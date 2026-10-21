import { sql } from "drizzle-orm";
import type { Request } from "express";
import { getDb } from "../../db";
import { resolveRequestRole } from "../../auth/roleResolutionService";

/** Independent authority. No role-name, Company Forms or checklist fallback. */
export async function trainingOverrideAllowed(req: Request, tx: any = getDb()): Promise<boolean> {
  const resolution = await resolveRequestRole(req, tx);
  if (!resolution.ok || !["office", "ship", "vessel"].includes(resolution.role.roleType.trim().toLowerCase())) return false;
  const result = await tx.execute(sql`SELECT g.allowed FROM adm_resource_action_grants g
    JOIN adm_rolemaster_ac r ON r.ruid=g.role_id
    WHERE g.role_id=${resolution.role.roleId} AND g.resource='training_compliance'
      AND g.action='override' AND r.is_active AND NOT r.is_deleted FOR SHARE OF g,r`);
  return result.rows[0]?.allowed === true;
}
