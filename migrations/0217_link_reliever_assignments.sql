-- The migration runner executes this whole file in one transaction.
ALTER TABLE vessel_planning_v2
  ADD COLUMN IF NOT EXISTS reliever_assign_uuid TEXT;

CREATE INDEX IF NOT EXISTS idx_vessel_planning_reliever_assign_uuid
  ON vessel_planning_v2 (reliever_assign_uuid);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'vessel_planning_v2'::regclass
      AND conname = 'fk_vessel_planning_reliever_assignment'
  ) THEN
    ALTER TABLE vessel_planning_v2
      ADD CONSTRAINT fk_vessel_planning_reliever_assignment
      FOREIGN KEY (reliever_assign_uuid) REFERENCES crew_assignments(assign_uuid);
  END IF;
END $$;

DO $$
DECLARE
  linked_count integer;
  unlinked_count integer;
  unmatched record;
BEGIN
  -- Match only the reliever, vessel and an undeleted Planned assignment.
  -- Dates, names and other crew assignments must not be used to guess identity.
  WITH candidates AS (
    SELECT p.plan_uuid, min(a.assign_uuid) AS assign_uuid
    FROM vessel_planning_v2 p
    JOIN crew_assignments a
      ON a.crew_uuid = p.reliever_crew_uuid
     AND a.vessel_uuid = p.vessel_uuid
     AND a.assignment_type = 'Planned'
     AND a.is_deleted = false
    WHERE p.reliever_crew_uuid IS NOT NULL
      AND p.reliever_crew_uuid <> ''
      AND p.is_deleted = false
      AND p.reliever_assign_uuid IS NULL
    GROUP BY p.plan_uuid
    HAVING count(*) = 1
  )
  UPDATE vessel_planning_v2 p
  SET reliever_assign_uuid = c.assign_uuid
  FROM candidates c
  WHERE p.plan_uuid = c.plan_uuid;
  GET DIAGNOSTICS linked_count = ROW_COUNT;

  SELECT count(*) INTO unlinked_count
  FROM vessel_planning_v2 p
  WHERE p.reliever_crew_uuid IS NOT NULL
    AND p.reliever_crew_uuid <> ''
    AND p.is_deleted = false
    AND p.reliever_assign_uuid IS NULL;
  RAISE NOTICE 'Reliever assignment backfill: % linked, % unlinked', linked_count, unlinked_count;

  FOR unmatched IN
    SELECT p.plan_uuid, p.reliever_crew_uuid, p.vessel_uuid, count(a.assign_uuid) AS matches
    FROM vessel_planning_v2 p
    LEFT JOIN crew_assignments a
      ON a.crew_uuid = p.reliever_crew_uuid
     AND a.vessel_uuid = p.vessel_uuid
     AND a.assignment_type = 'Planned'
     AND a.is_deleted = false
    WHERE p.reliever_crew_uuid IS NOT NULL
      AND p.reliever_crew_uuid <> ''
      AND p.is_deleted = false
      AND p.reliever_assign_uuid IS NULL
    GROUP BY p.plan_uuid, p.reliever_crew_uuid, p.vessel_uuid
  LOOP
    RAISE NOTICE 'Unlinked reliever: plan_uuid=%, crew_uuid=%, vessel_uuid=%, reason=% (% matching assignments)',
      unmatched.plan_uuid, unmatched.reliever_crew_uuid, unmatched.vessel_uuid,
      CASE WHEN unmatched.matches = 0 THEN 'zero matches' ELSE 'multiple matches' END,
      unmatched.matches;
  END LOOP;
END $$;