import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { CompanyFormPrincipal, CompanyFormSubjectAdapter } from "./contracts";
import { CompanyFormConflictError, CompanyFormValidationError } from "./errors";

export type RequirementDecision = {
  formVersionUuid: string;
  status: "OUTSTANDING" | "UNRESOLVED";
  matchedSetUuids: string[];
  values: unknown;
  unresolvedReason?: string;
};
export type ResolutionCommand = {
  adapter: CompanyFormSubjectAdapter<any>; actor: CompanyFormPrincipal;
  subjectType: string; subjectRef: string; stageKey: string | null;
  cycleUuid: string; eventKey: string; triggerAt: string; source: string;
  outcome: "COMPLETED" | "FAILED"; evidence: unknown; failureReason?: string;
  decisions: RequirementDecision[];
};

/** Internal commands only. There is deliberately no resolution-write HTTP route. */
export async function recordResolution(input: ResolutionCommand, executor = getDb()) {
  const trigger = new Date(input.triggerAt);
  if (!Number.isFinite(trigger.getTime()) || trigger > new Date() || !input.actor.userId
    || !input.cycleUuid || !input.eventKey || !input.source)
    throw new CompanyFormValidationError("A trusted actor and valid past trigger are required.");
  if (input.outcome === "FAILED" && (!input.failureReason?.trim() || input.decisions.length))
    throw new CompanyFormValidationError("Failed checks require a reason and cannot create requirements.");
  return executor.transaction(async (tx: any) => {
    const subject = await input.adapter.lockForStart(input.subjectRef, tx);
    if (!subject || !input.adapter.canStart(subject.context))
      throw new CompanyFormConflictError("This subject is no longer eligible for a rules check.");
    const stages = await input.adapter.loadStages();
    if ((stages.length && !stages.some(s => s.stageKey === input.stageKey)) || (!stages.length && input.stageKey !== null))
      throw new CompanyFormValidationError("Invalid subject stage.");
    const old = (await tx.execute(sql`SELECT * FROM frm_resolution_runs WHERE subject_type=${input.subjectType}
      AND subject_ref=${input.subjectRef} AND stage_key IS NOT DISTINCT FROM ${input.stageKey}
      AND cycle_uuid=${input.cycleUuid} AND event_key=${input.eventKey}`)).rows[0];
    if (old) return { run: old, retried: true };
    const pins: any[] = [];
    for (const decision of input.decisions) {
      const pin = (await tx.execute(sql`SELECT v.*,f.form_uuid,f.subject_type,p.mode,(p.obligation='mandatory') AS mandatory,
        p.effective_from::text AS effective_day
        FROM adm_form_versions_v2 v JOIN adm_forms_v2 f ON f.id=v.form_id
        JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
        WHERE v.fv_uuid=${decision.formVersionUuid} FOR SHARE OF f,v,p`)).rows[0];
      if (!pin || pin.status !== "released" || pin.subject_type !== input.subjectType
        || pin.stage_key !== input.stageKey || pin.mode === "manual_only"
        || !pin.released_at || new Date(pin.released_at) > trigger
        || !pin.effective_day || pin.effective_day > trigger.toISOString().slice(0, 10))
        throw new CompanyFormValidationError("Requirement pin is not an automatic policy effective at the trigger.");
      const sets = (await tx.execute(sql`SELECT set_uuid FROM frm_applicability_sets
        WHERE version_uuid=${decision.formVersionUuid}`)).rows as { set_uuid: string }[];
      if (decision.matchedSetUuids.some(id => !sets.some(s => s.set_uuid === id))
        || (pin.mode === "conditional" && decision.status === "OUTSTANDING" && !decision.matchedSetUuids.length)
        || (decision.status === "UNRESOLVED" && !decision.unresolvedReason?.trim()))
        throw new CompanyFormValidationError("Matched sets or unresolved evidence are invalid.");
      pins.push({ pin, decision });
    }
    const runUuid = randomUUID();
    await tx.execute(sql`INSERT INTO frm_resolution_runs(run_uuid,subject_type,subject_ref,stage_key,
      cycle_uuid,event_key,trigger_at,outcome,actor_uuid,source,evidence,failure_reason)
      VALUES(${runUuid},${input.subjectType},${input.subjectRef},${input.stageKey},${input.cycleUuid},
      ${input.eventKey},${trigger.toISOString()},${input.outcome},${String(input.actor.userId)},${input.source},
      ${JSON.stringify({ captured: input.evidence, candidates: pins.map(({ pin, decision }) =>
        ({ versionUuid: pin.fv_uuid, mandatory: pin.mandatory, mode: pin.mode, ...decision })) })}::jsonb,
      ${input.failureReason ?? null})`);
    await tx.execute(sql`SELECT set_config('sail.forms_actor',${String(input.actor.userId)},true)`);
    for (const { pin, decision } of pins) {
      const prior = (await tx.execute(sql`SELECT requirement_uuid FROM frm_requirements
        WHERE subject_type=${input.subjectType} AND subject_ref=${input.subjectRef}
        AND stage_key IS NOT DISTINCT FROM ${input.stageKey} AND form_uuid=${pin.form_uuid}
        AND (cycle_uuid=${input.cycleUuid} OR status IN('STARTED','COMPLETED')) FOR UPDATE`)).rows;
      if (prior.length) continue;
      await tx.execute(sql`INSERT INTO frm_requirements(requirement_uuid,run_uuid,subject_type,subject_ref,
        stage_key,cycle_uuid,form_uuid,form_version_uuid,mandatory,status,deciding_evidence,unresolved_reason)
        VALUES(${randomUUID()},${runUuid},${input.subjectType},${input.subjectRef},${input.stageKey},
        ${input.cycleUuid},${pin.form_uuid},${pin.fv_uuid},${pin.mandatory},${decision.status},
        ${JSON.stringify(decision)}::jsonb,${decision.unresolvedReason ?? null})`);
    }
    return { run: (await tx.execute(sql`SELECT * FROM frm_resolution_runs WHERE run_uuid=${runUuid}`)).rows[0], retried: false };
  });
}

export async function withdrawNotStarted(input: {
  adapter: CompanyFormSubjectAdapter<any>; actor: CompanyFormPrincipal;
  subjectType: string; subjectRef: string; stageKey: string | null; cycleUuid: string; reason: string;
}, executor = getDb()) {
  if (!input.reason.trim()) throw new CompanyFormValidationError("Withdrawal requires a reason.");
  return executor.transaction(async (tx: any) => {
    if (!await input.adapter.lockForStart(input.subjectRef, tx)) throw new CompanyFormConflictError("Subject unavailable.");
    await tx.execute(sql`SELECT set_config('sail.forms_actor',${String(input.actor.userId)},true),
      set_config('sail.forms_reason',${input.reason},true)`);
    return (await tx.execute(sql`UPDATE frm_requirements SET status='WITHDRAWN',updated_at=now()
      WHERE subject_type=${input.subjectType} AND subject_ref=${input.subjectRef}
      AND stage_key IS NOT DISTINCT FROM ${input.stageKey} AND cycle_uuid=${input.cycleUuid}
      AND status IN('OUTSTANDING','UNRESOLVED') RETURNING requirement_uuid`)).rows;
  });
}

export async function readRequirements(subjectType: string, subjectRef: string, executor = getDb()) {
  const runs = (await executor.execute(sql`SELECT * FROM frm_resolution_runs
    WHERE subject_type=${subjectType} AND subject_ref=${subjectRef} ORDER BY recorded_at,run_uuid`)).rows;
  const requirements = (await executor.execute(sql`SELECT r.*,f.name AS form_name,v.version_no,
    (SELECT jsonb_agg(h ORDER BY h.recorded_at,h.history_uuid) FROM frm_requirement_history h
      WHERE h.requirement_uuid=r.requirement_uuid) AS history,
    (SELECT jsonb_build_object('submissionUuid',s.submission_uuid,'origin',s.origin,'status',s.status)
      FROM frm_company_submissions s WHERE s.subject_type=r.subject_type AND s.subject_ref=r.subject_ref
      AND s.form_uuid=r.form_uuid AND NOT s.is_deleted AND s.status<>'voided' LIMIT 1) AS existing_form
    FROM frm_requirements r JOIN adm_forms_v2 f ON f.form_uuid=r.form_uuid
    JOIN adm_form_versions_v2 v ON v.fv_uuid=r.form_version_uuid
    WHERE r.subject_type=${subjectType} AND r.subject_ref=${subjectRef}
    ORDER BY r.created_at,r.requirement_uuid`)).rows;
  return { runs, requirements };
}
