-- Migration: APD-20 - data the appraisal form used to fix on every open,
-- fixed once here instead.
--
-- Background: on open, the appraisal form (AppraisalForm_v2.tsx) used to
--   - add a G1 office-review row for each assigned reviewer when the
--     appraisal had none, under a random uuid;
--   - mark G1 rows as assigned by matching reviewer names;
--   - turn a stored vessel name into its master-data UUID;
-- and the next Save Draft wrote all of it. Two sessions (office and vessel,
-- or two office windows) each added their own G1 rows, so the appraisal ended
-- up with duplicates. The form no longer does any of this: the server adds G1
-- rows at Stage 2 submit, and this migration brings existing data to the same
-- state.
--
-- 1. G1 rows from before migration 0180 (no user, is_assigned false) that
--    belong to an assigned reviewer are marked assigned. A row is the
--    reviewer's when it has the same user, or no user and the same name.
-- 2. Each assigned reviewer of an appraisal not yet past Stage 3 gets a G1
--    row if none of the appraisal's live rows is theirs. The row uuid is
--    computed from the appraisal and the reviewer, so every database that
--    runs this (ship and shore) creates the same row.
-- 3. Vessel names saved since migration 0126 are converted to the vessel's
--    master UUID (same rule as 0126).
--
-- The rules in 1 and 2 match ApprOfficeReviewsRepository.addAssignedReviewers.
-- Existing duplicate G1 rows are left as they are.
--
-- Safe to re-run: each step only touches rows still in the old state. Each
-- step is its own DO block; a database missing a table skips that step with a
-- NOTICE, so one tenant can never abort the per-tenant migration run.

-- 1. Mark legacy G1 rows of assigned reviewers as assigned.
DO $$
DECLARE
  changed INTEGER := 0;
BEGIN
  WITH updated AS (
    UPDATE appr_office_reviews_v2 o
    SET is_assigned = true,
        updated_at = now()
    WHERE coalesce(o.is_deleted, false) = false
      AND o.is_assigned = false
      AND EXISTS (
        SELECT 1
        FROM appr_reviewers_v2 r
        WHERE r.appraisal_uuid = o.appraisal_uuid
          AND coalesce(r.is_deleted, false) = false
          AND coalesce(trim(r.user_uuid), '') <> ''
          AND (
            o.user_uuid = trim(r.user_uuid)
            OR (
              coalesce(o.user_uuid, '') = ''
              AND coalesce(trim(o.name), '') <> ''
              AND trim(o.name) = trim(r.reviewer_name)
            )
          )
      )
    RETURNING 1
  )
  SELECT count(*) INTO changed FROM updated;

  RAISE NOTICE 'APD-20 G1 is_assigned backfill: % row(s) marked assigned', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-20 G1 is_assigned backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-20 G1 is_assigned backfill: required column missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'APD-20 G1 is_assigned backfill: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;

-- 2. Add the missing G1 row of each assigned reviewer.
DO $$
DECLARE
  added INTEGER := 0;
BEGIN
  WITH missing AS (
    SELECT DISTINCT ON (r.appraisal_uuid, trim(r.user_uuid))
      r.appraisal_uuid,
      trim(r.user_uuid) AS user_uuid,
      nullif(trim(r.reviewer_name), '') AS name,
      nullif(r.designation, '') AS position,
      r.sort_order AS reviewer_order,
      r.id AS reviewer_id
    FROM appr_reviewers_v2 r
    JOIN appraisal_results_v2 a ON a.appraisal_uuid = r.appraisal_uuid
    WHERE coalesce(r.is_deleted, false) = false
      AND coalesce(trim(r.user_uuid), '') <> ''
      AND coalesce(a.is_deleted, false) = false
      AND a.stage3_status IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM appr_office_reviews_v2 o
        WHERE o.appraisal_uuid = r.appraisal_uuid
          AND coalesce(o.is_deleted, false) = false
          AND (
            o.user_uuid = trim(r.user_uuid)
            OR (
              coalesce(o.user_uuid, '') = ''
              AND coalesce(trim(o.name), '') <> ''
              AND trim(o.name) = trim(r.reviewer_name)
            )
          )
      )
    ORDER BY r.appraisal_uuid, trim(r.user_uuid), r.sort_order, r.id
  ),
  inserted AS (
    INSERT INTO appr_office_reviews_v2
      (office_review_uuid, appraisal_uuid, name, position, user_uuid, is_assigned, sort_order, is_deleted)
    SELECT
      md5('appr-g1-assigned:' || m.appraisal_uuid || ':' || m.user_uuid)::uuid::text,
      m.appraisal_uuid,
      m.name,
      m.position,
      m.user_uuid,
      true,
      coalesce(
        (SELECT max(o.sort_order) FROM appr_office_reviews_v2 o WHERE o.appraisal_uuid = m.appraisal_uuid),
        -1
      ) + row_number() OVER (PARTITION BY m.appraisal_uuid ORDER BY m.reviewer_order, m.reviewer_id),
      false
    FROM missing m
    ON CONFLICT (office_review_uuid) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO added FROM inserted;

  RAISE NOTICE 'APD-20 G1 assigned-reviewer rows: % row(s) added', added;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-20 G1 assigned-reviewer rows: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-20 G1 assigned-reviewer rows: required column missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'APD-20 G1 assigned-reviewer rows: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;

-- 3. Convert vessel names saved since 0126 to the vessel's master UUID.
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

  RAISE NOTICE 'APD-20 appraisal vessel UUID backfill: % row(s) converted name -> uuid', changed;

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-20 appraisal vessel UUID backfill: required table missing on this DB, skipping';
  WHEN undefined_column THEN
    RAISE NOTICE 'APD-20 appraisal vessel UUID backfill: required column missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'APD-20 appraisal vessel UUID backfill: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;
