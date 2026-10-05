import { db, api, prefix, write, register, ensure } from "./signoff-verification-common.mjs";

export async function verifyViewers({ fixture, actorPage, getPage, planning, visible, shot, report }) {
  const actors = fixture.actors, c = fixture.crews.find(c=>c.key==="viewers"), reliever = fixture.crews.find(c=>c.key===(fixture.activeCrewKeys?.reliever ?? "reliever"));
  const form = key=>fixture.forms.find(f=>f.key===(fixture.activeFormKeys?.[key] ?? key));
  const subject = c=>`${prefix}/subjects/crew_assignment/${c.assignmentUuid}`;
  const retained=async(c,key)=>{
    const history=await api(actors.office,"GET",`${subject(c)}/submissions`);
    const matches=history.submissions.filter(s=>s.formUuid===form(key).formUuid && s.status!=="voided");
    ensure(matches.length<=1,"Ambiguous retained viewer declaration");
    return matches[0];
  };
  const existingOnboard=await retained(c,"onboard");
  await actorPage(actors.master); let page = getPage();
  await page.getByRole("button",{name:"Crew List",exact:true}).click();
  ensure(await page.getByTestId("crew-list-forms-header").count()===1,"Must preserve exactly one Forms column");
  const count = page.getByTestId(`button-crew-forms-${c.assignmentUuid}`);
  ensure((await count.innerText()).trim()===(existingOnboard?"1":"0"),"Keyboard-operable count does not match retained on-board records");
  await count.focus(); await page.keyboard.press("Enter");
  await page.getByTestId("select-onboard-form-version").selectOption(form("onboard").versionUuid);
  const started = existingOnboard ? null : page.waitForResponse(r=>r.request().method()==="POST" && new URL(r.url()).pathname===`${subject(c)}/submissions`);
  await page.getByTestId("button-start-onboard-form").click();
  const onboardUuid = existingOnboard?.submissionUuid ?? (await (await started).json()).submissionUuid;
  await visible(onboardUuid); await shot("viewer-crew-list-onboard-metadata");
  await register("Crew List metadata declaration",{submissionUuid:onboardUuid,assignmentUuid:c.assignmentUuid,versionUuid:form("onboard").versionUuid});
  fixture.declarations["viewers-onboard"]=onboardUuid;
  await write("fixtures.json",fixture);
  await actorPage(actors.master); page=getPage();
  await planning(c);
  await page.getByTestId("select-signoff-form-version").selectOption(form("aboard").versionUuid);
  const existingSignoff=await retained(c,"aboard");
  const signoffStart=existingSignoff ? null : page.waitForResponse(r=>r.request().method()==="POST" && new URL(r.url()).pathname===`${subject(c)}/submissions`);
  await page.getByTestId("button-start-signoff-form").click();
  const signoffUuid=existingSignoff?.submissionUuid ?? (await (await signoffStart).json()).submissionUuid;
  await visible(signoffUuid); await shot("viewer-onboard-status-signoff-metadata");
  fixture.declarations["viewers-aboard"]=signoffUuid;
  await write("fixtures.json",fixture);
  await register("On Board Status metadata declaration",{submissionUuid:signoffUuid,assignmentUuid:c.assignmentUuid,versionUuid:form("aboard").versionUuid});
  const counts=await api(actors.master,"POST",`${prefix}/subjects/crew_assignment/submission-counts`,{subjectRefs:[c.assignmentUuid],stageKey:"on_board"});
  ensure(counts[c.assignmentUuid]===1,"Sign-off declarations must not change on-board counts");

  // Original pinned version 01, voided without deleting, replaced by an
  // additive normally cloned/released version 02. All definitions are test-owned.
  const savedOriginal=fixture.declarations["reliever-original"], savedReplacement=fixture.declarations["reliever-replacement"];
  let original,replacement,draft;
  if(savedOriginal && savedReplacement) {
    original=(await api(actors.office,"GET",`${prefix}/${savedOriginal}/form`)).submission;
    replacement=(await api(actors.office,"GET",`${prefix}/${savedReplacement}/form`)).submission;
    draft={fvUuid:replacement.formVersionUuid};
  } else {
  original=await retained(reliever,"joining") ?? await api(actors.office,"POST",`${subject(reliever)}/submissions`,
    {formUuid:form("joining").formUuid,formVersionUuid:form("joining").versionUuid},201);
  const setupUser=(await db.query("SELECT id,role,user_type FROM master_users WHERE id=1")).rows[0];
  const setup={id:setupUser.id,role:setupUser.role,userType:setupUser.user_type};
  draft=await api(setup,"POST",`/api/v2/admin/forms/${form("joining").formId}/versions`,{versionNo:"02",versionDate:"04-Oct-2026",stageKey:"before_joining"});
  await api(setup,"POST",`/api/v2/admin/form-versions/${draft.id}/release`,{});
  await api(setup,"POST",`${prefix}/${original.submissionUuid}/void`,{reason:"TEST ONLY reciprocal metadata acceptance"},204);
  replacement=await api(actors.office,"POST",`${subject(reliever)}/submissions`,
    {formUuid:form("joining").formUuid,formVersionUuid:draft.fvUuid},201);
  }
  fixture.declarations["reliever-original"]=original.submissionUuid;
  fixture.declarations["reliever-replacement"]=replacement.submissionUuid;
  await write("fixtures.json",fixture);
  await register("Reliever reciprocal metadata records",{assignmentUuid:reliever.assignmentUuid,originalUuid:original.submissionUuid,
    replacementUuid:replacement.submissionUuid,replacementVersionUuid:draft.fvUuid});
  await actorPage(actors.master); page=getPage();
  await page.getByRole("button",{name:"Planning",exact:true}).click();
  const row=page.locator("tr").filter({hasText:reliever.name}).filter({has:page.locator('[data-testid^="button-edit-reliever-"]')});
  ensure(await row.count()===1,"Exact planned synthetic reliever row required");
  await row.locator('[data-testid^="button-edit-reliever-"]').click();
  await page.getByRole("button",{name:"Joining forms",exact:true}).click();
  const joining=page.getByTestId("joining-company-forms"); await joining.waitFor({state:"visible"});
  await joining.locator("div.rounded-md").filter({
    has:page.locator("div").filter({hasText:/· voided$/}),
  }).getByRole("button",{name:"Read declaration",exact:true}).click();
  const originalContract=await visible(original.submissionUuid);
  ensure(originalContract.version.versionNo==="01" && originalContract.submission.status==="voided","Must show pinned voided v01, not latest v02");
  await shot("viewer-reliever-voided-version01");
  const target=originalContract.replacementHistory.find(r=>r.submissionUuid===replacement.submissionUuid);
  await page.getByRole("button",{name:target.targetLabel,exact:true}).click();
  const replaced=await visible(replacement.submissionUuid);
  ensure(replaced.version.versionNo==="02" && replaced.submission.status==="in_progress","Reciprocal navigation metadata failed to follow active record");
  await shot("viewer-reliever-replacement-version02");
  report.checks.push({name:"four-real-viewers-and-reciprocal-labels",crewList:onboardUuid,onboardStatus:signoffUuid,
    reliever:[original.submissionUuid,replacement.submissionUuid],crewProfile:fixture.declarations["original-ashore"],onboardCount:counts[c.assignmentUuid]});
  // Cancellation through supported assignment API; retain the exact planning
  // row and both declaration histories, never clear any vessel position.
  await api(actors.office,"PATCH",`/api/v2/crew-pool/crew/${reliever.crewUuid}/assignments/${reliever.assignmentUuid}`,{assignmentType:"Cancelled",isCurrent:false});
  await api(actors.office,"POST",`${subject(reliever)}/submissions`,
    {formUuid:form("joining").formUuid,formVersionUuid:draft.fvUuid},[403,409]);
  const saved=await api(actors.office,"GET",`${prefix}/${replacement.submissionUuid}/form`);
  ensure(!saved.submission.canEdit,"Cancelled history must stay read-only");
  await api(actors.office,"PUT",`${prefix}/${replacement.submissionUuid}/sections/${saved.parts[0].sections[0].sectionUuid}/answers`,
    {answers:[],sectionComment:"TEST ONLY refused stale cancellation write"},[403,409]);
  const history=await api(actors.office,"GET",`${prefix}/subjects/crew_assignment/home/${reliever.crewUuid}/submissions`);
  ensure(!history.groups.find(g=>g.subjectRef===reliever.assignmentUuid).startableStages?.length,"Cancelled G3 group offers creation");
}