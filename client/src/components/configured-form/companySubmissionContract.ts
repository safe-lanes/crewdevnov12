import { sailUtcTimestamp } from "@shared/v2/forms-engine/displayFormatting";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  CompanyFormRenderPart,
  CompanyFormRenderSection,
  CompanyFormSubmissionRenderContract,
  CompanyFormSubmissionSectionState,
} from "@shared/v2/forms-engine/submissionRenderContract";
import { apiRequest } from "@/lib/queryClient";
import {
  ConfiguredFormRenderer,
  type ConfiguredFormAnswerValue,
  type ConfiguredFormPart,
  type ConfiguredFormQuestion,
  type ConfiguredFormSection,
} from "./ConfiguredFormRenderer";

export type CompanySubmissionRenderView = CompanyFormSubmissionRenderContract;

export interface CompanySubmissionDraftAnswer {
  questionUuid: string;
  value: ConfiguredFormAnswerValue | null;
  comment?: string;
}

export interface CompanySubmissionDraftInput {
  answers: readonly CompanySubmissionDraftAnswer[];
  sectionComment?: string;
}

export interface CompanySubmissionRendererModel {
  submissionUuid: string;
  status: CompanyFormSubmissionRenderContract["submission"]["status"];
  title: string;
  versionLabel: string;
  subjectType: string;
  parts: ConfiguredFormPart[];
  structures: Record<string, ConfiguredFormSection[]>;
  roles: Array<{ ruid: string; assignedRole?: string }>;
  departments: string[];
  vesselTypes: Array<{ vtUuid: string; name?: string }>;
  answers: Record<string, ConfiguredFormAnswerValue>;
  answerComments: Record<string, string | null>;
  sectionComments: Record<string, string>;
  questionSections: Record<string, string>;
  questionResponseTypes: Record<string, CompanyFormRenderSection["questions"][number]["responseType"]>;
  sectionStates: Record<string, {
    status: "not_started" | "submitted" | "not_applicable";
    sectionComment?: string | null;
    submittedByName?: string | null;
    submittedAt?: string | null;
    signatures?: Record<string, {
      signatureAttUuid: string;
      signatureName?: string | null;
      signatureRank?: string | null;
      signedAt?: string | null;
      signatureUrl: string;
    }>;
  }>;
  readOnly: boolean;
}

const companySubmissionDraftQueues = new Map<string, Promise<void>>();

function draftQueueKey(submissionUuid: string, sectionUuid: string): string {
  return `${submissionUuid}\u0000${sectionUuid}`;
}

export function saveCompanySubmissionDraft(
  submissionUuid: string,
  sectionUuid: string,
  draft: CompanySubmissionDraftInput,
): Promise<void> {
  const answers = draft.answers.map((answer) => ({
    questionUuid: answer.questionUuid,
    value: answer.value,
    ...(answer.comment !== undefined ? { comment: answer.comment } : {}),
  }));
  const key = draftQueueKey(submissionUuid, sectionUuid);
  const previous = companySubmissionDraftQueues.get(key) ?? Promise.resolve();
  const scheduled = previous
    .catch(() => undefined)
    .then(() => apiRequest(
      "PUT",
      `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/sections/${encodeURIComponent(sectionUuid)}/answers`,
      {
        answers,
        ...(draft.sectionComment !== undefined ? { sectionComment: draft.sectionComment } : {}),
      },
    ))
    .then(() => undefined);
  const queueTail = scheduled.catch(() => undefined);
  companySubmissionDraftQueues.set(key, queueTail);
  void queueTail.then(() => {
    if (companySubmissionDraftQueues.get(key) === queueTail) {
      companySubmissionDraftQueues.delete(key);
    }
  });
  return scheduled;
}

export function flushCompanySubmissionDrafts(
  submissionUuid: string,
  sectionUuid: string,
): Promise<void> {
  return companySubmissionDraftQueues.get(draftQueueKey(submissionUuid, sectionUuid)) ?? Promise.resolve();
}

function answerValuesEqual(
  left: ConfiguredFormAnswerValue | null | undefined,
  right: ConfiguredFormAnswerValue | null | undefined,
): boolean {
  if (Object.is(left, right)) return true;
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function parseAnswer(
  question: CompanyFormRenderSection["questions"][number] | undefined,
  raw: string | null,
): ConfiguredFormAnswerValue | undefined {
  if (raw === null) return undefined;
  if (!question) {
    throw new Error("Corrupt persisted Company Form answer references an unknown question.");
  }
  const corrupt = () => new Error(
    `Corrupt persisted ${question.responseType} answer for Company Form question ${question.questionUuid}.`,
  );
  if (question.responseType === "checkbox") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw corrupt();
  }
  if (question.responseType === "multi_select") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw corrupt();
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw corrupt();
    }
    return parsed;
  }
  if ([
    "yes_no",
    "yes_no_na",
    "single_select",
    "free_text",
    "date",
    "number",
  ].includes(question.responseType)) return raw;
  throw corrupt();
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function mapQuestion(
  question: CompanyFormRenderSection["questions"][number],
  optionSets: CompanyFormSubmissionRenderContract["optionSets"],
): ConfiguredFormQuestion {
  if (question.responseType === "system_field" && question.systemField) {
    // The existing shared renderer's System fields are prompts to fill. For a
    // pinned submission they are immutable resolved data; map them to the
    // renderer's safe HTML content primitive so the point shows its frozen
    // label and value rather than asking for an answer again.
    return {
      question_uuid: question.questionUuid,
      question_code: question.questionCode,
      question_text: question.systemField.label,
      content_html: `<p>${escapeHtml(question.systemField.value ?? "—")}</p>`,
      response_type: "content",
      is_mandatory: false,
      comment_enabled: false,
      options: [],
    };
  }
  return {
    question_uuid: question.questionUuid,
    question_code: question.questionCode,
    question_text: question.questionText,
    content_html: question.contentHtml,
    system_field_key: question.systemFieldKey,
    response_type: question.responseType,
    is_mandatory: question.isMandatory,
    comment_enabled: question.commentEnabled,
    option_set_uuid: question.optionSetUuid,
    low_end_label: optionSets.find((set) => set.optionSetUuid === question.optionSetUuid)?.lowEndLabel,
    high_end_label: optionSets.find((set) => set.optionSetUuid === question.optionSetUuid)?.highEndLabel,
    options: [...question.options]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        option_uuid: option.optionUuid,
        option_label: option.optionLabel,
        option_value: option.optionValue,
      })),
  };
}

function mapSection(
  section: CompanyFormRenderSection,
  optionSets: CompanyFormSubmissionRenderContract["optionSets"],
): ConfiguredFormSection {
  return {
    section_uuid: section.sectionUuid,
    section_code: section.sectionCode,
    section_title: section.sectionTitle,
    applicable_vessel_types: section.applicableVesselTypes.map((type) => type.vesselTypeUuid),
    responsible_mode: section.responsibleMode as ConfiguredFormSection["responsible_mode"],
    responsible_role_uuid: section.responsibleRoleUuid,
    responsible_role_name: section.responsibleRole?.roleName,
    responsible_department: section.responsibleDepartment,
    comment_box_required: section.commentBoxRequired,
    signature_officer_required: section.signatureOfficerRequired,
    signature_seafarer_required: section.signatureSeafarerRequired,
    signature_vessel_management_required: section.signatureVesselManagementRequired,
    requires_submission: section.requiresSubmission,
    is_applicable: section.isApplicable,
    can_submit: section.canSubmit,
    can_edit: section.canEdit,
    can_sign: section.canSign,
    default_option_set_uuid: section.defaultOptionSetUuid,
    layout_preference: section.layoutPreference as ConfiguredFormSection["layout_preference"],
    effectiveLayout: section.effectiveLayout,
    questions: section.questions.map((question) => mapQuestion(question, optionSets)),
  };
}

function mapPart(part: CompanyFormRenderPart): ConfiguredFormPart {
  return {
    formPartUuid: part.formPartUuid,
    partCode: part.partCode,
    partTitle: part.partTitle,
    // Company Form parts are content containers, including those historically
    // marked "fixed" by the editor. Never ask the Standard Form fixed-part
    // registry to supply Company submission content.
    partType: "configurable",
    isOfficeOnly: part.isOfficeOnly,
  };
}

function mapSignatureState(state: CompanyFormSubmissionSectionState) {
  const signatures = Object.fromEntries(state.signatures.map((signature) => [
    signature.signatureType,
    {
      signatureAttUuid: signature.attachment.assetUuid,
      signatureName: signature.signerName,
      signatureRank: signature.signerRank,
      witnessedByName: signature.witnessName,
      witnessedByRank: signature.witnessRank,
      signedAt: signature.signedAt,
      signatureUrl: signature.attachment.rawUrl,
    },
  ]));
  return signatures;
}

export function mapCompanySubmissionForm(contract: CompanySubmissionRenderView): CompanySubmissionRendererModel {
  const parts = contract.parts.map(mapPart);
  const structures = Object.fromEntries(contract.parts.map((part) => [
    part.formPartUuid,
    part.sections.map((section) => mapSection(section, contract.optionSets)),
  ]));
  const questionsByUuid = new Map(
    contract.parts.flatMap((part) => part.sections.flatMap((section) =>
      section.questions.map((question) => [question.questionUuid, question] as const),
    )),
  );
  const questionResponseTypes = Object.fromEntries([...questionsByUuid].map(([questionUuid, question]) => [
    questionUuid,
    question.responseType,
  ]));
  const answers: Record<string, ConfiguredFormAnswerValue> = {};
  const answerComments: Record<string, string | null> = {};
  for (const answer of contract.answers) {
    const value = parseAnswer(questionsByUuid.get(answer.questionUuid), answer.answerValue);
    if (value !== undefined) answers[answer.questionUuid] = value;
    answerComments[answer.questionUuid] = answer.answerComment;
  }
  const sectionComments: Record<string, string> = {};
  const questionSections: Record<string, string> = {};
  const sectionStates: CompanySubmissionRendererModel["sectionStates"] = {};
  const roles = new Map<string, string>();
  const departments = new Set<string>();
  const vesselTypes = new Map<string, string>();
  for (const part of contract.parts) {
    for (const section of part.sections) {
      for (const question of section.questions) questionSections[question.questionUuid] = section.sectionUuid;
      if (section.responsibleRole) {
        roles.set(section.responsibleRole.roleUuid, section.responsibleRole.roleName);
      }
      if (section.responsibleDepartment) departments.add(section.responsibleDepartment);
      for (const vesselType of section.applicableVesselTypes) {
        if (vesselType.vesselType) vesselTypes.set(vesselType.vesselTypeUuid, vesselType.vesselType);
      }
    }
  }
  for (const state of contract.states) {
    sectionComments[state.sectionUuid] = state.sectionComment ?? "";
    sectionStates[state.sectionUuid] = {
      status: state.status === "submitted" || state.status === "not_applicable"
        ? state.status
        : "not_started",
      sectionComment: state.sectionComment,
      submittedByName: state.submittedByName,
      submittedAt: state.submittedAt,
      signatures: mapSignatureState(state),
    };
  }
  const readOnly = contract.submission.status !== "in_progress" || !contract.submission.canEdit;

  return {
    submissionUuid: contract.submission.submissionUuid,
    status: contract.submission.status,
    title: contract.form.formName,
    versionLabel: contract.version.versionNo,
    subjectType: contract.submission.subjectType,
    parts,
    structures,
    roles: [...roles].map(([ruid, assignedRole]) => ({ ruid, assignedRole })),
    departments: [...departments],
    vesselTypes: [...vesselTypes].map(([vtUuid, name]) => ({ vtUuid, name })),
    answers,
    answerComments,
    sectionComments,
    questionSections,
    questionResponseTypes,
    sectionStates,
    readOnly,
  };
}

function persistedDraftValue(
  questionUuid: string,
  value: ConfiguredFormAnswerValue | undefined,
  responseTypes: CompanySubmissionRendererModel["questionResponseTypes"],
): ConfiguredFormAnswerValue | null {
  const responseType = responseTypes[questionUuid];
  if (value === undefined) return null;
  if (value === "" && (responseType === "date" || responseType === "number")) return null;
  return value;
}

export async function fetchCompanySubmissionForm(submissionUuid: string): Promise<CompanySubmissionRenderView> {
  const response = await apiRequest(
    "GET",
    `/api/v2/company-form-submissions/${encodeURIComponent(submissionUuid)}/form`,
  );
  return await response.json() as CompanySubmissionRenderView;
}

export function CompanySubmissionRenderer({
  submissionUuid,
  onBack,
  onAnswerChange,
  onAnswerCommentChange,
}: {
  submissionUuid: string;
  onBack?: () => void;
  onAnswerChange?: (questionUuid: string, value: ConfiguredFormAnswerValue) => void;
  onAnswerCommentChange?: (questionUuid: string, comment: string) => void;
}) {
  const [activeSubmissionUuid, setActiveSubmissionUuid] = useState(submissionUuid);
  const originalSubmissionUuid = useRef(submissionUuid);
  const activeSubmissionUuidRef = useRef(activeSubmissionUuid);
  const activeSubmissionStatusRef = useRef<CompanySubmissionRendererModel["status"] | undefined>();
  useEffect(() => {
    setActiveSubmissionUuid(submissionUuid);
    originalSubmissionUuid.current = submissionUuid;
  }, [submissionUuid]);
  useEffect(() => {
    activeSubmissionUuidRef.current = activeSubmissionUuid;
    activeSubmissionStatusRef.current = undefined;
    answerRevisionsRef.current = {};
    answerCommentRevisionsRef.current = {};
    sectionCommentRevisionsRef.current = {};
    acknowledgedAnswerRevisionsRef.current = {};
    acknowledgedAnswerCommentRevisionsRef.current = {};
    acknowledgedSectionCommentRevisionsRef.current = {};
  }, [activeSubmissionUuid]);
  const form = useQuery({
    queryKey: ["company-form-submission-form", activeSubmissionUuid],
    queryFn: () => fetchCompanySubmissionForm(activeSubmissionUuid),
    retry: false,
    enabled: !!activeSubmissionUuid,
  });
  const lifecycleForm = form.data;
  const model = useMemo(
    () => {
      if (!form.data) return { model: undefined, error: undefined };
      try {
        return { model: mapCompanySubmissionForm(form.data), error: undefined };
      } catch (error: unknown) {
        return {
          model: undefined,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    [form.data],
  );
  const mappingError = model.error;
  const rendererModel = model.model;
  const [draftAnswers, setDraftAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({});
  const [draftAnswerComments, setDraftAnswerComments] = useState<Record<string, string | null>>({});
  const [draftSectionComments, setDraftSectionComments] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [sectionSubmitting, setSectionSubmitting] = useState<Record<string, boolean>>({});
  const [sectionActionErrors, setSectionActionErrors] = useState<Record<string, string>>({});
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [selectedPartUuid, setSelectedPartUuid] = useState("");
  const draftAnswersRef = useRef(draftAnswers);
  const draftAnswerCommentsRef = useRef(draftAnswerComments);
  const draftSectionCommentsRef = useRef(draftSectionComments);
  const draftRevisionCounterRef = useRef(0);
  const answerRevisionsRef = useRef<Record<string, number>>({});
  const answerCommentRevisionsRef = useRef<Record<string, number>>({});
  const sectionCommentRevisionsRef = useRef<Record<string, number>>({});
  const lockedSectionUuidsRef = useRef(new Set<string>());
  const acknowledgedAnswerRevisionsRef = useRef<Record<string, number>>({});
  const acknowledgedAnswerCommentRevisionsRef = useRef<Record<string, number>>({});
  const acknowledgedSectionCommentRevisionsRef = useRef<Record<string, number>>({});
  const saveSequencesRef = useRef<Record<string, number>>({});
  const explicitDraftSaveKeysRef = useRef(new Set<string>());
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!rendererModel || rendererModel.submissionUuid !== activeSubmissionUuid) return;
    activeSubmissionStatusRef.current = rendererModel.status;
    const lockedSectionUuids = new Set(Object.entries(rendererModel.sectionStates)
      .filter(([, state]) => state.status === "submitted" || state.status === "not_applicable")
      .map(([sectionUuid]) => sectionUuid));
    lockedSectionUuidsRef.current = lockedSectionUuids;
    if (rendererModel.status !== "in_progress") {
      answerRevisionsRef.current = {};
      answerCommentRevisionsRef.current = {};
      sectionCommentRevisionsRef.current = {};
    lockedSectionUuidsRef.current = new Set();
      acknowledgedAnswerRevisionsRef.current = {};
      acknowledgedAnswerCommentRevisionsRef.current = {};
      acknowledgedSectionCommentRevisionsRef.current = {};
      lockedSectionUuidsRef.current = new Set(Object.keys(rendererModel.sectionStates));
      draftAnswersRef.current = rendererModel.answers;
      draftAnswerCommentsRef.current = rendererModel.answerComments;
      draftSectionCommentsRef.current = rendererModel.sectionComments;
      setDraftAnswers(rendererModel.answers);
      setDraftAnswerComments(rendererModel.answerComments);
      setDraftSectionComments(rendererModel.sectionComments);
      setSaveErrors((current) => {
        const next = { ...current };
        for (const key of Object.keys(next)) {
          if (key.startsWith(`${activeSubmissionUuid}\u0000`)) delete next[key];
        }
        return next;
      });
      setSectionActionErrors({});
      setSelectedPartUuid((current) => rendererModel.parts.some((part) => part.formPartUuid === current)
        ? current
        : rendererModel.parts[0]?.formPartUuid ?? "");
      return;
    }
    const answers = { ...rendererModel.answers };
    for (const [questionUuid, revision] of Object.entries(answerRevisionsRef.current)) {
      if (lockedSectionUuids.has(rendererModel.questionSections[questionUuid])) {
        delete answerRevisionsRef.current[questionUuid];
        delete acknowledgedAnswerRevisionsRef.current[questionUuid];
        continue;
      }
      const localValue = draftAnswersRef.current[questionUuid];
      const persistedValue = persistedDraftValue(questionUuid, localValue, rendererModel.questionResponseTypes);
      const serverValue = rendererModel.answers[questionUuid];
      const matchesServer = persistedValue === null
        ? serverValue === undefined
        : answerValuesEqual(serverValue, persistedValue);
      if (revision <= (acknowledgedAnswerRevisionsRef.current[questionUuid] ?? 0) && matchesServer) {
        delete answerRevisionsRef.current[questionUuid];
        delete acknowledgedAnswerRevisionsRef.current[questionUuid];
      } else if (localValue !== undefined) {
        answers[questionUuid] = localValue;
      }
    }
    const answerComments = { ...rendererModel.answerComments };
    for (const [questionUuid, revision] of Object.entries(answerCommentRevisionsRef.current)) {
      if (lockedSectionUuids.has(rendererModel.questionSections[questionUuid])) {
        delete answerCommentRevisionsRef.current[questionUuid];
        delete acknowledgedAnswerCommentRevisionsRef.current[questionUuid];
        continue;
      }
      const localComment = draftAnswerCommentsRef.current[questionUuid];
      const serverComment = rendererModel.answerComments[questionUuid];
      const matchesServer = localComment === ""
        ? serverComment === null || serverComment === undefined || serverComment === ""
        : localComment === serverComment;
      if (revision <= (acknowledgedAnswerCommentRevisionsRef.current[questionUuid] ?? 0) && matchesServer) {
        delete answerCommentRevisionsRef.current[questionUuid];
        delete acknowledgedAnswerCommentRevisionsRef.current[questionUuid];
      } else if (localComment !== undefined) {
        answerComments[questionUuid] = localComment;
      }
    }
    const sectionComments = { ...rendererModel.sectionComments };
    for (const [sectionUuid, revision] of Object.entries(sectionCommentRevisionsRef.current)) {
      if (lockedSectionUuids.has(sectionUuid)) {
        delete sectionCommentRevisionsRef.current[sectionUuid];
        delete acknowledgedSectionCommentRevisionsRef.current[sectionUuid];
        continue;
      }
      const localComment = draftSectionCommentsRef.current[sectionUuid];
      const serverComment = rendererModel.sectionComments[sectionUuid] ?? "";
      if (revision <= (acknowledgedSectionCommentRevisionsRef.current[sectionUuid] ?? 0)
        && localComment === serverComment) {
        delete sectionCommentRevisionsRef.current[sectionUuid];
        delete acknowledgedSectionCommentRevisionsRef.current[sectionUuid];
      } else if (localComment !== undefined) {
        sectionComments[sectionUuid] = localComment;
      }
    }
    draftAnswersRef.current = answers;
    draftAnswerCommentsRef.current = answerComments;
    draftSectionCommentsRef.current = sectionComments;
    setDraftAnswers(answers);
    setDraftAnswerComments(answerComments);
    setDraftSectionComments(sectionComments);
    setSaveErrors((current) => {
      const next = { ...current };
      const submissionPrefix = `${activeSubmissionUuid}\u0000`;
      for (const key of Object.keys(next)) {
        if (key.startsWith(submissionPrefix)
          && lockedSectionUuids.has(key.slice(submissionPrefix.length))) delete next[key];
      }
      return next;
    });
    setSectionActionErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([sectionUuid]) => !lockedSectionUuids.has(sectionUuid)),
    ));
    setSelectedPartUuid((current) => rendererModel.parts.some((part) => part.formPartUuid === current)
      ? current
      : rendererModel.parts[0]?.formPartUuid ?? "");
  }, [activeSubmissionUuid, rendererModel]);

  if (form.isPending) return React.createElement("div", { role: "status" }, "Loading Company Form…");
  if (form.error) return React.createElement(
    "div",
    { role: "alert", className: "flex items-start gap-2 text-sm text-destructive" },
    React.createElement(AlertCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }),
    React.createElement("span", null, form.error.message),
  );
  if (mappingError) {
    return React.createElement(
      "div",
      { role: "alert", className: "text-sm text-destructive" },
      `Unable to read persisted Company Form answers: ${mappingError}`,
    );
  }
  if (!rendererModel || !rendererModel.parts.length) {
    return React.createElement("div", { role: "alert" }, "The pinned Company Form has no readable form parts.");
  }
  const activePartUuid = rendererModel.parts.some((part) => part.formPartUuid === selectedPartUuid)
    ? selectedPartUuid
    : rendererModel.parts[0].formPartUuid;

  const reportSaveFailure = (error: unknown) => {
    return error instanceof Error ? error.message : String(error);
  };
  const save = (
    sectionUuid: string,
    draft: CompanySubmissionDraftInput,
    purpose: "autosave" | "explicit" = "autosave",
  ): Promise<void> => {
    const key = draftQueueKey(activeSubmissionUuid, sectionUuid);
    const saveSubmissionUuid = activeSubmissionUuid;
    const sequence = (saveSequencesRef.current[key] ?? 0) + 1;
    saveSequencesRef.current[key] = sequence;
    const answerRevisions = new Map<string, number>();
    const answerCommentRevisions = new Map<string, number>();
    for (const answer of draft.answers) {
      const answerRevision = answerRevisionsRef.current[answer.questionUuid];
      if (answerRevision !== undefined) answerRevisions.set(answer.questionUuid, answerRevision);
      if (answer.comment !== undefined) {
        const commentRevision = answerCommentRevisionsRef.current[answer.questionUuid];
        if (commentRevision !== undefined) answerCommentRevisions.set(answer.questionUuid, commentRevision);
      }
    }
    const sectionCommentRevision = draft.sectionComment === undefined
      ? undefined
      : sectionCommentRevisionsRef.current[sectionUuid];
    return saveCompanySubmissionDraft(activeSubmissionUuid, sectionUuid, draft).then(
      () => {
        if (activeSubmissionUuidRef.current === saveSubmissionUuid
          && activeSubmissionStatusRef.current === "in_progress"
          && !lockedSectionUuidsRef.current.has(sectionUuid)) {
          for (const [questionUuid, revision] of answerRevisions) {
            acknowledgedAnswerRevisionsRef.current[questionUuid] = Math.max(
              acknowledgedAnswerRevisionsRef.current[questionUuid] ?? 0,
              revision,
            );
          }
          for (const [questionUuid, revision] of answerCommentRevisions) {
            acknowledgedAnswerCommentRevisionsRef.current[questionUuid] = Math.max(
              acknowledgedAnswerCommentRevisionsRef.current[questionUuid] ?? 0,
              revision,
            );
          }
          if (sectionCommentRevision !== undefined) {
            acknowledgedSectionCommentRevisionsRef.current[sectionUuid] = Math.max(
              acknowledgedSectionCommentRevisionsRef.current[sectionUuid] ?? 0,
              sectionCommentRevision,
            );
          }
        }
        if (!isMountedRef.current || activeSubmissionUuidRef.current !== saveSubmissionUuid
          || activeSubmissionStatusRef.current !== "in_progress"
          || lockedSectionUuidsRef.current.has(sectionUuid)
          || saveSequencesRef.current[key] !== sequence) return;
        if (purpose === "autosave" && explicitDraftSaveKeysRef.current.has(key)) return;
        setSaveErrors((current) => {
          if (!(key in current)) return current;
          const next = { ...current };
          delete next[key];
          return next;
        });
      },
      (error: unknown) => {
        if (!isMountedRef.current || activeSubmissionUuidRef.current !== saveSubmissionUuid
          || activeSubmissionStatusRef.current !== "in_progress"
          || lockedSectionUuidsRef.current.has(sectionUuid)
          || saveSequencesRef.current[key] !== sequence) return;
        setSaveErrors((current) => ({
          ...current,
          [key]: reportSaveFailure(error),
        }));
        throw error;
      },
    );
  };
  const handleAnswerChange = (questionUuid: string, value: ConfiguredFormAnswerValue) => {
    answerRevisionsRef.current[questionUuid] = ++draftRevisionCounterRef.current;
    draftAnswersRef.current = { ...draftAnswersRef.current, [questionUuid]: value };
    setDraftAnswers((current) => ({ ...current, [questionUuid]: value }));
    const sectionUuid = rendererModel.questionSections[questionUuid];
    if (sectionUuid && !rendererModel.readOnly) {
      const comment = draftAnswerCommentsRef.current[questionUuid];
      void save(sectionUuid, {
        answers: [{
          questionUuid,
          value: persistedDraftValue(questionUuid, value, rendererModel.questionResponseTypes),
          ...(comment !== null && comment !== undefined ? { comment } : {}),
        }],
      }).catch(() => undefined);
    }
    onAnswerChange?.(questionUuid, value);
  };
  const handleAnswerCommentChange = (questionUuid: string, comment: string) => {
    answerCommentRevisionsRef.current[questionUuid] = ++draftRevisionCounterRef.current;
    draftAnswerCommentsRef.current = { ...draftAnswerCommentsRef.current, [questionUuid]: comment };
    setDraftAnswerComments((current) => ({ ...current, [questionUuid]: comment }));
    const sectionUuid = rendererModel.questionSections[questionUuid];
    const value = draftAnswersRef.current[questionUuid];
    if (sectionUuid && !rendererModel.readOnly) {
      void save(sectionUuid, {
        answers: [{
          questionUuid,
          value: persistedDraftValue(questionUuid, value, rendererModel.questionResponseTypes),
          comment,
        }],
      }).catch(() => undefined);
    }
    onAnswerCommentChange?.(questionUuid, comment);
  };
  const handleSectionCommentChange = (sectionUuid: string, comment: string) => {
    sectionCommentRevisionsRef.current[sectionUuid] = ++draftRevisionCounterRef.current;
    draftSectionCommentsRef.current = { ...draftSectionCommentsRef.current, [sectionUuid]: comment };
    setDraftSectionComments((current) => ({ ...current, [sectionUuid]: comment }));
    if (!rendererModel.readOnly) void save(sectionUuid, { answers: [], sectionComment: comment }).catch(() => undefined);
  };
  const handleSaveDraft = async (sectionUuid: string) => {
    const section = Object.values(rendererModel.structures)
      .flat()
      .find((candidate) => candidate.section_uuid === sectionUuid);
    if (!section || rendererModel.readOnly) return;
    const queueKey = draftQueueKey(activeSubmissionUuid, sectionUuid);
    explicitDraftSaveKeysRef.current.add(queueKey);
    try {
      await flushCompanySubmissionDrafts(activeSubmissionUuid, sectionUuid);
      await save(sectionUuid, {
        answers: section.questions.flatMap((question) => {
          const questionUuid = question.question_uuid;
          if (!questionUuid) return [];
          if (["content", "system_field", "info_only"].includes(question.response_type)) return [];
          const displayValue = draftAnswersRef.current[questionUuid];
          const comment = draftAnswerCommentsRef.current[questionUuid];
          if (displayValue === undefined && (comment === null || comment === undefined)) return [];
          return [{
            questionUuid,
            value: persistedDraftValue(questionUuid, displayValue, rendererModel.questionResponseTypes),
            ...(comment !== null && comment !== undefined ? { comment } : {}),
          }];
        }),
        sectionComment: draftSectionCommentsRef.current[sectionUuid] ?? "",
      }, "explicit");
    } finally {
      explicitDraftSaveKeysRef.current.delete(queueKey);
    }
  };

  const refetchPersistedForm = async () => {
    await form.refetch();
  };

  const handleSubmitSection = async (sectionUuid: string, _comment: string) => {
    if (sectionSubmitting[sectionUuid]) return;
    setSectionSubmitting((current) => ({ ...current, [sectionUuid]: true }));
    setSectionActionErrors((current) => {
      const next = { ...current };
      delete next[sectionUuid];
      return next;
    });
    try {
      await handleSaveDraft(sectionUuid);
      await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/${encodeURIComponent(activeSubmissionUuid)}/sections/${encodeURIComponent(sectionUuid)}/submit`,
      );
      await refetchPersistedForm();
    } catch (error) {
      const message = reportSaveFailure(error);
      setSectionActionErrors((current) => ({ ...current, [sectionUuid]: message }));
      throw error;
    } finally {
      setSectionSubmitting((current) => ({ ...current, [sectionUuid]: false }));
    }
  };

  const handleSignatureChange = async (
    sectionUuid: string,
    type: "officer" | "seafarer" | "vessel_management",
    pngDataUrl: string,
    _signerName?: string,
    _signerRank?: string,
    signatureMethod?: string,
    seafarerPresent?: boolean,
  ) => {
    if (sectionSubmitting[sectionUuid]) return;
    setSectionSubmitting((current) => ({ ...current, [sectionUuid]: true }));
    setSectionActionErrors((current) => {
      const next = { ...current };
      delete next[sectionUuid];
      return next;
    });
    try {
      await handleSaveDraft(sectionUuid);
      await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/${encodeURIComponent(activeSubmissionUuid)}/sections/${encodeURIComponent(sectionUuid)}/signatures`,
        {
          signatureType: type,
          method: signatureMethod,
          data: pngDataUrl,
          ...(signatureMethod === "witnessed" ? { seafarerPresent } : {}),
        },
      );
      await refetchPersistedForm();
    } catch (error) {
      const message = reportSaveFailure(error);
      setSectionActionErrors((current) => ({ ...current, [sectionUuid]: message }));
      throw error;
    } finally {
      setSectionSubmitting((current) => ({ ...current, [sectionUuid]: false }));
    }
  };

  const handleDeleteSignature = async (sectionUuid: string, type: "officer" | "seafarer" | "vessel_management") => {
    if (sectionSubmitting[sectionUuid]) return;
    // The rendered signature state's signatureAttUuid is the attachment asset
    // ID used for image retrieval. DELETE identifies the signature record.
    const signatureUuid = lifecycleForm?.states
      .find((state) => state.sectionUuid === sectionUuid)
      ?.signatures.find((signature) => signature.signatureType === type)
      ?.sectionSignatureUuid;
    if (!signatureUuid) throw new Error("The persisted signature could not be identified. Reload the Company Form and try again.");
    setSectionSubmitting((current) => ({ ...current, [sectionUuid]: true }));
    setSectionActionErrors((current) => {
      const next = { ...current };
      delete next[sectionUuid];
      return next;
    });
    try {
      await apiRequest(
        "DELETE",
        `/api/v2/company-form-submissions/${encodeURIComponent(activeSubmissionUuid)}/sections/${encodeURIComponent(sectionUuid)}/signatures/${encodeURIComponent(signatureUuid)}`,
      );
      await refetchPersistedForm();
    } catch (error) {
      const message = reportSaveFailure(error);
      setSectionActionErrors((current) => ({ ...current, [sectionUuid]: message }));
      throw error;
    } finally {
      setSectionSubmitting((current) => ({ ...current, [sectionUuid]: false }));
    }
  };

  const handleVoidSubmission = async () => {
    if (!voidReason.trim() || isVoiding) return;
    setIsVoiding(true);
    setVoidError(null);
    try {
      await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/${encodeURIComponent(activeSubmissionUuid)}/void`,
        { reason: voidReason.trim() },
      );
      setVoidReason("");
      await refetchPersistedForm();
    } catch (error) {
      setVoidError(reportSaveFailure(error));
    } finally {
      setIsVoiding(false);
    }
  };

  const visibleSaveErrors = Object.entries(saveErrors)
    .filter(([key]) => key.startsWith(`${activeSubmissionUuid}\u0000`));
  const relatedSubmissions = lifecycleForm?.replacementHistory ?? [];
  const submissionStatus = lifecycleForm?.submission.status;
  return React.createElement(React.Fragment, null,
    lifecycleForm?.systemValuesChangedNotice && React.createElement(
      "div",
      { role: "status", className: "mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" },
      lifecycleForm.systemValuesChangedNotice,
    ),
    lifecycleForm?.systemValuesComparisonError && React.createElement(
      "div",
      { role: "alert", className: "mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" },
      "Current record values could not be compared with this declaration's saved snapshot.",
    ),
    relatedSubmissions.length > 0 && React.createElement(
      "section",
      { className: "mb-3 rounded-md border p-3 text-sm", "aria-label": "Voided submission history" },
      relatedSubmissions.map((relatedSubmission) => React.createElement(
        "div",
        { key: `${relatedSubmission.label}:${relatedSubmission.submissionUuid}`, className: "mt-2 first:mt-0" },
        React.createElement("p", null, relatedSubmission.label),
        React.createElement(
          "button",
          {
            type: "button",
            className: "mt-1 text-primary underline underline-offset-2",
            onClick: () => setActiveSubmissionUuid(relatedSubmission.submissionUuid),
          },
          relatedSubmission.targetLabel || "Open linked declaration — historical label unavailable",
        ),
      )),
    ),
    activeSubmissionUuid !== originalSubmissionUuid.current && React.createElement(
      "button",
      {
        type: "button",
        className: "mb-3 text-primary underline underline-offset-2",
        onClick: () => setActiveSubmissionUuid(originalSubmissionUuid.current),
      },
      "Return to the previously opened submission",
    ),
    lifecycleForm && submissionStatus === "voided" && React.createElement(
      "div",
      { role: "status", className: "mb-3 rounded-md border p-3 text-sm" },
      React.createElement("p", { className: "font-semibold" }, "Voided submission"),
      lifecycleForm.submission.voidReason && React.createElement("p", { className: "mt-1" }, `Reason: ${lifecycleForm.submission.voidReason}`),
      React.createElement("p", { className: "mt-1" }, `Voided by ${lifecycleForm.submission.voidedByName ?? "Identity unavailable"} · ${lifecycleForm.submission.voidedByDesignation ?? "Designation not recorded"}`),
      lifecycleForm.submission.voidedAt && React.createElement("p", { className: "mt-1" }, `Voided at ${sailUtcTimestamp(lifecycleForm.submission.voidedAt)}`),
    ),
    lifecycleForm?.submission.canVoid && submissionStatus !== "voided" && React.createElement(
      "section",
      { className: "mb-3 space-y-2 rounded-md border p-3", "aria-label": "Void submission" },
      React.createElement("label", { htmlFor: "company-form-void-reason", className: "block text-sm font-medium" }, "Void this submission and keep it in history"),
      React.createElement("textarea", {
        id: "company-form-void-reason",
        className: "min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm",
        value: voidReason,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setVoidReason(event.target.value),
        maxLength: 5000,
        required: true,
        "aria-required": true,
      }),
      React.createElement("button", {
        type: "button",
        className: "rounded-md border px-3 py-2 text-sm",
        disabled: isVoiding || !voidReason.trim(),
        onClick: () => void handleVoidSubmission(),
      }, isVoiding ? "Voiding…" : "Void submission"),
      voidError && React.createElement("p", { role: "alert", className: "text-sm text-destructive" }, voidError),
    ),
    visibleSaveErrors.map(([key, message]) => React.createElement(
        "div",
        { key, role: "alert", className: "mb-3 flex items-start gap-2 text-sm text-destructive" },
        React.createElement(AlertCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }),
        React.createElement("span", null, message),
      )),
    rendererModel.parts.length > 1
      ? React.createElement(
        "nav",
        { "aria-label": "Company Form parts", className: "mb-4 flex flex-wrap gap-2" },
        rendererModel.parts.map((part) => React.createElement(
          "button",
          {
            key: part.formPartUuid,
            type: "button",
            "aria-current": part.formPartUuid === activePartUuid ? "page" : undefined,
            onClick: () => setSelectedPartUuid(part.formPartUuid),
            className: part.formPartUuid === activePartUuid
              ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              : "rounded-md border px-3 py-2 text-sm font-medium",
          },
          `${part.partCode} · ${part.partTitle}`,
        )),
      )
      : null,
    React.createElement(ConfiguredFormRenderer, {
      mode: "live",
      embedded: true,
      companyForm: true,
      formTitle: rendererModel.title,
      formVersionLabel: rendererModel.versionLabel,
      subjectType: rendererModel.subjectType,
      parts: rendererModel.parts,
      structures: rendererModel.structures,
      roles: rendererModel.roles,
      departments: rendererModel.departments,
      vesselTypes: rendererModel.vesselTypes,
      selectedVesselTypeUuid: "all",
      selectedPartUuid: activePartUuid,
      onBack,
      live: {
        answers: draftAnswers,
        answerComments: draftAnswerComments,
        sectionComments: draftSectionComments,
        sectionStates: rendererModel.sectionStates,
        submissionStatus,
        signatureMethodOptions: lifecycleForm?.signatureMethodOptions,
        sectionSubmitting,
        sectionActionErrors,
        isLocked: rendererModel.readOnly,
        onAnswerChange: handleAnswerChange,
        onAnswerCommentChange: handleAnswerCommentChange,
        onSectionCommentChange: handleSectionCommentChange,
        onSaveDraft: handleSaveDraft,
        onSubmitSection: handleSubmitSection,
        onSignatureChange: handleSignatureChange,
        onDeleteSignature: handleDeleteSignature,
      },
    }),
  );
}