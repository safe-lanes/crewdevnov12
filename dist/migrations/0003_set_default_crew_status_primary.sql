-- Migration: Set DEFAULT 'primary' for crew_status column
-- This ensures all new vessel planning records have crew_status = 'primary' by default
-- Existing NULL values will be treated as 'primary' in application logic for backward compatibility

ALTER TABLE vessel_planning 
ALTER COLUMN crew_status SET DEFAULT 'primary';

-- Update existing NULL crew_status values to 'primary' for data consistency
UPDATE vessel_planning 
SET crew_status = 'primary' 
WHERE crew_status IS NULL;
