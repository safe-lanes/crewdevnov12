-- Part skeletons remain form-owned templates (form_version_uuid IS NULL).
-- Each existing form version gets its own copies. Sections may only reference
-- version-owned copies. The migration runner executes this file in one transaction.
-- Do not deploy this migration without the subsequent application read/copy changes.

LOCK TABLE adm_form_versions_v2, frm_form_parts, frm_sections IN SHARE ROW EXCLUSIVE MODE;

-- Preserve the complete section identity set and downstream row counts before
-- any DDL or data changes. These temporary tables disappear at transaction end.
CREATE TEMP TABLE _vop_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM frm_sections) AS section_count,
  (SELECT count(*) FROM frm_questions) AS question_count,
  (SELECT count(*) FROM frm_section_states) AS state_count,
  (SELECT count(*) FROM frm_answers) AS answer_count,
  (SELECT count(*) FROM frm_section_signatures) AS signature_count;

CREATE TEMP TABLE _vop_section_uuids ON COMMIT DROP AS
SELECT section_uuid FROM frm_sections;

ALTER TABLE frm_form_parts
  ADD COLUMN IF NOT EXISTS form_version_uuid TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'frm_form_parts'::regclass
      AND conname = 'fk_frm_form_parts_form_version'
  ) THEN
    ALTER TABLE frm_form_parts
      ADD CONSTRAINT fk_frm_form_parts_form_version
      FOREIGN KEY (form_version_uuid) REFERENCES adm_form_versions_v2(fv_uuid)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- The old unique constraint prohibited two versions of one form from having
-- the same code. Templates retain exactly that uniqueness through a partial
-- index, while version-owned parts are unique within their version.
ALTER TABLE frm_form_parts DROP CONSTRAINT IF EXISTS uq_frm_form_parts_form_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_form_parts_template_form_code
  ON frm_form_parts(form_uuid, part_code)
  WHERE form_version_uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_form_parts_version_code
  ON frm_form_parts(form_version_uuid, part_code)
  WHERE form_version_uuid IS NOT NULL;
-- A non-partial unique key is required as the target of the composite FK.
CREATE UNIQUE INDEX IF NOT EXISTS uq_frm_form_parts_version_uuid
  ON frm_form_parts(form_version_uuid, form_part_uuid);
CREATE INDEX IF NOT EXISTS idx_frm_form_parts_form_version_uuid
  ON frm_form_parts(form_version_uuid);

-- Derive the expected number of new copies from this tenant, including
-- soft-deleted versions and parts. Versions with no templates produce no rows.
-- NOT EXISTS also makes a safe replay of an already-completed backfill a no-op.
CREATE TEMP TABLE _vop_expected_pairs ON COMMIT DROP AS
SELECT v.fv_uuid AS version_uuid, p.form_uuid, p.part_code,
       p.form_part_uuid AS template_uuid
FROM adm_forms_v2 f
JOIN adm_form_versions_v2 v ON v.form_id = f.id
JOIN frm_form_parts p ON p.form_uuid = f.form_uuid
                     AND p.form_version_uuid IS NULL
WHERE f.category IN ('briefing', 'interview', 'debriefing');

CREATE TEMP TABLE _vop_copy_map ON COMMIT DROP AS
SELECT p.form_part_uuid AS template_uuid,
       v.fv_uuid AS version_uuid,
       gen_random_uuid()::text AS copy_uuid
FROM adm_forms_v2 f
JOIN adm_form_versions_v2 v ON v.form_id = f.id
JOIN frm_form_parts p ON p.form_uuid = f.form_uuid
                     AND p.form_version_uuid IS NULL
WHERE f.category IN ('briefing', 'interview', 'debriefing')
  AND NOT EXISTS (
    SELECT 1 FROM frm_form_parts owned
    WHERE owned.form_version_uuid = v.fv_uuid
      AND owned.part_code = p.part_code
  );

INSERT INTO frm_form_parts (
  form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
  part_type, is_office_only, sort_order, created_at, updated_at,
  created_by_uuid, updated_by_uuid, is_deleted, is_sync
)
SELECT m.copy_uuid, p.form_uuid, m.version_uuid, p.part_code, p.part_title,
       p.part_type, p.is_office_only, p.sort_order, p.created_at, p.updated_at,
       p.created_by_uuid, p.updated_by_uuid, p.is_deleted, p.is_sync
FROM _vop_copy_map m
JOIN frm_form_parts p ON p.form_part_uuid = m.template_uuid;

-- Match by the section's own version and the source template's part code;
-- additionally require the version to belong to the template's form.
UPDATE frm_sections s
SET form_part_uuid = owned.form_part_uuid
FROM frm_form_parts template
JOIN adm_forms_v2 f ON f.form_uuid = template.form_uuid
JOIN adm_form_versions_v2 v ON v.form_id = f.id
JOIN frm_form_parts owned ON owned.form_version_uuid = v.fv_uuid
                         AND owned.form_uuid = template.form_uuid
                         AND owned.part_code = template.part_code
WHERE s.form_part_uuid = template.form_part_uuid
  AND template.form_version_uuid IS NULL
  AND s.form_version_uuid = v.fv_uuid;

-- A version and its referenced part must agree, and the section's two
-- non-null UUIDs prevent a template (NULL version) from matching this FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'frm_sections'::regclass
      AND conname = 'fk_frm_sections_version_part'
  ) THEN
    ALTER TABLE frm_sections
      ADD CONSTRAINT fk_frm_sections_version_part
      FOREIGN KEY (form_version_uuid, form_part_uuid)
      REFERENCES frm_form_parts(form_version_uuid, form_part_uuid)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
DECLARE
  expected_copies bigint;
  actual_copies bigint;
  template_references bigint;
BEGIN
  SELECT count(*) INTO expected_copies FROM _vop_copy_map;
  SELECT count(*) INTO actual_copies
  FROM frm_form_parts p
  JOIN _vop_copy_map m ON m.copy_uuid = p.form_part_uuid
                     AND m.version_uuid = p.form_version_uuid;
  IF actual_copies <> expected_copies THEN
    RAISE EXCEPTION 'Version part copy count mismatch: actual %, tenant-derived expected %',
      actual_copies, expected_copies;
  END IF;
  IF EXISTS (
    SELECT 1 FROM _vop_expected_pairs expected
    LEFT JOIN frm_form_parts owned
      ON owned.form_version_uuid = expected.version_uuid
     AND owned.form_uuid = expected.form_uuid
     AND owned.part_code = expected.part_code
    WHERE owned.form_part_uuid IS NULL
  ) THEN
    RAISE EXCEPTION 'A tenant-derived version/template part pair has no version-owned copy';
  END IF;

  -- A broken or cross-form section relationship cannot silently survive.
  IF EXISTS (
    SELECT 1 FROM frm_sections s
    LEFT JOIN frm_form_parts p ON p.form_part_uuid = s.form_part_uuid
    WHERE p.form_part_uuid IS NULL
       OR p.form_version_uuid IS DISTINCT FROM s.form_version_uuid
  ) THEN
    RAISE EXCEPTION 'A section references a missing, template, or different-version part';
  END IF;
  SELECT count(*) INTO template_references
  FROM frm_sections s JOIN frm_form_parts p ON p.form_part_uuid = s.form_part_uuid
  WHERE p.form_version_uuid IS NULL;
  IF template_references <> 0 THEN
    RAISE EXCEPTION 'A form-level template still has a section reference';
  END IF;

  IF (SELECT count(*) FROM frm_sections) <> (SELECT section_count FROM _vop_before)
     OR EXISTS (
       (SELECT section_uuid FROM _vop_section_uuids EXCEPT SELECT section_uuid FROM frm_sections)
       UNION ALL
       (SELECT section_uuid FROM frm_sections EXCEPT SELECT section_uuid FROM _vop_section_uuids)
     ) THEN
    RAISE EXCEPTION 'Section count or section UUID set changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM frm_form_parts WHERE form_version_uuid IS NOT NULL
    GROUP BY form_version_uuid, part_code HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate version/part code pair';
  END IF;
  IF (SELECT count(*) FROM frm_questions) <> (SELECT question_count FROM _vop_before)
     OR (SELECT count(*) FROM frm_section_states) <> (SELECT state_count FROM _vop_before)
     OR (SELECT count(*) FROM frm_answers) <> (SELECT answer_count FROM _vop_before)
     OR (SELECT count(*) FROM frm_section_signatures) <> (SELECT signature_count FROM _vop_before) THEN
    RAISE EXCEPTION 'Question, section state, answer, or signature count changed';
  END IF;
  RAISE NOTICE 'Version-owned parts created: %, tenant-derived version/template pairs: %, sections: %, template section references: %',
    actual_copies, (SELECT count(*) FROM _vop_expected_pairs),
    (SELECT section_count FROM _vop_before), template_references;
END $$;