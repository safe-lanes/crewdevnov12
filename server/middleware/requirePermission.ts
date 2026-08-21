import type { NextFunction, Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../v2/db";
import { admMenuMasterAc, admRoleAccessAc } from "../../shared/v2/admin/schema";
import { resolveRequestRole } from "../v2/auth/roleResolutionService";

export type PermissionAction = "view" | "create" | "edit" | "delete";

type PermissionColumn = "canview" | "cancreate" | "canedit" | "candelete";

export type PermissionMiddleware = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>) & {
  permissionRequirement: {
    menuName: string;
    action: PermissionAction;
  };
};

const ACTION_COLUMNS: Record<PermissionAction, PermissionColumn> = {
  view: "canview",
  create: "cancreate",
  edit: "canedit",
  delete: "candelete",
};

function deny(res: Response): void {
  res.status(403).json({
    error: "forbidden",
    message: "You do not have permission to perform this action.",
  });
}

/**
 * Requires one explicit Access Control action for a named active menu.
 * Callers must select the action per route; this middleware never infers it
 * from an HTTP method.
 */
export function requirePermission(
  menuName: string,
  action: PermissionAction,
) : PermissionMiddleware {
  const middleware = (async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const roleResolution = await resolveRequestRole(req);
    if (!roleResolution.ok) {
      console.error("[RequirePermission] denied_unresolved_role", {
        menuName,
        action,
        reason: roleResolution.reason,
      });
      deny(res);
      return;
    }

    try {
      const db = getDb();
      const normalizedMenuName = menuName.trim().toLocaleLowerCase();
      const menus = await db
        .select({ menuId: admMenuMasterAc.muid })
        .from(admMenuMasterAc)
        .where(
          and(
            eq(admMenuMasterAc.isDeleted, false),
            eq(admMenuMasterAc.isActive, true),
            sql`lower(btrim(${admMenuMasterAc.name})) = ${normalizedMenuName}`,
          ),
        );

      if (menus.length !== 1) {
        console.error("[RequirePermission] denied_menu_resolution", {
          menuName,
          action,
          matches: menus.length,
        });
        deny(res);
        return;
      }

      const grants = await db
        .select({
          canview: admRoleAccessAc.canview,
          cancreate: admRoleAccessAc.cancreate,
          canedit: admRoleAccessAc.canedit,
          candelete: admRoleAccessAc.candelete,
        })
        .from(admRoleAccessAc)
        .where(
          and(
            eq(admRoleAccessAc.roleId, roleResolution.role.roleId),
            eq(admRoleAccessAc.menuId, menus[0].menuId),
            eq(admRoleAccessAc.isDeleted, false),
          ),
        );

      if (grants.length !== 1) {
        console.error("[RequirePermission] denied_grant_resolution", {
          menuName,
          action,
          roleId: roleResolution.role.roleId,
          matches: grants.length,
        });
        deny(res);
        return;
      }

      const requiredColumn = ACTION_COLUMNS[action];
      if (grants[0][requiredColumn] !== true) {
        console.error("[RequirePermission] denied_missing_grant", {
          menuName,
          action,
          roleId: roleResolution.role.roleId,
        });
        deny(res);
        return;
      }

      next();
    } catch (error: unknown) {
      console.error("[RequirePermission] permission_check_error", {
        menuName,
        action,
        roleId: roleResolution.role.roleId,
        error,
      });
      deny(res);
    }
  }) as PermissionMiddleware;

  middleware.permissionRequirement = { menuName, action };
  return middleware;
}