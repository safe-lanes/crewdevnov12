-- Migration: APD-39 - corresponding_in_db stores the company training's ct_uuid.
--
-- Background: a training picked from the company training list was saved in
-- corresponding_in_db as adm_company_trainings_v2.id (the serial id, as text).
-- Serial ids are numbered by each database, so once a row reaches another
-- server the same number can mean a different training, or none. The client
-- now saves adm_company_trainings_v2.ct_uuid instead; this migration converts
-- the values already stored.
--
-- Each value that equals a company training's id is replaced by that
-- training's ct_uuid, with updated_at stamped so the sync picks the change up.
-- Deleted rows and deleted trainings are converted too: the stored id pointed
-- at that training either way. Values that are not ids (free-text names copied
-- in from the rank-group form) are left as they are, and so are numbers with
-- no matching training (counted in the NOTICE).
--
-- Converting on each database with its own ids is correct: rows are not synced
-- yet, so every stored id was written on the database it sits in, or arrived
-- with a full dump that copied the trainings' ids and ct_uuids together.
--
-- Safe to re-run: a ct_uuid never equals a serial id, so converted rows are
-- not matched again. Each table runs in its own sub-block; a database missing
-- a table or column skips that table with a NOTICE, so one tenant can never
-- abort the per-tenant migration run.

DO $$
DECLARE
  target_table TEXT;
  changed INTEGER;
  unmatched INTEGER;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'appr_training_needs_v2',
    'appr_training_followups_v2',
    'promo_training_needs_v2',
    'training_needs_other_v2',
    'training_needs_source_overlay_v2'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I r
         SET corresponding_in_db = c.ct_uuid,
             updated_at = now()
         FROM adm_company_trainings_v2 c
         WHERE c.id::text = btrim(r.corresponding_in_db)',
        target_table
      );
      GET DIAGNOSTICS changed = ROW_COUNT;

      EXECUTE format(
        'SELECT count(*) FROM %I WHERE corresponding_in_db ~ ''^\s*[0-9]+\s*$''',
        target_table
      ) INTO unmatched;

      RAISE NOTICE 'APD-39 corresponding_in_db to ct_uuid: % - % row(s) converted, % numeric value(s) with no matching training left as is',
        target_table, changed, unmatched;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'APD-39 corresponding_in_db to ct_uuid: % - table missing on this DB, skipping', target_table;
      WHEN undefined_column THEN
        RAISE NOTICE 'APD-39 corresponding_in_db to ct_uuid: % - required column missing on this DB, skipping', target_table;
      WHEN OTHERS THEN
        RAISE NOTICE 'APD-39 corresponding_in_db to ct_uuid: % - skipped: %', target_table, SQLERRM;
    END;
  END LOOP;
END $$;
