-- Migration: 0065_recruitment_v2_tables.sql
-- Description: Create recruitment v2 tables with serial IDs and UUID soft foreign keys
-- Date: 2026-01-20
-- Note: Original recruitment_candidates table is preserved unchanged

-- ============================================================================
-- CANDIDATE CORE TABLES (Phase 1 - 7 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recruitment_candidates_v2 (
  id SERIAL PRIMARY KEY,
  rec_can_uuid TEXT UNIQUE NOT NULL,
  file_no TEXT,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  gender TEXT,
  dob TEXT,
  nationality_uuid TEXT,
  present_rank TEXT,
  rank_applied_for TEXT,
  status TEXT DEFAULT 'Draft',
  uploaded_photo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_vessel_types_applied (
  id SERIAL PRIMARY KEY,
  cvta_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  vessel_type_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_personal_details (
  id SERIAL PRIMARY KEY,
  cpd_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  height_cm TEXT,
  weight_kg TEXT,
  place_of_birth_city TEXT,
  place_of_birth_country_uuid TEXT,
  age_in_years TEXT,
  native_language_uuid TEXT,
  foreign_languages TEXT,
  english_proficiency TEXT,
  manning_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_addresses (
  id SERIAL PRIMARY KEY,
  addr_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  country_of_residence_uuid TEXT,
  nearest_airport TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  contact_landline TEXT,
  mobile TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_family_info (
  id SERIAL PRIMARY KEY,
  cfi_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  marital_status TEXT,
  spouse_name TEXT,
  spouse_dob TEXT,
  spouse_occupation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_children (
  id SERIAL PRIMARY KEY,
  child_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  name TEXT,
  dob TEXT,
  gender TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_next_of_kin (
  id SERIAL PRIMARY KEY,
  nok_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  name TEXT,
  relationship TEXT,
  address TEXT,
  contact_number TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- DOCUMENTS TABLES (Phase 2 - 14 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_documents (
  id SERIAL PRIMARY KEY,
  doc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  document_type TEXT,
  document_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_documents_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  doc_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_visas (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  visa_type TEXT,
  visa_number TEXT,
  country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_visas_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  visa_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_education (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  institution TEXT,
  degree TEXT,
  field_of_study TEXT,
  start_date TEXT,
  end_date TEXT,
  grade TEXT,
  country_uuid TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_education_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  edu_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_licenses (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  license_type TEXT,
  license_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  country_uuid TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_licenses_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  lic_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_training_courses (
  id SERIAL PRIMARY KEY,
  tc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  course_name TEXT,
  institution TEXT,
  certificate_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  country_uuid TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_training_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  tc_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_sea_service (
  id SERIAL PRIMARY KEY,
  ss_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  vessel_name TEXT,
  vessel_type TEXT,
  flag TEXT,
  gross_tonnage TEXT,
  engine_type TEXT,
  rank_held TEXT,
  sign_on_date TEXT,
  sign_off_date TEXT,
  company_name TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_sea_service_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  ss_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_additional_info (
  id SERIAL PRIMARY KEY,
  ai_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  info_type TEXT,
  info_value TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_additional_info_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  ai_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B1-B8 TABLES (Phase 3)
-- ============================================================================

-- B1: Initial Screening
CREATE TABLE IF NOT EXISTS screening_b1_initial (
  id SERIAL PRIMARY KEY,
  sb1_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  screening_date TEXT,
  screened_by_uuid TEXT,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b1_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb1_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b1_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb1_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B2: Reference Check
CREATE TABLE IF NOT EXISTS screening_b2_references (
  id SERIAL PRIMARY KEY,
  sb2_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b2_reference_items (
  id SERIAL PRIMARY KEY,
  item_uuid TEXT UNIQUE NOT NULL,
  sb2_uuid TEXT NOT NULL,
  reference_name TEXT,
  reference_company TEXT,
  reference_position TEXT,
  contact_number TEXT,
  email TEXT,
  relationship TEXT,
  verification_status TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b2_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb2_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b2_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb2_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B3: Security Check
CREATE TABLE IF NOT EXISTS screening_b3_security (
  id SERIAL PRIMARY KEY,
  sb3_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b3_authorities (
  id SERIAL PRIMARY KEY,
  auth_uuid TEXT UNIQUE NOT NULL,
  sb3_uuid TEXT NOT NULL,
  authority_name TEXT,
  check_type TEXT,
  check_date TEXT,
  result TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b3_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb3_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b3_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb3_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B4: Certificate Verification
CREATE TABLE IF NOT EXISTS screening_b4_certificates (
  id SERIAL PRIMARY KEY,
  sb4_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b4_cert_items (
  id SERIAL PRIMARY KEY,
  item_uuid TEXT UNIQUE NOT NULL,
  sb4_uuid TEXT NOT NULL,
  certificate_type TEXT,
  certificate_number TEXT,
  verification_status TEXT,
  verified_date TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b4_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb4_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b4_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb4_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B5: Medical/Tests
CREATE TABLE IF NOT EXISTS screening_b5_tests (
  id SERIAL PRIMARY KEY,
  sb5_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b5_test_items (
  id SERIAL PRIMARY KEY,
  item_uuid TEXT UNIQUE NOT NULL,
  sb5_uuid TEXT NOT NULL,
  test_type TEXT,
  test_date TEXT,
  result TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b5_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb5_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b5_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb5_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B6: Interview
CREATE TABLE IF NOT EXISTS screening_b6_interviews (
  id SERIAL PRIMARY KEY,
  sb6_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  interview_date TEXT,
  interviewer_uuid TEXT,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b6_interview_items (
  id SERIAL PRIMARY KEY,
  item_uuid TEXT UNIQUE NOT NULL,
  sb6_uuid TEXT NOT NULL,
  question TEXT,
  answer TEXT,
  score INTEGER,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b6_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb6_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b6_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb6_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B7: Training Assessment
CREATE TABLE IF NOT EXISTS screening_b7_training (
  id SERIAL PRIMARY KEY,
  sb7_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b7_training_items (
  id SERIAL PRIMARY KEY,
  item_uuid TEXT UNIQUE NOT NULL,
  sb7_uuid TEXT NOT NULL,
  training_name TEXT,
  required BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  completion_date TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- B8: Final Shortlisting
CREATE TABLE IF NOT EXISTS screening_b8_shortlisting (
  id SERIAL PRIMARY KEY,
  sb8_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  decision TEXT,
  decision_date TEXT,
  decided_by_uuid TEXT,
  overall_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b8_selected_approvers (
  id SERIAL PRIMARY KEY,
  sa_uuid TEXT UNIQUE NOT NULL,
  sb8_uuid TEXT NOT NULL,
  approver_uuid TEXT,
  approval_status TEXT,
  approved_at TIMESTAMP,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b8_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  sb8_uuid TEXT NOT NULL,
  comment_text TEXT,
  commented_by_uuid TEXT,
  commented_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS screening_b8_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sb8_uuid TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- APPROVALS TABLES (Phase 4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_approvals (
  id SERIAL PRIMARY KEY,
  approval_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  stage TEXT,
  status TEXT DEFAULT 'Pending',
  approver_uuid TEXT,
  approved_at TIMESTAMP,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_suitability (
  id SERIAL PRIMARY KEY,
  suit_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  overall_rating TEXT,
  recommendation TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_suitability_vessel_types (
  id SERIAL PRIMARY KEY,
  svt_uuid TEXT UNIQUE NOT NULL,
  suit_uuid TEXT NOT NULL,
  vessel_type_uuid TEXT,
  suitability_level TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_suitability_fleet_groups (
  id SERIAL PRIMARY KEY,
  sfg_uuid TEXT UNIQUE NOT NULL,
  suit_uuid TEXT NOT NULL,
  fleet_group_uuid TEXT,
  suitability_level TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_recruitment_decision (
  id SERIAL PRIMARY KEY,
  decision_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  decision TEXT,
  decision_date TEXT,
  decided_by_uuid TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_assigned_groups (
  id SERIAL PRIMARY KEY,
  ag_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  group_uuid TEXT,
  assigned_date TEXT,
  assigned_by_uuid TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
