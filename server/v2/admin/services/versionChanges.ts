import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { readApplicability } from "./applicabilityService";
import type { VersionApplicability, VersionChangeSummary } from "../../../../shared/v2/admin/applicability";

const identityFields = new Set(["id", "created_at", "updated_at", "created_by_uuid", "updated_by_uuid",
  "is_deleted", "is_sync", "form_version_uuid", "form_uuid"]);
const entityIds = new Set(["form_part_uuid", "section_uuid", "question_uuid", "option_set_uuid", "option_uuid"]);
const signingKey = (key: string) => /^(signature_|vessel_signature_|responsible_|witness)/.test(key);

export function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function parseConfig(value: any) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
export function policySnapshot(p: VersionApplicability) {
  return {
    mode: p.mode, obligation: p.obligation, effectiveKind: p.effectiveKind, specificDate: p.specificDate,
    // resolved on-release dates and clone UUIDs aren't an authored policy change.
    sets: p.sets.map(s => s.conditions.map(c => ({
      dimensionKey: c.dimensionKey, operator: c.operator,
      value: Array.isArray(c.value) ? [...new Set(c.value)].sort() : c.value,
    })).sort((a, b) => canonical(a).localeCompare(canonical(b))))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
  };
}
function withoutSigning(value: any): any {
  if (Array.isArray(value)) return value.map(withoutSigning);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).filter(([k]) => !signingKey(k)).map(([k, v]) => [k, withoutSigning(v)]));
  return value;
}
function signingValues(value: any, path = ""): any[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) =>
    signingKey(k) ? [[`${path}/${k}`, v]] : signingValues(v, `${path}/${k}`));
}

export async function contentSnapshot(versionUuid: string, tx: any) {
  const version = (await tx.execute(sql`SELECT configuration,shared_config,stage_key,stage_subject_type
    FROM adm_form_versions_v2 WHERE fv_uuid=${versionUuid}`)).rows[0];
  const parts = (await tx.execute(sql`SELECT * FROM frm_form_parts WHERE form_version_uuid=${versionUuid}
    AND is_deleted=false ORDER BY sort_order,id`)).rows;
  const sections = (await tx.execute(sql`SELECT s.* FROM frm_sections s JOIN frm_form_parts p
    ON p.form_part_uuid=s.form_part_uuid WHERE s.form_version_uuid=${versionUuid}
    AND s.is_deleted=false AND p.is_deleted=false ORDER BY p.sort_order,p.id,s.sort_order,s.id`)).rows;
  const questions = (await tx.execute(sql`SELECT q.* FROM frm_questions q JOIN frm_sections s
    ON s.section_uuid=q.section_uuid JOIN frm_form_parts p ON p.form_part_uuid=s.form_part_uuid
    WHERE s.form_version_uuid=${versionUuid} AND q.is_deleted=false AND s.is_deleted=false
    AND p.is_deleted=false ORDER BY p.sort_order,p.id,s.sort_order,s.id,q.sort_order,q.id`)).rows;
  const sets = (await tx.execute(sql`SELECT * FROM frm_option_sets WHERE form_version_uuid=${versionUuid}
    AND is_deleted=false ORDER BY sort_order,id`)).rows;
  const options = (await tx.execute(sql`SELECT o.* FROM frm_options o JOIN frm_option_sets s
    ON s.option_set_uuid=o.option_set_uuid WHERE s.form_version_uuid=${versionUuid}
    AND o.is_deleted=false AND s.is_deleted=false ORDER BY s.sort_order,s.id,o.sort_order,o.id`)).rows;
  const entities: Record<string, any[]> = { parts, sections, questions, optionSets: sets, options };
  const ids = new Map<string, string>();
  for (const [kind, rows] of Object.entries(entities)) rows.forEach((r, index) => {
    for (const k of entityIds) if (typeof r[k] === "string") {
      // A row's own identity, not its foreign reference.
      const own = ({ parts: "form_part_uuid", sections: "section_uuid", questions: "question_uuid",
        optionSets: "option_set_uuid", options: "option_uuid" } as Record<string, string>)[kind];
      if (k === own) ids.set(r[k], `${kind}:${index}`);
    }
  });
  const normalize = (v: any): any => {
    if (typeof v === "string") return ids.get(v) ?? v;
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v)
      .map(([k, val]) => [k, normalize(val)]));
    return v;
  };
  // Strip database identity/audit columns only on database rows. An "id"
  // inside authored configuration/validation/layout is meaningful content.
  const cleanEntities = Object.fromEntries(Object.entries(entities).map(([kind, rows]) =>
    [kind, rows.map(row => Object.fromEntries(Object.entries(row).filter(([k]) => !identityFields.has(k))))]));
  return normalize({ ...cleanEntities, configuration: parseConfig(version.configuration),
    sharedConfig: parseConfig(version.shared_config), stageKey: version.stage_key, subjectType: version.stage_subject_type });
}

export async function recordReleaseChanges(versionUuid: string, previousUuid: string | null, actor: string | null, tx: any) {
  const content = await contentSnapshot(versionUuid, tx);
  const policy = policySnapshot(await readApplicability(versionUuid, tx));
  let contentChanged = false, applicabilityChanged = false;
  const details: string[] = [];
  if (previousUuid) {
    const recorded = (await tx.execute(sql`SELECT content_snapshot,policy_snapshot FROM frm_version_release_changes
      WHERE version_uuid=${previousUuid}`)).rows[0];
    const previousContent = recorded?.content_snapshot ?? await contentSnapshot(previousUuid, tx);
    const previousPolicy = recorded?.policy_snapshot ?? policySnapshot(await readApplicability(previousUuid, tx));
    contentChanged = canonical(content) !== canonical(previousContent);
    applicabilityChanged = canonical(policy) !== canonical(previousPolicy);
    if (canonical(signingValues(content)) !== canonical(signingValues(previousContent))) details.push("Signing configuration changed");
    if (canonical(withoutSigning(content)) !== canonical(withoutSigning(previousContent))) details.push("Wording / fields / layout changed");
    if (applicabilityChanged) details.push("Applicability changed");
  } else details.push("Initial release");
  await tx.execute(sql`INSERT INTO frm_version_release_changes(version_uuid,previous_version_uuid,
    content_changed,applicability_changed,details,content_snapshot,policy_snapshot,released_by)
    VALUES(${versionUuid},${previousUuid},${contentChanged},${applicabilityChanged},
      ${JSON.stringify(details)}::jsonb,${JSON.stringify(content)}::jsonb,${JSON.stringify(policy)}::jsonb,${actor})`);
}

export async function readChangeSummary(versionUuid: string, tx: any = getDb()): Promise<VersionChangeSummary | null> {
  const result = await tx.execute(sql`SELECT previous_version_uuid AS "previousVersionUuid",
    content_changed AS "contentChanged",applicability_changed AS "applicabilityChanged",details
    FROM frm_version_release_changes WHERE version_uuid=${versionUuid}`);
  return result.rows[0] ?? null;
}
export async function enrichCompanyVersions<T extends { fvUuid: string }>(versions: T[], tx: any = getDb()) {
  return Promise.all(versions.map(async v => ({
    ...v, applicability: await readApplicability(v.fvUuid, tx),
    changeSummary: await readChangeSummary(v.fvUuid, tx),
  })));
}
