import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { runInCrewAppTenant } from "../tenantContext";
import { CrewCredentialsRepository } from "./repositories/crewCredentialsRepository";
import { emitCrewSecurityEvent } from "../monitoring/securityEvents";

// Fully independent of server/middleware/authMiddleware.ts and tenantMiddleware.ts —
// this module must never import from either, and must never reference JWT_SECRET.
// Routes protected by this middleware are mounted outside /api/v2/, so the legacy
// tenant+auth middleware never runs against them in the first place; this is the
// only auth boundary for those routes.

const ACCESS_TOKEN_SECRET = process.env.CREW_APP_ACCESS_TOKEN_SECRET;
const credentialsRepository = new CrewCredentialsRepository();

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

  let decoded: { sub: number; crewId: string; domain: string; userType: string; sessionVersion: number; tokenType: string };
  try {
    decoded = jwt.verify(token, ACCESS_TOKEN_SECRET!, { algorithms: ["HS256"] }) as unknown as typeof decoded;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({ error: "token_expired", message: "Access token has expired" });
      return;
    }
    res.status(401).json({ error: "invalid_token", message: "Invalid access token" });
    return;
  }

  if (decoded.tokenType !== "access" || !Number.isInteger(decoded.sessionVersion)) {
    res.status(401).json({ error: "invalid_token", message: "Invalid access token" });
    return;
  }

  runInCrewAppTenant(decoded.domain, async (tuid) => {
      const credential = await credentialsRepository.findById(decoded.sub);
      if (credential && credential.domain !== decoded.domain) {
        emitCrewSecurityEvent({ event: "tenant_mismatch", correlationId: req.requestId, actorId: decoded.sub, tenantId: decoded.domain, resourceType: "crew_session", result: "denied", reasonCode: "credential_domain_mismatch" });
      }
      if (!credential || credential.isActive === false || credential.crewUuid !== decoded.crewId ||
          credential.domain !== decoded.domain || credential.userType !== decoded.userType ||
          (credential.sessionVersion ?? 0) !== decoded.sessionVersion) {
        emitCrewSecurityEvent({ event: "session_revoke", correlationId: req.requestId, actorId: decoded.sub, tenantId: decoded.domain, resourceType: "crew_session", result: "denied", reasonCode: "session_state_mismatch" });
        throw Object.assign(new Error("Session is no longer active"), { status: 401, code: "session_revoked" });
      }
      req.crewUser = {
        credentialId: decoded.sub,
        crewUuid: decoded.crewId,
        domain: decoded.domain,
        userType: decoded.userType,
      };
      if (tuid) req.crewTuid = tuid;
      return new Promise<void>((resolve, reject) => {
        res.on("finish", resolve);
        res.on("error", reject);
        next();
      });
    })
    .catch((err: any) => {
      res.status(err?.status ?? 500).json({
        error: err?.code ?? "tenant_resolution_failed",
        message: err?.status === 401 ? "Session is no longer active" : "Unable to resolve tenant for this request",
      });
    });
}
