import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { retainFixtureReferences } from "../../helpers/fixture-retention";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const api = request("http://127.0.0.1:5000");
const call = (method: "get" | "post" | "put", path: string, body: object = {}) =>
  api[method](`/api/v2/admin${path}`).set("Authorization", `Bearer ${token}`).send(body);
let formId: number, version: any, policy: any, choices: any[], subjects: string[] = [], crews: string[] = [];
const suffix = randomUUID().slice(0, 8);
const snapshot = async () => (await pool.query(`SELECT
  (SELECT count(*) FROM frm_resolution_runs) runs,
  (SELECT count(*) FROM frm_requirements) requirements,
  (SELECT count(*) FROM frm_requirement_history) transitions,
  (SELECT count(*) FROM frm_company_submissions) forms,
  (SELECT count(*) FROM crew_assignment_rule_context) contexts,
  (SELECT count(*) FROM crew_sea_service) service,
  (SELECT jsonb_agg(to_jsonb(p)) FROM frm_version_applicability p WHERE version_uuid=$1) policy`,
  [version.fvUuid])).rows[0];

describe("Company Form rule editor read-only authoring APIs", () => {
  beforeAll(async () => {
    const formUuid = randomUUID(), template = randomUUID();
    retainFixtureReferences("rule editor definition", [formUuid, template]);
    formId = (await pool.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
      VALUES($1,$2,'dynamic','crew_assignment','','00','12-Oct-2026') RETURNING id`,
    [formUuid, `TEST ONLY Rule editor ${suffix}`])).rows[0].id;
    await pool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
      VALUES($1,$2,'MAIN','Rule evidence','configurable')`, [template, formUuid]);
    const response = await call("post", `/forms/${formId}/versions`,
      { versionNo: "00", versionDate: "12-Oct-2026", configuration: "{}", stageKey: "before_joining" });
    retainFixtureReferences("rule editor automatically created versions and parts", [
      ...(await pool.query("SELECT fv_uuid FROM adm_form_versions_v2 WHERE form_id=$1", [formId])).rows,
      ...(await pool.query("SELECT form_part_uuid FROM frm_form_parts WHERE form_uuid=$1", [formUuid])).rows,
    ]);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    version = response.body;
    retainFixtureReferences("rule editor draft", [version.fvUuid]);
    choices = (await call("get", `/forms/${formId}/rule-dimensions`)).body;
    const ranks = choices.find(d => d.key === "rank").choices;
    const nationalities = choices.find(d => d.key === "nationality").choices;
    expect(ranks.length).toBeGreaterThan(2); expect(nationalities.length).toBeGreaterThan(1);
    const vessel = (await pool.query("SELECT vessel_uuid FROM master_vessels WHERE is_active=true AND is_deleted=false ORDER BY id LIMIT 1")).rows[0].vessel_uuid;
    for (let index = 0; index < 2; index++) {
      const crew = randomUUID(), subject = randomUUID();
      retainFixtureReferences(`rule trial seafarer ${index + 1}`, [crew, subject]);
      await pool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,nationality_uuid)
        VALUES($1,$2,$3,'Rule trial',$4)`, [crew, `RULE-${suffix}-${index}`, `TEST RULE ${suffix} ${index}`, nationalities[index].id]);
      await pool.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date)
        VALUES($1,$2,$3,'OnBoard',true,'2026-10-01')`, [subject, crew, vessel]);
      await pool.query(`INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source)
        VALUES($1,$2,$3,$4::jsonb)`, [subject, ranks[index].id, ranks[index].label, JSON.stringify({ method: "retained_test_fixture" })]);
      subjects.push(subject); crews.push(crew);
    }
    policy = { mode: "conditional", obligation: "mandatory", effectiveKind: "on_release", sets: [
      { conditions: [
        { dimensionKey: "nationality", operator: "in", value: [nationalities[0].id] },
        { dimensionKey: "rank", operator: "in", value: [ranks[0].id] },
      ] },
      { conditions: [{ dimensionKey: "rank", operator: "in", value: [ranks[2].id] }] },
    ] };
  });
  afterAll(async () => { await pool.end(); });
  it("starts manual only and trials two sets with different outcomes without saving any policy or operational records", async () => {
    expect((await call("get", `/form-versions/${version.id}/applicability`)).body.mode).toBe("manual_only");
    const before = await snapshot();
    for (const [index, expected] of ["applies", "does_not_apply"].entries()) {
      const result = await call("post", `/form-versions/${version.id}/applicability/preview`,
        { subjectRef: subjects[index], policy });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.outcome).toBe(expected);
      expect(result.body.sets).toHaveLength(2);
      expect(result.body.timing).toContain("Draft trial only");
    }
    expect(await snapshot()).toEqual(before);
  });
  it("searches retained exact assignments with readable context", async () => {
    const result = await call("get", `/form-versions/${version.id}/applicability/assignments?search=${suffix}`);
    expect(result.status).toBe(200);
    expect(result.body.map((r: any) => r.subjectRef).sort()).toEqual([...subjects].sort());
    expect(result.body.every((r: any) => !r.label.includes(r.subjectRef))).toBe(true);
  });
  it("reports imported-on-board missing first-service captures as unresolved, never No", async () => {
    const before = await snapshot();
    const result = await call("post", `/form-versions/${version.id}/applicability/preview`, {
      subjectRef: subjects[0], policy: { mode: "conditional", obligation: "optional", sets: [
        { conditions: [{ dimensionKey: "first_ever", operator: "is", value: true },
          { dimensionKey: "first_in_rank", operator: "is", value: true }] },
      ] },
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.outcome).toBe("unresolved");
    expect(result.body.sets[0].conditions.every((c: any) => c.observed === "Unresolved")).toBe(true);
    expect(await snapshot()).toEqual(before);
    expect((await pool.query("SELECT count(*)::int n FROM crew_sea_service WHERE crew_uuid=ANY($1)", [crews])).rows[0].n).toBe(0);
  });
  it("rejects forged identity/facts, unavailable dimensions and unsupported comparisons", async () => {
    for (const extra of [{ actor: { id: 24 } }, { facts: { first_ever: true } }]) {
      expect((await call("post", `/form-versions/${version.id}/applicability/preview`,
        { subjectRef: subjects[0], policy, ...extra })).status).toBe(400);
    }
    for (const condition of [
      { dimensionKey: "owner", operator: "in", value: [randomUUID()] },
      { dimensionKey: "rank", operator: "contains_all", value: [choices.find(d => d.key === "rank").choices[0].id] },
      { dimensionKey: "rank", operator: "in", value: [randomUUID()] },
    ]) {
      const result = await call("post", `/form-versions/${version.id}/applicability/preview`,
        { subjectRef: subjects[0], policy: { ...policy, sets: [{ conditions: [condition] }] } });
      expect(result.status).toBe(400);
      expect(JSON.stringify(result.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    }
  });
  it("preserves identities on repeated draft saves", async () => {
    const saved = await call("put", `/form-versions/${version.id}/applicability`, policy);
    expect(saved.status).toBe(200);
    retainFixtureReferences("rule editor saved sets", saved.body.sets);
    const payload = { ...policy, sets: saved.body.sets.map((s: any) => ({
      setUuid: s.setUuid, conditions: s.conditions.map(({ valueLabels, ...c }: any) => c),
    })) };
    const again = await call("put", `/form-versions/${version.id}/applicability`, payload);
    expect(again.body.sets).toEqual(saved.body.sets);
  });
});
