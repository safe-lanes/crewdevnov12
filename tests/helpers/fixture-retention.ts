import fs from "node:fs";

/**
 * Compatibility name for existing suites: record disposable test provenance
 * in ignored test logs only. This does NOT retain data or intercept teardown.
 * Main-preview acceptance registration is deliberately separate.
 */
export function retainFixtureReferences(origin: string, references: unknown[]) {
  if (process.env.TEST_DATABASE_VERIFIED !== "true")
    throw new Error("Automated fixture tracking requires verified test isolation.");
  fs.mkdirSync("test-logs", { recursive: true });
  fs.appendFileSync("test-logs/fixture-contexts.jsonl",
    JSON.stringify({ origin, references, recordedAt: new Date().toISOString() }) + "\n");
}
