// UI-only main-preview checks: real GET responses, all API mutations refused.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const output = ".local/verification/access-control-panels";
await fs.mkdir(output, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  options: "-c default_transaction_read_only=on" });
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted
  JOIN adm_resource_action_grants g ON g.role_id=r.ruid
  WHERE g.resource='access_control' AND g.action='manage' AND g.allowed
    AND r.parent_owned AND lower(u.user_type)='office' ORDER BY u.id LIMIT 1`)).rows[0];
const grantRole = (await db.query(`SELECT ruid,assigned_role FROM adm_rolemaster_ac
  WHERE assigned_role='PDF Layout Review Vessel' AND is_active AND NOT is_deleted`)).rows[0];
const revokeRole = (await db.query(`SELECT r.ruid,r.assigned_role FROM adm_rolemaster_ac r
  JOIN adm_resource_action_grants g ON g.role_id=r.ruid WHERE r.is_active AND NOT r.is_deleted
  AND g.resource='access_control' AND g.action='manage' AND g.allowed
  ORDER BY r.ruid LIMIT 1`)).rows[0];
if (!actor || !grantRole || !revokeRole) throw Error("Existing read-only verification roles/persona unavailable.");
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
  evidence: "Existing office development persona; real, unmodified GET responses; grant/revoke dialogs cancelled",
  personaRole: actor.role,
  errors: [], blockedWrites: [], screenshots: [], checks: [] };
await context.route("**/api/**", route => {
  if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
  report.blockedWrites.push(new URL(route.request().url()).pathname);
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
async function capture(name, locator) {
  const path = `${output}/${name}.jpg`;
  if (locator) await locator.screenshot({ path, type: "jpeg", quality: 85, animations: "disabled" });
  else await page.screenshot({ path, type: "jpeg", quality: 85, animations: "disabled" });
  report.screenshots.push(path);
}
async function choose(role, checked) {
  await page.getByLabel("Choose role for management grant").selectOption(role.ruid);
  await expect(page.getByRole("checkbox", { name: "Management access granted" }))
    .toHaveAttribute("data-state", checked ? "checked" : "unchecked");
  await expect(page.getByTestId("button-review-management-grant")).toBeDisabled();
}
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
  const grid = page.getByTestId("access-control-permissions");
  const policy = page.getByTestId("training-compliance-policy");
  const management = page.getByTestId("management-grants-panel");
  await expect(policy).toBeVisible();
  await expect(management).toBeVisible();
  const positions = await page.evaluate(() => {
    const box = id => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
    const grid = box("access-control-permissions"), policy = box("training-compliance-policy"),
      management = box("management-grants-panel");
    return { gridBottom: grid.bottom, policyTop: policy.top, policyBottom: policy.bottom, managementTop: management.top };
  });
  if (positions.gridBottom > positions.policyTop || positions.policyBottom > positions.managementTop)
    throw Error("Configure-once panels do not follow the permission grid.");
  report.checks.push({ order: positions });
  await capture("desktop-position");
  await policy.scrollIntoViewIfNeeded();
  await capture("desktop-training-policy", policy);
  await management.scrollIntoViewIfNeeded();
  await capture("desktop-management-grants", management);

  // Unsaved controls must not claim that the live policy already changed.
  const savedEffect = await page.getByTestId("training-expiring-current-effect").innerText();
  await page.getByTestId("training-block-expiring").click();
  await expect(page.getByTestId("training-expiring-unsaved")).toBeVisible();
  expect(await page.getByTestId("training-expiring-current-effect").innerText()).toBe(savedEffect);
  await page.getByTestId("training-block-expiring").click();
  await expect(page.getByTestId("save-training-compliance-policy")).toBeDisabled();

  await choose(grantRole, false);
  await page.getByRole("checkbox", { name: "Management access granted" }).click();
  await page.getByTestId("button-review-management-grant").click();
  let dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(grantRole.assigned_role);
  await capture("grant-confirmation");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await choose(revokeRole, true);
  await page.getByRole("checkbox", { name: "Management access granted" }).click();
  await page.getByTestId("button-review-management-grant").click();
  dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(revokeRole.assigned_role);
  await capture("remove-confirmation");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  report.checks.push({ grantDialogRole: grantRole.assigned_role, removalDialogRole: revokeRole.assigned_role,
    cancelledWithoutSaving: true });

  await page.setViewportSize({ width: 402, height: 874 });
  await policy.scrollIntoViewIfNeeded();
  await capture("narrow-training-policy", policy);
  await management.scrollIntoViewIfNeeded();
  await capture("narrow-management-grants", management);
  for (const locator of [policy, management]) {
    const bounds = await locator.boundingBox();
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > 403) throw Error("A settings panel overflows the narrow viewport.");
  }
  await choose(grantRole, false);
  await page.getByRole("checkbox", { name: "Management access granted" }).click();
  await page.getByTestId("button-review-management-grant").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await capture("narrow-confirmation");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  if (report.blockedWrites.length || report.errors.length) throw Error("Browser errors or attempted development writes detected.");
  report.checks.push({ narrowViewport: "402x874", panelOverflow: false });
} finally {
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
console.log(JSON.stringify(report, null, 2));
