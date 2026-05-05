-- Migration 0111: Create training_needs_source_overlay_v2
-- Date: 2026-05-05
-- Description:
--   Sanctioned persistence path for the unified Training Needs aggregator
--   to store fields that the underlying source tables don't carry, WITHOUT
--   modifying source-module schemas:
--     * Recruitment (`screening_b7_training_items`) has no `status` column
--     * Promotion   (`promo_training_needs_v2`)     has no `comments` column
--   This overlay keys by (source_type, source_ref_uuid) and is LEFT JOINed
--   on aggregate. Idempotent.

CREATE TABLE IF NOT EXISTS training_needs_source_overlay_v2 (
  id SERIAL PRIMARY KEY,
  so_uuid TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,        -- 'recruitment' | 'appraisal' | 'promotion'
  source_ref_uuid TEXT NOT NULL,    -- the source row's natural uuid
  status TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS training_needs_source_overlay_v2_key_uniq
  ON training_needs_source_overlay_v2 (source_type, source_ref_uuid)
  WHERE is_deleted = FALSE;
