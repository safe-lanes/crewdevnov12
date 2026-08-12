-- Migration 0183: Add vessel API cache tables and extend cand_sea_service
-- Purpose: Support vessel search & auto-fill from vesselapi.com with local caching
-- Created: 2026-08-03

-- ============================================================================
-- 1. master_vessels_api — local cache of vessel data from external API
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_vessels_api (
  id SERIAL PRIMARY KEY,
  vessel_api_uuid TEXT UNIQUE,
  imo TEXT,
  mmsi TEXT,
  call_sign TEXT,
  name TEXT NOT NULL,
  name_ais TEXT,
  vessel_type TEXT,
  country TEXT,
  country_code TEXT,
  year_built TEXT,
  operating_status TEXT,
  length NUMERIC,
  length_unit TEXT,
  breadth NUMERIC,
  breadth_unit TEXT,
  gross_tonnage TEXT,
  deadweight_tonnage TEXT,
  speed_calculated_avg NUMERIC,
  speed_observed_max NUMERIC,
  draught_calculated_avg NUMERIC,
  draught_observed_max NUMERIC,
  class_society TEXT,
  owner_name TEXT,
  manager_name TEXT,
  engine_type_power TEXT,
  refresh_locked_at TIMESTAMPTZ,
  api_verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Idempotent column additions for existing installations
ALTER TABLE master_vessels_api ADD COLUMN IF NOT EXISTS vessel_api_uuid TEXT UNIQUE;
ALTER TABLE master_vessels_api ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE master_vessels_api ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE master_vessels_api ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE master_vessels_api ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

-- Partial unique index: deduplicate IMO-bearing vessels by IMO
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_vessels_api_imo
  ON master_vessels_api (imo) WHERE imo IS NOT NULL;

-- Partial unique index: deduplicate IMO-less vessels by name
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_vessels_api_name_no_imo
  ON master_vessels_api (name) WHERE imo IS NULL;

-- Standard lookup indexes
CREATE INDEX IF NOT EXISTS idx_master_vessels_api_imo
  ON master_vessels_api (imo);

CREATE INDEX IF NOT EXISTS idx_master_vessels_api_name
  ON master_vessels_api (name);

-- ============================================================================
-- 2. vessel_search_misses — negative cache to avoid repeated API calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS vessel_search_misses (
  id SERIAL PRIMARY KEY,
  miss_uuid TEXT UNIQUE,
  search_key TEXT NOT NULL,
  search_by TEXT NOT NULL,  -- 'imo' | 'name'
  reason TEXT,              -- 'not_found' | 'rate_limited' | 'provider_error'
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Idempotent column additions for existing installations
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS miss_uuid TEXT UNIQUE;
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE vessel_search_misses ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_vessel_search_misses_key_by
  ON vessel_search_misses (search_key, search_by);

CREATE INDEX IF NOT EXISTS idx_vessel_search_misses_expires_at
  ON vessel_search_misses (expires_at);

-- ============================================================================
-- 3. ALTER cand_sea_service — add API-sourced vessel fields
-- ============================================================================

ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS imo_number TEXT;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS flag TEXT;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS year_built TEXT;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS gross_tonnage TEXT;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS mmsi TEXT;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS from_api BOOLEAN DEFAULT FALSE;
ALTER TABLE cand_sea_service ADD COLUMN IF NOT EXISTS api_verified_at TIMESTAMPTZ;

-- ============================================================================
-- ROLLBACK (commented out — uncomment to revert)
-- ============================================================================
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS imo_number;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS flag;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS year_built;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS gross_tonnage;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS mmsi;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS from_api;
-- ALTER TABLE cand_sea_service DROP COLUMN IF EXISTS api_verified_at;
-- DROP TABLE IF EXISTS vessel_search_misses;
-- DROP TABLE IF EXISTS master_vessels_api;
