-- Add the missing is_lock_form column to promotion_reviews_v2.
--
-- Background: the Drizzle schema (shared/v2/promotions/schema.ts) declares
-- `isLockForm` mapped to DB column `is_lock_form` on promotion_reviews_v2, but
-- no migration ever added it to this table. The lock-form migration
-- (0123_appraisal_lock_form.sql) added is_lock_form to adm_forms_v2 and
-- appraisal_results_v2 only. As a result every select/insert that references
-- is_lock_form on promotion_reviews_v2 failed with Postgres 42703
-- ("column does not exist"), breaking GET/POST of promotion reviews.
--
-- Additive and idempotent: re-running is a no-op via ADD COLUMN IF NOT EXISTS.
-- Default false matches the schema default.

ALTER TABLE promotion_reviews_v2
  ADD COLUMN IF NOT EXISTS is_lock_form BOOLEAN NOT NULL DEFAULT false;
