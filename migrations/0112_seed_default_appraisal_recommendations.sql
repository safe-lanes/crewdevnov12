-- Seed the four default F2 Appraiser's Recommendations into every rank group
-- under the "Crew Appraisal Form" so the appraisal UI ships with the standard
-- baseline recommendations:
--   1. Recommended for continued service on board?
--   2. Recommended for re-employment?
--   3. Recommended for promotion?
--   4. Career Development recommendations (If Any)?
--
-- Each recommendation matches the exact JSON shape produced by the FormEditor
-- (see client/src/components/FormEditor.tsx defaultValues.recommendations):
--   { id, question, answer: "Yes", comment: "", isCustom: false }
--
-- Idempotent:
--   * Rank groups whose configuration already contains a non-empty
--     recommendations array are NOT touched.
--   * Re-running the migration is a no-op.
--
-- Scope: only "Crew Appraisal Form" rank groups. Other forms (Promotion
-- Review, Rating Appraisal, Testing-form, ...) are unaffected.

DO $$
DECLARE
  default_recs jsonb := '[
    {"id":"1","question":"Recommended for continued service on board?","answer":"Yes","comment":"","isCustom":false},
    {"id":"2","question":"Recommended for re-employment?","answer":"Yes","comment":"","isCustom":false},
    {"id":"3","question":"Recommended for promotion?","answer":"Yes","comment":"","isCustom":false},
    {"id":"4","question":"Career Development recommendations (If Any)?","answer":"Yes","comment":"","isCustom":false}
  ]'::jsonb;
BEGIN
  -- Case 1: rank groups with NULL or empty configuration --------------------
  -- Seed a minimal configuration containing just the recommendations array.
  UPDATE adm_rank_groups_v2 rg
  SET configuration = jsonb_build_object('recommendations', default_recs)::text,
      updated_at    = NOW()
  FROM adm_forms_v2 f
  WHERE rg.form_id = f.id
    AND f.name = 'Crew Appraisal Form'
    AND rg.is_deleted = FALSE
    AND (rg.configuration IS NULL OR length(trim(rg.configuration)) = 0);

  -- Case 2: rank groups with an existing configuration whose recommendations
  -- key is missing, not an array, or an empty array. Inject the defaults
  -- without disturbing any other keys (Part C/D criteria, hidden fields, etc).
  UPDATE adm_rank_groups_v2 rg
  SET configuration = jsonb_set(
        rg.configuration::jsonb,
        '{recommendations}',
        default_recs,
        TRUE
      )::text,
      updated_at = NOW()
  FROM adm_forms_v2 f
  WHERE rg.form_id = f.id
    AND f.name = 'Crew Appraisal Form'
    AND rg.is_deleted = FALSE
    AND rg.configuration IS NOT NULL
    AND length(trim(rg.configuration)) > 0
    AND (
      (rg.configuration::jsonb -> 'recommendations') IS NULL
      OR jsonb_typeof(rg.configuration::jsonb -> 'recommendations') <> 'array'
      OR jsonb_array_length(rg.configuration::jsonb -> 'recommendations') = 0
    );
END $$;
