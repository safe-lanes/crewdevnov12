-- Migration: APD-56 — appraisals refer to master data by key, not by name.
--
-- 1. The four built-in appraisal types (0041 / 0090) got a random id on each
--    server, so "Mid Term" had a different id on the office and on each
--    vessel. They now get fixed ids, matched by entry_id. The ids are uuid v5
--    of the entry_id in namespace b8e7e704-6257-5d13-8b3e-dd0eb3042a6d
--    (v5('safelanes.crewing.master_appraisal_types', URL)). Never change them.
--    Nothing referenced master_appraisal_types.id before this migration.
-- 2. appraisal_results_v2.appraisal_type held the type NAME. Names that match
--    a master type (case-insensitive, trimmed) become that type's id. Must
--    run after step 1. Names with no match (e.g. "Annual") are left as-is.
-- 3. Re-runs the 0126 / 0253 vessel name -> master_vessels.vessel_uuid rule
--    for names saved since 0253.
--
-- Rows submitted before form-version pins existed (0196) fail that NOT VALID
-- pin check on any UPDATE. The check is dropped for steps 2-3 and re-added
-- exactly as 0196 defines it (NOT VALID, so those rows stay tolerated). The
-- runner wraps this file in one transaction, so the check is never missing
-- outside it.
--
-- Idempotent: a re-run writes 0 rows. Each step is its own DO block, so a
-- tenant DB missing a table logs a NOTICE instead of failing.
-- The 0272 trigger bumps updated_at on converted rows; the result is the same
-- on every server, so sync sees the same value on both sides.

-- 1. Fixed ids for the built-in appraisal types.
DO $$
DECLARE
  fixed RECORD;
  changed INTEGER := 0;
  n INTEGER;
BEGIN
  FOR fixed IN
    SELECT * FROM (VALUES
      ('AT001', '865557dc-3e40-51ed-9d41-208208afac3f'::uuid),
      ('AT002', 'e7b845e9-ad8e-5b03-8fb6-c2d4fb103097'::uuid),
      ('AT003', '905187e4-0c28-52aa-8767-a8e683ef784e'::uuid),
      ('AT004', '6cfb8037-f9ad-5bd7-af94-c6749167666b'::uuid)
    ) AS t(entry_id, id)
  LOOP
    UPDATE master_appraisal_types
    SET id = fixed.id
    WHERE entry_id = fixed.entry_id
      AND id <> fixed.id
      AND NOT EXISTS (SELECT 1 FROM master_appraisal_types WHERE id = fixed.id);
    GET DIAGNOSTICS n = ROW_COUNT;
    changed := changed + n;
  END LOOP;

  RAISE NOTICE 'APD-56 appraisal type fixed ids: % row(s) updated', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-56 appraisal type fixed ids: master_appraisal_types missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-56 appraisal type fixed ids: required column missing on this DB, skipping';
END
$$;

-- Lift the 0196 pin check for steps 2-3 (re-added below).
ALTER TABLE IF EXISTS appraisal_results_v2
  DROP CONSTRAINT IF EXISTS appraisal_results_v2_submitted_form_version_pin_check;

-- 2. Appraisal type name -> master_appraisal_types.id.
DO $$
DECLARE
  changed INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE appraisal_results_v2 ar
    SET appraisal_type = (
      SELECT mat.id::text
      FROM master_appraisal_types mat
      WHERE lower(trim(mat.name)) = lower(trim(ar.appraisal_type))
      ORDER BY mat.is_deleted ASC, mat.is_active DESC, mat.sort_order, mat.entry_id
      LIMIT 1
    )
    WHERE trim(ar.appraisal_type) <> ''
      -- value is NOT already a known type id
      AND NOT EXISTS (
        SELECT 1 FROM master_appraisal_types mat2
        WHERE mat2.id::text = lower(trim(ar.appraisal_type))
      )
      -- value matches a known type NAME
      AND EXISTS (
        SELECT 1 FROM master_appraisal_types mat3
        WHERE lower(trim(mat3.name)) = lower(trim(ar.appraisal_type))
      )
    RETURNING 1
  )
  SELECT count(*) INTO changed FROM updated;

  RAISE NOTICE 'APD-56 appraisal type backfill: % row(s) converted name -> id', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-56 appraisal type backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-56 appraisal type backfill: required column missing on this DB, skipping';
END
$$;

-- 3. Vessel names saved since 0253 -> master_vessels.vessel_uuid (same rule as 0126).
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
      -- value is NOT already a known UUID
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

  RAISE NOTICE 'APD-56 appraisal vessel UUID backfill: % row(s) converted name -> uuid', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-56 appraisal vessel UUID backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-56 appraisal vessel UUID backfill: required column missing on this DB, skipping';
END
$$;

-- Re-add the pin check exactly as 0196 defines it.
DO $$
BEGIN
  IF to_regclass('appraisal_results_v2') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appraisal_results_v2_submitted_form_version_pin_check'
      AND conrelid = 'appraisal_results_v2'::regclass
  ) THEN
    ALTER TABLE appraisal_results_v2
      ADD CONSTRAINT appraisal_results_v2_submitted_form_version_pin_check
      CHECK (
        lower(trim(status)) NOT IN (
          'preliminary', 'submitted', 'pending_review', 'stage2_submitted',
          'reviewed', 'stage3_submitted'
        )
        OR (form_version_id IS NOT NULL AND form_version_uuid IS NOT NULL)
      ) NOT VALID;
  END IF;
END
$$;
