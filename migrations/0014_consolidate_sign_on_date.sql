-- Migration: Consolidate joiningDate to signOnDate across all tables
-- Purpose: Align database schema with business logic where only Sign On Date exists (planned or actual)
-- Date: 2025-12-08

-- Step 1: Migrate data from joining_date to sign_on_date in crew_members table
-- Copy joining_date to sign_on_date where sign_on_date is NULL
UPDATE crew_members
SET sign_on_date = joining_date
WHERE sign_on_date IS NULL AND joining_date IS NOT NULL;

-- Step 2: Drop the joining_date column from crew_members
ALTER TABLE crew_members DROP COLUMN IF EXISTS joining_date;

-- Step 3: Rename joining_date to reliever_sign_on_date in vessel_planning table
-- Note: vessel_planning has TWO sign-on dates (on-board crew and reliever)
DO $$
BEGIN
    -- Check if joining_date column exists before renaming
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'vessel_planning' AND column_name = 'joining_date') THEN
        -- Rename to reliever_sign_on_date to distinguish from on-board crew's sign_on_date
        ALTER TABLE vessel_planning RENAME COLUMN joining_date TO reliever_sign_on_date;
    END IF;
END $$;

-- Step 4: Rename joining_date to sign_on_date in rotation_archive table
DO $$
BEGIN
    -- Check if joining_date column exists before renaming
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'rotation_archive' AND column_name = 'joining_date') THEN
        
        -- If sign_on_date already exists, migrate data first then drop joining_date
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rotation_archive' AND column_name = 'sign_on_date') THEN
            -- Migrate data from joining_date to sign_on_date where sign_on_date is NULL
            UPDATE rotation_archive
            SET sign_on_date = joining_date
            WHERE sign_on_date IS NULL AND joining_date IS NOT NULL;
            
            -- Drop the old column
            ALTER TABLE rotation_archive DROP COLUMN joining_date;
        ELSE
            -- Simply rename the column
            ALTER TABLE rotation_archive RENAME COLUMN joining_date TO sign_on_date;
        END IF;
    END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN crew_members.sign_on_date IS 'Date crew signed on to vessel (planned or actual based on status)';
COMMENT ON COLUMN vessel_planning.sign_on_date IS 'On-board crew actual sign-on date';
COMMENT ON COLUMN vessel_planning.reliever_sign_on_date IS 'Reliever planned/actual sign-on date (based on joining_status)';
COMMENT ON COLUMN rotation_archive.sign_on_date IS 'Historical sign-on date from rotation archive';
