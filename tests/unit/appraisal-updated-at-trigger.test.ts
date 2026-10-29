import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getTableName } from "drizzle-orm";
import { appraisalResultsV2 } from "@shared/v2/appraisals/schema";
import { APPRAISAL_CHILD_TABLES } from "@server/v2/appraisals/repositories/childRowSync";

// APD-46: updated_at must change on every update, because the sync uses it to
// tell which rows changed. 0150 stamps it with a trigger, but only on tables
// that existed when it ran, so appr_reviewers_v2 (0179) never got one. 0272
// puts 0150's trigger on every appraisal table.

const migration = (file: string) =>
  readFileSync(join(__dirname, "../../migrations", file), "utf-8").replace(/\r\n/g, "\n");

// The CREATE OR REPLACE FUNCTION public.set_updated_at() statement.
const setUpdatedAtFunction = (sql: string) =>
  sql.match(/CREATE OR REPLACE FUNCTION public\.set_updated_at\(\)[\s\S]*?SET search_path = pg_catalog, public;/)?.[0];

describe("APD-46 every appraisal table stamps updated_at on update", () => {
  const sql0272 = migration("0272_appraisal_updated_at_triggers.sql");
  const sql0150 = migration("0150_add_updated_at_triggers.sql");

  // The table names listed in 0272's ARRAY[...].
  const tablesIn0272 = [...sql0272.match(/ARRAY\[([\s\S]*?)\]/)![1].matchAll(/'([a-z0-9_]+)'/g)]
    .map((m) => m[1]);

  it("installs 0150's function unchanged", () => {
    // 0272 replaces the shared function on every database, so a changed copy
    // would change updated_at for every module's tables, not just appraisals.
    expect(setUpdatedAtFunction(sql0272)).toBeDefined();
    expect(setUpdatedAtFunction(sql0272)).toBe(setUpdatedAtFunction(sql0150));
  });

  it("creates 0150's trigger, under 0150's name, for each listed table", () => {
    expect(sql0272).toContain("trigger_name := 'trg_' || appraisal_table || '_updated_at';");
    expect(sql0272).toContain(
      "'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()'",
    );
    expect(new Set(tablesIn0272).size).toBe(tablesIn0272.length);
  });

  it("covers appraisal_results_v2 and every child table", () => {
    const appraisalTables = [appraisalResultsV2, ...APPRAISAL_CHILD_TABLES]
      .map((t) => getTableName(t))
      .sort();

    expect([...tablesIn0272].sort()).toEqual(appraisalTables);
  });
});
