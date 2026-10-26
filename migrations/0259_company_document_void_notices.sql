-- Notice revisions and annotated copies are append-only; originals are never updated.
CREATE TABLE frm_document_void_notices (
 notice_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision > 0),
 evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(submission_uuid, revision)
);
CREATE TABLE frm_document_void_files (
 file_uuid text PRIMARY KEY,
 notice_uuid text NOT NULL UNIQUE REFERENCES frm_document_void_notices(notice_uuid) ON DELETE RESTRICT,
 original_file_uuid text NOT NULL REFERENCES frm_document_files(file_uuid) ON DELETE RESTRICT,
 pdf_bytes bytea NOT NULL,
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 original_file_sha256 text NOT NULL,
 byte_length integer NOT NULL CHECK(byte_length > 0),
 page_count integer NOT NULL CHECK(page_count > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(pdf_bytes)=byte_length),
 CHECK(encode(sha256(pdf_bytes),'hex')=file_sha256)
);
CREATE TABLE frm_document_void_handovers (
 handover_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 file_uuid text NOT NULL REFERENCES frm_document_void_files(file_uuid) ON DELETE RESTRICT,
 file_sha256 text NOT NULL,
 actor_uuid text NOT NULL,
 actor_name text NOT NULL,
 actor_role_uuid text,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_void_notices_immutable BEFORE UPDATE OR DELETE ON frm_document_void_notices
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
CREATE TRIGGER trg_void_files_immutable BEFORE UPDATE OR DELETE ON frm_document_void_files
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
CREATE TRIGGER trg_void_handovers_immutable BEFORE UPDATE OR DELETE ON frm_document_void_handovers
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();

-- Callers lock the assignment, then submission. The trigger participates in the
-- void/replacement transaction, so no committed void can lack its notice.
CREATE FUNCTION frm_capture_void_notice(p_submission text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s frm_company_submissions%ROWTYPE; e jsonb; prior frm_document_void_notices%ROWTYPE; result text;
BEGIN
 SELECT * INTO s FROM frm_company_submissions WHERE submission_uuid=p_submission FOR UPDATE;
 IF s.status <> 'voided' THEN RETURN NULL; END IF;
 e := jsonb_build_object(
   'submissionUuid', s.submission_uuid, 'voidedAt', s.voided_at,
   'actorUuid', s.voided_by_uuid, 'actorName', s.voided_by_name,
   'designation', s.voided_by_designation, 'reason', s.void_reason,
   'replacementSubmissionUuid', s.replaced_by_submission_uuid,
   'originalFileSha256', (SELECT file_sha256 FROM frm_document_files WHERE submission_uuid=p_submission));
 SELECT * INTO prior FROM frm_document_void_notices WHERE submission_uuid=p_submission ORDER BY revision DESC LIMIT 1;
 IF prior.notice_uuid IS NOT NULL AND prior.evidence=e THEN RETURN prior.notice_uuid; END IF;
 result := gen_random_uuid()::text;
 INSERT INTO frm_document_void_notices(notice_uuid,submission_uuid,revision,evidence)
 VALUES(result,p_submission,COALESCE(prior.revision,0)+1,e);
 RETURN result;
END $$;
CREATE FUNCTION frm_void_notice_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='voided' THEN PERFORM frm_capture_void_notice(NEW.submission_uuid); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_company_void_notice AFTER UPDATE OF status,replaced_by_submission_uuid ON frm_company_submissions
 FOR EACH ROW EXECUTE FUNCTION frm_void_notice_changed();
-- Historical evidence only: never join today's users or reconstruct a designation.
SELECT frm_capture_void_notice(submission_uuid) FROM frm_company_submissions WHERE status='voided';

CREATE FUNCTION frm_void_copy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='frm_document_void_files' THEN
   IF NOT EXISTS(SELECT 1 FROM frm_document_files f JOIN frm_document_void_notices n
     ON n.submission_uuid=f.submission_uuid WHERE n.notice_uuid=NEW.notice_uuid
     AND f.file_uuid=NEW.original_file_uuid AND f.file_sha256=NEW.original_file_sha256
     AND n.evidence->>'originalFileSha256'=f.file_sha256) THEN
     RAISE EXCEPTION 'Notice must identify its exact original file' USING ERRCODE='23514';
   END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM frm_document_void_files f JOIN frm_document_void_notices n USING(notice_uuid)
     WHERE f.file_uuid=NEW.file_uuid AND n.submission_uuid=NEW.submission_uuid AND f.file_sha256=NEW.file_sha256) THEN
     RAISE EXCEPTION 'Handover must identify its exact annotated file' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_void_file_guard BEFORE INSERT ON frm_document_void_files
 FOR EACH ROW EXECUTE FUNCTION frm_void_copy_guard();
CREATE TRIGGER trg_void_handover_guard BEFORE INSERT ON frm_document_void_handovers
 FOR EACH ROW EXECUTE FUNCTION frm_void_copy_guard();
