-- Task #500: Appraisal v2 lock-form + B1 auto-fetch source tracking.
-- Additive, idempotent.

ALTER TABLE adm_forms_v2
  ADD COLUMN IF NOT EXISTS is_lock_form BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE appraisal_results_v2
  ADD COLUMN IF NOT EXISTS is_lock_form BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE appr_trainings_v2
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
