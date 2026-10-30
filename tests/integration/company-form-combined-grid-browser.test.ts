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
const role = randomUUID(), menu = randomUUID();
const roleName = `Atomic save browser ${role.slice(0, 8)}`;
const out = ".local/verification/company-form-grid/test-database";
let userId: number, browser: Browser | undefined;
beforeAll(async () => {
  if (process.env.TEST_DATABASE_VERIFIED !== "true") throw Error("Registered test database required.");
  await fs.mkdir(out, { recursive: true });
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned,is_active,is_deleted,sort_order)
    VALUES ($1,$2,'Office',true,true,false,-100000)`, [role, roleName]);
  userId = (await pool.query(`INSERT INTO master_users(id,user_uuid,role,user_type,firstname,lastname)
    SELECT coalesce(max(id),0)+10000,$1,$2,'Office','Atomic','Verifier' FROM master_users RETURNING id`,
    [randomUUID(), roleName])).rows[0].id;
  await pool.query(`INSERT INTO adm_menumaster_ac(muid,name,route,is_active,is_deleted,sort_order)
    VALUES ($1,$2,$3,true,false,-100000)`, [menu, `Atomic browser menu ${menu}`, `/atomic-browser-${menu}`]);
  await pool.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
    VALUES ($1,'access_control','manage',true)`, [role]);
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
it("saves both groups through the screen, then proves a real second-writer failure rolls everything back", async () => {
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
  await context.route("**/api/**", async route => {
    const request = route.request(), source = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(source.pathname);
    const response = await route.fetch({ url: `${process.env.TEST_API_URL}${source.pathname}${source.search}` });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
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
    expect(saved.audit.filter(a => a.resource === "company_forms")).toHaveLength(1);
    expect(saved.audit.find(a => a.resource === "company_forms")).toMatchObject({
      actor_display_name: "Atomic Verifier", affected_role_name: roleName, before_value: false, after_value: true,
    });
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/saved-desktop.jpg`, animations: "disabled" });
    await pool.query(`CREATE FUNCTION company_grid_browser_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.role_id='${role}' AND NEW.resource='company_forms' THEN
        RAISE EXCEPTION 'Deliberate isolated browser rollback test'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER company_grid_browser_failure BEFORE UPDATE ON adm_resource_action_grants
      FOR EACH ROW EXECUTE FUNCTION company_grid_browser_failure()`);
    await page.getByTestId(`checkbox-${menu}-canview`).click();
    await trigger.click();
    await page.getByRole("checkbox", { name: "Fill in", exact: true }).click();
    await page.keyboard.press("Escape");
    await save.click();
    await browserExpect(page.getByText("Neither group was saved. Please retry.", { exact: true })).toBeVisible();
    await browserExpect(save).toBeEnabled();
    expect(await snapshot()).toEqual(saved);
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/failed-desktop.jpg`, animations: "disabled" });
    await page.setViewportSize({ width: 402, height: 874 });
    await trigger.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/failed-narrow.jpg`, animations: "disabled" });
    await trigger.click();
    await page.screenshot({ path: `${out}/dropdown-narrow.jpg`, animations: "disabled" });
    expect(writes).toEqual([`/api/v2/admin/access-control/roles/${role}/combined-permissions`,
      `/api/v2/admin/access-control/roles/${role}/combined-permissions`]);
    expect(await row.count()).toBe(1);
    await fs.writeFile(`${out}/report.json`, JSON.stringify({
      database: "Registered isolated test database; no development API calls.",
      head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      saved: true, failureInjected: "PostgreSQL trigger rejects the Company Forms writer after menu writes",
      afterFailureExactlyMatchesSuccessfulSnapshot: true, auditFrozenNamesVerified: true,
      writes, screenshots: ["collapsed-desktop", "dropdown-desktop", "saved-desktop", "failed-desktop", "failed-narrow", "dropdown-narrow"],
    }, null, 2));
  } finally { await context.close(); }
}, 90000);
