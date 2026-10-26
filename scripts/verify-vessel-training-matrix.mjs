import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

// Deliberate main-preview acceptance only. Automated suites use TEST_DATABASE_URL.
const dir = "generated-artifacts/training-slice7";
await fs.mkdir(dir, { recursive: true });
const fixture = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const onboard = "a4120000-0000-4000-8000-000000000005";
const closing = process.argv.includes("--closing");
const cmd = (name, args) => execFileSync(name, args, { encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();
const pid = cmd("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]);
const report = { head: cmd("git", ["rev-parse", "HEAD"]), commitTime: cmd("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendStart: new Date(`${cmd("ps", ["-p", pid, "-o", "lstart="])} UTC`).toISOString(), pid, closing,
  checks: [], screenshots: [], requests: [], fixtures: { ...fixture, onboardAssignmentUuid: onboard } };
if (closing) assert.ok(Date.parse(report.backendStart) > Date.parse(report.commitTime), "Restart after final commit");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const [subject] = (await db.query(`SELECT c.first_name,v.vessel,a.crew_uuid,a.vessel_uuid,a.assignment_type,
  x.contract_rank_uuid,x.contract_rank_label FROM crew_assignments a
  JOIN crew_members_v2 c USING(crew_uuid) JOIN master_vessels v USING(vessel_uuid)
  JOIN crew_assignment_rule_context x ON x.assign_uuid=$2
  WHERE a.assign_uuid=$1 AND NOT a.is_deleted`, [onboard, fixture.assignmentUuid])).rows;
assert.ok(subject.first_name.startsWith("TEST ONLY") && subject.vessel.startsWith("TEST ONLY"));
assert.equal(subject.crew_uuid, fixture.crewUuid); assert.equal(subject.vessel_uuid, fixture.vesselUuid);
assert.equal(subject.assignment_type, "OnBoard"); assert.ok(subject.contract_rank_uuid);
const certificateIds = [...fixture.certificateUuids, "9471834c-cff2-4529-b308-a43589c431af"];
const baseline = {
  certificates: (await db.query("SELECT train_uuid,issued,expiry FROM crew_training_courses WHERE crew_uuid=$1 AND train_uuid=ANY($2::text[])",
    [fixture.crewUuid, certificateIds])).rows,
  plan: (await db.query("SELECT crew_uuid,crew_assign_uuid,sign_off_date,reliever_sign_on_date,reliever_contract_end_range_end_months,reliever_contract_period_months FROM vessel_planning_v2 WHERE plan_uuid=$1",
    [fixture.planUuid])).rows[0],
};
assert.equal(baseline.certificates.length, 4);
const backup = `${dir}/fixture-baseline.json`;
try { await fs.access(backup); } catch { await fs.writeFile(backup, JSON.stringify(baseline, null, 2)); }
const original = JSON.parse(await fs.readFile(backup, "utf8"));
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: cmd("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1700, height: 1280 }, hasTouch: true });
await context.addInitScript(token => {
  const persona = { personaKey: "crewing-executive", masterUserId: 24, userId: "24", role: "Admin",
    roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6", userType: "Office", myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(persona));
  localStorage.setItem("devPersona", JSON.stringify(persona)); localStorage.setItem("devAuthToken", token);
}, token);
const page = await context.newPage(), base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const matrixPath = `/api/v2/vessel/${fixture.vesselUuid}/training-compliance`;
const relieverPath = `/api/v2/vessel/planning/${fixture.planUuid}/reliever-assignment/${fixture.assignmentUuid}/training-compliance`;
let phase = "matrix";
report.screenWrites = [];
// Preserve real responses; only retry proxied source-module transport.
await page.route("**/src/**", async route => {
  try { await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) }); }
  catch { await route.continue(); }
});
await page.route("**/api/**", route => {
  const request = route.request();
  if (!["GET", "HEAD"].includes(request.method())) {
    const path = new URL(request.url()).pathname;
    // The existing reliever screen reconciles suggestions; the matrix never
    // does. Preserve that real behavior when showing the other screen.
    if (phase !== "reliever" || request.method() !== "POST"
      || path !== relieverPath.replace(/training-compliance$/, "training-suggestions")) return route.abort();
    report.screenWrites.push({ phase, path });
  }
  return route.continue();
});
page.on("response", response => {
  if (new URL(response.url()).pathname === matrixPath) report.requests.push({ status: response.status(), url: matrixPath });
});
async function get(path) {
  const r = await context.request.get(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function matrixScreen() {
  await page.goto(`${base}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Training Matrix", exact: true }).click();
  await expect(page.getByTestId("onboard-training-details-1").or(page.getByTestId("onboard-training-details-0")).first()).toBeVisible();
  const response = await get(matrixPath);
  const index = response.crew.findIndex(crew => crew.assignmentUuid === onboard);
  assert.ok(index >= 0);
  const rowFor = courseUuid => page.getByRole("row").filter({ hasText: response.rows.find(row => row.courseUuid === courseUuid).name });
  const cell = courseUuid => rowFor(courseUuid).locator("td").nth(index + 2);
  return { response, index, cell };
}
async function shot(name) {
  const path = `${dir}/${name}.png`; await page.screenshot({ path, animations: "disabled" });
  report.screenshots.push(path);
}
const plusDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const aff = "1fbde38c-a34f-4b87-beae-f05d362decba", chemical = "0d4ed165-03b7-4db8-a339-fa02df0bb561";
try {
  // Explicit synthetic fixture fact, NOT a production/backfill inference. The
  // UUID is the registered fixture's declared contract rank, never a name match.
  await db.query(`INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source)
    VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(assign_uuid) DO UPDATE SET
    contract_rank_uuid=excluded.contract_rank_uuid,contract_rank_label=excluded.contract_rank_label,
    rank_source=excluded.rank_source`,
  [onboard, subject.contract_rank_uuid, subject.contract_rank_label, JSON.stringify({
    method: "registered_fixture_declared_contract_rank", fixtureOnly: true,
    declaredRankUuid: subject.contract_rank_uuid, purpose: "slice7_onboard_relief_parity",
  })]);
  await db.query("UPDATE vessel_planning_v2 SET crew_uuid=$1,crew_assign_uuid=$2 WHERE plan_uuid=$3",
    [fixture.crewUuid, onboard, fixture.planUuid]);
  const today = (await get(matrixPath)).referenceDate;
  await db.query(`UPDATE vessel_planning_v2 SET reliever_sign_on_date=$1,
    reliever_contract_end_range_end_months=6,reliever_contract_period_months=NULL WHERE plan_uuid=$2`, [today, fixture.planUuid]);
  const relief = (await get(relieverPath)).contractEnd;
  assert.ok(relief);
  await db.query("UPDATE vessel_planning_v2 SET sign_off_date=$1 WHERE plan_uuid=$2", [relief, fixture.planUuid]);
  await db.query(`UPDATE crew_training_courses SET issued=$1,expiry=$2 WHERE crew_uuid=$3 AND train_uuid=ANY($4::text[])`,
    [plusDays(today, -365), plusDays(today, 30), fixture.crewUuid, certificateIds.filter(id => id !== fixture.certificateUuids[2])]);
  await db.query("UPDATE crew_training_courses SET issued=$1 WHERE train_uuid=$2 AND crew_uuid=$3",
    [plusDays(today, 365), fixture.certificateUuids[2], fixture.crewUuid]);
  let screen = await matrixScreen();
  const own = screen.response.crew[screen.index], reliever = await get(relieverPath);
  const normalize = courses => courses.map(({ courseUuid, state, chosenCertificate, isEquivalent, validAtJoining, validThroughContract, complete, calculationVersion }) =>
    ({ courseUuid, state, chosenCertificate, isEquivalent, validAtJoining, validThroughContract, complete, calculationVersion }));
  assert.deepEqual(normalize(own.courses), normalize(reliever.courses));
  assert.equal(own.contractRankUuid, reliever.contractRankUuid);
  assert.equal(own.joiningDate, reliever.joiningDate); assert.equal(own.contractEnd, reliever.contractEnd);
  assert.equal(own.matrixRevisionUuid, reliever.matrixRevisionUuid);
  assert.equal(own.calculationVersion, reliever.calculationVersion);
  report.parity = { onboardAssignmentUuid: onboard, relieverAssignmentUuid: fixture.assignmentUuid,
    rankUuid: own.contractRankUuid, today, plannedRelief: own.contractEnd, matrixRevisionUuid: own.matrixRevisionUuid,
    calculationVersion: own.calculationVersion, identicalCourses: normalize(own.courses) };
  report.checks.push("Same captured rank, reference/end dates, matrix, certificates and equivalents produce identical engine states and chosen certificates on both screens.");
  const missing = screen.cell(chemical).getByTestId("vessel-training-dot");
  await expect(missing).toHaveAttribute("data-color", "red"); await expect(missing).toHaveAttribute("data-outline", "true");
  assert.equal(await screen.cell(chemical).textContent(), "");
  const amber = screen.cell(aff).getByTestId("vessel-training-dot");
  await expect(amber).toHaveAttribute("data-color", "amber");
  await amber.hover();
  await expect(page.getByRole("tooltip")).toContainText("Expires before planned relief");
  await shot("01-missing-red-outline-and-before-relief-hover");
  await amber.tap();
  await expect(page.getByRole("status")).toHaveText("Expires before planned relief; Expires within 2 months");
  await shot("02-touch-meaning-lists-both-reasons");
  await page.keyboard.press("Escape");
  await page.getByTestId(`onboard-training-details-${screen.index}`).click();
  const detail = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Training Matrix Compliance", exact: true }) });
  await expect(detail).toBeVisible(); await expect(detail.getByText("Today", { exact: true })).toBeVisible();
  await expect(detail.getByText("Planned relief date", { exact: true })).toBeVisible();
  await expect(detail.getByText(subject.contract_rank_label, { exact: true })).toBeVisible();
  await shot("03-shared-details-from-onboard-crew");
  report.checks.push("Through the matrix: red-outline Not held, amber before-relief, hover and tap showing both reasons, and crew click opens shared details with Today and Planned relief.");
  phase = "reliever";
  await page.goto(`${base}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  const suggestionsLoaded = page.waitForResponse(r => new URL(r.url()).pathname ===
    relieverPath.replace(/training-compliance$/, "training-suggestions") && r.request().method() === "POST");
  await page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${fixture.planUuid}"]`).click();
  assert.equal((await suggestionsLoaded).status(), 200);
  await page.getByTestId("training-compliance-see-details").click();
  const relieverDetail = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Training Matrix Compliance", exact: true }) });
  await expect(relieverDetail).toBeVisible();
  await expect(relieverDetail.getByText("Planned joining", { exact: true })).toBeVisible();
  await expect(relieverDetail.getByText("Expires during contract", { exact: true })).toBeVisible();
  await expect(relieverDetail.getByText("Not held", { exact: true })).toBeVisible();
  await shot("04-reliever-screen-same-engine-results");
  phase = "matrix";
  await db.query("UPDATE vessel_planning_v2 SET sign_off_date=NULL WHERE plan_uuid=$1", [fixture.planUuid]);
  screen = await matrixScreen();
  await expect(screen.cell(aff).getByTestId("vessel-training-dot")).toHaveAttribute("aria-label", "Expires within 2 months");
  await screen.cell(aff).getByTestId("vessel-training-dot").tap();
  await shot("05-no-planned-relief-two-month-fallback");
  report.checks.push("No planned relief: the same finite certificate shows the two-calendar-month fallback warning.");
  // With all held alternatives lacking expiry, do not silently choose an
  // unrelated future-issued equivalent or turn absence into no-expiry green.
  await db.query(`UPDATE crew_training_courses SET expiry=NULL WHERE crew_uuid=$1 AND train_uuid=ANY($2::text[])`,
    [fixture.crewUuid, certificateIds.filter(id => id !== fixture.certificateUuids[2])]);
  screen = await matrixScreen();
  await expect(screen.cell(aff).getByTestId("vessel-training-dot")).toHaveAttribute("data-color", "amber");
  await expect(screen.cell(aff).getByTestId("vessel-training-dot")).toHaveAttribute("data-outline", "true");
  await screen.cell(aff).getByTestId("vessel-training-dot").tap();
  await expect(page.getByRole("status")).toHaveText("Expiry not recorded");
  await shot("06-expiry-not-recorded-amber-outline");
  report.checks.push("Expiry not recorded is an unfilled amber outline, not green.");
  report.finishedAt = new Date().toISOString();
} catch (error) {
  report.error = error.message;
  await page.screenshot({ path: `${dir}/failure.png`, animations: "disabled" }).catch(() => {});
  throw error;
} finally {
  // Never delete acceptance fixtures. Restore temporary dates; retain and
  // register the declared on-board rank fact used by this verification.
  for (const cert of original.certificates)
    await db.query("UPDATE crew_training_courses SET issued=$1,expiry=$2 WHERE train_uuid=$3 AND crew_uuid=$4",
      [cert.issued, cert.expiry, cert.train_uuid, fixture.crewUuid]);
  const p = original.plan;
  await db.query(`UPDATE vessel_planning_v2 SET crew_uuid=$1,crew_assign_uuid=$2,sign_off_date=$3,
    reliever_sign_on_date=$4,reliever_contract_end_range_end_months=$5,reliever_contract_period_months=$6
    WHERE plan_uuid=$7`, [p.crew_uuid,p.crew_assign_uuid,p.sign_off_date,p.reliever_sign_on_date,
    p.reliever_contract_end_range_end_months,p.reliever_contract_period_months,fixture.planUuid]);
  report.restoredTemporaryDatesAndLinks = true;
  const reconciled = await context.request.post(`${base}${relieverPath.replace(/training-compliance$/, "training-suggestions")}`,
    { data: {}, headers: { Authorization: `Bearer ${token}` } });
  assert.equal(reconciled.status(), 200, "Reconcile the restored registered reliever facts");
  assert.equal(cmd("git", ["rev-parse", "HEAD"]), report.head); assert.equal(cmd("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]), pid);
  await fs.writeFile(`${dir}/${closing ? "browser-closing" : "browser-preflight"}.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.end();
}
console.log(JSON.stringify({ head: report.head, backendStart: report.backendStart, checks: report.checks, screenshots: report.screenshots }));
