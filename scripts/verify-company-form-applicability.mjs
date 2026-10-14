import "./verification-guard.mjs";
// Development-only acceptance against the managed main preview.
// Creates labelled definitions and a temporary synthetic historical assignment.
// Never starts a declaration or changes existing assignments, signatures,
// stages, grants or authentication. Removes its temporary crew/assignment.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium } from "@playwright/test";
const root = ".local/verification/company-applicability";
await fs.mkdir(root, { recursive: true });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ensure = (v, message) => { if (!v) throw Error(message); };
const head = () => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
function mainPid() {
  const rows = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" }).split("\n")
    .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
  ensure(rows.length === 1, "Exactly one managed main backend required");
  return rows[0].trim().split(/\s+/)[0];
}
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const report = { head: head(), backendPid: mainPid(), checks: [], screenshots: [] };
report.commitAt = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
report.backendStartedAt = new Date(execFileSync("ps", ["-p", report.backendPid, "-o", "lstart="], { encoding: "utf8" }).trim()).toISOString();
const preflight = process.argv.includes("--preflight");
if (!preflight) ensure(new Date(report.backendStartedAt) > new Date(report.commitAt), "Backend must start after final commit");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
  ON r.assigned_role=u.role AND r.is_active=true AND r.is_deleted=false WHERE u.id=24`)).rows[0];
ensure(actor, "Existing authorised development authoring actor required");
async function api(method, path, data) {
  const response = await fetch(`${base}/api/v2/admin${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
const ok = (result, status = 200) => { ensure(result.status === status, JSON.stringify(result)); return result.body; };
async function refusedSQL(statement, params) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    try { await c.query(statement, params); throw Error("Expected SQL refusal"); }
    catch (e) { ensure(e.code === "23514", `Expected guard refusal, got ${e.message}`); return { code: e.code, reason: e.message }; }
  } finally { await c.query("ROLLBACK"); c.release(); }
}
let browser, temporaryCrewUuid, temporaryAssignmentUuid;
async function registerRetainedFixture() {
  if (!temporaryCrewUuid && !temporaryAssignmentUuid) return;
  await fs.appendFile("docs/company-form-regression-fixtures.md",
    `\n### Applicability preview fixture — ${new Date().toISOString()}\n\n` +
    `- Crew: \`${temporaryCrewUuid ?? "not created"}\`\n` +
    `- Assignment: \`${temporaryAssignmentUuid ?? "not created"}\`\n` +
    "- Created by scripts/verify-company-form-applicability.mjs; retained, including failed captures. No cleanup DELETE.\n");
  temporaryCrewUuid = undefined;
  temporaryAssignmentUuid = undefined;
}
try {
  let fixture;
  if (process.argv.includes("--reuse")) fixture = JSON.parse(await fs.readFile(`${root}/fixture.json`, "utf8"));
  else {
    const formUuid = randomUUID(), name = `TEST ONLY Version applicability ${formUuid.slice(0, 8)}`;
    const form = (await db.query(`INSERT INTO adm_forms_v2(form_uuid,name,description,category,subject_type,rank_group,version_no,version_date)
      VALUES($1,$2,'Acceptance definition only; no declaration created','dynamic','crew_assignment','','00','11-Oct-2026') RETURNING id`,
    [formUuid, name])).rows[0];
    await db.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
      VALUES($1,$2,'MAIN','Declaration','configurable')`, [randomUUID(), formUuid]);
    const versions = [];
    async function draft() {
      return ok(await api("POST", `/forms/${form.id}/versions`, {
        versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "at_sign_off",
      }));
    }
    for (const kind of ["initial", "none", "applicability", "signing", "both", "on_release"]) {
      const v = await draft();
      if (kind === "initial") {
        const part = (await db.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1 AND is_deleted=false", [v.fvUuid])).rows[0];
        const section = randomUUID();
        await db.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
          VALUES($1,$2,$3,'DECL','Declaration','seafarer')`, [section, v.fvUuid, part.form_part_uuid]);
        await db.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,comment_enabled)
          VALUES($1,$2,'ANSWER','Acceptance wording','free_text',true)`, [randomUUID(), section]);
      }
      if (kind === "applicability" || kind === "on_release") ok(await api("PUT", `/form-versions/${v.id}/applicability`, { mode: "all", obligation: "mandatory" }));
      if (kind === "signing") await db.query("UPDATE frm_sections SET signature_seafarer_required=true WHERE form_version_uuid=$1", [v.fvUuid]);
      if (kind === "both") {
        ok(await api("PUT", `/form-versions/${v.id}/applicability`, { mode: "all", obligation: "optional", effectiveKind: "specific_date", specificDate: "2099-01-01" }));
        await db.query(`UPDATE frm_questions SET question_text='Revised acceptance wording' WHERE section_uuid IN(
          SELECT section_uuid FROM frm_sections WHERE form_version_uuid=$1)`, [v.fvUuid]);
      }
      const released = ok(await api("POST", `/form-versions/${v.id}/release`));
      versions.push({ ...released, kind });
    }
    const pending = await draft();
    ok(await api("PUT", `/form-versions/${pending.id}/applicability`, { mode: "all", obligation: "mandatory", effectiveKind: "specific_date", specificDate: "2000-01-01" }));
    const pastDate = await api("POST", `/form-versions/${pending.id}/release`);
    ensure(pastDate.status === 400 && /never resolved retrospectively/.test(pastDate.body.error), "Past effective date must explain refusal");
    report.pastDate = pastDate;
    report.pastDateSQL = await refusedSQL("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [pending.fvUuid]);
    const conditional = ok(await api("PUT", `/form-versions/${pending.id}/applicability`, {
      mode: "conditional", obligation: "mandatory", sets: [
        { conditions: [{ dimensionKey: "rank", operator: "in", value: ["test-placeholder-awaiting-dimension-validation"] }] },
      ],
    }));
    fixture = { formId: form.id, formUuid, name, versions, pending, conditional };
    await fs.writeFile(`${root}/fixture.json`, JSON.stringify(fixture, null, 2));
  }
  report.fixture = { formId: fixture.formId, formUuid: fixture.formUuid };
  if (process.argv.includes("--reuse")) {
    // Repeat the date proof against the closing process, not an earlier
    // preflight. This changes only our still-unreleased test policy.
    ok(await api("PUT", `/form-versions/${fixture.pending.id}/applicability`, {
      mode: "all", obligation: "mandatory", effectiveKind: "specific_date", specificDate: "2000-01-01",
    }));
    report.pastDate = await api("POST", `/form-versions/${fixture.pending.id}/release`);
    ensure(report.pastDate.status === 400 && /never resolved retrospectively/.test(report.pastDate.body.error), "Closing past-date refusal required");
    report.pastDateSQL = await refusedSQL("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [fixture.pending.fvUuid]);
    const sets = fixture.conditional.sets.map(s => ({ conditions: s.conditions.map(c => ({
      dimensionKey: c.dimensionKey, operator: c.operator, value: c.value,
    })) }));
    ok(await api("PUT", `/form-versions/${fixture.pending.id}/applicability`, {
      mode: "conditional", obligation: "mandatory", sets,
    }));
  }
  report.versions = ok(await api("GET", `/forms/${fixture.formId}/versions`));
  for (const version of report.versions.filter(v => v.status === "released")) {
    const original = fixture.versions.find(v => v.fvUuid === version.fvUuid);
    const signing = version.changeSummary?.details.includes("Signing configuration changed") ?? false;
    ensure(signing === (original.kind === "signing"), `Incorrect signing-change label on ${original.kind}`);
  }
  const conditionalRefused = await api("POST", `/form-versions/${fixture.pending.id}/release`);
  ensure(conditionalRefused.status === 400 && /dimension validation/.test(conditionalRefused.body.error), "Conditional release must stay closed");
  report.conditionalRefused = conditionalRefused;
  const frozen = await api("PUT", `/form-versions/${fixture.versions[5].id}/applicability`, { mode: "manual_only" });
  ensure(frozen.status === 409, "Released policy API write must be refused");
  report.releasedWriteRefused = frozen;
  report.releasedSQLRefused = await refusedSQL("UPDATE frm_version_applicability SET obligation='optional' WHERE version_uuid=$1", [fixture.versions[5].fvUuid]);
  report.rawSQL = (await db.query(`SELECT v.fv_uuid,v.status,p.mode,p.obligation,p.effective_kind,p.specific_date,p.effective_from,
    p.copied_from_version_uuid,c.previous_version_uuid,c.content_changed,c.applicability_changed,c.details,c.released_by
    FROM adm_form_versions_v2 v JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
    LEFT JOIN frm_version_release_changes c ON c.version_uuid=v.fv_uuid WHERE v.form_id=$1 ORDER BY v.id`, [fixture.formId])).rows;
  report.declarationsCreated = Number((await db.query("SELECT count(*) FROM frm_company_submissions WHERE form_uuid=$1", [fixture.formUuid])).rows[0].count);
  ensure(report.declarationsCreated === 0, "Persistence must not resolve or create declarations");
  const baseCounts = (await db.query(`SELECT count(*) FILTER(WHERE f.category='dynamic' AND p.version_uuid IS NULL) missing_company_policies,
    count(*) FILTER(WHERE f.category<>'dynamic' AND p.version_uuid IS NOT NULL) standard_policies
    FROM adm_form_versions_v2 v JOIN adm_forms_v2 f ON f.id=v.form_id LEFT JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid`)).rows[0];
  ensure(baseCounts.missing_company_policies === "0" && baseCounts.standard_policies === "0", "Company-only initialization must be complete");
  report.policyCounts = baseCounts;
  report.upgradeCohort = (await db.query(`SELECT v.fv_uuid,v.status,p.mode FROM adm_form_versions_v2 v
    JOIN adm_forms_v2 f ON f.id=v.form_id JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
    WHERE f.category='dynamic' AND v.created_at < (
      SELECT applied_at FROM schema_migrations WHERE filename='0237_company_form_applicability_policy.sql'
    ) ORDER BY v.id`)).rows;
  ensure(report.upgradeCohort.every(v => v.mode === "manual_only"), "Unedited upgrade cohort must remain manual only");
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  const page = await context.newPage();
  await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").waitFor({ timeout: 45000 });
  await page.getByTestId("tab-company-forms").click();
  await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
  await page.getByTestId("select-form-version").click({ timeout: 30000 });
  for (const [index, label] of [[0, "Manual only"], [1, "No change"], [2, "Applicability changed"], [3, "Signing configuration changed"], [4, "Content + applicability changed"]]) {
    await page.getByRole("option").getByTestId(`version-policy-${fixture.versions[index].fvUuid}`).getByText(label, { exact: false }).waitFor();
    report.checks.push(`Version ${index + 1}: ${label}`);
  }
  await page.getByRole("option").getByTestId(`version-policy-${fixture.pending.fvUuid}`).getByText("Applies when conditions match", { exact: false }).waitFor();
  await page.screenshot({ path: `${root}/version-list.jpg`, animations: "disabled" }); report.screenshots.push(`${root}/version-list.jpg`);
  await page.keyboard.press("Escape");
  const legacy = (await db.query(`SELECT f.id,f.name,v.fv_uuid FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
    WHERE f.category='dynamic' AND f.is_deleted=false AND f.archived_at IS NULL AND v.is_deleted=false
      AND v.rank_group_id IS NULL AND v.created_at < (
        SELECT applied_at FROM schema_migrations WHERE filename='0237_company_form_applicability_policy.sql'
      ) ORDER BY f.id LIMIT 1`)).rows[0];
  ensure(legacy, "An existing upgrade version is required for the legacy UI proof");
  await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").click({ timeout: 30000 });
  await page.getByRole("button", { name: `Configure ${legacy.name}`, exact: true }).click();
  await page.getByTestId("select-form-version").click({ timeout: 30000 });
  await page.getByRole("option").getByTestId(`version-policy-${legacy.fv_uuid}`).waitFor({ timeout: 30000 });
  const legacyOptions = await page.getByRole("option").allTextContents();
  ensure(legacyOptions.length && legacyOptions.every(t => /Manual only/.test(t)), "Upgrade versions must display Manual only");
  await page.screenshot({ path: `${root}/upgrade-manual-only.jpg`, animations: "disabled" }); report.screenshots.push(`${root}/upgrade-manual-only.jpg`);
  report.checks.push("Existing upgrade versions display Manual only without fabricated historical comparisons");
  await page.keyboard.press("Escape");
  // Separate test-only history. Do not invent actual sign-off dates on a
  // retained on-board assignment merely to make the picker available.
  const crewUuid = randomUUID(), assignmentUuid = randomUUID();
  temporaryCrewUuid = crewUuid; temporaryAssignmentUuid = assignmentUuid;
  await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name)
    VALUES($1,$2,'TEST ONLY','Applicability picker')`, [crewUuid, `TEST-CF-${crewUuid.slice(0, 8)}`]);
  const vessel = (await db.query("SELECT vessel_uuid FROM master_vessels WHERE is_deleted=false AND is_active=true ORDER BY id LIMIT 1")).rows[0];
  ensure(vessel, "Existing canonical vessel reference required for synthetic history");
  await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date,sign_off_date)
    VALUES($1,$2,$3,'OnBoard',false,'2026-10-01','2026-10-10')`, [assignmentUuid, crewUuid, vessel.vessel_uuid]);
  await page.goto(`${base}/crew-pool?crew=${crewUuid}&section=G`, { waitUntil: "domcontentloaded" });
  const group = page.getByTestId(`crew-company-forms-group-${assignmentUuid}`);
  await group.waitFor({ timeout: 45000 });
  if (!(await group.evaluate(e => e.open))) await group.locator("summary").click();
  const picker = page.getByTestId(`crew-company-forms-signoff-picker-${assignmentUuid}`);
  await picker.waitFor({ timeout: 30000 });
  await picker.getByRole("button", { name: "Choose a form", exact: true }).click();
  const option = picker.getByRole("option", { name: new RegExp(fixture.name) });
  await option.waitFor({ state: "attached", timeout: 30000 });
  await picker.getByRole("combobox").selectOption({ label: (await option.textContent()).trim() });
  await page.screenshot({ path: `${root}/unchanged-manual-picker.jpg`, animations: "disabled" }); report.screenshots.push(`${root}/unchanged-manual-picker.jpg`);
  report.checks.push("Existing manual sign-off picker still offers the released definition; no automatic resolution");
  ensure(Number((await db.query("SELECT count(*) FROM frm_company_submissions WHERE form_uuid=$1", [fixture.formUuid])).rows[0].count) === 0,
    "Opening the picker must not create a declaration");
  report.temporaryPickerFixture = { crewUuid, assignmentUuid, cleanup: "Retained and registered; no existing assignment changed" };
  await registerRetainedFixture();
  if (!preflight) {
    ok(await api("POST", `/forms/${fixture.formId}/archive`));
    report.fixture.archivedAfterCapture = true;
  }
  ensure(head() === report.head && mainPid() === report.backendPid, "HEAD and managed backend must remain unchanged");
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(`${root}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ head: report.head, commitAt: report.commitAt, backendPid: report.backendPid,
    backendStartedAt: report.backendStartedAt, checks: report.checks, report: `${root}/report.json` }, null, 2));
} finally {
  if (browser) await browser.close();
  await registerRetainedFixture();
  await db.end();
}
