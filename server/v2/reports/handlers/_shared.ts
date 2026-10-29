import { z } from "zod";
import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

// Cast a text column to DATE, returning NULL for invalid values rather
// than raising. pg_input_is_valid (PG 16+) catches calendar errors like
// 2024-02-30 that a regex shape-check alone cannot.
export function dateExpr(textCol: PgColumn | SQL): SQL {
  return sql`CASE WHEN ${textCol} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' AND pg_input_is_valid(${textCol}, 'date') THEN ${textCol}::date ELSE NULL END`;
}

// Cast a text column to NUMERIC, returning NULL for anything that is not a
// plain decimal ('N/A', ' ', '3,5', 'NaN') so AVG skips it instead of the
// whole query failing. Dots are written [.] because the sql tag drops "\.".
export function numericExpr(textCol: PgColumn | SQL): SQL {
  return sql`CASE WHEN TRIM(${textCol}) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' THEN TRIM(${textCol})::numeric ELSE NULL END`;
}

// Display name for a vessel value that may be a master_vessels UUID (current
// writes) or a vessel name (older / synced rows). vessel_uuid is not unique,
// so pick one row (active, newest) instead of joining. Deleted vessels still
// resolve; an unknown value is shown as stored.
export function vesselNameExpr(vesselCol: PgColumn | SQL): SQL<string | null> {
  // Nested in its own sql`` so Drizzle keeps the table prefix. In a
  // single-table select it strips the prefix from top-level columns, and a
  // bare "vessel" in the subquery would bind to master_vessels.vessel.
  const ref = sql`${vesselCol}`;
  return sql<string | null>`COALESCE((
    SELECT NULLIF(master_vessels.vessel, '')
    FROM master_vessels
    WHERE master_vessels.vessel_uuid = ${ref}
    ORDER BY master_vessels.is_deleted ASC, master_vessels.id DESC
    LIMIT 1
  ), ${ref})`;
}

// Vessel filter for a UUID-or-name column: both sides are resolved to a name
// and compared case-insensitively, so a name or a UUID matches either kind of
// row (the Reports dropdown sends names).
export function vesselMatchCond(vesselCol: PgColumn | SQL, value: string): SQL {
  return sql`LOWER(TRIM(${vesselNameExpr(vesselCol)})) = LOWER(TRIM(${vesselNameExpr(sql`${value}`)}))`;
}

// Ship scoping for a UUID-or-name column: the row's vessel is one of the
// given UUIDs, or the name of one of them. Callers must handle an empty list.
export function vesselScopeCond(vesselCol: PgColumn | SQL, vesselUuids: string[]): SQL {
  const ids = sql.join(vesselUuids.map((id) => sql`${id}`), sql`, `);
  return sql`(${vesselCol} IN (${ids}) OR LOWER(TRIM(${vesselCol})) IN (
    SELECT LOWER(TRIM(master_vessels.vessel))
    FROM master_vessels
    WHERE master_vessels.vessel_uuid IN (${ids})
  ))`;
}

export const dateFilter = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date")
  .optional();

// A crew member counts as still on board until an actual sign-off date is
// recorded. Some flows (e.g. confirming a relief in Planning) write an empty
// string into sign_off_date, so treat '' the same as NULL.
export function noSignOffExpr(signOffCol: PgColumn | SQL): SQL {
  return sql`NULLIF(${signOffCol}, '') IS NULL`;
}

export function fullNameExpr(
  first: PgColumn | SQL,
  middle: PgColumn | SQL,
  family: PgColumn | SQL,
): SQL<string> {
  return sql<string>`TRIM(BOTH ' ' FROM CONCAT_WS(' ', NULLIF(${first}, ''), NULLIF(${middle}, ''), NULLIF(${family}, '')))`;
}
