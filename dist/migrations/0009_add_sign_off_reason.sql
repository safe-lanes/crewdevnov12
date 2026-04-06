-- Migration: Add sign_off_reason field to vessel_planning table
-- This field stores the reason for crew sign-off: Contract Completed, Terminated, Medical Reasons, Others

ALTER TABLE vessel_planning 
ADD COLUMN IF NOT EXISTS sign_off_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vessel_planning.sign_off_reason IS 'Reason for sign-off: Contract Completed, Terminated, Medical Reasons, Others';
