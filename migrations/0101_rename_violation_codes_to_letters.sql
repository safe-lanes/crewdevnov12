-- Migration: Rename violation codes from numeric (1-8) to alphabetic (A, B, C, D, EF, G, H, I)
-- Mapping: 1→A, 2→C, 3→EF, 4→G, 5→B, 6→D, 7→I, 8→H
-- Affects: rh_daily_records_v2.daily_records JSON column
--   - violations arrays: [1, 3] → ["A", "EF"]
--   - violationDiagnostics[].code: 1 → "A"
-- Idempotent: safe to run multiple times (handles both numeric and already-converted string codes)

DO $$
DECLARE
  rec RECORD;
  daily_json JSONB;
  updated_json JSONB;
  day_obj JSONB;
  new_violations JSONB;
  new_diagnostics JSONB;
  diag JSONB;
  old_code JSONB;
  new_code TEXT;
  i INT;
  j INT;
  changed BOOLEAN;
BEGIN
  FOR rec IN SELECT id, daily_records FROM rh_daily_records_v2 WHERE daily_records IS NOT NULL AND daily_records != '' AND daily_records != '[]'
  LOOP
    BEGIN
      daily_json := rec.daily_records::JSONB;
      updated_json := '[]'::JSONB;
      changed := FALSE;

      FOR i IN 0..jsonb_array_length(daily_json) - 1
      LOOP
        day_obj := daily_json->i;

        -- Convert violations array: numeric codes to string codes
        IF day_obj ? 'violations' AND jsonb_array_length(COALESCE(day_obj->'violations', '[]'::JSONB)) > 0 THEN
          new_violations := '[]'::JSONB;
          FOR j IN 0..jsonb_array_length(day_obj->'violations') - 1
          LOOP
            old_code := day_obj->'violations'->j;
            -- Match both numeric JSONB values (1, 2, ...) and string JSONB values ("1", "2", ...)
            new_code := CASE
              WHEN old_code = to_jsonb(1) OR old_code = to_jsonb('1'::text) THEN 'A'
              WHEN old_code = to_jsonb(2) OR old_code = to_jsonb('2'::text) THEN 'C'
              WHEN old_code = to_jsonb(3) OR old_code = to_jsonb('3'::text) THEN 'EF'
              WHEN old_code = to_jsonb(4) OR old_code = to_jsonb('4'::text) THEN 'G'
              WHEN old_code = to_jsonb(5) OR old_code = to_jsonb('5'::text) THEN 'B'
              WHEN old_code = to_jsonb(6) OR old_code = to_jsonb('6'::text) THEN 'D'
              WHEN old_code = to_jsonb(7) OR old_code = to_jsonb('7'::text) THEN 'I'
              WHEN old_code = to_jsonb(8) OR old_code = to_jsonb('8'::text) THEN 'H'
              ELSE NULL
            END;
            IF new_code IS NOT NULL THEN
              new_violations := new_violations || to_jsonb(new_code);
              changed := TRUE;
            ELSE
              -- Keep as-is if already a letter code or unknown
              new_violations := new_violations || old_code;
            END IF;
          END LOOP;
          day_obj := jsonb_set(day_obj, '{violations}', new_violations);
        END IF;

        -- Convert violationDiagnostics[].code: numeric to string
        IF day_obj ? 'violationDiagnostics' AND jsonb_array_length(COALESCE(day_obj->'violationDiagnostics', '[]'::JSONB)) > 0 THEN
          new_diagnostics := '[]'::JSONB;
          FOR j IN 0..jsonb_array_length(day_obj->'violationDiagnostics') - 1
          LOOP
            diag := day_obj->'violationDiagnostics'->j;
            old_code := diag->'code';
            -- Match both numeric JSONB values (1, 2, ...) and string JSONB values ("1", "2", ...)
            new_code := CASE
              WHEN old_code = to_jsonb(1) OR old_code = to_jsonb('1'::text) THEN 'A'
              WHEN old_code = to_jsonb(2) OR old_code = to_jsonb('2'::text) THEN 'C'
              WHEN old_code = to_jsonb(3) OR old_code = to_jsonb('3'::text) THEN 'EF'
              WHEN old_code = to_jsonb(4) OR old_code = to_jsonb('4'::text) THEN 'G'
              WHEN old_code = to_jsonb(5) OR old_code = to_jsonb('5'::text) THEN 'B'
              WHEN old_code = to_jsonb(6) OR old_code = to_jsonb('6'::text) THEN 'D'
              WHEN old_code = to_jsonb(7) OR old_code = to_jsonb('7'::text) THEN 'I'
              WHEN old_code = to_jsonb(8) OR old_code = to_jsonb('8'::text) THEN 'H'
              ELSE NULL
            END;
            IF new_code IS NOT NULL THEN
              diag := jsonb_set(diag, '{code}', to_jsonb(new_code));
              changed := TRUE;
            END IF;
            new_diagnostics := new_diagnostics || jsonb_build_array(diag);
          END LOOP;
          day_obj := jsonb_set(day_obj, '{violationDiagnostics}', new_diagnostics);
        END IF;

        updated_json := updated_json || jsonb_build_array(day_obj);
      END LOOP;

      IF changed THEN
        UPDATE rh_daily_records_v2 SET daily_records = updated_json::TEXT WHERE id = rec.id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped record id=% due to error: %', rec.id, SQLERRM;
    END;
  END LOOP;
END $$;
