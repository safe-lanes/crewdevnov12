-- Migration: Add criteria_meets_status column to promotion_reviews table
-- This column stores the auto-computed "Meets Criteria" values separately from the user verification status
-- Values are stored as JSON: { "a2.1": "yes", "a2.3a": "no", "a2.3b": "pending", ... }

ALTER TABLE promotion_reviews
ADD COLUMN IF NOT EXISTS criteria_meets_status TEXT;

-- Add comment for documentation
COMMENT ON COLUMN promotion_reviews.criteria_meets_status IS 'JSON object storing auto-computed Meets Criteria status per criterion (yes/no/pending)';
