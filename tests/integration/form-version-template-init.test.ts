import { afterAll, describe, expect, it } from "vitest";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@server/v2/db";
import { admFormsV2, admFormVersionsV2, admRankGroupsV2 } from "@shared/v2/admin/schema";
import { frmFormParts, frmSections } from "@shared/v2/forms-engine/schema";
import { formsService } from "@server/v2/admin/services/formsService";
import { rankGroupsService } from "@server/v2/admin/services/rankGroupsService";
import { formStructureRepository } from "@server/v2/admin/repositories/formStructureRepository";

const fixtures: string[] = [];

async function fixture(withTemplates = true) {
  const db = getDb();
  const formUuid = uuidv4();
  fixtures.push(formUuid);
  const [form] = await db.insert(admFormsV2).values({
    formUuid,
    name: `Template initialization ${formUuid}`,
    category: "briefing",
    rankGroup: "Test",
    versionNo: "00",
    versionDate: "24-Aug-2026",
    isLockForm: false,
  }).returning();
  const [rankGroup] = await db.insert(admRankGroupsV2).values({
    rgUuid: uuidv4(),
    formId: form.id,
    name: `Template initialization ${formUuid}`,
    ranks: "[]",
  }).returning();
  const templates = withTemplates ? await db.insert(frmFormParts).values([
    { formPartUuid: uuidv4(), formUuid, partCode: "B", partTitle: "Briefing", partType: "configurable", isOfficeOnly: false, sortOrder: 8 },
    { formPartUuid: uuidv4(), formUuid, partCode: "O", partTitle: "Office", partType: "fixed", isOfficeOnly: true, sortOrder: 2 },
  ]).returning() : [];
  return { form, rankGroup, templates };
}

async function parts(formVersionUuid: string | null, formUuid: string) {
  return getDb().select().from(frmFormParts).where(and(
    eq(frmFormParts.formUuid, formUuid),
    formVersionUuid === null ? isNull(frmFormParts.formVersionUuid) : eq(frmFormParts.formVersionUuid, formVersionUuid),
  )).orderBy(asc(frmFormParts.sortOrder));
}

async function cleanup(formUuid: string) {
  const db = getDb();
  const [form] = await db.select({ id: admFormsV2.id }).from(admFormsV2).where(eq(admFormsV2.formUuid, formUuid));
  if (!form) return;
  const versions = await db.select({ fvUuid: admFormVersionsV2.fvUuid }).from(admFormVersionsV2)
    .where(eq(admFormVersionsV2.formId, form.id));
  const versionUuids = versions.map((row) => row.fvUuid);
  if (versionUuids.length) {
    await db.delete(frmSections).where(inArray(frmSections.formVersionUuid, versionUuids));
  }
  await db.delete(frmFormParts).where(eq(frmFormParts.formUuid, formUuid));
  await db.delete(admFormVersionsV2).where(eq(admFormVersionsV2.formId, form.id));
  await db.delete(admRankGroupsV2).where(eq(admRankGroupsV2.formId, form.id));
  await db.delete(admFormsV2).where(eq(admFormsV2.id, form.id));
}

describe.sequential("first form version template initialization", () => {
  afterAll(async () => {
    for (const formUuid of fixtures) await cleanup(formUuid);
  });

  it("creates version-owned parts with fresh UUIDs and unchanged ordered templates", async () => {
    const { form, rankGroup, templates } = await fixture();
    const db = getDb();
    const templateRows = async () => {
      const result = await db.execute(sql`
        SELECT form_part_uuid, form_version_uuid, part_code, part_title,
               part_type, is_office_only, sort_order
        FROM frm_form_parts
        WHERE form_uuid = ${form.formUuid} AND form_version_uuid IS NULL
        ORDER BY sort_order, id
      `);
      return result.rows;
    };
    const beforeSql = await templateRows();
    const before = await parts(null, form.formUuid);
    const version = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id, configuration: "{}", versionDate: "24-Aug-2026",
    } as any);
    expect(version.status).toBe("draft");
    const versionResult = await db.execute(sql`
      SELECT form_part_uuid, form_version_uuid, part_code, part_title,
             part_type, is_office_only, sort_order
      FROM frm_form_parts
      WHERE form_version_uuid = ${version.fvUuid}
      ORDER BY sort_order, id
    `);
    console.info("First-version raw SQL evidence:", JSON.stringify({
      templatesBefore: beforeSql, versionParts: versionResult.rows,
      templatesAfter: await templateRows(),
    }));
    expect(await templateRows()).toEqual(beforeSql);
    const created = await parts(version.fvUuid, form.formUuid);
    expect(created.map((part) => [part.partCode, part.partTitle, part.partType, part.isOfficeOnly, part.sortOrder]))
      .toEqual([
        ["O", "Office", "fixed", true, 2],
        ["B", "Briefing", "configurable", false, 8],
      ]);
    expect(created.every((part) => part.formVersionUuid === version.fvUuid)).toBe(true);
    expect(created.every((part) => !templates.some((template) => template.formPartUuid === part.formPartUuid))).toBe(true);
    expect(await parts(null, form.formUuid)).toEqual(before);
    expect(await getDb().select().from(frmSections).where(inArray(
      frmSections.formPartUuid, templates.map((template) => template.formPartUuid),
    ))).toEqual([]);
    const sectionResult = await db.execute(sql`
      SELECT count(*)::int AS count
      FROM frm_sections s
      JOIN frm_form_parts p ON p.form_part_uuid = s.form_part_uuid
      WHERE p.form_version_uuid IS NULL
    `);
    console.info("Sections referencing templates (raw SQL):", JSON.stringify(sectionResult.rows));
    expect(Number(sectionResult.rows[0].count)).toBe(0);
  });

  it("permits an empty first version when the form has no templates", async () => {
    const { form, rankGroup } = await fixture(false);
    const version = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id, configuration: "{}",
    } as any);
    expect(version.status).toBe("draft");
    expect(await parts(version.fvUuid, form.formUuid)).toEqual([]);
  });

  it("initializes the rank-group save path and does not reinitialize an existing draft", async () => {
    const { form, rankGroup } = await fixture();
    await rankGroupsService.updateConfigurationById(rankGroup.id, "{}");
    const [version] = await getDb().select().from(admFormVersionsV2)
      .where(and(eq(admFormVersionsV2.rankGroupId, rankGroup.id), eq(admFormVersionsV2.status, "draft")));
    const initial = await parts(version.fvUuid, form.formUuid);
    expect(initial).toHaveLength(2);
    await rankGroupsService.updateConfigurationById(rankGroup.id, '{"changed":true}');
    expect(await parts(version.fvUuid, form.formUuid)).toEqual(initial);
  });

  it("copies from a released version rather than newly changed templates", async () => {
    const { form, rankGroup, templates } = await fixture();
    const initial = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id, configuration: "{}",
    } as any);
    await formsService.releaseVersionById(initial.id);
    await getDb().update(frmFormParts).set({ partTitle: "Changed template" })
      .where(eq(frmFormParts.formPartUuid, templates[0].formPartUuid));
    const copy = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id, configuration: "{}",
    } as any);
    const source = await parts(initial.fvUuid, form.formUuid);
    const copied = await parts(copy.fvUuid, form.formUuid);
    expect(copied.map((part) => part.partTitle)).toEqual(source.map((part) => part.partTitle));
    expect(copied.every((part) => !source.some((item) => item.formPartUuid === part.formPartUuid))).toBe(true);
  });

  it("rolls back the version and parts together if initialization's transaction fails", async () => {
    const { form, rankGroup } = await fixture();
    const versionUuid = uuidv4();
    await expect(getDb().transaction(async (tx) => {
      await tx.insert(admFormVersionsV2).values({
        fvUuid: versionUuid, formId: form.id, rankGroupId: rankGroup.id,
        versionNo: "01", versionDate: "24-Aug-2026", status: "draft",
      });
      await formStructureRepository.initializePartsFromTemplates(form.formUuid, versionUuid, tx);
      throw new Error("abort creation");
    })).rejects.toThrow("abort creation");
    expect(await getDb().select().from(admFormVersionsV2).where(eq(admFormVersionsV2.fvUuid, versionUuid))).toEqual([]);
    expect(await parts(versionUuid, form.formUuid)).toEqual([]);
    expect(await parts(null, form.formUuid)).toHaveLength(2);
  });
});