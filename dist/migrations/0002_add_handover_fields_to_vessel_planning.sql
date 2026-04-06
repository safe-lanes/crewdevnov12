-- Migration: Add handover workflow fields to vessel_planning table
-- Date: 2025-11-24
-- Description: Adds crew_status, signOnDate, takeOverDate, takeOverConfirmation, and handOverDate fields for crew handover workflow

-- Add crew_status column (primary/secondary)
ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS crew_status TEXT DEFAULT 'primary';

-- Add signOnDate column (actual sign-on date when crew boards vessel)
ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS sign_on_date TEXT;

-- Add takeOverDate column (date when secondary takes over as primary)
ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS take_over_date TEXT;

-- Add takeOverConfirmation column (checkbox confirmation for takeover)
ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS take_over_confirmation BOOLEAN DEFAULT FALSE;

-- Add handOverDate column (auto-filled when handing over, matches takeOverDate of reliever)
ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS hand_over_date TEXT;

-- Update existing records to have default crew_status
UPDATE vessel_planning
SET crew_status = 'primary'
WHERE crew_status IS NULL;

COMMENT ON COLUMN vessel_planning.crew_status IS 'Crew status during handover: primary or secondary';
COMMENT ON COLUMN vessel_planning.sign_on_date IS 'Actual sign-on date when crew boards vessel';
COMMENT ON COLUMN vessel_planning.take_over_date IS 'Date when secondary crew takes over as primary';
COMMENT ON COLUMN vessel_planning.take_over_confirmation IS 'Checkbox confirmation for takeover process';
COMMENT ON COLUMN vessel_planning.hand_over_date IS 'Auto-filled handover date (matches takeOverDate of reliever)';
