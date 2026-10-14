-- Add immutable Company Form declaration snapshots and explicit void/re-create
-- history. Applied migrations (including 0226) are intentionally untouched.
ALTER TABLE frm_company_submissions
  DROP CONSTRAINT IF EXISTS ck_frm_company_submissions_status,
  DROP CONSTRAINT IF EXISTS ck_frm_company_submissions_completed_at,
  DROP CONSTRAINT IF EXISTS ck_frm_company_submissions_voided_audit,
  DROP CONSTRAINT IF EXISTS ck_frm_company_submissions_system_snapshot,
  DROP CONSTRAINT IF EXISTS fk_frm_company_submissions_replaced_by,
  DROP CONSTRAINT IF EXISTS fk_frm_company_submissions_replaces,
  DROP CONSTRAINT IF EXISTS uq_frm_company_submissions_form_subject_ref;
DROP INDEX IF EXISTS uq_frm_company_submissions_form_subject_ref;

ALTER TABLE frm_company_submissions
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS voided_by_uuid TEXT,
  ADD COLUMN IF NOT EXISTS voided_by_name TEXT,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_previous_status TEXT,
  ADD COLUMN IF NOT EXISTS replaced_by_submission_uuid TEXT,
  ADD COLUMN IF NOT EXISTS replaces_submission_uuid TEXT,
  ADD COLUMN IF NOT EXISTS system_snapshot_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS system_snapshot_event TEXT;

ALTER TABLE frm_section_signatures
  ADD COLUMN IF NOT EXISTS witness_name TEXT;

ALTER TABLE frm_company_submissions
  ADD CONSTRAINT ck_frm_company_submissions_status
    CHECK (status IN ('in_progress', 'completed', 'voided')),
  ADD CONSTRAINT ck_frm_company_submissions_completed_at
    CHECK ((status = 'completed' AND completed_at IS NOT NULL)
        OR (status = 'in_progress' AND completed_at IS NULL)
        OR status = 'voided'),
  ADD CONSTRAINT ck_frm_company_submissions_voided_audit
    CHECK (
      (status = 'voided'
        AND voided_at IS NOT NULL
        AND voided_by_uuid IS NOT NULL
        AND voided_by_name IS NOT NULL
        AND BTRIM(voided_by_name) <> ''
        AND void_reason IS NOT NULL
        AND BTRIM(void_reason) <> ''
        AND voided_previous_status IN ('in_progress', 'completed'))
      OR
      (status <> 'voided'
        AND voided_at IS NULL
        AND voided_by_uuid IS NULL
        AND voided_by_name IS NULL
        AND void_reason IS NULL
        AND voided_previous_status IS NULL)
    ),
  ADD CONSTRAINT ck_frm_company_submissions_system_snapshot
    CHECK (
      (system_snapshot_at IS NULL AND system_snapshot_event IS NULL)
      OR
      (system_snapshot_at IS NOT NULL
        AND system_snapshot_event IN ('section_submission', 'signature'))
    ),
  ADD CONSTRAINT fk_frm_company_submissions_replaced_by
    FOREIGN KEY (replaced_by_submission_uuid)
    REFERENCES frm_company_submissions(submission_uuid)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_frm_company_submissions_replaces
    FOREIGN KEY (replaces_submission_uuid)
    REFERENCES frm_company_submissions(submission_uuid)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX uq_frm_company_submissions_form_subject_ref
  ON frm_company_submissions(form_uuid, subject_type, subject_ref)
  WHERE status <> 'voided';

CREATE TABLE IF NOT EXISTS frm_company_submission_system_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_uuid TEXT NOT NULL UNIQUE,
  submission_uuid TEXT NOT NULL
    REFERENCES frm_company_submissions(submission_uuid)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  field_key TEXT NOT NULL,
  section_uuid TEXT NOT NULL,
  question_uuid TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_uuid TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  is_sync BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_frm_company_submission_system_snapshot_value
    UNIQUE (submission_uuid, question_uuid)
);

CREATE INDEX IF NOT EXISTS idx_frm_company_submission_system_snapshots_submission
  ON frm_company_submission_system_snapshots(submission_uuid);

CREATE OR REPLACE FUNCTION frm_guard_company_submission_lifecycle_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.system_snapshot_at IS NOT NULL
       AND (NEW.system_snapshot_at IS DISTINCT FROM OLD.system_snapshot_at
         OR NEW.system_snapshot_event IS DISTINCT FROM OLD.system_snapshot_event) THEN
      RAISE EXCEPTION 'Company Form System snapshot boundary is immutable';
    END IF;
    IF OLD.status = 'voided' THEN
      IF (to_jsonb(NEW) - ARRAY['replaced_by_submission_uuid', 'updated_at'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['replaced_by_submission_uuid', 'updated_at'])
         OR (OLD.replaced_by_submission_uuid IS NOT NULL
           AND NEW.replaced_by_submission_uuid IS DISTINCT FROM OLD.replaced_by_submission_uuid) THEN
        RAISE EXCEPTION 'Voided Company Form submissions are immutable';
      END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'in_progress' AND NEW.status = 'completed')
       AND NEW.status <> 'voided' THEN
      RAISE EXCEPTION 'Company Form lifecycle status may only advance from in-progress to completed or voided';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_company_submission_lifecycle_history ON frm_company_submissions;
CREATE TRIGGER trg_guard_company_submission_lifecycle_history
BEFORE UPDATE ON frm_company_submissions
FOR EACH ROW EXECUTE FUNCTION frm_guard_company_submission_lifecycle_history();

CREATE OR REPLACE FUNCTION frm_check_company_submission_replacement_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_row RECORD;
  linked_row RECORD;
BEGIN
  SELECT * INTO current_row FROM frm_company_submissions
    WHERE submission_uuid = NEW.submission_uuid;
  IF current_row.replaced_by_submission_uuid IS NOT NULL THEN
    SELECT * INTO linked_row FROM frm_company_submissions
      WHERE submission_uuid = current_row.replaced_by_submission_uuid;
    IF NOT FOUND OR linked_row.replaces_submission_uuid IS DISTINCT FROM current_row.submission_uuid
       OR linked_row.form_uuid IS DISTINCT FROM current_row.form_uuid
       OR linked_row.subject_type IS DISTINCT FROM current_row.subject_type
       OR linked_row.subject_ref IS DISTINCT FROM current_row.subject_ref THEN
      RAISE EXCEPTION 'Company Form replacement links must be reciprocal and share the same subject and form';
    END IF;
  END IF;
  IF current_row.replaces_submission_uuid IS NOT NULL THEN
    SELECT * INTO linked_row FROM frm_company_submissions
      WHERE submission_uuid = current_row.replaces_submission_uuid;
    IF NOT FOUND OR linked_row.replaced_by_submission_uuid IS DISTINCT FROM current_row.submission_uuid
       OR linked_row.status <> 'voided'
       OR linked_row.form_uuid IS DISTINCT FROM current_row.form_uuid
       OR linked_row.subject_type IS DISTINCT FROM current_row.subject_type
       OR linked_row.subject_ref IS DISTINCT FROM current_row.subject_ref THEN
      RAISE EXCEPTION 'Company Form replacement links must be reciprocal and share the same subject and form';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_company_submission_replacement_links ON frm_company_submissions;
CREATE CONSTRAINT TRIGGER trg_check_company_submission_replacement_links
AFTER INSERT OR UPDATE ON frm_company_submissions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION frm_check_company_submission_replacement_links();

CREATE OR REPLACE FUNCTION frm_prevent_company_system_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Company Form System snapshots are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_company_system_snapshot_update ON frm_company_submission_system_snapshots;
CREATE TRIGGER trg_prevent_company_system_snapshot_update
BEFORE UPDATE OR DELETE ON frm_company_submission_system_snapshots
FOR EACH ROW EXECUTE FUNCTION frm_prevent_company_system_snapshot_mutation();