import { describe, expect, it } from "vitest";
// @ts-expect-error Closing driver is deliberately plain Node JavaScript.
import { checkCompanyFormResults, discoverCompanyFormTests } from "../../scripts/verify-company-forms-tests.mjs";

describe("Company Forms closing test gate", () => {
  const name = "tests/unit/company-form-example.test.ts";
  const passed = () => ({
    success: true, numPendingTestSuites: 0, numPendingTests: 0,
    testResults: [{ name, status: "passed", assertionResults: [{ status: "passed" }] }],
  });
  it("accepts only an executed passing suite", () => {
    expect(checkCompanyFormResults([name], passed())).toEqual([]);
  });
  it("fails a missing or skipped suite even when the runner reports success", () => {
    expect(checkCompanyFormResults([name], { success: true, testResults: [] })).not.toEqual([]);
    expect(checkCompanyFormResults([name], { ...passed(), numPendingTestSuites: 1 })).not.toEqual([]);
  });
  it("fails a skipped test inside a passed suite", () => {
    const result = passed();
    result.testResults[0].assertionResults[0].status = "pending";
    expect(checkCompanyFormResults([name], result)).not.toEqual([]);
  });
  it("discovers authoring, renderer, lifecycle and every boundary suite", async () => {
    const files = await discoverCompanyFormTests();
    for (const file of [
      "tests/integration/api/company-form-versions.test.ts",
      "tests/integration/api/form-category-creation.test.ts",
      "tests/integration/form-option-set-migration.test.ts",
      "tests/integration/api/company-form-submission-boundary.test.ts",
      "tests/unit/company-form-submission-lifecycle-contracts.test.ts",
      "tests/unit/configured-form-renderer.test.tsx",
      "tests/unit/generic-form-editor-release.test.tsx",
    ]) expect(files).toContain(file);
    expect(new Set(files).size).toBe(files.length);
  });
});