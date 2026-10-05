// Closing gate: discover every Company Forms/submission test, never a hand-picked list.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function discoverCompanyFormTests(directory = "tests") {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await discoverCompanyFormTests(name));
    else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) {
      const content = await fs.readFile(name, "utf8");
      if (/company[-_]?form|submission|configured-form|generic-form-editor|form-(?:category-creation|option-set-migration)/i.test(name) ||
        /(?:company-forms\/|forms-engine\/|configured-form\/|GenericFormEditor|OnBoardStatusEditDialog_v2|\/(?:formsService|formsRepository|formStructureService|formStructureRepository)["'])/.test(content) ||
        // A Promotions E2E test merely mocks the standard-form picker endpoint;
        // that is not Company Forms/submission coverage. Direct authoring API
        // integration tests are, even without importing the service.
        (!name.startsWith("tests/e2e/") && content.includes("/api/v2/admin/forms"))) {
        files.push(name);
      }
    }
  }
  return files.sort();
}

export function checkCompanyFormResults(files, result) {
  const failures = [];
  if (!result.success) failures.push("Vitest reported failure");
  if (result.numPendingTestSuites || result.numPendingTests || result.numTodoTests) {
    failures.push("Skipped/pending/todo suites or tests are failures");
  }
  for (const file of files) {
    const suite = result.testResults?.find(s => path.resolve(s.name) === path.resolve(file));
    if (!suite) failures.push(`Missing suite: ${file}`);
    else if (suite.status !== "passed" || !suite.assertionResults?.length ||
      suite.assertionResults.some(test => test.status !== "passed")) {
      failures.push(`Failed, empty or skipped suite/test: ${file}`);
    }
  }
  return failures;
}

export async function runCompanyFormTests() {
  const files = await discoverCompanyFormTests();
  if (!files.length) throw Error("No Company Forms/submission tests discovered");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = `.local/verification/company-forms-all-tests-${stamp}`;
  await fs.mkdir(".local/verification", { recursive: true });
  const report = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    startedAt: new Date().toISOString(), files,
    resultsPath: `${prefix}.vitest.json`, logPath: `${prefix}.log`,
  };
  // Serialize DB suites: their isolated fixture writes still share master tables.
  const run = spawnSync("npx", ["vitest", "run", ...files, "--no-file-parallelism",
    "--reporter=verbose", "--reporter=json", `--outputFile.json=${report.resultsPath}`],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  await fs.writeFile(report.logPath, (run.stdout ?? "") + (run.stderr ?? ""));
  const results = await fs.readFile(report.resultsPath, "utf8").then(JSON.parse).catch(() => null);
  report.failures = results ? checkCompanyFormResults(files, results) : ["Missing Vitest results"];
  if (run.error || run.status !== 0) report.failures.push(String(run.error ?? `Vitest exit ${run.status}`));
  report.finishedAt = new Date().toISOString();
  report.totalSuites = files.length;
  report.totalTests = results?.numTotalTests ?? 0;
  report.passedTests = results?.numPassedTests ?? 0;
  report.skippedTests = results?.numPendingTests ?? 0;
  report.passed = !report.failures.length;
  report.reportPath = `${prefix}.json`;
  await fs.writeFile(report.reportPath, JSON.stringify(report, null, 2));
  await fs.writeFile(".local/verification/company-forms-all-tests.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) throw Error(`Company Forms closing test gate failed: ${report.reportPath}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCompanyFormTests();
}