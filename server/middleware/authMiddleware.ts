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

const EXEMPT_PATHS = ["/api/v2/tenant/init", "/api/health"];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p)) return true;
  if (!path.startsWith("/api/v2/")) return true;
  return false;
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const queryToken = req.query.sail;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }

  return null;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!JWT_SECRET) {
    next();
    return;
  }

  if (isExempt(req.path)) {
    next();
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
          next();
        });
      return;
    }

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
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
