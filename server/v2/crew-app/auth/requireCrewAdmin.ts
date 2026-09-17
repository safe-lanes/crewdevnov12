import { Request, Response, NextFunction } from "express";

// Mount AFTER crewAuthMiddleware — relies on req.crewUser already being set.
// Not a new auth mechanism, just a role check on the userType already decoded
// from the access token.
export function requireCrewAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.crewUser?.userType !== "Admin") {
    res.status(403).json({ error: "forbidden", message: "Admin role required" });
    return;
  }
  next();
}
