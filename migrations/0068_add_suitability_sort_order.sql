-- Add sort_order column to suitability vessel types and fleet groups tables
ALTER TABLE cand_suitability_vessel_types 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE cand_suitability_fleet_groups 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
