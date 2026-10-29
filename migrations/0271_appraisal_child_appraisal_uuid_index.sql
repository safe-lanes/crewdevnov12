-- Migration: APD-45 - index appraisal_uuid on the appraisal child tables.
--
-- Background: the 10 appr_*_v2 child tables from 0093 had no index on
-- appraisal_uuid. Only appr_reviewers_v2 got one (0179). Yet every open,
-- list, save and delete of an appraisal reads its child rows by that column
-- (the findByAppraisalUuids repositories, syncChildRows and the delete
-- cascade in server/v2/appraisals/repositories/childRowSync.ts), and the sync
-- will gather children through the same join. Without the index Postgres
-- reads the whole table each time and throws away other appraisals' rows.
--
-- The table list is APPRAISAL_CHILD_TABLES in childRowSync.ts minus
-- appr_reviewers_v2, which already has idx_appr_reviewers_v2_appraisal_uuid.
-- Index names follow that one: idx_<table>_appraisal_uuid.
--
-- Not CONCURRENTLY: the migration runner wraps each file in a transaction,
-- where CONCURRENTLY is not allowed. The tables are small, so the write lock
-- while each index builds is brief.
--
-- Safe to re-run (IF NOT EXISTS). Each table runs in its own sub-block; a
-- database missing a table or column skips that table with a NOTICE, so one
-- tenant can never abort the per-tenant migration run.

DO $$
DECLARE
  child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY[
    'appr_trainings_v2',
    'appr_targets_v2',
    'appr_competence_assessments_v2',
    'appr_behavioural_assessments_v2',
    'appr_training_needs_v2',
    'appr_recommendations_v2',
    'appr_appraiser_comments_v2',
    'appr_seafarer_comments_v2',
    'appr_office_reviews_v2',
    'appr_training_followups_v2'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (appraisal_uuid)',
        'idx_' || child_table || '_appraisal_uuid',
        child_table
      );
      RAISE NOTICE 'APD-45 appraisal_uuid index: % - index ready', child_table;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'APD-45 appraisal_uuid index: % - table missing on this DB, skipping', child_table;
      WHEN undefined_column THEN
        RAISE NOTICE 'APD-45 appraisal_uuid index: % - appraisal_uuid column missing on this DB, skipping', child_table;
      WHEN OTHERS THEN
        RAISE NOTICE 'APD-45 appraisal_uuid index: % - unexpected failure (% : %), skipping',
          child_table, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$$;
