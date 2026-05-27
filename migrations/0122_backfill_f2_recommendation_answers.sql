-- Migration: Backfill F2 "Appraiser's Recommendations" answers.
--
-- Background: Until Task #479, the admin Form Editor seeded the 4 built-in
-- F2 recommendations with answer="Yes" (and its loaders silently back-filled
-- "Yes" whenever no answer was present). That stale default flowed into
-- every appraisal's F2 section as a pre-selected "Yes" even though the
-- admin never explicitly chose it. The fix stopped writing "Yes" going
-- forward; this migration removes the legacy "Yes" from already-stored
-- configurations on:
--
--   - adm_rank_groups_v2.configuration   (legacy runtime config)
--   - adm_form_versions_v2.configuration (versioned configs that released
--                                          appraisals actually load)
--
-- Scope (deliberately narrow):
--   - Only rows whose `question` exactly matches one of the 4 baseline
--     questions below (custom rows are NEVER touched).
--   - Only when current `answer === "Yes"`.
--   - Only when `isCustom IS DISTINCT FROM true` (missing/null/false).
--   - Promotion form / submitted appraisals are NOT touched.
--
-- Fault tolerance:
--   - Each row is processed inside a nested BEGIN/EXCEPTION block, so any
--     single malformed JSON row, unexpected shape, or per-row failure is
--     logged as a RAISE NOTICE warning and the loop continues. One bad row
--     can never abort startup or block subsequent migrations.
--   - Missing tables (e.g. on a tenant DB that hasn't created admin v2
--     tables yet) are soft-skipped with a RAISE NOTICE.
--
-- Idempotent: each UPDATE is guarded by `configuration IS DISTINCT FROM`
-- the rebuilt value, so re-running this migration writes 0 rows.

DO $$
DECLARE
  baselines TEXT[] := ARRAY[
    'Recommended for continued service on board?',
    'Recommended for re-employment?',
    'Recommended for promotion?',
    'Career Development recommendations (If Any)?'
  ];
  row_rec     RECORD;
  cfg_jsonb   JSONB;
  recs        JSONB;
  new_recs    JSONB;
  new_cfg     JSONB;
  scanned     INTEGER;
  changed     INTEGER;
  skipped     INTEGER;
  errored     INTEGER;
BEGIN
  ----------------------------------------------------------------------
  -- 1) adm_rank_groups_v2
  ----------------------------------------------------------------------
  scanned := 0; changed := 0; skipped := 0; errored := 0;
  BEGIN
    FOR row_rec IN
      SELECT id, name, configuration
      FROM adm_rank_groups_v2
      WHERE configuration IS NOT NULL
    LOOP
      scanned := scanned + 1;
      BEGIN
        -- Parse configuration as JSONB. text->jsonb cast will throw on
        -- invalid JSON; the EXCEPTION handler below converts that into
        -- a warning + continue.
        cfg_jsonb := row_rec.configuration::jsonb;

        IF cfg_jsonb IS NULL
           OR jsonb_typeof(cfg_jsonb) <> 'object' THEN
          skipped := skipped + 1;
          CONTINUE;
        END IF;

        recs := cfg_jsonb -> 'recommendations';
        IF recs IS NULL OR jsonb_typeof(recs) <> 'array' THEN
          skipped := skipped + 1;
          CONTINUE;
        END IF;

        SELECT jsonb_agg(
                 CASE
                   WHEN jsonb_typeof(rec) = 'object'
                    AND (rec ->> 'answer') = 'Yes'
                    AND (rec -> 'isCustom') IS DISTINCT FROM 'true'::jsonb
                    AND COALESCE(rec ->> 'question', rec ->> 'recommendation', '')
                        = ANY (baselines)
                   THEN jsonb_set(rec, '{answer}', '""'::jsonb, true)
                   ELSE rec
                 END
                 ORDER BY ord
               )
          INTO new_recs
          FROM jsonb_array_elements(recs) WITH ORDINALITY AS elems(rec, ord);

        new_cfg := cfg_jsonb || jsonb_build_object('recommendations', COALESCE(new_recs, '[]'::jsonb));

        IF (new_cfg)::text IS DISTINCT FROM row_rec.configuration THEN
          UPDATE adm_rank_groups_v2
          SET configuration = (new_cfg)::text,
              updated_at    = NOW()
          WHERE id = row_rec.id
            AND configuration IS DISTINCT FROM (new_cfg)::text;
          changed := changed + 1;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        errored := errored + 1;
        RAISE NOTICE 'F2 backfill: skipped adm_rank_groups_v2 id=% (% : %)',
          row_rec.id, SQLSTATE, SQLERRM;
        CONTINUE;
      END;
    END LOOP;

    RAISE NOTICE 'F2 backfill summary [adm_rank_groups_v2]: scanned=%, changed=%, skipped=%, errored=%',
      scanned, changed, skipped, errored;

  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'F2 backfill: table adm_rank_groups_v2 does not exist on this DB, skipping';
    WHEN OTHERS THEN
      RAISE NOTICE 'F2 backfill: unexpected failure on adm_rank_groups_v2 (% : %), continuing',
        SQLSTATE, SQLERRM;
  END;

  ----------------------------------------------------------------------
  -- 2) adm_form_versions_v2
  ----------------------------------------------------------------------
  scanned := 0; changed := 0; skipped := 0; errored := 0;
  BEGIN
    FOR row_rec IN
      SELECT id, configuration
      FROM adm_form_versions_v2
      WHERE configuration IS NOT NULL
    LOOP
      scanned := scanned + 1;
      BEGIN
        cfg_jsonb := row_rec.configuration::jsonb;

        IF cfg_jsonb IS NULL
           OR jsonb_typeof(cfg_jsonb) <> 'object' THEN
          skipped := skipped + 1;
          CONTINUE;
        END IF;

        recs := cfg_jsonb -> 'recommendations';
        IF recs IS NULL OR jsonb_typeof(recs) <> 'array' THEN
          skipped := skipped + 1;
          CONTINUE;
        END IF;

        SELECT jsonb_agg(
                 CASE
                   WHEN jsonb_typeof(rec) = 'object'
                    AND (rec ->> 'answer') = 'Yes'
                    AND (rec -> 'isCustom') IS DISTINCT FROM 'true'::jsonb
                    AND COALESCE(rec ->> 'question', rec ->> 'recommendation', '')
                        = ANY (baselines)
                   THEN jsonb_set(rec, '{answer}', '""'::jsonb, true)
                   ELSE rec
                 END
                 ORDER BY ord
               )
          INTO new_recs
          FROM jsonb_array_elements(recs) WITH ORDINALITY AS elems(rec, ord);

        new_cfg := cfg_jsonb || jsonb_build_object('recommendations', COALESCE(new_recs, '[]'::jsonb));

        IF (new_cfg)::text IS DISTINCT FROM row_rec.configuration THEN
          UPDATE adm_form_versions_v2
          SET configuration = (new_cfg)::text,
              updated_at    = NOW()
          WHERE id = row_rec.id
            AND configuration IS DISTINCT FROM (new_cfg)::text;
          changed := changed + 1;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        errored := errored + 1;
        RAISE NOTICE 'F2 backfill: skipped adm_form_versions_v2 id=% (% : %)',
          row_rec.id, SQLSTATE, SQLERRM;
        CONTINUE;
      END;
    END LOOP;

    RAISE NOTICE 'F2 backfill summary [adm_form_versions_v2]: scanned=%, changed=%, skipped=%, errored=%',
      scanned, changed, skipped, errored;

  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'F2 backfill: table adm_form_versions_v2 does not exist on this DB, skipping';
    WHEN OTHERS THEN
      RAISE NOTICE 'F2 backfill: unexpected failure on adm_form_versions_v2 (% : %), continuing',
        SQLSTATE, SQLERRM;
  END;
END
$$;
