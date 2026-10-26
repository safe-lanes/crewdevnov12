-- Allocate references only for newly frozen records. Never backfill old evidence
-- from current crew data or alter an archived PDF.
CREATE TABLE IF NOT EXISTS frm_document_references (
 submission_uuid text PRIMARY KEY REFERENCES frm_company_submissions(submission_uuid) ON DELETE RESTRICT,
 reference_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 issued_year integer NOT NULL CHECK(issued_year BETWEEN 1900 AND 9999),
 document_reference text GENERATED ALWAYS AS (
  'CF-' || issued_year::text || '-' ||
  lpad(reference_number::text, GREATEST(6,length(reference_number::text)), '0')
 ) STORED UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_frm_document_references_immutable
 BEFORE UPDATE OR DELETE ON frm_document_references
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
