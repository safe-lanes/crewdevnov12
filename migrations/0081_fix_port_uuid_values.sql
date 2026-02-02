-- Fix port UUID values in vessel_planning_v2 that were stored as port names instead of UUIDs
-- This migration resolves port names to their corresponding port_uuid from master_ports

-- Fix joining_port_uuid values that contain port names
UPDATE vessel_planning_v2 vp
SET joining_port_uuid = mp.port_uuid
FROM master_ports mp
WHERE vp.joining_port_uuid IS NOT NULL
  AND vp.joining_port_uuid NOT LIKE '%-%-%-%-%'
  AND UPPER(mp.name) = UPPER(vp.joining_port_uuid);

-- Fix sign_off_port_uuid values that contain port names
UPDATE vessel_planning_v2 vp
SET sign_off_port_uuid = mp.port_uuid
FROM master_ports mp
WHERE vp.sign_off_port_uuid IS NOT NULL
  AND vp.sign_off_port_uuid NOT LIKE '%-%-%-%-%'
  AND UPPER(mp.name) = UPPER(vp.sign_off_port_uuid);

-- Clear any remaining non-UUID values that couldn't be matched
-- (Better to have NULL than invalid data that can't be joined)
UPDATE vessel_planning_v2
SET joining_port_uuid = NULL
WHERE joining_port_uuid IS NOT NULL
  AND joining_port_uuid NOT LIKE '%-%-%-%-%';

UPDATE vessel_planning_v2
SET sign_off_port_uuid = NULL
WHERE sign_off_port_uuid IS NOT NULL
  AND sign_off_port_uuid NOT LIKE '%-%-%-%-%';
