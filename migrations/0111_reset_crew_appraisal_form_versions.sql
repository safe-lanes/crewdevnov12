-- Wipe all existing version history (released + drafts) for the
-- "Crew Appraisal Form" parent form and reset its parent metadata to the
-- "00 / today" placeholder. After this migration each rank group on that
-- form starts fresh: no released, no draft, grid shows 00 / today, and
-- the editor's Release Ver button is disabled until a draft is saved and
-- released.
--
-- Idempotent: re-runs are no-ops because we delete by form name and
-- conditionally update the parent row to the same placeholder values.
-- Other forms (Promotion Review, Rating Appraisal, Testing-form, etc.)
-- are NOT touched.

DELETE FROM adm_form_versions_v2
WHERE form_id IN (
  SELECT id FROM adm_forms_v2 WHERE name = 'Crew Appraisal Form'
);

UPDATE adm_forms_v2
SET version_no   = '00',
    version_date = to_char(NOW(), 'DD-Mon-YYYY'),
    updated_at   = NOW()
WHERE name = 'Crew Appraisal Form'
  AND (version_no IS DISTINCT FROM '00'
       OR version_date IS DISTINCT FROM to_char(NOW(), 'DD-Mon-YYYY'));
