// Read-only main-preview layout evidence. Never saves a policy or creates data.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const before = process.argv.includes("--before");
const out = ".local/verification/form-settings-order";
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
await fs.mkdir(out, { recursive: true });
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
const original = before ? await fingerprint() : JSON.parse(await fs.readFile(`${out}/before-data.json`, "utf8"));
if (before) await fs.writeFile(`${out}/before-data.json`, JSON.stringify(original));
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const fixture = (await db.query(`SELECT f.name FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
  WHERE f.name='TEST ONLY Approved PDF automatic rollout' AND NOT f.is_deleted AND v.status='draft' LIMIT 1`)).rows[0];
if (!actor || !fixture?.name.startsWith("TEST ONLY ")) throw Error("Existing registered fixture and persona required");
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: !process.argv.includes("--headed"),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1280,900"] });
const screenshots = [], confirmations = [], writes = [], errors = [], measures = {};
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 2200 } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id), role: actor.role,
      roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  await context.route("**/api/**", route => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    writes.push(route.request().url()); return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
  await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
  await expect(page.getByTestId("company-form-applicability-summary")).not.toContainText("Loading", { timeout: 30000 });
  await page.getByTestId("button-toggle-applicability-settings").click();
  const dialog = page.getByTestId("company-form-applicability-window");
  await expect(dialog.getByTestId("company-form-rule-trial")).toBeVisible();
  await dialog.getByRole("heading", { name: "When this form applies", exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const settle = async () => {
    await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) { if (a.effect?.getTiming().iterations !== Infinity) a.finish(); } });
  };
  const capture = async (name, full = true) => {
    await settle();
    const path = `${out}/${name}.jpg`;
    if (full) await dialog.screenshot({ path, animations: "disabled" }); else await page.screenshot({ path, animations: "disabled" });
    screenshots.push(path);
  };
  const measure = async name => {
    await settle();
    measures[name] = await dialog.evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight, scrollHeight: el.scrollHeight,
      contentHeight: el.querySelector('[data-testid="company-form-applicability-editor"]').offsetHeight, viewportWidth: innerWidth }));
  };
  await measure("conditional");
  await capture(before ? "before-conditional" : "conditional");
  if (!before) {
    const conditions = dialog.getByRole("heading", { name: "Conditions", exact: true });
    const obligation = dialog.getByText("Completion obligation", { exact: true });
    const summary = dialog.getByTestId("applicability-summary");
    const trial = dialog.getByTestId("company-form-rule-trial");
    for (const [a, b] of [[conditions, obligation], [obligation, summary], [summary, trial]]) {
      const handle = await b.elementHandle();
      expect(await a.evaluate((el, next) => !!(el.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), handle)).toBe(true);
    }
    const save = dialog.getByRole("button", { name: "Save settings", exact: true });
    await save.scrollIntoViewIfNeeded(); await expect(save).toBeInViewport();
    const help = dialog.getByRole("button", { name: "About Manual only", exact: true });
    const description = "Crew start it only by choosing it; this policy does not start it automatically.";
    await help.hover();
    await expect(page.getByRole("tooltip", { name: description, exact: true })).toBeVisible();
    await capture("description-hover", false);
    await help.click();
    const helpWindow = page.getByRole("dialog").filter({ hasText: description });
    await expect(helpWindow).toBeVisible();
    await capture("description-tap", false);
    await page.keyboard.press("Escape");
    await expect(helpWindow).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await help.focus(); await page.keyboard.press("Enter");
    await expect(helpWindow).toBeVisible();
    await capture("description-keyboard", false);
    await page.keyboard.press("Escape");
    const keyboard = [{ name: "About Applies to all" }];
    await dialog.getByRole("button", { name: "About Applies to all", exact: true }).focus();
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press("Tab");
      keyboard.push(await page.evaluate(() => ({ tag: document.activeElement?.tagName, role: document.activeElement?.getAttribute("role"),
        name: document.activeElement?.getAttribute("aria-label") || document.activeElement?.getAttribute("placeholder") ||
          document.activeElement?.textContent?.trim().slice(0, 80), type: document.activeElement?.getAttribute("type") })));
      if (await trial.getByRole("searchbox").evaluate(el => document.activeElement === el)) break;
    }
    await expect(trial.getByRole("searchbox")).toBeFocused();
    expect(keyboard.some(k => k.name === "About Manual only")).toBe(true);
    expect(keyboard.some(k => k.name?.includes("Add crew group"))).toBe(true);
    expect(keyboard.some(k => k.type === "radio")).toBe(true);
    await capture("keyboard-trial", false);
    // Exercise keyboard-only specific-date entry and the save control without saving.
    await dialog.getByLabel("On a specific date").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    const date = dialog.locator('input[type="date"]');
    await expect(date).toBeFocused();
    await date.fill("2030-11-02");
    await save.focus(); await expect(save).toBeFocused();
    await capture("keyboard-save", false);
    await dialog.getByLabel("On release").check();
    await fs.writeFile(`${out}/keyboard.json`, JSON.stringify(keyboard, null, 2));
    // A cancelled real native confirmation must leave the visible configuration intact.
    const cardsBefore = await dialog.getByText("Crew group 1", { exact: true }).textContent();
    if (process.argv.includes("--headed")) {
      await page.setViewportSize({ width: 760, height: 440 });
      await page.evaluate(() => { document.title = "Company Form mode confirmation verification"; });
    }
    let cancelled;
    const cancellationDone = new Promise(resolve => { cancelled = resolve; });
    const cancel = async native => {
      confirmations.push({ message: native.message(), action: "cancel" });
      if (process.argv.includes("--headed")) {
        await new Promise(resolve => setTimeout(resolve, 350)); // Let Chromium paint its native modal, not an HTML imitation.
        const row = shell("xwininfo", ["-root", "-tree"]).split("\n").find(line => line.includes('"Company Form mode confirmation verification') && line.includes("chromium"));
        if (!row) throw Error("Could not identify the verification browser window");
        const path = `${out}/mode-switch-confirmation.jpg`;
        execFileSync("import", ["-window", row.trim().split(/\s+/)[0], path]);
        screenshots.push(path);
      }
      await native.dismiss();
      cancelled();
    };
    page.once("dialog", cancel);
    await dialog.getByRole("radio", { name: "Manual only", exact: true }).click();
    await cancellationDone;
    await expect(dialog.getByRole("radio", { name: "Applies when conditions match", exact: true })).toBeChecked();
    await expect(dialog.getByText("Crew group 1", { exact: true })).toHaveText(cardsBefore);
    await page.setViewportSize({ width: 1560, height: 2200 });
    const accept = async native => { confirmations.push({ message: native.message(), action: "accept" }); await native.accept(); };
    page.once("dialog", accept);
    await dialog.getByRole("radio", { name: "Applies to all", exact: true }).click();
    await expect(conditions).toHaveCount(0);
    await expect(trial).toHaveCount(0);
    await measure("all"); await capture("all");
    page.once("dialog", accept);
    await dialog.getByRole("radio", { name: "Manual only", exact: true }).click();
    await expect(conditions).toHaveCount(0);
    await expect(obligation).toHaveCount(0);
    await measure("manual"); await capture("manual");
    await page.setViewportSize({ width: 420, height: 900 });
    await measure("narrow-manual"); await capture("narrow-manual", false);
    await dialog.getByRole("radio", { name: "Applies when conditions match", exact: true }).click();
    // A fresh group is expected after confirmed discard; make this local-only
    // narrow-width example complete without saving it.
    await dialog.getByRole("checkbox").first().check();
    await measure("narrow-conditional"); await capture("narrow-conditional", false);
    await save.scrollIntoViewIfNeeded(); await expect(save).toBeInViewport();
    await capture("narrow-save", false);
    await help.click(); await expect(helpWindow).toBeVisible(); await capture("narrow-description-tap", false);
    await page.keyboard.press("Escape");
  }
  expect(writes).toEqual([]); expect(errors).toEqual([]);
  expect(await fingerprint()).toEqual(original);
  const head = shell("git", ["rev-parse", "HEAD"]), commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
  const processes = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(row => row.endsWith("server/index.ts") && !/watch|npm| -c /.test(row));
  expect(processes).toHaveLength(1);
  const backendStart = new Date(shell("ps", ["-p", processes[0].trim().split(/\s+/)[0], "-o", "lstart="])).toISOString();
  if (process.argv.includes("--closing")) expect(new Date(backendStart).getTime()).toBeGreaterThan(new Date(commitTime).getTime());
  await fs.writeFile(`${out}/${before ? "before" : "after"}.json`, JSON.stringify({ head, commitTime, backendStart, measures,
    screenshots, confirmations, writes, errors, developmentUnchanged: true }, null, 2));
  if (!before) {
    const destination = "generated-artifacts/form-settings-order";
    await fs.mkdir(destination, { recursive: true });
    const baseline = JSON.parse(await fs.readFile(`${out}/before.json`, "utf8"));
    const shots = [
      ["Before — conditional mode", `${out}/before-conditional.jpg`],
      ["After — applies when conditions match", `${out}/conditional.jpg`],
      ["After — applies to all", `${out}/all.jpg`],
      ["After — manual only", `${out}/manual.jpg`],
      ["Mode description — hover", `${out}/description-hover.jpg`],
      ["Mode description — tap/click", `${out}/description-tap.jpg`],
      ["Mode description — keyboard", `${out}/description-keyboard.jpg`],
      ["Keyboard focus — draft test", `${out}/keyboard-trial.jpg`],
      ["Keyboard focus — Save settings (not activated)", `${out}/keyboard-save.jpg`],
      ["Actual Chromium mode-switch confirmation", `${out}/mode-switch-confirmation.jpg`],
      ["Narrow width — manual only", `${out}/narrow-manual.jpg`],
      ["Narrow width — conditional mode", `${out}/narrow-conditional.jpg`],
      ["Narrow width — Save settings reachable", `${out}/narrow-save.jpg`],
      ["Narrow width — tap description", `${out}/narrow-description-tap.jpg`],
    ];
    const cards = await Promise.all(shots.map(async ([title, path]) =>
      `<section><h2>${title}</h2><img alt="${title}" src="data:image/jpeg;base64,${(await fs.readFile(path)).toString("base64")}"></section>`));
    await fs.writeFile(`${destination}/review.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>When this form applies — decision order</title><style>body{font:16px system-ui;color:#18374a;background:#f3f7fb;max-width:1150px;margin:24px auto;padding:0 18px}section{background:white;border:1px solid #d9e2e8;border-radius:8px;padding:18px;margin:24px 0}img{max-width:100%;height:auto}p,li{line-height:1.6}</style><h1>When this form applies — decision order</h1><p>Modes → Conditions (conditional only) → Obligation/effective date → Summary → Test → Stage line → Save.</p><p>Desktop viewport: 1560 × 2200, allowing the full natural-height dialog to be captured. Total conditional-dialog height ${baseline.measures.conditional.height} px before, ${measures.conditional.height} px after (${baseline.measures.conditional.height - measures.conditional.height} px shorter). Narrow viewport: 420 × 900, vertical scrolling with Save settings reachable.</p><p>All screenshots use the existing registered main-preview fixture and Admin development persona. No parent sign-in is claimed. No saves or API mutations are allowed; transient local mode/condition/date changes are discarded on leaving. Counts, content fingerprints and column definitions unchanged. The browser-native confirmation is an actual headed Chromium window capture, not a reconstructed HTML dialog.</p><p>HEAD ${head}<br>Commit ${commitTime}<br>Backend start ${backendStart}</p>${cards.join("")}</html>`);
  }
} finally { await browser.close(); await db.end(); }
