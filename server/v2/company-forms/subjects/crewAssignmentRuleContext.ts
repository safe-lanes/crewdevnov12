import { sql } from "drizzle-orm";

export async function captureDeployRank(assignUuid: string, planUuid: string, tx: any) {
  const planning = (await tx.execute(sql`SELECT p.rank_id FROM vessel_planning_v2 p
    JOIN crew_assignments a ON a.assign_uuid=${assignUuid}
    WHERE p.plan_uuid=${planUuid} AND p.vessel_uuid=a.vessel_uuid
      AND p.reliever_assign_uuid=a.assign_uuid AND p.reliever_crew_uuid=a.crew_uuid
    FOR SHARE OF p`)).rows[0];
  if (!planning) throw new Error("Deploy rank capture requires the exact recorded reliever planning link");
  const ranks = (await tx.execute(sql`SELECT r.ar_uuid,r.name FROM adm_available_ranks_v2 r
    WHERE NOT r.is_deleted AND (r.ar_uuid=${planning.rank_id} OR r.rank_id=${planning.rank_id} OR EXISTS(
      SELECT 1 FROM adm_company_ranks_v2 c WHERE NOT c.is_deleted
        AND ${planning.rank_id} IN(c.cr_uuid,c.id,c.rank_id)
        AND coalesce(c.original_rank_id,c.rank_id) IN(r.ar_uuid,r.rank_id)
    )) FOR SHARE OF r`)).rows;
  const rank = ranks.length === 1 ? ranks[0] : undefined;
  const provenance = { method: "deploy_planning_link", planningUuids: [planUuid], rankReferences: [planning.rank_id] };
  await tx.execute(sql`INSERT INTO crew_assignment_rule_context
    (assign_uuid,contract_rank_uuid,contract_rank_label,rank_source,rank_reason)
    VALUES(${assignUuid},${rank?.ar_uuid ?? null},${rank?.name ?? null},${JSON.stringify(provenance)}::jsonb,
      ${rank ? null : "Planning rank does not yield exactly one eligible master"})
    ON CONFLICT(assign_uuid) DO NOTHING`);
}
