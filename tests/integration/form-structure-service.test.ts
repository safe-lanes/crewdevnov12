import { afterAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@server/v2/db";
import {
  admFormVersionsV2,
  admFormsV2,
  admRankGroupsV2,
} from "@shared/v2/admin/schema";
import {
  frmFormParts,
  frmOptions,
  frmOptionSets,
  frmQuestions,
  frmSections,
  type FormStructureInput,
} from "@shared/v2/forms-engine/schema";
import { formsService } from "@server/v2/admin/services/formsService";
import { rankGroupsService } from "@server/v2/admin/services/rankGroupsService";
import {
  FormStructureServiceError,
  copyFormVersionStructure,
  formStructureService,
} from "@server/v2/admin/services/formStructureService";
import { formStructureRepository } from "@server/v2/admin/repositories/formStructureRepository";

const formUuids: string[] = [];

function testStructure(): FormStructureInput {
  return {
    sections: [{
      section_code: "B1",
      section_title: "First briefing point",
      applicable_vessel_types: [],
      responsible_mode: "not_applicable",
      comment_box_required: false,
      signature_required: false,
      questions: [{
        question_code: "B1Q1",
        question_text: "Is this understood?",
        response_type: "single_select",
        is_mandatory: true,
        comment_enabled: true,
        options: [
          { option_label: "Yes", option_value: "yes" },
          { option_label: "No", option_value: "no" },
        ],
      }],
    }],
  };
}

function acceptanceSizedStructure(): FormStructureInput {
  return {
    sections: Array.from({ length: 10 }, (_, sectionIndex) => {
      const sectionCode = `B${sectionIndex + 1}`;
      return {
        section_code: sectionCode,
        section_title: `Briefing section ${sectionIndex + 1}`,
        applicable_vessel_types: [],
        responsible_mode: "not_applicable" as const,
        comment_box_required: false,
        signature_required: false,
        questions: Array.from({ length: 10 }, (_, questionIndex) => {
          const isSelect = questionIndex === 0;
          return {
            question_code: `${sectionCode}.${questionIndex + 1}`,
            question_text: `Briefing point ${sectionIndex + 1}.${questionIndex + 1}`,
            response_type: isSelect ? "single_select" : "yes_no",
            is_mandatory: false,
            comment_enabled: true,
            // Two selections in each of ten sections = the acceptance 20 options.
            options: isSelect ? [
              { option_label: "Yes", option_value: `yes_${sectionIndex + 1}` },
              { option_label: "No", option_value: `no_${sectionIndex + 1}` },
            ] : [],
          };
        }),
      };
    }),
  };
}

async function createFormFixture(name: string) {
  const db = getDb();
  const formUuid = uuidv4();
  formUuids.push(formUuid);
  const [form] = await db.insert(admFormsV2).values({
    formUuid,
    name,
    category: "briefing",
    rankGroup: "Test rank group",
    versionNo: "00",
    versionDate: "24-Aug-2026",
    isLockForm: false,
  }).returning();
  const [rankGroup] = await db.insert(admRankGroupsV2).values({
    rgUuid: uuidv4(),
    formId: form.id,
    name: `${name} ranks`,
    ranks: "[]",
  }).returning();
  const partUuid = uuidv4();
  await db.insert(frmFormParts).values({
    formPartUuid: partUuid,
    formUuid,
    partCode: "B",
    partTitle: "Briefing Points",
    partType: "configurable",
    isOfficeOnly: false,
  });
  return { form, rankGroup, partUuid };
}

async function deleteFixture(formUuid: string) {
  const db = getDb();
  const forms = await db.select({ id: admFormsV2.id }).from(admFormsV2)
    .where(eq(admFormsV2.formUuid, formUuid));
  const form = forms[0];
  if (!form) return;
  const versions = await db.select({ fvUuid: admFormVersionsV2.fvUuid }).from(admFormVersionsV2)
    .where(eq(admFormVersionsV2.formId, form.id));
  const versionUuids = versions.map((row) => row.fvUuid);
  const sections = versionUuids.length === 0 ? [] : await db.select({ sectionUuid: frmSections.sectionUuid })
    .from(frmSections)
    .where(inArray(frmSections.formVersionUuid, versionUuids));
  const sectionUuids = sections.map((row) => row.sectionUuid);
  const questions = sectionUuids.length === 0 ? [] : await db.select({ questionUuid: frmQuestions.questionUuid })
    .from(frmQuestions)
    .where(inArray(frmQuestions.sectionUuid, sectionUuids));
  const questionUuids = questions.map((row) => row.questionUuid);

  if (questionUuids.length > 0) {
    await db.delete(frmQuestions).where(inArray(frmQuestions.questionUuid, questionUuids));
  }
  if (sectionUuids.length > 0) {
    await db.delete(frmSections).where(inArray(frmSections.sectionUuid, sectionUuids));
  }
  if (versionUuids.length > 0) {
    const sets = await db.select({ optionSetUuid: frmOptionSets.optionSetUuid }).from(frmOptionSets)
      .where(inArray(frmOptionSets.formVersionUuid, versionUuids));
    const setUuids = sets.map((row) => row.optionSetUuid);
    if (setUuids.length > 0) {
      await db.delete(frmOptions).where(inArray(frmOptions.optionSetUuid, setUuids));
      await db.delete(frmOptionSets).where(inArray(frmOptionSets.optionSetUuid, setUuids));
    }
  }
  await db.delete(admFormVersionsV2).where(eq(admFormVersionsV2.formId, form.id));
  await db.delete(admRankGroupsV2).where(eq(admRankGroupsV2.formId, form.id));
  await db.delete(frmFormParts).where(eq(frmFormParts.formUuid, formUuid));
  await db.delete(admFormsV2).where(eq(admFormsV2.id, form.id));
}

describe.sequential("form structure service integration", () => {
  afterAll(async () => {
    for (const formUuid of formUuids) await deleteFixture(formUuid);
  });

  it("writes draft trees transactionally, keeps identities, protects releases, and deep-copies a new draft", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure integration ${uuidv4()}`);
    const firstDraft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);

    const saved = await formStructureService.replaceStructure(
      firstDraft.fvUuid,
      partUuid,
      testStructure(),
      null,
    );
    expect(saved.sections).toHaveLength(1);
    expect(saved.sections[0].questions[0].options).toHaveLength(2);
    expect(saved.option_sets).toHaveLength(1);

    const savedSectionUuid = saved.sections[0].section_uuid;
    const savedQuestionUuid = saved.sections[0].questions[0].question_uuid;
    const savedOptionUuid = saved.sections[0].questions[0].options[0].option_uuid;
    const savedSetUuid = saved.option_sets[0].option_set_uuid;

    const renamed = await formStructureService.replaceStructure(firstDraft.fvUuid, partUuid, {
      sections: [{
        section_uuid: savedSectionUuid,
        section_code: "B1",
        section_title: "Renamed briefing point",
        applicable_vessel_types: [],
        responsible_mode: "not_applicable",
        comment_box_required: false,
        signature_required: false,
        questions: [{
          question_uuid: savedQuestionUuid,
          question_code: "B1Q1",
          question_text: "Is this understood?",
          response_type: "single_select",
          is_mandatory: true,
          comment_enabled: true,
          options: [
            {
              option_uuid: savedOptionUuid,
              option_label: "Yes",
              option_value: "yes",
            },
            { option_label: "No", option_value: "no" },
          ],
        }],
      }],
    }, null);
    expect(renamed.sections[0].section_uuid).toBe(savedSectionUuid);
    expect(renamed.sections[0].section_title).toBe("Renamed briefing point");
    expect(renamed.sections[0].questions[0].question_uuid).toBe(savedQuestionUuid);
    expect(renamed.sections[0].questions[0].options[0].option_uuid).toBe(savedOptionUuid);

    const released = await formsService.releaseVersionById(firstDraft.id);
    await expect(
      formStructureService.replaceStructure(released.fvUuid, partUuid, { sections: [] }, null),
    ).rejects.toMatchObject<FormStructureServiceError>({ statusCode: 409 });
    const releasedTree = await formStructureService.getStructure(released.fvUuid, partUuid);
    expect(releasedTree.sections[0].section_uuid).toBe(savedSectionUuid);

    const copiedDraft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const copiedTree = await formStructureService.getStructure(copiedDraft.fvUuid, partUuid);
    expect(copiedTree.sections).toHaveLength(1);
    expect(copiedTree.sections[0].questions).toHaveLength(1);
    expect(copiedTree.sections[0].questions[0].options).toHaveLength(2);
    expect(copiedTree.sections[0].section_uuid).not.toBe(savedSectionUuid);
    expect(copiedTree.sections[0].questions[0].question_uuid).not.toBe(savedQuestionUuid);
    expect(copiedTree.sections[0].questions[0].options[0].option_uuid).not.toBe(savedOptionUuid);
    expect(copiedTree.option_sets[0].option_set_uuid).not.toBe(savedSetUuid);

    await formStructureService.replaceStructure(copiedDraft.fvUuid, partUuid, { sections: [] }, null);
    const emptiedDraft = await formStructureService.getStructure(copiedDraft.fvUuid, partUuid);
    expect(emptiedDraft.sections).toEqual([]);
  });

  it("persists named shared sets, resolves section defaults, and exposes effectiveLayout", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure sets ${uuidv4()}`);
    const draft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const setUuid = uuidv4();
    const saved = await formStructureService.replaceStructure(draft.fvUuid, partUuid, {
      option_sets: [{
        option_set_uuid: setUuid,
        option_set_name: "Readiness",
        options: [
          { option_label: "Yes", option_value: "yes" },
          { option_label: "No", option_value: "no" },
        ],
      }],
      sections: [{
        section_code: "B1",
        section_title: "Shared choices",
        applicable_vessel_types: [],
        responsible_mode: "not_applicable",
        comment_box_required: false,
        signature_required: false,
        default_option_set_uuid: setUuid,
        layout_preference: "auto",
        questions: [
          {
            question_code: "B1Q1",
            question_text: "First point",
            response_type: "single_select",
            is_mandatory: false,
            comment_enabled: true,
            options: [],
          },
          {
            question_code: "B1Q2",
            question_text: "Second point",
            response_type: "multi_select",
            is_mandatory: false,
            comment_enabled: true,
            options: [],
          },
        ],
      }],
    }, null);

    expect(saved.option_sets).toMatchObject([{
      option_set_uuid: setUuid,
      option_set_name: "Readiness",
    }]);
    expect(saved.sections[0].effectiveLayout).toBe("matrix");
    expect(saved.sections[0].questions[0].options.map((option: any) => option.option_value)).toEqual(["yes", "no"]);
    expect(saved.sections[0].questions[1].options.map((option: any) => option.option_value)).toEqual(["yes", "no"]);

    // The GET/PUT shape intentionally includes the same shared options both
    // top-level and under each question for legacy editor compatibility.
    const roundTripped = await formStructureService.replaceStructure(
      draft.fvUuid,
      partUuid,
      saved as any,
      null,
    );
    expect(roundTripped.option_sets[0].options).toHaveLength(2);
    expect(roundTripped.sections[0].questions[0].options).toHaveLength(2);
  });

  it("retains an unreferenced named set so it can be assigned later", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure unassigned set ${uuidv4()}`);
    const draft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const setUuid = uuidv4();
    const first = await formStructureService.replaceStructure(draft.fvUuid, partUuid, {
      option_sets: [{
        option_set_uuid: setUuid,
        option_set_name: "Future choices",
        options: [{ option_label: "Ready", option_value: "ready" }],
      }],
      sections: [],
    }, null);
    expect(first.option_sets.map((set: any) => set.option_set_uuid)).toContain(setUuid);

    const assigned = await formStructureService.replaceStructure(draft.fvUuid, partUuid, {
      option_sets: first.option_sets.map((set: any) => ({
        option_set_uuid: set.option_set_uuid,
        option_set_name: set.option_set_name,
        options: set.options.map((option: any) => ({
          option_uuid: option.option_uuid,
          option_label: option.option_label,
          option_value: option.option_value,
        })),
      })),
      sections: [{
        section_code: "B1",
        section_title: "Assigned later",
        applicable_vessel_types: [],
        responsible_mode: "not_applicable",
        comment_box_required: false,
        signature_required: false,
        default_option_set_uuid: setUuid,
        layout_preference: "auto",
        questions: [{
          question_code: "B1Q1",
          question_text: "Ready?",
          response_type: "single_select",
          is_mandatory: false,
          comment_enabled: true,
          options: [],
        }],
      }],
    }, null);
    expect(assigned.sections[0].questions[0].options[0].option_value).toBe("ready");
  });

  it("keeps reusable sets when another part is saved with the legacy payload", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure legacy set retention ${uuidv4()}`);
    const secondPartUuid = uuidv4();
    await getDb().insert(frmFormParts).values({
      formPartUuid: secondPartUuid,
      formUuid: form.formUuid,
      partCode: "D",
      partTitle: "Debriefing",
      partType: "configurable",
      isOfficeOnly: false,
    });
    const draft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const setUuid = uuidv4();
    const first = await formStructureService.replaceStructure(draft.fvUuid, partUuid, {
      option_sets: [{
        option_set_uuid: setUuid,
        option_set_name: "Reusable choices",
        options: [{ option_label: "Ready", option_value: "ready" }],
      }],
      sections: [],
    }, null);
    expect(first.option_sets).toHaveLength(1);

    await formStructureService.replaceStructure(draft.fvUuid, secondPartUuid, { sections: [] }, null);
    const afterLegacySave = await formStructureService.getStructure(draft.fvUuid, partUuid);
    expect(afterLegacySave.option_sets).toMatchObject([{
      option_set_uuid: setUuid,
      options: [{ option_value: "ready" }],
    }]);
  });

  it("requires a released source and a draft target before writing any structure", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure guarded copy ${uuidv4()}`);
    const sourceDraft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    await formStructureService.replaceStructure(sourceDraft.fvUuid, partUuid, testStructure(), null);
    const [draftTarget] = await getDb().insert(admFormVersionsV2).values({
      fvUuid: uuidv4(),
      formId: form.id,
      rankGroupId: rankGroup.id,
      versionNo: "98",
      versionDate: "24-Aug-2026",
      status: "draft",
      configuration: "{}",
    }).returning();
    await expect(copyFormVersionStructure(sourceDraft.fvUuid, draftTarget.fvUuid))
      .rejects.toThrow("source status must be exactly released");
    expect((await formStructureService.getStructure(draftTarget.fvUuid, partUuid)).sections).toEqual([]);

    const source = await formsService.releaseVersionById(sourceDraft.id);
    const [target] = await getDb().insert(admFormVersionsV2).values({
      fvUuid: uuidv4(),
      formId: form.id,
      rankGroupId: rankGroup.id,
      versionNo: "99",
      versionDate: "24-Aug-2026",
      status: "released",
      configuration: "{}",
      releasedAt: new Date(),
    }).returning();

    await expect(copyFormVersionStructure(source.fvUuid, target.fvUuid))
      .rejects.toThrow("target status must be exactly draft");
    expect((await formStructureService.getStructure(target.fvUuid, partUuid)).sections).toEqual([]);
  });

  it("handles the acceptance-sized source through both draft-copy paths without mutating the released source", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure acceptance ${uuidv4()}`);
    const sourceDraft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const startedAt = Date.now();
    const saved = await formStructureService.replaceStructure(
      sourceDraft.fvUuid,
      partUuid,
      acceptanceSizedStructure(),
      null,
    );
    const saveDurationMs = Date.now() - startedAt;
    const counts = {
      sections: saved.sections.length,
      questions: saved.sections.reduce((total, section) => total + section.questions.length, 0),
      options: saved.sections.reduce(
        (total, section) => total + section.questions.reduce((points, question) => points + question.options.length, 0),
        0,
      ),
    };
    expect(counts).toEqual({ sections: 10, questions: 100, options: 20 });
    expect(saveDurationMs).toBeLessThan(10_000);

    const released = await formsService.releaseVersionById(sourceDraft.id);
    const sourceTree = await formStructureService.getStructure(released.fvUuid, partUuid);
    const sourceSectionUuid = sourceTree.sections[0].section_uuid;
    const sourceQuestionUuid = sourceTree.sections[0].questions[0].question_uuid;
    const sourceOptionUuid = sourceTree.sections[0].questions[0].options[0].option_uuid;

    // Direct form-version creation copies the released tree into an editable draft.
    const directDraft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const directTree = await formStructureService.getStructure(directDraft.fvUuid, partUuid);
    expect(directTree.sections).toHaveLength(10);
    expect(directTree.sections[0].questions).toHaveLength(10);
    expect(directTree.sections[0].questions[0].options).toHaveLength(2);
    expect(directTree.sections[0].section_uuid).not.toBe(sourceSectionUuid);
    expect(directTree.sections[0].questions[0].question_uuid).not.toBe(sourceQuestionUuid);
    expect(directTree.sections[0].questions[0].options[0].option_uuid).not.toBe(sourceOptionUuid);
    expect((await formStructureService.getStructure(released.fvUuid, partUuid)).sections).toHaveLength(10);

    // Remove the direct draft so the rank-group configuration path must build its own copy.
    await formStructureService.replaceStructure(directDraft.fvUuid, partUuid, { sections: [] }, null);
    const directSets = await getDb().select({ optionSetUuid: frmOptionSets.optionSetUuid })
      .from(frmOptionSets)
      .where(eq(frmOptionSets.formVersionUuid, directDraft.fvUuid));
    const directSetUuids = directSets.map((set) => set.optionSetUuid);
    if (directSetUuids.length > 0) {
      await getDb().delete(frmOptions).where(inArray(frmOptions.optionSetUuid, directSetUuids));
      await getDb().delete(frmOptionSets).where(inArray(frmOptionSets.optionSetUuid, directSetUuids));
    }
    await getDb().delete(admFormVersionsV2).where(eq(admFormVersionsV2.id, directDraft.id));

    await rankGroupsService.updateConfigurationById(rankGroup.id, "{}");
    const rankGroupDrafts = await getDb().select().from(admFormVersionsV2).where(and(
      eq(admFormVersionsV2.rankGroupId, rankGroup.id),
      eq(admFormVersionsV2.status, "draft"),
      eq(admFormVersionsV2.isDeleted, false),
    ));
    expect(rankGroupDrafts).toHaveLength(1);
    const rankGroupTree = await formStructureService.getStructure(rankGroupDrafts[0].fvUuid, partUuid);
    expect(rankGroupTree.sections).toHaveLength(10);
    expect(rankGroupTree.sections[0].questions).toHaveLength(10);
    expect(rankGroupTree.sections[0].questions[0].options).toHaveLength(2);
    expect(rankGroupTree.sections[0].section_uuid).not.toBe(sourceSectionUuid);
    expect((await formStructureService.getStructure(released.fvUuid, partUuid)).sections).toHaveLength(10);
    console.info(`Acceptance-sized form structure saved in ${saveDurationMs}ms (10 sections, 100 questions, 20 options).`);
  });

  it("rejects cross-form ownership and invalid master-data references before writes", async () => {
    const source = await createFormFixture(`Structure owner ${uuidv4()}`);
    const foreign = await createFormFixture(`Structure foreign ${uuidv4()}`);
    const draft = await formsService.createVersionByFormId(source.form.id, {
      rankGroupId: source.rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);

    await expect(
      formStructureService.replaceStructure(draft.fvUuid, foreign.partUuid, testStructure(), null),
    ).rejects.toMatchObject<FormStructureServiceError>({ statusCode: 400 });

    const unknownVesselTypePayload = testStructure();
    unknownVesselTypePayload.sections[0].applicable_vessel_types = [uuidv4()];
    await expect(
      formStructureService.replaceStructure(draft.fvUuid, source.partUuid, unknownVesselTypePayload, null),
    ).rejects.toThrow("Unknown vessel type UUID");

    const unknownRolePayload = testStructure();
    unknownRolePayload.sections[0].responsible_mode = "role";
    unknownRolePayload.sections[0].responsible_role_uuid = uuidv4();
    await expect(
      formStructureService.replaceStructure(draft.fvUuid, source.partUuid, unknownRolePayload, null),
    ).rejects.toThrow("Unknown responsible role UUID");
  });

  it("rolls back every configurable part when a batch member fails validation", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure batch rollback ${uuidv4()}`);
    const secondPartUuid = uuidv4();
    await getDb().insert(frmFormParts).values({
      formPartUuid: secondPartUuid,
      formUuid: form.formUuid,
      partCode: "D",
      partTitle: "Debriefing Points",
      partType: "configurable",
      isOfficeOnly: false,
    });
    const draft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const invalidSecondPart = testStructure();
    invalidSecondPart.sections[0].responsible_mode = "role";
    invalidSecondPart.sections[0].responsible_role_uuid = uuidv4();

    await expect(
      formStructureService.replaceStructures(draft.fvUuid, [
        { partUuid, structure: testStructure() },
        { partUuid: secondPartUuid, structure: invalidSecondPart },
      ], null),
    ).rejects.toThrow("Unknown responsible role UUID");

    expect((await formStructureService.getStructure(draft.fvUuid, partUuid)).sections).toEqual([]);
    expect((await formStructureService.getStructure(draft.fvUuid, secondPartUuid)).sections).toEqual([]);
  });

  it("rolls back the entire tree when a database write fails mid-replacement", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure rollback ${uuidv4()}`);
    const draft = await formsService.createVersionByFormId(form.id, {
      rankGroupId: rankGroup.id,
      configuration: "{}",
      sharedConfig: "{}",
      versionDate: "24-Aug-2026",
    } as any);
    const malformed = testStructure();
    malformed.sections[0].questions[0].options = [
      { option_label: "First", option_value: "duplicate" },
      { option_label: "Second", option_value: "duplicate" },
    ];

    await expect(
      formStructureRepository.replaceTree(draft.fvUuid, partUuid, malformed, null),
    ).rejects.toThrow();
    const treeAfterFailure = await formStructureService.getStructure(draft.fvUuid, partUuid);
    expect(treeAfterFailure.sections).toEqual([]);
  });

  it("copies through the rank-group draft path and blocks direct releases when structure exists", async () => {
    const { form, rankGroup, partUuid } = await createFormFixture(`Structure rank group ${uuidv4()}`);
    const db = getDb();
    const sourceVersionUuid = uuidv4();
    await db.insert(admFormVersionsV2).values({
      fvUuid: sourceVersionUuid,
      formId: form.id,
      rankGroupId: rankGroup.id,
      versionNo: "01",
      versionDate: "24-Aug-2026",
      status: "released",
      configuration: "{}",
      sharedConfig: "{}",
      releasedAt: new Date(),
    });
    const sectionUuid = uuidv4();
    const questionUuid = uuidv4();
    await db.insert(frmSections).values({
      sectionUuid,
      formVersionUuid: sourceVersionUuid,
      formPartUuid: partUuid,
      sectionCode: "B1",
      sectionTitle: "Copied through rank group",
      responsibleMode: "not_applicable",
    });
    await db.insert(frmQuestions).values({
      questionUuid,
      sectionUuid,
      questionCode: "B1Q1",
      questionText: "Copied question",
      responseType: "free_text",
    });

    await rankGroupsService.updateConfigurationById(rankGroup.id, "{}");
    const drafts = await db.select().from(admFormVersionsV2).where(and(
      eq(admFormVersionsV2.rankGroupId, rankGroup.id),
      eq(admFormVersionsV2.status, "draft"),
      eq(admFormVersionsV2.isDeleted, false),
    ));
    expect(drafts).toHaveLength(1);
    const copiedTree = await formStructureService.getStructure(drafts[0].fvUuid, partUuid);
    expect(copiedTree.sections).toHaveLength(1);
    expect(copiedTree.sections[0].section_uuid).not.toBe(sectionUuid);

    await expect(
      rankGroupsService.releaseConfigurationById(rankGroup.id, "{}"),
    ).rejects.toThrow("Cannot create a direct released version because this form has configurable structure");
  });
});