import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { companyFormSubjectRegistry } from "./registry";
import { readApplicability } from "../admin/services/applicabilityService";
import { evaluateRule } from "./evaluateRule";
import { recordResolution, type RequirementDecision } from "./requirementsRepository";
import { appendAttempt, stageAudit, type StageEvent, type StageSnapshot } from "./stageEventRepository";
import { CompanyFormConflictError, CompanyFormNotFoundError } from "./errors";
import type { CompanyFormPrincipal } from "./contracts";

const subjectType = "crew_assignment";
function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/** Caller must hold the assignment lock. No HTTP input supplies a snapshot. */
async function capture(subjectRef: string, stage: string, occurredAt: string, executor: any): Promise<StageSnapshot> {
  const adapter = companyFormSubjectRegistry.get(subjectType);
  const subject = await adapter.lookup(subjectRef, executor);
  if (!subject || !adapter.readRuleDimensions) throw new Error("Recorded assignment facts are unavailable.");
  const facts = await adapter.readRuleDimensions(subject.context, executor);
  const versions = (await executor.execute(sql`SELECT DISTINCT ON(f.form_uuid) v.fv_uuid
    FROM adm_form_versions_v2 v JOIN adm_forms_v2 f ON f.id=v.form_id
    WHERE f.category='dynamic' AND f.subject_type=${subjectType} AND v.stage_key=${stage}
    AND NOT f.is_deleted AND f.archived_at IS NULL AND NOT v.is_deleted
    AND v.status='released' AND v.released_at<=${occurredAt}::timestamptz
    ORDER BY f.form_uuid,v.released_at DESC,v.id DESC`)).rows;
  const candidates: StageSnapshot["candidates"] = [];
  for (const version of versions) {
    const policy = await readApplicability(version.fv_uuid, executor);
    if (policy.mode !== "manual_only") candidates.push({ versionUuid: version.fv_uuid, policy });
  }
  return { facts, candidates };
}

export type LifecycleCheck = {
  subjectRef: string; stage: "before_joining" | "on_board" | "at_sign_off";
  source: "deploy" | "sign_on" | "relief" | "sign_off";
  sourceKey: string; actor: string; businessDate: string;
};

/** After the authoritative operation commits. Forms failures never escape this boundary. */
export async function checkLifecycle(input: LifecycleCheck, executor: any = getDb()) {
  try {
    const rollout = (await executor.execute(sql`SELECT capture_from FROM frm_stage_rollout WHERE singleton`)).rows[0];
    if (!rollout?.capture_from) return;
    const event = await executor.transaction(async (tx: any) => {
      const adapter = companyFormSubjectRegistry.get(subjectType);
      if (!await adapter.lockForStart(input.subjectRef, tx)) throw new Error("Verified assignment is unavailable.");
      let cycle = (await tx.execute(sql`SELECT * FROM frm_stage_cycles WHERE subject_ref=${input.subjectRef}
        AND stage_key=${input.stage} FOR UPDATE`)).rows[0];
      // Sign-off uses any previous relief event in the current active cycle, even failed/pending.
      if (cycle && !cycle.deferred) {
        const existing = (await tx.execute(sql`SELECT * FROM frm_stage_events WHERE subject_ref=${input.subjectRef}
          AND stage_key=${input.stage} AND cycle_uuid=${cycle.cycle_uuid} ORDER BY recorded_at LIMIT 1`)).rows[0];
        if (existing) return null;
      }
      if (!cycle || cycle.deferred) {
        const cycleUuid = randomUUID();
        await tx.execute(sql`INSERT INTO frm_stage_cycles(subject_ref,stage_key,cycle_uuid,deferred)
          VALUES(${input.subjectRef},${input.stage},${cycleUuid},false)
          ON CONFLICT(subject_ref,stage_key) DO UPDATE SET cycle_uuid=excluded.cycle_uuid,deferred=false`);
        cycle = { cycle_uuid: cycleUuid };
      }
      const occurredAt = new Date().toISOString();
      let snapshot: StageSnapshot;
      await tx.execute(sql`SAVEPOINT forms_capture`);
      try {
        snapshot = await capture(input.subjectRef, input.stage, occurredAt, tx);
        await tx.execute(sql`RELEASE SAVEPOINT forms_capture`);
      } catch {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT forms_capture`);
        await tx.execute(sql`RELEASE SAVEPOINT forms_capture`);
        snapshot = { facts: null, candidates: [], captureError: "Original deciding facts could not be captured." };
      }
      const eventUuid = randomUUID();
      const event = (await tx.execute(sql`INSERT INTO frm_stage_events(event_uuid,subject_ref,stage_key,cycle_uuid,
        source,source_key,occurred_at,business_date,actor_uuid,snapshot)
        VALUES(${eventUuid},${input.subjectRef},${input.stage},${cycle.cycle_uuid},${input.source},
          ${input.sourceKey},${occurredAt},${input.businessDate},${input.actor},${JSON.stringify(snapshot)}::jsonb)
        RETURNING *`)).rows[0] as StageEvent;
      await appendAttempt(eventUuid, input.actor, "PENDING", null, null, tx);
      return event;
    });
    if (event) await resolveStageEvent(event.event_uuid, input.actor, executor);
  } catch (error) {
    console.error("[CompanyForms] lifecycle check failed; operation retained", input.subjectRef, error);
    try {
      await stageAudit(input.actor, input.subjectRef, input.stage, "CAPTURE_FAILED",
        { source: input.source, sourceKey: input.sourceKey, businessDate: input.businessDate,
          reason: "The check could not capture its original facts. The lifecycle operation succeeded." }, executor);
    } catch (auditError) { console.error("[CompanyForms] failure audit unavailable", auditError); }
  }
}

/** Replay only the immutable event. Caller already performed scoped Fill in authorization. */
export async function resolveStageEvent(eventUuid: string, actor: string, executor: any = getDb()) {
  const adapter = companyFormSubjectRegistry.get(subjectType);
  try {
    return await executor.transaction(async (tx: any) => {
      const initial = (await tx.execute(sql`SELECT * FROM frm_stage_events WHERE event_uuid=${eventUuid}`)).rows[0] as StageEvent;
      if (!initial) throw new CompanyFormNotFoundError("Stage check not found.");
      const subject = await adapter.lockForStart(initial.subject_ref, tx);
      if (!subject || !adapter.canStart(subject.context)) throw new CompanyFormConflictError("This assignment is no longer open.");
      const cycle = (await tx.execute(sql`SELECT * FROM frm_stage_cycles WHERE subject_ref=${initial.subject_ref}
        AND stage_key=${initial.stage_key} FOR UPDATE`)).rows[0];
      if (cycle?.deferred || cycle?.cycle_uuid !== initial.cycle_uuid)
        throw new CompanyFormConflictError("This relief cycle was deferred. Plan relief again to run a fresh check.");
      const completed = (await tx.execute(sql`SELECT * FROM frm_stage_attempts WHERE event_uuid=${eventUuid}
        AND outcome='COMPLETED' LIMIT 1`)).rows[0];
      if (completed) return completed;
      const snapshot = initial.snapshot;
      if (snapshot.captureError || (!snapshot.legacy && !snapshot.facts))
        throw new Error("Original deciding facts were not captured; they cannot be reconstructed from changed facts.");
      const decisions: RequirementDecision[] = [];
      for (const { versionUuid, policy } of snapshot.candidates) {
        if (!initial.business_date || !policy.effectiveFrom || policy.effectiveFrom > dateOnly(initial.business_date)) continue;
        const result = evaluateRule(policy, snapshot.facts!);
        if (result.outcome === "applies" || result.outcome === "unresolved") decisions.push({
          formVersionUuid: versionUuid, status: result.outcome === "applies" ? "OUTSTANDING" : "UNRESOLVED",
          matchedSetUuids: (policy.sets ?? []).filter((_set, i) => result.sets[i]?.outcome === "applies").map(s => s.setUuid),
          values: { facts: snapshot.facts, result },
          ...(result.outcome === "unresolved" ? { unresolvedReason: result.explanation } : {}),
        });
      }
      const principal = { kind: "office", userId: actor as unknown as number, roleId: "", roleName: "", roleType: "Office" } as CompanyFormPrincipal;
      const result = await recordResolution({ adapter, actor: principal, subjectType, subjectRef: initial.subject_ref,
        stageKey: initial.stage_key, cycleUuid: initial.cycle_uuid, eventKey: randomUUID(),
        triggerAt: new Date(initial.occurred_at).toISOString(),
        effectiveDate: initial.business_date ? dateOnly(initial.business_date) : undefined,
        source: initial.source, outcome: "COMPLETED", evidence: { eventUuid, snapshot }, decisions }, tx);
      await appendAttempt(eventUuid, actor, "COMPLETED", null, result.run.run_uuid, tx);
      return result.run;
    });
  } catch (error) {
    const reason = error instanceof CompanyFormConflictError ? error.message :
      "The form check failed. Retry uses its original recorded facts and dates.";
    await appendAttempt(eventUuid, actor, "FAILED", reason, null, executor);
    return { outcome: "FAILED", reason };
  }
}
