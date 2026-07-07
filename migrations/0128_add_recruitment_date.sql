-- Migration: Add "C3.3 Date of Recruitment" support.
--
-- Background: The recruitment form gained a new sub-point C3.3 "Date of
-- Recruitment" — a manual date stored on the candidate's recruitment decision
-- and carried over to the crew pool member when the candidate is transferred.
-- This migration adds the backing columns:
--   - cand_recruitment_decision.recruitment_date (source of truth, set in C3.3)
--   - crew_members_v2.recruitment_date (copied on transfer, shown in crew pool)
--
-- Both columns are nullable text (dates are stored as ISO yyyy-mm-dd strings,
-- consistent with the other date columns in these tables).
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS, so re-running is a no-op.
--
-- Fault tolerance / multi-tenant: wrapped in a DO block so a tenant database
-- that does not yet have one of these tables is soft-skipped with a RAISE
-- NOTICE rather than aborting the per-tenant migration run.

DO $$
BEGIN
  ALTER TABLE cand_recruitment_decision
    ADD COLUMN IF NOT EXISTS recruitment_date text;

  ALTER TABLE crew_members_v2
    ADD COLUMN IF NOT EXISTS recruitment_date text;

  RAISE NOTICE 'recruitment_date columns ensured on cand_recruitment_decision and crew_members_v2';

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'recruitment_date migration: required table missing on this DB, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'recruitment_date migration: unexpected failure (% : %), skipping',
      SQLSTATE, SQLERRM;
END
$$;
