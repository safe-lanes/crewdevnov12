-- Migration: Align rh_variable_tasks_v2 with V1 column structure
-- Replace single 'date' column with V1-style startDateTime/finishDateTime columns

-- Add new V1-compatible columns
ALTER TABLE rh_variable_tasks_v2 ADD COLUMN IF NOT EXISTS start_date_time text;
ALTER TABLE rh_variable_tasks_v2 ADD COLUMN IF NOT EXISTS finish_date_time text;
ALTER TABLE rh_variable_tasks_v2 ADD COLUMN IF NOT EXISTS start_date_time_sort text;
ALTER TABLE rh_variable_tasks_v2 ADD COLUMN IF NOT EXISTS finish_date_time_sort text;

-- Backfill existing records if date column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rh_variable_tasks_v2' AND column_name = 'date'
  ) THEN
    UPDATE rh_variable_tasks_v2
    SET start_date_time = COALESCE(date, ''),
        finish_date_time = COALESCE(date, ''),
        start_date_time_sort = COALESCE(date, ''),
        finish_date_time_sort = COALESCE(date, '')
    WHERE start_date_time IS NULL;
  END IF;
END $$;

-- Set defaults for any NULLs remaining
UPDATE rh_variable_tasks_v2 SET start_date_time = '' WHERE start_date_time IS NULL;
UPDATE rh_variable_tasks_v2 SET finish_date_time = '' WHERE finish_date_time IS NULL;
UPDATE rh_variable_tasks_v2 SET start_date_time_sort = '' WHERE start_date_time_sort IS NULL;
UPDATE rh_variable_tasks_v2 SET finish_date_time_sort = '' WHERE finish_date_time_sort IS NULL;

-- Make the new columns NOT NULL after backfill
ALTER TABLE rh_variable_tasks_v2 ALTER COLUMN start_date_time SET NOT NULL;
ALTER TABLE rh_variable_tasks_v2 ALTER COLUMN finish_date_time SET NOT NULL;
ALTER TABLE rh_variable_tasks_v2 ALTER COLUMN start_date_time_sort SET NOT NULL;
ALTER TABLE rh_variable_tasks_v2 ALTER COLUMN finish_date_time_sort SET NOT NULL;

-- Drop the old 'date' column if it exists
ALTER TABLE rh_variable_tasks_v2 DROP COLUMN IF EXISTS date;
