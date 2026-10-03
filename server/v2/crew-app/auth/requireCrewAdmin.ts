import { Request, Response, NextFunction } from "express";
import { requireMobileRole } from "../authorization";

// Mount AFTER crewAuthMiddleware — relies on req.crewUser already being set.
// Not a new auth mechanism, just a role check on the userType already decoded
// from the access token.
export function requireCrewAdmin(req: Request, res: Response, next: NextFunction): void {
  requireMobileRole("Admin")(req, res, next);
}
