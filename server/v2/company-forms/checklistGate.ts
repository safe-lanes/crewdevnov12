import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { stageStatus } from "./stageEventRepository";
import { resolveCompanyFormPrincipal } from "./trustedPrincipalService";
import { assertCompanyFormPermission } from "./operationalPermissions";
import { authenticatedActor, appendAudit } from "../admin/services/accessControlManagement";
import { ChecklistGateError, checklistBlockerMessage, checklistOverrideEligible, type ChecklistBlocker } from "./checklistPolicy";

export function humanFormFactReason(value: string | null): string {
  if (!value) return "A required contract fact is missing. Verify it and retry the rules check.";
  const missing = [
    [/first.?in.?rank/i, "first company service in this contract rank"],
    [/first.?ever/i, "first company service"],
    [/contract.?rank|rank.?uuid/i, "captured contract rank"],
    [/national/i, "nationality"], [/vessel.?type/i, "vessel type"],
    [/owner/i, "vessel owner"], [/flag/i, "vessel flag"],
    [/crew.?group/i, "crew group"], [/agency/i, "manning agency"],
  ] as const;
  const facts = missing.filter(([pattern]) => pattern.test(value)).map(([, label]) => label);
  if (facts.length) return `Missing or unverified: ${facts.join(", ")}. Review Form rule facts and retry the rules check.`;
  const labels: Record<string, string> = {
    first_ever: "first company service", first_in_rank: "first company service in this contract rank",
    contract_rank: "captured contract rank", nationality: "nationality", vessel_type: "vessel type",
    vessel_owner: "vessel owner", flag: "vessel flag", agency: "manning agency",
  };
  // Reasons are domain diagnostics, never pass SQL/stack traces to a screen.
  if (/SELECT |INSERT |UPDATE |Error:|\.tsx?:\d|stack|SQLSTATE/i.test(value))
    return "A contract fact could not be verified. Check Form rule facts and retry the rules check.";
  return value.replace(/\b(first_ever|first_in_rank|contract_rank|nationality|vessel_type|vessel_owner|flag|agency)\b/g,
    key => labels[key]).replace(/[{}]/g, "").slice(0, 700);
}

export async function verifyChecklistYes(tx: any, planning: {
  planUuid: string; relieverAssignUuid: string | null; relieverCrewUuid: string | null;
  vesselUuid: string; deploymentChecklistCompleted?: boolean | null;
}, req?: Request): Promise<void> {
  if (!req) throw new ChecklistGateError("Open the seafarer's linked Planning record to complete the deployment checklist.");
  if (["actor", "actorId", "actor_uuid", "actorUuid", "userId", "auditIdentity", "auditUserUuid", "updatedByUuid", "createdByUuid"].some(key => key in (req.body ?? {})))
    throw new ChecklistGateError("Audit identity comes from your signed-in account. Remove supplied audit details and retry.");
  if (!planning.relieverAssignUuid)
    throw new ChecklistGateError("Deploy the reliever to establish the linked assignment before completing the checklist.");
  const principal = await resolveCompanyFormPrincipal(req);
  if (principal.kind !== "seafarer") {
    await tx.execute(sql`SELECT ruid FROM adm_rolemaster_ac WHERE ruid=${principal.roleId} FOR SHARE`);
    await tx.execute(sql`SELECT role_id FROM adm_resource_action_grants
      WHERE role_id=${principal.roleId} AND resource='company_forms' AND action='override_checklist' FOR SHARE`);
  }
  const assignment = (await tx.execute(sql`SELECT assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_deleted
    FROM crew_assignments WHERE assign_uuid=${planning.relieverAssignUuid}`)).rows[0];
  if (!assignment || assignment.is_deleted || assignment.assignment_type === "Cancelled" ||
      assignment.crew_uuid !== planning.relieverCrewUuid || assignment.vessel_uuid !== planning.vesselUuid)
    throw new ChecklistGateError("The linked assignment is unavailable or changed. Reload Planning before completing the checklist.");
  if (principal.kind === "seafarer" || (principal.kind === "vessel" &&
      !principal.vesselUuids.includes(assignment.vessel_uuid)))
    throw new ChecklistGateError("You cannot complete a deployment checklist outside your permitted vessel.");
  const blockers: ChecklistBlocker[] = (await tx.execute(sql`
    SELECT r.requirement_uuid,r.status,r.unresolved_reason,f.name AS form_name
    FROM frm_requirements r JOIN adm_forms_v2 f ON f.form_uuid=r.form_uuid
    WHERE r.subject_type='crew_assignment' AND r.subject_ref=${planning.relieverAssignUuid}
      AND r.stage_key='before_joining' AND r.mandatory
      AND r.status IN('OUTSTANDING','STARTED','UNRESOLVED')
    ORDER BY r.created_at,r.requirement_uuid`)).rows.map((row: any) => ({
      kind: "requirement", status: row.status, formName: row.form_name,
      requirementUuid: row.requirement_uuid,
      reason: row.status === "UNRESOLVED" ? humanFormFactReason(row.unresolved_reason) : undefined,
    }));
  const state = await stageStatus(planning.relieverAssignUuid, tx);
  const stage = state.stages.find((s: any) => s.stage_key === "before_joining");
  // Go-live checked legacy crews' current stage only. Do not invent a
  // retrospective before-joining check for an already on-board contract.
  if ((stage && (stage.deferred || stage.outcome !== "COMPLETED")) ||
      (!stage && assignment.assignment_type === "Planned"))
    blockers.push({ kind: "check", status: stage?.outcome === "FAILED" ? "FAILED" :
      stage?.event_uuid ? "PENDING" : "NOT_CHECKED", eventUuid: stage?.event_uuid });
  const hasOverride = await assertCompanyFormPermission(principal, "override_checklist", {}, tx)
    .then(() => true, () => false);
  const canOverride = hasOverride && checklistOverrideEligible(blockers);
  const requested = req.body?.checklistOverride;
  if (requested !== undefined) {
    if (blockers.some(b => b.kind === "requirement" && ["OUTSTANDING", "STARTED"].includes(b.status)))
      throw new ChecklistGateError(checklistBlockerMessage(blockers), blockers, false);
    const parsed = z.object({ reason: z.string().trim().min(1).max(2000) }).strict().safeParse(requested);
    if (!parsed.success) throw new ChecklistGateError("Write a reason before overriding the checklist.", blockers, canOverride);
    if (!canOverride) throw new ChecklistGateError(blockers.some(b => b.kind === "requirement" &&
      ["OUTSTANDING", "STARTED"].includes(b.status)) ? checklistBlockerMessage(blockers) :
      "This checklist cannot be overridden. Verify your Override checklist permission and complete the listed checks.", blockers, false);
    const actor = await authenticatedActor(req, tx);
    await appendAudit(tx, { ...actor, source: "company_forms_checklist" }, "checklist_override",
      actor.roleId ?? null, "company_forms", "override_checklist",
      planning.deploymentChecklistCompleted ?? null, true,
      { planUuid: planning.planUuid, assignmentUuid: planning.relieverAssignUuid,
        reason: parsed.data.reason, blockers });
  } else if (blockers.length) {
    throw new ChecklistGateError(checklistBlockerMessage(blockers), blockers, canOverride);
  }
  await tx.execute(sql`SELECT set_config('sail.checklist_verified_plan',${planning.planUuid},true)`);
}

export function sendChecklistGateError(error: unknown, res: Response): boolean {
  if (!(error instanceof ChecklistGateError)) return false;
  res.status(error.status).json({ error: error.code, message: error.message,
    blockers: error.blockers, canOverride: error.canOverride });
  return true;
}
