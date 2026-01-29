-- V2 Migration: rotation_entries_v2 (30 columns)
-- Stores individual crew rotation entries (normalized from JSON assignments)

CREATE TABLE IF NOT EXISTS rotation_entries_v2 (
  id SERIAL PRIMARY KEY,
  entry_uuid TEXT NOT NULL UNIQUE,
  draft_uuid TEXT NOT NULL,
  vessel_uuid TEXT NOT NULL,
  active_revision_uuid TEXT,
  rank_id TEXT,
  rank TEXT NOT NULL,
  crew_uuid TEXT,
  sign_on_date TEXT,
  joining_port_uuid TEXT,
  contract_period INTEGER,
  sign_off_date TEXT,
  proposal_status TEXT DEFAULT 'Pending',
  proposed_by_uuid TEXT,
  proposed_date TEXT,
  deployed_date TEXT,
  deployed_by_uuid TEXT,
  rejection_reason TEXT,
  deployed_to_plan_uuid TEXT,
  current_crew_uuid TEXT,
  current_crew_sign_on_date TEXT,
  current_crew_contract_end TEXT,
  current_crew_range_start TEXT,
  current_crew_range_end TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_draft ON rotation_entries_v2(draft_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_vessel ON rotation_entries_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_crew ON rotation_entries_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_status ON rotation_entries_v2(proposal_status);
CREATE INDEX IF NOT EXISTS idx_rotation_entries_v2_deleted ON rotation_entries_v2(is_deleted) WHERE is_deleted = false;
