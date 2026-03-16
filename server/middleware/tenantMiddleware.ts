import { Request, Response, NextFunction } from "express";
import {
  tenantConnectionManager,
  TenantNotFoundError,
  TenantInactiveError,
  TenantDatabaseError,
} from "../utils/tenantConnectionManager";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    next();
    return;
  }

  if (isExempt(req.path)) {
    next();
    return;
  }

  const tenantId = req.headers["x-tenant-id"] as string | undefined;

  if (!tenantId) {
    res.status(400).json({
      error: "Missing x-tenant-id header",
      message: "Tenant identification is required for all API requests",
    });
    return;
  }

  req.tenantId = tenantId;

  tenantConnectionManager
    .validateTuid(tenantId)
    .then(() => {
      return tenantConnectionManager.runInTenantContext(tenantId, () => {
        return new Promise<void>((resolve, reject) => {
          res.on("finish", resolve);
          res.on("error", reject);
          next();
        });
      });
    })
    .catch((err) => {
      if (res.headersSent) return;

      if (err instanceof TenantNotFoundError) {
        res.status(403).json({
          error: "invalid_tenant",
          message: "The provided tenant identifier is not valid.",
        });
      } else if (err instanceof TenantInactiveError) {
        res.status(403).json({
          error: "tenant_inactive",
          message: err.message,
        });
      } else if (err instanceof TenantDatabaseError) {
        res.status(503).json({
          error: "Tenant database unavailable",
          message: "Unable to connect to the tenant database. Please try again later.",
        });
      } else {
        res.status(500).json({
          error: "Internal server error",
          message: "An unexpected error occurred during tenant resolution",
        });
      }
    });
}
