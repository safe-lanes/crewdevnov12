import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db";
import { readPriorServiceDecision } from "./crewAssignmentHistory";

export type BackfillResult = {
  assignmentUuid: string; status: "RECALCULATED" | "UNRESOLVED" | "SKIPPED" | "FAILED";
  firstEver?: boolean | null; firstInRank?: boolean | null;
  previous?: { firstEver: boolean | null; firstInRank: boolean | null };
  reason?: string;
};

/** Separate from import. No declarations, resolution runs or requirements written. */
export async function backfillCurrentAssignmentHistory(
  assignmentUuids: string[], actorId?: string, phase: "post_import" | "rerun" = "rerun",
  db: any = getDb(),
): Promise<BackfillResult[]> {
  const results: BackfillResult[] = [];
  for (const assignmentUuid of [...new Set(assignmentUuids)].sort()) {
    try {
      results.push(await db.transaction(async (tx: any): Promise<BackfillResult> => {
        const a = (await tx.execute(sql`SELECT * FROM crew_assignments WHERE assign_uuid=${assignmentUuid}
          AND NOT is_deleted FOR UPDATE`)).rows[0];
        if (!a || a.assignment_type !== "OnBoard" || !a.is_current)
          return { assignmentUuid, status: "SKIPPED", reason: "This is not a current on-board assignment." };
        await tx.execute(sql`INSERT INTO crew_assignment_rule_context(assign_uuid,rank_source,rank_reason)
          VALUES(${assignmentUuid},'{"method":"no_recorded_deploy_capture"}','Contract rank is unresolved')
          ON CONFLICT(assign_uuid) DO NOTHING`);
        const c = (await tx.execute(sql`SELECT * FROM crew_assignment_rule_context
          WHERE assign_uuid=${assignmentUuid} FOR UPDATE`)).rows[0];
        if (c.joining_history) return {
          assignmentUuid, status: "SKIPPED", reason: "First-service facts were captured at sign-on and remain unchanged.",
        };
        if (c.joining_history_backfill && c.joining_history_backfill.source !== "verified_current_contract_backfill")
          return { assignmentUuid, status: "SKIPPED", reason: "Existing facts do not have verified-backfill provenance. Ask an administrator to review them." };
        const exact = (await tx.execute(sql`SELECT sea_uuid FROM crew_sea_service
          WHERE NOT is_deleted AND service_type='company' AND crew_uuid=${a.crew_uuid}
            AND vessel_uuid=${a.vessel_uuid} AND from_date=${a.sign_on_date} FOR SHARE`)).rows;
        const matchingRows = exact.length;
        const decision = await readPriorServiceDecision(a.crew_uuid, c.contract_rank_uuid, a.sign_on_date, tx,
          { excludeSeaUuid: matchingRows === 1 ? exact[0].sea_uuid : undefined, identifiersOnly: true });
        const reason = matchingRows !== 1 ? matchingRows === 0
          ? "No exact current company-service row. Review the vessel and sign-on date."
          : "Multiple rows record the current contract. Review company sea service."
          : null;
        const evidence = { ...decision,
          ...(reason ? { firstEver: null, firstInRank: null, firstEverReason: reason, firstInRankReason: reason } : {}),
          source: "verified_current_contract_backfill", verifiedAt: new Date().toISOString(),
          recalculationUuid: randomUUID(),
          matchingRows, excludedCurrentSeaServiceUuid: matchingRows === 1 ? exact[0].sea_uuid : null,
          currentContractExclusion: "Exact seafarer, vessel, sign-on date and company service" };
        await tx.execute(sql`SELECT set_config('sail.verified_backfill_write','verified_current_contract_backfill',true),
          set_config('sail.verified_backfill_actor',${actorId ?? ""},true),
          set_config('sail.verified_backfill_phase',${phase},true)`);
        await tx.execute(sql`UPDATE crew_assignment_rule_context
          SET joining_history_backfill=${JSON.stringify(evidence)}::jsonb
          WHERE assign_uuid=${assignmentUuid}`);
        const unresolved = evidence.firstEver === null || evidence.firstInRank === null;
        return { assignmentUuid, status: unresolved ? "UNRESOLVED" : "RECALCULATED",
          firstEver: evidence.firstEver, firstInRank: evidence.firstInRank,
          ...(c.joining_history_backfill ? { previous: {
            firstEver: c.joining_history_backfill.firstEver, firstInRank: c.joining_history_backfill.firstInRank } } : {}),
          ...(unresolved ? { reason: reason ?? evidence.firstEverReason ?? evidence.firstInRankReason ?? "Review company sea service." } : {}),
        };
      }));
    } catch (error) {
      console.error("[Company Forms verified history backfill]", assignmentUuid, error);
      results.push({ assignmentUuid, status: "FAILED",
        reason: "First-service facts could not be checked. The crew import is saved; retry the check." });
    }
  }
  return results;
}
