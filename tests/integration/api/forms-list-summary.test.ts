import { beforeAll, afterAll, describe, it, expect } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { verifyTestBackend } from "../../helpers/test-backend";

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefix = `TEST ONLY List Summary ${randomUUID()} `;
let token: string;
let ids: number[] = [];

beforeAll(async () => {
  await verifyTestBackend();
  const actor = (await pool.query(`SELECT u.id,u.user_type,r.ruid FROM master_users u
    JOIN adm_rolemaster_ac r ON r.assigned_role=u.role
    WHERE u.id=24 AND r.is_active AND NOT r.is_deleted`)).rows[0];
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  token = `${encode({ alg: "none" })}.${encode({ id: actor.id, roleId: actor.ruid, userType: actor.user_type, domain: "test" })}.devsig`;
  ids = (await pool.query(`INSERT INTO adm_forms_v2
    (form_uuid,name,category,subject_type,rank_group,version_no,version_date)
    SELECT gen_random_uuid()::text,$1||n,
      CASE WHEN n<=500 THEN 'appraisal' ELSE 'dynamic' END,
      CASE WHEN n<=500 THEN NULL ELSE 'crew_assignment' END,'','99','31-Dec-2099'
    FROM generate_series(1,1000) n RETURNING id`, [prefix])).rows.map(r => r.id);
  await pool.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,status)
    SELECT gen_random_uuid()::text,id,'02','03-Jun-2026','draft'
    FROM adm_forms_v2 WHERE id=ANY($1::int[])`, [ids]);
});
afterAll(async () => {
  try {
    await pool.query("DELETE FROM adm_form_versions_v2 WHERE form_id=ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM adm_forms_v2 WHERE name LIKE $1", [`${prefix}%`]);
  } finally { await pool.end(); }
});

describe("Forms Configuration list with server version summaries", () => {
  it("loads 1,000 mixed forms with real versions and metadata in one response", async () => {
    const response = await request(process.env.TEST_API_URL!).get("/api/v2/admin/forms?includeSummary=true")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    const fixtures = response.body.filter((f: any) => f.name.startsWith(prefix));
    expect(fixtures).toHaveLength(1000);
    for (const form of fixtures) {
      expect(form.versionSummary).toMatchObject({
        state: "loaded", versions: [{ formId: form.id, versionNo: "02", versionDate: "03-Jun-2026", status: "draft" }],
      });
      expect(form.parts).toEqual([]);
      expect(form.rankGroups).toEqual([]);
    }
  });
  it("loads one row's summary for Retry without requesting or replacing other forms", async () => {
    const response = await request(process.env.TEST_API_URL!).get(`/api/v2/admin/forms/${ids[0]}?includeSummary=true`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(ids[0]);
    expect(response.body.versionSummary).toMatchObject({
      state: "loaded", versions: [{ formId: ids[0], versionNo: "02", versionDate: "03-Jun-2026" }],
    });
  });
});
