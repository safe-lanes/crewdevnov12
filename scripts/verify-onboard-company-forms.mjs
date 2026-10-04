// Development-only retained-fixture acceptance against the managed main app.
// Does not change authentication settings, original records, or on-board status.
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium } from "@playwright/test";

const mode = process.argv[2];
const root = ".local/verification";
const manifestPath = `${root}/onboard-retained-fixtures.json`;
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const apiEvidence=[];
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const headers = actor => ({
  Authorization: `Bearer ${encode({ alg: "none", typ: "JWT" })}.${encode({
    id: actor.id, userType: actor.userType ?? "Ship", role: actor.role,
    roleId: actor.roleUuid, vessels: [actor.vesselUuid],
  })}.devsig`, "Content-Type": "application/json",
});
async function request(actor, method, path, body, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: headers(actor),
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  apiEvidence.push({actorId:actor.id,method,path,status:response.status,expected});
  if (!(Array.isArray(expected)?expected:[expected]).includes(response.status)) throw Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const write = (name, data) => fs.writeFile(`${root}/${name}`, JSON.stringify(data, null, 2));
async function insert(table, data) {
  const fields = Object.keys(data);
  await db.query(`INSERT INTO "${table}" (${fields.map(f => `"${f}"`).join(",")}) VALUES (${fields.map((_, i) => `$${i+1}`).join(",")})`,
    fields.map(field => data[field]));
}
async function clone(table, where, overrides, serial = true) {
  const source = (await db.query(`SELECT * FROM "${table}" WHERE ${where} LIMIT 1`)).rows[0];
  if (!source) throw Error(`No test-owned clone source for ${table}`);
  const row = { ...source, ...overrides };
  if (serial) delete row.id;
  await insert(table, row);
}
async function protectedCheck() {
  const baseline = JSON.parse(await fs.readFile(`${root}/onboard-protected-before.json`, "utf8"));
  const result = {};
  for (const [table, originals] of Object.entries({ ...baseline.tables, ...baseline.released })) {
    for (const original of originals) {
      const actual = (await db.query(`SELECT to_jsonb(t) AS value FROM "${table}" t WHERE id=$1`, [original.id])).rows[0]?.value;
      if (!actual) throw Error(`Protected ${table}/${original.id} disappeared`);
      for (const key of Object.keys(original)) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(original[key])) {
          throw Error(`Protected ${table}/${original.id}/${key} changed`);
        }
      }
    }
    result[table] = originals.length;
  }
  await write("onboard-protected-comparison.json", { checkedAt: new Date().toISOString(), unchanged: result });
  return result;
}
async function prepare() {
  try { await fs.access(manifestPath); throw Error("Retained fixture already exists; reuse it rather than replacing it."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const old = JSON.parse(await fs.readFile(`${root}/joining-declaration-retained-fixtures.json`, "utf8"));
  const vessels = (await db.query("SELECT id,vessel_uuid,vessel FROM master_vessels WHERE is_active=true AND is_deleted=false ORDER BY id")).rows;
  const vessel = vessels.find(v => v.vessel_uuid === old.vesselUuid), other = vessels.find(v => v.vessel_uuid !== old.vesselUuid);
  if (!vessel || !other) throw Error("Expected existing fixture vessels are unavailable.");
  const savedJournal = await fs.readFile(`${root}/onboard-setup-journal.json`, "utf8").then(JSON.parse).catch(error => {
    if (error.code === "ENOENT") return null; throw error;
  });
  const roleUuid = savedJournal?.roleUuid ?? randomUUID();
  if (!savedJournal && (await db.query("SELECT 1 FROM adm_rolemaster_ac WHERE lower(assigned_role)='master' AND is_active=true AND is_deleted=false")).rowCount) {
    throw Error("Master role now exists; inspect its ownership instead of creating a duplicate.");
  }
  if (!savedJournal) await insert("adm_rolemaster_ac", { ruid: roleUuid, assigned_role: "Master", roletype: "Ship" });
  const journal = savedJournal ?? { roleUuid, actors: [], crewUuid: null, draftUuid: null, entryUuid: null };
  await write("onboard-setup-journal.json", journal);
  const secondRole = (await db.query("SELECT ruid FROM adm_rolemaster_ac WHERE assigned_role='Vessel Admin' AND roletype='Ship' AND is_active=true AND is_deleted=false")).rows[0].ruid;
  const nonpermittedRole = (await db.query("SELECT ruid,assigned_role FROM adm_rolemaster_ac WHERE assigned_role='Vessel User' AND roletype='Ship' AND is_active=true AND is_deleted=false")).rows[0];
  for (const menu of (await db.query("SELECT muid FROM adm_menumaster_ac WHERE route IN ('/vessel','/vessel/vessel-database','/crew-pool/crew-database','/admin/forms') AND is_active=true AND is_deleted=false")).rows) {
    if ((await db.query("SELECT 1 FROM adm_roleaccess_ac WHERE role_id=$1 AND menu_id=$2", [roleUuid,menu.muid])).rowCount) continue;
    await insert("adm_roleaccess_ac", { rauid: randomUUID(), role_id: roleUuid, menu_id: menu.muid,
      canview: true, canedit: true, cancreate: false, candelete: false });
  }
  const actors = {};
  for (const [key, name, own, role, id] of [
    ["master", "TEST ONLY ONBOARD MASTER ONE", vessel, "Master", roleUuid],
    ["masterTwo", "TEST ONLY ONBOARD MASTER TWO", vessel, "Master", roleUuid],
    ["wrongVessel", "TEST ONLY OTHER VESSEL MASTER", other, "Master", roleUuid],
    ["wrongRole", "TEST ONLY NONPERMITTED VESSEL USER", vessel, nonpermittedRole.assigned_role, nonpermittedRole.ruid],
    ["missingScope", "TEST ONLY UNSCOPED MASTER", null, "Master", roleUuid],
  ]) {
    const previous = journal.actors.find(actor => actor.name === name);
    if (previous) { actors[key] = previous; continue; }
    const uuid = randomUUID();
    const user = (await db.query(`INSERT INTO master_users(user_uuid,fullname,display_name,firstname,lastname,user_type,designation,role,vessel_ids)
      VALUES($1,$2,$2,$2,'','Ship','Master',$3,$4) RETURNING id`, [uuid, name, role, own ? String(own.id) : ""])).rows[0];
    actors[key] = { id: user.id, userUuid: uuid, name, role, roleUuid: id, vesselUuid: own?.vessel_uuid ?? vessel.vessel_uuid };
    journal.actors.push(actors[key]); await write("onboard-setup-journal.json", journal);
  }
  const crewUuid = journal.crewUuid ?? randomUUID(), draftUuid = journal.draftUuid ?? randomUUID(), entryUuid = journal.entryUuid ?? randomUUID();
  Object.assign(journal, { crewUuid, draftUuid, entryUuid }); await write("onboard-setup-journal.json", journal);
  await clone("crew_members_v2", `crew_uuid='${old.seafarer.crewUuid}'`, {
    crew_uuid: crewUuid, first_name: "TEST ONLY ONBOARD",
    family_name: "SEAFARER", middle_name: "", emp_no: "TEST-ONBOARD-DECLARATION",
    present_rank: "R002", employee_id: "TEST-ONBOARD-DECLARATION",
  });
  // New normal Rotation draft/entry, then normal deployment creates the
  // planned assignment and exact planning link. Existing slots are untouched.
  if ((await db.query("SELECT 1 FROM vessel_planning_v2 WHERE vessel_uuid=$1 AND rank='Chief Officer' AND is_deleted=false AND is_archived=false", [vessel.vessel_uuid])).rowCount) {
    throw Error("Chief Officer slot is occupied; do not replace or clear it.");
  }
  await clone("rotation_drafts_v2", `draft_uuid='${old.rotationDraftUuid}'`, {
    draft_uuid: draftUuid, draft_id: `TEST-ONBOARD-${Date.now()}`,
  });
  await clone("rotation_entries_v2", `entry_uuid='${old.rotationEntryUuid}'`, {
    entry_uuid: entryUuid, draft_uuid: draftUuid, vessel_uuid: vessel.vessel_uuid,
    crew_uuid: crewUuid, rank: "Chief Officer", sign_on_date: new Date().toISOString().slice(0, 10),
    rank_id: "R002", proposal_status: "Proposed", deployed_date: null, deployed_by_uuid: null,
    deployed_to_plan_uuid: null, current_crew_uuid: null,
  });
  const office = { id: old.actor.masterUserId, role: old.actor.roleName, userType: "Office" };
  const deployment = await request(office, "POST", `/api/v2/rotation/entries/${entryUuid}/deploy`,
    { deployedByUuid: String(office.id), auditUserUuid: String(office.id) });
  if (!deployment.success || !deployment.planUuid) throw Error(`Normal deployment failed: ${JSON.stringify(deployment)}`);
  const planning = (await db.query("SELECT * FROM vessel_planning_v2 WHERE plan_uuid=$1", [deployment.planUuid])).rows[0];
  const fixture = { createdAt: new Date().toISOString(), vesselUuid: vessel.vessel_uuid, vesselName: vessel.vessel,
    actors, roleUuid, secondRole, crewUuid, crewName: "TEST ONLY ONBOARD SEAFARER", draftUuid, entryUuid,
    planUuid: planning.plan_uuid, assignmentUuid: planning.reliever_assign_uuid, forms: [], office,
    retention: "Keep all synthetic actors, permissions, crew, deployment, definitions, declarations, signatures and evidence. No fixture cleanup." };
  // Save immediately so interrupted setup remains traceable and retained.
  await write("onboard-retained-fixtures.json", fixture);
  await definitions();
  await protectedCheck();
  console.log("Prepared retained fixture", { actors: Object.values(actors).map(a => a.id), assignmentUuid: fixture.assignmentUuid, planUuid: fixture.planUuid, forms: fixture.forms });
}

async function definitions() {
  const fixture = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const today = new Date().toISOString().slice(0,10);
  const systemKeys = (await db.query("SELECT DISTINCT system_field_key FROM frm_questions WHERE response_type='system_field' AND system_field_key IS NOT NULL")).rows.map(r => r.system_field_key);
  for (let index=fixture.forms.length; index<2; index++) {
    const name = `TEST ONLY ONBOARD ${index ? "HANDOVER" : "DECLARATION"}`;
    let form = (await db.query("SELECT id,form_uuid FROM adm_forms_v2 WHERE name=$1", [name])).rows[0];
    if (!form) {
      const uuid=randomUUID();
      await insert("adm_forms_v2", { form_uuid:uuid,name,category:"dynamic",rank_group:"All Ranks",
        version_no:"1",version_date:today,subject_type:"crew_assignment" });
      form=(await db.query("SELECT id,form_uuid FROM adm_forms_v2 WHERE form_uuid=$1",[uuid])).rows[0];
    }
    const versionUuid=randomUUID(),partUuid=randomUUID(),sectionUuid=randomUUID();
    await insert("adm_form_versions_v2", { fv_uuid:versionUuid,form_id:form.id,version_no:"1",version_date:today,
      status:"released",released_at:new Date(),stage_key:"on_board",stage_subject_type:"crew_assignment" });
    await insert("frm_form_parts", { form_part_uuid:partUuid,form_uuid:form.form_uuid,form_version_uuid:versionUuid,
      part_code:"A",part_title:"On-board declaration",part_type:"configurable",is_office_only:false,sort_order:0 });
    await insert("frm_sections", { section_uuid:sectionUuid,form_version_uuid:versionUuid,form_part_uuid:partUuid,
      section_code:"S1",section_title:"On-board signatures",responsible_mode:"seafarer",signature_seafarer_required:true,
      signature_vessel_management_required:true,vessel_signature_role_uuids:[fixture.roleUuid,fixture.secondRole] });
    for (const key of systemKeys.filter(k=>["full_name","name","seafarer_name","date_of_declaration","rank"].includes(k))) {
      await insert("frm_questions",{question_uuid:randomUUID(),section_uuid:sectionUuid,question_code:key,
        question_text:key.replaceAll("_"," "),response_type:"system_field",system_field_key:key});
    }
    fixture.forms.push({ formId:form.id,formUuid:form.form_uuid,versionUuid,partUuid,sectionUuid,name });
    await write("onboard-retained-fixtures.json",fixture);
  }
  console.log("Retained definitions", fixture.forms);
  await protectedCheck();
}

async function position() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  if ((await db.query("SELECT 1 FROM vessel_planning_v2 WHERE vessel_uuid=$1 AND rank='Master' AND is_deleted=false AND is_archived=false",[fixture.vesselUuid])).rowCount) {
    throw Error("Configured Master slot is occupied; never replace it for verification.");
  }
  fixture.retainedExtraPlanning={entryUuid:fixture.entryUuid,planUuid:fixture.planUuid,assignmentUuid:fixture.assignmentUuid,
    reason:"Vacant Chief Officer deployment succeeded, but this vessel's UI profile does not contain that position. Retained, not cleared or deleted."};
  const pending=(await db.query("SELECT entry_uuid FROM rotation_entries_v2 WHERE draft_uuid=$1 AND rank='Master' AND proposal_status='Proposed'",[fixture.draftUuid])).rows;
  if (pending.length>1) throw Error("Ambiguous test-owned pending Master entries.");
  const entryUuid=fixture.pendingMasterEntryUuid ?? pending[0]?.entry_uuid ?? randomUUID();
  fixture.pendingMasterEntryUuid=entryUuid;
  await write("onboard-retained-fixtures.json",fixture);
  const matrix=(await db.query("SELECT muid FROM adm_menumaster_ac WHERE route='/vessel/officer-matrix' AND is_active=true AND is_deleted=false")).rows[0];
  if (!(await db.query("SELECT 1 FROM adm_roleaccess_ac WHERE role_id=$1 AND menu_id=$2",[fixture.roleUuid,matrix.muid])).rowCount) {
    await insert("adm_roleaccess_ac",{rauid:randomUUID(),role_id:fixture.roleUuid,menu_id:matrix.muid,canview:true,canedit:true});
  }
  await db.query(`UPDATE adm_roleaccess_ac SET canview=false,canedit=false,cancreate=false,candelete=false
    WHERE role_id=$1 AND menu_id IN (SELECT muid FROM adm_menumaster_ac WHERE route='/admin/forms')`,[fixture.roleUuid]);
  await db.query("UPDATE crew_members_v2 SET present_rank='R001' WHERE crew_uuid=$1",[fixture.crewUuid]);
  if (!(await db.query("SELECT 1 FROM rotation_entries_v2 WHERE entry_uuid=$1",[entryUuid])).rowCount) {
    await clone("rotation_entries_v2",`entry_uuid='${fixture.entryUuid}'`,{entry_uuid:entryUuid,rank:"Master",rank_id:"R001",
      proposal_status:"Proposed",deployed_date:null,deployed_by_uuid:null,deployed_to_plan_uuid:null,current_crew_uuid:null});
  }
  const result=await request(fixture.office,"POST",`/api/v2/rotation/entries/${entryUuid}/deploy`,
    {deployedByUuid:String(fixture.office.id),auditUserUuid:String(fixture.office.id)});
  if (!result.success) throw Error(`Configured-slot deployment refused: ${JSON.stringify(result)}`);
  const planning=(await db.query("SELECT plan_uuid,reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid=$1",[result.planUuid])).rows[0];
  Object.assign(fixture,{entryUuid,planUuid:planning.plan_uuid,assignmentUuid:planning.reliever_assign_uuid,rank:"Master",rankId:"R001"});
  await write("onboard-retained-fixtures.json",fixture);
  await protectedCheck();
  console.log("Normal deployment into the configured, vacant Master slot",fixture.planUuid,fixture.assignmentUuid);
}

async function launch(actor, fixture) {
  const browser = await chromium.launch({ executablePath: execFileSync("which",["chromium"],{encoding:"utf8"}).trim(), headless:true,args:["--no-sandbox"] });
  const context = await browser.newContext({ ignoreHTTPSErrors:true,viewport:{width:1560,height:1000},extraHTTPHeaders:headers(actor) });
  await context.addInitScript(({actor,fixture,token})=>{
    const vessel={vessel:fixture.vesselName,vesselId:actor.vesselUuid,imoNumber:""};
    const state={personaKey:"vessel-admin",masterUserId:actor.id,role:actor.role,roleId:actor.roleUuid,
      userType:"Ship",designation:"Master",vessel};
    localStorage.setItem("userProfile",JSON.stringify({role:actor.role,roleId:actor.roleUuid,userId:String(actor.id),
      userType:"Ship",designation:"Master",myVessels:[vessel]}));
    localStorage.setItem("devAuthToken",token);
    localStorage.setItem("devPersona",JSON.stringify(state));
    localStorage.setItem("devLastVesselId",actor.vesselUuid);
  },{actor,fixture,token:headers(actor).Authorization.slice(7)});
  const page=await context.newPage();
  await page.goto(`${base}/vessel`,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#root")?.textContent?.trim(),{timeout:30000});
  await page.waitForTimeout(2500);
  return {browser,context,page};
}

async function explore() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  await request(fixture.actors.master,"GET",`/api/v2/vessel/planning/${fixture.planUuid}`);
  const subject=`/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.assignmentUuid}`;
  await request(fixture.actors.master,"POST",`${subject}/submissions`,
    {formUuid:fixture.forms[0].formUuid,formVersionUuid:fixture.forms[0].versionUuid},403);
  await request(fixture.actors.wrongVessel,"GET",`${subject}/submissions`,undefined,403);
  await request(fixture.actors.missingScope,"GET",`${subject}/submissions`,undefined,403);
  const {browser,page}=await launch(fixture.actors.master,fixture);
  try {
    await write("onboard-explore-root-dom.txt",await page.locator("body").innerText());
    // The normal vessel-detail entry is available to the trusted Ship actor.
    const rows=page.getByRole("row").filter({hasText:fixture.vesselName});
    if (await rows.count()) await rows.first().getByRole("button").first().click();
    await page.getByTestId("tab-planning").click();
    await page.locator(`[data-plan-uuid="${fixture.planUuid}"]`).click();
    await page.waitForTimeout(1000);
    await fs.writeFile(`${root}/onboard-sign-on-screen.txt`,await page.locator("body").innerText());
    console.log("Normal Ship sign-on screen",await page.getByRole("dialog").innerText());
  } catch (error) {
    await fs.writeFile(`${root}/onboard-explore-failure-dom.txt`,await page.locator("body").innerText());
    await page.screenshot({path:`${root}/onboard-explore-failure.png`,fullPage:true});
    throw error;
  } finally {await browser.close();}
}

async function configuration() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  const user=(await db.query("SELECT id,user_type,role FROM master_users WHERE id=1")).rows[0];
  const author={id:user.id,userType:user.user_type,role:user.role};
  const draft=await request(author,"POST",`/api/v2/admin/forms/${fixture.forms[0].formId}/versions`,
    {versionNo:"02",versionDate:"03-Oct-2026",configuration:"{}",stageKey:"on_board"});
  ensure(draft.fvUuid,"Version creation must return its stable UUID");
  fixture.clonedDraftVersionUuid=draft.fvUuid;fixture.clonedDraftVersionId=draft.id;fixture.author=author;
  await write("onboard-retained-fixtures.json",fixture);
  const copied=(await db.query("SELECT section_uuid,signature_vessel_management_required,vessel_signature_role_uuids FROM frm_sections WHERE form_version_uuid=$1",[draft.fvUuid])).rows;
  ensure(copied.length===1&&copied[0].signature_vessel_management_required,"Version clone lost the distinct third signature");
  ensure(JSON.stringify(copied[0].vessel_signature_role_uuids)===JSON.stringify([fixture.roleUuid,fixture.secondRole]),"Version clone lost multiple pinned role IDs");
  await request(author,"PUT",`/api/v2/admin/form-versions/${draft.id}`,{stageKey:"before_joining"});
  await request(author,"POST",`/api/v2/admin/form-versions/${draft.id}/release`,{},400);
  await request(author,"PUT",`/api/v2/admin/form-versions/${draft.id}`,{stageKey:"on_board"});
  await write("onboard-configuration-api.json",{checkedAt:new Date().toISOString(),draftVersionUuid:draft.fvUuid,
    copied,apiEvidence,checks:["Normal version creation cloned the multi-role policy and third signature","Before-joining release refused Vessel Management","Original released version unchanged"]});
  await protectedCheck();console.log("Configuration API checks passed",draft.fvUuid);
}

async function cancellation() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  const old=JSON.parse(await fs.readFile(`${root}/joining-declaration-retained-fixtures.json`,"utf8"));
  const extra=fixture.retainedExtraPlanning.assignmentUuid;
  const path=`/api/v2/company-form-submissions/subjects/crew_assignment/${extra}`;
  const definition=old.eligibleReadAsTestActor[0];
  const saved=await request(fixture.office,"POST",`${path}/submissions`,
    {formUuid:definition.formUuid,formVersionUuid:definition.formVersionUuid},201);
  fixture.cancelledSubmissionUuid=saved.submissionUuid;await write("onboard-retained-fixtures.json",fixture);
  await request(fixture.office,"PATCH",`/api/v2/crew-pool/crew/${fixture.crewUuid}/assignments/${extra}`,
    {assignmentType:"Cancelled",isCurrent:false});
  const history=await request(fixture.office,"GET",`${path}/submissions`);
  const row=history.submissions.find(s=>s.submissionUuid===saved.submissionUuid);
  ensure(row&&row.canEdit===false,"Cancelled assignment must retain read-only history");
  await request(fixture.office,"GET",`/api/v2/company-form-submissions/${saved.submissionUuid}/form`);
  await request(fixture.office,"POST",`${path}/submissions`,
    {formUuid:definition.formUuid,formVersionUuid:definition.formVersionUuid},[403,409]);
  await write("onboard-cancelled-history-api.json",{checkedAt:new Date().toISOString(),submissionUuid:saved.submissionUuid,
    assignmentUuid:extra,readOnlyHistory:row,apiEvidence});
  await protectedCheck();console.log("Normal cancellation retained read-only history",saved.submissionUuid);
}

async function freshClosingFixture() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  if(fixture.rank==="Chief Engineer")throw Error("Fresh closing fixture already retained; never recreate it.");
  for(const actor of Object.values(fixture.actors)){
    const scope=actor.id===fixture.actors.missingScope.id?"":String((await db.query(
      "SELECT id FROM master_vessels WHERE vessel_uuid=$1",[actor.vesselUuid])).rows[0].id);
    await db.query("UPDATE master_users SET vessel_ids=$1 WHERE id=$2 AND user_uuid=$3",[scope,actor.id,actor.userUuid]);
  }
  const countPath="/api/v2/company-form-submissions/subjects/crew_assignment/submission-counts";
  await request(fixture.actors.master,"POST",countPath,{subjectRefs:[fixture.assignmentUuid],stageKey:"on_board"});
  if((await db.query("SELECT 1 FROM vessel_planning_v2 WHERE vessel_uuid=$1 AND rank='Chief Engineer' AND is_deleted=false AND is_archived=false",[fixture.vesselUuid])).rowCount){
    throw Error("Chief Engineer slot occupied; never clear it.");
  }
  fixture.retainedJoinedFixtures=[...(fixture.retainedJoinedFixtures??[]),{
    crewUuid:fixture.crewUuid,entryUuid:fixture.entryUuid,planUuid:fixture.planUuid,assignmentUuid:fixture.assignmentUuid,
    rank:fixture.rank,reason:"Normal Master browser sign-on succeeded; subsequent count refusal exposed incorrectly JSON-formatted synthetic provisioning. Retained without resetting sign-on."}];
  const crewUuid=randomUUID(),entryUuid=randomUUID();
  await clone("crew_members_v2",`crew_uuid='${fixture.crewUuid}'`,{
    crew_uuid:crewUuid,first_name:"TEST ONLY CLOSING ONBOARD",family_name:"SEAFARER",middle_name:"",
    emp_no:"TEST-ONBOARD-CLOSING",employee_id:"TEST-ONBOARD-CLOSING",present_rank:"R005",
  });
  await clone("rotation_entries_v2",`entry_uuid='${fixture.entryUuid}'`,{
    entry_uuid:entryUuid,crew_uuid:crewUuid,rank:"Chief Engineer",rank_id:"R005",proposal_status:"Proposed",
    deployed_date:null,deployed_by_uuid:null,deployed_to_plan_uuid:null,current_crew_uuid:null,
  });
  const result=await request(fixture.office,"POST",`/api/v2/rotation/entries/${entryUuid}/deploy`,
    {deployedByUuid:String(fixture.office.id),auditUserUuid:String(fixture.office.id)});
  ensure(result.success&&result.planUuid,"Fresh configured-slot deployment must succeed");
  const plan=(await db.query("SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid=$1",[result.planUuid])).rows[0];
  Object.assign(fixture,{crewUuid,crewName:"TEST ONLY CLOSING ONBOARD SEAFARER",entryUuid,
    planUuid:result.planUuid,assignmentUuid:plan.reliever_assign_uuid,rank:"Chief Engineer",rankId:"R005"});
  await write("onboard-retained-fixtures.json",fixture);
  await request(fixture.actors.master,"POST",countPath,{subjectRefs:[fixture.assignmentUuid],stageKey:"on_board"});
  await request(fixture.actors.master,"POST",`/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.assignmentUuid}/submissions`,
    {formUuid:fixture.forms[0].formUuid,formVersionUuid:fixture.forms[0].versionUuid},403);
  await protectedCheck();console.log("Fresh normal Chief Engineer deployment; trusted CSV scope verified",fixture.planUuid,fixture.assignmentUuid);
}

async function retainedPumpmanFixture() {
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  const original=JSON.parse(await fs.readFile(`${root}/joining-declaration-retained-fixtures.json`,"utf8"));
  const plan=(await db.query("SELECT * FROM vessel_planning_v2 WHERE plan_uuid=$1",[original.planUuid])).rows[0];
  ensure(plan&&!plan.crew_uuid&&plan.reliever_crew_uuid===original.seafarer.crewUuid&&plan.reliever_assign_uuid===original.assignmentUuid,
    "Use only the original test-owned planned Pumpman deployment; never replace occupied or other reliever positions");
  const assignment=(await db.query("SELECT assignment_type,is_current FROM crew_assignments WHERE assign_uuid=$1",[original.assignmentUuid])).rows[0];
  ensure(assignment.assignment_type==="Planned"&&!assignment.is_current,"Retained Pumpman must still be legitimately Planned");
  const crew=(await db.query("SELECT first_name,middle_name,family_name FROM crew_members_v2 WHERE crew_uuid=$1",[original.seafarer.crewUuid])).rows[0];
  fixture.retainedJoinedFixtures.push({crewUuid:fixture.crewUuid,entryUuid:fixture.entryUuid,planUuid:fixture.planUuid,
    assignmentUuid:fixture.assignmentUuid,rank:fixture.rank,submissionUuid:fixture.primarySubmissionUuid,
    reason:"Normal Master sign-on and witnessed Seafarer capture passed; driver expected 403 for an unconfigured Company Representative, correctly refused with 400. All rows retained."});
  Object.assign(fixture,{crewUuid:original.seafarer.crewUuid,crewName:[crew.first_name,crew.middle_name,crew.family_name].filter(Boolean).join(" "),
    entryUuid:original.rotationEntryUuid,planUuid:original.planUuid,assignmentUuid:original.assignmentUuid,rank:original.rank,rankId:original.rankId});
  delete fixture.primarySubmissionUuid;
  await write("onboard-retained-fixtures.json",fixture);
  await request(fixture.actors.master,"POST","/api/v2/company-form-submissions/subjects/crew_assignment/submission-counts",
    {subjectRefs:[fixture.assignmentUuid],stageKey:"on_board"});
  await request(fixture.actors.master,"POST",`/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.assignmentUuid}/submissions`,
    {formUuid:fixture.forms[0].formUuid,formVersionUuid:fixture.forms[0].versionUuid},403);
  await protectedCheck();console.log("Retained test-owned Pumpman deployment verified; before-joining frozen records untouched",fixture.planUuid);
}

const ensure=(condition,message)=>{if(!condition)throw Error(message);};
async function closing() {
  const previous=await fs.readFile(`${root}/onboard-closing-browser.json`,"utf8").then(JSON.parse).catch(error=>{
    if(error.code==="ENOENT")return null;throw error;
  });
  if(previous)await write(`onboard-closing-${previous.startedAt.replace(/[:.]/g,"-")}.json`,previous);
  const fixture=JSON.parse(await fs.readFile(manifestPath,"utf8"));
  const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const commitDate=execFileSync("git",["show","-s","--format=%cI","HEAD"],{encoding:"utf8"}).trim();
  const mainLine=execFileSync("ps",["-eo","pid,lstart,args"],{encoding:"utf8"}).split("\n")
    .find(line=>line.includes("tsx/dist/loader.mjs server/index.ts"));
  ensure(mainLine,"Main backend not found");
  const fields=mainLine.trim().split(/\s+/),backendPid=Number(fields[0]);
  const backendStart=new Date(fields.slice(1,6).join(" ")+" UTC");
  ensure(backendStart>new Date(commitDate),"Main backend must start later than final commit");
  const report={head,commitDate,backendPid,backendStart:backendStart.toISOString(),startedAt:new Date().toISOString(),
    actor:fixture.actors.master.id,network:[],checks:[],screenshots:[],retainedSubmissions:[]};
  const {browser,page}=await launch(fixture.actors.master,fixture);
  const prefix="/api/v2/company-form-submissions";
  const subject=`${prefix}/subjects/crew_assignment/${fixture.assignmentUuid}`;
  let checkingForms=false;
  const forbiddenAdmin=[];
  page.on("response",response=>{
    const path=new URL(response.url()).pathname;
    if(path.startsWith(prefix)){
      const token=response.request().headers().authorization?.split(" ")[1];
      const actorId=token?JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()).id:null;
      report.network.push({path,method:response.request().method(),status:response.status(),actorId});
    }
    if(checkingForms&&path.startsWith("/api/v2/admin/"))forbiddenAdmin.push(path);
  });
  await fs.mkdir("screenshots/onboard",{recursive:true});
  const shot=async name=>{const path=`screenshots/onboard/${name}.png`;await page.screenshot({path,fullPage:true});report.screenshots.push(path);};
  const form=uuid=>request(fixture.actors.master,"GET",`${prefix}/${uuid}/form`);
  const openList=async()=>{
    await page.getByRole("button",{name:"Crew List",exact:true}).click();
    ensure(await page.getByTestId("crew-list-forms-header").count()===1,"Exactly one Forms column is required");
    const count=page.getByTestId(`button-crew-forms-${fixture.assignmentUuid}`);
    await count.waitFor(); await count.click();
    await page.getByTestId("onboard-company-forms").waitFor();
  };
  const start=async definition=>{
    await page.getByTestId("select-onboard-form-version").selectOption(definition.versionUuid);
    const pending=page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname===`${subject}/submissions`);
    await page.getByTestId("button-start-onboard-form").click();
    const response=await pending;ensure(response.ok(),`Start failed: ${await response.text()}`);
    const saved=await response.json();ensure(saved.submissionUuid,"Saved submission UUID is required");
    report.retainedSubmissions.push(saved.submissionUuid);
    await page.getByTestId("configured-form-live").waitFor({state:"attached"});
    return saved.submissionUuid;
  };
  const sign=async(sectionUuid,type)=>{
    const toggle=page.getByTestId(`button-preview-section-toggle-${sectionUuid}`);
    if(await toggle.getAttribute("aria-expanded")==="false")await toggle.click();
    const block=page.getByTestId(`preview-signature-${type}-${sectionUuid}`);
    if(type==="seafarer")await block.getByRole("checkbox").check();
    const pad=page.getByTestId(`live-signature-${type}-${sectionUuid}`),canvas=pad.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();ensure(b,"Visible signature canvas required");
    await page.mouse.move(b.x+30,b.y+35);await page.mouse.down();
    for(const[x,y]of[[65,18],[93,65],[125,27],[160,85],[210,42],[245,68]])await page.mouse.move(b.x+x,b.y+y,{steps:5});
    await page.mouse.up();
    const pending=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith(`/sections/${sectionUuid}/signatures`));
    await pad.getByRole("button",{name:"Save signature",exact:true}).click();
    const response=await pending;ensure(response.ok(),`Signature failed: ${await response.text()}`);
    const body=response.request().postDataJSON();
    await block.locator("canvas").waitFor({state:"detached"});
    return body;
  };
  const submit=async(uuid,sectionUuid)=>{
    const pending=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().endsWith(`/sections/${sectionUuid}/submit`));
    await page.getByTestId(`preview-section-footer-${sectionUuid}`).getByRole("button",{name:/^Submit( section)?$/i}).click();
    await page.getByTestId(`briefing-section-dialog-${sectionUuid}`).getByRole("button",{name:"Submit",exact:true}).click();
    const response=await pending;ensure(response.ok(),`Section submit failed: ${await response.text()}`);
    const status=(await db.query("SELECT status FROM frm_company_submissions WHERE submission_uuid=$1",[uuid])).rows[0].status;
    ensure(status==="completed","Required sections must auto-complete, without a Complete button");
    ensure(!(await page.getByRole("button",{name:/^Complete$/i}).count()),"No separate Complete button");
  };
  try{
    // Normal Ship sign-on, not a database status write or an Office substitute.
    const rows=page.getByRole("row").filter({hasText:fixture.vesselName});
    if(await rows.count())await rows.first().getByRole("button").first().click();
    await page.getByTestId("tab-planning").click();
    await page.locator(`[data-plan-uuid="${fixture.planUuid}"]`).click();
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.getByRole("option",{name:"Signed On",exact:true}).click();
    await page.getByTestId("button-joining-date").click();
    await page.locator("button").filter({hasText:new RegExp(`^${new Date().getUTCDate()}$`)}).last().click();
    const signed=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes(`/planning/${fixture.planUuid}/sign-on`));
    await page.getByTestId("button-submit-relief").click();
    const signOnResponse=await signed;ensure(signOnResponse.ok(),`Normal Master sign-on failed: ${await signOnResponse.text()}`);
    const assignment=(await db.query("SELECT assignment_type,is_current FROM crew_assignments WHERE assign_uuid=$1",[fixture.assignmentUuid])).rows[0];
    ensure(assignment.assignment_type==="OnBoard"&&assignment.is_current,"Normal sign-on must preserve the exact persisted assignment");
    report.checks.push("Normal vessel 02 Master sign-on preserved the linked assignment");
    checkingForms=true;
    await openList();await shot("01-zero-count-and-picker");
    const primary=await start(fixture.forms[0]);
    fixture.primarySubmissionUuid=primary;await write("onboard-retained-fixtures.json",fixture);
    const signaturePath=`${prefix}/${primary}/sections/${fixture.forms[0].sectionUuid}/signatures`;
    const witnessed=await sign(fixture.forms[0].sectionUuid,"seafarer");
    const snapshots=(await db.query("SELECT field_key,value,system_value FROM frm_company_submission_system_snapshots WHERE submission_uuid=$1",[primary])).rows;
    ensure(snapshots.length===2,"First witnessed signature must freeze every System point");
    await write("onboard-first-event-freeze.json",{submissionUuid:primary,at:new Date().toISOString(),snapshots});
    await shot("02-witnessed-seafarer-signature");
    const vmBody={...witnessed,signatureType:"vessel_management",method:"vessel_management"};delete vmBody.seafarerPresent;
    for(const key of["wrongRole","wrongVessel","missingScope"])await request(fixture.actors[key],"POST",signaturePath,vmBody,403);
    await request(fixture.actors.master,"POST",signaturePath,{...vmBody,signerName:"FORGED",signerRank:"FORGED",roleId:fixture.secondRole},400);
    await request(fixture.actors.master,"POST",signaturePath,{...vmBody,signatureType:"officer",method:"officer"},[400,403]);
    await request(fixture.actors.master,"POST",`${prefix}/${primary}/void`,{reason:"Vessel users cannot void"},403);
    for(const key of["wrongVessel","missingScope"]){
      await request(fixture.actors[key],"GET",`${prefix}/${primary}/form`,undefined,403);
      await request(fixture.actors[key],"GET",`${prefix}/${primary}/attachments/${randomUUID()}/raw`,undefined,403);
    }
    report.checks.push("Wrong role, wrong vessel, absent trusted scope, forged actor fields, Company Representative and vessel void attempts refused");
    await sign(fixture.forms[0].sectionUuid,"vessel_management");await shot("03-vessel-management-captured-identity");
    const captured=JSON.stringify(await form(primary));
    ensure(captured.includes(fixture.actors.master.name),"Authenticated Master identity must be frozen in the saved model");
    await db.query("UPDATE crew_members_v2 SET first_name='TEST ONLY ONBOARD SOURCE CHANGED' WHERE crew_uuid=$1",[fixture.crewUuid]);
    const changedSnapshots=(await db.query("SELECT field_key,value,system_value FROM frm_company_submission_system_snapshots WHERE submission_uuid=$1",[primary])).rows;
    ensure(JSON.stringify(changedSnapshots)===JSON.stringify(snapshots),"Changed live source must not refresh frozen System points");
    await submit(primary,fixture.forms[0].sectionUuid);await shot("04-auto-completed-read-view");
    report.checks.push("Whole-form first-event snapshots remained immutable; witnessed and Vessel Management signatures auto-completed");
    // Explicit Office void is outside the closing Ship browser. No role switch.
    await request(fixture.office,"POST",`${prefix}/${primary}/void`,{reason:"TEST ONLY retained replacement and historical-link verification"},204);
    await page.getByRole("button",{name:/^(Back|Close)$/i}).last().click();
    const replacement=await start(fixture.forms[0]);fixture.replacementSubmissionUuid=replacement;
    await write("onboard-retained-fixtures.json",fixture);
    await shot("05-readable-replacement-link");
    const replacedForm=await form(replacement);
    const originalLink=replacedForm.replacementHistory.find(link=>link.direction==="replaces");
    ensure(originalLink?.submissionUuid===primary,"Replacement must link to its exact original");
    const link=page.getByRole("button",{name:originalLink.targetLabel,exact:true});
    const text=await link.innerText();ensure(!text.includes(primary),"Historical link text must not expose its UUID");
    await link.click();await page.getByTestId("configured-form-live").waitFor({state:"attached"});
    ensure((await page.locator("body").innerText()).includes("Voided"),"Historical link must open the recorded voided declaration");
    await page.getByRole("button",{name:/^(Back|Close)$/i}).last().click();
    await page.getByTestId("select-onboard-form-version").selectOption(fixture.forms[0].versionUuid);
    await page.getByTestId("button-start-onboard-form").click();
    await sign(fixture.forms[0].sectionUuid,"seafarer");await sign(fixture.forms[0].sectionUuid,"vessel_management");
    await submit(replacement,fixture.forms[0].sectionUuid);
    await page.getByRole("button",{name:/^(Back|Close)$/i}).last().click();await shot("06-count-list-retained-history");
    const count=await request(fixture.actors.master,"POST",`${prefix}/subjects/crew_assignment/submission-counts`,
      {subjectRefs:[fixture.assignmentUuid],stageKey:"on_board"});
    const history=await request(fixture.actors.master,"GET",`${subject}/submissions`);
    ensure(count[fixture.assignmentUuid]===history.submissions.filter(s=>s.stageKey==="on_board"&&s.status!=="voided").length,"Count must equal nonvoided saved on-board declarations only");
    ensure(count[fixture.assignmentUuid]===1,"Voided originals and definitions must not count");
    report.checks.push("One Forms column, zero entry, explicit replacement, actual form/audit link and nonvoided saved count; voided history retained");
    const second=await request(fixture.actors.masterTwo,"POST",`${subject}/submissions`,
      {formUuid:fixture.forms[1].formUuid,formVersionUuid:fixture.forms[1].versionUuid},201);
    fixture.handoverSubmissionUuid=second.submissionUuid;await write("onboard-retained-fixtures.json",fixture);
    const secondSection=`${prefix}/${second.submissionUuid}/sections/${fixture.forms[1].sectionUuid}`;
    await request(fixture.actors.masterTwo,"POST",`${secondSection}/signatures`,witnessed,201);
    await request(fixture.actors.masterTwo,"POST",`${secondSection}/signatures`,vmBody,201);
    await request(fixture.actors.masterTwo,"POST",`${secondSection}/submit`,{});
    const savedSignatures=async()=> (await db.query("SELECT to_jsonb(s) AS value FROM frm_section_signatures s WHERE signed_by_uuid=$1 ORDER BY id",[fixture.actors.masterTwo.userUuid])).rows.map(r=>r.value);
    const before=await savedSignatures();
    ensure(before.length===2&&before.some(s=>s.signature_type==="vessel_management"&&s.signer_name===fixture.actors.masterTwo.name&&s.signer_rank==="Master"),"Second Master must capture its own name/rank, not the current roster or first Master");
    await db.query("UPDATE master_users SET fullname='TEST ONLY HANDOVER IDENTITY CHANGED',designation='Chief Engineer',role=$1 WHERE id=$2",
      [fixture.actors.wrongRole.role,fixture.actors.masterTwo.id]);
    const after=await savedSignatures();ensure(JSON.stringify(before)===JSON.stringify(after),"Handover must never rewrite frozen signer/witness identity");
    const readSecond=await request(fixture.actors.masterTwo,"GET",`${prefix}/${second.submissionUuid}/form`);
    ensure(JSON.stringify(readSecond).includes(fixture.actors.masterTwo.name),"Historical read must use the recorded identity after role/name/rank changes");
    await write("onboard-two-master-handover.json",{firstMaster:fixture.actors.master,secondMaster:fixture.actors.masterTwo,
      firstSubmission:primary,secondSubmission:second.submissionUuid,before,after,changedOnlySyntheticActor:true});
    report.checks.push("Two permitted Masters signed separate records; second Master's later identity/rank/role changes did not alter saved signatures");
    await request(fixture.author,"POST",`/api/v2/admin/forms/${fixture.forms[1].formId}/archive`,{});
    const archivedRead=await request(fixture.actors.master,"GET",`${prefix}/${second.submissionUuid}/form`);
    ensure(JSON.stringify(archivedRead).includes(fixture.actors.masterTwo.name),"Archival must retain readable frozen history");
    const available=await request(fixture.actors.master,"GET",`${subject}/eligible-forms?stageKey=on_board`);
    ensure(!available.some(f=>f.formUuid===fixture.forms[1].formUuid),"Archived forms must leave the manual picker");
    report.checks.push("Archived synthetic form retained readable pinned history and left the eligible picker");
    const countsAfter=await request(fixture.actors.master,"POST",`${prefix}/subjects/crew_assignment/submission-counts`,
      {subjectRefs:[fixture.assignmentUuid],stageKey:"on_board"});
    ensure(countsAfter[fixture.assignmentUuid]===3,"Multiple forms plus void/replacement history must produce the matching saved count");
    await page.getByRole("button",{name:"Refresh forms",exact:true}).click();
    await page.getByText("Saved declarations and retained history (3)",{exact:true}).waitFor();
    await shot("08-multiple-forms-and-retained-history");
    const refusal=await browser.newContext({extraHTTPHeaders:headers(fixture.actors.wrongVessel),ignoreHTTPSErrors:true});
    const deniedPage=await refusal.newPage();
    const denied=await deniedPage.goto(`${base}${prefix}/${primary}/form`);
    ensure(denied.status()===403,"Other vessel's browser must receive a real server permission refusal");
    await deniedPage.screenshot({path:"screenshots/onboard/07-other-vessel-permission-refusal.png",fullPage:true});
    report.screenshots.push("screenshots/onboard/07-other-vessel-permission-refusal.png");await refusal.close();
    ensure(forbiddenAdmin.length===0,`Vessel form operations used Admin endpoints: ${forbiddenAdmin}`);
    ensure(report.network.every(n=>n.actorId===fixture.actors.master.id),"Closing form network must remain the same trusted Master");
    await protectedCheck();
    ensure(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()===head,"HEAD changed during closing browser");
    ensure(execFileSync("ps",["-p",String(backendPid),"-o","args="],{encoding:"utf8"}).includes("server/index.ts"),"Main backend changed during closing browser");
    report.finishedAt=new Date().toISOString();report.passed=true;
  }catch(error){
    report.passed=false;report.error=String(error);await shot(`failure-${report.startedAt.replace(/[:.]/g,"-")}`);
    await fs.writeFile(`${root}/onboard-closing-failure-dom.txt`,await page.locator("body").innerText());
    throw error;
  }finally{
    report.apiEvidence=apiEvidence;
    await write(`onboard-closing-${report.startedAt.replace(/[:.]/g,"-")}.json`,report);
    await write("onboard-closing-browser.json",report);await browser.close();
  }
  console.log("Closing browser passed",report);
}

try {
  if (mode === "prepare") await prepare();
  else if (mode === "definitions") await definitions();
  else if (mode === "position") await position();
  else if (mode === "explore") await explore();
  else if (mode === "closing") await closing();
  else if (mode === "configuration") await configuration();
  else if (mode === "cancellation") await cancellation();
  else if (mode === "fresh-closing-fixture") await freshClosingFixture();
  else if (mode === "retained-pumpman-fixture") await retainedPumpmanFixture();
  else if (mode === "protected") console.log(await protectedCheck());
  else throw Error("Use prepare or protected; browser/API acceptance added in the next implementation batch.");
} finally { await db.end(); }