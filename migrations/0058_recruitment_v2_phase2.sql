-- Phase 2: Documents & Certificates (14 tables)
-- Recruitment V2 - Complete isolation from existing recruitment code

-- ============================================================================
-- TABLE 8: CANDIDATE TRAVEL DOCUMENTS (Passports, Seaman Books)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_travel_documents (
  id SERIAL PRIMARY KEY,
  tdoc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  document_type TEXT,
  document_number TEXT,
  issuing_country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  place_of_issue TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tdoc_rec_can_uuid ON cand_travel_documents(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_tdoc_document_type ON cand_travel_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_tdoc_expiry_date ON cand_travel_documents(expiry_date);

-- ============================================================================
-- TABLE 9: CANDIDATE VISAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_visas (
  id SERIAL PRIMARY KEY,
  visa_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  visa_type TEXT,
  issuing_country_uuid TEXT,
  serial_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  multiple_entry BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_visa_rec_can_uuid ON cand_visas(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_visa_country_uuid ON cand_visas(issuing_country_uuid);
CREATE INDEX IF NOT EXISTS idx_visa_expiry_date ON cand_visas(expiry_date);

-- ============================================================================
-- TABLE 10: CANDIDATE COC (Certificate of Competency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_coc (
  id SERIAL PRIMARY KEY,
  coc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  certificate_type TEXT,
  grade TEXT,
  limitation TEXT,
  certificate_number TEXT,
  issuing_country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_coc_rec_can_uuid ON cand_coc(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_coc_certificate_type ON cand_coc(certificate_type);
CREATE INDEX IF NOT EXISTS idx_coc_expiry_date ON cand_coc(expiry_date);

-- ============================================================================
-- TABLE 11: CANDIDATE COP (Certificate of Proficiency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_cop (
  id SERIAL PRIMARY KEY,
  cop_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  certificate_name TEXT,
  certificate_number TEXT,
  issuing_country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_cop_rec_can_uuid ON cand_cop(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_cop_expiry_date ON cand_cop(expiry_date);

-- ============================================================================
-- TABLE 12: CANDIDATE STCW CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_stcw_certificates (
  id SERIAL PRIMARY KEY,
  stcw_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  stcw_code TEXT,
  certificate_name TEXT,
  certificate_number TEXT,
  issuing_country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_stcw_rec_can_uuid ON cand_stcw_certificates(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_stcw_code ON cand_stcw_certificates(stcw_code);
CREATE INDEX IF NOT EXISTS idx_stcw_expiry_date ON cand_stcw_certificates(expiry_date);

-- ============================================================================
-- TABLE 13: CANDIDATE FLAG ENDORSEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_flag_endorsements (
  id SERIAL PRIMARY KEY,
  flag_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  flag_state_uuid TEXT,
  endorsement_type TEXT,
  certificate_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_flag_rec_can_uuid ON cand_flag_endorsements(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_flag_state_uuid ON cand_flag_endorsements(flag_state_uuid);
CREATE INDEX IF NOT EXISTS idx_flag_expiry_date ON cand_flag_endorsements(expiry_date);

-- ============================================================================
-- TABLE 14: CANDIDATE MEDICAL CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_medical_certificates (
  id SERIAL PRIMARY KEY,
  med_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  certificate_type TEXT,
  certificate_number TEXT,
  clinic_name TEXT,
  clinic_location TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  fitness_status TEXT,
  restrictions TEXT,
  blood_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_med_rec_can_uuid ON cand_medical_certificates(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_med_certificate_type ON cand_medical_certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_med_expiry_date ON cand_medical_certificates(expiry_date);

-- ============================================================================
-- TABLE 15: CANDIDATE VACCINATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_vaccinations (
  id SERIAL PRIMARY KEY,
  vacc_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  vaccine_name TEXT,
  vaccine_type TEXT,
  date_administered TEXT,
  expiry_date TEXT,
  batch_number TEXT,
  administered_by TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_vacc_rec_can_uuid ON cand_vaccinations(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_vacc_expiry_date ON cand_vaccinations(expiry_date);

-- ============================================================================
-- TABLE 16: CANDIDATE TRAINING CERTIFICATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_training_certificates (
  id SERIAL PRIMARY KEY,
  train_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  course_name TEXT,
  course_code TEXT,
  certificate_number TEXT,
  training_center TEXT,
  training_location TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_train_rec_can_uuid ON cand_training_certificates(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_train_course_name ON cand_training_certificates(course_name);
CREATE INDEX IF NOT EXISTS idx_train_expiry_date ON cand_training_certificates(expiry_date);

-- ============================================================================
-- TABLE 17: CANDIDATE EDUCATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_education (
  id SERIAL PRIMARY KEY,
  edu_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  institution_name TEXT,
  qualification TEXT,
  field_of_study TEXT,
  start_date TEXT,
  completion_date TEXT,
  grade TEXT,
  country_uuid TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_edu_rec_can_uuid ON cand_education(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_edu_completion_date ON cand_education(completion_date);

-- ============================================================================
-- TABLE 18: CANDIDATE SEA SERVICE (Internal - Current Company)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_sea_service_internal (
  id SERIAL PRIMARY KEY,
  ss_int_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  vessel_name TEXT,
  vessel_type_uuid TEXT,
  imo_number TEXT,
  gross_tonnage TEXT,
  engine_power TEXT,
  rank TEXT,
  sign_on_date TEXT,
  sign_off_date TEXT,
  duration_months TEXT,
  flag_state_uuid TEXT,
  trading_area TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ss_int_rec_can_uuid ON cand_sea_service_internal(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_ss_int_vessel_type_uuid ON cand_sea_service_internal(vessel_type_uuid);
CREATE INDEX IF NOT EXISTS idx_ss_int_sign_on_date ON cand_sea_service_internal(sign_on_date);

-- ============================================================================
-- TABLE 19: CANDIDATE SEA SERVICE (External - Other Companies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_sea_service_external (
  id SERIAL PRIMARY KEY,
  ss_ext_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  company_name TEXT,
  vessel_name TEXT,
  vessel_type_uuid TEXT,
  imo_number TEXT,
  gross_tonnage TEXT,
  engine_power TEXT,
  rank TEXT,
  sign_on_date TEXT,
  sign_off_date TEXT,
  duration_months TEXT,
  flag_state_uuid TEXT,
  trading_area TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ss_ext_rec_can_uuid ON cand_sea_service_external(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_ss_ext_company_name ON cand_sea_service_external(company_name);
CREATE INDEX IF NOT EXISTS idx_ss_ext_sign_on_date ON cand_sea_service_external(sign_on_date);

-- ============================================================================
-- TABLE 20: CANDIDATE LICENSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_licenses (
  id SERIAL PRIMARY KEY,
  lic_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  license_type TEXT,
  license_name TEXT,
  license_number TEXT,
  issuing_country_uuid TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  issuing_authority TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_lic_rec_can_uuid ON cand_licenses(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_lic_license_type ON cand_licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_lic_expiry_date ON cand_licenses(expiry_date);

-- ============================================================================
-- TABLE 21: CANDIDATE DOCUMENT ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_document_attachments (
  id SERIAL PRIMARY KEY,
  attach_uuid TEXT UNIQUE NOT NULL,
  rec_can_uuid TEXT NOT NULL,
  parent_table_name TEXT,
  parent_record_uuid TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_attach_rec_can_uuid ON cand_document_attachments(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_attach_parent_table ON cand_document_attachments(parent_table_name);
CREATE INDEX IF NOT EXISTS idx_attach_parent_record ON cand_document_attachments(parent_record_uuid);
