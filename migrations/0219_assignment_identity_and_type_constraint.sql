-- The migration runner executes each file inside one transaction. Older crew
-- list imports stored the roster role (Primary/Secondary) in this lifecycle
-- column. Normalize those known aliases before enforcing the lifecycle values;
-- genuinely unknown history still aborts the migration below.
DO $$
DECLARE normalized integer;
BEGIN
  WITH changed AS (
    UPDATE crew_assignments
       SET assignment_type = CASE lower(btrim(assignment_type))
         WHEN 'primary' THEN 'OnBoard'
         WHEN 'secondary' THEN 'Planned'
         WHEN 'planned' THEN 'Planned'
         WHEN 'onboard' THEN 'OnBoard'
         WHEN 'onboard_m' THEN 'OnBoard_M'
         WHEN 'cancelled' THEN 'Cancelled'
       END
     WHERE lower(btrim(assignment_type)) IN
       ('primary', 'secondary', 'planned', 'onboard', 'onboard_m', 'cancelled')
       AND assignment_type IS DISTINCT FROM CASE lower(btrim(assignment_type))
         WHEN 'primary' THEN 'OnBoard'
         WHEN 'secondary' THEN 'Planned'
         WHEN 'planned' THEN 'Planned'
         WHEN 'onboard' THEN 'OnBoard'
         WHEN 'onboard_m' THEN 'OnBoard_M'
         WHEN 'cancelled' THEN 'Cancelled'
       END
    RETURNING 1
  )
  SELECT count(*) INTO normalized FROM changed;

  RAISE NOTICE 'Normalized % legacy crew assignment types', normalized;
END $$;

DO $$
DECLARE inventory text;
DECLARE invalid text;
BEGIN
  SELECT string_agg(format('%s: %s', coalesce(assignment_type, '<NULL>'), n), ', ' ORDER BY assignment_type)
    INTO inventory
  FROM (SELECT assignment_type, count(*) n FROM crew_assignments GROUP BY assignment_type) types;
  RAISE NOTICE 'Crew assignment types before constraint: %', coalesce(inventory, '(none)');
  SELECT string_agg(format('%s: %s', coalesce(assignment_type, '<NULL>'), n), ', ' ORDER BY assignment_type)
    INTO invalid
  FROM (SELECT assignment_type, count(*) n FROM crew_assignments
        WHERE assignment_type IS NULL OR assignment_type NOT IN ('Planned', 'OnBoard', 'OnBoard_M', 'Cancelled')
        GROUP BY assignment_type) types;
  IF invalid IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected crew assignment types; reconcile before applying constraint: %', invalid;
  END IF;
END $$;

ALTER TABLE crew_assignments ALTER COLUMN assignment_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'crew_assignments'::regclass
      AND conname = 'ck_crew_assignments_assignment_type'
  ) THEN
    ALTER TABLE crew_assignments ADD CONSTRAINT ck_crew_assignments_assignment_type
      CHECK (assignment_type IN ('Planned', 'OnBoard', 'OnBoard_M', 'Cancelled'));
  END IF;
END $$;

-- The incumbent's assignment is distinct from the reliever's Planned link.
ALTER TABLE vessel_planning_v2 ADD COLUMN IF NOT EXISTS crew_assign_uuid TEXT;
CREATE INDEX IF NOT EXISTS idx_vessel_planning_crew_assign_uuid
  ON vessel_planning_v2 (crew_assign_uuid);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'vessel_planning_v2'::regclass
      AND conname = 'fk_vessel_planning_crew_assignment'
  ) THEN
    ALTER TABLE vessel_planning_v2 ADD CONSTRAINT fk_vessel_planning_crew_assignment
      FOREIGN KEY (crew_assign_uuid) REFERENCES crew_assignments(assign_uuid);
  END IF;
END $$;

-- Only a single current OnBoard assignment with a single active planning owner
-- supplies a verified incumbent identity. Ambiguous or missing links stay NULL.
WITH candidates AS (
  SELECT p.plan_uuid, min(a.assign_uuid) assign_uuid
  FROM vessel_planning_v2 p
  JOIN crew_assignments a ON a.crew_uuid = p.crew_uuid
    AND a.vessel_uuid = p.vessel_uuid
    AND a.assignment_type = 'OnBoard' AND a.is_current = true AND a.is_deleted = false
  WHERE p.crew_uuid IS NOT NULL AND p.is_deleted = false AND p.is_archived = false
    AND p.crew_assign_uuid IS NULL
  GROUP BY p.plan_uuid HAVING count(*) = 1
), exclusive AS (
  SELECT assign_uuid FROM candidates GROUP BY assign_uuid HAVING count(*) = 1
)
UPDATE vessel_planning_v2 p SET crew_assign_uuid = c.assign_uuid
FROM candidates c JOIN exclusive e ON e.assign_uuid = c.assign_uuid
WHERE p.plan_uuid = c.plan_uuid;

DO $$
DECLARE linked integer;
DECLARE unlinked integer;
BEGIN
  SELECT count(*) FILTER (WHERE crew_assign_uuid IS NOT NULL),
         count(*) FILTER (WHERE crew_assign_uuid IS NULL)
    INTO linked, unlinked FROM vessel_planning_v2
  WHERE crew_uuid IS NOT NULL AND is_deleted = false AND is_archived = false;
  RAISE NOTICE 'Active incumbent assignment links: % linked, % unlinked', linked, unlinked;
END $$;
