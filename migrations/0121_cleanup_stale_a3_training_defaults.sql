-- Migration: Cleanup stale A3 "Identified Training Needs" default rows.
-- Removes seeded/test rows in promo_training_needs_v2 that match the
-- exact signature of the stale defaults that were appearing on the
-- Promotion Review form (Section A3) by default:
--   training IN ('LT Endorsement', 'Crowd Control')
--   AND category = '1. Competence'
--   AND status = 'Proposed'
--
-- These rows are leftover seed/test data, not produced by any current
-- code path. Soft-delete (is_deleted = true) is used instead of a hard
-- DELETE so the change is reversible if needed.

UPDATE promo_training_needs_v2
SET is_deleted = true,
    updated_at = NOW()
WHERE training IN ('LT Endorsement', 'Crowd Control')
  AND category = '1. Competence'
  AND status = 'Proposed'
  AND (is_deleted IS NULL OR is_deleted = false);
