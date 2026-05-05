-- Migration 0110: Create training_needs_other_v2 table
-- Date: 2026-05-05
-- Description: Persistence for "Others" entries in the Training Needs aggregator
--              (needs identified outside Recruitment / Appraisal / Promotion).

CREATE TABLE IF NOT EXISTS training_needs_other_v2 (
  id SERIAL PRIMARY KEY,
  tno_uuid TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL DEFAULT 'Others',
  crew_member_id TEXT,
  name TEXT,
  rank TEXT,
  rank_id TEXT,
  training TEXT,
  corresponding_in_db TEXT,
  identified_by TEXT,
  category TEXT,
  status TEXT,
  target_date TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS training_needs_other_v2_not_deleted_idx
  ON training_needs_other_v2 (is_deleted)
  WHERE is_deleted = FALSE;
