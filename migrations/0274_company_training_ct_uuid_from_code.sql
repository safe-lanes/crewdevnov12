-- Migration: APD-39 follow-up (parked issue 3) - a company training's ct_uuid
-- is worked out from its code, so the same course has the same id on the
-- office and on every vessel.
--
-- Background: 0089 filled ct_uuid with gen_random_uuid() and new rows got
-- uuidv4(), so each server made up its own id for the same course. Since
-- APD-39 (0268), appraisals, promotions and Training & Retention store the
-- ct_uuid in corresponding_in_db, so after sync a training picked on a vessel
-- would point to nothing in the office.
--
-- The new id is a name-based UUIDv8 (RFC 9562 appendix B.2): SHA-256 of the
-- namespace bytes followed by upper(btrim(company_id)) in UTF-8, first 16
-- bytes, version 8, variant 10. Namespace 702a098f-d905-565c-993b-336495209e5d
-- = v5('safelanes.crewing.company_trainings', URL). The app makes the same
-- value in server/v2/admin/utils/companyTrainingUuid.ts. Never change either.
-- SHA-256 rather than uuid v5 (SHA-1): sha256() is built into Postgres, while
-- uuid_generate_v5 needs the uuid-ossp extension, which no migration installs.
--
-- Steps:
-- 1. Work out each training's new id. When rows share a code only one gets
--    it: the live row first, then the lowest id. The others keep their random
--    id. A row that already has its new id is left alone.
-- 2. Rewrite every stored copy of an old id: corresponding_in_db in the five
--    tables 0268 converted, and crew_training_courses.course_id (the training
--    compliance reader accepts a ct_uuid there). updated_at is stamped so the
--    sync picks the change up.
-- 3. Give the trainings their new ids.
--
-- All or nothing: the steps run in one block, so if any statement fails the
-- whole block is undone and a WARNING is raised. Ids and references never get
-- out of step, and one tenant can never abort the per-tenant migration run.
-- A table or column missing on this database is skipped with a NOTICE.
-- Idempotent: a re-run finds nothing to change. A new id (version 8) can never
-- equal an old random id (version 4), so old and new values never clash.

DO $$
DECLARE
  target_table TEXT;
  changed INTEGER;
  rewritten INTEGER := 0;
  rekeyed INTEGER;
BEGIN
  IF to_regclass('adm_company_trainings_v2') IS NULL THEN
    RAISE NOTICE 'APD-39 ct_uuid from code: adm_company_trainings_v2 missing on this DB, skipping';
    RETURN;
  END IF;

  BEGIN
    DROP TABLE IF EXISTS pg_temp.ct_uuid_rekey;
    CREATE TEMP TABLE ct_uuid_rekey ON COMMIT DROP AS
    WITH hashed AS (
      SELECT c.id, c.ct_uuid, coalesce(c.is_deleted, false) AS is_deleted,
             sha256(decode('702a098fd905565c993b336495209e5d', 'hex')
                    || convert_to(upper(btrim(c.company_id)), 'UTF8')) AS d
      FROM adm_company_trainings_v2 c
      WHERE nullif(btrim(c.company_id), '') IS NOT NULL
    ), derived AS (
      SELECT id, ct_uuid AS old_uuid, is_deleted,
             encode(set_byte(set_byte(substring(d FROM 1 FOR 16),
               6, (get_byte(d, 6) & 15) | 128),
               8, (get_byte(d, 8) & 63) | 128), 'hex')::uuid::text AS new_uuid
      FROM hashed
    ), ranked AS (
      SELECT *, row_number() OVER (PARTITION BY new_uuid ORDER BY is_deleted, id) AS pick
      FROM derived
    )
    SELECT r.id, r.old_uuid, r.new_uuid
    FROM ranked r
    WHERE r.pick = 1
      AND NOT EXISTS (SELECT 1 FROM adm_company_trainings_v2 x WHERE x.ct_uuid = r.new_uuid);

    FOREACH target_table IN ARRAY ARRAY[
      'appr_training_needs_v2',
      'appr_training_followups_v2',
      'promo_training_needs_v2',
      'training_needs_other_v2',
      'training_needs_source_overlay_v2'
    ]
    LOOP
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = current_schema() AND table_name = target_table
                       AND column_name = 'corresponding_in_db') THEN
        RAISE NOTICE 'APD-39 ct_uuid from code: % has no corresponding_in_db on this DB, skipping', target_table;
        CONTINUE;
      END IF;
      EXECUTE format(
        'UPDATE %I t
         SET corresponding_in_db = m.new_uuid,
             updated_at = now()
         FROM ct_uuid_rekey m
         WHERE btrim(t.corresponding_in_db) = m.old_uuid',
        target_table
      );
      GET DIAGNOSTICS changed = ROW_COUNT;
      rewritten := rewritten + changed;
      RAISE NOTICE 'APD-39 ct_uuid from code: % - % reference(s) rewritten', target_table, changed;
    END LOOP;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'crew_training_courses'
                 AND column_name = 'course_id') THEN
      UPDATE crew_training_courses t
      SET course_id = m.new_uuid,
          updated_at = now()
      FROM ct_uuid_rekey m
      WHERE btrim(t.course_id) = m.old_uuid;
      GET DIAGNOSTICS changed = ROW_COUNT;
      rewritten := rewritten + changed;
      RAISE NOTICE 'APD-39 ct_uuid from code: crew_training_courses - % reference(s) rewritten', changed;
    ELSE
      RAISE NOTICE 'APD-39 ct_uuid from code: crew_training_courses.course_id missing on this DB, skipping';
    END IF;

    UPDATE adm_company_trainings_v2 c
    SET ct_uuid = m.new_uuid,
        updated_at = now()
    FROM ct_uuid_rekey m
    WHERE c.id = m.id;
    GET DIAGNOSTICS rekeyed = ROW_COUNT;

    RAISE NOTICE 'APD-39 ct_uuid from code: % training(s) given their code-based id, % reference(s) rewritten',
      rekeyed, rewritten;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'APD-39 ct_uuid from code: nothing changed on this DB, all steps undone: %', SQLERRM;
  END;
END $$;
