-- Subject-scoped Company Form stages and immutable submission pins.
-- The only pre-existing release classified here is the approved MARPOL v01
-- mapping. Any other released staged-subject version must be classified
-- explicitly before this migration can complete.

CREATE TABLE IF NOT EXISTS frm_subject_types (
  subject_type TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS frm_subject_stages (
  subject_type TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_frm_subject_stages PRIMARY KEY (subject_type, stage_key),
  CONSTRAINT fk_frm_subject_stages_subject
    FOREIGN KEY (subject_type) REFERENCES frm_subject_types(subject_type)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

INSERT INTO frm_subject_types(subject_type, label)
VALUES ('crew_assignment', 'Crew assignment')
ON CONFLICT (subject_type) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO frm_subject_stages(subject_type, stage_key, label, sort_order)
VALUES
  ('crew_assignment', 'before_joining', 'Before joining', 0),
  ('crew_assignment', 'on_board', 'On board', 1),
  ('crew_assignment', 'at_sign_off', 'At sign-off', 2)
ON CONFLICT (subject_type, stage_key)
DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

-- Replace the fixed crew-only allowlist with the subject registry FK.
ALTER TABLE adm_forms_v2 DROP CONSTRAINT IF EXISTS chk_adm_forms_v2_subject_type;
CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_forms_v2_id_subject_type
  ON adm_forms_v2(id, subject_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_forms_v2_form_uuid_subject_type
  ON adm_forms_v2(form_uuid, subject_type);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'adm_forms_v2'::regclass
      AND conname = 'fk_adm_forms_v2_subject_type'
  ) THEN
    ALTER TABLE adm_forms_v2
      ADD CONSTRAINT fk_adm_forms_v2_subject_type
      FOREIGN KEY (subject_type) REFERENCES frm_subject_types(subject_type)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

ALTER TABLE adm_form_versions_v2 ADD COLUMN IF NOT EXISTS stage_key TEXT;
ALTER TABLE adm_form_versions_v2 ADD COLUMN IF NOT EXISTS stage_subject_type TEXT;

-- Materialize the form's subject as a server-maintained mirror on each
-- version, including versions whose stage is NULL.
UPDATE adm_form_versions_v2 v
SET stage_subject_type = f.subject_type
FROM adm_forms_v2 f
WHERE f.id = v.form_id
  AND v.stage_subject_type IS DISTINCT FROM f.subject_type;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'adm_form_versions_v2'::regclass
      AND conname = 'fk_adm_form_versions_v2_form'
  ) THEN
    ALTER TABLE adm_form_versions_v2
      ADD CONSTRAINT fk_adm_form_versions_v2_form
      FOREIGN KEY (form_id) REFERENCES adm_forms_v2(id)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'adm_form_versions_v2'::regclass
      AND conname = 'fk_adm_form_versions_v2_stage'
  ) THEN
    ALTER TABLE adm_form_versions_v2
      ADD CONSTRAINT fk_adm_form_versions_v2_stage
      FOREIGN KEY (stage_subject_type, stage_key)
      REFERENCES frm_subject_stages(subject_type, stage_key)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'adm_form_versions_v2'::regclass
      AND conname = 'fk_adm_form_versions_v2_form_subject'
  ) THEN
    ALTER TABLE adm_form_versions_v2
      ADD CONSTRAINT fk_adm_form_versions_v2_form_subject
      FOREIGN KEY (form_id, stage_subject_type)
      REFERENCES adm_forms_v2(id, subject_type)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

-- The only approved classification for historical releases. The immutable
-- UUID is absent in fresh tenants, but if present it must identify precisely
-- the approved release. Run this backfill before installing the trigger below.
DO $$
DECLARE
  target_count INTEGER;
  approved_target_count INTEGER;
  conflicting_count INTEGER;
BEGIN
  SELECT count(*) INTO target_count
  FROM adm_form_versions_v2
  WHERE fv_uuid = '3a0ded43-41a4-4460-a6b1-2cc59b0409ba';

  IF target_count > 1 THEN
    RAISE EXCEPTION 'Approved MARPOL UUID 3a0ded43-41a4-4460-a6b1-2cc59b0409ba is not unique';
  ELSIF target_count = 1 THEN
    SELECT count(*) INTO approved_target_count
    FROM adm_form_versions_v2 v
    JOIN adm_forms_v2 f ON f.id = v.form_id
    WHERE v.fv_uuid = '3a0ded43-41a4-4460-a6b1-2cc59b0409ba'
      AND v.version_no = '01'
      AND v.status = 'released'
      AND f.category = 'dynamic'
      AND f.subject_type = 'crew_assignment';

    IF approved_target_count <> 1 THEN
      RAISE EXCEPTION 'Approved MARPOL UUID 3a0ded43-41a4-4460-a6b1-2cc59b0409ba exists but does not identify a released dynamic crew_assignment version 01';
    END IF;

    SELECT count(*) INTO conflicting_count
    FROM adm_form_versions_v2
    WHERE fv_uuid = '3a0ded43-41a4-4460-a6b1-2cc59b0409ba'
      AND stage_key IS NOT NULL
      AND stage_key <> 'before_joining';
    IF conflicting_count > 0 THEN
      RAISE EXCEPTION 'Approved MARPOL version already has a conflicting stage mapping';
    END IF;
  END IF;
END;
$$;

UPDATE adm_form_versions_v2
SET stage_key = 'before_joining'
WHERE fv_uuid = '3a0ded43-41a4-4460-a6b1-2cc59b0409ba'
  AND status = 'released';

DO $$
DECLARE
  unclassified_count BIGINT;
BEGIN
  SELECT count(*) INTO unclassified_count
  FROM adm_form_versions_v2 v
  JOIN adm_forms_v2 f ON f.id = v.form_id
  WHERE v.status = 'released'
    AND EXISTS (
      SELECT 1 FROM frm_subject_stages s WHERE s.subject_type = f.subject_type
    )
    AND v.stage_key IS NULL;

  IF unclassified_count > 0 THEN
    RAISE EXCEPTION '% released form version(s) for staged subjects remain unclassified; add explicit approved mappings before migration', unclassified_count;
  END IF;
END;
$$;

-- Serialize stage-registry edits against version releases using a per-subject
-- transaction advisory lock. Foreign keys restrict removal/renaming of keys
-- already referenced by versions.
CREATE OR REPLACE FUNCTION frm_lock_subject_stage_registry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  released_unstaged_count BIGINT;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.subject_type IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('frm_subject_stage:' || OLD.subject_type, 0));
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.subject_type IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.subject_type IS DISTINCT FROM OLD.subject_type) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('frm_subject_stage:' || NEW.subject_type, 0));

    IF NOT EXISTS (
      SELECT 1
      FROM frm_subject_stages s
      WHERE s.subject_type = NEW.subject_type
    ) THEN
      SELECT count(*) INTO released_unstaged_count
      FROM adm_form_versions_v2 v
      JOIN adm_forms_v2 f ON f.id = v.form_id
      WHERE f.subject_type = NEW.subject_type
        AND v.status = 'released'
        AND v.stage_key IS NULL;

      IF released_unstaged_count > 0 THEN
        RAISE EXCEPTION 'Cannot add the first stage for subject type % while released NULL-stage form versions exist', NEW.subject_type;
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_frm_lock_subject_stage_registry_change ON frm_subject_stages;
CREATE TRIGGER tr_frm_lock_subject_stage_registry_change
BEFORE INSERT OR UPDATE OR DELETE ON frm_subject_stages
FOR EACH ROW EXECUTE FUNCTION frm_lock_subject_stage_registry_change();

CREATE OR REPLACE FUNCTION frm_enforce_form_version_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  form_subject TEXT;
  subject_has_stages BOOLEAN;
  stage_is_valid BOOLEAN;
BEGIN
  SELECT f.subject_type INTO form_subject
  FROM adm_forms_v2 f
  WHERE f.id = NEW.form_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form version references unknown form id %', NEW.form_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_subject_type IS NOT NULL
       AND NEW.stage_subject_type IS DISTINCT FROM form_subject THEN
      RAISE EXCEPTION 'stage_subject_type must match the form subject type';
    END IF;
  ELSIF NEW.stage_subject_type IS DISTINCT FROM OLD.stage_subject_type
        AND NEW.stage_subject_type IS DISTINCT FROM form_subject THEN
    RAISE EXCEPTION 'stage_subject_type must match the form subject type';
  END IF;
  NEW.stage_subject_type := form_subject;

  IF TG_OP = 'UPDATE' AND OLD.status = 'released' THEN
    IF NEW.status IS DISTINCT FROM 'released' THEN
      RAISE EXCEPTION 'Released form versions cannot be downgraded';
    END IF;
    IF NEW.form_id IS DISTINCT FROM OLD.form_id
       OR NEW.stage_key IS DISTINCT FROM OLD.stage_key
       OR NEW.stage_subject_type IS DISTINCT FROM OLD.stage_subject_type THEN
      RAISE EXCEPTION 'Released form version ownership and stage are immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF form_subject IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('frm_subject_stage:' || form_subject, 0));
  END IF;

  IF NEW.stage_key IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM frm_subject_stages s
      WHERE s.subject_type = form_subject AND s.stage_key = NEW.stage_key
    ) INTO stage_is_valid;
    IF NOT stage_is_valid THEN
      RAISE EXCEPTION 'Stage % is not registered for subject type %', NEW.stage_key, form_subject;
    END IF;
  END IF;

  IF NEW.status = 'released'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'released') THEN
    SELECT EXISTS (
      SELECT 1 FROM frm_subject_stages s WHERE s.subject_type = form_subject
    ) INTO subject_has_stages;
    IF subject_has_stages AND NEW.stage_key IS NULL THEN
      RAISE EXCEPTION 'A stage must be selected before releasing this form version';
    ELSIF NOT subject_has_stages AND NEW.stage_key IS NOT NULL THEN
      RAISE EXCEPTION 'A subject type without stages cannot release a staged form version';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_frm_enforce_form_version_stage ON adm_form_versions_v2;
CREATE TRIGGER tr_frm_enforce_form_version_stage
BEFORE INSERT OR UPDATE ON adm_form_versions_v2
FOR EACH ROW EXECUTE FUNCTION frm_enforce_form_version_stage();

CREATE TABLE IF NOT EXISTS frm_company_submissions (
  id SERIAL PRIMARY KEY,
  submission_uuid TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  form_uuid TEXT NOT NULL,
  form_version_uuid TEXT NOT NULL,
  stage_key TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT ck_frm_company_submissions_status
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT ck_frm_company_submissions_completed_at
    CHECK ((status = 'completed' AND completed_at IS NOT NULL)
        OR (status = 'in_progress' AND completed_at IS NULL)),
  CONSTRAINT uq_frm_company_submissions_form_subject_ref
    UNIQUE (form_uuid, subject_type, subject_ref),
  CONSTRAINT fk_frm_company_submissions_subject
    FOREIGN KEY (subject_type) REFERENCES frm_subject_types(subject_type)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_frm_company_submissions_form
    FOREIGN KEY (form_uuid) REFERENCES adm_forms_v2(form_uuid)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_frm_company_submissions_form_subject
    FOREIGN KEY (form_uuid, subject_type)
    REFERENCES adm_forms_v2(form_uuid, subject_type)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_frm_company_submissions_version
    FOREIGN KEY (form_version_uuid) REFERENCES adm_form_versions_v2(fv_uuid)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_frm_company_submissions_stage
    FOREIGN KEY (subject_type, stage_key)
    REFERENCES frm_subject_stages(subject_type, stage_key)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_frm_company_submissions_subject_ref
  ON frm_company_submissions(subject_type, subject_ref);

CREATE OR REPLACE FUNCTION frm_enforce_company_submission_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pinned_subject TEXT;
  pinned_status TEXT;
  pinned_stage TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.submission_uuid IS DISTINCT FROM OLD.submission_uuid
       OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
       OR NEW.subject_ref IS DISTINCT FROM OLD.subject_ref
       OR NEW.form_uuid IS DISTINCT FROM OLD.form_uuid
       OR NEW.form_version_uuid IS DISTINCT FROM OLD.form_version_uuid
       OR NEW.stage_key IS DISTINCT FROM OLD.stage_key THEN
      RAISE EXCEPTION 'Submission subject, form/version pin, and stage are immutable';
    END IF;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('frm_subject_stage:' || NEW.subject_type, 0));
  SELECT f.subject_type, v.status, v.stage_key
    INTO pinned_subject, pinned_status, pinned_stage
  FROM adm_forms_v2 f
  JOIN adm_form_versions_v2 v ON v.form_id = f.id
  WHERE f.form_uuid = NEW.form_uuid
    AND v.fv_uuid = NEW.form_version_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission form version does not belong to the selected form';
  END IF;
  IF pinned_subject IS DISTINCT FROM NEW.subject_type THEN
    RAISE EXCEPTION 'Submission subject type does not match the form';
  END IF;
  IF pinned_status IS DISTINCT FROM 'released' THEN
    RAISE EXCEPTION 'Submissions must pin a released form version';
  END IF;
  IF pinned_stage IS DISTINCT FROM NEW.stage_key THEN
    RAISE EXCEPTION 'Submission stage snapshot must match the pinned form version';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_frm_enforce_company_submission_pin ON frm_company_submissions;
CREATE TRIGGER tr_frm_enforce_company_submission_pin
BEFORE INSERT OR UPDATE ON frm_company_submissions
FOR EACH ROW EXECUTE FUNCTION frm_enforce_company_submission_pin();

CREATE TABLE IF NOT EXISTS frm_company_submission_assignments (
  id SERIAL PRIMARY KEY,
  submission_uuid TEXT NOT NULL UNIQUE,
  assign_uuid TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_frm_company_submission_assignments_submission
    FOREIGN KEY (submission_uuid) REFERENCES frm_company_submissions(submission_uuid)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_frm_company_submission_assignments_assignment
    FOREIGN KEY (assign_uuid) REFERENCES crew_assignments(assign_uuid)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION frm_enforce_company_submission_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_subject_type TEXT;
  linked_subject_ref TEXT;
BEGIN
  SELECT subject_type, subject_ref
    INTO linked_subject_type, linked_subject_ref
  FROM frm_company_submissions
  WHERE submission_uuid = NEW.submission_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crew assignment link references an unknown submission';
  END IF;
  IF linked_subject_type IS DISTINCT FROM 'crew_assignment'
     OR linked_subject_ref IS DISTINCT FROM NEW.assign_uuid THEN
    RAISE EXCEPTION 'Crew assignment link must match a crew_assignment submission subject';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_frm_enforce_company_submission_assignment
  ON frm_company_submission_assignments;
CREATE TRIGGER tr_frm_enforce_company_submission_assignment
BEFORE INSERT OR UPDATE ON frm_company_submission_assignments
FOR EACH ROW EXECUTE FUNCTION frm_enforce_company_submission_assignment();