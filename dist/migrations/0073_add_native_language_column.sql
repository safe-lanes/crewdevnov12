-- Add native_language text column to crew_personal_details table
-- This stores the language name for display, complementing native_language_uuid

ALTER TABLE crew_personal_details 
ADD COLUMN IF NOT EXISTS native_language TEXT;
