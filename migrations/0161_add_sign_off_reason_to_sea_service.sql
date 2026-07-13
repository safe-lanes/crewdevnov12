-- Add "Reason of Sign Off" to E1 sea service records (crew_sea_service).
-- The reason is captured at vessel sign-off on vessel_planning_v2; carry it
-- onto the matching sea service row so the crew profile can display it.

ALTER TABLE crew_sea_service ADD COLUMN IF NOT EXISTS sign_off_reason TEXT;

-- Backfill from signed-off vessel planning records. Match on crew + vessel
-- where the planning sign-off date equals the sea service To date, so repeat
-- contracts on the same vessel only pick up their own sign-off. Rows without
-- an unambiguous match stay NULL (displayed as a dash).
UPDATE crew_sea_service s
SET sign_off_reason = vp.sign_off_reason
FROM (
  SELECT DISTINCT ON (crew_uuid, vessel_uuid, sign_off_date)
    crew_uuid, vessel_uuid, sign_off_date, sign_off_reason
  FROM vessel_planning_v2
  WHERE sign_off_reason IS NOT NULL
    AND sign_off_date IS NOT NULL
    AND crew_uuid IS NOT NULL
    AND is_deleted = false
  ORDER BY crew_uuid, vessel_uuid, sign_off_date, updated_at DESC NULLS LAST
) vp
WHERE s.crew_uuid = vp.crew_uuid
  AND s.vessel_uuid = vp.vessel_uuid
  AND s.to_date = vp.sign_off_date
  AND s.service_type = 'company'
  AND s.is_deleted = false
  AND s.sign_off_reason IS NULL;
