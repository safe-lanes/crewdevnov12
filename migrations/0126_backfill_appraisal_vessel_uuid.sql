-- Migration: Backfill appraisal vessel from NAME to master-data UUID.
--
-- Background: Crew appraisals historically stored the vessel as its display
-- NAME (e.g. "MT Sail One") in appraisal_results_v2.vessel. When a vessel was
-- renamed in master data, existing appraisals kept the stale old name. Going
-- forward the app stores the vessel's master UUID and resolves the CURRENT
-- name at display time. This migration converts already-stored NAME values to
-- the matching master_vessels.vessel_uuid so historical rows also reflect the
-- vessel's current name.
--
-- Scope (deliberately narrow):
--   - Only appraisal_results_v2.vessel rows whose value matches a known
--     master_vessels.vessel name (case-insensitive, trimmed).
--   - Values that are already a UUID (i.e. already equal to some
--     master_vessels.vessel_uuid) are left untouched.
--   - Names with no master match are left as-is (display falls back to the
--     stored value).
--
-- Idempotent: re-running writes 0 rows. A value already equal to a known
-- vessel_uuid is excluded, and a name with no match never updates.
--
-- Fault tolerance / multi-tenant: wrapped in a DO block. Tenant databases
-- that do not yet have these tables are soft-skipped with a RAISE NOTICE so a
-- single tenant can never abort the lazy per-tenant migration run.

DO $$
DECLARE
  changed INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE appraisal_results_v2 ar
    SET vessel = (
      SELECT mv.vessel_uuid
      FROM master_vessels mv
      WHERE mv.vessel_uuid IS NOT NULL
        AND mv.vessel IS NOT NULL
        AND lower(trim(mv.vessel)) = lower(trim(ar.vessel))
      ORDER BY mv.vessel_uuid
      LIMIT 1
    )
    WHERE ar.vessel IS NOT NULL
      AND trim(ar.vessel) <> ''
      -- value is NOT already a known UUID (idempotency guard)
      AND NOT EXISTS (
        SELECT 1 FROM master_vessels mv2
        WHERE mv2.vessel_uuid = ar.vessel
      )
      -- value matches a known vessel NAME
      AND EXISTS (
        SELECT 1 FROM master_vessels mv3
        WHERE mv3.vessel_uuid IS NOT NULL
          AND mv3.vessel IS NOT NULL
          AND lower(trim(mv3.vessel)) = lower(trim(ar.vessel))
      )
    RETURNING 1
  )
  SELECT count(*) INTO changed FROM updated;

  RAISE NOTICE 'Appraisal vessel UUID backfill: % row(s) converted name -> uuid', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Appraisal vessel UUID backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'Appraisal vessel UUID backfill: required column missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Appraisal vessel UUID backfill: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;
