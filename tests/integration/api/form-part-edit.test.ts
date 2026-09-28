import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import { getDb } from "@server/v2/db";
import { formsService } from "@server/v2/admin/services/formsService";
import { admFormsV2, admFormVersionsV2, admRankGroupsV2 } from "@shared/v2/admin/schema";
import { frmFormParts, frmSections } from "@shared/v2/forms-engine/schema";
import { masterUsers } from "@shared/schema";

const BASE = "/api/v2/admin/form-versions";
const fixtures: string[] = [];
const actorId = 24; // existing Office Admin with a Forms:edit grant
const spoof = uuidv4();
let actorUuid: string;

function token(id = actorId, userType = "Office") {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ id, domain: "test", userType })}.devsig`;
}

async function api(method: string, path: string, body?: unknown, bearer: string | null = token()) {
  const agent = request("http://127.0.0.1:5000");
  const url = `${BASE}${path}`;
  let call = method === "POST" ? agent.post(url)
    : method === "PATCH" ? agent.patch(url)
    : method === "PUT" ? agent.put(url)
    : agent.delete(url);
  if (bearer) call = call.set("Authorization", `Bearer ${bearer}`);
  if (body !== undefined) call = call.send(body);
  const response = await call;
  return { status: response.status, body: response.body as any };
}

async function formFixture(category: string, withTemplate = false) {
  const db = getDb();
  const formUuid = uuidv4();
  fixtures.push(formUuid);
  const [form] = await db.insert(admFormsV2).values({
    formUuid, name: `Part-edit fixture ${formUuid}`, category,
    rankGroup: "Isolated", versionNo: "00", versionDate: "25-Sep-2026",
    isLockForm: false,
  }).returning();
  const group = category === "dynamic" ? undefined : (await db.insert(admRankGroupsV2).values({
    rgUuid: uuidv4(), formId: form.id, name: `Part-edit ${formUuid}`, ranks: "[]",
  }).returning())[0];
  if (withTemplate) await db.insert(frmFormParts).values({
    formPartUuid: uuidv4(), formUuid, partCode: "B", partTitle: "SAIL-owned part",
    partType: "configurable",
  });
  const draft = await formsService.createVersionByFormId(form.id, {
    ...(group ? { rankGroupId: group.id } : {}), configuration: "{}",
  } as any);
  return { form, group, draft };
}

async function rows(versionUuid: string) {
  return getDb().select().from(frmFormParts)
    .where(eq(frmFormParts.formVersionUuid, versionUuid))
    .orderBy(frmFormParts.id);
}

async function rawRows(versionUuid: string) {
  const result = await getDb().execute(sql`
    SELECT form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
           sort_order, is_deleted, created_by_uuid, updated_by_uuid
    FROM frm_form_parts WHERE form_version_uuid = ${versionUuid} ORDER BY id
  `);
  return result.rows;
}

async function cleanUp() {
  const db = getDb();
  for (const formUuid of fixtures) {
    const [form] = await db.select({ id: admFormsV2.id }).from(admFormsV2)
      .where(eq(admFormsV2.formUuid, formUuid));
    if (!form) continue;
    const versions = await db.select({ uuid: admFormVersionsV2.fvUuid })
      .from(admFormVersionsV2).where(eq(admFormVersionsV2.formId, form.id));
    if (versions.length) await db.delete(frmSections)
      .where(inArray(frmSections.formVersionUuid, versions.map((v) => v.uuid)));
    await db.delete(frmFormParts).where(eq(frmFormParts.formUuid, formUuid));
    await db.delete(admFormVersionsV2).where(eq(admFormVersionsV2.formId, form.id));
    await db.delete(admRankGroupsV2).where(eq(admRankGroupsV2.formId, form.id));
    await db.delete(admFormsV2).where(eq(admFormsV2.id, form.id));
  }
}

describe.sequential("version-scoped part edit API", () => {
  let dynamic: Awaited<ReturnType<typeof formFixture>>;
  let fixed: Awaited<ReturnType<typeof formFixture>>;
  let otherStandard: Awaited<ReturnType<typeof formFixture>>;
  let releasedUuid: string;
  let firstUuid: string;
  let secondUuid: string;

  beforeAll(async () => {
    const [user] = await getDb().select({ uuid: masterUsers.userUuid })
      .from(masterUsers).where(eq(masterUsers.id, actorId));
    if (!user?.uuid) throw new Error("Office Admin fixture identity is unavailable");
    actorUuid = user.uuid;
    dynamic = await formFixture("dynamic");
    fixed = await formFixture("briefing", true);
    otherStandard = await formFixture("interview", true);
    const [releasedGroup] = await getDb().insert(admRankGroupsV2).values({
      rgUuid: uuidv4(), formId: fixed.form.id, name: `Released ${uuidv4()}`, ranks: "[]",
    }).returning();
    const released = await formsService.createVersionByFormId(fixed.form.id, {
      rankGroupId: releasedGroup.id, configuration: "{}",
    } as any);
    await formsService.releaseVersionById(released.id);
    releasedUuid = released.fvUuid;
  });
  afterAll(cleanUp);

  it("creates, renames, and reorders only dynamic draft parts with server-derived audit identity", async () => {
    const version = dynamic.draft.fvUuid;
    const first = await api("POST", `/${version}/parts`, {
      part_code: "A", part_title: "First", auditUserUuid: spoof,
    });
    expect(first.status).toBe(201);
    firstUuid = first.body.formPartUuid;
    expect(first.body).toMatchObject({
      formUuid: dynamic.form.formUuid, formVersionUuid: version,
      partType: "configurable", partCode: "A", partTitle: "First",
      createdByUuid: actorUuid, updatedByUuid: actorUuid,
    });
    const second = await api("POST", `/${version}/parts`, {
      part_code: "B", part_title: "Second", is_office_only: true,
    });
    expect(second.status).toBe(201);
    secondUuid = second.body.formPartUuid;
    expect(second.body.isOfficeOnly).toBe(true);
    const renamed = await api("PATCH", `/${version}/parts/${firstUuid}`, {
      part_title: "Renamed", auditUserUuid: spoof,
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({
      formPartUuid: firstUuid, partTitle: "Renamed", updatedByUuid: actorUuid,
    });
    const reordered = await api("PUT", `/${version}/parts/reorder`, {
      part_uuids: [secondUuid, firstUuid], auditUserUuid: spoof,
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body.map((part: any) => [part.formPartUuid, part.sortOrder]))
      .toEqual([[secondUuid, 0], [firstUuid, 1]]);
    const sqlRows = await getDb().execute(sql`
      SELECT form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
             sort_order, created_by_uuid, updated_by_uuid
      FROM frm_form_parts WHERE form_version_uuid = ${version} ORDER BY sort_order
    `);
    expect(sqlRows.rows.map((part: any) => part.form_part_uuid)).toEqual([secondUuid, firstUuid]);
    expect(sqlRows.rows.every((part: any) =>
      part.form_uuid === dynamic.form.formUuid &&
      part.form_version_uuid === version &&
      part.created_by_uuid === actorUuid &&
      part.updated_by_uuid === actorUuid)).toBe(true);
    console.info("Dynamic part ownership and actor (raw SQL):", JSON.stringify(sqlRows.rows));
  });

  it("generates unique codes for omitted-code creates without changing explicit-code rejection", async () => {
    const isolated = await formFixture("dynamic");
    const version = isolated.draft.fvUuid;
    const first = await api("POST", `/${version}/parts`, { part_title: "First auto part" });
    const second = await api("POST", `/${version}/parts`, { part_title: "Second auto part" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toMatchObject({ partType: "configurable", partTitle: "First auto part" });
    expect(first.body.partCode).toMatch(/^P[0-9a-f]{29}$/);
    expect(second.body.partCode).toMatch(/^P[0-9a-f]{29}$/);
    expect(second.body.partCode).not.toBe(first.body.partCode);
    const duplicate = await api("POST", `/${version}/parts`, {
      part_code: first.body.partCode, part_title: "Duplicate",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toContain("already used in this version");
    expect((await api("POST", `/${version}/parts`, {
      part_title: "Fixed not allowed", part_type: "fixed",
    })).status).toBe(400);
    const sqlRows = await rawRows(version);
    expect(sqlRows).toHaveLength(2);
    expect(new Set(sqlRows.map((row: any) => row.part_code)).size).toBe(2);
  });

  it("denies standard drafts of different categories and released versions without touching their parts", async () => {
    for (const [version, expected] of [
      [fixed.draft.fvUuid, 403], [otherStandard.draft.fvUuid, 403], [releasedUuid, 409],
    ] as const) {
      const before = await rows(version);
      const beforeSql = await rawRows(version);
      const partUuid = before[0].formPartUuid;
      expect((await api("POST", `/${version}/parts`, { part_code: "X", part_title: "Not allowed" })).status).toBe(expected);
      expect((await api("PATCH", `/${version}/parts/${partUuid}`, { part_title: "Not allowed" })).status).toBe(expected);
      expect((await api("PUT", `/${version}/parts/reorder`, { part_uuids: [partUuid] })).status).toBe(expected);
      expect((await api("DELETE", `/${version}/parts/${partUuid}`)).status).toBe(expected);
      expect(await rows(version)).toEqual(before);
      expect(await rawRows(version)).toEqual(beforeSql);
    }
    expect((await api("PATCH", `/${dynamic.draft.fvUuid}/parts/${(await rows(fixed.draft.fvUuid))[0].formPartUuid}`,
      { part_title: "Cross-version" })).status).toBe(404);
  });

  it("cannot reclassify a SAIL fixed form to bypass the part-edit gate", async () => {
    const res = await request("http://127.0.0.1:5000")
      .put(`/api/v2/admin/forms/${fixed.form.id}`)
      .set("Authorization", `Bearer ${token()}`)
      .send({ category: "dynamic" });
    expect(res.status).toBe(409);
    const [form] = await getDb().select({ category: admFormsV2.category })
      .from(admFormsV2).where(eq(admFormsV2.id, fixed.form.id));
    expect(form.category).toBe("briefing");
    expect((await api("POST", `/${fixed.draft.fvUuid}/parts`, {
      part_code: "X", part_title: "Still denied",
    })).status).toBe(403);
  });

  it("denies missing Forms:edit permission and forged payload fields", async () => {
    const version = dynamic.draft.fvUuid;
    const before = await rows(version);
    const beforeSql = await rawRows(version);
    expect((await api("POST", `/${version}/parts`, { part_code: "X", part_title: "Denied" }, null)).status).toBe(403);
    expect((await api("POST", `/${version}/parts`, { part_code: "X", part_title: "Denied" }, token(8, "Ship"))).status).toBe(403);
    expect((await api("POST", `/${version}/parts`, { part_code: "X", part_title: "Denied", part_type: "fixed" })).status).toBe(400);
    expect(await rows(version)).toEqual(before);
    expect(await rawRows(version)).toEqual(beforeSql);
  });

  it("rejects duplicate codes and partial/duplicate reorder inventories without changing SQL rows", async () => {
    const version = dynamic.draft.fvUuid;
    const before = await rows(version);
    const beforeSql = await rawRows(version);
    expect((await api("POST", `/${version}/parts`, { part_code: "A", part_title: "Collision" })).status).toBe(409);
    expect((await api("PUT", `/${version}/parts/reorder`, { part_uuids: [firstUuid] })).status).toBe(400);
    expect((await api("PUT", `/${version}/parts/reorder`, { part_uuids: [firstUuid, firstUuid] })).status).toBe(400);
    expect(await rows(version)).toEqual(before);
    expect(await rawRows(version)).toEqual(beforeSql);
  });

  it("blocks deletion while active sections reference a part; then soft-deletes an empty part", async () => {
    const version = dynamic.draft.fvUuid;
    await getDb().insert(frmSections).values([1, 2].map((index) => ({
      sectionUuid: uuidv4(), formVersionUuid: version, formPartUuid: firstUuid,
      sectionCode: `A${index}`, sectionTitle: `Section ${index}`,
      responsibleMode: "not_applicable",
    })));
    const before = await rows(version);
    const beforeSql = await rawRows(version);
    const denied = await api("DELETE", `/${version}/parts/${firstUuid}`);
    expect(denied.status).toBe(409);
    expect(denied.body.error).toContain("2 active sections");
    expect(await rows(version)).toEqual(before);
    expect(await rawRows(version)).toEqual(beforeSql);
    const removed = await api("DELETE", `/${version}/parts/${secondUuid}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({
      formPartUuid: secondUuid, isDeleted: true, updatedByUuid: actorUuid,
    });
    expect((await api("POST", `/${version}/parts`, { part_code: "B", part_title: "Old code" })).status).toBe(409);
    const [survivor] = await getDb().select().from(frmFormParts)
      .where(and(eq(frmFormParts.formPartUuid, firstUuid), eq(frmFormParts.isDeleted, false)));
    expect(survivor).toMatchObject(before.find((part) => part.formPartUuid === firstUuid)!);
  });
});