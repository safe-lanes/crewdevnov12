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
  const readOnly = !contract.submission.canEdit;

  return {
    submissionUuid: contract.submission.submissionUuid,
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
  const form = useQuery({
    queryKey: ["company-form-submission-form", submissionUuid],
    queryFn: () => fetchCompanySubmissionForm(submissionUuid),
    retry: false,
    enabled: !!submissionUuid,
  });
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
  const [selectedPartUuid, setSelectedPartUuid] = useState("");
  const draftAnswersRef = useRef(draftAnswers);
  const draftAnswerCommentsRef = useRef(draftAnswerComments);
  const draftSectionCommentsRef = useRef(draftSectionComments);
  const saveSequencesRef = useRef<Record<string, number>>({});
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!rendererModel) return;
    draftAnswersRef.current = rendererModel.answers;
    draftAnswerCommentsRef.current = rendererModel.answerComments;
    draftSectionCommentsRef.current = rendererModel.sectionComments;
    setDraftAnswers(rendererModel.answers);
    setDraftAnswerComments(rendererModel.answerComments);
    setDraftSectionComments(rendererModel.sectionComments);
    setSelectedPartUuid((current) => rendererModel.parts.some((part) => part.formPartUuid === current)
      ? current
      : rendererModel.parts[0]?.formPartUuid ?? "");
  }, [rendererModel]);

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
  const save = (sectionUuid: string, draft: CompanySubmissionDraftInput): Promise<void> => {
    const key = draftQueueKey(submissionUuid, sectionUuid);
    const sequence = (saveSequencesRef.current[key] ?? 0) + 1;
    saveSequencesRef.current[key] = sequence;
    return saveCompanySubmissionDraft(submissionUuid, sectionUuid, draft).then(
      () => {
        if (!isMountedRef.current || saveSequencesRef.current[key] !== sequence) return;
        setSaveErrors((current) => {
          if (!(key in current)) return current;
          const next = { ...current };
          delete next[key];
          return next;
        });
      },
      (error: unknown) => {
        if (!isMountedRef.current || saveSequencesRef.current[key] !== sequence) return;
        setSaveErrors((current) => ({
          ...current,
          [key]: reportSaveFailure(error),
        }));
      },
    );
  };
  const handleAnswerChange = (questionUuid: string, value: ConfiguredFormAnswerValue) => {
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
      });
    }
    onAnswerChange?.(questionUuid, value);
  };
  const handleAnswerCommentChange = (questionUuid: string, comment: string) => {
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
      });
    }
    onAnswerCommentChange?.(questionUuid, comment);
  };
  const handleSectionCommentChange = (sectionUuid: string, comment: string) => {
    draftSectionCommentsRef.current = { ...draftSectionCommentsRef.current, [sectionUuid]: comment };
    setDraftSectionComments((current) => ({ ...current, [sectionUuid]: comment }));
    if (!rendererModel.readOnly) void save(sectionUuid, { answers: [], sectionComment: comment });
  };
  const handleSaveDraft = (sectionUuid: string) => {
    const section = Object.values(rendererModel.structures)
      .flat()
      .find((candidate) => candidate.section_uuid === sectionUuid);
    if (!section || rendererModel.readOnly) return;
    return save(sectionUuid, {
      answers: section.questions.flatMap((question) => {
        const questionUuid = question.question_uuid;
        if (!questionUuid) return [];
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
    });
  };

  const visibleSaveErrors = Object.entries(saveErrors)
    .filter(([key]) => key.startsWith(`${submissionUuid}\u0000`));
  return React.createElement(React.Fragment, null,
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
        isLocked: rendererModel.readOnly,
        onAnswerChange: handleAnswerChange,
        onAnswerCommentChange: handleAnswerCommentChange,
        onSectionCommentChange: handleSectionCommentChange,
        onSaveDraft: handleSaveDraft,
      },
    }),
  );
}