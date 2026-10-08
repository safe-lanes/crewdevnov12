import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { COMPANY_FORMS_RESOURCE, COMPANY_FORM_PERMISSIONS, emptyCompanyFormGrants,
  type CompanyFormGrants, type CompanyFormPermission } from "../../../../shared/v2/admin/companyFormPermissions";

export async function readCompanyFormGrants(roleId: string, executor: any = getDb()): Promise<CompanyFormGrants> {
  const result = await executor.execute(sql`
    SELECT g.action, g.allowed FROM adm_resource_action_grants g
    JOIN adm_permission_actions a ON a.resource=g.resource AND a.action=g.action
    JOIN adm_rolemaster_ac r ON r.ruid=g.role_id
    WHERE g.role_id=${roleId} AND g.resource=${COMPANY_FORMS_RESOURCE}
      AND r.is_active=true AND COALESCE(r.is_deleted,false)=false
  `);
  const grants = emptyCompanyFormGrants();
  for (const row of result.rows as { action: CompanyFormPermission; allowed: boolean }[]) {
    if (Object.hasOwn(grants, row.action)) grants[row.action] = row.allowed === true;
  }
  return grants;
}

export async function saveCompanyFormGrants(roleId: string, grants: CompanyFormGrants, actorId: string) {
  await getDb().transaction(async (tx: any) => {
    const role = await tx.execute(sql`SELECT ruid FROM adm_rolemaster_ac
      WHERE ruid=${roleId} AND is_active=true AND COALESCE(is_deleted,false)=false FOR SHARE`);
    if (role.rows.length !== 1) throw new Error("Active role not found.");
    for (const { action } of COMPANY_FORM_PERMISSIONS) {
      await tx.execute(sql`INSERT INTO adm_resource_action_grants
        (role_id,resource,action,allowed,updated_by_uuid)
        VALUES (${roleId},${COMPANY_FORMS_RESOURCE},${action},${grants[action]},${actorId})
        ON CONFLICT (role_id,resource,action) DO UPDATE
        SET allowed=EXCLUDED.allowed, updated_by_uuid=EXCLUDED.updated_by_uuid, updated_at=now()`);
    }
  });
  return readCompanyFormGrants(roleId);
}
