// Read-only closing main-preview evidence. No fixture creation or mutations.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium } from "@playwright/test";
const directory = ".local/verification/requirement-ledger";
await fs.mkdir(directory, { recursive: true });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const ensure = (x, why) => { if (!x) throw Error(why); };
const head = () => shell("git", ["rev-parse", "HEAD"]);
const pid = () => {
  const rows = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(l =>
    l.includes("server/index.ts") && !/watch|npm| -c /.test(l));
  ensure(rows.length === 1, "One managed main backend required");
  return Number(rows[0].trim().split(/\s+/)[0]);
};
const initialHead = head(), initialPid = pid();
const commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
const processStart = new Date(shell("ps", ["-p", String(initialPid), "-o", "lstart="])).toISOString();
ensure(new Date(processStart) > new Date(commitTime), "Backend must start after final commit");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
ensure(actor, "Retained closing Office author required");
const enc = x => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id,userType: actor.user_type,domain: "test" })}.devsig`;
const fixture = (await db.query(`SELECT r.*,a.crew_uuid,a.assignment_type FROM frm_requirements r
  JOIN crew_assignments a ON a.assign_uuid=r.subject_ref JOIN adm_forms_v2 f ON f.form_uuid=r.form_uuid
  WHERE f.name LIKE 'TEST ONLY Requirement form %' AND r.status='STARTED'
  AND EXISTS(SELECT 1 FROM frm_requirement_history h WHERE h.requirement_uuid=r.requirement_uuid AND event='COMPLETED')
  AND EXISTS(SELECT 1 FROM frm_requirement_history h WHERE h.requirement_uuid=r.requirement_uuid AND event='OUTSTANDING')
  ORDER BY r.created_at DESC LIMIT 1`)).rows[0];
ensure(fixture, "Retained completed/voided/replaced fixture required");
const endpoint = `/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.subject_ref}/requirements`;
const response = await fetch(base + endpoint, { headers: { Authorization: `Bearer ${token}` } });
ensure(response.ok, `Requirement API refused: ${response.status}`);
const ledger = await response.json();
const requirement = ledger.requirements.find(r => r.requirement_uuid === fixture.requirement_uuid);
ensure(requirement?.history.length >= 5, "Complete lifecycle history required");
ensure(ledger.activeRequirements.length === 0 && !ledger.outstandingEligible, "Cancelled scope must not be active");
const raw = (await db.query(`SELECT r.requirement_uuid,r.form_version_uuid,r.status,r.current_submission_uuid,
  s.origin,s.requirement_uuid submission_requirement,s.form_version_uuid submission_pin,s.status submission_status,
  h.event,h.before_value->>'status' before_status,h.after_value->>'status' after_status,h.actor_uuid,h.reason,h.recorded_at
  FROM frm_requirements r JOIN frm_company_submissions s ON s.submission_uuid=r.current_submission_uuid
  JOIN frm_requirement_history h ON h.requirement_uuid=r.requirement_uuid
  WHERE r.requirement_uuid=$1 ORDER BY h.recorded_at,h.history_uuid`, [fixture.requirement_uuid])).rows;
ensure(raw.every(r => r.form_version_uuid === r.submission_pin && r.requirement_uuid === r.submission_requirement), "Pin/binding SQL proof");
const browser = await chromium.launch({ headless: true, executablePath: shell("which", ["chromium"]), args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1800 } });
  await context.addInitScript(({ actor, token }) => {
    localStorage.setItem("devAuthToken", token);
    const profile = { personaKey:"crewing-executive",masterUserId:actor.id,userId:String(actor.id),
      role:actor.role,roleId:actor.ruid,userType:actor.user_type,myVessels:[] };
    localStorage.setItem("userProfile",JSON.stringify(profile)); localStorage.setItem("devPersona",JSON.stringify(profile));
  }, { actor, token });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/crew-pool?crew=${fixture.crew_uuid}&section=G`, { waitUntil: "domcontentloaded" });
  const group = page.getByTestId(`crew-company-forms-group-${fixture.subject_ref}`);
  await group.waitFor({ timeout: 45000 });
  if (!(await group.evaluate(element => element.open))) await group.locator(":scope > summary").click();
  const panel = group.getByTestId(`assignment-form-requirements-${fixture.subject_ref}`);
  await panel.getByText("Started", { exact: true }).waitFor({ timeout: 30000 });
  await panel.getByText("Requirement history", { exact: true }).click();
  ensure(await panel.getByText("Open linked form", { exact: true }).isVisible(), "Replacement open action visible");
  ensure(await panel.getByText("Start required form", { exact: true }).count() === 0, "Cancelled fixture has no start action");
  await group.evaluate(element => element.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: `${directory}/closing-requirements.jpg`, fullPage: true, animations: "disabled" });
  const formLoaded = page.waitForResponse(r => r.url().includes(`/${fixture.current_submission_uuid}/form`) && r.status() === 200);
  await panel.getByText("Open linked form", { exact: true }).click();
  const opened = await (await formLoaded).json();
  ensure(opened.submission.formVersionUuid === fixture.form_version_uuid, "Opened replacement must use the requirement pin");
  await page.getByText("Retained requirement evidence", { exact: true }).waitFor();
  await page.screenshot({ path: `${directory}/closing-pinned-form.jpg`, fullPage: true, animations: "disabled" });
  ensure(!errors.length, `Browser errors: ${errors.join("; ")}`);
  ensure(head() === initialHead && pid() === initialPid, "HEAD/PID changed during closing proof");
  await fs.writeFile(`${directory}/closing.json`, JSON.stringify({
    head:initialHead,commitTime,pid:initialPid,processStart,fixture,ledger,raw,opened,errors,
  }, null, 2));
  console.log(JSON.stringify({ head:initialHead,commitTime,pid:initialPid,processStart,requirement:fixture.requirement_uuid,events:raw.length,errors },null,2));
  await context.close();
} finally { await browser.close(); await db.end(); }
