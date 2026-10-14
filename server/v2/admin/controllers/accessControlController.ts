import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { accessControlService } from "../services";
import { resolveRequestRole } from "../../auth/roleResolutionService";
import { accessControlAuthority, saveActionDecisions } from "../services/accessControlManagement";
import { writeCatalogue, writeMenuGrants } from "../services/accessControlWrites";

export function accessControlHandler(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { res.json(await fn(req)); }
    catch (error: any) {
      console.error("[AccessControl]", error);
      res.status(error.status ?? 500).json({ message: error.status ? error.message : "Access Control operation failed." });
    }
  };
}
export const accessControlController = {
  getAllMenus: accessControlHandler(() => accessControlService.getAllMenus()),
  createMenu: accessControlHandler(req => writeCatalogue(req, "menu", "create")),
  updateMenu: accessControlHandler(req => writeCatalogue(req, "menu", "update", req.params.muid)),
  deleteMenu: accessControlHandler(async req => ({ success: await writeCatalogue(req, "menu", "delete", req.params.muid) })),
  getAllRoles: accessControlHandler(req => accessControlService.getAllRoles(req.query.includeInactive === "true")),
  createRole: accessControlHandler(req => writeCatalogue(req, "role", "create")),
  updateRole: accessControlHandler(req => writeCatalogue(req, "role", "update", req.params.ruid)),
  deleteRole: accessControlHandler(async req => ({ success: await writeCatalogue(req, "role", "delete", req.params.ruid) })),
  async getMyPermissions(req: Request, res: Response) {
    try {
      const resolution = await resolveRequestRole(req);
      if (!resolution.ok) return res.status(403).json({ error: "forbidden", message: "Unable to resolve permissions for this user." });
      const result = await accessControlService.getMyPermissions(resolution.role.roleId, resolution.role.roleName, resolution.role.roleType);
      res.json({ ...result, accessControlManagement: (await accessControlAuthority(req)).allowed });
    } catch (error) {
      console.error("[AccessControl] permissions lookup failed", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  },
  getPermissions: accessControlHandler(req => accessControlService.getPermissionsByRoleUuid(req.params.ruid)),
  savePermissions: accessControlHandler(req => writeMenuGrants(req, req.params.ruid)),
  state: accessControlHandler(req => accessControlAuthority(req)),
  getManagement: accessControlHandler(async req => {
    const row = (await getDb().execute(sql`SELECT allowed FROM adm_resource_action_grants
      WHERE role_id=${req.params.ruid} AND resource='access_control' AND action='manage'`)).rows[0];
    return { allowed: row?.allowed === true };
  }),
  saveManagement: accessControlHandler(async req => {
    const parsed = z.object({ allowed: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) throw Object.assign(new Error("Supply only the allowed management flag."), { status: 400 });
    return saveActionDecisions(req, req.params.ruid, "access_control", { manage: parsed.data.allowed })
      .then(d => ({ allowed: d.manage }));
  }),
  audit: accessControlHandler(async req => {
    const filter = typeof req.query.filter === "string" ? req.query.filter : "all";
    const condition = filter === "management" ? sql`resource='access_control' AND action='manage'` :
      filter === "void_completed" ? sql`resource='company_forms' AND action='void_completed'` :
      filter === "parent_sync" ? sql`event LIKE 'parent_sync%'` : sql`true`;
    const role = typeof req.query.roleId === "string" ? sql`AND role_id=${req.query.roleId}` : sql``;
    return (await getDb().execute(sql`SELECT * FROM adm_access_control_audit WHERE ${condition} ${role}
      ORDER BY id DESC LIMIT 500`)).rows;
  }),
};
