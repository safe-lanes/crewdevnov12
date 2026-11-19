import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

// Actual C2 field, mapper, save helper and shared popup. No app API or data writes.
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {VisaCountryField} from "./client/src/modules/crew-pool/components/VisaCountryField";
import {VisaSelectionDialog} from "./client/src/modules/crew-pool/VisaSelectionDialog";
import {mapV2VisaToLegacy,mapLegacyVisaToV2} from "./client/src/modules/crew-pool/mappers/v2ToLegacyMapper";
import {visaCountryForSave} from "./shared/v2/crew-pool/visaCountry";
const names=["China","INDIA","AUSTRALIA","UNITED STATES","UNITED KINGDOM"];
const rows=names.map((countryName,i)=>mapV2VisaToLegacy({visaUuid:"visa-"+i,
 countryUuid:(i+1)+"1111111-1111-4111-8111-111111111111",
 country:(i+1)+"1111111-1111-4111-8111-111111111111",countryName,visaType:"work"}));
const missing=mapV2VisaToLegacy({countryUuid:"99999999-9999-4999-8999-999999999999",
 country:"99999999-9999-4999-8999-999999999999"});
window.visaBrowser={};
function Harness(){
 const [open,setOpen]=React.useState(false);
 const [manual,setManual]=React.useState(mapV2VisaToLegacy({country:"Custom country"}));
 return <><section data-testid="country-fields">{rows.map(row=><div key={row.visaUuid}>
 <VisaCountryField value={row.issuingCountry} countryId={row.countryId} onChange={()=>{}} onBlur={()=>{}}/></div>)}
 <VisaCountryField value={missing.issuingCountry} countryId={missing.countryId}
 unavailable={missing.countryUnavailable} onChange={()=>{}} onBlur={()=>{}}/></section>
 <section data-testid="manual"><VisaCountryField value={manual.issuingCountry}
 onChange={value=>setManual({...manual,issuingCountry:value,country:value,countryUnavailable:false})} onBlur={()=>{}}/></section>
 <button onClick={()=>{window.visaBrowser.payload=mapLegacyVisaToV2({...manual,country:visaCountryForSave(manual)})}}>Save manual</button>
 <button onClick={()=>setOpen(true)}>Open countries</button>
 <VisaSelectionDialog open={open} onClose={()=>setOpen(false)} existingCountryIds={rows.flatMap(r=>[r.countryId,r.issuingCountry])}
 onConfirm={selected=>{window.visaBrowser.selected=selected;}}/></>;
}
createRoot(document.getElementById("root")).render(<Harness/>);
`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{ name: "isolated-query", setup(build) {
    build.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: "query", namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: "export const useQuery=()=>({data:[],isLoading:false});", loader: "js",
    }));
  } }],
});
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", error => { throw error; });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByTestId("country-fields").waitFor();
  for (const name of ["China", "INDIA", "AUSTRALIA", "UNITED STATES", "UNITED KINGDOM"]) {
    assert.equal(await page.getByTestId("country-fields").getByText(name, { exact: true }).count(), 1);
  }
  assert.doesNotMatch(await page.getByTestId("country-fields").innerText(), /[0-9a-f]{8}-[0-9a-f]{4}-/i);
  console.log("PASS: all five country names render with no visible UUIDs");
  assert.equal(await page.getByText("Country unavailable", { exact: true }).count(), 1);
  assert.equal(await page.getByTestId("country-fields").getByRole("textbox").count(), 0);
  console.log("PASS: missing masters show Country unavailable and reference-backed fields stay read-only");
  await page.getByTestId("manual").getByRole("textbox").fill("Schengen");
  await page.getByRole("button", { name: "Save manual", exact: true }).click();
  assert.equal(await page.evaluate(() => window.visaBrowser.payload.country), "Schengen");
  console.log("PASS: manual countries remain editable and save the entered text");
  await page.getByRole("button", { name: "Open countries", exact: true }).click();
  for (const name of ["China", "India", "Australia", "United States", "United Kingdom"]) {
    const row = page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
    assert.equal(await row.getByText("Added", { exact: true }).count(), 1);
    assert.equal(await row.getByRole("checkbox").isDisabled(), true);
  }
  console.log("PASS: popup recognizes all five transferred countries as Added");
  await page.getByTestId("button-select-priority-visa").click();
  await page.getByTestId("button-confirm-visa-selection").click();
  assert.deepEqual(await page.evaluate(() => window.visaBrowser.selected.map(c => c.name)), ["Schengen"]);
  console.log("PASS: Select Priority excludes all already-transferred countries");
} finally {
  await browser.close();
}
