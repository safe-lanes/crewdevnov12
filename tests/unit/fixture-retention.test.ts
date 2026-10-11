import { afterAll, describe, expect, it } from "vitest";
import path from "node:path";
import pg from "pg";
import { cleanupOrigin } from "../helpers/fixture-retention";

describe("fixture retention cleanup classification", () => {
  it("recognises a direct cleanup hook", () => {
    expect(cleanupOrigin(`at hook (${path.resolve("tests/integration/api/obsolete-crew-assignment-paths.test.ts")}:46:7)`))
      .toBe("tests/integration/api/obsolete-crew-assignment-paths.test.ts");
  });
  it("keeps real constraint-refusal tests outside teardown", () => {
    expect(cleanupOrigin(`at test (${path.resolve("tests/integration/company-form-stage-persistence.test.ts")}:309:7)`))
      .toBeUndefined();
  });
});

afterAll(async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("DELETE FROM crew_assignments WHERE false");
    expect(result.command).toBe("RETAIN_FIXTURE");
  } finally {
    await pool.end();
  }
});
