import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { discoverCompanyFormTests, checkCompanyFormResults } from "./verify-company-forms-tests.mjs";
const dir = "generated-artifacts/training-slice7";
const full = JSON.parse(await fs.readFile(`${dir}/full-suite.json`, "utf8"));
const baseline = JSON.parse(await fs.readFile("generated-artifacts/training-slice6/full-suite.json", "utf8"));
const browser = JSON.parse(await fs.readFile(`${dir}/browser-closing.json`, "utf8"));
const files = await discoverCompanyFormTests();
const suites = full.testResults.filter(suite => files.some(file => suite.name.endsWith(`/${file}`)));
const assertions = suites.flatMap(suite => suite.assertionResults);
const area = { success: suites.every(suite => suite.status === "passed"), testResults: suites,
  numPendingTestSuites: suites.filter(suite => suite.status === "pending").length,
  numPendingTests: assertions.filter(test => ["pending", "skipped"].includes(test.status)).length,
  numTodoTests: assertions.filter(test => test.status === "todo").length };
const failures = checkCompanyFormResults(files, area);
const failedNames = result => result.testResults.flatMap(suite =>
  suite.assertionResults.filter(test => test.status === "failed").map(test => test.fullName));
const old = new Set(failedNames(baseline)), current = new Set(failedNames(full));
const typescript = (await fs.readFile(`${dir}/typescript.log`, "utf8")).match(/error TS/g)?.length ?? 0;
const report = { head: browser.head, commitTime: browser.commitTime, backendStart: browser.backendStart, pid: browser.pid,
  full: { passed: full.numPassedTests, failed: full.numFailedTests, pending: full.numPendingTests },
  companyForms: { suites: suites.length, passed: assertions.filter(test => test.status === "passed").length,
    pending: area.numPendingTests, failures },
  typescript, newFailures: [...current].filter(name => !old.has(name)),
  resolvedFailures: [...old].filter(name => !current.has(name)),
  parity: browser.parity, checks: browser.checks, restored: browser.restoredTemporaryDatesAndLinks };
assert.ok(report.full.failed <= 162 && report.full.pending <= 67);
assert.equal(failures.length, 0); assert.ok(typescript <= 222);
assert.deepEqual(report.newFailures, []); assert.ok(!browser.error && report.restored);
assert.ok(Date.parse(report.backendStart) > Date.parse(report.commitTime));
await fs.writeFile(`${dir}/gates.json`, JSON.stringify(report, null, 2));
const escape = text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const captions = [
  "Missing mandatory: red outline. Before-relief: amber, with both reasons on hover.",
  "Touchscreen tap opens all reasons; matrix cells contain no status text.",
  "Crew-name click opens the shared details, with Today and Planned relief date.",
  "Reliever screen: same rank/dates/matrix/certificates, same engine results.",
  "No planned relief: the two-calendar-month fallback.",
  "Expiry not recorded: amber outline, no fill.",
];
const images = await Promise.all(browser.screenshots.map(async (path, i) =>
  `<figure><figcaption>${escape(captions[i] ?? path)}</figcaption><img alt="${escape(captions[i] ?? path)}" src="data:image/png;base64,${(await fs.readFile(path)).toString("base64")}"></figure>`));
await fs.writeFile(`${dir}/screenshots.html`, `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Vessel Training Matrix — slice 7 evidence</title>
<style>body{font:16px/1.5 system-ui,sans-serif;color:#163247;background:#f4f7fa;margin:auto;padding:24px;max-width:1400px}
section,figure{background:white;padding:20px;border:1px solid #dce4ea;border-radius:8px;margin:20px 0}img{width:100%;height:auto}
code{overflow-wrap:anywhere}figcaption{font-weight:650;margin-bottom:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
<h1>Vessel Training Matrix — slice 7</h1>
<section><h2>Closing runtime</h2><p>HEAD <code>${escape(report.head)}</code><br>
Commit: ${escape(report.commitTime)}<br>Backend start: ${escape(report.backendStart)}, PID ${escape(report.pid)}.</p>
<p>Full suite: ${report.full.passed} passed / ${report.full.failed} failed / ${report.full.pending} pending.
Company Forms: ${report.companyForms.passed} passed in ${report.companyForms.suites} suites, zero skipped/pending.
TypeScript: ${typescript}. No new test failures; the full suite is not green.</p>
<p>Main-preview screens use approved development office persona 24/Admin and real persisted permission/scope checks.
These are not normal parent-login evidence. No grants, masters, forms or matrix revisions changed.</p>
<p>Registered existing vessel, crew, on-board and reliever assignments are reused. An explicit synthetic captured-rank
fact is retained for the on-board fixture. Temporary certificate dates and planning links/dates are restored.
No fixture was deleted. The matrix issues no write request; only the existing reliever screen reconciles suggestions.</p></section>
<section><h2>Checks</h2><ul>${report.checks.map(text => `<li>${escape(text)}</li>`).join("")}</ul>
<h2>Identical engine inputs and results</h2><pre>${escape(JSON.stringify(report.parity, null, 2))}</pre>
<p>The display words differ appropriately: “Expires during contract” on the reliever screen means
“Expires before planned relief” on the on-board screen. The certificate choice and validity booleans match exactly.</p></section>
${images.join("")}</html>`);
console.log(JSON.stringify(report));
