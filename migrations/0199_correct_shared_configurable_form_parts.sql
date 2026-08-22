-- Correct the nine shared configurable-form part rows seeded by migration 0198.
-- This migration reconciles the existing rows in place, preserving UUIDs and
-- avoiding identifier churn for any future rows that already have references.
--
-- No sections may exist for these parts yet. Abort before updating anything if
-- a dependent section is present.

DO $$
DECLARE
  invalid_form_count INTEGER;
  invalid_part_count INTEGER;
  dependent_section_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_form_count
  FROM (
    VALUES
      ('Crew Briefing Form', 'briefing'),
      ('Crew Debriefing Form', 'debriefing'),
      ('Crew Interview Form', 'interview')
  ) AS expected_forms(name, category)
  WHERE (
    SELECT COUNT(*)
    FROM adm_forms_v2 form
    WHERE form.name = expected_forms.name
      AND form.category = expected_forms.category
      AND COALESCE(form.is_deleted, false) = false
  ) <> 1;

  IF invalid_form_count <> 0 THEN
    RAISE EXCEPTION
      'Expected exactly one active row for each shared configurable form, invalid form identities: %',
      invalid_form_count;
  END IF;

  SELECT COUNT(*)
  INTO invalid_part_count
  FROM (
    VALUES
      ('Crew Briefing Form',   'briefing',   'A'),
      ('Crew Briefing Form',   'briefing',   'B'),
      ('Crew Briefing Form',   'briefing',   'C'),
      ('Crew Debriefing Form', 'debriefing', 'A'),
      ('Crew Debriefing Form', 'debriefing', 'B'),
      ('Crew Debriefing Form', 'debriefing', 'C'),
      ('Crew Interview Form',  'interview',  'A'),
      ('Crew Interview Form',  'interview',  'B'),
      ('Crew Interview Form',  'interview',  'C')
  ) AS expected_parts(form_name, category, part_code)
  WHERE (
    SELECT COUNT(*)
    FROM frm_form_parts part
    JOIN adm_forms_v2 form ON form.form_uuid = part.form_uuid
    WHERE form.name = expected_parts.form_name
      AND form.category = expected_parts.category
      AND COALESCE(form.is_deleted, false) = false
      AND part.part_code = expected_parts.part_code
  ) <> 1;

  IF invalid_part_count <> 0 THEN
    RAISE EXCEPTION
      'Expected exactly one A/B/C part row for each shared configurable form, invalid part identities: %',
      invalid_part_count;
  END IF;

  SELECT COUNT(*)
  INTO dependent_section_count
  FROM frm_sections section
  JOIN frm_form_parts part ON part.form_part_uuid = section.form_part_uuid
  JOIN adm_forms_v2 form ON form.form_uuid = part.form_uuid
  WHERE COALESCE(form.is_deleted, false) = false
    AND (
      (form.name = 'Crew Briefing Form' AND form.category = 'briefing')
      OR (form.name = 'Crew Debriefing Form' AND form.category = 'debriefing')
      OR (form.name = 'Crew Interview Form' AND form.category = 'interview')
    )
    AND part.part_code IN ('A', 'B', 'C');

  IF dependent_section_count <> 0 THEN
    RAISE EXCEPTION
      'Refusing to correct shared configurable form parts: found % dependent section rows',
      dependent_section_count;
  END IF;
END $$;

WITH requested_parts (form_name, category, part_code, part_title, part_type, is_office_only, sort_order) AS (
  VALUES
    ('Crew Briefing Form',   'briefing',   'A', 'Basic Information',  'fixed',        false, 1),
    ('Crew Briefing Form',   'briefing',   'B', 'Briefing Points',    'configurable', false, 2),
    ('Crew Briefing Form',   'briefing',   'C', 'Office Followup',    'fixed',        true,  3),
    ('Crew Debriefing Form', 'debriefing', 'A', 'Basic Information',  'fixed',        false, 1),
    ('Crew Debriefing Form', 'debriefing', 'B', 'Debriefing Points',   'configurable', false, 2),
    ('Crew Debriefing Form', 'debriefing', 'C', 'Office Followup',     'fixed',        true,  3),
    ('Crew Interview Form',  'interview',  'A', 'Basic Information',  'fixed',        false, 1),
    ('Crew Interview Form',  'interview',  'B', 'Interview',           'configurable', false, 2),
    ('Crew Interview Form',  'interview',  'C', 'Interview Comments',  'fixed',        true,  3)
)
UPDATE frm_form_parts AS part
SET
  part_title = requested.part_title,
  part_type = requested.part_type,
  is_office_only = requested.is_office_only,
  sort_order = requested.sort_order,
  is_deleted = false,
  updated_at = NOW()
FROM requested_parts AS requested
JOIN adm_forms_v2 AS form
  ON form.name = requested.form_name
 AND form.category = requested.category
 AND COALESCE(form.is_deleted, false) = false
WHERE part.form_uuid = form.form_uuid
  AND part.part_code = requested.part_code;
