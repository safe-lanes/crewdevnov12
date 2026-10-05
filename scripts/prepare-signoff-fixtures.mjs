// Approved retained development fixtures only; never modify vessel masters,
// configured ranks, existing Planning rows, or protected signed declarations.
import { db, api, read, write, insert, clone, register, snapshot, protectedCheck, ensure, randomUUID, fs, root } from "./signoff-verification-common.mjs";
const tag = "TEST ONLY SIGNOFF";
const journal = await read("fixtures.json").catch(() => ({ createdAt: new Date().toISOString(), actors: {}, crews: [], forms: [],
  retention: "Retain every synthetic record; Sync All may remove test users/roles. Runtime actors have no Forms authoring grant." }));
await write("fixtures.json", journal);
const old = JSON.parse(await fs.readFile(".local/verification/joining-declaration-retained-fixtures.json", "utf8"));
const initial = await read("protected-before-setup.json").catch(async () => { const value = await snapshot(); await write("protected-before-setup.json", value); return value; });
const vessel = (await db.query("SELECT id,vessel,vessel_uuid FROM master_vessels WHERE vessel_uuid=$1 AND is_active=true AND is_deleted=false",
  ["7440571a-841a-11ed-aa7c-7003bca91a86"])).rows[0];
ensure(vessel, "Approved existing vessel 03 unavailable; STOP");
journal.vessel = vessel;
const setup = (await db.query("SELECT id,user_type,role FROM master_users WHERE id=1")).rows[0];
const author = { id: setup.id, userType: setup.user_type, role: setup.role };
async function actor(key, type, designation, vesselIds, roleKey = key) {
  if (journal.actors[key]) return journal.actors[key];
  let roleUuid = journal.actors[roleKey]?.roleUuid;
  const role = `${tag} ${roleKey.toUpperCase()}`;
  if (!roleUuid) {
    roleUuid = randomUUID();
    const row = await insert("adm_rolemaster_ac", { ruid: roleUuid, assigned_role: role, roletype: type, is_active: true, is_deleted: false, sort_order: 980 });
    await register(`role ${key}`, { roleUuid: row.ruid, role });
    const routes = type === "Office" ? ["/crew-pool","/crew-pool/crew-database","/vessel","/vessel/vessel-database","/rotation","/rotation/rotation-plan"]
      : ["/vessel","/vessel/vessel-database","/vessel/officer-matrix","/crew-pool","/crew-pool/crew-database"];
    const menus = (await db.query("SELECT muid,route,name FROM adm_menumaster_ac WHERE is_active=true AND is_deleted=false")).rows;
    for (const menu of menus.filter(m => routes.includes(m.route))) {
      const grant = await insert("adm_roleaccess_ac", { rauid: randomUUID(), role_id: roleUuid, menu_id: menu.muid,
        canview: true, canedit: type === "Office" || menu.route.startsWith("/vessel"), cancreate: type === "Office", candelete: false });
      await register(`operational grant ${key}`, { grantUuid: grant.rauid, roleUuid, menuUuid: menu.muid, menu: menu.name });
    }
  }
  const user = await insert("master_users", { user_uuid: randomUUID(), fullname: `${tag} ${key.toUpperCase()}`,
    firstname: tag, lastname: key.toUpperCase(), display_name: `${tag} ${key.toUpperCase()}`,
    user_type: type, role, designation, vessel_ids: vesselIds ?? "" });
  const result = { id: user.id, userUuid: user.user_uuid, roleUuid, role, userType: type, vesselUuid: vessel.vessel_uuid };
  journal.actors[key] = result; await write("fixtures.json", journal); await register(`actor ${key}`, result);
  return result;
}
try {
  const office = await actor("office", "Office", `${tag} Crewing Representative`, "");
  const master = await actor("master", "Ship", "Master", String(vessel.id));
  await actor("masterTwo", "Ship", "Master", String(vessel.id), "master");
  await actor("wrongVessel", "Ship", "Master", "1", "master");
  await actor("unprovisioned", "Ship", "Master", "", "master");
  await actor("wrongRole", "Ship", "Chief Engineer", String(vessel.id));
  journal.permissions = {};
  for (const [key, runtime] of Object.entries(journal.actors)) {
    const grants = await api(runtime, "GET", "/api/v2/admin/access-control/my-permissions");
    journal.permissions[key] = grants;
    const list = Array.isArray(grants) ? grants : grants.permissions ?? [];
    ensure(!list.some(g => (g.menuName === "Forms" || g.route === "/admin/forms") && (g.canview || g.cancreate || g.canedit || g.candelete)), `${key} has forbidden Forms authoring grants`);
    await api(runtime, "GET", "/api/v2/admin/forms", undefined, 403);
  }
  const scenarios = [
    ["original","R001","Master"], ["unfinished","R002","Chief Officer"], ["dualOffice","R003","2nd Officer"],
    ["late","R005","Chief Engineer"], ["viewers","R006","2nd Engineer"], ["reliever","R008","4th Engineer"],
  ];
  if (process.argv[2] === "fresh-original") scenarios.push(["originalRetry","R007","3rd Engineer"]);
  if (process.argv[2] === "review-fresh") scenarios.push(
    ["reviewOriginal","R010","Electrical Officer"], ["reviewUnfinished","R012","Deck Cadet"],
    ["reviewOffice","R014","Bosun"], ["reviewLate","R015","AB_1"], ["reviewReliever","R016","OS_1"],
  );
  if (process.argv[2] === "review-final") scenarios.push(
    ["reviewLateFinal","R015","AB_2"], ["reviewOfficeFinal","R015","AB_3"],
    ["reviewRelieverFinal","R016","OS_2"],
  );
  for (const [key, rankId, rank] of scenarios) {
    let fixture = journal.crews.find(c => c.key === key);
    if (fixture?.signedOnAt || fixture?.plannedOnly) continue;
    if (!fixture) {
    // Reject ALL existing rows, including archived/deleted. No slot clearing.
    const occupied = await db.query("SELECT plan_uuid FROM vessel_planning_v2 WHERE vessel_uuid=$1 AND rank=$2", [vessel.vessel_uuid, rank]);
    ensure(!occupied.rowCount, `${vessel.vessel}/${rank} already has a Planning row; STOP`);
    const revisions = (await db.query("SELECT revision_data FROM adm_vessel_revisions_v2 WHERE vessel_id=$1 AND is_deleted=false ORDER BY id DESC LIMIT 1", [vessel.vessel_uuid])).rows;
    const configured = revisions.length ? JSON.parse(revisions[0].revision_data) : [];
    ensure(configured.some(r => r.rankId === rankId &&
      (r.isRoleRow ? r.role === rank : !r.hasMultiple && r.rank === rank) && r.actualManningFlag),
      `${rank} is not actually configured; STOP`);
    const crewUuid = randomUUID(), draftUuid = randomUUID(), entryUuid = randomUUID();
    fixture = { key, crewUuid, draftUuid, entryUuid, rankId, rank, vesselUuid: vessel.vessel_uuid, vesselName: vessel.vessel,
      name: `${tag} ${key.toUpperCase()} SEAFARER` };
    journal.crews.push(fixture); await write("fixtures.json", journal); await register(`crew and Rotation ${key}`, fixture);
    await clone("crew_members_v2", "crew_uuid", old.seafarer.crewUuid, { crew_uuid: crewUuid,
      first_name: `${tag} ${key.toUpperCase()}`, middle_name: "", family_name: "SEAFARER",
      emp_no: `${tag}-${key}`, employee_id: `${tag}-${key}`, present_rank: rankId });
    await clone("rotation_drafts_v2", "draft_uuid", old.rotationDraftUuid, { draft_uuid: draftUuid, draft_id: `${tag}-${key}-${Date.now()}` });
    await clone("rotation_entries_v2", "entry_uuid", old.rotationEntryUuid, { entry_uuid: entryUuid, draft_uuid: draftUuid,
      vessel_uuid: vessel.vessel_uuid, crew_uuid: crewUuid, rank, rank_id: rankId, proposal_status: "Proposed",
      sign_on_date: new Date().toISOString().slice(0,10), deployed_date: null, deployed_by_uuid: null,
      deployed_to_plan_uuid: null, current_crew_uuid: null });
    const deployed = await api(office, "POST", `/api/v2/rotation/entries/${entryUuid}/deploy`, { deployedByUuid: String(office.id), auditUserUuid: String(office.id) });
    ensure(deployed.success && deployed.planUuid, "Normal deployment did not insert a new Planning row");
    fixture.planUuid = deployed.planUuid;
    const planning = (await db.query("SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid=$1", [fixture.planUuid])).rows[0];
    fixture.assignmentUuid = planning.reliever_assign_uuid;
    await write("fixtures.json", journal); await register(`exact deployment ${key}`, fixture);
    }
    const { crewUuid } = fixture;
    ensure(fixture.planUuid && fixture.assignmentUuid, "Incomplete retained deployment needs inspection; do not create a replacement");
    await api(master, "GET", `/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.assignmentUuid}/submissions`);
    await api(office, "GET", `/api/v2/company-form-submissions/subjects/crew_assignment/home/${crewUuid}/submissions`);
    if (key === "reliever" || key === "reviewReliever" || key === "reviewRelieverFinal") {
      fixture.plannedOnly = true; await write("fixtures.json", journal); continue;
    }
    const onboard = await api(master, "POST", `/api/v2/vessel/planning/${fixture.planUuid}/sign-on`, {
      signOnDate: new Date().toISOString().slice(0,10), signOnPort: "TEST ONLY PORT", contractPeriodMonths: 1,
      contractEndRangeStartMonths: 1, contractEndRangeEndMonths: 2 });
    ensure(onboard.crewAssignUuid === fixture.assignmentUuid && onboard.crewUuid === crewUuid, "Sign-on lost the exact incumbent assignment link");
    await api(master, "GET", `/api/v2/company-form-submissions/subjects/crew_assignment/${fixture.assignmentUuid}/eligible-forms?stageKey=at_sign_off`);
    fixture.signedOnAt = new Date().toISOString(); await write("fixtures.json", journal);
  }
  if(process.argv[2] === "review-role-slots") {
    const revision=(await db.query("SELECT revision_data FROM adm_vessel_revisions_v2 WHERE vessel_id=$1 AND is_deleted=false ORDER BY id DESC LIMIT 1",[vessel.vessel_uuid])).rows[0];
    const configured=JSON.parse(revision.revision_data);
    for(const [key,rank] of [["reviewLate","AB_1"],["reviewReliever","OS_1"]]) {
      const own=journal.crews.find(c=>c.key===key);
      const existing=await api(master,"GET",`/api/v2/vessel/planning/${own.planUuid}`);
      ensure((existing.crewUuid ?? existing.relieverCrewUuid)===own.crewUuid &&
        (existing.crewAssignUuid ?? existing.relieverAssignUuid)===own.assignmentUuid &&
        existing.vesselUuid===vessel.vessel_uuid,"Only the new exact test-owned row may be corrected");
      ensure(configured.some(r=>r.isRoleRow && r.role===rank && r.rankId===own.rankId && r.actualManningFlag),
        "Exact configured role position is unavailable; STOP");
      const occupied=await db.query("SELECT plan_uuid FROM vessel_planning_v2 WHERE vessel_uuid=$1 AND rank=$2 AND plan_uuid<>$3",
        [vessel.vessel_uuid,rank,own.planUuid]);
      ensure(!occupied.rowCount,"Configured role position is occupied; STOP");
      await api(master,"PATCH",`/api/v2/vessel/planning/${own.planUuid}`,{rank});
      own.rank=rank; await write("fixtures.json",journal);
    }
  }
  const definitions = [
    ["aboard","at_sign_off",false,true], ["ashore","at_sign_off",true,false], ["dual","at_sign_off",true,true],
    ["joining","before_joining",true,false], ["onboard","on_board",false,true],
  ];
  if(process.argv[2] === "review-fresh") definitions.push(["joiningReview","before_joining",true,false]);
  if(process.argv[2] === "review-final") definitions.push(["joiningFinal","before_joining",true,false]);
  for (const [key, stage, officer, management] of definitions) {
    let entry = journal.forms.find(f => f.key === key);
    if (entry?.releasedAt) continue;
    const created = entry ? { form: { id: entry.formId, formUuid: entry.formUuid, name: entry.name },
      version: { id: entry.versionId, fvUuid: entry.versionUuid } } :
      await api(author, "POST", "/api/v2/admin/forms", { name: `${tag} ${key.toUpperCase()} ${journal.createdAt}`, category: "dynamic" }, 201);
    const form = created.form, version = created.version;
    const parts = (await db.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1", [version.fvUuid])).rows;
    const partUuid = parts[0].form_part_uuid, sectionUuid = randomUUID();
    const questions = [
      ["name","Seafarer name","system_field","seafarer_name"], ["rank","Rank","system_field","rank"],
      ["declared","Declaration date","system_field","date_of_declaration"], ["instructions","Declaration instructions","content",null],
      ["answer","Departure notes","free_text",null],
    ].map(([question_code,question_text,response_type,system_field_key]) => ({
      question_code, question_text, response_type, system_field_key,
      ...(response_type === "content" ? { content_html: "<p>TEST ONLY retained declaration.</p>" } : {}),
      comment_enabled: response_type === "free_text", is_mandatory: false, options: [],
    }));
    if (!entry) {
      entry = { key, formId: form.id, formUuid: form.formUuid, versionId: version.id, versionUuid: version.fvUuid,
        partUuid, name: form.name, stage };
      journal.forms.push(entry); await write("fixtures.json", journal); await register(`definition ${key}`, entry);
    }
    await api(author, "PUT", `/api/v2/admin/form-versions/${version.id}`, { stageKey: stage });
    const previous = await api(author, "GET", `/api/v2/admin/form-versions/${version.fvUuid}/parts/${partUuid}/structure`);
    const saved = previous.sections?.length ? previous : await api(author, "PUT", `/api/v2/admin/form-versions/${version.fvUuid}/parts/${partUuid}/structure`, {
      sections: [{ section_code: "SIGNOFF", section_title: `${tag} ${key} signatures`,
        responsible_mode: "seafarer", signature_seafarer_required: true, signature_officer_required: officer,
        signature_vessel_management_required: management, vessel_signature_role_uuids: management ? [master.roleUuid] : [],
        questions }], option_sets: [],
    });
    entry.sectionUuid = saved.sections[0].section_uuid;
    entry.questionUuids = saved.sections[0].questions.map(q => q.question_uuid);
    ensure(entry.sectionUuid && entry.questionUuids.every(Boolean), "Definition API did not return server-generated identifiers");
    await write("fixtures.json", journal); await register(`persisted definition ${key}`, entry);
    await api(author, "POST", `/api/v2/admin/form-versions/${version.id}/release`, {});
    entry.releasedAt = new Date().toISOString(); await write("fixtures.json", journal);
  }
  await protectedCheck(initial);
  if (process.argv[2] === "review-final" && !journal.reviewFinalActivatedAt) {
    journal.activeCrewKeys.late = "reviewLateFinal";
    journal.activeCrewKeys.dualOffice = "reviewOfficeFinal";
    journal.activeCrewKeys.reliever = "reviewRelieverFinal";
    journal.activeFormKeys.joining = "joiningFinal";
    journal.retainedPriorDeclarations = { ...journal.retainedPriorDeclarations,
      priorReviewRelieverOriginal: journal.declarations["reliever-original"],
      priorReviewRelieverReplacement: journal.declarations["reliever-replacement"] };
    delete journal.declarations["reliever-original"];
    delete journal.declarations["reliever-replacement"];
    journal.reviewFinalActivatedAt = new Date().toISOString();
    await write("fixtures.json",journal);
  }
  if (process.argv[2] === "review-fresh" && !journal.reviewSetActivatedAt) {
    journal.retainedPriorDeclarations = journal.declarations;
    journal.declarations = {};
    journal.activeCrewKeys = { original: "reviewOriginal", unfinished: "reviewUnfinished",
      dualOffice: "reviewOffice", late: "reviewLate", reliever: "reviewReliever" };
    journal.activeFormKeys = { joining: "joiningReview" };
    journal.reviewSetActivatedAt = new Date().toISOString();
    await write("fixtures.json",journal);
  }
  if (process.argv[2] === "fresh-original") {
    journal.activeOriginalKey = "originalRetry";
    await write("fixtures.json",journal);
  }
  await write("preflight-passed.json", { at: new Date().toISOString(), actors: journal.actors,
    exactSubjects: journal.crews, releasedVersions: journal.forms, protectedRecordsUnchanged: true });
  console.log("Retained sign-off preflight passed", journal.crews.map(c => ({ vessel: c.vesselName, rank: c.rank, assignmentUuid: c.assignmentUuid })));
} finally { await db.end(); }