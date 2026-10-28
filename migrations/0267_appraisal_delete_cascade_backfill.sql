-- Migration: APD-33 - child rows of deleted appraisals are deleted too.
--
-- Background: deleting an appraisal (DELETE /api/v2/appraisals/:uuid) used to
-- soft-delete only its appraisal_results_v2 row. Its rows in the 11 appr_*_v2
-- child tables kept is_deleted = false, so the sync would send live rows of a
-- deleted appraisal to the other side. The delete now soft-deletes the child
-- rows in the same transaction (AppraisalResultsService.delete); this
-- migration brings existing data to the same state.
--
-- Each live child row whose appraisal is soft-deleted is marked deleted, with
-- updated_at stamped so the sync picks the change up. updated_by_uuid is left
-- as it is: who deleted the appraisal was not recorded before this fix.
--
-- The table list matches APPRAISAL_CHILD_TABLES in
-- server/v2/appraisals/repositories/childRowSync.ts.
--
-- Safe to re-run: only rows still live under a deleted appraisal are touched.
-- Each table runs in its own sub-block; a database missing a table or column
-- skips that table with a NOTICE, so one tenant can never abort the
-- per-tenant migration run.

DO $$
DECLARE
  child_table TEXT;
  changed INTEGER;
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
    'appr_training_followups_v2',
    'appr_reviewers_v2'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I c
         SET is_deleted = true,
             updated_at = now()
         FROM appraisal_results_v2 p
         WHERE p.appraisal_uuid = c.appraisal_uuid
           AND p.is_deleted = true
           AND coalesce(c.is_deleted, false) = false',
        child_table
      );
      GET DIAGNOSTICS changed = ROW_COUNT;
      RAISE NOTICE 'APD-33 delete cascade backfill: % - % row(s) of deleted appraisals marked deleted',
        child_table, changed;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'APD-33 delete cascade backfill: % - table missing on this DB, skipping', child_table;
      WHEN undefined_column THEN
        RAISE NOTICE 'APD-33 delete cascade backfill: % - required column missing on this DB, skipping', child_table;
      WHEN OTHERS THEN
        RAISE NOTICE 'APD-33 delete cascade backfill: % - unexpected failure (% : %), skipping',
          child_table, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$$;
