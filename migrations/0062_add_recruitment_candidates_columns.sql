-- Migration: 0062_add_recruitment_candidates_columns.sql
-- Description: Add missing columns to recruitment_candidates table
-- Date: 2026-01-20

-- Add missing columns to recruitment_candidates table
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS rec_can_uuid TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS nationality_uuid TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS uploaded_photo TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS created_by_uuid TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS updated_by_uuid TEXT;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS is_sync BOOLEAN DEFAULT FALSE;

-- Update rec_can_uuid for existing rows that don't have one
UPDATE recruitment_candidates SET rec_can_uuid = gen_random_uuid()::text WHERE rec_can_uuid IS NULL;

-- Make rec_can_uuid NOT NULL and unique after population
ALTER TABLE recruitment_candidates ALTER COLUMN rec_can_uuid SET NOT NULL;

-- Create unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recruitment_candidates_rec_can_uuid_key'
    ) THEN
        ALTER TABLE recruitment_candidates ADD CONSTRAINT recruitment_candidates_rec_can_uuid_key UNIQUE (rec_can_uuid);
    END IF;
END $$;

-- Add is_deleted column if it doesn't exist (may be named is_delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recruitment_candidates' AND column_name = 'is_deleted'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'recruitment_candidates' AND column_name = 'is_delete'
        ) THEN
            -- Rename is_delete to is_deleted
            ALTER TABLE recruitment_candidates RENAME COLUMN is_delete TO is_deleted;
        ELSE
            -- Add is_deleted if neither exists
            ALTER TABLE recruitment_candidates ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;
END $$;
