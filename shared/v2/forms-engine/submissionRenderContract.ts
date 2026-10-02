export type CompanyFormSubmissionStatus = "in_progress" | "completed" | "voided";
export type CompanyFormSectionStatus = "not_started" | "in_progress" | "submitted" | string;
export type CompanyFormSignatureType = "officer" | "seafarer";
export type CompanyFormSignatureMethod = "officer" | "authenticated" | "witnessed";
export type CompanyFormSignatureMethodOption = {
  method: CompanyFormSignatureMethod;
  label: string;
};
export type CompanyFormSubmissionSectionActions = {
  canEdit: boolean;
  canSubmit: boolean;
  canSign: Partial<Record<CompanyFormSignatureType, boolean>>;
};
export type CompanyFormSubmissionHistoryLink = {
  direction: "replaced_by" | "replaces";
  label: "Voided — replaced by" | "Replaces a voided submission";
  submissionUuid: string;
};
export type CompanyFormRenderResponseType =
  | "yes_no"
  | "yes_no_na"
  | "single_select"
  | "multi_select"
  | "free_text"
  | "date"
  | "number"
  | "checkbox"
  | "info_only"
  | "content"
  | "system_field";

export type CompanyFormSubmissionSummary = {
  submissionUuid: string;
  subjectType: string;
  subjectRef: string;
  formUuid: string;
  formVersionUuid: string;
  stageKey: string | null;
  status: CompanyFormSubmissionStatus;
  canEdit: boolean;
  canVoid: boolean;
  createdAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidedByUuid: string | null;
  voidedByName: string | null;
  voidReason: string | null;
  voidedPreviousStatus: "in_progress" | "completed" | null;
  replacedBySubmissionUuid: string | null;
  replacesSubmissionUuid: string | null;
  systemSnapshotAt: string | null;
  systemSnapshotEvent: "section_submission" | "signature" | null;
};

export type CompanyFormSubmissionAnswer = {
  answerUuid: string;
  questionUuid: string;
  answerValue: string | null;
  answerComment: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CompanyFormSubmissionSignature = {
  sectionSignatureUuid: string;
  signatureType: string;
  signerName: string;
  signerRank: string | null;
  witnessName: string | null;
  signedAt: string;
  signedByUuid: string;
  signatureMethod: string;
  attachment: {
    assetUuid: string;
    fileName: string | null;
    fileType: string | null;
    fileSize: string | null;
    rawUrl: string;
  };
};

export type CompanyFormSubmissionSectionState = {
  sectionStateUuid: string;
  sectionUuid: string;
  status: CompanyFormSectionStatus;
  sectionComment: string | null;
  submittedByUuid: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  signatures: CompanyFormSubmissionSignature[];
};

export type CompanyFormRenderOption = {
  optionUuid: string;
  optionLabel: string;
  optionValue: string;
  sortOrder: number;
};

export type CompanyFormRenderOptionSet = {
  optionSetUuid: string;
  setName: string | null;
  lowEndLabel: string | null;
  highEndLabel: string | null;
  sortOrder: number;
  options: CompanyFormRenderOption[];
};

export type CompanyFormSystemFieldValue = {
  key: string;
  label: string;
  source: "submission" | "subject";
  value: string | null;
  valueOrigin: "submission_date" | "current_subject" | "frozen_snapshot" | "persisted_snapshot_unavailable";
};

export type CompanyFormRenderQuestion = {
  questionUuid: string;
  questionCode: string;
  questionText: string;
  responseType: CompanyFormRenderResponseType;
  contentHtml: string | null;
  systemFieldKey: string | null;
  isMandatory: boolean;
  commentEnabled: boolean;
  optionSetUuid: string | null;
  sortOrder: number;
  options: CompanyFormRenderOption[];
  systemField: CompanyFormSystemFieldValue | null;
};

export type CompanyFormRenderSection = {
  sectionUuid: string;
  sectionCode: string;
  sectionTitle: string;
  applicableVesselTypes: Array<{ vesselTypeUuid: string; vesselType: string | null }>;
  responsibleMode: string;
  responsibleRoleUuid: string | null;
  responsibleRole: { roleUuid: string; roleName: string; roleType: string } | null;
  responsibleDepartment: string | null;
  commentBoxRequired: boolean;
  signatureOfficerRequired: boolean;
  signatureSeafarerRequired: boolean;
  defaultOptionSetUuid: string | null;
  layoutPreference: string;
  effectiveLayout: "list" | "matrix";
  sortOrder: number;
  questions: CompanyFormRenderQuestion[];
  requiresSubmission: boolean;
  isApplicable: boolean;
  canEdit?: boolean;
  canSubmit?: boolean;
  canSign?: Partial<Record<CompanyFormSignatureType, boolean>>;
};

export type CompanyFormRenderPart = {
  formPartUuid: string;
  partCode: string;
  partTitle: string;
  partType: string;
  isOfficeOnly: boolean;
  sortOrder: number;
  sections: CompanyFormRenderSection[];
};

export type CompanyFormSubmissionRenderContract = {
  submission: CompanyFormSubmissionSummary;
  signatureMethodOptions: Partial<Record<CompanyFormSignatureType, CompanyFormSignatureMethodOption[]>>;
  form: {
    formName: string;
    description: string | null;
    category: string;
    archivedAt: string | null;
  };
  version: {
    formVersionUuid: string;
    versionNo: string;
    versionDate: string;
    status: string;
    stageKey: string | null;
    stageLabel: string | null;
    releasedAt: string | null;
  };
  systemFields: CompanyFormSystemFieldValue[];
  optionSets: CompanyFormRenderOptionSet[];
  parts: CompanyFormRenderPart[];
  states: CompanyFormSubmissionSectionState[];
  answers: CompanyFormSubmissionAnswer[];
  systemSnapshotAt: string | null;
  systemSnapshotEvent: "section_submission" | "signature" | null;
  systemValuesChanged: boolean | null;
  systemValuesComparisonError: boolean;
  systemValuesChangedNotice: string | null;
  voidedReplacement: {
    label: "Voided — replaced by" | "Replaces a voided submission";
    submissionUuid: string;
  } | null;
  replacementHistory: CompanyFormSubmissionHistoryLink[];
};

export type CompanyFormSubmissionDetail = {
  submission: CompanyFormSubmissionSummary;
  states: CompanyFormSubmissionSectionState[];
  answers: CompanyFormSubmissionAnswer[];
  formUrl: string;
  voidedReplacement: {
    label: "Voided — replaced by" | "Replaces a voided submission";
    submissionUuid: string;
  } | null;
  replacementHistory: CompanyFormSubmissionHistoryLink[];
};