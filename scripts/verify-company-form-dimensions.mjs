// Closing collector is read-only: no fixtures, grants, submissions or registry
// writes. Run only after the final commit and managed workflow restart.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium } from "@playwright/test";
const directory = ".local/verification/assignment-dimensions";
await fs.mkdir(directory, { recursive: true });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ensure = (value, message) => { if (!value) throw Error(message); };
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const head = () => shell("git", ["rev-parse", "HEAD"]);
const pid = () => {
  const rows = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(line =>
    line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
  ensure(rows.length === 1, "Exactly one managed main backend required");
  return Number(rows[0].trim().split(/\s+/)[0]);
};
const initialHead = head(), initialPid = pid();
const commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
const processStart = new Date(shell("ps", ["-p", String(initialPid), "-o", "lstart="])).toISOString();
ensure(new Date(processStart) > new Date(commitTime), "Backend must start after final commit");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND NOT r.is_deleted AND r.is_active
  WHERE u.id=24`)).rows[0];
ensure(actor, "Existing verified office actor required");
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, domain: "test", userType: "Office" })}.devsig`;
const crewUuid = "424584fc-dc59-4f85-aa14-30781eb8477e";
const assignUuid = "10df4ffb-db61-46a9-ac7a-cc5e290b7376";
const url = `/api/v2/company-form-submissions/subjects/crew_assignment/${assignUuid}/dimensions`;
const response = await fetch(base + url, { headers: { Authorization: `Bearer ${token}` } });
ensure(response.ok, `Inspector API refused: ${response.status}`);
const dimensions = await response.json();
ensure(dimensions.dimensions.length === 12, "All dimensions must be explicit");
ensure(dimensions.dimensions.filter(d => ["owner", "flag"].includes(d.key)).every(d => d.status === "not_yet_available"),
  "Owner and flag must remain unavailable");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), args: ["--no-sandbox"] });
let report;
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1800 } });
  await context.addInitScript(({ actor, token }) => {
    localStorage.setItem("devAuthToken", token);
    const profile = {
      personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [],
    };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
  }, { actor, token });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/crew-pool?crew=${crewUuid}&section=G`, { waitUntil: "domcontentloaded" });
  const group = page.getByTestId(`crew-company-forms-group-${assignUuid}`);
  await group.waitFor({ timeout: 45000 });
  if (!(await group.evaluate(element => element.open))) await group.locator(":scope > summary").click();
  const loaded = page.waitForResponse(response => response.url().includes(url) && response.status() === 200);
  await page.getByTestId(`assignment-dimension-check-${assignUuid}`).click();
  await loaded;
  await group.getByText("Vessel type", { exact: true }).waitFor();
  await group.getByText("First-in-rank", { exact: true }).waitFor();
  await group.locator("dt").filter({ hasText: /^Contract rank$/ }).waitFor();
  const rank = dimensions.dimensions.find(dimension => dimension.key === "rank");
  for (const label of rank?.labels ?? []) await group.getByText(label, { exact: true }).first().waitFor();
  ensure(!(await group.innerText()).includes("Not recorded on assignment"), "G3 must use captured contract rank");
  await group.evaluate(element => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${directory}/closing-inspector.jpg`, fullPage: true, animations: "disabled" });
  ensure(head() === initialHead && pid() === initialPid, "HEAD/PID changed during closing evidence");
  ensure(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  report = { success: true, finalHead: initialHead, commitTime, backendPid: initialPid, backendStart: processStart,
    actorId: actor.id, assignmentUuid: assignUuid, dimensionApi: dimensions, browserErrors: errors,
    screenshot: `${directory}/closing-inspector.jpg`, finishedAt: new Date().toISOString() };
} finally { await browser.close(); await db.end(); }
await fs.writeFile(`${directory}/closing.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, dimensionApi: { dimensions: report.dimensionApi.dimensions.length } }, null, 2));
