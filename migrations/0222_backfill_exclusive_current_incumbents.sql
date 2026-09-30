-- Forward-only, auditable backfill requested for existing onboard crews.
-- A matching crew/vessel alone does not prove voyage ownership; require an
-- exclusive current OnBoard candidate, the same sign-on date, and no other
-- active planning owner. Ambiguous records stay unlinked for human review.
LOCK TABLE vessel_planning_v2, crew_assignments IN SHARE ROW EXCLUSIVE MODE;

WITH candidates AS (
  SELECT p.plan_uuid, p.crew_uuid, p.vessel_uuid, p.sign_on_date,
         min(a.assign_uuid) AS assign_uuid, count(a.assign_uuid) AS match_count
  FROM vessel_planning_v2 p
  LEFT JOIN crew_assignments a
    ON a.crew_uuid = p.crew_uuid AND a.vessel_uuid = p.vessel_uuid
   AND a.assignment_type = 'OnBoard' AND a.is_current = true
   AND a.is_deleted = false
  WHERE p.crew_uuid IS NOT NULL AND p.crew_assign_uuid IS NULL
    AND p.is_deleted = false AND p.is_archived = false
  GROUP BY p.plan_uuid, p.crew_uuid, p.vessel_uuid, p.sign_on_date
), eligible AS (
  SELECT c.*
  FROM candidates c
  JOIN crew_assignments a ON a.assign_uuid = c.assign_uuid
  WHERE c.match_count = 1
    AND c.sign_on_date IS NOT DISTINCT FROM a.sign_on_date
    AND NOT EXISTS (
      SELECT 1 FROM candidates sibling
      WHERE sibling.plan_uuid <> c.plan_uuid AND sibling.assign_uuid = c.assign_uuid
    )
    AND NOT EXISTS (
      SELECT 1 FROM vessel_planning_v2 owner
      WHERE owner.plan_uuid <> c.plan_uuid AND owner.is_deleted = false
        AND owner.is_archived = false
        AND (owner.crew_assign_uuid = c.assign_uuid
          OR owner.reliever_assign_uuid = c.assign_uuid)
    )
), linked AS (
  UPDATE vessel_planning_v2 p SET crew_assign_uuid = e.assign_uuid,
    updated_at = now()
  FROM eligible e
  WHERE p.plan_uuid = e.plan_uuid AND p.crew_assign_uuid IS NULL
  RETURNING p.plan_uuid, p.crew_uuid, p.vessel_uuid, p.crew_assign_uuid
)
INSERT INTO vessel_planning_assignment_reconciliations
  (plan_uuid, crew_uuid, vessel_uuid, assign_uuid, reviewed_by, evidence_note)
SELECT l.plan_uuid, l.crew_uuid, l.vessel_uuid, l.crew_assign_uuid,
  'SYSTEM:exclusive-incumbent-backfill',
  'Automated backfill: sole current, non-deleted OnBoard assignment for this crew and vessel; matching sign-on date; no other active planning owner. Not an administrator-reviewed voyage document.'
FROM linked l;

DO $$
DECLARE row_to_review record;
BEGIN
  FOR row_to_review IN
    WITH unmatched AS (
      SELECT p.plan_uuid, p.sign_on_date, min(a.assign_uuid) AS assign_uuid,
        min(a.sign_on_date) AS assignment_sign_on_date,
        count(a.assign_uuid) AS match_count
      FROM vessel_planning_v2 p LEFT JOIN crew_assignments a
        ON a.crew_uuid = p.crew_uuid AND a.vessel_uuid = p.vessel_uuid
        AND a.assignment_type = 'OnBoard' AND a.is_current = true
        AND a.is_deleted = false
      WHERE p.crew_uuid IS NOT NULL AND p.crew_assign_uuid IS NULL
        AND p.is_deleted = false AND p.is_archived = false
      GROUP BY p.plan_uuid, p.sign_on_date
    )
    SELECT c.plan_uuid,
      CASE
        WHEN c.match_count = 0 THEN 'no current OnBoard assignment for crew/vessel'
        WHEN c.match_count > 1 THEN 'multiple current OnBoard assignments for crew/vessel'
        WHEN c.sign_on_date IS DISTINCT FROM c.assignment_sign_on_date THEN 'sign-on dates disagree'
        WHEN EXISTS (
          SELECT 1 FROM vessel_planning_v2 other
          WHERE other.plan_uuid <> c.plan_uuid AND other.is_deleted = false
            AND other.is_archived = false
            AND (other.crew_assign_uuid = c.assign_uuid
              OR other.reliever_assign_uuid = c.assign_uuid)
        ) THEN 'assignment already owned by another active planning row'
        ELSE 'assignment shared by another unlinked planning row'
      END AS reason
    FROM unmatched c
  LOOP
    RAISE NOTICE 'Incumbent planning % left unlinked: %',
      row_to_review.plan_uuid, row_to_review.reason;
  END LOOP;
END $$;