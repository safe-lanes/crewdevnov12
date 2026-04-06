-- Drugs & Alcohol V2 Normalized Tables
-- Migrates from single flat table (drug_alcohol_test_records) with JSON columns
-- to 5 normalized tables with proper foreign key relationships

-- Table 1: Test Records (parent)
CREATE TABLE IF NOT EXISTS da_test_records_v2 (
  id SERIAL PRIMARY KEY,
  da_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  alcohol_drug_type TEXT,
  place_location TEXT,
  date_time_test_completed TEXT,
  external_test_results_date TEXT,
  incident_id TEXT,
  equipment_not_applicable BOOLEAN DEFAULT FALSE,
  test_history TEXT,
  frequency_months INTEGER DEFAULT 12,
  planned_port TEXT,
  planned_date TEXT,
  planned_comments TEXT,
  incident_title TEXT,
  incident_date_time TEXT,
  alcohol_test_date_time TEXT,
  drug_test_date_time TEXT,
  violations INTEGER DEFAULT 0,
  test_date_time TEXT,
  other_test_type TEXT,
  reason_for_testing TEXT,
  description TEXT,
  initiated_by TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 2: Testing Equipment (child of test records)
CREATE TABLE IF NOT EXISTS da_testing_equipment_v2 (
  id SERIAL PRIMARY KEY,
  eq_uuid TEXT NOT NULL UNIQUE,
  test_record_uuid TEXT NOT NULL,
  equipment_id TEXT,
  make_model TEXT,
  serial_no TEXT,
  last_calibrated TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 3: Personnel Tested (child of test records)
CREATE TABLE IF NOT EXISTS da_personnel_tested_v2 (
  id SERIAL PRIMARY KEY,
  pt_uuid TEXT NOT NULL UNIQUE,
  test_record_uuid TEXT NOT NULL,
  crew_id TEXT,
  rank TEXT,
  name TEXT,
  alcohol_test_checked BOOLEAN DEFAULT FALSE,
  alcohol_test_date TEXT,
  alcohol_test_time TEXT,
  alcohol_results TEXT,
  alcohol_violation BOOLEAN DEFAULT FALSE,
  drug_test_checked BOOLEAN DEFAULT FALSE,
  drug_test_date TEXT,
  drug_test_time TEXT,
  drug_results TEXT,
  drug_violation BOOLEAN DEFAULT FALSE,
  witness TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 4: Signatures (one per test record)
CREATE TABLE IF NOT EXISTS da_signatures_v2 (
  id SERIAL PRIMARY KEY,
  sig_uuid TEXT NOT NULL UNIQUE,
  test_record_uuid TEXT NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  name TEXT,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Table 5: Attachments (child of test records)
CREATE TABLE IF NOT EXISTS da_attachments_v2 (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  test_record_uuid TEXT NOT NULL,
  filename TEXT,
  file_type TEXT,
  upload_date TEXT,
  uploaded_by TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_da_test_records_v2_vessel_id ON da_test_records_v2(vessel_id);
CREATE INDEX IF NOT EXISTS idx_da_test_records_v2_test_type ON da_test_records_v2(test_type);
CREATE INDEX IF NOT EXISTS idx_da_test_records_v2_status ON da_test_records_v2(status);
CREATE INDEX IF NOT EXISTS idx_da_test_records_v2_is_deleted ON da_test_records_v2(is_deleted);

CREATE INDEX IF NOT EXISTS idx_da_testing_equipment_v2_record ON da_testing_equipment_v2(test_record_uuid);
CREATE INDEX IF NOT EXISTS idx_da_testing_equipment_v2_is_deleted ON da_testing_equipment_v2(is_deleted);

CREATE INDEX IF NOT EXISTS idx_da_personnel_tested_v2_record ON da_personnel_tested_v2(test_record_uuid);
CREATE INDEX IF NOT EXISTS idx_da_personnel_tested_v2_is_deleted ON da_personnel_tested_v2(is_deleted);

CREATE INDEX IF NOT EXISTS idx_da_signatures_v2_record ON da_signatures_v2(test_record_uuid);
CREATE INDEX IF NOT EXISTS idx_da_signatures_v2_is_deleted ON da_signatures_v2(is_deleted);

CREATE INDEX IF NOT EXISTS idx_da_attachments_v2_record ON da_attachments_v2(test_record_uuid);
CREATE INDEX IF NOT EXISTS idx_da_attachments_v2_is_deleted ON da_attachments_v2(is_deleted);
