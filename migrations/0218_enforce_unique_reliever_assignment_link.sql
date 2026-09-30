-- 0217 was already applied. Correct shared legacy candidates forward rather
-- than editing an applied migration: one assignment cannot belong to two plans.
DO $$
DECLARE
  duplicate record;
BEGIN
  FOR duplicate IN
    SELECT p.plan_uuid, p.reliever_crew_uuid, p.vessel_uuid, p.reliever_assign_uuid
    FROM vessel_planning_v2 p
    WHERE p.reliever_assign_uuid IN (
      SELECT reliever_assign_uuid FROM vessel_planning_v2
      WHERE reliever_assign_uuid IS NOT NULL AND is_deleted = false
      GROUP BY reliever_assign_uuid HAVING count(*) > 1
    )
    AND p.is_deleted = false
  LOOP
    RAISE NOTICE 'Shared reliever assignment left unlinked: plan_uuid=%, crew_uuid=%, vessel_uuid=%, assign_uuid=%',
      duplicate.plan_uuid, duplicate.reliever_crew_uuid, duplicate.vessel_uuid, duplicate.reliever_assign_uuid;
  END LOOP;
END $$;

UPDATE vessel_planning_v2 p
SET reliever_assign_uuid = NULL
WHERE p.reliever_assign_uuid IN (
  SELECT reliever_assign_uuid FROM vessel_planning_v2
  WHERE reliever_assign_uuid IS NOT NULL
  GROUP BY reliever_assign_uuid HAVING count(*) > 1
);

-- A unique nullable index enforces one-to-one ownership for every future writer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vessel_planning_reliever_assign_uuid
  ON vessel_planning_v2 (reliever_assign_uuid)
  WHERE reliever_assign_uuid IS NOT NULL;