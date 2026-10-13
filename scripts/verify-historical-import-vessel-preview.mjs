import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

// Read-only UI check using an existing parent Office/Admin account.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid
  FROM master_users u JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
  AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
await db.end();
if (!actor) throw Error("Existing verification account unavailable.");
const shell = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
if (processes.length !== 1) throw Error("Expected exactly one main backend.");
const pid = Number(processes[0].trim().split(/\s+/)[0]);
const expected = Array.from({ length: 9 }, (_, n) => `vessel ${String(n + 2).padStart(2, "0")}`);
const report = { head: shell("git", ["rev-parse", "HEAD"]),
  commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendPid: pid, backendStart: new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString(),
  expectedVessels: expected, errors: [], passed: false };
if (new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Backend predates final commit.");
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
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
page.on("pageerror", e => report.errors.push(e.message));
page.on("requestfailed", request =>
  report.errors.push(`${request.failure()?.errorText} ${new URL(request.url()).pathname}`));
page.on("response", response => {
  if (new URL(response.url()).pathname.startsWith("/api/") && response.status() >= 400)
    report.errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
});
const directory = "generated-artifacts/historical-import-vessel";
await fs.mkdir(directory, { recursive: true });
try {
  const list = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v2/vessel/list",
    { timeout: 60000 });
  const initial = await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/vessel`,
    { waitUntil: "domcontentloaded" });
  if (initial.status() !== 200) throw Error("Main preview did not load.");
  const response = await list;
  if (response.status() !== 200) throw Error("Vessel API did not load.");
  const apiNames = (await response.json()).map(v => v.vessel).sort();
  if (JSON.stringify(apiNames) !== JSON.stringify(expected))
    throw Error("Main-preview vessel API returned an unexpected list.");
  // The route opens the Vessel Database list, not a selected-vessel detail.
  // Check the rendered grid itself without opening or editing a vessel.
  await page.getByText("vessel 10", { exact: true }).first().waitFor({ timeout: 60000 });
  const cells = page.locator('.ag-cell[col-id="vessel"]');
  const visible = (await cells.allTextContents()).map(s => s.trim()).sort();
  if (JSON.stringify(visible) !== JSON.stringify(expected))
    throw Error("The visible vessel list does not show exactly vessel 02 through vessel 10.");
  await page.screenshot({ path: `${directory}/vessel-list.jpg`, type: "jpeg" });
  if (report.errors.length) throw Error("Browser errors during vessel verification.");
  report.visibleVessels = visible; report.passed = true;
} finally {
  await browser.close();
  await fs.writeFile(`${directory}/preview-proof.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
