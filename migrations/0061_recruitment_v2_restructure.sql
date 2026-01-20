-- Migration: 0061_recruitment_v2_restructure.sql
-- Description: Complete restructure of Recruitment V2 module with 56 tables matching spec
-- Date: 2026-01-20

-- ============================================================================
-- CANDIDATE CORE TABLES (7 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recruitment_candidates (
    id SERIAL PRIMARY KEY,
    rec_can_uuid TEXT UNIQUE NOT NULL,
    file_no TEXT UNIQUE,
    first_name TEXT,
    middle_name TEXT,
    family_name TEXT,
    gender TEXT,
    dob TEXT,
    nationality_uuid TEXT,
    present_rank TEXT,
    rank_applied_for TEXT,
    status TEXT,
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

CREATE TABLE IF NOT EXISTS cand_children (
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

CREATE TABLE IF NOT EXISTS cand_next_of_kin (
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
-- DOCUMENTS & ATTACHMENTS (14 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_documents (
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

CREATE TABLE IF NOT EXISTS cand_documents_attachments (
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

CREATE TABLE IF NOT EXISTS cand_visas (
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

CREATE TABLE IF NOT EXISTS cand_visas_attachments (
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

CREATE TABLE IF NOT EXISTS cand_education (
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

CREATE TABLE IF NOT EXISTS cand_education_attachments (
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

CREATE TABLE IF NOT EXISTS cand_licenses (
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

CREATE TABLE IF NOT EXISTS cand_licenses_attachments (
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

CREATE TABLE IF NOT EXISTS cand_training_courses (
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

CREATE TABLE IF NOT EXISTS cand_training_attachments (
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

CREATE TABLE IF NOT EXISTS cand_sea_service (
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

CREATE TABLE IF NOT EXISTS cand_sea_service_attachments (
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

CREATE TABLE IF NOT EXISTS cand_additional_info (
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

CREATE TABLE IF NOT EXISTS cand_additional_info_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b1_initial (
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

CREATE TABLE IF NOT EXISTS screening_b1_comments (
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

CREATE TABLE IF NOT EXISTS screening_b1_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b2_references (
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

CREATE TABLE IF NOT EXISTS screening_b2_reference_items (
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

CREATE TABLE IF NOT EXISTS screening_b2_comments (
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

CREATE TABLE IF NOT EXISTS screening_b2_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b3_security (
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

CREATE TABLE IF NOT EXISTS screening_b3_authorities (
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

CREATE TABLE IF NOT EXISTS screening_b3_comments (
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

CREATE TABLE IF NOT EXISTS screening_b3_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b4_certificates (
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

CREATE TABLE IF NOT EXISTS screening_b4_cert_items (
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

CREATE TABLE IF NOT EXISTS screening_b4_comments (
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

CREATE TABLE IF NOT EXISTS screening_b4_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b5_tests (
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

CREATE TABLE IF NOT EXISTS screening_b5_test_items (
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

CREATE TABLE IF NOT EXISTS screening_b5_comments (
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

CREATE TABLE IF NOT EXISTS screening_b5_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b6_interviews (
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

CREATE TABLE IF NOT EXISTS screening_b6_interview_items (
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

CREATE TABLE IF NOT EXISTS screening_b6_comments (
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

CREATE TABLE IF NOT EXISTS screening_b6_attachments (
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

CREATE TABLE IF NOT EXISTS screening_b7_training (
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

CREATE TABLE IF NOT EXISTS screening_b7_training_items (
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

CREATE TABLE IF NOT EXISTS screening_b8_shortlisting (
    id SERIAL PRIMARY KEY,
    b8_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS screening_b8_selected_approvers (
    id SERIAL PRIMARY KEY,
    approver_uuid TEXT UNIQUE NOT NULL,
    b8_uuid TEXT NOT NULL,
    user_uuid TEXT,
    sort_order INTEGER DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS screening_b8_attachments (
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
-- APPROVALS & DECISION (6 tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_approvals (
    id SERIAL PRIMARY KEY,
    approval_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT NOT NULL,
    approval_date TEXT,
    approver_uuid TEXT,
    status TEXT,
    approval_result TEXT,
    comments TEXT,
    sort_order INTEGER DEFAULT 0,
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
    sort_order INTEGER DEFAULT 0,
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
    sort_order INTEGER DEFAULT 0,
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
    recruitment_status TEXT,
    submitted_by_uuid TEXT,
    submitted_date TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cand_assigned_groups (
    id SERIAL PRIMARY KEY,
    cag_uuid TEXT UNIQUE NOT NULL,
    decision_uuid TEXT NOT NULL,
    group_uuid TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);
