-- Migration: Cleanup stale A3 "Identified Training Needs" default rows.
--
-- Removes seeded/test rows in promo_training_needs_v2 that were appearing
-- as default entries in Section A3 of the Promotion Review form. The
-- predicate is scoped to the full stale-data signature so legitimate
-- user-entered rows that happen to share a training name are not touched:
--
--   training        IN ('LT Endorsement', 'Crowd Control')
--   AND category    = '1. Competence'
--   AND status      = 'Proposed'
--   AND created_by_uuid IS NULL          -- seeded rows have no creator
--   AND created_at  <  '2026-04-15'      -- all stale rows were created
--                                        --   in the 2026-04-09..04-14 window
--
-- Uses soft-delete (is_deleted = true) so the change is reversible.
-- The guard on is_deleted makes the migration idempotent.

DO $$
DECLARE
  candidate_count INTEGER;
  updated_count   INTEGER;
BEGIN
  SELECT COUNT(*) INTO candidate_count
  FROM promo_training_needs_v2
  WHERE training IN ('LT Endorsement', 'Crowd Control')
    AND category = '1. Competence'
    AND status = 'Proposed'
    AND created_by_uuid IS NULL
    AND created_at < TIMESTAMP '2026-04-15'
    AND (is_deleted IS NULL OR is_deleted = false);

  RAISE NOTICE 'A3 cleanup: % active stale rows match the seed signature', candidate_count;

  -- Strict cardinality guard: the dev DB inventory at migration-authoring
  -- time showed exactly 7 active rows matching the full signature
  -- (3x "LT Endorsement" + 4x "Crowd Control" with status='Proposed',
  -- category='1. Competence', created_by_uuid NULL, before 2026-04-15).
  -- The original plan called this out as "10 rows" by counting all rows
  -- with the two training names; the strict status='Proposed' filter
  -- only matches 7. Accept 0 (idempotent rerun / already applied) or 7
  -- (first run). Any other count means the dataset has drifted and the
  -- migration should be reviewed before proceeding.
  IF candidate_count NOT IN (0, 7) THEN
    RAISE EXCEPTION
      'A3 cleanup safety check failed: expected 0 or 7 candidate rows, found %',
      candidate_count;
  END IF;

  UPDATE promo_training_needs_v2
  SET is_deleted = true,
      updated_at = NOW()
  WHERE training IN ('LT Endorsement', 'Crowd Control')
    AND category = '1. Competence'
    AND status = 'Proposed'
    AND created_by_uuid IS NULL
    AND created_at < TIMESTAMP '2026-04-15'
    AND (is_deleted IS NULL OR is_deleted = false);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'A3 cleanup: soft-deleted % row(s)', updated_count;

  IF updated_count <> candidate_count THEN
    RAISE EXCEPTION
      'A3 cleanup safety check failed: expected to soft-delete % row(s) but updated % row(s)',
      candidate_count, updated_count;
  END IF;
END
$$;
