import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { archivedFile } from "./documentArchive";
import { sha256 } from "./documentEvidenceRepository";
import { CompanyFormConflictError } from "./errors";
import { frozenDocumentReference } from "../../../shared/v2/forms-engine/documentEvidence";

/** Caller holds assignment then submission FOR UPDATE, serializing void/start/download. */
export async function annotatedVoidCopy(tx: any, submissionUuid: string) {
  const original = await archivedFile(tx, submissionUuid, true);
  if (!original) return null;
  const originalBytes = Buffer.from(original.pdf_bytes);
  if (sha256(originalBytes) !== original.file_sha256 || originalBytes.length !== original.byte_length) {
    throw new CompanyFormConflictError("The original copy failed its integrity check. Ask the office to review it.");
  }
  const noticeUuid = (await tx.execute(sql`SELECT frm_capture_void_notice(${submissionUuid}) AS id`)).rows[0]?.id;
  if (!noticeUuid) throw new CompanyFormConflictError("The void history changed. Reopen the form and try again.");
  const existing = (await tx.execute(sql`SELECT * FROM frm_document_void_files WHERE notice_uuid=${noticeUuid}`)).rows[0];
  if (existing) return existing;
  const notice = (await tx.execute(sql`SELECT * FROM frm_document_void_notices WHERE notice_uuid=${noticeUuid}`)).rows[0];
  const snapshot = (await tx.execute(sql`SELECT input FROM frm_document_snapshots WHERE submission_uuid=${submissionUuid}`)).rows[0];
  if (!snapshot) throw new CompanyFormConflictError("Frozen copy evidence is unavailable. Ask the office to review this form.");
  // No PDF/font imports during application startup or ordinary non-void status requests.
  const { appendVoidNotice } = await import("./documentVoidRenderer");
  const { bytes, pageCount } = await appendVoidNotice(originalBytes, notice.evidence,
    frozenDocumentReference(snapshot.input), notice.revision);
  return (await tx.execute(sql`INSERT INTO frm_document_void_files
    (file_uuid,notice_uuid,original_file_uuid,pdf_bytes,file_sha256,original_file_sha256,byte_length,page_count)
    VALUES(${randomUUID()},${noticeUuid},${original.file_uuid},decode(${bytes.toString("base64")},'base64'),
      ${sha256(bytes)},${original.file_sha256},${bytes.length},${pageCount}) RETURNING *`)).rows[0];
}
