/** Subject-neutral, versioned evidence. No live lookup is needed to render it. */
export function frozenDocumentReference(input: FrozenDocumentInput): string {
  if (input.header.documentReference) return input.header.documentReference;
  // Legacy completed records predate short references. Never rewrite their
  // signed snapshot or look up current data to retrofit one. The full UUID
  // preserves uniqueness without a truncated-hash collision.
  return `CF-${input.source.completedAt.slice(0, 4)}-${input.source.recordUuid}`;
}

export type DocumentHeaderFacts = {
  subjectLabel: string | null;
  fields: { label: string; value: string | null }[];
};

export type FrozenDocumentHeader = {
  schemaVersion: 1;
  /** Absent only on legacy frozen records. Never reconstructed from live data. */
  documentReference?: string;
  tenant: { identity: string; companyName: string | null; source: "parent" | "tenant_setting" | "not_recorded" };
  branding: {
    logoVersionUuid: string | null; assetSha256: string | null; mode: "company_name" | "logo";
    asset?: { mediaType: string; bytesBase64: string; sha256: string };
  };
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
