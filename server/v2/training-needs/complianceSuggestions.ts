import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { readCanonicalReliever, type RelieverCheckRequest } from "../shared/training-compliance/reader";
import { readRelieverTrainingCompliance } from "../shared/training-compliance/service";
import type { ComplianceResult } from "../shared/training-compliance/types";
import { needsSuggestion, qualifyingCertificate, suggestionTarget, type SuggestionStatus } from "./complianceSuggestionPolicy";

export type Suggestion = {
  suggestion_uuid: string; assign_uuid: string; plan_uuid: string; crew_uuid: string;
  vessel_uuid: string; course_uuid: string; source: string; status: SuggestionStatus;
  gap: any; target_date: string | null; confirmed_at: string | null; confirmed_by: string | null;
  closed_certificate_uuid: string | null;
};
const systemActor = "system:pre-joining-compliance";
export async function suggestionHistory(tx: any, before: Suggestion | null, after: Suggestion,
  event: string, reason: string, actor = systemActor, certificateUuid: string | null = null) {
  await tx.execute(sql`INSERT INTO training_compliance_suggestion_history
    (suggestion_uuid,actor,event,before_value,after_value,reason,certificate_uuid)
    VALUES(${after.suggestion_uuid},${actor},${event},
      ${before ? JSON.stringify(before) : null}::jsonb,${JSON.stringify(after)}::jsonb,${reason},${certificateUuid})`);
}
export async function listSuggestions(tx: any, assignmentUuid: string): Promise<Suggestion[]> {
  return (await tx.execute(sql`SELECT *,target_date::text AS target_date
    FROM training_compliance_suggestions WHERE assign_uuid=${assignmentUuid} ORDER BY created_at,suggestion_uuid`)).rows;
}

/** Called with the assignment and plan locked in that order. */
export async function reconcileSuggestionResult(tx: any, request: RelieverCheckRequest,
  check: ComplianceResult): Promise<Suggestion[]> {
  const canonical = await readCanonicalReliever(tx, request);
  const plan = (await tx.execute(sql`SELECT relief_status,is_deleted,is_archived
    FROM vessel_planning_v2 WHERE plan_uuid=${request.planUuid}`)).rows[0];
  if (!canonical || !plan || plan.is_deleted || plan.is_archived || plan.relief_status === "Deferred")
    return listSuggestions(tx, request.assignmentUuid);
  for (const course of check.courses) {
    let before = (await tx.execute(sql`SELECT *,target_date::text AS target_date
      FROM training_compliance_suggestions WHERE assign_uuid=${request.assignmentUuid}
        AND course_uuid=${course.courseUuid} FOR UPDATE`)).rows[0] as Suggestion | undefined;
    const certificate = qualifyingCertificate(course);
    if (before && ["SUGGESTED", "CONFIRMED"].includes(before.status) && certificate) {
      const after = (await tx.execute(sql`UPDATE training_compliance_suggestions SET
        status='CLOSED',closed_certificate_uuid=${certificate},updated_at=now()
        WHERE suggestion_uuid=${before.suggestion_uuid} RETURNING *`)).rows[0] as Suggestion;
      await suggestionHistory(tx, before, after, "certificate_qualified",
        `A qualifying ${course.isEquivalent ? "accepted equivalent" : "course"} certificate now covers the requirement${check.contractEnd ? " through the contract end" : " at joining"}.`,
        systemActor, certificate);
      continue;
    }
    if (!needsSuggestion(course)) continue;
    const gap = { course, joiningDate: check.joiningDate, contractEnd: check.contractEnd,
      matrixRevisionUuid: check.matrixRevisionUuid, calculationVersion: check.calculationVersion };
    const target = suggestionTarget(course, check);
    if (!before) {
      const inserted = (await tx.execute(sql`INSERT INTO training_compliance_suggestions
        (suggestion_uuid,assign_uuid,plan_uuid,crew_uuid,vessel_uuid,course_uuid,status,gap,target_date)
        VALUES(${randomUUID()},${request.assignmentUuid},${request.planUuid},${canonical.crewUuid},
          ${canonical.vesselUuid},${course.courseUuid},'SUGGESTED',${JSON.stringify(gap)}::jsonb,${target}::date)
        ON CONFLICT(assign_uuid,course_uuid) DO NOTHING RETURNING *`)).rows[0] as Suggestion | undefined;
      if (inserted) await suggestionHistory(tx, null, inserted, "suggested", course.state!);
    } else if (before.status !== "DISMISSED") {
      // Stable dismissal survives refresh; withdrawal/closure can reopen the
      // same slot when a later genuine check identifies a new gap.
      const unchanged = JSON.stringify(before.gap) === JSON.stringify(gap)
        && before.target_date === target && !["WITHDRAWN", "CLOSED"].includes(before.status);
      // JSONB object order is not significant.
      const equal = unchanged || (await tx.execute(sql`SELECT
        gap=${JSON.stringify(gap)}::jsonb AND target_date IS NOT DISTINCT FROM ${target}::date AS same
        FROM training_compliance_suggestions WHERE suggestion_uuid=${before.suggestion_uuid}`)).rows[0]?.same;
      if (equal && !["WITHDRAWN", "CLOSED"].includes(before.status)) continue;
      const after = (await tx.execute(sql`UPDATE training_compliance_suggestions SET
        status=${["WITHDRAWN", "CLOSED"].includes(before.status) ? "SUGGESTED" : before.status},
        gap=${JSON.stringify(gap)}::jsonb,target_date=${target}::date,closed_certificate_uuid=NULL,
        plan_uuid=${request.planUuid},updated_at=now() WHERE suggestion_uuid=${before.suggestion_uuid}
        RETURNING *`)).rows[0] as Suggestion;
      await suggestionHistory(tx, before, after, "gap_rechecked", course.state!);
    }
  }
  return listSuggestions(tx, request.assignmentUuid);
}

export async function reconcileAssignmentSuggestions(request: RelieverCheckRequest, tx?: any): Promise<Suggestion[]> {
  const run = async (db: any) => {
    await db.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${request.assignmentUuid} FOR UPDATE`);
    await db.execute(sql`SELECT plan_uuid FROM vessel_planning_v2 WHERE plan_uuid=${request.planUuid} FOR UPDATE`);
    return reconcileSuggestionResult(db, request, await readRelieverTrainingCompliance(db, request));
  };
  return tx ? run(tx) : getDb().transaction(run);
}
export async function lockCrewSuggestionAssignments(tx: any, crewUuid: string) {
  await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE crew_uuid=${crewUuid}
    ORDER BY assign_uuid FOR UPDATE`);
}
export async function reconcileCrewSuggestions(crewUuid: string, tx?: any) {
  const run = async (db: any) => {
    await lockCrewSuggestionAssignments(db, crewUuid);
    const plans = (await db.execute(sql`SELECT p.plan_uuid,p.reliever_assign_uuid
      FROM vessel_planning_v2 p JOIN crew_assignments a ON a.assign_uuid=p.reliever_assign_uuid
      WHERE a.crew_uuid=${crewUuid} AND NOT a.is_deleted AND a.assignment_type IN ('Planned','OnBoard')
        AND NOT p.is_deleted AND NOT p.is_archived AND coalesce(p.relief_status,'')<>'Deferred'
      ORDER BY p.plan_uuid`)).rows as { plan_uuid: string; reliever_assign_uuid: string }[];
    for (const p of plans) await reconcileAssignmentSuggestions(
      { planUuid: p.plan_uuid, assignmentUuid: p.reliever_assign_uuid }, db);
  };
  return tx ? run(tx) : getDb().transaction(run);
}
