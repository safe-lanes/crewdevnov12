import "./verification-guard.mjs";
// Development-only UI acceptance. No SQL writes, actor switching, assignment
// resets, or mutation of the retained on-board declarations.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium } from "@playwright/test";
import { runCompanyFormTests } from "./verify-company-forms-tests.mjs";

const root = ".local/verification";
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const prefix = "/api/v2/company-form-submissions";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const fixture = JSON.parse(await fs.readFile(`${root}/onboard-retained-fixtures.json`, "utf8"));
const ensure = (condition, message) => { if (!condition) throw Error(message); };
async function assertResponse(response, expected, message) {
  if (response.status() !== expected) {
    const body = await response.text().catch(() => "[response body unavailable]");
    throw Error(`${message}: ${response.status()} ${body}`);
  }
}
const save = (path, value) => fs.writeFile(path, JSON.stringify(value, null, 2));
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = actor => `${encode({ alg: "none", typ: "JWT" })}.${encode({
  id: actor.id, role: actor.role, roleId: actor.roleUuid, userType: actor.userType ?? "Ship",
  vessels: actor.userType === "Office" ? [] : [actor.vesselUuid],
})}.devsig`;
const apiEvidence = [];
const pendingNetwork = [];
const startedPages = [];
async function api(actor, method, path, body, expected = 200) {
  const r = await fetch(`${base}${path}`, { method,
    headers: { Authorization: `Bearer ${token(actor)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  apiEvidence.push({ actorId: actor.id, method, path, status: r.status, expected });
  ensure([expected].flat().includes(r.status), `${method} ${path}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
async function actorRecord(actor) {
  const { rows } = await db.query(`SELECT u.id,u.fullname,u.user_uuid,r.ruid,r.assigned_role,r.roletype
    FROM master_users u JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
    WHERE u.id=$1 AND r.is_active=true AND r.is_deleted=false`, [actor.id]);
  ensure(rows.length === 1, "Actor must resolve to exactly one current persisted role");
  return { ...actor, name: rows[0].fullname, userUuid: rows[0].user_uuid,
    roleUuid: rows[0].ruid, role: rows[0].assigned_role, userType: rows[0].roletype };
}
const office = await actorRecord(fixture.office);
const master = await actorRecord(fixture.actors.master);
const author = await actorRecord(fixture.author);
const subject = `${prefix}/subjects/crew_assignment/${fixture.assignmentUuid}`;
const manifestPath = `${root}/onboard-corrections-fixtures.json`;

async function prepare() {
  const previous = await fs.readFile(manifestPath, "utf8").then(JSON.parse).catch(e => {
    if (e.code === "ENOENT") return null; throw e;
  });
  if (previous) await save(`${root}/onboard-corrections-retained-preparation-${previous.preparedAt.replace(/[:.]/g, "-")}.json`, previous);
  if (previous?.definitions.length === 2 && previous.definitions.every(d => d.sectionUuid)) {
    const eligible = await api(office, "GET", `${subject}/eligible-forms?stageKey=on_board`);
    ensure(!eligible.some(e => e.formUuid === fixture.forms[1].formUuid), "Retained Handover stays archived");
    if (previous.definitions.every(d => eligible.some(e => e.formVersionUuid === d.versionUuid))) {
      await save(`${root}/onboard-corrections-preflight-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, { apiEvidence, reusedPreparation: previous.preparedAt });
      console.log("Previously prepared normal releases are eligible; no extra fixtures created.");
      return;
    }
  }
  const assignment = (await db.query("SELECT assignment_type,is_current FROM crew_assignments WHERE assign_uuid=$1", [fixture.assignmentUuid])).rows[0];
  ensure(assignment?.assignment_type === "OnBoard" && assignment.is_current, "Use the retained current test-owned assignment without changing it");
  for (const actor of [office, master]) await api(actor, "GET", `${subject}/submissions`);
  const run = { preparedAt: new Date().toISOString(), assignmentUuid: fixture.assignmentUuid,
    actors: { office, master, author }, definitions: [], retention: "Retain every fixture and all evidence. No cleanup or assignment changes." };
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  // Normal authoring endpoints, not a directly inserted released definition.
  for (const purpose of ["RETIREMENT", "REPLACEMENT"]) {
    const name = `TEST ONLY ONBOARD ${purpose} ${suffix}`;
    const created = await api(author, "POST", "/api/v2/admin/forms", { name, category: "dynamic" }, 201);
    const form = created.form, version = created.version;
    const entry = { purpose, name, formId: form.id, formUuid: form.formUuid,
      versionId: version.id, versionUuid: version.fvUuid };
    run.definitions.push(entry);
    await save(manifestPath, run);
    await api(author, "PUT", `/api/v2/admin/form-versions/${version.id}`, { stageKey: "on_board" });
    const parts = await api(author, "GET", `/api/v2/admin/forms/${form.id}/parts?formVersionUuid=${version.fvUuid}`);
    const part = parts.find(p => p.formVersionUuid === version.fvUuid);
    ensure(part, "Normal creation must supply a version-owned part");
    entry.partUuid = part.formPartUuid;
    const structurePath = `/api/v2/admin/form-versions/${version.fvUuid}/parts/${part.formPartUuid}/structure`;
    const structure = await api(author, "PUT", structurePath, {
      sections: [{ section_code: "S1", section_title: "Test-owned on-board signatures",
        responsible_mode: "seafarer", signature_seafarer_required: true,
        signature_vessel_management_required: true, vessel_signature_role_uuids: [master.roleUuid],
        questions: [
          { question_code: "DATE", question_text: "Date of declaration", response_type: "system_field", system_field_key: "date_of_declaration", is_mandatory: false, comment_enabled: false },
          { question_code: "NAME", question_text: "Seafarer", response_type: "system_field", system_field_key: "seafarer_name", is_mandatory: false, comment_enabled: false },
        ] }],
    });
    entry.sectionUuid = structure.sections[0].section_uuid;
    await api(author, "POST", `/api/v2/admin/form-versions/${version.id}/release`, {});
    await save(manifestPath, run);
    await save(`${root}/onboard-corrections-fixtures-${suffix}.json`, run);
  }
  const eligible = await api(office, "GET", `${subject}/eligible-forms?stageKey=on_board`);
  ensure(run.definitions.every(d => eligible.some(e => e.formVersionUuid === d.versionUuid)), "New normally released test forms must be picker eligible");
  ensure(!eligible.some(e => e.formUuid === fixture.forms[1].formUuid), "Retained Handover remains archived and ineligible");
  await save(`${root}/onboard-corrections-preparation-${suffix}.json`, { ...run, apiEvidence });
  console.log("Prepared two new test-owned forms using normal release validation; existing assignment unchanged.");
}

const protectedTables = ["frm_company_submissions", "frm_company_submission_system_snapshots",
  "frm_section_states", "frm_section_signatures", "frm_signature_attachments",
  "frm_form_parts", "frm_sections", "frm_questions", "adm_form_versions_v2",
  "crew_assignments", "vessel_planning_v2", "master_users"];
async function protectionSnapshot(retirementFormId) {
  const tables = {};
  for (const table of protectedTables) tables[table] = (await db.query(
    `SELECT id,md5(to_jsonb(t)::text) AS hash FROM "${table}" t ORDER BY id`)).rows;
  tables.adm_forms_v2 = (await db.query(
    "SELECT id,md5(to_jsonb(t)::text) AS hash FROM adm_forms_v2 t WHERE id<>$1 ORDER BY id", [retirementFormId])).rows;
  return tables;
}
async function context(browser, actor, report) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true,
    viewport: { width: 1560, height: 1100 }, extraHTTPHeaders: { Authorization: `Bearer ${token(actor)}` } });
  await ctx.addInitScript(({ actor, fixture, auth }) => {
    const vessel = { vessel: fixture.vesselName, vesselId: fixture.vesselUuid, imoNumber: "" };
    const state = { personaKey: actor.userType === "Office" ? "crewing-executive" : "vessel-admin",
      masterUserId: actor.id, role: actor.role, roleId: actor.roleUuid, userType: actor.userType,
      designation: actor.userType === "Office" ? "Crewing" : "Master", vessel };
    localStorage.setItem("userProfile", JSON.stringify({ ...state, userId: String(actor.id), myVessels: [vessel] }));
    localStorage.setItem("devPersona", JSON.stringify(state));
    localStorage.setItem("devAuthToken", auth);
    localStorage.setItem("devLastVesselId", fixture.vesselUuid);
  }, { actor, fixture, auth: token(actor) });
  const page = await ctx.newPage();
  startedPages.push(page);
  page.on("response", r => {
    const path = new URL(r.url()).pathname;
    if (!path.startsWith("/api/")) return;
    const entry = { contextActorId: actor.id, actorId: null, path,
      method: r.request().method(), status: r.status() };
    report.network.push(entry);
    const recording = r.request().allHeaders().then(headers => {
      const payload = headers.authorization?.split(" ")[1]?.split(".")[1];
      if (payload) entry.actorId = JSON.parse(Buffer.from(payload, "base64url").toString()).id;
    }).catch(error => { entry.recordingError = String(error); });
    pendingNetwork.push(recording);
  });
  await page.goto(`${base}/vessel`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#root")?.textContent?.trim());
  if (actor.userType === "Office") {
    const vesselRow = page.getByRole("row").filter({ hasText: fixture.vesselName });
    await vesselRow.first().waitFor();
    await vesselRow.first().getByRole("button").first().click();
  }
  await page.getByRole("button", { name: "Crew List", exact: true }).click();
  await page.getByTestId(`button-crew-forms-${fixture.assignmentUuid}`).waitFor();
  await page.waitForFunction(id => /^\d+$/.test(document.querySelector(`[data-testid="button-crew-forms-${id}"]`)?.textContent?.trim() ?? ""), fixture.assignmentUuid);
  ensure(await page.getByTestId("crew-list-forms-header").count() === 1, "Exactly one Forms column");
  const headers = await page.getByTestId("crew-list-forms-header").evaluate(el => ({
    preceding: el.previousElementSibling?.textContent, text: el.textContent,
  }));
  const handoverVisible = await page.getByRole("columnheader", { name: "Handover", exact: true }).count() > 0;
  if (actor.userType === "Ship" || handoverVisible) ensure(headers.preceding === "Handover", "Forms must immediately follow Handover");
  else report.checks.push("Office Handover column retains its existing permission-based exclusion; Forms remains the final data column");
  return page;
}
async function closing() {
  const run = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const [retirement, replacement] = run.definitions;
  ensure(run.assignmentUuid === fixture.assignmentUuid && retirement && replacement, "Prepared fixture is required");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const commitTime = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
  const line = execFileSync("ps", ["-eo", "pid,lstart,args"], { encoding: "utf8" }).split("\n")
    .find(l => l.includes("tsx/dist/loader.mjs server/index.ts"));
  ensure(line, "Managed backend process required");
  const fields = line.trim().split(/\s+/), pid = Number(fields[0]);
  const backendStart = new Date(`${fields.slice(1, 6).join(" ")} UTC`);
  ensure(backendStart > new Date(commitTime), "Backend must start strictly after final source commit");
  const tests = await runCompanyFormTests();
  ensure(tests.head === head, "Closing test gate must use the closing HEAD");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = { head, commitTime, backendPid: pid, backendStart: backendStart.toISOString(),
    startedAt: new Date().toISOString(), tests, actors: { office, master, author }, checks: [], network: [], screenshots: [], submissions: [] };
  const before = await protectionSnapshot(retirement.formId);
  await save(`${root}/onboard-corrections-protected-${stamp}.json`, before);
  const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox"] });
  let officePage, masterPage;
  const shot = async (page, name) => {
    const path = `screenshots/onboard-corrections/${stamp}-${name}.png`;
    await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
  };
  const count = page => page.getByTestId(`button-crew-forms-${fixture.assignmentUuid}`);
  const popup = async page => { await count(page).click(); await page.getByTestId("onboard-company-forms").waitFor(); };
  const back = async page => {
    // Crew List uses the embedded renderer, which has no separate form-back
    // control. Close and reopen through the count's actual UI entry point.
    await close(page);
    await popup(page);
  };
  const close = async page => {
    await page.getByTestId("onboard-company-forms-dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId("onboard-company-forms-dialog").waitFor({ state: "detached" });
  };
  const start = async (page, definition) => {
    await page.getByTestId("select-onboard-form-version").selectOption(definition.versionUuid);
    const pending = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `${subject}/submissions`);
    await page.getByTestId("button-start-onboard-form").click();
    const r = await pending; await assertResponse(r, 201, "Visible creation failed");
    const saved = await r.json(); report.submissions.push({ uuid: saved.submissionUuid, purpose: definition.purpose });
    await page.getByTestId("configured-form-live").waitFor({ state: "attached" });
    return saved.submissionUuid;
  };
  const voidUi = async (page, uuid, reason, confirmed = false) => {
    await page.locator("#company-form-void-reason").fill(reason);
    const pending = confirmed ? null : page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/${uuid}/void`));
    await page.getByRole("button", { name: "Void submission", exact: true }).click();
    if (pending) await assertResponse(await pending, 204, "Visible Office void failed");
  };
  try {
    officePage = await context(browser, office, report);
    const initialCount = Number(await count(officePage).innerText());
    ensure(await count(officePage).evaluate(el => el.classList.contains("text-blue-600")), "Forms count is a blue keyboard-operable button");
    await count(officePage).focus(); await officePage.keyboard.press("Enter");
    await officePage.getByTestId("onboard-company-forms").waitFor();
    await officePage.getByText("No replacement — form retired", { exact: true }).first().waitFor();
    ensure(await officePage.getByText("No replacement — form retired", { exact: true }).count() >= 1, "Retained Handover displays exact retired message");
    ensure(!(await officePage.locator("#onboard-form-version option").allTextContents()).some(t => t.includes(fixture.forms[1].name)), "Retained Handover excluded from visible picker");
    await shot(officePage, "01-retained-handover-message-and-picker");
    const retiredUuid = await start(officePage, retirement);
    await api(author, "POST", `/api/v2/admin/forms/${retirement.formId}/archive`, {});
    await voidUi(officePage, retiredUuid, "TEST ONLY retirement warning cancellation and confirmation", true);
    const warning = "This form has been retired. Voiding will not allow a replacement on this form.";
    await officePage.getByRole("alertdialog").getByText(warning, { exact: true }).waitFor();
    await shot(officePage, "02-retirement-warning");
    const beforeCancel = await api(office, "GET", `${prefix}/${retiredUuid}/form`);
    await officePage.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
    const afterCancel = await api(office, "GET", `${prefix}/${retiredUuid}/form`);
    ensure(JSON.stringify(beforeCancel) === JSON.stringify(afterCancel), "Cancellation left the entire submission unchanged");
    await shot(officePage, "03-cancelled-unchanged");
    await voidUi(officePage, retiredUuid, "TEST ONLY retirement warning cancellation and confirmation", true);
    await officePage.getByRole("alertdialog").getByText(warning, { exact: true }).waitFor();
    const voided = officePage.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/${retiredUuid}/void`));
    await officePage.getByRole("alertdialog").getByRole("button", { name: "Confirm void", exact: true }).click();
    ensure((await voided).status() === 204, "Authorised retirement confirmation voided through visible UI");
    await officePage.getByText("No replacement — form retired", { exact: true }).waitFor();
    await shot(officePage, "04-retired-no-replacement");
    await back(officePage);
    await officePage.getByRole("button", { name: "Refresh forms", exact: true }).click();
    await officePage.waitForFunction(name => {
      const select = document.querySelector("#onboard-form-version");
      return select && !Array.from(select.querySelectorAll("option")).some(o => o.textContent.includes(name));
    }, retirement.name);
    ensure(!(await officePage.locator("#onboard-form-version option").allTextContents()).some(t => t.includes(retirement.name)), "Newly archived form stays excluded");
    await close(officePage);
    await officePage.waitForFunction(({ id, n }) => document.querySelector(`[data-testid="button-crew-forms-${id}"]`)?.textContent?.trim() === String(n), { id: fixture.assignmentUuid, n: initialCount });
    report.checks.push("Exact retired warning, cancellation unchanged, authorised confirmation, exact no-replacement message and continued picker exclusion");
    await popup(officePage);
    const originalUuid = await start(officePage, replacement);
    await back(officePage); await close(officePage);
    await officePage.waitForFunction(({ id, n }) => document.querySelector(`[data-testid="button-crew-forms-${id}"]`)?.textContent?.trim() === String(n), { id: fixture.assignmentUuid, n: initialCount + 1 });
    await shot(officePage, "05-before-void-count");
    await popup(officePage);
    await officePage.getByTestId("select-onboard-form-version").selectOption(replacement.versionUuid);
    await officePage.getByTestId("button-start-onboard-form").click();
    await officePage.locator("#company-form-void-reason").waitFor();
    await voidUi(officePage, originalUuid, "TEST ONLY eligible replacement closing journey");
    await back(officePage); await close(officePage);
    await officePage.waitForFunction(({ id, n }) => document.querySelector(`[data-testid="button-crew-forms-${id}"]`)?.textContent?.trim() === String(n), { id: fixture.assignmentUuid, n: initialCount });
    await shot(officePage, "06-after-void-count-decrement");
    await popup(officePage);
    const newUuid = await start(officePage, replacement);
    await shot(officePage, "07-replacement-side-actual-form-date-voider");
    const replacementData = await api(office, "GET", `${prefix}/${newUuid}/form`);
    const originalData = await api(office, "GET", `${prefix}/${originalUuid}/form`);
    const link = replacementData.replacementHistory.find(l => l.direction === "replaces");
    ensure(link.submissionUuid === originalUuid && link.targetLabel.includes(replacement.name) &&
      link.targetLabel.includes(`Voided by ${office.name}`) && link.targetLabel.includes("Created (declaration date unavailable)") &&
      /\d{2}-[A-Z][a-z]{2}-\d{4}/.test(link.targetLabel), "Replacement link uses original creation fallback and saved voider");
    const exactOriginal = officePage.waitForResponse(r => r.url().endsWith(`/${originalUuid}/form`));
    await officePage.getByRole("button", { name: link.targetLabel, exact: true }).click();
    ensure((await exactOriginal).status() === 200, "Replacement link opens exact pinned original");
    await officePage.getByText("Voided submission", { exact: true }).waitFor();
    const forward = originalData.replacementHistory.find(l => l.direction === "replaced_by");
    ensure(forward.submissionUuid === newUuid && forward.targetLabel.includes(replacement.name) && forward.targetLabel.includes(`Voided by ${office.name}`), "Original-side label uses actual form and same original audit");
    await shot(officePage, "08-original-side-reciprocal-link");
    const exactReplacement = officePage.waitForResponse(r => r.url().endsWith(`/${newUuid}/form`));
    await officePage.getByRole("button", { name: forward.targetLabel, exact: true }).click();
    ensure((await exactReplacement).status() === 200, "Original link opens exact pinned replacement");
    await back(officePage); await close(officePage);
    await officePage.waitForFunction(({ id, n }) => document.querySelector(`[data-testid="button-crew-forms-${id}"]`)?.textContent?.trim() === String(n), { id: fixture.assignmentUuid, n: initialCount + 1 });
    await shot(officePage, "09-after-replacement-count-increment");
    report.checks.push("Visible Office void/start replacement; column decremented then incremented; both corrected reciprocal links clicked to exact pinned targets");
    // Separate persisted Master context, never change the Office page's actor.
    masterPage = await context(browser, master, report);
    await popup(masterPage);
    await masterPage.getByTestId("select-onboard-form-version").selectOption(replacement.versionUuid);
    await masterPage.getByTestId("button-start-onboard-form").click();
    await masterPage.getByTestId("configured-form-live").waitFor({ state: "attached" });
    ensure(await masterPage.locator("#company-form-void-reason").count() === 0, "Master cannot void");
    for (const type of ["seafarer", "vessel_management"]) {
      const section = replacement.sectionUuid;
      const toggle = masterPage.getByTestId(`button-preview-section-toggle-${section}`);
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
      const block = masterPage.getByTestId(`preview-signature-${type}-${section}`);
      if (type === "seafarer") await block.getByRole("checkbox").check();
      const pad = masterPage.getByTestId(`live-signature-${type}-${section}`), canvas = pad.locator("canvas");
      await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(); ensure(b, "Visible signature canvas");
      await masterPage.mouse.move(b.x + 25, b.y + 25); await masterPage.mouse.down();
      for (const [x, y] of [[60, 60], [100, 20], [140, 65], [185, 35], [230, 70]]) await masterPage.mouse.move(b.x + x, b.y + y, { steps: 5 });
      await masterPage.mouse.up();
      const pending = masterPage.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/sections/${section}/signatures`));
      await pad.getByRole("button", { name: "Save signature", exact: true }).click();
      ensure((await pending).status() === 201, `Visible ${type} signature accepted`);
      await block.locator("canvas").waitFor({ state: "detached" });
      await shot(masterPage, `10-${type}-saved-signature`);
    }
    const pending = masterPage.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/sections/${replacement.sectionUuid}/submit`));
    await masterPage.getByTestId(`preview-section-footer-${replacement.sectionUuid}`).getByRole("button", { name: /^Submit( section)?$/i }).click();
    await masterPage.getByTestId(`briefing-section-dialog-${replacement.sectionUuid}`).getByRole("button", { name: "Submit", exact: true }).click();
    ensure((await pending).status() === 200, "Normal section submission succeeded");
    const completed = await api(master, "GET", `${prefix}/${newUuid}/form`);
    ensure(completed.submission.status === "completed" && completed.version.formVersionUuid === replacement.versionUuid, "Automatic completion on pinned version");
    ensure(completed.states[0].signatures.every(s => s.signatureType === "seafarer"
      ? s.witnessName === master.name : s.signerName === master.name), "Actual saved Master/witness identity");
    ensure(!await masterPage.getByRole("button", { name: /^Complete$/i }).count(), "No separate completion action");
    await back(masterPage);
    const completedCard = masterPage.getByText(`${replacement.name} · completed`, { exact: true }).locator("..");
    await completedCard.waitFor();
    await shot(masterPage, "11-visible-automatic-completion-in-history");
    await completedCard.getByRole("button", { name: "Read declaration", exact: true }).click();
    await masterPage.getByTestId("configured-form-live").waitFor({ state: "attached" });
    await shot(masterPage, "11-automatic-completion-and-saved-identities");
    // Reopen through reciprocal links after freezing to demonstrate historical rendering.
    const backLink = completed.replacementHistory.find(l => l.direction === "replaces");
    await masterPage.getByRole("button", { name: backLink.targetLabel, exact: true }).click();
    await masterPage.getByText("Voided submission", { exact: true }).waitFor();
    const originalAfter = await api(master, "GET", `${prefix}/${originalUuid}/form`);
    const frozenLink = originalAfter.replacementHistory.find(l => l.direction === "replaced_by");
    ensure(frozenLink.targetLabel.includes("Declaration ") && frozenLink.targetLabel.includes(`Voided by ${office.name}`), "Frozen related declaration date with original Office voider");
    await masterPage.getByRole("button", { name: frozenLink.targetLabel, exact: true }).click();
    await masterPage.getByTestId("configured-form-live").waitFor({ state: "attached" });
    await shot(masterPage, "12-exact-frozen-completed-replacement-reopened");
    await back(masterPage);
    ensure((await masterPage.getByText(/Saved declarations and retained history \(total including voided:/).innerText()).includes("total including voided"), "History total explicitly includes voided");
    await shot(masterPage, "13-retained-history");
    report.checks.push("Separate permitted Master context witnessed present Seafarer, signed Vessel Management, submitted required section and observed automatic completion; exact frozen replacement reopened through reciprocal links");
    const after = await protectionSnapshot(retirement.formId);
    for (const [table, rows] of Object.entries(before)) for (const row of rows) {
      ensure(after[table].find(r => r.id === row.id)?.hash === row.hash, `Protected ${table}/${row.id} changed`);
    }
    ensure(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === head, "HEAD stable throughout");
    ensure(new Date(execFileSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" }).trim() + " UTC").getTime() === backendStart.getTime(), "Backend PID/start stable throughout");
    await Promise.all(pendingNetwork);
    ensure(report.network.filter(n => n.path.startsWith(prefix)).every(n => n.actorId === n.contextActorId), "No submission browser context silently changed actor");
    ensure(report.network.every(n => n.actorId === null || n.actorId === n.contextActorId), "No observed API silently changed actor");
    report.protectedRecords = Object.fromEntries(Object.entries(before).map(([table, rows]) => [table, rows.length]));
    report.counts = { initial: initialCount, afterOriginalCreation: initialCount + 1, afterVoid: initialCount, afterReplacement: initialCount + 1 };
    report.links = { originalUuid, replacementUuid: newUuid, original: originalAfter.replacementHistory, replacement: completed.replacementHistory };
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = String(error);
    for (const [name, page] of [["office", officePage ?? startedPages[0]], ["master", masterPage ?? startedPages[1]]]) if (page) {
      await shot(page, `failure-${name}`);
      await fs.writeFile(`${root}/onboard-corrections-${stamp}-${name}-failure.txt`, await page.locator("body").innerText());
    }
    throw error;
  } finally {
    await Promise.all(pendingNetwork);
    report.finishedAt = new Date().toISOString(); report.apiEvidence = apiEvidence;
    await save(`${root}/onboard-corrections-closing-${stamp}.json`, report);
    await save(`${root}/onboard-corrections-closing.json`, report);
    await browser.close();
  }
  console.log("Uninterrupted closing browser passed:", JSON.stringify({ head, pid, checks: report.checks, counts: report.counts, screenshots: report.screenshots }));
}
try {
  if (process.argv[2] === "prepare") await prepare();
  else if (process.argv[2] === "closing") await closing();
  else throw Error("Use prepare (normal authoring only) or closing (normal UI writes only).");
} catch (error) {
  await save(`${root}/onboard-corrections-driver-failure-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    { mode: process.argv[2], error: String(error), apiEvidence });
  throw error;
} finally { await db.end(); }