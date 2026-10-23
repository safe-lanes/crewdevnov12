// Controlled failure presentation, not a live save/release of the fixture.
// Run: node --import tsx scripts/verify-company-form-validation.mjs
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { companyFormDraftStructureInputSchema } from "../shared/v2/forms-engine/schema.ts";
import { validateCompanyFormLifecycle } from "../server/v2/company-forms/lifecyclePolicy.ts";

const directory = ".local/verification/company-form-validation";
await fs.mkdir(directory, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
const fixture = (await db.query(`SELECT f.id,f.name,f.form_uuid,v.id AS version_id,v.fv_uuid
  FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
  WHERE f.id=5301 AND v.id=7457 AND v.status='released'`)).rows[0];
if (!fixture) throw Error("Registered final-glance PDF fixture is required.");
const register = await fs.readFile("docs/company-form-regression-fixtures.md", "utf8");
const manifestPath = "docs/company-forms/pdf-layout-fixtures.json";
if (!register.includes(manifestPath) || !(await fs.readFile(manifestPath, "utf8")).includes(fixture.fv_uuid))
  throw Error("Fixture registration is missing.");
const section = (await db.query(`SELECT section_uuid,section_title FROM frm_sections
  WHERE form_version_uuid=$1 AND NOT is_deleted ORDER BY sort_order LIMIT 1`, [fixture.fv_uuid])).rows[0];
const structure = companyFormDraftStructureInputSchema.safeParse({
  sections: [{ section_code: "S", section_title: section.section_title, responsible_mode: "seafarer", questions: [
    { question_code: "INFO", question_text: "Purpose of this sample", response_type: "content", content_html: "<p>Sample</p>", comment_enabled: false },
    { question_code: "Q", question_text: "Long recorded answer", response_type: "free_text", content_html: "<p>Unsupported formatted content</p>" },
    { question_code: "RANK", question_text: "Rank", response_type: "system_field", system_field_key: "rank", comment_enabled: false,
      options: [{ option_label: "Yes", option_value: "yes" }] },
  ] }],
});
if (structure.success) throw Error("Expected the existing schema's validation issues.");
const saveBody = { error: "Invalid form structures", details: structure.error.issues.map(issue => ({
  ...issue, path: ["parts", 0, "structure", ...issue.path],
})) };
const lifecycle = validateCompanyFormLifecycle([{
  sectionUuid: section.section_uuid, sectionTitle: section.section_title,
  responsibleMode: "not_applicable", signatureOfficerRequired: false,
  signatureSeafarerRequired: true, onBoard: true, vesselSignatureRoleUuids: [], questions: [],
}]);
if (lifecycle.length < 2) throw Error("Expected multiple existing lifecycle explanations.");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  evidenceType: "Controlled browser responses from existing server validators; browser-only draft status; no development mutations",
  fixture, scenarios: [], unexpectedWrites: [], errors: [],
};
try {
  for (const scenario of [
    { name: "failed-save", method: "PUT", endpoint: "/structures", status: 400, body: saveBody, count: saveBody.details.length },
    { name: "failed-release", method: "POST", endpoint: "/release", status: 400, body: { error: lifecycle.join(" ") }, count: lifecycle.length },
    { name: "fallback", method: "PUT", endpoint: "/structures", status: 500, body: { error: "server_error" }, count: 1 },
  ]) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 } });
    await context.addInitScript(({ actor, token }) => {
      const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
        role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
      for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
      localStorage.setItem("devAuthToken", token);
    }, { actor, token });
    await context.route("**/api/**", async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      if (request.method() === "GET") {
        if (pathname === `/api/v2/admin/forms/${fixture.id}/versions`) {
          const response = await route.fetch(), versions = await response.json();
          return route.fulfill({ response, json: versions.map(version =>
            version.id === fixture.version_id ? { ...version, status: "draft", releasedAt: null } : version) });
        }
        return route.continue();
      }
      if (request.method() === scenario.method && pathname.endsWith(scenario.endpoint)) {
        return route.fulfill({ status: scenario.status, contentType: "application/json", body: JSON.stringify(scenario.body) });
      }
      if (!["HEAD", "OPTIONS"].includes(request.method())) {
        report.unexpectedWrites.push({ method: request.method(), pathname });
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
    await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
    const save = page.getByTestId("button-save-form-structure");
    await expect(save).toBeEnabled({ timeout: 30000 });
    if (scenario.name === "failed-release") {
      await page.getByTestId("button-release-version").click();
      await page.getByTestId("button-confirm-release").click();
    } else await save.click();
    const problems = page.getByTestId("text-form-save-error");
    await expect(problems.locator("li")).toHaveCount(scenario.count);
    const text = await problems.innerText();
    if (scenario.status === 400) {
      await expect(problems).not.toContainText(/could not be (saved|released)/);
      await expect(problems).toContainText("Section 1.1");
      if (scenario.name === "failed-save") await expect(problems).toContainText("Point 1.1");
    } else await expect(problems).toContainText("Form settings could not be saved");
    await expect(problems).not.toContainText(/content_html|system_field|SQLSTATE|server_error/);
    await problems.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/${scenario.name}.jpg` });
    report.scenarios.push({ name: scenario.name, status: scenario.status, payload: scenario.body, displayed: text });
    await context.close();
  }
  if (report.errors.length || report.unexpectedWrites.length) throw Error("Unexpected browser errors or mutation attempt.");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fs.writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
