-- Migration: APD-42 - a B1 auto row stores the D3 course it came from.
--
-- Background: Part B1 "Auto" rows are built by the appraisal form from the
-- crew's Crew Pool D3 training courses. The row kept the course name but not
-- which course it came from, so each time a draft was opened the form matched
-- stored rows to courses by name. A renamed course, or two courses with the
-- same name, then lost the row's evaluation and comment on the next save.
--
-- source_train_uuid holds the course's crew_training_courses.train_uuid. The
-- server lets it be set once and never changed or cleared.
--
-- No backfill: the link can't be worked out reliably in SQL (an auto row's
-- uuid is a v5 uuid of the course, and this database has no sha1). The form
-- fills the column the next time a draft is saved. Rows past Stage 2 are
-- frozen and never matched again, so they can stay empty.
--
-- Safe to re-run. A database without the table skips it with a NOTICE, so one
-- tenant can never abort the per-tenant migration run.

DO $$
BEGIN
  ALTER TABLE appr_trainings_v2 ADD COLUMN IF NOT EXISTS source_train_uuid TEXT;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'APD-42 source_train_uuid: appr_trainings_v2 missing on this DB, skipping';
END $$;
