-- Migration: Create Extended Admin Module V2 Tables
-- Date: 2026-02-11
-- Description: Creates V2 versions of remaining admin tables (training, company ranks, vessel, training matrix) with UUID identifiers and audit columns

-- Training Master V2
CREATE TABLE IF NOT EXISTS adm_training_master_v2 (
  id SERIAL PRIMARY KEY,
  tm_uuid TEXT NOT NULL UNIQUE,
  training_id TEXT NOT NULL UNIQUE,
  training_name TEXT NOT NULL,
  category TEXT NOT NULL,
  training_group TEXT NOT NULL,
  requirement_reference TEXT,
  applicable_to_company BOOLEAN DEFAULT FALSE,
  training_label TEXT,
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Company Training Groups V2
CREATE TABLE IF NOT EXISTS adm_company_training_groups_v2 (
  id SERIAL PRIMARY KEY,
  ctg_uuid TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Company Trainings V2
CREATE TABLE IF NOT EXISTS adm_company_trainings_v2 (
  id SERIAL PRIMARY KEY,
  ct_uuid TEXT NOT NULL UNIQUE,
  training_master_id INTEGER NOT NULL,
  company_id TEXT NOT NULL,
  training_label TEXT NOT NULL,
  abr TEXT,
  requirement TEXT,
  group_code TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Company Training Requirements V2
CREATE TABLE IF NOT EXISTS adm_company_training_requirements_v2 (
  id SERIAL PRIMARY KEY,
  ctr_uuid TEXT NOT NULL UNIQUE,
  company_training_id INTEGER NOT NULL,
  rank_id INTEGER NOT NULL,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Company Ranks V2
CREATE TABLE IF NOT EXISTS adm_company_ranks_v2 (
  id TEXT PRIMARY KEY,
  cr_uuid TEXT NOT NULL UNIQUE,
  rank TEXT NOT NULL,
  rank_id TEXT NOT NULL,
  role TEXT,
  original_rank_id TEXT,
  is_role_row BOOLEAN DEFAULT FALSE,
  officer BOOLEAN DEFAULT FALSE,
  rating BOOLEAN DEFAULT FALSE,
  senior_officer BOOLEAN DEFAULT FALSE,
  deck_officer BOOLEAN DEFAULT FALSE,
  eng_officer BOOLEAN DEFAULT FALSE,
  petty_officer BOOLEAN DEFAULT FALSE,
  deck_rating BOOLEAN DEFAULT FALSE,
  engine_rating BOOLEAN DEFAULT FALSE,
  general_rating BOOLEAN DEFAULT FALSE,
  catering_rating BOOLEAN DEFAULT FALSE,
  safety_officer BOOLEAN DEFAULT FALSE,
  sso BOOLEAN DEFAULT FALSE,
  medical_officer BOOLEAN DEFAULT FALSE,
  navigating_officer BOOLEAN DEFAULT FALSE,
  emt_officer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Vessel Groups V2
CREATE TABLE IF NOT EXISTS adm_vessel_groups_v2 (
  id SERIAL PRIMARY KEY,
  vg_uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  vessel_ids TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Vessel Drafts V2
CREATE TABLE IF NOT EXISTS adm_vessel_drafts_v2 (
  id SERIAL PRIMARY KEY,
  vd_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  revision TEXT NOT NULL DEFAULT 'R1',
  draft_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Vessel Revisions V2
CREATE TABLE IF NOT EXISTS adm_vessel_revisions_v2 (
  id SERIAL PRIMARY KEY,
  vr_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  revision_date TEXT NOT NULL,
  revision_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Training Matrix Vessel Drafts V2
CREATE TABLE IF NOT EXISTS adm_training_matrix_vessel_drafts_v2 (
  id SERIAL PRIMARY KEY,
  tmvd_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  revision TEXT NOT NULL DEFAULT 'R1',
  draft_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

-- Training Matrix Vessel Revisions V2
CREATE TABLE IF NOT EXISTS adm_training_matrix_vessel_revisions_v2 (
  id SERIAL PRIMARY KEY,
  tmvr_uuid TEXT NOT NULL UNIQUE,
  vessel_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  revision_date TEXT NOT NULL,
  revision_data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
