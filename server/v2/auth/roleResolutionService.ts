import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { masterUsers } from "../../../shared/schema";
import { admRoleMasterAc } from "../../../shared/v2/admin/schema";

export type RoleResolutionFailureReason =
  | "no_authenticated_user"
  | "user_not_found"
  | "identity_mismatch"
  | "role_not_matched"
  | "role_ambiguous"
  | "resolution_error";

export type ResolvedRole = {
  roleId: string;
  roleName: string;
  masterUserId: number;
};

export type RoleResolution =
  | { ok: true; role: ResolvedRole }
  | { ok: false; reason: RoleResolutionFailureReason };

declare global {
  namespace Express {
    interface Request {
      resolvedRole?: RoleResolution;
    }
  }
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function rememberResolution(req: Request, resolution: RoleResolution): RoleResolution {
  req.resolvedRole = resolution;
  return resolution;
}

/**
 * Resolves the authenticated parent-app actor to this tenant's Access Control
 * role. The JWT-to-master_users ID mapping is intentionally guarded by a
 * userType assertion, so an incorrect cross-application mapping fails closed.
 */
export async function resolveRequestRole(req: Request): Promise<RoleResolution> {
  if (req.resolvedRole) {
    return req.resolvedRole;
  }

  if (!req.user) {
    return rememberResolution(req, { ok: false, reason: "no_authenticated_user" });
  }

  try {
    const db = getDb();
    const users = await db
      .select({
        id: masterUsers.id,
        userType: masterUsers.userType,
        role: masterUsers.role,
      })
      .from(masterUsers)
      // master_users has no lifecycle or soft-delete column. A matching ID is
      // therefore the complete definition of an active master user here.
      .where(eq(masterUsers.id, req.user.id))
      .limit(1);
    const user = users[0];

    if (!user) {
      return rememberResolution(req, { ok: false, reason: "user_not_found" });
    }

    const masterUserType = normalize(user.userType);
    const jwtUserType = normalize(req.user.userType);
    if (!masterUserType || !jwtUserType || masterUserType !== jwtUserType) {
      console.error("[RoleResolution] identity_mismatch", {
        masterUserId: user.id,
        masterUserType: user.userType,
        jwtUserType: req.user.userType,
      });
      return rememberResolution(req, { ok: false, reason: "identity_mismatch" });
    }

    const normalizedRole = normalize(user.role);
    if (!normalizedRole) {
      return rememberResolution(req, { ok: false, reason: "role_not_matched" });
    }

    const roles = await db
      .select({
        roleId: admRoleMasterAc.ruid,
        roleName: admRoleMasterAc.assignedRole,
      })
      .from(admRoleMasterAc)
      .where(
        and(
          eq(admRoleMasterAc.isDeleted, false),
          eq(admRoleMasterAc.isActive, true),
          sql`lower(btrim(${admRoleMasterAc.assignedRole})) = ${normalizedRole}`,
        ),
      );

    if (roles.length === 0) {
      return rememberResolution(req, { ok: false, reason: "role_not_matched" });
    }

    if (roles.length !== 1) {
      console.error("[RoleResolution] role_ambiguous", {
        masterUserId: user.id,
        masterUserRole: user.role,
        matchingRoleIds: roles.map((role: { roleId: string }) => role.roleId),
      });
      return rememberResolution(req, { ok: false, reason: "role_ambiguous" });
    }

    return rememberResolution(req, {
      ok: true,
      role: {
        roleId: roles[0].roleId,
        roleName: roles[0].roleName,
        masterUserId: user.id,
      },
    });
  } catch (error: unknown) {
    console.error("[RoleResolution] resolution_error", {
      actorId: req.user.id,
      error,
    });
    return rememberResolution(req, { ok: false, reason: "resolution_error" });
  }
}