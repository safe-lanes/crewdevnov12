import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  admFormVersionsV2,
  admFormsV2,
  admRoleMasterAc,
} from "../../../../shared/v2/admin/schema";
import {
  frmFormParts,
  frmQuestionOptions,
  frmQuestions,
  frmSections,
  type FormStructureInput,
} from "../../../../shared/v2/forms-engine/schema";
import { masterVesselTypes } from "../../../../shared/schema";

type Executor = any;
type ReplaceTreeValidator = (
  current: Awaited<ReturnType<FormStructureRepository["readTree"]>>,
  executor: Executor,
) => Promise<void> | void;

export type FormStructureContext = {
  version: {
    id: number;
    fvUuid: string;
    formId: number;
    status: string;
  };
  formUuid: string;
  part: typeof frmFormParts.$inferSelect;
};

export class FormStructureRepository {
  private async findContextWithExecutor(
    executor: Executor,
    fvUuid: string,
    partUuid: string,
  ): Promise<FormStructureContext | undefined> {
    const versions = await executor
      .select({
        id: admFormVersionsV2.id,
        fvUuid: admFormVersionsV2.fvUuid,
        formId: admFormVersionsV2.formId,
        status: admFormVersionsV2.status,
        formUuid: admFormsV2.formUuid,
      })
      .from(admFormVersionsV2)
      .innerJoin(admFormsV2, eq(admFormsV2.id, admFormVersionsV2.formId))
      .where(and(
        eq(admFormVersionsV2.fvUuid, fvUuid),
        eq(admFormVersionsV2.isDeleted, false),
        eq(admFormsV2.isDeleted, false),
      ));
    if (versions.length === 0) return undefined;

    const parts = await executor
      .select()
      .from(frmFormParts)
      .where(and(
        eq(frmFormParts.formPartUuid, partUuid),
        eq(frmFormParts.isDeleted, false),
      ));
    if (parts.length === 0) return undefined;

    return {
      version: versions[0],
      formUuid: versions[0].formUuid,
      part: parts[0],
    };
  }

  async findContext(fvUuid: string, partUuid: string): Promise<FormStructureContext | undefined> {
    return this.findContextWithExecutor(getDb(), fvUuid, partUuid);
  }

  private async readTreeWithExecutor(
    executor: Executor,
    fvUuid: string,
    partUuid: string,
    includeDeleted = false,
  ) {
    const sectionConditions = [
      eq(frmSections.formVersionUuid, fvUuid),
      eq(frmSections.formPartUuid, partUuid),
    ];
    if (!includeDeleted) sectionConditions.push(eq(frmSections.isDeleted, false));
    const sections = await executor
      .select()
      .from(frmSections)
      .where(and(...sectionConditions))
      .orderBy(asc(frmSections.sortOrder), asc(frmSections.id));

    const sectionUuids = sections.map((section: any) => section.sectionUuid);
    const questions = sectionUuids.length === 0
      ? []
      : await executor
        .select()
        .from(frmQuestions)
        .where(and(
          inArray(frmQuestions.sectionUuid, sectionUuids),
          ...(includeDeleted ? [] : [eq(frmQuestions.isDeleted, false)]),
        ))
        .orderBy(asc(frmQuestions.sortOrder), asc(frmQuestions.id));

    const questionUuids = questions.map((question: any) => question.questionUuid);
    const options = questionUuids.length === 0
      ? []
      : await executor
        .select()
        .from(frmQuestionOptions)
        .where(and(
          inArray(frmQuestionOptions.questionUuid, questionUuids),
          ...(includeDeleted ? [] : [eq(frmQuestionOptions.isDeleted, false)]),
        ))
        .orderBy(asc(frmQuestionOptions.sortOrder), asc(frmQuestionOptions.id));

    return { sections, questions, options };
  }

  async readTree(fvUuid: string, partUuid: string) {
    return this.readTreeWithExecutor(getDb(), fvUuid, partUuid);
  }

  async replaceTree(
    fvUuid: string,
    partUuid: string,
    input: FormStructureInput,
    auditUserUuid: string | null,
    validate?: ReplaceTreeValidator,
    executor?: Executor,
  ) {
    const db = getDb();
    const replaceWithExecutor = async (tx: Executor) => {
      const context = await this.findContextWithExecutor(tx, fvUuid, partUuid);
      if (!context) throw new Error("Form version or form part not found");
      if (context.version.status !== "draft") {
        throw new Error(`Cannot modify form structure for version ${fvUuid}: only draft versions are editable (current status: ${context.version.status})`);
      }
      if (context.formUuid !== context.part.formUuid) {
        throw new Error(`Form part ${partUuid} does not belong to the same form as version ${fvUuid}`);
      }

      const current = await this.readTreeWithExecutor(tx, fvUuid, partUuid, true);
      await validate?.(current, tx);
      const activeSections = current.sections.filter((row: any) => !row.isDeleted);
      const activeQuestions = current.questions.filter((row: any) => !row.isDeleted);
      const activeOptions = current.options.filter((row: any) => !row.isDeleted);

      const requestedSectionUuids = new Set(
        input.sections.flatMap((section) => section.section_uuid ? [section.section_uuid] : []),
      );
      const requestedQuestionUuids = new Set(
        input.sections.flatMap((section) =>
          section.questions.flatMap((question) => question.question_uuid ? [question.question_uuid] : []),
        ),
      );
      const requestedOptionUuids = new Set(
        input.sections.flatMap((section) =>
          section.questions.flatMap((question) =>
            question.options.flatMap((option) => option.option_uuid ? [option.option_uuid] : []),
          ),
        ),
      );

      const deletedOptionUuids = [
        ...current.options.filter((row: any) => row.isDeleted).map((row: any) => row.optionUuid),
        ...activeOptions
          .filter((row: any) => !requestedOptionUuids.has(row.optionUuid))
          .map((row: any) => row.optionUuid),
      ];
      if (deletedOptionUuids.length > 0) {
        await tx.delete(frmQuestionOptions)
          .where(inArray(frmQuestionOptions.optionUuid, deletedOptionUuids));
      }

      const deletedQuestionUuids = [
        ...current.questions.filter((row: any) => row.isDeleted).map((row: any) => row.questionUuid),
        ...activeQuestions
          .filter((row: any) => !requestedQuestionUuids.has(row.questionUuid))
          .map((row: any) => row.questionUuid),
      ];
      if (deletedQuestionUuids.length > 0) {
        await tx.delete(frmQuestions)
          .where(inArray(frmQuestions.questionUuid, deletedQuestionUuids));
      }

      const deletedSectionUuids = [
        ...current.sections.filter((row: any) => row.isDeleted).map((row: any) => row.sectionUuid),
        ...activeSections
          .filter((row: any) => !requestedSectionUuids.has(row.sectionUuid))
          .map((row: any) => row.sectionUuid),
      ];
      if (deletedSectionUuids.length > 0) {
        await tx.delete(frmSections)
          .where(inArray(frmSections.sectionUuid, deletedSectionUuids));
      }

      const retainedSections = activeSections.filter((row: any) => requestedSectionUuids.has(row.sectionUuid));
      for (const row of retainedSections) {
        await tx.update(frmSections)
          .set({
            sectionCode: `__replacing__${row.sectionUuid}`,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
          })
          .where(eq(frmSections.sectionUuid, row.sectionUuid));
      }
      const retainedQuestions = activeQuestions.filter((row: any) => requestedQuestionUuids.has(row.questionUuid));
      for (const row of retainedQuestions) {
        await tx.update(frmQuestions)
          .set({
            questionCode: `__replacing__${row.questionUuid}`,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
          })
          .where(eq(frmQuestions.questionUuid, row.questionUuid));
      }
      const retainedOptions = activeOptions.filter((row: any) => requestedOptionUuids.has(row.optionUuid));
      for (const row of retainedOptions) {
        await tx.update(frmQuestionOptions)
          .set({
            optionValue: `__replacing__${row.optionUuid}`,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
          })
          .where(eq(frmQuestionOptions.optionUuid, row.optionUuid));
      }

      const existingSectionUuids = new Set(activeSections.map((row: any) => row.sectionUuid));
      const existingQuestionUuids = new Set(activeQuestions.map((row: any) => row.questionUuid));
      const existingOptionUuids = new Set(activeOptions.map((row: any) => row.optionUuid));
      const sectionByUuid = new Map(activeSections.map((row: any) => [row.sectionUuid, row]));
      const questionByUuid = new Map(activeQuestions.map((row: any) => [row.questionUuid, row]));
      const optionByUuid = new Map(activeOptions.map((row: any) => [row.optionUuid, row]));

      for (let sectionIndex = 0; sectionIndex < input.sections.length; sectionIndex++) {
        const section = input.sections[sectionIndex];
        const sectionUuid = section.section_uuid ?? uuidv4();
        const sectionExisting = sectionByUuid.get(sectionUuid);
        const sectionValues = {
          sectionCode: section.section_code,
          sectionTitle: section.section_title,
          applicableVesselTypes: JSON.stringify(section.applicable_vessel_types),
          responsibleMode: section.responsible_mode,
          responsibleRoleUuid: section.responsible_role_uuid ?? null,
          responsibleDepartment: section.responsible_department ?? null,
          commentBoxRequired: section.comment_box_required,
          signatureRequired: section.signature_required,
          sortOrder: sectionIndex,
          updatedByUuid: auditUserUuid,
          updatedAt: sql`now()`,
          isDeleted: false,
        };
        if (sectionExisting) {
          await tx.update(frmSections)
            .set(sectionValues)
            .where(eq(frmSections.sectionUuid, sectionUuid));
        } else {
          await tx.insert(frmSections).values({
            sectionUuid,
            formVersionUuid: fvUuid,
            formPartUuid: partUuid,
            ...sectionValues,
            createdByUuid: auditUserUuid,
            isSync: false,
          });
        }

        for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
          const question = section.questions[questionIndex];
          const questionUuid = question.question_uuid ?? uuidv4();
          const questionExisting = questionByUuid.get(questionUuid);
          const questionValues = {
            questionCode: question.question_code,
            questionText: question.question_text,
            responseType: question.response_type,
            isMandatory: question.is_mandatory,
            commentEnabled: question.comment_enabled,
            sortOrder: questionIndex,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
            isDeleted: false,
          };
          if (questionExisting) {
            await tx.update(frmQuestions)
              .set({ ...questionValues, sectionUuid })
              .where(eq(frmQuestions.questionUuid, questionUuid));
          } else {
            await tx.insert(frmQuestions).values({
              questionUuid,
              sectionUuid,
              ...questionValues,
              createdByUuid: auditUserUuid,
              isSync: false,
            });
          }

          for (let optionIndex = 0; optionIndex < question.options.length; optionIndex++) {
            const option = question.options[optionIndex];
            const optionUuid = option.option_uuid ?? uuidv4();
            const optionExisting = optionByUuid.get(optionUuid);
            const optionValues = {
              optionLabel: option.option_label,
              optionValue: option.option_value,
              sortOrder: optionIndex,
              updatedByUuid: auditUserUuid,
              updatedAt: sql`now()`,
              isDeleted: false,
            };
            if (optionExisting) {
              await tx.update(frmQuestionOptions)
                .set({ ...optionValues, questionUuid })
                .where(eq(frmQuestionOptions.optionUuid, optionUuid));
            } else {
              await tx.insert(frmQuestionOptions).values({
                optionUuid,
                questionUuid,
                ...optionValues,
                createdByUuid: auditUserUuid,
                isSync: false,
              });
            }
          }
        }
      }

      return this.readTreeWithExecutor(tx, fvUuid, partUuid);
    };
    return executor ? replaceWithExecutor(executor) : db.transaction(replaceWithExecutor);
  }

  async copyStructure(
    sourceFvUuid: string,
    destinationFvUuid: string,
    executor?: Executor,
  ): Promise<{ sections: number; questions: number; options: number }> {
    const db = executor ?? getDb();
    const sourceRows = await db
      .select({
        fvUuid: admFormVersionsV2.fvUuid,
        formId: admFormVersionsV2.formId,
        status: admFormVersionsV2.status,
      })
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.fvUuid, sourceFvUuid),
        eq(admFormVersionsV2.isDeleted, false),
      ));
    const destinationRows = await db
      .select({
        fvUuid: admFormVersionsV2.fvUuid,
        formId: admFormVersionsV2.formId,
        status: admFormVersionsV2.status,
      })
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.fvUuid, destinationFvUuid),
        eq(admFormVersionsV2.isDeleted, false),
      ));
    const source = sourceRows[0];
    const destination = destinationRows[0];
    if (!source || !destination) throw new Error("Source or destination form version not found");
    if (source.status !== "released") throw new Error("Structure copy source must be a released form version");
    if (destination.status !== "draft") throw new Error("Structure copy destination must be a draft form version");
    if (source.formId !== destination.formId) {
      throw new Error("Cannot copy structure between versions belonging to different forms");
    }

    const sourceSections = await db
      .select()
      .from(frmSections)
      .where(and(
        eq(frmSections.formVersionUuid, sourceFvUuid),
        eq(frmSections.isDeleted, false),
      ))
      .orderBy(asc(frmSections.sortOrder), asc(frmSections.id));
    const sourceSectionUuids = sourceSections.map((row: any) => row.sectionUuid);
    const sourceQuestions = sourceSectionUuids.length === 0
      ? []
      : await db.select().from(frmQuestions)
        .where(and(inArray(frmQuestions.sectionUuid, sourceSectionUuids), eq(frmQuestions.isDeleted, false)))
        .orderBy(asc(frmQuestions.sortOrder), asc(frmQuestions.id));
    const sourceQuestionUuids = sourceQuestions.map((row: any) => row.questionUuid);
    const sourceOptions = sourceQuestionUuids.length === 0
      ? []
      : await db.select().from(frmQuestionOptions)
        .where(and(inArray(frmQuestionOptions.questionUuid, sourceQuestionUuids), eq(frmQuestionOptions.isDeleted, false)))
        .orderBy(asc(frmQuestionOptions.sortOrder), asc(frmQuestionOptions.id));

    if (sourceSections.length === 0) return { sections: 0, questions: 0, options: 0 };

    const sectionUuidMap = new Map<string, string>();
    for (const sourceSection of sourceSections) {
      const newSectionUuid = uuidv4();
      sectionUuidMap.set(sourceSection.sectionUuid, newSectionUuid);
      await db.insert(frmSections).values({
        sectionUuid: newSectionUuid,
        formVersionUuid: destinationFvUuid,
        formPartUuid: sourceSection.formPartUuid,
        sectionCode: sourceSection.sectionCode,
        sectionTitle: sourceSection.sectionTitle,
        applicableVesselTypes: sourceSection.applicableVesselTypes,
        responsibleMode: sourceSection.responsibleMode,
        responsibleRoleUuid: sourceSection.responsibleRoleUuid,
        responsibleDepartment: sourceSection.responsibleDepartment,
        commentBoxRequired: sourceSection.commentBoxRequired,
        signatureRequired: sourceSection.signatureRequired,
        sortOrder: sourceSection.sortOrder,
        createdByUuid: null,
        updatedByUuid: null,
        isDeleted: false,
        isSync: false,
      });
    }

    const questionUuidMap = new Map<string, string>();
    for (const sourceQuestion of sourceQuestions) {
      const newSectionUuid = sectionUuidMap.get(sourceQuestion.sectionUuid);
      if (!newSectionUuid) throw new Error(`Missing copied section for question ${sourceQuestion.questionUuid}`);
      const newQuestionUuid = uuidv4();
      questionUuidMap.set(sourceQuestion.questionUuid, newQuestionUuid);
      await db.insert(frmQuestions).values({
        questionUuid: newQuestionUuid,
        sectionUuid: newSectionUuid,
        questionCode: sourceQuestion.questionCode,
        questionText: sourceQuestion.questionText,
        responseType: sourceQuestion.responseType,
        isMandatory: sourceQuestion.isMandatory,
        commentEnabled: sourceQuestion.commentEnabled,
        sortOrder: sourceQuestion.sortOrder,
        createdByUuid: null,
        updatedByUuid: null,
        isDeleted: false,
        isSync: false,
      });
    }

    for (const sourceOption of sourceOptions) {
      const newQuestionUuid = questionUuidMap.get(sourceOption.questionUuid);
      if (!newQuestionUuid) throw new Error(`Missing copied question for option ${sourceOption.optionUuid}`);
      await db.insert(frmQuestionOptions).values({
        optionUuid: uuidv4(),
        questionUuid: newQuestionUuid,
        optionLabel: sourceOption.optionLabel,
        optionValue: sourceOption.optionValue,
        sortOrder: sourceOption.sortOrder,
        createdByUuid: null,
        updatedByUuid: null,
        isDeleted: false,
        isSync: false,
      });
    }

    return {
      sections: sourceSections.length,
      questions: sourceQuestions.length,
      options: sourceOptions.length,
    };
  }

  async hasStructureForForm(formUuid: string, executor: Executor = getDb()): Promise<boolean> {
    const rows = await executor
      .select({ sectionUuid: frmSections.sectionUuid })
      .from(frmSections)
      .innerJoin(frmFormParts, eq(frmFormParts.formPartUuid, frmSections.formPartUuid))
      .where(and(
        eq(frmFormParts.formUuid, formUuid),
        eq(frmFormParts.isDeleted, false),
        eq(frmSections.isDeleted, false),
      ))
      .limit(1);
    return rows.length > 0;
  }

  async validateReferenceData(
    input: FormStructureInput,
    executor: Executor = getDb(),
  ): Promise<void> {
    const vesselTypeUuids = [
      ...new Set(input.sections.flatMap((section) => section.applicable_vessel_types)),
    ];
    if (vesselTypeUuids.length > 0) {
      const vesselTypes = await executor
        .select({ vtUuid: masterVesselTypes.vtUuid })
        .from(masterVesselTypes)
        .where(and(
          eq(masterVesselTypes.isDeleted, false),
          eq(masterVesselTypes.isActive, true),
          inArray(masterVesselTypes.vtUuid, vesselTypeUuids),
        ));
      const known = new Set(vesselTypes.map((row: any) => row.vtUuid));
      const unknown = vesselTypeUuids.filter((uuid) => !known.has(uuid));
      if (unknown.length > 0) throw new Error(`Unknown vessel type UUID(s): ${unknown.join(", ")}`);
    }

    const roleUuids = [
      ...new Set(input.sections
        .filter((section) => section.responsible_mode === "role" && section.responsible_role_uuid)
        .map((section) => section.responsible_role_uuid as string)),
    ];
    if (roleUuids.length > 0) {
      const roles = await executor
        .select({ ruid: admRoleMasterAc.ruid })
        .from(admRoleMasterAc)
        .where(and(
          eq(admRoleMasterAc.isDeleted, false),
          eq(admRoleMasterAc.isActive, true),
          inArray(admRoleMasterAc.ruid, roleUuids),
        ));
      const known = new Set(roles.map((row: any) => row.ruid));
      const unknown = roleUuids.filter((uuid) => !known.has(uuid));
      if (unknown.length > 0) throw new Error(`Unknown responsible role UUID(s): ${unknown.join(", ")}`);
    }
  }
}

export const formStructureRepository = new FormStructureRepository();