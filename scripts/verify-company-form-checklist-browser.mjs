import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const dir=".local/verification/company-forms-checklist";
const fixture=JSON.parse(await fs.readFile(`${dir}/fixture.json`,"utf8"));
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const shell=(...a)=>execFileSync(...a,{encoding:"utf8"}).trim();
const actor=(await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u JOIN adm_rolemaster_ac r
  ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const closing=process.argv.includes("--closing"), report={checks:[],operations:[],screenshots:[],errors:[],
  head:shell("git",["rev-parse","HEAD"]),commitTime:shell("git",["show","-s","--format=%cI","HEAD"])};
const assert=(yes,message)=>{if(!yes)throw Error(message);report.checks.push(message);};
const pid=shell("ps",["-eo","pid=,args="]).split("\n").filter(x=>x.includes("server/index.ts")&&!/watch|npm| -c /.test(x));
assert(pid.length===1,"One main backend process");
report.backendPid=Number(pid[0].trim().split(/\s+/)[0]);
report.backendStart=new Date(shell("ps",["-p",String(report.backendPid),"-o","lstart="])).toISOString();
if(closing)assert(new Date(report.backendStart)>new Date(report.commitTime),"Backend started after final commit");
const base=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser=await chromium.launch({executablePath:shell("which",["chromium"]),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
let context,page;
async function login(user,vessel){
  if(context)await context.close();
  const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
  const token=`${enc({alg:"none",typ:"JWT"})}.${enc({id:user.id,roleId:user.ruid??user.roleId,userType:user.user_type??user.userType,domain:"test"})}.devsig`;
  context=await browser.newContext({viewport:{width:1560,height:1100},ignoreHTTPSErrors:true,extraHTTPHeaders:{Authorization:`Bearer ${token}`}});
  // Read actual modules from the same main-preview URL. Retry transport errors;
  // never substitute UI, API responses, localhost, or a second application.
  await context.route("**/src/**",async route=>{
    const response=await route.fetch({maxRetries:2,timeout:60000});
    await route.fulfill({response});
  });
  await context.addInitScript(({user,token,vessel})=>{
    const selected=vessel?{vessel:vessel.vesselName,vesselId:vessel.vessel,imoNumber:""}:undefined;
    const profile={personaKey:selected?"vessel-admin":"crewing-executive",masterUserId:user.id,userId:String(user.id),role:user.role,
      roleId:user.ruid??user.roleId,userType:user.user_type??user.userType,vessel:selected,myVessels:[]};
    localStorage.setItem("userProfile",JSON.stringify(profile));localStorage.setItem("devPersona",JSON.stringify(profile));
    localStorage.setItem("devAuthToken",token);
    if(selected)localStorage.setItem("devLastVesselId",selected.vesselId);
  },{user,token,vessel});
  page=await context.newPage();page.on("pageerror",e=>report.errors.push(e.message));
  page.on("requestfailed",r=>{(report.networkFailures??=[]).push({url:r.url(),error:r.failure()?.errorText});});
  page.on("dialog",async dialog=>{
    report.checks.push(`Browser confirmation accepted: ${dialog.type()}`);
    await dialog.accept();
  });
  page.on("response",r=>{if(r.url().includes("/api/v2/")&&r.request().method()!=="GET")
    report.operations.push({method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
}
async function shot(name){await page.screenshot({path:`${dir}/${name}.jpg`});report.screenshots.push(name);}
async function planning(kind){
  await login(actor,fixture.cases[kind]);
  const navigation=await page.goto(`${base}/vessel`,{waitUntil:"domcontentloaded"});
  assert(navigation.status()===200,"Main preview document returned 200");
  await page.waitForFunction(()=>document.body.innerText.trim().length>10,null,{timeout:60000});
  await page.getByTestId("select-vessel-value").click();
  await page.getByRole("option",{name:fixture.cases[kind].vesselName,exact:true}).click();
  const vesselRow=page.getByRole("row").filter({hasText:fixture.cases[kind].vesselName});
  await vesselRow.locator('[data-testid^="button-edit-"]').click();
  await page.getByRole("button",{name:"Planning",exact:true}).click();
  const row=page.locator("tr").filter({hasText:`${fixture.prefix} ${kind}`})
    .filter({has:page.locator('[data-testid^="button-edit-reliever-"]')});
  await row.first().waitFor({timeout:45000});assert(await row.count()===1,`${kind}: exact linked planning row`);
  await row.locator('[data-testid^="button-edit-reliever-"]').click();
  await page.getByTestId("radio-deployment-checklist").waitFor();
}
async function saveYes(){
  await page.getByTestId("radio-deployment-checklist").getByRole("radio",{name:"Yes",exact:true}).click();
  const response=page.waitForResponse(r=>r.url().includes("/vessel/planning/")&&["PATCH","PUT"].includes(r.request().method()));
  await page.getByTestId("button-submit-relief").click();return (await response).status();
}
async function completed(){
  const c=fixture.cases.required;
  await page.goto(`${base}/crew-pool?crew=${c.crew}&section=G`,{waitUntil:"domcontentloaded"});
  const group=page.getByTestId(`crew-company-forms-group-${c.assignment}`);await group.waitFor({timeout:45000});
  if(!await group.evaluate(el=>el.open))await group.locator(":scope > summary").click();
  const panel=page.getByTestId(`assignment-form-requirements-${c.assignment}`);
  await panel.getByText("Completed",{exact:true}).waitFor();await shot(closing?"closing-completed":"completed");
}
async function reportPage(user=actor){
  await login(user);await page.goto(`${base}/reports`,{waitUntil:"domcontentloaded"});
  await page.getByText("Company Forms",{exact:true}).click();
  await page.getByText("Outstanding forms",{exact:true}).click();
  await page.getByRole("searchbox",{name:"Filter Seafarer",exact:true}).fill(fixture.prefix);
  await page.locator("tbody tr").filter({hasText:fixture.prefix}).first().waitFor({timeout:30000});
}
try{
  const shipOnly=process.argv.includes("--ship-only");
  if(!shipOnly){
  await login(actor);
  const requirementState=(await db.query("SELECT status FROM frm_requirements WHERE subject_ref=$1 AND mandatory",[fixture.cases.required.assignment])).rows[0]?.status;
  if(!closing&&requirementState!=="COMPLETED"){
    await planning("required");assert(await saveYes()===409,"Browser: mandatory OUTSTANDING refuses Yes");
    await page.getByRole("alertdialog").getByText(/SL01 Pre-Joining Declaration/).first().waitFor();
    assert(await page.getByRole("button",{name:/Confirm override|Override checklist/i}).count()===0,"No override offered for incomplete mandatory form");
    await shot("mandatory-refused");
    const c=fixture.cases.required;
    await page.goto(`${base}/crew-pool?crew=${c.crew}&section=G`,{waitUntil:"domcontentloaded"});
    const group=page.getByTestId(`crew-company-forms-group-${c.assignment}`);await group.waitFor({timeout:45000});
    if(!await group.evaluate(el=>el.open))await group.locator(":scope > summary").click();
    const requirementPanel=page.getByTestId(`assignment-form-requirements-${c.assignment}`);
    const start=requirementPanel.getByRole("button",{name:"Start required form",exact:true});
    if(await start.count())await start.click();
    else await requirementPanel.getByRole("button",{name:/Open.*form/i}).click();
    const officer=page.locator('[data-testid^="live-signature-officer-"]').first();
    await officer.waitFor({timeout:30000});const section=(await officer.getAttribute("data-testid")).replace("live-signature-officer-","");
    for(const type of ["officer","seafarer"]){
      if(type==="seafarer")await page.getByRole("checkbox",{name:/Seafarer.*present/i}).check();
      const pad=page.getByTestId(`live-signature-${type}-${section}`);
      const canvas=pad.locator("canvas");
      await canvas.scrollIntoViewIfNeeded();
      const box=await canvas.boundingBox();assert(Boolean(box),"Visible signature pad");
      await page.mouse.move(box.x+30,box.y+45);await page.mouse.down();
      await page.mouse.move(box.x+115,box.y+70,{steps:12});await page.mouse.move(box.x+175,box.y+35,{steps:12});await page.mouse.up();
      const response=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes(`/sections/${section}/signatures`));
      await pad.getByRole("button",{name:/Save/i}).click();assert((await response).status()===201,`Browser: ${type} signature saved`);
      await page.getByTestId(`preview-signature-${type}-${section}`).waitFor();
    }
    const submit=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes(`/sections/${section}/submit`));
    await page.getByRole("button",{name:"Submit",exact:true}).click();
    await page.getByRole("alertdialog").getByRole("button",{name:/Confirm|Submit|Yes/i}).click();
    assert((await submit).status()===200,"Browser: Submit completes required form");
  }
  await completed();
  await planning("required");
  if(!closing)assert(await saveYes()===200,"Browser: completed requirement allows checklist Yes");
  else assert(await page.getByTestId("radio-deployment-checklist").getByRole("radio",{name:"Yes",exact:true}).isChecked(),"Closing: completed checklist remains Yes");
  await shot(closing?"closing-checklist":"checklist-allowed");
  if(!closing){
    await planning("optional");assert(await saveYes()===200,"Browser: optional form never blocks");
    await planning("unresolved");assert(await saveYes()===409,"Browser: unresolved mandatory fact blocks ordinary Yes");
    await shot("unresolved-fact");await page.getByLabel("Reason for override",{exact:true}).fill("TEST ONLY retained fixture: office accepts pending service verification.");
    const override=page.waitForResponse(r=>r.url().includes("/vessel/planning/")&&["PATCH","PUT"].includes(r.request().method()));
    await page.getByRole("button",{name:"Confirm override",exact:true}).click();
    assert((await override).status()===200,"Browser: permitted unresolved-only override saved with reason");
    await planning("mixed");assert(await saveYes()===409,"Browser: mixed OUTSTANDING and UNRESOLVED cannot override");
    assert(await page.getByRole("button",{name:/Confirm override|Override checklist/i}).count()===0,"Browser: mixed blocker override hidden");
    await shot("mixed-override-refused");
    await page.locator('[data-testid^="checklist-blocker-"]').filter({hasText:"SL01 Pre-Joining Declaration"})
      .getByRole("button",{name:"Open form",exact:true}).click();
    await page.getByRole("dialog").getByText("SL01 Pre-Joining Declaration",{exact:false}).first().waitFor();
    await shot("exact-pinned-blocker-form");
  }
  await reportPage();
  await page.locator("tbody tr").filter({hasText:fixture.cases.signedoff.name}).waitFor();
  assert(await page.getByText("Signed off",{exact:true}).count()>0,"Browser: signed-off seafarer included");
  await shot(closing?"closing-outstanding-report":"outstanding-report");
  if(!closing){
    const download=page.waitForEvent("download");await page.getByRole("button",{name:"Export Excel",exact:true}).click();
    await (await download).saveAs(`${dir}/outstanding.xlsx`);report.checks.push("Browser: full filtered Excel export downloaded");
    const row=page.locator("tbody tr").filter({hasText:fixture.cases.failed.name});await row.click();
    await page.getByRole("button",{name:/Retry.*check/i}).waitFor();await shot("failed-check-retry");
    const retry=page.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/retry"));
    await page.getByRole("button",{name:/Retry.*check/i}).click();assert((await retry).status()===200,"Browser: failed check retried through stage panel");
  }
  }
  if(!closing){
    await reportPage(fixture.ship);const rows=page.locator("tbody tr").filter({hasText:fixture.prefix});
    assert(await rows.count()===1&&await rows.first().getByText(fixture.cases.optional.vesselName,{exact:true}).count()===1,
      "Browser: vessel user sees only own vessel");
    await shot("vessel-own-report");await rows.first().click();
    await page.getByRole("dialog").getByText(/Version|Optional|TEST ONLY/i).first().waitFor();await shot("vessel-exact-pinned-form");
  }
  assert(report.errors.length===0,"No browser page errors");
}catch(error){report.failure=String(error);if(page){report.visibleText=(await page.locator("body").innerText()).slice(-10000);await shot("failure");}throw error;}
finally{await fs.writeFile(`${dir}/${closing?"browser-closing":"browser"}.json`,JSON.stringify(report,null,2));await browser.close();await db.end();}
console.log(JSON.stringify({passed:report.checks.length,screenshots:report.screenshots.length}));
