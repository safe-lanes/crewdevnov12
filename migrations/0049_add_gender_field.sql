-- Add gender column to recruitment_candidates table
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add gender column to crew_members table  
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS gender TEXT;

-- Set default value 'Male' for all existing records in recruitment_candidates
UPDATE recruitment_candidates SET gender = 'Male' WHERE gender IS NULL;

-- Set default value 'Male' for all existing records in crew_members
UPDATE crew_members SET gender = 'Male' WHERE gender IS NULL;
