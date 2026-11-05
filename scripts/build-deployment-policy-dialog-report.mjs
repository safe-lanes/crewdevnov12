import fs from "node:fs/promises";

const root = ".local/verification/deployment-policy-dialog";
const main = JSON.parse(await fs.readFile(`${root}/main-preview/report.json`, "utf8"));
const integrity = JSON.parse(await fs.readFile(`${root}/main-preview/integrity.json`, "utf8"));
const gates = JSON.parse(await fs.readFile(`${root}/gates.json`, "utf8"));
const audit = JSON.parse(await fs.readFile(`${root}/test-database/policy-audit.json`, "utf8"));
if (!integrity.allRowsAndSchemaUnchanged || main.errors.length || main.blockedWrites.length ||
    gates.full.failed > 162 || gates.full.pending > 67 ||
    gates.companyForms.failed || gates.companyForms.skipped || gates.typescript > 222)
  throw Error("Evidence is incomplete or outside the requested gates.");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const cards = [
  ["Main preview — desktop row and body", `${root}/main-preview/desktop-body.jpg`],
  ["Main preview — desktop popup", `${root}/main-preview/desktop-popup.jpg`],
  ["Main preview — narrow row and body (390 px)", `${root}/main-preview/narrow-body.jpg`],
  ["Main preview — narrow popup (390 px)", `${root}/main-preview/narrow-popup.jpg`],
  ["Isolated test database — saved policy change, desktop", `${root}/test-database/desktop-saved.jpg`],
  ["Isolated test database — saved policy change, narrow", `${root}/test-database/narrow-saved-popup.jpg`],
];
const images = await Promise.all(cards.map(async ([title, path]) =>
  `<section><h2>${escape(title)}</h2><img alt="${escape(title)}" src="data:image/jpeg;base64,${(await fs.readFile(path)).toString("base64")}"></section>`));
await fs.mkdir("generated-artifacts/deployment-policy-dialog", { recursive: true });
await fs.writeFile("generated-artifacts/deployment-policy-dialog/review.html", `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Blocking Seafarer Deployment — popup verification</title>
<style>body{margin:0;background:#eef3f8;color:#172b42;font:16px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:auto;padding:24px}header,section{padding:24px;margin-bottom:24px;background:white;border:1px solid #d7e1eb;border-radius:8px}
h1,h2{color:#16569e}img{max-width:100%;height:auto;border:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}</style>
<main><header><h1>Blocking Seafarer Deployment</h1>
<p>The existing policy opens from an outline button immediately before Access audit history. Wording, settings, safeguards and audit capture are unchanged.</p>
<p>Main-preview screenshots use the existing ${escape(main.persona.role)} development persona. Every API mutation was blocked; no parent-SSO claim is made. Saving and restoration were clicked through against the registered isolated test database, using the same UI and server.</p>
<p>The actual top action row has three buttons, not four: the new policy action and the two existing actions. They wrap at 390 px; no unspecified action was added.</p>
<p>HEAD: <code>${escape(main.head)}</code></p>
<p>Full suite: ${gates.full.passed} passed / ${gates.full.failed} failed / ${gates.full.pending} pending.
Company Forms: ${gates.companyForms.passed} passed / ${gates.companyForms.failed} failed / ${gates.companyForms.skipped} skipped.
TypeScript: ${gates.typescript} diagnostics.</p>
<p>Development integrity: all rows and column definitions unchanged across ${integrity.tables} public tables, including settings, audit and migration ledger.</p>
</header>${images.join("")}
<section><h2>Saved-change audit — isolated database only</h2><p>Both settings use the unchanged audit writer. The test records server-derived identity, timestamp, frozen labels and before/after values, and restores settings through the popup.</p><pre>${escape(JSON.stringify(audit, null, 2))}</pre></section>
<section><h2>Management grants recommendation — not implemented</h2><p>The same popup pattern would work. Preserve its existing role selector, clearly show the affected role, and retain the unsaved-grid-edits and grant-review confirmations. It need not remain visible beside the grid, but the shared role selection must not silently discard grid edits.</p></section></main></html>`);
console.log("generated-artifacts/deployment-policy-dialog/review.html");
