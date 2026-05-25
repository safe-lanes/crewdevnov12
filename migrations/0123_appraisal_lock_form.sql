-- Task #500 + #504: Appraisal v2 lock-form + B1 auto-fetch source tracking.
-- Additive, idempotent. `adm_forms_v2.is_lock_form` defaults to TRUE so the
-- post-Stage-2 lock behavior applies to every form unless an admin opts out.

ALTER TABLE adm_forms_v2
  ADD COLUMN IF NOT EXISTS is_lock_form BOOLEAN NOT NULL DEFAULT true;

-- If the column was created earlier with DEFAULT false, flip the default
-- and backfill every existing row to true so locks fire everywhere.
ALTER TABLE adm_forms_v2
  ALTER COLUMN is_lock_form SET DEFAULT true;
UPDATE adm_forms_v2 SET is_lock_form = true WHERE is_lock_form = false;

ALTER TABLE appraisal_results_v2
  ADD COLUMN IF NOT EXISTS is_lock_form BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE appr_trainings_v2
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
