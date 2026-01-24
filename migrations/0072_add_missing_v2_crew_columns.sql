-- Migration: Add missing columns to V2 Crew Pool tables
-- Date: 2026-01-24
-- Description: Adds vessel_type_uuid, availability, next_availability to crew_members_v2;
--              last_vessel_uuid, reason to crew_assignments;
--              vessel_name, bp, weight, any_medication_prescribed to crew_pre_joining_medicals

-- ============================================
-- crew_members_v2: Add missing columns
-- ============================================
ALTER TABLE crew_members_v2 
ADD COLUMN IF NOT EXISTS vessel_type_uuid TEXT;

ALTER TABLE crew_members_v2 
ADD COLUMN IF NOT EXISTS availability TEXT;

ALTER TABLE crew_members_v2 
ADD COLUMN IF NOT EXISTS next_availability TEXT;

-- Remove reason column from crew_members_v2 (moved to crew_assignments)
ALTER TABLE crew_members_v2 
DROP COLUMN IF EXISTS reason;

-- ============================================
-- crew_assignments: Add missing columns
-- ============================================
ALTER TABLE crew_assignments 
ADD COLUMN IF NOT EXISTS last_vessel_uuid TEXT;

ALTER TABLE crew_assignments 
ADD COLUMN IF NOT EXISTS reason TEXT;

-- ============================================
-- crew_pre_joining_medicals: Add missing columns
-- ============================================
ALTER TABLE crew_pre_joining_medicals 
ADD COLUMN IF NOT EXISTS vessel_name TEXT;

ALTER TABLE crew_pre_joining_medicals 
ADD COLUMN IF NOT EXISTS bp TEXT;

ALTER TABLE crew_pre_joining_medicals 
ADD COLUMN IF NOT EXISTS weight TEXT;

ALTER TABLE crew_pre_joining_medicals 
ADD COLUMN IF NOT EXISTS any_medication_prescribed TEXT;
