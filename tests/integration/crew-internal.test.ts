import { beforeAll,afterAll,describe,it,expect,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Request } from "express";
const holder=vi.hoisted(()=>({db:null as any}));
vi.mock("@server/v2/db",()=>({getDb:()=>holder.db}));
import { authorize,eligibleAssignees } from "../../server/v2/crew-internal/access";
import { createComment,editComment,removeEntry } from "../../server/v2/crew-internal/write";
import { listEntries,history,readEntry } from "../../server/v2/crew-internal/read";
import { createAction,editAction,transitionAction } from "../../server/v2/crew-internal/actions";
const schema=`test_internal_${randomUUID().replaceAll("-","")}`;
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`,max:6});
const crew="internal-fixture";
const req=(id=1,body:any={},entryUuid="",crewUuid=crew)=>({user:{id,userType:id===4?"Ship":"Office"},
  params:{crewUuid,entryUuid},body}) as unknown as Request;
beforeAll(async()=>{
  await admin.query(`CREATE SCHEMA ${schema}`);
  for(const table of ["master_users","adm_rolemaster_ac","adm_roleaccess_ac","adm_menumaster_ac","crew_members_v2"])
    await pool.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
  await pool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name) VALUES($1,'INTERNAL','Internal fixture')`,[crew]);
  await pool.query(`INSERT INTO adm_menumaster_ac(muid,name,route) VALUES('crew','Crew Database','/crew')`);
  await pool.query(await readFile("migrations/0273_crew_internal_records.sql","utf8"));
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype) VALUES
    ('author','Crew Manager','Office'),('viewer','Viewer','Office'),('deleter','Remover','Office'),('ship','Ship fixture','Ship')`);
  await pool.query(`INSERT INTO master_users(id,user_uuid,fullname,user_type,role,designation) VALUES
    (1,'author','John Adams','Office','Crew Manager','Marine Superintendent'),
    (2,'viewer','Maria James','Office','Viewer',NULL),
    (3,'deleter','Remover','Office','Remover','Crew Executive'),
    (4,'ship','Vessel User','Ship','Ship fixture','Master')`);
  await pool.query(await readFile("migrations/0274_crew_internal_permissions.sql","utf8"));
  await pool.query(`UPDATE adm_roleaccess_ac SET canview=true,cancreate=true,
    canedit=(role_id='author'),candelete=(role_id='deleter')`);
  holder.db=drizzle(pool);
});
describe("Part H action lifecycle",()=>{
  it("revalidates assignees and records reassignment independently of live labels",async()=>{
    await expect(createAction(req(1,{body:"Task",assigneeUuid:"ship",dueDate:"2026-11-17"}))).rejects.toMatchObject({status:400});
    const row=await createAction(req(1,{body:"Task",assigneeUuid:"viewer",dueDate:"2026-11-17"}));
    expect(row.assignee.designation).toBe("designation not recorded");
    await editAction(req(1,{body:"Assigned again",assigneeUuid:"deleter",dueDate:"2026-11-18",revision:1},row.entry_uuid));
    const events=await history(holder.db,"actions",crew,row.entry_uuid,false);
    expect(events.map((e:any)=>e.event)).toEqual(["created","reassigned"]);
    expect(events[0].snapshot.assignee.uuid).toBe("viewer");
    await pool.query("UPDATE adm_roleaccess_ac SET canview=false WHERE role_id='viewer' AND menu_id='cp-internal-actions'");
    await expect(editAction(req(1,{body:"Task",assigneeUuid:"viewer",dueDate:"2026-11-17",revision:2},row.entry_uuid))).rejects.toMatchObject({status:400});
    await pool.query("UPDATE adm_roleaccess_ac SET canview=true WHERE role_id='viewer'");
  });
  it("allows assignee and raiser to complete/reopen without Edit, retaining completion history",async()=>{
    const row=await createAction(req(2,{body:"Action",assigneeUuid:"author",dueDate:"2026-11-17"}));
    await expect(transitionAction(req(3,{revision:1},row.entry_uuid),true)).rejects.toMatchObject({status:403});
    await transitionAction(req(2,{revision:1,closingNote:"Finished"},row.entry_uuid),true);
    await transitionAction(req(1,{revision:2,closingNote:"Review again"},row.entry_uuid),false);
    const events=await history(holder.db,"actions",crew,row.entry_uuid,false);
    expect(events.map((e:any)=>e.event)).toEqual(["created","completed","reopened"]);
    expect(events[1].snapshot.completed_by.uuid).toBe("viewer");
    expect(events[1].snapshot.closing_note).toBe("Finished");
    expect(events[2].snapshot.completed_at).toBeNull();
  });
  it("derives overdue on UTC day boundaries without storing that status",async()=>{
    const today=(await pool.query("SELECT (now() AT TIME ZONE 'UTC')::date::text AS d")).rows[0].d;
    const yesterday=(await pool.query("SELECT ((now() AT TIME ZONE 'UTC')::date-1)::text AS d")).rows[0].d;
    const due=await createAction(req(1,{body:"Due today",assigneeUuid:"viewer",dueDate:today}));
    const overdue=await createAction(req(1,{body:"Due yesterday",assigneeUuid:"viewer",dueDate:yesterday}));
    const rows=await listEntries(holder.db,"actions",crew,false);
    expect(rows.find((r:any)=>r.entry_uuid===due.entry_uuid).overdue).toBe(false);
    expect(rows.find((r:any)=>r.entry_uuid===overdue.entry_uuid).overdue).toBe(true);
    expect(rows.find((r:any)=>r.entry_uuid===overdue.entry_uuid).status).toBe("Open");
    await transitionAction(req(2,{revision:1},overdue.entry_uuid),true);
    expect((await listEntries(holder.db,"actions",crew,false)).find((r:any)=>r.entry_uuid===overdue.entry_uuid).overdue).toBe(false);
    await expect(createAction(req(1,{body:"Bad date",assigneeUuid:"viewer",dueDate:"2026-02-30"}))).rejects.toMatchObject({status:400});
  });
  it("restricts removed action content and history, and rejects all later transitions",async()=>{
    const row=await createAction(req(1,{body:"Private action",assigneeUuid:"viewer",dueDate:"2026-11-17"}));
    await removeEntry(req(3,{reason:"wrong seafarer",revision:1},row.entry_uuid),"actions");
    expect(JSON.stringify((await listEntries(holder.db,"actions",crew,false)).find((r:any)=>r.entry_uuid===row.entry_uuid))).not.toContain("Private action");
    await expect(history(holder.db,"actions",crew,row.entry_uuid,false)).rejects.toMatchObject({status:403});
    expect((await history(holder.db,"actions",crew,row.entry_uuid,true))[0].snapshot.body).toBe("Private action");
    await expect(transitionAction(req(2,{revision:2},row.entry_uuid),true)).rejects.toMatchObject({status:409});
  });
});
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();});
describe("Part H comment lifecycle",()=>{
  it("does not let a different crew record address an entry or its revisions",async()=>{
    const row=await createComment(req(1,{body:"Exact crew only"}));
    await expect(readEntry(holder.db,"comments","different-crew",row.entry_uuid)).rejects.toMatchObject({status:404});
    await expect(history(holder.db,"comments","different-crew",row.entry_uuid,true)).rejects.toMatchObject({status:404});
  });
  it("does not fall through from a second tenant schema into the first tenant",async()=>{
    const tenant=`${schema}_tenant2`;
    await admin.query(`CREATE SCHEMA ${tenant}`);
    const second=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${tenant}`});
    try{
      for(const t of ["master_users","adm_rolemaster_ac","adm_menumaster_ac","adm_roleaccess_ac","crew_members_v2"]){
        await second.query(`CREATE TABLE ${t} (LIKE ${schema}.${t} INCLUDING ALL)`);
        if(t!=="crew_members_v2")await second.query(`INSERT INTO ${t} SELECT * FROM ${schema}.${t}`);
      }
      holder.db=drizzle(second);
      await expect(authorize(req(1),"comments")).rejects.toMatchObject({status:404});
    }finally{holder.db=drizzle(pool);await second.end();await admin.query(`DROP SCHEMA ${tenant} CASCADE`);}
  });
  it("refuses missing matching View/Create/Edit/Delete even with a general crew grant",async()=>{
    await pool.query(`INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview,cancreate,canedit,candelete)
      VALUES('general','viewer','crew',true,true,true,true)`);
    try{
      for(const resource of ["comments","actions"] as const){
        await pool.query("UPDATE adm_roleaccess_ac SET canview=false WHERE role_id='viewer' AND menu_id=$1",
          [resource==="comments"?"cp-internal-comments":"cp-internal-actions"]);
        await expect(authorize(req(2),resource)).rejects.toMatchObject({status:403});
        await pool.query("UPDATE adm_roleaccess_ac SET canview=true,cancreate=false,canedit=false,candelete=false WHERE role_id='viewer'");
        for(const capability of ["cancreate","canedit","candelete"])
          await expect(authorize(req(2),resource,capability)).rejects.toMatchObject({status:403});
      }
    }finally{await pool.query("UPDATE adm_roleaccess_ac SET canview=true,cancreate=true WHERE role_id='viewer'");}
  });
  it("freezes the server name and designation; rejects browser identity",async()=>{
    await expect(createComment(req(1,{body:"private",author:{name:"forged"}}))).rejects.toMatchObject({status:400});
    const row=await createComment(req(1,{body:"Frozen wording"}));
    expect(row.author).toEqual({uuid:"author",name:"John Adams",designation:"Marine Superintendent"});
    await pool.query("UPDATE master_users SET fullname='Later name',designation='Later designation' WHERE id=1");
    expect((await listEntries(holder.db,"comments",crew,false)).find((r:any)=>r.entry_uuid===row.entry_uuid).author.name).toBe("John Adams");
    await pool.query("UPDATE master_users SET fullname='John Adams',designation='Marine Superintendent' WHERE id=1");
    const missing=await createComment(req(2,{body:"missing designation"}));
    expect(missing.author.designation).toBe("designation not recorded");
  });
  it("requires comment author AND Edit and retains every revision",async()=>{
    const row=await createComment(req(1,{body:"Original"}));
    await expect(editComment(req(2,{body:"Other",revision:1},row.entry_uuid))).rejects.toMatchObject({status:403});
    await pool.query("UPDATE adm_roleaccess_ac SET canedit=true WHERE role_id='deleter'");
    await expect(editComment(req(3,{body:"Other",revision:1},row.entry_uuid))).rejects.toMatchObject({status:403});
    await editComment(req(1,{body:"Revised",revision:1},row.entry_uuid));
    const revisions=await history(holder.db,"comments",crew,row.entry_uuid,false);
    expect(revisions.map((e:any)=>e.snapshot.body)).toEqual(["Original","Revised"]);
    expect(revisions[1].snapshot.edited).toBe(true);
  });
  it("retains a removed line for View but restricts all removed wording/history to Delete",async()=>{
    const row=await createComment(req(1,{body:"Wrong seafarer private text"}));
    await editComment(req(1,{body:"Revised wrong text",revision:1},row.entry_uuid));
    await expect(removeEntry(req(3,{reason:" ",revision:2},row.entry_uuid),"comments")).rejects.toMatchObject({status:400});
    await expect(removeEntry(req(2,{reason:"wrong crew",revision:2},row.entry_uuid),"comments")).rejects.toMatchObject({status:403});
    await removeEntry(req(3,{reason:"wrong crew",revision:2},row.entry_uuid),"comments");
    const line=(await listEntries(holder.db,"comments",crew,false)).find((r:any)=>r.entry_uuid===row.entry_uuid);
    expect(Object.keys(line).sort()).toEqual(["crew_uuid","entry_uuid","removal_reason","removed_at","removed_by","revision"]);
    expect(line.removal_reason).toBe("wrong crew");
    await expect(history(holder.db,"comments",crew,row.entry_uuid,false)).rejects.toMatchObject({status:403});
    expect((await history(holder.db,"comments",crew,row.entry_uuid,true))[0].snapshot.body).toBe("Wrong seafarer private text");
    await expect(pool.query("DELETE FROM crew_internal_comments WHERE entry_uuid=$1",[row.entry_uuid])).rejects.toThrow("retained");
    await expect(pool.query("UPDATE crew_internal_comments_events SET event='edited' WHERE entry_uuid=$1",[row.entry_uuid])).rejects.toThrow("append-only");
  });
  it("catches concurrent edits without silently overwriting",async()=>{
    const row=await createComment(req(1,{body:"Start"}));
    const results=await Promise.allSettled(["A","B"].map(body=>editComment(req(1,{body,revision:1},row.entry_uuid))));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
    expect(await history(holder.db,"comments",crew,row.entry_uuid,false)).toHaveLength(2);
  });
  it("fails closed for vessel, unknown crew and absent grants; assignees are narrow",async()=>{
    for(const resource of ["comments","actions"] as const) {
      await expect(authorize(req(4),resource)).rejects.toMatchObject({status:403});
      await expect(authorize(req(1,{},"","another-tenant-crew"),resource)).rejects.toMatchObject({status:404});
    }
    const users=await eligibleAssignees(holder.db);
    expect(users.map((u:any)=>u.uuid)).toEqual(expect.arrayContaining(["author","viewer","deleter"]));
    expect(users.find((u:any)=>u.uuid==="ship")).toBeUndefined();
    expect(Object.keys(users[0]).sort()).toEqual(["designation","name","uuid"]);
  });
});
