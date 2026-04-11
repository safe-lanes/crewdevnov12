import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  tenantConnectionManager,
  TenantNotFoundError,
  TenantInactiveError,
  TenantDatabaseError,
} from "../utils/tenantConnectionManager";
import { extractToken } from "./authMiddleware";

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

type JwtFallbackResult =
  | { status: "domain"; domain: string }
  | { status: "no_token" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "no_domain" }
  | { status: "no_secret" };

function extractDomainFromJwt(req: Request): JwtFallbackResult {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return { status: "no_secret" };

  const token = extractToken(req);
  if (!token) return { status: "no_token" };

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { domain?: string };
    const domain =
      typeof decoded.domain === "string" ? decoded.domain.trim() : undefined;
    if (!domain) return { status: "no_domain" };
    return { status: "domain", domain };
  } catch (err: any) {
    if (err.name === "TokenExpiredError") return { status: "expired" };
    return { status: "invalid" };
  }
}

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    next();
    return;
  }

  if (isExempt(req.path)) {
    next();
    return;
  }

  const rawTenantId = req.headers["x-tenant-id"];
  const tenantId =
    typeof rawTenantId === "string" ? rawTenantId.trim() : undefined;

  if (!tenantId) {
    const jwtResult = extractDomainFromJwt(req);

    if (jwtResult.status === "expired") {
      res.status(401).json({
        error: "token_expired",
        message: "Authorization token has expired",
      });
      return;
    }

    if (jwtResult.status === "invalid") {
      res.status(401).json({
        error: "invalid_token",
        message: "Invalid authorization token",
      });
      return;
    }

    if (jwtResult.status === "domain") {
      tenantConnectionManager
        .resolveTenant(jwtResult.domain)
        .then((tenant) => {
          req.tenantId = tenant.tuid;
          return tenantConnectionManager.runInTenantContext(
            tenant.tuid,
            () => {
              return new Promise<void>((resolve, reject) => {
                res.on("finish", resolve);
                res.on("error", reject);
                next();
              });
            },
          );
        })
        .catch((err) => {
          if (res.headersSent) return;
          handleTenantError(res, err);
        });
      return;
    }

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
      return tenantConnectionManager.runInTenantContext(tenantId!, () => {
        return new Promise<void>((resolve, reject) => {
          res.on("finish", resolve);
          res.on("error", reject);
          next();
        });
      });
    })
    .catch((err) => {
      if (res.headersSent) return;
      handleTenantError(res, err);
    });
}

function handleTenantError(res: Response, err: unknown): void {
  if (err instanceof TenantNotFoundError) {
    res.status(403).json({
      error: "invalid_tenant",
      message: "The provided tenant identifier is not valid.",
    });
  } else if (err instanceof TenantInactiveError) {
    res.status(403).json({
      error: "tenant_inactive",
      message: (err as TenantInactiveError).message,
    });
  } else if (err instanceof TenantDatabaseError) {
    res.status(503).json({
      error: "Tenant database unavailable",
      message:
        "Unable to connect to the tenant database. Please try again later.",
    });
  } else {
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred during tenant resolution",
    });
  }
}
