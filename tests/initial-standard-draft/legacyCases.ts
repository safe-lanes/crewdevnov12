import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import * as admin from "../../shared/v2/admin/schema";
import * as engine from "../../shared/v2/forms-engine/schema";
import { formsService } from "../../server/v2/admin/services/formsService";
import { rankGroupsService } from "../../server/v2/admin/services/rankGroupsService";
import { formsController } from "../../server/v2/admin/controllers/formsController";
import { formStructureRepository } from "../../server/v2/admin/repositories/formStructureRepository";
import { requirePermission } from "../../server/middleware/requirePermission";

export function registerLegacyCases(db: () => any, fixture: any) {
  const configuration = (category: string) => JSON.stringify(category === "promotion" ? {
    higherLicenseIds: ["license-1"], ageMin: 24, ageMax: 60,
    experienceMonths: { rankVessel: 12, rankVesselType: 6, companyService: 3, tankerExperience: null },
    otherCriteria: [{ id: "criterion", label: "Leadership", requirement: "Required" }],
    checklistSections: [{ id: "one", title: "Review", assessmentPoints: [{ id: "1.1", text: "Prepared" }] }],
    futureSetting: { keep: true },
  } : {
    competenceAssessments: [{ id: "one", assessmentCriteria: "Navigation", weight: 100, effectiveness: "" }],
    behaviouralAssessments: [], trainings: [], targets: [], hiddenFields: ["personalityIndexCategory"],
    hiddenSections: ["partB"], recommendations: [{ id: "r", question: "Ready?", answer: "" }],
    effectivenessOptions: [{ id: "good", label: "5- Good" }], futureSetting: { keep: true },
  });
  async function legacy(category: string) {
    const { form, group } = await fixture(category, false);
    const [source] = await db().insert(admin.admFormVersionsV2).values({
      fvUuid: randomUUID(), formId: form.id, rankGroupId: group.id,
      versionNo: "09", versionDate: "01-Nov-2026", status: "released",
      configuration: configuration(category), sharedConfig: '{"appraisalTypeOptions":["Annual"],"futureShared":{"keep":true}}',
      releasedAt: new Date("2026-11-01T00:00:00Z"),
    }).returning();
    return { form, group, source };
  }
  const input = (group: any, extra = {}) => ({ rankGroupId: group.id, versionNo: "10", versionDate: "17-Nov-2026", ...extra } as any);
  const load = async (id: number) => (await db().select().from(admin.admFormVersionsV2).where(eq(admin.admFormVersionsV2.id, id)))[0];

  describe("legacy Appraisal and Promotion compatibility", () => {
    it.each(["appraisal", "promotion"])("preserves %s content through entry, explicit save, reopen, release and next draft", async category => {
      const { form, group, source } = await legacy(category);
      const beforeForm = await formsService.getById(form.id);
      const beforeGroup = await rankGroupsService.getById(group.id);
      const draft = await formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open", sourceVersionId: source.id });
      expect(draft).toMatchObject({ versionNo: "10", status: "draft", configuration: source.configuration, sharedConfig: source.sharedConfig });
      expect(await formsService.getById(form.id)).toEqual(beforeForm);
      expect(await rankGroupsService.getById(group.id)).toEqual(beforeGroup);
      const edited = JSON.stringify({ ...JSON.parse(draft.configuration!), futureSetting: { keep: true, edited: true } });
      await formsService.createVersionByFormId(form.id, input(group, { configuration: edited }));
      expect(await load(draft.id)).toMatchObject({ configuration: edited, sharedConfig: source.sharedConfig });
      const resumed = await formsService.createVersionByFormId(form.id, input(group, { configuration: '{"stale":true}' }), { draftIntent: "open" });
      expect(resumed).toMatchObject({ id: draft.id, configuration: edited, sharedConfig: source.sharedConfig });
      expect(await formsService.getVersionConfiguration(draft.id)).toMatchObject({ rankGroupConfig: JSON.parse(edited) });
      const released = await formsService.releaseVersionById(draft.id);
      expect(released).toMatchObject({ status: "released", configuration: edited, sharedConfig: source.sharedConfig });
      const next = await formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" });
      expect(next).toMatchObject({ versionNo: "11", configuration: edited, sharedConfig: source.sharedConfig });
      expect(await load(source.id)).toEqual(source);
      expect((await formsService.getVersionConfiguration(source.id)).rankGroupConfig).toEqual(JSON.parse(source.configuration!));
      expect(await rankGroupsService.getById(group.id)).toEqual(beforeGroup);
    });

    it.each(["appraisal", "promotion"])("serializes concurrent %s entry and preserves saved edits on retry", async category => {
      const { form, group, source } = await legacy(category);
      const drafts = await Promise.all(Array.from({ length: 4 }, () =>
        formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" })));
      expect(new Set(drafts.map(d => d.id)).size).toBe(1);
      await rankGroupsService.updateConfigurationById(group.id, source.configuration!.replace('"keep":true', '"keep":false'));
      const saved = await load(drafts[0].id);
      const retried = await formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" });
      expect(retried).toEqual(saved);
      expect(await db().select().from(admin.admFormVersionsV2).where(and(
        eq(admin.admFormVersionsV2.formId, form.id), eq(admin.admFormVersionsV2.status, "draft")))).toHaveLength(1);
    });
    it("honors an explicitly viewed released source without trusting browser configuration", async () => {
      const { form, group, source } = await legacy("appraisal");
      await db().insert(admin.admFormVersionsV2).values({
        ...source, id: undefined, fvUuid: randomUUID(), versionNo: "10",
        configuration: '{"hiddenSections":["partD"]}',
      });
      const opened = await formsService.createVersionByFormId(form.id, input(group, {
        configuration: '{"browser":"stale"}', sharedConfig: '{"browser":"stale"}',
      }), { draftIntent: "open", sourceVersionId: source.id });
      expect(opened).toMatchObject({ versionNo: "11", configuration: source.configuration, sharedConfig: source.sharedConfig });
      await formsService.createVersionByFormId(form.id, input(group, { sharedConfig: null }));
      expect((await load(opened.id)).sharedConfig).toBeNull();
      await formsService.createVersionByFormId(form.id, input(group));
      expect((await load(opened.id)).sharedConfig).toBeNull();
    });

    it.each(["appraisal", "promotion"])("uses the same compatibility policy on the %s rank-group save route", async category => {
      const { form, group, source } = await legacy(category);
      await rankGroupsService.updateConfigurationById(group.id, source.configuration!);
      const rows = await formsService.getVersionsByFormId(form.id, group.id);
      expect(rows.find(v => v.status === "draft")).toMatchObject({ versionNo: "10", configuration: source.configuration, sharedConfig: source.sharedConfig });
      expect(await load(source.id)).toEqual(source);
    });

    it.each(["appraisal", "promotion"])("still copies %s version-owned structure with new identities", async category => {
      const { form, group, source } = await legacy(category);
      const [part] = await db().insert(engine.frmFormParts).values({
        formPartUuid: randomUUID(), formUuid: form.formUuid, formVersionUuid: source.fvUuid,
        partCode: "C", partTitle: "Criteria", partType: "configurable",
      }).returning();
      const [set] = await db().insert(engine.frmOptionSets).values({
        optionSetUuid: randomUUID(), formVersionUuid: source.fvUuid, setName: "Rating",
      }).returning();
      const [section] = await db().insert(engine.frmSections).values({
        sectionUuid: randomUUID(), formVersionUuid: source.fvUuid, formPartUuid: part.formPartUuid,
        sectionCode: "C1", sectionTitle: "Safety", defaultOptionSetUuid: set.optionSetUuid,
        vesselSignatureRoleUuids: [],
      }).returning();
      await db().insert(engine.frmQuestions).values({
        questionUuid: randomUUID(), sectionUuid: section.sectionUuid, questionCode: "Q1",
        questionText: "Understands safety", responseType: "single_select", optionSetUuid: set.optionSetUuid,
      });
      await db().insert(engine.frmOptions).values({
        optionUuid: randomUUID(), optionSetUuid: set.optionSetUuid, optionLabel: "Good", optionValue: "5",
      });
      const before = await formStructureRepository.readTree(source.fvUuid, part.formPartUuid);
      const spy = vi.spyOn(formStructureRepository, "copyStructure");
      const draft = await formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" });
      expect(spy).toHaveBeenCalledOnce();
      const [copiedPart] = await db().select().from(engine.frmFormParts).where(eq(engine.frmFormParts.formVersionUuid, draft.fvUuid));
      const after = await formStructureRepository.readTree(draft.fvUuid, copiedPart.formPartUuid);
      expect(copiedPart.formPartUuid).not.toBe(part.formPartUuid);
      expect(after.sections[0]).toMatchObject({ sectionTitle: "Safety", formVersionUuid: draft.fvUuid, formPartUuid: copiedPart.formPartUuid });
      expect(after.sections[0].sectionUuid).not.toBe(section.sectionUuid);
      expect(after.questions[0]).toMatchObject({ questionText: "Understands safety", sectionUuid: after.sections[0].sectionUuid });
      expect(after.optionSets[0].formVersionUuid).toBe(draft.fvUuid);
      expect(after.options[0]).toMatchObject({ optionLabel: "Good", optionSetUuid: after.optionSets[0].optionSetUuid });
      expect(await formStructureRepository.readTree(source.fvUuid, part.formPartUuid)).toEqual(before);
    });

    it.each(["null", "{}", "[]", "broken", '{"competenceAssessments":"bad"}', '{"higherLicenseIds":5}'])(
      "rejects unsupported source %s without adding a draft", async invalid => {
        const { form, group, source } = await legacy("appraisal");
        await db().update(admin.admFormVersionsV2).set({ configuration: invalid }).where(eq(admin.admFormVersionsV2.id, source.id));
        await expect(formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" })).rejects.toThrow();
        expect(await formsService.getVersionsByFormId(form.id, group.id)).toHaveLength(1);
      });
    it.each(["deleted-part", "orphan-section", "orphan-set", "bad-shared"])("rejects ambiguous %s instead of falling back to JSON", async corruption => {
      const { form, group, source } = await legacy("promotion");
      if (corruption === "deleted-part") await db().insert(engine.frmFormParts).values({
        formPartUuid: randomUUID(), formUuid: form.formUuid, formVersionUuid: source.fvUuid,
        partCode: "OLD", partTitle: "Deleted", partType: "configurable", isDeleted: true,
      });
      if (corruption === "orphan-section") await db().insert(engine.frmSections).values({
        sectionUuid: randomUUID(), formVersionUuid: source.fvUuid, formPartUuid: randomUUID(),
        sectionCode: "OLD", sectionTitle: "Orphan",
        vesselSignatureRoleUuids: [],
      });
      if (corruption === "orphan-set") await db().insert(engine.frmOptionSets).values({
        optionSetUuid: randomUUID(), formVersionUuid: source.fvUuid, setName: "Orphan",
      });
      if (corruption === "bad-shared") await db().update(admin.admFormVersionsV2).set({ sharedConfig: "broken" }).where(eq(admin.admFormVersionsV2.id, source.id));
      await expect(formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open" })).rejects.toThrow();
      expect(await formsService.getVersionsByFormId(form.id, group.id)).toHaveLength(1);
    });
    it("rejects cross-form/group sources and non-target entry intent without writes", async () => {
      const { form, group } = await legacy("appraisal");
      const foreign = await legacy("promotion");
      await expect(formsService.createVersionByFormId(form.id, input(group), { draftIntent: "open", sourceVersionId: foreign.source.id })).rejects.toThrow("no longer available");
      await expect(formsService.createVersionByFormId(form.id, input(foreign.group), { draftIntent: "open" })).rejects.toThrow("belonging");
      const excluded = await fixture("briefing");
      await expect(formsService.createVersionByFormId(excluded.form.id, input(excluded.group), { draftIntent: "open" })).rejects.toThrow("only");
      expect(await formsService.getVersionsByFormId(form.id, group.id)).toHaveLength(1);
    });
    it("sanitizes structural failure and keeps the existing API permission gates", async () => {
      const { form, group, source } = await legacy("appraisal");
      await db().update(admin.admFormVersionsV2).set({ configuration: "{}" }).where(eq(admin.admFormVersionsV2.id, source.id));
      const app = express(); app.use(express.json());
      app.post("/forms/:id/versions", requirePermission("Forms", "create"), formsController.createVersion);
      expect((await request(app).post(`/forms/${form.id}/versions`).send(input(group, { draftIntent: "open" }))).status).toBe(403);
      await db().insert(admin.admMenuMasterAc).values({ muid: "forms-menu", name: "Forms", route: "/forms", isActive: true, isDeleted: false });
      await db().insert(admin.admRoleAccessAc).values({ rauid: randomUUID(), roleId: "test-role", menuId: "forms-menu", canview: true, cancreate: true, isDeleted: false });
      const failed = await request(app).post(`/forms/${form.id}/versions`).send(input(group, { draftIntent: "open" }));
      expect(failed.status).toBe(409);
      expect(failed.body.error).toMatch(/cannot safely create a draft/);
      expect(JSON.stringify(failed.body)).not.toContain(source.fvUuid);
      expect(await formsService.getVersionsByFormId(form.id, group.id)).toHaveLength(1);
    });
  });
}
