import type { Request } from "express";
import { resolveStageEvent } from "./stageResolutionService";
import { stageStatus, assertStageReady } from "./stageEventRepository";
import { eq } from "drizzle-orm";
import { masterUsers } from "../../../shared/schema";
import { ownsCompanyFormSignature } from "./signatureOwnership";
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
  CompanyFormSignatureMethodOption,
  CompanyFormSignatureType,
  CompanyFormSubmissionHistoryLink,
  CompanyFormSubmissionSectionActions,
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
import { assertCompanyFormSectionEditable, assertCompanyFormSignatureConfigured } from "./draftSectionPolicy";
import { sanitizeComparisonHtml } from "../../../shared/v2/forms-engine/contentSanitizer";
import { companyFormSubmissionLifecycleRepository } from "./submissionLifecycleRepository";
import { fileStorageService } from "../shared/fileStorageService";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { sectionRequiresSubmission } from "./lifecyclePolicy";
import { sailDate } from "../../../shared/v2/forms-engine/displayFormatting";
import { sql } from "drizzle-orm";
import { readRequirements } from "./requirementsRepository";

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

function mapSummary(row: any, canEdit: boolean, canVoid: boolean): CompanyFormSubmissionSummary {
  return {
    submissionUuid: row.submissionUuid,
    subjectType: row.subjectType,
    subjectRef: row.subjectRef,
    formUuid: row.formUuid,
    formVersionUuid: row.formVersionUuid,
    stageKey: row.stageKey,
    status: row.status,
    origin: row.origin ?? "MANUAL",
    requirementUuid: row.requirementUuid ?? null,
    canEdit,
    canVoid,
    formArchivedAt: isoDate(row.formArchivedAt),
    createdAt: isoDate(row.createdAt),
    completedAt: isoDate(row.completedAt),
    voidedAt: isoDate(row.voidedAt),
    voidedByUuid: row.voidedByUuid,
    voidedByName: row.voidedByName,
    voidedByDesignation: row.voidedByDesignation,
    voidReason: row.voidReason,
    voidedPreviousStatus: row.voidedPreviousStatus,
    replacedBySubmissionUuid: row.replacedBySubmissionUuid,
    replacesSubmissionUuid: row.replacesSubmissionUuid,
    systemSnapshotAt: isoDate(row.systemSnapshotAt),
    systemSnapshotEvent: row.systemSnapshotEvent,
  };
}

function replacementHistory(row: any): CompanyFormSubmissionHistoryLink[] {
  const links: CompanyFormSubmissionHistoryLink[] = [];
  if (row.replacedBySubmissionUuid) {
    links.push({
      direction: "replaced_by",
      label: "Voided — replaced by",
      submissionUuid: row.replacedBySubmissionUuid,
    });
  }
  if (row.replacesSubmissionUuid) {
    links.push({
      direction: "replaces",
      label: "Replaces a voided submission",
      submissionUuid: row.replacesSubmissionUuid,
    });
  }
  return links;
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
  async countsForSubjects(input: { req: Request; subjectType: string; subjectRefs: string[]; stageKey: string }) {
    const adapter = this.registry.get(input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    for (const ref of new Set(input.subjectRefs)) {
      const subject = await adapter.lookup(ref);
      if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
      await this.authorize(adapter, principal, "count_submissions", subject.context);
    }
    return this.repository.countsForSubjects(input.subjectType, [...new Set(input.subjectRefs)], input.stageKey);
  }

  private async readableHistory(req: Request, row: any): Promise<CompanyFormSubmissionHistoryLink[]> {
    const links = replacementHistory(row);
    return Promise.all(links.map(async link => {
      // A relationship is not a grant to its target, even if the source is readable.
      await this.authorizeSubmission(req, link.submissionUuid, "read_submission");
      const target = await this.renderRepository.readPinnedRenderData(link.submissionUuid);
      if (!target) throw new CompanyFormNotFoundError("Linked Company Form not found.");
       // Both directions describe the related record, but audit the original void.
       const original = link.direction === "replaces" ? target.submission : row;
       const date = target.submission.systemSnapshotAt ?? target.submission.createdAt;
       return { ...link, targetLabel: `${target.form.name || "Form name unavailable"} — ${target.submission.systemSnapshotAt ? "Form" : "Created (form date unavailable)"} ${sailDate(date)} — Voided by ${original.voidedByName || "Historical voiding identity unavailable"} — Voided ${sailDate(original.voidedAt)}` };
    }));
  }
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
    executor?: any,
  ): Promise<void> {
    try {
      if (await adapter.authorize(principal, action, subject, executor)) return;
    } catch (error) {
      if (error instanceof CompanyFormPermissionError) throw error;
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
    } catch (error) {
      if (error instanceof CompanyFormPermissionError) throw error;
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
    const adapter = this.contextAdapter(req, submission.subjectType);
    const subject = await adapter.lookup(submission.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    // Void authority belongs exclusively to the locked actual status below.
    // A pre-lock status check would refuse a valid completed-void request, or
    // authorize an in-progress grant against a concurrently completed record.
    if (action !== "void_submission") await this.authorize(adapter, principal, action, subject.context);
    return { submission, adapter, subject, principal };
  }

  private contextAdapter(req: Request, subjectType: string): CompanyFormSubjectAdapter<any> {
    const adapter = this.registry.get(subjectType);
    if (!adapter.assertRequestContext) return adapter;
    return {
      ...adapter,
      lookup: async (ref, executor) => {
        const subject = await adapter.lookup(ref, executor);
        if (subject) await adapter.assertRequestContext!(subject.context, req.query ?? {}, executor);
        return subject;
      },
      lockForStart: async (ref, executor) => {
        const subject = await adapter.lockForStart(ref, executor);
        if (subject) await adapter.assertRequestContext!(subject.context, req.query ?? {}, executor, true);
        return subject;
      },
    };
  }

  private async canEditSubmission(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    subject: any,
    status: string,
    stageKey: string | null = null,
  ): Promise<boolean> {
    if (status !== "in_progress") return false;
    try {
      if (!adapter.canStart(subject)) return false;
      if (adapter.authorizeStageAction && !adapter.authorizeStageAction(principal, "edit_draft", subject, stageKey)) return false;
      return await adapter.authorize(principal, "edit_draft", subject);
    } catch {
      return false;
    }
  }

  private async canAuthorizeAction(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    action: CompanyFormAction,
    subject: any,
  ): Promise<boolean> {
    try {
      return await adapter.authorize(principal, action, subject);
    } catch {
      return false;
    }
  }

  private async canVoidSubmission(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    subject: any,
    status: string,
  ): Promise<boolean> {
    if (status !== "in_progress" && status !== "completed") return false;
    return this.canAuthorizeAction(adapter, principal,
      status === "completed" ? "void_completed_submission" : "void_submission", subject);
  }

  private async signatureMethodOptions(
    adapter: CompanyFormSubjectAdapter<any>,
    principal: CompanyFormPrincipal,
    actionAuthorized: boolean,
  ): Promise<Partial<Record<CompanyFormSignatureType, CompanyFormSignatureMethodOption[]>>> {
    const options: Partial<Record<CompanyFormSignatureType, CompanyFormSignatureMethodOption[]>> = {};
    if (!actionAuthorized) return options;
    for (const declaration of adapter.signatories) {
      try { await adapter.authorizeSignature?.(principal, declaration.signatureType); }
      catch { continue; }
      const methods = declaration.methodsByActor?.[principal.kind] ??
        (declaration.allowedActors.includes(principal.kind) ? declaration.methods : []);
      if (!methods.length) continue;
      options[declaration.signatureType] = methods.map((method) => ({
        method,
        label: method === "officer" ? "Company Representative" :
          method === "authenticated" ? "Authenticated Seafarer" :
            method === "vessel_management" ? "Vessel Management" :
            principal.kind === "vessel" ? "Vessel-witnessed Seafarer" : "Office-witnessed Seafarer",
      }));
    }
    return options;
  }

  private async sectionActions(input: {
    adapter: CompanyFormSubjectAdapter<any>;
    subject: any;
    stageKey: string | null;
    principal: CompanyFormPrincipal;
    canEditSubmission: boolean;
    canSubmitAction: boolean;
    canSaveSignatureAction: boolean;
    sections: readonly any[];
    parts: readonly any[];
    questions: readonly any[];
    states: readonly any[];
    signatures: readonly any[];
    applicableBySection: ReadonlyMap<string, boolean>;
    methodOptions: Partial<Record<CompanyFormSignatureType, CompanyFormSignatureMethodOption[]>>;
  }): Promise<Record<string, CompanyFormSubmissionSectionActions>> {
    const questionsBySection = new Map<string, any[]>();
    for (const question of input.questions) {
      const values = questionsBySection.get(question.sectionUuid) ?? [];
      values.push(question);
      questionsBySection.set(question.sectionUuid, values);
    }
    const partByUuid = new Map(input.parts.map((part) => [part.formPartUuid, part]));
    const statusBySection = new Map(input.states.map((state) => [state.sectionUuid, state.status]));
    const result: Record<string, CompanyFormSubmissionSectionActions> = {};
    for (const section of input.sections) {
      const applicable = input.applicableBySection.get(section.sectionUuid) ?? true;
      const state = statusBySection.get(section.sectionUuid);
      const mutable = state !== "submitted" && state !== "not_applicable";
      let canEdit = input.canEditSubmission && applicable && mutable;
      if (canEdit) {
        try {
          if (input.adapter.authorizeStageAction && !input.adapter.authorizeStageAction(input.principal, "edit_draft", input.subject, input.stageKey)) {
            throw new CompanyFormPermissionError();
          }
          await input.adapter.authorizeSectionAction?.({ principal: input.principal, subject: input.subject,
            stageKey: input.stageKey, section, action: "edit_draft", executor: getDb() });
          await assertCompanyFormSectionEditable({
            principal: input.principal,
            section,
            part: partByUuid.get(section.formPartUuid) ?? { isOfficeOnly: false },
            executor: getDb(),
          });
        } catch {
          canEdit = false;
        }
      }
      const questions = questionsBySection.get(section.sectionUuid) ?? [];
      const required = sectionRequiresSubmission({ ...section, questions });
      const canSign: Partial<Record<CompanyFormSignatureType, boolean>> = {};
      for (const signatureType of ["officer", "seafarer", "vessel_management"] as const) {
        const signatureRequired = signatureType === "officer"
          ? section.signatureOfficerRequired
          : signatureType === "vessel_management" ? section.signatureVesselManagementRequired : section.signatureSeafarerRequired;
        const stagePermitsSigning = !input.adapter.authorizeStageAction ||
          input.adapter.authorizeStageAction(input.principal, "save_signature", input.subject, input.stageKey);
        canSign[signatureType] = applicable && mutable && stagePermitsSigning && input.canSaveSignatureAction &&
          signatureRequired && (input.methodOptions[signatureType]?.length ?? 0) > 0;
        if (canSign[signatureType]) {
          try {
            await assertCompanyFormSectionEditable({
              principal: input.principal, section,
              part: partByUuid.get(section.formPartUuid) ?? { isOfficeOnly: false }, executor: getDb(),
            });
            await input.adapter.authorizeSectionAction?.({ principal: input.principal, subject: input.subject,
              stageKey: input.stageKey, section, action: "save_signature", signatureType,
              signatures: input.signatures.map(row => row.signature ?? row).filter(signature =>
                signature.sectionStateUuid === input.states.find(state => state.sectionUuid === section.sectionUuid)?.sectionStateUuid),
              executor: getDb() });
          } catch { canSign[signatureType] = false; }
        }
      }
      const canProvideRequiredSignatures =
        (!section.signatureOfficerRequired || (input.methodOptions.officer?.length ?? 0) > 0) &&
        (!section.signatureSeafarerRequired || (input.methodOptions.seafarer?.length ?? 0) > 0);
      result[section.sectionUuid] = {
        canEdit,
        canSubmit: canEdit && input.canSubmitAction && required,
        canSign,
      };
    }
    return result;
  }

  private async mapStatesAndAnswers(data: any, formUrl: string, principal: CompanyFormPrincipal, canEdit: boolean) {
    const users = data.signatures.length && canEdit
      ? await getDb().select({ userUuid: masterUsers.userUuid }).from(masterUsers)
        .where(eq(masterUsers.id, principal.userId)).limit(1) : [];
    const statusByState = new Map((data.states as any[]).map(state => [state.sectionStateUuid, state.status]));
    const signaturesByState = new Map<string, CompanyFormSubmissionSectionState["signatures"]>();
    for (const row of data.signatures as any[]) {
      const signatures = signaturesByState.get(row.signature.sectionStateUuid) ?? [];
      signatures.push({
        sectionSignatureUuid: row.signature.sectionSignatureUuid,
        signatureType: row.signature.signatureType,
        signerName: row.signature.signerName,
        signerRank: row.signature.signerRank,
        witnessName: row.signature.witnessName,
        witnessRank: row.signature.witnessRank,
        witnessUserId: row.signature.witnessUserId,
        signerRoleUuid: row.signature.signerRoleUuid,
        signedAt: isoDate(row.signature.signedAt)!,
        signedByUuid: row.signature.signedByUuid,
        signatureMethod: row.signature.signatureMethod,
        canRemove: canEdit && statusByState.get(row.signature.sectionStateUuid) !== "submitted" &&
          ownsCompanyFormSignature(row.signature, principal.userId, users[0]?.userUuid),
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
    const canEdit = await this.canEditSubmission(adapter, principal, subject.context, data.submission.status, data.submission.stageKey);
    const canVoid = await this.canVoidSubmission(adapter, principal, subject.context, data.submission.status);
    const formUrl = `/api/v2/company-form-submissions/${encodeURIComponent(input.submissionUuid)}`;
    const { states, answers } = await this.mapStatesAndAnswers(data, formUrl, principal, canEdit);
    const history = await this.readableHistory(input.req, data.submission);
    return {
      submission: mapSummary({ ...data.submission, formArchivedAt: data.form.archivedAt }, canEdit, canVoid),
      states,
      answers,
      formUrl: `${formUrl}/form`,
      voidedReplacement: history[0]
        ? { label: history[0].label, submissionUuid: history[0].submissionUuid }
        : null,
      replacementHistory: history,
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
    const canEdit = await this.canEditSubmission(adapter, principal, subject.context, data.submission.status, data.submission.stageKey);
    const canVoid = await this.canVoidSubmission(adapter, principal, subject.context, data.submission.status);

    const stages = await adapter.loadStages();
    const stage = data.submission.stageKey
      ? stages.find((candidate) => candidate.stageKey === data.submission.stageKey)
      : undefined;
    const snapshotAt = data.submission.systemSnapshotAt as Date | string | null;
    const dateOfDeclaration = isoCalendarDate(snapshotAt ?? data.submission.createdAt);
    const snapshots = data.systemSnapshots as any[];
    const snapshotByQuestion = new Map<string, any>(snapshots.map((snapshot) => [snapshot.questionUuid, snapshot]));
    const systemSnapshotExists = snapshotAt !== null;
    const hasLegacySignatureOrSubmission = !systemSnapshotExists &&
      ((data.states as any[]).some((state) => state.status === "submitted") ||
        data.hasSignatureHistory === true);
    let systemValuesChanged: boolean | null = systemSnapshotExists ? false : null;
    let systemValuesComparisonError = hasLegacySignatureOrSubmission;
    const usedSystemFieldKeys = new Set((data.questions as any[])
      .filter((question) => question.responseType === "system_field")
      .map((question) => question.systemFieldKey));
    const systemFields: CompanyFormSystemFieldValue[] = [];
    for (const field of adapter.systemFields.filter((declared) => usedSystemFieldKeys.has(declared.key))) {
      if (systemSnapshotExists) {
        const recorded = snapshots.find((snapshot) => snapshot.fieldKey === field.key);
        if (recorded) {
          systemFields.push({
            ...field,
            value: recorded.value,
            systemValue: recorded.systemValue,
            valueOrigin: "frozen_snapshot",
          });
          try {
            const current = await adapter.resolveSystemField(field.key, subject.context, {
              raw: recorded.systemValue == null,
              submission: { dateOfDeclaration },
            });
            if (current !== recorded.value) systemValuesChanged = true;
          } catch {
            systemValuesComparisonError = true;
            if (systemValuesChanged !== true) systemValuesChanged = null;
          }
        } else {
          // A frozen timestamp with no corresponding row is incomplete
          // history. Never replace it with values from the current source.
          systemFields.push({
            ...field,
            value: null,
            valueOrigin: "persisted_snapshot_unavailable",
          });
          systemValuesComparisonError = true;
          if (systemValuesChanged !== true) systemValuesChanged = null;
        }
        continue;
      }
      if (hasLegacySignatureOrSubmission || data.submission.status === "completed" || data.submission.status === "voided") {
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
    const applicableBySection = new Map<string, boolean>();
    for (const section of data.sections as any[]) {
      const frozen = systemSnapshotExists || ["completed", "voided"].includes(data.submission.status);
      const state = (data.states as any[]).find(state => state.sectionUuid === section.sectionUuid);
      const hasSignedState = state && (data.signatures as any[]).some(row => (row.signature ?? row).sectionStateUuid === state.sectionStateUuid);
      if (frozen && !Array.isArray(data.submission.applicableSectionUuids) &&
          parseVesselTypeUuids(section.applicableVesselTypes).length > 0 &&
          state?.status !== "not_applicable" && state?.status !== "submitted" && !hasSignedState) {
        throw new CompanyFormConflictError("Historical vessel-type applicability was not captured. This signed record cannot safely be filtered using current vessel data.");
      }
      applicableBySection.set(
        section.sectionUuid,
        Array.isArray(data.submission.applicableSectionUuids)
          ? data.submission.applicableSectionUuids.includes(section.sectionUuid)
          : systemSnapshotExists || ["completed", "voided"].includes(data.submission.status)
            ? state?.status !== "not_applicable" &&
              (parseVesselTypeUuids(section.applicableVesselTypes).length === 0 ||
                state?.status === "submitted" || !!hasSignedState)
            : await (adapter.isSectionApplicable?.(section, subject.context) ?? true),
      );
    }
    const canSubmitAction = await this.canAuthorizeAction(
      adapter, principal, "submit_section", subject.context,
    );
    const canSaveSignatureAction = await this.canAuthorizeAction(
      adapter, principal, "save_signature", subject.context,
    );
    const signatureMethodOptions = await this.signatureMethodOptions(
      adapter, principal, canSaveSignatureAction,
    );
    const sectionActions = await this.sectionActions({
      adapter, subject: subject.context, stageKey: data.submission.stageKey,
      principal,
      canEditSubmission: canEdit,
      canSubmitAction,
      canSaveSignatureAction: canSaveSignatureAction && data.submission.status === "in_progress",
      signatures: data.signatures as any[],
      sections: data.sections as any[],
      parts: data.parts as any[],
      questions: data.questions as any[],
      states: data.states as any[],
      applicableBySection,
      methodOptions: signatureMethodOptions,
    });
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
        const actions = sectionActions[section.sectionUuid];
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
          signatureVesselManagementRequired: section.signatureVesselManagementRequired,
          vesselSignatureRoleUuids: section.vesselSignatureRoleUuids,
          defaultOptionSetUuid: section.defaultOptionSetUuid,
          layoutPreference: section.layoutPreference,
          effectiveLayout: resolveEffectiveLayout(section, questions, optionSetsByUuid, optionsBySet),
          sortOrder: section.sortOrder,
          requiresSubmission: sectionRequiresSubmission({ ...section, questions }),
          isApplicable: applicableBySection.get(section.sectionUuid) ?? true,
          canEdit: actions?.canEdit ?? false,
          canSubmit: actions?.canSubmit ?? false,
          canSign: actions?.canSign ?? {},
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
              systemField: isSystemField
                ? {
                  ...systemField!,
                  value: snapshotByQuestion.has(question.questionUuid)
                    ? snapshotByQuestion.get(question.questionUuid).value
                    : systemField!.value,
                  valueOrigin: snapshotByQuestion.has(question.questionUuid)
                    ? "frozen_snapshot"
                    : systemField!.valueOrigin,
                }
                : null,
            };
          }),
        };
      }),
    }));

    const formUrl = `/api/v2/company-form-submissions/${encodeURIComponent(input.submissionUuid)}`;
    const { states, answers } = await this.mapStatesAndAnswers(data, formUrl, principal, canEdit);
    const history = await this.readableHistory(input.req, data.submission);
    if (systemValuesComparisonError && systemValuesChanged !== true) systemValuesChanged = null;
    return {
      submission: mapSummary({ ...data.submission, formArchivedAt: data.form.archivedAt }, canEdit, canVoid),
      signatureMethodOptions,
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
      systemSnapshotAt: isoDate(snapshotAt),
      systemSnapshotEvent: data.submission.systemSnapshotEvent,
      systemValuesChanged,
      systemValuesComparisonError,
      systemValuesChangedNotice: systemValuesChanged
        ? "The record has changed since signing began. This declaration shows the values at the time of first signature."
        : null,
      voidedReplacement: history[0]
        ? { label: history[0].label, submissionUuid: history[0].submissionUuid }
        : null,
      replacementHistory: history,
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
      assertSubjectWritable: async (lockedSubject, executor) => {
        try {
          if (!adapter.canStart(lockedSubject.context)) {
            throw new CompanyFormConflictError("This Company Form subject no longer accepts draft edits.");
          }
        } catch (error) {
          if (error instanceof CompanyFormConflictError) throw error;
          throw new CompanyFormConflictError("Unable to verify that this subject still accepts draft edits.");
        }
        await this.authorize(adapter, principal, "edit_draft", lockedSubject.context, executor);
        if (adapter.authorizeStageAction && !adapter.authorizeStageAction(principal, "edit_draft", lockedSubject.context, submission.stageKey)) {
          throw new CompanyFormPermissionError("This actor cannot edit at this stage.");
        }
      },
      assertSectionWritable: async ({ section, part, executor }) => {
        await assertCompanyFormSectionEditable({ principal, section, part, executor });
        const subject = await adapter.lookup(submission.subjectRef, executor);
        if (!subject) throw new CompanyFormPermissionError();
        await adapter.authorizeSectionAction?.({ principal, subject: subject.context, stageKey: submission.stageKey,
          section, action: "edit_draft", executor });
      },
    });
  }

  async submitSection(input: {
    req: Request;
    submissionUuid: string;
    sectionUuid: string;
  }) {
    const { adapter, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "submit_section",
    );
    return companyFormSubmissionLifecycleRepository.submitSection({
      submissionUuid: input.submissionUuid,
      sectionUuid: input.sectionUuid,
      actor: principal,
      adapter,
    });
  }

  async saveSignature(input: {
    req: Request;
    submissionUuid: string;
    sectionUuid: string;
    signatureType: "officer" | "seafarer" | "vessel_management";
    method: "officer" | "authenticated" | "witnessed" | "vessel_management";
    data: string;
    seafarerPresent?: boolean;
  }) {
    const { adapter, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "save_signature",
    );
    await adapter.authorizeSignature?.(principal, input.signatureType);
    // The version is immutable. Reject foreign/unconfigured sections before
    // writing a file; the locked repository repeats this check authoritatively.
    const pinned = await this.renderRepository.readPinnedRenderData(input.submissionUuid);
    if (!pinned) throw new CompanyFormNotFoundError("Company Form submission not found.");
    if (pinned.submission.status !== "in_progress") {
      throw new CompanyFormConflictError("This Company Form no longer accepts signatures.");
    }
    const section = (pinned.sections as any[]).find((candidate) => candidate.sectionUuid === input.sectionUuid);
    if (!section) throw new CompanyFormValidationError("Section does not belong to this pinned submission.");
    assertCompanyFormSignatureConfigured(section, input.signatureType);
    if (input.method === "witnessed" && input.seafarerPresent !== true) {
      throw new CompanyFormValidationError("Confirm the Seafarer is present before recording a witnessed signature.");
    }
    if (input.method !== "witnessed" && input.seafarerPresent !== undefined) {
      throw new CompanyFormValidationError("Seafarer presence may only be supplied for a witnessed signature.");
    }
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data);
    if (!match || input.data.length > Math.ceil(5 * 1024 * 1024 * 4 / 3) + 100) {
      throw new CompanyFormValidationError("Signature must be a PNG data URL within the size limit.");
    }
    const bytes = Buffer.from(match[1], "base64");
    const mimeType = fileStorageService.detectMimeBySignature(bytes);
    if (!mimeType || mimeType !== "image/png" || bytes.length > fileStorageService.MAX_ATTACHMENT_BYTES) {
      throw new CompanyFormValidationError("Signature must be a valid PNG within the size limit.");
    }
    const attachmentUuid = randomUUID();
    const filePath = await fileStorageService.writeAttachment(
      "company-forms/signatures",
      "signature.png",
      bytes,
    );
    try {
      return await companyFormSubmissionLifecycleRepository.saveSignature({
        submissionUuid: input.submissionUuid,
        sectionUuid: input.sectionUuid,
        signatureType: input.signatureType,
        method: input.method,
        attachment: {
          uuid: attachmentUuid,
          path: filePath,
          fileName: "signature.png",
          fileType: mimeType,
          fileSize: bytes.length,
        },
        actor: principal,
        adapter,
      });
    } catch (error) {
      await fileStorageService.deleteAttachment(filePath);
      throw error;
    }
  }

  async removeSignature(input: {
    req: Request;
    submissionUuid: string;
    sectionUuid: string;
    signatureUuid: string;
  }) {
    const { adapter, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "remove_signature",
    );
    return companyFormSubmissionLifecycleRepository.removeSignature({
      submissionUuid: input.submissionUuid,
      sectionUuid: input.sectionUuid,
      signatureUuid: input.signatureUuid,
      actor: principal,
      adapter,
    });
  }

  async voidSubmission(input: {
    req: Request;
    submissionUuid: string;
    reason: string;
    retirementConfirmedAt?: string;
  }) {
    const { adapter, principal } = await this.authorizeSubmission(
      input.req,
      input.submissionUuid,
      "void_submission",
    );
    return companyFormSubmissionLifecycleRepository.voidSubmission({
      submissionUuid: input.submissionUuid,
      reason: input.reason,
      retirementConfirmedAt: input.retirementConfirmedAt,
      actor: principal,
      adapter,
    });
  }

  async dimensions(input: { req: Request; subjectType: string; subjectRef: string }) {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "read_eligible_forms", subject.context);
    if (!adapter.readRuleDimensions) throw new CompanyFormValidationError("This subject does not declare rule dimensions");
    return adapter.readRuleDimensions(subject.context, getDb());
  }

  async eligibleForms(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
    stageKey?: string;
  }): Promise<EligibleCompanyForm[]> {
    const adapter = this.contextAdapter(input.req, input.subjectType);
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
    if (input.subjectType === "crew_assignment") await assertStageReady(input.subjectRef, stageKey);
    const eligible = await this.repository.findEligibleForms(input.subjectType, stageKey);
    const required = (await getDb().execute(sql`SELECT form_uuid FROM frm_requirements
      WHERE subject_type=${input.subjectType} AND subject_ref=${input.subjectRef}
      AND stage_key IS NOT DISTINCT FROM ${stageKey} AND status<>'WITHDRAWN'`)).rows as { form_uuid: string }[];
    return eligible.filter(form => !required.some(r => r.form_uuid === form.formUuid));
  }

  async create(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
    formUuid: string;
    formVersionUuid: string;
  }): Promise<CompanyFormSubmissionRow> {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const submission = await this.repository.createPinnedSubmission({
      adapter,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      formUuid: input.formUuid,
      formVersionUuid: input.formVersionUuid,
      actorUuid: String(principal.userId),
      authorizeLockedSubject: async (subject) => {
        await this.authorize(adapter, principal, "create_submission", subject.context);
      },
      authorizeLockedVersion: async (subject, stageKey, executor) => {
        if (adapter.authorizeStageAction && !adapter.authorizeStageAction(principal, "create_submission", subject.context, stageKey)) {
          throw new CompanyFormPermissionError("This actor cannot start a form at this stage.");
        }
        await adapter.authorizeVersionStart?.({ principal, subject: subject.context,
          stageKey, formVersionUuid: input.formVersionUuid, executor });
      },
    });
    return submission;
  }

  async requirements(input: { req: Request; subjectType: string; subjectRef: string }) {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "list_submissions", subject.context);
    const data = await readRequirements(input.subjectType, input.subjectRef);
    const outstandingEligible = adapter.isOutstanding(subject.context);
    let canRetry = false;
    try { await this.authorize(adapter, principal, "create_submission", subject.context); canRetry = true; } catch { /* view does not imply Fill in */ }
    return { ...data, stageChecks: input.subjectType === "crew_assignment" ? { ...await stageStatus(input.subjectRef), canRetry } : null, outstandingEligible,
      activeRequirements: outstandingEligible
        ? data.requirements.filter((r: any) => ["OUTSTANDING", "STARTED", "UNRESOLVED"].includes(r.status)) : [] };
  }

  async retryStageCheck(input: { req: Request; subjectType: string; subjectRef: string; eventUuid: string }) {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form assignment not found.");
    // Same assignment-scoped Fill in authorization as starting. Authoring is not consulted.
    await this.authorize(adapter, principal, "create_submission", subject.context);
    const event = (await getDb().execute(sql`SELECT event_uuid FROM frm_stage_events WHERE event_uuid=${input.eventUuid}
      AND subject_ref=${input.subjectRef}`)).rows[0];
    if (!event || input.subjectType !== "crew_assignment") throw new CompanyFormNotFoundError("Stage check not found.");
    return resolveStageEvent(event.event_uuid, String(principal.userId));
  }

  async startRequirement(input: { req: Request; subjectType: string; subjectRef: string; requirementUuid: string }) {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const requirement = (await getDb().execute(sql`SELECT * FROM frm_requirements WHERE requirement_uuid=${input.requirementUuid}
      AND subject_type=${input.subjectType} AND subject_ref=${input.subjectRef}`)).rows[0];
    if (!requirement) throw new CompanyFormNotFoundError("Form requirement not found.");
    return this.repository.createPinnedSubmission({
      adapter, subjectType: input.subjectType, subjectRef: input.subjectRef,
      requirementUuid: input.requirementUuid, formUuid: requirement.form_uuid,
      formVersionUuid: requirement.form_version_uuid, actorUuid: String(principal.userId),
      authorizeLockedSubject: async subject => {
        await this.authorize(adapter, principal, "create_submission", subject.context);
      },
      authorizeLockedVersion: async (subject, stageKey, executor) => {
        if (adapter.authorizeStageAction && !adapter.authorizeStageAction(principal, "create_submission", subject.context, stageKey))
          throw new CompanyFormPermissionError("This actor cannot start a form at this stage.");
        await adapter.authorizeVersionStart?.({ principal, subject: subject.context, stageKey,
          formVersionUuid: requirement.form_version_uuid, executor });
      },
    });
  }

  async listForSubject(input: {
    req: Request;
    subjectType: string;
    subjectRef: string;
  }) {
    const adapter = this.contextAdapter(input.req, input.subjectType);
    const principal = await this.resolvePrincipal(input.req);
    const subject = await adapter.lookup(input.subjectRef);
    if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
    await this.authorize(adapter, principal, "list_submissions", subject.context);

    const rows = await this.repository.listForSubjects(
      input.subjectType,
      [subject.subjectRef],
    );
    const classified = classifyOutstanding(adapter, subject, rows);
    return {
      subjectType: input.subjectType,
      subjectRef: subject.subjectRef,
      ...classified,
      submissions: await Promise.all(classified.submissions.map(async row => ({
        ...row,
        canEdit: await this.canEditSubmission(adapter, principal, subject.context, row.status, row.stageKey),
        replacementHistory: await this.readableHistory(input.req, row),
      }))),
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

    const groups = (await Promise.all(permittedSubjects.map(async (subject) => {
      const classified = classifyOutstanding(adapter, subject, rowsBySubject.get(subject.subjectRef) ?? []);
      return {
        subjectRef: subject.subjectRef,
        display: adapter.homeGroupDisplay?.(subject.context),
        ...await adapter.homeActions?.(principal, subject.context),
        ...classified,
        submissions: await Promise.all(classified.submissions.map(async row => ({
          ...row,
          canEdit: await this.canEditSubmission(adapter, principal, subject.context, row.status, row.stageKey),
          replacementHistory: await this.readableHistory(input.req, row),
        }))),
      };
    }))).filter(group => !group.display?.historyOnly || group.totalCount > 0);
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