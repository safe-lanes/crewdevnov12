import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { isExempt } from "./exemptPaths";

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
const IS_DEV = process.env.NODE_ENV === "development";

if (!JWT_SECRET) {
  if (IS_DEV) {
    console.warn(
      "⚠️  JWT_SECRET is not set. Authentication is disabled in development mode.",
    );
  } else {
    console.error(
      "⚠️  JWT_SECRET is not set. All protected API requests will be rejected with 401.",
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
    if (IS_DEV) {
      next();
      return;
    }
    res.status(401).json({
      error: "unauthorized",
      message: "Authentication service is not available",
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
