-- Backfill initial released v01 form versions for active rank groups that
-- already have a configuration but no released version in adm_form_versions_v2.
-- Idempotent: only inserts when no released version exists for the rank group.
INSERT INTO adm_form_versions_v2 (
  fv_uuid,
  form_id,
  rank_group_id,
  version_no,
  version_date,
  status,
  configuration,
  released_at,
  created_at,
  updated_at,
  is_deleted
)
SELECT
  gen_random_uuid()::text,
  rg.form_id,
  rg.id,
  '01',
  to_char(NOW(), 'DD-Mon-YYYY'),
  'released',
  rg.configuration,
  NOW(),
  NOW(),
  NOW(),
  FALSE
FROM adm_rank_groups_v2 rg
WHERE rg.is_deleted = FALSE
  AND rg.archived_at IS NULL
  AND rg.configuration IS NOT NULL
  AND length(trim(rg.configuration)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM adm_form_versions_v2 fv
    WHERE fv.rank_group_id = rg.id
      AND fv.status = 'released'
      AND fv.is_deleted = FALSE
  );

-- Sync parent form's version_no / version_date with the latest released version
-- per form (highest numeric version_no). Idempotent.
UPDATE adm_forms_v2 f
SET
  version_no = sub.version_no,
  version_date = sub.version_date,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (fv.form_id)
    fv.form_id,
    fv.version_no,
    fv.version_date
  FROM adm_form_versions_v2 fv
  WHERE fv.status = 'released'
    AND fv.is_deleted = FALSE
  ORDER BY fv.form_id,
           NULLIF(regexp_replace(fv.version_no, '\D', '', 'g'), '')::int DESC NULLS LAST,
           fv.released_at DESC NULLS LAST
) sub
WHERE f.id = sub.form_id
  AND f.is_deleted = FALSE
  AND (
    f.version_no IS DISTINCT FROM sub.version_no
    OR f.version_date IS DISTINCT FROM sub.version_date
  );
