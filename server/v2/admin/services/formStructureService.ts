import {
  formStructureInputSchema,
  type FormStructureInput,
  type FormStructureOptionInput,
  type FormStructureOptionSetInput,
  type FormStructureQuestionInput,
  type FormStructureSectionInput,
} from "../../../../shared/v2/forms-engine/schema";
import { getDb } from "../../db";
import { formStructureRepository } from "../repositories/formStructureRepository";

/*
 * Keep direct service callers compatible with the pre-option-set contract.
 * HTTP callers are already parsed by the controller; integration callers are
 * normalized here so defaults such as option_sets and layout_preference exist.
 */
function normalizeStructureInput(input: FormStructureInput): FormStructureInput {
  return formStructureInputSchema.parse(input);
}

export class FormStructureServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "FormStructureServiceError";
  }
}

export async function copyFormVersionStructure(
  sourceFormVersionUuid: string,
  targetFormVersionUuid: string,
  executor?: any,
) {
  return formStructureRepository.copyStructure(sourceFormVersionUuid, targetFormVersionUuid, executor);
}

function parseApplicableVesselTypes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function treeResponse(
  fvUuid: string,
  partUuid: string,
  tree: Awaited<ReturnType<typeof formStructureRepository.readTree>>,
) {
  const questionsBySection = new Map<string, any[]>();
  for (const question of tree.questions as any[]) {
    const questions = questionsBySection.get(question.sectionUuid) ?? [];
    questions.push(question);
    questionsBySection.set(question.sectionUuid, questions);
  }

  const optionsBySet = new Map<string, any[]>();
  for (const option of tree.options as any[]) {
    const options = optionsBySet.get(option.optionSetUuid) ?? [];
    options.push(option);
    optionsBySet.set(option.optionSetUuid, options);
  }
  const setsByUuid = new Map((tree.optionSets as any[]).map((set) => [set.optionSetUuid, set]));
  const mapOptions = (optionSetUuid: string | null | undefined) =>
    (optionSetUuid ? optionsBySet.get(optionSetUuid) ?? [] : []).map((option) => ({
      option_uuid: option.optionUuid,
      option_label: option.optionLabel,
      option_value: option.optionValue,
      sort_order: option.sortOrder,
    }));

  return {
    form_version_uuid: fvUuid,
    form_part_uuid: partUuid,
    option_sets: (tree.optionSets as any[]).map((set) => ({
      option_set_uuid: set.optionSetUuid,
      option_set_name: set.setName,
      low_end_label: set.lowEndLabel,
      high_end_label: set.highEndLabel,
      sort_order: set.sortOrder,
      options: mapOptions(set.optionSetUuid),
    })),
    sections: (tree.sections as any[]).map((section) => ({
      section_uuid: section.sectionUuid,
      section_code: section.sectionCode,
      section_title: section.sectionTitle,
      applicable_vessel_types: parseApplicableVesselTypes(section.applicableVesselTypes),
      responsible_mode: section.responsibleMode,
      responsible_role_uuid: section.responsibleRoleUuid,
      responsible_department: section.responsibleDepartment,
      comment_box_required: section.commentBoxRequired,
      signature_officer_required: section.signatureOfficerRequired,
      signature_seafarer_required: section.signatureSeafarerRequired,
      default_option_set_uuid: section.defaultOptionSetUuid,
      layout_preference: section.layoutPreference,
      effectiveLayout: resolveEffectiveLayout(
        section.layoutPreference,
        questionsBySection.get(section.sectionUuid) ?? [],
        section.defaultOptionSetUuid,
        setsByUuid,
        optionsBySet,
      ),
      sort_order: section.sortOrder,
      questions: (questionsBySection.get(section.sectionUuid) ?? []).map((question) => ({
        ...(() => {
          const optionSet = setsByUuid.get(question.optionSetUuid ?? section.defaultOptionSetUuid);
          return {
            low_end_label: optionSet?.lowEndLabel ?? null,
            high_end_label: optionSet?.highEndLabel ?? null,
          };
        })(),
        question_uuid: question.questionUuid,
        question_code: question.questionCode,
        question_text: question.questionText,
        response_type: question.responseType,
        is_mandatory: question.isMandatory,
        comment_enabled: question.commentEnabled,
        option_set_uuid: question.optionSetUuid,
        sort_order: question.sortOrder,
        options: mapOptions(question.optionSetUuid ?? section.defaultOptionSetUuid),
      })),
    })),
  };
}

export function resolveEffectiveLayout(
  preference: string,
  questions: any[],
  defaultOptionSetUuid: string | null,
  setsByUuid: Map<string, any>,
  optionsBySet: Map<string, any[]>,
): "list" | "matrix" {
  if (preference === "list" || questions.length === 0) return "list";
  const setUuids = questions.map((question) => question.optionSetUuid ?? defaultOptionSetUuid);
  if (
    setUuids.some((uuid) => !uuid) ||
    new Set(setUuids).size !== 1 ||
    questions.some((question) => question.responseType !== "single_select" && question.responseType !== "multi_select")
  ) return "list";
  const setUuid = setUuids[0] as string;
  if (!setsByUuid.has(setUuid)) return "list";
  const options = optionsBySet.get(setUuid) ?? [];
  if (options.length === 0 || options.length > 12) return "list";
  if (options.length <= 6) return "matrix";
  return options.every((option) => String(option.optionLabel).length <= 4) ? "matrix" : "list";
}

function ensureUnique(values: string[], description: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new FormStructureServiceError(`Duplicate ${description}: ${value}`);
    }
    seen.add(value);
  }
}

function validateIdentities(
  input: FormStructureInput,
  current: Awaited<ReturnType<typeof formStructureRepository.readTree>>,
): void {
  const existingSections = new Map(
    (current.sections as any[]).filter((row) => !row.isDeleted).map((row) => [row.sectionUuid, row]),
  );
  const existingQuestions = new Map(
    (current.questions as any[]).filter((row) => !row.isDeleted).map((row) => [row.questionUuid, row]),
  );
  const existingOptions = new Map(
    (current.options as any[]).filter((row) => !row.isDeleted).map((row) => [row.optionUuid, row]),
  );
  const existingSets = new Map(
    (current.optionSets as any[]).filter((row) => !row.isDeleted).map((row) => [row.optionSetUuid, row]),
  );

  const sectionUuids = input.sections.flatMap((section) => section.section_uuid ? [section.section_uuid] : []);
  const questionUuids = input.sections.flatMap((section) =>
    section.questions.flatMap((question) => question.question_uuid ? [question.question_uuid] : []),
  );
  const optionSets = input.option_sets ?? [];
  const setUuids = optionSets.flatMap((set) => set.option_set_uuid ? [set.option_set_uuid] : []);
  const optionDefinitions = new Map<string, {
    optionLabel: string;
    optionValue: string;
    optionSetUuid?: string;
  }>();
  const recordOption = (
    option: { option_uuid?: string; option_label: string; option_value: string },
    optionSetUuid?: string,
  ) => {
    if (!option.option_uuid) return;
    const prior = optionDefinitions.get(option.option_uuid);
    if (prior && (
      prior.optionLabel !== option.option_label ||
      prior.optionValue !== option.option_value ||
      (prior.optionSetUuid && optionSetUuid && prior.optionSetUuid !== optionSetUuid)
    )) {
      throw new FormStructureServiceError(
        `Conflicting definitions for option_uuid: ${option.option_uuid}`,
      );
    }
    optionDefinitions.set(option.option_uuid, {
      optionLabel: option.option_label,
      optionValue: option.option_value,
      optionSetUuid: prior?.optionSetUuid ?? optionSetUuid,
    });
  };
  for (const set of optionSets) {
    for (const option of set.options) recordOption(option, set.option_set_uuid);
  }
  for (const section of input.sections) {
    for (const question of section.questions) {
      const existingQuestionSet = question.question_uuid
        ? existingQuestions.get(question.question_uuid)?.optionSetUuid
        : undefined;
      const resolvedSetUuid = question.option_set_uuid ??
        section.default_option_set_uuid ??
        existingQuestionSet;
      for (const option of question.options) recordOption(option, resolvedSetUuid);
    }
  }
  const optionUuids = [...optionDefinitions.keys()];
  ensureUnique(sectionUuids, "section_uuid");
  ensureUnique(questionUuids, "question_uuid");

  ensureUnique(setUuids, "option_set_uuid");
  const allIdentities = [...sectionUuids, ...questionUuids, ...setUuids, ...optionUuids];
  ensureUnique(allIdentities, "structure row UUID");

  for (const set of optionSets) {
    for (const option of set.options) {
      if (!option.option_uuid) continue;
      const existing = existingOptions.get(option.option_uuid);
      if (!existing) throw new FormStructureServiceError(`option_uuid does not belong to this draft: ${option.option_uuid}`);
      if (set.option_set_uuid && existing.optionSetUuid !== set.option_set_uuid) {
        throw new FormStructureServiceError(`option_uuid ${option.option_uuid} belongs to a different option set`);
      }
    }
  }
  const availableSets = new Set([...existingSets.keys(), ...setUuids]);

  for (const section of input.sections) {
    if (section.section_uuid && !existingSections.has(section.section_uuid)) {
      throw new FormStructureServiceError(`section_uuid does not belong to this draft: ${section.section_uuid}`);
    }
    if (section.default_option_set_uuid && !availableSets.has(section.default_option_set_uuid)) {
      throw new FormStructureServiceError(`default_option_set_uuid does not belong to this form version: ${section.default_option_set_uuid}`);
    }
    for (const question of section.questions) {
      if (question.option_set_uuid && !availableSets.has(question.option_set_uuid)) {
        throw new FormStructureServiceError(`option_set_uuid does not belong to this form version: ${question.option_set_uuid}`);
      }
      if (question.question_uuid) {
        const existing = existingQuestions.get(question.question_uuid);
        if (!existing) {
          throw new FormStructureServiceError(`question_uuid does not belong to this draft: ${question.question_uuid}`);
        }
        if (existing.sectionUuid !== section.section_uuid) {
          throw new FormStructureServiceError(`question_uuid ${question.question_uuid} belongs to a different section`);
        }
      }
      for (const option of question.options) {
        if (option.option_uuid) {
          const existing = existingOptions.get(option.option_uuid);
          if (!existing) {
            throw new FormStructureServiceError(`option_uuid does not belong to this draft: ${option.option_uuid}`);
          }
          const expectedSetUuid = question.option_set_uuid ??
            (question.question_uuid ? existingQuestions.get(question.question_uuid)?.optionSetUuid : undefined);
          if (expectedSetUuid && existing.optionSetUuid !== expectedSetUuid) {
            throw new FormStructureServiceError(`option_uuid ${option.option_uuid} belongs to a different option set`);
          }
        }
      }
    }
  }
}

function validateBusinessUniqueness(input: FormStructureInput): void {
  ensureUnique(input.sections.map((section) => section.section_code), "section_code");
  ensureUnique(
    (input.option_sets ?? []).flatMap((set) => set.option_set_name ? [set.option_set_name] : []),
    "option_set_name",
  );
  for (const set of input.option_sets ?? []) {
    ensureUnique(set.options.map((option) => option.option_value), `option_value in option set ${set.option_set_name ?? "(unnamed)"}`);
  }
  for (const section of input.sections) {
    ensureUnique(
      section.questions.map((question) => question.question_code),
      `question_code in section ${section.section_code}`,
    );
    for (const question of section.questions) {
      ensureUnique(
        question.options.map((option) => option.option_value),
        `option_value in question ${question.question_code}`,
      );
    }
  }
}

function validateReplacement(input: FormStructureInput, fvUuid: string) {
  return async (
    current: Awaited<ReturnType<typeof formStructureRepository.readTree>>,
    tx: any,
  ): Promise<void> => {
    validateIdentities(input, current);
    validateBusinessUniqueness(input);
    await formStructureRepository.validateReferenceData(input, tx);
    await formStructureRepository.validateOptionSetOwnership(fvUuid, input, current, tx);
  };
}

function mapReplacementError(error: any): never {
  if (error?.message?.includes("only draft versions are editable")) {
    throw new FormStructureServiceError(error.message, 409);
  }
  if (error?.message?.includes("same form")) {
    throw new FormStructureServiceError(error.message, 400);
  }
  if (
    error?.message?.includes("Unknown vessel type UUID") ||
    error?.message?.includes("Unknown responsible role UUID") ||
    error?.message?.includes("Option set does not belong to this form version")
  ) {
    throw new FormStructureServiceError(error.message, 400);
  }
  throw error;
}

export const formStructureService = {
  async getStructure(fvUuid: string, partUuid: string) {
    const context = await formStructureRepository.findContext(fvUuid, partUuid);
    if (!context) throw new FormStructureServiceError("Form version or form part not found", 404);
    if (context.formUuid !== context.part.formUuid) {
      throw new FormStructureServiceError(`Form part ${partUuid} does not belong to the same form as version ${fvUuid}`);
    }
    const tree = await formStructureRepository.readTree(fvUuid, partUuid);
    return treeResponse(fvUuid, partUuid, tree);
  },

  async replaceStructure(
    fvUuid: string,
    partUuid: string,
    input: FormStructureInput,
    auditUserUuid: string | null,
  ) {
    input = normalizeStructureInput(input);
    const context = await formStructureRepository.findContext(fvUuid, partUuid);
    if (!context) throw new FormStructureServiceError("Form version or form part not found", 404);
    if (context.formUuid !== context.part.formUuid) {
      throw new FormStructureServiceError(`Form part ${partUuid} does not belong to the same form as version ${fvUuid}`);
    }
    if (context.version.status !== "draft") {
      throw new FormStructureServiceError(
        `Cannot modify form structure for version ${fvUuid}: only draft versions are editable (current status: ${context.version.status})`,
        409,
      );
    }

    try {
      const tree = await formStructureRepository.replaceTree(
        fvUuid,
        partUuid,
        input,
        auditUserUuid,
        validateReplacement(input, fvUuid),
      );
      return treeResponse(fvUuid, partUuid, tree);
    } catch (error: any) {
      return mapReplacementError(error);
    }
  },

  async replaceStructures(
    fvUuid: string,
    parts: Array<{ partUuid: string; structure: FormStructureInput }>,
    auditUserUuid: string | null,
  ) {
    const seenParts = new Set<string>();
    for (const { partUuid } of parts) {
      if (seenParts.has(partUuid)) {
        throw new FormStructureServiceError(`Duplicate form_part_uuid: ${partUuid}`);
      }
      seenParts.add(partUuid);
    }

    try {
      const responses = await getDb().transaction(async (tx: any) => {
        const saved = [];
        for (const { partUuid, structure } of parts) {
          const normalizedStructure = normalizeStructureInput(structure);
          const tree = await formStructureRepository.replaceTree(
            fvUuid,
            partUuid,
            normalizedStructure,
            auditUserUuid,
            validateReplacement(normalizedStructure, fvUuid),
            tx,
          );
          saved.push(treeResponse(fvUuid, partUuid, tree));
        }
        return saved;
      });
      return { form_version_uuid: fvUuid, parts: responses };
    } catch (error: any) {
      return mapReplacementError(error);
    }
  },

  async copyStructure(
    sourceFvUuid: string | null | undefined,
    destinationFvUuid: string,
    executor?: any,
  ) {
    if (!sourceFvUuid) return { sections: 0, questions: 0, options: 0 };
    return formStructureRepository.copyStructure(sourceFvUuid, destinationFvUuid, executor);
  },

  async copyFormVersionStructure(
    sourceFormVersionUuid: string,
    targetFormVersionUuid: string,
    executor?: any,
  ) {
    return copyFormVersionStructure(sourceFormVersionUuid, targetFormVersionUuid, executor);
  },

  async hasStructureForForm(formUuid: string, executor?: any) {
    return formStructureRepository.hasStructureForForm(formUuid, executor);
  },
};

export type {
  FormStructureInput,
  FormStructureOptionInput,
  FormStructureOptionSetInput,
  FormStructureQuestionInput,
  FormStructureSectionInput,
};