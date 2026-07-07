import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { isExempt } from "./exemptPaths";

export interface JwtPayload {
  id: number;
  domain: string;
  userType: string;
  /**
   * Optional vessel assignments for vessel-role ("Ship") users.
   * When present, vessel-scoped endpoints (accounts vessel-portage / CTM /
   * monthly transactions) enforce that Ship users only mutate data for these
   * vessel UUIDs. Provided by the parent SAIL Audits app; see
   * docs/deployment-checklist.md.
   */
  vessels?: string[];
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
const IS_DEV = process.env.NODE_ENV === "development";
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true" && IS_DEV;

if (!JWT_SECRET) {
  if (AUTH_BYPASS) {
    console.warn(
      "⚠️  AUTH_BYPASS=true: JWT authentication is disabled. Do NOT use in production.",
    );
  } else if (IS_DEV) {
    throw new Error(
      "JWT_SECRET is not set and AUTH_BYPASS is not enabled. " +
        "Set JWT_SECRET for real auth, or set AUTH_BYPASS=true to skip auth in development.",
    );
  } else {
    throw new Error(
      "JWT_SECRET is not set. This is required in production. " +
        "Set JWT_SECRET to the shared secret matching the parent SAIL Audits app.",
    );
  }
}

const FILE_SERVING_SEGMENTS = [
  "/download",
  "/attachment",
  "/attachments",
  "/document",
  "/documents",
  "/file",
  "/files",
];

function isFileServingRoute(path: string): boolean {
  if (!path.startsWith("/api/v2/")) return false;
  return FILE_SERVING_SEGMENTS.some((seg) => path.includes(seg));
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function extractToken(req: Request): string | null {
  const headerToken = extractBearerToken(req);
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
    if (AUTH_BYPASS) {
      // Dev-only impersonation: with AUTH_BYPASS active there is no secret to
      // verify against, but if the caller supplies a Bearer token we decode it
      // (unverified) so integration tests can simulate user roles (e.g. a
      // vessel "Ship" user with a `vessels` claim). Never runs in production —
      // AUTH_BYPASS requires NODE_ENV=development.
      const bypassToken = extractToken(req);
      if (bypassToken) {
        const decoded = jwt.decode(bypassToken);
        if (decoded && typeof decoded === "object") {
          req.user = decoded as JwtPayload;
          req.tokenData = decoded as JwtPayload;
        }
      }
      next();
      return;
    }
    res.status(500).json({
      error: "server_configuration_error",
      message: "Authentication service is not configured",
    });
    return;
  }

  if (req.tokenData) {
    req.user = req.tokenData;
    proceedWithTenantBinding(req, res, next);
    return;
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing authorization token",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (typeof decoded.domain === "string") {
      decoded.domain = decoded.domain.trim();
    }
    req.user = decoded;
    req.tokenData = decoded;
    proceedWithTenantBinding(req, res, next);
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

function proceedWithTenantBinding(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    next();
    return;
  }

  if (!req.tenantId) {
    if (IS_DEV) {
      next();
      return;
    }
    res.status(500).json({
      error: "server_configuration_error",
      message: "Tenant context was not established before authentication",
    });
    return;
  }

  const decoded = req.tokenData!;
  if (!decoded.domain) {
    if (IS_DEV) {
      next();
      return;
    }
    res.status(403).json({
      error: "tenant_mismatch",
      message: "Authorization token is missing required domain claim",
    });
    return;
  }

  if (req.jwtDomain && req.jwtDomain === decoded.domain) {
    next();
    return;
  }

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
