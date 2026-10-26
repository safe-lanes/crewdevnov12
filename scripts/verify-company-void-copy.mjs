import "./verification-guard.mjs";
import fs from "node:fs/promises";
import pg from "pg";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const closing = process.argv.includes("--closing");
const dir = "generated-artifacts/company-void-copy";
await fs.mkdir(dir, { recursive: true });
const manifestPath = "docs/company-forms/pdf-rollout-fixtures.json";
const fixture = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const identity = (await db.query(`SELECT system_identifier::text AS clusterid,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
if (JSON.stringify(identity) !== JSON.stringify(fixture.databaseIdentity)) throw Error("Wrong acceptance database.");
const shell = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const processes = () => shell("ps", ["-eo", "pid=,args="]).split("\n").filter(l => l.includes("server/index.ts") && !/watch|npm| -c /.test(l));
if (processes().length !== 1) throw Error("Expected one main backend.");
const pid = Number(processes()[0].trim().split(/\s+/)[0]);
const report = { head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendPid: pid, backendStart: new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString(),
  errors: [], operations: [] };
if (!closing) {
  try {
    const prior = JSON.parse(await fs.readFile(`${dir}/initial-evidence.json`, "utf8"));
    if (!prior.passed) report.previousAttempt = prior;
  } catch { /* first evidence run */ }
}
if (closing && new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Backend predates HEAD.");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
 JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const enc = x => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id:24,userType:"Office",domain:"test" })}.devsig`;
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const grantPath = `/api/v2/admin/access-control/roles/${actor.ruid}/action-permissions`;
const api = async (path, method = "GET", body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw Error(`Acceptance prerequisite refused (${r.status}).`);
  return r.json();
};
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless:true,
  args:["--no-sandbox","--disable-dev-shm-usage"] });
let page, originalGrants;
try {
  const original = (await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [fixture.submissionUuid])).rows[0];
  const frozen = (await db.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [fixture.submissionUuid])).rows[0];
  if (original.file_sha256 !== fixture.retainedEvidence.frm_document_files[0].file_sha256) throw Error("Fixture original changed.");
  const context = await browser.newContext({ viewport:{width:1560,height:1060}, ignoreHTTPSErrors:true });
  await context.route("**/api/**", route => route.continue({ headers:{...route.request().headers(),
    ...(new URL(route.request().url()).origin === base ? { authorization:`Bearer ${token}` } : {})} }));
  await context.addInitScript(({actor,token}) => {
    const profile = { personaKey:"crewing-executive",masterUserId:actor.id,userId:String(actor.id),
      role:actor.role,roleId:actor.ruid,userType:actor.user_type,myVessels:[] };
    localStorage.setItem("userProfile",JSON.stringify(profile));
    localStorage.setItem("devPersona",JSON.stringify(profile)); localStorage.setItem("devAuthToken",token);
  }, { actor,token });
  page = await context.newPage();
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("response", r => {
    if (r.url().includes("/company-form-submissions/") && r.request().method() === "POST")
      report.operations.push({ path:new URL(r.url()).pathname,status:r.status() });
  });
  const openGroup = async () => {
    await page.goto(`${base}/crew-pool?crew=${fixture.crewUuid}&section=G`,{waitUntil:"domcontentloaded"});
    const group = page.getByTestId(`crew-company-forms-group-${fixture.assignmentUuid}`);
    await group.waitFor({timeout:90000});
    if (!await group.evaluate(el=>el.open)) await group.locator(":scope > summary").click();
    return group;
  };
  const open = async () => {
    const group = await openGroup();
    await group.getByTestId(`crew-company-forms-open-${fixture.submissionUuid}`).click();
    const viewer = page.getByTestId("crew-company-form-viewer"); await viewer.waitFor({timeout:30000}); return viewer;
  };
  const confirmAction = async (button, suffix) => {
    page.once("dialog", dialog=>dialog.accept());
    const [response] = await Promise.all([page.waitForResponse(r=>r.request().method()==="POST" &&
      new URL(r.url()).pathname.endsWith(suffix)),button.click()]);
    if (response.status() !== 201) throw Error("Handover failed.");
  };
  const state = (await db.query("SELECT status FROM frm_company_submissions WHERE submission_uuid=$1",[fixture.submissionUuid])).rows[0];
  if (!closing && state.status === "completed") {
    originalGrants = (await api(grantPath)).grants;
    await api(grantPath,"PUT",{grants:{...originalGrants,void_completed:true}});
    report.temporaryVoidGrant = { roleUuid:actor.ruid,before:originalGrants.void_completed,after:true };
    let viewer = await open();
    await viewer.getByRole("button",{name:"Copy handed to seafarer",exact:true}).waitFor({timeout:45000});
    const prior = (await db.query("SELECT 1 FROM frm_document_handovers WHERE submission_uuid=$1",[fixture.submissionUuid])).rowCount;
    if (!prior) await confirmAction(viewer.getByRole("button",{name:"Copy handed to seafarer",exact:true}),"/pdf/handover");
    await viewer.locator("#company-form-void-reason").fill("Registered fixture verification: original copy handed over; issue an immutable void notice.");
    const [response] = await Promise.all([page.waitForResponse(r=>r.request().method()==="POST" &&
      new URL(r.url()).pathname.endsWith(`/${fixture.submissionUuid}/void`)),
      viewer.getByRole("button",{name:"Void submission",exact:true}).click()]);
    if (response.status() !== 204) throw Error("Fixture void failed.");
    await viewer.getByText(/The void notice has not been handed over\./).waitFor({timeout:45000});
    await viewer.getByRole("button",{name:"Void notice handed to seafarer",exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${dir}/reminder-before-handover.jpg`});
    // Restore the ordinary role's original grant immediately; handover uses Fill in, not Void completed.
    await api(grantPath,"PUT",{grants:originalGrants}); originalGrants = null;
    report.grantRestored = true;
  }
  if (!closing && !(await db.query("SELECT 1 FROM frm_document_void_handovers WHERE submission_uuid=$1",[fixture.submissionUuid])).rowCount) {
    const viewer = await open();
    await viewer.getByText(/The void notice has not been handed over\./).waitFor({timeout:45000});
    await viewer.getByRole("button",{name:"Void notice handed to seafarer",exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${dir}/reminder-before-handover.jpg`});
    await confirmAction(viewer.getByRole("button",{name:"Void notice handed to seafarer",exact:true}),"/pdf/void-notice-handover");
    await viewer.getByText("Current notice",{exact:false}).waitFor();
    await page.screenshot({path:`${dir}/handover-recorded.jpg`});
  }
  const viewer = await open();
  await viewer.getByRole("button",{name:"Download void notice copy",exact:true}).waitFor({timeout:45000});
  await viewer.getByRole("button",{name:"Download void notice copy",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${closing?"closing-":""}void-copy-controls.jpg`});
  const [download] = await Promise.all([page.waitForEvent("download"),
    viewer.getByRole("button",{name:"Download void notice copy",exact:true}).click()]);
  await download.saveAs(`${dir}/fixture-void-copy.pdf`);
  const [popup] = await Promise.all([page.waitForEvent("popup"),viewer.getByRole("button",{name:"Print void notice copy",exact:true}).click()]);
  await popup.waitForURL(/^blob:/,{timeout:30000,waitUntil:"domcontentloaded"}); await popup.close();
  const group = await openGroup();
  await group.getByText(/Void notice copy handed to seafarer by/).waitFor({timeout:30000});
  if (await group.getByText(/The void notice has not been handed over\./).count()) throw Error("G3 reminder did not clear.");
  await group.getByText(/Void notice copy handed to seafarer by/).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${closing?"closing-":""}g3-handover.jpg`});
  const copies = (await db.query(`SELECT f.file_uuid,f.notice_uuid,f.file_sha256,f.original_file_sha256,f.page_count,
    n.revision,n.evidence FROM frm_document_void_files f JOIN frm_document_void_notices n USING(notice_uuid)
    WHERE n.submission_uuid=$1 ORDER BY n.revision`,[fixture.submissionUuid])).rows;
  const handovers = (await db.query("SELECT * FROM frm_document_void_handovers WHERE submission_uuid=$1",[fixture.submissionUuid])).rows;
  if (!handovers.length || handovers.at(-1).file_sha256 !== copies.at(-1).file_sha256) throw Error("Handover does not match annotated file.");
  const sha = createHash("sha256").update(await fs.readFile(`${dir}/fixture-void-copy.pdf`)).digest("hex");
  if (sha !== copies.at(-1).file_sha256) throw Error("Downloaded copy differs from archive.");
  if (JSON.stringify((await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1",[fixture.submissionUuid])).rows[0]) !== JSON.stringify(original)) throw Error("Original archive changed.");
  if (JSON.stringify((await db.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1",[fixture.submissionUuid])).rows[0]) !== JSON.stringify(frozen)) throw Error("Frozen record changed.");
  report.copies = copies; report.handovers = handovers; report.originalUnchanged = true; report.frozenUnchanged = true;
  report.documentReference = await (await api(`/api/v2/company-form-submissions/${fixture.submissionUuid}/pdf/status`)).documentReference;
  if (!closing) {
    fixture.voidCopyEvidence = { copies,handovers,originalHandovers:(await db.query("SELECT * FROM frm_document_handovers WHERE submission_uuid=$1",[fixture.submissionUuid])).rows };
    await fs.writeFile(manifestPath,JSON.stringify(fixture,null,2)+"\n");
  }
  if (report.errors.length || report.operations.some(o=>o.status>=400)) throw Error("Browser failure.");
  if (Number(processes()[0].trim().split(/\s+/)[0]) !== pid || shell("git",["rev-parse","HEAD"]) !== report.head) throw Error("Main process or HEAD changed.");
  report.passed = true;
} catch(error) {
  report.failure = error.message; report.passed = false;
  if (page) await page.screenshot({path:`${dir}/failure.jpg`}).catch(()=>{});
} finally {
  if (originalGrants) {
    await api(grantPath,"PUT",{grants:originalGrants}); report.grantRestored = true;
  }
  await fs.writeFile(`${dir}/${closing?"closing":"initial"}-evidence.json`,JSON.stringify(report,null,2));
  await browser.close(); await db.end();
}
console.log(JSON.stringify(report,null,2));
if (!report.passed) process.exit(1);
