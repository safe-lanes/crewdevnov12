-- Migration: Consolidate promo B2 suitability into a single table with array columns.
-- Replaces the per-chip link tables promo_suitability_vessel_types_v2 and
-- promo_suitability_fleet_groups_v2 with one row per review carrying two
-- text[] columns for the selected vessel types and fleet groups.

CREATE TABLE IF NOT EXISTS promo_suitability_v2 (
  id SERIAL PRIMARY KEY,
  ps_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL UNIQUE,
  vessel_types TEXT[] NOT NULL DEFAULT '{}',
  fleet_groups TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_promo_suitability_v2_review_uuid
  ON promo_suitability_v2 (review_uuid);

-- Backfill from the existing per-chip tables. Aggregate names by review_uuid
-- in sort_order, ignoring soft-deleted rows. Full outer join so reviews that
-- have only vessel types OR only fleet groups still get a row.
WITH vt AS (
  SELECT review_uuid,
         array_agg(vessel_type_name ORDER BY sort_order, id) AS names
  FROM promo_suitability_vessel_types_v2
  WHERE COALESCE(is_deleted, false) = false
    AND vessel_type_name IS NOT NULL
    AND length(trim(vessel_type_name)) > 0
  GROUP BY review_uuid
),
fg AS (
  SELECT review_uuid,
         array_agg(fleet_group_name ORDER BY sort_order, id) AS names
  FROM promo_suitability_fleet_groups_v2
  WHERE COALESCE(is_deleted, false) = false
    AND fleet_group_name IS NOT NULL
    AND length(trim(fleet_group_name)) > 0
  GROUP BY review_uuid
)
INSERT INTO promo_suitability_v2 (ps_uuid, review_uuid, vessel_types, fleet_groups)
SELECT
  gen_random_uuid()::text,
  COALESCE(vt.review_uuid, fg.review_uuid),
  COALESCE(vt.names, ARRAY[]::text[]),
  COALESCE(fg.names, ARRAY[]::text[])
FROM vt
FULL OUTER JOIN fg ON vt.review_uuid = fg.review_uuid
ON CONFLICT (review_uuid) DO UPDATE SET
  vessel_types = EXCLUDED.vessel_types,
  fleet_groups = EXCLUDED.fleet_groups,
  updated_at = NOW();

DROP TABLE IF EXISTS promo_suitability_vessel_types_v2;
DROP TABLE IF EXISTS promo_suitability_fleet_groups_v2;
