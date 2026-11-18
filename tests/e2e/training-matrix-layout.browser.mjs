// Isolated browser regression: real AdminModule, table, inputs, hooks and CSS.
// Only permissions and HTTP data are fixtures; never connects to a tenant DB.
// Run: node tests/e2e/training-matrix-layout.browser.mjs
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";

const baseline = process.argv.includes("--baseline");
const captureOnly = process.argv.includes("--capture");
const realisticLabels = [
  "Basic Training", "Personal Survival Techniques (PST)",
  "Fire Prevention and Fire Fighting (FPFF)", "Elementary First Aid (EFA)",
  "Personal Safety and Social Responsibilities (PSSR)", "Advanced Fire Fighting (AFF)",
];
const trainings = Array.from({ length: 80 }, (_, i) => ({
  id: i + 1, companyId: `SA${String(i + 1).padStart(3, "0")}`,
  trainingLabel: realisticLabels[i] || `Training ${i + 1}`,
  abr: i === 0 ? "ADVANCED-FIRE-FIGHTING-CERTIFICATE" : i === 1 ? "" : "AFF",
  requirement: "STCW", groupCode: "A", sortOrder: i,
}));
const ranks = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1, name: `Rank ${i + 1}`, label: `Rank ${i + 1}`,
  rankId: `R${i + 1}`, applicableToCompany: true,
}));
let rankCount = 24;
const writes = [];
let savedRequirements = [];
let vesselDraft = null;
let vesselRevisions = [];
const css = (await postcss([tailwindcss("./tailwind.config.ts")]).process(
  "@tailwind base; @tailwind components; @tailwind utilities;",
  { from: undefined },
)).css;
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClientProvider} from "@tanstack/react-query";
      import {queryClient} from "./client/src/lib/queryClient";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      import {AdminModule_v2} from "./client/src/modules/admin/AdminModule";
      window.fixtureQueryClient=queryClient;
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={queryClient}><TooltipProvider>
          <div style={{height:67}}>Training Matrix layout regression fixture</div>
          <AdminModule_v2 />
        </TooltipProvider></QueryClientProvider>
      );
    `,
  },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"test"' },
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "isolated-permissions",
    setup(builder) {
      builder.onResolve({ filter: /contexts\/PermissionsContext$/ },
        args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        loader: "js",
        contents: `const permissions=[];
          export const usePermissions=()=>({permissions,isLoading:false,myVessels:[],userType:"Office",
            canView:()=>true,canCreate:()=>true,canEdit:()=>true,canDelete:()=>true,
            canViewRoute:()=>true,canCompanyFormAction:()=>true,getVesselIds:()=>[]});
          export const getUserProfile=()=>null;
          export const PermissionsProvider=({children})=>children;`,
      }));
    },
  }],
});
const server = createServer(async (req, res) => {
  if (req.url.startsWith("/fixture/rank-count/")) {
    rankCount = Number(req.url.split("/").pop());
    return res.end("ok");
  }
  if (req.url === "/bundle.js") {
    res.setHeader("content-type", "application/javascript");
    return res.end(bundle.outputFiles[0].text);
  }
  if (req.url.startsWith("/api/")) {
    res.setHeader("content-type", "application/json");
    const url = new URL(req.url, "http://fixture");
    let data = [];
    if (url.pathname.endsWith("/company-trainings")) data = trainings;
    if (url.pathname.endsWith("/available-ranks")) data = ranks.slice(0, rankCount);
    if (url.pathname.endsWith("/company-training-groups")) data = [{ code: "A", label: "Statutory" }];
    if (url.pathname.endsWith("/company-training-requirements")) data = savedRequirements;
    if (url.pathname.endsWith("/external/vessels")) data = {
      data: [{ id: 1, vesselUuid: "fixture-vessel", vessel: "Fixture Vessel", isActive: true }],
    };
    if (url.pathname.includes("/next-revision/")) data = { nextRevision: "R1", currentRevisionCount: 1 };
    if (url.pathname.includes("/training-matrix-vessel-drafts/by-vessel/")) data = vesselDraft ? [vesselDraft] : [];
    if (url.pathname.includes("/training-matrix-vessel-revisions/by-vessel/")) data = vesselRevisions;
    if (url.pathname.includes("/training-matrix-equivalents/")) data = {
      vesselId: "fixture-vessel", source: { kind: "none", uuid: null, revision: null },
      latestRevisionUuid: null, links: [], courses: [], requirements: [], revisions: [],
    };
    if (req.method !== "GET") {
      let body = "";
      for await (const chunk of req) body += chunk;
      writes.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      const id = Number(url.pathname.split("/").pop());
      if (req.method === "PATCH" && url.pathname.includes("/company-trainings/")) {
        const row = trainings.find(t => t.id === id);
        Object.assign(row, JSON.parse(body));
        data = row;
      } else if (url.pathname.endsWith("/company-training-requirements/batch")) {
        savedRequirements = JSON.parse(body);
        data = savedRequirements;
      } else if (url.pathname.endsWith("/training-matrix-vessel-drafts/upsert")) {
        vesselDraft = { id: 1, ...JSON.parse(body), updatedAt: new Date().toISOString() };
        data = vesselDraft;
      } else if (url.pathname.endsWith("/training-matrix-vessel-revisions/submit")) {
        vesselRevisions = [{ id: 1, revision: "R1", ...JSON.parse(body) }];
        vesselDraft = null;
        data = vesselRevisions[0];
      } else data = {};
    }
    return res.end(JSON.stringify(data));
  }
  res.setHeader("content-type", "text/html");
  res.end(`<style>${css}</style><div id="root"></div><script src="/bundle.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => { errors.push(e.message); console.error("BROWSER:", e.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/admin/training-matrix`);
  await page.getByText("Training Matrix", { exact: true }).click();
  try {
    await page.getByTestId("title-training-matrix").waitFor({ timeout: 10000 });
  } catch (error) {
    console.log("Fixture screen:", (await page.locator("body").innerText()).slice(0, 2000));
    throw error;
  }
  await page.getByTestId("tab-training-company").click();
  await page.getByTestId("row-company-training-80").waitFor({ state: "attached" });
  await page.getByTestId("button-edit-company-training").click();
  const input = page.getByTestId("input-company-abr-1");
  const dimensions = await input.evaluate(el => ({
    client: el.clientWidth, text: el.scrollWidth,
    cell: el.closest("td").getBoundingClientRect().width,
  }));
  console.log("Company abbreviation dimensions:", dimensions);
  if (captureOnly) {
    await page.screenshot({ path: "/tmp/training-matrix-company-edit.png" });
    console.log("Captured isolated fixture: /tmp/training-matrix-company-edit.png");
  }
  if (baseline) {
    assert.ok(dimensions.text > dimensions.client, "Baseline should reproduce clipped abbreviation");
    console.log("Baseline scroll owners:", await page.getByTestId("content-training-company").evaluate(el =>
      [...el.querySelectorAll("div")].filter(d => d.scrollWidth > d.clientWidth + 1).map(d => ({
        class: d.className, height: d.clientHeight, scrollHeight: d.scrollHeight,
        bottom: d.getBoundingClientRect().bottom,
      }))));
  } else if (!captureOnly) {
    assert.ok(dimensions.text <= dimensions.client + 1, "Full abbreviation must fit without input scrolling");
    console.log("PASS: existing long abbreviation fits while unfocused");
    const settle = () => page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const companyEdit = () => page.locator('[data-testid^="button-edit-company-training"]:visible');
    const assertInputFits = async (locator, value) => {
      await expect(locator).toHaveValue(value);
      await settle();
      const size = await locator.evaluate(el => ({
        visible: el.clientWidth, content: el.scrollWidth, left: el.scrollLeft,
      }));
      assert.ok(size.content <= size.visible + 1, `Unclipped input: ${JSON.stringify(size)}`);
      assert.equal(size.left, 0, "No hidden text left of the cursor");
    };
    const checkScrollPanel = async (kind, vertical = true, requireOverflow = true) => {
      const panel = page.getByTestId(`${kind}-training-table-viewport`);
      const scroll = panel.locator(":scope > div");
      await settle();
      const initial = await scroll.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const main = el.closest("main").getBoundingClientRect();
        return {
          width: el.clientWidth, contentWidth: el.scrollWidth,
          height: el.clientHeight, contentHeight: el.scrollHeight,
          top: rect.top, bottom: rect.bottom, screen: innerHeight, mainBottom: main.bottom,
          overflow: getComputedStyle(el).overflowX,
        };
      });
      const headingHeight = await panel.locator("thead").evaluate(el => el.getBoundingClientRect().height);
      assert.ok(initial.height > headingHeight + 10,
        `${kind}: both headings and rows remain visible ${JSON.stringify(initial)}`);
      assert.ok(initial.bottom <= Math.min(initial.screen, initial.mainBottom) + 1,
        `${kind}: horizontal scrollbar stays on screen ${JSON.stringify(initial)}`);
      assert.ok(["auto", "scroll"].includes(initial.overflow), "Native horizontal scrolling retained");
      if (requireOverflow) assert.ok(initial.contentWidth > initial.width, `${kind}: rank columns overflow`);
      if (vertical) assert.ok(initial.contentHeight > initial.height, `${kind}: rows scroll inside panel`);

      for (const fraction of [0, 0.5, 1]) {
        await scroll.evaluate((el, f) => {
          el.scrollTop = (el.scrollHeight - el.clientHeight) * f;
          el.scrollLeft = 0;
        }, fraction);
        await settle();
        const header = await panel.locator("thead").boundingBox();
        assert.ok(header.y >= initial.top - 1 && header.y <= initial.top + 2,
          `${kind}: header remains sticky at row fraction ${fraction}`);
        await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        await settle();
        const lastHeader = await panel.locator("thead th").last().boundingBox();
        const bounds = await scroll.boundingBox();
        assert.ok(lastHeader.x + lastHeader.width <= bounds.x + bounds.width + 1,
          `${kind}: final rank column reachable`);
        const exposed = await panel.locator("thead th").last().evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        assert.ok(exposed, `${kind}: final rank must not be covered by frozen columns`);
        const bottom = await scroll.evaluate(el => el.getBoundingClientRect().bottom);
        assert.ok(bottom <= initial.screen + 1, `${kind}: scrollbar accessible at row fraction ${fraction}`);
      }
      await scroll.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
      if (initial.contentWidth > initial.width) {
        await scroll.hover();
        await page.mouse.wheel(500, 0);
        await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
      await scroll.evaluate(el => { el.scrollLeft = 0; });
      await settle();
      const overlap = await panel.locator("table").evaluate(table => {
        const heads = [...table.tHead.rows[0].cells];
        const cells = [...table.tBodies[0].rows[0].cells];
        const fixed = heads.filter(cell => getComputedStyle(cell).position === "sticky");
        const dataFixed = cells.filter(cell => getComputedStyle(cell).position === "sticky");
        const overlaps = list => list.slice(1).some((cell, i) =>
          cell.getBoundingClientRect().left < list[i].getBoundingClientRect().right - 1);
        const firstUnfrozen = heads.find(cell => getComputedStyle(cell).position !== "sticky");
        const covered = firstUnfrozen && fixed.length > 0 &&
          firstUnfrozen.getBoundingClientRect().left < fixed.at(-1).getBoundingClientRect().right - 1;
        return {
          headerOverlap: overlaps(fixed), rowOverlap: overlaps(dataFixed), covered,
          widths: fixed.map(cell => cell.getBoundingClientRect().width),
          lefts: fixed.map(cell => cell.getBoundingClientRect().left),
        };
      });
      assert.equal(overlap.headerOverlap, false, `${kind}: frozen headers must not overlap ${JSON.stringify(overlap)}`);
      assert.equal(overlap.rowOverlap, false, `${kind}: frozen row cells must not overlap ${JSON.stringify(overlap)}`);
      assert.equal(overlap.covered, false, `${kind}: first unfrozen column must not be covered ${JSON.stringify(overlap)}`);
      if (kind === "company") {
        // A fitting input can still be hidden behind the Training Label cell.
        // Check actual hit targets at both edges, not only scrollWidth.
        const abr = panel.locator('[data-testid="input-company-abr-1"]');
        if (await abr.count()) {
          // On phones the abbreviation initially lies beyond the viewport.
          // Bring it beside (not underneath) the remaining frozen ID columns.
          await abr.evaluate(el => {
            const table = el.closest("table"), viewport = table.parentElement;
            const fixed = [...table.tHead.rows[0].cells]
              .filter(cell => getComputedStyle(cell).position === "sticky")
              .reduce((width, cell) => width + cell.getBoundingClientRect().width, 0);
            const rect = el.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
            if (rect.left >= bounds.right - 4) viewport.scrollLeft += rect.left - bounds.left - fixed - 8;
          });
          await settle();
          const exposed = await abr.evaluate(el => {
            const r = el.getBoundingClientRect(), viewport = el.closest("table").parentElement.getBoundingClientRect();
            const points = [r.left + 2, Math.min(r.right - 2, viewport.right - 2)]
              .filter(x => x >= Math.max(viewport.left, r.left) && x < Math.min(viewport.right, r.right));
            return points.length > 0 && points.every(x =>
              el.contains(document.elementFromPoint(x, r.y + r.height / 2)));
          });
          assert.ok(exposed, "Abbreviation input edges must not be hidden by another column");
          await assertInputFits(page.getByTestId("input-company-id-1"), "SA001");
          await scroll.evaluate(el => { el.scrollLeft = 0; });
          await settle();
        }
      }
      // The same table lays out headers and cells; verify measured alignment.
      const alignment = await panel.locator("table").evaluate(table => {
        const heads = [...table.tHead.rows[0].cells];
        const cells = [...table.tBodies[0].rows[0].cells];
        return heads.every((head, index) =>
          Math.abs(head.getBoundingClientRect().width - cells[index].getBoundingClientRect().width) < 1);
      });
      assert.ok(alignment, `${kind}: header/body alignment`);
      console.log(`PASS: ${kind} scrollbar, sticky headings, last rank, row scrolling and alignment at ${page.viewportSize().width}px`);
    };

    // Typing/pasting values must not truncate, rewrite or silently persist them.
    for (const value of ["", "AFF", "W".repeat(85), "  EFA / 海上安全 / Medical First Aid  "]) {
      await input.fill(value);
      await page.getByTestId("input-company-requirement-1").focus();
      await assertInputFits(input, value);
    }
    const savedText = "ADVANCED-FIRE-FIGHTING-CERTIFICATE";
    await input.fill(savedText);
    await page.getByTestId("checkbox-m-1-24").check();
    assert.equal(writes.length, 0, "Typing and checking are local until Save");
    await checkScrollPanel("company");
    await companyEdit().click();
    await expect(page.getByTestId("input-company-abr-1")).toHaveCount(0);
    assert.equal(writes.length, 2, "Save uses only original company and requirements endpoints");
    assert.equal(writes.find(w => w.method === "PATCH").body.abr, savedText);
    assert.deepEqual(writes.find(w => w.url.endsWith("/company-training-requirements/batch")).body,
      [{ companyTrainingId: 1, rankId: 24, status: "M", auditUserUuid: null }]);
    await expect(page.getByTestId("cell-company-abr-1")).toHaveText(savedText);
    console.log("PASS: long, empty, pasted and spaced abbreviations; existing Save payload and rank requirement preserved");
    await companyEdit().click();
    await assertInputFits(page.getByTestId("input-company-abr-1"), savedText);
    await assertInputFits(page.getByTestId("input-company-abr-2"), "");
    const writeCount = writes.length;
    await companyEdit().click();
    assert.equal(writes.length, writeCount, "Save without edits performs no write");

    // Few ranks let auto-layout expand fixed tracks; many ranks compress them.
    // Both cases must use the measured track widths rather than nominal offsets.
    for (const count of [1, 3, 24]) {
      await page.evaluate(async count => {
        await fetch("/fixture/rank-count/" + count);
        await window.fixtureQueryClient.invalidateQueries({
          predicate: query => query.queryKey.includes("available-ranks"),
        });
      }, count);
      await expect(page.getByTestId("company-training-table-viewport").locator("thead th")).toHaveCount(6 + count);
      await checkScrollPanel("company", true, false);
      await companyEdit().click();
      await checkScrollPanel("company", true, false);
      await companyEdit().click();
    }

    for (const [width, height] of [[1280, 800], [900, 800], [390, 800], [1280, 600], [390, 667]]) {
      await page.setViewportSize({ width, height });
      await settle();
      await checkScrollPanel("company");
      await companyEdit().click();
      await checkScrollPanel("company");
      await assertInputFits(page.getByTestId("input-company-abr-1"), savedText);
      await companyEdit().click();
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle();
    await page.getByTestId("button-toggle-company-training-filters").click();
    await checkScrollPanel("company");
    await page.getByTestId("button-toggle-company-training-filters").click();
    await page.getByTestId("input-search-company-training").fill("Training 80");
    await expect(page.locator('[data-testid^="row-company-training-"]')).toHaveCount(1);
    await checkScrollPanel("company", false);
    await page.getByTestId("input-search-company-training").fill("nothing matches");
    await expect(page.getByText("No trainings match your search.")).toBeVisible();
    await page.getByTestId("input-search-company-training").fill("");

    await page.getByTestId("tab-training-vessel").click();
    await page.getByTestId("tm-vessel-select").click();
    await page.getByText("Fixture Vessel", { exact: true }).last().click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("row-vessel-training-80")).toHaveCount(1);
    for (const [width, height] of [[1280, 800], [900, 800], [390, 800], [1280, 600], [390, 667]]) {
      await page.setViewportSize({ width, height });
      await settle();
      await checkScrollPanel("vessel");
      await page.getByTestId("tm-revision-button").click();
      await checkScrollPanel("vessel");
      await page.getByTestId("checkbox-app-to-vessel-1").check();
      await page.getByTestId("tm-cancel-button").click();
      await expect(page.getByTestId("tm-revision-button")).toBeVisible();
    }
    assert.equal(writes.length, writeCount, "Resizing, filtering, scrolling and Revision Cancel do not save");
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle();
    await page.getByTestId("tm-revision-button").click();
    await page.getByTestId("checkbox-app-to-vessel-1").check();
    await page.getByTestId("tm-save-draft-button").click();
    await expect.poll(() => writes.length).toBe(writeCount + 1);
    assert.deepEqual(writes.at(-1).body, {
      vesselId: "fixture-vessel", draftData: { applicableTrainingIds: [1] },
    });
    await expect(page.getByTestId("checkbox-app-to-vessel-1")).toBeChecked();
    await checkScrollPanel("vessel");
    await page.getByTestId("tm-submit-button").click();
    await expect(page.getByTestId("tm-revision-button")).toBeVisible();
    assert.equal(writes.length, writeCount + 2);
    assert.deepEqual(writes.at(-1).body.revisionData, { applicableTrainingIds: [1] });
    assert.equal(writes.at(-1).body.vesselId, "fixture-vessel");
    assert.match(writes.at(-1).body.revisionDate, /^\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByTestId("row-vessel-training-1").locator('input[type="checkbox"]')).toBeChecked();
    await checkScrollPanel("vessel");
    await page.getByTestId("tab-training-training-master").click();
    await expect(page.getByTestId("content-training-master")).toBeVisible();
    assert.equal(await page.getByTestId("content-training-master").locator('[data-testid$="training-table-viewport"]').count(), 0);
    await page.getByTestId("tab-training-company").click();
    await checkScrollPanel("company");
    console.log("PASS: filters, empty results, resize, tab switches, Vessel Cancel/Save Draft/Submit; Training Master remains unchanged");
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  if (baseline || captureOnly) assert.equal(writes.length, 0, "Opening and measuring the table must not write data");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
