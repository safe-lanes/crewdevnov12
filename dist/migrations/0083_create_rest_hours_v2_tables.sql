-- Rest Hours V2 Tables Migration
-- Created: February 2026
-- Description: Create all 9 Rest Hours V2 tables with UUID and audit columns

-- ============================================
-- TABLE 1: VESSEL RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_vessel_records_v2 (
  id SERIAL PRIMARY KEY,
  rh_vessel_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  month TEXT NOT NULL,
  month_value TEXT NOT NULL,
  total_crew INTEGER NOT NULL DEFAULT 0,
  recording_status_percent INTEGER NOT NULL DEFAULT 0,
  activity_conflicting BOOLEAN NOT NULL DEFAULT FALSE,
  crew_with_activity_conflicts INTEGER NOT NULL DEFAULT 0,
  crew_with_activity_conflicts_details TEXT,
  total_violations INTEGER NOT NULL DEFAULT 0,
  crew_with_violations INTEGER NOT NULL DEFAULT 0,
  crew_with_violations_details TEXT,
  total_ncs INTEGER NOT NULL DEFAULT 0,
  crew_with_ncs INTEGER NOT NULL DEFAULT 0,
  crew_with_ncs_details TEXT,
  predicted_violations INTEGER NOT NULL DEFAULT 0,
  crew_with_predicted_violations INTEGER NOT NULL DEFAULT 0,
  crew_with_predicted_violations_details TEXT,
  predicted_ncs INTEGER NOT NULL DEFAULT 0,
  crew_with_predicted_ncs INTEGER NOT NULL DEFAULT 0,
  crew_with_predicted_ncs_details TEXT,
  vessel_review_status TEXT NOT NULL DEFAULT 'Due',
  vessel_review_submitted_date TIMESTAMP,
  office_review_status TEXT NOT NULL DEFAULT 'Due',
  office_review_submitted_date TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 2: CREW RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_crew_records_v2 (
  id SERIAL PRIMARY KEY,
  rh_crew_record_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  crew_member_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  name TEXT NOT NULL,
  month TEXT NOT NULL,
  month_value TEXT NOT NULL,
  sign_on_off_info TEXT,
  recording_status_percent INTEGER NOT NULL DEFAULT 0,
  activity_conflicting BOOLEAN NOT NULL DEFAULT FALSE,
  total_violations INTEGER NOT NULL DEFAULT 0,
  total_ncs INTEGER NOT NULL DEFAULT 0,
  predicted_violations INTEGER NOT NULL DEFAULT 0,
  predicted_ncs INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 3: DAILY RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_daily_records_v2 (
  id SERIAL PRIMARY KEY,
  rh_daily_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  vessel_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  name TEXT NOT NULL,
  month_year TEXT NOT NULL,
  daily_records TEXT NOT NULL,
  show_planning BOOLEAN DEFAULT FALSE,
  opa_mode BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS rh_daily_records_v2_unique_idx 
  ON rh_daily_records_v2 (crew_member_id, vessel_id, month_year);

-- ============================================
-- TABLE 4: VESSEL VIOLATION COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_vessel_violation_comments_v2 (
  id SERIAL PRIMARY KEY,
  vessel_comment_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  month_value TEXT NOT NULL,
  comment TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 5: OFFICE VIOLATION COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_office_violation_comments_v2 (
  id SERIAL PRIMARY KEY,
  office_comment_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  month_value TEXT NOT NULL,
  comment TEXT,
  reviewer_name TEXT,
  reviewer_position TEXT,
  review_date TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 6: NC REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_nc_reports_v2 (
  id SERIAL PRIMARY KEY,
  nc_report_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  vessel_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  month_value TEXT NOT NULL,
  nc_reference TEXT NOT NULL DEFAULT 'STCW/MLC/ILO',
  identified_root_cause TEXT,
  immediate_corrective_action TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 7: FIXED TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_fixed_tasks_v2 (
  id SERIAL PRIMARY KEY,
  fixed_task_uuid TEXT NOT NULL UNIQUE,
  crew_member_id TEXT NOT NULL,
  vessel_id TEXT NOT NULL,
  rank TEXT NOT NULL,
  name TEXT NOT NULL,
  month_year TEXT NOT NULL,
  sea_hours TEXT NOT NULL,
  port_hours TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 8: VARIABLE TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_variable_tasks_v2 (
  id SERIAL PRIMARY KEY,
  variable_task_uuid TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  crew_involved INTEGER NOT NULL,
  remarks TEXT,
  period_value TEXT,
  vessel_id TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  record_type TEXT NOT NULL,
  status_type TEXT NOT NULL,
  selected_tasks TEXT,
  other_task TEXT,
  crew_involved_details TEXT,
  comments TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- TABLE 9: DATELINE ADJUSTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_dateline_adjustments_v2 (
  id SERIAL PRIMARY KEY,
  adjustment_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  month_value TEXT NOT NULL,
  adjustments TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rh_vessel_records_v2_vessel_id ON rh_vessel_records_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_vessel_records_v2_month_value ON rh_vessel_records_v2 (month_value);
CREATE INDEX IF NOT EXISTS idx_rh_crew_records_v2_vessel_id ON rh_crew_records_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_crew_records_v2_crew_member_id ON rh_crew_records_v2 (crew_member_id);
CREATE INDEX IF NOT EXISTS idx_rh_crew_records_v2_month_value ON rh_crew_records_v2 (month_value);
CREATE INDEX IF NOT EXISTS idx_rh_daily_records_v2_vessel_id ON rh_daily_records_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_daily_records_v2_crew_member_id ON rh_daily_records_v2 (crew_member_id);
CREATE INDEX IF NOT EXISTS idx_rh_nc_reports_v2_vessel_id ON rh_nc_reports_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_nc_reports_v2_crew_member_id ON rh_nc_reports_v2 (crew_member_id);
CREATE INDEX IF NOT EXISTS idx_rh_fixed_tasks_v2_vessel_id ON rh_fixed_tasks_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_variable_tasks_v2_vessel_id ON rh_variable_tasks_v2 (vessel_id);
CREATE INDEX IF NOT EXISTS idx_rh_dateline_adjustments_v2_vessel_id ON rh_dateline_adjustments_v2 (vessel_id);
