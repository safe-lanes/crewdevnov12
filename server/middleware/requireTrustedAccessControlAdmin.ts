import type { NextFunction, Request, Response } from "express";
import { resolveRequestRole } from "../v2/auth/roleResolutionService";

// These roles come from the parent application's master-user assignment, not
// from editable adm_roleaccess_ac grant rows. They are the trusted actors who
// can repair the authorization catalogue without being able to self-escalate
// through that catalogue first.
const TRUSTED_ACCESS_CONTROL_ROLES = new Set([
  "admin",
  "super admin",
  "sail admin",
]);

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
    const roleResolution = await resolveRequestRole(req);
    if (
      !roleResolution.ok ||
      !TRUSTED_ACCESS_CONTROL_ROLES.has(
        roleResolution.role.roleName.trim().toLocaleLowerCase(),
      )
    ) {
      console.error("[AccessControlAdmin] denied", {
        reason: roleResolution.ok ? "not_trusted_admin_role" : roleResolution.reason,
      });
      deny(res);
      return;
    }

    next();
  };
}