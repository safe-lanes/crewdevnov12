/**
 * Opt-in MAIN development-workspace verification.
 * Creates only named verification fixtures; lifecycle writes use live HTTP.
 * Never deletes the resulting assignment history or edits operational records.
 */
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium } from "@playwright/test";

const phase = process.argv[2];
const root = ".local/verification";
const statePath = `${root}/assignment-lifecycle-state.json`;
const imageRoot = "screenshots/assignment-lifecycle";
await fs.mkdir(root, { recursive: true });
await fs.mkdir(imageRoot, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 24, userType: "Office", role: "Admin" })}.devsig`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
let state;
const trace = { phase, startedAt: new Date().toISOString(), sql: [], http: [], network: [] };

function provenance() {
  const [sha, committedAt, epoch] = execFileSync("git", ["show", "-s", "--format=%H%n%cI%n%ct", "HEAD"], { encoding: "utf8" }).trim().split("\n");
  const ids = [...new Set(execFileSync("lsof", ["-nP", "-iTCP:5000", "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim().split("\n"))];
  if (ids.length !== 1) throw new Error("Expected one main backend listener");
  const pid = Number(ids[0]);
  const stat = execFileSync("cat", [`/proc/${pid}/stat`], { encoding: "utf8" }).split(")").at(-1).trim().split(/\s+/);
  const boot = Number(execFileSync("awk", ["/^btime / {print $2}", "/proc/stat"], { encoding: "utf8" }).trim());
  const hz = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim());
  const started = boot + Number(stat[19]) / hz;
  if (started <= Number(epoch)) throw new Error("NOT VERIFIED: backend predates final commit");
  if (state && (state.provenance.pid !== pid || state.provenance.sha !== sha)) throw new Error("Backend/HEAD changed during walkthrough");
  return { pid, sha, committedAt, backendStartedAt: new Date(started * 1000).toISOString(), environment: "main development workspace", port: 5000 };
}

async function sql(text, params = []) {
  const { rows } = await db.query(text, params);
  trace.sql.push({ statement: text, parameters: params, rows });
  return rows;
}

async function api(method, path, body, expected = 200) {
  const response = await fetch(base + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  trace.http.push({ at: new Date().toISOString(), method, path, status: response.status, response: data });
  if (response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function snapshot(planUuid, assignmentUuid) {
  return sql(`SELECT p.plan_uuid, p.vessel_uuid, p.rank_id, p.crew_uuid,
       p.crew_assign_uuid, p.reliever_crew_uuid, p.reliever_assign_uuid,
       p.joining_status, a.assign_uuid, a.crew_uuid AS assignment_crew_uuid,
       a.assignment_type, a.is_current, a.is_deleted, a.sign_on_date,
       a.sign_off_date, a.vessel_uuid AS assignment_vessel_uuid
FROM vessel_planning_v2 p
LEFT JOIN crew_assignments a ON a.assign_uuid = $2
WHERE p.plan_uuid = $1`, [planUuid, assignmentUuid]);
}

async function screenshot(openPopup = false) {
  const browser = await chromium.launch({
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, extraHTTPHeaders: headers });
    const page = await context.newPage();
    page.on("response", async (r) => {
      if (r.url().includes("assignment")) {
        trace.network.push({ at: new Date().toISOString(), method: r.request().method(), url: r.url().replace(base, ""), status: r.status(), response: await r.json().catch(() => null) });
      }
    });
    await page.goto(base + "/vessel", { waitUntil: "domcontentloaded" });
    const roles = await api("GET", "/api/v2/admin/access-control/roles");
    const admin = roles.find((r) => Object.values(r).includes("Admin"));
    if (!admin) throw new Error("Existing Admin persona role not found");
    const roleId = admin.ruid ?? admin.roleId ?? admin.id;
    if (roleId == null) throw new Error("Admin role identifier missing");
    await page.evaluate(async (roleId) => {
      const { applyDevPersona } = await import("/src/lib/devPersona.ts");
      applyDevPersona({ personaKey: "admin", masterUserId: 24, role: "Admin", roleId: String(roleId), userType: "Office" });
    }, roleId);
    await page.waitForTimeout(2500);
    await fs.writeFile(`${root}/${phase}-dom.txt`, await page.locator("body").innerText());
    const crewTab = page.getByRole("tab", { name: /crew list/i });
    if (await crewTab.count()) await crewTab.click();
    const detail = page.getByTestId("select-vessel-detail");
    const filter = page.getByTestId("select-vessel-value");
    const selector = await detail.count() ? detail : filter;
    await selector.click();
    await page.getByRole("option", { name: state.vesselName, exact: true }).click();
    await page.waitForTimeout(1800);
    if (await page.getByTestId("select-vessel-detail").count() === 0) {
      await page.getByRole("row").filter({ hasText: state.vesselName }).getByRole("button").first().click();
      await page.getByTestId("select-vessel-detail").waitFor();
    }
    await page.getByTestId("tab-planning").click();
    await page.waitForTimeout(1200);
    await fs.writeFile(`${root}/${phase}-dom.txt`, await page.locator("body").innerText());
    if (openPopup) {
      const edit = page.locator('[data-testid^="button-edit-reliever-"]');
      if (await edit.count() === 0) throw new Error("Real reliever edit button is not visible");
      await edit.first().click();
      await page.getByRole("dialog").waitFor();
      await fs.writeFile(`${root}/${phase}-dialog.txt`, await page.getByRole("dialog").innerText());
      await page.screenshot({ path: `${imageRoot}/popup-diagnostic.png`, fullPage: true });
      await page.getByRole("button", { name: "Open assignment", exact: true }).click();
      await page.getByText(state.firstAssignment, { exact: true }).waitFor();
      await page.waitForTimeout(300);
      if (!trace.network.some((r) => r.response?.assignUuid === state.firstAssignment && r.status === 200)) {
        throw new Error("Popup did not read the exact linked assignment");
      }
    }
    const file = `${imageRoot}/${process.argv[3] ?? phase}.png`;
    await page.screenshot({ path: file, fullPage: true });
    trace.screenshot = file;
    trace.screenshotAt = new Date().toISOString();
  } finally {
    await browser.close();
  }
}

try {
  if (phase !== "prepare") state = JSON.parse(await fs.readFile(statePath, "utf8"));
  trace.provenance = provenance();
  if (phase === "prepare") {
    try { await fs.access(statePath); throw new Error("Existing fixture state: do not overwrite"); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
    const suffix = randomUUID().slice(0, 8);
    const vesselUuid = randomUUID();
    const ranks = await sql("SELECT rank, rank_id FROM adm_company_ranks_v2 WHERE is_deleted=false AND rank IN ('Master','Chief Officer') ORDER BY id");
    if (ranks.length !== 2) throw new Error("Required existing master ranks absent");
    state = { provenance: trace.provenance, vesselUuid, vesselName: `VERIFY Lifecycle ${suffix}`, firstCrew: randomUUID(), secondCrew: randomUUID(), firstEntry: randomUUID(), secondEntry: randomUUID(), ranks };
    await db.query("BEGIN");
    try {
      await sql("INSERT INTO master_vessels(vessel_uuid,vessel,is_active,is_deleted) VALUES ($1,$2,true,false) RETURNING vessel_uuid,vessel", [vesselUuid, state.vesselName]);
      for (let i = 0; i < 2; i++) {
        const crew = i === 0 ? state.firstCrew : state.secondCrew;
        const entry = i === 0 ? state.firstEntry : state.secondEntry;
        await sql("INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,is_deleted) VALUES ($1,$2,$3,$4,false) RETURNING crew_uuid,emp_no", [crew, `VERIFY-${suffix}-${i + 1}`, "Lifecycle", `Verification ${i + 1}`]);
        await sql("INSERT INTO rotation_entries_v2(entry_uuid,draft_uuid,vessel_uuid,rank_id,rank,crew_uuid,sign_on_date,contract_period,proposal_status,is_deleted) VALUES ($1,$2,$3,$4,$5,$6,'2026-10-02',4,'Pending',false) RETURNING entry_uuid,crew_uuid,vessel_uuid,proposal_status", [entry, randomUUID(), vesselUuid, ranks[i].rank_id, ranks[i].rank, crew]);
      }
      await db.query("COMMIT");
    } catch (e) { await db.query("ROLLBACK"); throw e; }
  } else if (phase === "configure") {
    const allRanks = await api("GET", "/api/v2/admin/company-ranks");
    const positions = state.ranks.map((rank) => {
      const reference = allRanks.find((r) => r.rankId === rank.rank_id);
      if (!reference) throw new Error("Fixture rank reference missing");
      return { ...reference, actualManning: ["Primary"], actualManningFlag: true, safeManning: false, optimumManning: false, highWorkloadManning: false };
    });
    await api("POST", "/api/v2/admin/vessel-revisions", { vesselId: state.vesselUuid, revision: "R0", revisionDate: "02/10/2026", revisionData: JSON.stringify(positions) });
    await sql("SELECT vessel_id,revision,revision_data FROM adm_vessel_revisions_v2 WHERE vessel_id=$1 AND is_deleted=false", [state.vesselUuid]);
    const [s] = await snapshot(state.firstPlan, state.firstAssignment);
    if (s.reliever_assign_uuid !== state.firstAssignment) throw new Error("Position setup changed assignment link");
  } else if (phase === "deploy-first" || phase === "deploy-second") {
    const first = phase === "deploy-first";
    const result = await api("POST", `/api/v2/rotation/entries/${first ? state.firstEntry : state.secondEntry}/deploy`, { deployedByUuid: "main-lifecycle-verification" });
    if (!result.success || !result.planUuid) throw new Error("Deployment did not return planning identity");
    const [row] = await sql("SELECT plan_uuid,reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid=$1", [result.planUuid]);
    if (!row?.reliever_assign_uuid) throw new Error("Deployment failed to persist assignment UUID");
    const prefix = first ? "first" : "second";
    state[`${prefix}Plan`] = row.plan_uuid;
    state[`${prefix}Assignment`] = row.reliever_assign_uuid;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    const [s] = await snapshot(row.plan_uuid, row.reliever_assign_uuid);
    if (s.assignment_type !== "Planned" || s.is_deleted) throw new Error("Expected preserved Planned assignment");
    await screenshot();
  } else if (phase === "popup") {
    await snapshot(state.firstPlan, state.firstAssignment);
    await screenshot(true);
  } else if (phase === "sign-on") {
    await api("POST", `/api/v2/vessel/planning/${state.firstPlan}/sign-on`, { signOnDate: "2026-10-02" });
    const [s] = await snapshot(state.firstPlan, state.firstAssignment);
    if (s.crew_assign_uuid !== state.firstAssignment || s.assignment_type !== "OnBoard" || !s.is_current) throw new Error("Sign-on lost exact assignment identity");
    await screenshot();
  } else if (phase === "sign-off") {
    await api("POST", `/api/v2/vessel/planning/${state.firstPlan}/sign-off`, { signOffDate: "2026-10-03", signOffReason: "Dedicated lifecycle verification complete" });
    const [s] = await snapshot(state.firstPlan, state.firstAssignment);
    if (s.crew_assign_uuid !== state.firstAssignment || s.is_current || !s.sign_off_date || s.is_deleted) throw new Error("Sign-off failed to preserve exact assignment history");
    await screenshot();
  } else if (phase === "unassign") {
    await api("PATCH", `/api/v2/vessel/planning/${state.secondPlan}`, { relieverCrewUuid: null, joiningStatus: null, relieverSignOnDate: null, joiningPortUuid: null, plannedConfirmedDate: null, travelStartDate: null, relieverContractPeriodMonths: null, relieverContractEndRangeStartMonths: null, relieverContractEndRangeEndMonths: null, deploymentChecklistCompleted: null, applicableDocsChecked: null });
    const [s] = await snapshot(state.secondPlan, state.secondAssignment);
    if (s.reliever_assign_uuid || s.reliever_crew_uuid || s.assignment_type !== "Cancelled" || s.is_current || s.is_deleted) throw new Error("Unassign did not preserve cancelled assignment and clear planning");
    await screenshot();
  } else if (phase === "invalid-vessel") {
    const bad = "744535d0-841a-11ed-aa7c-7003bca91a866";
    const [globalBefore] = await sql("SELECT count(*)::int AS matching_assignments FROM crew_assignments WHERE vessel_uuid=$1", [bad]);
    const before = await sql("SELECT assign_uuid,vessel_uuid,assignment_type,is_current,is_deleted FROM crew_assignments WHERE crew_uuid=$1 ORDER BY assign_uuid", [state.secondCrew]);
    const refused = await api("POST", `/api/v2/crew-pool/crew/${state.secondCrew}/assignments`, { vesselUuid: bad, assignmentType: "Planned", isCurrent: false, signOnDate: "2026-10-02" }, 400);
    if (!JSON.stringify(refused).toLowerCase().includes("vessel")) throw new Error("Refusal was not vessel validation");
    const after = await sql("SELECT assign_uuid,vessel_uuid,assignment_type,is_current,is_deleted FROM crew_assignments WHERE crew_uuid=$1 ORDER BY assign_uuid", [state.secondCrew]);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Refused write changed assignment history");
    const [globalAfter] = await sql("SELECT count(*)::int AS matching_assignments FROM crew_assignments WHERE vessel_uuid=$1", [bad]);
    if (globalBefore.matching_assignments !== globalAfter.matching_assignments) throw new Error("Refused write changed global invalid-vessel count");
    await screenshot();
  } else if (phase === "capture") {
    await screenshot();
  } else {
    throw new Error("Unknown phase");
  }
  provenance();
  trace.result = "PASS";
  trace.completedAt = new Date().toISOString();
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ ...trace, http: trace.http.filter((r) => !r.path.includes("/access-control/")) }, null, 2));
} catch (error) {
  trace.result = "FAIL";
  trace.error = error.message;
  console.error(JSON.stringify({ ...trace, http: trace.http.filter((r) => !r.path.includes("/access-control/")) }, null, 2));
  process.exitCode = 1;
} finally {
  await fs.writeFile(`${root}/${phase}.json`, JSON.stringify(trace, null, 2));
  await db.end();
}