import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";

// Fully independent of server/middleware/authMiddleware.ts and tenantMiddleware.ts —
// this module must never import from either, and must never reference JWT_SECRET.
// Routes protected by this middleware are mounted outside /api/v2/, so the legacy
// tenant+auth middleware never runs against them in the first place; this is the
// only auth boundary for those routes.

const ACCESS_TOKEN_SECRET = process.env.CREW_APP_ACCESS_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  throw new Error(
    "CREW_APP_ACCESS_TOKEN_SECRET is not set. This is required for the crew mobile app auth module and must be distinct from JWT_SECRET.",
  );
}

export interface CrewUser {
  credentialId: number;
  crewUuid: string;
  domain: string;
  userType: string;
}

declare global {
  namespace Express {
    interface Request {
      crewUser?: CrewUser;
      crewTuid?: string;
    }
  }
}

function extractCrewBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function crewAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractCrewBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Missing authorization token" });
    return;
  }

  let decoded: { sub: number; crewId: string; domain: string; userType: string };
  try {
    decoded = jwt.verify(token, ACCESS_TOKEN_SECRET!) as unknown as typeof decoded;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({ error: "token_expired", message: "Access token has expired" });
      return;
    }
    res.status(401).json({ error: "invalid_token", message: "Invalid access token" });
    return;
  }

  tenantConnectionManager
    .resolveTenant(decoded.domain)
    .then(({ tuid }) => {
      req.crewUser = {
        credentialId: decoded.sub,
        crewUuid: decoded.crewId,
        domain: decoded.domain,
        userType: decoded.userType,
      };
      req.crewTuid = tuid;

      return tenantConnectionManager.runInTenantContext(
        tuid,
        () =>
          new Promise<void>((resolve, reject) => {
            res.on("finish", resolve);
            res.on("error", reject);
            next();
          }),
        decoded.domain,
      );
    })
    .catch((err: any) => {
      res.status(err?.status ?? 500).json({
        error: "tenant_resolution_failed",
        message: err?.message ?? "Unable to resolve tenant for this request",
      });
    });
}
