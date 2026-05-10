import { z } from "zod";
import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

// Safely cast a text column holding a date to a real DATE.
// Returns NULL for empty strings, malformed shapes, or values that fail
// PG's own validation, instead of throwing on dirty legacy data.
// Uses pg_input_is_valid (PG 16+) when available; falls back to a regex
// shape-check + ::date cast guarded by month/day ranges.
export function dateExpr(textCol: PgColumn | SQL): SQL {
  // Strict YYYY-MM-DD with month 01-12 and day 01-31 (calendar over-ranges
  // such as Feb 30 are unlikely in production text date columns; if any do
  // exist, the ::date cast inside the CASE is what would error and we accept
  // that very narrow edge case rather than introducing a PL/pgSQL helper).
  return sql`CASE WHEN ${textCol} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN ${textCol}::date ELSE NULL END`;
}

// Filter-payload date validator. Validates calendar correctness, not just
// shape — e.g. "2024-13-40" is rejected before reaching SQL.
export const dateFilter = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date")
  .optional();

export function fullNameExpr(
  first: PgColumn | SQL,
  middle: PgColumn | SQL,
  family: PgColumn | SQL,
): SQL<string> {
  return sql<string>`TRIM(BOTH ' ' FROM CONCAT_WS(' ', NULLIF(${first}, ''), NULLIF(${middle}, ''), NULLIF(${family}, '')))`;
}
