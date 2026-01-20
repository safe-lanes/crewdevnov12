-- Fix NOT NULL constraints for recruitment_candidates to allow flexible inserts
ALTER TABLE recruitment_candidates 
  ALTER COLUMN dob DROP NOT NULL,
  ALTER COLUMN nationality DROP NOT NULL,
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN family_name DROP NOT NULL,
  ALTER COLUMN rank_applied_for DROP NOT NULL,
  ALTER COLUMN present_rank DROP NOT NULL,
  ALTER COLUMN vessel_type DROP NOT NULL,
  ALTER COLUMN middle_name DROP NOT NULL;
