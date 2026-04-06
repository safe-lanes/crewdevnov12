-- Add is_reliever_archived column to vessel_planning_v2
-- When onboard crew is signed off (isArchived=true), this flag stays false
-- so the reliever remains visible in the crew list.
ALTER TABLE vessel_planning_v2
ADD COLUMN IF NOT EXISTS is_reliever_archived BOOLEAN DEFAULT false;
