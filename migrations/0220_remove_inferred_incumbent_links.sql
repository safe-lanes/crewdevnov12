-- 0219 inferred incumbent links from crew/vessel/current state. That match
-- cannot prove voyage ownership. Remove those links before allowing sign-off
-- to act on them. This is a forward-only safety correction: freshly imported
-- and signed-on rows will establish their own links through their transactions.
UPDATE vessel_planning_v2
SET crew_assign_uuid = NULL
WHERE crew_assign_uuid IS NOT NULL AND is_deleted = false
  AND is_archived = false;

DO $$
DECLARE awaiting_review integer;
BEGIN
  SELECT count(*) INTO awaiting_review FROM vessel_planning_v2
  WHERE crew_uuid IS NOT NULL AND crew_assign_uuid IS NULL
    AND is_deleted = false AND is_archived = false;
  RAISE NOTICE 'Active incumbents awaiting verified assignment reconciliation: %', awaiting_review;
END $$;