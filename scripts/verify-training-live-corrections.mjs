import "./verification-guard.mjs";
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import pg from "pg";
import assert from "node:assert/strict";

const root = "generated-artifacts/training-live-corrections";
await fs.mkdir(root, { recursive: true });
const fixture = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const cmd = (name, args) => execFileSync(name, args, { encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();
const listener = () => cmd("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]);
const report = { head: cmd("git", ["rev-parse", "HEAD"]), commitTime: cmd("git", ["show", "-s", "--format=%cI", "HEAD"]),
  pid: listener(), closing: process.argv.includes("--closing"), checks: [], screenshots: [], writes: [], prompts: [] };
report.backendStart = new Date(`${cmd("ps", ["-p", report.pid, "-o", "lstart="])} UTC`).toISOString();
if (report.closing) assert.ok(Date.parse(report.backendStart) > Date.parse(report.commitTime));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const originalPlan = (await db.query(`SELECT reliever_sign_on_date AS "relieverSignOnDate",
  reliever_contract_period_months AS "relieverContractPeriodMonths",
  reliever_contract_end_range_end_months AS "relieverContractEndRangeEndMonths",
  deployment_checklist_completed AS "deploymentChecklistCompleted" FROM vessel_planning_v2 WHERE plan_uuid=$1`, [fixture.planUuid])).rows[0];
const originals = (await db.query("SELECT train_uuid,issued,expiry FROM crew_training_courses WHERE train_uuid=ANY($1::text[])",
  [fixture.certificateUuids])).rows;
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: cmd("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1700, height: 1280 },
  extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
await context.addInitScript(token => {
  const profile = { personaKey: "crewing-executive", masterUserId: 24, userId: "24", role: "Admin",
    roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6", userType: "Office", myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(profile));
  localStorage.setItem("devPersona", JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, token);
const page = await context.newPage(), base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const endpoint = `/api/v2/vessel/planning/${fixture.planUuid}/reliever-assignment/${fixture.assignmentUuid}/training-compliance`;
const planPath = `/api/v2/vessel/planning/${fixture.planUuid}`;
const settingsPath = "/api/v2/admin/training-compliance/settings";
const allowedWrites = new Set([planPath, settingsPath,
  ...fixture.certificateUuids.map(id => `/api/v2/crew-pool/crew/${fixture.crewUuid}/training/${id}`)]);
await page.route("**/api/**", route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (["GET", "HEAD"].includes(request.method())) return route.continue();
  if (!allowedWrites.has(path)) return route.abort();
  report.writes.push({ path, method: request.method(), body: request.postDataJSON() });
  return route.continue();
});
await page.route("**/src/**", async route => {
  const response = await route.fetch({ maxRetries: 2, timeout: 60000 });
  await route.fulfill({ response });
});
let nextPromptAccept = false;
page.on("dialog", async dialog => {
  report.prompts.push(dialog.message());
  if (nextPromptAccept) await dialog.accept(); else await dialog.dismiss();
});
async function api(method, path, body) {
  assert.ok(method === "GET" || allowedWrites.has(path), "Only registered fixture and tenant-policy writes allowed.");
  const response = await context.request.fetch(`${base}${path}`, { method, data: body });
  assert.equal(response.status(), 200, `Fixture preparation/restoration failed: ${method} ${path}`);
  if (method !== "GET") report.writes.push({ path, method, preparationOrRestoration: true, body });
  return response.json();
}
const originalPolicy = await api("GET", settingsPath);
const parent = () => page.getByRole("dialog").filter({ has: page.getByTestId("input-reliever-name") });
const details = () => page.getByRole("dialog", { name: "Training Matrix Compliance", exact: true });
const check = text => report.checks.push(text);
async function shot(name) {
  await page.getByText("Relief status saved successfully", { exact: true }).last().waitFor({ state: "hidden", timeout: 15000 });
  const path = `${root}/${name}.png`;
  await page.screenshot({ path, animations: "disabled" });
  report.screenshots.push(path);
}
async function openPlan() {
  await page.goto(`${base}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${fixture.planUuid}"]`).click();
  await expect(page.getByTestId("input-reliever-name")).toHaveValue("TEST ONLY PDF Layout Seafarer");
}
async function joining(value) {
  await page.getByTestId("button-joining-date").click();
  const grid = page.getByRole("grid").last(), target = new Date(`${value}T00:00:00Z`);
  for (let i = 0; i < 36; i++) {
    const caption = await grid.evaluate(el => document.getElementById(el.getAttribute("aria-labelledby"))?.textContent);
    const current = new Date(`1 ${caption} UTC`);
    assert.ok(Number.isFinite(current.getTime()));
    const delta = (target.getUTCFullYear() - current.getUTCFullYear()) * 12 + target.getUTCMonth() - current.getUTCMonth();
    if (!delta) break;
    await page.getByRole("button", { name: delta > 0 ? "Go to next month" : "Go to previous month", exact: true }).click();
  }
  await grid.locator("button:not(.day-outside)").filter({ hasText: new RegExp(`^${Number(value.slice(-2))}$`) }).click();
}
async function save(period, range) {
  await page.getByTestId("input-reliever-contract-period").fill(period == null ? "" : String(period));
  await page.getByTestId("input-reliever-contract-range-end").fill(range == null ? "" : String(range));
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === planPath && r.request().method() === "PATCH");
  const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === "GET");
  await parent().getByRole("button", { name: "Save", exact: true }).click();
  assert.equal((await saved).status(), 200);
  const response = await refreshed;
  assert.equal(response.status(), 200);
  await expect(parent()).toBeVisible();
  return response.json();
}
async function openDetails() {
  await page.getByTestId("training-compliance-see-details").click();
  await expect(details()).toContainText("Calculation version: 1.4.0");
  await expect(details().getByRole("columnheader").first()).toHaveText("Company ID");
  await expect(details().getByRole("columnheader", { name: "Certificate No.", exact: true })).toBeVisible();
}
async function closeDetails() { await details().getByRole("button", { name: "Close", exact: true }).click(); }
try {
  await openPlan();
  await joining("2028-01-01");
  let result = await save(6, 6);
  assert.ok(result.courses.every(c => c.state === "Expiry not recorded"));
  await openDetails();
  await expect(details().getByText("Expiry not recorded", { exact: true }).first()).toHaveClass(/bg-amber-50/);
  await expect(details().getByText("Valid, no expiry", { exact: true })).toHaveCount(0);
  await shot("01-expiry-not-recorded-amber");
  check("Expiring master + undated certificate shows amber Expiry not recorded, never green/permanent.");
  await closeDetails();

  await joining("2027-05-01");
  result = await save(6, null);
  assert.equal(result.contractEnd, "2027-11-01");
  assert.equal(result.contractEndSource, "contract_period");
  await openDetails();
  await expect(details()).toContainText("based on contract period");
  await expect(details()).toContainText("Add the certificate in crew profile → D3.");
  const multiple = result.courses.find(c => c.certificates.length > 1);
  await details().getByTestId(`training-certificate-expand-${multiple.courseUuid}`).click();
  await expect(details()).toContainText("Used:");
  await expect(details()).toContainText("Not used:");
  await expect(details()).not.toContainText("Selection rule");
  await shot("02-own-period-and-certificate-details");
  await closeDetails();
  check("Blank range uses own period; Save keeps popup open and refreshes compliance; certificate numbers/next actions/details are separate.");

  result = await save(null, null);
  assert.equal(result.contractEndStatus, "not_set");
  assert.ok(result.courses.some(c => c.state === "Not held"));
  await expect(page.getByTestId("training-matrix-compliance-line")).toContainText(
    "Contract end not set: enter Contract End Range to check validity for the whole contract");
  await expect(page.getByTestId("training-matrix-compliance-line")).not.toContainText("(0)");
  await shot("03-missing-end-with-joining-gap");
  check("Both lengths save blank, with explicit missing-end instruction and nonzero joining-date gaps.");

  await page.getByTestId("input-reliever-contract-range-end").fill("7");
  nextPromptAccept = false;
  await parent().getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(report.prompts.at(-1), "Discard unsaved changes?");
  await expect(parent()).toBeVisible();
  await expect(page.getByTestId("input-reliever-contract-range-end")).toHaveValue("7");
  await shot("04-discard-cancel-preserves-edit");
  nextPromptAccept = true;
  await page.mouse.click(10, 120);
  await expect(parent()).not.toBeVisible();
  assert.equal(report.prompts.at(-1), "Discard unsaved changes?");
  await openPlan();
  await expect(page.getByTestId("input-reliever-contract-range-end")).toHaveValue("");
  check("X/cancel retains unsaved edits; outside/accept discards them without saving.");

  for (const id of [fixture.certificateUuids[0], fixture.certificateUuids[2]])
    await api("PATCH", `/api/v2/crew-pool/crew/${fixture.crewUuid}/training/${id}`, { issued: null });
  result = await save(6, null);
  await openDetails();
  await expect(details()).toContainText("2 certificates are missing their issue date");
  await expect(details()).toContainText("Correct in crew profile → D3 Training Courses.");
  await shot("05-actionable-banner-and-d3-link");
  const link = details().getByTestId("training-open-crew-profile");
  assert.equal(await link.getAttribute("href"), `/crew-pool?crew=${fixture.crewUuid}&section=D3`);
  await Promise.all([page.waitForURL(/\/crew-pool\?/), link.click()]);
  await expect(page.locator("#crew-training-courses")).toBeInViewport();
  await expect(page.getByText("D3 Training Course", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${root}/06-open-crew-d3.png`, animations: "disabled" });
  report.screenshots.push(`${root}/06-open-crew-d3.png`);
  check("Banner counts affected certificates/names with D3 corrections; Open crew profile (D3) reaches the actual D3 screen.");

  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("sidebar-item-access-control").click();
  await page.getByTestId("training-compliance-policy").waitFor();
  await expect(page.getByText("Block when a mandatory certificate's expiry is not recorded", { exact: true })).toBeVisible();
  await shot("07-management-expiry-settings");
  const checkbox = page.getByTestId("training-block-missing-expiry");
  await checkbox.click();
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === settingsPath && r.request().method() === "PUT");
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  assert.equal((await saved).status(), 200);
  const audits = (await db.query(`SELECT actor,before_value,after_value,recorded_at FROM adm_access_control_audit
    WHERE action='block_missing_expiry' ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.equal(audits.actor.masterUserId, 24);
  assert.notEqual(audits.before_value, audits.after_value);
  report.policyAudit = audits;
  check("Management screen saves independent missing-expiry policy; audit derives actor 24 and before/after on server.");
  assert.equal(listener(), report.pid); assert.equal(cmd("git", ["rev-parse", "HEAD"]), report.head);
} catch (error) {
  report.failure = error.message;
  await page.screenshot({ path: `${root}/failure.png` }).catch(() => {});
  throw error;
} finally {
  try {
    await api("PUT", settingsPath, originalPolicy);
    for (const row of originals) await api("PATCH",
      `/api/v2/crew-pool/crew/${fixture.crewUuid}/training/${row.train_uuid}`, { issued: row.issued, expiry: row.expiry });
    await api("PATCH", planPath, originalPlan);
    report.restored = true;
  } catch (error) { report.restoreError = error.message; }
  await fs.writeFile(`${root}/${report.closing ? "browser-closing" : "browser-preflight"}.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.end();
}
assert.equal(report.restored, true, report.restoreError);
console.log(JSON.stringify(report));
