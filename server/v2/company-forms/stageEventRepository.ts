import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { AssignmentDimensionReport } from "../../../shared/v2/forms-engine/ruleDimensions";
import type { VersionApplicability } from "../../../shared/v2/admin/applicability";
import { CompanyFormConflictError } from "./errors";

export type StageSnapshot = {
  facts: AssignmentDimensionReport | null;
  candidates: Array<{ versionUuid: string; policy: VersionApplicability }>;
  captureError?: string;
  legacy?: boolean;
};
export type StageEvent = {
  event_uuid: string; subject_ref: string; stage_key: string; cycle_uuid: string;
  source: string; source_key: string; occurred_at: Date | string; business_date: string | Date | null;
  actor_uuid: string; snapshot: StageSnapshot;
};

export async function stageStatus(subjectRef: string, executor: any = getDb()) {
  const rollout = (await executor.execute(sql`SELECT * FROM frm_stage_rollout WHERE singleton`)).rows[0];
  const stages = (await executor.execute(sql`SELECT c.stage_key,c.cycle_uuid,c.deferred,
    e.event_uuid,e.source,e.business_date,
    a.outcome,a.reason,a.recorded_at
    FROM frm_stage_cycles c
    LEFT JOIN LATERAL (SELECT * FROM frm_stage_events e WHERE e.subject_ref=c.subject_ref
      AND e.stage_key=c.stage_key AND e.cycle_uuid=c.cycle_uuid ORDER BY recorded_at,event_uuid LIMIT 1) e ON true
    LEFT JOIN LATERAL (SELECT * FROM frm_stage_attempts a WHERE a.event_uuid=e.event_uuid
      ORDER BY recorded_at DESC,attempt_uuid DESC LIMIT 1) a ON true
    WHERE c.subject_ref=${subjectRef}`)).rows;
  const failures = (await executor.execute(sql`SELECT stage_key,evidence,recorded_at FROM frm_stage_audit
    WHERE subject_ref=${subjectRef} AND event='CAPTURE_FAILED' ORDER BY recorded_at DESC`)).rows;
  return { enforcementEnabled: Boolean(rollout?.enforcement_enabled), completedAt: rollout?.completed_at ?? null, stages, failures };
}

export async function assertStageReady(subjectRef: string, stage: string | null, executor: any = getDb()) {
  if (!stage) return;
  const status = await stageStatus(subjectRef, executor);
  if (!status.enforcementEnabled) return;
  const current = status.stages.find((s: any) => s.stage_key === stage);
  if (current && !current.deferred && current.outcome === "COMPLETED") return;
  if (current && !current.deferred && ["FAILED", "PENDING"].includes(current.outcome))
    throw new CompanyFormConflictError("The form check is pending or failed. Retry the check before starting a form; the vessel operation is unaffected.");
  throw new CompanyFormConflictError(stage === "at_sign_off" ? "Available once Relief Status is Planned or Confirmed" :
    stage === "on_board" ? "Available after sign-on and its form check." : "Available after Deploy and its form check.");
}

export async function appendAttempt(eventUuid: string, actor: string, outcome: string,
  reason: string | null = null, runUuid: string | null = null, executor: any = getDb()) {
  await executor.execute(sql`INSERT INTO frm_stage_attempts(attempt_uuid,event_uuid,actor_uuid,outcome,reason,run_uuid)
    VALUES(${randomUUID()},${eventUuid},${actor},${outcome},${reason},${runUuid})`);
}

export async function stageAudit(actor: string, subjectRef: string | null, stage: string | null,
  event: string, evidence: unknown, executor: any = getDb()) {
  await executor.execute(sql`INSERT INTO frm_stage_audit(actor_uuid,subject_ref,stage_key,event,evidence)
    VALUES(${actor},${subjectRef},${stage},${event},${JSON.stringify(evidence)}::jsonb)`);
}
