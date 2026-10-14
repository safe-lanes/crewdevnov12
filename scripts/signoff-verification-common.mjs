import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
export const root = ".local/verification/signoff";
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
export const prefix = "/api/v2/company-form-submissions";
export const ensure = (value, message) => { if (!value) throw Error(message); };
export const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
export const token = actor => {
  const encode = data => Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, role: actor.role,
    userType: actor.userType, roleId: actor.roleUuid, vessels: actor.vesselUuid ? [actor.vesselUuid] : [] })}.devsig`;
};
export const write = async (file, value) => {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(`${root}/${file}`, JSON.stringify(value, null, 2));
};
export const read = async file => JSON.parse(await fs.readFile(`${root}/${file}`, "utf8"));
export const evidence = [];
export async function api(actor, method, path, body, expected = 200) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { Authorization: `Bearer ${token(actor)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  const record = { at: new Date().toISOString(), actorId: actor.id, actorRole: actor.role,
    method, path, body, status: response.status, expected, response: text };
  evidence.push(record);
  await write("requests.json", evidence);
  ensure((Array.isArray(expected) ? expected : [expected]).includes(response.status),
    `${method} ${path}: expected ${expected}, got ${response.status}: ${text.slice(0,1000)}`);
  return text ? JSON.parse(text) : null;
}
export async function insert(table, values) {
  const keys = Object.keys(values);
  return (await db.query(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(",")})
    VALUES (${keys.map((_, i) => `$${i+1}`).join(",")}) RETURNING *`, Object.values(values))).rows[0];
}
export async function clone(table, key, value, overrides) {
  const row = (await db.query(`SELECT * FROM "${table}" WHERE "${key}"=$1`, [value])).rows[0];
  ensure(row, `Missing approved fixture source ${table}/${value}`);
  for (const field of ["id", "created_at", "updated_at"]) delete row[field];
  return insert(table, { ...row, ...overrides, is_deleted: false, is_sync: false });
}
export async function register(label, values) {
  const uuids = [...JSON.stringify(values).matchAll(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)].map(m => m[0]);
  const existing = await fs.readFile("docs/company-form-regression-fixtures.md","utf8");
  if (uuids.length && uuids.every(uuid=>existing.includes(uuid))) return;
  // Fixture registry is evidence, not source; appended UUIDs are never removed.
  await fs.appendFile("docs/company-form-regression-fixtures.md",
    `\n### Retained sign-off fixture: ${label}\n\n${JSON.stringify(values, null, 2)}\n\nUUIDs: ${[...new Set(uuids)].map(u => "`"+u+"`").join(", ")}\n`);
}
const protectedTables = ["master_vessels","adm_company_ranks_v2","crew_members_v2","crew_assignments",
  "vessel_planning_v2","frm_company_submissions","frm_company_submission_system_snapshots",
  "frm_company_submission_assignments","frm_section_states","frm_section_signatures",
  "frm_answers","frm_signature_attachments","adm_forms_v2","adm_form_versions_v2","frm_form_parts","frm_sections","frm_questions",
  "master_users","adm_rolemaster_ac","adm_roleaccess_ac"];
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function snapshot() {
  const result = {};
  for (const table of protectedTables) {
    const rows = (await db.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY id`)).rows.map(r => r.value);
    result[table] = Object.fromEntries(rows.map(row => [row.id, hash(row)]));
  }
  return result;
}
export async function protectedCheck(before) {
  const now = await snapshot(), changes = [];
  for (const [table, rows] of Object.entries(before)) for (const [id, saved] of Object.entries(rows)) {
    if (now[table][id] !== saved) changes.push({ table, id });
  }
  await write("protected-comparison.json", { at: new Date().toISOString(), changes });
  ensure(!changes.length, `Protected records changed: ${JSON.stringify(changes)}`);
}
export function backend() {
  const line = execFileSync("ps", ["-eo","pid,lstart,args"], { encoding: "utf8" })
    .split("\n").find(line => line.includes("tsx/dist/loader.mjs server/index.ts"));
  ensure(line, "Managed main backend required");
  const fields = line.trim().split(/\s+/);
  return { pid: Number(fields[0]), startedAt: new Date(`${fields.slice(1,6).join(" ")} UTC`).toISOString() };
}
export { fs, randomUUID };