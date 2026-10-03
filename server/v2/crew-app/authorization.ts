import type { NextFunction, Request, Response } from "express";
import { emitCrewSecurityEvent } from "./monitoring/securityEvents";

export function authenticatedMobileIdentity(req: Request) {
  if (!req.crewUser) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return req.crewUser;
}

export function requireMobileRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.crewUser?.userType;
    if (!role || !allowed.includes(role)) {
      emitCrewSecurityEvent({ event: "authorization_deny", correlationId: req.requestId, actorId: req.crewUser?.credentialId, tenantId: req.crewUser?.domain, resourceType: "route", result: "denied", reasonCode: "role_not_granted" });
      res.status(403).json({ error: "forbidden", message: "Required role not granted" });
      return;
    }
    next();
  };
}

/** Fail with 404 so resource existence is never disclosed across owners. */
export function requireResourceOwnership(req: Request, resource: { crewUuid?: unknown } | null | undefined): void {
  const identity = authenticatedMobileIdentity(req);
  if (!resource || resource.crewUuid !== identity.crewUuid) {
    emitCrewSecurityEvent({ event: "ownership_deny", correlationId: req.requestId, actorId: identity.credentialId, tenantId: identity.domain, resourceType: "crew_resource", result: "denied", reasonCode: "owner_mismatch_or_absent" });
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
}
