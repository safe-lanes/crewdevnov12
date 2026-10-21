import fs from "node:fs/promises";
const root = "generated-artifacts/training-slice4-adjustments";
const evidence = JSON.parse(await fs.readFile(`${root}/browser-evidence.json`, "utf8"));
if (!evidence.closing || evidence.failure || evidence.errors.length || evidence.screenshots.length !== 4)
  throw Error("Only successful closing main-preview evidence may be delivered.");
const entries = [
  ["01-all-courses-compliant", "All course states compliant — complete matrix list",
    "Both requirements are visible under A. Statutory, in matrix order, with the switch OFF. Both are Valid, no expiry. A correction flag on an older certificate is still disclosed; the equivalent actually used is named."],
  ["02-mixed-and-expandable", "Mixed results and useful expanded evidence",
    "The full list includes Valid and Not held. Expanded evidence identifies the chosen longer certificate, the shorter alternative and the future-issued equivalent that was not counted. The selection rule and correction flag are visible without repeating the course status."],
  ["03-action-only-switch", "Action-only switch ON",
    "The unflagged compliant chemical-tanker requirement is hidden. The AFF requirement remains because an older certificate needs correction, even though the selected equivalent satisfies the course. This is only a display filter."],
  ["04-no-recommended-courses", "Rank with no recommended courses",
    "Reliever Status states Recommended: None required for this rank. The same wording appears inside Details. This does not turn an incomplete check into a claim that no courses are required."],
];
const escape = text => String(text).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cards = await Promise.all(entries.map(async ([name, title, note], index) =>
  `<section id="shot-${index + 1}"><h2>${index + 1}. ${escape(title)}</h2><p>${escape(note)}</p>
  <a href="#top">Back to top</a><img alt="${escape(title)}" src="data:image/png;base64,${(await fs.readFile(`${root}/${name}.png`)).toString("base64")}"></section>`));
await fs.writeFile(`${root}/training-presentation-review.html`, `<!doctype html><html lang="en">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Training compliance — presentation review</title>
<style>body{margin:0;background:#f2f5f8;color:#172c43;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1560px;margin:auto;padding:24px}header{background:white;box-sizing:border-box}h1{font-size:28px;margin:0 0 12px}h2{font-size:21px}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#16569e}section{background:white;margin-bottom:28px;padding:16px;border-radius:8px}img{width:100%;height:auto;display:block;margin-top:12px}code{overflow-wrap:anywhere}small{color:#52657a}</style>
<header id="top"><h1>Training Matrix — presentation adjustments</h1>
<p>Actual main-preview clicks as the registered <b>Crewing Manager development persona</b>, using normal persisted permission checks.
Same retained fixture, two saved joining-date scenarios; no new crew, grants, courses or matrix rules.
Calculation remains <b>1.2.0</b>; no enforcement.</p>
<p><b>Vessel → TEST ONLY PDF layout review → Planning → Chief Officer's Reliever Status → See Details</b>.
The fixture is restored to joining <b>01-May-2027</b> with a <b>6-month</b> end range.</p>
<p><small>HEAD <code>${escape(evidence.head)}</code><br>
Commit ${escape(evidence.chronology.commitTime)}<br>Backend start ${escape(evidence.chronology.backendStartUtc)}; same HEAD/process throughout.</small></p>
<nav>${entries.map(([, title], index) => `<a href="#shot-${index + 1}">${index + 1}. ${escape(title)}</a>`).join("")}</nav></header>
<main>${cards.join("")}</main></html>`);
console.log(`${root}/training-presentation-review.html`);
