import type { Request } from "express";
import { z } from "zod";
import { getDb } from "../../db";
import { companyFormSubjectRegistry } from "../../company-forms/registry";
import { resolveCompanyFormPrincipal } from "../../company-forms/trustedPrincipalService";
import { evaluateRule } from "../../company-forms/evaluateRule";
import { validateDimensionCondition } from "../../company-forms/ruleDimensionValidation";
import { ApplicabilityError, getPolicyVersion, policyInput } from "./applicabilityService";
import type { ApplicabilityCondition } from "../../../../shared/v2/admin/applicability";
import type { RulePreview } from "../../../../shared/v2/admin/applicabilityPreview";

async function context(req: Request, id: number) {
  const db = getDb();
  const version = await getPolicyVersion(id, db);
  if (version.archived_at) throw new ApplicabilityError("This form is archived.", 409);
  const adapter = companyFormSubjectRegistry.get(version.subject_type);
  const principal = await resolveCompanyFormPrincipal(req);
  return { db, version, adapter, principal };
}
export async function searchRuleAssignments(req: Request, id: number, search: string) {
  const { db, adapter, principal } = await context(req, id);
  if (!adapter.searchRuleSubjects) throw new ApplicabilityError("Assignment trials are not available for this form.", 400);
  return adapter.searchRuleSubjects(principal, search, db);
}
const trialInput = z.object({ subjectRef: z.string().uuid(), policy: policyInput }).strict();
export async function previewApplicability(req: Request, id: number): Promise<RulePreview> {
  const parsed = trialInput.safeParse(req.body);
  if (!parsed.success) throw new ApplicabilityError("Send only an assignment and a valid draft rule; deciding facts and identity are server-derived.");
  const { db, version, adapter, principal } = await context(req, id);
  if (version.status !== "draft") throw new ApplicabilityError("Try rules in a draft, not a released version.", 409);
  if (!version.stage_key) throw new ApplicabilityError("Choose a subject stage before trying this rule.");
  const stages = await adapter.loadStages(db);
  const stage = stages.find(s => s.stageKey === version.stage_key);
  if (!stage) throw new ApplicabilityError("The selected stage is not available.");
  const subject = await adapter.lookup(parsed.data.subjectRef, db);
  if (!subject || !adapter.authorizeRuleRead?.(principal, subject.context))
    throw new ApplicabilityError("This assignment is not available to you.", 403);
  if (!adapter.readRuleDimensions) throw new ApplicabilityError("Form rule facts are not available.");
  const p = parsed.data.policy;
  if (p.mode === "manual_only" && (p.obligation || p.effectiveKind || p.specificDate || p.sets?.length))
    throw new ApplicabilityError("Manual only has no obligation, effective date or conditions.");
  if (p.mode !== "manual_only" && !p.obligation) throw new ApplicabilityError("Choose Mandatory or Optional.");
  const date = p.specificDate ? new Date(`${p.specificDate}T00:00:00Z`) : null;
  if (p.effectiveKind === "specific_date" && !date ||
    date && (p.effectiveKind !== "specific_date" || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0,10) !== p.specificDate))
    throw new ApplicabilityError("Choose a real effective date.");
  if (p.specificDate && p.specificDate < new Date().toISOString().slice(0,10))
    throw new ApplicabilityError("This effective date is before the earliest possible release date. Choose On release or a later date; rules never apply retrospectively.");
  if (p.mode !== "conditional" && p.sets?.length) throw new ApplicabilityError("Only conditional rules have cards.");
  if (p.mode === "conditional" && (!p.sets?.length || p.sets.some(s => !s.conditions.length)))
    throw new ApplicabilityError("Add at least one condition to every card.");
  for (const set of p.sets ?? []) for (const c of set.conditions) {
    try { await validateDimensionCondition(adapter, { ...c, conditionUuid: c.conditionUuid ?? "" } as ApplicabilityCondition, db); }
    catch {
      const label = adapter.ruleDimensions?.find(d => d.key === c.dimensionKey)?.label ?? "Selected condition";
      throw new ApplicabilityError(`${label}: select an available condition, supported comparison and active master values.`);
    }
  }
  const facts = await adapter.readRuleDimensions(subject.context, db);
  return { ...evaluateRule(p, facts), stageLabel: stage.label,
    timing: p.mode === "manual_only" ? "No automatic requirement is created." :
      `Draft trial only. ${p.obligation === "mandatory" ? "Mandatory" : "Optional"} ${p.effectiveKind === "specific_date" ? `from ${p.specificDate}` : "from release"}, for an eligible future ${stage.label} trigger. An already-triggered stage is not reassessed retrospectively. No records are created.` };
}
