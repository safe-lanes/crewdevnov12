// Real main-preview clicks. Only registered fixture Planning PATCHes are allowed.
import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const f = JSON.parse(await fs.readFile("docs/training-compliance-slice-4-fixtures.json", "utf8"));
const root = "generated-artifacts/training-slice4";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launchPersistentContext("generated-artifacts/attachment-display/browser-profile-office", {
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"], viewport: { width: 1560, height: 1080 } });
const page = await browser.newPage();
const evidence = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  persona: f.persona, scenarios: [], screenshots: [], responses: [], errors: [], writes: [] };
const reads = [];
let abortOnce = false;
page.on("pageerror", error => evidence.errors.push(error.message));
page.on("response", r => {
  const path = new URL(r.url()).pathname;
  if (path.endsWith("/training-compliance") && r.ok()) reads.push((async () => {
    const data = await r.json(); evidence.responses.push({ status: r.status(), path, data }); return data;
  })());
});
await page.route("**/api/v2/**", route => {
  const r = route.request(), path = new URL(r.url()).pathname;
  if (abortOnce && path.endsWith("/training-compliance")) { abortOnce = false; return route.abort("failed"); }
  if (["GET", "HEAD"].includes(r.method())) return route.continue();
  if (r.method() === "PATCH" && path === `/api/v2/vessel/planning/${f.planUuid}`) {
    evidence.writes.push({ method: r.method(), path, body: r.postDataJSON() }); return route.continue();
  }
  evidence.errors.push(`Refused non-fixture write: ${r.method()} ${path}`); return route.abort();
});
async function capture(name) {
  const file = `${root}/${name}.png`;
  await page.screenshot({ path: file, animations: "disabled" }); evidence.screenshots.push(file);
}
async function openReliever(wait = true) {
  const edit = page.locator(`[data-testid^="button-edit-reliever-"][data-plan-uuid="${f.planUuid}"]`);
  await edit.click();
  await expect(page.getByTestId("input-reliever-name")).toHaveValue("TEST ONLY PDF Layout Seafarer");
  if (wait) await page.getByTestId("training-compliance-see-details").waitFor();
}
async function details(name, required) {
  await page.getByTestId("training-compliance-see-details").click();
  const dialog = page.getByRole("dialog", { name: "Training Matrix Compliance", exact: true });
  await expect(dialog).toContainText(required);
  await expect(dialog).toContainText("Calculation version: 1.2.0");
  await capture(name);
  await Promise.all(reads);
  evidence.scenarios.push({ name, result: evidence.responses.at(-1).data });
  return dialog;
}
async function closeDetails(dialog) { await dialog.getByRole("button", { name: "Close", exact: true }).click(); }
async function saveDate(date, months) {
  await page.getByTestId("button-joining-date").click();
  const grid = page.getByRole("grid").last();
  for (let i = 0; i < 30; i++) {
    const label = await grid.evaluate(el => document.getElementById(el.getAttribute("aria-labelledby"))?.textContent);
    const target = new Date(`${date}T00:00:00Z`), current = new Date(`1 ${label} UTC`);
    assert.ok(Number.isFinite(current.getTime()), `Unknown calendar caption: ${label}`);
    const diff = (target.getUTCFullYear() - current.getUTCFullYear()) * 12 + target.getUTCMonth() - current.getUTCMonth();
    if (!diff) break;
    await page.getByRole("button", { name: diff > 0 ? "Go to next month" : "Go to previous month", exact: true }).click();
    assert.ok(i < 29, "Calendar did not reach the fixture date.");
  }
  await grid.locator("button:not(.day-outside)").filter({ hasText: new RegExp(`^${Number(date.slice(-2))}$`) }).click();
  if (months !== undefined) await page.getByTestId("input-reliever-contract-range-end").fill(months);
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === `/api/v2/vessel/planning/${f.planUuid}`
    && r.request().method() === "PATCH");
  await page.getByTestId("button-submit-relief").click();
  const response = await saved;
  assert.equal(response.status(), 200, await response.text());
  await page.getByTestId("button-submit-relief").waitFor({ state: "hidden" });
  await openReliever();
}
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/vessel`, { waitUntil: "networkidle" });
  await page.getByTestId("button-edit-2387").click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await openReliever();
  await Promise.all(reads);
  if (evidence.responses.at(-1)?.data.joiningDate === null) {
    const d = await details("01-incomplete", "The reliever's planned joining date is missing or invalid.");
    await closeDetails(d);
    await saveDate("2027-05-01", "");
    const warning = await details("02-contract-end-not-set", "Contract end not set: full-contract validity not checked");
    assert.equal(evidence.scenarios.at(-1).result.status, "complete");
    await closeDetails(warning);
  }
  await saveDate("2027-05-01", "6");
  await capture("03-compliance-line");
  let d = await details("04-valid-and-not-held", "Not held");
  await expect(d).toContainText("Valid");
  await expect(d).toContainText("Certificate dates invalid: correct the record");
  await page.getByTestId(`training-certificate-expand-${evidence.scenarios.at(-1).result.courses[0].courseUuid}`).click();
  await expect(d).toContainText("TEST-S4-A-SHORT");
  await expect(d).toContainText("TEST-S4-A-LONG");
  await capture("05-multiple-certificates");
  const fileResponse = page.waitForResponse(r => r.request().method() === "GET"
    && new URL(r.url()).pathname === `/api/v2/crew-pool/training/attachments/${f.attachmentUuid}/raw`);
  const popupEvent = page.waitForEvent("popup");
  await page.getByTestId(`training-attachment-${f.attachmentUuid}`).first().click();
  const [response, popup] = await Promise.all([fileResponse, popupEvent]);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /application\/pdf/);
  await popup.waitForURL("blob:**", { timeout: 20000 });
  // Verify the actual blob opened by the click, not a second API request.
  const bytes = Buffer.from(await page.evaluate(async url =>
    Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())), popup.url()));
  evidence.attachment = { status: response.status(), method: response.request().method(),
    headers: response.headers(), bytes: bytes.length };
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF", JSON.stringify(evidence.attachment));
  await fs.writeFile(`${root}/opened-training-certificate.pdf`, bytes);
  await popup.waitForLoadState("networkidle");
  await popup.screenshot({ path: `${root}/06-attachment-open.png`, animations: "disabled" });
  evidence.screenshots.push(`${root}/06-attachment-open.png`);
  await popup.close(); evidence.attachment = { status: 200, type: "application/pdf", bytes: bytes.length };
  await closeDetails(d);
  await saveDate("2027-10-01", "6");
  d = await details("07-expires-during-contract", "Expires during contract"); await closeDetails(d);
  await saveDate("2027-12-01", "6");
  d = await details("08-expired-at-joining", "Expired at joining"); await closeDetails(d);
  await saveDate("2028-01-01", "6");
  d = await details("09-no-expiry-equivalent", "Valid, no expiry");
  await expect(d).toContainText("Equivalent"); await expect(d).toContainText("TEST-S4-B-PERMANENT"); await closeDetails(d);
  await saveDate("2027-05-01", "6");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  abortOnce = true; await openReliever(false);
  await expect(page.getByText("Training compliance could not be loaded.", { exact: true })).toBeVisible();
  await capture("10-failure-and-retry");
  await page.getByTestId("training-compliance-retry").click();
  await page.getByTestId("training-compliance-see-details").waitFor();
  d = await details("11-retry-recovered", "Not held"); await closeDetails(d);
  assert.deepEqual(evidence.errors, []);
  const states = new Set(evidence.scenarios.flatMap(s => s.result.courses.map(c => c.state)).filter(Boolean));
  assert.equal(states.size, 5);
  console.log(JSON.stringify({ states: [...states], screenshots: evidence.screenshots, attachment: evidence.attachment }));
} catch (error) {
  evidence.failure = error.message;
  await page.screenshot({ path: `${root}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await Promise.allSettled(reads);
  await fs.writeFile(`${root}/browser-evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
