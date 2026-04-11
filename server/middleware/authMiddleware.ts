import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";

export interface JwtPayload {
  id: number;
  domain: string;
  userType: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tokenData?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "⚠️  JWT_SECRET is not set. All protected API requests will be rejected with 401.",
  );
}

const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

const FILE_SERVING_PREFIXES = [
  "/api/v2/crew-pool/crew/",
  "/api/v2/recruitment/",
  "/api/v2/drugs-alcohol/",
  "/api/v2/vessel/",
];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}

function isFileServingRoute(path: string): boolean {
  return FILE_SERVING_PREFIXES.some(
    (prefix) =>
      path.startsWith(prefix) &&
      (path.includes("/download") ||
        path.includes("/attachment") ||
        path.includes("/document") ||
        path.includes("/file")),
  );
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function extractTokenWithQueryFallback(req: Request): string | null {
  const headerToken = extractToken(req);
  if (headerToken) return headerToken;

  if (isFileServingRoute(req.path)) {
    const queryToken = req.query.sail;
    if (typeof queryToken === "string" && queryToken.length > 0) {
      return queryToken;
    }
  }

  return null;
}

function isJwtError(err: unknown): err is { name: string; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    typeof (err as { name: unknown }).name === "string"
  );
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isExempt(req.path)) {
    next();
    return;
  }

  if (!JWT_SECRET) {
    res.status(401).json({
      error: "unauthorized",
      message: "Authentication service is not available",
    });
    return;
  }

  const token = extractTokenWithQueryFallback(req);

  if (!token) {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing authorization token",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    req.tokenData = decoded;

    if (
      tenantConnectionManager.isMultiTenantEnabled &&
      req.tenantId &&
      decoded.domain
    ) {
      verifyTenantBinding(decoded.domain, req.tenantId)
        .then((valid) => {
          if (!valid) {
            res.status(403).json({
              error: "tenant_mismatch",
              message:
                "Authorization token does not match the requested tenant",
            });
            return;
          }
          next();
        })
        .catch(() => {
          res.status(403).json({
            error: "tenant_mismatch",
            message: "Unable to verify tenant authorization",
          });
        });
      return;
    }

    next();
  } catch (err: unknown) {
    if (isJwtError(err) && err.name === "TokenExpiredError") {
      res.status(401).json({
        error: "token_expired",
        message: "Authorization token has expired",
      });
      return;
    }

    res.status(401).json({
      error: "invalid_token",
      message: "Invalid authorization token",
    });
    return;
  }
}

async function verifyTenantBinding(
  jwtDomain: string,
  requestTenantId: string,
): Promise<boolean> {
  try {
    const resolved = await tenantConnectionManager.resolveTenant(jwtDomain);
    return resolved.tuid === requestTenantId;
  } catch {
    return false;
  }
}
