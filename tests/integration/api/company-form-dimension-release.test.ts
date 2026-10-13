import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../server/v2/db";
import { validateApplicabilityRelease } from "../../../server/v2/admin/services/applicabilityService";
import { retainFixtureReferences } from "../../helpers/fixture-retention";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const enc = (x: object) => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const api = request(process.env.TEST_API_URL!);
const call = (method: "get" | "post" | "put", path: string, body: object = {}) =>
  api[method](`/api/v2/admin${path}`).set("Authorization", `Bearer ${token}`).send(body);

describe("trusted conditional dimension release", () => {
  afterAll(async () => { await pool.end(); });
  it("releases valid master-ID conditions, freezes labels and copies independently without resolving anything", async () => {
    const formUuid = randomUUID(), templatePart = randomUUID();
    retainFixtureReferences("dimension release definition", [formUuid, templatePart]);
    const f = (await pool.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
      VALUES($1,$2,'dynamic','crew_assignment','','00','11-Oct-2026') RETURNING id`,
    [formUuid, `TEST ONLY Dimension release ${formUuid.slice(0, 8)}`])).rows[0];
    await pool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
      VALUES($1,$2,'MAIN','Dimension evidence','configurable')`, [templatePart, formUuid]);
    const v = (await call("post", `/forms/${f.id}/versions`, {
      versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "before_joining",
    })).body;
    expect(v.fvUuid).toBeTruthy();
    const part = (await pool.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_version_uuid=$1", [v.fvUuid])).rows[0].form_part_uuid;
    const section = randomUUID(), question = randomUUID();
    retainFixtureReferences("dimension release draft content", [v.fvUuid, part, section, question]);
    await pool.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
      VALUES($1,$2,$3,'DIM','Declaration','seafarer')`, [section, v.fvUuid, part]);
    await pool.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type)
      VALUES($1,$2,'ANSWER','Original wording','free_text')`, [question, section]);
    const catalog = await call("get", `/forms/${f.id}/rule-dimensions`);
    expect(catalog.status).toBe(200);
    const selected = catalog.body.find((d: any) => d.key === "rank").choices[0];
    const body = { mode: "conditional", obligation: "mandatory", sets: [{ conditions: [
      { dimensionKey: "rank", operator: "in", value: [selected.id] },
      { dimensionKey: "first_in_rank", operator: "is", value: true },
    ] }] };
    const saved = await call("put", `/form-versions/${v.id}/applicability`, body);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const rankCondition = saved.body.sets[0].conditions.find((c: any) => c.dimensionKey === "rank");
    expect(rankCondition.valueLabels).toEqual([selected]);
    retainFixtureReferences("dimension release condition data", saved.body.sets);
    expect((await call("put", `/form-versions/${v.id}/applicability`, {
      ...body, dimensionValidationReady: true,
    })).status).toBe(400);
    // A validation proof from an earlier transaction must not open SQL release.
    await getDb().transaction(async (tx: any) => {
      await validateApplicabilityRelease(v.fvUuid, tx);
      const competing = await pool.connect();
      try {
        await competing.query("BEGIN");
        await expect(competing.query("SELECT ar_uuid FROM adm_available_ranks_v2 WHERE ar_uuid=$1 FOR UPDATE NOWAIT", [selected.id]))
          .rejects.toMatchObject({ code: "55P03" });
      } finally { await competing.query("ROLLBACK"); competing.release(); }
    });
    await expect(pool.query("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [v.fvUuid]))
      .rejects.toMatchObject({ code: "23514" });
    const released = await call("post", `/form-versions/${v.id}/release`);
    expect(released.status, JSON.stringify(released.body)).toBe(200);
    expect((await call("put", `/form-versions/${v.id}/applicability`, { mode: "manual_only" })).status).toBe(409);
    await expect(pool.query("UPDATE frm_applicability_conditions SET value_labels='[]' WHERE condition_uuid=$1", [rankCondition.conditionUuid]))
      .rejects.toMatchObject({ code: "23514" });
    const copy = (await call("post", `/forms/${f.id}/versions`, {
      versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "before_joining",
    })).body;
    const copied = (await call("get", `/form-versions/${copy.id}/applicability`)).body;
    retainFixtureReferences("dimension release copied draft", [copy.fvUuid, ...copied.sets]);
    expect(copied.sets[0].setUuid).not.toBe(saved.body.sets[0].setUuid);
    expect(copied.sets[0].conditions.every((c: any) => !saved.body.sets[0].conditions.some((s: any) => s.conditionUuid === c.conditionUuid))).toBe(true);
    expect(copied.sets[0].conditions.find((c: any) => c.dimensionKey === "rank").valueLabels).toEqual([selected]);
    expect((await pool.query("SELECT count(*)::int n FROM frm_company_submissions WHERE form_uuid=$1", [formUuid])).rows[0].n).toBe(0);
  });
});
