// Real development-persona browser acceptance against the managed main server.
// No resets, occupied-slot changes, production-auth claims or cleanup.
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { db, api, read, write, register, snapshot, protectedCheck, backend, ensure, git, token, fs, base, prefix, evidence, root } from "./signoff-verification-common.mjs";
import { verifyViewers } from "./signoff-verification-viewers.mjs";
const fixture = await read("fixtures.json"), mode = process.argv[2] ?? "preflight";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const folder = `${root}/${mode}-${stamp}`;
await fs.mkdir(folder, { recursive: true });
const save = (name, data) => fs.writeFile(`${folder}/${name}`, JSON.stringify(data, null, 2));
const crew = key => fixture.crews.find(c => c.key === (fixture.activeCrewKeys?.[key] ?? (key==="original" ? fixture.activeOriginalKey ?? key : key)));
const form = key => fixture.forms.find(f => f.key === (fixture.activeFormKeys?.[key] ?? key));
const home = c => `${prefix}/subjects/crew_assignment/home/${c.crewUuid}/submissions`;
const subject = c => `${prefix}/subjects/crew_assignment/${c.assignmentUuid}`;
const actors = fixture.actors;
const report = { mode, head: git("rev-parse","HEAD"), commitTime: git("show","-s","--format=%cI","HEAD"),
  start: new Date().toISOString(), checks: [], network: [], screenshots: [], passed: false };
let browser, page, currentActor, context, formPhase = false;
let currentUuid;
const pending = [];
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
async function retainedProof(name, predicate) {
  for(const dir of (await fs.readdir(root)).filter(d=>d.startsWith("close-")).sort().reverse()) {
    try {
      const path=`${root}/${dir}/${name}`, value=JSON.parse(await fs.readFile(path,"utf8"));
      if(!predicate(value)) continue;
      const prior=JSON.parse(await fs.readFile(`${root}/${dir}/report.json`,"utf8"));
      ensure(prior.sourceStable && prior.backendStable && prior.formActorsVerified,"Retained evidence was not actor/source/process stable");
      ensure(!git("diff","--name-only",prior.head,"HEAD","--","server","client","shared","tests"),"Runtime/test source changed since retained positive evidence");
      report.checks.push({name:"retained-positive-evidence",path,head:prior.head,backend:prior.backend,applicationAndTestsUnchanged:true});
      return {path,head:prior.head,value};
    } catch(error) {
      if(error.code!=="ENOENT") throw error;
    }
  }
  throw Error(`Required retained positive evidence is missing: ${name}`);
}
async function departed(c) {
  const row=(await db.query("SELECT is_current,sign_off_date FROM crew_assignments WHERE assign_uuid=$1 AND crew_uuid=$2",[c.assignmentUuid,c.crewUuid])).rows[0];
  ensure(row,"Exact synthetic assignment is unavailable");
  return !row.is_current && !!row.sign_off_date;
}
async function frozen(uuid) {
  const result = {};
  for (const table of ["frm_company_submission_system_snapshots","frm_section_states","frm_answers"]) {
    result[table]=(await db.query(`SELECT to_jsonb(t) AS value FROM "${table}" t WHERE submission_uuid=$1 ORDER BY id`,[uuid])).rows;
  }
  result.signatures=(await db.query(`SELECT to_jsonb(s) AS value FROM frm_section_signatures s
    JOIN frm_section_states t ON s.section_state_uuid=t.section_state_uuid WHERE t.submission_uuid=$1 ORDER BY s.id`,[uuid])).rows;
  return result;
}
const processes = backend();
Object.assign(report, { backend: processes });
async function shot(name) {
  const path = `${folder}/${name}.png`;
  await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
}
async function actorPage(actor, url = "/vessel") {
  if (context) await context.close();
  currentActor = actor;
  context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 },
    extraHTTPHeaders: { Authorization: `Bearer ${token(actor)}` } });
  await context.addInitScript(({ actor, auth, vesselName }) => {
    const vessel = { vessel: vesselName, vesselId: actor.vesselUuid, imoNumber: "" };
    const state = { personaKey: actor.userType === "Ship" ? "vessel-admin" : "crewing-executive",
      masterUserId: actor.id, userId: String(actor.id), role: actor.role, roleId: actor.roleUuid,
      userType: actor.userType, designation: actor.userType === "Ship" ? "Master" : "Crewing",
      vessel, myVessels: actor.userType === "Ship" ? [vessel] : [] };
    localStorage.setItem("userProfile", JSON.stringify(state));
    localStorage.setItem("devPersona", JSON.stringify(state)); localStorage.setItem("devAuthToken", auth);
    localStorage.setItem("devLastVesselId", actor.vesselUuid);
  }, { actor, auth: token(actor), vesselName: fixture.vessel.vessel });
  page = await context.newPage();
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith("/api/")) return;
    const entry = { actorId: actor.id, actorRole: actor.role, method: response.request().method(),
      path, status: response.status(), at: new Date().toISOString(), formPhase };
    report.network.push(entry);
    if (path.startsWith(prefix)) {
      pending.push(response.text().then(text => { entry.savedResponse = text; }).catch(() => undefined));
      pending.push(response.request().allHeaders().then(headers => {
        const auth=headers.authorization?.split(" ")[1];
        entry.actualActorId=auth ? JSON.parse(Buffer.from(auth.split(".")[1],"base64url").toString()).id : null;
        entry.savedRequest=response.request().postDataJSON();
      }).catch(error=>{entry.actorEvidenceError=String(error)}));
    }
  });
  page.on("pageerror", error => { (report.pageErrors ??= []).push(String(error)); });
  page.on("requestfailed", request => { (report.failedRequests ??= []).push({ url: request.url(), error: request.failure() }); });
  const response = await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });
  (report.navigation ??= []).push({ actorId: actor.id, url: page.url(), status: response?.status() });
  await page.waitForFunction(() => !!document.querySelector("#root")?.textContent?.trim(), { timeout: 60000 });
}
async function planning(c) {
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  const row = page.locator("tr").filter({ hasText: c.name }).filter({ has: page.locator('[data-testid^="button-edit-onboard-"]') });
  await row.first().waitFor({ state: "visible", timeout: 45000 });
  ensure(await row.count() === 1, `Ambiguous Planning row ${c.name}`);
  await row.locator('[data-testid^="button-edit-onboard-"]').click();
  await page.getByTestId("button-open-signoff-forms").click();
  await page.getByTestId("signoff-company-forms").waitFor({ state: "visible" });
}
async function closeDialog() {
  const dialog = page.getByRole("dialog").first();
  await dialog.locator('button').filter({ has: page.locator('span.sr-only', { hasText: "Close" }) }).last().click();
}
async function startPlanning(c, f) {
  if(await departed(c)) {
    const history=await api(actors.master,"GET",`${subject(c)}/submissions`);
    const matches=history.submissions.filter(s=>s.formUuid===f.formUuid && s.status!=="voided");
    ensure(matches.length===1,"Historical resume requires one exact retained declaration");
    await openProfile(c,matches[0].submissionUuid,actors.master);
    return matches[0].submissionUuid;
  }
  await planning(c);
  await page.getByTestId("select-signoff-form-version").selectOption(f.versionUuid);
  const retained=fixture.declarations?.[`${c.key}-${f.key}`];
  const response = retained ? null : page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `${subject(c)}/submissions`);
  await page.getByTestId("button-start-signoff-form").click();
  const result = retained ? (await api(actors.master,"GET",`${prefix}/${retained}/form`)).submission : await (await response).json();
    ensure(result.subjectRef === c.assignmentUuid && result.formVersionUuid === f.versionUuid, "Start did not retain exact subject/version");
  fixture.declarations ??= {};
  fixture.declarations[`${c.key}-${f.key}`] = result.submissionUuid;
  await write("fixtures.json", fixture);
  await register(`declaration ${c.key}/${f.key}`, { crewUuid: c.crewUuid, assignmentUuid: c.assignmentUuid,
    submissionUuid: result.submissionUuid, versionUuid: f.versionUuid });
  await visible(result.submissionUuid);
  return result.submissionUuid;
}
async function profile(c, actor = actors.office) {
  await actorPage(actor, `/crew-pool?crew=${c.crewUuid}&section=G`);
  await page.getByTestId("crew-company-forms-home").waitFor({ state: "visible", timeout: 45000 });
  const group = page.getByTestId(`crew-company-forms-group-${c.assignmentUuid}`);
  await group.waitFor({ state: "visible" });
  if (await group.getAttribute("open") === null) await group.locator("summary").click();
  return group;
}
async function openProfile(c, uuid, actor = actors.office) {
  await profile(c, actor);
  await page.getByTestId(`crew-company-forms-open-${uuid}`).click();
  await visible(uuid);
}
async function visible(uuid) {
  currentUuid=uuid;
  const metadata = page.getByTestId("company-form-saved-metadata");
  await metadata.waitFor({ state: "visible", timeout: 45000 });
  const contract = await api(currentActor, "GET", `${prefix}/${uuid}/form`);
  await save(`contract-${uuid}-${Date.now()}.json`, contract);
  const status=contract.submission.status === "in_progress" ? "In progress" : contract.submission.status === "voided" ? "Voided" : "Completed";
  await page.waitForFunction(expected=>{
    const text=document.querySelector('[data-testid="company-form-saved-metadata"]')?.textContent;
    return text?.includes(expected.status) && text.includes(expected.versionNo) && text.includes(expected.stageLabel);
  },{status,versionNo:contract.version.versionNo,stageLabel:contract.version.stageLabel});
  return contract;
}
async function draw(f, type, presence = false) {
  const toggle = page.getByTestId(`button-preview-section-toggle-${f.sectionUuid}`);
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  if(await page.getByTestId(`preview-signature-${type}-${f.sectionUuid}`).locator("img").count()) {
    report.checks.push({name:"retained-signature-read-without-resigning",submissionUuid:currentUuid,type});
    return;
  }
  if (presence) await page.getByLabel("The seafarer is present and is signing this witnessed declaration.").check();
  const pad = page.getByTestId(`live-signature-${type}-${f.sectionUuid}`);
  const canvas = pad.locator("canvas");
  await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox();
  ensure(b, "Actual visible signature canvas required");
  await page.mouse.move(b.x+30,b.y+45); await page.mouse.down();
  for (const [x,y] of [[80,70],[145,28],[230,90],[330,40]]) await page.mouse.move(b.x+x,b.y+y);
  await page.mouse.up();
  const saved = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith(`/sections/${f.sectionUuid}/signatures`));
  await pad.getByRole("button",{ name: "Save signature", exact: true }).click();
  ensure((await saved).status() === 201, `Browser ${type} signature failed`);
  await page.getByTestId(`preview-signature-${type}-${f.sectionUuid}`).locator("canvas").waitFor({ state: "detached" });
}
async function submit(f) {
  if((await api(currentActor,"GET",`${prefix}/${currentUuid}/form`)).submission.status==="completed") return;
  await page.getByTestId(`preview-section-footer-${f.sectionUuid}`).getByRole("button",{ name: /^Submit$/ }).click();
  const dialog = page.getByTestId(`briefing-section-dialog-${f.sectionUuid}`);
  const saved=page.waitForResponse(r=>r.request().method()==="POST" && new URL(r.url()).pathname.endsWith(`/sections/${f.sectionUuid}/submit`));
  await dialog.getByRole("button",{ name: "Submit", exact: true }).click();
  const response=await saved; ensure(response.status()===200,`Section submission failed: ${await response.text()}`);
}
async function depart(c, useBrowser=false) {
  if(await departed(c)) {
    report.checks.push({name:"retained-normal-sign-off",assignmentUuid:c.assignmentUuid});
    return;
  }
  if(useBrowser) {
    await actorPage(actors.master); await planning(c);
    await page.getByRole("dialog").getByRole("combobox").first().click();
    await page.getByRole("option",{name:"Signed Off",exact:true}).click();
    const dateButton=page.getByTestId("button-sign-off-date");
    if(/dd-.*yyyy/.test(await dateButton.innerText())) {
      await dateButton.click();
      await page.getByRole("gridcell",{name:String(new Date().getDate()),exact:true}).click();
    }
    const reason=page.getByText("Reason",{exact:true});
    if(await reason.isVisible()) {
      await reason.locator("..").getByRole("combobox").click();
      await page.getByRole("option").first().click();
    }
    const saved=page.waitForResponse(r=>r.request().method()==="POST" && new URL(r.url()).pathname===`/api/v2/vessel/planning/${c.planUuid}/sign-off`);
    await page.getByTestId("button-submit-onboard").click();
    const response=await saved; ensure(response.status()===200,`Normal browser sign-off failed: ${await response.text()}`);
    await shot(`normal-signoff-${c.key}`);
  } else {
    await api(actors.master, "POST", `/api/v2/vessel/planning/${c.planUuid}/sign-off`, {
      signOffDate: new Date().toISOString().slice(0,10), signOffReason: "Contract Complete" });
  }
  const persisted = (await db.query("SELECT * FROM crew_assignments WHERE assign_uuid=$1", [c.assignmentUuid])).rows[0];
  ensure(persisted.sign_off_date && !persisted.is_current, "Normal sign-off was not persisted");
  await save(`signoff-${c.key}.json`, persisted);
  report.checks.push({ name: "normal-unblocked-sign-off", assignmentUuid: c.assignmentUuid });
}
try {
  ensure(fixture.crews.every(c => c.signedOnAt || c.plannedOnly) && fixture.forms.every(f => f.releasedAt), "Prerequisites incomplete");
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox","--disable-dev-shm-usage"] });
  const originalDeparted=await departed(crew("original"));
  await actorPage(actors.master); await planning(originalDeparted ? crew("viewers") : crew("original")); await shot("master-planning-preflight");
  if(mode==="preflight") {
    await page.getByTestId("button-sign-off-date").click();
    await page.getByRole("gridcell",{name:String(new Date().getDate()),exact:true}).click();
    await shot("normal-signoff-date-navigation-without-saving");
  }
  await profile(crew("original"), actors.master); await shot("master-g3-preflight");
  await profile(crew("original")); await shot("office-g3-preflight");
  if (mode === "preflight") {
    report.passed = true;
  } else {
    ensure(mode === "close", "Unknown mode");
    ensure(!git("status","--porcelain"), "All source/tests/drivers/registry must be committed before closing");
    ensure(Date.parse(processes.startedAt) > Date.parse(report.commitTime), "Backend must start strictly after final source/test/driver commit");
    report.protectedBefore = await read("protected-before-setup.json");
    report.protectedBefore.frm_signature_attachments=(await snapshot()).frm_signature_attachments;
    const retainedAssignments = fixture.reviewSetActivatedAt
      ? fixture.crews.filter(c=>!c.key.startsWith("review")).map(c=>c.assignmentUuid) : [];
    const retainedUuids = retainedAssignments.length ? (await db.query(
      "SELECT submission_uuid FROM frm_company_submissions WHERE subject_ref=ANY($1::text[])",
      [retainedAssignments])).rows.map(r=>r.submission_uuid) : [];
    const retainedFrozen = Object.fromEntries(await Promise.all(retainedUuids.map(async uuid=>[uuid,await frozen(uuid)])));
    await save("all-prior-frozen-before.json",retainedFrozen);
    const earlierUuid=fixture.declarations?.["original-aboard"];
    const earlierFrozen=earlierUuid ? await frozen(earlierUuid) : null;
    await save("retained-earlier-attempt-before.json",{submissionUuid:earlierUuid,frozen:earlierFrozen});
    await save("protected-before.json", report.protectedBefore);
    formPhase = true;
    const c = crew("original"), aboard = form("aboard");
    await actorPage(actors.master);
    // Actual browser persists Planned, reopens popup, and manually starts.
    let originalUuid;
    if(originalDeparted) {
      originalUuid=fixture.declarations[`${c.key}-${aboard.key}`];
      ensure(originalUuid,"Signed-off original must retain its exact declaration");
      await openProfile(c,originalUuid,actors.master);
    } else {
      await planning(c);
      await page.getByRole("dialog").getByRole("combobox").first().click();
      await page.getByRole("option",{ name:"Planned", exact:true }).click();
      await page.getByTestId("button-submit-onboard").click();
      await page.getByTestId("signoff-company-forms").waitFor({ state:"hidden" });
      originalUuid=await startPlanning(c,aboard);
    }
    await draw(aboard,"seafarer",true); await draw(aboard,"vessel_management");
    await submit(aboard);
    const original = await visible(originalUuid);
    ensure(original.submission.status === "completed", "Aboard form did not auto-complete");
    await shot("completed-aboard-signoff");
    const originalFrozen=await frozen(originalUuid); await save("original-frozen-before-signoff.json",originalFrozen);
    await depart(c,true);
    const originalAfter = await api(actors.office,"GET",`${prefix}/${originalUuid}/form`);
    ensure(JSON.stringify(originalFrozen)===JSON.stringify(await frozen(originalUuid)), "Earlier signature/frozen values changed after sign-off");
    // Deliberate G3 second DIFFERENT form start after sign-off.
    const group = await profile(c);
    await group.getByRole("button", { name: "Choose a form", exact: true }).click();
    await group.getByLabel("Eligible sign-off form").selectOption(`${form("ashore").formUuid}:${form("ashore").versionUuid}`);
    const retainedAshore=fixture.declarations["original-ashore"];
    const officeStart = retainedAshore ? null : page.waitForResponse(r=>r.request().method()==="POST" && new URL(r.url()).pathname===`${subject(c)}/submissions`);
    await group.getByRole("button", { name: "Start or resume", exact: true }).click();
    const ashoreUuid = retainedAshore ?? (await (await officeStart).json()).submissionUuid;
    fixture.declarations["original-ashore"] = ashoreUuid; await write("fixtures.json",fixture);
    await register("office post-sign-off declaration",{ submissionUuid:ashoreUuid,assignmentUuid:c.assignmentUuid,versionUuid:form("ashore").versionUuid });
    await visible(ashoreUuid); await draw(form("ashore"),"seafarer",true); await draw(form("ashore"),"officer");
    await submit(form("ashore"));
    const ashore = await visible(ashoreUuid); ensure(ashore.submission.status==="completed","Office post-sign-off form did not complete");
    await shot("office-post-signoff-completed");
    // Saved unfinished declaration must not block a separate sign-off.
    await actorPage(actors.master);
    const unfinishedUuid = await startPlanning(crew("unfinished"),aboard);
    await depart(crew("unfinished"),true);
    await profile(crew("unfinished"));
    ensure((await page.getByTestId("crew-company-forms-home").innerText()).toLowerCase().includes("unfinished sign-off"),"G3 unfinished flag missing");
    await shot("g3-unfinished-signoff-flag");
    ensure((await api(actors.office,"GET",`${prefix}/${unfinishedUuid}/form`)).submission.status==="in_progress","Sign-off completed/erased the unfinished form");
    for(const type of ["vessel_management","seafarer"]) {
      await api(actors.master,"POST",`${prefix}/${unfinishedUuid}/sections/${aboard.sectionUuid}/signatures`,
        {signatureType:type,method:type==="seafarer"?"witnessed":"vessel_management",data:png,
          ...(type==="seafarer"?{seafarerPresent:true}:{})},403);
    }
    // BOTH routes; Master witnessed aboard, then signature-only exception ashore.
    await actorPage(actors.master);
    const lateUuid = await startPlanning(crew("late"),form("dual"));
    await draw(form("dual"),"seafarer",true);
    const beforeLate = await visible(lateUuid);
    ensure(beforeLate.states.flatMap(s=>s.signatures).some(s=>s.signatureType==="seafarer") &&
      !beforeLate.states.flatMap(s=>s.signatures).some(s=>s.signatureType==="officer") &&
      beforeLate.submission.status==="in_progress","Dual signatures were waived");
    // Separate declaration on this exact aboard assignment for a real
    // simultaneous late-signature race, without resetting any signed slot.
    const lateDeparted=await departed(crew("late"));
    const lateHistory=lateDeparted ? await api(actors.master,"GET",`${subject(crew("late"))}/submissions`) : null;
    const concurrent=lateDeparted ? lateHistory.submissions.find(s=>s.formUuid===aboard.formUuid && s.status!=="voided")
      : await api(actors.master,"POST",`${subject(crew("late"))}/submissions`,{formUuid:aboard.formUuid,formVersionUuid:aboard.versionUuid},201);
    ensure(concurrent,"Exact concurrent declaration is missing");
    if(!lateDeparted) await api(actors.master,"POST",`${prefix}/${concurrent.submissionUuid}/sections/${aboard.sectionUuid}/signatures`,
      {signatureType:"seafarer",method:"witnessed",data:png,seafarerPresent:true},201);
    await register("simultaneous late-signature declaration",{assignmentUuid:crew("late").assignmentUuid,submissionUuid:concurrent.submissionUuid,versionUuid:aboard.versionUuid});
    await depart(crew("late"),true);
    await openProfile(crew("late"),lateUuid,actors.master);
    const late = await visible(lateUuid);
    const vmPresent=late.states.flatMap(s=>s.signatures).some(s=>s.signatureType==="vessel_management");
    ensure(!late.submission.canEdit && late.parts[0].sections[0].canSign.vessel_management===!vmPresent,"Late signature capability incorrect");
    for (const text of ["Save draft","Submit","Remove signature","Void submission"]) ensure(!(await page.getByRole("button",{name:text,exact:true}).count()),`Forbidden late control ${text}`);
    await shot("late-signature-only-controls");
    const sectionPath = `${prefix}/${lateUuid}/sections/${form("dual").sectionUuid}`;
    for (const [method,path,body] of [
      ["POST",`${subject(crew("late"))}/submissions`,{formUuid:aboard.formUuid,formVersionUuid:aboard.versionUuid}],
      ["PUT",`${sectionPath}/answers`,{answers:[],sectionComment:"Forbidden late comment"}],
      ["POST",`${sectionPath}/submit`,{}],
      ["POST",`${sectionPath}/signatures`,{signatureType:"seafarer",method:"witnessed",data:png,seafarerPresent:true}],
      ["POST",`${sectionPath}/signatures`,{signatureType:"officer",method:"officer",data:png}],
      ["POST",`${prefix}/${lateUuid}/void`,{reason:"Forbidden late void"}],
    ]) await api(actors.master,method,path,body,403);
    const seafarer = late.states.flatMap(s=>s.signatures).find(s=>s.signatureType==="seafarer");
    await api(actors.master,"DELETE",`${sectionPath}/signatures/${seafarer.sectionSignatureUuid}`,undefined,403);
    for (const negative of [actors.wrongVessel,actors.wrongRole,actors.unprovisioned]) {
      await api(negative,"POST",`${sectionPath}/signatures`,{signatureType:"vessel_management",method:"vessel_management",data:png},403);
    }
    await draw(form("dual"),"vessel_management");
    const afterLate = await visible(lateUuid);
    ensure(JSON.stringify(seafarer)===JSON.stringify(afterLate.states.flatMap(s=>s.signatures).find(s=>s.signatureType==="seafarer")),"Late signing changed frozen Seafarer signature");
    ensure(afterLate.submission.status==="in_progress" && !afterLate.states.flatMap(s=>s.signatures).some(s=>s.signatureType==="officer"),"Late VM waived Company Representative");
    await api(actors.masterTwo,"POST",`${sectionPath}/signatures`,{signatureType:"vessel_management",method:"vessel_management",data:png},403);
    const ownVm=afterLate.states.flatMap(s=>s.signatures).find(s=>s.signatureType==="vessel_management");
    await api(actors.master,"DELETE",`${sectionPath}/signatures/${ownVm.sectionSignatureUuid}`,undefined,403);
    await api(actors.master,"POST",`${sectionPath}/signatures`,{signatureType:"vessel_management",method:"vessel_management",data:png},403);
    const answerPoint=afterLate.parts.flatMap(p=>p.sections).flatMap(s=>s.questions).find(q=>q.responseType==="free_text");
    await api(actors.master,"PUT",`${sectionPath}/answers`,{answers:[{
      questionUuid:answerPoint.questionUuid,value:"Forbidden late answer",comment:"Forbidden late point comment",
    }],sectionComment:"Forbidden late section comment"},403);
    await shot("late-authenticated-master-signature");
    const firstRequest=evidence.length;
    await Promise.all([actors.master,actors.masterTwo].map(actor=>api(actor,"POST",
      `${prefix}/${concurrent.submissionUuid}/sections/${aboard.sectionUuid}/signatures`,
       {signatureType:"vessel_management",method:"vessel_management",data:png},lateDeparted ? 403 : [201,403])));
    const raceRequests=evidence.slice(firstRequest);
    ensure(lateDeparted ? raceRequests.every(r=>r.status===403) :
      raceRequests.filter(r=>r.status===201).length===1 && raceRequests.filter(r=>r.status===403).length===1,
      "Concurrent late signing did not preserve exactly one immutable authenticated signature");
    const raceForm=await api(actors.office,"GET",`${prefix}/${concurrent.submissionUuid}/form`);
    const vm=raceForm.states.flatMap(s=>s.signatures).filter(s=>s.signatureType==="vessel_management");
    const winner=lateDeparted ? Object.values(actors).find(a=>a.userUuid===vm[0]?.signedByUuid) :
      Object.values(actors).find(a=>a.id===raceRequests.find(r=>r.status===201).actorId);
    ensure(vm.length===1 && winner && vm[0].signedByUuid===winner.userUuid,"Race signer identity is not the winner");
    const priorRace=lateDeparted ? await retainedProof("simultaneous-late-signature-race.json",
      p=>p.requests.some(r=>r.status===201) && p.requests.some(r=>r.status===403)) : null;
    if(priorRace) ensure(JSON.stringify(vm)===JSON.stringify(priorRace.value.contract.states.flatMap(s=>s.signatures).filter(s=>s.signatureType==="vessel_management")),"Retained race signature changed");
    await save("simultaneous-late-signature-race.json",{kind:lateDeparted?"immutable-slot-replay":"actual-race",retainedEvidence:priorRace,requests:raceRequests,contract:raceForm});
    // Office witness route on a separate dual-configured case.
    await actorPage(actors.master);
    const dualOfficeUuid = await startPlanning(crew("dualOffice"),form("dual"));
    const officeDeparted=await departed(crew("dualOffice"));
    const officeHistory=officeDeparted ? await api(actors.master,"GET",`${subject(crew("dualOffice"))}/submissions`) : null;
    const signoffRace=officeDeparted ? officeHistory.submissions.find(s=>s.formUuid===aboard.formUuid && s.status!=="voided")
      : await api(actors.master,"POST",`${subject(crew("dualOffice"))}/submissions`,
      {formUuid:aboard.formUuid,formVersionUuid:aboard.versionUuid},201);
    ensure(signoffRace,"Exact sign-off race declaration is missing");
    const signoffRaceStart=evidence.length;
    if(!officeDeparted) await Promise.all([
      api(actors.master,"POST",`${prefix}/${signoffRace.submissionUuid}/sections/${aboard.sectionUuid}/signatures`,
        {signatureType:"seafarer",method:"witnessed",data:png,seafarerPresent:true},[201,403]),
      depart(crew("dualOffice")),
    ]);
    const raced=await api(actors.office,"GET",`${prefix}/${signoffRace.submissionUuid}/form`);
    const provenance=(await db.query(`SELECT s.subject_provenance FROM frm_section_signatures s JOIN frm_section_states t
      ON t.section_state_uuid=s.section_state_uuid WHERE t.submission_uuid=$1 AND s.signature_type='seafarer'`,[signoffRace.submissionUuid])).rows;
    const captured=evidence.slice(signoffRaceStart).find(r=>r.path.endsWith("/signatures"));
    ensure(officeDeparted ? provenance.length<=1 && provenance.every(p=>p.subject_provenance?.aboard===true) :
      captured.status===201 ? provenance.length===1 && provenance[0].subject_provenance?.aboard===true : !provenance.length,
      "Sign-off/signature race did not serialize authoritative aboard provenance");
    const priorSignoff=officeDeparted ? await retainedProof("signoff-signature-race.json",
      p=>p.requests.some(r=>r.path.endsWith("/sign-off") && r.status===200) && p.requests.some(r=>r.path.endsWith("/signatures"))) : null;
    if(priorSignoff) ensure(JSON.stringify(provenance)===JSON.stringify(priorSignoff.value.persistedProvenance),"Persisted aboard provenance changed after the race");
    await save("signoff-signature-race.json",{kind:officeDeparted?"retained-provenance-verification":"actual-race",retainedEvidence:priorSignoff,requests:evidence.slice(signoffRaceStart),persistedProvenance:provenance,contract:raced});
    await register("sign-off/signature race declaration",{assignmentUuid:crew("dualOffice").assignmentUuid,submissionUuid:signoffRace.submissionUuid});
    await openProfile(crew("dualOffice"),dualOfficeUuid);
    await draw(form("dual"),"seafarer",true); await draw(form("dual"),"officer");
    const officeDual = await visible(dualOfficeUuid);
    ensure(officeDual.submission.status==="in_progress" && !officeDual.states.flatMap(s=>s.signatures).some(s=>s.signatureType==="vessel_management"),"Office witness waived VM");
    await shot("dual-office-witness-required-vm");
    // A post-sign-off Office Seafarer signature does NOT establish aboard provenance.
    await api(actors.master,"POST",`${prefix}/${dualOfficeUuid}/sections/${form("dual").sectionUuid}/signatures`,
      {signatureType:"vessel_management",method:"vessel_management",data:png},403);
    // Exact cross-crew context and independent unauthorized reads/assets.
    await api(actors.office,"GET",`${prefix}/${originalUuid}/form?crewUuid=${crew("late").crewUuid}`,undefined,403);
    for (const negative of [actors.wrongVessel,actors.unprovisioned]) {
      await api(negative,"GET",`${prefix}/${originalUuid}/form`,undefined,403);
      await api(negative,"GET",original.states[0].signatures[0].attachment.rawUrl,undefined,403);
    }
    await api(actors.office,"GET","/api/v2/admin/forms",undefined,403);
    await verifyViewers({fixture,actorPage,getPage:()=>page,planning,visible,shot,report});
    const assignments=fixture.crews.map(c=>c.assignmentUuid);
    const submissions=(await db.query("SELECT submission_uuid FROM frm_company_submissions WHERE subject_type='crew_assignment' AND subject_ref=ANY($1::text[])",[assignments])).rows.map(s=>s.submission_uuid);
    const records={};
    for(const table of ["frm_company_submissions","frm_company_submission_system_snapshots","frm_company_submission_assignments","frm_section_states","frm_answers"]) {
      records[table]=(await db.query(`SELECT to_jsonb(t) AS value FROM "${table}" t WHERE submission_uuid=ANY($1::text[]) ORDER BY id`,[submissions])).rows;
    }
    records.signatures=(await db.query(`SELECT to_jsonb(s) AS value FROM frm_section_signatures s JOIN frm_section_states t
      ON t.section_state_uuid=s.section_state_uuid WHERE t.submission_uuid=ANY($1::text[]) ORDER BY s.id`,[submissions])).rows;
    records.attachments=(await db.query(`SELECT to_jsonb(a) AS value FROM frm_signature_attachments a JOIN frm_section_signatures s
      ON s.signature_att_uuid=a.sig_att_uuid JOIN frm_section_states t ON t.section_state_uuid=s.section_state_uuid
      WHERE t.submission_uuid=ANY($1::text[]) ORDER BY a.id`,[submissions])).rows;
    await save("all-retained-declaration-records.json",records);
    const uuids=[...new Set([...JSON.stringify(records).matchAll(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi)].map(m=>m[0]))];
    await register("persisted declaration, freeze, signature and attachment identities",{uuids});
    await protectedCheck(report.protectedBefore);
    for(const uuid of retainedUuids) ensure(JSON.stringify(retainedFrozen[uuid])===JSON.stringify(await frozen(uuid)),
      `Previously retained declaration changed: ${uuid}`);
    await save("all-prior-frozen-after.json",retainedFrozen);
    const frozenAfter=await frozen(originalUuid); await save("original-frozen-after-all-journeys.json",frozenAfter);
    ensure(JSON.stringify(originalFrozen)===JSON.stringify(frozenAfter),"Original completed record changed");
    if(earlierFrozen) {
      const earlierAfter=await frozen(earlierUuid);
      await save("retained-earlier-attempt-after.json",{submissionUuid:earlierUuid,frozen:earlierAfter});
      ensure(JSON.stringify(earlierFrozen)===JSON.stringify(earlierAfter),"Retained earlier-attempt signatures changed");
    }
    report.passed = true;
  }
} catch (error) {
  report.error = String(error);
  if (page) {
    await shot("failure").catch(()=>undefined);
    await fs.writeFile(`${folder}/failure-dom.html`,await page.content()).catch(()=>undefined);
  }
  process.exitCode = 1;
} finally {
  await Promise.allSettled(pending);
  report.formActorsVerified=report.network.filter(r=>r.path.startsWith(prefix)).every(r=>r.actualActorId===r.actorId);
  if(mode==="close" && (!report.formActorsVerified || report.network.some(r=>r.formPhase &&
    /^\/api\/v2\/admin\/(?:forms(?:\/|$)|form-versions(?:\/|$))/.test(r.path)))) {
    report.passed=false; report.authorizationEvidenceFailure=true; process.exitCode=1;
  }
  report.end = new Date().toISOString(); report.apiEvidence = evidence;
  report.sourceStable = git("rev-parse","HEAD")===report.head;
  report.backendStable = backend().pid===processes.pid;
  if (!report.sourceStable || !report.backendStable) { report.passed=false; process.exitCode=1; }
  await save("report.json",report);
  await browser?.close(); await db.end();
  console.log(JSON.stringify({passed:report.passed,error:report.error,folder,head:report.head,backend:processes},null,2));
}