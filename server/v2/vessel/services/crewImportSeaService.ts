import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

export type ImportSeaServiceOutcome = {
  status: "CREATED" | "ALREADY_PRESENT" | "REVIEW";
  assignmentUuid: string;
  seaServiceUuids: string[];
  reason?: string;
};

const validDay = (day: string | null): day is string => !!day
  && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day))
  && new Date(day).toISOString().slice(0, 10) === day;

/**
 * Import only: record the current contract in E1, never calculate first service.
 * Called after the exact incumbent planning link has been written, in the
 * existing vessel-import transaction/advisory lock.
 */
export async function recordImportedCompanyService(
  tx: any, assignmentUuid: string, planUuid: string, actorUuid?: string,
): Promise<ImportSeaServiceOutcome> {
  const a = (await tx.execute(sql`SELECT a.*,v.vessel AS vessel_name
    FROM crew_assignments a JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid
    WHERE a.assign_uuid=${assignmentUuid} AND NOT a.is_deleted
      AND a.assignment_type='OnBoard' FOR UPDATE OF a`)).rows[0];
  if (!a) throw new Error("Imported current-contract service requires an OnBoard assignment");
  await tx.execute(sql`SELECT crew_uuid FROM crew_members_v2
    WHERE crew_uuid=${a.crew_uuid} FOR UPDATE`);
  const review = (reason: string, ids: string[] = []): ImportSeaServiceOutcome =>
    ({ status: "REVIEW", assignmentUuid, seaServiceUuids: ids, reason });
  if (!validDay(a.sign_on_date)) return review("Sign-on date is missing or invalid. Check the contract before adding company sea service.");

  // Normalize only verified master identifiers; never guess a rank by its name.
  const ranks = (await tx.execute(sql`SELECT DISTINCT r.ar_uuid,r.name
    FROM vessel_planning_v2 p JOIN adm_available_ranks_v2 r ON NOT r.is_deleted AND
      (p.rank_id IN(r.ar_uuid,r.rank_id) OR EXISTS(
        SELECT 1 FROM adm_company_ranks_v2 c WHERE NOT c.is_deleted
          AND p.rank_id IN(c.cr_uuid,c.id,c.rank_id)
          AND coalesce(c.original_rank_id,c.rank_id) IN(r.ar_uuid,r.rank_id)))
    WHERE p.plan_uuid=${planUuid} AND NOT p.is_deleted
      AND p.crew_assign_uuid=${assignmentUuid} AND p.crew_uuid=${a.crew_uuid}
      AND p.vessel_uuid=${a.vessel_uuid}`)).rows;
  const rank = ranks.length === 1 ? ranks[0] : null;
  await tx.execute(sql`INSERT INTO crew_assignment_rule_context
    (assign_uuid,contract_rank_uuid,contract_rank_label,rank_source,rank_reason)
    VALUES(${assignmentUuid},${rank?.ar_uuid ?? null},${rank?.name ?? null},
      ${JSON.stringify({ method: "crew_list_import_planning_link", planningUuids: [planUuid] })}::jsonb,
      ${rank ? null : "The imported planning link has no unique eligible contract rank"})
    ON CONFLICT(assign_uuid) DO UPDATE SET contract_rank_uuid=EXCLUDED.contract_rank_uuid,
      contract_rank_label=EXCLUDED.contract_rank_label,rank_source=EXCLUDED.rank_source,
      rank_reason=EXCLUDED.rank_reason
    WHERE crew_assignment_rule_context.contract_rank_uuid IS NULL`);
  const context = (await tx.execute(sql`SELECT r.ar_uuid FROM crew_assignment_rule_context c
    JOIN adm_available_ranks_v2 r ON r.ar_uuid=c.contract_rank_uuid AND NOT r.is_deleted
    WHERE c.assign_uuid=${assignmentUuid}`)).rows[0];
  const rows = (await tx.execute(sql`SELECT sea_uuid,vessel_uuid,from_date,to_date
    FROM crew_sea_service WHERE crew_uuid=${a.crew_uuid} AND NOT is_deleted
      AND service_type='company' AND (vessel_uuid=${a.vessel_uuid} OR vessel_uuid IS NULL)
    FOR UPDATE`)).rows;
  const exact = rows.filter((r: any) => r.vessel_uuid === a.vessel_uuid && r.from_date === a.sign_on_date);
  if (exact.length) return {
    status: exact.length === 1 ? "ALREADY_PRESENT" : "REVIEW", assignmentUuid,
    seaServiceUuids: exact.map((r: any) => r.sea_uuid),
    ...(exact.length > 1 ? { reason: "More than one company sea-service row already records this contract. Review the history; nothing was added." } : {}),
  };
  // This contract has no end date. A later row also overlaps it. Malformed or
  // unbound history cannot prove non-overlap and requires review, not guessing.
  const overlapping = rows.filter((r: any) => !validDay(r.from_date)
    || (r.to_date && !validDay(r.to_date)) || !r.to_date || r.to_date >= a.sign_on_date);
  if (overlapping.length) return review(
    "Company sea service overlaps this contract or cannot be verified. Review the vessel and dates; nothing was added.",
    overlapping.map((r: any) => r.sea_uuid),
  );
  if (!context) return review("The contract rank cannot be verified from planning. Check the rank master and planning link; nothing was added.");
  const seaUuid = randomUUID();
  await tx.execute(sql`INSERT INTO crew_sea_service
    (sea_uuid,crew_uuid,service_type,vessel_uuid,vessel_name,rank,from_date,to_date,
      created_by_uuid,updated_by_uuid,is_deleted)
    VALUES(${seaUuid},${a.crew_uuid},'company',${a.vessel_uuid},${a.vessel_name},
      ${context.ar_uuid},${a.sign_on_date},NULL,${actorUuid ?? null},${actorUuid ?? null},false)`);
  return { status: "CREATED", assignmentUuid, seaServiceUuids: [seaUuid] };
}
