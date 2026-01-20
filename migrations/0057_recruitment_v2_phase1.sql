-- ============================================================================
-- RECRUITMENT V2 - PHASE 1: CANDIDATE CORE + PROFILE TABLES
-- ============================================================================
-- This migration creates 7 new tables for the recruitment v2 module.
-- These are completely isolated from existing recruitment_candidates table.
-- ============================================================================

-- ============================================================================
-- TABLE 1: RECRUITMENT CANDIDATES V2 (Core)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recruitment_candidates_v2 (
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
    status TEXT DEFAULT 'draft',
    uploaded_photo TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sync BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_rcv2_rec_can_uuid ON recruitment_candidates_v2(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_rcv2_file_no ON recruitment_candidates_v2(file_no);
CREATE INDEX IF NOT EXISTS idx_rcv2_nationality_uuid ON recruitment_candidates_v2(nationality_uuid);
CREATE INDEX IF NOT EXISTS idx_rcv2_status ON recruitment_candidates_v2(status);

-- ============================================================================
-- TABLE 2: CANDIDATE VESSEL TYPES APPLIED (One-to-Many)
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_cvta_rec_can_uuid ON cand_vessel_types_applied(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_cvta_vessel_type_uuid ON cand_vessel_types_applied(vessel_type_uuid);

-- ============================================================================
-- TABLE 3: CANDIDATE PERSONAL DETAILS (One-to-One)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_personal_details (
    id SERIAL PRIMARY KEY,
    cpd_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_cpd_rec_can_uuid ON cand_personal_details(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_cpd_country_uuid ON cand_personal_details(place_of_birth_country_uuid);
CREATE INDEX IF NOT EXISTS idx_cpd_language_uuid ON cand_personal_details(native_language_uuid);

-- ============================================================================
-- TABLE 4: CANDIDATE ADDRESSES (One-to-One)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_addresses (
    id SERIAL PRIMARY KEY,
    addr_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_addr_rec_can_uuid ON cand_addresses(rec_can_uuid);
CREATE INDEX IF NOT EXISTS idx_addr_country_uuid ON cand_addresses(country_of_residence_uuid);

-- ============================================================================
-- TABLE 5: CANDIDATE FAMILY INFO (One-to-One)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cand_family_info (
    id SERIAL PRIMARY KEY,
    fam_uuid TEXT UNIQUE NOT NULL,
    rec_can_uuid TEXT UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_fam_rec_can_uuid ON cand_family_info(rec_can_uuid);

-- ============================================================================
-- TABLE 6: CANDIDATE CHILDREN (One-to-Many)
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_child_rec_can_uuid ON cand_children(rec_can_uuid);

-- ============================================================================
-- TABLE 7: CANDIDATE NEXT OF KIN (One-to-Many)
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_nok_rec_can_uuid ON cand_next_of_kin(rec_can_uuid);
