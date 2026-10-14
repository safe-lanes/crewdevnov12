import "./verification-guard.mjs";
// Development-only, test-owned records. Uses the existing managed preview.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium } from "@playwright/test";
const root = ".local/verification/company-permissions";
await fs.mkdir(root, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const save = (name, data) => fs.writeFile(`${root}/${name}`, JSON.stringify(data, null, 2));
function mainPid() {
  const lines = execFileSync("ps", ["-eo","pid=,args="], {encoding:"utf8"}).split("\n")
    .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
  ensure(lines.length===1, "Exactly one managed main backend is required");
  return lines[0].trim().split(/\s+/)[0];
}
const token = actor => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  // Existing development bypass accepts identity-only tokens; never change auth.
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, userType: actor.userType, domain: "test" })}.dev-bypass`;
};
const ensure = (value, message) => { if (!value) throw Error(message); };
async function api(actor, method, path, body, expected) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    Authorization: `Bearer ${token(actor)}`, "Content-Type": "application/json",
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  ensure(response.status === expected, `${method} ${path}: ${response.status} ${text.slice(0,500)}`);
  return text ? JSON.parse(text) : null;
}
async function actor(category, label, vesselId) {
  const roleUuid = randomUUID(), userUuid = randomUUID();
  const role = `TEST ONLY CF PERMISSIONS ${label} ${roleUuid.slice(0,8)}`;
  await db.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
    VALUES ($1,$2,$3,true,false)`, [roleUuid, role, category]);
  const row = (await db.query(`INSERT INTO master_users(user_uuid,user_type,role,fullname,designation,vessel_ids)
    VALUES ($1,$2,$3,$4,'Master',$5) RETURNING id`,
  [userUuid, category, role, `Test-only ${label}`, vesselId ? String(vesselId) : null])).rows[0];
  for (const action of ["view","fill_in","witness","sign_representative","void","void_completed"]) {
    await db.query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES ($1,'company_forms',$2,$3)`, [roleUuid, action, action !== "void_completed" && (category === "Office" || !["sign_representative","void"].includes(action))]);
  }
  // Navigation is separate; no Forms authoring/Access Control grants for actors.
  await db.query(`INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview,cancreate,canedit,candelete,is_deleted)
    SELECT md5($1||muid),$1,muid,true,false,false,false,false FROM adm_menumaster_ac
    WHERE is_active=true AND COALESCE(is_deleted,false)=false
      AND name IN ('Crew Pool','Crew Database','Vessel','Vessel Database')`, [roleUuid]);
  return { id: Number(row.id), role, roleUuid, userUuid, userType: category };
}
async function prepare() {
  const vessel = (await db.query(`SELECT id,vessel_uuid FROM master_vessels
    WHERE vessel_uuid='7440571a-841a-11ed-aa7c-7003bca91a86' AND is_active=true AND is_deleted=false`)).rows[0];
  ensure(vessel, "Approved existing vessel unavailable");
  const office = await actor("Office", "OFFICE", null), ship = await actor("Ship", "VESSEL", vessel.id);
  const admin = (await db.query(`SELECT u.id,u.role,u.user_type AS "userType",r.ruid AS "roleUuid"
    FROM master_users u JOIN adm_rolemaster_ac r ON lower(trim(r.assigned_role))=lower(trim(u.role))
    WHERE u.id=1 AND r.is_active=true AND COALESCE(r.is_deleted,false)=false`)).rows[0];
  ensure(admin, "Existing trusted Access Control editor unavailable");
  const crewUuid = randomUUID(), assignUuid = randomUUID(), formUuid = randomUUID(),
    versionUuid = randomUUID(), partUuid = randomUUID(), sectionUuid = randomUUID();
  await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
    VALUES ($1,$2,'TEST ONLY','CF Permissions','R001',false)`, [crewUuid, `CFP-${crewUuid.slice(0,8)}`]);
  await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,is_deleted)
    VALUES ($1,$2,$3,'Planned',false,false)`, [assignUuid, crewUuid, vessel.vessel_uuid]);
  const form = (await db.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date,is_deleted)
    VALUES ($1,$2,'dynamic','crew_assignment','All','1','2026-10-08',false) RETURNING id`,
  [formUuid, `TEST ONLY COMPANY PERMISSIONS ${formUuid.slice(0,8)}`])).rows[0];
  await db.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,status,stage_key,stage_subject_type,released_at,is_deleted)
    VALUES ($1,$2,'1','2026-10-08','released','before_joining','crew_assignment',now(),false)`, [versionUuid, form.id]);
  await db.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,form_version_uuid,part_code,part_title,part_type,is_office_only,is_deleted)
    VALUES ($1,$2,$3,'P1','Permission verification','configurable',false,false)`, [partUuid, formUuid, versionUuid]);
  await db.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode,signature_officer_required,is_deleted)
    VALUES ($1,$2,$3,'S1','Test-only representative declaration','seafarer',true,false)`, [sectionUuid, versionUuid, partUuid]);
  const fixture = { office, ship, admin, crewUuid, assignUuid, formUuid, versionUuid, sectionUuid, vesselUuid: vessel.vessel_uuid };
  await save("fixture.json", fixture);
  await fs.appendFile("docs/company-form-regression-fixtures.md", `\n### Company Forms independent-permission development fixtures\n\nTest-owned actors, definition and subject created for permission verification; no protected historical declarations modified.\n\n${JSON.stringify(fixture, null, 2)}\n`);
  console.log("Prepared test-owned permission fixtures.");
}
async function verify() {
  const fixture = JSON.parse(await fs.readFile(`${root}/fixture.json`, "utf8"));
  const { office, ship, admin, crewUuid, assignUuid, formUuid, versionUuid, sectionUuid } = fixture;
  const head = execFileSync("git", ["rev-parse","HEAD"], { encoding: "utf8" }).trim();
  const commitAt = execFileSync("git", ["show","-s","--format=%cI","HEAD"], { encoding: "utf8" }).trim();
  const pid = mainPid();
  const startedAt = execFileSync("ps", ["-p",pid,"-o","lstart="], { encoding: "utf8" }).trim();
  if (process.argv.includes("--closing")) ensure(new Date(startedAt) > new Date(commitAt), "Backend must start later than final commit");
  const retained = (await db.query(`SELECT submission_uuid AS "submissionUuid" FROM frm_company_submissions
    WHERE subject_ref=$1 AND form_uuid=$2 AND status='completed' ORDER BY id DESC LIMIT 1`,[assignUuid,formUuid])).rows[0];
  const started = retained || await api(office,"POST",`/api/v2/company-form-submissions/subjects/crew_assignment/${assignUuid}/submissions`,
    { formUuid, formVersionUuid: versionUuid },201);
  const submission = started.submissionUuid, prefix = `/api/v2/company-form-submissions/${submission}`;
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  if (!retained) {
    await api(office,"POST",`${prefix}/sections/${sectionUuid}/signatures`,{signatureType:"officer",method:"officer",data:png},201);
    await api(office,"POST",`${prefix}/sections/${sectionUuid}/submit`,{},200);
  }
  const completed = await api(office,"GET",`${prefix}/form`,undefined,200);
  ensure(completed.submission.status === "completed" && !completed.submission.canVoid, "Initial completed declaration must lack Void completed");
  const report = { head, commitAt, pid, startedAt, submission, checks: [], screenshots: [] };
  const browser = await chromium.launch({ executablePath: execFileSync("which",["chromium"],{encoding:"utf8"}).trim(),
    headless:true,args:["--no-sandbox","--disable-dev-shm-usage"] });
  async function pageFor(actor) {
    const context = await browser.newContext({ ignoreHTTPSErrors:true,viewport:{width:1560,height:1100},
      extraHTTPHeaders:{Authorization:`Bearer ${token(actor)}`} });
    await context.addInitScript(({actor,auth}) => {
      const profile = { personaKey:"crewing-executive",masterUserId:actor.id,userId:String(actor.id),
        role:actor.role,roleId:actor.roleUuid,userType:actor.userType,myVessels:[] };
      for(const key of ["userProfile","devPersona"]) localStorage.setItem(key,JSON.stringify(profile));
      localStorage.setItem("devAuthToken",auth);
    },{actor,auth:token(actor)});
    return context.newPage();
  }
  try {
    const page = await pageFor(office);
    async function open() {
      await page.goto(`${base}/crew-pool?crew=${crewUuid}&section=G`,{waitUntil:"domcontentloaded"});
      const group = page.getByTestId(`crew-company-forms-group-${assignUuid}`);
      await group.locator("summary").click({timeout:45000});
      await page.getByTestId(`crew-company-forms-open-${submission}`).click({timeout:45000});
      await page.getByTestId("crew-company-form-viewer").getByText(completed.form.formName,{exact:false}).first().waitFor();
    }
    await open();
    await page.getByTestId("company-form-void-refusal").waitFor();
    const denied = await page.evaluate(async prefix=>{
      const r=await fetch(`${prefix}/void`,{method:"POST",headers:{"Content-Type":"application/json",
        Authorization:`Bearer ${localStorage.getItem("devAuthToken")}`},body:JSON.stringify({reason:"Test-only refused completed void"})});
      return {status:r.status,text:await r.text()};
    },prefix);
    ensure(denied.status===403 && denied.text.includes("Void completed"),"Observable completed void refusal required");
    const deniedShot = `${root}/completed-void-refused.jpg`;
    await page.screenshot({path:deniedShot}); report.screenshots.push(deniedShot);
    report.checks.push({name:"completed-void-refused",status:403});
    const editor = await pageFor(admin);
    await editor.goto(`${base}/admin`,{waitUntil:"domcontentloaded"});
    await editor.getByText("Access Control",{exact:true}).first().click();
    await editor.getByTestId(`role-item-${office.roleUuid}`).click({timeout:45000});
    const checkbox = editor.getByTestId("company-form-grant-void_completed");
    await checkbox.waitFor(); ensure(await checkbox.getAttribute("data-state")==="unchecked","Completed grant initially off");
    await checkbox.click();
    const saving = editor.waitForResponse(r=>r.url().includes(`/roles/${office.roleUuid}/action-permissions`)&&r.request().method()==="PUT");
    await editor.getByTestId("save-company-form-permissions").click();
    ensure((await saving).status()===200,"Access Control grant save must succeed");
    await open();
    await page.locator("#company-form-void-reason").fill("Test-only authorized completed void");
    const allowed = page.waitForResponse(r=>r.url().includes(`${prefix}/void`)&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Void submission",exact:true}).click();
    ensure((await allowed).status()===204,"Completed void after editor grant must succeed");
    ensure((await api(office,"GET",`${prefix}/form`,undefined,200)).submission.status==="voided","Persisted void required");
    const successShot = `${root}/completed-void-authorized.jpg`;
    await page.screenshot({path:successShot}); report.screenshots.push(successShot);
    report.checks.push({name:"same-role-completed-void-after-editor-grant",status:204});
    // Deliberately inappropriate, test-owned grant through the same editor.
    await editor.getByTestId(`role-item-${ship.roleUuid}`).click();
    const representative = editor.getByTestId("company-form-grant-sign_representative");
    await representative.waitFor();
    ensure(await representative.getAttribute("data-state")==="unchecked","Vessel Representative grant initially off");
    await representative.click();
    const shipSaving = editor.waitForResponse(r=>r.url().includes(`/roles/${ship.roleUuid}/action-permissions`)&&r.request().method()==="PUT");
    await editor.getByTestId("save-company-form-permissions").click();
    ensure((await shipSaving).status()===200,"Deliberate Vessel Representative grant must save through Access Control");
    const vesselAssignment = randomUUID();
    await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,is_deleted)
      VALUES ($1,$2,$3,'Planned',false,false)`,[vesselAssignment,crewUuid,fixture.vesselUuid]);
    const vesselSubmission = await api(office,"POST",`/api/v2/company-form-submissions/subjects/crew_assignment/${vesselAssignment}/submissions`,
      {formUuid,formVersionUuid:versionUuid},201);
    const vesselPrefix=`/api/v2/company-form-submissions/${vesselSubmission.submissionUuid}`;
    report.vesselSubmission=vesselSubmission.submissionUuid;
    const vesselPage = await pageFor(ship);
    await vesselPage.goto(`${base}/vessel`,{waitUntil:"domcontentloaded"});
    const attachmentCount = async () => Number((await db.query(`SELECT count(*)::int AS count FROM frm_signature_attachments
      WHERE created_by_uuid IN ($1,$2)`,[String(ship.id),ship.userUuid])).rows[0].count);
    const attachmentsBefore = await attachmentCount();
    const refusal = await vesselPage.evaluate(async ({prefix,sectionUuid,png})=>{
      const r = await fetch(`${prefix}/sections/${sectionUuid}/signatures`,{method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("devAuthToken")}`},
        body:JSON.stringify({signatureType:"officer",method:"officer",data:png})});
      return {status:r.status,text:await r.text()};
    },{prefix:vesselPrefix,sectionUuid,png});
    ensure(refusal.status===403 && refusal.text.includes("Office category"),"Vessel Representative must be categorically denied despite grant");
    ensure((await db.query(`SELECT count(*)::int AS count FROM frm_section_signatures s
      JOIN frm_section_states t ON t.section_state_uuid=s.section_state_uuid WHERE t.submission_uuid=$1`,
      [vesselSubmission.submissionUuid])).rows[0].count===0,"Denied Vessel signing must create no signature");
    const attachmentsAfter = await attachmentCount();
    ensure(attachmentsAfter===attachmentsBefore,"Denied Vessel signing must create no attachment");
    report.checks.push({name:"vessel-representative-grant-categorical-refusal",...refusal,
      signaturesAfter:0,attachmentsBefore,attachmentsAfter});
    ensure(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()===head,"HEAD changed during verification");
    ensure(mainPid()===pid,"Main backend PID changed");
    report.passed=true;
  } finally {
    await db.query(`UPDATE adm_resource_action_grants SET allowed=false
      WHERE resource='company_forms' AND ((role_id=$1 AND action='void_completed') OR (role_id=$2 AND action='sign_representative'))`,[office.roleUuid,ship.roleUuid]);
    await save("preview-evidence.json",report);
    await browser.close();
  }
  console.log(JSON.stringify(report,null,2));
}
try { if(process.argv[2]==="prepare") await prepare(); else await verify(); }
finally { await db.end(); }
