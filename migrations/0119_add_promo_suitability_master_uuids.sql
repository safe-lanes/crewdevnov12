-- Migration: Add master UUID references to promo suitability tables.
-- B2.1 vessel types and B2.2 fleet groups now reference master records by
-- UUID (with the name kept as a denormalized fallback for legacy rows and
-- robustness if a master record is removed).

ALTER TABLE promo_suitability_vessel_types_v2
  ADD COLUMN IF NOT EXISTS vessel_type_uuid TEXT;

ALTER TABLE promo_suitability_fleet_groups_v2
  ADD COLUMN IF NOT EXISTS fleet_group_uuid TEXT;

-- Backfill UUIDs for any pre-existing rows by matching against the masters.
UPDATE promo_suitability_vessel_types_v2 svt
SET vessel_type_uuid = mvt.vt_uuid
FROM master_vessel_types mvt
WHERE svt.vessel_type_uuid IS NULL
  AND mvt.vessel_type IS NOT NULL
  AND lower(trim(mvt.vessel_type)) = lower(trim(svt.vessel_type_name));

UPDATE promo_suitability_fleet_groups_v2 sfg
SET fleet_group_uuid = mfg.fg_uuid
FROM master_fleet_groups mfg
WHERE sfg.fleet_group_uuid IS NULL
  AND mfg.name IS NOT NULL
  AND lower(trim(mfg.name)) = lower(trim(sfg.fleet_group_name));

CREATE INDEX IF NOT EXISTS idx_promo_suitability_vt_vessel_type_uuid
  ON promo_suitability_vessel_types_v2 (vessel_type_uuid);

CREATE INDEX IF NOT EXISTS idx_promo_suitability_fg_fleet_group_uuid
  ON promo_suitability_fleet_groups_v2 (fleet_group_uuid);
