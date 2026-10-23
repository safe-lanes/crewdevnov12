import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID as uuid } from "node:crypto";
import request from "supertest";
import { getDb } from "@server/v2/db";
import { copyFormVersionStructure } from "@server/v2/admin/services/formStructureService";
import { copyApplicability } from "@server/v2/admin/services/applicabilityService";
import { readFile } from "node:fs/promises";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const forms: string[] = [];
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 24, domain: "test", userType: "Office" })}.devsig`;
const call = (method: "get" | "put" | "post", path: string, body: object = {}) =>
  request(process.env.TEST_API_URL!)[method](`/api/v2/admin${path}`)
    .set("Authorization", `Bearer ${token}`).send(body);
beforeAll(() => {
  expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
});

async function fixture(company = true) {
  const formUuid = uuid(); forms.push(formUuid);
  const f = (await pool.query(`INSERT INTO adm_forms_v2
    (form_uuid,name,category,subject_type,rank_group,version_no,version_date)
    VALUES($1,$2,$3,$4,'','00','23-Oct-2026') RETURNING *`,
    [formUuid, `TEST ONLY unfinished ${formUuid}`,company ? "dynamic" : "briefing",company ? "crew_assignment" : null])).rows[0];
  await pool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
    VALUES($1,$2,'MAIN','Main','configurable')`, [uuid(),formUuid]);
  if (!company) {
    const v=(await pool.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,configuration,status)
      VALUES($1,$2,'00','23-Oct-2026','{}','draft') RETURNING id,fv_uuid AS "fvUuid"`,[uuid(),f.id])).rows[0];
    const part=uuid();
    await pool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,form_version_uuid,part_code,part_title,part_type)
      VALUES($1,$2,$3,'MAIN','Main','configurable')`,[part,formUuid,v.fvUuid]);
    return {f,v,part};
  }
  const created = await call("post",`/forms/${f.id}/versions`,{
    versionNo:"00",versionDate:"23-Oct-2026",configuration:"{}",stageKey:"before_joining",
  });
  expect(created.status,JSON.stringify(created.body)).toBe(200);
  const v = created.body;
  const part = (await pool.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1",[v.fvUuid])).rows[0].form_part_uuid;
  return { f,v,part };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const tree = () => ({
  option_sets: [] as any[],
  sections: [{
    section_code:"MAIN", section_title:"Main", responsible_mode:"seafarer",
    questions:[{ question_code:"Q1",question_text:"Your answer",response_type:"free_text",comment_enabled:true }],
  }] as any[],
});
const save = (f: Fixture,t: ReturnType<typeof tree>,bulk=false) => bulk
  ? call("put",`/form-versions/${f.v.fvUuid}/structures`,{ parts:[{form_part_uuid:f.part,structure:t}] })
  : call("put",`/form-versions/${f.v.fvUuid}/parts/${f.part}/structure`,t);
const release = (f: Fixture) => call("post",`/form-versions/${f.v.id}/release`);
async function refused(query: string, values: any[] = []) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await expect(c.query(query,values)).rejects.toBeTruthy();
  } finally { await c.query("ROLLBACK"); c.release(); }
}

describe("Company Form draft completeness is checked on every release",() => {
  const cases: [string,(t: ReturnType<typeof tree>) => void][] = [
    ["blank point wording",t => { t.sections[0].questions[0].question_text=""; }],
    ["unfinished named answer set",t => { t.option_sets=[{option_set_name:"",options:[]}]; }],
    ["named answer set without choices",t => { t.option_sets=[{option_set_name:"Answers",options:[]}]; }],
    ["blank choice label",t => { t.option_sets=[{option_set_name:"Answers",options:[{option_label:"",option_value:"yes"}]}]; }],
    ["system field not chosen",t => { t.sections[0].questions.push({
      question_code:"FIELD",question_text:"Rank",response_type:"system_field",comment_enabled:false,
    }); }],
    ["blank section title",t => { t.sections[0].section_title=""; }],
    ["empty content body",t => { t.sections[0].questions.push({
      question_code:"CONTENT",question_text:"",response_type:"content",content_html:"",
    }); }],
    ["role not chosen",t => { t.sections[0].responsible_mode="role"; }],
    ["department not chosen",t => { t.sections[0].responsible_mode="department"; }],
    ["missing choices",t => { t.sections[0].questions[0].response_type="single_select"; }],
  ];
  for (const [name,change] of cases) for (const bulk of [false,true]) {
    it(`${name}: ${bulk ? "bulk" : "single"} save succeeds; unchanged release is refused`,async () => {
      const f=await fixture(),t=tree(); change(t);
      const saved=await save(f,t,bulk);
      expect(saved.status,JSON.stringify(saved.body)).toBe(200);
      // No edit or second save between the successful save and release.
      expect((await release(f)).status).toBe(400);
      expect((await pool.query("SELECT status FROM adm_form_versions_v2 WHERE fv_uuid=$1",[f.v.fvUuid])).rows[0].status).toBe("draft");
    });
  }
  for (const policy of [{mode:"all"},{mode:"all",obligation:"mandatory",effectiveKind:"specific_date"}]) {
    it(`incomplete automatic applicability saves but unchanged release refuses ${JSON.stringify(policy)}`,async () => {
      const f=await fixture();
      expect((await save(f,tree())).status).toBe(200);
      const p=await call("put",`/form-versions/${f.v.id}/applicability`,policy);
      expect(p.status,JSON.stringify(p.body)).toBe(200);
      expect((await release(f)).status).toBe(400);
      await refused("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1",[f.v.fvUuid]);
    });
  }
  it("complete draft saves and releases normally, then cannot be edited through the API",async () => {
    const f=await fixture();
    expect((await save(f,tree())).status).toBe(200);
    const r=await release(f);
    expect(r.status,JSON.stringify(r.body)).toBe(200);
    expect((await save(f,tree())).status).toBe(409);
  });
  it("duplicated identities, unsafe content, incompatible settings and unsupported fields still refuse saving",async () => {
    const f=await fixture(),t=tree();
    const sectionUuid=uuid();
    t.sections[0].section_uuid=sectionUuid;
    t.sections.push({...t.sections[0],section_code:"OTHER"});
    expect((await save(f,t)).status).toBe(400);
    const unsafe=tree();
    unsafe.sections[0].questions=[{question_code:"HTML",question_text:"Text",response_type:"content",content_html:"<script>alert(1)</script><p>Text</p>"}];
    expect((await save(f,unsafe)).status).toBe(400);
    const incompatible=tree();
    incompatible.sections[0].responsible_mode="role";
    incompatible.sections[0].responsible_department="Office";
    expect((await save(f,incompatible)).status).toBe(400);
    const unsupported=tree();
    unsupported.sections[0].questions[0].response_type="unsupported";
    expect((await save(f,unsupported)).status).toBe(400);
  });
  it("refuses comments on system fields in single-part and bulk draft writes without changing saved data", async () => {
    const f = await fixture(), t = tree();
    t.sections[0].signature_seafarer_required = true;
    t.sections[0].questions = [{
      question_code: "RANK", question_text: "Rank", response_type: "system_field",
      system_field_key: "rank", comment_enabled: false,
    }];
    expect((await save(f, t)).status).toBe(200);
    const before = (await pool.query(`SELECT q.* FROM frm_questions q JOIN frm_sections s USING(section_uuid)
      WHERE s.form_version_uuid=$1`, [f.v.fvUuid])).rows;
    t.sections[0].questions[0].comment_enabled = true;
    for (const bulk of [false, true]) expect((await save(f, t, bulk)).status).toBe(400);
    expect((await pool.query(`SELECT q.* FROM frm_questions q JOIN frm_sections s USING(section_uuid)
      WHERE s.form_version_uuid=$1`, [f.v.fvUuid])).rows).toEqual(before);
    expect(before[0].comment_enabled).toBe(false);
    expect((await release(f)).status).toBe(200);
  });
  it("copy-version service keeps unfinished data, independently identified, and release still refuses",async () => {
    const source=await fixture(),t=tree();
    // The public endpoint correctly reuses an existing draft. The lower-level
    // copy/import path needs an independent destination, created as a draft.
    const targetVersion=(await pool.query(`INSERT INTO adm_form_versions_v2
      (fv_uuid,form_id,version_no,version_date,configuration,status,stage_key)
      VALUES($1,$2,'01','23-Oct-2026','{}','draft','before_joining')
      RETURNING id,fv_uuid AS "fvUuid"`,[uuid(),source.f.id])).rows[0];
    const target={f:source.f,v:targetVersion,part:""};
    expect(target.v.fvUuid).not.toBe(source.v.fvUuid);
    t.sections[0].responsible_mode="role";
    t.sections[0].questions=[{question_code:"FIELD",question_text:"",response_type:"system_field",comment_enabled:false}];
    expect((await save(source,t)).status).toBe(200);
    // Normal public draft creation copies only a released source. Exercise the
    // existing lower-level copy/import path too, without disabling any trigger.
    await getDb().transaction(async (tx: any) => {
      await copyFormVersionStructure(source.v.fvUuid,target.v.fvUuid,tx);
      await copyApplicability(source.v.fvUuid,target.v.fvUuid,tx);
    });
    const rows=(await pool.query("SELECT section_uuid,form_version_uuid FROM frm_sections WHERE form_version_uuid=ANY($1)",[[source.v.fvUuid,target.v.fvUuid]])).rows;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r: any)=>r.section_uuid)).size).toBe(2);
    expect((await release(target)).status).toBe(400);
    await refused("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1",[target.v.fvUuid]);
  });
  it("direct multi-row INSERT accepts only draft exceptions, and direct release cannot bypass the guard",async () => {
    const f=await fixture(),ids=[uuid(),uuid()];
    await pool.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
      VALUES($1,$3,$4,'A','A','role'),($2,$3,$4,'B','B','department')`,[...ids,f.v.fvUuid,f.part]);
    await pool.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,comment_enabled)
      VALUES($1,$3,'F1','Field','system_field',false),($2,$4,'F2','Field','system_field',false)`,[uuid(),uuid(),...ids]);
    await refused("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1",[f.v.fvUuid]);
    // Fix responsibility only: the missing system keys must independently refuse release.
    await pool.query("UPDATE frm_sections SET responsible_mode='seafarer' WHERE form_version_uuid=$1",[f.v.fvUuid]);
    await refused("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1",[f.v.fvUuid]);
  });
  it("direct INSERT of an already released Company Form version is refused",async () => {
    const f=await fixture();
    await refused(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,configuration,status)
      VALUES($1,$2,'99','23-Oct-2026','{}','released')`,[uuid(),f.f.id]);
  });
  it("released children retain database completeness checks on direct insert and update",async () => {
    const f=await fixture();
    const t=tree();
    t.sections[0].questions.push({question_code:"SYS",question_text:"Rank",response_type:"system_field",
      system_field_key:"crew.rank",comment_enabled:false});
    // Use a regular complete tree; inserts below exercise system-field guard.
    t.sections[0].questions.pop();
    expect((await save(f,t)).status).toBe(200);
    expect((await release(f)).status).toBe(200);
    const section=(await pool.query("SELECT section_uuid FROM frm_sections WHERE form_version_uuid=$1",[f.v.fvUuid])).rows[0].section_uuid;
    await refused(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
      VALUES($1,$2,$3,'BAD','Bad','role')`,[uuid(),f.v.fvUuid,f.part]);
    await refused("UPDATE frm_sections SET responsible_mode='role',responsible_role_uuid=NULL WHERE section_uuid=$1",[section]);
    await refused(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,comment_enabled)
      VALUES($1,$2,'BAD','Bad','system_field',false)`,[uuid(),section]);
  });
  it("Standard Forms retain the original database responsibility rule",async () => {
    // Reuse a synthetic test form; the category-only change is in a rolled back
    // transaction and never alters a real Standard Form.
    const f=await fixture(false),c=await pool.connect();
    try {
      await c.query("BEGIN");
      await expect(c.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
        VALUES($1,$2,$3,'BAD','Bad','department')`,[uuid(),f.v.fvUuid,f.part])).rejects.toBeTruthy();
    } finally { await c.query("ROLLBACK"); c.release(); }
  });
  it("rollback refuses unfinished drafts without changing content or removing guards",async () => {
    const f=await fixture(),t=tree(); t.sections[0].responsible_mode="role";
    expect((await save(f,t)).status).toBe(200);
    const before=(await pool.query("SELECT * FROM frm_sections WHERE form_version_uuid=$1",[f.v.fvUuid])).rows;
    const c=await pool.connect();
    try {
      await expect(c.query(await readFile("migrations/rollback/0266_company_form_unfinished_drafts.sql","utf8"))).rejects.toBeTruthy();
    } finally { await c.query("ROLLBACK"); c.release(); }
    expect((await pool.query("SELECT * FROM frm_sections WHERE form_version_uuid=$1",[f.v.fvUuid])).rows).toEqual(before);
    await refused("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1",[f.v.fvUuid]);
  });
});

afterAll(async () => {
  for (const formUuid of forms) {
    const ids=(await pool.query("SELECT fv_uuid FROM adm_form_versions_v2 WHERE form_id IN(SELECT id FROM adm_forms_v2 WHERE form_uuid=$1)",[formUuid])).rows.map((v: any)=>v.fv_uuid);
    await pool.query("DELETE FROM frm_questions WHERE section_uuid IN(SELECT section_uuid FROM frm_sections WHERE form_version_uuid=ANY($1))",[ids]);
    await pool.query("DELETE FROM frm_sections WHERE form_version_uuid=ANY($1)",[ids]);
    await pool.query("DELETE FROM frm_options WHERE option_set_uuid IN(SELECT option_set_uuid FROM frm_option_sets WHERE form_version_uuid=ANY($1))",[ids]);
    await pool.query("DELETE FROM frm_option_sets WHERE form_version_uuid=ANY($1)",[ids]);
    await pool.query("DELETE FROM frm_form_parts WHERE form_uuid=$1",[formUuid]);
    await pool.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid=ANY($1)",[ids]);
    await pool.query("DELETE FROM adm_forms_v2 WHERE form_uuid=$1",[formUuid]);
  }
  await pool.end();
});
