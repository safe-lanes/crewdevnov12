-- tr_crew_assignments_vessel_uuid_guard protects new assignment vessel references.
-- BEFORE INSERT OR UPDATE OF vessel_uuid: a new/changed non-NULL ID must be a
-- canonical 8-4-4-4-12 hex UUID (either letter case) and resolve to exactly one
-- non-deleted master_vessels row. Store that row's exact spelling for text joins.
-- Unrelated updates to old rows, including those referencing retired/missing
-- vessels, do not fire this trigger; unchanged vessel_uuid is also exempt.
--
-- Current external vessel sync reconciles by UUID: INSERT new, UPDATE matching,
-- and soft-delete missing masters. It does NOT TRUNCATE, TRUNCATE CASCADE, or
-- hard-delete/reinsert parent rows, so a foreign key is not exposed to parent
-- replacement by today's sync. A future hard-delete/truncate strategy would
-- collide with a FK (or CASCADE away history). A normal FK also cannot require
-- non-deleted masters, and a CHECK (even NOT VALID) tests legacy rows on unrelated
-- UPDATE. This change neither scans nor rewrites historical assignments.
CREATE OR REPLACE FUNCTION guard_crew_assignment_vessel_uuid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_uuid text;
  match_count integer := 0;
  matched_uuid text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.vessel_uuid IS NOT DISTINCT FROM OLD.vessel_uuid THEN
    RETURN NEW;
  END IF;
  IF NEW.vessel_uuid IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.vessel_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid assignment vessel UUID: expected canonical UUID'
      USING ERRCODE = '22023';
  END IF;

  -- Lock matched parents against concurrent deletion while the assignment
  -- transaction is open. A case-folded duplicate is ambiguous, not a winner.
  FOR parent_uuid IN
    SELECT vessel_uuid FROM master_vessels
    WHERE lower(vessel_uuid) = lower(NEW.vessel_uuid)
      AND is_deleted IS NOT TRUE
    FOR KEY SHARE
  LOOP
    match_count := match_count + 1;
    matched_uuid := parent_uuid;
    IF match_count > 1 THEN
      RAISE EXCEPTION 'Ambiguous assignment vessel UUID in vessel master'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF match_count = 0 THEN
    RAISE EXCEPTION 'Assignment vessel UUID is not present in the active vessel master'
      USING ERRCODE = '22023';
  END IF;
  NEW.vessel_uuid := matched_uuid;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'crew_assignments'::regclass
      AND tgname = 'tr_crew_assignments_vessel_uuid_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER tr_crew_assignments_vessel_uuid_guard
      BEFORE INSERT OR UPDATE OF vessel_uuid ON crew_assignments
      FOR EACH ROW EXECUTE FUNCTION guard_crew_assignment_vessel_uuid();
  END IF;
END $$;