import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import fs from "node:fs";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
describe("ordinary isolated fixture teardown", () => {
  it("records references without changing the development acceptance register", () => {
    const before = fs.readFileSync("docs/company-form-regression-fixtures.md", "utf8");
    retainFixtureReferences("isolated regression", ["synthetic-reference"]);
    expect(fs.readFileSync("docs/company-form-regression-fixtures.md", "utf8")).toBe(before);
  });
  it("allows real cleanup SQL, including DELETE and DROP", async () => {
    await pool.query("CREATE TABLE isolated_cleanup_probe(id int)");
    await pool.query("INSERT INTO isolated_cleanup_probe VALUES(1)");
    const deletion = await pool.query("DELETE FROM isolated_cleanup_probe");
    expect(deletion.command).toBe("DELETE");
    expect(deletion.rowCount).toBe(1);
    await pool.query("DROP TABLE isolated_cleanup_probe");
    expect((await pool.query("SELECT to_regclass('isolated_cleanup_probe') AS table_name")).rows[0].table_name).toBeNull();
  });
});
afterAll(async () => { await pool.end(); });
