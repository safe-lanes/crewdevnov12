import "./verification-guard.mjs";
// Main-preview evidence. Test-owned records are retained; no auth configuration or client records are changed.
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium } from "@playwright/test";
const initial = process.argv.includes("--initial");
const dir = ".local/verification/company-form-stage-triggers";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const ensure = (value, reason) => { if (!value) throw Error(reason); };
const actor = (await db.query("SELECT id,role,user_type FROM master_users WHERE id=24")).rows[0];
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({alg:"none",typ:"JWT"})}.${encode({id:actor.id,userType:actor.user_type,domain:"test"})}.devsig`;
await fs.mkdir(dir, { recursive: true });
let browser, fixture, page;
const report = { head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  operations: [], screenshots: [], checks: [], errors: [] };
const pids = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
ensure(pids.length === 1, "Exactly one main backend process is required.");
report.backendPid = Number(pids[0].trim().split(/\s+/)[0]);
report.backendStart = new Date(shell("ps", ["-p", String(report.backendPid), "-o", "lstart="])).toISOString();
if (!initial) ensure(new Date(report.backendStart) > new Date(report.commitTime), "Closing backend must start after final commit.");
async function retain() {
  if (!fixture) return;
  const refs = new Set([...JSON.stringify(fixture).matchAll(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g)].map(m=>m[0]));
  for (const assignment of [fixture.assignment, fixture.fallback?.assignment, fixture.rankChange?.assignment].filter(Boolean)) {
    const rows = (await db.query(`SELECT row_to_json(e) AS row FROM frm_stage_events e WHERE subject_ref=$1
      UNION ALL SELECT row_to_json(r) FROM frm_resolution_runs r WHERE subject_ref=$1
      UNION ALL SELECT row_to_json(r) FROM frm_requirements r WHERE subject_ref=$1
      UNION ALL SELECT row_to_json(h) FROM frm_requirement_history h WHERE requirement_uuid IN
        (SELECT requirement_uuid FROM frm_requirements WHERE subject_ref=$1)
      UNION ALL SELECT row_to_json(a) FROM frm_stage_attempts a WHERE event_uuid IN
        (SELECT event_uuid FROM frm_stage_events WHERE subject_ref=$1)
      UNION ALL SELECT row_to_json(a) FROM frm_stage_audit a WHERE subject_ref=$1`, [assignment])).rows;
    for (const {row} of rows) for (const value of JSON.stringify(row).matchAll(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g)) refs.add(value[0]);
  }
  await fs.appendFile("docs/company-form-regression-fixtures.md", `\n- Main-preview stage-trigger fixtures retained (${initial ? "initial" : "closing"}): ${[...refs].map(x => `\`${x}\``).join(", ")}. Normal lifecycle operations only; never hard-delete.\n`);
  await fs.writeFile(`${dir}/fixture.json`, JSON.stringify(fixture, null, 2));
}
async function api(method, path, body) {
  const result = await page.evaluate(async ({method,path,body}) => {
    const response = await fetch(path, {method, headers:{"Content-Type":"application/json",
      Authorization:`Bearer ${localStorage.getItem("devAuthToken")}`}, body:body === undefined ? undefined : JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }, {method,path:`/api/v2${path}`,body});
  report.operations.push({method,path,status:result.status});
  ensure(result.status < 400, `${method} ${path}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}
const ledger = assignment => api("GET", `/company-form-submissions/subjects/crew_assignment/${assignment}/requirements`);
async function screen(crew, assignment, name) {
  await page.goto(`${base}/crew-pool?crew=${crew}&section=G`, {waitUntil:"domcontentloaded"});
  const group = page.getByTestId(`crew-company-forms-group-${assignment}`);
  await group.waitFor({timeout:45000});
  if (!(await group.evaluate(el => el.open))) await group.locator(":scope > summary").click();
  const panel = group.getByTestId(`assignment-form-requirements-${assignment}`);
  await panel.getByText(/check · Completed/).first().waitFor({timeout:30000});
  await group.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${name}.jpg`,fullPage:false});
  report.screenshots.push(`${dir}/${name}.jpg`);
}
try {
  if (initial) {
    const source = JSON.parse(await fs.readFile(".local/verification/stage-runtime-fixtures.json", "utf8"));
    fixture = {vessel:randomUUID(), draft:randomUUID(), entry:randomUUID(), revision:randomUUID(),
      crew:randomUUID(), forms:source.forms, rank:source.rank, day:source.day,
      name:`TEST ONLY Browser stage ${randomUUID().slice(0,8)}`};
    await retain(); // Register before any possible partial setup.
    await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
      VALUES($1,$2,'TEST ONLY','Browser stage trigger',$3,false)`, [fixture.crew,`TEST-STAGE-${fixture.crew.slice(0,8)}`,fixture.rank.ar_uuid]);
    await db.query("INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted) VALUES($1,$2,true,false)", [fixture.vessel,fixture.name]);
    await db.query(`INSERT INTO adm_vessel_revisions_v2(vr_uuid,vessel_id,revision,revision_date,revision_data,is_deleted)
      VALUES($1,$2,'TEST ONLY',$3,$4,false)`, [fixture.revision,fixture.vessel,fixture.day,
      JSON.stringify([{id:fixture.rank.ar_uuid,rankId:fixture.rank.ar_uuid,rank:fixture.rank.name,sortOrder:1,officer:true}])]);
    await db.query(`INSERT INTO rotation_drafts_v2(draft_uuid,draft_id,plan_from_date,plan_to_date,plan_status,is_deleted)
      VALUES($1,$2,$3,$3,'Proposed',false)`, [fixture.draft,fixture.name,fixture.day]);
    await db.query(`INSERT INTO rotation_entries_v2(entry_uuid,draft_uuid,vessel_uuid,rank_id,rank,crew_uuid,
      sign_on_date,contract_period,proposal_status,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,4,'Proposed',false)`,
      [fixture.entry,fixture.draft,fixture.vessel,fixture.rank.ar_uuid,fixture.rank.name,fixture.crew,fixture.day]);
  } else fixture = JSON.parse(await fs.readFile(`${dir}/fixture.json`, "utf8"));
  if (process.argv.includes("--register-related")) {
    const source = JSON.parse(await fs.readFile(".local/verification/stage-runtime-fixtures.json", "utf8"));
    fixture.fallback = source.failed;
    fixture.rankChange = source.rankChange;
    await retain();
    // Register generated child records of positively registered fixture roots, including earlier retained trials.
    const registry = await fs.readFile("docs/company-form-regression-fixtures.md", "utf8");
    const roots = [...new Set([...registry.matchAll(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g)].map(m=>m[0]))];
    const children = (await db.query(`SELECT sea_uuid AS uuid FROM crew_sea_service WHERE crew_uuid=ANY($1::text[])
      UNION SELECT archive_uuid FROM rotation_archive_v2 WHERE entry_uuid=ANY($1::text[])`, [roots])).rows;
    await fs.appendFile("docs/company-form-regression-fixtures.md",
      `\n- Retained generated company sea-service and rotation-archive child records of registered fixture roots: ${children.map(r=>`\`${r.uuid}\``).join(", ")}. Register only; no records changed or deleted.\n`);
  }
  browser = await chromium.launch({executablePath:shell("which",["chromium"]),args:["--no-sandbox","--disable-dev-shm-usage"]});
  const context = await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1560,height:1050},
    extraHTTPHeaders:{Authorization:`Bearer ${token}`}});
  await context.addInitScript(({actor,token}) => {
    const p = {personaKey:"crewing-executive",masterUserId:actor.id,userId:String(actor.id),role:actor.role,userType:actor.user_type,myVessels:[]};
    localStorage.setItem("devPersona",JSON.stringify(p));localStorage.setItem("userProfile",JSON.stringify(p));
    localStorage.setItem("devAuthToken",token);
  }, {actor,token});
  page = await context.newPage();
  page.on("pageerror",e => report.errors.push(e.message));
  if (!initial) await page.goto(`${base}/crew-pool?crew=${fixture.crew}&section=G`, {waitUntil:"domcontentloaded"});
  if (initial) {
    await page.goto(`${base}/rotation`, {waitUntil:"domcontentloaded"});
    await page.getByTestId("sidebar-v2-approval").click({timeout:45000});
    const draft = page.getByTestId("input-draft-id-v2").first();
    if (!(await draft.isVisible())) await page.getByTestId("button-toggle-filters-v2").click();
    await draft.fill(fixture.name);
    const checkbox = page.locator(`[data-testid^="checkbox-assignment-v2-"][data-testid*="${fixture.entry}"]`);
    await checkbox.click({timeout:45000});
    const deployment = page.waitForResponse(r => r.url().includes(`/entries/${fixture.entry}/deploy`) && r.request().method()==="POST");
    await page.getByTestId("button-deploy-v2").click();
    const response = await deployment;
    ensure(response.ok(), `Screen Deploy refused: ${await response.text()}`);
    const deployed = await response.json();
    fixture.plan = deployed.planUuid;
    fixture.assignment = (await db.query("SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid=$1",[fixture.plan])).rows[0].reliever_assign_uuid;
    await retain();
    let state = await ledger(fixture.assignment);
    ensure(state.requirements.some(r => r.form_uuid===fixture.forms[0].formUuid), "Deploy must create before-joining requirement.");
    report.checks.push("Deploy clicked through the Approval screen; before-joining requirement persisted.");
    await screen(fixture.crew,fixture.assignment,"before-joining");
    await api("POST", `/vessel/planning/${fixture.plan}/sign-on`, {signOnDate:fixture.day});
    state = await ledger(fixture.assignment);
    ensure(state.requirements.some(r => r.form_uuid===fixture.forms[1].formUuid), "Sign-on must create on-board requirement.");
    await screen(fixture.crew,fixture.assignment,"on-board");
    await api("PATCH", `/vessel/planning/${fixture.plan}`, {reliefStatus:"Planned"});
    const planned = await ledger(fixture.assignment);
    const beforeCycle = planned.stageChecks.stages.find(s=>s.stage_key==="at_sign_off");
    ensure(planned.requirements.some(r=>r.form_uuid===fixture.forms[2].formUuid), "Planned must create sign-off requirement.");
    await screen(fixture.crew,fixture.assignment,"relief-planned");
    await api("PATCH", `/vessel/planning/${fixture.plan}`, {reliefStatus:"Confirmed"});
    ensure((await ledger(fixture.assignment)).stageChecks.stages.find(s=>s.stage_key==="at_sign_off").event_uuid===beforeCycle.event_uuid,
      "Planned to Confirmed must not resolve again.");
    await api("POST", `/vessel/planning/${fixture.plan}/defer-relief`, {reason:"TEST ONLY Browser evidence: voyage extended"});
    const deferred = await ledger(fixture.assignment);
    ensure(deferred.requirements.some(r=>r.form_uuid===fixture.forms[2].formUuid && r.status==="WITHDRAWN"), "Deferral must withdraw unstarted requirement.");
    await screen(fixture.crew,fixture.assignment,"relief-deferred");
    await api("PATCH", `/vessel/planning/${fixture.plan}`, {reliefStatus:"Planned"});
    const replanned = await ledger(fixture.assignment);
    ensure(replanned.stageChecks.stages.find(s=>s.stage_key==="at_sign_off").cycle_uuid!==beforeCycle.cycle_uuid, "Replanning must run a fresh cycle.");
    await screen(fixture.crew,fixture.assignment,"relief-replanned");
    report.checks.push("Real sign-on, first Planned, Confirmed deduplication, reasoned deferral and fresh replan API operations; their persisted UI displayed in the main preview.");
    fixture.legacy = (await db.query(`SELECT e.subject_ref,a.crew_uuid FROM frm_stage_events e
      JOIN crew_assignments a ON a.assign_uuid=e.subject_ref JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid
      WHERE e.source='go_live' AND e.stage_key='on_board' AND a.is_current AND a.assignment_type='OnBoard'
        AND NOT a.is_deleted AND c.first_name LIKE 'TEST%'
        AND NOT EXISTS(SELECT 1 FROM frm_requirements r WHERE r.subject_ref=e.subject_ref)
      LIMIT 1`)).rows[0];
    ensure(fixture.legacy, "Retained pre-go-live onboard fixture with no requirements is required.");
  }
  const current = await ledger(fixture.assignment);
  ensure(current.stageChecks.enforcementEnabled, "This tenant must have completed its own activation.");
  ensure(current.stageChecks.stages.every(s=>s.outcome==="COMPLETED" && !s.deferred), "All current cycles are complete.");
  await screen(fixture.crew,fixture.assignment,"closing-current-stages");
  const legacy = await ledger(fixture.legacy.subject_ref);
  ensure(legacy.requirements.length===0, "Pre-go-live onboard fixture must have no retrospective requirements.");
  ensure(legacy.stageChecks.stages.some(s=>s.stage_key==="on_board" && s.source==="go_live" && s.outcome==="COMPLETED"),
    "Its current stage must be opened by a recorded go-live check.");
  await screen(fixture.legacy.crew_uuid,fixture.legacy.subject_ref,"closing-legacy-open");
  ensure(await page.getByTestId(`assignment-form-requirements-${fixture.legacy.subject_ref}`).getByText("The completed stage check found no forms that apply.").count()>0,
    "Main preview must distinguish a completed empty check from never checked.");
  report.checks.push("Existing onboard fixture: current stage open, recorded empty go-live check, zero requirements.");
  ensure(fixture.fallback && fixture.rankChange, "Register retained fallback and rank-change browser subjects before the final commit.");
  const fallback = await ledger(fixture.fallback.assignment);
  ensure(fallback.stageChecks.stages.some(s=>s.stage_key==="at_sign_off" && s.source==="sign_off" && s.outcome==="COMPLETED"),
    "Actual sign-off without qualifying relief must resolve at sign-off.");
  await screen(fixture.fallback.crew,fixture.fallback.assignment,"closing-sign-off-without-relief");
  ensure((await db.query("SELECT event_uuid FROM frm_stage_events WHERE subject_ref=$1 AND stage_key='at_sign_off'",
    [fixture.rankChange.assignment])).rows.length===0, "Rank-change sign-off must create no at-sign-off event.");
  await screen(fixture.rankChange.crew,fixture.rankChange.assignment,"closing-rank-change-excluded");
  report.checks.push("Retained real-operation subjects shown in G3: sign-off fallback resolves at sign-off; rank-change sign-off has no at-sign-off event (SQL verified).");
  report.rawSql = (await db.query(`SELECT e.event_uuid,e.stage_key,e.source,e.business_date,e.actor_uuid,
    a.outcome,a.run_uuid FROM frm_stage_events e JOIN frm_stage_attempts a USING(event_uuid)
    WHERE e.subject_ref=$1 ORDER BY e.recorded_at,a.recorded_at`, [fixture.assignment])).rows;
  ensure(report.errors.length===0, `Browser errors: ${report.errors.join("; ")}`);
  ensure(shell("git",["rev-parse","HEAD"])===report.head,"HEAD changed during browser evidence.");
  ensure(shell("ps",["-p",String(report.backendPid),"-o","args="]).includes("server/index.ts"),"Backend changed during browser evidence.");
  report.passed = true;
} catch (error) {
  report.error = error.message;
  if (page) { await fs.writeFile(`${dir}/failure-dom.txt`,await page.locator("body").innerText()); await page.screenshot({path:`${dir}/failure.jpg`}); }
  throw error;
} finally {
  if (initial) await retain(); // Closing read-only checks do not change the registered fixture manifest.
  await fs.writeFile(`${dir}/${initial?"initial":"closing"}-evidence.json`,JSON.stringify(report,null,2));
  if (browser) await browser.close();
  await db.end();
}
