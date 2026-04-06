-- Migration: 0066_fix_v2_schema_alignment.sql
-- Description: Drop and recreate v2 tables to match TypeScript schema
-- Date: 2026-01-20

-- Drop all v2 tables and recreate with correct schema
DROP TABLE IF EXISTS cand_assigned_groups CASCADE;
DROP TABLE IF EXISTS cand_recruitment_decision CASCADE;
DROP TABLE IF EXISTS cand_suitability_fleet_groups CASCADE;
DROP TABLE IF EXISTS cand_suitability_vessel_types CASCADE;
DROP TABLE IF EXISTS cand_suitability CASCADE;
DROP TABLE IF EXISTS cand_approvals CASCADE;
DROP TABLE IF EXISTS screening_b8_attachments CASCADE;
DROP TABLE IF EXISTS screening_b8_comments CASCADE;
DROP TABLE IF EXISTS screening_b8_selected_approvers CASCADE;
DROP TABLE IF EXISTS screening_b8_shortlisting CASCADE;
DROP TABLE IF EXISTS screening_b7_training_items CASCADE;
DROP TABLE IF EXISTS screening_b7_training CASCADE;
DROP TABLE IF EXISTS screening_b6_attachments CASCADE;
DROP TABLE IF EXISTS screening_b6_comments CASCADE;
DROP TABLE IF EXISTS screening_b6_interview_items CASCADE;
DROP TABLE IF EXISTS screening_b6_interviews CASCADE;
DROP TABLE IF EXISTS screening_b5_attachments CASCADE;
DROP TABLE IF EXISTS screening_b5_comments CASCADE;
DROP TABLE IF EXISTS screening_b5_test_items CASCADE;
DROP TABLE IF EXISTS screening_b5_tests CASCADE;
DROP TABLE IF EXISTS screening_b4_attachments CASCADE;
DROP TABLE IF EXISTS screening_b4_comments CASCADE;
DROP TABLE IF EXISTS screening_b4_cert_items CASCADE;
DROP TABLE IF EXISTS screening_b4_certificates CASCADE;
DROP TABLE IF EXISTS screening_b3_attachments CASCADE;
DROP TABLE IF EXISTS screening_b3_comments CASCADE;
DROP TABLE IF EXISTS screening_b3_authorities CASCADE;
DROP TABLE IF EXISTS screening_b3_security CASCADE;
DROP TABLE IF EXISTS screening_b2_attachments CASCADE;
DROP TABLE IF EXISTS screening_b2_comments CASCADE;
DROP TABLE IF EXISTS screening_b2_reference_items CASCADE;
DROP TABLE IF EXISTS screening_b2_references CASCADE;
DROP TABLE IF EXISTS screening_b1_attachments CASCADE;
DROP TABLE IF EXISTS screening_b1_comments CASCADE;
DROP TABLE IF EXISTS screening_b1_initial CASCADE;
DROP TABLE IF EXISTS cand_additional_info_attachments CASCADE;
DROP TABLE IF EXISTS cand_additional_info CASCADE;
DROP TABLE IF EXISTS cand_sea_service_attachments CASCADE;
DROP TABLE IF EXISTS cand_sea_service CASCADE;
DROP TABLE IF EXISTS cand_training_attachments CASCADE;
DROP TABLE IF EXISTS cand_training_courses CASCADE;
DROP TABLE IF EXISTS cand_licenses_attachments CASCADE;
DROP TABLE IF EXISTS cand_licenses CASCADE;
DROP TABLE IF EXISTS cand_education_attachments CASCADE;
DROP TABLE IF EXISTS cand_education CASCADE;
DROP TABLE IF EXISTS cand_visas_attachments CASCADE;
DROP TABLE IF EXISTS cand_visas CASCADE;
DROP TABLE IF EXISTS cand_documents_attachments CASCADE;
DROP TABLE IF EXISTS cand_documents CASCADE;
DROP TABLE IF EXISTS cand_next_of_kin CASCADE;
DROP TABLE IF EXISTS cand_children CASCADE;
DROP TABLE IF EXISTS cand_family_info CASCADE;
DROP TABLE IF EXISTS cand_addresses CASCADE;
DROP TABLE IF EXISTS cand_personal_details CASCADE;
DROP TABLE IF EXISTS cand_vessel_types_applied CASCADE;
DROP TABLE IF EXISTS recruitment_candidates_v2 CASCADE;

-- ============================================================================
-- CANDIDATE CORE TABLES (Phase 1 - 7 tables)
-- ============================================================================

CREATE TABLE recruitment_candidates_v2 (
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

CREATE TABLE cand_vessel_types_applied (
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

CREATE TABLE cand_personal_details (
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

CREATE TABLE cand_addresses (
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

CREATE TABLE cand_family_info (
  id SERIAL PRIMARY KEY,
  fam_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  marital_status TEXT,
  num_dependent_children TEXT,
  father_name TEXT,
  mother_name TEXT,
  spouse_first_name TEXT,
  spouse_middle_name TEXT,
  spouse_family_name TEXT,
  spouse_dob TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_children (
  id SERIAL PRIMARY KEY,
  child_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
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

CREATE TABLE cand_next_of_kin (
  id SERIAL PRIMARY KEY,
  nok_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  telephone TEXT,
  email TEXT,
  address TEXT,
  relationship TEXT,
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

CREATE TABLE cand_documents (
  id SERIAL PRIMARY KEY,
  doc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  document_id TEXT,
  document_name TEXT,
  number TEXT,
  issued TEXT,
  expiry TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_documents_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  doc_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_visas (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  country_uuid TEXT,
  serial_no TEXT,
  issued TEXT,
  expiry TEXT,
  visa_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_visas_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  visa_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_education (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  date_of_completion TEXT,
  institution TEXT,
  subjects_field TEXT,
  qualifications TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_education_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  edu_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_licenses (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  license_id TEXT,
  certificate_document TEXT,
  abbr TEXT,
  requirement TEXT,
  certificate_no TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  issued TEXT,
  expiry TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_licenses_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  lic_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_training_courses (
  id SERIAL PRIMARY KEY,
  train_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  course_id TEXT,
  training_course TEXT,
  abbr TEXT,
  requirement TEXT,
  certificate_no TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  issued TEXT,
  expiry TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_training_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  train_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_sea_service (
  id SERIAL PRIMARY KEY,
  sea_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  vessel_name TEXT,
  vessel_uuid TEXT,
  vessel_type_uuid TEXT,
  deadweight TEXT,
  engine_type_power TEXT,
  owner_operator TEXT,
  rank TEXT,
  from_date TEXT,
  to_date TEXT,
  period_months TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_sea_service_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  sea_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_additional_info (
  id SERIAL PRIMARY KEY,
  info_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  information TEXT,
  response TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_additional_info_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  info_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B1: Initial Screening (3 tables)
-- ============================================================================

CREATE TABLE screening_b1_initial (
  id SERIAL PRIMARY KEY,
  b1_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  age_meets_criteria TEXT,
  rank_meets_criteria TEXT,
  certificates_valid TEXT,
  shortlisted TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b1_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b1_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b1_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b1_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B2: References (4 tables)
-- ============================================================================

CREATE TABLE screening_b2_references (
  id SERIAL PRIMARY KEY,
  b2_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  references_completed TEXT,
  employer_feedback TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b2_reference_items (
  id SERIAL PRIMARY KEY,
  ref_uuid TEXT UNIQUE NOT NULL,
  b2_uuid TEXT NOT NULL,
  ref_date TEXT,
  name_designation TEXT,
  contact_info TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b2_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b2_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b2_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b2_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B3: Security (4 tables)
-- ============================================================================

CREATE TABLE screening_b3_security (
  id SERIAL PRIMARY KEY,
  b3_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  checks_completed TEXT,
  results TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b3_authorities (
  id SERIAL PRIMARY KEY,
  auth_uuid TEXT UNIQUE NOT NULL,
  b3_uuid TEXT NOT NULL,
  check_date TEXT,
  authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b3_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b3_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b3_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b3_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B4: Certificates (4 tables)
-- ============================================================================

CREATE TABLE screening_b4_certificates (
  id SERIAL PRIMARY KEY,
  b4_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  certificates_authenticated TEXT,
  results TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b4_cert_items (
  id SERIAL PRIMARY KEY,
  cert_uuid TEXT UNIQUE NOT NULL,
  b4_uuid TEXT NOT NULL,
  auth_date TEXT,
  certificate TEXT,
  authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b4_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b4_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b4_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b4_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B5: Tests (4 tables)
-- ============================================================================

CREATE TABLE screening_b5_tests (
  id SERIAL PRIMARY KEY,
  b5_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  tests_completed TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b5_test_items (
  id SERIAL PRIMARY KEY,
  test_uuid TEXT UNIQUE NOT NULL,
  b5_uuid TEXT NOT NULL,
  test_date TEXT,
  subject TEXT,
  score TEXT,
  result TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b5_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b5_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b5_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b5_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B6: Interviews (4 tables)
-- ============================================================================

CREATE TABLE screening_b6_interviews (
  id SERIAL PRIMARY KEY,
  b6_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  interview_completed TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b6_interview_items (
  id SERIAL PRIMARY KEY,
  int_uuid TEXT UNIQUE NOT NULL,
  b6_uuid TEXT NOT NULL,
  interview_date TEXT,
  interviewer_uuid TEXT,
  status TEXT,
  result TEXT,
  comments TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b6_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b6_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b6_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b6_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B7: Training (2 tables)
-- ============================================================================

CREATE TABLE screening_b7_training (
  id SERIAL PRIMARY KEY,
  b7_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b7_training_items (
  id SERIAL PRIMARY KEY,
  train_item_uuid TEXT UNIQUE NOT NULL,
  b7_uuid TEXT NOT NULL,
  training TEXT,
  identified_by_uuid TEXT,
  category TEXT,
  due_date TEXT,
  comments TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SCREENING B8: Shortlisting (4 tables)
-- ============================================================================

CREATE TABLE screening_b8_shortlisting (
  id SERIAL PRIMARY KEY,
  b8_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  status TEXT,
  outcome TEXT,
  submitted_by_uuid TEXT,
  submitted_date TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b8_selected_approvers (
  id SERIAL PRIMARY KEY,
  approver_uuid TEXT UNIQUE NOT NULL,
  b8_uuid TEXT NOT NULL,
  user_uuid TEXT,
  approval_status TEXT,
  approved_date TEXT,
  comments TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b8_comments (
  id SERIAL PRIMARY KEY,
  comment_uuid TEXT UNIQUE NOT NULL,
  b8_uuid TEXT NOT NULL,
  field_key TEXT,
  user_uuid TEXT,
  comment_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE screening_b8_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT UNIQUE NOT NULL,
  b8_uuid TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size TEXT,
  file_path TEXT,
  file_data TEXT,
  uploaded_by_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- APPROVALS TABLES (Phase 4 - 6 tables)
-- ============================================================================

CREATE TABLE cand_approvals (
  id SERIAL PRIMARY KEY,
  approval_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  stage TEXT,
  status TEXT,
  approver_uuid TEXT,
  approved_date TEXT,
  comments TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE cand_suitability (
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

CREATE TABLE cand_suitability_vessel_types (
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

CREATE TABLE cand_suitability_fleet_groups (
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

CREATE TABLE cand_recruitment_decision (
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

CREATE TABLE cand_assigned_groups (
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
