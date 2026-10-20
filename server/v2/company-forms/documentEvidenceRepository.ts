import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FrozenDocumentHeader } from "../../../shared/v2/forms-engine/documentEvidence";
import type { CompanyFormSubjectAdapter, SubjectLookupResult } from "./contracts";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";

export const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** Capture only at the existing first-action boundary, never from a read. */
export async function captureDocumentHeader(input: {
  tx: any; submission: any; subject: SubjectLookupResult<any>;
  adapter: CompanyFormSubjectAdapter<any>; actorUserId: number;
  event: "signature" | "section_submission"; at: Date;
}) {
  const { tx, submission, adapter, subject, at, event, actorUserId } = input;
  const tenant = await tenantConnectionManager.getCurrentDocumentCompany();
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
    tenant: { identity, companyName: tenant.companyName, source: tenant.companyName ? "parent" : "not_recorded" },
    // Logo administration is deliberately deferred. Explicit absence is frozen.
    branding: { logoVersionUuid: null, assetSha256: null, mode: "company_name" },
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
