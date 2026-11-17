// Real Dashboard UI, synthetic data, registered isolated database only.
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prepareTestEnvironment, sameIdentity } from "./test-database-guard.mjs";
const identity = await prepareTestEnvironment(), base = process.env.TEST_API_URL;
const evidenceDir = process.env.DASHBOARD_KPI_EVIDENCE_DIR || "generated-artifacts/dashboard-kpis";
const out = `${evidenceDir}/browser`;
await fs.mkdir(out, { recursive: true });
const fd = openSync(`${out}/backend.log`, "w"), instance = randomUUID();
const backend = spawn(process.execPath, ["--import", "tsx", "scripts/start-test-backend.ts"], {
  env: { ...process.env, TEST_BACKEND_INSTANCE: instance }, stdio: ["ignore", fd, fd],
});
closeSync(fd);
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const run = randomUUID(), roleId = randomUUID(), roleName = `TEST ONLY Dashboard Reader ${run.slice(0, 8)}`;
const rankIds = [randomUUID(), randomUUID(), randomUUID()];
const rankNames = ["Senior", "Officer", "Rating"].map(n => `TEST ONLY KPI ${n} ${run.slice(0, 8)}`);
const crewIds = [], records = [];
const year = new Date().getFullYear(), years = [year - 1, year];
let browser, actorId, connected = false, savedYears = [], savedValues = [], targetsTouched = false;
const report = { isolated: true, database: identity.database, year, role: roleName,
  grants: ["Dashboard View"], screenshots: [], checks: [], errors: [], passed: false };
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (backend.exitCode !== null) throw Error("Test backend failed; inspect backend.log.");
    try {
      const actual = await (await fetch(`${base}/api/test-database-identity`)).json();
      if (!sameIdentity(identity, actual) || actual.instance !== instance) throw Error("Wrong backend identity.");
      ready = true; break;
    } catch (e) {
      if (e.message === "Wrong backend identity.") throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!ready) throw Error("Isolated backend did not start.");
  await db.connect(); connected = true;
  savedYears = (await db.query("SELECT * FROM kpi_target_years WHERE year=ANY($1)", [years])).rows;
  savedValues = (await db.query(`SELECT v.* FROM kpi_target_values v JOIN kpi_target_years y USING(target_year_uuid)
    WHERE y.year=ANY($1)`, [years])).rows;
  await db.query("INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned) VALUES($1,$2,'Office',true)", [roleId, roleName]);
  actorId = (await db.query(`INSERT INTO master_users(user_uuid,role,user_type,fullname,display_name)
    VALUES($1,$2,'Office','Synthetic Dashboard Reader','Synthetic Dashboard Reader') RETURNING id`, [randomUUID(), roleName])).rows[0].id;
  await db.query(`INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview)
    SELECT gen_random_uuid()::text,$1,muid,true FROM adm_menumaster_ac WHERE name='Dashboard'`, [roleId]);
  for (let group = 0; group < 3; group++) {
    await db.query(`INSERT INTO adm_available_ranks_v2(ar_uuid,name,category,rank_id,label,applicable_to_company)
      VALUES($1,$2,'Synthetic',$1,$2,true)`, [rankIds[group], rankNames[group]]);
    await db.query(`INSERT INTO adm_company_ranks_v2(id,cr_uuid,rank,rank_id,senior_officer,officer,rating)
      VALUES($1,$1,$2,$1,$3,$4,$5)`, [rankIds[group], rankNames[group], group === 0, group <= 1, group === 2]);
    for (let n = 0; n < 8; n++) {
      const id = randomUUID(); crewIds.push(id);
      await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,recruitment_date,last_termination_date)
        VALUES($1,$1,'TEST ONLY','Dashboard KPI',$2,$3,$4)`, [id, rankNames[group], `${year - 4}-01-01`, n === 0 ? `${year}-01-02` : null]);
      if (n === 0) await db.query(`INSERT INTO crew_terminations(term_uuid,crew_uuid,termination_date,category,rank_id_snapshot)
        VALUES($1,$2,$3,'VT',$4)`, [randomUUID(), id, `${year}-01-02`, rankNames[group]]);
    }
  }
  for (const y of years) {
    const record = randomUUID(); records.push(record);
    await db.query(`INSERT INTO da_test_records_v2(da_uuid,vessel_id,test_type,date_time_test_completed,status)
      VALUES($1,'40400000-0000-4000-8000-000000000001','periodic',$2,'submitted')`, [record, `${y}-01-02`]);
    await db.query(`INSERT INTO da_personnel_tested_v2(pt_uuid,test_record_uuid,crew_id,rank,name,alcohol_violation,drug_violation)
      VALUES($1,$2,$3,$4,'TEST ONLY Dashboard KPI',true,true)`, [randomUUID(), record, crewIds[1], rankNames[0]]);
  }
  async function targets(missing = false) {
    targetsTouched = true;
    await db.query("DELETE FROM kpi_target_values WHERE target_year_uuid IN(SELECT target_year_uuid FROM kpi_target_years WHERE year=ANY($1))", [years]);
    if (missing) return;
    for (const y of years) {
      await db.query(`INSERT INTO kpi_target_years(kpi_uuid,year,created_by,updated_by)
        SELECT kpi_uuid,$1,$2,$2 FROM kpi_definitions WHERE active
        ON CONFLICT(kpi_uuid,year,scope) DO NOTHING`, [y, String(actorId)]);
      // Existing formula supplies real actuals. Set test-only KPIs to create
      // a mix; do not replace or mock successful actual/KPI responses.
      await db.query(`INSERT INTO kpi_target_values(target_year_uuid,component_uuid,kpi_uuid,target_value)
        SELECT y.target_year_uuid,c.component_uuid,k.kpi_uuid,
          CASE WHEN k.code='retention' THEN CASE WHEN c.code='ratings' THEN 100 ELSE 0 END
            WHEN k.code='alcohol_violations' THEN 0 ELSE 999999 END
        FROM kpi_definitions k JOIN kpi_components c USING(kpi_uuid)
        JOIN kpi_target_years y USING(kpi_uuid) WHERE y.year=$1`, [y]);
    }
  }
  await targets();
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1650, height: 1100 } });
  const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ id: actorId, roleId, userType: "Office", domain: "test" })}.devsig`;
  await context.route("**/api/**", route => route.continue({ headers: { ...route.request().headers(),
    ...(new URL(route.request().url()).origin === base ? { authorization: `Bearer ${token}` } : {}) } }));
  await context.addInitScript(({ actorId, roleId, roleName, token }) => {
    const p = { personaKey: "crewing-executive", masterUserId: actorId, userId: String(actorId),
      role: roleName, roleId, userType: "Office", myVessels: [] };
    localStorage.setItem("userProfile", JSON.stringify(p)); localStorage.setItem("devPersona", JSON.stringify(p));
    localStorage.setItem("devAuthToken", token);
  }, { actorId, roleId, roleName, token });
  const page = await context.newPage();
  page.on("pageerror", e => report.errors.push(e.message));
  const apiRequests = [];
  page.on("request", r => { if (r.url().startsWith(`${base}/api/`)) apiRequests.push(r.url()); });
  const apiRead = path => fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
  expect((await apiRead("/api/v2/admin/kpis")).status).toBe(403);
  expect((await apiRead("/api/v2/admin/access-control/audit")).status).toBe(403);
  expect((await apiRead(`/api/v2/admin/dashboard-kpis/${year}`)).status).toBe(200);
  report.checks.push("Dashboard-only persona can read KPIs but not KPI settings or Access Control audit");
  async function loaded() {
    await expect(page.getByTestId("text-retention-senior")).toBeVisible({ timeout: 90000 });
    await expect(page.getByTestId("text-da-drug-violations")).toBeVisible({ timeout: 90000 });
  }
  async function shot(name, locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.screenshot({ path: `${out}/${name}.jpg` });
    report.screenshots.push(`${name}.jpg`);
  }
  const retention = () => page.getByTestId("card-wrapper-crew-retention");
  const da = () => page.getByTestId("card-wrapper-da-analysis");
  async function reload() { await page.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" }); await page.reload(); await loaded(); }
  await reload();
  await expect(retention()).toContainText("Rolling 2 years:");
  await expect(retention().getByTestId("kpi-retention-senior")).toContainText("On track");
  await expect(retention().getByTestId("kpi-retention-rating")).toContainText("Off track");
  await expect(retention().getByText("On track").first()).toHaveAttribute("title",
    `Forecast based on the last 24 months. The official result uses 1 Jan ${year - 1} to 31 Dec ${year}.`);
  await expect(da()).toContainText("(year to date)");
  await expect(da()).toContainText("Within KPI so far");
  await expect(da().getByTestId("kpi-da-alcohol")).toContainText("Missed");
  expect(apiRequests.filter(u => new URL(u).pathname === `/api/v2/admin/dashboard-kpis/${year}`).length).toBeLessThanOrEqual(2); // initial mount + reload
  await shot("retention-rolling-on-off-track", retention());
  await shot("da-current-within-and-missed", da());
  await page.getByTestId("tile-retention-officer").hover();
  await expect(page.getByTestId("tile-retention-officer")).toHaveAttribute("title", /including senior officers.*TMSA 3.4/);
  await page.getByTestId("tile-retention-senior").click();
  await expect(page.getByTestId("dialog-crew-retention-drilldown")).toBeVisible();
  await shot("retention-drilldown-dates", page.getByTestId("dialog-crew-retention-drilldown"));
  await page.keyboard.press("Escape");
  await page.getByTestId("tile-da-alcohol-violations").click();
  await expect(page.getByTestId("dialog-da-violations-drilldown")).toBeVisible();
  await shot("da-drilldown", page.getByTestId("dialog-da-violations-drilldown"));
  await page.keyboard.press("Escape");
  report.checks.push("Both drilldowns open; rolling drilldown uses effective dates; Officers explanation is present");
  async function range(from, to) {
    await page.getByTestId("period-filter-trigger").click();
    await page.getByTestId("radio-date-range").click();
    for (const [id, value] of [["date-from-trigger", from], ["date-to-trigger", to]]) {
      await page.getByTestId(`${id}-manual`).fill(value);
      await page.getByTestId(`${id}-manual`).press("Tab");
    }
    await page.getByTestId("button-apply-period-filter").click();
    await loaded();
    await expect(retention()).not.toContainText("Rolling 2 years:");
  }
  await range(`01-Jan-${year - 1}`, `31-Dec-${year}`);
  await expect(retention()).toContainText(`KPI (${year})`);
  await expect(retention().getByTestId("kpi-retention-senior")).toContainText("Met");
  await expect(retention().getByTestId("kpi-retention-rating")).toContainText("Missed");
  await expect(da().getByTestId("kpi-da-drug")).not.toContainText("Within KPI so far");
  await expect(da().getByTestId("kpi-da-drug").locator("div").first()).toHaveClass(/text-slate-400/);
  await shot("retention-official-two-years", retention());
  await shot("da-two-years-reference", da());
  await range(`01-Jan-${year - 1}`, `31-Dec-${year - 1}`);
  await expect(da().getByTestId("kpi-da-drug")).toContainText("Met");
  await expect(da().getByTestId("kpi-da-alcohol")).toContainText("Missed");
  await expect(retention().getByTestId("kpi-retention-senior").locator("div").first()).toHaveClass(/text-slate-400/);
  await shot("da-completed-year-met-missed", da());
  await shot("retention-single-year-reference", retention());
  const beforeOther = apiRequests.length;
  await page.getByTestId("button-clear-filters").click();
  await loaded();
  await expect(retention()).toContainText("Rolling 2 years:");
  await expect(da()).toContainText("(year to date)");
  report.checks.push("Clear restores rolling Retention without changing other cards' current-year default");
  report.otherCardRequestsAfterClear = apiRequests.slice(beforeOther).filter(u => !/dashboard-kpis|retention|violations/.test(u)).map(u => new URL(u).pathname + new URL(u).search);
  await page.getByTestId("select-rank").click();
  await page.getByTestId(`checkbox-rank-${rankNames[0]}`).click();
  await page.keyboard.press("Escape");
  await expect(retention()).toContainText("Company-wide target — shown for reference while filters are applied.");
  await expect(da()).not.toContainText("Within KPI so far");
  await expect(retention().getByTestId("text-retention-senior")).toHaveClass(/text-gray-900/);
  await shot("retention-filtered", retention()); await shot("da-filtered", da());
  await page.getByTestId("button-clear-filters").click();
  await range(`01-Feb-${year}`, `28-Feb-${year}`);
  await expect(retention().getByTestId("kpi-retention-senior").locator("div").first()).toHaveClass(/text-slate-400/);
  await shot("retention-part-year-reference", retention()); await shot("da-part-year-reference", da());
  const day = new Date(), start = new Date(day.getFullYear() - 2, day.getMonth(), day.getDate() + 1);
  const fmt = d => `${String(d.getDate()).padStart(2,"0")}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}-${d.getFullYear()}`;
  await range(fmt(start), fmt(day));
  await expect(retention().getByTestId("kpi-retention-senior").locator("div").first()).toHaveClass(/text-slate-400/);
  await shot("retention-manual-rolling-reference", retention());
  await targets(true); await reload();
  await expect(retention().getByTestId("kpi-retention-senior")).toHaveCount(0);
  await expect(da().getByTestId("kpi-da-drug")).toHaveCount(0);
  await shot("retention-no-kpi", retention()); await shot("da-no-kpi", da());
  // A genuine empty historical cohort (no fixture recruitment before 1900).
  await range("01-Jan-1900", "31-Dec-1900");
  await expect(page.getByTestId("text-retention-senior")).toHaveText("N/A");
  await shot("retention-unavailable", retention());
  // Explicit transport failures are the only intercepted responses. Successful
  // screens above use real APIs; a failure must never become missing KPI/zero.
  await targets(); await reload();
  await page.route("**/api/v2/admin/dashboard-kpis/*", r => r.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Unavailable"}' }));
  await page.reload(); await loaded();
  await expect(page.getByTestId("error-dashboard-kpis-retention")).toBeVisible({ timeout: 30000 });
  await shot("kpi-failure-retry", retention());
  await page.unroute("**/api/v2/admin/dashboard-kpis/*");
  await page.getByTestId("error-dashboard-kpis-retention").getByText("Retry", { exact: true }).click();
  await expect(retention().getByTestId("kpi-retention-senior")).toBeVisible();
  await page.route("**/api/v2/drugs-alcohol/stats/violations?**", r => r.fulfill({ status: 503, body: "Unavailable" }));
  await page.reload();
  await expect(page.getByTestId("error-da-drug-violations")).toBeVisible({ timeout: 30000 });
  await expect(da().getByTestId("kpi-da-drug")).not.toContainText("Within KPI so far");
  await shot("da-unavailable-error", da());
  await page.unroute("**/api/v2/drugs-alcohol/stats/violations?**");
  await reload();
  await page.setViewportSize({ width: 520, height: 1100 });
  await shot("retention-narrow", retention()); await shot("da-narrow", da());
  report.checks.push("Actual UI verified rolling/official/manual/partial/clear/filter/zero/no-KPI/unavailable/failure-and-Retry states");
  report.requests = apiRequests.map(u => new URL(u).pathname + new URL(u).search);
  report.passed = true;
} catch (e) {
  report.errors.push(e.stack ?? String(e)); throw e;
} finally {
  await browser?.close();
  if (connected) {
    await db.query("DELETE FROM da_personnel_tested_v2 WHERE test_record_uuid=ANY($1)", [records]);
    await db.query("DELETE FROM da_test_records_v2 WHERE da_uuid=ANY($1)", [records]);
    await db.query("DELETE FROM crew_terminations WHERE crew_uuid=ANY($1)", [crewIds]);
    await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid=ANY($1)", [crewIds]);
    await db.query("DELETE FROM adm_company_ranks_v2 WHERE id=ANY($1)", [rankIds]);
    await db.query("DELETE FROM adm_available_ranks_v2 WHERE ar_uuid=ANY($1)", [rankIds]);
    await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id=$1", [roleId]);
    if (actorId) await db.query("DELETE FROM master_users WHERE id=$1", [actorId]);
    await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid=$1", [roleId]);
    if (targetsTouched) {
      await db.query("DELETE FROM kpi_target_values WHERE target_year_uuid IN(SELECT target_year_uuid FROM kpi_target_years WHERE year=ANY($1))", [years]);
      await db.query("DELETE FROM kpi_target_years WHERE year=ANY($1)", [years]);
      for (const [table, rows] of [["kpi_target_years", savedYears], ["kpi_target_values", savedValues]]) {
        for (const row of rows) {
          const keys = Object.keys(row);
          await db.query(`INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i+1}`).join(",")})`, Object.values(row));
        }
      }
    }
  }
  await db.end();
  backend.kill("SIGTERM");
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  if (report.screenshots.length) {
    const sections = await Promise.all(report.screenshots.map(async file => `<section><h2>${file.replace(".jpg","").replaceAll("-"," ")}</h2><img src="data:image/jpeg;base64,${(await fs.readFile(`${out}/${file}`)).toString("base64")}"></section>`));
    await fs.writeFile(`${evidenceDir}/dashboard-kpi-evidence.html`,
      `<!doctype html><meta charset="utf-8"><title>Dashboard KPI browser evidence</title><style>body{font:16px system-ui;max-width:1100px;margin:30px auto;background:#f3f6fa;color:#18354c}section{background:white;padding:20px;margin:20px 0;border-radius:8px}img{max-width:100%;height:auto}</style><h1>Dashboard KPI browser evidence</h1><p>Actual app on the identity-verified isolated test database. Synthetic Dashboard View-only persona. No development writes. Failed-request screenshots deliberately inject transport errors; all successful screenshots use actual API data.</p>${sections.join("")}`);
  }
  console.log(JSON.stringify({ passed: report.passed, screenshots: report.screenshots.length, errors: report.errors, checks: report.checks }));
}
