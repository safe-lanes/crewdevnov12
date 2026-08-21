-- Enforce the appraisal and promotion form-version pin contract.
-- Backfill date: 21-Aug-2026. These are the explicitly approved pre-pinning
-- development records only; no general latest-version backfill is permitted.

BEGIN;

-- The exceptional repair is only valid for this known development inventory.
-- Match both listed numeric IDs and immutable record UUIDs so unrelated tenant
-- rows sharing a serial ID can never be changed by this migration.
DO $$
DECLARE
  approved_appraisal_match_count integer;
  approved_promotion_match_count integer;
  resolved_appraisal_version_count integer;
  resolved_promotion_version_count integer;
  unlisted_final_unpinned_count integer;
  partial_pin_count integer;
BEGIN
  SELECT count(*) INTO approved_appraisal_match_count
  FROM appraisal_results_v2
  WHERE
    (id = 2 AND appraisal_uuid = '51954b26-851f-4ac7-a24e-fbfabf4618a8') OR
    (id = 3 AND appraisal_uuid = '8308950e-4040-4ce1-8ef0-a8d1641de4db') OR
    (id = 4 AND appraisal_uuid = '4933f094-194b-4b95-9020-4d482c395d5b') OR
    (id = 5 AND appraisal_uuid = 'bec61b88-a45c-4056-9cfe-106421f0615f') OR
    (id = 6 AND appraisal_uuid = '6598dfb6-83f6-4b7d-8d7f-f734103c79bc') OR
    (id = 7 AND appraisal_uuid = 'f32b30c7-edeb-42eb-93d2-4e874af264ae') OR
    (id = 8 AND appraisal_uuid = 'bb27b8df-cf95-43f3-bbb9-a98888fd7d88') OR
    (id = 9 AND appraisal_uuid = '1fdb0002-1900-4f77-9f6d-0badc2045daf') OR
    (id = 10 AND appraisal_uuid = '9453680f-1517-4a21-aa33-7e5874349555') OR
    (id = 11 AND appraisal_uuid = '617d1174-7a8c-4957-ad02-d76ac211beba') OR
    (id = 12 AND appraisal_uuid = 'b9b8bbf0-798c-494d-bc31-ac6e45d0d799') OR
    (id = 13 AND appraisal_uuid = '10523bee-65c4-4cd4-a41b-d5ddd064c1b0');

  SELECT count(*) INTO approved_promotion_match_count
  FROM promotion_reviews_v2
  WHERE id = 134
    AND review_uuid = '35d776ba-b8b8-4aae-9a6c-e3fd6f08b767';

  IF approved_appraisal_match_count NOT IN (0, 12)
     OR approved_promotion_match_count NOT IN (0, 1) THEN
    RAISE EXCEPTION
      'Form-version pin backfill preflight failed: expected either no approved development records or all 12 appraisal and 1 promotion records, found % and %',
      approved_appraisal_match_count, approved_promotion_match_count;
  END IF;

  -- Form-version serial IDs are tenant-local. Whenever this known development
  -- inventory is present, confirm every stable version UUID still points to a
  -- released form of the expected category and rank before resolving local IDs.
  IF approved_appraisal_match_count = 12 THEN
    SELECT count(*) INTO resolved_appraisal_version_count
    FROM (
      VALUES
        ('2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
        ('3rd Engineer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('Electrical Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
        ('2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('Master', '063e2175-3883-4e53-9718-1710ef2b2c97'),
        ('Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
        ('Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
        ('2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
        ('Deck Cadet', 'd0373db4-9f1a-43e0-b808-e900f4cc735a')
    ) AS expected(rank, fv_uuid)
    JOIN adm_form_versions_v2 v ON v.fv_uuid = expected.fv_uuid
    JOIN adm_rank_groups_v2 rg ON rg.id = v.rank_group_id
    JOIN adm_forms_v2 f ON f.id = rg.form_id
    WHERE v.status = 'released'
      AND COALESCE(v.is_deleted, false) = false
      AND rg.archived_at IS NULL
      AND COALESCE(f.is_deleted, false) = false
      AND f.category = 'appraisal'
      AND EXISTS (
        SELECT 1
        FROM json_array_elements_text(rg.ranks::json) AS rank_item(rank_label)
        WHERE lower(trim(rank_item.rank_label)) = lower(trim(expected.rank))
      );

    IF resolved_appraisal_version_count <> 12 THEN
      RAISE EXCEPTION
        'Form-version pin backfill preflight failed: only % of 12 approved appraisal version UUID/rank mappings are released and valid',
        resolved_appraisal_version_count;
    END IF;
  END IF;

  IF approved_promotion_match_count = 1 THEN
    SELECT count(*) INTO resolved_promotion_version_count
    FROM adm_form_versions_v2 v
    JOIN adm_rank_groups_v2 rg ON rg.id = v.rank_group_id
    JOIN adm_forms_v2 f ON f.id = rg.form_id
    WHERE v.fv_uuid = 'ce5723f1-d8f5-4f2b-9fa1-a12e9d391a3d'
      AND v.status = 'released'
      AND COALESCE(v.is_deleted, false) = false
      AND rg.archived_at IS NULL
      AND COALESCE(f.is_deleted, false) = false
      AND f.category = 'promotion'
      AND EXISTS (
        SELECT 1
        FROM json_array_elements_text(rg.ranks::json) AS rank_item(rank_label)
        WHERE lower(trim(rank_item.rank_label)) = 'ab'
      );

    IF resolved_promotion_version_count <> 1 THEN
      RAISE EXCEPTION
        'Form-version pin backfill preflight failed: approved promotion version UUID is not a released AB promotion form';
    END IF;
  END IF;

  -- Any other final record lacking either pin is unrelated historical data.
  -- Stop before writes so it can be reviewed deliberately rather than mutated.
  SELECT count(*) INTO unlisted_final_unpinned_count
  FROM (
    SELECT id
    FROM appraisal_results_v2
    WHERE lower(trim(status)) IN (
        'preliminary', 'submitted', 'pending_review', 'stage2_submitted',
        'reviewed', 'stage3_submitted'
      )
      AND (form_version_id IS NULL OR form_version_uuid IS NULL)
      AND NOT (
        (id = 2 AND appraisal_uuid = '51954b26-851f-4ac7-a24e-fbfabf4618a8') OR
        (id = 3 AND appraisal_uuid = '8308950e-4040-4ce1-8ef0-a8d1641de4db') OR
        (id = 4 AND appraisal_uuid = '4933f094-194b-4b95-9020-4d482c395d5b') OR
        (id = 5 AND appraisal_uuid = 'bec61b88-a45c-4056-9cfe-106421f0615f') OR
        (id = 6 AND appraisal_uuid = '6598dfb6-83f6-4b7d-8d7f-f734103c79bc') OR
        (id = 7 AND appraisal_uuid = 'f32b30c7-edeb-42eb-93d2-4e874af264ae') OR
        (id = 8 AND appraisal_uuid = 'bb27b8df-cf95-43f3-bbb9-a98888fd7d88') OR
        (id = 9 AND appraisal_uuid = '1fdb0002-1900-4f77-9f6d-0badc2045daf') OR
        (id = 10 AND appraisal_uuid = '9453680f-1517-4a21-aa33-7e5874349555') OR
        (id = 11 AND appraisal_uuid = '617d1174-7a8c-4957-ad02-d76ac211beba') OR
        (id = 12 AND appraisal_uuid = 'b9b8bbf0-798c-494d-bc31-ac6e45d0d799') OR
        (id = 13 AND appraisal_uuid = '10523bee-65c4-4cd4-a41b-d5ddd064c1b0')
      )

    UNION ALL

    SELECT id
    FROM promotion_reviews_v2
    WHERE lower(trim(status)) IN ('submitted', 'for approval', 'approved', 'completed')
      AND (form_version_id IS NULL OR form_version_uuid IS NULL)
      AND NOT (id = 134 AND review_uuid = '35d776ba-b8b8-4aae-9a6c-e3fd6f08b767')
  ) AS unlisted_final_unpinned_rows;

  IF unlisted_final_unpinned_count <> 0 THEN
    RAISE EXCEPTION
      'Form-version pin backfill preflight failed: found % unlisted submitted-or-later rows without complete pins',
      unlisted_final_unpinned_count;
  END IF;

  -- Pair constraints cover every status, so reject all existing partial pairs
  -- before backfill rather than discovering them during ALTER TABLE.
  SELECT
    (SELECT count(*) FROM appraisal_results_v2
      WHERE (form_version_id IS NULL) <> (form_version_uuid IS NULL))
    +
    (SELECT count(*) FROM promotion_reviews_v2
      WHERE (form_version_id IS NULL) <> (form_version_uuid IS NULL))
  INTO partial_pin_count;

  IF partial_pin_count <> 0 THEN
    RAISE EXCEPTION
      'Form-version pin backfill preflight failed: found % rows with one-sided form-version pins',
      partial_pin_count;
  END IF;
END $$;

-- Resolve each local version ID from its stable UUID. Existing complete pins
-- are preserved, and the preflight above guarantees every joined mapping is
-- a released form of the expected appraisal category and rank.
WITH expected(id, appraisal_uuid, rank, form_version_uuid) AS (
  VALUES
    (2, '51954b26-851f-4ac7-a24e-fbfabf4618a8', '2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (3, '8308950e-4040-4ce1-8ef0-a8d1641de4db', 'Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
    (4, '4933f094-194b-4b95-9020-4d482c395d5b', '3rd Engineer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (5, 'bec61b88-a45c-4056-9cfe-106421f0615f', 'Electrical Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (6, '6598dfb6-83f6-4b7d-8d7f-f734103c79bc', 'Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
    (7, 'f32b30c7-edeb-42eb-93d2-4e874af264ae', '2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (8, 'bb27b8df-cf95-43f3-bbb9-a98888fd7d88', 'Master', '063e2175-3883-4e53-9718-1710ef2b2c97'),
    (9, '1fdb0002-1900-4f77-9f6d-0badc2045daf', 'Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
    (10, '9453680f-1517-4a21-aa33-7e5874349555', 'Chief Officer', '063e2175-3883-4e53-9718-1710ef2b2c97'),
    (11, '617d1174-7a8c-4957-ad02-d76ac211beba', '2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (12, 'b9b8bbf0-798c-494d-bc31-ac6e45d0d799', '2nd Officer', '66b509f5-7737-4ac7-8ff9-72896f1b91be'),
    (13, '10523bee-65c4-4cd4-a41b-d5ddd064c1b0', 'Deck Cadet', 'd0373db4-9f1a-43e0-b808-e900f4cc735a')
), resolved AS (
  SELECT expected.id, expected.appraisal_uuid, expected.form_version_uuid, v.id AS form_version_id
  FROM expected
  JOIN adm_form_versions_v2 v ON v.fv_uuid = expected.form_version_uuid
  JOIN adm_rank_groups_v2 rg ON rg.id = v.rank_group_id
  JOIN adm_forms_v2 f ON f.id = rg.form_id
  WHERE v.status = 'released'
    AND COALESCE(v.is_deleted, false) = false
    AND rg.archived_at IS NULL
    AND COALESCE(f.is_deleted, false) = false
    AND f.category = 'appraisal'
    AND EXISTS (
      SELECT 1
      FROM json_array_elements_text(rg.ranks::json) AS rank_item(rank_label)
      WHERE lower(trim(rank_item.rank_label)) = lower(trim(expected.rank))
    )
)
UPDATE appraisal_results_v2 result
SET form_version_id = resolved.form_version_id,
    form_version_uuid = resolved.form_version_uuid
FROM resolved
WHERE (
    (result.id = 2 AND result.appraisal_uuid = '51954b26-851f-4ac7-a24e-fbfabf4618a8') OR
    (result.id = 3 AND result.appraisal_uuid = '8308950e-4040-4ce1-8ef0-a8d1641de4db') OR
    (result.id = 4 AND result.appraisal_uuid = '4933f094-194b-4b95-9020-4d482c395d5b') OR
    (result.id = 5 AND result.appraisal_uuid = 'bec61b88-a45c-4056-9cfe-106421f0615f') OR
    (result.id = 6 AND result.appraisal_uuid = '6598dfb6-83f6-4b7d-8d7f-f734103c79bc') OR
    (result.id = 7 AND result.appraisal_uuid = 'f32b30c7-edeb-42eb-93d2-4e874af264ae') OR
    (result.id = 8 AND result.appraisal_uuid = 'bb27b8df-cf95-43f3-bbb9-a98888fd7d88') OR
    (result.id = 9 AND result.appraisal_uuid = '1fdb0002-1900-4f77-9f6d-0badc2045daf') OR
    (result.id = 10 AND result.appraisal_uuid = '9453680f-1517-4a21-aa33-7e5874349555') OR
    (result.id = 11 AND result.appraisal_uuid = '617d1174-7a8c-4957-ad02-d76ac211beba') OR
    (result.id = 12 AND result.appraisal_uuid = 'b9b8bbf0-798c-494d-bc31-ac6e45d0d799') OR
    (result.id = 13 AND result.appraisal_uuid = '10523bee-65c4-4cd4-a41b-d5ddd064c1b0')
  )
  AND result.id = resolved.id
  AND result.appraisal_uuid = resolved.appraisal_uuid
  AND result.form_version_id IS NULL
  AND result.form_version_uuid IS NULL;

WITH resolved AS (
  SELECT v.id AS form_version_id, v.fv_uuid AS form_version_uuid
  FROM adm_form_versions_v2 v
  JOIN adm_rank_groups_v2 rg ON rg.id = v.rank_group_id
  JOIN adm_forms_v2 f ON f.id = rg.form_id
  WHERE v.fv_uuid = 'ce5723f1-d8f5-4f2b-9fa1-a12e9d391a3d'
    AND v.status = 'released'
    AND COALESCE(v.is_deleted, false) = false
    AND rg.archived_at IS NULL
    AND COALESCE(f.is_deleted, false) = false
    AND f.category = 'promotion'
    AND EXISTS (
      SELECT 1
      FROM json_array_elements_text(rg.ranks::json) AS rank_item(rank_label)
      WHERE lower(trim(rank_item.rank_label)) = 'ab'
    )
)
UPDATE promotion_reviews_v2 result
SET form_version_id = resolved.form_version_id,
    form_version_uuid = resolved.form_version_uuid
FROM resolved
WHERE result.id = 134
  AND result.review_uuid = '35d776ba-b8b8-4aae-9a6c-e3fd6f08b767'
  AND result.form_version_id IS NULL
  AND result.form_version_uuid IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appraisal_results_v2_form_version_pin_pair_check'
      AND conrelid = 'appraisal_results_v2'::regclass
  ) THEN
    ALTER TABLE appraisal_results_v2
      ADD CONSTRAINT appraisal_results_v2_form_version_pin_pair_check
      CHECK ((form_version_id IS NULL) = (form_version_uuid IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appraisal_results_v2_submitted_form_version_pin_check'
      AND conrelid = 'appraisal_results_v2'::regclass
  ) THEN
    ALTER TABLE appraisal_results_v2
      ADD CONSTRAINT appraisal_results_v2_submitted_form_version_pin_check
      CHECK (
        lower(trim(status)) NOT IN (
          'preliminary', 'submitted', 'pending_review', 'stage2_submitted',
          'reviewed', 'stage3_submitted'
        )
        OR (form_version_id IS NOT NULL AND form_version_uuid IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_reviews_v2_form_version_pin_pair_check'
      AND conrelid = 'promotion_reviews_v2'::regclass
  ) THEN
    ALTER TABLE promotion_reviews_v2
      ADD CONSTRAINT promotion_reviews_v2_form_version_pin_pair_check
      CHECK ((form_version_id IS NULL) = (form_version_uuid IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_reviews_v2_submitted_form_version_pin_check'
      AND conrelid = 'promotion_reviews_v2'::regclass
  ) THEN
    ALTER TABLE promotion_reviews_v2
      ADD CONSTRAINT promotion_reviews_v2_submitted_form_version_pin_check
      CHECK (
        lower(trim(status)) NOT IN ('submitted', 'for approval', 'approved', 'completed')
        OR (form_version_id IS NOT NULL AND form_version_uuid IS NOT NULL)
      );
  END IF;
END $$;

COMMIT;