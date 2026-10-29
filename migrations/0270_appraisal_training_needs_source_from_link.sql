-- Migration: APD-44 - a Part E training need's source follows its course link.
--
-- Background: appr_training_needs_v2.source ('db' = picked with "Add Training
-- from Database", shown as locked text; 'manual' = typed, editable) was copied
-- from the client flag addedFromDB on every save, so any request could flip it
-- and it could disagree with corresponding_in_db. The server now derives it
-- from the link (ApprTrainingNeedsRepository): 'db' when corresponding_in_db
-- holds a company training ct_uuid, 'manual' otherwise. This migration brings
-- existing rows to the same rule, e.g. rows picked from the database before
-- migration 0124, which got the default 'manual'.
--
-- Only rows that disagree are written, with updated_at stamped so the sync
-- picks the change up. updated_by_uuid is left as it is: no user made the
-- change.
--
-- Safe to re-run. A database without the table skips it with a NOTICE, so one
-- tenant can never abort the per-tenant migration run.

DO $$
DECLARE
  changed INTEGER;
BEGIN
  UPDATE appr_training_needs_v2
     SET source = CASE WHEN coalesce(corresponding_in_db, '') <> '' THEN 'db' ELSE 'manual' END,
         updated_at = now()
   WHERE source IS DISTINCT FROM
         CASE WHEN coalesce(corresponding_in_db, '') <> '' THEN 'db' ELSE 'manual' END;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RAISE NOTICE 'APD-44 training needs source: % row(s) set from corresponding_in_db', changed;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE 'APD-44 training needs source: appr_training_needs_v2 or a column missing on this DB, skipping';
END $$;
