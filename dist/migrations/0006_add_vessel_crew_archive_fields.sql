-- Migration: Add vessel crew archive fields to vessel_planning table
-- This adds isArchived and archivedDate columns for the vessel crew archive feature

-- Add isArchived column with default false
ALTER TABLE vessel_planning ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add archivedDate column for tracking when the record was archived
ALTER TABLE vessel_planning ADD COLUMN IF NOT EXISTS archived_date TEXT;

-- Create index for filtering archived/active records efficiently
CREATE INDEX IF NOT EXISTS idx_vessel_planning_is_archived ON vessel_planning(is_archived);

-- Create composite index for vessel + archived status queries
CREATE INDEX IF NOT EXISTS idx_vessel_planning_vessel_archived ON vessel_planning(vessel_id, is_archived);
