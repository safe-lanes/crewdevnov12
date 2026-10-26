CREATE TABLE IF NOT EXISTS frm_document_snapshots (
 snapshot_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL UNIQUE REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 schema_version integer NOT NULL CHECK(schema_version=1),
 input jsonb NOT NULL,
 canonical_input text NOT NULL,
 frozen_record_sha256 text NOT NULL CHECK(frozen_record_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL,
 actor_uuid text NOT NULL,
 CHECK (canonical_input::jsonb = input),
 CHECK (encode(sha256(convert_to(canonical_input,'UTF8')),'hex') = frozen_record_sha256)
);
CREATE TABLE IF NOT EXISTS frm_document_preparation_requests (
 request_uuid text PRIMARY KEY,
 submission_uuid text NOT NULL UNIQUE REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 snapshot_uuid text UNIQUE REFERENCES frm_document_snapshots(snapshot_uuid) ON DELETE RESTRICT,
 outcome text NOT NULL CHECK (outcome IN ('PENDING','UNAVAILABLE')),
 reason_code text,
 created_at timestamptz NOT NULL,
 actor_uuid text NOT NULL,
 CHECK ((outcome='PENDING' AND snapshot_uuid IS NOT NULL AND reason_code IS NULL)
     OR (outcome='UNAVAILABLE' AND snapshot_uuid IS NULL AND reason_code IS NOT NULL))
);
DROP TRIGGER IF EXISTS trg_frm_document_snapshots_immutable ON frm_document_snapshots;
CREATE TRIGGER trg_frm_document_snapshots_immutable BEFORE UPDATE OR DELETE ON frm_document_snapshots
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
DROP TRIGGER IF EXISTS trg_frm_document_requests_immutable ON frm_document_preparation_requests;
CREATE TRIGGER trg_frm_document_requests_immutable BEFORE UPDATE OR DELETE ON frm_document_preparation_requests
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
