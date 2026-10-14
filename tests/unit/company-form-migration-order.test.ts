import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("Company Forms migration safety", () => {
  it("uses explicit pre-run bootstrap context rather than seeded roles", () => {
    const runner = readFileSync("server/migrationRunner.ts", "utf8");
    expect(runner).toContain("const existingDatabase = appliedMigrations.size > 0");
    expect(runner).toContain("sail.permission_upgrade");
  });
  it("preserves later grants and leaves completed void off", () => {
    const migration = readFileSync("migrations/0234_company_form_permission_upgrade.sql", "utf8");
    expect(migration).toContain("'void_completed',false");
    expect(migration).toContain("ON CONFLICT (role_id,resource,action) DO NOTHING");
    expect(migration).toContain("'create_without_edit',c AND NOT e");
  });
});
