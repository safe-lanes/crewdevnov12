import type { Request } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { authorizeAttachmentMenu } from "../shared/attachmentAccess";
import { resolveTrustedVesselScope } from "../company-forms/trustedPrincipalService";

/** Only confirmed generated needs join the existing Training Needs list. */
export async function complianceNeedRows(req: Request) {
  const { role, ship } = await authorizeAttachmentMenu(req, "Training");
  const vessels = ship ? await resolveTrustedVesselScope(role.masterUserId) ?? [] : null;
  return (await getDb().execute(sql`SELECT s.source,s.suggestion_uuid AS "sourceRefUuid",
    btrim(concat_ws(' ',c.first_name,nullif(c.middle_name,''),c.family_name)) AS name,
    coalesce(x.contract_rank_label,'Not recorded') AS rank,
    s.gap->'course'->>'name' AS training,NULL::text AS "correspondingInDb",
    coalesce(mu.fullname,mu.display_name,s.confirmed_by) AS "identifiedBy",
    s.confirmed_by AS "identifiedByUuid",'Mandatory'::text AS category,
    CASE s.status WHEN 'CONFIRMED' THEN 'Pending' WHEN 'CLOSED' THEN 'Completed'
      WHEN 'WITHDRAWN' THEN 'Withdrawn' ELSE s.status END AS status,
    s.target_date::text AS "targetDate",
    CASE WHEN s.status='CLOSED' THEN 'Closed automatically by a qualifying certificate.'
      WHEN s.status='WITHDRAWN' THEN 'Relief deferred or assignment cancelled.'
      ELSE 'Confirmed from a pre-joining compliance gap.' END AS comments,
    'readonly'::text AS editable,c.emp_no AS "crewMemberId",
    x.contract_rank_uuid AS "rankId"
    FROM training_compliance_suggestions s
    JOIN crew_members_v2 c ON c.crew_uuid=s.crew_uuid AND NOT c.is_deleted
    LEFT JOIN crew_assignment_rule_context x ON x.assign_uuid=s.assign_uuid
    LEFT JOIN master_users mu ON mu.id::text=s.confirmed_by
    WHERE s.confirmed_at IS NOT NULL AND s.status IN ('CONFIRMED','CLOSED','WITHDRAWN')
      ${vessels === null ? sql`` : sql`AND s.vessel_uuid=ANY(${sql.param(vessels)}::text[])`}
    ORDER BY s.created_at,s.suggestion_uuid`)).rows;
}
