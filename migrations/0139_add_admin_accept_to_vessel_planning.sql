-- Add admin_accept column to vessel_planning_v2
-- Backs the editable "Admin Accept" (Yes/No) dropdown in the Officer Matrix.
-- Defaults to true so existing rows keep displaying "Yes".
ALTER TABLE vessel_planning_v2
ADD COLUMN IF NOT EXISTS admin_accept BOOLEAN DEFAULT true;
