ALTER TABLE appraisal_results_v2 ADD COLUMN IF NOT EXISTS form_version_id INTEGER;
ALTER TABLE appraisal_results_v2 ADD COLUMN IF NOT EXISTS form_version_uuid TEXT;
