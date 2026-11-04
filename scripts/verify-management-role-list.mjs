// UI-only: existing office persona, read-only SQL, no saved settings or grants.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const output = ".local/verification/management-role-list";
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
let fallback = false;
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  personaRole: actor.role, errors: [], blockedWrites: [], screenshots: [],
  normalState: "Real main-preview GET responses; no changes saved.",
  fallbackState: "Browser-only GET response fixture: state mode=name_bootstrap, explicitManagers=[], eligibleManagerCount=0, categoryReady=false; role management GETs return allowed=false. No server data or permission changes.",
};
await context.route("**/api/**", async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    report.blockedWrites.push(path);
    return route.abort("blockedbyclient");
  }
  if (fallback && path === "/api/v2/admin/access-control/state") {
    const response = await route.fetch();
    const real = await response.json();
    if (!response.ok()) throw Error("Authorised display-state read failed.");
    return route.fulfill({ response, json: { ...real, allowed: true, mode: "name_bootstrap",
      eligibleManagerCount: 0, categoryReady: false, recoveryRoute: "interim_names", explicitManagers: [] } });
  }
  if (fallback && /^\/api\/v2\/admin\/access-control\/roles\/[^/]+\/management$/.test(path))
    return route.fulfill({ json: { allowed: false } });
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
async function openPanel() {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
  const panel = page.getByTestId("management-grants-panel");
  await expect(panel).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  return panel;
}
async function capture(name, locator) {
  const path = `${output}/${name}.jpg`;
  const options = { path, type: "jpeg", quality: 85, animations: "disabled" };
  if (locator) await locator.screenshot(options);
  else await page.screenshot(options);
  report.screenshots.push(path);
}
async function ownRemoval(name) {
  await page.getByLabel("Choose role for management grant").selectOption(actor.ruid);
  const checkbox = page.getByRole("checkbox", { name: "Management access granted" });
  await expect(checkbox).toHaveAttribute("data-state", "checked");
  await checkbox.click();
  await page.getByTestId("button-review-management-grant").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByTestId("management-own-role-warning")).toContainText("lock you out");
  await expect(dialog.getByTestId("button-confirm-management-change")).toBeEnabled();
  await capture(name);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await checkbox.click();
  await expect(page.getByTestId("button-review-management-grant")).toBeDisabled();
}
try {
  let panel = await openPanel();
  const list = page.getByRole("list", { name: "Roles with explicit management access" });
  await expect(list.getByText(actor.role, { exact: true })).toBeVisible();
  await expect(list.getByText("Your role", { exact: true })).toBeVisible();
  await expect(page.getByTestId("management-fallback-warning")).toHaveCount(0);
  await capture("normal-desktop", panel);
  await ownRemoval("own-removal-desktop");

  await page.setViewportSize({ width: 402, height: 874 });
  await panel.scrollIntoViewIfNeeded();
  await capture("normal-narrow", panel);
  await ownRemoval("own-removal-narrow");

  fallback = true;
  await page.setViewportSize({ width: 1500, height: 1100 });
  panel = await openPanel();
  await expect(page.getByTestId("management-fallback-warning")).toContainText("Admin, Super Admin or Sail Admin");
  await expect(page.getByRole("list", { name: "Roles with explicit management access" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Management access granted" })).toHaveAttribute("data-state", "unchecked");
  await capture("fallback-desktop", panel);
  await page.setViewportSize({ width: 402, height: 874 });
  await panel.scrollIntoViewIfNeeded();
  await capture("fallback-narrow", panel);
  for (const oldHeading of ["How access is assigned", "Parent SAIL Admin category"])
    await expect(panel.getByText(oldHeading, { exact: true })).toHaveCount(0);
  if (report.errors.length || report.blockedWrites.length) throw Error(JSON.stringify(report));
} finally {
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
console.log(JSON.stringify(report, null, 2));
