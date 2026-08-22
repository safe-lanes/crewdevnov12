-- Seed the product skeletons for the shared configurable-forms engine.
-- This migration runs independently in each tenant database.
--
-- The required parent metadata intentionally follows the existing
-- "Crew Appraisal Form" pattern exactly:
--   rank_group  = Cadets, Senior Officers Appraisal Form, Junior Officers Appraisal Form, Rating Appraisal Form
--   version_no  = 02
--   version_date = 10-Jul-2026
--
-- No rank groups, form versions, sections, questions, or options are created.

WITH requested_forms (name, category) AS (
  VALUES
    ('Crew Briefing Form', 'briefing'),
    ('Crew Debriefing Form', 'debriefing'),
    ('Crew Interview Form', 'interview')
)
INSERT INTO adm_forms_v2 (
  form_uuid,
  name,
  category,
  rank_group,
  version_no,
  version_date,
  created_by_uuid,
  updated_by_uuid
)
SELECT
  gen_random_uuid()::text,
  requested.name,
  requested.category,
  'Cadets, Senior Officers Appraisal Form, Junior Officers Appraisal Form, Rating Appraisal Form',
  '02',
  '10-Jul-2026',
  NULL,
  NULL
FROM requested_forms AS requested
WHERE NOT EXISTS (
  SELECT 1
  FROM adm_forms_v2 AS existing
  WHERE existing.name = requested.name
    AND existing.category = requested.category
);

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
INSERT INTO frm_form_parts (
  form_part_uuid,
  form_uuid,
  part_code,
  part_title,
  part_type,
  is_office_only,
  sort_order,
  created_by_uuid,
  updated_by_uuid
)
SELECT
  gen_random_uuid()::text,
  form.form_uuid,
  requested.part_code,
  requested.part_title,
  requested.part_type,
  requested.is_office_only,
  requested.sort_order,
  NULL,
  NULL
FROM requested_parts AS requested
JOIN adm_forms_v2 AS form
  ON form.name = requested.form_name
 AND form.category = requested.category
WHERE COALESCE(form.is_deleted, false) = false
ON CONFLICT (form_uuid, part_code) DO NOTHING;