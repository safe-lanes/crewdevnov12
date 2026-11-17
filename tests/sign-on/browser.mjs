import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";

// Bundle the actual dialog and date widgets with synthetic network boundaries.
// No app authentication, development records, or real sign-on API is touched.
const entry = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ReliefStatusEditDialog_v2 } from "./client/src/modules/vessel/components/ReliefStatusEditDialog_v2";
import { TooltipProvider } from "./client/src/components/ui/tooltip";
window.signOnTest = { writes: [], toasts: [], refreshFails: false, mode: "success", release: null };
window.fetch = async () => ({ ok: true, json: async () => ({ hasConflict: false }) });
function Harness() {
  const [open, setOpen] = useState(true);
  return <TooltipProvider><ReliefStatusEditDialog_v2 open={open} onOpenChange={setOpen}
    rank="Master" rankId="rank-test" vesselUuid="vessel-test"
    planningData={{ planUuid: "plan-test", relieverCrewUuid: "crew-test",
      relieverAssignUuid: "assign-test", relieverCrewName: "Browser Test Crew",
      joiningStatus: "Signed On", relieverSignOnDate: window.initialSignOnDate }} /></TooltipProvider>;
}
createRoot(document.getElementById("root")).render(<Harness />);
`;
const shims = {
  "@tanstack/react-query": `
    export const useQuery = () => ({ data: { allowed: false }, isLoading: false });
    const client = { invalidateQueries: async () => {
      if (window.signOnTest.refreshFails) throw new Error("refresh unavailable");
    }};
    export const useQueryClient = () => client;`,
  "@/hooks/use-app-dialog": `export const useAppDialog = () => ({ ask: async () => true, dialog: null });`,
  "@/hooks/use-toast": `export const useToast = () => ({ toast: data => window.signOnTest.toasts.push(data) });`,
  "@/contexts/PermissionsContext": `export const usePermissions = () => ({
    permissions: [], roleName: "Admin", userType: "Office", canCompanyFormAction: () => false
  });`,
  "../hooks/useVesselV2": `
    const mutation = { isPending: false, mutateAsync: async () => ({}) };
    export const useUpdatePlanningV2 = () => mutation;
    export const useCreatePlanningV2 = () => mutation;`,
  "../api/vesselApiV2": `
    export const vesselApiV2 = { signOnReliever: async (plan, data) => {
      const state = window.signOnTest;
      state.writes.push({ plan, data });
      if (state.mode === "hold") await new Promise(resolve => { state.release = resolve; });
      if (state.mode === "reject") throw new Error('400: {"error":"Rejected sign-on"}');
      return { planUuid: plan, relieverCrewUuid: null, joiningStatus: null, relieverSignOnDate: null };
    }};`,
  "@/lib/queryClient": `export const apiRequest = async () => ({ json: async () => ({}) });`,
  "@/components/ui/SearchablePortCombobox": `export const SearchablePortCombobox = () => null;`,
  "@/components/configured-form/RequiredFormDetails": `export const RequiredFormDetails = () => null;`,
  "./JoiningCompanyForms": `export const JoiningCompanyForms = () => null;`,
  "./AcceptedChecklistHistory": `export const AcceptedChecklistHistory = () => null;`,
  "./TrainingMatrixCompliance": `
    import React from "react";
    export const TrainingMatrixCompliance = () => React.createElement("span", null, "Training compliance could not be loaded.");`,
};
const compiled = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "iife",
  define: { "process.env.NODE_ENV": '"test"' },
  alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` },
  plugins: [{
    name: "synthetic-sign-on-boundaries",
    setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, args =>
        Object.hasOwn(shims, args.path) ? { path: args.path, namespace: "sign-on-shim" } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: "sign-on-shim" }, args =>
        ({ contents: shims[args.path], loader: "js", resolveDir: process.cwd() }));
    },
  }],
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
let passed = 0;
async function fixture(mode = "success", date = "2025-01-10") {
  const page = await browser.newPage();
  page.on("pageerror", error => console.error("Browser error:", error.message));
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.evaluate(date => { window.initialSignOnDate = date; }, date);
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await page.getByTestId("button-submit-relief").waitFor();
  await page.evaluate(mode => { window.signOnTest.mode = mode; }, mode);
  return page;
}
async function waitForToast(page, title) {
  try {
    await page.waitForFunction(title => window.signOnTest.toasts.some(t => t.title === title), title, { timeout: 5000 });
  } catch (error) {
    console.error(await page.evaluate(() => ({
      state: window.signOnTest,
      invalid: [...document.querySelectorAll("input:invalid")].map(input => ({
        testId: input.dataset.testid, value: input.value, message: input.validationMessage,
      })),
      date: document.querySelector('[data-testid="input-relieverSignOnDate-manual"]')?.value,
      errors: [...document.querySelectorAll('[id$="-form-item-message"]')].map(node => node.textContent),
    })));
    throw error;
  }
}
try {
  let page = await fixture("success", "");
  await page.getByTestId("button-submit-relief").click();
  await waitForToast(page, "Validation Error");
  assert.equal(await page.evaluate(() => window.signOnTest.writes.length), 0);
  assert.equal(await page.getByRole("dialog").count(), 1);
  console.log(`PASS ${++passed}: missing date keeps form open and sends no sign-on`);
  await page.close();

  page = await fixture();
  await page.getByTestId("input-relieverSignOnDate-manual").fill("bad");
  assert.equal(await page.getByTestId("button-submit-relief").isDisabled(), true);
  await page.getByTestId("input-relieverSignOnDate-manual").press("Enter");
  assert.equal(await page.evaluate(() => window.signOnTest.writes.length), 0);
  console.log(`PASS ${++passed}: invalid visible draft cannot submit stale accepted date`);
  await page.close();

  page = await fixture("hold");
  await page.getByTestId("button-submit-relief").click();
  await page.waitForFunction(() => window.signOnTest.writes.length === 1);
  assert.equal(await page.getByTestId("button-submit-relief").isDisabled(), true);
  await page.getByTestId("button-submit-relief").evaluate(button => {
    button.form.requestSubmit();
    button.form.requestSubmit();
  });
  assert.equal(await page.evaluate(() => window.signOnTest.writes.length), 1);
  await page.evaluate(() => window.signOnTest.release());
  await waitForToast(page, "Success");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.signOnTest.writes[0].data.signOnDate), "2025-01-10");
  console.log(`PASS ${++passed}: success closes actual dialog; repeated submits produce one write`);
  await page.close();

  page = await fixture("reject");
  await page.getByTestId("button-submit-relief").click();
  await waitForToast(page, "Error");
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(await page.getByTestId("input-relieverSignOnDate-manual").inputValue(), "10-Jan-2025");
  console.log(`PASS ${++passed}: server rejection preserves entered date and open form`);
  await page.close();

  page = await fixture();
  await page.evaluate(() => { window.signOnTest.refreshFails = true; });
  await page.getByTestId("button-submit-relief").click();
  await waitForToast(page, "Signed on — refresh needed");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.signOnTest.writes.length), 1);
  console.log(`PASS ${++passed}: refresh failure after success never invites another sign-on`);
  await page.close();
} finally {
  await browser.close();
}
console.log(`${passed} isolated Chromium sign-on checks passed; no real API writes.`);
