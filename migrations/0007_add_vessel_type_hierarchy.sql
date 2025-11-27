-- Migration: Add vessel type hierarchy columns to master_data_entries
-- Date: 2025-11-27
-- Purpose: Add level, parentId, and code columns to support hierarchical vessel types

-- Add level column for hierarchy (1=Category, 2=Type, 3=Subtype)
ALTER TABLE master_data_entries ADD COLUMN IF NOT EXISTS level INTEGER;

-- Add parentId column for parent-child relationships
ALTER TABLE master_data_entries ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- Add code column for unique vessel type codes (e.g., 'OIL_TANKER', 'LPG_TANKER')
ALTER TABLE master_data_entries ADD COLUMN IF NOT EXISTS code TEXT;

-- Create index on level for efficient filtering by hierarchy level
CREATE INDEX IF NOT EXISTS idx_master_data_entries_level ON master_data_entries(level) WHERE level IS NOT NULL;

-- Create index on parentId for efficient parent-child lookups
CREATE INDEX IF NOT EXISTS idx_master_data_entries_parent_id ON master_data_entries("parentId") WHERE "parentId" IS NOT NULL;

-- Note: Vessel Type hierarchy data (Master 004) should be populated via the Admin Master Data UI
-- or through direct database inserts if needed
