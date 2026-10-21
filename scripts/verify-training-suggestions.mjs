import "./verification-guard.mjs";
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import pg from "pg";
import assert from "node:assert/strict";

const root = "generated-artifacts/training-slice6";
await fs.mkdir(root, { recursive: true });
const fixture = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const closing = process.argv.includes("--closing");
const cmd = (name, args) => execFileSync(name, args, { encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();
const pid = cmd("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]);
const report = { head: cmd("git", ["rev-parse", "HEAD"]), commitTime: cmd("git", ["show", "-s", "--format=%cI", "HEAD"]),
  pid, backendStart: new Date(`${cmd("ps", ["-p", pid, "-o", "lstart="])} UTC`).toISOString(),
  closing, checks: [], screenshots: [], writes: [] };
if (closing) assert.ok(Date.parse(report.backendStart) > Date.parse(report.commitTime));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const subject = (await db.query(`SELECT c.emp_no,c.first_name,c.recruitment_date,v.vessel FROM crew_assignments a
  JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid
  WHERE a.assign_uuid=$1 AND a.crew_uuid=$2 AND a.vessel_uuid=$3`,
  [fixture.assignmentUuid, fixture.crewUuid, fixture.vesselUuid])).rows[0];
assert.ok(subject.first_name.startsWith("TEST ONLY") && subject.vessel.startsWith("TEST ONLY"));
const original = (await db.query("SELECT train_uuid,issued,expiry FROM crew_training_courses WHERE train_uuid=ANY($1::text[])",
  [fixture.certificateUuids])).rows;
const backupPath = `${root}/original-certificates.json`;
try { await fs.access(backupPath); } catch { await fs.writeFile(backupPath, JSON.stringify(original, null, 2)); }
const required = "1fbde38c-a34f-4b87-beae-f05d362decba", chemical = "0d4ed165-03b7-4db8-a339-fa02df0bb561";
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = id => `${enc({ alg: "none", typ: "JWT" })}.${enc({ id, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: cmd("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1700, height: 1280 } });
await context.addInitScript(token => {
  const profile = { personaKey: "crewing-executive", masterUserId: 24, userId: "24", role: "Admin",
    roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6", userType: "Office", myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(profile)); localStorage.setItem("devPersona", JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, token(24));
const page = await context.newPage(), base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const prefix = `/api/v2/vessel/planning/${fixture.planUuid}/reliever-assignment/${fixture.assignmentUuid}`;
const crewPath = `/api/v2/crew-pool/crew/${fixture.crewUuid}/training`;
const canWrite = path => path === `${prefix}/training-suggestions`
  || path === crewPath || fixture.certificateUuids.some(id => path === `${crewPath}/${id}`)
  || path === "/api/v2/training-needs/others"
  || /^\/api\/v2\/training-needs\/compliance\/[0-9a-f-]+\/(?:confirm|dismiss)$/.test(path)
  // Crew Save reconciles through this exact registered subject only.
  || path === `/api/v2/crew-pool/crew/${fixture.crewUuid}`
  || path.startsWith(`/api/v2/crew-pool/crew/${fixture.crewUuid}/`);
await page.route("**/api/**", route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (!["GET", "HEAD"].includes(request.method()) && !canWrite(path)) return route.abort();
  if (!["GET", "HEAD"].includes(request.method())) report.writes.push({ path, method: request.method(), throughScreen: true });
  return route.continue();
});
await page.route("**/src/**", async route => {
  try { return await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) }); }
  catch { return route.continue(); }
});
async function api(method, path, data, id = 24) {
  assert.ok(["GET", "HEAD"].includes(method) || canWrite(path), "Only registered fixture writes allowed");
  const response = await context.request.fetch(`${base}${path}`, {
    method, data, headers: { Authorization: `Bearer ${token(id)}` },
  });
  if (!["GET", "HEAD"].includes(method)) report.writes.push({ path, method, preparation: true });
  return response;
}
async function ok(method, path, data) {
  const response = await api(method, path, data);
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
}
const parent = () => page.getByRole("dialog").filter({ has: page.getByTestId("input-reliever-name") });
const details = () => page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Training Matrix Compliance", exact: true }) });
async function openPlan() {
  await page.goto(`${base}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  const reconciled = page.waitForResponse(r => new URL(r.url()).pathname === `${prefix}/training-suggestions` && r.request().method() === "POST");
  await page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${fixture.planUuid}"]`).click();
  assert.equal((await reconciled).status(), 200);
  await page.getByTestId("training-compliance-see-details").click();
  await expect(details()).toBeVisible();
}
async function shot(name) {
  const path = `${root}/${name}.png`; await page.screenshot({ path, animations: "disabled" }); report.screenshots.push(path);
}
try {
  // Reuse certificate and manual-need descendants on replay; no repeated roots.
  let manual = (await db.query("SELECT * FROM training_needs_other_v2 WHERE training=$1 AND crew_member_id=$2 AND NOT is_deleted",
    ["TEST ONLY slice 6 manual need — never auto-close", subject.emp_no])).rows[0];
  if (!manual) manual = await ok("POST", "/api/v2/training-needs/others", {
    sourceLabel: "Others", crewMemberId: subject.emp_no, name: "TEST ONLY PDF Layout Seafarer",
    training: "TEST ONLY slice 6 manual need — never auto-close", category: "Fixture", status: "Pending",
    comments: "Registered slice 6 acceptance fixture. Automatic compliance closure must never change this manual need.",
  });
  const manualUuid = manual.tno_uuid ?? manual.tnoUuid;
  report.manualUuid = manualUuid;
  const manualBefore = (await db.query("SELECT md5(to_jsonb(t)::text) AS fingerprint FROM training_needs_other_v2 t WHERE tno_uuid=$1", [manualUuid])).rows[0].fingerprint;
  let certificate = (await db.query("SELECT * FROM crew_training_courses WHERE crew_uuid=$1 AND certificate_no='TEST-S6-RENEWAL' AND NOT is_deleted",
    [fixture.crewUuid])).rows[0];
  if (!certificate) certificate = await ok("POST", crewPath, { courseId: "18", trainingCourse: "Advanced Fire Fighting (AFF)",
    certificateNo: "TEST-S6-RENEWAL", issued: "2030-01-01", expiry: "2031-01-01" });
  const certificateUuid = certificate.train_uuid ?? certificate.trainUuid;
  report.certificateUuid = certificateUuid;
  const before = await ok("POST", `${prefix}/training-suggestions`, {});
  const finished = before.suggestions.some(s => s.course_uuid === required && s.status === "CLOSED")
    && before.suggestions.some(s => s.course_uuid === chemical && s.status === "DISMISSED");
  if (!finished) {
    await ok("PATCH", `${crewPath}/${fixture.certificateUuids[0]}`, { issued: "2026-01-01", expiry: "2027-07-01" });
    await openPlan();
    const first = await ok("POST", `${prefix}/training-suggestions`, {});
    await ok("POST", `${prefix}/training-suggestions`, {});
    await ok("POST", `${prefix}/training-suggestions`, {});
    const duplicates = (await db.query(`SELECT course_uuid,count(*)::int AS count FROM training_compliance_suggestions
      WHERE assign_uuid=$1 GROUP BY course_uuid`, [fixture.assignmentUuid])).rows;
    assert.ok(duplicates.every(row => row.count === 1));
    const expiring = first.suggestions.find(s => s.course_uuid === required);
    assert.equal(expiring.gap.course.state, "Expires during contract");
    assert.equal(expiring.target_date, "2027-06-30");
    await expect(details().getByTestId(`training-need-suggestion-${required}`)).toContainText("Target 30-Jun-2027");
    await shot("01-one-suggestion-per-gap-and-expiry-target");
    report.checks.push("Repeated checks produce one suggestion per assignment/course; expiry 01-Jul-2027 has target 30-Jun-2027.");
    if (closing) {
      const confirmed = page.waitForResponse(r => r.url().endsWith(`/${expiring.suggestion_uuid}/confirm`));
      await details().getByTestId(`training-suggestion-confirm-${required}`).click();
      assert.equal((await confirmed).status(), 200);
      await expect(details().getByTestId(`training-need-suggestion-${required}`)).toContainText("Confirmed");
      await shot("02-confirmed-through-see-details");
      await details().getByTestId(`training-suggestion-dismiss-${chemical}`).click();
      const dismissDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Dismiss training suggestion" }) });
      await expect(dismissDialog.getByRole("button", { name: "Dismiss suggestion", exact: true })).toBeDisabled();
      await dismissDialog.getByLabel("Reason", { exact: true }).fill("TEST ONLY: training already arranged separately; retain this dismissal for verification.");
      await dismissDialog.getByRole("button", { name: "Dismiss suggestion", exact: true }).click();
      await expect(details().getByTestId(`training-need-suggestion-${chemical}`)).toContainText("Dismissed");
      await shot("03-dismissed-with-written-reason");
      // Complete the registered pending renewal in D3 through the actual form.
      await page.goto(`${base}/crew-pool?crew=${fixture.crewUuid}&section=D3`, { waitUntil: "networkidle" });
      if (!subject.recruitment_date) {
        await page.getByTestId("button-edit-recruitment-date").click();
        const dateDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Set Date of Recruitment" }) });
        await dateDialog.getByTestId("input-recruitment-date-manual").fill("01-Jan-2026");
        await dateDialog.getByTestId("input-recruitment-date-manual").blur();
        await dateDialog.getByRole("button", { name: "Save", exact: true }).click();
        await expect(dateDialog).toBeHidden();
      }
      const row = page.locator("#crew-training-courses tr").filter({ has: page.locator('input[value="TEST-S6-RENEWAL"]') });
      await expect(row).toBeVisible(); await row.scrollIntoViewIfNeeded();
      const dates = row.getByRole("textbox", { name: "Date", exact: true });
      await dates.nth(0).fill("01-Jan-2026"); await dates.nth(0).blur();
      await dates.nth(1).fill("31-Dec-2029"); await dates.nth(1).blur();
      // Existing fixture has a deliberately future-issued certificate for
      // calculation cases. Correct it temporarily so profile Save's ordinary
      // date validation can run; the dismissed suggestion remains dismissed.
      const priorFuture = page.locator("#crew-training-courses tr").filter({ has: page.locator('input[value="TEST-S4-B-PERMANENT"]') });
      const priorDates = priorFuture.getByRole("textbox", { name: "Date", exact: true });
      await priorDates.nth(0).fill("01-Jan-2026"); await priorDates.nth(0).blur();
      await priorDates.nth(1).fill("31-Dec-2026"); await priorDates.nth(1).blur();
      await shot("04-qualifying-renewal-recorded-in-d3");
      await page.getByTestId("button-save-draft").click();
      await expect.poll(async () => (await db.query("SELECT status FROM training_compliance_suggestions WHERE suggestion_uuid=$1",
        [expiring.suggestion_uuid])).rows[0].status, { timeout: 30000 }).toBe("CLOSED");
      report.checks.push("Confirmed and dismissed through See Details; qualifying registered renewal completed and saved through D3 closes the confirmed need automatically.");
    }
  }
  if (closing) {
    await openPlan();
    await expect(details().getByTestId(`training-need-suggestion-${required}`)).toContainText("Closed");
    await expect(details().getByTestId(`training-need-suggestion-${chemical}`)).toContainText("Dismissed");
    await shot("05-closed-with-certificate-and-retained-dismissal");
    const suggestions = await ok("POST", `${prefix}/training-suggestions`, {});
    report.suggestions = suggestions.suggestions;
    const active = suggestions.suggestions.find(s => s.course_uuid === required);
    const denied = await api("POST", `/api/v2/training-needs/compliance/${active.suggestion_uuid}/confirm`, {}, 3);
    assert.equal(denied.status(), 403);
    report.checks.push("Crewing Manager has Training View but not Create: server refuses confirmation, without any grant changes.");
    report.history = (await db.query(`SELECT h.* FROM training_compliance_suggestion_history h
      JOIN training_compliance_suggestions s ON s.suggestion_uuid=h.suggestion_uuid
      WHERE s.assign_uuid=$1 ORDER BY h.id`, [fixture.assignmentUuid])).rows;
    assert.ok(report.history.some(h => h.event === "confirmed" && h.actor === "24" && h.before_value.status === "SUGGESTED" && h.after_value.status === "CONFIRMED"));
    assert.ok(report.history.some(h => h.event === "dismissed" && h.actor === "24" && h.reason.includes("already arranged")));
    assert.ok(report.history.some(h => h.event === "certificate_qualified" && h.certificate_uuid === certificateUuid && h.reason.includes("qualifying")));
    const manualAfter = (await db.query("SELECT md5(to_jsonb(t)::text) AS fingerprint FROM training_needs_other_v2 t WHERE tno_uuid=$1", [manualUuid])).rows[0].fingerprint;
    assert.equal(manualAfter, manualBefore);
    report.checks.push("Manual Training Need content fingerprint is unchanged; automatic closure names the qualifying certificate and reason in append-only history.");
    await page.goto(`${base}/training-retention/training`, { waitUntil: "networkidle" });
    await expect(page.getByText("Pre-joining compliance", { exact: true }).first()).toBeVisible();
    await shot("06-generated-and-manual-training-needs");
    // Restore only temporary edits to the old fixture certificates. New
    // registered descendants and all suggestion histories deliberately remain.
    const originals = JSON.parse(await fs.readFile(backupPath, "utf8"));
    for (const item of originals)
      await ok("PATCH", `${crewPath}/${item.train_uuid}`, { issued: item.issued, expiry: item.expiry });
    if (!subject.recruitment_date)
      await ok("PATCH", `/api/v2/crew-pool/crew/${fixture.crewUuid}`, { recruitmentDate: null });
    report.restoredOriginalCertificates = true;
    assert.equal(cmd("git", ["rev-parse", "HEAD"]), report.head);
    assert.equal(cmd("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]), pid);
  }
  await fs.writeFile(`${root}/${closing ? "browser-closing" : "browser-preflight"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ head: report.head, closing, checks: report.checks, manualUuid, certificateUuid, screenshots: report.screenshots }));
} catch (error) {
  report.failure = String(error); await page.screenshot({ path: `${root}/failure.png` }).catch(() => {});
  await fs.writeFile(`${root}/${closing ? "browser-closing" : "browser-preflight"}.json`, JSON.stringify(report, null, 2));
  throw error;
} finally { await browser.close(); await db.end(); }
