-- Tenant-local private durable storage. Bytes and metadata publish atomically;
-- no workspace upload path or external-object overwrite can change an original.
CREATE TABLE IF NOT EXISTS frm_document_samples (
 submission_uuid text PRIMARY KEY REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 registration jsonb NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS frm_document_files (
 file_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL UNIQUE REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 snapshot_uuid text NOT NULL UNIQUE REFERENCES frm_document_snapshots(snapshot_uuid) ON DELETE RESTRICT,
 pdf_bytes bytea NOT NULL,
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 frozen_record_sha256 text NOT NULL,
 renderer_version text NOT NULL,
 font_version text NOT NULL,
 logo_version_uuid text,
 byte_length integer NOT NULL CHECK(byte_length>0),
 page_count integer NOT NULL CHECK(page_count>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(pdf_bytes)=byte_length),
 CHECK(encode(sha256(pdf_bytes),'hex')=file_sha256)
);
CREATE TABLE IF NOT EXISTS frm_document_preparation_events (
 event_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 outcome text NOT NULL CHECK(outcome IN('READY','FAILED')),
 reason_code text,
 actor_uuid text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_preparation_events ON frm_document_preparation_events(submission_uuid,created_at);
CREATE TRIGGER trg_frm_document_files_immutable BEFORE UPDATE OR DELETE ON frm_document_files
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
CREATE TRIGGER trg_frm_document_samples_immutable BEFORE UPDATE OR DELETE ON frm_document_samples
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
CREATE TRIGGER trg_frm_document_preparation_events_immutable BEFORE UPDATE OR DELETE ON frm_document_preparation_events
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
