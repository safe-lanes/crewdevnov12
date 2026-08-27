-- Numeric-scale endpoint descriptors belong to the option set, not option
-- labels. Keeping labels numeric preserves matrix eligibility for 7–12 point
-- scales while retaining the meaning of the low and high ends.
ALTER TABLE frm_option_sets
  ADD COLUMN IF NOT EXISTS low_end_label TEXT,
  ADD COLUMN IF NOT EXISTS high_end_label TEXT;

-- Conservative legacy migration:
-- only move descriptors when both endpoints follow "<numeric value> - <text>",
-- their prefixes match stored numeric values, and all interior labels already
-- match their values. Labels such as "1 -" deliberately remain untouched
-- because they do not carry a safely extractable descriptor.
WITH ranked_options AS (
  SELECT
    option_set_uuid,
    option_label,
    option_value,
    sort_order,
    id,
    ROW_NUMBER() OVER (PARTITION BY option_set_uuid ORDER BY sort_order, id) AS position,
    COUNT(*) OVER (PARTITION BY option_set_uuid) AS option_count
  FROM frm_options
  WHERE COALESCE(is_deleted, false) = false
),
candidate_sets AS (
  SELECT
    option_set_uuid,
    MAX(option_count) AS option_count,
    MAX(option_label) FILTER (WHERE position = 1) AS first_label,
    MAX(option_value) FILTER (WHERE position = 1) AS first_value,
    MAX(option_label) FILTER (WHERE position = option_count) AS last_label,
    MAX(option_value) FILTER (WHERE position = option_count) AS last_value,
    BOOL_AND(option_value ~ '^-?[0-9]+$') AS numeric_values,
    BOOL_AND(
      CASE
        WHEN position = 1 OR position = option_count THEN true
        ELSE option_label = option_value
      END
    ) AS plain_interior_labels
  FROM ranked_options
  GROUP BY option_set_uuid
),
extractable_sets AS (
  SELECT
    candidate_sets.option_set_uuid,
    first_match[2] AS low_end_label,
    last_match[2] AS high_end_label
  FROM candidate_sets
  CROSS JOIN LATERAL regexp_match(
    candidate_sets.first_label,
    '^(-?[0-9]+)[[:space:]]*-[[:space:]]*(.+)$'
  ) AS first_match
  CROSS JOIN LATERAL regexp_match(
    candidate_sets.last_label,
    '^(-?[0-9]+)[[:space:]]*-[[:space:]]*(.+)$'
  ) AS last_match
  WHERE candidate_sets.option_count >= 2
    AND candidate_sets.numeric_values
    AND candidate_sets.plain_interior_labels
    AND first_match[1] = candidate_sets.first_value
    AND last_match[1] = candidate_sets.last_value
)
UPDATE frm_option_sets AS sets
SET
  low_end_label = COALESCE(sets.low_end_label, extractable_sets.low_end_label),
  high_end_label = COALESCE(sets.high_end_label, extractable_sets.high_end_label),
  updated_at = NOW()
FROM extractable_sets
WHERE sets.option_set_uuid = extractable_sets.option_set_uuid
  AND COALESCE(sets.is_deleted, false) = false;

WITH ranked_options AS (
  SELECT
    option_set_uuid,
    option_label,
    option_value,
    sort_order,
    id,
    ROW_NUMBER() OVER (PARTITION BY option_set_uuid ORDER BY sort_order, id) AS position,
    COUNT(*) OVER (PARTITION BY option_set_uuid) AS option_count
  FROM frm_options
  WHERE COALESCE(is_deleted, false) = false
),
candidate_sets AS (
  SELECT
    option_set_uuid,
    MAX(option_count) AS option_count,
    MAX(option_label) FILTER (WHERE position = 1) AS first_label,
    MAX(option_value) FILTER (WHERE position = 1) AS first_value,
    MAX(option_label) FILTER (WHERE position = option_count) AS last_label,
    MAX(option_value) FILTER (WHERE position = option_count) AS last_value,
    BOOL_AND(option_value ~ '^-?[0-9]+$') AS numeric_values,
    BOOL_AND(
      CASE
        WHEN position = 1 OR position = option_count THEN true
        ELSE option_label = option_value
      END
    ) AS plain_interior_labels
  FROM ranked_options
  GROUP BY option_set_uuid
),
extractable_sets AS (
  SELECT candidate_sets.option_set_uuid
  FROM candidate_sets
  CROSS JOIN LATERAL regexp_match(
    candidate_sets.first_label,
    '^(-?[0-9]+)[[:space:]]*-[[:space:]]*(.+)$'
  ) AS first_match
  CROSS JOIN LATERAL regexp_match(
    candidate_sets.last_label,
    '^(-?[0-9]+)[[:space:]]*-[[:space:]]*(.+)$'
  ) AS last_match
  WHERE candidate_sets.option_count >= 2
    AND candidate_sets.numeric_values
    AND candidate_sets.plain_interior_labels
    AND first_match[1] = candidate_sets.first_value
    AND last_match[1] = candidate_sets.last_value
)
UPDATE frm_options AS options
SET
  option_label = options.option_value,
  updated_at = NOW()
FROM ranked_options
JOIN extractable_sets ON extractable_sets.option_set_uuid = ranked_options.option_set_uuid
WHERE options.id = ranked_options.id
  AND ranked_options.position IN (1, ranked_options.option_count);