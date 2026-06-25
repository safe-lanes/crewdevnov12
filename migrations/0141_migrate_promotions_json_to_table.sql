-- Migration: promotions JSON attachments backfill and column deprecation
-- Target: promo_checklist_progress_v2
-- Description: Outlines the promotions json extraction process and deprecates the old JSON column.

/*
  NOTE ON EXECUTION LAYER:
  A database DDL script alone cannot perform the promotions migration because binary files must be 
  written to the server disk. Therefore, the migration is a two-step process:
  
  1. A Node.js migration script is run to parse the `attachments_data` JSON text columns,
     convert the base64 strings to disk files under `.private/`, and insert catalog rows 
     into `promo_checklist_attachments_v2`.
  2. This SQL script is run to rename and deprecate the old JSON column to prevent new writes.
*/

-- Step A: Rename old JSON column to indicate deprecation (rather than dropping immediately)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'promo_checklist_progress_v2' 
          AND column_name = 'attachments_data'
    ) THEN
        ALTER TABLE public.promo_checklist_progress_v2 
        RENAME COLUMN attachments_data TO deprecated_attachments_data;
    END IF;
END $$;
