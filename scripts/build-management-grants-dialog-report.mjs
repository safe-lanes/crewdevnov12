import fs from "node:fs/promises";

const root = ".local/verification/management-grants-dialog";
const main = JSON.parse(await fs.readFile(`${root}/main-preview/report.json`, "utf8"));
const integrity = JSON.parse(await fs.readFile(`${root}/main-preview/integrity.json`, "utf8"));
const isolated = JSON.parse(await fs.readFile(`${root}/test-database/report.json`, "utf8"));
const audit = JSON.parse(await fs.readFile(`${root}/test-database/audit.json`, "utf8"));
const gates = JSON.parse(await fs.readFile(`${root}/gates.json`, "utf8"));
if (!integrity.allRowsAndSchemaUnchanged || main.errors.length || main.blockedWrites.length ||
    !isolated.frozenAuditVerified || gates.full.failed > 162 || gates.full.pending > 67 ||
    gates.companyForms.failed || gates.companyForms.skipped || gates.companyForms.problems.length ||
    gates.typescript > 222) throw Error("Incomplete evidence or requested gate exceeded.");
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const cards = [
  ["Main preview — desktop buttons and body, with no inline panel", "main-preview/desktop-body"],
  ["Main preview — desktop popup, target role clearly identified", "main-preview/desktop-popup"],
  ["Main preview — four buttons wrapping at 390 px", "main-preview/narrow-body"],
  ["Main preview — narrow popup with independent target", "main-preview/narrow-popup"],
  ["Isolated database — normal state and Your role marker", "test-database/normal-desktop"],
  ["Isolated database — normal state at narrow width", "test-database/normal-narrow"],
  ["Isolated database — fallback state", "test-database/fallback-desktop"],
  ["Isolated database — fallback state at narrow width", "test-database/fallback-narrow"],
  ["Isolated database — grant confirmation", "test-database/grant-confirmation-desktop"],
  ["Isolated database — grant confirmation at narrow width", "test-database/grant-confirmation-narrow"],
  ["Isolated database — removal confirmation and own-role warning", "test-database/own-removal-desktop"],
  ["Isolated database — own-role warning at narrow width", "test-database/own-removal-narrow"],
  ["Isolated database — grant saved", "test-database/saved-desktop"],
  ["Isolated database — original unsaved-grid confirmation retained", "test-database/unsaved-grid-confirmation"],
];
const images = await Promise.all(cards.map(async ([title, path]) =>
  `<section><h2>${escape(title)}</h2><img alt="${escape(title)}" src="data:image/jpeg;base64,${(await fs.readFile(`${root}/${path}.jpg`)).toString("base64")}"></section>`));
await fs.mkdir("generated-artifacts/management-grants-dialog", { recursive: true });
await fs.writeFile("generated-artifacts/management-grants-dialog/review.html", `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Management grants — popup verification</title>
<style>body{margin:0;background:#eef3f8;color:#172b42;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}
header,section{padding:24px;margin-bottom:24px;background:white;border:1px solid #d7e1eb;border-radius:8px}
h1,h2{color:#16569e}img{max-width:100%;height:auto;border:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}</style>
<main><header><h1>Management grants</h1>
<p>First in the outline-button row, before Blocking Seafarer Deployment, Access audit history and Company PDF branding. Four buttons wrap at 390 px. No inline panel remains.</p>
<p>Every opening starts with the grid's currently selected role, rather than an older popup target. The popup's selection is independent thereafter. “Management access applies to” names the target clearly.</p>
<p>Changing the popup role never discards dirty grid edits. Changing the grid role still asks whether to keep editing or discard all three groups. Grant/removal confirmation and the own-role self-lockout warning remain.</p>
<p>Main preview uses the existing ${escape(main.persona.role)} development persona, with all API mutations blocked. Normal and fallback states, grant saving and confirmation checks also use the same real UI and registered isolated backend/database. Fallback setup is restored afterwards. This is not normal parent-SSO verification.</p>
<p>HEAD: <code>${escape(main.head)}</code></p>
<p>Full suite: ${gates.full.passed} passed / ${gates.full.failed} failed / ${gates.full.pending} pending.
Company Forms: ${gates.companyForms.passed} passed / ${gates.companyForms.failed} failed / ${gates.companyForms.skipped} skipped.
TypeScript: ${gates.typescript} diagnostics. The full repository suite is within the requested ceiling, not fully green.</p>
<p>All rows and column definitions unchanged across ${integrity.tables} development public tables, including grants, audit and migration ledger. Server settings, safeguards and audit capture were not changed.</p>
</header>${images.join("")}<section><h2>Frozen audit evidence — isolated database</h2>
<pre>${escape(JSON.stringify(audit, null, 2))}</pre></section></main></html>`);
console.log("generated-artifacts/management-grants-dialog/review.html");
