// @vitest-environment node
// Real UI and backend save/rollback evidence, entirely in the registered test DB.
import { afterAll, beforeAll, expect, it } from "vitest";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";
import { emptyCompanyFormGrants } from "../../shared/v2/admin/companyFormPermissions";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const role = randomUUID(), menu = randomUUID(), managementTarget = randomUUID();
const roleName = `Atomic save browser ${role.slice(0, 8)}`;
const targetName = `Management popup target ${managementTarget.slice(0, 8)}`;
const out = ".local/verification/deployment-block-grid/test-database";
let userId: number, targetUserId: number, browser: Browser | undefined;
beforeAll(async () => {
  if (process.env.TEST_DATABASE_VERIFIED !== "true") throw Error("Registered test database required.");
  await fs.mkdir(out, { recursive: true });
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned,is_active,is_deleted,sort_order)
    VALUES ($1,$2,'Office',true,true,false,-100000)`, [role, roleName]);
  userId = (await pool.query(`INSERT INTO master_users(id,user_uuid,role,user_type,firstname,lastname)
    SELECT coalesce(max(id),0)+10000,$1,$2,'Office','Atomic','Verifier' FROM master_users RETURNING id`,
    [randomUUID(), roleName])).rows[0].id;
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned,is_active,is_deleted,sort_order)
    VALUES ($1,$2,'Office',true,true,false,-99999)`, [managementTarget, targetName]);
  targetUserId = (await pool.query(`INSERT INTO master_users(id,user_uuid,role,user_type,firstname,lastname)
    SELECT coalesce(max(id),0)+1,$1,$2,'Office','Popup','Target' FROM master_users RETURNING id`,
    [randomUUID(), targetName])).rows[0].id;
  await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
    VALUES ($1,'access_control','manage',false)`, [managementTarget]);
  await pool.query(`INSERT INTO adm_menumaster_ac(muid,name,route,is_active,is_deleted,sort_order)
    VALUES ($1,$2,$3,true,false,-100000)`, [menu, `Atomic browser menu ${menu}`, `/atomic-browser-${menu}`]);
  await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
    VALUES ($1,'access_control','manage',true)`, [role]);
  await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
    VALUES ($1,'training_compliance','override',false)`, [role]);
  for (const [action] of Object.entries(emptyCompanyFormGrants()))
    await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES ($1,'company_forms',$2,$3)`, [role, action, action === "view"]);
  browser = await chromium.launch({
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
});
afterAll(async () => {
  await browser?.close();
  await pool.query(`DROP TRIGGER IF EXISTS company_grid_browser_failure ON adm_resource_action_grants;
    DROP FUNCTION IF EXISTS company_grid_browser_failure()`);
  // Audit history is intentionally append-only even in the test database.
  // Retain its frozen identities while removing the synthetic operational rows.
  await pool.query("DELETE FROM adm_roleaccess_ac WHERE role_id=$1 OR menu_id=$2", [role, menu]);
  await pool.query("DELETE FROM adm_resource_action_grants WHERE role_id=$1", [role]);
  await pool.query("DELETE FROM master_users WHERE id=$1", [userId ?? -1]);
  await pool.query("DELETE FROM adm_resource_action_grants WHERE role_id=$1", [managementTarget]);
  await pool.query("DELETE FROM master_users WHERE id=$1", [targetUserId ?? -1]);
  await pool.query("DELETE FROM adm_rolemaster_ac WHERE ruid=$1", [managementTarget]);
  await pool.query("DELETE FROM adm_rolemaster_ac WHERE ruid=$1", [role]);
  await pool.query("DELETE FROM adm_menumaster_ac WHERE muid=$1", [menu]);
  expect((await pool.query("SELECT * FROM adm_rolemaster_ac WHERE ruid=$1", [role])).rows).toHaveLength(0);
  await pool.end();
});
async function snapshot() {
  return {
    menus: (await pool.query("SELECT * FROM adm_roleaccess_ac WHERE role_id=$1 ORDER BY menu_id", [role])).rows,
    forms: (await pool.query("SELECT * FROM adm_resource_action_grants WHERE role_id=$1 ORDER BY resource,action", [role])).rows,
    audit: (await pool.query("SELECT * FROM adm_access_control_audit WHERE role_id=$1 ORDER BY id", [role])).rows,
  };
}
it("saves all three groups through the screen, then proves a real third-writer failure rolls everything back", async () => {
  const context = await browser!.newContext({ viewport: { width: 1500, height: 1100 }, ignoreHTTPSErrors: true });
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: userId, roleId: role, userType: "Office", domain: "test" })}.devsig`;
  await context.addInitScript(({ role, roleName, userId, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: userId, userId: String(userId),
      roleId: role, role: roleName, userType: "Office", myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { role, roleName, userId, token });
  const writes: string[] = [];
  // Main-preview UI assets, but EVERY API request goes to the guarded test backend.
  const networkTimings: Array<{ path: string; milliseconds: number; status: number }> = [];
  await context.route("**/api/**", async route => {
    const request = route.request(), source = new URL(request.url());
    // Vite source modules may contain an /api/ directory. They are not API
    // requests: leave assets on the original frontend, not the test backend.
    if (!source.pathname.startsWith("/api/")) return route.continue();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(source.pathname);
    const started = performance.now();
    const response = await route.fetch({ url: `${process.env.TEST_API_URL}${source.pathname}${source.search}` });
    networkTimings.push({ path: source.pathname + source.search, milliseconds: performance.now() - started, status: response.status() });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  try {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByText("Access Control", { exact: true }).first().click({ timeout: 30000 });
    await page.getByTestId(`role-item-${role}`).click();
    const trigger = page.getByTestId("company-form-permissions-trigger");
    await browserExpect(trigger).toHaveText("View");
    const row = page.getByTestId("company-forms-permissions");
    const save = page.getByTestId("button-save-access-control");
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/collapsed-desktop.jpg`, animations: "disabled" });
    const training = page.getByTestId("training-compliance-permission-checkbox");
    await browserExpect(page.getByTestId("access-control-permissions").getByTestId("training-compliance-permissions")).toHaveCount(1);
    await browserExpect(page.getByTestId("save-training-compliance-permission")).toHaveCount(0);
    const trainingHelp = page.getByRole("button", { name: "Help: Override deployment block", exact: true });
    await trainingHelp.hover();
    await browserExpect(page.getByRole("tooltip")).toContainText("Lets this role approve a deployment that training rules would otherwise block");
    await page.screenshot({ path: `${out}/override-help-desktop.jpg`, animations: "disabled" });
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
    await training.click();
    await page.getByTestId(`checkbox-${menu}-canview`).click();
    await trigger.click();
    await browserExpect(page.getByTestId("company-form-grant-action")).toBeVisible();
    await page.getByRole("checkbox", { name: "Fill in", exact: true }).click();
    await page.screenshot({ path: `${out}/dropdown-desktop.jpg`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await save.click();
    await browserExpect(save).toBeDisabled();
    await browserExpect(trigger).toHaveText("View, Fill in");
    await browserExpect(page.getByText("Changes Saved", { exact: true })).toBeVisible();
    const saved = await snapshot();
    expect(saved.menus.find(m => m.menu_id === menu).canview).toBe(true);
    expect(saved.forms.find(g => g.resource === "company_forms" && g.action === "fill_in").allowed).toBe(true);
    expect(saved.forms.find(g => g.resource === "training_compliance" && g.action === "override").allowed).toBe(true);
    expect(saved.audit.filter(a => a.resource === "company_forms")).toHaveLength(1);
    expect(saved.audit.find(a => a.resource === "company_forms")).toMatchObject({
      actor_display_name: "Atomic Verifier", affected_role_name: roleName, before_value: false, after_value: true,
    });
    expect(saved.audit.find(a => a.resource === "training_compliance")).toMatchObject({
      permission_display_label: "Override deployment block",
      actor_display_name: "Atomic Verifier", affected_role_name: roleName, before_value: false, after_value: true,
    });
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/saved-desktop.jpg`, animations: "disabled" });
    const policyOut = ".local/verification/deployment-policy-dialog/test-database";
    await fs.mkdir(policyOut, { recursive: true });
    const policyButton = page.getByTestId("button-training-compliance-policy");
    await policyButton.scrollIntoViewIfNeeded();
    await browserExpect(page.getByTestId("training-compliance-policy")).toHaveCount(0);
    await page.screenshot({ path: `${policyOut}/desktop-body.jpg`, animations: "disabled" });
    await policyButton.click();
    const policy = page.getByTestId("training-compliance-policy");
    await browserExpect(policy.getByRole("heading", { name: "Blocking Seafarer Deployment Policy" })).toBeVisible();
    await page.screenshot({ path: `${out}/policy-desktop.jpg`, animations: "disabled" });
    await page.screenshot({ path: `${policyOut}/desktop-popup.jpg`, animations: "disabled" });
    const originalPolicy = (await pool.query("SELECT * FROM adm_training_compliance_settings WHERE singleton")).rows[0];
    const beforePolicyAudit = Number((await pool.query("SELECT coalesce(max(id),0) AS id FROM adm_access_control_audit")).rows[0].id);
    await policy.getByTestId("training-block-expiring").click();
    await policy.getByTestId("training-block-missing-expiry").click();
    await policy.getByTestId("save-training-compliance-policy").click();
    await browserExpect(policy.getByTestId("save-training-compliance-policy")).toBeDisabled();
    await browserExpect(policy.getByTestId("training-expiring-current-effect")).toHaveText(
      `Current saved effect: ${originalPolicy.block_expiring_during_contract ? "Warning only" : "Blocking"}`);
    await browserExpect(policy.getByTestId("training-missing-expiry-current-effect")).toHaveText(
      `Current saved effect: ${originalPolicy.block_missing_expiry ? "Warning only" : "Blocking"}`);
    const policyAudit = (await pool.query(`SELECT * FROM adm_access_control_audit
      WHERE id>$1 AND event='training_setting_changed' ORDER BY id`, [beforePolicyAudit])).rows;
    expect(policyAudit).toHaveLength(2);
    for (const entry of policyAudit) {
      expect(entry.actor).toMatchObject({ masterUserId: userId });
      expect(entry.actor_display_name).toBe("Atomic Verifier");
      expect(entry.permission_display_label).toBeTruthy();
      expect(entry.before_value).not.toEqual(entry.after_value);
      expect(entry.recorded_at).toBeTruthy();
    }
    await fs.writeFile(`${policyOut}/policy-audit.json`, JSON.stringify(policyAudit, null, 2));
    await page.screenshot({ path: `${policyOut}/desktop-saved.jpg`, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${policyOut}/narrow-saved-popup.jpg`, animations: "disabled" });
    const dialogBox = await page.getByTestId("training-compliance-policy-dialog").boundingBox();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);
    // Restore isolated settings through the same screen, not direct SQL.
    await policy.getByTestId("training-block-expiring").click();
    await policy.getByTestId("training-block-missing-expiry").click();
    await policy.getByTestId("save-training-compliance-policy").click();
    await browserExpect(policy.getByTestId("save-training-compliance-policy")).toBeDisabled();
    await browserExpect(policy.getByTestId("training-expiring-current-effect")).toHaveText(
      `Current saved effect: ${originalPolicy.block_expiring_during_contract ? "Blocking" : "Warning only"}`);
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    const topActions = page.getByTestId("access-control-top-actions");
    await topActions.scrollIntoViewIfNeeded();
    await browserExpect(topActions.getByRole("button")).toHaveCount(4);
    const actionBoxes = await topActions.getByRole("button").evaluateAll(buttons =>
      buttons.map(button => { const r = button.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y }; }));
    expect(actionBoxes).toHaveLength(4);
    for (const box of actionBoxes) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(390); }
    expect(new Set(actionBoxes.map(box => box.y)).size).toBeGreaterThan(1);
    await browserExpect(page.getByTestId("training-compliance-policy")).toHaveCount(0);
    await page.screenshot({ path: `${policyOut}/narrow-body.jpg`, animations: "disabled" });
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.getByRole("button", { name: "Access audit history", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search history" }).fill(roleName);
    await browserExpect(page.getByTestId("audit-sentence").filter({ hasText: "Override deployment block" })).toContainText("Atomic Verifier granted");
    await page.screenshot({ path: `${out}/audit-new-wording.jpg`, animations: "disabled" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const downloaded = await downloadPromise;
    const csv = await fs.readFile((await downloaded.path())!, "utf8");
    expect(csv).toContain("Override deployment block");
    expect(csv).not.toContain("Override training compliance");
    await fs.writeFile(`${out}/audit.csv`, csv);
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await training.scrollIntoViewIfNeeded();
    await pool.query(`CREATE FUNCTION company_grid_browser_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.role_id='${role}' AND NEW.resource='training_compliance' THEN
        RAISE EXCEPTION 'Deliberate isolated browser rollback test'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER company_grid_browser_failure BEFORE UPDATE ON adm_resource_action_grants
      FOR EACH ROW EXECUTE FUNCTION company_grid_browser_failure()`);
    await page.getByTestId(`checkbox-${menu}-canview`).click();
    await training.click();
    await trigger.click();
    await page.getByRole("checkbox", { name: "Fill in", exact: true }).click();
    await page.keyboard.press("Escape");
    await save.click();
    await browserExpect(page.getByText("None of the permission changes were saved. Please retry.", { exact: true })).toBeVisible();
    await browserExpect(save).toBeEnabled();
    expect(await snapshot()).toEqual(saved);
    expect(networkTimings.every(entry => entry.path.startsWith("/api/"))).toBe(true);
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/failed-desktop.jpg`, animations: "disabled" });
    await page.setViewportSize({ width: 402, height: 874 });
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/failed-narrow.jpg`, animations: "disabled" });
    await trigger.click();
    await page.screenshot({ path: `${out}/dropdown-narrow.jpg`, animations: "disabled" });
    expect(writes).toEqual([`/api/v2/admin/access-control/roles/${role}/combined-permissions`,
      "/api/v2/admin/training-compliance/settings",
      "/api/v2/admin/training-compliance/settings",
      `/api/v2/admin/access-control/roles/${role}/combined-permissions`]);
    expect(await row.count()).toBe(1);
    await fs.writeFile(`${out}/report.json`, JSON.stringify({
      database: "Registered isolated test database; no development API calls.",
      head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      saved: true, failureInjected: "PostgreSQL trigger rejects the deployment override writer after menu and Company Forms writes",
      afterFailureExactlyMatchesSuccessfulSnapshot: true, auditFrozenNamesVerified: true, networkTimings,
      writes, screenshots: ["collapsed-desktop", "override-help-desktop", "dropdown-desktop", "saved-desktop", "policy-desktop", "audit-new-wording", "failed-desktop", "failed-narrow", "dropdown-narrow"],
    }, null, 2));
  } catch (error) {
    // Retain evidence for cold/proxied SPA startup failures, not just saves.
    await page.screenshot({ path: `${out}/browser-failure.jpg`, animations: "disabled" }).catch(() => {});
    await fs.writeFile(`${out}/browser-failure.json`, JSON.stringify({
      message: String(error), pageErrors, networkTimings,
      visibleText: await page.locator("body").innerText().catch(() => "Body unavailable"),
    }, null, 2));
    throw error;
  } finally { await context.close(); }
}, 90000);

it("keeps management roles independent, confirms grants and own-role removal, and retains frozen audit capture", async () => {
  const dir = ".local/verification/management-grants-dialog/test-database";
  await fs.mkdir(dir, { recursive: true });
  const context = await browser!.newContext({ viewport: { width: 1500, height: 1100 }, ignoreHTTPSErrors: true });
  const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: userId, roleId: role, userType: "Office", domain: "test" })}.devsig`;
  await context.addInitScript(({ token, role, roleName, userId }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: userId, userId: String(userId),
      roleId: role, role: roleName, userType: "Office", myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { token, role, roleName, userId });
  const writes: string[] = [];
  await context.route("**/api/**", async route => {
    const request = route.request(), source = new URL(request.url());
    if (!source.pathname.startsWith("/api/")) return route.continue();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(source.pathname);
    const response = await route.fetch({ url: `${process.env.TEST_API_URL}${source.pathname}${source.search}` });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  const screenshot = async (name: string) => page.screenshot({ path: `${dir}/${name}.jpg`, animations: "disabled" });
  try {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByText("Access Control", { exact: true }).first().click({ timeout: 30000 });
    await page.getByTestId(`role-item-${managementTarget}`).click();
    await browserExpect(page.getByTestId("company-form-permissions-trigger")).toBeVisible();
    await page.getByTestId(`checkbox-${menu}-canview`).click();
    await browserExpect(page.getByTestId("button-save-access-control")).toBeEnabled();
    await page.getByTestId("button-management-grants").click();
    const dialog = page.getByTestId("management-grants-dialog");
    await browserExpect(dialog.getByTestId("management-target-role")).toContainText(targetName);
    const selector = dialog.getByLabel("Choose role for management grant");
    await browserExpect(dialog.getByRole("checkbox", { name: "Management access granted" })).toBeEnabled();
    await selector.selectOption(role);
    await browserExpect(dialog.getByRole("checkbox", { name: "Management access granted" })).toBeChecked();
    await browserExpect(dialog.getByTestId("management-target-role")).toContainText(roleName);
    await browserExpect(dialog.getByTestId("management-fallback-warning")).toHaveCount(0);
    await browserExpect(dialog.getByText("Your role", { exact: true })).toBeVisible();
    await screenshot("normal-desktop");
    await dialog.getByRole("checkbox", { name: "Management access granted" }).click();
    await dialog.getByTestId("button-review-management-grant").click();
    const confirmation = page.getByTestId("management-grant-confirmation");
    await browserExpect(confirmation.getByTestId("management-own-role-warning")).toBeVisible();
    await screenshot("own-removal-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot("own-removal-narrow");
    await confirmation.getByTestId("button-cancel-management-confirmation").click();
    await browserExpect(page.getByRole("alertdialog")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await browserExpect(page.getByTestId("management-grants-panel")).toHaveCount(0);
    await browserExpect(page.getByTestId(`role-item-${managementTarget}`)).toHaveClass(/bg-\[#52baf3\]/);
    await browserExpect(page.getByTestId(`checkbox-${menu}-canview`)).toBeChecked();
    await browserExpect(page.getByTestId("button-save-access-control")).toBeEnabled();
    // Opening again deliberately resets to the grid's target, not the last popup role.
    await page.getByTestId("button-management-grants").click();
    await browserExpect(selector).toHaveValue(managementTarget);
    await browserExpect(dialog.getByRole("checkbox", { name: "Management access granted" })).not.toBeChecked();
    await browserExpect(dialog.getByRole("checkbox", { name: "Management access granted" })).toBeEnabled();
    await screenshot("normal-narrow");
    await dialog.getByRole("checkbox", { name: "Management access granted" }).click();
    await dialog.getByTestId("button-review-management-grant").click();
    await browserExpect(confirmation).toContainText(targetName);
    await browserExpect(confirmation.getByTestId("management-own-role-warning")).toHaveCount(0);
    await screenshot("grant-confirmation-narrow");
    await page.setViewportSize({ width: 1500, height: 1100 });
    await screenshot("grant-confirmation-desktop");
    await confirmation.getByTestId("button-confirm-management-change").click();
    await browserExpect(page.getByRole("alertdialog")).toHaveCount(0);
    await browserExpect(dialog.getByTestId("button-review-management-grant")).toBeDisabled();
    await browserExpect(dialog.getByRole("list", { name: "Roles with explicit management access" })).toContainText(targetName);
    const audit = (await pool.query(`SELECT * FROM adm_access_control_audit WHERE role_id=$1
      AND resource='access_control' AND action='manage' ORDER BY id`, [managementTarget])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ event: "grant_change", actor_display_name: "Atomic Verifier",
      affected_role_name: targetName, before_value: false, after_value: true });
    expect(audit[0].actor).toMatchObject({ masterUserId: userId });
    expect(audit[0].permission_display_label).toBeTruthy();
    expect(audit[0].recorded_at).toBeTruthy();
    await fs.writeFile(`${dir}/audit.json`, JSON.stringify(audit, null, 2));
    await screenshot("saved-desktop");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId(`role-item-${role}`).click();
    await browserExpect(page.getByTestId("unsaved-role-change-confirmation")).toBeVisible();
    await screenshot("unsaved-grid-confirmation");
    await page.getByTestId("button-cancel-role-change").click();
    await browserExpect(page.getByRole("alertdialog")).toHaveCount(0);
    await browserExpect(page.getByTestId(`checkbox-${menu}-canview`)).toBeChecked();
    expect(writes).toEqual([`/api/v2/admin/access-control/roles/${managementTarget}/management`]);
    await fs.writeFile(`${dir}/report.json`, JSON.stringify({ independentSelection: true, resetsToGridOnOpen: true,
      dirtyGridPreserved: true, confirmationsPreserved: true, frozenAuditVerified: true, writes }, null, 2));
    // Arrange recovery ONLY in the registered isolated test database; restore
    // every affected grant, role flag and category-readiness value afterwards.
    const active = (await pool.query("SELECT ruid FROM adm_rolemaster_ac WHERE is_active AND ruid<>$1", [role])).rows;
    const managers = (await pool.query("SELECT role_id FROM adm_resource_action_grants WHERE resource='access_control' AND action='manage' AND allowed")).rows;
    const readiness = (await pool.query("SELECT category_ready FROM adm_access_control_state WHERE singleton")).rows[0];
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("UPDATE adm_rolemaster_ac SET is_active=false WHERE is_active AND ruid<>$1", [role]);
      await connection.query("UPDATE adm_rolemaster_ac SET assigned_role='Sail Admin' WHERE ruid=$1", [role]);
      await connection.query("UPDATE master_users SET role='Sail Admin' WHERE id=$1", [userId]);
      await connection.query("UPDATE adm_resource_action_grants SET allowed=false WHERE resource='access_control' AND action='manage' AND allowed");
      await connection.query("UPDATE adm_access_control_state SET category_ready=false WHERE singleton");
      await connection.query("COMMIT");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Access Control", { exact: true }).first().click();
      await page.getByTestId("button-management-grants").click();
      await browserExpect(dialog.getByTestId("management-fallback-warning")).toBeVisible();
      await browserExpect(dialog.getByRole("checkbox", { name: "Management access granted" })).toBeEnabled();
      await screenshot("fallback-desktop");
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot("fallback-narrow");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      await connection.query("BEGIN");
      await connection.query("UPDATE adm_rolemaster_ac SET assigned_role=$1 WHERE ruid=$2", [roleName, role]);
      await connection.query("UPDATE master_users SET role=$1 WHERE id=$2", [roleName, userId]);
      await connection.query("UPDATE adm_rolemaster_ac SET is_active=true WHERE ruid=ANY($1::text[])", [active.map(r => r.ruid)]);
      await connection.query("UPDATE adm_resource_action_grants SET allowed=true WHERE resource='access_control' AND action='manage' AND role_id=ANY($1::text[])", [managers.map(r => r.role_id)]);
      await connection.query("UPDATE adm_access_control_state SET category_ready=$1 WHERE singleton", [readiness.category_ready]);
      await connection.query("COMMIT");
      connection.release();
    }
  } finally { await context.close(); }
}, 90000);
