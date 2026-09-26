import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import { getDb } from "@server/v2/db";
import { admFormsV2 } from "@shared/v2/admin/schema";

const endpoint = "/api/v2/admin/forms";
const namedForms = [
  "Crew Appraisal Form", "Crew Briefing Form", "Crew Debriefing Form",
  "Crew Interview Form", "Promotion Review Form",
];

function token() {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 24, domain: "test", userType: "Office" })}.devsig`;
}

describe("client form creation category boundary", () => {
  it("rejects unknown SQL and missing ORM categories, rejects standard API creation, and accepts dynamic", async () => {
    const db = getDb();
    const existing = async () => (await db.execute(sql`
      SELECT row_to_json(f) AS row FROM adm_forms_v2 f
      WHERE name IN ('Crew Appraisal Form', 'Crew Briefing Form', 'Crew Debriefing Form',
                     'Crew Interview Form', 'Promotion Review Form')
      ORDER BY name, id
    `)).rows;
    const before = await existing();
    expect(before).toHaveLength(namedForms.length);
    console.info("Five existing forms before (raw SQL):", JSON.stringify(before));

    let createdUuid: string | undefined;
    try {
      let sqlError = "";
      try {
        await db.execute(sql`
          INSERT INTO adm_forms_v2 (form_uuid, name, category, rank_group, version_no, version_date)
          VALUES (${uuidv4()}, 'Invalid category proof', 'Dynamic', '', '00', '26-Sep-2026')
        `);
      } catch (error: any) {
        sqlError = error.message;
      }
      console.info("Direct SQL category 'Dynamic' error:", sqlError);
      expect(sqlError).toContain("adm_forms_v2_category_check");

      let ormError = "";
      try {
        await db.insert(admFormsV2).values({
          formUuid: uuidv4(), name: "Missing category ORM proof",
          rankGroup: "", versionNo: "00", versionDate: "26-Sep-2026",
        } as any).returning();
      } catch (error: any) {
        ormError = error.message;
      }
      console.info("ORM insert with no category error:", ormError);
      expect(ormError).toMatch(/null value in column "category"|violates not-null constraint/i);

      const payload = {
        name: `Form API proof ${uuidv4()}`,
        rankGroup: "", versionNo: "00", versionDate: "26-Sep-2026",
      };
      const agent = request("http://127.0.0.1:5000");
      const standard = await agent.post(endpoint).set("Authorization", `Bearer ${token()}`)
        .send({ ...payload, category: "briefing" });
      console.info("POST create category briefing:", JSON.stringify({
        request: { ...payload, category: "briefing" }, status: standard.status, response: standard.body,
      }));
      expect(standard.status).toBe(400);
      expect(standard.body.error).toContain("Only Company Forms");

      const dynamic = await agent.post(endpoint).set("Authorization", `Bearer ${token()}`)
        .send({ ...payload, category: "dynamic" });
      console.info("POST create category dynamic:", JSON.stringify({
        request: { ...payload, category: "dynamic" }, status: dynamic.status, response: dynamic.body,
      }));
      expect(dynamic.status).toBe(200);
      createdUuid = dynamic.body.formUuid;
      const raw = (await db.execute(sql`
        SELECT form_uuid, name, category, rank_group, version_no, version_date
        FROM adm_forms_v2 WHERE form_uuid = ${createdUuid}
      `)).rows;
      console.info("Created dynamic form (raw SQL):", JSON.stringify(raw));
      expect(raw).toMatchObject([{ form_uuid: createdUuid, category: "dynamic" }]);
    } finally {
      if (createdUuid) await db.delete(admFormsV2).where(eq(admFormsV2.formUuid, createdUuid));
      const after = await existing();
      console.info("Five existing forms after (raw SQL):", JSON.stringify(after));
      expect(after).toEqual(before);
    }
  });
});