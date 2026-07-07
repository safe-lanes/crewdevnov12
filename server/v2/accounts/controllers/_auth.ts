import { Request } from "express";

/**
 * Resolve the audit user from the authenticated request.
 *
 * The parent-app (SAIL Audits) JWT carries a numeric `id` (plus `domain` and
 * `userType`), not a user uuid, so we record the authenticated principal id as
 * the audit actor. This is always server-derived and therefore non-spoofable —
 * controllers must NEVER read the audit user from the request body or query.
 */
export function getAuditUserUuid(req: Request): string | undefined {
  const id = req.user?.id;
  return id != null ? String(id) : undefined;
}

/**
 * Server-derived request actor for vessel scoping (Prompt 06).
 *
 * Vessel-role users carry `userType: "Ship"` in the parent-app JWT (same
 * convention the Rest Hours module keys on) plus an optional `vessels` claim
 * listing their assigned vessel UUIDs. Office (non-Ship) users — and dev
 * requests with AUTH_BYPASS and no token — are unrestricted.
 */
export interface RequestActor {
  vesselUser: boolean;
  vessels: string[];
  auditUserUuid?: string;
}

export function getActor(req: Request): RequestActor {
  const userType = req.user?.userType;
  const vesselUser =
    typeof userType === "string" && userType.toLowerCase() === "ship";
  const raw = req.user?.vessels;
  const vessels = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  return { vesselUser, vessels, auditUserUuid: getAuditUserUuid(req) };
}
