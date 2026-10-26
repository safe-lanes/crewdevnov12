import fs from "node:fs/promises";
import { discoverCompanyFormTests, checkCompanyFormResults } from "./verify-company-forms-tests.mjs";
const root = "generated-artifacts/training-slice5";
const full = JSON.parse(await fs.readFile(`${root}/full-suite.json`, "utf8"));
const baseline = JSON.parse(await fs.readFile("generated-artifacts/training-slice4-adjustments/full-suite.json", "utf8"));
const files = await discoverCompanyFormTests();
const suites = full.testResults.filter(s => files.some(f => s.name.endsWith(`/${f}`)));
const assertions = suites.flatMap(s => s.assertionResults);
const area = {
  success: suites.every(s => s.status === "passed"),
  testResults: suites,
  numPendingTestSuites: suites.filter(s => s.status === "pending").length,
  numPendingTests: assertions.filter(t => t.status === "pending" || t.status === "skipped").length,
  numTodoTests: assertions.filter(t => t.status === "todo").length,
};
const failures = result => result.testResults.flatMap(s => s.assertionResults.filter(t => t.status === "failed").map(t => t.fullName));
const previous = new Set(failures(baseline)), current = new Set(failures(full));
const ts = await fs.readFile(`${root}/typescript.log`, "utf8");
const report = {
  full: { passed: full.numPassedTests, failed: full.numFailedTests, pending: full.numPendingTests },
  companyForms: { suites: files.length, tests: assertions.length, passed: assertions.filter(t => t.status === "passed").length,
    pending: area.numPendingTests, skipped: assertions.filter(t => t.status === "skipped").length,
    failures: checkCompanyFormResults(files, area) },
  typescript: (ts.match(/error TS\d+/g) ?? []).length,
  newFailures: [...current].filter(name => !previous.has(name)),
  resolvedFailures: [...previous].filter(name => !current.has(name)),
};
await fs.writeFile(`${root}/gates.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.full.failed > 162 || report.full.pending > 67 || report.typescript > 222 ||
    report.companyForms.failures.length || report.newFailures.length) process.exitCode = 1;
