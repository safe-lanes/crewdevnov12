// Read-only main-preview evidence. Saves are exercised only by the isolated test.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const out = ".local/verification/deployment-policy-dialog/main-preview";
await fs.mkdir(out, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
async function fingerprint() {
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const rows = {};
  for (const { tablename } of tables) {
    const name = `"${tablename.replaceAll('"', '""')}"`;
    rows[tablename] = (await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${name} t) q`)).rows[0];
  }
  const schema = (await db.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  return { rows, schema };
}
const mode = process.argv[2];
if (mode === "before" || mode === "after") {
  const current = await fingerprint();
  if (mode === "before") await fs.writeFile(`${out}/before.json`, JSON.stringify(current));
  else {
    const before = JSON.parse(await fs.readFile(`${out}/before.json`, "utf8"));
    expect(current).toEqual(before);
    await fs.writeFile(`${out}/integrity.json`, JSON.stringify({ tables: Object.keys(current.rows).length,
      allRowsAndSchemaUnchanged: true, checkedAt: execFileSync("date", ["-u", "+%FT%TZ"], { encoding: "utf8" }).trim() }, null, 2));
  }
  await db.end();
} else {
  const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
    JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
  if (!actor) throw Error("Registered office persona unavailable.");
  const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
  const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 1100 } });
    await context.addInitScript(({ actor, token }) => {
      const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
        role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
      for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
      localStorage.setItem("devAuthToken", token);
    }, { actor, token });
    const blockedWrites = [], errors = [], screenshots = [];
    await context.route("**/api/**", route => {
      if (!new URL(route.request().url()).pathname.startsWith("/api/")) return route.continue();
      if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
      blockedWrites.push(new URL(route.request().url()).pathname);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
    const button = page.getByTestId("button-training-compliance-policy");
    await expect(button).toBeVisible();
    const capture = async name => {
      await page.screenshot({ path: `${out}/${name}.jpg`, animations: "disabled" });
      screenshots.push(`${out}/${name}.jpg`);
    };
    for (const [size, width, height] of [["desktop", 1500, 1100], ["narrow", 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.getByTestId("access-control-top-actions").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("training-compliance-policy")).toHaveCount(0);
      const boxes = await page.getByTestId("access-control-top-actions").getByRole("button").evaluateAll(buttons =>
        buttons.map(b => { const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top }; }));
      expect(boxes).toHaveLength(3);
      for (const box of boxes) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); }
      if (size === "narrow") expect(new Set(boxes.map(b => b.top)).size).toBeGreaterThan(1);
      await capture(`${size}-body`);
      await button.click();
      const dialog = page.getByTestId("training-compliance-policy-dialog");
      await expect(dialog.getByTestId("training-expiring-current-effect")).toBeVisible();
      await expect(dialog.getByTestId("training-missing-expiry-current-effect")).toBeVisible();
      await expect(dialog.getByTestId("save-training-compliance-policy")).toBeVisible();
      await capture(`${size}-popup`);
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    }
    expect(blockedWrites).toEqual([]);
    expect(errors).toEqual([]);
    await fs.writeFile(`${out}/report.json`, JSON.stringify({
      head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      persona: { role: actor.role, id: actor.id }, blockedWrites, errors, screenshots,
      buttons: 3, noInlinePanel: true, narrowWidth: 390,
      evidence: "Main preview read-only development persona; no parent SSO; saved changes exercised only in isolated test database",
    }, null, 2));
  } finally { await browser.close(); await db.end(); }
}
