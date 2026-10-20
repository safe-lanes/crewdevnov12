import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { getDb } from "../db";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";
import { renderFrozenDocument, PDF_FONT_VERSION, PDF_RENDERER_VERSION } from "./documentPdfRenderer";
import { sha256 } from "./documentEvidenceRepository";
import { CompanyFormConflictError } from "./errors";

// Deliberately no environment-variable or browser switch to enable real forms.
// Layout approval must precede a separately reviewed rollout change.
export const REAL_FORM_PDF_GENERATION_ENABLED = false;

export async function sampleEligible(tx: any, submissionUuid: string): Promise<boolean> {
  const row = (await tx.execute(sql`SELECT s.registration, f.subject_ref, f.form_uuid,
    a.vessel_uuid FROM frm_document_samples s
    JOIN frm_company_submissions f USING(submission_uuid)
    JOIN crew_assignments a ON a.assign_uuid=f.subject_ref
    WHERE s.submission_uuid=${submissionUuid}`)).rows[0];
  if (!row || row.registration.assignmentUuid !== row.subject_ref ||
      row.registration.formUuid !== row.form_uuid || row.registration.vesselUuid !== row.vessel_uuid) return false;
  if (process.env.TEST_DATABASE_VERIFIED === "true") {
    const identity = (await tx.execute(sql`SELECT system_identifier::text AS clusterid,
      (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
    const expected = JSON.parse(process.env.TEST_DATABASE_IDENTITY!);
    return identity.clusterid === expected.clusterid && identity.databaseoid === expected.databaseoid;
  }
  if (process.env.NODE_ENV !== "development" || tenantConnectionManager.isMultiTenantEnabled) return false;
  // Main-preview samples must also be committed in the deliberate fixture register.
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile("docs/company-forms/pdf-layout-fixtures.json", "utf8"));
  const identity = (await tx.execute(sql`SELECT system_identifier::text AS clusterid,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
  return identity.clusterid === manifest.databaseIdentity?.clusterid &&
    identity.databaseoid === manifest.databaseIdentity?.databaseoid &&
    manifest.forms.some((r: any) => r.submissionUuid === submissionUuid && r.formUuid === row.form_uuid &&
      r.assignmentUuid === row.subject_ref && r.vesselUuid === row.vessel_uuid);
}

export async function archivedFile(tx: any, submissionUuid: string, includeBytes = false) {
  const result = await tx.execute(includeBytes
    ? sql`SELECT * FROM frm_document_files WHERE submission_uuid=${submissionUuid}`
    : sql`SELECT file_uuid,file_sha256,frozen_record_sha256,byte_length,page_count,created_at
      FROM frm_document_files WHERE submission_uuid=${submissionUuid}`);
  return result.rows[0] ?? null;
}

export async function prepareDocument(submissionUuid: string, actorUuid = "document_worker", db: any = getDb()) {
  // Existing subject lock always precedes document lock, including retries.
  const ref = (await db.execute(sql`SELECT subject_ref FROM frm_company_submissions WHERE submission_uuid=${submissionUuid}`)).rows[0]?.subject_ref;
  if (!ref) throw new CompanyFormConflictError("This form could not be found. Reopen it and try again.");
  try {
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${ref} FOR UPDATE`);
      await tx.execute(sql`SELECT submission_uuid FROM frm_company_submissions WHERE submission_uuid=${submissionUuid} FOR UPDATE`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'document:' + submissionUuid},0))`);
      const existing = await archivedFile(tx, submissionUuid);
      if (existing) return existing; // Never render again after publication.
      if (!await sampleEligible(tx, submissionUuid)) throw new CompanyFormConflictError(
        "PDF generation for real forms is disabled until the sample layout is approved.");
      const row = (await tx.execute(sql`SELECT s.*, f.status AS submission_status
        FROM frm_document_snapshots s JOIN frm_company_submissions f USING(submission_uuid)
        JOIN frm_document_preparation_requests r ON r.snapshot_uuid=s.snapshot_uuid AND r.outcome='PENDING'
        WHERE s.submission_uuid=${submissionUuid}`)).rows[0];
      if (!row || row.submission_status !== "completed") throw new CompanyFormConflictError(
        "This form does not have complete frozen evidence for a PDF copy. Ask the office to review it.");
      if (sha256(row.canonical_input) !== row.frozen_record_sha256) throw new Error("Frozen record checksum mismatch");
      const bytes = await renderFrozenDocument(row.input, row.frozen_record_sha256);
      const pages = (await PDFDocument.load(bytes)).getPageCount();
      await tx.execute(sql`INSERT INTO frm_document_files
        (file_uuid,submission_uuid,snapshot_uuid,pdf_bytes,file_sha256,frozen_record_sha256,
        renderer_version,font_version,logo_version_uuid,byte_length,page_count)
        VALUES(${randomUUID()},${submissionUuid},${row.snapshot_uuid},decode(${bytes.toString("base64")},'base64'),
          ${sha256(bytes)},${row.frozen_record_sha256},${PDF_RENDERER_VERSION},${PDF_FONT_VERSION},
          ${row.input.header.branding.logoVersionUuid},${bytes.length},${pages})`);
      await tx.execute(sql`INSERT INTO frm_document_preparation_events(event_uuid,submission_uuid,outcome,actor_uuid)
        VALUES(${randomUUID()},${submissionUuid},'READY',${actorUuid})`);
      return archivedFile(tx, submissionUuid);
    });
  } catch (error) {
    if (error instanceof CompanyFormConflictError) throw error;
    // The publication transaction rolled back. Keep a durable, safe failure event;
    // completion and its frozen record remain untouched.
    await db.execute(sql`INSERT INTO frm_document_preparation_events
      (event_uuid,submission_uuid,outcome,reason_code,actor_uuid)
      VALUES(${randomUUID()},${submissionUuid},'FAILED','PREPARATION_FAILED',${actorUuid})`);
    throw new CompanyFormConflictError("The PDF copy could not be prepared. Check the saved evidence and select Retry.");
  }
}

let running = false;
async function drainSamples(db: any) {
  const rows = (await db.execute(sql`SELECT r.submission_uuid FROM frm_document_samples m
    JOIN frm_document_preparation_requests r USING(submission_uuid)
    LEFT JOIN frm_document_files f USING(submission_uuid)
    WHERE r.outcome='PENDING' AND f.file_uuid IS NULL
      AND NOT EXISTS(SELECT 1 FROM frm_document_preparation_events e WHERE e.submission_uuid=r.submission_uuid AND e.outcome='FAILED')
    LIMIT 10`)).rows;
  for (const row of rows) {
    try { await prepareDocument(row.submission_uuid, "document_worker", db); }
    catch { /* status exposes failure; explicit Fill in retry controls another attempt */ }
  }
}
export function startDocumentSampleWorker() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Real generation is disabled in every tenant. Only registered preview samples
      // and identity-verified automated samples are considered by this worker.
      if (!tenantConnectionManager.isMultiTenantEnabled) await drainSamples(getDb());
    } catch { console.error("[CompanyForms] Stored-copy worker could not check pending samples."); }
    finally { running = false; }
  };
  const interval = setInterval(() => { void tick(); }, 15000);
  interval.unref();
}
