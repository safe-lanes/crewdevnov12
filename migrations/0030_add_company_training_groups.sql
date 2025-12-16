-- Migration: Add Company Training Groups table and groupCode column to company_trainings

-- Create company_training_groups table with A-J defaults
CREATE TABLE IF NOT EXISTS company_training_groups (
  code TEXT PRIMARY KEY,
  label TEXT,
  display_order INTEGER NOT NULL
);

-- Seed A-J groups with null labels (will display as just the letter)
INSERT INTO company_training_groups (code, label, display_order) VALUES
  ('A', NULL, 1),
  ('B', NULL, 2),
  ('C', NULL, 3),
  ('D', NULL, 4),
  ('E', NULL, 5),
  ('F', NULL, 6),
  ('G', NULL, 7),
  ('H', NULL, 8),
  ('I', NULL, 9),
  ('J', NULL, 10)
ON CONFLICT (code) DO NOTHING;

-- Add group_code column to company_trainings (nullable - NULL means unassigned)
ALTER TABLE company_trainings ADD COLUMN IF NOT EXISTS group_code TEXT;
