-- Migration: PRD-02 - an A3 training comment points at its training by the
-- training's tn_uuid.
--
-- Background: the promotion form used to number training rows with a counter
-- ("1", "2", ...) and saved each comment under that number in
-- promo_training_comments_v2.training_row_id. The same numbers repeat on every
-- server and come back after a row is deleted, so a comment could end up under
-- another training. The form now uses the training's tn_uuid as its id
-- (PRD-02), so the stored counters must become tn_uuids.
--
-- For each comment whose training_row_id is not already a tn_uuid of its
-- review, take the training of the same review with that counter: the live
-- row first, then the lowest id. A comment with no such training keeps its
-- value (the GET maps it the same way, so nothing is lost). updated_at is
-- stamped so the sync picks the change up. Running it again changes nothing.

UPDATE promo_training_comments_v2 AS tc
SET training_row_id = m.tn_uuid,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (c.id) c.id AS comment_id, tn.tn_uuid
  FROM promo_training_comments_v2 AS c
  JOIN promo_training_needs_v2 AS tn
    ON tn.review_uuid = c.review_uuid
   AND tn.training_row_id = c.training_row_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM promo_training_needs_v2 AS t
    WHERE t.review_uuid = c.review_uuid
      AND t.tn_uuid = c.training_row_id
  )
  ORDER BY c.id, COALESCE(tn.is_deleted, false) ASC, tn.id ASC
) AS m
WHERE tc.id = m.comment_id;
