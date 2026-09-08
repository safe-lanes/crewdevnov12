-- Enforce the appraisal and promotion form-version pin contract.
-- Backfill date: 21-Aug-2026, revised 08-Sep-2026. Backfills the known-approved
-- pre-pinning development records where present (partial matches allowed, no
-- longer treated as an error). Constraints are added NOT VALID: enforced on
-- every new/updated row from now on, without requiring every tenant's
-- pre-existing historical data to already comply before the tenant can connect.

BEGIN;

-- Backfill whichever of the known-approved appraisal rows exist. Match both
-- listed numeric IDs and immutable record UUIDs so unrelated tenant rows
-- sharing a serial ID can never be changed by this migration. Rows that don't
-- match are left untouched — no longer treated as a blocking error.
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
WHERE result.id = resolved.id
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

-- Add the pin-contract constraints NOT VALID: enforced on every new/updated
-- row from this point on, without requiring pre-existing rows (on this or any
-- other tenant) to already comply. Historical unpinned rows become a
-- follow-up data-quality item to review per tenant, never a connection blocker.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appraisal_results_v2_form_version_pin_pair_check'
      AND conrelid = 'appraisal_results_v2'::regclass
  ) THEN
    ALTER TABLE appraisal_results_v2
      ADD CONSTRAINT appraisal_results_v2_form_version_pin_pair_check
      CHECK ((form_version_id IS NULL) = (form_version_uuid IS NULL)) NOT VALID;
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
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_reviews_v2_form_version_pin_pair_check'
      AND conrelid = 'promotion_reviews_v2'::regclass
  ) THEN
    ALTER TABLE promotion_reviews_v2
      ADD CONSTRAINT promotion_reviews_v2_form_version_pin_pair_check
      CHECK ((form_version_id IS NULL) = (form_version_uuid IS NULL)) NOT VALID;
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
      ) NOT VALID;
  END IF;
END $$;

COMMIT;