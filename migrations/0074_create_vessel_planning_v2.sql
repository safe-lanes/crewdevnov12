-- V2 Migration: vessel_planning_v2 (37 columns)
-- Stores crew planning/assignments per vessel with UUID references

CREATE TABLE IF NOT EXISTS vessel_planning_v2 (
  id SERIAL PRIMARY KEY,
  plan_uuid TEXT NOT NULL UNIQUE,
  vessel_uuid TEXT NOT NULL,
  active_revision_uuid TEXT,
  rank_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  crew_uuid TEXT,
  crew_status TEXT DEFAULT 'primary',
  sign_on_date TEXT,
  relief_due TEXT,
  sign_off_date TEXT,
  sign_off_port_uuid TEXT,
  sign_off_reason TEXT,
  relief_status TEXT,
  take_over_date TEXT,
  take_over_confirmation BOOLEAN DEFAULT false,
  hand_over_date TEXT,
  reliever_crew_uuid TEXT,
  reliever_sign_on_date TEXT,
  joining_port_uuid TEXT,
  joining_status TEXT,
  contract_period_months INTEGER,
  contract_end_range_start_months INTEGER,
  contract_end_range_end_months INTEGER,
  reliever_contract_period_months INTEGER,
  reliever_contract_end_range_start_months INTEGER,
  reliever_contract_end_range_end_months INTEGER,
  deployment_checklist_completed BOOLEAN,
  applicable_docs_checked BOOLEAN,
  is_archived BOOLEAN DEFAULT false,
  archived_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_vessel ON vessel_planning_v2(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_crew ON vessel_planning_v2(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_reliever ON vessel_planning_v2(reliever_crew_uuid);
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_archived ON vessel_planning_v2(is_archived) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_vessel_planning_v2_deleted ON vessel_planning_v2(is_deleted) WHERE is_deleted = false;
