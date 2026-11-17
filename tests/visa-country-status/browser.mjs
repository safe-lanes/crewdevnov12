import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

// Actual popup and Recruitment resolver, isolated from all app APIs and data.
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { VisaSelectionDialog } from "./client/src/modules/crew-pool/VisaSelectionDialog";
import { recruitmentVisaCountryKeys } from "./client/src/modules/recruitment/visaCountryMatching";
const india = "11111111-1111-4111-8111-111111111111";
const australia = "22222222-2222-4222-8222-222222222222";
const catalog = [{id:india,label:"INDIA"},{id:australia,label:"AUSTRALIA"}];
const saved = [{countryId:"CHN",issuingCountry:"China"},{countryId:india,issuingCountry:india},{countryId:australia,issuingCountry:australia}];
window.visaTest = { selected: null };
function Harness() {
  const [mode,setMode] = React.useState("saved");
  window.visaTest.mode = setMode;
  const visas = mode === "deleted" ? saved.filter(v => v.countryId !== india) : saved;
  const keys = mode === "crewpool" ? ["CHN","China","IND","INDIA","AUS","AUSTRALIA"] :
    recruitmentVisaCountryKeys(visas, mode === "loading" ? [] : catalog);
  return <VisaSelectionDialog open={mode !== "closed"} onClose={()=>setMode("closed")}
    onConfirm={selected=>{window.visaTest.selected=selected;}} existingCountryIds={keys}/>;
}
createRoot(document.getElementById("root")).render(<Harness/>);
`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", jsx: "automatic",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "isolated-country-query",
    setup(build) {
      build.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: "query", namespace: "test" }));
      build.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        contents: "export const useQuery = () => ({data: [], isLoading: false});", loader: "js",
      }));
    },
  }],
});
const browser = await chromium.launch({
  headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole("dialog").waitFor();
  const row = name => page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
  const added = async name => {
    assert.equal(await row(name).getByRole("checkbox").isDisabled(), true, `${name} must be disabled`);
    assert.equal(await row(name).getByText("Added", { exact: true }).count(), 1, `${name} must show Added`);
  };
  for (const name of ["China", "India", "Australia"]) await added(name);
  console.log("PASS: saved Recruitment UUIDs show all three Added statuses");
  await page.getByTestId("button-select-priority-visa").click();
  await page.getByTestId("button-confirm-visa-selection").click();
  assert.deepEqual(await page.evaluate(() => window.visaTest.selected.map(c => c.name)),
    ["United States", "Schengen", "United Kingdom"]);
  console.log("PASS: priority selection cannot re-add existing countries");
  await page.evaluate(() => window.visaTest.mode("closed"));
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => window.visaTest.mode("saved"));
  await page.getByRole("dialog").waitFor();
  for (const name of ["China", "India", "Australia"]) await added(name);
  console.log("PASS: closing and reopening preserves Added statuses");
  await page.evaluate(() => window.visaTest.mode("loading"));
  await page.waitForFunction(() => !document.querySelector('[data-testid="checkbox-visa-country-IND"]').disabled);
  await page.evaluate(() => window.visaTest.mode("saved"));
  await page.waitForFunction(() => document.querySelector('[data-testid="checkbox-visa-country-IND"]').disabled);
  await added("India");
  console.log("PASS: late country catalog updates Added without reopening");
  await page.evaluate(() => window.visaTest.mode("deleted"));
  await page.waitForFunction(() => !document.querySelector('[data-testid="checkbox-visa-country-IND"]').disabled);
  assert.equal(await row("India").getByText("Added", { exact: true }).count(), 0);
  await added("Australia");
  console.log("PASS: removing a visa makes only its country selectable");
  await page.evaluate(() => window.visaTest.mode("crewpool"));
  await page.waitForFunction(() => document.querySelector('[data-testid="checkbox-visa-country-IND"]').disabled);
  for (const name of ["China", "India", "Australia"]) await added(name);
  console.log("PASS: Crew Pool C2 ID/name inputs still work");
} finally {
  await browser.close();
}
