import type { NextFunction, Request, Response } from "express";
import { accessControlAuthority } from "../v2/admin/services/accessControlManagement";

function deny(res: Response): void {
  res.status(403).json({
    error: "forbidden",
    message: "You do not have permission to manage Access Control.",
  });
}

export function requireTrustedAccessControlAdmin() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
    if (!(await accessControlAuthority(req)).allowed) {
      deny(res);
      return;
    }
    next();
    } catch (error) {
      console.error("[AccessControlAdmin] trusted authority lookup failed", error);
      deny(res);
    }
  };
}