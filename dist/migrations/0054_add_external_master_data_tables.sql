-- Migration: Add External API Master Data Tables
-- Date: 2025-01-09
-- Description: Create dedicated tables for syncing master data from external SAIL ERP API

-- =============================================================================
-- Nationalities Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_nationalities (
    id SERIAL PRIMARY KEY,
    cid TEXT,
    country_code TEXT,
    country_name TEXT,
    nationality TEXT,
    country_ref_id TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by INTEGER,
    is_deleted BOOLEAN DEFAULT FALSE,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nationality_cid ON master_nationalities (cid);
CREATE INDEX IF NOT EXISTS idx_nationality_country_code ON master_nationalities (country_code);

-- =============================================================================
-- Vessels Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_vessels (
    id SERIAL PRIMARY KEY,
    vuid TEXT,
    vessel TEXT,
    imo_number TEXT,
    vessel_type TEXT,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vessel_vuid ON master_vessels (vuid);
CREATE INDEX IF NOT EXISTS idx_vessel_imo ON master_vessels (imo_number);

-- =============================================================================
-- Vessel Types Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_vessel_types (
    id SERIAL PRIMARY KEY,
    vtuid TEXT,
    vessel_type TEXT,
    tanker BOOLEAN DEFAULT FALSE,
    oil_tanker BOOLEAN DEFAULT FALSE,
    gas_tanker BOOLEAN DEFAULT FALSE,
    chemical_tanker BOOLEAN DEFAULT FALSE,
    container BOOLEAN DEFAULT FALSE,
    dry BOOLEAN DEFAULT FALSE,
    other BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by INTEGER,
    updated_by INTEGER,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_vessel_types_vtuid ON master_vessel_types (vtuid);

-- =============================================================================
-- Additional Groups Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_additional_groups (
    id SERIAL PRIMARY KEY,
    external_id TEXT,
    name TEXT,
    vessels TEXT,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_add_group_ext_id ON master_additional_groups (external_id);

-- =============================================================================
-- Ports Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_ports (
    id SERIAL PRIMARY KEY,
    puid TEXT,
    name TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    country TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by INTEGER,
    port_code TEXT,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_port_puid ON master_ports (puid);
CREATE INDEX IF NOT EXISTS idx_port_code ON master_ports (port_code);

-- =============================================================================
-- Fleet Groups Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_fleet_groups (
    id SERIAL PRIMARY KEY,
    external_id TEXT,
    name TEXT,
    vessels TEXT,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_group_ext_id ON master_fleet_groups (external_id);

-- =============================================================================
-- Languages Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_languages (
    id SERIAL PRIMARY KEY,
    luid TEXT,
    iso_code TEXT,
    language_name TEXT,
    native_name TEXT,
    is_foreign_language BOOLEAN DEFAULT FALSE,
    display_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_language_luid ON master_languages (luid);
CREATE INDEX IF NOT EXISTS idx_language_iso ON master_languages (iso_code);

-- =============================================================================
-- Countries Master
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_countries (
    id SERIAL PRIMARY KEY,
    nuid TEXT,
    country_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by INTEGER,
    domain TEXT,
    order_by INTEGER,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_country_nuid ON master_countries (nuid);
-- =============================================================================
-- Users Master (External API)
-- =============================================================================
CREATE TABLE IF NOT EXISTS master_users (
    id SERIAL PRIMARY KEY,
    uuid TEXT,
    firstname TEXT,
    lastname TEXT,
    email TEXT,
    fullname TEXT,
    user_type TEXT,
    designation TEXT,
    department TEXT,
    role TEXT,
    display_name TEXT,
    synched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_user_uuid ON master_users (uuid);
CREATE INDEX IF NOT EXISTS idx_master_user_email ON master_users (email);
