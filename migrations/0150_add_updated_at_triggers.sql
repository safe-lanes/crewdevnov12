-- Migration: stamp updated_at on every UPDATE, DB-clock, sync-aware.
-- Target: every public base table carrying an `updated_at` column.
-- Description: Installs a BEFORE UPDATE trigger that auto-stamps updated_at with
-- the DB clock (NOW()) on every row update — including raw SQL / external writes
-- that bypass the Drizzle ORM. This is the defense-in-depth layer that complements
-- the ORM-level `.$onUpdate()` already on the audit columns (the ORM hook covers
-- future tables; this trigger covers existing tables and non-Drizzle writes).
--
-- Idempotent: safe to re-run any number of times (e.g., to heal a DB that's
-- missing these triggers after a `drizzle-kit push` provisioning path, or after a
-- restore that skipped migration replay).

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

-- Apply (or re-apply) the trigger to every base table that has an
-- updated_at column. Re-running this block is safe: each trigger is
-- dropped-if-exists then recreated, so the end state is identical
-- regardless of how many times it runs or what existed before.
DO $$
DECLARE
    tbl TEXT;
    trigger_name TEXT;
    failed_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOR tbl IN
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON c.table_name = t.table_name
         AND c.table_schema = t.table_schema
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name = 'updated_at'
        ORDER BY t.table_name
    LOOP
        trigger_name := 'trg_' || tbl || '_updated_at';

        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, tbl);
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
                trigger_name, tbl
            );
            RAISE NOTICE 'OK: % on %', trigger_name, tbl;
        EXCEPTION WHEN OTHERS THEN
            failed_tables := array_append(failed_tables, tbl || ' (' || SQLERRM || ')');
            RAISE WARNING 'FAILED: % on % — %', trigger_name, tbl, SQLERRM;
        END;
    END LOOP;

    IF array_length(failed_tables, 1) > 0 THEN
        RAISE WARNING 'Triggers NOT applied to: %', array_to_string(failed_tables, ', ');
    END IF;
END;
$$;
