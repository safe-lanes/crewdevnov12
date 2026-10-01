import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  admFormVersionsV2,
  admFormsV2,
} from "../../../shared/v2/admin/schema";
import {
  frmAnswers,
  frmFormParts,
  frmOptions,
  frmOptionSets,
  frmQuestions,
  frmSectionStates,
  frmSections,
} from "../../../shared/v2/forms-engine/schema";
import { frmCompanySubmissions } from "../../../shared/v2/forms-engine/submissions";
import { getDb } from "../db";
import { CompanyFormConflictError, CompanyFormNotFoundError, CompanyFormValidationError } from "./errors";

type Executor = any;
type AnswerValue = string | string[] | boolean | null;

export type CompanyFormDraftAnswerInput = {
  questionUuid: string;
  value: AnswerValue;
  comment?: string | null;
};

type SubjectLock<Context> = {
  subjectRef: string;
  context: Context;
};

type WriteDraftInput<Context> = {
  submissionUuid: string;
  sectionUuid: string;
  expectedSubmission: {
    subjectType: string;
    subjectRef: string;
    formUuid: string;
    formVersionUuid: string;
    stageKey: string | null;
  };
  actorUserId: number;
  answers: CompanyFormDraftAnswerInput[];
  sectionComment?: string | null;
  lockSubject: (subjectRef: string, executor: Executor) => Promise<SubjectLock<Context> | undefined>;
  assertSubjectWritable: (subject: SubjectLock<Context>) => Promise<void>;
  assertSectionWritable: (
    input: { section: any; part: any; subject: SubjectLock<Context>; executor: Executor },
  ) => Promise<void>;
};

function storedAnswerValue(value: AnswerValue): string | null {
  if (value === null) return null;
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]);
}

function isFiniteNumberString(value: string): boolean {
  const normalized = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return false;
  return Number.isFinite(Number(normalized));
}

function validateDraftAnswers(
  answers: readonly CompanyFormDraftAnswerInput[],
  questions: readonly any[],
  optionsBySet: Map<string, Set<string>>,
) {
  const questionByUuid = new Map<string, any>(questions.map((question) => [question.questionUuid, question]));
  const seen = new Set<string>();
  const writableResponseTypes = new Set([
    "yes_no",
    "yes_no_na",
    "single_select",
    "multi_select",
    "free_text",
    "date",
    "number",
    "checkbox",
  ]);
  return answers.map((answer) => {
    if (seen.has(answer.questionUuid)) {
      throw new CompanyFormValidationError("A question may appear only once in a draft update.");
    }
    seen.add(answer.questionUuid);
    const question = questionByUuid.get(answer.questionUuid);
    if (!question) {
      throw new CompanyFormValidationError("Question does not belong to this pinned section.");
    }

    const value = answer.value;
    const responseType = question.responseType;
    if (responseType === "content" || responseType === "system_field" || responseType === "info_only") {
      throw new CompanyFormValidationError("Content, System, and informational points cannot receive answers or comments.");
    }
    if (!writableResponseTypes.has(responseType)) {
      throw new CompanyFormValidationError("This Company Form point type cannot receive an answer.");
    }

    if (value !== null) {
      const isString = typeof value === "string";
      if (responseType === "yes_no" && (!isString || !["yes", "no"].includes(value.toLowerCase()))) {
        throw new CompanyFormValidationError("Expected a yes or no answer.");
      }
      if (responseType === "yes_no_na" && (!isString || !["yes", "no", "na"].includes(value.toLowerCase()))) {
        throw new CompanyFormValidationError("Expected yes, no, or not applicable.");
      }
      if (responseType === "single_select" && !isString) {
        throw new CompanyFormValidationError("Expected one selected option.");
      }
      if (responseType === "multi_select" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
        throw new CompanyFormValidationError("Expected a list of selected options.");
      }
      if (responseType === "checkbox" && typeof value !== "boolean") {
        throw new CompanyFormValidationError("Expected a boolean answer.");
      }
      if (["free_text", "date", "number"].includes(responseType) && !isString) {
        throw new CompanyFormValidationError(`Expected a text value for this ${responseType} point.`);
      }
      if (responseType === "date" && isString && !isCalendarDate(value)) {
        throw new CompanyFormValidationError("Expected a valid calendar date in YYYY-MM-DD format.");
      }
      if (responseType === "number" && isString && !isFiniteNumberString(value)) {
        throw new CompanyFormValidationError("Expected a finite number.");
      }
    }

    const comment = answer.comment;
    if (!question.commentEnabled && comment != null && comment.trim().length > 0) {
      throw new CompanyFormValidationError("Comments are not enabled for this question.");
    }
    if (["single_select", "multi_select"].includes(responseType) && value !== null) {
      const setUuid = question.optionSetUuid ?? question.sectionDefaultOptionSetUuid;
      const allowed = setUuid ? optionsBySet.get(setUuid) : undefined;
      const values = Array.isArray(value) ? value : [value];
      if (!allowed || values.some((selected) => typeof selected !== "string" || !allowed.has(selected))) {
        throw new CompanyFormValidationError("Answer contains an option outside this pinned question's option set.");
      }
      if (Array.isArray(value) && new Set(value).size !== value.length) {
        throw new CompanyFormValidationError("A multi-select answer cannot contain duplicate options.");
      }
    }
    return {
      questionUuid: answer.questionUuid,
      answerValue: storedAnswerValue(value),
      answerComment: comment === undefined ? undefined : comment?.trim() ? comment : null,
    };
  });
}

export class CompanyFormSubmissionDraftRepository {
  async updateDraft<Context>(
    input: WriteDraftInput<Context>,
    executor: Executor = getDb(),
  ): Promise<void> {
    if (input.answers.length === 0 && input.sectionComment === undefined) {
      throw new CompanyFormValidationError("Provide at least one answer or a section comment to save.");
    }
    await executor.transaction(async (tx: Executor) => {
      // Generic parent is always the first row lock. Child-only/orphan shared
      // rows cannot establish a submission or authorize a write.
      await tx.execute(sql`
        SELECT submission_uuid
        FROM frm_company_submissions
        WHERE submission_uuid = ${input.submissionUuid}
          AND COALESCE(is_deleted, false) = false
        FOR UPDATE
      `);
      const parents = await tx.select({
        submission: frmCompanySubmissions,
      }).from(frmCompanySubmissions)
        .innerJoin(admFormsV2, and(
          eq(admFormsV2.formUuid, frmCompanySubmissions.formUuid),
          eq(admFormsV2.subjectType, frmCompanySubmissions.subjectType),
          eq(admFormsV2.category, "dynamic"),
        ))
        .innerJoin(admFormVersionsV2, and(
          eq(admFormVersionsV2.fvUuid, frmCompanySubmissions.formVersionUuid),
          eq(admFormVersionsV2.formId, admFormsV2.id),
        ))
        .where(and(
          eq(frmCompanySubmissions.submissionUuid, input.submissionUuid),
          eq(frmCompanySubmissions.isDeleted, false),
        ))
        .limit(1);
      const parent = parents[0]?.submission;
      if (!parent) throw new CompanyFormNotFoundError("Company Form submission not found.");
      if (
        parent.subjectType !== input.expectedSubmission.subjectType ||
        parent.subjectRef !== input.expectedSubmission.subjectRef ||
        parent.formUuid !== input.expectedSubmission.formUuid ||
        parent.formVersionUuid !== input.expectedSubmission.formVersionUuid ||
        parent.stageKey !== input.expectedSubmission.stageKey
      ) {
        throw new CompanyFormConflictError("The Company Form subject or version pin changed; reload the submission.");
      }
      if (parent.status !== "in_progress") {
        throw new CompanyFormConflictError("Completed Company Form submissions are read-only.");
      }

      // This adapter lock serializes the write with authoritative subject
      // cancellation/update transactions; it is always acquired after parent.
      const subject = await input.lockSubject(parent.subjectRef, tx);
      if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
      if (subject.subjectRef !== parent.subjectRef) {
        throw new CompanyFormConflictError("The Company Form subject pin changed; reload the submission.");
      }
      await input.assertSubjectWritable(subject);

      const sectionRows = await tx.select({
        section: frmSections,
        part: frmFormParts,
      }).from(frmSections)
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formVersionUuid, parent.formVersionUuid),
          eq(frmFormParts.formUuid, parent.formUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmSections.sectionUuid, input.sectionUuid),
          eq(frmSections.formVersionUuid, parent.formVersionUuid),
          eq(frmSections.isDeleted, false),
        ))
        .limit(2);
      if (sectionRows.length !== 1) {
        throw new CompanyFormValidationError("Section does not belong to this pinned submission.");
      }
      const { section, part } = sectionRows[0];
      await input.assertSectionWritable({ section, part, subject, executor: tx });

      // Lock child state only after the generic parent and subject rows.
      await tx.execute(sql`
        SELECT section_state_uuid
        FROM frm_section_states
        WHERE submission_uuid = ${input.submissionUuid}
          AND section_uuid = ${input.sectionUuid}
          AND COALESCE(is_deleted, false) = false
        FOR UPDATE
      `);
      const states = await tx.select().from(frmSectionStates).where(and(
        eq(frmSectionStates.submissionUuid, input.submissionUuid),
        eq(frmSectionStates.sectionUuid, input.sectionUuid),
        eq(frmSectionStates.isDeleted, false),
      ));
      if (states.length > 1) {
        throw new CompanyFormConflictError("Duplicate active section-state rows prevent a safe draft update.");
      }
      let state = states[0];
      if (state && state.status !== "not_started" && state.status !== "in_progress") {
        throw new CompanyFormConflictError("Submitted or locked Company Form sections are read-only.");
      }

      const questions = await tx.select().from(frmQuestions).where(and(
        eq(frmQuestions.sectionUuid, section.sectionUuid),
        eq(frmQuestions.isDeleted, false),
      )).orderBy(asc(frmQuestions.sortOrder), asc(frmQuestions.id));

      const answerableSetUuids = [...new Set<string>(questions
        .filter((question: any) => question.responseType === "single_select" || question.responseType === "multi_select")
        .map((question: any) => question.optionSetUuid ?? section.defaultOptionSetUuid)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0))];
      const optionSets = answerableSetUuids.length
        ? await tx.select().from(frmOptionSets).where(and(
          inArray(frmOptionSets.optionSetUuid, answerableSetUuids),
          eq(frmOptionSets.formVersionUuid, parent.formVersionUuid),
          eq(frmOptionSets.isDeleted, false),
        ))
        : [];
      if (optionSets.length !== answerableSetUuids.length) {
        throw new CompanyFormConflictError("Pinned option-set data is incomplete or belongs to another form version.");
      }
      const options = answerableSetUuids.length
        ? await tx.select().from(frmOptions).where(and(
          inArray(frmOptions.optionSetUuid, answerableSetUuids),
          eq(frmOptions.isDeleted, false),
        ))
        : [];
      const optionsBySet = new Map<string, Set<string>>();
      for (const option of options) {
        const allowed = optionsBySet.get(option.optionSetUuid) ?? new Set<string>();
        allowed.add(option.optionValue);
        optionsBySet.set(option.optionSetUuid, allowed);
      }

      const validatedAnswers = validateDraftAnswers(input.answers, questions.map((question: any) => ({
        ...question,
        sectionDefaultOptionSetUuid: section.defaultOptionSetUuid,
      })), optionsBySet);

      const now = new Date();
      if (!state) {
        const inserted = await tx.insert(frmSectionStates).values({
          sectionStateUuid: randomUUID(),
          submissionUuid: input.submissionUuid,
          sectionUuid: input.sectionUuid,
          status: "not_started",
          createdByUuid: String(input.actorUserId),
          updatedByUuid: String(input.actorUserId),
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          isSync: false,
        }).returning();
        state = inserted[0];
      }

      if (validatedAnswers.length > 0) {
        const questionUuids = validatedAnswers.map((answer) => answer.questionUuid);
        const storedRows = await tx.select().from(frmAnswers).where(and(
          eq(frmAnswers.submissionUuid, input.submissionUuid),
          inArray(frmAnswers.questionUuid, questionUuids),
          eq(frmAnswers.isDeleted, false),
        )).for("update");
        const rowsByQuestion = new Map<string, any[]>();
        for (const stored of storedRows) {
          const rows = rowsByQuestion.get(stored.questionUuid) ?? [];
          rows.push(stored);
          rowsByQuestion.set(stored.questionUuid, rows);
        }
        const duplicates = [...rowsByQuestion.values()].some((rows) => rows.length > 1);
        if (duplicates) {
          throw new CompanyFormConflictError("Duplicate active answer rows prevent a safe draft update.");
        }
        for (const answer of validatedAnswers) {
          const existing = rowsByQuestion.get(answer.questionUuid)?.[0];
          const audit: {
            answerValue: string | null;
            answerComment?: string | null;
            updatedByUuid: string;
            updatedAt: Date;
          } = {
            answerValue: answer.answerValue,
            updatedByUuid: String(input.actorUserId),
            updatedAt: now,
          };
          if (answer.answerComment !== undefined) audit.answerComment = answer.answerComment;
          if (existing) {
            await tx.update(frmAnswers).set(audit).where(eq(frmAnswers.answerUuid, existing.answerUuid));
          } else {
            await tx.insert(frmAnswers).values({
              answerUuid: randomUUID(),
              submissionUuid: input.submissionUuid,
              questionUuid: answer.questionUuid,
              ...audit,
              answerComment: answer.answerComment ?? null,
              createdByUuid: String(input.actorUserId),
              createdAt: now,
              isDeleted: false,
              isSync: false,
            });
          }
        }
      }

      const stateAudit: { sectionComment?: string | null; updatedByUuid: string; updatedAt: Date } = {
        updatedByUuid: String(input.actorUserId),
        updatedAt: now,
      };
      if (input.sectionComment !== undefined) stateAudit.sectionComment = input.sectionComment;
      await tx.update(frmSectionStates).set(stateAudit)
        .where(eq(frmSectionStates.sectionStateUuid, state.sectionStateUuid));
    });
  }
}

export const companyFormSubmissionDraftRepository = new CompanyFormSubmissionDraftRepository();