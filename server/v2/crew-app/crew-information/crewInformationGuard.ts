import { Request, Response, NextFunction } from "express";
import { CrewCredentialsRepository } from "../auth/repositories/crewCredentialsRepository";
import { crewMembersService } from "../../crew-pool/services";

const credentials = new CrewCredentialsRepository();

/**
 * Re-checks the credential and linked crew on every request (JWT claims are not state).
 *
 * userType !== "Crew" is rejected outright — including Admin. This means an
 * Admin who is also crew currently gets a blanket 403 viewing their OWN
 * profile/documents/etc. via this module, with no specific UI messaging for
 * it (falls into CrewCollectionScreen/CrewProfileScreen's generic error
 * state on the mobile client). Flagged in review as undocumented; left
 * as-is pending a product decision on whether that's actually intended
 * (e.g. "admins manage their own record elsewhere") — if not, the fix is to
 * allow `user.userType === "Crew" || user.userType === "Admin"` here, scoped
 * to the credential's own crewUuid exactly as the Crew case already is below.
 */
export async function requireCurrentCrew(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.crewUser;
    if (!user || user.userType !== "Crew") {
      res.status(403).json({ error: "crew_access_required" });
      return;
    }
    const credential = await credentials.findById(user.credentialId);
    if (!credential || credential.isDeleted || !credential.isActive ||
        credential.domain !== user.domain || credential.crewUuid !== user.crewUuid ||
        credential.userType !== "Crew") {
      res.status(401).json({ error: "credential_inactive", message: "Crew credential is no longer valid" });
      return;
    }
    const crew = await crewMembersService.getByUuid(user.crewUuid);
    if (!crew || crew.isDeleted || crew.isActive === false || crew.crewUuid !== credential.crewUuid) {
      res.status(403).json({ error: "crew_inactive", message: "Linked crew record is not active" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "credential_inactive", message: "Unable to verify crew state" });
  }
}