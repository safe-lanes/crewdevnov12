import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DocumentEvidenceStatus, FrozenDocumentHeader, FrozenDocumentInput } from "../../../shared/v2/forms-engine/documentEvidence";
import type { CompanyFormSubjectAdapter, SubjectLookupResult } from "./contracts";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";

export const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** JSON dates are ISO strings, object keys sorted recursively, arrays retain order. */
export function canonicalDocumentJson(input: unknown): string {
  const normalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
    }
    return value;
  };
  return JSON.stringify(normalize(JSON.parse(JSON.stringify(input))));
}

export function evidenceStatus(input: {
  status: string; systemSnapshotAt?: unknown; header?: unknown;
  historicalActions?: boolean;
  outcome?: string; reasonCode?: string; hash?: string | null;
}): DocumentEvidenceStatus {
  if (input.outcome === "UNAVAILABLE" ||
      (["completed", "voided"].includes(input.status) && !input.outcome) ||
      (!input.header && !input.outcome && (input.systemSnapshotAt || input.historicalActions))) {
    return {
      status: "unavailable", frozenRecordSha256: null,
      message: input.reasonCode === "SIGNATURE_EVIDENCE_MISSING"
        ? "A saved signature image is missing from this form's original evidence. Ask the office to review it; a historical copy cannot be reconstructed from current details."
        : input.reasonCode === "SUBJECT_NAME_NOT_RECORDED"
          ? "The seafarer's name was not recorded with this form. Ask the office to review the original evidence; current details will not be substituted."
          : "Original document evidence was not captured for this form. Ask the office to review the historical record; current details will not be substituted.",
    };
  }
  if (input.outcome === "PENDING") return {
    status: "pending", frozenRecordSha256: input.hash ?? null,
    message: "The completed form's frozen record is saved. A PDF copy will be available once stored-copy generation is enabled.",
  };
  if (input.header) return {
    status: "frozen", frozenRecordSha256: null,
    message: "Document header details are frozen. The completed record will be saved when all required sections are submitted.",
  };
  return { status: "not_started", frozenRecordSha256: null,
    message: "Document header details will be recorded with the first signature or section submission." };
}

export async function readDocumentEvidenceStatus(tx: any, submission: any): Promise<DocumentEvidenceStatus> {
  const result = await tx.execute(sql`SELECT r.outcome,r.reason_code,s.frozen_record_sha256,
    EXISTS(SELECT 1 FROM frm_document_headers h WHERE h.submission_uuid=${submission.submissionUuid}) AS header
    FROM (SELECT 1) anchor LEFT JOIN frm_document_preparation_requests r
      ON r.submission_uuid=${submission.submissionUuid}
    LEFT JOIN frm_document_snapshots s ON s.snapshot_uuid=r.snapshot_uuid`);
  const row = result.rows[0];
  return evidenceStatus({ status: submission.status, header: row.header,
    systemSnapshotAt: submission.systemSnapshotAt, historicalActions: submission.historicalActions,
    outcome: row.outcome, reasonCode: row.reason_code, hash: row.frozen_record_sha256 });
}

/** Capture only at the existing first-action boundary, never from a read. */
export async function captureDocumentHeader(input: {
  tx: any; submission: any; subject: SubjectLookupResult<any>;
  adapter: CompanyFormSubjectAdapter<any>; actorUserId: number;
  event: "signature" | "section_submission"; at: Date;
}) {
  const { tx, submission, adapter, subject, at, event, actorUserId } = input;
  const tenant = await tenantConnectionManager.getCurrentDocumentCompany();
  const { readBranding } = await import("./documentBranding");
  const branding = await readBranding(tx);
  const identity = tenant.identity ?? (await tx.execute(sql`
    SELECT 'database:' || oid::text AS identity FROM pg_database WHERE datname = current_database()
  `)).rows[0].identity;
  const { companyFormSubmissionRenderRepository } = await import("./submissionRenderRepository");
  const pinned = await companyFormSubmissionRenderRepository.readPinnedRenderData(submission.submissionUuid, tx);
  if (!pinned) throw new Error("Pinned form evidence is unavailable.");
  const policy = await tx.execute(sql`SELECT to_jsonb(p) AS policy,
    COALESCE((SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('conditions',
      COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.condition_uuid)
        FROM frm_applicability_conditions c WHERE c.set_uuid=s.set_uuid), '[]'::jsonb))
      ORDER BY s.set_uuid) FROM frm_applicability_sets s
      WHERE s.version_uuid=p.version_uuid), '[]'::jsonb) AS sets
    FROM frm_version_applicability p WHERE p.version_uuid=${submission.formVersionUuid}`);
  const evidence: FrozenDocumentHeader = {
    schemaVersion: 1,
    tenant: { identity, companyName: tenant.companyName ?? branding?.company_name ?? null,
      source: tenant.companyName ? "parent" : branding?.company_name ? "tenant_setting" : "not_recorded" },
    branding: branding?.media_type
      ? { logoVersionUuid: branding.version_uuid, assetSha256: branding.sha256, mode: "logo",
        asset: { mediaType: branding.media_type, bytesBase64: branding.bytes_base64, sha256: branding.sha256 } }
      : { logoVersionUuid: branding?.version_uuid ?? null, assetSha256: null, mode: "company_name" },
    subject: await adapter.documentHeader?.(subject.context, tx) ?? { subjectLabel: null, fields: [] },
    definition: {
      form: pinned.form, version: pinned.version, parts: pinned.parts,
      sections: pinned.sections, questions: pinned.questions, optionSets: pinned.optionSets,
      options: pinned.options, roles: pinned.roles, vesselTypes: pinned.vesselTypes,
      applicability: policy.rows,
    },
    capturedAt: at.toISOString(),
    captureEvent: event,
  };
  await tx.execute(sql`INSERT INTO frm_document_headers
    (submission_uuid, evidence, captured_at, actor_uuid, capture_event)
    VALUES (${submission.submissionUuid}, ${JSON.stringify(evidence)}::jsonb, ${at.toISOString()},
      ${String(actorUserId)}, ${event})`);
}

/** Keep actual signed image bytes; a mutable upload path is not evidence. */
export async function captureDocumentSignature(input: {
  tx: any; submissionUuid: string; attachmentUuid: string; bytes: Buffer;
  actorUserId: number; at: Date;
}) {
  const { tx, submissionUuid, attachmentUuid, bytes, actorUserId, at } = input;
  if (bytes.length < 8 || bytes.length > 5 * 1024 * 1024 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Signature evidence must contain valid PNG bytes.");
  }
  await tx.execute(sql`INSERT INTO frm_document_assets
    (asset_uuid,submission_uuid,attachment_uuid,media_type,bytes_base64,sha256,byte_length,captured_at,actor_uuid)
    VALUES (${randomUUID()},${submissionUuid},${attachmentUuid},'image/png',${bytes.toString("base64")},
      ${sha256(bytes)},${bytes.length},${at.toISOString()},${String(actorUserId)})`);
}

/** Called ONLY under the lifecycle's subject/submission locks, in its transaction. */
export async function recordCompletedDocument(input: {
  tx: any; submissionUuid: string; actorUserId: number; at: Date;
}) {
  const { tx, submissionUuid, actorUserId, at } = input;
  const existing = await tx.execute(sql`SELECT request_uuid FROM frm_document_preparation_requests
    WHERE submission_uuid=${submissionUuid}`);
  if (existing.rows.length) return;
  const headers = await tx.execute(sql`SELECT evidence FROM frm_document_headers
    WHERE submission_uuid=${submissionUuid}`);
  const { companyFormSubmissionRenderRepository } = await import("./submissionRenderRepository");
  const pinned = await companyFormSubmissionRenderRepository.readPinnedRenderData(submissionUuid, tx);
  if (!pinned || pinned.submission.status !== "completed") throw new Error("Document completion evidence is unavailable.");
  const assets = await tx.execute(sql`SELECT * FROM frm_document_assets WHERE submission_uuid=${submissionUuid}`);
  const byAttachment = new Map<string, any>(assets.rows.map((asset: any) => [asset.attachment_uuid, asset]));
  const missingImage = pinned.signatures.some((row: any) => {
    const asset = byAttachment.get(row.signature.signatureAttUuid);
    return !asset || asset.sha256 !== sha256(Buffer.from(asset.bytes_base64, "base64")) ||
      asset.byte_length !== Buffer.from(asset.bytes_base64, "base64").length;
  });
  const header = headers.rows[0]?.evidence as FrozenDocumentHeader | undefined;
  // Never reconstruct old headers, fields or missing signature bytes from live data.
  const reason = !header || !pinned.submission.systemSnapshotAt
    ? "HISTORICAL_HEADER_MISSING"
    : !header.subject.subjectLabel ? "SUBJECT_NAME_NOT_RECORDED"
    : missingImage ? "SIGNATURE_EVIDENCE_MISSING" : null;
  let snapshotUuid: string | null = null;
  if (!reason && header) {
    snapshotUuid = randomUUID();
    const s = pinned.submission;
    const document: FrozenDocumentInput = {
      schemaVersion: 1,
      source: {
        kind: "company_form", recordUuid: submissionUuid,
        subjectType: s.subjectType, subjectRef: s.subjectRef,
        formUuid: s.formUuid, versionUuid: s.formVersionUuid, stageKey: s.stageKey,
        origin: s.origin, requirementUuid: s.requirementUuid,
        completedAt: at.toISOString(),
      },
      header,
      applicableSectionUuids: s.applicableSectionUuids ?? [],
      systemFields: pinned.systemSnapshots,
      answers: pinned.answers,
      sectionStates: pinned.states,
      signatures: pinned.signatures.map((row: any) => {
        const asset = byAttachment.get(row.signature.signatureAttUuid)!;
        return { record: row.signature, asset: {
          mediaType: asset.media_type, sha256: asset.sha256,
          byteLength: asset.byte_length, bytesBase64: asset.bytes_base64,
        } };
      }),
    };
    const canonical = canonicalDocumentJson(document);
    await tx.execute(sql`INSERT INTO frm_document_snapshots
      (snapshot_uuid,submission_uuid,schema_version,input,canonical_input,frozen_record_sha256,created_at,actor_uuid)
      VALUES(${snapshotUuid},${submissionUuid},1,${canonical}::jsonb,${canonical},
        ${sha256(canonical)},${at.toISOString()},${String(actorUserId)})`);
  }
  await tx.execute(sql`INSERT INTO frm_document_preparation_requests
    (request_uuid,submission_uuid,snapshot_uuid,outcome,reason_code,created_at,actor_uuid)
    VALUES(${randomUUID()},${submissionUuid},${snapshotUuid},${reason ? "UNAVAILABLE" : "PENDING"},
      ${reason},${at.toISOString()},${String(actorUserId)})`);
}
