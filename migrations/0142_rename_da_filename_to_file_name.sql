-- Migration: Rename Drugs & Alcohol filename column to file_name
-- Target: da_attachments_v2
-- Description: Standardizes the filename column name and ensures file_path is present.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'da_attachments_v2' 
          AND column_name = 'filename'
    ) THEN
        ALTER TABLE public.da_attachments_v2 
        RENAME COLUMN filename TO file_name;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'da_attachments_v2' 
          AND column_name = 'file_path'
    ) THEN
        ALTER TABLE public.da_attachments_v2 
        ADD COLUMN file_path TEXT;
    END IF;
END $$;
