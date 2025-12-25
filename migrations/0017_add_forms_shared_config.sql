-- Add shared_config column to forms table for shared field configurations
-- This stores field configurations that apply to ALL rank groups (e.g., appraisalTypeOptions)
ALTER TABLE forms ADD COLUMN IF NOT EXISTS shared_config TEXT;
