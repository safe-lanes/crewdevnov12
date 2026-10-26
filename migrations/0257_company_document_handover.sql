CREATE TABLE IF NOT EXISTS frm_document_handovers (
 handover_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 file_uuid text NOT NULL REFERENCES frm_document_files(file_uuid) ON DELETE RESTRICT,
 file_sha256 text NOT NULL,
 actor_uuid text NOT NULL,
 actor_name text NOT NULL,
 actor_role_uuid text,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION frm_document_handover_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM frm_document_files f WHERE f.file_uuid=NEW.file_uuid
   AND f.submission_uuid=NEW.submission_uuid AND f.file_sha256=NEW.file_sha256) THEN
   RAISE EXCEPTION 'Handover must identify the exact stored file' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_frm_document_handover_file BEFORE INSERT ON frm_document_handovers
 FOR EACH ROW EXECUTE FUNCTION frm_document_handover_guard();
CREATE TRIGGER trg_frm_document_handovers_immutable BEFORE UPDATE OR DELETE ON frm_document_handovers
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
