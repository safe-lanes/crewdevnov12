-- Migration: Add reliever_sign_on_date column to vessel_planning
-- Purpose: Add sign-on date field for relievers to match business logic
-- Date: 2025-12-08

-- Add reliever_sign_on_date column to vessel_planning table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vessel_planning' AND column_name = 'reliever_sign_on_date') THEN
        ALTER TABLE vessel_planning ADD COLUMN reliever_sign_on_date TEXT;
        COMMENT ON COLUMN vessel_planning.reliever_sign_on_date IS 'Reliever planned/actual sign-on date (based on joining_status)';
    END IF;
END $$;
