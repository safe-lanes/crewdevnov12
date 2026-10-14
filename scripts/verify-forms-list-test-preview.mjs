import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { prepareTestEnvironment, sameIdentity } from "./test-database-guard.mjs";

// Disposable automated fixtures ONLY in THE registered test database.
const identity = await prepareTestEnvironment();
const base = process.env.TEST_API_URL;
if (new URL(base).port === "5000") throw Error("Main preview is forbidden.");
const out = "generated-artifacts/forms-list-test-preview";
fs.mkdirSync(out, { recursive: true });
const log = fs.openSync(`${out}/backend.log`, "w");
const instance = randomUUID();
const backend = spawn(process.execPath, ["--import", "tsx", "scripts/start-test-backend.ts"], {
  env: { ...process.env, TEST_BACKEND_INSTANCE: instance }, stdio: ["ignore", log, log],
});
fs.closeSync(log);
const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const prefix = `TEST ONLY Browser List ${randomUUID()} `;
let browser, ids = [];
const report = { database: identity.database, identityMatched: false, fixtureCount: 1000,
  resourceErrors: [], apiErrors: [], faultEvidence: [], passed: false };
try {
  for (let n = 0; n < 120; n++) {
    if (backend.exitCode !== null) throw Error("Dedicated test backend failed to start.");
    try {
      const actual = await (await fetch(`${base}/api/test-database-identity`)).json();
      if (!sameIdentity(identity, actual) || actual.instance !== instance)
        throw Error("Occupied test port belongs to another backend.");
      report.identityMatched = true; break;
    } catch (error) {
      if (String(error).includes("another backend")) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  if (!report.identityMatched) throw Error("Test backend did not become ready.");
  await db.connect();
  const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
    JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
    WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
  const inserted = (await db.query(`INSERT INTO adm_forms_v2
    (form_uuid,name,category,subject_type,rank_group,version_no,version_date)
    SELECT gen_random_uuid()::text,$1||n,
      CASE WHEN n<=500 THEN 'appraisal' ELSE 'dynamic' END,
      CASE WHEN n<=500 THEN NULL ELSE 'crew_assignment' END,'','99','31-Dec-2099'
    FROM generate_series(1,1000) n RETURNING id,name,category`, [prefix])).rows;
  ids = inserted.map(f => f.id);
  await db.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,status)
    SELECT gen_random_uuid()::text,id,'02','03-Jun-2026','draft'
    FROM adm_forms_v2 WHERE id=ANY($1::int[])`, [ids]);
  const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "none" })}.${encode({ id: actor.id, roleId: actor.ruid, userType: actor.user_type, domain: "test" })}.devsig`;
  browser = await chromium.launch({
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1560, height: 1050 } });
  // Global Authorization headers leak to external fonts and cause CORS failures.
  await context.route("**/api/**", route => route.continue({
    headers: { ...route.request().headers(),
      ...(new URL(route.request().url()).origin === base ? { authorization: `Bearer ${token}` } : {}) },
  }));
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id,
      userId: String(actor.id), role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    localStorage.setItem("userProfile", JSON.stringify(profile));
    localStorage.setItem("devPersona", JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  const page = await context.newPage();
  let faultPhase = false;
  const initialFormRequests = [];
  page.on("pageerror", e => report.resourceErrors.push(e.message));
  page.on("requestfailed", r => report.resourceErrors.push(`${r.failure()?.errorText} ${new URL(r.url()).pathname}`));
  page.on("response", r => {
    const url = new URL(r.url());
    if (!faultPhase && url.pathname.startsWith("/api/v2/admin/forms")) initialFormRequests.push(url.pathname + url.search);
    if (!faultPhase && r.status() >= 400) report.apiErrors.push(`${r.status()} ${url.pathname}`);
  });
  page.on("console", message => {
    if (!faultPhase && message.type() === "error") report.resourceErrors.push(message.text());
  });
  const listResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v2/admin/forms");
  const start = performance.now();
  await page.goto(`${base}/admin/forms`, { waitUntil: "domcontentloaded" });
  const response = await listResponse;
  const data = await response.json();
  report.totalForms = data.length;
  report.serverResponseMs = Math.round(performance.now() - start);
  report.summaryRequestMs = Math.round(response.request().timing().responseEnd);
  const standard = inserted.find(f => f.category === "appraisal");
  const company = inserted.find(f => f.category === "dynamic");
  const standardRow = () => page.getByRole("row").filter({ has: page.getByText(standard.name, { exact: true }) });
  const companyRow = () => page.getByTestId(`company-form-row-${company.id}`);
  await page.getByTestId("tab-standard-forms").waitFor();
  await standardRow().getByText("v02", { exact: true }).waitFor();
  if (await page.getByRole("row").filter({ hasText: prefix }).count() !== 500)
    throw Error("Not all 500 Standard fixtures rendered.");
  report.standardListReadyMs = Math.round(performance.now() - start);
  await page.screenshot({ path: `${out}/standard-list.jpg` });
  await page.getByTestId("tab-company-forms").click();
  await companyRow().getByText("v02", { exact: true }).waitFor();
  if (await page.getByRole("row").filter({ hasText: prefix }).count() !== 500)
    throw Error("Not all 500 Company fixtures rendered.");
  report.bothListsReadyMs = Math.round(performance.now() - start);
  report.initialFormRequests = initialFormRequests;
  if (initialFormRequests.length !== 1 || !initialFormRequests[0].includes("includeSummary=true"))
    throw Error("Initial form loading still uses per-form requests.");
  if (report.resourceErrors.length || report.apiErrors.length) throw Error("Benchmark browser resource/API errors.");
  await page.screenshot({ path: `${out}/company-list.jpg` });

  // Controlled network-fault injection, not a production failure or fake fixture:
  // one unavailable summary in each tab; one Retry HTTP 503, then real recovery.
  faultPhase = true;
  await page.route("**/api/v2/admin/forms?includeSummary=true", async route => {
    const response = await route.fetch();
    const data = await response.json();
    for (const form of data) if (form.id === standard.id || form.id === company.id)
      form.versionSummary = { state: "error" };
    await route.fulfill({ response, json: data });
  });
  let failRetry = true;
  await page.route(/\/api\/v2\/admin\/forms\/\d+\?includeSummary=true$/, async route => {
    if (failRetry) {
      failRetry = false;
      await route.fulfill({ status: 503, json: { error: "deliberate_private_sql_failure" } });
    } else await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  for (const [tab, row] of [["standard", standardRow], ["company", companyRow]]) {
    await page.getByTestId(`tab-${tab}-forms`).click();
    await row().getByText("Could not load", { exact: true }).waitFor();
    if (await page.getByRole("alert").filter({ hasText: "Could not load" }).count() !== 1)
      throw Error("One row failure poisoned other rows.");
    if ((await row().innerText()).includes("2099") || (await row().innerText()).includes("v99"))
      throw Error("Legacy fallback escaped into a failed row.");
    await row().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${tab}-row-failure.jpg` });
    await row().getByRole("button", { name: "Retry" }).click();
    if (tab === "standard") {
      await row().getByText("Could not load", { exact: true }).waitFor();
      if ((await page.locator("body").innerText()).includes("deliberate_private_sql_failure"))
        throw Error("Raw error reached the UI.");
      await row().getByRole("button", { name: "Retry" }).click();
    }
    await row().getByText("v02", { exact: true }).waitFor();
    if (await page.getByRole("alert").filter({ hasText: "Could not load" }).count() !== 0)
      throw Error("Retry did not recover the row.");
    await page.screenshot({ path: `${out}/${tab}-row-recovered.jpg` });
    report.faultEvidence.push(`${tab}: only the failed row showed Could not load; Retry restored real v02.`);
  }
  report.passed = true;
} finally {
  if (browser) await browser.close();
  if (ids.length) {
    await db.query("DELETE FROM adm_form_versions_v2 WHERE form_id=ANY($1::int[])", [ids]);
    await db.query("DELETE FROM adm_forms_v2 WHERE id=ANY($1::int[])", [ids]);
    report.fixturesRemoved = (await db.query("SELECT count(*)::int n FROM adm_forms_v2 WHERE name LIKE $1",
      [`${prefix}%`])).rows[0].n === 0;
  }
  await db.end();
  backend.kill("SIGTERM");
  fs.writeFileSync(`${out}/evidence.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
