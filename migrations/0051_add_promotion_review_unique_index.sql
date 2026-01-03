-- Add unique composite index on promotion_reviews to prevent duplicate entries
-- for the same crew member and promotion rank combination

-- Create unique index (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_reviews_crew_rank_unique 
ON promotion_reviews (crew_member_id, promotion_to_rank);

-- Add index for faster lookups by crew member
CREATE INDEX IF NOT EXISTS idx_promotion_reviews_crew_member 
ON promotion_reviews (crew_member_id);

-- Add index for faster lookups by promotion rank
CREATE INDEX IF NOT EXISTS idx_promotion_reviews_promotion_rank 
ON promotion_reviews (promotion_to_rank);
