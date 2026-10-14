import "./verification-guard.mjs";
// Development-only browser evidence against the existing managed main preview.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium } from "@playwright/test";

if (process.env.AUTH_BYPASS !== "true") throw Error("Existing development authentication bypass required.");
const root = ".local/verification/access-control-management";
await fs.mkdir(root, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const token = actor => {
  const encode = data => Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, userType: actor.userType, domain: "test" })}.dev-bypass`;
};
const ensure = (value, message) => { if (!value) throw Error(message); };
const save = (name, value) => fs.writeFile(`${root}/${name}`, JSON.stringify(value, null, 2));
function pid() {
  const rows = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" }).split("\n")
    .filter(line => line.includes("server/index.ts") && !/watch|npm| -c /.test(line));
  ensure(rows.length === 1, "Exactly one main backend required");
  return rows[0].trim().split(/\s+/)[0];
}
async function api(actor, method, path, body, expected = 200) {
  const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token(actor)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  ensure(res.status === expected, `${method} ${path}: ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
async function prepare() {
  const state = (await db.query("SELECT category_ready FROM adm_access_control_state")).rows[0];
  ensure(state?.category_ready === false, "Main-preview fixture requires interim category state; do not reset readiness.");
  ensure((await db.query("SELECT count(*)::int AS n FROM adm_resource_action_grants WHERE resource='access_control' AND action='manage' AND allowed=true")).rows[0].n === 0,
    "Refuse to remove any existing management decision for fixture preparation.");
  const support = (await db.query(`SELECT u.id,u.user_type AS "userType",r.ruid AS "roleUuid",r.assigned_role AS role
    FROM master_users u JOIN adm_rolemaster_ac r ON lower(trim(r.assigned_role))=lower(trim(u.role))
    WHERE u.id=1 AND r.is_active AND NOT r.is_deleted AND r.parent_owned`)).rows[0];
  ensure(support && support.role === "Sail Admin", "Existing trusted bootstrap source unavailable.");
  const actors = {};
  for (const [key, prefix] of [["ordinary", "TEST ONLY AC MANAGER"], ["target", "TEST ONLY AC REVIEWER"]]) {
    const roleUuid = randomUUID(), role = `${prefix} ${roleUuid.slice(0, 8)}`;
    await db.query("INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted,parent_owned) VALUES ($1,$2,'Office',true,false,true)", [roleUuid, role]);
    const user = (await db.query(`INSERT INTO master_users(user_uuid,firstname,lastname,email,fullname,user_type,role)
      VALUES ($1,'TEST ONLY','Access Control',$2,'TEST ONLY Access Control','Office',$3) RETURNING id`,
      [randomUUID(), `test-ac-${roleUuid}@example.invalid`, role])).rows[0];
    actors[key] = { id: user.id, userType: "Office", roleUuid, role };
  }
  await save("fixture.json", { support, ...actors });
  console.log("Prepared test-owned roles/users only. Protected parent identities/categories unchanged.");
}
async function verify() {
  const fixture = JSON.parse(await fs.readFile(`${root}/fixture.json`, "utf8"));
  const { support, ordinary, target } = fixture;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const commitTime = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
  const backendPid = pid();
  const backendStart = execFileSync("ps", ["-p", backendPid, "-o", "lstart="], { encoding: "utf8" }).trim();
  if (process.argv.includes("--closing")) ensure(new Date(backendStart) > new Date(commitTime), "Main backend must start after final source commit.");
  const report = { head, commitTime, backendPid, backendStart, base, checks: [], screenshots: [] };
  const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  async function pageFor(actor) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1580, height: 1150 },
      extraHTTPHeaders: { Authorization: `Bearer ${token(actor)}` } });
    await context.addInitScript(({ actor, auth }) => {
      const profile = { personaKey: "crewing-executive", masterUserId: actor.id, userId: String(actor.id),
        role: actor.role, roleId: actor.roleUuid, userType: actor.userType, myVessels: [] };
      for (const key of ["userProfile", "devPersona"]) localStorage.setItem(key, JSON.stringify(profile));
      localStorage.setItem("devAuthToken", auth);
    }, { actor, auth: token(actor) });
    const page = await context.newPage();
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("sidebar-item-access-control").click({ timeout: 45000 });
    await page.getByTestId("access-control-page").waitFor({ timeout: 30000 });
    await page.getByRole("heading", { name: "Management grants", exact: true }).waitFor();
    return page;
  }
  const shoot = async (page, name) => { await page.screenshot({ path: `${root}/${name}.png`, fullPage: true }); report.screenshots.push(`${root}/${name}.png`); };
  async function select(page, actor) {
    await page.locator("#management-role-select").selectOption(actor.roleUuid);
    await page.getByRole("checkbox", { name: "Management access granted", exact: true }).waitFor();
    await page.waitForTimeout(300);
  }
  async function grant(page, actor, allowed) {
    await select(page, actor);
    const toggle = page.getByRole("checkbox", { name: "Management access granted", exact: true });
    ensure(await toggle.getAttribute("data-state") === (allowed ? "unchecked" : "checked"), "Stored management decision differs from fixture precondition");
    await toggle.click();
    const response = page.waitForResponse(r => r.url().endsWith(`/roles/${actor.roleUuid}/management`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Save grant", exact: true }).click();
    const result = await response; ensure(result.status() === 200, `Management save failed: ${await result.text()}`);
    await page.waitForTimeout(600);
  }
  try {
    const initial = await api(support, "GET", "/api/v2/admin/access-control/state");
    ensure(initial.mode === "name_bootstrap" || initial.mode === "management", "Trusted support unavailable");
    const supportPage = await pageFor(support);
    await shoot(supportPage, initial.mode === "name_bootstrap" ? "01-zero-manager-bootstrap" : "01-support-explicit-management");
    if (initial.mode === "name_bootstrap") await grant(supportPage, support, true);
    ensure((await api(support, "GET", "/api/v2/admin/access-control/state")).mode === "management", "Support self-grant did not replace fallback");
    if ((await api(support, "GET", `/api/v2/admin/access-control/roles/${ordinary.roleUuid}/management`)).allowed)
      await grant(supportPage, ordinary, false);
    await grant(supportPage, ordinary, true);
    await grant(supportPage, support, false);
    await api(support, "GET", "/api/v2/admin/access-control/state", undefined, 403);
    report.checks.push("Support self-granted via screen, granted ordinary manager, revoked own non-last grant; ungranted named support immediately denied.");

    const managerPage = await pageFor(ordinary);
    ensure(await managerPage.getByTestId("sidebar-item-approval-workflow").count() === 0,
      "Management must not confer unrelated Approval Workflow navigation");
    await select(managerPage, target);
    const view = managerPage.getByTestId("company-form-grant-view");
    let viewBefore = null;
    if (await view.getAttribute("data-state") === "checked") {
      await view.click();
      const clearing = managerPage.waitForResponse(r => r.url().endsWith(`/roles/${target.roleUuid}/action-permissions`) && r.request().method() === "PUT");
      await managerPage.getByTestId("save-company-form-permissions").click();
      ensure((await clearing).status() === 200, "Test-only View reset failed");
      await managerPage.waitForTimeout(400);
      viewBefore = false;
    }
    await view.click();
    const viewResponse = managerPage.waitForResponse(r => r.url().endsWith(`/roles/${target.roleUuid}/action-permissions`) && r.request().method() === "PUT");
    await managerPage.getByTestId("save-company-form-permissions").click();
    ensure((await viewResponse).status() === 200, "Actual screen View save failed");
    await managerPage.waitForTimeout(500);
    await shoot(managerPage, "02-ordinary-manager-company-forms-view");
    const records = await api(ordinary, "GET", "/api/v2/admin/access-control/audit");
    const viewEvent = records.find(r => r.resource === "company_forms" && r.role_id === target.roleUuid && r.action === "view");
    ensure(viewEvent?.actor.masterUserId === ordinary.id && viewEvent.before_value === viewBefore && viewEvent.after_value === true, "Exact authenticated View audit unavailable");
    await managerPage.locator("section[aria-labelledby='access-audit-heading'] article").first().scrollIntoViewIfNeeded();
    ensure(await managerPage.getByText(ordinary.role, { exact: false }).count() > 0, "Audit screen lacks ordinary actor");
    await shoot(managerPage, "03-authenticated-before-after-audit");
    report.viewAudit = viewEvent;
    report.checks.push(`Non-whitelisted manager granted another test-owned role Company Forms View through the actual screen; server audit shows actor and ${viewBefore} → true.`);

    await select(managerPage, ordinary);
    await managerPage.getByRole("checkbox", { name: "Management access granted", exact: true }).click();
    const refusal = managerPage.waitForResponse(r => r.url().endsWith(`/roles/${ordinary.roleUuid}/management`) && r.request().method() === "PUT");
    await managerPage.getByRole("button", { name: "Save grant", exact: true }).click();
    ensure((await refusal).status() === 409, "Last-manager removal was not refused");
    await managerPage.getByText(/Cannot remove the last eligible Access Control manager/).waitFor();
    await shoot(managerPage, "04-last-manager-refused");
    ensure((await api(ordinary, "GET", `/api/v2/admin/access-control/roles/${ordinary.roleUuid}/management`)).allowed, "Refusal changed stored grant");
    const afterRefusal = await api(ordinary, "GET", "/api/v2/admin/access-control/audit");
    ensure(afterRefusal.length === records.length, "Failed refusal left a successful-change audit record");
    report.checks.push("Same ordinary manager's last-grant removal refused with HTTP 409; grant and successful-change audit unchanged.");
    await api(ordinary, "PUT", `/api/v2/admin/access-control/roles/${ordinary.roleUuid}`,
      { assignedRole: `${ordinary.role} ORPHANED MAPPING` }, 409);
    ensure((await api(ordinary, "GET", "/api/v2/admin/access-control/state")).mode === "management",
      "Sole-manager self-rename stranded its trusted user");
    ensure((await api(ordinary, "GET", "/api/v2/admin/access-control/audit")).length === records.length,
      "Refused self-rename left a successful-change audit");
    report.checks.push("Guarded sole-manager self-rename refused with HTTP 409; trusted user still resolves the manager and no successful audit was appended.");

    // No alternate server: exercise the production parent-transition transaction using a development-only fixture harness.
    execFileSync("node_modules/.bin/tsx", ["scripts/verify-access-control-parent-sync.ts"], { encoding: "utf8", timeout: 60000 });
    await api(ordinary, "GET", "/api/v2/admin/access-control/state", undefined, 403);
    const recoveryState = await api(support, "GET", "/api/v2/admin/access-control/state");
    ensure(recoveryState.mode === "name_bootstrap" && recoveryState.eligibleManagerCount === 0, "Parent loss recovery unavailable");
    const recoveryPage = await pageFor(support);
    await shoot(recoveryPage, "05a-zero-manager-recovery-state");
    await recoveryPage.getByLabel("Event filter").selectOption("parent_sync");
    await recoveryPage.getByText("parent_sync_management_eligibility", { exact: true }).first().waitFor();
    await recoveryPage.locator("section[aria-labelledby='access-audit-heading'] article").first().scrollIntoViewIfNeeded();
    await shoot(recoveryPage, "05-parent-sync-recovery-visible");
    const recoveryAudit = (await api(support, "GET", "/api/v2/admin/access-control/audit?filter=parent_sync"))
      .find(r => r.role_id === ordinary.roleUuid);
    ensure(recoveryAudit?.after_value.eligible === false && recoveryAudit.after_value.storedManagementDecision === true
      && recoveryAudit.details.eligibleHolderCountAfter === 0, "Parent event falsely revoked grant or omitted recovery counts");
    report.recoveryState = recoveryState; report.recoveryAudit = recoveryAudit;
    report.checks.push("Production parent-sync transition deactivated only test-owned manager via fixture harness; retained allowed grant became ineligible, distinct event visible, trusted zero-manager name recovery immediately active.");

    // Preserve recoverability without SQL grant cleanup: support recovers its own management through the screen.
    await grant(recoveryPage, support, true);
    const restoreRequest = await api(support, "PUT", `/api/v2/admin/access-control/roles/${ordinary.roleUuid}`, { isActive: true });
    ensure(restoreRequest.isActive, "Test-only manager restoration failed");
    report.finalState = await api(support, "GET", "/api/v2/admin/access-control/state");
    ensure(report.finalState.eligibleManagerCount === 2, "Final recoverable state requires support and ordinary test manager");
    ensure(pid() === backendPid && execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === head, "PID or HEAD changed during evidence");
    report.pidAndHeadUnchanged = true;
    await save("report.json", report);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
try { if (process.argv.includes("--prepare")) await prepare(); else await verify(); }
finally { await db.end(); }
