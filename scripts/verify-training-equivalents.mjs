// Main-preview UI acceptance only. Reuses the registered PDF fixture vessel.
// No API calls, mocked responses, auth bypass or grants are introduced here.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const root = "generated-artifacts/training-slice2";
fs.mkdirSync(root, { recursive: true });
const fixture = "a4120000-0000-4000-8000-000000000001";
const persona = { personaKey: "crewing-manager", masterUserId: 3, role: "Crewing Manager",
  roleId: "408d9fe9-1d0f-11f1-925d-5419ffd80f01", userType: "Office" };
const bootstrap = process.env.TRAINING_VERIFY_BOOTSTRAP === "1";
const label = bootstrap ? "fixture-authoring" : "closing-preview";
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const pid = () => execFileSync("bash", ["-lc", "lsof -t -iTCP:5000 -sTCP:LISTEN | head -n1"], { encoding: "utf8" }).trim();
const originalPid = pid();
const apiPath = `/api/v2/admin/training-matrix-equivalents/${fixture}`;
const browser = await chromium.launchPersistentContext(
  "generated-artifacts/attachment-display/browser-profile-office", {
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
    viewport: { width: 1560, height: 1080 },
  });
const evidence = { head, backendPid: originalPid, persona, fixture, bootstrap, api: [], errors: [] };
const captures = [];
let page;
try {
  await browser.addInitScript(state => {
    localStorage.setItem("devPersona", JSON.stringify(state));
    localStorage.setItem("userProfile", JSON.stringify({ role: state.role, roleId: state.roleId,
      userId: String(state.masterUserId), userType: state.userType, myVessels: [] }));
  }, persona);
  page = await browser.newPage();
  page.on("pageerror", error => evidence.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/v2/admin/training-matrix-")) return;
    captures.push((async () => evidence.api.push({ path: url.pathname, query: url.search,
      method: response.request().method(), status: response.status(), body: await response.json() }))());
  });
  // Guard the verification tool, not application authorization. Never replace a response.
  await page.route(/\/api\/v2\/admin\/training-matrix-/, async route => {
    const req = route.request();
    if (["GET", "HEAD"].includes(req.method())) return route.continue();
    const path = new URL(req.url()).pathname;
    const body = req.postDataJSON();
    const target = path.includes("/training-matrix-equivalents/") ? path.split("/").at(-1) : body?.vesselId;
    if (!bootstrap || target !== fixture) {
      evidence.errors.push("Refused a non-fixture or read-only verification write.");
      return route.abort();
    }
    return route.continue();
  });
  const readNext = () => page.waitForResponse(r => new URL(r.url()).pathname === apiPath
    && r.request().method() === "GET").then(r => r.json());
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/admin`, { waitUntil: "networkidle" });
  await page.getByTestId("sidebar-item-training-matrix").click();
  await page.getByRole("button", { name: "Vessel", exact: true }).click();
  await page.getByTestId("tm-vessel-select").click();
  await page.getByPlaceholder("Search vessels...").fill("TEST ONLY PDF layout review");
  const firstRead = readNext();
  await page.getByRole("option").filter({ hasText: "TEST ONLY PDF layout review" }).click();
  await page.keyboard.press("Escape");
  let state = await firstRead;
  assert.equal(state.vesselId, fixture);
  const distinct = [...new Map(state.requirements.map(r => [r.courseUuid, r])).values()]
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
  assert.equal(distinct.length, 3);
  evidence.courses = distinct;
  const [a, b, c] = distinct.map(r => r.courseUuid);
  const pair = (requiredCourseUuid, acceptedCourseUuid) => ({ requiredCourseUuid, acceptedCourseUuid });
  const firstLinks = [pair(a, b), pair(b, c)], nextLinks = [pair(a, c)];
  const key = link => `${link.requiredCourseUuid}:${link.acceptedCourseUuid}`;
  async function configure(desired) {
    await page.getByTestId("tm-revision-button").click();
    for (const requirement of distinct.slice(0, 2))
      await page.getByTestId(`row-vessel-training-${requirement.companyTrainingId}`).locator("input[type=checkbox]").check();
    const desiredKeys = new Set(desired.map(key)), currentKeys = new Set(state.links.map(key));
    const changes = [...state.links.filter(l => !desiredKeys.has(key(l))), ...desired.filter(l => !currentKeys.has(key(l)))];
    for (const link of changes) {
      const course = state.courses.find(c => c.courseUuid === link.acceptedCourseUuid);
      assert.ok(course);
      await page.getByTestId(`training-equivalents-picker-${link.requiredCourseUuid}`).click();
      const popup = page.locator('[role="dialog"][data-state="open"]');
      await popup.getByPlaceholder("Search courses by name or code…").fill(course.code);
      await popup.getByRole("option").filter({ hasText: course.name }).filter({ hasText: course.code }).click();
      await page.keyboard.press("Escape");
    }
    if (changes.length) {
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === apiPath && r.request().method() === "PUT");
      await page.getByTestId("training-equivalents-save").click();
      const response = await saved;
      assert.equal(response.status(), 200);
      state = await response.json();
      await page.waitForLoadState("networkidle");
    }
    await page.getByTestId(`training-equivalent-row-${a}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/${label}-draft.png` });
  }
  if (bootstrap && state.revisions.length === 0) {
    await configure(firstLinks);
    await page.getByTestId("tm-flex-date-input").fill("2026-10-20");
    const refreshed = readNext();
    const published = page.waitForResponse(r => new URL(r.url()).pathname.endsWith("/training-matrix-vessel-revisions/submit"));
    await page.getByTestId("tm-submit-button").click();
    const release = await published;
    assert.equal(release.status(), 200);
    evidence.publication = await release.json();
    state = await refreshed;
  }
  assert.equal(state.revisions.length, 1, "Reuse the one registered revision; never create another on rerun.");
  if (bootstrap && state.source.kind !== "draft") await configure(nextLinks);
  assert.equal(state.source.kind, "draft");
  assert.deepEqual(state.links, nextLinks);
  evidence.current = state;
  const historicalRead = readNext();
  await page.getByTestId("training-equivalents-revision-select").selectOption(state.revisions[0].uuid);
  const historical = await historicalRead;
  assert.deepEqual(new Set(historical.links.map(key)), new Set(firstLinks.map(key)));
  await page.getByTestId(`training-equivalents-readonly-${a}`).waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("training-equivalents-save").count(), 0);
  await page.getByTestId(`training-equivalent-row-${a}`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/${label}-historical-readonly.png` });
  evidence.historical = historical;
  await Promise.all(captures);
  assert.ok(evidence.api.every(r => r.status < 400));
  assert.deepEqual(evidence.errors, []);
  assert.equal(pid(), originalPid, "Browser verification must not replace the main backend.");
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), head);
  console.log(JSON.stringify({ fixture, role: persona.role, revision: historical.source,
    currentDraft: state.source, capturedRequests: evidence.api.length, errors: evidence.errors }));
} catch (error) {
  evidence.errors.push(error.message);
  if (page) {
    await page.screenshot({ path: `${root}/${label}-failure.png` });
    fs.writeFileSync(`${root}/${label}-failure.txt`, await page.locator("body").innerText());
  }
  throw error;
} finally {
  evidence.recordedAt = new Date().toISOString();
  fs.writeFileSync(`${root}/${label}.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
