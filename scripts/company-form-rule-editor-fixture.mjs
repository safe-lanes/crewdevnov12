import "./verification-guard.mjs";
// Retained authoring fixtures only. Never delete/reset crew, assignments or history.
import fs from "node:fs/promises";
import pg from "pg";
import { randomUUID } from "node:crypto";
export const directory = ".local/verification/company-form-rule-editor";
export const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const ensure = (value, message) => { if (!value) throw Error(message); };
export const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
ensure(actor, "Existing verified Forms author required");
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
export const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, userType: "Office", domain: "test" })}.devsig`;
export async function api(method, path, body) {
  const response = await fetch(`${base}/api/v2/admin${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  ensure(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
export function payload(policy) {
  return { mode: policy.mode, obligation: policy.obligation, effectiveKind: policy.effectiveKind,
    ...(policy.effectiveKind === "specific_date" ? { specificDate: policy.specificDate } : {}),
    sets: policy.sets.map(s => ({ setUuid: s.setUuid, conditions: s.conditions.map(c => ({
      conditionUuid: c.conditionUuid, dimensionKey: c.dimensionKey, operator: c.operator, value: c.value,
    })) })) };
}
export async function registerOwned() {
  const refs = (await db.query(`WITH owned AS (SELECT id,form_uuid FROM adm_forms_v2 WHERE name LIKE 'TEST ONLY Rule editor %'),
    versions AS (SELECT v.fv_uuid FROM adm_form_versions_v2 v JOIN owned f ON f.id=v.form_id),
    sections AS (SELECT s.section_uuid FROM frm_sections s JOIN versions v ON v.fv_uuid=s.form_version_uuid)
    SELECT form_uuid ref FROM owned UNION SELECT fv_uuid FROM versions
    UNION SELECT p.form_part_uuid FROM frm_form_parts p JOIN owned f ON f.form_uuid=p.form_uuid
    UNION SELECT section_uuid FROM sections UNION SELECT q.question_uuid FROM frm_questions q JOIN sections s ON s.section_uuid=q.section_uuid
    UNION SELECT s.set_uuid FROM frm_applicability_sets s JOIN versions v ON v.fv_uuid=s.version_uuid
    UNION SELECT c.condition_uuid FROM frm_applicability_conditions c JOIN frm_applicability_sets s ON s.set_uuid=c.set_uuid JOIN versions v ON v.fv_uuid=s.version_uuid
    UNION SELECT crew_uuid FROM crew_members_v2 WHERE first_name LIKE 'TEST RULE %'
    UNION SELECT a.assign_uuid FROM crew_assignments a JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid WHERE c.first_name LIKE 'TEST RULE %'`)).rows.map(r => r.ref);
  await fs.appendFile("docs/company-form-regression-fixtures.md",
    `\n### Rule editor retained inventory — ${new Date().toISOString()}\n\n` +
    `All authoring definitions, versions, parts, sections/questions, condition identities and test-only crew/assignments, including interrupted setup, are retained: ${refs.map(r => `\`${r}\``).join(", ")}.\n` +
    "The closing journey edits registered draft identities only; it never creates an operational form or resolution record. No fixture deletion.\n");
}
export async function prepare({ copy = false, resetManual = false } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const form = (await db.query(`SELECT id,name,form_uuid FROM adm_forms_v2
    WHERE name LIKE 'TEST ONLY Rule editor %' ORDER BY id DESC LIMIT 1`)).rows[0];
  ensure(form, "Run the registered rule editor API regression first");
  let version = (await db.query("SELECT id,fv_uuid,version_no,status FROM adm_form_versions_v2 WHERE form_id=$1 ORDER BY id DESC LIMIT 1", [form.id])).rows[0];
  if (copy) {
    const next = await api("POST", `/forms/${form.id}/versions`, {
      versionNo: "next", versionDate: new Date().toISOString().slice(0,10), configuration: "{}",
    });
    version = { id: next.id, fv_uuid: next.fvUuid, version_no: next.versionNo, status: next.status };
  }
  ensure(version.status === "draft", "Only a retained draft may be prepared");
  await api("PUT", `/form-versions/${version.id}`, { stageKey: "before_joining" });
  const suffix = form.name.split(" ").at(-1);
  const subjects = (await db.query(`SELECT a.assign_uuid,c.crew_uuid,c.first_name,c.nationality_uuid,r.contract_rank_uuid
    FROM crew_members_v2 c JOIN crew_assignments a ON a.crew_uuid=c.crew_uuid
    JOIN crew_assignment_rule_context r ON r.assign_uuid=a.assign_uuid
    WHERE c.first_name LIKE $1 ORDER BY c.first_name`, [`TEST RULE ${suffix} %`])).rows;
  ensure(subjects.length === 2, "Two distinct retained seafarers required");
  const catalog = await api("GET", `/forms/${form.id}/rule-dimensions`);
  const choices = key => catalog.find(d => d.key === key).choices;
  const selected = (key, id) => { const value = choices(key).find(c => c.id === id); ensure(value, `Retained ${key} must remain eligible`); return value; };
  const rankA = selected("rank", subjects[0].contract_rank_uuid);
  const rankB = selected("rank", subjects[1].contract_rank_uuid);
  const rankC = choices("rank").find(r => r.id !== rankA.id && r.id !== rankB.id);
  const natA = selected("nationality", subjects[0].nationality_uuid), natB = selected("nationality", subjects[1].nationality_uuid);
  const fixture = { form, version, subjects, rankA, rankB, rankC, natA, natB };
  if (resetManual) await api("PUT", `/form-versions/${version.id}/applicability`, { mode: "manual_only" });
  else {
    const original = await api("GET", `/form-versions/${version.id}/applicability`);
    ensure(original.sets.length === 2, "Closing copy must retain two registered cards");
    const seed = payload(original);
    seed.sets.forEach(s => s.conditions.forEach(c => {
      c.value = [c.dimensionKey === "rank" ? rankB.id : natB.id];
    }));
    await api("PUT", `/form-versions/${version.id}/applicability`, seed);
    fixture.identities = original.sets.flatMap(s => [s.setUuid, ...s.conditions.map(c => c.conditionUuid)]).sort();
  }
  await registerOwned();
  await fs.writeFile(`${directory}/fixture.json`, JSON.stringify(fixture, null, 2));
  return fixture;
}
