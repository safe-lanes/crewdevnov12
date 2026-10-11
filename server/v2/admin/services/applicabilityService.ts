import { sql } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { getDb } from "../../db";
import type { VersionApplicability } from "../../../../shared/v2/admin/applicability";

export class ApplicabilityError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}
const conditionInput = z.object({
  conditionUuid: z.string().uuid().optional(),
  dimensionKey: z.string().trim().min(1).max(120),
  operator: z.enum(["in", "not_in", "contains_any", "contains_all", "is"]),
  value: z.union([z.array(z.string().trim().min(1)).min(1).max(200), z.boolean()]),
}).strict().refine(c => c.operator === "is" ? typeof c.value === "boolean" : Array.isArray(c.value),
  "Condition operator and value shape do not agree");
const policyInput = z.object({
  mode: z.enum(["manual_only", "all", "conditional"]),
  obligation: z.enum(["mandatory", "optional"]).optional(),
  effectiveKind: z.enum(["on_release", "specific_date"]).optional(),
  specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sets: z.array(z.object({
    setUuid: z.string().uuid().optional(),
    conditions: z.array(conditionInput).max(50),
  }).strict()).max(50).optional(),
}).strict();

export async function readApplicability(versionUuid: string, tx: any = getDb()): Promise<VersionApplicability> {
  const result = await tx.execute(sql`SELECT version_uuid AS "versionUuid",mode,obligation,
    effective_kind AS "effectiveKind",specific_date::text AS "specificDate",
    effective_from::text AS "effectiveFrom",copied_from_version_uuid AS "copiedFromVersionUuid"
    FROM frm_version_applicability WHERE version_uuid=${versionUuid}`);
  const policy = result.rows[0];
  if (!policy) throw new ApplicabilityError("Company Form applicability policy not found", 404);
  const sets = await tx.execute(sql`SELECT set_uuid AS "setUuid" FROM frm_applicability_sets
    WHERE version_uuid=${versionUuid} ORDER BY set_uuid`);
  const conditions = await tx.execute(sql`SELECT c.condition_uuid AS "conditionUuid",
    c.set_uuid AS "setUuid",c.dimension_key AS "dimensionKey",c.operator,c.value
    FROM frm_applicability_conditions c JOIN frm_applicability_sets s ON s.set_uuid=c.set_uuid
    WHERE s.version_uuid=${versionUuid} ORDER BY c.condition_uuid`);
  return { ...policy, sets: sets.rows.map((s: any) => ({
    setUuid: s.setUuid, conditions: conditions.rows.filter((c: any) => c.setUuid === s.setUuid)
      .map(({ setUuid: _setUuid, ...c }: any) => c),
  })) } as VersionApplicability;
}

export async function getPolicyVersion(id: number, tx: any, lock = false) {
  const initial = await tx.execute(sql`SELECT form_id FROM adm_form_versions_v2 WHERE id=${id} AND is_deleted=false`);
  if (!initial.rows[0]) throw new ApplicabilityError("Form version not found", 404);
  const formId = initial.rows[0].form_id;
  if (lock) await tx.execute(sql`SELECT id FROM adm_forms_v2 WHERE id=${formId} FOR UPDATE`);
  const query = sql`SELECT v.fv_uuid,v.status,f.category,f.archived_at FROM adm_form_versions_v2 v
    JOIN adm_forms_v2 f ON f.id=v.form_id WHERE v.id=${id} AND v.is_deleted=false`;
  const result = await tx.execute(lock ? sql`${query} FOR UPDATE OF v` : query);
  const row = result.rows[0];
  if (!row || row.category !== "dynamic") throw new ApplicabilityError("Company Form version not found", 404);
  return row;
}

export async function writeApplicability(id: number, input: unknown): Promise<VersionApplicability> {
  const parsed = policyInput.safeParse(input);
  if (!parsed.success) throw new ApplicabilityError(parsed.error.issues.map(i => i.message).join("; "));
  const p = parsed.data;
  if (p.mode === "manual_only" && (p.obligation || p.effectiveKind || p.specificDate || p.sets?.length))
    throw new ApplicabilityError("Manual only has no obligation, effective date or condition sets");
  if (p.mode !== "manual_only" && !p.obligation) throw new ApplicabilityError("Automatic modes require mandatory or optional");
  const effectiveKind = p.mode === "manual_only" ? null : p.effectiveKind ?? "on_release";
  if (effectiveKind === "specific_date" && !p.specificDate)
    throw new ApplicabilityError("A specific effective date is required");
  if (p.specificDate) {
    const date = new Date(`${p.specificDate}T00:00:00Z`);
    if (effectiveKind !== "specific_date" || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== p.specificDate)
      throw new ApplicabilityError("Specific date must be a real calendar date and use specific_date");
  }
  if (p.mode !== "conditional" && p.sets?.length) throw new ApplicabilityError("Only conditional policies contain sets");
  return getDb().transaction(async (tx: any) => {
    const version = await getPolicyVersion(id, tx, true);
    if (version.status !== "draft" || version.archived_at)
      throw new ApplicabilityError("Released or archived applicability policy is immutable", 409);
    const old = await readApplicability(version.fv_uuid, tx);
    const seen = new Set<string>();
    const sets = (p.sets ?? []).map(s => {
      if (s.setUuid && !old.sets.some(o => o.setUuid === s.setUuid))
        throw new ApplicabilityError("Condition set does not belong to this version");
      const setUuid = s.setUuid ?? uuid();
      if (seen.has(setUuid)) throw new ApplicabilityError("Duplicate set identifier");
      seen.add(setUuid);
      return { setUuid, conditions: s.conditions.map(c => {
        if (c.conditionUuid && !old.sets.find(o => o.setUuid === setUuid)?.conditions.some(o => o.conditionUuid === c.conditionUuid))
          throw new ApplicabilityError("Condition does not belong to this version and set");
        const conditionUuid = c.conditionUuid ?? uuid();
        if (seen.has(conditionUuid)) throw new ApplicabilityError("Duplicate condition identifier");
        seen.add(conditionUuid);
        return { ...c, conditionUuid };
      }) };
    });
    await tx.execute(sql`DELETE FROM frm_applicability_sets WHERE version_uuid=${version.fv_uuid}`);
    await tx.execute(sql`UPDATE frm_version_applicability SET mode=${p.mode},
      obligation=${p.obligation ?? null},effective_kind=${effectiveKind},specific_date=${p.specificDate ?? null}
      WHERE version_uuid=${version.fv_uuid}`);
    await insertSets(version.fv_uuid, sets, tx);
    return readApplicability(version.fv_uuid, tx);
  });
}

async function insertSets(versionUuid: string, sets: VersionApplicability["sets"], tx: any) {
  for (const s of sets) {
    await tx.execute(sql`INSERT INTO frm_applicability_sets(set_uuid,version_uuid) VALUES(${s.setUuid},${versionUuid})`);
    for (const c of s.conditions) await tx.execute(sql`INSERT INTO frm_applicability_conditions
      (condition_uuid,set_uuid,dimension_key,operator,value)
      VALUES(${c.conditionUuid},${s.setUuid},${c.dimensionKey},${c.operator},${JSON.stringify(c.value)}::jsonb)`);
  }
}

export async function copyApplicability(sourceUuid: string, destinationUuid: string, tx: any) {
  const source = await readApplicability(sourceUuid, tx);
  await tx.execute(sql`UPDATE frm_version_applicability SET mode=${source.mode},obligation=${source.obligation},
    effective_kind=${source.effectiveKind},specific_date=${source.specificDate},
    copied_from_version_uuid=${sourceUuid} WHERE version_uuid=${destinationUuid}`);
  await insertSets(destinationUuid, source.sets.map(s => ({
    setUuid: uuid(), conditions: s.conditions.map(c => ({ ...c, conditionUuid: uuid() })),
  })), tx);
}

export async function validateApplicabilityRelease(versionUuid: string, tx: any) {
  const policy = await readApplicability(versionUuid, tx);
  // A fail-closed seam: the dimension slice must supply trusted validation,
  // including its database release guard. Never accept client "ready" flags.
  if (policy.mode === "conditional")
    throw new ApplicabilityError("Conditional applicability cannot be released until server-side dimension validation is available");
  const result = await tx.execute(sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day`);
  const releaseDay = result.rows[0].day as string;
  if (policy.effectiveKind === "specific_date" && policy.specificDate! < releaseDay)
    throw new ApplicabilityError(`Effective-from date ${policy.specificDate} is earlier than release date ${releaseDay}; a rule cannot claim applicability before it existed and requirements are never resolved retrospectively`);
}
