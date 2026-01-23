-- ============================================================================
-- CREW POOL V2 MIGRATION
-- Creates 25 normalized tables for Crew Pool module
-- ============================================================================

-- ============================================
-- CREW CORE (1 table)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_members_v2 (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  emp_no TEXT NOT NULL UNIQUE,
  employee_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  family_name TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  nationality_uuid TEXT,
  present_rank TEXT,
  rank_applied_for TEXT,
  status TEXT DEFAULT 'active',
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  uploaded_photo TEXT,
  source_rec_can_uuid TEXT,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- CREW ASSIGNMENTS (1 table)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_assignments (
  id SERIAL PRIMARY KEY,
  assign_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel_uuid TEXT,
  is_current BOOLEAN DEFAULT false,
  sign_on_date DATE,
  sign_off_date DATE,
  contract_period INTEGER,
  relief_due DATE,
  port_of_joining_uuid TEXT,
  port_of_leaving_uuid TEXT,
  assignment_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- CREW PROFILE (6 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_vessel_types_applied (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL,
  vessel_type_uuid TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_personal_details (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  height TEXT,
  weight TEXT,
  eye_color TEXT,
  hair_color TEXT,
  shoe_size TEXT,
  boiler_suit_size TEXT,
  safety_shoe_size TEXT,
  blood_type TEXT,
  english_level TEXT,
  additional_languages TEXT,
  religion TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_addresses (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  permanent_address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country_uuid TEXT,
  phone_home TEXT,
  phone_mobile TEXT,
  email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_family_info (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  marital_status TEXT,
  spouse_name TEXT,
  spouse_dob DATE,
  spouse_nationality TEXT,
  father_name TEXT,
  mother_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_children (
  id SERIAL PRIMARY KEY,
  child_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  child_name TEXT,
  child_dob DATE,
  child_gender TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_next_of_kin (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  nok_name TEXT,
  nok_relationship TEXT,
  nok_address TEXT,
  nok_phone TEXT,
  nok_email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- DOCUMENTS & CERTIFICATES (10 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_documents (
  id SERIAL PRIMARY KEY,
  doc_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  document_type TEXT,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  issue_country_uuid TEXT,
  issue_place TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_documents_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  doc_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_visas (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  visa_type TEXT,
  country_uuid TEXT,
  visa_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_visas_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  visa_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_education (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  education_level TEXT,
  institution TEXT,
  field_of_study TEXT,
  graduation_date DATE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_education_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  edu_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_licenses (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  license_type TEXT,
  license_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  issue_country_uuid TEXT,
  issue_place TEXT,
  grade TEXT,
  remarks TEXT,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_licenses_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  lic_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_training_courses (
  id SERIAL PRIMARY KEY,
  train_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  course_name TEXT,
  course_type TEXT,
  institution TEXT,
  issue_date DATE,
  expiry_date DATE,
  issue_country_uuid TEXT,
  certificate_number TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_training_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  train_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- SEA SERVICE (2 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_sea_service (
  id SERIAL PRIMARY KEY,
  sea_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  service_type TEXT,
  vessel_name TEXT,
  vessel_type_uuid TEXT,
  vessel_imo TEXT,
  vessel_flag TEXT,
  vessel_grt TEXT,
  vessel_dwt TEXT,
  rank_held TEXT,
  sign_on_date DATE,
  sign_off_date DATE,
  company_name TEXT,
  trade_area TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_sea_service_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  sea_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- MEDICAL (4 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_pre_joining_medicals (
  id SERIAL PRIMARY KEY,
  med_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  medical_type TEXT,
  exam_date DATE,
  expiry_date DATE,
  result TEXT,
  clinic_name TEXT,
  doctor_name TEXT,
  remarks TEXT,
  vessel_uuid TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_medical_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  med_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_doctor_visits (
  id SERIAL PRIMARY KEY,
  visit_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  visit_date DATE,
  clinic_name TEXT,
  doctor_name TEXT,
  diagnosis TEXT,
  treatment TEXT,
  follow_up_date DATE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_doctor_visits_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
  visit_uuid TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- INDEXES
-- ============================================

-- Crew Members Indexes
CREATE INDEX IF NOT EXISTS idx_crew_members_status_active ON crew_members_v2(status, is_active);
CREATE INDEX IF NOT EXISTS idx_crew_members_not_deleted ON crew_members_v2(crew_uuid) WHERE is_deleted = false;

-- Crew Assignments Indexes
CREATE INDEX IF NOT EXISTS idx_crew_assignments_crew_uuid ON crew_assignments(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_vessel_uuid ON crew_assignments(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_current ON crew_assignments(is_current) WHERE is_current = true;

-- Crew Profile Indexes
CREATE INDEX IF NOT EXISTS idx_crew_vessel_types_applied_crew_uuid ON crew_vessel_types_applied(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_children_crew_uuid ON crew_children(crew_uuid);

-- Documents & Certificates Indexes
CREATE INDEX IF NOT EXISTS idx_crew_documents_crew_uuid ON crew_documents(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_documents_attachments_doc_uuid ON crew_documents_attachments(doc_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_visas_crew_uuid ON crew_visas(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_visas_attachments_visa_uuid ON crew_visas_attachments(visa_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_education_crew_uuid ON crew_education(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_education_attachments_edu_uuid ON crew_education_attachments(edu_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_licenses_crew_uuid ON crew_licenses(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_licenses_active ON crew_licenses(crew_uuid, expiry_date) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crew_licenses_attachments_lic_uuid ON crew_licenses_attachments(lic_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_training_courses_crew_uuid ON crew_training_courses(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_training_attachments_train_uuid ON crew_training_attachments(train_uuid);

-- Sea Service Indexes
CREATE INDEX IF NOT EXISTS idx_crew_sea_service_crew_uuid ON crew_sea_service(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_sea_service_type ON crew_sea_service(crew_uuid, service_type);
CREATE INDEX IF NOT EXISTS idx_crew_sea_service_attachments_sea_uuid ON crew_sea_service_attachments(sea_uuid);

-- Medical Indexes
CREATE INDEX IF NOT EXISTS idx_crew_pre_joining_medicals_crew_uuid ON crew_pre_joining_medicals(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_medical_attachments_med_uuid ON crew_medical_attachments(med_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_doctor_visits_crew_uuid ON crew_doctor_visits(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_doctor_visits_attachments_visit_uuid ON crew_doctor_visits_attachments(visit_uuid);
