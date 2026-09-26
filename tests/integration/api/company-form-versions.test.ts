import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import { getDb } from "@server/v2/db";
import { formsService } from "@server/v2/admin/services/formsService";
import { admFormsV2, admFormVersionsV2, admRankGroupsV2 } from "@shared/v2/admin/schema";
import { frmFormParts, frmSections } from "@shared/v2/forms-engine/schema";

const agent = request("http://127.0.0.1:5000");
const formUuids: string[] = [];

function token() {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 24, domain: "test", userType: "Office" })}.devsig`;
}

async function post(path: string, body: object = {}) {
  return agent.post(`/api/v2/admin${path}`).set("Authorization", `Bearer ${token()}`).send(body);
}

async function get(path: string) {
  return agent.get(`/api/v2/admin${path}`).set("Authorization", `Bearer ${token()}`);
}

async function createVersion(formId: number, extra: object = {}) {
  return post(`/forms/${formId}/versions`, {
    versionNo: "00", versionDate: "26-Sep-2026", configuration: "{}", ...extra,
  });
}

async function form(category: "dynamic" | "briefing") {
  const formUuid = uuidv4();
  formUuids.push(formUuid);
  const [row] = await getDb().insert(admFormsV2).values({
    formUuid, name: `Version-line fixture ${formUuid}`, category,
    rankGroup: "", versionNo: "00", versionDate: "26-Sep-2026",
  }).returning();
  return row;
}

afterAll(async () => {
  const db = getDb();
  for (const formUuid of formUuids) {
    const [row] = await db.select({ id: admFormsV2.id }).from(admFormsV2)
      .where(eq(admFormsV2.formUuid, formUuid));
    if (!row) continue;
    const versions = await db.select({ uuid: admFormVersionsV2.fvUuid })
      .from(admFormVersionsV2).where(eq(admFormVersionsV2.formId, row.id));
    if (versions.length) await db.delete(frmSections)
      .where(inArray(frmSections.formVersionUuid, versions.map(v => v.uuid)));
    await db.delete(frmFormParts).where(eq(frmFormParts.formUuid, formUuid));
    await db.delete(admFormVersionsV2).where(eq(admFormVersionsV2.formId, row.id));
    await db.delete(admRankGroupsV2).where(eq(admRankGroupsV2.formId, row.id));
    await db.delete(admFormsV2).where(eq(admFormsV2.id, row.id));
  }
});

describe.sequential("Company Form version line", () => {
  it("scopes null-rank-group drafts, release sources, numbering, and lists to each form", async () => {
    const db = getDb();
    const company = await form("dynamic");
    const other = await form("dynamic");
    const standard = await form("briefing");
    const [legacyGroup] = await db.insert(admRankGroupsV2).values({
      rgUuid: uuidv4(), formId: company.id, name: "Legacy grouped fixture", ranks: "[]",
    }).returning();
    const [standardGroup] = await db.insert(admRankGroupsV2).values({
      rgUuid: uuidv4(), formId: standard.id, name: "Standard fixture", ranks: "[]",
    }).returning();
    // Simulate a pre-existing grouped version on a dynamic form. API creation
    // must never add one, but it cannot turn an omitted filter into IS NULL.
    const [legacy] = await db.insert(admFormVersionsV2).values({
      fvUuid: uuidv4(), formId: company.id, rankGroupId: legacyGroup.id,
      versionNo: "99", versionDate: "26-Sep-2026", status: "released",
    }).returning();

    const first = await createVersion(company.id);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ versionNo: "01", rankGroupId: null, status: "draft" });
    const firstUuid = first.body.fvUuid as string;
    expect(await db.select().from(frmFormParts)
      .where(eq(frmFormParts.formVersionUuid, firstUuid))).toHaveLength(0);

    const otherFirst = await createVersion(other.id);
    expect(otherFirst.status).toBe(200);
    expect(otherFirst.body).toMatchObject({ versionNo: "01", rankGroupId: null });
    const sameDraft = await createVersion(company.id);
    expect(sameDraft.status).toBe(200);
    expect(sameDraft.body.fvUuid).toBe(firstUuid);
    expect(sameDraft.body.fvUuid).not.toBe(otherFirst.body.fvUuid);

    const companyList = await get(`/forms/${company.id}/versions`);
    expect(companyList.status).toBe(200);
    expect(companyList.body.map((v: any) => v.fvUuid)).toEqual([firstUuid]);
    expect((await formsService.getVersions(company.formUuid)).map(v => v.fvUuid)).toEqual([firstUuid]);
    expect((await get(`/forms/${company.id}/versions?rankGroupId=${legacyGroup.id}`)).status).toBe(400);

    for (const partCode of ["A", "B"]) {
      const added = await post(`/form-versions/${firstUuid}/parts`, {
        part_code: partCode, part_title: `Company part ${partCode}`,
      });
      expect(added.status).toBe(201);
      expect(added.body.formVersionUuid).toBe(firstUuid);
    }
    const firstParts = await db.select().from(frmFormParts)
      .where(eq(frmFormParts.formVersionUuid, firstUuid));
    expect(firstParts).toHaveLength(2);

    const released = await post(`/form-versions/${first.body.id}/release`);
    expect(released.status).toBe(200);
    expect(released.body).toMatchObject({ fvUuid: firstUuid, rankGroupId: null, status: "released" });
    const [parent] = await db.select().from(admFormsV2).where(eq(admFormsV2.id, company.id));
    expect(parent.versionNo).toBe("01"); // not the legacy grouped v99

    const second = await createVersion(company.id);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ versionNo: "02", rankGroupId: null, status: "draft" });
    const secondParts = await db.select().from(frmFormParts)
      .where(eq(frmFormParts.formVersionUuid, second.body.fvUuid));
    expect(secondParts.map(p => p.partCode).sort()).toEqual(["A", "B"]);
    expect(secondParts.every(p => p.formPartUuid && p.formVersionUuid === second.body.fvUuid)).toBe(true);
    expect(secondParts.every(p => !firstParts.some(firstPart => firstPart.formPartUuid === p.formPartUuid))).toBe(true);
    expect((await get(`/forms/${company.id}/versions`)).body.map((v: any) => v.versionNo).sort())
      .toEqual(["01", "02"]);
    expect((await get(`/forms/${other.id}/versions`)).body.map((v: any) => v.versionNo))
      .toEqual(["01"]);

    const before = (await db.execute(sql`
      SELECT id, rank_group_id, version_no FROM adm_form_versions_v2
      WHERE form_id = ${company.id} ORDER BY id
    `)).rows;
    const denied = await createVersion(company.id, { rankGroupId: legacyGroup.id });
    expect(denied.status).toBe(400);
    expect(denied.body.error).toContain("cannot have rank-grouped versions");
    expect((await db.execute(sql`
      SELECT id, rank_group_id, version_no FROM adm_form_versions_v2
      WHERE form_id = ${company.id} ORDER BY id
    `)).rows).toEqual(before);
    expect(before).toHaveLength(3); // two groupless versions plus injected legacy row
    expect(legacy.fvUuid).not.toBe(firstUuid);

    const standardFirst = await createVersion(standard.id, { rankGroupId: standardGroup.id });
    expect(standardFirst.status).toBe(200);
    const standardBefore = (await db.execute(sql`
      SELECT id, rank_group_id FROM adm_form_versions_v2 WHERE form_id = ${standard.id}
    `)).rows;
    const deniedStandard = await createVersion(standard.id);
    expect(deniedStandard.status).toBe(400);
    expect(deniedStandard.body.error).toContain("rankGroupId is required");
    expect((await db.execute(sql`
      SELECT id, rank_group_id FROM adm_form_versions_v2 WHERE form_id = ${standard.id}
    `)).rows).toEqual(standardBefore);
    expect((await get(`/forms/${standard.id}/versions`)).body).toHaveLength(1);
    expect((await get(`/forms/${standard.id}/versions?rankGroupId=${standardGroup.id}`)).body).toHaveLength(1);
  });
});