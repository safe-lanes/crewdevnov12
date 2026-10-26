// Read-only main-preview evidence: reuses the seven registered PDF fixtures.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const directory = ".local/verification/system-field-comments";
await fs.mkdir(directory, { recursive: true });
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c default_transaction_read_only=on",
});
const fixtures = (await db.query(`
  SELECT DISTINCT f.id AS form_id,f.name,v.id AS version_id,v.version_no,v.fv_uuid
  FROM frm_questions q JOIN frm_sections s ON s.section_uuid=q.section_uuid
  JOIN adm_form_versions_v2 v ON v.fv_uuid=s.form_version_uuid
  JOIN adm_forms_v2 f ON f.id=v.form_id
  WHERE q.response_type='system_field' AND q.comment_enabled
    AND NOT q.is_deleted AND NOT s.is_deleted
    AND f.category='dynamic' AND v.status='released' ORDER BY v.id
`)).rows;
if (fixtures.length !== 7) throw Error("Expected the seven protected released fixture versions.");
const register = await fs.readFile("docs/company-form-regression-fixtures.md", "utf8");
const manifestPath = "docs/company-forms/pdf-layout-fixtures.json";
if (!register.includes(manifestPath)) throw Error("PDF fixture manifest is not registered.");
const manifest = await fs.readFile(manifestPath, "utf8");
for (const fixture of fixtures) {
  if (!manifest.includes(fixture.fv_uuid))
    throw Error(`Unregistered version ${fixture.version_id}; verification refused.`);
}
const actor = (await db.query(`
  SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted
  WHERE u.id=24
`)).rows[0];
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({
  id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test",
})}.devsig`;
const browser = await chromium.launch({
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  verifiedAt: new Date().toISOString(),
  fixtures: [], errors: [], blockedWrites: [],
};
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 },
  });
  await context.route("**/api/**", async route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      report.blockedWrites.push({ method: route.request().method(), url: route.request().url() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await context.addInitScript(({ actor, token }) => {
    const profile = {
      personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [],
    };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  for (const fixture of fixtures) {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
    await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
    const version = page.getByTestId("select-form-version");
    await expect(version).not.toHaveText(/Loading/, { timeout: 30000 });
    if (!(await version.textContent()).includes(`v${fixture.version_no}`)) {
      await version.click();
      await page.getByRole("option").filter({ hasText: new RegExp(`^v${fixture.version_no}\\b`) }).click();
    }
    // The rank point is the protected system field; its disabled control has
    // an explanatory title even when legacy storage still says comments=true.
    const disabledComment = page.locator('label[title^="System fields display"] [data-testid^="checkbox-point-comment-"]');
    await expect(disabledComment.first()).toBeVisible({ timeout: 30000 });
    await expect(disabledComment.first()).toBeDisabled();
    await expect(disabledComment.first()).toHaveAttribute("data-state", "unchecked");
    await disabledComment.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/${fixture.version_id}-builder.jpg`, fullPage: true });
    await page.getByTestId("button-preview-mode").click();
    await expect(page.getByTestId("configured-form-preview")).toBeVisible();
    await page.screenshot({ path: `${directory}/${fixture.version_id}-preview.jpg`, fullPage: true });
    report.fixtures.push({ ...fixture, builder: "passed", preview: "passed" });
  }
  if (report.blockedWrites.length || report.errors.length) throw Error("Unexpected writes or browser errors.");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fs.writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
