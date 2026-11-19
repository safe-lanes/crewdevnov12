import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as admin from "../../shared/v2/admin/schema";
import * as engine from "../../shared/v2/forms-engine/schema";
import { formsService } from "../../server/v2/admin/services/formsService";
import { briefingService, resolveBriefingCreationTarget } from "../../server/v2/briefings/service";
import { interviewService, resolveInterviewCreationTarget } from "../../server/v2/interviews/service";
import { resolveDebriefingCreationTarget } from "../../server/v2/debriefings/service";
import { briefingRepository } from "../../server/v2/briefings/repository";
import { interviewRepository } from "../../server/v2/interviews/repository";
import { masterUsers } from "../../shared/schema";
import { crewBriefings } from "../../shared/v2/crew-pool/schema";
import { recruitmentCandidatesV2, screeningB6Interviews, screeningB6InterviewItems } from "../../shared/v2/recruitment/schema";
import type { Request } from "express";

export function registerReleasedResolutionCases(getDb: () => any, fixture: (category?: string, templates?: boolean) => Promise<any>) {
  async function createSubmission(category: string) {
    const [officer] = await getDb().insert(masterUsers).values({ userType: "Office", userUuid: randomUUID() }).returning();
    const req = { user: { id: officer.id, userType: "Office" } } as Request;
    if (category === "briefing") {
      const briefingUuid = randomUUID();
      await getDb().insert(crewBriefings).values({ briefingUuid, crewUuid: randomUUID(), joiningRank: "Master" });
      return briefingService.create({ briefingUuid }, req);
    }
    const recCanUuid = randomUUID(), b6Uuid = randomUUID(), intUuid = randomUUID();
    await getDb().insert(recruitmentCandidatesV2).values({ recCanUuid, rankAppliedFor: "Master" });
    await getDb().insert(screeningB6Interviews).values({ b6Uuid, recCanUuid });
    await getDb().insert(screeningB6InterviewItems).values({ intUuid, b6Uuid });
    return interviewService.create({ interviewItemUuid: intUuid }, req);
  }
  async function released(category: string, configuration: string | null = null, ranks = ["Master", "Bosun"]) {
    const db = getDb();
    const { form, group } = await fixture(category);
    await db.update(admin.admRankGroupsV2).set({ ranks: JSON.stringify(ranks), configuration })
      .where(eq(admin.admRankGroupsV2.id, group.id));
    const draft = await formsService.ensureInitialStandardDraft(form.id, group.id);
    const version = await formsService.releaseVersionById(draft.id);
    const parts = await db.select().from(engine.frmFormParts)
      .where(eq(engine.frmFormParts.formVersionUuid, version.fvUuid));
    return { form, group, version, parts };
  }

  describe("released structured standard form recognition", () => {
    for (const category of ["briefing", "interview"]) {
      it.each([null, "", "{}", '{"legacy":true}', "not-json"])(
        `${category} resolves the actual released version with legacy configuration %s`,
        async configuration => {
          const target = await released(category, configuration);
          const result = await formsService.getFormForRank("Master", category);
          expect(result).toMatchObject({
            formUuid: target.form.formUuid, formVersionId: target.version.id,
            formVersionUuid: target.version.fvUuid, noReleasedVersion: false,
          });
          expect((await getDb().select().from(admin.admFormVersionsV2))[0].configuration).toBe(configuration);
        },
      );
      it(`${category} works through the actual creation resolver and runtime structure reader`, async () => {
        const { form, group, version, parts } = await released(category);
        const part = parts.find((p: any) => p.partType === "configurable");
        const sectionUuid = randomUUID();
        await getDb().insert(engine.frmSections).values({
          sectionUuid, formVersionUuid: version.fvUuid, formPartUuid: part.formPartUuid,
          sectionCode: "B1", sectionTitle: "Discussion", sortOrder: 1, vesselSignatureRoleUuids: [],
        });
        await getDb().insert(engine.frmQuestions).values({
          questionUuid: randomUUID(), sectionUuid, questionCode: "B1.1", questionText: "Demo point",
          responseType: "checkbox", sortOrder: 1,
        });
        const target = category === "briefing"
          ? await resolveBriefingCreationTarget({ joiningRank: "Bosun" })
          : await resolveInterviewCreationTarget("Bosun");
        expect(target).toMatchObject({
          formUuid: form.formUuid, formVersionId: version.id, formVersionUuid: version.fvUuid,
          rank: "Bosun", rankGroupName: group.name,
        });
        const tree = category === "briefing"
          ? await briefingRepository.structure(target.formVersionUuid)
          : await interviewRepository.structure(target.formVersionUuid);
        expect(tree.sections).toHaveLength(1);
        expect(tree.questions[0].questionText).toBe("Demo point");
        const submission = await createSubmission(category);
        expect(submission).toMatchObject({ form_version_uuid: version.fvUuid, form_version_id: version.id });
        expect(await getDb().select().from(engine.frmSectionStates)).toHaveLength(1);
      });
      it(`${category} retains the released version when a newer draft exists`, async () => {
        const { form, group, version } = await released(category);
        await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: "{}" } as any);
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({
          formVersionId: version.id, noReleasedVersion: false,
        });
      });
      it(`${category} chooses the latest release, not an older version with populated JSON`, async () => {
        const { form, group, version } = await released(category, "{}");
        const next = await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: null } as any);
        await formsService.releaseVersionById(next.id);
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({
          formVersionId: next.id, noReleasedVersion: false,
        });
        expect(next.id).not.toBe(version.id);
      });
      it(`${category} does not accept a draft-only group`, async () => {
        const { form, group } = await fixture(category);
        await getDb().update(admin.admRankGroupsV2).set({ ranks: '["Master"]' }).where(eq(admin.admRankGroupsV2.id, group.id));
        await formsService.ensureInitialStandardDraft(form.id, group.id);
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({ noReleasedVersion: true, formVersionId: null });
        await expect(createSubmission(category)).rejects.toMatchObject({ statusCode: 404 });
        expect(await getDb().select().from(engine.crewBriefingSubmissions)).toHaveLength(0);
        expect(await getDb().select().from(engine.crewInterviewSubmissions)).toHaveLength(0);
      });
      it(`${category} does not accept a deleted release or an archived rank group`, async () => {
        const { group, version } = await released(category);
        await getDb().update(admin.admFormVersionsV2).set({ isDeleted: true }).where(eq(admin.admFormVersionsV2.id, version.id));
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({ noReleasedVersion: true });
        await getDb().update(admin.admRankGroupsV2).set({ archivedAt: new Date() }).where(eq(admin.admRankGroupsV2.id, group.id));
        expect(await formsService.getFormForRank("Master", category)).toBeNull();
      });
      it.each(["missing", "deleted", "wrong-form", "wrong-section-part"])(`${category} rejects %s structure without writing a submission`, async damage => {
        const { form, version } = await released(category, "{}");
        if (damage === "missing") await getDb().delete(engine.frmFormParts).where(eq(engine.frmFormParts.formVersionUuid, version.fvUuid));
        if (damage === "deleted") await getDb().update(engine.frmFormParts).set({ isDeleted: true }).where(eq(engine.frmFormParts.formVersionUuid, version.fvUuid));
        if (damage === "wrong-form") {
          const other = await fixture(category);
          await getDb().update(engine.frmFormParts).set({ formUuid: other.form.formUuid })
            .where(eq(engine.frmFormParts.formVersionUuid, version.fvUuid));
        }
        if (damage === "wrong-section-part") {
          const template = (await getDb().select().from(engine.frmFormParts))
            .find((p: any) => p.formUuid === form.formUuid && p.formVersionUuid === null);
          await getDb().insert(engine.frmSections).values({
            sectionUuid: randomUUID(), formVersionUuid: version.fvUuid, formPartUuid: template.formPartUuid,
            sectionCode: "B1", sectionTitle: "Wrong ownership", vesselSignatureRoleUuids: [],
          });
        }
        const resolve = () => category === "briefing"
          ? resolveBriefingCreationTarget({ joiningRank: "Master" }) : resolveInterviewCreationTarget("Master");
        await expect(resolve()).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("structure") });
        await expect(createSubmission(category)).rejects.toMatchObject({ statusCode: 409 });
        expect(await getDb().select().from(engine.crewBriefingSubmissions)).toHaveLength(0);
        expect(await getDb().select().from(engine.crewInterviewSubmissions)).toHaveLength(0);
        expect(await getDb().select().from(engine.frmAnswers)).toHaveLength(0);
      });
      it(`${category} never uses an older release to hide damaged latest structure`, async () => {
        const { form, group } = await released(category, "{}");
        const next = await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: null } as any);
        await formsService.releaseVersionById(next.id);
        await getDb().update(engine.frmFormParts).set({ isDeleted: true }).where(eq(engine.frmFormParts.formVersionUuid, next.fvUuid));
        const result = await formsService.getFormForRank("Master", category);
        expect(result.structureError).toContain("structure");
        expect(result.formVersionId).toBeNull();
      });
      it(`${category} rejects a version with a different form owner`, async () => {
        const { version } = await released(category);
        const other = await fixture(category);
        await getDb().update(admin.admFormVersionsV2).set({ formId: other.form.id })
          .where(eq(admin.admFormVersionsV2.id, version.id));
        await expect(createSubmission(category)).rejects.toMatchObject({ statusCode: 409 });
      });
      it(`${category} uses release time to break a version-number tie`, async () => {
        const { form, group, version } = await released(category);
        const newer = await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: null } as any);
        await formsService.releaseVersionById(newer.id);
        await getDb().update(admin.admFormVersionsV2).set({ versionNo: version.versionNo, releasedAt: new Date("2030-01-01") })
          .where(eq(admin.admFormVersionsV2.id, newer.id));
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({ formVersionId: newer.id });
      });
      it(`${category} does not repin an existing submission after a new release`, async () => {
        const { form, group, version } = await released(category);
        await createSubmission(category);
        const newer = await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: null } as any);
        await formsService.releaseVersionById(newer.id);
        const table = category === "briefing" ? engine.crewBriefingSubmissions : engine.crewInterviewSubmissions;
        expect((await getDb().select().from(table))[0].formVersionUuid).toBe(version.fvUuid);
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({ formVersionId: newer.id });
      });
      it(`${category} excludes an unrelated or deleted form`, async () => {
        const { form } = await released(category);
        expect(await formsService.getFormForRank("Wiper", category)).toBeNull();
        await getDb().update(admin.admFormsV2).set({ isDeleted: true }).where(eq(admin.admFormsV2.id, form.id));
        expect(await formsService.getFormForRank("Master", category)).toBeNull();
      });
      it(`${category} gives an exact suffixed-rank assignment precedence over a base rank`, async () => {
        await released(category, null, ["AB"]);
        const exact = await released(category, null, ["AB_3"]);
        expect(await formsService.getFormForRank("AB_3", category)).toMatchObject({ formVersionId: exact.version.id });
      });
    }
    it("Debriefing still resolves its own NULL-JSON release with a newer draft", async () => {
      const { form, group, version } = await released("debriefing");
      await formsService.createVersionByFormId(form.id, { rankGroupId: group.id, configuration: "{}" } as any);
      expect(await resolveDebriefingCreationTarget({ rankServed: "Master" }, getDb()))
        .toMatchObject({ formVersionId: version.id, formVersionUuid: version.fvUuid });
    });
    it.each(["appraisal", "promotion"])("%s retains its existing JSON configuration eligibility and parsing", async category => {
      const { form, group } = await fixture(category, false);
      await getDb().update(admin.admRankGroupsV2).set({ ranks: '["Master"]' }).where(eq(admin.admRankGroupsV2.id, group.id));
      const [version] = await getDb().insert(admin.admFormVersionsV2).values({
        fvUuid: randomUUID(), formId: form.id, rankGroupId: group.id, versionNo: "01",
        versionDate: "18-Nov-2026", status: "released", configuration: null,
      }).returning();
      for (const configuration of [null, "", "invalid-json", "null"]) {
        await getDb().update(admin.admFormVersionsV2).set({ configuration }).where(eq(admin.admFormVersionsV2.id, version.id));
        expect(await formsService.getFormForRank("Master", category)).toMatchObject({ noReleasedVersion: true });
      }
      await getDb().update(admin.admFormVersionsV2).set({ configuration: '{"preserved":true}' }).where(eq(admin.admFormVersionsV2.id, version.id));
      expect(await formsService.getFormForRank("Master", category)).toMatchObject({
        noReleasedVersion: false, formVersionId: version.id, rankGroupConfig: { preserved: true },
      });
    });
  });
}
