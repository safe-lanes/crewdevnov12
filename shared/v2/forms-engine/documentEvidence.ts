/** Subject-neutral, versioned evidence. No live lookup is needed to render it. */
export type DocumentHeaderFacts = {
  subjectLabel: string | null;
  fields: { label: string; value: string | null }[];
};

export type FrozenDocumentHeader = {
  schemaVersion: 1;
  tenant: { identity: string; companyName: string | null; source: "parent" | "not_recorded" };
  branding: { logoVersionUuid: string | null; assetSha256: string | null; mode: "company_name" };
  subject: DocumentHeaderFacts;
  definition: Record<string, unknown>;
  capturedAt: string;
  captureEvent: "signature" | "section_submission";
};

export type DocumentEvidenceStatus = {
  status: "not_started" | "frozen" | "pending" | "unavailable";
  message: string;
  frozenRecordSha256: string | null;
};

export type FrozenDocumentInput = {
  schemaVersion: 1;
  source: {
    kind: "company_form";
    recordUuid: string;
    subjectType: string;
    subjectRef: string;
    formUuid: string;
    versionUuid: string;
    stageKey: string | null;
    origin: string;
    requirementUuid: string | null;
    completedAt: string;
  };
  header: FrozenDocumentHeader;
  applicableSectionUuids: string[];
  systemFields: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  sectionStates: Record<string, unknown>[];
  signatures: {
    record: Record<string, unknown>;
    asset: { mediaType: string; sha256: string; byteLength: number; bytesBase64: string };
  }[];
};
