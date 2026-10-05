// Full configured Vitest inventory; inherited failures are reported, never called a pass.
import fs from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

async function inventory(dir = "tests") {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (file === "tests/e2e") continue;
    if (entry.isDirectory()) files.push(...await inventory(file));
    else if (/\.(test|spec)\.tsx?$/.test(file)) files.push(file);
  }
  return files.sort();
}
const files = await inventory();
const root = `.local/verification/stage-popups-suite-${new Date().toISOString().replace(/[:.]/g, "-")}`;
await fs.mkdir(root, { recursive: true });
const startedAt = new Date().toISOString();
const run = spawnSync("npx", ["vitest", "run", "--no-file-parallelism",
  "--reporter=verbose", "--reporter=json", `--outputFile.json=${root}/vitest.json`],
{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
await fs.writeFile(`${root}/run.log`, (run.stdout ?? "") + (run.stderr ?? ""));
const result = JSON.parse(await fs.readFile(`${root}/vitest.json`, "utf8"));
const missingOrEmpty = files.filter(file => {
  const suite = result.testResults.find(s => path.resolve(s.name) === path.resolve(file));
  return !suite?.assertionResults.length;
});
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  startedAt, finishedAt: new Date().toISOString(), command: "npx vitest run --no-file-parallelism",
  baselineHead: "37967ecd1aa30f1e3000ccd4d3a951fcf5079130",
  ceiling: { failed: 162, pending: 67 }, files: files.length,
  total: result.numTotalTests, passed: result.numPassedTests,
  failed: result.numFailedTests, pending: result.numPendingTests,
  exit: run.status, missingOrEmpty, resultPath: `${root}/vitest.json`, logPath: `${root}/run.log`,
  withinBaseline: !run.error && run.status === 1 && !missingOrEmpty.length &&
    result.numFailedTests <= 162 && result.numPendingTests <= 67 && !result.numTodoTests,
};
// A genuinely green run is also valid.
if (!run.error && run.status === 0 && result.success && !missingOrEmpty.length) report.withinBaseline = true;
await fs.writeFile(`${root}/report.json`, JSON.stringify(report, null, 2));
await fs.writeFile(".local/verification/stage-popups-repository-suite.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.withinBaseline) process.exitCode = 1;