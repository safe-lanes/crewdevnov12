import type { Request } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { resolveRequestRole } from "../auth/roleResolutionService";

export type Resource = "comments" | "actions";
export type Actor = { uuid: string; name: string; designation: string };
export class InternalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
export const office = (value: unknown) => ["office", "sail admin"].includes(normalize(value));
export const tableFor = (resource: Resource) =>
  sql.raw(resource === "comments" ? "crew_internal_comments" : "crew_internal_actions");
export const historyFor = (resource: Resource) =>
  sql.raw(resource === "comments" ? "crew_internal_comments_events" : "crew_internal_actions_events");
export const menuFor = (resource: Resource) => resource === "comments" ? "Internal Comments" : "Internal Actions";
export const snapshotActor = (row: any): Actor => ({
  uuid: row.user_uuid,
  name: [row.fullname?.trim(), row.display_name?.trim(),
    [row.firstname, row.lastname].filter(Boolean).join(" ").trim()].find(Boolean) || "Name not recorded",
  designation: row.designation?.trim() || "designation not recorded",
});
export async function grants(db: any, roleId: string, resource: Resource) {
  const result = (await db.execute(sql`SELECT a.canview,a.cancreate,a.canedit,a.candelete
    FROM adm_roleaccess_ac a JOIN adm_menumaster_ac m ON m.muid=a.menu_id
    WHERE a.role_id=${roleId} AND NOT a.is_deleted AND NOT m.is_deleted AND m.is_active
    AND m.name=${menuFor(resource)}`)).rows;
  return result.length === 1 ? result[0] : { canview:false,cancreate:false,canedit:false,candelete:false };
}
export async function authorize(req: Request, resource: Resource, action = "canview") {
  const db = getDb(); // tenant context is mandatory in multi-tenant mode; no caller-selected connection.
  const role = await resolveRequestRole(req);
  if (!role.ok || !office(role.role.masterUserType) || !office(role.role.roleType))
    throw new InternalError(403, "Internal records are available only to authorised office users.");
  const users = (await db.execute(sql`SELECT * FROM master_users WHERE id=${role.role.masterUserId}
    AND user_uuid IS NOT NULL AND btrim(user_uuid)<>'' AND
    (SELECT count(*) FROM master_users u WHERE u.user_uuid=master_users.user_uuid)=1`)).rows;
  if (users.length !== 1) throw new InternalError(403, "Your office identity could not be verified. Contact your administrator.");
  const permissions = await grants(db,role.role.roleId,resource);
  if (!permissions.canview || permissions[action] !== true)
    throw new InternalError(403,"You do not have permission to access these internal records.");
  const crew = (await db.execute(sql`SELECT crew_uuid FROM crew_members_v2
    WHERE crew_uuid=${req.params.crewUuid} AND NOT is_deleted`)).rows;
  if (crew.length !== 1) throw new InternalError(404,"This seafarer record is not available.");
  return { db, actor:snapshotActor(users[0]), permissions };
}
export async function eligibleAssignees(db: any) {
  const rows = (await db.execute(sql`SELECT u.* FROM master_users u
    WHERE lower(btrim(u.user_type)) IN ('office','sail admin')
    AND u.user_uuid IS NOT NULL AND btrim(u.user_uuid)<>''
    AND (SELECT count(*) FROM master_users duplicate WHERE duplicate.user_uuid=u.user_uuid)=1
    AND (SELECT count(*) FROM adm_rolemaster_ac r WHERE lower(btrim(r.assigned_role))=lower(btrim(u.role))
      AND r.is_active AND NOT r.is_deleted)=1
    AND EXISTS(SELECT 1 FROM adm_rolemaster_ac r
      JOIN adm_roleaccess_ac a ON a.role_id=r.ruid
      JOIN adm_menumaster_ac m ON m.muid=a.menu_id
      WHERE lower(btrim(r.assigned_role))=lower(btrim(u.role))
      AND lower(btrim(r.roletype)) IN ('office','sail admin') AND r.is_active AND NOT r.is_deleted
      AND NOT a.is_deleted AND a.canview AND m.name='Internal Actions' AND m.is_active AND NOT m.is_deleted
      AND (SELECT count(*) FROM adm_roleaccess_ac a2 WHERE a2.role_id=r.ruid AND a2.menu_id=m.muid AND NOT a2.is_deleted)=1)
    ORDER BY u.fullname,u.id`)).rows;
  return rows.map(snapshotActor);
}
