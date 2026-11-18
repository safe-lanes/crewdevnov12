import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { checkFullRun } from "./verify-company-forms-full-run.mjs";

const scope = "tests/unit/expected.test.ts";
const outside = "tests/unit/outside.test.ts";
const title = "feature scenario handles a parameterized case";
const manifest = { version: 1, suites: { [scope]: [title, title] } };
const root = path.resolve("example-project");
const result = () => ({
  success: false, // Other areas may contain known baseline failures.
  fullRun: { version: 1, root, full: true, reason: "failed", unhandledErrors: [],
    discoveredFiles: [scope, outside], selectedFiles: [scope, outside] },
  testResults: [
    { name: path.join(root, scope), status: "passed",
      assertionResults: Array.from({ length: 2 }, () => ({ fullName: title, status: "passed" })) },
    { name: path.join(root, outside), status: "failed",
      assertionResults: [{ fullName: "outside baseline failure", status: "failed" }] },
  ],
});
const checked = (mutate, discovered = [scope]) => {
  const report = result();
  mutate?.(report);
  return checkFullRun(manifest, discovered, report);
};

test("accepts a complete full run without treating other areas' baseline failures as Company Forms failures", () => {
  assert.deepEqual(checked(), { failures: [], files: 1, tests: 2, passed: 2 });
});

for (const [label, mutate, message] of [
  ["dedicated JSON", r => delete r.fullRun, /unfiltered full npm test/],
  ["filtered report", r => { r.fullRun.full = false; }, /unfiltered full npm test/],
  ["interrupted report", r => { r.fullRun.reason = "interrupted"; }, /completed/],
  ["missing non-Company Forms suite", r => r.testResults.pop(), /discovered suite paths/],
  ["missing expected suite", r => r.testResults.shift(), /Missing suite/],
  ["empty expected suite", r => { r.testResults[0].assertionResults = []; }, /Empty or failed-to-load suite/],
  ["failed suite with passing assertions", r => { r.testResults[0].status = "failed"; }, /Suite did not pass/],
  ["missing duplicate title occurrence", r => r.testResults[0].assertionResults.pop(), /Missing test.*1\/2 occurrences/],
  ["failed test", r => { r.testResults[0].assertionResults[1].status = "failed"; }, /Test failed:.*feature scenario/],
  ["skipped test", r => { r.testResults[0].assertionResults[1].status = "skipped"; }, /Test skipped:.*feature scenario/],
  ["pending test", r => { r.testResults[0].assertionResults[1].status = "pending"; }, /Test pending:.*feature scenario/],
  ["todo test", r => { r.testResults[0].assertionResults[1].status = "todo"; }, /Test todo:.*feature scenario/],
  ["unexpected assertion", r => r.testResults[0].assertionResults.push({ fullName: "new case", status: "passed" }), /not in manifest/],
  ["unhandled error", r => r.fullRun.unhandledErrors.push({ name: "TypeError" }), /Unhandled run error 1: TypeError/],
]) {
  test(`rejects ${label}`, () => assert.match(checked(mutate).failures.join("\n"), message));
}

test("rejects silently added or removed manifest suites", () => {
  const mismatch = checked(undefined, ["tests/unit/new.test.ts"]).failures.join("\n");
  assert.match(mismatch, /Manifest file no longer discovered/);
  assert.match(mismatch, /Discovered Company Forms file not in manifest/);
});
