import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getTableName } from "drizzle-orm";
import { APPRAISAL_CHILD_TABLES } from "@server/v2/appraisals/repositories/childRowSync";

// APD-45: every read, save and delete of an appraisal fetches its child rows
// by appraisal_uuid, and the sync gathers children through the same join.
// The 10 tables from 0093 had no index on it (only appr_reviewers_v2 did,
// from 0179), so each read scanned the whole table. 0271 adds the rest.

const migration = (file: string) =>
  readFileSync(join(__dirname, "../../migrations", file), "utf-8");

describe("APD-45 appraisal child tables are indexed on appraisal_uuid", () => {
  const sql0271 = migration("0271_appraisal_child_appraisal_uuid_index.sql");
  const sql0179 = migration("0179_add_appr_reviewers_v2.sql");

  // The table names listed in 0271's ARRAY[...].
  const tablesIn0271 = [...sql0271.match(/ARRAY\[([\s\S]*?)\]/)![1].matchAll(/'([a-z0-9_]+)'/g)]
    .map((m) => m[1]);

  it("0271 creates an appraisal_uuid index for each listed table", () => {
    expect(sql0271).toMatch(
      /CREATE INDEX IF NOT EXISTS %I ON %I \(appraisal_uuid\)',\s*'idx_' \|\| child_table \|\| '_appraisal_uuid'/,
    );
    expect(new Set(tablesIn0271).size).toBe(tablesIn0271.length);
  });

  it("covers every child table, with appr_reviewers_v2 left to 0179", () => {
    expect(sql0179).toContain(
      "idx_appr_reviewers_v2_appraisal_uuid ON appr_reviewers_v2 (appraisal_uuid)",
    );
    const indexed = [...tablesIn0271, "appr_reviewers_v2"].sort();
    const children = APPRAISAL_CHILD_TABLES.map((t) => getTableName(t)).sort();

    expect(indexed).toEqual(children);
  });
});
