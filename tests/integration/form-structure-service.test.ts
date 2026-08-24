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
  frmQuestionOptions,
  frmQuestions,
  frmSections,
  type FormStructureInput,
} from "@shared/v2/forms-engine/schema";
import { formsService } from "@server/v2/admin/services/formsService";
import { rankGroupsService } from "@server/v2/admin/services/rankGroupsService";
import {
  FormStructureServiceError,
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
    await db.delete(frmQuestionOptions).where(inArray(frmQuestionOptions.questionUuid, questionUuids));
    await db.delete(frmQuestions).where(inArray(frmQuestions.questionUuid, questionUuids));
  }
  if (sectionUuids.length > 0) {
    await db.delete(frmSections).where(inArray(frmSections.sectionUuid, sectionUuids));
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

    const savedSectionUuid = saved.sections[0].section_uuid;
    const savedQuestionUuid = saved.sections[0].questions[0].question_uuid;
    const savedOptionUuid = saved.sections[0].questions[0].options[0].option_uuid;

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

    await formStructureService.replaceStructure(copiedDraft.fvUuid, partUuid, { sections: [] }, null);
    const emptiedDraft = await formStructureService.getStructure(copiedDraft.fvUuid, partUuid);
    expect(emptiedDraft.sections).toEqual([]);
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