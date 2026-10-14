import "./verification-guard.mjs";
import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

const dir = ".local/verification/required-signing";
const fixture = JSON.parse(await fs.readFile(`${dir}/fixture.json`, "utf8"));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const actor = (await db.query("SELECT id,role,user_type FROM master_users WHERE id=24")).rows[0];
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, userType: actor.user_type, domain: "test" })}.devsig`;
const report = { head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  operations: [], screenshots: [], errors: [] };
const pidLine = shell("ps", ["-eo", "pid=,args="]).split("\n")
  .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
if (pidLine.length !== 1) throw Error("One main backend is required.");
report.backendPid = Number(pidLine[0].trim().split(/\s+/)[0]);
report.backendStart = new Date(shell("ps", ["-p", String(report.backendPid), "-o", "lstart="])).toISOString();
const closing = process.argv.includes("--closing");
if (closing && new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Restart after final commit is required.");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: true, args: ["--no-sandbox"] });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  await context.addInitScript(({ actor, token }) => {
    const persona = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, userType: actor.user_type, myVessels: [] };
    localStorage.setItem("devPersona", JSON.stringify(persona));
    localStorage.setItem("userProfile", JSON.stringify(persona));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  page = await context.newPage();
  page.on("response", response => {
    if (response.request().method() !== "GET" && response.url().includes("/company-form-submissions/"))
      report.operations.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
  });
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/crew-pool?crew=${fixture.crew}&section=G`, { waitUntil: "domcontentloaded" });
  const group = page.getByTestId(`crew-company-forms-group-${fixture.assignment}`);
  await group.waitFor({ timeout: 45000 });
  if (!(await group.evaluate(el => el.open))) await group.locator(":scope > summary").click();
  const panel = group.getByTestId(`assignment-form-requirements-${fixture.assignment}`);
  await panel.getByText("SL01 Pre-Joining Declaration", { exact: false }).first().waitFor();
  await page.screenshot({ path: `${dir}/${closing ? "closing" : "initial"}-requirement.jpg` });
  if (!closing) {
    await panel.getByRole("button", { name: "Start required form", exact: true }).click();
    const officer = page.locator('[data-testid^="live-signature-officer-"]');
    await officer.waitFor({ timeout: 30000 });
    const section = (await officer.getAttribute("data-testid")).replace("live-signature-officer-", "");
    for (const type of ["officer", "seafarer"]) {
      const pad = page.getByTestId(`live-signature-${type}-${section}`);
      await pad.waitFor({ timeout: 30000 });
      if (type === "seafarer") {
        const checkbox = page.getByRole("checkbox", { name: /Seafarer.*present|present.*Seafarer/i });
        await checkbox.check();
      }
      const canvas = pad.locator("canvas");
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (!box) throw Error("Visible signature canvas required.");
      await page.mouse.move(box.x + 30, box.y + 45);
      await page.mouse.down();
      await page.mouse.move(box.x + 115, box.y + 70, { steps: 12 });
      await page.mouse.move(box.x + 175, box.y + 35, { steps: 12 });
      await page.mouse.up();
      const response = page.waitForResponse(res => res.request().method() === "POST" && res.url().includes(`/sections/${section}/signatures`));
      await pad.getByRole("button", { name: /Save/i }).click();
      const saved = await response;
      if (saved.status() !== 201) throw Error(`${type} signature save returned ${saved.status()}`);
      const savedBlock = page.getByTestId(`preview-signature-${type}-${section}`);
      if (type === "officer") await savedBlock.getByRole("button", { name: "Remove signature", exact: true }).waitFor();
      else await savedBlock.getByText(/Signed in the presence of/i).waitFor();
      await page.screenshot({ path: `${dir}/${type}-saved.jpg` });
    }
    const submitResponse = page.waitForResponse(res => res.request().method() === "POST" && res.url().includes(`/sections/${section}/submit`));
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const confirmation = page.getByRole("alertdialog");
    await confirmation.getByRole("button", { name: /Confirm|Submit|Yes/i }).click();
    if ((await submitResponse).status() !== 200) throw Error("Section submission failed.");
    await page.getByText("Submitted", { exact: true }).waitFor();
    await page.screenshot({ path: `${dir}/submitted.jpg` });
    // Return to the requirement screen to verify its refreshed status.
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/crew-pool?crew=${fixture.crew}&section=G`, { waitUntil: "domcontentloaded" });
    await group.waitFor({ timeout: 30000 });
    if (!(await group.evaluate(el => el.open))) await group.locator(":scope > summary").click();
  }
  await panel.getByText("Completed", { exact: true }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${dir}/${closing ? "closing" : "initial"}-completed.jpg` });
  if (closing) {
    await panel.getByRole("button", { name: "Open completed form", exact: true }).click();
    await page.locator('[data-testid^="preview-signature-officer-"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid^="preview-signature-seafarer-"]').waitFor({ timeout: 30000 });
    await page.getByText(/Signed in the presence of/i).waitFor({ timeout: 30000 });
    await page.locator('[data-testid^="preview-signature-seafarer-"]').scrollIntoViewIfNeeded();
    if (await page.locator('[data-testid^="live-signature-"] canvas').count())
      throw Error("The completed form must not offer an editable signature canvas.");
    await page.screenshot({ path: `${dir}/closing-signed-form.jpg` });
    report.screenshots.push(`${dir}/closing-completed.jpg`, `${dir}/closing-signed-form.jpg`);
  } else {
    report.screenshots.push(`${dir}/initial-completed.jpg`, `${dir}/officer-saved.jpg`, `${dir}/seafarer-saved.jpg`, `${dir}/submitted.jpg`);
  }
  const result = (await db.query(`SELECT r.status,s.status AS form_status,s.submission_uuid
    FROM frm_requirements r JOIN frm_company_submissions s ON s.submission_uuid=r.current_submission_uuid
    WHERE r.requirement_uuid=$1`, [fixture.requirement])).rows[0];
  if (result?.status !== "COMPLETED" || result.form_status !== "completed") throw Error("Required form did not complete.");
  const signatures = (await db.query(`SELECT g.signature_type,g.signature_method,g.signer_rank,g.witness_user_id,
    g.section_signature_uuid,g.signature_att_uuid FROM frm_section_signatures g
    JOIN frm_section_states st USING(section_state_uuid) WHERE st.submission_uuid=$1 AND NOT g.is_deleted`, [result.submission_uuid])).rows;
  if (signatures.length !== 2 || !signatures.some(s => s.signature_type === "seafarer" && s.signature_method === "witnessed" && s.witness_user_id === actor.id))
    throw Error("Both persisted signatures and the authenticated witness are required.");
  report.result = result;
  report.signatures = signatures;
  report.contractRank = (await db.query(`SELECT c.contract_rank_uuid,r.name AS rank
    FROM crew_assignment_rule_context c JOIN adm_available_ranks_v2 r ON r.ar_uuid=c.contract_rank_uuid
    WHERE c.assign_uuid=$1`, [fixture.assignment])).rows[0];
  if (signatures.find(s => s.signature_type === "seafarer").signer_rank !== report.contractRank?.rank)
    throw Error("The signature rank did not match the captured contract UUID.");
  if (!closing) {
    const refs = [result.submission_uuid, ...signatures.flatMap(s => [s.section_signature_uuid, s.signature_att_uuid])];
    await fs.appendFile("docs/company-form-regression-fixtures.md",
      `\n- SL01 clicked-through required-form signing descendants retained: ${refs.map(id => `\`${id}\``).join(", ")}. Original released definition unchanged; no crew or assignment deletion.\n`);
  }
  if (report.operations.some(op => op.status >= 400) || report.errors.length) throw Error("Unexpected browser request or rendering failure.");
  if (shell("git", ["rev-parse", "HEAD"]) !== report.head) throw Error("HEAD changed during verification.");
  if (!shell("ps", ["-p", String(report.backendPid), "-o", "pid="])) throw Error("Main backend changed during verification.");
  report.passed = true;
} catch (error) {
  if (page) await page.screenshot({ path: `${dir}/failure.jpg` }).catch(() => {});
  report.failure = error.message;
  report.passed = false;
} finally {
  await fs.writeFile(`${dir}/${closing ? "closing" : "initial"}-evidence.json`, JSON.stringify(report, null, 2));
  await browser.close();
  await db.end();
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
