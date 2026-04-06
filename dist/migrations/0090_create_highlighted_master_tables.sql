-- Migration 0090: Create separate tables for highlighted masters (016, 021, 022, 023)
-- Each table has id (UUID), sort_order, created_at, updated_at + master-specific fields

-- 1. License & DCE Master (master_id = 016)
CREATE TABLE IF NOT EXISTS master_licenses_dce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  short_code TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Manning Agents Master (master_id = 021)
CREATE TABLE IF NOT EXISTS master_manning_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Crew Pool Master (master_id = 022)
CREATE TABLE IF NOT EXISTS master_crew_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Appraisal Type Master (master_id = 023)
CREATE TABLE IF NOT EXISTS master_appraisal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed data from master_data_entries

-- Seed License & DCE Master (016)
INSERT INTO master_licenses_dce (entry_id, name, description, short_code, sort_order, is_active, is_deleted, created_at, updated_at)
SELECT 
  entry_id,
  name,
  description,
  "shortCode",
  COALESCE("orderBy", ROW_NUMBER() OVER (ORDER BY entry_id) - 1)::INTEGER,
  COALESCE("isActive", true),
  COALESCE("isDeleted", false),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM master_data_entries
WHERE master_id = '016'
ON CONFLICT (entry_id) DO NOTHING;

-- Seed Manning Agents (021)
INSERT INTO master_manning_agents (name, country, email, phone, address, contact_person, sort_order, is_active, is_deleted, created_at, updated_at)
SELECT 
  COALESCE(name, ''),
  country,
  email,
  phone,
  address,
  "nameOfContactPerson",
  COALESCE("orderBy", ROW_NUMBER() OVER (ORDER BY entry_id) - 1)::INTEGER,
  COALESCE("isActive", true),
  COALESCE("isDeleted", false),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM master_data_entries
WHERE master_id = '021'
ON CONFLICT DO NOTHING;

-- Seed Crew Pools (022)
INSERT INTO master_crew_pools (name, description, sort_order, is_active, is_deleted, created_at, updated_at)
SELECT 
  COALESCE(name, ''),
  description,
  COALESCE("orderBy", ROW_NUMBER() OVER (ORDER BY entry_id) - 1)::INTEGER,
  COALESCE("isActive", true),
  COALESCE("isDeleted", false),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM master_data_entries
WHERE master_id = '022'
ON CONFLICT DO NOTHING;

-- Seed Appraisal Types (023)
INSERT INTO master_appraisal_types (entry_id, name, description, sort_order, is_active, is_deleted, created_at, updated_at)
SELECT 
  entry_id,
  COALESCE(name, ''),
  description,
  COALESCE("orderBy", ROW_NUMBER() OVER (ORDER BY entry_id) - 1)::INTEGER,
  COALESCE("isActive", true),
  COALESCE("isDeleted", false),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM master_data_entries
WHERE master_id = '023'
ON CONFLICT (entry_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_master_licenses_dce_entry_id ON master_licenses_dce(entry_id);
CREATE INDEX IF NOT EXISTS idx_master_licenses_dce_short_code ON master_licenses_dce(short_code);
CREATE INDEX IF NOT EXISTS idx_master_manning_agents_name ON master_manning_agents(name);
CREATE INDEX IF NOT EXISTS idx_master_crew_pools_name ON master_crew_pools(name);
CREATE INDEX IF NOT EXISTS idx_master_appraisal_types_entry_id ON master_appraisal_types(entry_id);
