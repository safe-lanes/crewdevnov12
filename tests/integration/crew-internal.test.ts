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
import { listEntries,history } from "../../server/v2/crew-internal/read";
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
afterAll(async()=>{await pool.end();await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();});
describe("Part H comment lifecycle",()=>{
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
