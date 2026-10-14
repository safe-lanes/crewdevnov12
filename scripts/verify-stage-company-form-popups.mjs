// Read-only browser closing against MAIN workspace preview; no fixtures/grants/resets.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { db, fs, base, prefix, token, backend, git, ensure, snapshot } from "./signoff-verification-common.mjs";

const fixture = JSON.parse(await fs.readFile(".local/verification/signoff/fixtures.json", "utf8"));
const folder = `.local/verification/stage-popups-browser-${new Date().toISOString().replace(/[:.]/g, "-")}`;
await fs.mkdir(folder, { recursive: true });
const report = {
  head: git("rev-parse", "HEAD"), commitTime: git("show", "-s", "--format=%cI", "HEAD"),
  startedAt: new Date().toISOString(), backend: backend(), preview: base,
  authentication: "Retained synthetic development personas, not production authentication",
  network: [], checks: [], screenshots: [], passed: false,
};
ensure(new Date(report.backend.startedAt) > new Date(report.commitTime), "Backend must start strictly after final commit");
const viewers = fixture.crews.find(c => c.key === "viewers");
let reliever = fixture.crews.find(c => c.key === (fixture.activeCrewKeys?.reliever ?? "reliever"));
ensure(viewers && reliever, "Retained viewer/reliever fixtures required");
const relieverState = (await db.query("SELECT assignment_type FROM crew_assignments WHERE assign_uuid=$1",
  [reliever.assignmentUuid])).rows[0];
if (relieverState?.assignment_type !== "Planned") {
  // The prior closing intentionally cancelled its reliever. Do not reset it.
  // This dedicated retained UI regression fixture still has its exact Planned link.
  const candidates = (await db.query(`SELECT p.plan_uuid AS "planUuid",
    p.reliever_assign_uuid AS "assignmentUuid",p.reliever_crew_uuid AS "crewUuid",
    concat_ws(' ',cm.first_name,cm.family_name) AS name
    FROM vessel_planning_v2 p JOIN crew_assignments a ON a.assign_uuid=p.reliever_assign_uuid
    JOIN crew_members_v2 cm ON cm.crew_uuid=p.reliever_crew_uuid
    WHERE p.plan_uuid='a7358272-29df-4274-ac28-9259824e2f5c'
      AND p.reliever_assign_uuid='7521f648-7125-4855-a51c-22660a20bc0f'
      AND a.crew_uuid=p.reliever_crew_uuid AND a.vessel_uuid=p.vessel_uuid
      AND p.vessel_uuid=$1 AND NOT p.is_deleted AND NOT p.is_archived
      AND NOT a.is_deleted AND a.assignment_type='Planned'`, [fixture.actors.master.vesselUuid])).rows;
  ensure(candidates.length === 1, "Exact retained Planned regression fixture required; no reset or inferred replacement");
  reliever = candidates[0];
  report.checks.push({ name: "Read-only retained reliever selection; cancelled fixture left unchanged", fixture: reliever });
}
let browser, context, page, actor, formPhase = false;
const pending = [];
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function protectedState() {
  return Object.fromEntries(Object.entries(await snapshot()).map(([table, rows]) => [table, hash(rows)]));
}
async function screenshot(name) {
  const file = `${folder}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}
async function asActor(next) {
  if (context) await context.close();
  actor = next; formPhase = false;
  context = await browser.newContext({ viewport: { width: 1560, height: 1100 },
    ignoreHTTPSErrors: true, extraHTTPHeaders: { Authorization: `Bearer ${token(actor)}` } });
  await context.addInitScript(({ actor, auth, vesselName }) => {
    const vessel = { vessel: vesselName, vesselId: actor.vesselUuid, imoNumber: "" };
    const state = { personaKey: "vessel-admin", masterUserId: actor.id, userId: String(actor.id),
      role: actor.role, roleId: actor.roleUuid, userType: actor.userType,
      vessel, myVessels: actor.userType === "Ship" ? [vessel] : [] };
    localStorage.setItem("userProfile", JSON.stringify(state));
    localStorage.setItem("devPersona", JSON.stringify(state));
    localStorage.setItem("devAuthToken", auth);
    localStorage.setItem("devLastVesselId", actor.vesselUuid);
  }, { actor, auth: token(actor), vesselName: fixture.vessel.vessel });
  page = await context.newPage();
  page.on("response", response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/")) return;
    const entry = { actorId: actor.id, actorRole: actor.role, at: new Date().toISOString(),
      method: response.request().method(), path: url.pathname + url.search, status: response.status(), formPhase };
    report.network.push(entry);
    if (url.pathname.startsWith(prefix)) pending.push(response.text().then(text => {
      entry.savedResponse = text;
    }).catch(() => undefined));
    if (url.pathname.startsWith(prefix)) pending.push(response.request().allHeaders().then(headers => {
      const auth = headers.authorization?.split(" ")[1];
      entry.actualActorId = auth ? JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString()).id : null;
      entry.savedRequest = response.request().postDataJSON();
    }).catch(error => { entry.actorEvidenceError = String(error); }));
  });
  await page.goto(`${base}/vessel`, { waitUntil: "domcontentloaded" });
}
async function planningRow(c, type) {
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  const row = page.locator("tr").filter({ hasText: c.name })
    .filter({ has: page.locator(`[data-testid^="button-edit-${type}-"]`) });
  await row.first().waitFor({ state: "visible", timeout: 45000 });
  ensure(await row.count() === 1, "Exact Planning row must be unique");
  await row.locator(`[data-testid^="button-edit-${type}-"]`).click();
}
async function history(c) {
  const response = await context.request.get(`${base}${prefix}/subjects/crew_assignment/${c.assignmentUuid}/submissions`);
  ensure(response.status() === 200, "Positive scoped history preflight required");
  return (await response.json()).submissions;
}
async function checkStage(container, c, stage) {
  const all = await history(c), own = all.filter(s => s.stageKey === stage);
  ensure(own.length > 0, `No retained ${stage} declaration to verify`);
  for (const saved of own) await container.getByText(`${saved.formName} · ${saved.status}`, { exact: true }).waitFor();
  for (const other of all.filter(s => s.stageKey !== stage && !own.some(saved => saved.formName === s.formName))) {
    ensure(await container.getByText(`${other.formName} · ${other.status}`, { exact: true }).count() === 0,
      "Another stage leaked into operational history");
  }
  ensure(!(await page.getByRole("heading").allTextContents()).some(text =>
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)), "UUID in heading");
  ensure(!(await container.innerText()).includes(c.assignmentUuid), "Assignment UUID in forms introduction");
  report.checks.push({ name: "stage-only declarations", stage, assignmentUuid: c.assignmentUuid,
    shown: own.map(s => s.submissionUuid), excluded: all.filter(s => s.stageKey !== stage).map(s => s.submissionUuid) });
  return own;
}
const before = await protectedState();
report.protectedBefore = before;
try {
  browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox"] });
  await asActor(fixture.actors.master);
  await planningRow(viewers, "onboard");
  const topButton = page.getByTestId("button-open-signoff-forms");
  await topButton.waitFor();
  ensure(await page.getByTestId("signoff-company-forms").count() === 0, "Sign-off forms remain inline");
  const top = await topButton.boundingBox(), dialog = await page.getByRole("dialog").boundingBox();
  ensure(top && dialog && top.y - dialog.y < 140, "Sign-off forms button must be at popup top");
  await screenshot("01-onboard-status-top-button");
  formPhase = true;
  await topButton.click();
  const signoff = page.getByTestId("signoff-company-forms");
  await signoff.waitFor();
  await checkStage(signoff, viewers, "at_sign_off");
  await screenshot("02-signoff-own-popup-stage-only");
  await signoff.getByRole("button", { name: /Resume declaration|Read declaration/ }).first().click();
  const metadata = page.getByTestId("company-form-saved-metadata");
  await metadata.waitFor();
  ensure((await metadata.innerText()).includes("At sign-off"), "Pinned sign-off stage missing in declaration viewer");
  await screenshot("02b-signoff-pinned-declaration");
  await page.getByRole("button", { name: "Back to On Board Status" }).click();
  await page.getByTestId("button-submit-onboard").waitFor();
  report.checks.push({ name: "Back returns to On Board Status" });

  await asActor(fixture.actors.master);
  await page.getByRole("button", { name: "Crew List", exact: true }).click();
  const count = page.getByTestId("button-crew-forms-" + viewers.assignmentUuid);
  await count.waitFor();
  ensure((await count.innerText()).trim() === "1", "Sign-off declarations changed the on-board count");
  ensure(await page.getByTestId("crew-list-forms-header").count() === 1, "Crew List must retain one Forms column");
  await count.focus();
  await page.keyboard.press("Enter");
  const onboard = page.getByTestId("onboard-company-forms"); formPhase = true;
  await onboard.waitFor();
  await checkStage(onboard, viewers, "on_board");
  await screenshot("03-crew-list-onboard-only");

  await asActor(fixture.actors.master);
  await planningRow(reliever, "reliever");
  formPhase = true;
  await page.getByTestId("button-open-joining-forms").click();
  const joining = page.getByTestId("joining-company-forms");
  await joining.waitFor();
  await checkStage(joining, reliever, "before_joining");
  await screenshot("04-reliever-before-joining-only");

  await asActor(fixture.actors.office);
  await page.goto(`${base}/crew-pool?crew=${viewers.crewUuid}&section=G`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("crew-company-forms-home").waitFor({ state: "visible", timeout: 45000 });
  const group = page.getByTestId("crew-company-forms-group-" + viewers.assignmentUuid);
  await group.waitFor();
  if (await group.getAttribute("open") === null) await group.locator("summary").click();
  await page.getByTestId("crew-company-forms-open-" + fixture.declarations["viewers-onboard"]).waitFor();
  await page.getByTestId("crew-company-forms-open-" + fixture.declarations["viewers-aboard"]).waitFor();
  report.checks.push({ name: "G3 retains on-board and at-sign-off history" });
  await page.getByTestId("crew-company-forms-open-" + fixture.declarations["viewers-aboard"]).scrollIntoViewIfNeeded();
  await screenshot("05-g3-full-history");

  await Promise.all(pending);
  ensure(!report.network.some(r => r.formPhase && /^\/api\/v2\/admin\/(?:forms|form-versions|form-assets)/.test(r.path)),
    "Form rendering used Admin authoring endpoints");
  ensure(!report.network.some(r => r.path.startsWith(prefix) && !["GET", "HEAD"].includes(r.method) &&
    !r.path.includes("/submission-counts")), "Closing wrote a declaration");
  report.protectedAfter = await protectedState();
  report.protectedUnchanged = hash(before) === hash(report.protectedAfter);
  ensure(report.protectedUnchanged, "Read-only closing changed protected records");
  ensure(git("rev-parse", "HEAD") === report.head && backend().pid === report.backend.pid,
    "HEAD or managed backend changed during closing");
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await screenshot("failed-attempt").catch(() => undefined);
  process.exitCode = 1;
} finally {
  await Promise.all(pending);
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ folder, head: report.head, backend: report.backend,
    passed: report.passed, failure: report.failure, checks: report.checks }, null, 2));
  await browser?.close(); await db.end();
}