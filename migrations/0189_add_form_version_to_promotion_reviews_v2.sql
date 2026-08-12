-- Task 334: pin promotion reviews to a form version (same pattern as appraisal_results_v2)
ALTER TABLE promotion_reviews_v2 ADD COLUMN IF NOT EXISTS form_version_id INTEGER;
ALTER TABLE promotion_reviews_v2 ADD COLUMN IF NOT EXISTS form_version_uuid TEXT;

-- One-time backfill: stamp every existing non-deleted review with the CURRENT
-- latest released version of its rank group (visually a no-op today; protects
-- them from all future releases).
UPDATE promotion_reviews_v2 pr
SET form_version_id = fv.id,
    form_version_uuid = fv.fv_uuid
FROM adm_form_versions_v2 fv
WHERE pr.form_version_id IS NULL
  AND pr.is_deleted = false
  AND fv.id = (
    SELECT v.id
    FROM adm_form_versions_v2 v
    JOIN adm_rank_groups_v2 rg ON rg.id = v.rank_group_id
    JOIN adm_forms_v2 f ON f.id = rg.form_id AND f.category = 'promotion'
    WHERE v.status = 'released' AND v.is_deleted = false
      AND rg.archived_at IS NULL
      AND rg.ranks IS NOT NULL AND rg.ranks LIKE '[%'
      AND EXISTS (
        SELECT 1 FROM json_array_elements_text(rg.ranks::json) r(rank)
        WHERE lower(trim(r.rank)) = lower(trim(pr.promotion_to_rank))
      )
    ORDER BY NULLIF(regexp_replace(v.version_no, '\D', '', 'g'), '')::int DESC NULLS LAST
    LIMIT 1
  );
