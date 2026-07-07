import type { RequestActor } from "../controllers/_auth";

/**
 * Server-side vessel scoping for vessel-role ("Ship") users (Prompt 06).
 *
 * Fail-closed: a Ship user with no `vessels` claim in their JWT is denied all
 * vessel-scoped operations. Office users (and dev-bypass requests with no
 * token) are unrestricted. The parent SAIL Audits app must include the
 * `vessels` claim for vessel roles — see docs/deployment-checklist.md.
 */
function forbidden(message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = "FORBIDDEN";
  return err;
}

export function assertVesselScope(
  actor: RequestActor | undefined,
  vesselUuid: string | null | undefined,
): void {
  if (!actor?.vesselUser) return;
  if (!vesselUuid) {
    throw forbidden("Vessel users must operate on a specific vessel");
  }
  if (actor.vessels.length === 0 || !actor.vessels.includes(vesselUuid)) {
    throw forbidden("You are not assigned to this vessel");
  }
}

export function assertOfficeUser(
  actor: RequestActor | undefined,
  action: string,
): void {
  if (actor?.vesselUser) {
    throw forbidden(`${action} is an office action`);
  }
}
