-- Migration 0159: Add identified_by_uuid to Promotion/Appraisal/Others training-needs tables
-- Date: 2026-07-06
-- Description:
--   Task #723 — adds an "Identified by" field to Promotion A3 and Appraisal G2
--   training sections, and fixes Training & Retention "Others" to store a real
--   user uuid instead of a display-name string. Stores the stable user_uuid
--   (not display name) so the grid can resolve the current display name via a
--   join, and renamed users/edited display names never go stale.
--   The existing training_needs_other_v2.identified_by (legacy text) column is
--   left untouched — old rows keep rendering via that column when
--   identified_by_uuid is null. Idempotent.

ALTER TABLE promo_training_needs_v2
  ADD COLUMN IF NOT EXISTS identified_by_uuid TEXT;

ALTER TABLE appr_training_needs_v2
  ADD COLUMN IF NOT EXISTS identified_by_uuid TEXT;

ALTER TABLE appr_training_followups_v2
  ADD COLUMN IF NOT EXISTS identified_by_uuid TEXT;

ALTER TABLE training_needs_other_v2
  ADD COLUMN IF NOT EXISTS identified_by_uuid TEXT;
