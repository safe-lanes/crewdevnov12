import { sql } from "drizzle-orm";

// null preserves the existing rule for crew never reactivated.
export function employmentAfterReactivationOn(day: string, includeTerminationDay: boolean) {
  const comparison = includeTerminationDay ? sql.raw("<") : sql.raw("<=");
  return sql<boolean | null>`CASE WHEN EXISTS (
    SELECT 1 FROM crew_reactivations r
    WHERE r.crew_uuid = crew_members_v2.crew_uuid AND r.is_deleted = false
  ) THEN NOT EXISTS (
    SELECT 1 FROM (
      SELECT t.termination_date AS day,
             t.created_at AT TIME ZONE 'UTC' AS saved_at
      FROM crew_terminations t
      WHERE t.crew_uuid = crew_members_v2.crew_uuid AND t.is_deleted = false
      UNION ALL
      SELECT crew_members_v2.last_termination_date, '-infinity'::timestamptz
      WHERE NOT EXISTS (
        SELECT 1 FROM crew_terminations t
        WHERE t.crew_uuid = crew_members_v2.crew_uuid AND t.is_deleted = false
      )
    ) termination
    WHERE NULLIF(termination.day, '') IS NOT NULL
      AND termination.day ${comparison} ${day}
      AND (${!includeTerminationDay} OR termination.day >= crew_members_v2.recruitment_date)
      AND NOT EXISTS (
        SELECT 1 FROM crew_reactivations r
        WHERE r.crew_uuid = crew_members_v2.crew_uuid AND r.is_deleted = false
          AND to_char(r.reactivation_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') <= ${day}
          AND r.reactivation_date > COALESCE(termination.saved_at, '-infinity'::timestamptz)
      )
  ) ELSE NULL END`;
}
