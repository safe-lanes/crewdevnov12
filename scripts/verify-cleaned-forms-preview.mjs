import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

// Read-only verification: reuse the original parent Office/Admin account.
// No fixtures, grants, personas in the database, or forms are created.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid
  FROM master_users u JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
  AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
if (!actor) throw Error("Original parent verification account unavailable.");
const names = (await db.query(`SELECT coalesce(to_jsonb(f)->>'name',to_jsonb(f)->>'form_name') name
  FROM adm_forms_v2 f ORDER BY id`)).rows.map(r => r.name);
if (names.length !== 6 || names.some(n => !n)) throw Error("Original form inventory unavailable.");
await db.end();
const shell = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
if (processes.length !== 1) throw Error("Expected exactly one main backend.");
const pid = Number(processes[0].trim().split(/\s+/)[0]);
const report = { head: shell("git", ["rev-parse", "HEAD"]),
  commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendPid: pid, backendStart: new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString(),
  checks: [], errors: [] };
if (new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Backend predates closing HEAD.");
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
// Existing development-persona mechanism; do not change the app's auth settings.
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
  id: actor.id, roleId: actor.ruid, userType: actor.user_type, domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1560, height: 1050 },
  ignoreHTTPSErrors: true });
await context.route("**/api/**", route => route.continue({
  headers: { ...route.request().headers(),
    ...(new URL(route.request().url()).hostname === process.env.REPLIT_DEV_DOMAIN
      ? { authorization: `Bearer ${token}` } : {}) },
}));
await context.addInitScript(({ actor, token }) => {
  const profile = { personaKey: "crewing-executive", masterUserId: actor.id,
    userId: String(actor.id), role: actor.role, roleId: actor.ruid,
    userType: actor.user_type, myVessels: [] };
  localStorage.setItem("userProfile", JSON.stringify(profile));
  localStorage.setItem("devPersona", JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, { actor, token });
await context.route("**/src/**", async route =>
  route.fulfill({ response: await route.fetch({ maxRetries: 2, timeout: 60000 }) }));
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
page.on("requestfailed", request =>
  report.errors.push(`${request.failure()?.errorText} ${new URL(request.url()).pathname}`));
page.on("response", response => {
  if (response.url().includes("/api/") && response.status() >= 400)
    report.errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
});
await fs.mkdir("generated-artifacts/cleanup-preview", { recursive: true });
try {
  const response = await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin/forms`,
    { waitUntil: "domcontentloaded" });
  if (response.status() !== 200) throw Error("Main preview document did not load.");
  await page.getByTestId("tab-standard-forms").waitFor({ timeout: 60000 });
  await page.getByTestId("tab-standard-forms").click();
  for (const name of names) await page.getByText(name, { exact: true }).first().waitFor({ timeout: 45000 });
  report.checks.push("Forms Configuration renders all six original Standard Forms.");
  for (const [group, version] of [["Cadets", "v02"], ["Promotion to Master", "v09"], ["Promotion to Chief Officer", "v10"]]) {
    const row = page.getByRole("row").filter({ has: page.getByText(group, { exact: true }) });
    await row.getByText(version, { exact: true }).waitFor();
    report.checks.push(`${group} shows its real ${version}.`);
  }
  await page.screenshot({ path: "generated-artifacts/cleanup-preview/standard-forms.jpg" });
  await page.getByTestId("tab-company-forms").click();
  await page.getByText("0 Company Forms", { exact: true }).waitFor({ timeout: 30000 });
  report.checks.push("Company Forms tab shows zero forms.");
  await page.screenshot({ path: "generated-artifacts/cleanup-preview/company-forms-empty.jpg" });
  if (report.errors.length) throw Error(`Preview errors: ${report.errors.join("; ")}`);
  report.passed = true;
} finally {
  await fs.writeFile("generated-artifacts/cleanup-preview/browser-evidence.json",
    JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
