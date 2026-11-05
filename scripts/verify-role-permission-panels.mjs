// Read-only main-preview evidence. Reuses an existing authorised office persona.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const output = ".local/verification/role-permission-panels";
await fs.mkdir(output, { recursive: true });
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
  personaRole: actor.role, errors: [], blockedWrites: [], screenshots: [],
  evidence: "Real main-preview GETs, existing development persona, all API writes blocked; no settings saved." };
await context.route("**/api/**", async route => {
  if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
    report.blockedWrites.push(new URL(route.request().url()).pathname);
    return route.abort("blockedbyclient");
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
async function capture(name, locator) {
  const path = `${output}/${name}.jpg`;
  const options = { path, type: "jpeg", quality: 85, animations: "disabled" };
  if (locator) await locator.screenshot(options);
  else await page.screenshot(options);
  report.screenshots.push(path);
}
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
  const grid = page.getByTestId("access-control-permissions");
  const forms = page.getByTestId("company-forms-permissions");
  const training = page.getByTestId("training-compliance-role-permission");
  await expect(forms).toBeVisible();
  await expect(forms.getByTestId("save-company-form-permissions")).toBeDisabled();
  await expect(training.getByTestId("save-training-compliance-permission")).toBeDisabled();
  await expect(grid.getByTestId("company-forms-permissions")).toHaveCount(0);
  await expect(grid.getByTestId("training-compliance-role-permission")).toHaveCount(0);
  report.order = await page.evaluate(() => [
    "access-control-permissions", "company-forms-permissions", "training-compliance-role-permission",
    "training-compliance-policy", "management-grants-panel",
  ].map(id => ({ id, top: document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect().top })));
  if (report.order.some((x, i, all) => i && x.top <= all[i - 1].top))
    throw Error("Permission panel order incorrect.");
  for (const [name, width, height] of [["desktop", 1500, 1100], ["narrow", 402, 874]]) {
    await page.setViewportSize({ width, height });
    await grid.scrollIntoViewIfNeeded();
    await capture(`grid-${name}`);
    const overview = `${output}/overview-${name}.jpg`;
    await page.screenshot({ path: overview, type: "jpeg", quality: 85, animations: "disabled", fullPage: true });
    report.screenshots.push(overview);
    await forms.scrollIntoViewIfNeeded();
    await capture(`panels-${name}`);
    await capture(`company-forms-${name}`, forms);
    await capture(`training-permission-${name}`, training);
    // Separate help buttons must not toggle the adjacent permission checkbox.
    for (const label of ["Witness", "Sign as Company Representative", "Void", "Void completed"]) {
      const button = forms.getByRole("button", { name: `Help: ${label}`, exact: true });
      const checkbox = forms.getByRole("checkbox", { name: label, exact: true });
      const before = await checkbox.getAttribute("data-state");
      await button.scrollIntoViewIfNeeded();
      if (name === "desktop") {
        await button.hover();
        await expect(page.getByRole("tooltip")).toBeVisible();
      } else {
        await button.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
      await capture(`help-${label.toLowerCase().replaceAll(" ", "-")}-${name}`);
      await expect(checkbox).toHaveAttribute("data-state", before);
      await page.keyboard.press("Escape");
      await page.mouse.move(0, 0, { steps: 8 });
    }
  }
  if (report.errors.length || report.blockedWrites.length) throw Error(JSON.stringify(report));
} finally {
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
console.log(JSON.stringify(report, null, 2));
