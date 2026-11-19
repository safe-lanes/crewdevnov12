import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const output = "generated-artifacts/wage-revision-checks";
await mkdir(output, { recursive: true });
let count = 0;
const pass = message => console.log(`PASS ${++count}: ${message}`);
async function pageFor() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    localStorage.setItem("userProfile", JSON.stringify({
      role: "Admin", roleId: "d57dd06b-7c4f-4152-8902-c8af0422b3e6",
      userId: "wage-ui-check", name: "Wage UI Check",
    }));
  });
  return page;
}

try {
  if (!process.argv.includes("--portage-only")) {
  // Actual create/update/delete API: only this uniquely named draft is touched.
  const page = await pageFor();
  let createdUuid;
  try {
    await page.goto(`${base}/accounts/master-tables/wage-scales`);
    await page.getByTestId("button-new-scale").click();
    await page.getByTestId("input-scale-name").fill(`Month UI regression ${Date.now()}`);
    await page.getByTestId("input-scale-effective-from-manual").fill("bad");
    let posts = 0;
    page.on("request", request => {
      if (request.method() === "POST" && request.url().endsWith("/wage-scales")) posts++;
    });
    await page.getByTestId("button-create-scale").click();
    await page.waitForTimeout(200);
    assert.equal(posts, 0);
    pass("Real New Scale invalid typing blocks POST");

    await page.getByTestId("input-scale-effective-from-manual").fill("Nov-2090");
    await page.getByTestId("input-scale-effective-to").evaluate(input => {
      input.value = "2091-02";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const createdResponse = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().endsWith("/wage-scales"));
    await page.getByTestId("button-create-scale").click();
    const response = await createdResponse;
    assert.equal(response.status(), 201);
    const payload = response.request().postDataJSON();
    assert.equal(payload.effectiveFrom, "2090-11-01");
    assert.equal(payload.effectiveTo, "2091-02-28");
    const created = await response.json();
    createdUuid = created.scaleUuid ?? created.scale?.scaleUuid;
    assert.ok(createdUuid);
    pass("Real create sends first/last days from shared typed/calendar month controls");

    await page.getByTestId("input-editor-effective-from-manual").fill("bad");
    let puts = 0;
    page.on("request", request => {
      if (request.method() === "PUT" && request.url().endsWith(`/wage-scales/${createdUuid}`)) puts++;
    });
    await page.getByTestId("button-save-dates").click();
    await page.waitForTimeout(200);
    assert.equal(puts, 0);
    pass("Real Edit Draft invalid typing blocks PUT");
    await page.getByTestId("input-editor-effective-from-manual").fill("Dec-2090");
    const savedResponse = page.waitForResponse(response =>
      response.request().method() === "PUT" && response.url().endsWith(`/wage-scales/${createdUuid}`));
    await page.getByTestId("button-save-dates").click();
    const saved = await savedResponse;
    assert.equal(saved.status(), 200);
    assert.equal(saved.request().postDataJSON().effectiveFrom, "2090-12-01");
    pass("Real draft edit saves the selected month");
    await page.screenshot({ path: `${output}/draft-month-editor.jpg` });
  } finally {
    if (createdUuid) {
      const deleted = await page.request.delete(`${base}/api/v2/accounts/wage-scales/${createdUuid}`);
      assert.ok(deleted.ok(), "Test-owned draft cleanup failed");
    }
    await page.close();
  }

  // Financial activation UI uses network fixtures; PostgreSQL behaviour is
  // tested separately, so no live active scales/payroll are changed here.
  const revisionPage = await pageFor();
  const original = { scaleUuid: "ui-original", scaleName: "UI original",
    status: "active", currency: "USD", effectiveFrom: "2090-01-01",
    effectiveTo: "2090-10-31" };
  let revision;
  let activation;
  let revisionPosts = 0;
  await revisionPage.route("**/api/v2/accounts/wage-scales**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body;
    if (path.endsWith("/supersede")) {
      revisionPosts++;
      revision = { scaleUuid: "ui-revision", scaleName: "UI revision", status: "draft",
        currency: "USD", effectiveFrom: request.postDataJSON().effectiveFrom, effectiveTo: null };
      body = revision;
    } else if (path.endsWith("/floor-check")) {
      body = { ok: true, violations: [] };
    } else if (path.endsWith("/activate")) {
      activation = request.postDataJSON();
      original.status = "superseded";
      original.effectiveTo = activation.predecessorAdjustment.nextEffectiveTo;
      revision.status = "active";
      body = { scale: revision, violations: [], overtime: { corrected: 1, protected: 1 } };
    } else if (path.endsWith("/ui-revision")) {
      body = { scale: revision, supersedes: original, lines: [] };
    } else if (path.endsWith("/ui-original")) {
      body = { scale: original, supersedes: null, lines: [] };
    } else {
      body = revision ? [original, revision] : [original];
    }
    await route.fulfill({ json: body });
  });
  await revisionPage.goto(`${base}/accounts/master-tables/wage-scales`);
  await revisionPage.getByTestId("button-supersede-scale-ui-original").click();
  await revisionPage.getByTestId("input-supersede-effective-from-manual").fill("Jan-2000");
  await revisionPage.getByTestId("button-confirm-supersede").click();
  await revisionPage.waitForTimeout(150);
  assert.equal(revisionPosts, 0);
  pass("Revision invalid/past month blocks creation (fixture API)");
  await revisionPage.getByTestId("input-supersede-effective-from-manual").fill("Dec-2090");
  await revisionPage.getByTestId("button-confirm-supersede").click();
  await revisionPage.getByTestId("button-activate-scale").waitFor();
  assert.equal(original.status, "active");
  assert.equal(revision.status, "draft");
  await revisionPage.getByTestId("button-activate-scale").click();
  await revisionPage.getByRole("dialog").filter({ hasText: "Confirm predecessor end date" }).waitFor();
  assert.equal(activation, undefined);
  await revisionPage.getByRole("button", { name: "Confirm and activate", exact: true }).click();
  await revisionPage.getByTestId("banner-readonly").waitFor();
  assert.deepEqual(activation.predecessorAdjustment, {
    predecessorUuid: "ui-original", previousEffectiveTo: "2090-10-31",
    revisionEffectiveFrom: "2090-12-01", nextEffectiveTo: "2090-11-30",
  });
  assert.equal(await revisionPage.getByTestId("input-editor-effective-from-manual").isDisabled(), true);
  pass("Activation requires old/new confirmation and sends exact payload; active fields read-only (fixture API)");
  await revisionPage.screenshot({ path: `${output}/activated-revision.jpg` });
  await revisionPage.close();
  }

  const portagePage = await pageFor();
  await portagePage.addInitScript(() => sessionStorage.setItem("accounts-vessel-period",
    JSON.stringify({ state: { vesselUuid: "ui-vessel", period: "2090-12" }, version: 0 })));
  const txn = { txnUuid: "ui-txn", crewUuid: "ui-crew", engagementUuid: "ui-eng",
    vesselUuid: "ui-vessel", period: "2090-12", payElementUuid: "ui-ot", status: "accepted",
    origin: "vessel", currency: "USD", qty: "10", rate: "10", amount: "100", id: 1 };
  const lookups = [];
  let failLookup = false;
  let portageWrites = 0;
  await portagePage.route("**/api/v2/accounts/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" &&
        url.pathname.startsWith("/api/v2/accounts/monthly-transactions")) portageWrites++;
    let body = [];
    if (url.pathname.endsWith("/wage-values")) {
      lookups.push(url.pathname);
      if (failLookup) return route.fulfill({ status: 500, json: { error: "Injected lookup failure" } });
      body = { values: { "ui-eng": { entries: {
        "ui-ot": { rate: "15", amount: null },
        "ui-got": { rate: null, amount: "450" },
      }, errors: [] } }, protectedTxnUuids: ["ui-txn"], frozenEngagementUuids: [] };
    } else if (url.pathname.endsWith("/status")) {
      body = { portage: { portageUuid: "ui-bill", status: "open", isLocked: false }, counts: {} };
    } else if (url.pathname.endsWith("/pay-elements")) {
      body = [
        { payElementUuid: "ui-ot", code: "OT", name: "Overtime", category: "overtime_variable", calcMethod: "rate_times_qty", status: "active", type: "earning" },
        { payElementUuid: "ui-got", code: "GOT", name: "Guaranteed overtime", category: "overtime_fixed", calcMethod: "scale_lookup", status: "active", type: "earning" },
      ];
    } else if (url.pathname.endsWith("/monthly-transactions")) {
      body = [txn];
    } else if (url.pathname.endsWith("/engagements/review")) {
      body = [{ crewUuid: "ui-crew", crewName: "UI Crew", presentRank: "Captain",
        engagement: { engagementUuid: "ui-eng", wageScaleUuid: "ui-original", crewUuid: "ui-crew",
          vesselUuid: "ui-vessel", rankIdAtStart: "capt", status: "active" } }];
    } else if (url.pathname.endsWith("/config")) {
      body = { preparationMode: "vessel_prepares", functionalCurrency: "USD" };
    } else if (url.pathname.includes("/ctm/")) {
      body = { ctm: null, lines: [] };
    } else if (url.pathname.endsWith("/portage")) {
      body = { portage: { status: "open" }, lines: [], rows: [] };
    }
    await route.fulfill({ json: body });
  });
  await portagePage.goto(`${base}/accounts/payroll/vessel-portage`);
  await portagePage.getByTestId("tab-overtime").click();
  const row = portagePage.locator('.ag-row').filter({ hasText: "UI Crew" }).first();
  await row.waitFor();
  await portagePage.waitForTimeout(500);
  assert.ok(lookups.some(path => path.endsWith("/ui-vessel/2090-12/wage-values")));
  // AG Grid renders pinned crew columns in a separate row container.
  const text = await portagePage.locator(".ag-center-cols-container .ag-row").first().innerText();
  assert.ok(text.includes("30"), text);
  assert.ok(text.includes("10.00"), text);
  assert.ok(text.includes("100"), text);
  pass("Portage lookup uses vessel/month; GOT hours use applicable values, protected rate/amount stay saved (fixture API)");
  await portagePage.screenshot({ path: `${output}/protected-overtime.jpg` });
  failLookup = true;
  await portagePage.reload();
  await portagePage.getByTestId("tab-overtime").click();
  await portagePage.getByRole("alert").filter({ hasText: "Applicable Wage Scale values could not be loaded" }).waitFor();
  pass("Lookup failure is visible instead of silently using the original scale (fixture API)");
  txn.status = "draft";
  failLookup = false;
  await portagePage.reload();
  await portagePage.getByTestId("tab-overtime").click();
  const hours = portagePage.locator(
    '.ag-center-cols-container .ag-row[row-index="0"] .ag-cell[col-id="excessHrs"]',
  );
  await hours.dblclick();
  const editor = portagePage.locator(".ag-cell-inline-editing input").first();
  await editor.fill("12");
  await editor.press("Enter");
  await portagePage.getByTestId("text-unsaved-overtime").waitFor();
  failLookup = true;
  await portagePage.evaluate(async () => {
    const { queryClient } = await import("/src/lib/queryClient.ts");
    await queryClient.invalidateQueries({
      predicate: query => String(query.queryKey[0]).endsWith("/wage-values"),
    });
  });
  await portagePage.getByRole("alert").filter({ hasText: "Applicable Wage Scale values could not be loaded" }).waitFor();
  await portagePage.getByTestId("button-save-overtime").click();
  await portagePage.getByText("Your unsaved entries have been kept.", { exact: false }).first().waitFor();
  assert.equal(portageWrites, 0);
  assert.ok((await hours.innerText()).includes("12"));
  assert.equal(await portagePage.getByTestId("text-unsaved-overtime").isVisible(), true);
  pass("Missing-rate save is caught, sends no batch, and retains edited hours (fixture API)");
  await portagePage.screenshot({ path: `${output}/unsaved-overtime-retained.jpg` });
  await portagePage.close();
  console.log(`${count} browser workflow checks passed.`);
} finally {
  await browser.close();
}
