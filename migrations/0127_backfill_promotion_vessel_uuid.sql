-- Migration: Backfill promotion vessel from numeric id to master-data UUID.
--
-- Background: Crew promotion reviews historically stored the assigned vessel as
-- the vessel's internal numeric id (master_vessels.id, e.g. "4") in
-- promotion_reviews_v2.vessel_assigned. The dashboard promotions drilldown
-- showed that raw number instead of the vessel name. Going forward the app
-- stores the vessel's master UUID and resolves the CURRENT name at display
-- time. This migration converts already-stored numeric ids to the matching
-- master_vessels.vessel_uuid so historical rows also resolve to a name.
--
-- Scope (deliberately narrow):
--   - Only promotion_reviews_v2.vessel_assigned rows whose value matches a
--     known master_vessels.id (numeric id stored as text).
--   - Values that are already a UUID (i.e. already equal to some
--     master_vessels.vessel_uuid) are left untouched.
--   - Ids/values with no master match are left as-is (display falls back to
--     the stored value).
--
-- Idempotent: re-running writes 0 rows. A value already equal to a known
-- vessel_uuid is excluded, and a value with no matching id never updates.
--
-- Fault tolerance / multi-tenant: wrapped in a DO block. Tenant databases
-- that do not yet have these tables are soft-skipped with a RAISE NOTICE so a
-- single tenant can never abort the lazy per-tenant migration run.

DO $$
DECLARE
  changed INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE promotion_reviews_v2 pr
    SET vessel_assigned = (
      SELECT mv.vessel_uuid
      FROM master_vessels mv
      WHERE mv.vessel_uuid IS NOT NULL
        AND mv.id::text = trim(pr.vessel_assigned)
      ORDER BY mv.vessel_uuid
      LIMIT 1
    )
    WHERE pr.vessel_assigned IS NOT NULL
      AND trim(pr.vessel_assigned) <> ''
      -- value is NOT already a known UUID (idempotency guard)
      AND NOT EXISTS (
        SELECT 1 FROM master_vessels mv2
        WHERE mv2.vessel_uuid = pr.vessel_assigned
      )
      -- value matches a known numeric vessel id
      AND EXISTS (
        SELECT 1 FROM master_vessels mv3
        WHERE mv3.vessel_uuid IS NOT NULL
          AND mv3.id::text = trim(pr.vessel_assigned)
      )
    RETURNING 1
  )
  SELECT count(*) INTO changed FROM updated;

  RAISE NOTICE 'Promotion vessel UUID backfill: % row(s) converted id -> uuid', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Promotion vessel UUID backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'Promotion vessel UUID backfill: required column missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Promotion vessel UUID backfill: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;
