import type { Request } from "express";
import { sql } from "drizzle-orm";
import { companyFormSubmissionsService } from "./submissionsService";
import { getDb } from "../db";
import { archivedFile, prepareDocument, sampleEligible, REAL_FORM_PDF_GENERATION_ENABLED } from "./documentArchive";
import { sha256 } from "./documentEvidenceRepository";
import { CompanyFormConflictError, CompanyFormPermissionError } from "./errors";
import { handoversFor } from "./documentHandover";
import { frozenDocumentReference } from "../../../shared/v2/forms-engine/documentEvidence";
import { annotatedVoidCopy } from "./documentVoidCopy";

export async function lockedCopy(tx: any, subjectRef: string, submissionUuid: string) {
  await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${subjectRef} FOR UPDATE`);
  const row = (await tx.execute(sql`SELECT status FROM frm_company_submissions WHERE submission_uuid=${submissionUuid} FOR UPDATE`)).rows[0];
  if (row?.status === "voided") return annotatedVoidCopy(tx, submissionUuid);
  if (row?.status !== "completed") throw new CompanyFormConflictError("Complete this form before requesting its stored copy.");
  return archivedFile(tx, submissionUuid, true);
}

export async function authorizeCopy(req: Request, submissionUuid: string, fill = false) {
  const context = await companyFormSubmissionsService.authorizeSubmission(req, submissionUuid, fill ? "edit_draft" : "read_asset");
  if (fill && !await context.adapter.authorize(context.principal, "edit_draft", context.subject.context)) {
    throw new CompanyFormPermissionError("Company Forms Fill in is required on this assignment.");
  }
  return context;
}
export async function copyStatus(req: Request, submissionUuid: string) {
  const context = await authorizeCopy(req, submissionUuid);
  const db = getDb();
  const voided = context.submission.status === "voided";
  const file = voided
    ? await db.transaction((tx: any) => lockedCopy(tx, context.subject.subjectRef, submissionUuid))
    : await archivedFile(db, submissionUuid);
  const eligible = REAL_FORM_PDF_GENERATION_ENABLED || await sampleEligible(db, submissionUuid);
  const mutable = ["completed", "voided"].includes(context.submission.status);
  let canFill = false;
  try { canFill = await context.adapter.authorize(context.principal, "edit_draft", context.subject.context); } catch { /* no Fill in */ }
  const event = (await db.execute(sql`SELECT outcome FROM frm_document_preparation_events
    WHERE submission_uuid=${submissionUuid} ORDER BY created_at DESC,event_uuid DESC LIMIT 1`)).rows[0];
  const request = (await db.execute(sql`SELECT outcome FROM frm_document_preparation_requests WHERE submission_uuid=${submissionUuid}`)).rows[0];
  const snapshot = (await db.execute(sql`SELECT input,frozen_record_sha256 FROM frm_document_snapshots WHERE submission_uuid=${submissionUuid}`)).rows[0];
  const status = !mutable ? "unavailable" : file ? "ready" : !eligible ? "disabled"
    : !request || request.outcome === "UNAVAILABLE" ? "unavailable" : event?.outcome === "FAILED" ? "failed" : "pending";
  const messages = {
    ready: voided ? "This form is void. The stored copy includes its void notice." : "The stored PDF copy is ready.",
    disabled: "PDF generation for real forms is disabled until the sample layout is approved.",
    unavailable: context.submission.status === "voided"
      ? "This form is voided. An annotated copy is not yet available; ask the office to review the void history."
      : "This form does not have complete frozen evidence for a PDF copy. Ask the office to review it.",
    failed: "The PDF copy could not be prepared. Select Retry or ask the office to review the saved evidence.",
    pending: "The PDF copy is awaiting preparation. Reopen this form shortly.",
  };
  return {
    status, message: messages[status], fileSha256: file?.file_sha256,
    documentReference: snapshot ? frozenDocumentReference(snapshot.input) : null,
    frozenRecordSha256: snapshot?.frozen_record_sha256,
    canRetry: mutable && eligible && !file && request?.outcome === "PENDING" && canFill,
    canFillIn: canFill,
    voided,
    originalFileSha256: voided ? file?.original_file_sha256 : file?.file_sha256,
    handovers: await handoversFor(db, [submissionUuid]),
  };
}
export async function downloadCopy(req: Request, submissionUuid: string): Promise<Buffer> {
  const { subject } = await authorizeCopy(req, submissionUuid);
  return getDb().transaction(async (tx: any) => {
    const file = await lockedCopy(tx, subject.subjectRef, submissionUuid);
    if (!file) throw new CompanyFormConflictError("The stored PDF is not ready. Reopen the form and check its copy status.");
    const bytes = Buffer.from(file.pdf_bytes);
    if (sha256(bytes) !== file.file_sha256 || bytes.length !== file.byte_length) {
      throw new CompanyFormConflictError("The stored copy failed its integrity check. Ask the office to review it; do not use this copy.");
    }
    return bytes;
  });
}
export async function retryCopy(req: Request, submissionUuid: string) {
  const { principal } = await authorizeCopy(req, submissionUuid, true);
  await prepareDocument(submissionUuid, String(principal.userId));
  return copyStatus(req, submissionUuid);
}
