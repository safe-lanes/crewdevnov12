-- Migration: Make present_vessel and vessel_type nullable in crew_members table
-- This allows crew members to be created without being assigned to a vessel

ALTER TABLE crew_members 
  ALTER COLUMN present_vessel DROP NOT NULL;

ALTER TABLE crew_members 
  ALTER COLUMN vessel_type DROP NOT NULL;
