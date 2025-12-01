-- Migration: Add uploaded_photo column to crew_members table
-- Date: 2025-12-01
-- Purpose: Add missing column for crew member photo storage

-- Add uploaded_photo column to crew_members table if it doesn't exist
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS uploaded_photo TEXT;

-- Also add is_active and next_availability columns if they don't exist
-- (These may also be missing from older databases)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS next_availability TEXT;
