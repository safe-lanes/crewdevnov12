import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { discoverCompanyFormTests, checkCompanyFormResults } from "./verify-company-forms-tests.mjs";
const root = "generated-artifacts/training-slice6";
const full = JSON.parse(await fs.readFile(`${root}/full-suite.json`, "utf8"));
const baseline = JSON.parse(await fs.readFile("generated-artifacts/training-live-corrections/full-suite.json", "utf8"));
const files = await discoverCompanyFormTests();
const suites = full.testResults.filter(s => files.some(f => s.name.endsWith(`/${f}`)));
const assertions = suites.flatMap(s => s.assertionResults);
const area = { success: suites.every(s => s.status === "passed"), testResults: suites,
  numPendingTestSuites: suites.filter(s => s.status === "pending").length,
  numPendingTests: assertions.filter(t => ["pending", "skipped"].includes(t.status)).length,
  numTodoTests: assertions.filter(t => t.status === "todo").length };
const failures = result => result.testResults.flatMap(s => s.assertionResults.filter(t => t.status === "failed").map(t => t.fullName));
const before = new Set(failures(baseline)), after = new Set(failures(full));
const ts = await fs.readFile(`${root}/typescript.log`, "utf8");
const browser = JSON.parse(await fs.readFile(`${root}/browser-closing.json`, "utf8"));
const gates = { full: { passed: full.numPassedTests, failed: full.numFailedTests, pending: full.numPendingTests },
  companyForms: { suites: suites.length, passed: assertions.filter(t => t.status === "passed").length,
    pending: area.numPendingTests, failures: checkCompanyFormResults(files, area) },
  typescript: (ts.match(/error TS\d+/g) ?? []).length,
  newFailures: [...after].filter(name => !before.has(name)), resolvedFailures: [...before].filter(name => !after.has(name)),
  head: browser.head, commitTime: browser.commitTime, backendStart: browser.backendStart, backendPid: browser.pid,
  checks: browser.checks };
await fs.writeFile(`${root}/gates.json`, JSON.stringify(gates, null, 2));
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const titles = ["Unique suggestions and a target before expiry", "Confirmed through See Details",
  "Dismissed with a written reason", "Qualifying renewal completed in D3",
  "Automatic closure and the certificate used", "Generated and manual Training Needs"];
const images = await Promise.all(browser.screenshots.map(async (file, index) =>
  `<section><h2>${index + 1}. ${escape(titles[index] ?? file)}</h2><img src="data:image/png;base64,${(await fs.readFile(file)).toString("base64")}" alt="${escape(titles[index] ?? file)}"></section>`));
await fs.writeFile(`${root}/screenshots.html`, `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>Training Needs suggestions — main-preview evidence</title>
<style>body{margin:0;background:#eef2f6;color:#132b40;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}
section{background:white;padding:20px;margin:24px 0;border:1px solid #d6e0e8;border-radius:8px}img{width:100%;height:auto}code{overflow-wrap:anywhere}</style>
<main><h1>Training Needs suggestions</h1><p>Registered fixture-only vessel and seafarer. Office/Admin development persona 24:
normal persisted grant, ownership and scope checks; not a parent-login claim. Crewing Manager Create refusal also verified.
No grants or master expiry classifications changed. A pending renewal was prepared through the normal fixture D3 API,
then completed and saved through the D3 screen. New fixture descendants and append-only history remain registered.</p>
${browser.priorActionJourney ? `<p>The original clicked confirmation, dismissal and D3 Save journey was captured under
<code>${escape(browser.priorActionJourney.head)}</code>, backend started ${escape(browser.priorActionJourney.backendStart)}.
The closing replay reuses those retained records and history; it does not invent a second dismissal.</p>` : ""}
<p>HEAD <code>${escape(gates.head)}</code><br>Commit ${escape(gates.commitTime)}<br>
Backend PID ${gates.backendPid}, started ${escape(gates.backendStart)}</p>
<p>Full suite: ${gates.full.passed} passed / ${gates.full.failed} failed / ${gates.full.pending} pending.
Company Forms: ${gates.companyForms.passed} passed, ${gates.companyForms.pending} pending or skipped.
TypeScript: ${gates.typescript} diagnostics.</p><ul>${browser.checks.map(c => `<li>${escape(c)}</li>`).join("")}</ul>
${images.join("\n")}</main></html>`);
console.log(JSON.stringify(gates));
assert.ok(gates.full.failed <= 162 && gates.full.pending <= 67);
assert.ok(gates.companyForms.failures.length === 0 && gates.companyForms.pending === 0);
assert.ok(gates.typescript <= 222 && gates.newFailures.length === 0);
assert.ok(!browser.failure && browser.restoredOriginalCertificates);
assert.ok(Date.parse(browser.backendStart) > Date.parse(browser.commitTime));
