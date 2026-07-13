-- Add source column to B7 training items to track whether a row was
-- added manually or from the training course database.
ALTER TABLE screening_b7_training_items
  ADD COLUMN IF NOT EXISTS source text;
