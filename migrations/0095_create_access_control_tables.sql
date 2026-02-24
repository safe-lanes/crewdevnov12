-- Migration 0095: Create Access Control tables
-- Tables: adm_menumaster_ac, adm_rolemaster_ac, adm_roleaccess_ac

-- 1. Menu Master table
CREATE TABLE IF NOT EXISTS adm_menumaster_ac (
  id SERIAL PRIMARY KEY,
  muid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  route VARCHAR(255) NOT NULL UNIQUE,
  parent_menu VARCHAR(36),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_menumaster_ac_parent ON adm_menumaster_ac(parent_menu);
CREATE INDEX IF NOT EXISTS idx_menumaster_ac_active ON adm_menumaster_ac(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_menumaster_ac_deleted ON adm_menumaster_ac(is_deleted) WHERE is_deleted = false;

-- 2. Role Master table
CREATE TABLE IF NOT EXISTS adm_rolemaster_ac (
  id SERIAL PRIMARY KEY,
  ruid VARCHAR(36) NOT NULL UNIQUE,
  assigned_role VARCHAR(255) NOT NULL,
  roletype VARCHAR(50) NOT NULL,
  orderby INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rolemaster_ac_active ON adm_rolemaster_ac(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rolemaster_ac_deleted ON adm_rolemaster_ac(is_deleted) WHERE is_deleted = false;

-- 3. Role Access table (permissions per role per menu)
CREATE TABLE IF NOT EXISTS adm_roleaccess_ac (
  id SERIAL PRIMARY KEY,
  rauid VARCHAR(36) NOT NULL UNIQUE,
  canview BOOLEAN NOT NULL DEFAULT false,
  cancreate BOOLEAN NOT NULL DEFAULT false,
  canedit BOOLEAN NOT NULL DEFAULT false,
  candelete BOOLEAN NOT NULL DEFAULT false,
  menu_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN DEFAULT false,
  is_sync BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_roleaccess_ac_menu ON adm_roleaccess_ac(menu_id);
CREATE INDEX IF NOT EXISTS idx_roleaccess_ac_role ON adm_roleaccess_ac(role_id);
CREATE INDEX IF NOT EXISTS idx_roleaccess_ac_role_menu ON adm_roleaccess_ac(role_id, menu_id);
CREATE INDEX IF NOT EXISTS idx_roleaccess_ac_deleted ON adm_roleaccess_ac(is_deleted) WHERE is_deleted = false;

-- Seed default roles
INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, orderby, is_active, sort_order) VALUES
  (gen_random_uuid(), 'Admin', 'Office', 1, true, 1),
  (gen_random_uuid(), 'Manager', 'Office', 2, false, 2),
  (gen_random_uuid(), 'User', 'Office', 3, true, 3),
  (gen_random_uuid(), 'Sail Admin', 'Office', 4, true, 4),
  (gen_random_uuid(), 'Super Admin', 'Office', 5, true, 5),
  (gen_random_uuid(), 'Vessel Admin', 'Ship', 6, true, 6),
  (gen_random_uuid(), 'Vessel User', 'Ship', 7, true, 7),
  (gen_random_uuid(), 'External 1', 'Office', 8, true, 8),
  (gen_random_uuid(), 'External 2', 'Office', 9, true, 9),
  (gen_random_uuid(), 'External 3', 'Office', 10, true, 10),
  (gen_random_uuid(), 'External 4', 'Office', 11, true, 11),
  (gen_random_uuid(), 'External 5', 'Office', 12, true, 12),
  (gen_random_uuid(), 'Vessel User 2', 'Ship', 13, true, 13),
  (gen_random_uuid(), 'Vessel User 3', 'Ship', 14, true, 14),
  (gen_random_uuid(), 'Vessel User 4', 'Ship', 15, true, 15)
ON CONFLICT (ruid) DO NOTHING;
