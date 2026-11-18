import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverCompanyFormTests } from "./verify-company-forms-tests.mjs";

const manifestUrl = new URL("../tests/manifests/company-forms.json", import.meta.url);

function add(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

const sorted = (values) => [...values].sort();
const sameFiles = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

export function checkFullRun(manifest, discovered, report) {
  const failures = [];
  const expected = Object.keys(manifest.suites);
  const expectedCount = Object.values(manifest.suites).reduce((n, names) => n + names.length, 0);
  let passed = 0;

  for (const name of expected.filter(file => !discovered.includes(file)))
    failures.push(`Manifest file no longer discovered: ${name}`);
  for (const name of discovered.filter(file => !Object.hasOwn(manifest.suites, file)))
    failures.push(`Discovered Company Forms file not in manifest: ${name}`);

  const run = report?.fullRun;
  const rows = report?.testResults;
  if (run?.version !== 1 || !run.full || !path.isAbsolute(run.root ?? "") ||
      !Array.isArray(run.discoveredFiles) || !run.discoveredFiles.length ||
      !Array.isArray(run.selectedFiles) || !sameFiles(run.discoveredFiles, run.selectedFiles) ||
      !["passed", "failed"].includes(run.reason) || !Array.isArray(run.unhandledErrors) ||
      !Array.isArray(rows)) {
    failures.push("A completed, unfiltered full npm test report with unhandled-error metadata is required.");
    return { failures, files: expected.length, tests: expectedCount, passed };
  }
  for (const [i, error] of run.unhandledErrors.entries())
    failures.push(`Unhandled run error ${i + 1}: ${error.name}`);

  const results = new Map();
  for (const row of rows) {
    if (typeof row?.name !== "string") {
      failures.push("Test report contains a result with no suite path.");
      continue;
    }
    const file = path.relative(run.root, path.resolve(run.root, row.name)).split(path.sep).join("/");
    add(results, file, row);
  }
  for (const [file, suites] of results)
    if (suites.length !== 1) failures.push(`Duplicate suite result: ${file}`);
  if (!sameFiles(results.keys(), run.discoveredFiles))
    failures.push("Result suite paths do not match the full run's discovered suite paths.");

  for (const file of expected) {
    const suite = results.get(file)?.[0];
    if (!suite) {
      failures.push(`Missing suite: ${file}`);
      continue;
    }
    if (suite.status !== "passed")
      failures.push(`Suite did not pass: ${file}${suite.message ? ` — ${suite.message}` : ""}`);
    const assertions = suite.assertionResults;
    if (!Array.isArray(assertions) || !assertions.length) {
      failures.push(`Empty or failed-to-load suite: ${file}`);
      continue;
    }
    const names = new Map();
    for (const name of manifest.suites[file]) names.set(name, (names.get(name) ?? 0) + 1);
    const found = new Map();
    for (const test of assertions) add(found, test.fullName, test.status);
    // Some parameterized cases share a full title, so the manifest is a
    // multiset, not a set. Each occurrence must independently pass.
    for (const [name, count] of names) {
      const statuses = found.get(name) ?? [];
      if (statuses.length < count)
        failures.push(`Missing test: ${file} :: ${name} (${statuses.length}/${count} occurrences)`);
      passed += Math.min(count, statuses.filter(status => status === "passed").length);
    }
    for (const [name, statuses] of found) {
      if (statuses.length > (names.get(name) ?? 0))
        failures.push(`Test not in manifest or extra occurrence: ${file} :: ${name}`);
      for (const status of statuses)
        if (status !== "passed") failures.push(`Test ${status ?? "has no status"}: ${file} :: ${name}`);
    }
  }
  return { failures, files: expected.length, tests: expectedCount, passed };
}

async function main() {
  const resultsPath = process.argv[2] ?? "test-results/results.json";
  const [manifest, report, discovered] = await Promise.all([
    fs.readFile(manifestUrl, "utf8").then(JSON.parse),
    fs.readFile(resultsPath, "utf8").then(JSON.parse),
    discoverCompanyFormTests(),
  ]);
  const { failures, files, tests, passed } = checkFullRun(manifest, discovered, report);
  if (failures.length) {
    console.error(`FAIL Company Forms full-run manifest: ${passed}/${tests} expected tests passed across ${files} expected suite files.`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS Company Forms full-run manifest: ${files} suite files, ${passed}/${tests} tests passed, 0 failed, 0 skipped, 0 unhandled errors.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch(error => {
    console.error(`FAIL Company Forms full-run manifest: ${error.message}`);
    process.exitCode = 1;
  });
}
