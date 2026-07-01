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
