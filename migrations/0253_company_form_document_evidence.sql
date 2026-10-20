-- No backfill: old forms cannot acquire present-day historical evidence.
CREATE TABLE IF NOT EXISTS frm_document_headers (
 submission_uuid text PRIMARY KEY REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 evidence jsonb NOT NULL,
 captured_at timestamptz NOT NULL,
 actor_uuid text NOT NULL,
 capture_event text NOT NULL CHECK (capture_event IN ('signature','section_submission'))
);
CREATE TABLE IF NOT EXISTS frm_document_assets (
 asset_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 attachment_uuid text NOT NULL UNIQUE,
 media_type text NOT NULL CHECK (media_type = 'image/png'),
 bytes_base64 text NOT NULL,
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 byte_length integer NOT NULL CHECK (byte_length > 0 AND byte_length <= 5242880),
 captured_at timestamptz NOT NULL,
 actor_uuid text NOT NULL
);
CREATE OR REPLACE FUNCTION frm_document_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Document evidence is immutable' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS trg_frm_document_headers_immutable ON frm_document_headers;
CREATE TRIGGER trg_frm_document_headers_immutable BEFORE UPDATE OR DELETE ON frm_document_headers
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
DROP TRIGGER IF EXISTS trg_frm_document_assets_immutable ON frm_document_assets;
CREATE TRIGGER trg_frm_document_assets_immutable BEFORE UPDATE OR DELETE ON frm_document_assets
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
