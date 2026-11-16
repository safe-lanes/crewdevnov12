-- RH-02: one live Rest Hours summary row per natural key.
-- New rows get a uuid derived from the key (see rhUuid.ts), so ship and office
-- make the same row. These indexes make a second live row impossible.
-- Existing rows keep their current uuids.

-- Keep the most recently updated live row of any key that already has more.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY vessel_id, month_value
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM rh_vessel_records_v2
  WHERE is_deleted = false
)
UPDATE rh_vessel_records_v2 t SET is_deleted = true
FROM ranked WHERE t.id = ranked.id AND ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY vessel_id, month_value
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM rh_vessel_violation_comments_v2
  WHERE is_deleted = false
)
UPDATE rh_vessel_violation_comments_v2 t SET is_deleted = true
FROM ranked WHERE t.id = ranked.id AND ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY vessel_id, month_value
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM rh_office_violation_comments_v2
  WHERE is_deleted = false
)
UPDATE rh_office_violation_comments_v2 t SET is_deleted = true
FROM ranked WHERE t.id = ranked.id AND ranked.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY vessel_id, crew_member_id, month_value, rank
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM rh_crew_records_v2
  WHERE is_deleted = false
)
UPDATE rh_crew_records_v2 t SET is_deleted = true
FROM ranked WHERE t.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS rh_vessel_records_v2_natural_key_idx
  ON rh_vessel_records_v2 (vessel_id, month_value)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS rh_vessel_violation_comments_v2_natural_key_idx
  ON rh_vessel_violation_comments_v2 (vessel_id, month_value)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS rh_office_violation_comments_v2_natural_key_idx
  ON rh_office_violation_comments_v2 (vessel_id, month_value)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS rh_crew_records_v2_natural_key_idx
  ON rh_crew_records_v2 (vessel_id, crew_member_id, month_value, rank)
  WHERE is_deleted = false;
