// Real live hosts/renderer against isolated HTTP fixtures; never uses a tenant DB.
// Run: node tests/e2e/saved-point-comments.browser.mjs
import { build } from "esbuild";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createServer } from "node:http";
import path from "node:path";

const fixtures = await build({
  entryPoints: ["tests/point-comments/fixtures.ts"],
  bundle: true, write: false, platform: "node", format: "esm",
});
const { companyFixture, legacyFixture, formFamilies } = await import(
  `data:text/javascript;base64,${Buffer.from(fixtures.outputFiles[0].text).toString("base64")}`
);
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import Briefing from "./client/src/modules/crew-pool/components/BriefingLiveSubmissionHost";
      import Debriefing from "./client/src/modules/crew-pool/components/DebriefingLiveSubmissionHost";
      import Interview from "./client/src/modules/recruitment/components/InterviewLiveSubmissionHost";
      import {CompanySubmissionRenderer} from "./client/src/components/configured-form/companySubmissionContract";
      const Host={briefing:Briefing,debriefing:Debriefing,interview:Interview,company:CompanySubmissionRenderer}
        [new URLSearchParams(location.search).get("family")];
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
          <Host submissionUuid="saved" onBack={()=>{}}/>
        </QueryClientProvider>);`,
  },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"test"' },
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "isolated-permissions-and-pdf",
    setup(builder) {
      builder.onResolve({ filter: /contexts\/PermissionsContext$/ },
        () => ({ path: "permissions", namespace: "fixture" }));
      builder.onResolve({ filter: /CompanyPdfActions$/ },
        () => ({ path: "pdf", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "js", contents: args.path === "pdf"
          ? "export const CompanyPdfActions=()=>null;"
          : `export const usePermissions=()=>({roleName:"Admin",roleId:"admin",userType:"Office"});
             export const getUserProfile=()=>null;`,
      }));
    },
  }],
});
const css = (await postcss([tailwindcss("./tailwind.config.ts")]).process(
  "@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined },
)).css;
const longComment = `Saved observation: safety briefing completed.\n${"A long saved comment should wrap without clipping. ".repeat(8)}`;
let stored;
let matrix;
let family;
let writes;
let draftReceipt;
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("content-type", "application/javascript");
    return res.end(bundle.outputFiles[0].text);
  }
  if (req.url.startsWith("/api/")) {
    res.setHeader("content-type", "application/json");
    if (req.method === "GET") {
      const fixture = family === "company" ? companyFixture(stored, matrix) : legacyFixture(stored, matrix);
      if (draftReceipt) Object.assign((fixture.states || fixture.section_states)[0], family === "company" ? draftReceipt : {
        last_draft_saved_at: draftReceipt.lastDraftSavedAt,
        last_draft_saved_by_uuid: draftReceipt.lastDraftSavedByUuid,
        last_draft_saved_by_name: draftReceipt.lastDraftSavedByName,
      });
      return res.end(JSON.stringify(fixture));
    }
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    writes.push({ method: req.method, url: req.url, body });
    if (req.url.endsWith("/answers")) {
      for (const answer of body.answers) {
        stored.value = answer.value;
        if (answer.comment !== undefined) stored.comment = answer.comment;
      }
      if (body.explicitDraftSave) {
        // Delay the acknowledgement so Saving… and disabled actions are visible.
        await new Promise(resolve => setTimeout(resolve, 180));
        draftReceipt = { lastDraftSavedAt: new Date().toISOString(), lastDraftSavedByUuid: "fixture-saver", lastDraftSavedByName: "Fixture Saver" };
        return res.end(JSON.stringify(draftReceipt));
      }
    } else if (req.url.endsWith("/submit")) stored.submitted = true;
    else { res.statusCode = 400; return res.end(JSON.stringify({ error: "Unexpected fixture write" })); }
    return res.end("{}");
  }
  res.setHeader("content-type", "text/html");
  res.end(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root{--background:0 0% 100%;--foreground:222 47% 11%;--muted:210 40% 96%;--border:214 32% 91%;--input:214 32% 91%;--primary:211 74% 35%;--primary-foreground:0 0% 100%;--radius:.5rem}
    ${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    for (family of formFamilies) {
      for (matrix of [false, true]) {
        stored = { comment: longComment, value: "yes", submitted: true };
        draftReceipt = null;
        writes = [];
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        const url = `http://127.0.0.1:${server.address().port}/?family=${family}`;
        await page.goto(url);
        const comment = page.getByTestId("preview-comment-display-point");
        await expect(comment).toHaveText(longComment);
        await expect(page.getByTestId("button-preview-comment-point")).toHaveCount(0);
        await expect(page.getByTestId("preview-comment-point")).toHaveCount(0);
        if (matrix) await expect(page.getByTestId("matrix-option-point-1")).toBeChecked();
        else await expect(page.getByTestId("preview-response-point")).toContainText("Yes");
        expect(await comment.evaluate(el => el.tagName)).toBe("P");
        expect(await comment.evaluate(el => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
        expect(await comment.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        // Comments must not expand an otherwise compact table to their full
        // text width. Existing narrow-screen table scrolling stays unchanged.
        expect(await comment.evaluate(el => {
          const table = el.closest("table");
          const wrapper = table.parentElement;
          return table.clientWidth <= Math.max(600, wrapper.clientWidth) + 2;
        })).toBe(true);
        expect(writes).toHaveLength(0);
        await page.reload();
        await expect(comment).toHaveText(longComment);
        expect(writes).toHaveLength(0);
        if (family === "briefing") {
          await comment.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/tmp/point-comment-${viewport.width}-${matrix ? "matrix" : "list"}.png` });
        }
        // Enter/edit -> explicit submit -> refresh from saved-response fixture.
        stored.submitted = false;
        await page.reload();
        await comment.click();
        const editor = page.getByTestId("preview-comment-point");
        await editor.fill("New submitted observation");
        await editor.blur();
        await page.getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
        await expect(page.getByText("Draft saved successfully", { exact: true })).toBeVisible();
        await expect(page.getByText("Last Saved by: Fixture Saver", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
        if (family === "briefing" && !matrix) {
          await page.getByText("Last Saved by: Fixture Saver", { exact: true }).scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/tmp/draft-saved-${viewport.width}.png` });
        }
        await page.reload();
        await expect(page.getByText("Draft", { exact: true })).toBeVisible();
        await expect(page.getByText("Last Saved by: Fixture Saver", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Submit", exact: true }).click();
        await expect.poll(() => stored.submitted).toBe(true);
        await expect(page.getByTestId("button-preview-comment-point")).toHaveCount(0);
        await expect(page.getByText("Last Saved by: Fixture Saver", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
        expect(stored.comment).toBe("New submitted observation");
        expect(stored.value).toBe("yes");
        const count = writes.length;
        await page.reload();
        await expect(comment).toHaveText("New submitted observation");
        expect(writes).toHaveLength(count);
        expect(errors).toEqual([]);
        console.log(`PASS ${family} ${matrix ? "matrix" : "list"} ${viewport.width}px: saved text, readonly, submit, refresh`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
