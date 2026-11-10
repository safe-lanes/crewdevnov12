-- PRD-09: one live criteria-status row per review and criteria code.
-- New rows get a uuid derived from review + code, so ship and office make the
-- same row. This index makes a second live row for the same pair impossible.

-- Keep the most recently updated live row of any pair that already has more.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY review_uuid, criteria_code
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM promo_criteria_status_v2
  WHERE is_deleted = false
)
UPDATE promo_criteria_status_v2 cs
SET is_deleted = true
FROM ranked
WHERE cs.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_criteria_status_v2_review_code
  ON promo_criteria_status_v2 (review_uuid, criteria_code)
  WHERE is_deleted = false;
