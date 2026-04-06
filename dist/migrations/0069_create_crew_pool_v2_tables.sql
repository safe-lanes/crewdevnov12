-- ============================================================================
-- Crew Pool V2 Migration
-- Creates 24 tables for the Crew Pool V2 module
-- ============================================================================

-- ============================================
-- CREW CORE (1 table)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_members_v2 (
  id SERIAL PRIMARY KEY,
  crew_uuid TEXT NOT NULL UNIQUE,
  emp_no TEXT NOT NULL UNIQUE,
  employee_id TEXT UNIQUE,
  first_name TEXT,
  middle_name TEXT,
  family_name TEXT,
  gender TEXT,
  dob TEXT,
  nationality_uuid TEXT,
  present_rank TEXT,
  rank_applied_for TEXT,
  status TEXT,
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
  sign_on_date TEXT,
  sign_off_date TEXT,
  contract_period TEXT,
  relief_due TEXT,
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
  cvta_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  vessel_type_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_personal_details (
  id SERIAL PRIMARY KEY,
  cpd_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  height_cm TEXT,
  weight_kg TEXT,
  bmi TEXT,
  age_in_years TEXT,
  place_of_birth_city TEXT,
  place_of_birth_country_uuid TEXT,
  native_language_uuid TEXT,
  foreign_languages TEXT,
  english_proficiency TEXT,
  manning_agent TEXT,
  crew_pool TEXT,
  availability TEXT,
  next_availability TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_addresses (
  id SERIAL PRIMARY KEY,
  addr_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_family_info (
  id SERIAL PRIMARY KEY,
  fam_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_children (
  id SERIAL PRIMARY KEY,
  child_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_next_of_kin (
  id SERIAL PRIMARY KEY,
  nok_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- DOCUMENTS & ATTACHMENTS (4 tables)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_documents (
  id SERIAL PRIMARY KEY,
  doc_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_documents_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_visas (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_visas_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- EDUCATION (2 tables)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_education (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  date_of_completion TEXT,
  institution TEXT,
  subjects_field TEXT,
  qualifications TEXT,
  sort_order INTEGER DEFAULT 0,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- LICENSES (2 tables)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_licenses (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  license_id TEXT,
  certificate_document TEXT,
  abbr TEXT,
  requirement TEXT,
  certificate_no TEXT,
  issuing_authority TEXT,
  issuing_country_uuid TEXT,
  issued TEXT,
  expiry TEXT,
  archived_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- TRAINING COURSES (2 tables)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_training_courses (
  id SERIAL PRIMARY KEY,
  train_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_training_attachments (
  id SERIAL PRIMARY KEY,
  att_uuid TEXT NOT NULL UNIQUE,
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
  vessel_uuid TEXT,
  vessel_type_uuid TEXT,
  deadweight TEXT,
  engine_type_power TEXT,
  owner_operator TEXT,
  rank TEXT,
  from_date TEXT,
  to_date TEXT,
  period_months TEXT,
  experience_categories TEXT[],
  sort_order INTEGER DEFAULT 0,
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
  vessel_uuid TEXT,
  examination_date TEXT,
  clinic_hospital TEXT,
  fit_for_duty TEXT,
  expiry_date TEXT,
  sort_order INTEGER DEFAULT 0,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS crew_doctor_visits (
  id SERIAL PRIMARY KEY,
  visit_uuid TEXT NOT NULL UNIQUE,
  crew_uuid TEXT NOT NULL,
  visit_date TEXT,
  doctor_name TEXT,
  clinic_hospital TEXT,
  reason TEXT,
  diagnosis TEXT,
  treatment TEXT,
  follow_up_date TEXT,
  sort_order INTEGER DEFAULT 0,
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
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

-- ============================================
-- INDEXES
-- ============================================

-- Crew Members Indexes
CREATE INDEX IF NOT EXISTS idx_crew_members_v2_status_active ON crew_members_v2(status, is_active);
CREATE INDEX IF NOT EXISTS idx_crew_members_v2_not_deleted ON crew_members_v2(crew_uuid) WHERE is_deleted = false;

-- Crew Assignments Indexes
CREATE INDEX IF NOT EXISTS idx_crew_assignments_crew_uuid ON crew_assignments(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_vessel_uuid ON crew_assignments(vessel_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_current ON crew_assignments(is_current) WHERE is_current = true;

-- Crew Profile Indexes
CREATE INDEX IF NOT EXISTS idx_crew_vessel_types_applied_crew_uuid ON crew_vessel_types_applied(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_personal_details_crew_uuid ON crew_personal_details(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_addresses_crew_uuid ON crew_addresses(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_family_info_crew_uuid ON crew_family_info(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_children_crew_uuid ON crew_children(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_next_of_kin_crew_uuid ON crew_next_of_kin(crew_uuid);

-- Documents Indexes
CREATE INDEX IF NOT EXISTS idx_crew_documents_crew_uuid ON crew_documents(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_documents_attachments_doc_uuid ON crew_documents_attachments(doc_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_visas_crew_uuid ON crew_visas(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_visas_attachments_visa_uuid ON crew_visas_attachments(visa_uuid);

-- Education Indexes
CREATE INDEX IF NOT EXISTS idx_crew_education_crew_uuid ON crew_education(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_education_attachments_edu_uuid ON crew_education_attachments(edu_uuid);

-- Licenses Indexes
CREATE INDEX IF NOT EXISTS idx_crew_licenses_crew_uuid ON crew_licenses(crew_uuid);
CREATE INDEX IF NOT EXISTS idx_crew_licenses_active ON crew_licenses(crew_uuid, expiry) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crew_licenses_attachments_lic_uuid ON crew_licenses_attachments(lic_uuid);

-- Training Courses Indexes
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
