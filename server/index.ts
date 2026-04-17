import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrationRunner";
import { tenantConnectionManager } from "./utils/tenantConnectionManager";
import { tenantMiddleware } from "./middleware/tenantMiddleware";
import { authMiddleware } from "./middleware/authMiddleware";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Please try again later." },
  skip: (req) => req.path === "/api/health",
});

const tenantInitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Tenant init rate limit exceeded. Please try again later." },
});

app.use("/api/", apiLimiter);
app.use("/api/v2/tenant/init", tenantInitLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Never log auth response bodies — they contain access/refresh tokens
      // and dev reset tokens which must not appear in server logs.
      const isAuthPath = path.startsWith("/api/v2/auth/");
      if (capturedJsonResponse && !isAuthPath) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run database migrations automatically before starting server
  await runMigrations();

  // Initialize multi-tenant connection manager (no-op if MASTER_DATABASE_URL not set)
  await tenantConnectionManager.init();

  // Apply tenant middleware before routes
  app.use(tenantMiddleware);

  // Apply JWT auth middleware after tenant resolution
  app.use(authMiddleware);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    
    // Log error but don't throw - prevents unnecessary server shutdowns
    log(`API Error ${status}: ${message}`);
    if (status >= 500) {
      log(`Server Error Details: ${err.stack || err}`);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const httpServer = server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });

  // Handle port conflicts explicitly
  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use. Please ensure no other process is using this port.`);
      process.exit(1);
    } else {
      log(`Server error: ${err.message}`);
      throw err;
    }
  });

  // Graceful shutdown handling to prevent port conflicts
  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    log(`${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      log('HTTP server closed.');
      await tenantConnectionManager.closeAll();
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      log('Forcing server close after 10 seconds...');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Used by nodemon

  // Handle uncaught errors to prevent crashes
  process.on('uncaughtException', (err) => {
    log(`Uncaught Exception: ${err.message}`);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    log(`Unhandled Rejection: ${reason}`);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
})();
