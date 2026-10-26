import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { discoverCompanyFormTests, checkCompanyFormResults } from "./verify-company-forms-tests.mjs";

const root = "generated-artifacts/training-live-corrections";
const full = JSON.parse(await fs.readFile(`${root}/full-suite.json`, "utf8"));
const baseline = JSON.parse(await fs.readFile("generated-artifacts/training-slice5/full-suite.json", "utf8"));
const files = await discoverCompanyFormTests();
const suites = full.testResults.filter(s => files.some(f => s.name.endsWith(`/${f}`)));
const assertions = suites.flatMap(s => s.assertionResults);
const area = { success: suites.every(s => s.status === "passed"), testResults: suites,
  numPendingTestSuites: suites.filter(s => s.status === "pending").length,
  numPendingTests: assertions.filter(t => ["pending", "skipped"].includes(t.status)).length,
  numTodoTests: assertions.filter(t => t.status === "todo").length };
const failureNames = result => result.testResults.flatMap(s => s.assertionResults.filter(t => t.status === "failed").map(t => t.fullName));
const previous = new Set(failureNames(baseline)), current = new Set(failureNames(full));
const ts = await fs.readFile(`${root}/typescript.log`, "utf8");
const browser = JSON.parse(await fs.readFile(`${root}/browser-closing.json`, "utf8"));
const gates = {
  full: { passed: full.numPassedTests, failed: full.numFailedTests, pending: full.numPendingTests },
  companyForms: { suites: files.length, tests: assertions.length, passed: assertions.filter(t => t.status === "passed").length,
    pending: area.numPendingTests, skipped: assertions.filter(t => t.status === "skipped").length,
    failures: checkCompanyFormResults(files, area) },
  typescript: (ts.match(/error TS\d+/g) ?? []).length,
  newFailures: [...current].filter(name => !previous.has(name)),
  resolvedFailures: [...previous].filter(name => !current.has(name)),
  head: browser.head, commitTime: browser.commitTime, backendStart: browser.backendStart, backendPid: browser.pid,
  browserChecks: browser.checks, restored: browser.restored,
};
await fs.writeFile(`${root}/gates.json`, JSON.stringify(gates, null, 2));
const titles = [
  "Missing expiry is amber, including accepted-equivalent coverage",
  "Own Contract Period fallback and readable Used / Not used certificate details",
  "Missing contract end does not hide joining-date gaps",
  "Discard confirmation: cancel preserves the unsaved value",
  "Actionable banner, separate certificate numbers and the D3 link",
  "The D3 link reaches the registered fixture’s actual training courses",
  "Independent missing-expiry tenant policy beside the existing expiry policy",
];
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const images = await Promise.all(browser.screenshots.map(async (file, i) =>
  `<section><h2>${i + 1}. ${escape(titles[i])}</h2><img src="data:image/png;base64,${(await fs.readFile(file)).toString("base64")}" alt="${escape(titles[i])}"></section>`));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Training Matrix corrections — approval screenshots</title><style>
body{margin:0;background:#eef2f6;color:#132b40;font:16px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:28px}
section{background:white;padding:20px;margin:24px 0;border:1px solid #d6e0e8;border-radius:8px}h1{margin:0}h2{font-size:20px}
img{display:block;width:100%;height:auto;border:1px solid #d6e0e8}code{overflow-wrap:anywhere}li{margin:6px 0}</style>
<main><h1>Training Matrix corrections</h1><p>Stopped for review; slice 6 has not been built.
Registered fixture only. Office development persona 24, parent Admin role; persisted permissions/scope checks still apply.
No parent-login claim. Both tenant settings and all temporary fixture edits were restored.</p>
<p>Final HEAD <code>${escape(gates.head)}</code><br>Commit: ${escape(gates.commitTime)}<br>
Backend PID ${escape(gates.backendPid)}, started ${escape(gates.backendStart)}</p>
<p>Full suite: ${gates.full.passed} passed, ${gates.full.failed} failed, ${gates.full.pending} pending.
Company Forms: ${gates.companyForms.passed} passed, ${gates.companyForms.skipped} skipped.
TypeScript: ${gates.typescript} diagnostics.</p><ul>${browser.checks.map(text => `<li>${escape(text)}</li>`).join("")}</ul>
${images.join("\n")}</main></html>`;
await fs.writeFile(`${root}/approval-screenshots.html`, html);
console.log(JSON.stringify(gates));
assert.ok(gates.full.failed <= 162 && gates.full.pending <= 67);
assert.ok(gates.typescript <= 222 && gates.companyForms.failures.length === 0 && gates.newFailures.length === 0);
assert.equal(gates.restored, true); assert.ok(!browser.failure);
assert.ok(Date.parse(gates.backendStart) > Date.parse(gates.commitTime));
