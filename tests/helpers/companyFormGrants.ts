import { COMPANY_FORM_PERMISSIONS } from "../../shared/v2/admin/companyFormPermissions";
/** Explicit grants for unique test-owned parent roles, never legacy inference. */
export async function grantCompanyFormFixture(db: any, roleId: string, mode: "office" | "view" | "vessel") {
  for (const { action } of COMPANY_FORM_PERMISSIONS) {
    const allowed = mode === "office" || action === "view" ||
      (mode === "vessel" && (action === "fill_in" || action === "witness"));
    await db.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES ($1,'company_forms',$2,$3)
      ON CONFLICT(role_id,resource,action) DO UPDATE SET allowed=EXCLUDED.allowed`,
    [roleId, action, allowed]);
  }
}
export async function clearCompanyFormFixtures(db: any, roles: string[]) {
  await db.query("DELETE FROM adm_resource_action_grants WHERE resource='company_forms' AND role_id=ANY($1::text[])", [roles]);
}
