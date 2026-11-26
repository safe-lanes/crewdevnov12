-- SYN-04: updated_at trigger on the Rest Hours and Vessel planning tables.
--
-- Background: the sync gathers whole rows (ONE_WAY_SHORE_TO_SHIP and SHIP_ONLY
-- tables) by updated_at, so updated_at must change on every update. App saves
-- stamp it through Drizzle, but 0150 only put its trigger on tables that existed
-- when it ran, and on the local dev DB none of the 11 tables below has it. Writes
-- that skip Drizzle (migrations, scripts, manual fixes and the sync replay) could
-- change a row and leave its old updated_at.
--
-- The function is 0150's, copied unchanged (same as 0272), including the
-- sync.bypass_trigger flag: the sync applier sets it with SET LOCAL so a received
-- row keeps the sender's updated_at. The trigger stamps the DB clock, like the
-- columns' DEFAULT now(). Trigger names follow 0150 (trg_<table>_updated_at), so
-- re-running 0150 replaces these instead of adding a second one.
--
-- Note: the rh_* updated_at columns are timestamp WITHOUT time zone. The trigger
-- keeps them on one clock (the DB's), which the mixed app/DB stamping did not.
-- Changing the column type is a separate decision, not made here.
--
-- Safe to re-run. Each table runs in its own sub-block; a database missing a
-- table or its updated_at column skips that table with a NOTICE.

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
  sync_table TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH sync_table IN ARRAY ARRAY[
    'rh_vessel_records_v2',
    'rh_crew_records_v2',
    'rh_daily_records_v2',
    'rh_vessel_violation_comments_v2',
    'rh_office_violation_comments_v2',
    'rh_nc_reports_v2',
    'rh_fixed_tasks_v2',
    'rh_variable_tasks_v2',
    'rh_dateline_adjustments_v2',
    'vessel_planning_v2',
    'vessel_planning_attachments_v2'
  ]
  LOOP
    trigger_name := 'trg_' || sync_table || '_updated_at';
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = sync_table
          AND column_name = 'updated_at'
      ) THEN
        RAISE NOTICE 'SYN-04 updated_at trigger: % - table or updated_at column missing on this DB, skipping', sync_table;
        CONTINUE;
      END IF;

      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, sync_table);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        trigger_name, sync_table
      );
      RAISE NOTICE 'SYN-04 updated_at trigger: % - trigger ready', sync_table;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'SYN-04 updated_at trigger: % - unexpected failure (% : %), skipping',
          sync_table, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$$;
