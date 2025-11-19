-- ============================================
-- MIGRATION: Add is_delete Column to recruitment_candidates
-- ============================================
-- Date: 2025-11-19
-- Purpose: Add soft delete functionality to recruitment_candidates table
-- Author: System Migration
-- Type: ALTER TABLE

-- ============================================
-- Add is_delete column if it doesn't exist
-- ============================================

DO $$ 
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'recruitment_candidates' 
        AND column_name = 'is_delete'
    ) THEN
        -- Add is_delete column with default false
        ALTER TABLE recruitment_candidates 
        ADD COLUMN is_delete BOOLEAN DEFAULT false;
        
        RAISE NOTICE 'Column is_delete added to recruitment_candidates table';
    ELSE
        RAISE NOTICE 'Column is_delete already exists in recruitment_candidates table';
    END IF;
END $$;

-- ============================================
-- Create index for performance on soft delete queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_is_delete 
ON recruitment_candidates(is_delete);

-- ============================================
-- Verification
-- ============================================

-- Verify column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'recruitment_candidates' 
AND column_name = 'is_delete';

-- Verify index exists
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'recruitment_candidates' 
AND indexname = 'idx_recruitment_candidates_is_delete';

-- ============================================
-- Migration Complete
-- ============================================
-- Changes Applied:
--   1. Added is_delete BOOLEAN column with DEFAULT false
--   2. Created index idx_recruitment_candidates_is_delete for query performance
-- 
-- Impact:
--   - All existing records will have is_delete = false
--   - Soft delete queries will be optimized
--   - No data loss - existing records preserved
-- ============================================
