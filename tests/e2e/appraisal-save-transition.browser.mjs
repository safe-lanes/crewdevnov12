// Actual appraisal form/parts, queries, mutations, toast and CSS, using isolated
// HTTP fixtures only. Never connects to a tenant database.
// Run: node tests/e2e/appraisal-save-transition.browser.mjs
import { build } from "esbuild";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

let writes = [];
let saved = null;
let pendingConfiguration = null;
let failConfiguration = false;
let editMode = false;
const pinned = {
  formVersionId: 17, formVersionUuid: "version-17", rankGroupName: "Officers",
  rankGroupConfig: {},
};
const css = (await postcss([tailwindcss("./tailwind.config.ts")]).process(
  "@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined },
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
      import {Toaster} from "./client/src/components/ui/toaster";
      import {AppraisalForm} from "./client/src/modules/crewing/AppraisalForm_v2";
      queryClient.setDefaultOptions({queries:{...queryClient.getDefaultOptions().queries,retry:false}});
      window.fixtureQueryClient=queryClient;
      const crew={id:"fixture-crew",name:{first:"Demo",middle:"",last:"Crew"},rank:"Master"};
      const id=location.search.includes("edit")?42:undefined;
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={queryClient}><TooltipProvider>
          <AppraisalForm crewMember={crew} appraisalId={id} onClose={()=>window.fixtureClosed=true}/>
          <Toaster/>
        </TooltipProvider></QueryClientProvider>
      );`,
  },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"test"' },
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "fixture-permissions",
    setup(builder) {
      builder.onResolve({ filter: /contexts\/PermissionsContext$/ },
        args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        loader: "js", contents: `const permissions=[];
          export const usePermissions=()=>({permissions,canView:()=>true});
          export const getUserProfile=()=>null;`,
      }));
    },
  }],
});
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("content-type", "application/javascript");
    return res.end(bundle.outputFiles[0].text);
  }
  if (req.url.startsWith("/api/")) {
    res.setHeader("content-type", "application/json");
    if (req.url.includes("/form-versions/17/configuration")) {
      pendingConfiguration = () => {
        res.statusCode = failConfiguration ? 503 : 200;
        res.end(JSON.stringify(failConfiguration ? { message: "fixture read failure" } : pinned));
      };
      return;
    }
    if (req.method !== "GET") {
      let raw = ""; for await (const part of req) raw += part;
      const body = JSON.parse(raw);
      writes.push({ method: req.method, url: req.url, body });
      saved = { ...body, id: 42, formVersionId: 17, formVersionUuid: "version-17" };
      return res.end(JSON.stringify(saved));
    }
    if (req.url.includes("/forms/for-rank/")) return res.end(JSON.stringify(pinned));
    if (req.url === "/api/v2/appraisals/42") {
      return res.end(JSON.stringify(editMode ? { ...saved, formVersionId: null, formVersionUuid: null } : saved));
    }
    return res.end("[]");
  }
  res.setHeader("content-type", "text/html");
  res.end(`<html><head><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  for (const mode of ["new", "edit", "failed", "mobile"]) {
    writes = []; pendingConfiguration = null; failConfiguration = mode === "failed";
    editMode = mode === "edit";
    saved = {
      id: 42, status: "draft", formVersionId: 17, formVersionUuid: "version-17",
      appraisalData: {
        seafarersName: "Demo Crew", seafarersRank: "Master", nationality: "", vessel: "", signOn: "",
        appraisalType: "", appraisalPeriodFrom: "", appraisalPeriodTo: "",
        personalityIndexCategory: "", primaryAppraiser: "", trainings: [], targets: [],
        competenceAssessments: [], behaviouralAssessments: [], recommendations: [], trainingNeeds: [],
        trainingFollowups: [], officeReviews: [], appraiserComments: [], seafarerComments: [],
      },
    };
    const page = await browser.newPage({
      viewport: mode === "mobile" ? { width: 390, height: 780 } : { width: 1280, height: 850 },
    });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?${mode}`);
    const input = page.getByTestId("select-primary-appraiser");
    await expect(input).toBeVisible();
    await input.click();
    await page.getByRole("option", { name: "Master", exact: true }).click();
    await page.evaluate(() => {
      window.originalInput = document.querySelector('[data-testid="select-primary-appraiser"]');
      window.originalScroll = document.querySelector('[data-testid="container-continuous-ab"]');
      window.originalScroll.scrollTop = 120;
      window.scrollBefore = window.originalScroll.scrollTop;
      window.loadingPopups = [];
      window.popupObserver = new MutationObserver(() => {
        if (document.body.textContent.includes("Loading form configuration")) window.loadingPopups.push(true);
      });
      window.popupObserver.observe(document.getElementById("root"), { subtree: true, childList: true });
    });
    const save = page.getByTestId(mode === "mobile" ? "button-save-draft-header-mobile" : "button-save-draft-header");
    await save.click();
    await expect.poll(() => writes.length).toBe(1);
    await expect.poll(() => !!pendingConfiguration).toBe(true);
    await expect(page.getByTestId("appraisal-configuration-status")).toBeVisible();
    await expect(save).toBeDisabled();
    assert.equal(await page.evaluate(() => document.querySelector('[data-testid="select-primary-appraiser"]') === window.originalInput), true);
    assert.equal(await input.evaluate(el => !!el.closest("[inert]")), true);
    // Native inert prevents focus/keyboard edits; the header stays closable.
    await input.evaluate(el => el.focus());
    assert.equal(await input.evaluate(el => document.activeElement === el), false);
    await page.waitForTimeout(1100);
    await expect(page.getByText("Draft Saved", { exact: true })).toBeVisible();
    pendingConfiguration();
    if (failConfiguration) {
      await expect(page.getByTestId("appraisal-configuration-status")).toContainText("was saved, but");
      await expect(save).toBeDisabled();
      await expect(page.getByTestId("appraisal-configuration-status")).toHaveAttribute("role", "alert");
    } else {
      await expect(save).toBeEnabled();
      await expect(input).toContainText("Master");
      assert.equal(await page.evaluate(() => document.querySelector('[data-testid="container-continuous-ab"]') === window.originalScroll), true);
      assert.equal(await page.evaluate(() => window.originalScroll.scrollTop === window.scrollBefore), true);
      await expect(page.getByTestId("select-pi-category")).toContainText("Select category");
      await save.click();
      await expect.poll(() => writes.length).toBe(2);
      assert.equal(writes[1].method, "PUT");
    }
    assert.equal(await page.evaluate(() => window.loadingPopups.length), 0);
    assert.deepEqual(errors, []);
    assert.equal(writes[0].body.expectedFormVersionId, 17);
    if (mode === "new") await page.screenshot({ path: "/tmp/appraisal-save-transition.jpg" });
    await page.getByRole("button", { name: "Close appraisal", exact: true }).click();
    assert.equal(await page.evaluate(() => window.fixtureClosed), true);
    console.log(`PASS ${mode}: stable form, readable toast, guarded version transition and correct saves`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
