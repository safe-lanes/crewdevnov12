// Read-only main-preview checks; never saves a policy or creates a fixture.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const out = ".local/verification/form-settings-wording";
await fs.mkdir(out, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
async function fingerprint() {
  const rows = {};
  for (const { tablename } of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows) {
    const name = `"${tablename.replaceAll('"', '""')}"`;
    rows[tablename] = (await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${name} t) q`)).rows[0];
  }
  const schema = (await db.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  return { rows, schema };
}
if (process.argv.includes("--before")) {
  await fs.writeFile(`${out}/before.json`, JSON.stringify(await fingerprint()));
  await db.end();
} else {
  const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
    JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
  const fixture = (await db.query(`SELECT f.id AS form_id,f.name,v.id AS version_id,v.fv_uuid,v.version_no
    FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
    WHERE f.name='TEST ONLY Approved PDF automatic rollout' AND NOT f.is_deleted AND v.status='draft'
    ORDER BY v.id DESC LIMIT 1`)).rows[0];
  if (!actor || !fixture.name.startsWith("TEST ONLY ")) throw Error("Registered fixture and development persona required");
  const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
  const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1400 } });
    const writes = [], errors = [], screenshots = [], layouts = [];
    await context.addInitScript(({ actor, token }) => {
      const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
        role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
      for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
      localStorage.setItem("devAuthToken", token);
    }, { actor, token });
    await context.route("**/api/**", route => {
      if (!new URL(route.request().url()).pathname.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
      writes.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
    await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
    await expect(page.getByTestId("company-form-applicability-summary")).not.toContainText("Loading", { timeout: 30000 });
    const capture = async name => {
      const path = `${out}/${name}.jpg`;
      await page.screenshot({ path, animations: "disabled" });
      screenshots.push(path);
    };
    for (const [size, width, height] of [["desktop", 1560, 1400], ["narrow", 390, 844]]) {
      await page.setViewportSize({ width, height });
      const button = page.getByTestId("button-toggle-applicability-settings");
      await expect(button).toHaveText("When this form applies");
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const fit = await button.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        return { lines: range.getClientRects().length, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      expect(fit.lines).toBe(1);
      expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
      layouts.push({ size, width, button: box, fit });
      await capture(`${size}-header`);
      await button.click();
      const dialog = page.getByTestId("company-form-applicability-window");
      await expect(dialog.getByRole("heading", { name: "When this form applies", exact: true })).toBeVisible();
      await expect(dialog.getByText("Set the completion obligation, effective date and crew scope, then save these settings before releasing this version.")).toBeVisible();
      await expect(dialog.getByTestId("applicability-summary")).toBeVisible();
      await capture(`${size}-dialog-top`);
      const save = dialog.getByRole("button", { name: "Save settings", exact: true });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeVisible();
      await capture(`${size}-dialog-save`);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    }
    await page.setViewportSize({ width: 1560, height: 1400 });
    await page.getByTestId("select-form-version").click();
    await page.getByRole("option").filter({ hasText: "Released" }).first().click();
    await expect(page.getByTestId("button-toggle-applicability-settings")).toHaveText("When this form applies");
    await page.getByTestId("button-toggle-applicability-settings").click();
    const released = page.getByTestId("company-form-applicability-window");
    await expect(released.getByRole("heading", { name: "When this form applies — read only" })).toBeVisible();
    await expect(released.getByRole("radio", { name: "Applies when conditions match", exact: true })).toBeDisabled();
    await expect(released.getByTestId("button-save-applicability")).toHaveCount(0);
    await capture("released-read-only");
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(await fingerprint()).toEqual(JSON.parse(await fs.readFile(`${out}/before.json`, "utf8")));
    const processes = shell("ps", ["-eo", "pid=,args="]).split("\n")
      .filter(row => row.endsWith("server/index.ts") && !/watch|npm| -c /.test(row));
    expect(processes).toHaveLength(1);
    const backendPid = Number(processes[0].trim().split(/\s+/)[0]);
    const backendStart = new Date(shell("ps", ["-p", String(backendPid), "-o", "lstart="])).toISOString();
    const commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
    if (process.argv.includes("--closing")) expect(new Date(backendStart).getTime()).toBeGreaterThan(new Date(commitTime).getTime());
    await fs.writeFile(`${out}/report.json`, JSON.stringify({ head: shell("git", ["rev-parse", "HEAD"]),
      commitTime, backendPid, backendStart,
      persona: actor.role, fixture, screenshots, layouts, writes, errors, developmentUnchanged: true,
      evidence: "Read-only existing development persona; parent SSO not verified" }, null, 2));
    const gallery = "generated-artifacts/form-settings-wording";
    await fs.mkdir(gallery, { recursive: true });
    const cards = await Promise.all(screenshots.map(async path => `<section><h2>${path.split("/").pop().replace(".jpg", "").replaceAll("-", " ")}</h2><img src="data:image/jpeg;base64,${(await fs.readFile(path)).toString("base64")}" alt="${path.split("/").pop()}"></section>`));
    await fs.writeFile(`${gallery}/review.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>When this form applies — verification</title><style>body{font:16px system-ui;background:#f3f7fb;color:#18374a;margin:24px auto;max-width:1200px;padding:0 18px}section{background:white;border:1px solid #d9e2e8;margin:24px 0;padding:18px;border-radius:8px}img{max-width:100%;height:auto;display:block}h2{text-transform:capitalize}</style><h1>When this form applies</h1><p>Read-only main-preview evidence, existing Admin development persona, registered fixture only. No settings were saved. New button text fits on one line at 390 px. The existing narrow editor wraps its toolbar and clips some other content; that broader layout was not changed in this wording-only task.</p><p>HEAD: ${shell("git", ["rev-parse", "HEAD"])}</p>${cards.join("")}</html>`);
    console.log("Header and dialog wording verified; no writes, browser errors or development-data changes.");
  } finally { await browser.close(); await db.end(); }
}
