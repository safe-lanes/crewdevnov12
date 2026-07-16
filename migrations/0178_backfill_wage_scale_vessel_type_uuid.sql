-- 0178: Backfill acc_wage_scales_v2.vessel_type_uuid values that hold a
-- vessel-type NAME (e.g. 'LPG Tanker') into the canonical
-- master_vessel_types.vt_uuid. Idempotent: rows already holding a valid
-- vt_uuid are untouched; re-running is a no-op.
--
-- Collision safety: partial unique index uq_acc_wage_scales_v2_active
-- enforces one ACTIVE scale per (vessel_type_uuid, vessel_group_uuid).
-- If converting a name-form ACTIVE row would collide with an existing
-- active scale for the same target type/group, the row is SKIPPED
-- (left unchanged) and reported via RAISE NOTICE for manual resolution;
-- the migration never aborts mid-way over such a row.

DO $$
DECLARE
  r RECORD;
  target_uuid text;
  match_count int;
  converted int := 0;
  skipped_collision int := 0;
  unresolved int := 0;
BEGIN
  IF to_regclass('public.acc_wage_scales_v2') IS NULL
     OR to_regclass('public.master_vessel_types') IS NULL THEN
    RAISE NOTICE '0178 backfill: required tables missing — nothing to do';
    RETURN;
  END IF;

  FOR r IN
    SELECT ws.scale_uuid, ws.scale_name, ws.vessel_type_uuid,
           ws.vessel_group_uuid, ws.status, ws.is_deleted
    FROM acc_wage_scales_v2 ws
    WHERE ws.vessel_type_uuid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM master_vessel_types mt
        WHERE mt.vt_uuid = ws.vessel_type_uuid
      )
  LOOP
    SELECT count(*), min(mt.vt_uuid)
      INTO match_count, target_uuid
    FROM master_vessel_types mt
    WHERE mt.vt_uuid IS NOT NULL
      AND COALESCE(mt.is_deleted, false) = false
      AND lower(trim(mt.vessel_type)) = lower(trim(r.vessel_type_uuid));

    IF match_count = 0 OR target_uuid IS NULL THEN
      unresolved := unresolved + 1;
      RAISE NOTICE '0178 backfill: scale % (%) holds unresolvable vessel_type_uuid value "%" — left unchanged for manual resolution',
        r.scale_uuid, r.scale_name, r.vessel_type_uuid;
      CONTINUE;
    END IF;

    IF match_count > 1 THEN
      RAISE NOTICE '0178 backfill: vessel-type name "%" is ambiguous (% master rows) — using vt_uuid %',
        r.vessel_type_uuid, match_count, target_uuid;
    END IF;

    -- Collision check against the partial unique index on active scales.
    IF r.status = 'active' AND COALESCE(r.is_deleted, false) = false AND EXISTS (
      SELECT 1 FROM acc_wage_scales_v2 other
      WHERE other.scale_uuid <> r.scale_uuid
        AND other.status = 'active'
        AND COALESCE(other.is_deleted, false) = false
        AND other.vessel_type_uuid IS NOT DISTINCT FROM target_uuid
        AND other.vessel_group_uuid IS NOT DISTINCT FROM r.vessel_group_uuid
    ) THEN
      skipped_collision := skipped_collision + 1;
      RAISE NOTICE '0178 backfill: scale % (%) NOT converted — converting "%" to vt_uuid % would collide with an existing active scale for the same type/group; resolve manually',
        r.scale_uuid, r.scale_name, r.vessel_type_uuid, target_uuid;
      CONTINUE;
    END IF;

    UPDATE acc_wage_scales_v2
      SET vessel_type_uuid = target_uuid,
          updated_at = now()
      WHERE scale_uuid = r.scale_uuid;
    converted := converted + 1;
    RAISE NOTICE '0178 backfill: scale % (%) converted vessel_type_uuid "%" -> %',
      r.scale_uuid, r.scale_name, r.vessel_type_uuid, target_uuid;
  END LOOP;

  RAISE NOTICE '0178 backfill summary: % converted, % skipped (active-scale collision), % unresolved',
    converted, skipped_collision, unresolved;
END $$;
