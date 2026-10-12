/** Click-through main-preview evidence; closing mode only reads completed forms. */
import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
const dir = ".local/verification/not-recorded-rank";
const fixtures = JSON.parse(await fs.readFile(`${dir}/fixtures.json`, "utf8"));
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const shell = (...args) => execFileSync(...args, { encoding: "utf8" }).trim();
const closing = process.argv.includes("--closing");
const actor = (await db.query(`SELECT u.id,u.role,u.user_type,r.ruid FROM master_users u
  JOIN adm_rolemaster_ac r ON r.assigned_role=u.role AND r.is_active AND NOT r.is_deleted WHERE u.id=24`)).rows[0];
const enc = v => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${enc({ alg: "none", typ: "JWT" })}.${enc({ id: actor.id, userType: "Office", roleId: actor.ruid, domain: "test" })}.devsig`;
const report = { head: shell("git", ["rev-parse", "HEAD"]), commitTime: shell("git", ["show", "-s", "--format=%cI", "HEAD"]),
  browserActions: [], errors: [], fixtures: [] };
const processes = shell("ps", ["-eo", "pid=,args="]).split("\n").filter(r => r.includes("server/index.ts") && !/watch|npm| -c /.test(r));
if (processes.length !== 1) throw Error("Exactly one main backend required");
report.backendPid = Number(processes[0].trim().split(/\s+/)[0]);
report.backendStart = new Date(shell("ps", ["-p", String(report.backendPid), "-o", "lstart="])).toISOString();
if (closing && new Date(report.backendStart) <= new Date(report.commitTime)) throw Error("Backend must start after final commit");
const browser = await chromium.launch({ executablePath: shell("which", ["chromium"]), headless: true, args: ["--no-sandbox"] });
let page;
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1450, height: 1100 },
    extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  await context.addInitScript(({ actor, token }) => {
    const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.ruid, userType: actor.user_type, myVessels: [] };
    for (const key of ["devPersona", "userProfile"]) localStorage.setItem(key, JSON.stringify(profile));
    localStorage.setItem("devAuthToken", token);
  }, { actor, token });
  page = await context.newPage();
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("response", r => {
    if (r.request().method() !== "GET" && r.url().includes("/company-form-submissions/"))
      report.browserActions.push({ method: r.request().method(), path: new URL(r.url()).pathname, status: r.status() });
  });
  for (const fixture of fixtures) {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/crew-pool?crew=${fixture.crew}&section=G`, { waitUntil: "domcontentloaded" });
    const group = page.getByTestId(`crew-company-forms-group-${fixture.assignment}`);
    await group.waitFor({ timeout: 45000 });
    if (!(await group.evaluate(el => el.open))) await group.locator(":scope > summary").click();
    const panel = group.getByTestId(`assignment-form-requirements-${fixture.assignment}`);
    await panel.getByText(fixture.formName, { exact: false }).waitFor();
    report.currentPanel = await panel.innerText();
    if (!closing) {
      const start = panel.getByRole("button", { name: "Start required form", exact: true });
      if (await start.count()) await start.click();
      else await panel.getByRole("button", { name: "Open linked form", exact: true }).click();
      for (const type of ["officer", "seafarer"]) {
        const saved = page.getByTestId(`preview-signature-${type}-${fixture.section}`);
        await saved.waitFor({ timeout: 30000 });
        if (await saved.getByText("Date:", { exact: true }).count()) continue;
        const pad = page.getByTestId(`live-signature-${type}-${fixture.section}`);
        await pad.waitFor({ timeout: 30000 });
        if (type === "seafarer") await page.getByRole("checkbox", { name: /Seafarer.*present|present.*Seafarer/i }).check();
        const canvas = pad.locator("canvas");
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        if (!box) throw Error("Signature canvas must be visible");
        await page.mouse.move(box.x + 25, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 75, { steps: 12 });
        await page.mouse.move(box.x + 170, box.y + 35, { steps: 12 });
        await page.mouse.up();
        const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().includes(`/sections/${fixture.section}/signatures`));
        await pad.getByRole("button", { name: /Save/i }).click();
        if ((await response).status() !== 201) throw Error(`${type} signing failed`);
        await page.getByTestId(`preview-signature-${type}-${fixture.section}`).waitFor();
      }
      const signature = page.getByTestId(`preview-signature-seafarer-${fixture.section}`);
      await signature.getByText(fixture.expectedRank, { exact: false }).waitFor({ timeout: 30000 });
      const system = page.getByTestId(`preview-content-${fixture.rankQuestion}`);
      if (!(await system.innerText()).includes(fixture.expectedRank)) throw Error("Rank System field disagrees");
      await signature.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/${fixture.missing ? "missing" : "captured"}-signed.jpg` });
      const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().includes(`/sections/${fixture.section}/submit`));
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /Confirm|Submit|Yes/i }).click();
      const submitted = await response;
      if (submitted.status() !== 200 || !(await submitted.json()).completed) throw Error("Submit did not complete the form");
      await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/crew-pool?crew=${fixture.crew}&section=G`, { waitUntil: "domcontentloaded" });
      await group.waitFor({ timeout: 30000 });
      if (!(await group.evaluate(el => el.open))) await group.locator(":scope > summary").click();
    }
    await panel.getByRole("button", { name: "Open completed form", exact: true }).waitFor({ timeout: 30000 });
    report.currentPanel = await panel.innerText();
    await panel.getByRole("button", { name: "Open completed form", exact: true }).click();
    const signature = page.getByTestId(`preview-signature-seafarer-${fixture.section}`);
    await signature.waitFor({ timeout: 30000 });
    const system = page.getByTestId(`preview-content-${fixture.rankQuestion}`);
    if (!(await signature.innerText()).includes(fixture.expectedRank) || !(await system.innerText()).includes(fixture.expectedRank))
      throw Error("Completed form's frozen rank does not agree");
    await signature.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${closing ? "closing" : "initial"}-${fixture.missing ? "missing" : "captured"}-completed.jpg` });
    const rows = (await db.query(`SELECT r.status,s.status AS form_status,s.submission_uuid,g.signer_rank,
      ss.value AS rank_field,ss.system_value FROM frm_requirements r JOIN frm_company_submissions s
      ON s.submission_uuid=r.current_submission_uuid JOIN frm_section_states st ON st.submission_uuid=s.submission_uuid
      JOIN frm_section_signatures g USING(section_state_uuid) JOIN frm_company_submission_system_snapshots ss
      ON ss.submission_uuid=s.submission_uuid AND ss.field_key='rank'
      WHERE r.requirement_uuid=$1 AND g.signature_type='seafarer'`, [fixture.requirement])).rows;
    if (rows.length !== 1 || rows[0].status !== "COMPLETED" || rows[0].form_status !== "completed"
      || rows[0].signer_rank !== fixture.expectedRank || rows[0].rank_field !== fixture.expectedRank) throw Error("SQL evidence disagrees");
    report.fixtures.push({ ...fixture, ...rows[0] });
  }
  if (report.errors.length) throw Error("Browser page errors occurred");
  if (shell("git", ["rev-parse", "HEAD"]) !== report.head) throw Error("HEAD changed during verification");
  report.passed = true;
} finally {
  if (!report.passed && page) {
    await page.screenshot({ path: `${dir}/browser-diagnostic.jpg` });
    report.lastScreen = (await page.locator("body").innerText()).slice(-4500);
  }
  await fs.writeFile(`${dir}/${closing ? "closing" : "initial"}-browser-evidence.json`, JSON.stringify(report, null, 2));
  await browser.close(); await db.end();
}
console.log(JSON.stringify({ passed: report.passed, head: report.head, backendStart: report.backendStart,
  forms: report.fixtures.map(f => ({ missing: f.missing, rank: f.signer_rank, status: f.status })) }));
