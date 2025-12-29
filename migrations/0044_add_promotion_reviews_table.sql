-- Migration: Add promotion_reviews table
-- Stores the form state for promotion review forms per crew member

CREATE TABLE IF NOT EXISTS promotion_reviews (
  id SERIAL PRIMARY KEY,
  crew_member_id TEXT NOT NULL REFERENCES crew_members(id),
  promotion_to_rank TEXT NOT NULL,
  
  -- A2 Criteria - Vessel Type Selection for A2.3b
  selected_vessel_type_for_a2_3b TEXT,
  
  -- A2 Criteria Verified Status (JSON object mapping criteria ID to status)
  criteria_verified_status TEXT,
  
  -- CES/Language Tests data (JSON array)
  ces_tests_data TEXT,
  
  -- Comments for each criteria (JSON object)
  criteria_comments TEXT,
  
  -- Training Needs (JSON array)
  training_needs TEXT,
  
  -- Part B - Approval data (JSON object)
  approval_data TEXT,
  
  -- Part C - Execution data
  promotion_confirmed TEXT,
  vessel_assigned TEXT,
  promotion_date TEXT,
  promotion_timing TEXT,
  
  -- Form notes
  part_a_notes TEXT,
  part_b_notes TEXT,
  part_c_notes TEXT,
  
  -- Form status
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by crew member
CREATE INDEX IF NOT EXISTS idx_promotion_reviews_crew_member 
ON promotion_reviews(crew_member_id);

-- Create unique constraint to allow only one active review per crew + rank combination
-- (prevents duplicate reviews for the same promotion)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_reviews_crew_rank 
ON promotion_reviews(crew_member_id, promotion_to_rank) 
WHERE status != 'completed';
