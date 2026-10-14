/** Read-only closing evidence on the main preview; preserves HEAD and main PID. */
import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const dir = ".local/verification/crew-import-first-service";
const evidence = JSON.parse(await fs.readFile(`${dir}/main-api-evidence.json`, "utf8"));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const head = shell("git", ["rev-parse", "HEAD"]), commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(r => r.includes("server/index.ts") && !/watch|npm| -c /.test(r));
if (processes.length !== 1) throw Error("Exactly one main backend required");
const pid = Number(processes[0].trim().split(/\s+/)[0]);
const backendStart = new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString();
if (new Date(backendStart) <= new Date(commitTime)) throw Error("Backend must start after the closing commit");
const actor = (await db.query("SELECT id,role,user_type FROM master_users WHERE id=24")).rows[0];
const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, userType: actor.user_type, domain: "test" })}.devsig`;
const f = evidence.fixtures[0];
const row = (await db.query(`SELECT s.sea_uuid,s.to_date,r.name FROM crew_sea_service s
  JOIN adm_available_ranks_v2 r ON r.ar_uuid=s.rank WHERE s.crew_uuid=$1 AND s.from_date='2026-10-01'`, [f.crew])).rows[0];
if (!row || row.to_date !== null) throw Error("Current E1 contract must have no to-date");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1450, height: 1100 } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      userType: actor.user_type, role: actor.role, permissions: ["view", "create", "edit", "delete", "export"] };
    localStorage.setItem("devPersona", JSON.stringify(profile));
    localStorage.setItem("userProfile", JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  const page = await context.newPage();
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/crew-pool?crew=${f.crew}&section=E`, { waitUntil: "domcontentloaded" });
  const activeTo = page.getByTestId(`date-to-active-${row.sea_uuid}`);
  await activeTo.waitFor({ timeout: 30000 });
  if ((await activeTo.textContent()).trim() !== "On board") throw Error("Open contract must not claim a sign-off date");
  const serviceRow = activeTo.locator("xpath=ancestor::tr");
  if (!(await serviceRow.innerText()).includes(row.name)) throw Error("E1 must render the canonical master rank name");
  await serviceRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/closing-part-e1.jpg` });
  await fs.writeFile(`${dir}/closing-preview.json`, JSON.stringify({
    head, commitTime, pid, backendStart, canonicalRankNameShown: true, openContractHasNoToDate: true,
    screenshot: `${dir}/closing-part-e1.jpg`, passed: true,
  }, null, 2));
  if (shell("git", ["rev-parse", "HEAD"]) !== head) throw Error("HEAD changed during evidence");
  console.log(JSON.stringify({ head, commitTime, backendStart, passed: true }));
} finally { await browser.close(); await db.end(); }
