-- Add source column to candidate visas to track whether a row was
-- added manually or from the country database.
ALTER TABLE cand_visas
  ADD COLUMN IF NOT EXISTS source text;
