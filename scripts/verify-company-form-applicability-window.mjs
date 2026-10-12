import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { chromium, expect } from "@playwright/test";

const directory = ".local/verification/company-form-applicability-window";
await fs.mkdir(directory, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted
  WHERE u.id=24`)).rows[0];
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({
  id: actor.id, roleId: actor.ruid, userType: "Office", domain: "test",
})}.devsig`;
const before = process.argv.includes("--before");
const closing = process.argv.includes("--closing");
const fixturePath = `${directory}/fixture.json`;
const fixture = before ? (await db.query(`SELECT f.id AS form_id,f.form_uuid,f.name,
  v.id AS version_id,v.fv_uuid,v.version_no
  FROM adm_forms_v2 f JOIN adm_form_versions_v2 v ON v.form_id=f.id
  WHERE f.name LIKE 'TEST ONLY Rule editor %' AND NOT f.is_deleted AND v.status='draft'
  ORDER BY f.id DESC,v.id DESC LIMIT 1`)).rows[0]
  : JSON.parse(await fs.readFile(fixturePath, "utf8"));
if (!fixture) throw Error("Retained registered authoring fixture required");
if (before) await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2));
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]),
  args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const report = { head: shell("git", ["rev-parse", "HEAD"]), fixture };
report.commitTime = shell("git", ["show", "-s", "--format=%cI", "HEAD"]);
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(row => row.includes("server/index.ts") && !/watch|npm| -c /.test(row));
if (processes.length !== 1) throw Error("Exactly one main backend required");
report.backendPid = Number(processes[0].trim().split(/\s+/)[0]);
report.backendStart = new Date(shell("ps", ["-p", String(report.backendPid), "-o", "lstart="])).toISOString();
if (closing && new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Closing backend must start after final commit");
let page;
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1560, height: 1100 } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  page = await context.newPage();
  report.errors = [];
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("tab-company-forms").click({ timeout: 45000 });
  await page.getByRole("button", { name: `Configure ${fixture.name}`, exact: true }).click();
  if (before) {
    await page.getByTestId("company-form-applicability-editor").waitFor({ timeout: 30000 });
    await page.getByTestId("applicability-summary").waitFor();
    await page.screenshot({ path: `${directory}/before.jpg` });
  } else {
    const summary = page.getByTestId("company-form-applicability-summary");
    await expect(summary).not.toContainText("Loading", { timeout: 30000 });
    await expect(page.getByTestId("company-form-applicability-editor")).toHaveCount(0);
    await expect(page.getByTestId("select-form-version")).toHaveText(`v${fixture.version_no} · Draft`);
    await page.screenshot({ path: `${directory}/${closing ? "closing" : "after"}-editor.jpg` });
    await page.getByTestId("button-toggle-applicability-settings").click();
    const window = page.getByTestId("company-form-applicability-window");
    await window.getByTestId("applicability-summary").waitFor();
    const trial = window.getByTestId("company-form-rule-trial");
    await expect(trial).toBeVisible();
    const originalObligation = await window.getByLabel(/^mandatory$/i).isChecked() ? "mandatory" : "optional";
    const otherObligation = originalObligation === "mandatory" ? "optional" : "mandatory";
    report.confirmations = [];
    let acceptDialogs = true;
    page.on("dialog", async dialog => {
      report.confirmations.push({ message: dialog.message(), accepted: acceptDialogs });
      await (acceptDialogs ? dialog.accept() : dialog.dismiss());
    });
    const save = async () => {
      const response = page.waitForResponse(response => response.request().method() === "PUT"
        && response.url().endsWith(`/form-versions/${fixture.version_id}/applicability`));
      await window.getByTestId("button-save-applicability").click();
      const result = await response;
      if (result.status() !== 200) throw Error(`Saving through window returned ${result.status()}`);
      await expect(window.getByText("Policy saved", { exact: false })).toBeVisible();
    };
    if (!closing) {
      // Only a retained draft is edited; never release an automatic rule or start an operational form.
      await window.getByLabel(new RegExp(`^${otherObligation}$`, "i")).check();
      await save();
      report.savedSummary = await window.getByTestId("applicability-summary").innerText();
      await window.screenshot({ path: `${directory}/saved-settings.jpg` });
      await window.getByLabel(new RegExp(`^${originalObligation}$`, "i")).check();
      acceptDialogs = false;
      await window.getByRole("button", { name: "Close", exact: true }).click();
      await expect(window).toBeVisible();
      acceptDialogs = true;
      await window.getByRole("button", { name: "Close", exact: true }).click();
      await expect(window).toHaveCount(0);
      await expect(summary).toContainText(otherObligation, { ignoreCase: true });
      await page.getByTestId("button-toggle-applicability-settings").click();
      await window.getByLabel(new RegExp(`^${otherObligation}$`, "i")).check();
      await window.getByLabel(new RegExp(`^${originalObligation}$`, "i")).check();
      await save();
      // These mode changes are local-only. Closing discards them and restores the saved conditional rule.
      await window.getByRole("radio", { name: "Applies to all", exact: true }).click();
      await expect(trial).toHaveCount(0);
      await window.screenshot({ path: `${directory}/all-no-trial.jpg` });
      await window.getByRole("radio", { name: "Manual only", exact: true }).click();
      await expect(trial).toHaveCount(0);
      await window.screenshot({ path: `${directory}/manual-no-trial.jpg` });
      report.trialVisibility = { conditional: true, all: false, manualOnly: false };
    }
    await window.getByRole("button", { name: "Close", exact: true }).click();
    await expect(window).toHaveCount(0);
    // Use an already-released version: presentation evidence must not introduce a new live rule.
    const released = (await db.query(`SELECT id,fv_uuid,version_no FROM adm_form_versions_v2
      WHERE form_id=$1 AND status='released' ORDER BY id DESC LIMIT 1`, [fixture.form_id])).rows[0];
    if (!released) throw Error("Retained released version required");
    await page.getByTestId("select-form-version").click();
    await page.getByRole("option", { name: new RegExp(`^v${released.version_no} · Released`) }).click();
    await expect(summary).not.toContainText("Loading", { timeout: 30000 });
    await expect(page.getByTestId("button-toggle-applicability-settings")).toHaveText("View");
    await page.getByTestId("button-toggle-applicability-settings").click();
    await window.getByTestId("applicability-summary").waitFor();
    await expect(window.getByRole("heading", { name: "Applicability settings — read only" })).toBeVisible();
    await expect(window.getByRole("radio", { name: "Applies when conditions match", exact: true })).toBeDisabled();
    await expect(window.getByLabel("Crew detail", { exact: true }).first()).toBeDisabled();
    await expect(window.getByTestId("button-save-applicability")).toHaveCount(0);
    await expect(trial).toHaveCount(0);
    await window.screenshot({ path: `${directory}/${closing ? "closing" : "initial"}-released.jpg` });
    report.releasedReadOnly = true;
    report.draftPolicy = (await db.query(`SELECT mode,obligation,effective_kind FROM frm_version_applicability
      WHERE version_uuid=$1`, [fixture.fv_uuid])).rows[0];
    if (report.draftPolicy.mode !== "conditional" || report.draftPolicy.obligation !== originalObligation)
      throw Error("Saved original draft policy was not restored");
    if (report.errors.length) throw Error("Browser page errors occurred");
  }
  if (shell("git", ["rev-parse", "HEAD"]) !== report.head) throw Error("HEAD changed during evidence");
  if (new Date(shell("ps", ["-p", String(report.backendPid), "-o", "lstart="])).toISOString() !== report.backendStart)
    throw Error("Main backend changed during evidence");
  report.passed = true;
  await fs.writeFile(`${directory}/${before ? "before" : closing ? "closing" : "initial"}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  report.error = String(error);
  if (page) {
    await page.screenshot({ path: `${directory}/diagnostic.jpg` });
    report.screen = (await page.locator("body").innerText()).slice(-5000);
  }
  await fs.writeFile(`${directory}/failure.json`, JSON.stringify(report, null, 2));
  throw error;
} finally { await browser.close(); await db.end(); }
