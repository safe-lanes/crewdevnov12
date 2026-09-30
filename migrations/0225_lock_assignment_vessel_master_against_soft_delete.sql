-- Forward-only correction to the guard installed by 0224. FOR KEY SHARE
-- protects the vessel's key but permits a concurrent non-key is_deleted
-- update. FOR SHARE conflicts with that update and keeps the matched vessel
-- active until the assignment write transaction finishes. Keep 0224 unchanged
-- because it may already be recorded in schema_migrations.
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
  -- FOR SHARE conflicts with soft-delete updates to these matched parents.
  FOR parent_uuid IN
    SELECT vessel_uuid FROM master_vessels
    WHERE lower(vessel_uuid) = lower(NEW.vessel_uuid)
      AND is_deleted IS NOT TRUE
    FOR SHARE
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