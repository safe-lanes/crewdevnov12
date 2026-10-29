-- Migration: APD-46 - updated_at trigger on every appraisal table.
--
-- Background: updated_at must change on every update, because the sync uses
-- it to tell which rows changed. 0150 installs a BEFORE UPDATE trigger that
-- stamps it, but it loops over the tables that exist when it runs, once.
-- appr_reviewers_v2 is created later (0179), so it never got the trigger.
-- Some databases also list 0150 as applied without having its function or
-- triggers (the local dev DB had neither on any appraisal table).
--
-- App saves stamp updatedAt through Drizzle, so they were not affected. Writes
-- that skip Drizzle were: migrations, scripts, manual fixes and the sync
-- replay could change a row and leave its old updated_at.
--
-- The function is 0150's, copied unchanged (tests/unit/appraisal-updated-at-
-- trigger.test.ts checks they stay identical), so databases where 0150 ran
-- see no change. It stamps the DB clock, like the columns' DEFAULT now().
-- Trigger names follow 0150 (trg_<table>_updated_at), so re-running 0150
-- replaces these triggers instead of adding a second one.
--
-- The table list is appraisal_results_v2 plus APPRAISAL_CHILD_TABLES in
-- server/v2/appraisals/repositories/childRowSync.ts.
--
-- Safe to re-run. Each table runs in its own sub-block; a database missing a
-- table or its updated_at column skips that table with a NOTICE (a trigger
-- there would make every update fail), so one tenant can never abort the
-- per-tenant migration run.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync engine sets this session flag before replaying a row from the
    -- other side (ship<->shore), so the original updated_at survives instead
    -- of being overwritten with this server's NOW().
    IF current_setting('sync.bypass_trigger', true) = 'true' THEN
        RETURN NEW;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = pg_catalog, public;

DO $$
DECLARE
  appraisal_table TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH appraisal_table IN ARRAY ARRAY[
    'appraisal_results_v2',
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
    trigger_name := 'trg_' || appraisal_table || '_updated_at';
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = appraisal_table
          AND column_name = 'updated_at'
      ) THEN
        RAISE NOTICE 'APD-46 updated_at trigger: % - table or updated_at column missing on this DB, skipping', appraisal_table;
        CONTINUE;
      END IF;

      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, appraisal_table);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        trigger_name, appraisal_table
      );
      RAISE NOTICE 'APD-46 updated_at trigger: % - trigger ready', appraisal_table;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'APD-46 updated_at trigger: % - unexpected failure (% : %), skipping',
          appraisal_table, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$$;
