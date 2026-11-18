import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// HTTP fixtures only: this server never contacts tenant APIs or a database.
export const matrixFixture = {
  drafts: new Map(),
  revisions: new Map([
    ["vessel-a", [{ tmvrUuid: "a-r2", revision: "R2", revisionData: { applicableTrainingIds: [1, 3] } }]],
    ["vessel-b", [{ tmvrUuid: "b-r7", revision: "R7", revisionData: { applicableTrainingIds: [2, 4] } }]],
  ]),
  writes: [],
  failure: null,
  unreadable: null,
  delay: null,
  equivalentReads: [],
  async handle(req, res) {
    const url = new URL(req.url, "http://fixture").pathname;
    const json = data => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(data)); return true; };
    if (url.endsWith("/external/vessels")) return json({ data: [
      { id: 1, vesselUuid: "vessel-a", vessel: "Vessel Alpha", isActive: true },
      { id: 2, vesselUuid: "vessel-b", vessel: "Vessel Beta", isActive: true },
      { id: 3, vesselUuid: "vessel-c", vessel: "Vessel Gamma", isActive: true },
    ] });
    if (url.endsWith("/vessel-groups")) return json([
      { id: 1, name: "Test Fleet", vesselIds: ["vessel-a", "vessel-b"] },
    ]);
    if (url.includes("/training-matrix-vessel-")) {
      const vesselId = decodeURIComponent(url.split("/").pop());
      if (req.method === "GET") {
        if (this.unreadable === vesselId) { res.statusCode = 503; return json({ message: "Fixture read unavailable" }); }
        if (url.includes("-drafts/by-vessel/")) return json(this.drafts.has(vesselId) ? [this.drafts.get(vesselId)] : []);
        if (url.includes("-revisions/by-vessel/")) return json(this.revisions.get(vesselId) || []);
        if (url.includes("/next-revision/")) return json({ nextRevision: "R9" });
      } else {
        let text = "";
        for await (const chunk of req) text += chunk;
        const body = JSON.parse(text);
        this.writes.push({ url, body });
        if (this.delay) await this.delay;
        if (this.failure === body.vesselId) { res.statusCode = 403; return json({ message: "Fixture write denied" }); }
        if (url.endsWith("/upsert")) {
          this.drafts.set(body.vesselId, { ...body, tmvdUuid: `${body.vesselId}-draft`, updatedAt: new Date().toISOString() });
          return json(this.drafts.get(body.vesselId));
        }
        const history = this.revisions.get(body.vesselId) || [];
        const next = Math.max(-1, ...history.map(r => Number(r.revision.slice(1)))) + 1;
        const revision = { ...body, tmvrUuid: `${body.vesselId}-r${next}`, revision: `R${next}` };
        this.revisions.set(body.vesselId, [...history, revision]);
        this.drafts.delete(body.vesselId);
        return json({ success: true, revision });
      }
    }
    if (url.includes("/training-matrix-equivalents/")) {
      this.equivalentReads.push(url.split("/").pop());
      return json({
        vesselId: url.split("/").pop(), source: { kind: "none", uuid: null, revision: null },
        latestRevisionUuid: null, links: [{ requiredCourseUuid: "course-required", acceptedCourseUuid: "course-accepted" }],
        courses: [], requirements: [], revisions: [],
      });
    }
    return false;
  },
};

export async function runMultiVesselRegression(page) {
  const choose = async (...labels) => {
    await page.getByTestId("tm-vessel-select").click();
    for (const label of labels) await page.getByText(label, { exact: true }).last().click();
    await page.keyboard.press("Escape");
  };
  const cancel = async () => {
    await page.getByTestId("tm-cancel-button").click();
    await page.getByRole("button", { name: "Discard and exit", exact: true }).click();
    await expect(page.getByTestId("tm-revision-button")).toBeVisible();
  };
  const start = async () => {
    await expect(page.getByTestId("tm-revision-button")).toBeEnabled();
    await page.getByTestId("tm-revision-button").click();
  };
  const ids = vesselId => matrixFixture.drafts.get(vesselId).draftData.applicableTrainingIds;
  const checkbox = id => page.getByTestId(`checkbox-app-to-vessel-${id}`);
  await page.getByTestId("tab-training-vessel").click();
  await choose("Vessel Alpha", "Vessel Beta");
  await expect(page.getByTestId("tm-vessel-select")).toContainText("2 vessels selected");
  await start();
  await expect(page.getByTestId("tm-vessel-select")).toBeDisabled();
  await expect(checkbox(1)).toHaveAttribute("aria-checked", "mixed");
  await expect(checkbox(2)).toHaveAttribute("aria-checked", "mixed");
  assert.equal(await checkbox(1).evaluate(el => el.indeterminate), true);
  const revisionDate = page.getByTestId("tm-flex-date-input-manual");
  await revisionDate.fill("not-a-date");
  await page.getByTestId("tm-submit-button").click();
  assert.equal(matrixFixture.writes.length, 0, "Invalid date prevents all vessel writes");
  await revisionDate.fill("18-Nov-2026");
  await revisionDate.press("Tab");
  await checkbox(5).check();
  await page.getByTestId("tm-save-draft-button").click();
  await expect.poll(() => matrixFixture.writes.length).toBe(2);
  await expect(page.getByTestId("tm-save-results")).toContainText("Vessel Beta: Saved");
  assert.deepEqual(ids("vessel-a"), [1, 3, 5]);
  assert.deepEqual(ids("vessel-b"), [2, 4, 5]);
  console.log("PASS: multi-vessel Save Draft preserves different baselines");

  // Reopen each vessel independently and confirm saved drafts, not only local checkboxes.
  await cancel();
  await choose("Vessel Beta");
  await start();
  await expect(checkbox(1)).toBeChecked();
  await expect(checkbox(2)).not.toBeChecked();
  await expect(checkbox(5)).toBeChecked();
  await cancel();
  await choose("Vessel Alpha", "Vessel Beta");
  await start();
  await expect(checkbox(1)).not.toBeChecked();
  await expect(checkbox(2)).toBeChecked();
  await expect(checkbox(5)).toBeChecked();
  await cancel();
  console.log("PASS: both saved drafts persist after switching and reopening vessels");

  // Expand an overlapping group while Beta is already selected; only two targets.
  await choose("Test Fleet");
  await expect(page.getByTestId("tm-vessel-select")).toContainText("2 vessels selected");
  await start();
  await checkbox(1).click(); // mixed -> all checked
  await checkbox(1).uncheck(); // then explicit all unchecked
  await checkbox(5).uncheck();
  matrixFixture.failure = "vessel-a"; // Beta succeeds first; Alpha is retained for retry.
  await page.getByTestId("tm-submit-button").click();
  await expect(page.getByTestId("tm-save-results")).toContainText("Vessel Alpha: Failed");
  await expect(page.getByTestId("tm-save-results")).toContainText("Vessel Beta: Saved");
  await expect(page.getByTestId("tm-cancel-button")).toBeVisible();
  await expect(checkbox(1)).toBeDisabled();
  await expect(page.getByTestId("tm-save-draft-button")).toBeDisabled();
  assert.equal(matrixFixture.writes.length, 4);
  matrixFixture.failure = null;
  await page.getByTestId("tm-submit-button").click();
  await expect(page.getByTestId("tm-revision-button")).toBeVisible();
  assert.equal(matrixFixture.writes.length, 5);
  assert.equal(matrixFixture.writes.at(-1).body.vesselId, "vessel-a");
  assert.equal(matrixFixture.revisions.get("vessel-a").at(-1).revision, "R3");
  assert.equal(matrixFixture.revisions.get("vessel-b").at(-1).revision, "R8");
  assert.deepEqual(matrixFixture.revisions.get("vessel-a").at(-1).revisionData.applicableTrainingIds, [3]);
  assert.deepEqual(matrixFixture.revisions.get("vessel-b").at(-1).revisionData.applicableTrainingIds, [2, 4]);
  assert.equal(matrixFixture.drafts.size, 0);
  assert.equal(matrixFixture.writes.some(w => w.url.includes("equivalents")), false);
  assert.equal(matrixFixture.writes.some(w => w.body.vesselId === "vessel-c"), false);
  console.log("PASS: group overlap, mixed check/uncheck, independent revision numbers and partial-failure retry");

  // An unreadable newly selected vessel must block writes for the whole selection.
  matrixFixture.unreadable = "vessel-c";
  await choose("Vessel Gamma");
  await expect(page.getByTestId("tm-retry-load")).toBeVisible();
  await expect(page.getByTestId("tm-revision-button")).toBeDisabled();
  assert.equal(matrixFixture.writes.length, 5);
  matrixFixture.unreadable = null;
  await page.getByTestId("tm-retry-load").click();
  await start();
  await cancel();
  await choose("Vessel Gamma");
  console.log("PASS: any vessel load failure blocks Revision until explicit retry succeeds");

  // Drop a committed response. The UI must read back the revision and never replay it.
  await start();
  await checkbox(6).check();
  let dropped = false;
  await page.route("**/training-matrix-vessel-revisions/submit", async route => {
    const response = await route.fetch();
    if (!dropped) { dropped = true; await route.abort("failed"); }
    else await route.fulfill({ response });
  });
  const beforeLost = matrixFixture.writes.length;
  await page.getByTestId("tm-submit-button").click();
  await expect(page.getByTestId("tm-revision-button")).toBeVisible();
  assert.equal(matrixFixture.writes.length, beforeLost + 2);
  await page.unroute("**/training-matrix-vessel-revisions/submit");
  console.log("PASS: lost response reconciled from persisted revisions without duplicate submission");

  // A truly ambiguous outcome must remain locked; Check Results does not POST again.
  await start();
  await page.route("**/training-matrix-vessel-revisions/submit", route => route.abort("failed"));
  const beforeUnknown = matrixFixture.writes.length;
  await page.getByTestId("tm-submit-button").click();
  await expect(page.getByTestId("tm-save-results")).toContainText("Outcome uncertain");
  await page.getByTestId("tm-submit-button").click();
  await expect(page.getByTestId("tm-submit-button")).toBeEnabled();
  assert.equal(matrixFixture.writes.length, beforeUnknown);
  await expect(page.getByTestId("tm-vessel-select")).toBeDisabled();
  await page.unroute("**/training-matrix-vessel-revisions/submit");
  await cancel();
  console.log("PASS: uncertain submissions remain blocked and repeated checks perform no writes");

  // Repeated click events during a slow request may not publish duplicate revisions.
  await start();
  let release;
  matrixFixture.delay = new Promise(resolve => { release = resolve; });
  const beforeSlow = matrixFixture.writes.length;
  await page.getByTestId("tm-submit-button").evaluate(button => { button.click(); button.click(); });
  await expect.poll(() => matrixFixture.writes.length).toBe(beforeSlow + 1);
  await expect(page.getByTestId("tm-submit-button")).toBeDisabled();
  await expect(page.getByTestId("tm-vessel-select")).toBeDisabled();
  release();
  matrixFixture.delay = null;
  await expect(page.getByTestId("tm-revision-button")).toBeVisible();
  assert.equal(matrixFixture.writes.length, beforeSlow + 2);
  console.log("PASS: slow requests disable conflicting controls and double clicks do not duplicate revisions");
  if (process.env.TM_CAPTURE) {
    await start();
    await page.screenshot({ path: "/tmp/training-matrix-multi-vessel.png" });
    await cancel();
  }
}
