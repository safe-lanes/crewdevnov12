-- Add status column to screening_b7_training_items table
-- Mirrors the Promotion A3 training-needs status pattern for Recruitment B7

ALTER TABLE screening_b7_training_items
ADD COLUMN IF NOT EXISTS status TEXT;
