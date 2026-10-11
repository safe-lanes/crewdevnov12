import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { v4 as uuid } from "uuid";
import { getDb } from "@server/v2/db";
import { copyApplicability, readApplicability } from "@server/v2/admin/services/applicabilityService";
import { canonical, policySnapshot } from "@server/v2/admin/services/versionChanges";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const agent = request("http://127.0.0.1:5000");
const forms: string[] = [];
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 24, domain: "test", userType: "Office" })}.devsig`;
const call = (method: "get" | "put" | "post", path: string, body: object = {}) =>
  agent[method](`/api/v2/admin${path}`).set("Authorization", `Bearer ${token}`).send(body);

async function fixture() {
  const formUuid = uuid(); forms.push(formUuid);
  const f = (await pool.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date)
    VALUES($1,$2,'dynamic','crew_assignment','','00','11-Oct-2026') RETURNING *`,
  [formUuid, `TEST ONLY Applicability ${formUuid}`])).rows[0];
  await pool.query(`INSERT INTO frm_form_parts(form_part_uuid,form_uuid,part_code,part_title,part_type)
    VALUES($1,$2,'MAIN','Declaration','configurable')`, [uuid(), formUuid]);
  const response = await call("post", `/forms/${f.id}/versions`, {
    versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "before_joining",
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  const v = response.body;
  const part = (await pool.query("SELECT * FROM frm_form_parts WHERE form_version_uuid=$1 AND is_deleted=false", [v.fvUuid])).rows[0];
  const sectionUuid = uuid();
  await pool.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode)
    VALUES($1,$2,$3,'DECL','Declaration','seafarer')`, [sectionUuid, v.fvUuid, part.form_part_uuid]);
  await pool.query(`INSERT INTO frm_questions(question_uuid,section_uuid,question_code,question_text,response_type,comment_enabled)
    VALUES($1,$2,'ANSWER','Original wording','free_text',true)`, [uuid(), sectionUuid]);
  return { f, v };
}
async function clone(f: any) {
  const r = await call("post", `/forms/${f.id}/versions`, {
    versionNo: "00", versionDate: "11-Oct-2026", configuration: "{}", stageKey: "before_joining",
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body;
}
async function summary(f: any, version: any) {
  const r = await call("get", `/forms/${f.id}/versions`);
  expect(r.status).toBe(200); return r.body.find((v: any) => v.fvUuid === version.fvUuid);
}
async function policy(version: any) {
  const r = await call("get", `/form-versions/${version.id}/applicability`);
  expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body;
}
async function sqlRefusal(query: string, params: any[] = []) {
  const c = await pool.connect();
  try { await c.query("BEGIN"); await expect(c.query(query, params)).rejects.toBeTruthy(); }
  finally { await c.query("ROLLBACK"); c.release(); }
}

afterAll(async () => {
  for (const formUuid of forms) {
    await pool.query(`DELETE FROM frm_questions WHERE section_uuid IN(
      SELECT section_uuid FROM frm_sections WHERE form_version_uuid IN(SELECT fv_uuid FROM adm_form_versions_v2 WHERE form_id IN(
        SELECT id FROM adm_forms_v2 WHERE form_uuid=$1)))`, [formUuid]);
    await pool.query(`DELETE FROM frm_sections WHERE form_version_uuid IN(
      SELECT fv_uuid FROM adm_form_versions_v2 WHERE form_id IN(SELECT id FROM adm_forms_v2 WHERE form_uuid=$1))`, [formUuid]);
    await pool.query("DELETE FROM frm_form_parts WHERE form_uuid=$1", [formUuid]);
    await pool.query("DELETE FROM adm_form_versions_v2 WHERE form_id IN(SELECT id FROM adm_forms_v2 WHERE form_uuid=$1)", [formUuid]);
    await pool.query("DELETE FROM adm_forms_v2 WHERE form_uuid=$1", [formUuid]);
  }
  await pool.end();
});

describe("Company Form applicability foundation", () => {
  it("persists exactly one policy per Company version and none for Standard versions", async () => {
    const r = (await pool.query(`SELECT count(*) FILTER(WHERE f.category='dynamic' AND p.version_uuid IS NULL) missing,
      count(*) FILTER(WHERE f.category<>'dynamic' AND p.version_uuid IS NOT NULL) standard_policies
      FROM adm_form_versions_v2 v JOIN adm_forms_v2 f ON f.id=v.form_id
      LEFT JOIN frm_version_applicability p ON p.version_uuid=v.fv_uuid`)).rows[0];
    expect(r).toEqual({ missing: "0", standard_policies: "0" });
  });

  it("defaults to manual only and rejects invalid/unknown/browser-provenance fields", async () => {
    const { v } = await fixture();
    expect(await policy(v)).toMatchObject({ mode: "manual_only", obligation: null, effectiveKind: null, effectiveFrom: null });
    for (const body of [{ mode: "bogus" }, { mode: "all" }, { mode: "manual_only", obligation: "mandatory" },
      { mode: "all", obligation: "mandatory", effectiveKind: "specific_date", specificDate: "2026-02-30" },
      { mode: "all", obligation: "optional", effectiveFrom: "2000-01-01" },
      { mode: "all", obligation: "optional", dimensionValidationReady: true }])
      expect((await call("put", `/form-versions/${v.id}/applicability`, body)).status).toBe(400);
    await sqlRefusal("UPDATE frm_version_applicability SET mode='bogus' WHERE version_uuid=$1", [v.fvUuid]);
    await sqlRefusal("DELETE FROM frm_version_applicability WHERE version_uuid=$1", [v.fvUuid]);
  });

  it("stores conditional data but refuses conditional release; IDs are stable and isolated", async () => {
    const { v } = await fixture();
    const body = { mode: "conditional", obligation: "mandatory", sets: [
      { conditions: [{ dimensionKey: "rank", operator: "in", value: ["rank-master-id"] },
        { dimensionKey: "nationality", operator: "in", value: ["nationality-master-id"] }] },
      { conditions: [{ dimensionKey: "first_in_rank", operator: "is", value: true }] },
    ] };
    const saved = await call("put", `/form-versions/${v.id}/applicability`, body);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const resaved = await call("put", `/form-versions/${v.id}/applicability`, {
      mode: "conditional", obligation: "mandatory", sets: saved.body.sets.map((set: any) => ({
        setUuid: set.setUuid, conditions: set.conditions.map(({ valueLabels: _labels, ...condition }: any) => condition),
      })),
    });
    expect(resaved.status).toBe(200); expect(resaved.body.sets).toEqual(saved.body.sets);
    const release = await call("post", `/form-versions/${v.id}/release`);
    expect(release.status).toBe(400); expect(release.body.error).toMatch(/master identifier/);
    const other = await fixture();
    expect((await call("put", `/form-versions/${other.v.id}/applicability`, {
      mode: "conditional", obligation: "mandatory", sets: saved.body.sets,
    })).status).toBe(400);
    await sqlRefusal("UPDATE frm_applicability_sets SET version_uuid=$1 WHERE set_uuid=$2",
      [other.v.fvUuid, saved.body.sets[0].setUuid]);
    await sqlRefusal("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [v.fvUuid]);
    // Conditional releases intentionally don't exist yet. Exercise the same copy
    // routine on draft data without weakening the public released-source guard.
    await getDb().transaction(async (tx: any) => { await copyApplicability(v.fvUuid, other.v.fvUuid, tx); });
    const copied = await readApplicability(other.v.fvUuid);
    expect(canonical(policySnapshot(copied))).toBe(canonical(policySnapshot(saved.body)));
    expect(copied.sets.flatMap(s => [s.setUuid, ...s.conditions.map(c => c.conditionUuid)])
      .every(id => !saved.body.sets.flatMap((s: any) => [s.setUuid, ...s.conditions.map((c: any) => c.conditionUuid)]).includes(id))).toBe(true);
    expect(copied.copiedFromVersionUuid).toBe(v.fvUuid);
  });

  it("defaults automatic dates to on release, freezes them and independently copies a released policy", async () => {
    const { f, v } = await fixture();
    expect((await call("put", `/form-versions/${v.id}/applicability`, { mode: "all", obligation: "mandatory" })).body)
      .toMatchObject({ effectiveKind: "on_release", effectiveFrom: null });
    const release = await call("post", `/form-versions/${v.id}/release`);
    expect(release.status, JSON.stringify(release.body)).toBe(200);
    const frozen = await policy(v);
    expect(frozen.effectiveFrom).toBe(release.body.releasedAt.slice(0, 10));
    expect((await call("put", `/form-versions/${v.id}/applicability`, { mode: "manual_only" })).status).toBe(409);
    await sqlRefusal("UPDATE frm_version_applicability SET obligation='optional' WHERE version_uuid=$1", [v.fvUuid]);
    await sqlRefusal("DELETE FROM frm_version_applicability WHERE version_uuid=$1", [v.fvUuid]);
    await sqlRefusal("UPDATE adm_form_versions_v2 SET status='draft' WHERE fv_uuid=$1", [v.fvUuid]);
    await sqlRefusal("UPDATE adm_form_versions_v2 SET released_at='2000-01-01' WHERE fv_uuid=$1", [v.fvUuid]);
    const next = await clone(f);
    expect(await policy(next)).toMatchObject({ mode: "all", effectiveKind: "on_release", effectiveFrom: null, copiedFromVersionUuid: v.fvUuid });
    await call("put", `/form-versions/${next.id}/applicability`, { mode: "all", obligation: "optional" });
    expect(await policy(v)).toEqual(frozen);
    await clone(f); // Reusing a draft must not reset policy.
    expect((await policy(next)).obligation).toBe("optional");
    expect((await call("put", `/form-versions/${v.id}`, { status: "draft" })).status).toBe(400);
  });

  it("refuses a date before actual release, accepts a future specific date and explains why", async () => {
    const { v } = await fixture();
    await call("put", `/form-versions/${v.id}/applicability`, {
      mode: "all", obligation: "optional", effectiveKind: "specific_date", specificDate: "2000-01-01",
    });
    const refused = await call("post", `/form-versions/${v.id}/release`);
    expect(refused.status).toBe(400); expect(refused.body.error).toMatch(/earlier than release date.*never resolved retrospectively/);
    await sqlRefusal("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [v.fvUuid]);
    expect((await policy(v)).effectiveFrom).toBeNull();
    await call("put", `/form-versions/${v.id}/applicability`, {
      mode: "all", obligation: "optional", effectiveKind: "specific_date", specificDate: "2099-01-01",
    });
    expect((await call("post", `/form-versions/${v.id}/release`)).status).toBe(200);
    expect((await policy(v)).effectiveFrom).toBe("2099-01-01");
  });

  it("accepts a specific date equal to the release day and blocks archived draft writes", async () => {
    const { f, v } = await fixture();
    const day = (await pool.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') AS day")).rows[0].day;
    await call("put", `/form-versions/${v.id}/applicability`, {
      mode: "all", obligation: "mandatory", effectiveKind: "specific_date", specificDate: day,
    });
    expect((await call("post", `/form-versions/${v.id}/release`)).status).toBe(200);
    expect((await policy(v)).effectiveFrom).toBe(day);
    const next = await clone(f);
    await pool.query("UPDATE adm_forms_v2 SET archived_at=clock_timestamp() WHERE id=$1", [f.id]);
    expect((await call("put", `/form-versions/${next.id}/applicability`, { mode: "manual_only" })).status).toBe(409);
    await sqlRefusal("UPDATE frm_version_applicability SET mode='manual_only' WHERE version_uuid=$1", [next.fvUuid]);
  });

  it("records initial, unchanged copy, content-only, applicability-only, both and signing-only changes", async () => {
    const { f, v } = await fixture();
    expect((await call("post", `/form-versions/${v.id}/release`)).status).toBe(200);
    expect((await summary(f, v)).changeSummary).toMatchObject({ previousVersionUuid: null, details: ["Initial release"] });
    let previous = v;
    for (const kind of ["none", "content", "applicability", "both", "signing"]) {
      const next = await clone(f);
      if (kind === "content" || kind === "both") await pool.query(`UPDATE frm_questions SET question_text=$1 WHERE section_uuid IN(
        SELECT section_uuid FROM frm_sections WHERE form_version_uuid=$2)`, [`Wording ${kind}`, next.fvUuid]);
      if (kind === "applicability" || kind === "both") await call("put", `/form-versions/${next.id}/applicability`, {
        mode: "all", obligation: kind === "both" ? "optional" : "mandatory",
      });
      if (kind === "signing") await pool.query("UPDATE frm_sections SET signature_seafarer_required=true WHERE form_version_uuid=$1", [next.fvUuid]);
      const released = await call("post", `/form-versions/${next.id}/release`);
      expect(released.status, JSON.stringify(released.body)).toBe(200);
      const s = (await summary(f, next)).changeSummary;
      expect(s).toMatchObject({ previousVersionUuid: previous.fvUuid,
        contentChanged: ["content", "both", "signing"].includes(kind),
        applicabilityChanged: ["applicability", "both"].includes(kind) });
      if (kind === "signing") expect(s.details).toEqual(["Signing configuration changed"]);
      else expect(s.details).not.toContain("Signing configuration changed");
      if (kind === "none") expect(s.details).toEqual([]);
      if (kind === "applicability") expect(s.details).toEqual(["Applicability changed"]);
      previous = next;
    }
    const audit = (await pool.query("SELECT released_by FROM frm_version_release_changes WHERE version_uuid=$1", [v.fvUuid])).rows[0];
    expect(audit.released_by).toBe("24");
    await sqlRefusal("UPDATE frm_version_release_changes SET content_changed=false WHERE version_uuid=$1", [previous.fvUuid]);
    expect((await pool.query("SELECT count(*) FROM frm_company_submissions WHERE form_uuid=$1", [f.form_uuid])).rows[0].count).toBe("0");
  });

  it("rejects browser release comparison, actor, timestamps and readiness claims", async () => {
    const { v } = await fixture();
    for (const body of [{ auditUserUuid: "spoof" }, { contentChanged: false },
      { releasedAt: "2000-01-01" }, { dimensionValidationReady: true }])
      expect((await call("post", `/form-versions/${v.id}/release`, body)).status).toBe(400);
  });

  it("preserves authored IDs inside configuration while excluding cloned database identities", async () => {
    const { f, v } = await fixture();
    const content = { id: "authored-system-field-a", layout: { id: "authored-layout-a" } };
    await call("put", `/form-versions/${v.id}`, { configuration: JSON.stringify(content) });
    expect((await call("post", `/form-versions/${v.id}/release`)).status).toBe(200);
    const identical = await clone(f);
    await call("put", `/form-versions/${identical.id}`, { configuration: JSON.stringify(content) });
    expect((await call("post", `/form-versions/${identical.id}/release`)).status).toBe(200);
    expect((await summary(f, identical)).changeSummary.contentChanged).toBe(false);
    const changed = await clone(f);
    await call("put", `/form-versions/${changed.id}`, { configuration: JSON.stringify({ ...content, layout: { id: "authored-layout-b" } }) });
    expect((await call("post", `/form-versions/${changed.id}/release`)).status).toBe(200);
    expect((await summary(f, changed)).changeSummary).toMatchObject({ contentChanged: true, applicabilityChanged: false });
  });

  it("serializes a release versus a policy edit without changing a frozen release", async () => {
    const { v } = await fixture();
    const [release, write] = await Promise.all([
      call("post", `/form-versions/${v.id}/release`),
      call("put", `/form-versions/${v.id}/applicability`, { mode: "all", obligation: "optional" }),
    ]);
    expect(release.status, JSON.stringify(release.body)).toBe(200);
    expect([200, 409]).toContain(write.status);
    const frozen = await policy(v);
    await sqlRefusal("UPDATE frm_version_applicability SET mode='manual_only',obligation=NULL,effective_kind=NULL,effective_from=NULL WHERE version_uuid=$1", [v.fvUuid]);
    expect(await policy(v)).toEqual(frozen);
  });
});
