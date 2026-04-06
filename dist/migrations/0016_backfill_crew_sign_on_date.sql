-- Migration: Backfill crew_members.sign_on_date from vessel_planning
-- Purpose: Ensure all deployed crew members have sign_on_date populated for Time on Board calculations
-- Date: 2025-12-08
-- Context: Some crew members were deployed before the joiningDate→signOnDate migration,
--          resulting in missing sign_on_date values and blank "Time o/b" in Officer Matrix

-- Backfill sign_on_date for crew members currently on board (from vessel_planning.sign_on_date)
UPDATE crew_members cm
SET sign_on_date = vp.sign_on_date
FROM vessel_planning vp
WHERE cm.id = vp.crew_member_id
  AND vp.crew_status = 'primary'
  AND vp.is_archived = false
  AND (cm.sign_on_date IS NULL OR cm.sign_on_date = '')
  AND vp.sign_on_date IS NOT NULL
  AND vp.sign_on_date != '';

-- Log the number of records updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled sign_on_date for % crew members from vessel_planning records', updated_count;
END $$;
