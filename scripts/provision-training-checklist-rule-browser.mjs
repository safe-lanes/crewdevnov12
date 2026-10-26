// One-time authoring on an existing registered fixture form. Reruns reuse it.
import "./verification-guard.mjs";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const existing = (await db.query(`SELECT v.id FROM adm_form_versions_v2 v
  JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid
  WHERE v.form_id=5297 AND v.stage_key='before_joining' AND p.obligation='mandatory'`)).rows[0];
if (existing) { console.log(JSON.stringify({ reused: existing.id })); await db.end(); process.exit(0); }
const enc = x => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1560, height: 1120 }, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
await context.addInitScript(token => {
  const p = { personaKey: "crewing-executive", masterUserId: 24, userId: "24", role: "Admin",
    roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6", userType: "Office", myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(p)); localStorage.setItem("devPersona", JSON.stringify(p));
  localStorage.setItem("devAuthToken", token);
}, token);
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("requestfailed", request => errors.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
await context.route("**/src/**", async route => {
  const response = await route.fetch({ maxRetries: 2, timeout: 60000 });
  await route.fulfill({ response });
});
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "networkidle" });
  if (!await page.getByTestId("tab-company-forms").isVisible())
    await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("tab-company-forms").click();
  const row = page.getByTestId("company-form-row-5297");
  await row.getByRole("button", { name: "Configure SAMPLE PDF layout review — company-name", exact: true }).click();
  const editDraft = page.getByRole("button", { name: "Edit as new draft", exact: true });
  if (await editDraft.isVisible()) await editDraft.click();
  await page.getByTestId("select-company-form-stage").click();
  await page.getByRole("option", { name: "Before joining", exact: true }).click();
  await page.getByTestId("button-save-form-structure").click();
  await expect(page.getByTestId("button-save-form-structure")).toBeEnabled();
  await page.screenshot({ path: "generated-artifacts/training-slice5/fixture-draft-authoring.png", animations: "disabled" });
  console.log(JSON.stringify((await db.query("SELECT id,fv_uuid,stage_key,status FROM adm_form_versions_v2 WHERE form_id=5297 ORDER BY id DESC LIMIT 1")).rows[0]));
} catch (error) {
  console.error(JSON.stringify({ errors }));
  await page.screenshot({ path: "generated-artifacts/training-slice5/fixture-authoring-failure.png" });
  throw error;
} finally { await browser.close(); await db.end(); }
