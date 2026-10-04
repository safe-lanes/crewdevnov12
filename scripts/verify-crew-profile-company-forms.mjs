// Read-only acceptance against the existing managed development application.
// No fixture creation, sign-on, source reset, signing, voiding or auth changes.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium } from "@playwright/test";

const root = ".local/verification";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const folder = `${root}/crew-profile-company-forms/${stamp}`;
await fs.mkdir(folder, { recursive: true });
const fixture = JSON.parse(await fs.readFile(`${root}/onboard-retained-fixtures.json`, "utf8"));
const crewUuid = "424584fc-dc59-4f85-aa14-30781eb8477e";
const assignmentUuid = "10df4ffb-db61-46a9-ac7a-cc5e290b7376";
const originalUuid = "026068b1-a083-4f86-9bf0-166df6ba6f6a";
const replacementUuid = "8de8fd4f-31f8-4a62-ba4b-7d2ba43715fd";
const onboardUuid = "6b2d6d21-2f1f-4fe2-b674-7224ba368fe7";
const prefix = "/api/v2/company-form-submissions";
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ensure = (value, message) => { if (!value) throw Error(message); };
const save = (file, data) => fs.writeFile(`${folder}/${file}`, JSON.stringify(data, null, 2));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = actor => `${encode({ alg: "none", typ: "JWT" })}.${encode({
  id: actor.id, role: actor.role, roleId: actor.roleUuid, userType: actor.userType,
  vessels: actor.userType === "Ship" ? [actor.vesselUuid].filter(Boolean) : [],
})}.devsig`;
const report = { head: git("rev-parse", "HEAD"), commitTime: git("show", "-s", "--format=%cI", "HEAD"),
  startedAt: new Date().toISOString(), crewUuid, assignmentUuid, originalUuid, replacementUuid, onboardUuid,
  screenshots: [], api: [], network: [], checks: [], consoleErrors: [], passed: false };
const pending = [];
let browser, page, before;
function backend() {
  const line = execFileSync("ps", ["-eo", "pid,lstart,args"], { encoding: "utf8" })
    .split("\n").find(line => line.includes("tsx/dist/loader.mjs server/index.ts"));
  ensure(line, "Managed backend process required");
  const fields = line.trim().split(/\s+/);
  return { pid: Number(fields[0]), startedAt: new Date(`${fields.slice(1, 6).join(" ")} UTC`).toISOString() };
}
async function actorRecord(id, vesselUuid) {
  const result = await db.query(`SELECT u.id,u.fullname,r.ruid,r.assigned_role,r.roletype
    FROM master_users u JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
    WHERE u.id=$1 AND r.is_active=true AND r.is_deleted=false`, [id]);
  ensure(result.rows.length === 1, "Actor must resolve to one persisted active role");
  const row = result.rows[0];
  return { id, name: row.fullname, roleUuid: row.ruid, role: row.assigned_role, userType: row.roletype, vesselUuid };
}
async function api(actor, path, expected = 200) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token(actor)}` } });
  const text = await response.text();
  report.api.push({ at: new Date().toISOString(), actorId: actor.id, method: "GET", path, status: response.status, expected });
  ensure(response.status === expected, `GET ${path}: expected ${expected}, got ${response.status}`);
  return text ? JSON.parse(text) : null;
}
async function protection() {
  const tables = ["frm_company_submissions", "frm_company_submission_system_snapshots",
    "frm_company_submission_assignments", "frm_section_states", "frm_section_signatures",
    "frm_signature_attachments", "frm_form_parts", "frm_sections", "frm_questions",
    "adm_form_versions_v2", "adm_forms_v2", "crew_assignments", "vessel_planning_v2", "master_users"];
  const result = {};
  for (const table of tables) result[table] = (await db.query(
    `SELECT id,md5(to_jsonb(t)::text) AS hash FROM "${table}" t ORDER BY id`)).rows;
  return result;
}
async function shot(name, target = page) {
  const file = `${folder}/${name}.png`;
  await target.screenshot({ path: file });
  report.screenshots.push(file);
}
async function readOpened(uuid, expected) {
  const response = await page.waitForResponse(r => new URL(r.url()).pathname === `${prefix}/${uuid}/form`, { timeout: 45000 });
  ensure(response.status() === 200, `Opened form ${uuid} did not return 200`);
  const contract = await response.json();
  await save(`form-${uuid}.json`, contract);
  ensure(contract.submission.submissionUuid === uuid && contract.submission.status === expected, "Exact saved submission/status required");
  ensure(contract.submission.formVersionUuid === contract.version.formVersionUuid, "Pinned version required");
  ensure(!contract.submission.canEdit, "Completed/voided closing records must be read-only");
  const viewer = page.getByTestId("crew-company-form-viewer");
  await viewer.getByText(contract.form.formName, { exact: false }).first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="crew-company-form-viewer"]');
    return el && el.textContent.includes("Company Form history") && !el.textContent.includes("Loading saved");
  });
  const text = await viewer.innerText();
  ensure(text.includes(contract.version.stageLabel), "Readable stage must be visible");
  if (contract.systemValuesChangedNotice) ensure(text.includes(contract.systemValuesChangedNotice), "Frozen-source notice must be preserved");
  const signatures = contract.states.flatMap(state => state.signatures.map(signature => ({ sectionUuid: state.sectionUuid, ...signature })));
  for (const signature of signatures) {
    const type = signature.signatureType;
    const block = viewer.getByTestId(`preview-signature-${type}-${signature.sectionUuid}`);
    await block.waitFor({ state: "visible" });
    if (signature.signerName) ensure((await block.innerText()).includes(signature.signerName), "Recorded signer identity must display");
  }
  report.checks.push({ name: "exact-pinned-read-only-form", uuid, expected, version: contract.version.versionNo,
    stage: contract.version.stageLabel, frozenAt: contract.systemSnapshotAt, signatures: signatures.length,
    sourceNotice: contract.systemValuesChangedNotice });
  return contract;
}
async function open(uuid, status, label) {
  const reading = readOpened(uuid, status);
  await page.getByTestId(`crew-company-forms-open-${uuid}`).click();
  const contract = await reading;
  await shot(label);
  return contract;
}
async function close() {
  await page.getByTestId("button-close-crew-company-form").click();
  await page.getByTestId("crew-company-form-viewer").waitFor({ state: "hidden" });
}
try {
  ensure(fixture.crewUuid === crewUuid && fixture.assignmentUuid === assignmentUuid, "Retained acceptance ownership differs");
  ensure(!git("status", "--porcelain"), "Source must be committed before closing");
  const process = backend();
  report.backendPid = process.pid; report.backendStart = process.startedAt;
  ensure(new Date(process.startedAt) > new Date(report.commitTime), "Backend must start strictly after final source commit");
  const office = await actorRecord(99);
  report.actor = office;
  ensure(office.userType === "Office", "Retained Office actor required");
  before = await protection(); await save("protected-before.json", before);
  await api(office, "/api/v2/admin/forms", 403);
  const homePath = `${prefix}/subjects/crew_assignment/home/${crewUuid}/submissions`;
  const home = await api(office, homePath);
  await save("home.json", home);
  const group = home.groups.find(group => group.subjectRef === assignmentUuid);
  ensure(group && [originalUuid, replacementUuid, onboardUuid].every(uuid => group.submissions.some(row => row.submissionUuid === uuid)), "All retained forms must share one assignment group");
  ensure(group.submissions.find(row => row.submissionUuid === originalUuid).replacementHistory.some(link => link.submissionUuid === replacementUuid), "Original must link to exact replacement");
  ensure(group.submissions.find(row => row.submissionUuid === replacementUuid).replacementHistory.some(link => link.submissionUuid === originalUuid), "Replacement must link to exact original");
  const wrong = await actorRecord(fixture.actors.wrongVessel.id, fixture.actors.wrongVessel.vesselUuid);
  const unprovisioned = { id: 2147483646, role: "Master", roleUuid: wrong.roleUuid, userType: "Ship" };
  for (const actor of [wrong, unprovisioned]) {
    await api(actor, homePath, 403);
    await api(actor, `${prefix}/${originalUuid}/form`, 403);
    await api(actor, `${prefix}/${replacementUuid}/form`, 403);
  }
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 },
    extraHTTPHeaders: { Authorization: `Bearer ${token(office)}` } });
  await context.addInitScript(({ actor, auth }) => {
    const state = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.roleUuid, userType: "Office", designation: "Crewing", myVessels: [] };
    localStorage.setItem("userProfile", JSON.stringify(state));
    localStorage.setItem("devPersona", JSON.stringify(state)); localStorage.setItem("devAuthToken", auth);
  }, { actor: office, auth: token(office) });
  page = await context.newPage();
  page.on("pageerror", error => report.consoleErrors.push(String(error)));
  let companyPhase = false;
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith("/api/")) return;
    const entry = { at: new Date().toISOString(), method: response.request().method(), path,
      status: response.status(), companyPhase };
    report.network.push(entry);
    pending.push(response.request().allHeaders().then(headers => {
      const payload = headers.authorization?.split(".")[1];
      if (payload) entry.actorId = JSON.parse(Buffer.from(payload, "base64url").toString()).id;
    }).catch(error => { entry.recordingError = String(error); }));
  });
  report.browserStart = new Date().toISOString();
  await page.goto(`${base}/crew-pool?crew=${crewUuid}&section=G`, { waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: "Part G - Briefing, Debriefing & Other Forms", exact: true });
  await heading.waitFor({ state: "visible", timeout: 60000 }); await heading.scrollIntoViewIfNeeded();
  ensure(await page.getByText("Brief & Debrief", { exact: true }).count(), "Original stepper label required");
  await shot("part-g-placement");
  const homeUi = page.getByTestId("crew-company-forms-home");
  await homeUi.scrollIntoViewIfNeeded();
  const assignment = page.getByTestId(`crew-company-forms-group-${assignmentUuid}`);
  await assignment.locator("summary").focus();
  await page.keyboard.press("Enter");
  ensure(await assignment.evaluate(element => element.open), "Assignment disclosure must expand");
  ensure(await page.getByTestId(`crew-company-forms-group-${assignmentUuid}`).count() === 1, "One assignment row required");
  await shot("g3-expanded");
  companyPhase = true;
  const original = await open(originalUuid, "voided", "before-joining-voided");
  const replacementRead = readOpened(replacementUuid, "completed");
  const originalLink = page.getByTestId("crew-company-form-viewer").getByText("Voided — replaced by", { exact: true }).locator("..").getByRole("button");
  await originalLink.click(); await replacementRead; await shot("before-joining-replacement-via-link");
  const originalRead = readOpened(originalUuid, "voided");
  await page.getByTestId("crew-company-form-viewer").getByText("Replaces a voided submission", { exact: true }).locator("..").getByRole("button").click();
  await originalRead; await shot("before-joining-original-via-link"); await close();
  await open(replacementUuid, "completed", "before-joining-replacement-direct"); await close();
  const aboard = await open(onboardUuid, "completed", "on-board-completed");
  ensure(aboard.version.stageKey === "on_board" && original.version.stageKey === "before_joining", "Stage provenance required");
  for (const state of aboard.states) for (const signature of state.signatures) {
    const block = page.getByTestId(`preview-signature-${signature.signatureType}-${state.sectionUuid}`);
    await block.scrollIntoViewIfNeeded(); await shot(`onboard-signature-${signature.signatureType}`);
  }
  await close();
  await Promise.all(pending);
  const formRequests = report.network.filter(entry => entry.path.startsWith(prefix));
  ensure(formRequests.length && formRequests.every(entry => entry.method === "GET" && entry.status === 200 && entry.actorId === office.id), "Office form journey must be submission-only GET/200");
  ensure(!report.network.some(entry => entry.companyPhase && entry.path.startsWith("/api/v2/admin/forms")), "No Admin form reads during Company Form journey");
  ensure(!report.consoleErrors.length, "Browser page errors fail closing");
  report.browserEnd = new Date().toISOString();
  const after = await protection(); await save("protected-after.json", after);
  report.protectedUnchanged = JSON.stringify(before) === JSON.stringify(after);
  ensure(report.protectedUnchanged, "Protected definitions/operations/submissions/signatures changed");
  ensure(git("rev-parse", "HEAD") === report.head && backend().pid === report.backendPid, "HEAD and backend PID must remain unchanged");
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  if (page) await shot("FAILED").catch(() => {});
  if (before) {
    const after = await protection().catch(() => null);
    await save("protected-after-failed.json", after);
    report.protectedUnchanged = JSON.stringify(before) === JSON.stringify(after);
  }
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await Promise.all(pending);
  await save("report.json", report);
  await browser?.close(); await db.end();
  console.log(JSON.stringify({ report: `${folder}/report.json`, passed: report.passed, head: report.head,
    backendPid: report.backendPid, protectedUnchanged: report.protectedUnchanged, failure: report.failure }, null, 2));
}