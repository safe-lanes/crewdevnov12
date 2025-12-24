-- Remove redundant vesselName columns from tables that store both vessel_id and vessel_name
-- The vessel_id (VSL-XXX format) is the source of truth; name can be looked up at display time

-- Remove vessel_name from rest_hours_vessel_records
ALTER TABLE rest_hours_vessel_records DROP COLUMN IF EXISTS vessel_name;

-- Remove vessel_name from rest_hours_crew_records  
ALTER TABLE rest_hours_crew_records DROP COLUMN IF EXISTS vessel_name;

-- Remove vessel_name from rotation_archive
ALTER TABLE rotation_archive DROP COLUMN IF EXISTS vessel_name;
