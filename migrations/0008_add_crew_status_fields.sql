-- Migration: Add isActive and nextAvailability fields to crew_members table
-- Purpose: Support unified status logic (On Board / On Leave / Inactive) and rotation planning

-- Add isActive boolean field (default true = Active category)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add nextAvailability date field (for when crew is next ready to join vessel)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS next_availability TEXT;

-- Update existing records to have isActive = true (all existing crew are active by default)
UPDATE crew_members SET is_active = true WHERE is_active IS NULL;
