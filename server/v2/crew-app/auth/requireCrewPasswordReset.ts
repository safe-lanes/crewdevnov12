import { Request, Response, NextFunction } from "express";
import { CrewCredentialsRepository } from "./repositories/crewCredentialsRepository";

const credentials = new CrewCredentialsRepository();

/** Blocks normal app APIs until a temporary password has been replaced. */
export async function requireCrewPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const credential = await credentials.findById(req.crewUser!.credentialId);
    if (!credential || credential.mustResetPassword) {
      res.status(403).json({ error: "password_reset_required", message: "Set a new password before using this resource" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "auth_state_unavailable", message: "Unable to verify password state" });
  }
}