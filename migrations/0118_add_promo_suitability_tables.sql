-- Migration: Add promotion review B2 suitability tables (vessel types & fleet groups)

CREATE TABLE IF NOT EXISTS promo_suitability_vessel_types_v2 (
  id SERIAL PRIMARY KEY,
  svt_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  vessel_type_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_promo_suitability_vt_review_uuid
  ON promo_suitability_vessel_types_v2 (review_uuid);

CREATE TABLE IF NOT EXISTS promo_suitability_fleet_groups_v2 (
  id SERIAL PRIMARY KEY,
  sfg_uuid TEXT NOT NULL UNIQUE,
  review_uuid TEXT NOT NULL,
  fleet_group_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_promo_suitability_fg_review_uuid
  ON promo_suitability_fleet_groups_v2 (review_uuid);
