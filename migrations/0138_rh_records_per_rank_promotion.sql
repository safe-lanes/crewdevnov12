-- Rest Hours: support a separate RH record per rank after a promotion.
-- Fully additive and backward-compatible:
--   * New window columns are NULLABLE; NULL = applies to the whole month, so
--     every existing record behaves exactly as before.
--   * The unique index gains `rank`; since the column already exists on every
--     row and there is only one record per crew/vessel/month today, widening the
--     key only loosens uniqueness and cannot violate existing data.

-- 1. Rank-period applicability window on daily records (NULL = whole month).
ALTER TABLE rh_daily_records_v2 ADD COLUMN IF NOT EXISTS applicable_from TEXT;
ALTER TABLE rh_daily_records_v2 ADD COLUMN IF NOT EXISTS applicable_to TEXT;

-- 2. Rank-period window + read-only lock on fixed tasks.
ALTER TABLE rh_fixed_tasks_v2 ADD COLUMN IF NOT EXISTS applicable_from TEXT;
ALTER TABLE rh_fixed_tasks_v2 ADD COLUMN IF NOT EXISTS applicable_to TEXT;
ALTER TABLE rh_fixed_tasks_v2 ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Make daily-record uniqueness rank-aware so the promotion month can hold one
--    record per rank period (old rank + new rank).
DROP INDEX IF EXISTS rh_daily_records_v2_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS rh_daily_records_v2_unique_idx
  ON rh_daily_records_v2 (crew_member_id, vessel_id, month_year, rank);
