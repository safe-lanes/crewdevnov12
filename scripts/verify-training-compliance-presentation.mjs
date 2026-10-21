// Clicked main-preview presentation evidence, reusing the registered slice 4 fixture.
import "./verification-guard.mjs";
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

const fixture = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const root = "generated-artifacts/training-slice4-adjustments";
await fs.mkdir(root, { recursive: true });
const command = (name, args) => execFileSync(name, args, { encoding: "utf8", env: { ...process.env, TZ: "UTC" } }).trim();
const listener = () => command("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"]);
const pid = listener();
const evidence = {
  head: command("git", ["rev-parse", "HEAD"]), persona: fixture.persona,
  closing: !process.argv.includes("--draft"), scenarios: [], screenshots: [], errors: [], writes: [],
  chronology: { pid, commitTime: command("git", ["show", "-s", "--format=%cI", "HEAD"]),
    backendStartUtc: new Date(`${command("ps", ["-p", pid, "-o", "lstart="])} UTC`).toISOString() },
};
const browser = await chromium.launchPersistentContext("generated-artifacts/attachment-display/browser-profile-office", {
  executablePath: command("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"], viewport: { width: 1560, height: 1080 },
});
const page = await browser.newPage();
const reads = [];
let lastResult;
page.on("pageerror", error => evidence.errors.push(error.message));
page.on("response", response => {
  if (new URL(response.url()).pathname.endsWith("/training-compliance") && response.ok())
    reads.push(response.json().then(data => { lastResult = data; }));
});
await page.route("**/api/v2/**", route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (["GET", "HEAD"].includes(request.method())) return route.continue();
  if (request.method() === "PATCH" && path === `/api/v2/vessel/planning/${fixture.planUuid}`) {
    evidence.writes.push({ path, body: request.postDataJSON() }); return route.continue();
  }
  evidence.errors.push(`Refused non-fixture write: ${request.method()} ${path}`);
  return route.abort();
});
async function closeDetails(dialog) {
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function capture(name) {
  const file = `${root}/${name}.png`;
  await page.getByText("Relief status saved successfully", { exact: true }).last()
    .waitFor({ state: "hidden", timeout: 15000 });
  await page.screenshot({ path: file, animations: "disabled" });
  evidence.screenshots.push(file);
  evidence.scenarios.push({ name, result: lastResult });
}
async function openReliever() {
  await page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${fixture.planUuid}"]`).click();
  await expect(page.getByTestId("input-reliever-name")).toHaveValue("TEST ONLY PDF Layout Seafarer");
  await page.getByTestId("training-compliance-see-details").waitFor();
  await Promise.all(reads);
}
async function details() {
  await page.getByTestId("training-compliance-see-details").click();
  const dialog = page.getByRole("dialog", { name: "Training Matrix Compliance", exact: true });
  await expect(dialog).toContainText("A. Statutory");
  await expect(dialog).toContainText("Calculation version: 1.2.0");
  await expect(dialog.getByRole("switch", { name: "Show only items needing action" })).not.toBeChecked();
  assert.equal(lastResult.status, "complete");
  await expect(dialog.getByTestId(/^training-course-row-/)).toHaveCount(lastResult.courses.length);
  const ordered = [...lastResult.courses].sort((a, b) => a.categoryOrder - b.categoryOrder || a.matrixOrder - b.matrixOrder);
  assert.deepEqual(await dialog.getByTestId(/^training-course-row-/).evaluateAll(rows => rows.map(row => row.dataset.testid)),
    ordered.map(course => `training-course-row-${course.courseUuid}`));
  return dialog;
}
async function saveDate(value) {
  await page.getByTestId("button-joining-date").click();
  const grid = page.getByRole("grid").last();
  for (let attempt = 0; attempt < 30; attempt++) {
    const caption = await grid.evaluate(el => document.getElementById(el.getAttribute("aria-labelledby"))?.textContent);
    const current = new Date(`1 ${caption} UTC`), target = new Date(`${value}T00:00:00Z`);
    assert.ok(Number.isFinite(current.getTime()), "Calendar month is unavailable.");
    const diff = (target.getUTCFullYear() - current.getUTCFullYear()) * 12 + target.getUTCMonth() - current.getUTCMonth();
    if (!diff) break;
    await page.getByRole("button", { name: diff > 0 ? "Go to next month" : "Go to previous month", exact: true }).click();
    assert.ok(attempt < 29, "Calendar did not reach the fixture date.");
  }
  await grid.locator("button:not(.day-outside)").filter({ hasText: new RegExp(`^${Number(value.slice(-2))}$`) }).click();
  await page.getByTestId("input-reliever-contract-range-end").fill("6");
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v2/vessel/planning/${fixture.planUuid}`
    && r.request().method() === "PATCH");
  await page.getByTestId("button-submit-relief").click();
  assert.equal((await saved).status(), 200);
  await page.getByTestId("button-submit-relief").waitFor({ state: "hidden" });
  await openReliever();
}
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await openReliever();
  await saveDate("2028-01-01");
  let dialog = await details();
  assert.equal(lastResult.courses.length, 2, "Review the fixture matrix before changing the expected complete list.");
  assert.ok(lastResult.courses.every(course => ["Valid", "Valid, no expiry"].includes(course.state)));
  const plain = lastResult.courses.find(course => course.certificates.length === 1
    && !course.isEquivalent && !course.certificates[0].flags.length);
  assert.ok(plain);
  await expect(dialog.getByTestId(`training-certificate-expand-${plain.courseUuid}`)).toHaveCount(0);
  await capture("01-all-courses-compliant");

  // At this date, the equivalent makes both course states compliant. The old
  // malformed-issue certificate still needs correction: filter retains that
  // row while hiding the unflagged compliant chemical-tanker requirement.
  await dialog.getByRole("switch", { name: "Show only items needing action" }).click();
  await expect(dialog.getByTestId(/^training-course-row-/)).toHaveCount(1);
  await expect(dialog.getByRole("switch", { name: "Show only items needing action" })).toBeChecked();
  await capture("03-action-only-switch");
  await closeDetails(dialog);

  await saveDate("2027-05-01");
  dialog = await details();
  assert.deepEqual(new Set(lastResult.courses.map(course => course.state)), new Set(["Valid", "Not held"]));
  const multiple = lastResult.courses.find(course => course.certificates.length > 1);
  assert.ok(multiple);
  const expand = dialog.getByTestId(`training-certificate-expand-${multiple.courseUuid}`);
  if (await expand.getAttribute("aria-expanded") !== "true") await expand.click();
  await expect(dialog).toContainText("TEST-S4-A-LONG");
  await expect(dialog).toContainText("TEST-S4-A-SHORT");
  await expect(dialog).toContainText("Selection rule:");
  await expect(dialog.getByText("Not held", { exact: true })).toHaveCount(1);
  await expect(dialog.getByText("Mandatory", { exact: true })).toHaveCount(2);
  await capture("02-mixed-and-expandable");
  await closeDetails(dialog);

  await expect(page.getByTestId("training-matrix-compliance-line")
    .getByText("Recommended: None required for this rank", { exact: true })).toBeVisible();
  await capture("04-no-recommended-courses");
  assert.equal(lastResult.summary.recommended.count, 0);
  assert.deepEqual(evidence.errors, []);
  assert.equal(listener(), pid, "Main backend changed during verification.");
  assert.equal(command("git", ["rev-parse", "HEAD"]), evidence.head, "HEAD changed during verification.");
  if (evidence.closing) assert.ok(Date.parse(evidence.chronology.backendStartUtc) > Date.parse(evidence.chronology.commitTime),
    "Closing evidence requires the backend to start after the final commit.");
  console.log(JSON.stringify({ head: evidence.head, chronology: evidence.chronology, screenshots: evidence.screenshots,
    rows: evidence.scenarios.map(s => ({ name: s.name, courses: s.result.courses.length })),
    restored: { joining: lastResult.joiningDate, contractEnd: lastResult.contractEnd } }));
} catch (error) {
  evidence.failure = error.message;
  await page.screenshot({ path: `${root}/failure.png`, animations: "disabled" }).catch(() => {});
  throw error;
} finally {
  await Promise.allSettled(reads);
  await fs.writeFile(`${root}/browser-evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
