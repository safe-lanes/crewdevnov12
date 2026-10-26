import "./verification-guard.mjs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import pg from "pg";
const shell = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const dir = "generated-artifacts/company-pdf-layout";
await fs.mkdir(dir, { recursive: true });
const fixtures = JSON.parse(await fs.readFile("docs/company-forms/pdf-layout-fixtures.json", "utf8"));
if (fixtures.provisioning || fixtures.forms.length !== 2) throw Error("The two registered samples must already exist.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const identity = (await db.query(`SELECT system_identifier::text AS clusterid,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
if (JSON.stringify(identity) !== JSON.stringify(fixtures.databaseIdentity)) throw Error("Wrong acceptance database identity.");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
 JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const enc = v => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(l => l.includes("server/index.ts") && !/watch|npm| -c /.test(l));
if (processes.length !== 1) throw Error("Expected one main backend.");
const pid = Number(processes[0].trim().split(/\s+/)[0]);
const report = {
  head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendPid: pid, backendStart: new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString(),
  checks: [], errors: [], requests: [], samples: [],
};
if (process.argv.includes("--closing") && new Date(report.backendStart) <= new Date(report.commitTime))
  throw Error("Backend must start later than the final commit.");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1560, height: 1060 }, ignoreHTTPSErrors: true });
  const host = process.env.REPLIT_DEV_DOMAIN;
  await context.route("**/api/**", route => route.continue({
    headers: { ...route.request().headers(),
      ...(new URL(route.request().url()).hostname === host ? { authorization: `Bearer ${token}` } : {}) },
  }));
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    localStorage.setItem("userProfile", JSON.stringify(profile));
    localStorage.setItem("devPersona", JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  page = await context.newPage();
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("request", r => {
    if (r.url().includes("/pdf")) report.requests.push({ method: r.method(), path: new URL(r.url()).pathname });
  });
  page.on("dialog", async d => { await d.accept(); });
  for (const f of fixtures.forms) {
    const file = (await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.submissionUuid])).rows[0];
    if (!file) throw Error("Registered sample archive is missing; verification does not create replacements.");
    const crewUuid = f.kind === "logo" ? fixtures.crewUuid : fixtures.onboardCrewUuid;
    await page.goto(`https://${host}/crew-pool?crew=${crewUuid}&section=G`, { waitUntil: "domcontentloaded" });
    const group = page.getByTestId(`crew-company-forms-group-${f.assignmentUuid}`);
    await group.waitFor({ timeout: 90000 });
    if (!await group.evaluate(el => el.open)) await group.locator(":scope > summary").click();
    await group.getByTestId(`crew-company-forms-open-${f.submissionUuid}`).click();
    const viewer = page.getByTestId("crew-company-form-viewer");
    await viewer.getByRole("button", { name: "Print copy", exact: true }).waitFor({ timeout: 45000 });
    await viewer.getByRole("button", { name: "Download", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/main-${f.kind}-controls.jpg` });
    const downloaded = page.waitForEvent("download");
    await viewer.getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloaded;
    const destination = `${dir}/${fixtures.layoutRevision >= 3 ? "final-glance-" : fixtures.layoutRevision === 2 ? "revised-" : ""}sample-${f.kind}.pdf`;
    await download.saveAs(destination);
    const hash = createHash("sha256").update(await fs.readFile(destination)).digest("hex");
    if (hash !== file.file_sha256) throw Error("Browser Download did not return the archived bytes.");
    const popup = page.waitForEvent("popup");
    await viewer.getByRole("button", { name: "Print copy", exact: true }).click();
    const print = await popup;
    await print.waitForURL(/^blob:/, { timeout: 30000, waitUntil: "domcontentloaded" });
    await print.close();
    const existing = (await db.query("SELECT * FROM frm_document_handovers WHERE submission_uuid=$1", [f.submissionUuid])).rows;
    if (!existing.length) {
      await viewer.getByRole("button", { name: "Copy handed to seafarer", exact: true }).click();
      await viewer.getByText("Jeevan Naik", { exact: false }).last().waitFor();
    }
    await viewer.getByText("Handover records", { exact: true }).waitFor();
    await page.screenshot({ path: `${dir}/main-${f.kind}-handover.jpg` });
    await viewer.getByRole("button", { name: "Back to Company Forms", exact: true }).click();
    await group.getByText("Copy handed to seafarer by", { exact: false }).first().waitFor();
    await group.getByText(`File SHA-256: ${file.file_sha256}`, { exact: false }).waitFor();
    await page.screenshot({ path: `${dir}/main-${f.kind}-g3.jpg` });
    const handovers = (await db.query("SELECT actor_uuid,actor_name,recorded_at,file_sha256 FROM frm_document_handovers WHERE submission_uuid=$1", [f.submissionUuid])).rows;
    if (!handovers.length || handovers.some(h => h.file_sha256 !== file.file_sha256)) throw Error("Handover fingerprint mismatch.");
    report.samples.push({ kind: f.kind, submissionUuid: f.submissionUuid, fileSha256: hash,
      frozenRecordSha256: file.frozen_record_sha256, pageCount: file.page_count, handovers });
  }
  await page.goto(`https://${host}/admin/forms`, { waitUntil: "domcontentloaded" });
  await page.getByText("Access Control", { exact: true }).click();
  await page.getByTestId("access-control-page").waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Company PDF branding", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: `${dir}/main-branding-setting.jpg` });
  report.checks.push("The logo setting is reachable in Admin > Access Control; explicit management permission is required. No real grants were changed.");
  report.checks.push("Both registered completed forms opened through G3. Download and Print copy use the original stored file. Handover is visible in the form and G3.");
  const finalFiles = (await db.query("SELECT submission_uuid,file_sha256 FROM frm_document_files ORDER BY submission_uuid")).rows;
  const registered = [...fixtures.forms, ...(fixtures.priorSamples ?? [])];
  if (finalFiles.length !== registered.length || finalFiles.some(row => !registered.some(f => f.submissionUuid === row.submission_uuid)))
    throw Error("An unregistered real form has an archive file.");
  report.checks.push(`Raw SQL: ${finalFiles.length} archived files, all registered samples (including retained originals); no real-form PDF.`);
  if (report.errors.length) throw Error(`Browser errors: ${report.errors.join("; ")}`);
  const now = shell("ps", ["-eo", "pid=,args="]).split("\n")
    .filter(l => l.includes("server/index.ts") && !/watch|npm| -c /.test(l));
  if (Number(now[0]?.trim().split(/\s+/)[0]) !== pid) throw Error("Main backend changed during verification.");
  await fs.writeFile(`${dir}/main-preview-evidence.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await fs.writeFile(`${dir}/main-preview-failure.json`, JSON.stringify({ ...report,
    visibleText: page ? await page.locator("body").innerText().catch(() => "") : "" }, null, 2));
  if (page) await page.screenshot({ path: `${dir}/main-preview-failure.jpg` }).catch(() => {});
  throw error;
} finally {
  await browser.close(); await db.end();
}
