import { Request, Response, NextFunction } from "express";
import multer from "multer";
import {
  getCurrentTenantDb,
  tenantConnectionManager,
} from "../../../utils/tenantConnectionManager";

/**
 * Maximum file size for import uploads.
 * Configurable via MAX_IMPORT_BYTES env var; defaults to 200 MB.
 * Exported so the controller can reuse the same limit in the stream path.
 */
export const MAX_IMPORT_BYTES = parseInt(
  process.env.MAX_IMPORT_BYTES || String(200 * 1024 * 1024),
  10,
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES },
});

/**
 * Re-enters the AsyncLocalStorage tenant context after multer's internal
 * callback chain has exited it.
 *
 * Problem: multer calls Express next() from inside its own async callback,
 * which exits the AsyncLocalStorage scope established by tenantMiddleware.
 * Every other route reaches next() directly and keeps the context intact;
 * only multer-wrapped routes lose it, causing getDb() to throw
 * "Tenant context required" in multi-tenant mode.
 *
 * Fix: if getCurrentTenantDb() is null but req.tenantId is already stamped
 * (by the global tenantMiddleware in both the x-tenant-id and JWT-fallback
 * auth paths), re-enter the context via runInTenantContext before the
 * controller runs. No-op in single-tenant mode.
 *
 * Must be placed AFTER importUploadMiddleware on every import route.
 */
export function tenantContextGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Single-tenant mode — nothing to guard.
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    next();
    return;
  }

  // ALS context is still live — proceed normally.
  if (getCurrentTenantDb()) {
    next();
    return;
  }

  // Context was lost by multer. Re-enter using req.tenantId that the global
  // tenantMiddleware already resolved and stamped on the request.
  const tenantId = (req as any).tenantId as string | undefined;
  if (!tenantId) {
    // No tenant identity on the request — let getDb() throw its usual error.
    next();
    return;
  }

  tenantConnectionManager
    .runInTenantContext(tenantId, () =>
      new Promise<void>((resolve, reject) => {
        res.on("finish", resolve);
        res.on("error", reject);
        next();
      }),
    )
    .catch(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: "Tenant database context unavailable" });
      }
    });
}

/**
 * Per-route multer middleware for the four import endpoints.
 * Expects a single file under the field name "file".
 *
 * Maps multer's LIMIT_FILE_SIZE to a 413 JSON response before any
 * controller code runs. Other multer errors surface as 400.
 * Leaves every other route (planning attachments, etc.) completely
 * unaffected — this middleware is applied per-route, not globally.
 */
export function importUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: `File too large. Maximum allowed size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`,
        });
        return;
      }
      res.status(400).json({ error: err.message || "File upload error" });
      return;
    }
    next();
  });
}
