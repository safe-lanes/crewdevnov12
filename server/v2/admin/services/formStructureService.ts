import type {
  FormStructureInput,
  FormStructureOptionInput,
  FormStructureQuestionInput,
  FormStructureSectionInput,
} from "../../../../shared/v2/forms-engine/schema";
import { formStructureRepository } from "../repositories/formStructureRepository";

export class FormStructureServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "FormStructureServiceError";
  }
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

  const optionsByQuestion = new Map<string, any[]>();
  for (const option of tree.options as any[]) {
    const options = optionsByQuestion.get(option.questionUuid) ?? [];
    options.push(option);
    optionsByQuestion.set(option.questionUuid, options);
  }

  return {
    form_version_uuid: fvUuid,
    form_part_uuid: partUuid,
    sections: (tree.sections as any[]).map((section) => ({
      section_uuid: section.sectionUuid,
      section_code: section.sectionCode,
      section_title: section.sectionTitle,
      applicable_vessel_types: parseApplicableVesselTypes(section.applicableVesselTypes),
      responsible_mode: section.responsibleMode,
      responsible_role_uuid: section.responsibleRoleUuid,
      responsible_department: section.responsibleDepartment,
      comment_box_required: section.commentBoxRequired,
      signature_required: section.signatureRequired,
      sort_order: section.sortOrder,
      questions: (questionsBySection.get(section.sectionUuid) ?? []).map((question) => ({
        question_uuid: question.questionUuid,
        question_code: question.questionCode,
        question_text: question.questionText,
        response_type: question.responseType,
        is_mandatory: question.isMandatory,
        comment_enabled: question.commentEnabled,
        sort_order: question.sortOrder,
        options: (optionsByQuestion.get(question.questionUuid) ?? []).map((option) => ({
          option_uuid: option.optionUuid,
          option_label: option.optionLabel,
          option_value: option.optionValue,
          sort_order: option.sortOrder,
        })),
      })),
    })),
  };
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

  const sectionUuids = input.sections.flatMap((section) => section.section_uuid ? [section.section_uuid] : []);
  const questionUuids = input.sections.flatMap((section) =>
    section.questions.flatMap((question) => question.question_uuid ? [question.question_uuid] : []),
  );
  const optionUuids = input.sections.flatMap((section) =>
    section.questions.flatMap((question) =>
      question.options.flatMap((option) => option.option_uuid ? [option.option_uuid] : []),
    ),
  );
  ensureUnique(sectionUuids, "section_uuid");
  ensureUnique(questionUuids, "question_uuid");
  ensureUnique(optionUuids, "option_uuid");

  const allIdentities = [...sectionUuids, ...questionUuids, ...optionUuids];
  ensureUnique(allIdentities, "structure row UUID");

  for (const section of input.sections) {
    if (section.section_uuid && !existingSections.has(section.section_uuid)) {
      throw new FormStructureServiceError(`section_uuid does not belong to this draft: ${section.section_uuid}`);
    }
    for (const question of section.questions) {
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
          if (existing.questionUuid !== question.question_uuid) {
            throw new FormStructureServiceError(`option_uuid ${option.option_uuid} belongs to a different question`);
          }
        }
      }
    }
  }
}

function validateBusinessUniqueness(input: FormStructureInput): void {
  ensureUnique(input.sections.map((section) => section.section_code), "section_code");
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
        async (current, tx) => {
          validateIdentities(input, current);
          validateBusinessUniqueness(input);
          await formStructureRepository.validateReferenceData(input, tx);
        },
      );
      return treeResponse(fvUuid, partUuid, tree);
    } catch (error: any) {
      if (error?.message?.includes("only draft versions are editable")) {
        throw new FormStructureServiceError(error.message, 409);
      }
      if (error?.message?.includes("same form")) {
        throw new FormStructureServiceError(error.message, 400);
      }
      if (
        error?.message?.includes("Unknown vessel type UUID") ||
        error?.message?.includes("Unknown responsible role UUID")
      ) {
        throw new FormStructureServiceError(error.message, 400);
      }
      throw error;
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

  async hasStructureForForm(formUuid: string, executor?: any) {
    return formStructureRepository.hasStructureForForm(formUuid, executor);
  },
};

export type { FormStructureInput, FormStructureOptionInput, FormStructureQuestionInput, FormStructureSectionInput };