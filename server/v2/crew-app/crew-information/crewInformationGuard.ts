import { Request, Response, NextFunction } from "express";
import { CrewCredentialsRepository } from "../auth/repositories/crewCredentialsRepository";
import { crewMembersService } from "../../crew-pool/services";

const credentials = new CrewCredentialsRepository();

/** Re-checks the credential and linked crew on every request (JWT claims are not state). */
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