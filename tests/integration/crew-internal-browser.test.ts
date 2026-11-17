// @vitest-environment node
import { beforeAll,afterAll,it,expect } from "vitest";
import { chromium,expect as browserExpect,type Browser,type BrowserContext,type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
const role=randomUUID(), actor=randomUUID(), crew=randomUUID(),shipRole=randomUUID(),shipActor=randomUUID();
const roleName=`TEST ONLY Part H ${role.slice(0,8)}`,shipRoleName=`TEST ONLY H Vessel ${shipRole.slice(0,8)}`;
const out="generated-artifacts/part-h/screenshots";
let userId:number,shipUserId:number,browser:Browser,context:BrowserContext,page:Page;
const marker=`Confidential Part H ${crew}`;
const token=(id:number,type:string)=>`${Buffer.from(JSON.stringify({alg:"none"})).toString("base64url")}.${Buffer.from(JSON.stringify({id,userType:type,domain:"test"})).toString("base64url")}.fixture`;
async function persona(id:number,uuid:string,name:string,type:string) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1050}});
  await ctx.addInitScript(({id,uuid,name,type,auth})=>{
    const profile={personaKey:"crewing-executive",masterUserId:id,userId:String(id),roleId:uuid,role:name,userType:type,myVessels:[]};
    localStorage.setItem("userProfile",JSON.stringify(profile));
    localStorage.setItem("devPersona",JSON.stringify(profile));
    localStorage.setItem("devAuthToken",auth);
  },{id,uuid,name,type,auth:token(id,type)});
  return ctx;
}
beforeAll(async()=>{
  if(process.env.TEST_DATABASE_VERIFIED!=="true")throw Error("Isolated database required");
  await fs.mkdir(out,{recursive:true});
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype)
    VALUES($1,$2,'Office'),($3,$4,'Ship')`,[role,roleName,shipRole,shipRoleName]);
  userId=(await pool.query(`INSERT INTO master_users(user_uuid,fullname,user_type,role,designation)
    VALUES($1,'Fixture Office Author','Office',$2,'Marine Superintendent') RETURNING id`,[actor,roleName])).rows[0].id;
  shipUserId=(await pool.query(`INSERT INTO master_users(user_uuid,fullname,user_type,role,designation)
    VALUES($1,'Fixture Vessel User','Ship',$2,'Master') RETURNING id`,[shipActor,shipRoleName])).rows[0].id;
  await pool.query(`INSERT INTO adm_roleaccess_ac(rauid,menu_id,role_id,canview,cancreate,canedit,candelete)
    SELECT gen_random_uuid()::text,muid,$1,true,
    name IN ('Internal Comments','Internal Actions'),name IN ('Internal Comments','Internal Actions'),
    name IN ('Internal Comments','Internal Actions') FROM adm_menumaster_ac
    WHERE name IN ('Crew Pool','Crew Database','CP Dashboard','Internal Comments','Internal Actions')`,[role]);
  // Deliberately mistaken vessel grants must never defeat the office-only guard.
  await pool.query(`INSERT INTO adm_roleaccess_ac(rauid,menu_id,role_id,canview,cancreate,canedit,candelete)
    SELECT gen_random_uuid()::text,muid,$1,true,true,true,true FROM adm_menumaster_ac
    WHERE name IN ('Internal Comments','Internal Actions')`,[shipRole]);
  await pool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank)
    VALUES($1,$2,'TEST ONLY','Internal Records','Master')`,[crew,`H-${crew.slice(0,8)}`]);
  browser=await chromium.launch({executablePath:execFileSync("which",["chromium"],{encoding:"utf8"}).trim(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  context=await persona(userId,role,roleName,"Office");page=await context.newPage();
});
afterAll(async()=>{
  await browser?.close();
  // Disposable test DB only. All requests have finished before these locks.
  // Production retention triggers are never disabled by product code.
  const c=await pool.connect();
  try{
    await c.query("BEGIN");
    for(const t of ["crew_internal_comments","crew_internal_comments_events","crew_internal_actions","crew_internal_actions_events"])
      await c.query(`ALTER TABLE ${t} DISABLE TRIGGER USER`);
    for(const t of ["crew_internal_comments_events","crew_internal_actions_events","crew_internal_comments","crew_internal_actions"])
      await c.query(`DELETE FROM ${t} WHERE crew_uuid=$1`,[crew]);
    for(const t of ["crew_internal_comments","crew_internal_comments_events","crew_internal_actions","crew_internal_actions_events"])
      await c.query(`ALTER TABLE ${t} ENABLE TRIGGER USER`);
    await c.query("DELETE FROM crew_members_v2 WHERE crew_uuid=$1",[crew]);
    await c.query("DELETE FROM adm_roleaccess_ac WHERE role_id=ANY($1::text[])",[[role,shipRole]]);
    await c.query("DELETE FROM master_users WHERE user_uuid=ANY($1::text[])",[[actor,shipActor]]);
    await c.query("DELETE FROM adm_rolemaster_ac WHERE ruid=ANY($1::text[])",[[role,shipRole]]);
    await c.query("COMMIT");
  }catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();await pool.end();}
});
it("uses the real Part H screens for create, edit, view, history, action transitions and removal",async()=>{
  await page.goto(`${process.env.TEST_API_URL}/crew-pool?crew=${crew}&section=H`,{waitUntil:"domcontentloaded"});
  const h=page.getByTestId("crew-internal-records");
  await browserExpect(h).toBeVisible({timeout:45000});
  await h.scrollIntoViewIfNeeded();
  await page.getByTestId("internal-comments").getByRole("button",{name:"Add",exact:true}).click();
  const dialog=page.getByRole("dialog").last();
  await browserExpect(dialog).toContainText("Write as if the seafarer may read this.");
  await dialog.getByLabel("Comment",{exact:true}).fill(`${marker}. ${"Long description for accessible viewing. ".repeat(7)}`);
  await page.screenshot({path:`${out}/add-comment.png`});
  await dialog.getByRole("button",{name:"Save record",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await page.getByTestId("internal-comments").getByRole("button",{name:"Edit comment",exact:true}).click();
  await page.screenshot({path:`${out}/edit-comment.png`});
  await dialog.getByLabel("Comment",{exact:true}).fill(`${marker}. Edited wording retained in history.`);
  await dialog.getByRole("button",{name:"Save record",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await page.getByTestId("internal-comments").getByRole("button",{name:"View record",exact:true}).click();
  await browserExpect(dialog).toContainText(marker);
  await page.screenshot({path:`${out}/view-comment.png`});
  await dialog.getByRole("button",{name:"View history",exact:true}).click();
  await browserExpect(page.getByRole("dialog").last()).toContainText("Long description for accessible viewing.");
  await page.screenshot({path:`${out}/comment-history.png`});
  await page.getByRole("button",{name:"Close history",exact:true}).click();
  await dialog.getByRole("button",{name:"Close",exact:true}).first().click();
  // Hold a real history response across closing its window and a later edit.
  // Releasing it must not overwrite the newly opened, current history.
  let release!:()=>void,received!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const ready=new Promise<void>(resolve=>{received=resolve;});
  await page.route("**/crew-internal/**/comments/*/history",async route=>{
    const response=await route.fetch();received();await held;await route.fulfill({response});
  },{times:1});
  await page.getByTestId("internal-comments").getByRole("button",{name:"View record",exact:true}).click();
  await dialog.getByRole("button",{name:"View history",exact:true}).click();
  await ready;
  await page.getByRole("button",{name:"Close history",exact:true}).click();
  await dialog.getByRole("button",{name:"Close",exact:true}).first().click();
  await page.getByTestId("internal-comments").getByRole("button",{name:"Edit comment",exact:true}).click();
  await dialog.getByLabel("Comment",{exact:true}).fill(`${marker}. Second approved revision.`);
  await dialog.getByRole("button",{name:"Save record",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await page.getByTestId("internal-comments").getByRole("button",{name:"View record",exact:true}).click();
  await dialog.getByRole("button",{name:"View history",exact:true}).click();
  const historyDialog=page.getByRole("dialog").last();
  await browserExpect(historyDialog).toContainText("Second approved revision.");
  const oldFinished=page.waitForResponse(r=>r.url().includes("/comments/")&&r.url().endsWith("/history"));
  release();await (await oldFinished).finished();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await browserExpect(historyDialog).toContainText("Second approved revision.");
  await page.getByRole("button",{name:"Close history",exact:true}).click();
  await dialog.getByRole("button",{name:"Close",exact:true}).first().click();
  await page.getByTestId("internal-actions").getByRole("button",{name:"Add",exact:true}).click();
  await dialog.getByLabel("Action description",{exact:true}).fill("Arrange refresher training with the office.");
  await dialog.getByLabel("Assigned to",{exact:true}).selectOption(actor);
  await dialog.getByLabel("Due date",{exact:true}).fill("2020-01-01");
  await page.screenshot({path:`${out}/add-action.png`});
  await dialog.getByRole("button",{name:"Save record",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await browserExpect(h).toContainText("Overdue");
  await h.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/overdue.png`});
  await page.getByTestId("internal-actions").getByRole("button",{name:"Edit action",exact:true}).click();
  await page.screenshot({path:`${out}/edit-action.png`});
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.getByTestId("internal-actions").getByRole("button",{name:"Complete action",exact:true}).click();
  await dialog.getByLabel(/Closing note/).fill("Training arranged.");
  await dialog.getByRole("button",{name:"Complete action",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await browserExpect(h).toContainText("Completed");
  await page.screenshot({path:`${out}/completed.png`});
  await page.getByTestId("internal-comments").getByRole("button",{name:"Remove record",exact:true}).click();
  await dialog.getByLabel("Reason for removal").fill("Recorded on the wrong seafarer.");
  await dialog.getByRole("button",{name:"Remove record",exact:true}).click();
  await browserExpect(dialog).not.toBeVisible();
  await browserExpect(h).toContainText("Comment removed by");
  await page.screenshot({path:`${out}/removed-desktop.png`});
  const downloadWait=page.waitForEvent("download");
  await page.getByTestId("button-export").click();
  const download=await downloadWait;
  const pdf=await download.path();
  const pdfText=execFileSync("pdftotext",[pdf!,"-"],{encoding:"utf8"});
  expect(pdfText).toContain("Internal Records");
  expect(pdfText).not.toContain(marker);
  expect(pdfText).not.toContain("Arrange refresher training");
  expect(pdfText).not.toContain("Part H");
  await download.saveAs(`${out}/profile-export-without-part-h.pdf`);
  await page.setViewportSize({width:480,height:1000});
  await h.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/part-h-narrow.png`});
  const snapshot=JSON.stringify((await pool.query("SELECT * FROM crew_internal_comments WHERE crew_uuid=$1",[crew])).rows);
  expect(snapshot).toContain(marker);
},120000);
it("refuses vessel access through every route even with grants; keeps general crew APIs free of Part H",async()=>{
  const ctx=await persona(shipUserId,shipRole,shipRoleName,"Ship");
  const routes:Array<[string,string,any]>=[];
  for(const resource of ["comments","actions"]){
    const base=`/api/v2/crew-internal/${crew}/${resource}`;
    routes.push(["GET",base,null],["GET",`${base}/some-entry`,null],["GET",`${base}/some-entry/history`,null],
      ["POST",base,{body:"Cannot save"}],["PATCH",`${base}/some-entry`,{body:"Cannot change",revision:1}],
      ["POST",`${base}/some-entry/remove`,{reason:"Cannot remove",revision:1}]);
  }
  routes.push(["GET",`/api/v2/crew-internal/${crew}/assignees`,null],
    ["POST",`/api/v2/crew-internal/${crew}/actions/some-entry/complete`,{revision:1}],
    ["POST",`/api/v2/crew-internal/${crew}/actions/some-entry/reopen`,{revision:1}]);
  for(const [method,path,data] of routes){
    const response=await ctx.request.fetch(`${process.env.TEST_API_URL}${path}`,{
      method,data:data||undefined,headers:{Authorization:`Bearer ${token(shipUserId,"Ship")}`}});
    expect(response.status(),path).toBe(403);
    expect((await response.json()).message).toBe("Internal records are available only to authorised office users.");
  }
  for(const [method,path,data] of routes){
    const response=await context.request.fetch(`${process.env.TEST_API_URL}${path.replace(crew,randomUUID())}`,{
      method,data:data||undefined,headers:{Authorization:`Bearer ${token(userId,"Office")}`}});
    expect(response.status(),`wrong crew ${path}`).toBe(404);
  }
  await pool.query("UPDATE adm_roleaccess_ac SET canview=false WHERE role_id=$1 AND menu_id IN ('cp-internal-comments','cp-internal-actions')",[role]);
  try{
    for(const [method,path,data] of routes){
      const response=await context.request.fetch(`${process.env.TEST_API_URL}${path}`,{
        method,data:data||undefined,headers:{Authorization:`Bearer ${token(userId,"Office")}`}});
      expect(response.status(),`missing grant ${path}`).toBe(403);
    }
  }finally{
    await pool.query("UPDATE adm_roleaccess_ac SET canview=true WHERE role_id=$1 AND menu_id IN ('cp-internal-comments','cp-internal-actions')",[role]);
  }
  const p=await ctx.newPage();
  await p.setExtraHTTPHeaders({Authorization:`Bearer ${token(shipUserId,"Ship")}`});
  await p.goto(`${process.env.TEST_API_URL}/api/v2/crew-internal/${crew}/comments`);
  await browserExpect(p.locator("body")).toContainText("Internal records are available only to authorised office users.");
  await p.screenshot({path:`${out}/vessel-refusal.png`});
  for(const path of [`/api/v2/crew-pool/crew/${crew}`,`/api/v2/crew-pool/crew/${crew}/profile`,
    "/api/v2/crew-pool/crew","/api/v2/crew-pool/crew/enriched","/api/v2/crew-pool/crew/details"]){
    const response=await context.request.get(`${process.env.TEST_API_URL}${path}`,{headers:{Authorization:`Bearer ${token(userId,"Office")}`}});
    expect(response.ok(),path).toBe(true);
    const text=await response.text();expect(text).not.toContain(marker);expect(text).not.toContain("crew_internal_");
  }
  await ctx.close();
},60000);
it("shows both ordinary permission rows in the existing Access Control grid",async()=>{
  const admin=(await pool.query(`SELECT r.ruid,r.assigned_role FROM adm_rolemaster_ac r
    JOIN master_users u ON u.role=r.assigned_role WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
  const ctx=await persona(24,admin.ruid,admin.assigned_role,"Office");
  const p=await ctx.newPage();
  await p.goto(`${process.env.TEST_API_URL}/admin`,{waitUntil:"domcontentloaded"});
  await p.getByText("Access Control",{exact:true}).first().click({timeout:30000});
  await p.getByTestId(`role-item-${role}`).click();
  const chain=(await pool.query(`WITH RECURSIVE parents AS (
    SELECT muid,parent_menu,0 AS depth FROM adm_menumaster_ac WHERE muid='cp-internal-comments'
    UNION ALL SELECT m.muid,m.parent_menu,p.depth+1 FROM adm_menumaster_ac m JOIN parents p ON p.parent_menu=m.muid
  ) SELECT * FROM parents ORDER BY depth DESC`)).rows;
  for(let i=0;i<chain.length-1;i++){
    const toggle=p.getByTestId(`toggle-menu-${chain[i].muid}`);
    await browserExpect(toggle).toBeVisible();
    if((await toggle.locator("svg").getAttribute("class"))?.includes("lucide-chevron-right"))await toggle.click();
    await browserExpect(p.getByTestId(`permission-row-${chain[i+1].muid}`)).toBeVisible();
  }
  const row=p.getByTestId("permission-row-cp-internal-comments");
  await row.scrollIntoViewIfNeeded();
  await browserExpect(row).toContainText("Internal Comments");
  await browserExpect(p.getByTestId("permission-row-cp-internal-actions")).toContainText("Internal Actions");
  await p.screenshot({path:`${out}/access-control-rows.png`});
  await ctx.close();
},60000);
