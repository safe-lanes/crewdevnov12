import type { Request } from "express";
import type {
  CompanyFormAction,
  CompanyFormPrincipal,
  CompanyFormSubjectAdapter,
  SubjectLookupResult,
} from "./contracts";
import type {
  CompanyFormRenderOption,
  CompanyFormRenderResponseType,
  CompanyFormSubmissionDetail,
  CompanyFormSubmissionRenderContract,
  CompanyFormSubmissionSectionState,
  CompanyFormSubmissionSummary,
  CompanyFormSystemFieldValue,
} from "../../../shared/v2/forms-engine/submissionRenderContract";
import {
  CompanyFormAuthenticationError,
  CompanyFormConflictError,
  CompanyFormNotFoundError,
  CompanyFormPermissionError,
  CompanyFormValidationError,
} from "./errors";
import { companyFormSubjectRegistry } from "./registry";
import {
  companyFormSubmissionsRepository,
  type CompanyFormSubmissionsRepository,
  type CompanyFormSubmissionRow,
  type EligibleCompanyForm,
} from "./submissionsRepository";
import {
  resolveCompanyFormPrincipal,
  type PrincipalDependencies,
} from "./trustedPrincipalService";
import {
  companyFormSubmissionRenderRepository,
  type CompanyFormSubmissionRenderRepository,
} from "./submissionRenderRepository";
import {
  companyFormSubmissionDraftRepository,
  type CompanyFormDraftAnswerInput,
  type CompanyFormSubmissionDraftRepository,
} from "./submissionDraftRepository";
import { assertCompanyFormSectionEditable } from "./draftSectionPolicy";
import { sanitizeComparisonHtml } from "../../../shared/v2/forms-engine/contentSanitizer";

function isoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid persisted Company Form timestamp.");
  return date.toISOString();
}

function isoCalendarDate(value: Date | string | null | undefined): string | null {
  const timestamp = isoDate(value);
  return timestamp ? timestamp.slice(0, 10) : null;
}

function mapSummary(row: any, canEdit: boolean): CompanyFormSubmissionSummary {
  return {
    submissionUuid: row.submissionUuid,
    subjectType: row.subjectType,
    subjectRef: row.subjectRef,
    formUuid: row.formUuid,
    formVersionUuid: row.formVersionUuid,
    stageKey: row.stageKey,
    status: row.status,
    canEdit,
    createdAt: isoDate(row.createdAt),
    completedAt: isoDate(row.completedAt),
  };
}

function mapRenderOption(row: any): CompanyFormRenderOption {
  return {
    optionUuid: row.optionUuid,
    optionLabel: row.optionLabel,
    optionValue: row.optionValue,
    sortOrder: row.sortOrder,
  };
}

const renderResponseTypes = new Set<CompanyFormRenderResponseType>([
  "yes_no",
  "yes_no_na",
  "single_select",
  "multi_select",
  "free_text",
  "date",
  "number",
  "checkbox",
  "info_only",
  "content",
  "system_field",
]);

function renderResponseType(value: unknown): CompanyFormRenderResponseType {
  if (typeof value !== "string" || !renderResponseTypes.has(value as CompanyFormRenderResponseType)) {
    throw new Error("Unsupported persisted response type in a Company Form version.");
  }
  return value as CompanyFormRenderResponseType;
}

function parseVesselTypeUuids(value: string | null): string[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid persisted vessel-type lookup data in a Company Form section.");
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Invalid persisted vessel-type lookup data in a Company Form section.");
  }
  return parsed;
}

function resolveEffectiveLayout(
  section: any,
  questions: any[],
  setsByUuid: Map<string, any>,
  optionsBySet: Map<string, CompanyFormRenderOption[]>,
): "list" | "matrix" {
  if (section.layoutPreference === "list" || questions.length === 0) return "list";
  const setUuids = questions.map((question) => question.optionSetUuid ?? section.defaultOptionSetUuid);
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

function classifyOutstanding<Context>(
  adapter: CompanyFormSubjectAdapter<Context>,
  subject: SubjectLookupResult<Context>,
  submissions: readonly CompanyFormSubmissionRow[],
) {
  const outstanding = adapter.isOutstanding(subject.context);
  const rows = submissions.map((submission) => ({
    ...submission,
    groupId: adapter.groupingIdentifier(subject.context, subject.subjectRef),
    isOutstanding: outstanding && submission.status === "in_progress",
  }));
  return {
    groupId: adapter.groupingIdentifier(subject.context, subject.subjectRef),
    submissions: rows,
    totalCount: rows.length,
    outstandingCount: rows.filter((row) => row.isOutstanding).length,
    historyCount: rows.filter((row) => !row.isOutstanding).length,
  };
}

export class CompanyFormSubmissionsService {
  constructor(
    private readonly principalDependencies: PrincipalDependencies = {},
    private readonly registry = companyFormSubjectRegistry,
    private readonly repository: CompanyFormSubmissionsRepository = companyFormSubmissionsRepository,
    private readonly renderRepository: CompanyFormSubmissionRenderRepository = companyFormSubmissionRenderRepository,
    private readonly draftRepository: CompanyFormSubmissionDraftRepository = companyFormSubmissionDraftRepository,
  ) {}

  private async resolvePrincipal(req: Request): Promise<CompanyFormPrincipal> {
    try {
      return await resolveCompanyFormPrincipal(req, this.principalDependencies);
    } catch (error: unknown) {
      if (error instanceof CompanyFormAuthenticationError) throw error;
      // Identity, role, grant, and vessel-scope resolution errors are denied
      // as permissions rather than reported as missing configuration.
      throw new CompanyFormPermissionError();
    }
  }

  private async authorize(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
    subject: any,
  ): Promise<void> {
    try {
      if (await adapter.authorize(principal, action, subject)) return;
    } catch {
      // Office grant and relationship lookup failures fail closed.
    }
    throw new CompanyFormPermissionError();
  }

  private async authorizeHome(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
    homeRef: string,
    subjects: readonly SubjectLookupResult<any>[],
  ): Promise<void> {
    try {
      if (await adapter.authorizeHome(principal, action, homeRef, subjects)) return;
    } catch {
      // Treat unavailable permission sources as an explicit refusal.
    }
    throw new CompanyFormPermissionError();
  }

  private async authorizeSubmission(
    req: Request,
    submissionUuid: string,
    action: CompanyFormAction,
  ) {
    const principal = await this.resolvePrincipal(req);
    const submission = await this.renderRepository.findSubmission(submissionUuid);
    if (!submission) throw new CompanyFormNotFoundError("Company Form submission not found.");
    const adapter = this.registry.get(submission.subjectType);
    const subject = await adapter.lookup(submission.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, action, subject.context);
    return { submission, adapter, subject, principal };
  }

  private async canEditSubmission(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    subject: any,
    status: string,
  ): Promise<boolean> {
    if (status !== "in_progress") return false;
    try {
      if (!adapter.canStart(subject)) return false;
      return await adapter.authorize(principal, "edit_draft", subject);
    } catch {
      return false;
    }
  }

  private mapStatesAndAnswers(data: any, formUrl: string) {
    const signaturesByState = new Map<string, CompanyFormSubmissionSectionState["signatures"]>();
    for (const row of data.signatures as any[]) {
      const signatures = signaturesByState.get(row.signature.sectionStateUuid) ?? [];
      signatures.push({
        sectionSignatureUuid: row.signature.sectionSignatureUuid,
        signatureType: row.signature.signatureType,
        signerName: row.signature.signerName,
        signerRank: row.signature.signerRank,
        signedAt: isoDate(row.signature.signedAt)!,
        signedByUuid: row.signature.signedByUuid,
        signatureMethod: row.signature.signatureMethod,
        attachment: {
          assetUuid: row.attachment.sigAttUuid,
          fileName: row.attachment.fileName,
          fileType: row.attachment.fileType,
          fileSize: row.attachment.fileSize,
          rawUrl: `${formUrl}/attachments/${encodeURIComponent(row.attachment.sigAttUuid)}/raw`,
        },
      });
      signaturesByState.set(row.signature.sectionStateUuid, signatures);
    }

    const states: CompanyFormSubmissionSectionState[] = (data.states as any[]).map((state) => ({
      sectionStateUuid: state.sectionStateUuid,
      sectionUuid: state.sectionUuid,
      status: state.status,
      sectionComment: state.sectionComment,
      submittedByUuid: state.submittedByUuid,
      submittedByName: state.submittedByName,
      submittedAt: isoDate(state.submittedAt),
      signatures: signaturesByState.get(state.sectionStateUuid) ?? [],
    }));
    const answers = (data.answers as any[]).map((answer) => ({
      answerUuid: answer.answerUuid,
      questionUuid: answer.questionUuid,
      answerValue: answer.answerValue,
      answerComment: answer.answerComment,
      createdAt: isoDate(answer.createdAt),
      updatedAt: isoDate(answer.updatedAt),
    }));
    return { states, answers };
  }

  async readSubmission(input: {
    req: Request;
    submissionUuid: string;
  }): Promise<CompanyFormSubmissionDetail> {
    const { adapter, subject, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "read_submission",
    );
    const data = await this.renderRepository.readPinnedRenderData(input.submissionUuid);
    if (!data) throw new CompanyFormNotFoundError("Company Form submission not found.");
    const canEdit = await this.canEditSubmission(adapter, principal, subject.context, data.submission.status);
    const formUrl = `/api/v2/company-form-submissions/${encodeURIComponent(input.submissionUuid)}`;
    const { states, answers } = this.mapStatesAndAnswers(data, formUrl);
    return {
      submission: mapSummary(data.submission, canEdit),
      states,
      answers,
      formUrl: `${formUrl}/form`,
    };
  }

  async readSubmissionForm(input: {
    req: Request;
    submissionUuid: string;
  }): Promise<CompanyFormSubmissionRenderContract> {
    const { adapter, subject, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "read_definition",
    );
    const data = await this.renderRepository.readPinnedRenderData(input.submissionUuid);
    if (!data) throw new CompanyFormNotFoundError("Company Form submission not found.");
    const canEdit = await this.canEditSubmission(adapter, principal, subject.context, data.submission.status);

    const stages = await adapter.loadStages();
    const stage = data.submission.stageKey
      ? stages.find((candidate) => candidate.stageKey === data.submission.stageKey)
      : undefined;
    const dateOfDeclaration = isoCalendarDate(data.submission.completedAt ?? data.submission.createdAt);
    const systemFields: CompanyFormSystemFieldValue[] = [];
    for (const field of adapter.systemFields) {
      if (field.source === "subject" && data.submission.status === "completed") {
        systemFields.push({
          ...field,
          value: null,
          valueOrigin: "persisted_snapshot_unavailable",
        });
        continue;
      }
      const value = await adapter.resolveSystemField(field.key, subject.context, {
        submission: { dateOfDeclaration },
      });
      systemFields.push({
        ...field,
        value,
        valueOrigin: field.source === "submission" ? "submission_date" : "current_subject",
      });
    }

    const systemFieldsByKey = new Map(systemFields.map((field) => [field.key, field]));
    const optionSetsByUuid = new Map<string, any>(
      (data.optionSets as any[]).map((set) => [set.optionSetUuid, set]),
    );
    const optionsBySet = new Map<string, CompanyFormRenderOption[]>();
    for (const option of data.options as any[]) {
      const options = optionsBySet.get(option.optionSetUuid) ?? [];
      options.push(mapRenderOption(option));
      optionsBySet.set(option.optionSetUuid, options);
    }
    const sectionsByPart = new Map<string, any[]>();
    for (const section of data.sections as any[]) {
      const sections = sectionsByPart.get(section.formPartUuid) ?? [];
      sections.push(section);
      sectionsByPart.set(section.formPartUuid, sections);
    }
    const questionsBySection = new Map<string, any[]>();
    for (const question of data.questions as any[]) {
      const questions = questionsBySection.get(question.sectionUuid) ?? [];
      questions.push(question);
      questionsBySection.set(question.sectionUuid, questions);
    }
    const vesselTypeByUuid = new Map<string, any>(
      (data.vesselTypes as any[]).map((row) => [row.vesselTypeUuid, row]),
    );
    const roleByUuid = new Map<string, any>(
      (data.roles as any[]).map((row) => [row.roleUuid, row]),
    );
    const optionSets = (data.optionSets as any[]).map((set) => ({
      optionSetUuid: set.optionSetUuid,
      setName: set.setName,
      lowEndLabel: set.lowEndLabel,
      highEndLabel: set.highEndLabel,
      sortOrder: set.sortOrder,
      options: optionsBySet.get(set.optionSetUuid) ?? [],
    }));
    const parts = (data.parts as any[]).map((part) => ({
      formPartUuid: part.formPartUuid,
      partCode: part.partCode,
      partTitle: part.partTitle,
      partType: part.partType,
      isOfficeOnly: part.isOfficeOnly,
      sortOrder: part.sortOrder,
      sections: (sectionsByPart.get(part.formPartUuid) ?? []).map((section) => {
        const questions = questionsBySection.get(section.sectionUuid) ?? [];
        return {
          sectionUuid: section.sectionUuid,
          sectionCode: section.sectionCode,
          sectionTitle: section.sectionTitle,
          applicableVesselTypes: parseVesselTypeUuids(section.applicableVesselTypes)
            .map((vesselTypeUuid) => ({
              vesselTypeUuid,
              vesselType: vesselTypeByUuid.get(vesselTypeUuid)?.vesselType ?? null,
            })),
          responsibleMode: section.responsibleMode,
          responsibleRoleUuid: section.responsibleRoleUuid,
          responsibleRole: section.responsibleRoleUuid && roleByUuid.has(section.responsibleRoleUuid)
            ? {
              roleUuid: section.responsibleRoleUuid,
              roleName: roleByUuid.get(section.responsibleRoleUuid).roleName,
              roleType: roleByUuid.get(section.responsibleRoleUuid).roleType,
            }
            : null,
          responsibleDepartment: section.responsibleDepartment,
          commentBoxRequired: section.commentBoxRequired,
          signatureOfficerRequired: section.signatureOfficerRequired,
          signatureSeafarerRequired: section.signatureSeafarerRequired,
          defaultOptionSetUuid: section.defaultOptionSetUuid,
          layoutPreference: section.layoutPreference,
          effectiveLayout: resolveEffectiveLayout(section, questions, optionSetsByUuid, optionsBySet),
          sortOrder: section.sortOrder,
          questions: questions.map((question) => {
            const responseType = renderResponseType(question.responseType);
            const isSystemField = responseType === "system_field";
            const systemField = isSystemField
              ? systemFieldsByKey.get(question.systemFieldKey)
              : undefined;
            if (isSystemField && !systemField) {
              throw new Error("Unknown persisted System field in a Company Form version.");
            }
            const optionSetUuid = isSystemField
              ? null
              : question.optionSetUuid ?? section.defaultOptionSetUuid;
            return {
              questionUuid: question.questionUuid,
              questionCode: question.questionCode,
              questionText: question.questionText,
              responseType,
              contentHtml: responseType === "content"
                ? sanitizeComparisonHtml(question.contentHtml ?? "")
                : null,
              systemFieldKey: question.systemFieldKey,
              isMandatory: question.isMandatory,
              commentEnabled: question.commentEnabled,
              optionSetUuid,
              sortOrder: question.sortOrder,
              options: optionSetUuid ? optionsBySet.get(optionSetUuid) ?? [] : [],
              systemField: systemField ?? null,
            };
          }),
        };
      }),
    }));

    const formUrl = `/api/v2/company-form-submissions/${encodeURIComponent(input.submissionUuid)}`;
    const { states, answers } = this.mapStatesAndAnswers(data, formUrl);
    return {
      submission: mapSummary(data.submission, canEdit),
      form: {
        formName: data.form.name,
        description: data.form.description,
        category: data.form.category,
        archivedAt: isoDate(data.form.archivedAt),
      },
      version: {
        formVersionUuid: data.version.fvUuid,
        versionNo: data.version.versionNo,
        versionDate: data.version.versionDate,
        status: data.version.status,
        stageKey: data.version.stageKey,
        stageLabel: stage?.label ?? null,
        releasedAt: isoDate(data.version.releasedAt),
      },
      systemFields,
      optionSets,
      parts,
      states,
      answers,
    };
  }

  async readSubmissionAsset(input: {
    req: Request;
    submissionUuid: string;
    assetUuid: string;
  }) {
    await this.authorizeSubmission(input.req, input.submissionUuid, "read_asset");
    const asset = await this.renderRepository.findOwnedSignatureAttachment(
      input.submissionUuid,
      input.assetUuid,
    );
    if (!asset) throw new CompanyFormNotFoundError("Company Form attachment not found.");
    return asset;
  }

  async updateDraftAnswers(input: {
    req: Request;
    submissionUuid: string;
    sectionUuid: string;
    answers: CompanyFormDraftAnswerInput[];
    sectionComment?: string | null;
  }): Promise<void> {
    const { submission, adapter, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "edit_draft",
    );
    await this.draftRepository.updateDraft({
      submissionUuid: input.submissionUuid,
      sectionUuid: input.sectionUuid,
      expectedSubmission: {
        subjectType: submission.subjectType,
        subjectRef: submission.subjectRef,
        formUuid: submission.formUuid,
        formVersionUuid: submission.formVersionUuid,
        stageKey: submission.stageKey,
      },
      actorUserId: principal.userId,
      answers: input.answers,
      sectionComment: input.sectionComment,
      lockSubject: (subjectRef, executor) => adapter.lockForStart(subjectRef, executor),
      assertSubjectWritable: async (lockedSubject) => {
        try {
          if (!adapter.canStart(lockedSubject.context)) {
            throw new CompanyFormConflictError("This Company Form subject no longer accepts draft edits.");
          }
        } catch (error) {
          if (error instanceof CompanyFormConflictError) throw error;
          throw new CompanyFormConflictError("Unable to verify that this subject still accepts draft edits.");
        }
        await this.authorize(adapter, principal, "edit_draft", lockedSubject.context);
      },
      assertSectionWritable: async ({ section, part, executor }) => {
        await assertCompanyFormSectionEditable({ principal, section, part, executor });
      },
    });
  }

  async eligibleForms(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
    stageKey?: string;
  }): Promise<EligibleCompanyForm[]> {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "read_eligible_forms", subject.context);

    const stages = await adapter.loadStages();
    let stageKey: string | null;
    if (stages.length === 0) {
      if (input.stageKey !== undefined) {
        throw new CompanyFormValidationError("This subject type does not have a stage to select.");
      }
      stageKey = null;
    } else {
      if (!input.stageKey || !stages.some((stage) => stage.stageKey === input.stageKey)) {
        throw new CompanyFormValidationError("Select a valid stage for this subject.");
      }
      stageKey = input.stageKey;
    }

    if (!adapter.canStart(subject.context)) return [];
    return this.repository.findEligibleForms(input.subjectType, stageKey);
  }

  async create(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
    formUuid: string;
    formVersionUuid: string;
  }): Promise<CompanyFormSubmissionRow> {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    return this.repository.createPinnedSubmission({
      adapter,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      formUuid: input.formUuid,
      formVersionUuid: input.formVersionUuid,
      authorizeLockedSubject: async (subject) => {
        await this.authorize(adapter, principal, "create_submission", subject.context);
      },
    });
  }

  async listForSubject(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
  }) {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "list_submissions", subject.context);

    const rows = await this.repository.listForSubjects(
      input.subjectType,
      [subject.subjectRef],
    );
    return {
      subjectType: input.subjectType,
      subjectRef: subject.subjectRef,
      ...classifyOutstanding(adapter, subject, rows),
    };
  }

  async countForSubject(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
  }) {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "count_submissions", subject.context);
    const rows = await this.repository.listForSubjects(input.subjectType, [subject.subjectRef]);
    const result = classifyOutstanding(adapter, subject, rows);
    return {
      subjectType: input.subjectType,
      subjectRef: subject.subjectRef,
      groupId: result.groupId,
      totalCount: result.totalCount,
      outstandingCount: result.outstandingCount,
      historyCount: result.historyCount,
    };
  }

  async listForHome(input: {
    req: Request;
    subjectType: string;
    homeRef: string;
  }) {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const allSubjects = await adapter.loadHomeSubjects(input.homeRef);
    if (!allSubjects) throw new CompanyFormNotFoundError("Company Form subject home not found.");

    await this.authorizeHome(adapter, principal, "list_submissions", input.homeRef, allSubjects);
    const permittedSubjects: SubjectLookupResult<any>[] = [];
    for (const subject of allSubjects) {
      try {
        if (await adapter.authorize(principal, "list_submissions", subject.context)) {
          permittedSubjects.push(subject);
        }
      } catch {
        throw new CompanyFormPermissionError();
      }
    }

    const rows = await this.repository.listForSubjects(
      input.subjectType,
      permittedSubjects.map((subject) => subject.subjectRef),
    );
    const rowsBySubject = new Map<string, CompanyFormSubmissionRow[]>();
    for (const row of rows) {
      const subjectRows = rowsBySubject.get(row.subjectRef) ?? [];
      subjectRows.push(row);
      rowsBySubject.set(row.subjectRef, subjectRows);
    }

    const groups = permittedSubjects.map((subject) => ({
      subjectRef: subject.subjectRef,
      ...classifyOutstanding(
        adapter,
        subject,
        rowsBySubject.get(subject.subjectRef) ?? [],
      ),
    }));
    return {
      subjectType: input.subjectType,
      homeRef: input.homeRef,
      groups,
      totalCount: groups.reduce((total, group) => total + group.totalCount, 0),
      outstandingCount: groups.reduce((total, group) => total + group.outstandingCount, 0),
      historyCount: groups.reduce((total, group) => total + group.historyCount, 0),
    };
  }
}

export const companyFormSubmissionsService = new CompanyFormSubmissionsService();