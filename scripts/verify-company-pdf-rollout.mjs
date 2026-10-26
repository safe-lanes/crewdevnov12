import "./verification-guard.mjs";
import fs from "node:fs/promises";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
const dir = "generated-artifacts/company-pdf-rollout";
await fs.mkdir(dir, { recursive: true });
const fixture = JSON.parse(await fs.readFile("docs/company-forms/pdf-rollout-fixtures.json", "utf8"));
const queued = JSON.parse(await fs.readFile(`${dir}/queue-before.json`, "utf8"))[0];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const identity = (await db.query(`SELECT system_identifier::text AS clusterid,
 (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS databaseoid FROM pg_control_system()`)).rows[0];
if (JSON.stringify(identity) !== JSON.stringify(fixture.databaseIdentity)) throw Error("Wrong main-preview database.");
const shell = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
const backend = () => shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(l => l.includes("server/index.ts") && !/watch|npm| -c /.test(l));
if (backend().length !== 1) throw Error("Expected one main backend.");
const pid = Number(backend()[0].trim().split(/\s+/)[0]);
const report = {
  head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  backendPid: pid, backendStart: new Date(shell("ps", ["-p", String(pid), "-o", "lstart="])).toISOString(),
  errors: [], operations: [], documents: [],
};
if (process.argv.includes("--closing") && new Date(report.backendStart) <= new Date(report.commitTime))
  throw Error("Backend must start after final commit.");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
 JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const enc = x => Buffer.from(JSON.stringify(x)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: 24, userType: "Office", domain: "test" })}.devsig`;
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
let page;
try {
  const host = process.env.REPLIT_DEV_DOMAIN;
  const context = await browser.newContext({ viewport: { width: 1560, height: 1060 }, ignoreHTTPSErrors: true });
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
  page.on("response", r => {
    if (r.url().includes("/company-form-submissions/") && r.request().method() === "POST")
      report.operations.push({ method: "POST", path: new URL(r.url()).pathname, status: r.status() });
  });
  async function open(crew, assignment, submission) {
    await page.goto(`https://${host}/crew-pool?crew=${crew}&section=G`, { waitUntil: "domcontentloaded" });
    const group = page.getByTestId(`crew-company-forms-group-${assignment}`);
    await group.waitFor({ timeout: 90000 });
    if (!await group.evaluate(el => el.open)) await group.locator(":scope > summary").click();
    await group.getByTestId(`crew-company-forms-open-${submission}`).click();
    const viewer = page.getByTestId("crew-company-form-viewer");
    await viewer.waitFor({ timeout: 30000 });
    return viewer;
  }
  if (!process.argv.includes("--closing")) {
    const saved = (await db.query("SELECT status FROM frm_company_submissions WHERE submission_uuid=$1", [fixture.submissionUuid])).rows[0];
    if (saved.status !== "completed") {
      await open(fixture.crewUuid, fixture.assignmentUuid, fixture.submissionUuid);
      await page.getByTestId(`live-signature-officer-${fixture.sectionUuid}`)
        .or(page.getByTestId(`preview-signature-officer-${fixture.sectionUuid}`)).first().waitFor({ timeout: 45000 });
      for (const type of ["officer", "seafarer"]) {
        const pad = page.getByTestId(`live-signature-${type}-${fixture.sectionUuid}`);
        if (!await pad.count()) continue;
        if (type === "seafarer") await page.getByRole("checkbox", { name: /Seafarer is present/i }).check();
        await pad.locator("canvas").scrollIntoViewIfNeeded();
        const box = await pad.locator("canvas").boundingBox();
        if (!box) throw Error("Visible signature canvas required.");
        await page.mouse.move(box.x + 30, box.y + 45); await page.mouse.down();
        await page.mouse.move(box.x + 115, box.y + 70, { steps: 12 });
        await page.mouse.move(box.x + 175, box.y + 35, { steps: 12 }); await page.mouse.up();
        const [response] = await Promise.all([
          page.waitForResponse(r => r.request().method() === "POST" && r.url().includes(`/sections/${fixture.sectionUuid}/signatures`)),
          pad.getByRole("button", { name: /Save/i }).click(),
        ]);
        if (response.status() !== 201) throw Error("Signature failed.");
        await page.getByTestId(`preview-signature-${type}-${fixture.sectionUuid}`).waitFor();
      }
      const [submitted] = await Promise.all([
        page.waitForResponse(r => r.request().method() === "POST" && r.url().includes(`/sections/${fixture.sectionUuid}/submit`)),
        (async () => {
          await page.getByRole("button", { name: "Submit", exact: true }).click();
          await page.getByRole("alertdialog").getByRole("button", { name: /Confirm|Submit|Yes/i }).click();
        })(),
      ]);
      if (submitted.status() !== 200) throw Error("Submit failed.");
      await page.getByText("Submitted", { exact: true }).waitFor();
      await page.screenshot({ path: `${dir}/new-form-completed.jpg` });
    }
  }
  const queuedCrew = (await db.query("SELECT crew_uuid FROM crew_assignments WHERE assign_uuid=$1", [queued.subject_ref])).rows[0].crew_uuid;
  for (const f of [
    { kind: "queued", crew: queuedCrew, assignment: queued.subject_ref, submission: queued.submission_uuid },
    { kind: "automatic-fixture", crew: fixture.crewUuid, assignment: fixture.assignmentUuid, submission: fixture.submissionUuid },
  ]) {
    // Poll persistence only; never call retry/preparation APIs for automatic evidence.
    let file;
    for (let i = 0; i < 30 && !file; i++) {
      file = (await db.query("SELECT * FROM frm_document_files WHERE submission_uuid=$1", [f.submission])).rows[0];
      if (!file) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!file) throw Error("Automatic archive not prepared.");
    const viewer = await open(f.crew, f.assignment, f.submission);
    await viewer.getByRole("button", { name: "Print copy", exact: true }).waitFor({ timeout: 45000 });
    await viewer.getByRole("button", { name: "Download", exact: true }).scrollIntoViewIfNeeded();
    await viewer.getByText("Document reference:", { exact: false }).waitFor();
    const reference = await viewer.getByText("Document reference:", { exact: false }).textContent();
    await page.screenshot({ path: `${dir}/${process.argv.includes("--closing") ? "closing-" : ""}${f.kind}-controls.jpg` });
    const event = page.waitForEvent("download");
    await viewer.getByRole("button", { name: "Download", exact: true }).click();
    const download = await event;
    const path = `${dir}/${f.kind}.pdf`;
    await download.saveAs(path);
    if (createHash("sha256").update(await fs.readFile(path)).digest("hex") !== file.file_sha256) throw Error("Download bytes differ.");
    const popup = page.waitForEvent("popup");
    await viewer.getByRole("button", { name: "Print copy", exact: true }).click();
    const print = await popup;
    await print.waitForURL(/^blob:/, { timeout: 30000, waitUntil: "domcontentloaded" }); await print.close();
    report.documents.push({ ...f, reference, fileSha256: file.file_sha256, frozenRecordSha256: file.frozen_record_sha256,
      pages: file.page_count, createdAt: file.created_at });
  }
  const after = (await db.query("SELECT * FROM frm_document_snapshots WHERE submission_uuid=$1", [queued.submission_uuid])).rows[0];
  if (after.frozen_record_sha256 !== queued.frozen_record_sha256 || JSON.stringify(after.input) !== JSON.stringify(queued.input))
    throw Error("Queued frozen snapshot changed.");
  if ((await db.query("SELECT 1 FROM frm_document_samples WHERE submission_uuid=$1", [fixture.submissionUuid])).rowCount)
    throw Error("The new fixture must prove ordinary generation, not a sample exception.");
  report.pending = (await db.query(`SELECT count(*)::int AS n FROM frm_document_preparation_requests r
    LEFT JOIN frm_document_files f USING(submission_uuid) WHERE r.outcome='PENDING' AND f.file_uuid IS NULL`)).rows[0].n;
  if (report.errors.length || report.operations.some(o => o.status >= 400)) throw Error("Browser failure.");
  if (report.operations.some(o => /pdf\/retry/.test(o.path))) throw Error("Automatic evidence must not request PDF retry.");
  if (Number(backend()[0].trim().split(/\s+/)[0]) !== pid) throw Error("Backend changed.");
  report.queuedFrozenEvidenceUnchanged = true;
  report.passed = true;
} catch (error) {
  report.failure = error.message; report.passed = false;
  if (page) await page.screenshot({ path: `${dir}/failure.jpg` }).catch(() => {});
} finally {
  await fs.writeFile(`${dir}/${process.argv.includes("--closing") ? "closing" : "initial"}-evidence.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.end();
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
