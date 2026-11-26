-- SYN-05: register adm_vessel_revisions_v2 for sync, office to ship only.
--
-- Decision of 26 Nov 2026: planning rows point to a manning revision through
-- vessel_planning_v2.active_revision_uuid, so the ship needs the revisions the
-- office defines. Only the office writes this table (the ship has no write path),
-- so it is ONE_WAY_SHORE_TO_SHIP and goes as whole rows, scoped by vessel_id
-- (which holds the vessel uuid on every row).
--
-- Also installs 0150's updated_at trigger on it (function copied unchanged, as in
-- 0272 and 0281), because the sync gathers whole rows by updated_at.
--
-- Safe to re-run.

INSERT INTO sync_table_config (table_name, category, identity_column, scope_mode, vessel_column, notes) VALUES
  ('adm_vessel_revisions_v2', 'ONE_WAY_SHORE_TO_SHIP', 'vr_uuid', 'own', 'vessel_id',
   'Office defines manning revisions; plans point to them through active_revision_uuid. Rows are large (revision_data), sent as whole rows.')
ON CONFLICT (table_name) DO UPDATE SET
  category = EXCLUDED.category, identity_column = EXCLUDED.identity_column,
  scope_mode = EXCLUDED.scope_mode, vessel_column = EXCLUDED.vessel_column,
  notes = EXCLUDED.notes, updated_at = now();

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
    'adm_vessel_revisions_v2'
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
        RAISE NOTICE 'SYN-05 updated_at trigger: % - table or updated_at column missing on this DB, skipping', sync_table;
        CONTINUE;
      END IF;

      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, sync_table);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        trigger_name, sync_table
      );
      RAISE NOTICE 'SYN-05 updated_at trigger: % - trigger ready', sync_table;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'SYN-05 updated_at trigger: % - unexpected failure (% : %), skipping',
          sync_table, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END
$$;
