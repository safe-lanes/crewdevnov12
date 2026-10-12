import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { actor, token, db, api, base, directory, ensure, payload, prepare, registerOwned } from "./company-form-rule-editor-fixture.mjs";
const initial = process.argv.includes("--initial");
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const head = () => shell("git", ["rev-parse", "HEAD"]);
const pid = () => {
  const rows = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(r =>
    r.includes("server/index.ts") && !/watch|npm| -c /.test(r));
  ensure(rows.length === 1, "Exactly one main backend required");
  return Number(rows[0].trim().split(/\s+/)[0]);
};
const report = { head: head(), pid: pid(), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]) };
report.backendStart = new Date(shell("ps", ["-p", String(report.pid), "-o", "lstart="])).toISOString();
if (!initial) ensure(new Date(report.backendStart) > new Date(report.commitTime), "Backend must start later than final commit");
let browser;
try {
  const fixture = initial ? await prepare({ resetManual: true }) : JSON.parse(await fs.readFile(`${directory}/fixture.json`, "utf8"));
  report.fixture = fixture;
  browser = await chromium.launch({ executablePath: shell("which", ["chromium"]),
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
  await page.getByRole("button", { name: `Configure ${fixture.form.name}`, exact: true }).click();
  const panel = page.getByTestId("company-form-applicability-editor");
  await panel.getByText("Policy saved", { exact: false }).waitFor({ timeout: 30000 });
  if (initial) await panel.getByLabel("Applies when conditions match", { exact: true }).check();
  // Existing registered two-card identities are edited in closing; initial builds from scratch.
  const actualCards = () => panel.locator('[data-testid="company-form-condition-card"]');
  const setCondition = async (card, index, key, selected) => {
    await card.getByLabel("Crew detail", { exact: true }).nth(index).selectOption(key);
    // Locate the condition by its crew-detail select, rather than matching another card.
    const condition = card.getByLabel("Crew detail", { exact: true }).nth(index).locator("xpath=ancestor::div[contains(@class,'rounded-md')][1]");
    await condition.getByPlaceholder("Search choices").fill("");
    while (await condition.locator('input[type="checkbox"]:checked').count())
      await condition.locator('input[type="checkbox"]:checked').first().uncheck();
    await condition.getByPlaceholder("Search choices").fill(selected.label);
    await condition.getByRole("checkbox", { name: selected.label, exact: true }).check();
  };
  if (initial) {
    // The mode adds the first card. Add a second condition and an OR card through the UI.
    await panel.getByRole("button", { name: "Add condition", exact: true }).first().click();
    await panel.getByRole("button", { name: /Add.*(?:group|card)/i }).click();
  }
  // Card order after load/save may differ: identify the AND card by its two conditions.
  const all = actualCards();
  ensure(await all.count() === 2, "Two condition cards must render");
  let andCard, orCard;
  for (let n=0;n<2;n++) {
    const card = all.nth(n);
    if (await card.getByLabel("Crew detail", { exact: true }).count() === 2) andCard=card; else orCard=card;
  }
  ensure(andCard && orCard, "AND and OR cards required");
  await setCondition(andCard, 0, "nationality", fixture.natA);
  await setCondition(andCard, 1, "rank", fixture.rankA);
  await setCondition(orCard, 0, "rank", fixture.rankC);
  await page.getByTestId("button-save-applicability").click();
  await panel.getByText("Policy saved", { exact: false }).waitFor();
  report.summary = await panel.getByTestId("applicability-summary").innerText();
  ensure(/Mandatory.*from release/i.test(report.summary), "Summary must state obligation and timing");
  ensure(report.summary.includes(fixture.natA.label) && report.summary.includes(fixture.rankA.label) &&
    report.summary.includes(fixture.rankC.label) && / or /i.test(report.summary), "Summary must explain all branches");
  await panel.screenshot({ path: `${directory}/${initial ? "initial" : "closing"}-rule.jpg`, type: "jpeg", quality: 75 });
  const saved = await api("GET", `/form-versions/${fixture.version.id}/applicability`);
  const identities = saved.sets.flatMap(s => [s.setUuid, ...s.conditions.map(c => c.conditionUuid)]).sort();
  if (!initial) ensure(JSON.stringify(identities) === JSON.stringify(fixture.identities), "Closing keeps registered identities");
  const trial = page.getByTestId("company-form-rule-trial");
  report.outcomes = [];
  for (const [index, expected] of ["applies", "does_not_apply"].entries()) {
    await trial.getByPlaceholder("Type at least two letters").fill(fixture.subjects[index].first_name);
    const option = trial.getByRole("button").filter({ hasText: fixture.subjects[index].first_name });
    await option.click();
    const before = (await db.query(`SELECT
      (SELECT count(*) FROM frm_resolution_runs) runs,
      (SELECT count(*) FROM frm_requirements) requirements,
      (SELECT count(*) FROM frm_company_submissions) forms,
      (SELECT count(*) FROM frm_requirement_history) history`)).rows[0];
    const response = page.waitForResponse(r => r.url().endsWith("/applicability/preview") && r.request().method() === "POST");
    await page.getByTestId("button-run-company-form-trial").click();
    const result = await (await response).json();
    ensure(result.outcome === expected, `Seafarer ${index+1}: expected ${expected}, got ${JSON.stringify(result)}`);
    await page.getByTestId("company-form-rule-trial-result").waitFor();
    const after = (await db.query(`SELECT
      (SELECT count(*) FROM frm_resolution_runs) runs,
      (SELECT count(*) FROM frm_requirements) requirements,
      (SELECT count(*) FROM frm_company_submissions) forms,
      (SELECT count(*) FROM frm_requirement_history) history`)).rows[0];
    ensure(JSON.stringify(before) === JSON.stringify(after), "Trial creates no operational records");
    report.outcomes.push({ subject: fixture.subjects[index].assign_uuid, ...result, before, after });
    await trial.screenshot({ path: `${directory}/${initial ? "initial" : "closing"}-trial-${index+1}.jpg`, type: "jpeg", quality: 75 });
  }
  report.unresolved = await api("POST", `/form-versions/${fixture.version.id}/applicability/preview`, {
    subjectRef: fixture.subjects[0].assign_uuid, policy: { mode: "conditional", obligation: "optional", sets: [
      { conditions: [{ dimensionKey: "first_ever", operator: "is", value: true }] },
    ] },
  });
  ensure(report.unresolved.outcome === "unresolved", "Missing on-board capture is not false");
  await page.getByTestId("button-release-version").click();
  await page.getByTestId("button-confirm-release").click();
  await page.getByTestId("released-read-only-message").waitFor({ timeout: 30000 });
  ensure(await panel.getByLabel("Applies when conditions match", { exact: true }).isDisabled(), "Released mode read-only");
  ensure(await panel.getByLabel("Crew detail", { exact: true }).first().isDisabled(), "Released conditions read-only");
  ensure(await page.getByTestId("company-form-rule-trial").count() === 0, "Released version has no editable trial");
  report.sql = (await db.query(`SELECT v.status,p.mode,p.obligation,p.effective_kind,p.effective_from,
    (SELECT count(*) FROM frm_applicability_sets s WHERE s.version_uuid=v.fv_uuid) sets
    FROM adm_form_versions_v2 v JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid WHERE v.id=$1`,
    [fixture.version.id])).rows[0];
  ensure(report.sql.status === "released" && report.sql.sets === "2", "SQL confirms released two-set policy");
  await panel.screenshot({ path: `${directory}/${initial ? "initial" : "closing"}-released.jpg`, type: "jpeg", quality: 75 });
  report.errors = errors;
  ensure(!errors.length, `Browser errors: ${errors.join("; ")}`);
  ensure(head() === report.head && pid() === report.pid, "Main HEAD/PID must stay unchanged");
  report.finishedAt = new Date().toISOString(); report.passed = true;
  await fs.writeFile(`${directory}/${initial ? "initial" : "closing"}.json`, JSON.stringify(report, null, 2));
  if (initial) { await registerOwned(); await prepare({ copy: true }); }
  console.log(JSON.stringify({ passed: true, head: report.head, pid: report.pid, commitTime: report.commitTime,
    backendStart: report.backendStart, summary: report.summary, outcomes: report.outcomes.map(r => r.outcome), sql: report.sql }, null, 2));
} catch (error) {
  report.error = String(error);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(`${directory}/${initial ? "initial" : "closing"}-failure.json`, JSON.stringify(report, null, 2));
  if (initial) await registerOwned();
  throw error;
} finally { await browser?.close(); await db.end(); }
