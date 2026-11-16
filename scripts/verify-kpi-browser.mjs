// Real UI + actual test backend. No development writes, mock responses or UI harness.
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prepareTestEnvironment, sameIdentity } from "./test-database-guard.mjs";
const identity = await prepareTestEnvironment();
const base = process.env.TEST_API_URL;
if (new URL(base).port === "5000") throw Error("Development preview is forbidden.");
const out = "generated-artifacts/kpi-settings/browser";
await fs.mkdir(out, { recursive: true });
const fd = openSync(`${out}/backend.log`, "w");
const instance = randomUUID();
const backend = spawn(process.execPath, ["--import", "tsx", "scripts/start-test-backend.ts"], {
  env: { ...process.env, TEST_BACKEND_INSTANCE: instance }, stdio: ["ignore", fd, fd],
});
closeSync(fd);
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const roleId = randomUUID(), roleName = `TEST ONLY KPI Editor ${roleId.slice(0, 8)}`;
let browser, actorId;
const year = 2096;
const report = { database: identity.database, isolated: true, personas: [], screenshots: [], errors: [], passed: false };
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (backend.exitCode !== null) throw Error("Test backend failed; inspect browser/backend.log.");
    try {
      const actual = await (await fetch(`${base}/api/test-database-identity`)).json();
      if (!sameIdentity(identity, actual) || actual.instance !== instance) throw Error("Wrong backend identity.");
      ready = true; break;
    } catch (e) {
      if (e.message === "Wrong backend identity.") throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!ready) throw Error("Test backend startup timed out.");
  await db.connect();
  const existing = await db.query("SELECT * FROM kpi_target_years WHERE year=$1", [year]);
  if (existing.rowCount) throw Error("Evidence year is occupied; refuse to overwrite.");
  await db.query("INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned) VALUES($1,$2,'Office',true)", [roleId, roleName]);
  actorId = (await db.query(`INSERT INTO master_users(user_uuid,role,user_type,fullname,display_name)
    VALUES($1,$2,'Office','Synthetic KPI Editor','Synthetic KPI Editor') RETURNING id`, [randomUUID(), roleName])).rows[0].id;
  await db.query(`INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview)
    SELECT gen_random_uuid()::text,$1,muid,true FROM adm_menumaster_ac WHERE name IN ('Admin','KPIs')`, [roleId]);
  await db.query("INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed) VALUES($1,'kpi_targets','set',true)", [roleId]);
  const editor = { id: actorId, role: roleName, ruid: roleId, user_type: "Office" };
  const manager = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
    ON r.assigned_role=u.role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
  report.personas = [{ role: roleName, grants: ["Admin View", "KPIs View", "Set KPI targets"], accessControl: false },
    { role: manager.role, purpose: "Existing synthetic test administrator for audit and grant screen" }];
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  async function persona(actor, viewport = { width: 1560, height: 1000 }) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "none" })}.${encode({ id: actor.id, roleId: actor.ruid, userType: actor.user_type, domain: "test" })}.devsig`;
    const context = await browser.newContext({ viewport });
    await context.route("**/api/**", route => route.continue({ headers: {
      ...route.request().headers(), ...(new URL(route.request().url()).origin === base ? { authorization: `Bearer ${token}` } : {}),
    } }));
    await context.addInitScript(({ actor, token }) => {
      const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
        role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
      localStorage.setItem("userProfile", JSON.stringify(profile));
      localStorage.setItem("devPersona", JSON.stringify(profile));
      localStorage.setItem("devAuthToken", token);
    }, { actor, token });
    const page = await context.newPage();
    page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("sidebar-item-kpis").waitFor({ timeout: 90000 });
    return { page, context, token };
  }
  const { page, token } = await persona(editor);
  const apiRead = url => fetch(`${base}${url}`, { headers: { authorization: `Bearer ${token}` } });
  expect((await apiRead("/api/v2/admin/access-control/audit")).status).toBe(403);
  await expect(page.getByTestId("sidebar-item-access-control")).toHaveCount(0);
  await page.getByTestId("sidebar-item-kpis").click();
  await page.getByTestId("tree-kpi-retention").click();
  await page.getByTestId("input-kpi-target-senior_officers").waitFor();
  await page.getByTestId("input-kpi-year").fill(String(year));
  await page.getByTestId("input-kpi-year").press("Tab");
  await expect(page.getByText(`Annual target · ${year}`, { exact: true })).toBeVisible();
  await expect(page.getByTestId("input-kpi-target-senior_officers")).toHaveValue("");
  await expect(page.getByTestId("text-kpi-last-changed")).toHaveCount(0);
  async function shot(name, target = page) {
    await target.screenshot({ path: `${out}/${name}.jpg`, fullPage: true });
    report.screenshots.push(`${name}.jpg`);
  }
  await shot("retention-empty");
  await page.getByTestId("button-kpi-edit").click();
  await page.getByTestId("input-kpi-target-senior_officers").fill("96.5");
  await page.getByTestId("input-kpi-target-officers").fill("95");
  await page.getByTestId("input-kpi-target-ratings").fill("94");
  await page.getByTestId("button-kpi-save").click();
  await expect(page.getByTestId("text-kpi-last-changed")).toContainText("Synthetic KPI Editor");
  await shot("retention-saved");
  // Unsaved edits stay until the real in-app discard confirmation is accepted.
  await page.getByTestId("button-kpi-edit").click();
  await page.getByTestId("input-kpi-target-ratings").fill("93");
  await page.getByTestId("tree-kpi-alcohol_violations").click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByTestId("text-selected-kpi")).toHaveText("Retention Rate");
  await page.getByTestId("button-kpi-cancel").click();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.getByTestId("tree-kpi-alcohol_violations").click();
  await expect(page.getByTestId("input-kpi-target-overall")).toHaveValue("");
  await page.getByTestId("button-kpi-edit").click();
  await page.getByTestId("input-kpi-target-overall").fill("0");
  await page.getByTestId("button-kpi-save").click();
  await expect(page.getByTestId("text-kpi-last-changed")).toContainText("Synthetic KPI Editor");
  await expect(page.getByTestId("input-kpi-target-overall")).toHaveValue("0");
  await shot("alcohol-zero");
  await page.getByTestId("button-kpi-edit").click();
  await page.getByTestId("input-kpi-target-overall").fill("4");
  await page.getByTestId("button-kpi-save").click();
  await expect(page.getByTestId("button-kpi-edit")).toBeVisible();
  await page.getByTestId("button-kpi-edit").click();
  await page.getByTestId("input-kpi-target-overall").fill("");
  await page.getByTestId("button-kpi-save").click();
  await expect(page.getByTestId("input-kpi-target-overall")).toHaveValue("");
  await expect(page.getByTestId("text-kpi-last-changed")).toBeVisible();
  await shot("alcohol-cleared");
  // Same frozen actor name remains visible despite a changed current master name.
  await db.query("UPDATE master_users SET fullname='Renamed current user' WHERE id=$1", [actorId]);
  await page.reload();
  await page.getByTestId("sidebar-item-kpis").click();
  await page.getByTestId("tree-kpi-alcohol_violations").click();
  await page.getByTestId("input-kpi-year").fill(String(year));
  await page.getByTestId("input-kpi-year").press("Tab");
  await expect(page.getByTestId("text-kpi-last-changed")).toContainText("Synthetic KPI Editor");
  await page.setViewportSize({ width: 700, height: 1000 });
  await shot("narrow");
  const grantPage = (await persona(manager)).page;
  await grantPage.getByTestId("sidebar-item-access-control").click();
  await grantPage.getByText(roleName, { exact: true }).first().click();
  await expect(grantPage.getByTestId("checkbox-kpi-targets-set")).toBeChecked();
  await shot("permission-grid", grantPage);
  await grantPage.getByRole("button", { name: "Access audit history", exact: true }).click();
  await expect(grantPage.getByRole("dialog")).toBeVisible();
  const search = grantPage.getByRole("dialog").getByPlaceholder(/search/i);
  if (await search.count()) await search.fill("Alcohol violations");
  await expect(grantPage.getByRole("dialog")).toContainText("Alcohol violations");
  await expect(grantPage.getByRole("dialog")).toContainText("Synthetic KPI Editor");
  await shot("audit-history", grantPage);
  report.passed = true;
  report.audit = (await db.query(`SELECT actor_display_name,before_value,after_value,details,recorded_at
    FROM adm_access_control_audit WHERE event='kpi_target_changed' AND details->>'year'=$1 ORDER BY id`, [String(year)])).rows;
} finally {
  await browser?.close();
  if (actorId) {
    await db.query("DELETE FROM kpi_target_values WHERE target_year_uuid IN (SELECT target_year_uuid FROM kpi_target_years WHERE year=$1 AND created_by=$2)", [year, String(actorId)]);
    await db.query("DELETE FROM kpi_target_years WHERE year=$1 AND created_by=$2", [year, String(actorId)]);
    await db.query("DELETE FROM adm_resource_action_grants WHERE role_id=$1", [roleId]);
    await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id=$1", [roleId]);
    await db.query("DELETE FROM master_users WHERE id=$1", [actorId]);
    await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid=$1", [roleId]);
  }
  await db.end();
  backend.kill("SIGTERM");
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
if (!report.passed || report.errors.length) throw Error("Browser verification failed; inspect report.json");
console.log(JSON.stringify(report, null, 2));
