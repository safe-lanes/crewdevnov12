import type { NextFunction, Request, Response } from "express";
import { getActor } from "../../accounts/controllers/_auth";
import { SHIP_READ_ONLY_ERROR } from "../utils/planningFieldOwnership";

// VS-04: planning is office-owned. Ship users get 403 on the planning write
// routes that use this guard. Company-form routes are not guarded.
export function denyShipPlanningWrites(req: Request, res: Response, next: NextFunction) {
  if (getActor(req).vesselUser) {
    return res.status(403).json({ error: SHIP_READ_ONLY_ERROR });
  }
  next();
}
