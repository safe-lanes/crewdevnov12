import fs from "node:fs/promises";
const root = "generated-artifacts/training-slice4";
const evidence = JSON.parse(await fs.readFile(`${root}/browser-evidence.json`, "utf8"));
if (evidence.failure || evidence.errors.length || evidence.screenshots.length !== 11)
  throw Error("Only complete, successful main-preview evidence may be delivered.");
const titles = [
  "Incomplete: planned joining date absent",
  "Contract end not set: warning, not incomplete",
  "Reliever Status: Mandatory and Recommended",
  "Valid and explicitly Not held",
  "Multiple certificates and the correction flag",
  "Protected certificate opened in the PDF viewer",
  "Expires during contract",
  "Expired at joining",
  "No expiry and the named accepted equivalent",
  "Failed request: plain message and Retry",
  "Retry recovered the saved result",
];
const escape = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cards = await Promise.all(evidence.screenshots.map(async (file, i) =>
  `<section id="shot-${i + 1}"><h2>${i + 1}. ${titles[i]}</h2><img alt="${titles[i]}" src="data:image/png;base64,${(await fs.readFile(file)).toString("base64")}"></section>`));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Training compliance — main-preview review</title>
<style>body{margin:0;background:#f2f5f8;color:#172c43;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1560px;margin:auto;padding:24px}header{background:white;box-sizing:border-box}h1{font-size:28px;margin:0 0 12px}h2{font-size:21px}nav{display:flex;gap:14px;flex-wrap:wrap}a{color:#16569e}section{background:white;margin-bottom:28px;padding:16px;box-shadow:0 2px 9px #20304012;border-radius:8px}img{width:100%;height:auto;display:block}code{overflow-wrap:anywhere}small{color:#52657a}</style>
<header><h1>Training Matrix compliance — slice 4</h1>
<p>Actual main-preview clicks using the registered Crewing Manager development persona. Read-only calculation <b>1.2.0</b>; no training enforcement or override enabled. No new grants.</p>
<p>Fixture: <b>TEST ONLY PDF layout review</b> → Planning → Chief Officer's Reliever Status → See Details.<br>
All five states are shown below across saved fixture-date scenarios. The fixture is restored to joining <b>01-May-2027</b> and a <b>6-month</b> end range.</p>
<p><small>HEAD <code>${escape(evidence.head)}</code><br>Commit ${escape(evidence.chronology.commitTime)}<br>
Backend started ${escape(evidence.chronology.backendStartUtc)}; same process throughout the journey.</small></p>
<nav>${titles.map((_, i) => `<a href="#shot-${i + 1}">Screenshot ${i + 1}</a>`).join("")}</nav></header><main>${cards.join("")}</main></html>`;
await fs.writeFile(`${root}/training-compliance-review.html`, html);
console.log(`${root}/training-compliance-review.html`);
