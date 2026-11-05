// Read-only main-preview verification; no audit, grant or fixture writes.
import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const output = ".local/verification/access-audit-export";
await fs.mkdir(output, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c default_transaction_read_only=on" });
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
if (!actor) throw Error("Existing office development persona unavailable.");
const targetRole = (await db.query(`SELECT a.role_id FROM adm_access_control_audit a
  JOIN adm_rolemaster_ac r ON r.ruid=a.role_id AND NOT r.is_deleted WHERE a.role_id IS NOT NULL ORDER BY a.id DESC LIMIT 1`)).rows[0]?.role_id;
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 1100 } });
await context.addInitScript(({ actor, token }) => {
  const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
    role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
  for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
  localStorage.setItem("devAuthToken", token);
}, { actor, token });
const report = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  evidence: "Existing office development persona; real GET responses; every API mutation blocked",
  errors: [], blockedWrites: [], pages: [], screenshots: [], exports: [] };
await context.route("**/api/**", route => {
  if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
  report.blockedWrites.push(new URL(route.request().url()).pathname);
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
page.on("pageerror", error => report.errors.push(error.message));
page.on("response", async response => {
  if (new URL(response.url()).pathname !== "/api/v2/admin/access-control/audit") return;
  const body = await response.json().catch(() => null);
  report.pages.push({ url: new URL(response.url()).search, status: response.status(),
    total: body?.total, rows: body?.items?.length, unmapped: body?.unmappedKeys, body });
});
const capture = async name => {
  await page.screenshot({ path: `${output}/${name}.jpg` });
  report.screenshots.push(`${name}.jpg`);
};
const exportCsv = async (name, filters = {}) => {
  const exportButton = page.getByRole("button", { name: "Export CSV", exact: true });
  await expect(exportButton).toBeEnabled();
  const total = Number((await page.getByRole("dialog").getByRole("status").innerText()).match(/^\d+/)?.[0]);
  const [download, response] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/v2/admin/access-control/audit" &&
      new URL(response.url()).searchParams.get("export") === "all"),
    exportButton.click(),
  ]);
  expect(download.suggestedFilename()).toBe("access-audit-history.csv");
  const file = `${output}/${name}.csv`;
  await download.saveAs(file);
  const records = JSON.parse(execFileSync("python3", ["-c",
    "import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1], encoding='utf-8', newline='')))))", file], { encoding: "utf8" }));
  const data = await response.json();
  expect(records).toHaveLength(total);
  expect(records.map(row => row["Audit ID"])).toEqual(data.items.map(row => String(row.id)));
  for (const [key, value] of Object.entries(filters)) expect(new URL(response.url()).searchParams.get(key)).toBe(value);
  for (const [index, row] of records.entries()) {
    expect(row["Plain-language sentence"]).toBe(data.items[index].sentence);
    expect(row["Event key"]).toBe(data.items[index].event);
    expect(JSON.parse(row["Recorded actor (JSON)"])).toEqual(data.items[index].actor);
  }
  report.exports.push({ file, rows: records.length, filters, headers: Object.keys(records[0] ?? {}) });
  return records;
};
const waitForAudit = (predicate, action) => Promise.all([
  page.waitForResponse(response => new URL(response.url()).pathname === "/api/v2/admin/access-control/audit" &&
    predicate(new URL(response.url()).searchParams)), action(),
]);
try {
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).first().click({ timeout: 45000 });
  const button = page.getByTestId("button-access-audit-history");
  await expect(button).toBeVisible();
  await expect(page.getByTestId("access-audit-entries")).toHaveCount(0);
  if (report.pages.length) throw Error("Audit fetched while popup was closed.");
  await capture("button");
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("audit-sentence")).toHaveCount(20);
  const sentences = await dialog.getByTestId("audit-sentence").allTextContents();
  if (sentences.some(text => /masterUserId|roleId|training_setting_changed|grant_change|block_missing_expiry|\btrue\b|\bfalse\b|[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(text)))
    throw Error("Technical content in a resting sentence.");
  await expect(dialog.locator("pre")).toHaveCount(0);
  await capture("popup");
  await dialog.locator("summary").first().click();
  await expect(dialog.locator("details").first().locator("dl")).toBeVisible();
  await expect(dialog.locator("pre")).toHaveCount(0);
  expect(await dialog.innerText()).not.toMatch(/auditId|masterUserId|roleId|[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  await capture("details");
  await dialog.locator("summary").first().click();
  const exported = await exportCsv("all-history");
  expect(exported.length).toBeGreaterThan(20);
  const viewer = await context.newPage();
  const html = value => String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  await viewer.setViewportSize({ width: 2600, height: 1000 });
  await viewer.setContent(`<html><head><meta charset="utf-8"><title>Downloaded Access audit CSV</title>
    <style>body{font:14px Arial;padding:20px;color:#162438}table{width:100%;table-layout:fixed;border-collapse:collapse}
    th,td{border:1px solid #ccd6e0;padding:9px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf3fa;text-align:left}
    th:first-child{width:280px}th:nth-child(13),th:nth-child(14){width:240px}</style></head><body>
    <h1>Downloaded Access audit CSV — opened file</h1><p>Actual downloaded file: ${html(output)}/all-history.csv ·
    ${exported.length} entries, including entries beyond page 1. First three records shown below.</p><table><thead><tr>
    ${Object.keys(exported[0]).map(key => `<th>${html(key)}</th>`).join("")}</tr></thead><tbody>
    ${exported.slice(0, 3).map(row => `<tr>${Object.values(row).map(value => `<td>${html(value)}</td>`).join("")}</tr>`).join("")}
    </tbody></table></body></html>`);
  await expect(viewer.getByRole("columnheader", { name: "Plain-language sentence", exact: true })).toBeVisible();
  await expect(viewer.getByRole("columnheader", { name: "Audit ID", exact: true })).toBeVisible();
  await viewer.screenshot({ path: `${output}/export-opened.jpg` });
  report.screenshots.push("export-opened.jpg");
  await viewer.close();
  await waitForAudit(q => q.get("filter") === "void_completed", () => dialog.getByLabel("Event filter").selectOption("void_completed"));
  await expect(dialog.getByTestId("audit-sentence").first()).toContainText("Void completed");
  await capture("event-filter");
  await dialog.getByLabel("Event filter").selectOption("all");
  await waitForAudit(q => q.get("roleId") === targetRole, () => dialog.getByLabel("Audit role").selectOption(targetRole));
  await expect(dialog.getByTestId("audit-sentence").first()).toBeVisible();
  await capture("role-filter");
  await dialog.getByLabel("Audit role").selectOption("");
  const date = report.pages.find(p => p.body?.items?.length)?.body.items[0].recorded_at.slice(0, 10);
  await dialog.getByLabel("From date").fill(date);
  await waitForAudit(q => q.get("from") === date && q.get("to") === date, () => dialog.getByLabel("To date").fill(date));
  await expect(dialog.getByTestId("audit-sentence").first()).toBeVisible();
  await capture("date-filter");
  await dialog.getByLabel("From date").fill("");
  await dialog.getByLabel("To date").fill("");
  await waitForAudit(q => q.get("search") === "Witness", () => dialog.getByLabel("Search history").fill("Witness"));
  await expect(dialog.getByTestId("audit-sentence").first()).toContainText("Witness");
  await capture("search-filter");
  await exportCsv("filtered-history", { search: "Witness", filter: "all" });
  await dialog.getByLabel("Search history").fill("");
  await expect(dialog.getByTestId("audit-sentence")).toHaveCount(20);
  await waitForAudit(q => q.get("page") === "2", () => dialog.getByRole("button", { name: "Next", exact: true }).click());
  await expect(dialog.getByRole("status")).toContainText("Page 2");
  await capture("pagination");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("access-audit-entries")).toHaveCount(0);
  report.unmappedKeys = [...new Set(report.pages.flatMap(p => p.unmapped ?? []))];
  if (report.errors.length || report.blockedWrites.length || report.pages.some(p => p.status !== 200)) throw Error("Browser error, forbidden write, or unsuccessful history request.");
  console.log(JSON.stringify({ screenshots: report.screenshots, unmapped: report.unmappedKeys, errors: report.errors,
    rowsPerPage: Math.max(...report.pages.filter(p => !p.url.includes("export=all")).map(p => p.rows ?? 0)),
    exports: report.exports, head: report.head }, null, 2));
} finally {
  // Store technical evidence outside Git; omit audit bodies from console output.
  await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
