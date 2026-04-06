-- ============================================
-- Simple Migration: Add is_delete Column
-- ============================================
-- Run directly with: psql $DATABASE_URL -f add_is_delete_column.sql
-- Safe to run multiple times (idempotent)

-- Add is_delete column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'recruitment_candidates' 
        AND column_name = 'is_delete'
    ) THEN
        ALTER TABLE recruitment_candidates 
        ADD COLUMN is_delete BOOLEAN DEFAULT false;
        
        RAISE NOTICE 'Column is_delete added to recruitment_candidates';
    ELSE
        RAISE NOTICE 'Column is_delete already exists, skipping...';
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_is_delete 
ON recruitment_candidates(is_delete);

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'recruitment_candidates' 
AND column_name = 'is_delete';

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Migration complete! is_delete column is ready.';
END $$;
