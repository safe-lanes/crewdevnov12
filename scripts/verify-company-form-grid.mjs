// Main preview: read-only SQL and GETs only. No grants or fixtures are saved.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
const out = ".local/verification/deployment-block-grid/main-preview";
await fs.mkdir(out, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  options: "-c default_transaction_read_only=on" });
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted
  JOIN adm_resource_action_grants g ON g.role_id=r.ruid
  WHERE g.resource='access_control' AND g.action='manage' AND g.allowed
    AND r.parent_owned AND lower(u.user_type)='office' ORDER BY u.id LIMIT 1`)).rows[0];
if (!actor) throw Error("Existing authorised office development persona unavailable.");
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 1100 } });
await context.addInitScript(({ actor, token }) => {
  const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
    role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
  for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, { actor, token });
const report = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  personaRole: actor.role, errors: [], blockedWrites: [], screenshots: [], summary: "",
  evidence: "Real main-preview GETs, existing development persona, all API writes blocked." };
await context.route("**/api/**", async route => {
  if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
    report.blockedWrites.push(new URL(route.request().url()).pathname);
    return route.abort("blockedbyclient");
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
async function capture(name) {
  const path = `${out}/${name}.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 85, animations: "disabled" });
  report.screenshots.push(path);
}
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
  const grid = page.getByTestId("access-control-permissions");
  const trigger = page.getByTestId("company-form-permissions-trigger");
  const row = page.getByTestId("company-forms-permissions");
  await expect(trigger).toBeVisible();
  await expect(grid.getByTestId("company-forms-permissions")).toHaveCount(1);
  await expect(grid.getByTestId("training-compliance-permissions")).toHaveCount(1);
  await expect(page.getByTestId("save-company-form-permissions")).toHaveCount(0);
  await expect(page.getByTestId("save-training-compliance-permission")).toHaveCount(0);
  await expect(page.getByTestId("button-save-access-control")).toBeDisabled();
  report.summary = await trigger.innerText();
  const selectedRole = await page.locator('[data-testid^="role-item-"][class*="text-white"]').innerText();
  report.selectedRole = selectedRole;
  for (const [name, width, height] of [["desktop", 1500, 1100], ["narrow", 402, 874]]) {
    await page.setViewportSize({ width, height });
    if (await trigger.getAttribute("aria-expanded") === "true") await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.scrollIntoViewIfNeeded();
    await capture(`collapsed-${name}`);
    await trigger.click();
    const dropdown = page.getByTestId("company-form-grant-action");
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole("checkbox")).toHaveCount(7);
    const bounds = await dropdown.boundingBox();
    if (bounds.x < 0 || bounds.x + bounds.width > width) throw Error("Dropdown escapes viewport.");
    await capture(`dropdown-${name}`);
    const help = page.getByRole("button", { name: "Help: Witness", exact: true });
    const before = await page.getByTestId("company-form-grant-witness").getAttribute("data-state");
    if (name === "desktop") {
      await help.hover();
      await expect(page.getByRole("tooltip")).toContainText("recorded as the witness");
    } else {
      await help.click();
      await expect(page.getByText("Records a seafarer’s signature on their behalf, with the acting user’s own identity recorded as the witness.", { exact: true })).toBeVisible();
    }
    await capture(`help-${name}`);
    await expect(page.getByTestId("company-form-grant-witness")).toHaveAttribute("data-state", before);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0, { steps: 8 });
    if (await trigger.getAttribute("aria-expanded") === "true") await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const training = page.getByTestId("training-compliance-permission-checkbox");
    const trainingBefore = await training.getAttribute("data-state");
    await training.scrollIntoViewIfNeeded();
    await capture(`both-grid-rows-${name}`);
    const trainingHelp = page.getByRole("button", { name: "Help: Override deployment block", exact: true });
    if (name === "desktop") {
      await trainingHelp.hover();
      await expect(page.getByRole("tooltip")).toContainText("Lets this role approve a deployment that training rules would otherwise block");
    } else {
      await trainingHelp.click();
      await expect(page.getByRole("dialog")).toContainText("Lets this role approve a deployment that training rules would otherwise block");
    }
    await capture(`override-help-${name}`);
    await expect(training).toHaveAttribute("data-state", trainingBefore);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await expect(page.getByTestId("button-save-access-control")).toBeDisabled();
  }
  await page.setViewportSize({ width: 1500, height: 1100 });
  const policy = page.getByTestId("training-compliance-policy");
  await policy.scrollIntoViewIfNeeded();
  await expect(policy.getByRole("heading", { name: "Blocking Seafarer Deployment Policy" })).toBeVisible();
  await capture("renamed-policy-desktop");
  expect(await row.count()).toBe(1);
  if (report.errors.length || report.blockedWrites.length) throw Error(JSON.stringify(report));
} finally {
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
console.log(JSON.stringify(report, null, 2));
