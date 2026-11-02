// Read-only main-preview evidence plus isolated execution of EVERY converted
// source handler. No product test route, browser API writes, or fixture creation.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import ts from "typescript";
import { chromium, expect } from "@playwright/test";

const out = ".local/verification/native-dialogs";
await fs.mkdir(out, { recursive: true });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
async function fingerprint() {
  const rows = {};
  for (const { tablename } of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows) {
    const name = `"${tablename.replaceAll('"', '""')}"`;
    rows[tablename] = (await db.query(`SELECT count(*)::text AS count,md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${name} t) q`)).rows[0];
  }
  return { rows, columns: (await db.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows };
}
const baselineFile = `${out}/before-data.json`;
if (process.argv.includes("--baseline")) {
  await fs.writeFile(baselineFile, JSON.stringify(await fingerprint()));
  await db.end();
  console.log("Read-only development fingerprint captured");
  process.exit(0);
}
const baseline = JSON.parse(await fs.readFile(baselineFile, "utf8"));
const cases = [
  ["wage-element", "Wage element", "components/wage/ElementLineRow.tsx", "Are you sure you want to delete", [], "confirm"],
  ["mode-discard", "When this form applies — mode change", "components/company-forms/CompanyFormApplicabilityEditor.tsx", "Changing this mode", ["manual_only"], "confirm"],
  ["settings-close", "When this form applies — close", "components/company-forms/CompanyFormApplicabilityEditor.tsx", "Discard unsaved applicability", [], "confirm"],
  ["training-delete", "Training Needs", "modules/training-retention/components/Training.tsx", "Delete this training need?", [{ sourceRefUuid: "need" }], "confirm"],
  ["hierarchy-delete", "Promotion hierarchy", "components/dialogs/PromotionHierarchyDialog.tsx", "hierarchy?", [], "confirm"],
  ["comment", "Appraisal — Office Review & Followup", "components/form-editor-parts/PartG.tsx", "Enter comment:", [], "prompt"],
  ["candidate-delete", "Recruitment", "modules/recruitment/RecruitmentModule_v2.tsx", "Are you sure you want to delete", [], "confirm"],
  ["pdf-handover", "Company Form — PDF handover", "components/configured-form/CompanyPdfActions.tsx", "Record that this PDF", [], "confirm"],
  ["void-handover", "Company Form — void notice handover", "components/configured-form/CompanyPdfActions.tsx", "Record that the void notice", [], "confirm"],
  ["reliever-close", "Reliever Status", "modules/vessel/components/ReliefStatusEditDialog_v2.tsx", "Discard unsaved changes?", [false], "confirm"],
  ["form-delete", "Forms Configuration — delete form", "modules/admin/AdminModule.tsx", "Are you sure you want to delete the form", [{ id: 1, name: "Fixture form" }], "confirm"],
  ["form-archive", "Forms Configuration — archive Company Form", "modules/admin/AdminModule.tsx", "Existing submissions will stay readable", [], "confirm"],
  ["vessel-switch", "Training equivalents — switch vessel", "modules/admin/TrainingEquivalentsEditor.tsx", "switch vessel?", [], "confirm"],
  ["revision-switch", "Training equivalents — switch revision", "modules/admin/TrainingEquivalentsEditor.tsx", "view another revision?", ["next"], "confirm"],
  ["wage-draft-delete", "Wage scales", "modules/accounts/pages/WageScalesPage.tsx", "Delete draft", [{ scaleName: "Fixture scale", scaleUuid: "scale" }], "confirm"],
  ["cba-delete", "CBA references", "modules/accounts/pages/CbaReferencePage.tsx", "Delete CBA reference", [{ cbaName: "Fixture reference", cbaRefUuid: "cba" }], "confirm"],
  ["pay-element-delete", "Pay elements", "modules/accounts/pages/PayElementsPage.tsx", "This performs a soft-delete.", [{ name: "Fixture element", payElementUuid: "pay" }], "confirm"],
  ["chart-notice", "Rest Hours chart", "modules/rest-hours/components/PlaceholderChart.tsx", "Download functionality", [], "alert"],
];
async function compiledHandler(file, marker) {
  const fileName = path.resolve("client/src", file);
  const source = ts.createSourceFile(fileName, await fs.readFile(fileName, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isCallExpression(node) && ["ask", "requestText", "notify"].includes(node.expression.getText(source))
      && node.arguments[0]?.getText(source).includes(marker)) {
      let parent = node;
      while (!ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent)) parent = parent.parent;
      handler = parent;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw Error(`No source handler for ${file}: ${marker}`);
  return ts.transpileModule(`exports.handler = (${handler.getText(source)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
}
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errors = [], nativeDialogs = [], writes = [], evidence = [], checks = [];
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const head = shell("git", ["rev-parse", "HEAD"]);
const commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
const processes = shell("ps", ["-eo", "pid,args"]).split("\n").filter(line => /tsx\/dist\/loader\.mjs server\/index\.ts$/.test(line));
if (processes.length !== 1) throw Error("Expected exactly one main backend process");
const pid = Number(processes[0].trim().split(/\s+/)[0]);
const backendStart = new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString();
if (process.argv.includes("--closing") && new Date(backendStart) <= new Date(commitTime)) throw Error("Backend must start after final HEAD");
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 980 } });
  await context.route("**/api/**", route => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    writes.push(route.request().url()); return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss(); });
  let activeEntry;
  await context.route("**/__native-dialog-review", route => route.fulfill({
    contentType: "text/html",
    body: `<html><meta charset="utf-8"><div id="root"></div><script>window.dialogReviewCase=${JSON.stringify(activeEntry).replaceAll("<", "\\u003c")};</script><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      import('/@fs${process.cwd()}/tests/browser/native-dialog-review.tsx');
    </script></html>`,
  }));
  const capture = async name => {
    await page.evaluate(() => document.getAnimations().forEach(animation => { if (animation.effect?.getTiming().iterations !== Infinity) animation.finish(); }));
    const file = `${out}/${name}.jpg`;
    await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 82 });
    evidence.push({ name, file });
  };
  for (const [id, screen, file, marker, args, kind] of cases) {
    const entry = { screen, compiled: await compiledHandler(file, marker), args };
    activeEntry = entry;
    await page.goto(`${origin}/__native-dialog-review`);
    await page.getByRole("button", { name: "Open confirmation" }).click();
    const modal = page.getByRole("alertdialog");
    await expect(modal).toBeVisible();
    await capture(id);
    if (kind === "prompt") await expect(modal.getByRole("textbox")).toHaveValue("Existing fixture comment");
    if (kind === "alert") {
      await modal.getByRole("button").click();
      await expect(modal).toHaveCount(0);
      checks.push({ id, acknowledged: true });
    } else {
      await modal.getByRole("button").first().click();
      await expect(page.getByRole("status")).toHaveText("Cancelled: unchanged");
      await page.getByRole("button", { name: "Open confirmation" }).click();
      await expect(modal).toBeVisible();
      if (kind === "prompt") await modal.getByRole("textbox").fill("");
      await modal.getByRole("button").last().click();
      await expect(page.getByRole("status")).toContainText("Confirmed:");
      checks.push({ id, cancelledUnchanged: true, confirmed: true });
    }
  }
  // The two attachment notices are independent call sites inside one function.
  // Invoke each exact notify expression, retaining the source text and options.
  for (const [id, marker] of [["attachment-popup-blocked", "Please allow pop-ups"], ["attachment-failed", "Please try again."]]) {
    const fileName = "client/src/modules/vessel/components/TrainingMatrixCompliance.tsx";
    const source = ts.createSourceFile(fileName, await fs.readFile(fileName, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression;
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "notify" && node.arguments[0]?.getText(source).includes(marker))
        expression = node.getText(source);
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (!expression) throw Error("Attachment notice missing");
    activeEntry = {
      screen: "Training Matrix Compliance — attachment unavailable",
      compiled: `exports.handler = async () => { await ${expression}; };`, args: [],
    };
    await page.goto(`${origin}/__native-dialog-review`);
    await page.getByRole("button", { name: "Open confirmation" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await capture(id);
    await page.getByRole("alertdialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    checks.push({ id, acknowledged: true });
  }

  // Real main-preview screen, existing registered fixture and development persona.
  const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
    JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
  if (!actor) throw Error("Existing development persona required");
  const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
  await page.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id), role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
  await page.getByRole("button", { name: "Configure TEST ONLY Approved PDF automatic rollout", exact: true }).click();
  await expect(page.getByTestId("company-form-applicability-summary")).not.toContainText("Loading", { timeout: 30000 });
  await page.getByTestId("button-toggle-applicability-settings").click();
  const settings = page.getByTestId("company-form-applicability-window");
  await expect(settings).toBeVisible();
  await settings.getByRole("radio", { name: "Manual only", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await capture("main-applicability-discard");
  await page.getByRole("alertdialog").getByRole("button", { name: "Keep editing" }).click();
  await expect(settings.getByRole("radio", { name: "Applies when conditions match", exact: true })).toBeChecked();
  await settings.getByRole("button", { name: "Add crew group" }).click();
  await settings.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await capture("main-applicability-close");
  await page.getByRole("alertdialog").getByRole("button", { name: "Keep editing" }).click();
  await expect(settings.getByText("Crew group 2", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 420, height: 900 });
  await settings.getByRole("radio", { name: "Manual only", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await capture("main-applicability-narrow");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(settings).toBeVisible();
  checks.push({ id: "main-preview", cancelledModePreserved: true, cancelledClosePreserved: true, escapeOnlyClosesConfirmation: true });
  const after = await fingerprint();
  if (JSON.stringify(baseline) !== JSON.stringify(after)) throw Error("Development database/schema fingerprint changed");
  if (writes.length || errors.length || nativeDialogs.length) throw Error(JSON.stringify({ writes, errors, nativeDialogs }));
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ head, commitTime, backendStart, checks, evidence, writes, errors, nativeDialogs, developmentUnchanged: true }, null, 2));
  const destination = "generated-artifacts/native-dialogs";
  await fs.mkdir(destination, { recursive: true });
  const before = ".local/verification/form-settings-order/mode-switch-confirmation.jpg";
  const cards = await Promise.all([{ name: "Before — actual native Chromium confirmation from the preceding task", file: before }, ...evidence].map(async item =>
    `<section><h2>${item.name}</h2><img alt="${item.name}" src="data:image/jpeg;base64,${(await fs.readFile(item.file)).toString("base64")}"></section>`));
  await fs.writeFile(`${destination}/review.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>In-app confirmations review</title><style>body{font:16px system-ui;max-width:1100px;margin:24px auto;padding:0 20px;background:#f4f7fa;color:#19364a}section{background:white;padding:18px;margin:20px 0;border:1px solid #d5dfe7;border-radius:8px}img{max-width:100%;height:auto}p{line-height:1.6}</style><h1>In-app confirmations</h1><p>20 converted call sites. First 20 after screenshots execute actual source handlers or exact attachment-notice expressions with synthetic dependencies in an isolated browser harness. They show the real AlertDialog, not HTML recreations. Every confirmation/prompt was cancelled and accepted. The final three screenshots are the actual signed-in main-preview applicability screen using an existing development persona and registered fixture. No parent SSO is claimed.</p><p>No API writes. Development table counts, content fingerprints and schema unchanged. No native dialogs or browser page errors observed.</p><p>HEAD ${head}<br>Commit ${commitTime}<br>Backend start ${backendStart}</p>${cards.join("")}</html>`);
  console.log(JSON.stringify({ head, commitTime, backendStart, screenshots: evidence.length, checks: checks.length, developmentUnchanged: true, nativeDialogs: nativeDialogs.length, mutations: writes.length }));
} finally { await browser.close(); await db.end(); }
