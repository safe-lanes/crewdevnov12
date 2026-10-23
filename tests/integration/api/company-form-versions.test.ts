import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import request from "supertest";
import { getDb } from "@server/v2/db";
import { formsService } from "@server/v2/admin/services/formsService";
import { admFormsV2, admFormVersionsV2, admRankGroupsV2 } from "@shared/v2/admin/schema";
import {
  frmFormParts,
  frmOptions,
  frmOptionSets,
  frmQuestions,
  frmSections,
} from "@shared/v2/forms-engine/schema";
import { frmSubjectTypes } from "@shared/v2/forms-engine/subjectRegistry";

const agent = request(process.env.TEST_API_URL!);
const formUuids: string[] = [];
const temporarySubjectTypes: string[] = [];

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

async function addSubmissionSection(versionUuid: string, formUuid: string) {
  const [part] = await getDb().insert(frmFormParts).values({
    formPartUuid: uuidv4(),
    formUuid,
    formVersionUuid: versionUuid,
    partCode: "LIFECYCLE",
    partTitle: "Lifecycle",
    partType: "configurable",
    isOfficeOnly: false,
    isDeleted: false,
    isSync: false,
  }).returning();
  const [section] = await getDb().insert(frmSections).values({
    sectionUuid: uuidv4(),
    formVersionUuid: versionUuid,
    formPartUuid: part.formPartUuid,
    sectionCode: "SUBMIT",
    sectionTitle: "Submission section",
    responsibleMode: "seafarer",
    isDeleted: false,
    isSync: false,
  }).returning();
  await getDb().insert(frmQuestions).values({
    questionUuid: uuidv4(),
    sectionUuid: section.sectionUuid,
    questionCode: "ANSWER",
    questionText: "Answer",
    responseType: "free_text",
    isMandatory: false,
    commentEnabled: true,
    isDeleted: false,
    isSync: false,
  });
}

async function form(category: "dynamic" | "briefing", subjectType?: string) {
  const formUuid = uuidv4();
  formUuids.push(formUuid);
  const [row] = await getDb().insert(admFormsV2).values({
    formUuid, name: `Version-line fixture ${formUuid}`, category,
    subjectType: category === "dynamic" ? subjectType ?? "crew_assignment" : null,
    rankGroup: "", versionNo: "00", versionDate: "26-Sep-2026",
  }).returning();
  return row;
}

async function cleanupFixture(formUuid: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ id: admFormsV2.id }).from(admFormsV2)
      .where(eq(admFormsV2.formUuid, formUuid));
    if (!row) return;
    const versions = await tx.select({ uuid: admFormVersionsV2.fvUuid })
      .from(admFormVersionsV2).where(eq(admFormVersionsV2.formId, row.id));
    const versionUuids = versions.map((version) => version.uuid);
    if (versionUuids.length) {
      const sectionUuids = await tx.select({ uuid: frmSections.sectionUuid })
        .from(frmSections).where(inArray(frmSections.formVersionUuid, versionUuids));
      const sectionIds = sectionUuids.map((section) => section.uuid);
      const optionSets = await tx.select({ uuid: frmOptionSets.optionSetUuid })
        .from(frmOptionSets).where(inArray(frmOptionSets.formVersionUuid, versionUuids));
      const optionSetIds = optionSets.map((optionSet) => optionSet.uuid);
      if (sectionIds.length) {
        await tx.delete(frmQuestions).where(inArray(frmQuestions.sectionUuid, sectionIds));
        await tx.delete(frmSections).where(inArray(frmSections.sectionUuid, sectionIds));
      }
      if (optionSetIds.length) {
        await tx.delete(frmOptions).where(inArray(frmOptions.optionSetUuid, optionSetIds));
        await tx.delete(frmOptionSets).where(inArray(frmOptionSets.optionSetUuid, optionSetIds));
      }
      await tx.delete(frmFormParts).where(inArray(frmFormParts.formVersionUuid, versionUuids));
    }
    await tx.delete(frmFormParts).where(eq(frmFormParts.formUuid, formUuid));
    await tx.delete(admFormVersionsV2).where(eq(admFormVersionsV2.formId, row.id));
    await tx.delete(admRankGroupsV2).where(eq(admRankGroupsV2.formId, row.id));
    await tx.delete(admFormsV2).where(eq(admFormsV2.id, row.id));
  });
}

afterAll(async () => {
  const failures: Error[] = [];
  for (const formUuid of formUuids) {
    try {
      await cleanupFixture(formUuid);
    } catch (error) {
      failures.push(new Error(`Failed to clean up version-line fixture ${formUuid}`, { cause: error }));
    }
  }
  for (const subjectType of temporarySubjectTypes) {
    try {
      await getDb().delete(frmSubjectTypes).where(eq(frmSubjectTypes.subjectType, subjectType));
    } catch (error) {
      failures.push(new Error(`Failed to clean up temporary subject type ${subjectType}`, { cause: error }));
    }
  }
  if (failures.length) throw new AggregateError(failures, "Version-line fixture cleanup failed");
});

describe.sequential("Company Form version line", () => {
  it("allows a stage-less Company Form with a valid submission path to release", async () => {
    const subjectType = `stage_less_${uuidv4()}`;
    temporarySubjectTypes.push(subjectType);
    await getDb().insert(frmSubjectTypes).values({ subjectType, label: "Stage-less test subject" });
    const company = await form("dynamic", subjectType);
    const draft = await createVersion(company.id);
    expect(draft.status).toBe(200);
    expect(draft.body).toMatchObject({ stageKey: null, stageSubjectType: subjectType });
    expect((await get(`/forms/${company.id}/subject-stages`)).body).toEqual([]);
    await addSubmissionSection(draft.body.fvUuid, company.formUuid);

    const released = await post(`/form-versions/${draft.body.id}/release`);
    expect(released.status).toBe(200);
    expect(released.body).toMatchObject({
      status: "released", stageKey: null, stageSubjectType: subjectType,
    });
  });

  it("refuses to release a Company Form version with no submission-requiring section", async () => {
    const company = await form("dynamic");
    const draft = await createVersion(company.id, { stageKey: "before_joining" });
    expect(draft.status).toBe(200);

    await expect(formsService.releaseVersionById(draft.body.id)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("at least one section requiring submission"),
    });
  });

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
      versionNo: "99", versionDate: "26-Sep-2026", status: "draft", stageKey: "before_joining",
    }).returning();
    await db.update(admFormVersionsV2).set({ status: "released" }).where(eq(admFormVersionsV2.id, legacy.id));

    const first = await createVersion(company.id);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      versionNo: "01", rankGroupId: null, status: "draft",
      stageKey: null, stageSubjectType: "crew_assignment",
    });
    const subjectStages = await get(`/forms/${company.id}/subject-stages`);
    expect(subjectStages.status).toBe(200);
    expect(subjectStages.body).toContainEqual(expect.objectContaining({
      subjectType: "crew_assignment", stageKey: "before_joining",
    }));
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

    const missingStageRelease = await post(`/form-versions/${first.body.id}/release`);
    expect(missingStageRelease.status).toBe(400);
    expect(missingStageRelease.body.error).toContain("Select a subject stage");
    const selectedStage = await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ stageKey: "before_joining" });
    expect(selectedStage.status).toBe(200);
    expect(selectedStage.body).toMatchObject({ stageKey: "before_joining", stageSubjectType: "crew_assignment" });
    const clearedStage = await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ stageKey: null });
    expect(clearedStage.status).toBe(200);
    expect(clearedStage.body).toMatchObject({ stageKey: null, stageSubjectType: "crew_assignment" });
    await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ stageKey: "before_joining" }).expect(200);
    await addSubmissionSection(firstUuid, company.formUuid);
    const stagePreservedWithoutField = await createVersion(company.id);
    expect(stagePreservedWithoutField.body).toMatchObject({
      fvUuid: firstUuid, stageKey: "before_joining", stageSubjectType: "crew_assignment",
    });
    const attemptedOwnershipChange = await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ rankGroupId: legacyGroup.id });
    expect(attemptedOwnershipChange.status).toBe(400);
    const attemptedDerivedSubject = await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ stageSubjectType: "other" });
    expect(attemptedDerivedSubject.status).toBe(400);

    const released = await post(`/form-versions/${first.body.id}/release`);
    expect(released.status).toBe(200);
    expect(released.body).toMatchObject({
      fvUuid: firstUuid, rankGroupId: null, status: "released",
      stageKey: "before_joining", stageSubjectType: "crew_assignment",
    });
    const attemptedReleasedStageChange = await agent.put(`/api/v2/admin/form-versions/${first.body.id}`)
      .set("Authorization", `Bearer ${token()}`).send({ stageKey: "on_board" });
    expect(attemptedReleasedStageChange.status).toBe(400);
    const [parent] = await db.select().from(admFormsV2).where(eq(admFormsV2.id, company.id));
    expect(parent.versionNo).toBe("01"); // not the legacy grouped v99

    const second = await createVersion(company.id);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      versionNo: "02", rankGroupId: null, status: "draft",
      stageKey: null, stageSubjectType: "crew_assignment",
    });
    const secondParts = await db.select().from(frmFormParts)
      .where(eq(frmFormParts.formVersionUuid, second.body.fvUuid));
    expect(secondParts.map(p => p.partCode).sort()).toEqual(["A", "B", "LIFECYCLE"]);
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
    expect((await get(`/forms/${standard.id}/subject-stages`)).body).toEqual([]);
    const standardStage = await createVersion(standard.id, {
      rankGroupId: standardGroup.id, stageKey: "before_joining",
    });
    expect(standardStage.status).toBe(400);
    expect(standardStage.body.error).toContain("Standard forms cannot");
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

  it("waits for a concurrent archive and rejects a version write after the archive commits", async () => {
    const db = getDb();
    const company = await form("dynamic");
    let unlock!: () => void;
    let acquired!: () => void;
    const held = new Promise<void>((resolve) => { acquired = resolve; });
    const holdLock = new Promise<void>((resolve) => { unlock = resolve; });
    const archiveTransaction = db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM adm_forms_v2 WHERE id = ${company.id} FOR UPDATE`);
      await tx.update(admFormsV2).set({ archivedAt: new Date() }).where(eq(admFormsV2.id, company.id));
      acquired();
      await holdLock;
    });
    await held;

    let writeSettled = false;
    const write = formsService.createVersionByFormId(company.id, {
      configuration: "{}",
      versionDate: "26-Sep-2026",
    } as any).then(
      (version) => { writeSettled = true; return { version }; },
      (error) => { writeSettled = true; return { error }; },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(writeSettled).toBe(false);

    unlock();
    await archiveTransaction;
    const result = await write;
    expect(result).toHaveProperty("error");
    expect((result as any).error).toMatchObject({ statusCode: 409 });
    expect((result as any).error.message).toContain("archived and is read-only");
    expect(await db.select().from(admFormVersionsV2).where(eq(admFormVersionsV2.formId, company.id))).toHaveLength(0);
  });
});