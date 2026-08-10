-- Add vessel_name and rank snapshot columns to crew_assignments.
-- These store the display name and rank held at the time of the assignment so
-- that crew history remains readable even if the vessel is later renamed or the
-- rank definition is changed/removed.
ALTER TABLE crew_assignments
  ADD COLUMN IF NOT EXISTS vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS rank TEXT;
