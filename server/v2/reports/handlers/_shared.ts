import { z } from "zod";
import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

// Cast a text column to DATE, returning NULL for invalid values rather
// than raising. pg_input_is_valid (PG 16+) catches calendar errors like
// 2024-02-30 that a regex shape-check alone cannot.
export function dateExpr(textCol: PgColumn | SQL): SQL {
  return sql`CASE WHEN ${textCol} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' AND pg_input_is_valid(${textCol}, 'date') THEN ${textCol}::date ELSE NULL END`;
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

export function fullNameExpr(
  first: PgColumn | SQL,
  middle: PgColumn | SQL,
  family: PgColumn | SQL,
): SQL<string> {
  return sql<string>`TRIM(BOTH ' ' FROM CONCAT_WS(' ', NULLIF(${first}, ''), NULLIF(${middle}, ''), NULLIF(${family}, '')))`;
}
