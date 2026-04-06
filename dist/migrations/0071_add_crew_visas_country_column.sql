-- Add country text column to crew_visas table for free-hand country entry
ALTER TABLE crew_visas ADD COLUMN IF NOT EXISTS country TEXT;
