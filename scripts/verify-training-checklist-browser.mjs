import "./verification-guard.mjs";
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import pg from "pg";
import assert from "node:assert/strict";

const f = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const root = "generated-artifacts/training-slice5";
await fs.mkdir(root, { recursive: true });
const shell = (name, args) => execFileSync(name, args, { encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();
const pid = () => shell("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]);
const report = { head: shell("git", ["rev-parse", "HEAD"]), pid: pid(), checks: [], screenshots: [], api: [],
  closing: process.argv.includes("--closing"), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]) };
report.backendStart = new Date(`${shell("ps", ["-p", report.pid, "-o", "lstart="])} UTC`).toISOString();
if (report.closing) assert.ok(Date.parse(report.backendStart) > Date.parse(report.commitTime));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
  ON r.assigned_role=u.role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
assert.ok(actor, "Existing trusted office administrator required.");
const token = [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ id: actor.id, userType: actor.user_type, domain: "test" })).toString("base64url"), "devsig"].join(".");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1560, height: 1120 },
  extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
await context.addInitScript(({ actor, token }) => {
  const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
    role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(profile));
  localStorage.setItem("devPersona", JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, { actor, token });
const page = await context.newPage();
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const grantUrl = `/api/v2/admin/access-control/roles/${actor.ruid}/training-compliance`;
const settingsUrl = "/api/v2/admin/training-compliance/settings";
async function api(method, path, body) {
  const response = await context.request.fetch(`${base}${path}`, { method, data: body });
  const data = await response.json();
  report.api.push({ method, path, status: response.status() });
  return { status: response.status(), data };
}
const originalGrant = await api("GET", grantUrl);
const originalSetting = await api("GET", settingsUrl);
const cert = (await db.query("SELECT issued,expiry FROM crew_training_courses WHERE train_uuid=$1", [f.certificateUuids[2]])).rows[0];
assert.ok(cert);
const existingRequired = (await db.query(`SELECT 1 FROM frm_requirements WHERE subject_ref=$1 AND mandatory
  AND stage_key='before_joining' AND status IN('OUTSTANDING','STARTED')`, [f.assignmentUuid])).rows.length > 0;
report.persona = { masterUserId: actor.id, role: actor.role, roleUuid: actor.ruid,
  mode: "user-approved development persona; real persisted grants and scope checks" };
report.originalGrant = originalGrant.data;
report.originalSetting = originalSetting.data;
function check(condition, text) { assert.ok(condition, text); report.checks.push(text); }
async function capture(name) {
  const path = `${root}/${name}.png`;
  await page.screenshot({ path, animations: "disabled" });
  report.screenshots.push(path);
}
async function navigateReliever() {
  await page.goto(`${base}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${f.planUuid}"]`).click();
  await expect(page.getByTestId("input-reliever-name")).toHaveValue("TEST ONLY PDF Layout Seafarer");
}
async function date(value) {
  await page.getByTestId("button-joining-date").click();
  const grid = page.getByRole("grid").last();
  for (let i = 0; i < 30; i++) {
    const caption = await grid.evaluate(el => document.getElementById(el.getAttribute("aria-labelledby"))?.textContent);
    const from = new Date(`1 ${caption} UTC`), to = new Date(`${value}T00:00:00Z`);
    assert.ok(Number.isFinite(from.getTime()));
    const difference = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
    if (!difference) break;
    await page.getByRole("button", { name: difference > 0 ? "Go to next month" : "Go to previous month", exact: true }).click();
  }
  await grid.locator("button:not(.day-outside)").filter({ hasText: new RegExp(`^${Number(value.slice(-2))}$`) }).click();
  await page.getByTestId("input-reliever-contract-range-end").fill("6");
}
async function submitYes(expectedStatus) {
  await page.getByTestId("radio-deployment-checklist").getByRole("radio", { name: "Yes", exact: true }).click();
  const response = page.waitForResponse(r => r.request().method() === "PATCH" &&
    new URL(r.url()).pathname === `/api/v2/vessel/planning/${f.planUuid}`);
  await page.getByTestId("button-submit-relief").click();
  const result = await response;
  assert.equal(result.status(), expectedStatus, await result.text());
  return result.json();
}
async function accessControl() {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("sidebar-item-access-control").click();
  await page.getByTestId("access-control-page").waitFor();
}
async function grant(value) {
  await accessControl();
  await page.getByLabel("Choose role for management grant").selectOption(actor.ruid);
  const checkbox = page.getByTestId("training-compliance-permission-checkbox");
  await expect(checkbox).toHaveAttribute("data-state", value ? "unchecked" : "checked");
  await checkbox.click();
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === grantUrl);
  await page.getByTestId("save-training-compliance-permission").click();
  assert.equal((await saved).status(), 200);
}
async function setting(value) {
  await accessControl();
  const checkbox = page.getByTestId("training-block-expiring");
  await expect(checkbox).toHaveAttribute("data-state", value ? "unchecked" : "checked");
  await checkbox.click();
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname === settingsUrl);
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  assert.equal((await saved).status(), 200);
}
async function editCertificate(fields) {
  const result = await api("PATCH", `/api/v2/crew-pool/crew/${f.crewUuid}/training/${f.certificateUuids[2]}`, fields);
  assert.equal(result.status, 200);
}
try {
  // On closing replay, the deliberately retained mandatory fixture requirement
  // already exists. Verify earlier accepted warning/override snapshots rather
  // than deleting or weakening that requirement to replay history.
  if (!existingRequired) {
    if (originalGrant.data.allowed) assert.equal((await api("PUT", grantUrl, { allowed: false })).status, 200);
    if (originalSetting.data.blockExpiringDuringContract) assert.equal((await api("PUT", settingsUrl, { blockExpiringDuringContract: false })).status, 200);
    await navigateReliever();
    const denied = await submitYes(409);
    check(denied.blockers.some(b => b.kind === "training" && b.status === "Not held"), "Screen refuses checklist and names missing mandatory course");
    check(!denied.canOverrideTraining, "No training override authority by default");
    await expect(page.getByRole("alertdialog")).toContainText("Advanced Training for Chemical Tanker Cargo Operations");
    await capture("01-course-block-no-permission");
    const forged = await api("PATCH", `/api/v2/vessel/planning/${f.planUuid}`, {
      deploymentChecklistCompleted: true, trainingOverride: { reason: "TEST ONLY unauthorized override attempt" } });
    check(forged.status === 409 && /do not have Override training compliance/.test(forged.data.message),
      "Server refuses explicit training override request without permission (negative API check)");

    await grant(true);
    await capture("02-explicit-training-grant");
    await navigateReliever();
    await submitYes(409);
    const alert = page.getByRole("alertdialog");
    await alert.getByText("Request a training compliance override", { exact: true }).click();
    await alert.getByLabel("Reason for training override").fill("TEST ONLY registered fixture: demonstrate independent audited training exception.");
    await capture("03-training-reason");
    const response = page.waitForResponse(r => r.request().method() === "PATCH" && new URL(r.url()).pathname === `/api/v2/vessel/planning/${f.planUuid}`);
    await alert.getByRole("button", { name: "Save planning change", exact: true }).click();
    const accepted = await response;
    assert.equal(accepted.status(), 200, await accepted.text());
    check(Boolean((await accepted.json()).checklistAcceptance?.snapshotUuid), "Screen accepts authorized training override with reason and stores snapshot");

    await editCertificate({ issued: "2027-01-01", expiry: "2027-11-30" });
    await navigateReliever();
    await date("2027-10-01");
    const warning = await submitYes(200);
    check(warning.checklistAcceptance.warnings.some(w => w.includes("Expires during contract")),
      "Mandatory expiry warning proceeds normally while policy is OFF");
    await capture("04-warning-proceeds");
    const snapshot = (await db.query("SELECT * FROM training_checklist_snapshots WHERE snapshot_uuid=$1",
      [warning.checklistAcceptance.snapshotUuid])).rows[0];
    report.warningSnapshotUuid = snapshot.snapshot_uuid;
    await editCertificate({ expiry: "2028-12-31" });
    const after = (await db.query("SELECT * FROM training_checklist_snapshots WHERE snapshot_uuid=$1", [snapshot.snapshot_uuid])).rows[0];
    assert.deepEqual(after, snapshot);
    check(true, "Editing the fixture certificate after acceptance leaves every saved snapshot value and fingerprint unchanged");
    await navigateReliever();
    await page.getByTestId("button-see-checklist").click();
    await expect(page.getByRole("dialog", { name: "Accepted checklist history", exact: true })).toContainText("30-Nov-2027");
    await capture("05-frozen-after-certificate-edit");
    await editCertificate({ expiry: "2027-11-30" });
    await setting(true);
    await navigateReliever();
    const blocked = await submitYes(409);
    check(blocked.blockers.some(b => b.kind === "training" && b.status === "Expires during contract"),
      "Setting switched ON through Access Control blocks expiring mandatory courses");
    await capture("06-expiry-policy-on-block");
    await setting(false);
    // Prepare/reuse one mandatory version of the existing registered fixture
    // form, released only for the allowlisted fixture vessel; no new crew/forms.
    shell("npx", ["tsx", "scripts/prepare-training-checklist-combined-fixture.ts", "--resolve"]);
  } else {
    const snapshots = (await db.query(`SELECT snapshot_uuid,evidence FROM training_checklist_snapshots WHERE assignment_uuid=$1`, [f.assignmentUuid])).rows;
    check(snapshots.some(s => s.evidence.overrides?.training?.reason), "Retained accepted training override snapshot exists");
    check(snapshots.some(s => !s.evidence.overrides?.training && s.evidence.warnings?.some(w => w.includes("Expires during contract"))),
      "Retained normal acceptance with expiry warnings exists");
    if (!originalGrant.data.allowed) await grant(true);
    await navigateReliever();
    await page.getByTestId("button-see-checklist").click();
    await capture("07-closing-accepted-history");
  }
  await editCertificate(cert);
  await navigateReliever();
  await date("2027-05-01");
  const combined = await submitYes(409);
  check(combined.blockers.some(b => b.kind === "training") && combined.blockers.some(b => b.kind === "requirement"),
    "One screen refusal lists the outstanding mandatory form and training gap together");
  check(!combined.canOverride, "Company Forms completion cannot be bypassed");
  await expect(page.getByRole("alertdialog")).toContainText("must be completed");
  await expect(page.getByRole("alertdialog").getByText("Request a training compliance override", { exact: true })).toHaveCount(0);
  await capture("08-combined-form-and-training-refusal");
  const combinedOverride = await api("PATCH", `/api/v2/vessel/planning/${f.planUuid}`, {
    deploymentChecklistCompleted: true, trainingOverride: { reason: "TEST ONLY prove training authority cannot bypass the required form" } });
  check(combinedOverride.status === 409 && /must be completed/.test(combinedOverride.data.message),
    "Even an explicit permitted training override is refused while the mandatory form is outstanding");
  const audits = (await db.query(`SELECT event,actor,resource,action,before_value,after_value,details,recorded_at
    FROM adm_access_control_audit WHERE resource='training_compliance' ORDER BY id DESC LIMIT 30`)).rows;
  report.audits = audits;
  check(audits.some(a => a.event === "training_override" && a.actor.masterUserId === 24 &&
    a.details.reason && a.details.results?.calculationVersion === "1.2.0"), "Audit records server actor, time, reason and overridden results");
  check(pid() === report.pid && shell("git", ["rev-parse", "HEAD"]) === report.head, "Main backend PID and HEAD stayed fixed during clicked evidence");
} catch (error) {
  report.failure = error.message;
  await capture("failure").catch(() => {});
  throw error;
} finally {
  await editCertificate(cert).catch(error => { report.restoreError = error.message; });
  // Restore original permission and tenant-wide policy via audited normal APIs.
  report.restoreGrant = await api("PUT", grantUrl, originalGrant.data);
  report.restoreSetting = await api("PUT", settingsUrl, originalSetting.data);
  // Restore fixture facts with No so cleanup does not create another acceptance.
  report.restorePlan = await api("PATCH", `/api/v2/vessel/planning/${f.planUuid}`, {
    deploymentChecklistCompleted: false, relieverSignOnDate: "2027-05-01", relieverContractEndRangeEndMonths: 6 });
  await fs.writeFile(`${root}/${report.closing ? "browser-closing" : "browser-preflight"}.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
assert.equal(report.restoreGrant.status, 200, "Original training grant must be restored.");
assert.equal(report.restoreSetting.status, 200, "Original tenant policy must be restored.");
assert.equal(report.restorePlan.status, 200, "Registered fixture facts must be restored.");
assert.ok(!report.restoreError, "Registered certificate facts must be restored.");
console.log(JSON.stringify({ checks: report.checks, screenshots: report.screenshots, head: report.head, backendStart: report.backendStart }));
