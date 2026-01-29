-- V2 Migration: rotation_archive_v2 (30 columns)
-- Stores archived/deployed rotation entries for history

CREATE TABLE IF NOT EXISTS rotation_archive_v2 (
  id SERIAL PRIMARY KEY,
  archive_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  entry_uuid TEXT,
  vessel_uuid TEXT NOT NULL,
  rank TEXT NOT NULL,
  crew_uuid TEXT NOT NULL,
  crew_name TEXT,
  sign_on_date TEXT,
  joining_port_uuid TEXT,
  contract_period INTEGER,
  result TEXT NOT NULL,
  archived_by_uuid TEXT,
  archived_date TEXT,
  current_crew_uuid TEXT,
  current_crew_name TEXT,
  current_crew_sign_on_date TEXT,
  current_crew_contract_end TEXT,
  current_crew_range_start TEXT,
  current_crew_range_end TEXT,
  deployed_to_plan_uuid TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false,
  snapshot_data JSONB,
  source_plan_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_draft ON rotation_archive_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_vessel ON rotation_archive_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_crew ON rotation_archive_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_result ON rotation_archive_v2(result);
CREATE INDEX IF NOT EXISTS idx_rotation_archive_v2_deleted ON rotation_archive_v2(is_deleted) WHERE is_deleted = false;
