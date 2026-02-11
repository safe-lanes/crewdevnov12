-- Migration: Create Admin Module V2 Tables
-- Date: 2026-02-11
-- Description: Creates V2 versions of admin tables with UUID identifiers and audit columns

CREATE TABLE IF NOT EXISTS adm_forms_v2 (
  id SERIAL PRIMARY KEY,
  form_uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'appraisal',
  rank_group TEXT NOT NULL,
  version_no TEXT NOT NULL,
  version_date TEXT NOT NULL,
  configuration TEXT,
  shared_config TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS adm_form_versions_v2 (
  id SERIAL PRIMARY KEY,
  fv_uuid TEXT NOT NULL UNIQUE,
  form_id INTEGER NOT NULL,
  rank_group_id INTEGER,
  version_no TEXT NOT NULL,
  version_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  configuration TEXT,
  shared_config TEXT,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS adm_rank_groups_v2 (
  id SERIAL PRIMARY KEY,
  rg_uuid TEXT NOT NULL UNIQUE,
  form_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  ranks TEXT NOT NULL,
  archived_at TIMESTAMP,
  configuration TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS adm_available_ranks_v2 (
  id SERIAL PRIMARY KEY,
  ar_uuid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rank_id TEXT,
  label TEXT,
  applicable_to_company BOOLEAN,
  is_system_rank BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS adm_promotion_hierarchies_v2 (
  id SERIAL PRIMARY KEY,
  ph_uuid TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL,
  rank_path TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_sync BOOLEAN DEFAULT FALSE
);
