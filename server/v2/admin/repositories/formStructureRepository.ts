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
  frmOptions,
  frmOptionSets,
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
    const optionSets = await executor
      .select()
      .from(frmOptionSets)
      .where(and(
        eq(frmOptionSets.formVersionUuid, fvUuid),
        ...(includeDeleted ? [] : [eq(frmOptionSets.isDeleted, false)]),
      ))
      .orderBy(asc(frmOptionSets.sortOrder), asc(frmOptionSets.id));
    const optionSetUuids = optionSets.map((optionSet: any) => optionSet.optionSetUuid);
    const options = optionSetUuids.length === 0
      ? []
      : await executor
        .select()
        .from(frmOptions)
        .where(and(
          inArray(frmOptions.optionSetUuid, optionSetUuids),
          ...(includeDeleted ? [] : [eq(frmOptions.isDeleted, false)]),
        ))
        .orderBy(asc(frmOptions.sortOrder), asc(frmOptions.id));

    return { sections, questions, optionSets, options };
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
      const activeSets = current.optionSets.filter((row: any) => !row.isDeleted);
      const activeOptions = current.options.filter((row: any) => !row.isDeleted);
      const sectionByUuid = new Map<string, any>(activeSections.map((row: any) => [row.sectionUuid, row]));
      const questionByUuid = new Map<string, any>(activeQuestions.map((row: any) => [row.questionUuid, row]));
      const setByUuid = new Map<string, any>(activeSets.map((row: any) => [row.optionSetUuid, row]));

      const requestedSectionUuids = new Set(input.sections.flatMap((s) => s.section_uuid ? [s.section_uuid] : []));
      const requestedQuestionUuids = new Set(input.sections.flatMap((s) =>
        s.questions.flatMap((q) => q.question_uuid ? [q.question_uuid] : [])));
      const deletedQuestionUuids = activeQuestions
        .filter((row: any) => !requestedQuestionUuids.has(row.questionUuid))
        .map((row: any) => row.questionUuid);
      if (deletedQuestionUuids.length > 0) {
        await tx.delete(frmQuestions).where(inArray(frmQuestions.questionUuid, deletedQuestionUuids));
      }
      const deletedSectionUuids = activeSections
        .filter((row: any) => !requestedSectionUuids.has(row.sectionUuid))
        .map((row: any) => row.sectionUuid);
      if (deletedSectionUuids.length > 0) {
        await tx.delete(frmSections).where(inArray(frmSections.sectionUuid, deletedSectionUuids));
      }
      for (const row of activeSections.filter((item: any) => requestedSectionUuids.has(item.sectionUuid))) {
        await tx.update(frmSections)
          .set({ sectionCode: `__replacing__${row.sectionUuid}`, updatedByUuid: auditUserUuid, updatedAt: sql`now()` })
          .where(eq(frmSections.sectionUuid, row.sectionUuid));
      }
      for (const row of activeQuestions.filter((item: any) => requestedQuestionUuids.has(item.questionUuid))) {
        await tx.update(frmQuestions)
          .set({ questionCode: `__replacing__${row.questionUuid}`, updatedByUuid: auditUserUuid, updatedAt: sql`now()` })
          .where(eq(frmQuestions.questionUuid, row.questionUuid));
      }

      // The old editor sends options nested under a question. Resolve that
      // payload into an unnamed set while accepting the new set-based form.
      const setPayloads = new Map<string, {
        uuid: string;
        name: string | null;
        lowEndLabel: string | null;
        highEndLabel: string | null;
        options: any[];
      }>();
      const questionUuidByInput = new Map<object, string>();
      for (const set of input.option_sets ?? []) {
        const uuid = set.option_set_uuid ?? uuidv4();
        setPayloads.set(uuid, {
          uuid,
          name: set.option_set_name ?? null,
          lowEndLabel: set.low_end_label ?? null,
          highEndLabel: set.high_end_label ?? null,
          options: set.options,
        });
      }
      const questionSetUuid = new Map<string, string | null>();
      for (const section of input.sections) {
        const existingSection = section.section_uuid ? sectionByUuid.get(section.section_uuid) : undefined;
        for (const question of section.questions) {
          const questionUuid = question.question_uuid ?? uuidv4();
          questionUuidByInput.set(question, questionUuid);
          let setUuid = question.option_set_uuid ?? null;
          if (!setUuid && question.options.length > 0) {
            const existingQuestion = questionByUuid.get(questionUuid);
            const existingSet = existingQuestion?.optionSetUuid ? setByUuid.get(existingQuestion.optionSetUuid) : undefined;
            setUuid = existingSet && existingSet.setName == null ? existingSet.optionSetUuid : uuidv4();
            setPayloads.set(setUuid as string, {
              uuid: setUuid as string,
              name: null,
              lowEndLabel: null,
              highEndLabel: null,
              options: question.options,
            });
          } else if (setUuid && question.options.length > 0 && !setPayloads.has(setUuid)) {
            setPayloads.set(setUuid, {
              uuid: setUuid,
              name: setByUuid.get(setUuid)?.setName ?? null,
              lowEndLabel: setByUuid.get(setUuid)?.lowEndLabel ?? null,
              highEndLabel: setByUuid.get(setUuid)?.highEndLabel ?? null,
              options: question.options,
            });
          }
          if (!setUuid) setUuid = section.default_option_set_uuid ?? existingSection?.defaultOptionSetUuid ?? null;
          questionSetUuid.set(questionUuid, setUuid);
        }
      }

      for (const payload of setPayloads.values()) {
        const existing = setByUuid.get(payload.uuid);
        const setValues = {
          setName: payload.name,
          lowEndLabel: payload.lowEndLabel,
          highEndLabel: payload.highEndLabel,
          updatedByUuid: auditUserUuid,
          updatedAt: sql`now()`,
          isDeleted: false,
        };
        if (existing) {
          await tx.update(frmOptionSets).set(setValues)
            .where(eq(frmOptionSets.optionSetUuid, payload.uuid));
        } else {
          await tx.insert(frmOptionSets).values({
            optionSetUuid: payload.uuid,
            formVersionUuid: fvUuid,
            ...setValues,
            createdByUuid: auditUserUuid,
            isSync: false,
          });
        }

        const oldOptions = activeOptions.filter((row: any) => row.optionSetUuid === payload.uuid);
        const requestedOptions = new Set(payload.options.flatMap((o) => o.option_uuid ? [o.option_uuid] : []));
        const toDelete = oldOptions.filter((o: any) => !requestedOptions.has(o.optionUuid)).map((o: any) => o.optionUuid);
        if (toDelete.length > 0) await tx.delete(frmOptions).where(inArray(frmOptions.optionUuid, toDelete));
        for (const row of oldOptions.filter((o: any) => requestedOptions.has(o.optionUuid))) {
          await tx.update(frmOptions)
            .set({ optionValue: `__replacing__${row.optionUuid}`, updatedByUuid: auditUserUuid, updatedAt: sql`now()` })
            .where(eq(frmOptions.optionUuid, row.optionUuid));
        }
        for (let optionIndex = 0; optionIndex < payload.options.length; optionIndex++) {
          const option = payload.options[optionIndex];
          const optionUuid = option.option_uuid ?? uuidv4();
          const optionValues = {
            optionLabel: option.option_label,
            optionValue: option.option_value,
            sortOrder: optionIndex,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
            isDeleted: false,
          };
          const existingOption = oldOptions.find((row: any) => row.optionUuid === optionUuid);
          if (existingOption) {
            await tx.update(frmOptions).set(optionValues).where(eq(frmOptions.optionUuid, optionUuid));
          } else {
            await tx.insert(frmOptions).values({
              optionUuid,
              optionSetUuid: payload.uuid,
              ...optionValues,
              createdByUuid: auditUserUuid,
              isSync: false,
            });
          }
        }
      }

      const retainedSections = new Map<string, any>();
      for (let sectionIndex = 0; sectionIndex < input.sections.length; sectionIndex++) {
        const section = input.sections[sectionIndex];
        const sectionUuid = section.section_uuid ?? uuidv4();
        const sectionValues = {
          sectionCode: section.section_code,
          sectionTitle: section.section_title,
          applicableVesselTypes: JSON.stringify(section.applicable_vessel_types),
          responsibleMode: section.responsible_mode,
          responsibleRoleUuid: section.responsible_role_uuid ?? null,
          responsibleDepartment: section.responsible_department ?? null,
          commentBoxRequired: section.comment_box_required,
          signatureRequired: section.signature_required,
          defaultOptionSetUuid: section.default_option_set_uuid ?? null,
          layoutPreference: section.layout_preference,
          sortOrder: sectionIndex,
          updatedByUuid: auditUserUuid,
          updatedAt: sql`now()`,
          isDeleted: false,
        };
        if (sectionByUuid.has(sectionUuid)) {
          await tx.update(frmSections).set(sectionValues).where(eq(frmSections.sectionUuid, sectionUuid));
        } else {
          await tx.insert(frmSections).values({
            sectionUuid, formVersionUuid: fvUuid, formPartUuid: partUuid, ...sectionValues,
            createdByUuid: auditUserUuid, isSync: false,
          });
        }
        retainedSections.set(sectionUuid, section);
        for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
          const question = section.questions[questionIndex];
          const questionUuid = questionUuidByInput.get(question) ?? question.question_uuid ?? uuidv4();
          const existing = questionByUuid.get(questionUuid);
          const values = {
            questionCode: question.question_code,
            questionText: question.question_text,
            responseType: question.response_type,
            isMandatory: question.is_mandatory,
            commentEnabled: question.comment_enabled,
            optionSetUuid: questionSetUuid.get(questionUuid) ?? null,
            sortOrder: questionIndex,
            updatedByUuid: auditUserUuid,
            updatedAt: sql`now()`,
            isDeleted: false,
          };
          if (existing) {
            await tx.update(frmQuestions).set({ ...values, sectionUuid }).where(eq(frmQuestions.questionUuid, questionUuid));
          } else {
            await tx.insert(frmQuestions).values({
              questionUuid, sectionUuid, ...values, createdByUuid: auditUserUuid, isSync: false,
            });
          }
        }
      }

      // Option sets are version-owned inventory, not part-owned children.
      // Never infer deletion from this part-scoped PUT: older clients omit
      // option_sets and named sets may intentionally be awaiting assignment.
      // A future version-level inventory endpoint can provide explicit deletes.

      return this.readTreeWithExecutor(tx, fvUuid, partUuid);
    };
    return executor ? replaceWithExecutor(executor) : db.transaction(replaceWithExecutor);
  }

  async copyStructure(
    sourceFvUuid: string,
    destinationFvUuid: string,
    executor?: Executor,
  ): Promise<{ sections: number; questions: number; options: number }> {
    const copyWithExecutor = async (db: Executor) => {
      const sourceRows = await db.select({
        fvUuid: admFormVersionsV2.fvUuid,
        formId: admFormVersionsV2.formId,
        status: admFormVersionsV2.status,
      }).from(admFormVersionsV2).where(and(
        eq(admFormVersionsV2.fvUuid, sourceFvUuid),
        eq(admFormVersionsV2.isDeleted, false),
      ));
      const targetRows = await db.select({
        fvUuid: admFormVersionsV2.fvUuid,
        formId: admFormVersionsV2.formId,
        status: admFormVersionsV2.status,
      }).from(admFormVersionsV2).where(and(
        eq(admFormVersionsV2.fvUuid, destinationFvUuid),
        eq(admFormVersionsV2.isDeleted, false),
      ));
      const source = sourceRows[0];
      const target = targetRows[0];
      if (!source || !target) throw new Error("Source or target form version not found");
      if (source.status !== "released" && source.status !== "draft") {
        throw new Error(`Cannot copy form structure from version ${sourceFvUuid}: source status must be draft or released (current status: ${source.status})`);
      }
      if (target.status !== "draft") {
        throw new Error(`Cannot copy form structure to version ${destinationFvUuid}: target status must be exactly draft (current status: ${target.status})`);
      }
      if (source.formId !== target.formId) {
        throw new Error("Cannot copy structure between versions belonging to different forms");
      }

      // The target guard above deliberately runs before the first insert.
      const sourceSets = await db.select().from(frmOptionSets).where(and(
        eq(frmOptionSets.formVersionUuid, sourceFvUuid),
        eq(frmOptionSets.isDeleted, false),
      )).orderBy(asc(frmOptionSets.sortOrder), asc(frmOptionSets.id));
      const sourceSetUuids = sourceSets.map((row: any) => row.optionSetUuid);
      const sourceOptions = sourceSetUuids.length === 0 ? [] : await db.select().from(frmOptions).where(and(
        inArray(frmOptions.optionSetUuid, sourceSetUuids),
        eq(frmOptions.isDeleted, false),
      )).orderBy(asc(frmOptions.sortOrder), asc(frmOptions.id));
      const sourceSections = await db.select().from(frmSections).where(and(
        eq(frmSections.formVersionUuid, sourceFvUuid),
        eq(frmSections.isDeleted, false),
      )).orderBy(asc(frmSections.sortOrder), asc(frmSections.id));
      const sourceSectionUuids = sourceSections.map((row: any) => row.sectionUuid);
      const sourceQuestions = sourceSectionUuids.length === 0 ? [] : await db.select().from(frmQuestions).where(and(
        inArray(frmQuestions.sectionUuid, sourceSectionUuids),
        eq(frmQuestions.isDeleted, false),
      )).orderBy(asc(frmQuestions.sortOrder), asc(frmQuestions.id));

      const setUuidMap = new Map<string, string>();
      for (const row of sourceSets) {
        const optionSetUuid = uuidv4();
        setUuidMap.set(row.optionSetUuid, optionSetUuid);
        await db.insert(frmOptionSets).values({
          optionSetUuid,
          formVersionUuid: destinationFvUuid,
          setName: row.setName,
          lowEndLabel: row.lowEndLabel,
          highEndLabel: row.highEndLabel,
          sortOrder: row.sortOrder,
          createdByUuid: null,
          updatedByUuid: null,
          isDeleted: false,
          isSync: false,
        });
      }
      for (const row of sourceOptions) {
        const optionSetUuid = setUuidMap.get(row.optionSetUuid);
        if (!optionSetUuid) throw new Error(`Missing copied option set for option ${row.optionUuid}`);
        await db.insert(frmOptions).values({
          optionUuid: uuidv4(),
          optionSetUuid,
          optionLabel: row.optionLabel,
          optionValue: row.optionValue,
          sortOrder: row.sortOrder,
          createdByUuid: null,
          updatedByUuid: null,
          isDeleted: false,
          isSync: false,
        });
      }

      const sectionUuidMap = new Map<string, string>();
      for (const row of sourceSections) {
        const sectionUuid = uuidv4();
        sectionUuidMap.set(row.sectionUuid, sectionUuid);
        await db.insert(frmSections).values({
          sectionUuid,
          formVersionUuid: destinationFvUuid,
          formPartUuid: row.formPartUuid,
          sectionCode: row.sectionCode,
          sectionTitle: row.sectionTitle,
          applicableVesselTypes: row.applicableVesselTypes,
          responsibleMode: row.responsibleMode,
          responsibleRoleUuid: row.responsibleRoleUuid,
          responsibleDepartment: row.responsibleDepartment,
          commentBoxRequired: row.commentBoxRequired,
          signatureRequired: row.signatureRequired,
          defaultOptionSetUuid: row.defaultOptionSetUuid ? setUuidMap.get(row.defaultOptionSetUuid) ?? null : null,
          layoutPreference: row.layoutPreference,
          sortOrder: row.sortOrder,
          createdByUuid: null,
          updatedByUuid: null,
          isDeleted: false,
          isSync: false,
        });
      }
      for (const row of sourceQuestions) {
        const sectionUuid = sectionUuidMap.get(row.sectionUuid);
        if (!sectionUuid) throw new Error(`Missing copied section for question ${row.questionUuid}`);
        await db.insert(frmQuestions).values({
          questionUuid: uuidv4(),
          sectionUuid,
          questionCode: row.questionCode,
          questionText: row.questionText,
          responseType: row.responseType,
          isMandatory: row.isMandatory,
          commentEnabled: row.commentEnabled,
          optionSetUuid: row.optionSetUuid ? setUuidMap.get(row.optionSetUuid) ?? null : null,
          sortOrder: row.sortOrder,
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
    };
    return executor ? copyWithExecutor(executor) : getDb().transaction(copyWithExecutor);
  }

  async getStructureSummary(
    formVersionUuid: string,
    executor: Executor = getDb(),
  ): Promise<{ sections: number; questions: number; optionSets: number; options: number }> {
    const sections = await executor
      .select({ sectionUuid: frmSections.sectionUuid })
      .from(frmSections)
      .where(and(
        eq(frmSections.formVersionUuid, formVersionUuid),
        eq(frmSections.isDeleted, false),
      ));
    const optionSets = await executor
      .select({ optionSetUuid: frmOptionSets.optionSetUuid })
      .from(frmOptionSets)
      .where(and(
        eq(frmOptionSets.formVersionUuid, formVersionUuid),
        eq(frmOptionSets.isDeleted, false),
      ));
    const sectionUuids = sections.map((row: { sectionUuid: string }) => row.sectionUuid);
    const optionSetUuids = optionSets.map((row: { optionSetUuid: string }) => row.optionSetUuid);
    const questions = sectionUuids.length === 0
      ? []
      : await executor
        .select({ questionUuid: frmQuestions.questionUuid })
        .from(frmQuestions)
        .where(and(
          inArray(frmQuestions.sectionUuid, sectionUuids),
          eq(frmQuestions.isDeleted, false),
        ));
    const options = optionSetUuids.length === 0
      ? []
      : await executor
        .select({ optionUuid: frmOptions.optionUuid })
        .from(frmOptions)
        .where(and(
          inArray(frmOptions.optionSetUuid, optionSetUuids),
          eq(frmOptions.isDeleted, false),
        ));
    return {
      sections: sections.length,
      questions: questions.length,
      optionSets: optionSets.length,
      options: options.length,
    };
  }

  async deleteStructure(
    formVersionUuid: string,
    executor: Executor = getDb(),
  ): Promise<void> {
    const sections = await executor
      .select({ sectionUuid: frmSections.sectionUuid })
      .from(frmSections)
      .where(eq(frmSections.formVersionUuid, formVersionUuid));
    const optionSets = await executor
      .select({ optionSetUuid: frmOptionSets.optionSetUuid })
      .from(frmOptionSets)
      .where(eq(frmOptionSets.formVersionUuid, formVersionUuid));
    const sectionUuids = sections.map((row: { sectionUuid: string }) => row.sectionUuid);
    const optionSetUuids = optionSets.map((row: { optionSetUuid: string }) => row.optionSetUuid);
    if (sectionUuids.length > 0) {
      await executor.delete(frmQuestions).where(inArray(frmQuestions.sectionUuid, sectionUuids));
      await executor.delete(frmSections).where(inArray(frmSections.sectionUuid, sectionUuids));
    }
    if (optionSetUuids.length > 0) {
      await executor.delete(frmOptions).where(inArray(frmOptions.optionSetUuid, optionSetUuids));
      await executor.delete(frmOptionSets).where(inArray(frmOptionSets.optionSetUuid, optionSetUuids));
    }
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

  async validateOptionSetOwnership(
    targetVersionUuid: string,
    input: FormStructureInput,
    current: Awaited<ReturnType<FormStructureRepository["readTree"]>>,
    executor: Executor = getDb(),
  ): Promise<void> {
    const currentSets = new Map<string, any>(
      (current.optionSets as any[]).map((row: any) => [row.optionSetUuid, row]),
    );
    const requested = new Set<string>([
      ...(input.option_sets ?? []).flatMap((set) => set.option_set_uuid ? [set.option_set_uuid] : []),
      ...input.sections.flatMap((section) => [
        ...(section.default_option_set_uuid ? [section.default_option_set_uuid] : []),
        ...section.questions.flatMap((question) => question.option_set_uuid ? [question.option_set_uuid] : []),
      ]),
    ]);
    const unknown = [...requested].filter((uuid) => !currentSets.has(uuid));
    if (unknown.length === 0) return;
    const rows = await executor.select({
      optionSetUuid: frmOptionSets.optionSetUuid,
      formVersionUuid: frmOptionSets.formVersionUuid,
    }).from(frmOptionSets).where(inArray(frmOptionSets.optionSetUuid, unknown));
    if (rows.length > 0) {
      const foreign = rows.filter((row: any) => !targetVersionUuid || row.formVersionUuid !== targetVersionUuid);
      if (foreign.length > 0) {
        throw new Error(`Option set does not belong to this form version: ${foreign.map((row: any) => row.optionSetUuid).join(", ")}`);
      }
    }
  }
}

export const formStructureRepository = new FormStructureRepository();