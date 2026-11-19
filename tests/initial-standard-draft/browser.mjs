import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

// Complete production editor in Chromium; only HTTP, permissions and toast
// boundaries are in memory. No application database or authentication changes.
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {GenericFormEditor} from "./client/src/components/GenericFormEditor";
const root=createRoot(document.getElementById("root"));
let key=0;
window.start=(category,preview=false,fail=false)=>{
 window.calls=[];window.versions=[];window.structure={sections:[],option_sets:[]};
 window.fail=fail;window.toasts=[];window.saved=0;
 const response=data=>({ok:true,json:async()=>structuredClone(data)});
 window.transport=async(method,url,data)=>{
  window.calls.push({method,url,data});
  if(method==="GET"&&url.includes("/rank-groups/form/"))return response([{id:7,formId:99,name:"Deck"}]);
  if(method==="GET"&&url.includes("/forms/99/versions"))return response(window.versions);
  if(method==="POST"&&url.endsWith("/initial-draft")){
   if(window.fail)throw new Error('500: {"error":"private-uuid"}');
   if(!window.versions.length)window.versions.push({id:42,fvUuid:"draft-42",formId:99,rankGroupId:7,versionNo:"01",versionDate:"17-Nov-2026",status:"draft"});
   return response(window.versions[0]);
  }
  if(method==="GET"&&url.includes("/parts?"))return response([{formPartUuid:"part-42",formVersionUuid:"draft-42",partCode:"MAIN",partTitle:"Configuration",partType:"configurable",sortOrder:0}]);
  if(method==="GET"&&url.endsWith("/structure"))return response(window.structure);
  if(method==="PUT"&&url.endsWith("/structures")){
   window.structure=structuredClone(data.parts[0].structure);
   return response({form_version_uuid:"draft-42",parts:[{form_part_uuid:"part-42",...window.structure}]});
  }
  if(method==="POST"&&url.endsWith("/release")){
   window.versions[0].status="released";return response(window.versions[0]);
  }
  return response([]);
 };
 window.fetch=async url=>window.transport("GET",url);
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 root.render(<QueryClientProvider key={++key} client={client}><GenericFormEditor
  form={{id:99,name:"Fixture",category}} formName="Fixture" rankGroupId={7}
  rankGroupName="Deck" initialPreview={preview} onClose={()=>{}} onSave={()=>window.saved++}
 /></QueryClientProvider>);
};
window.start("briefing");
`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "isolated-editor-boundaries",
    setup(build) {
      build.onResolve({ filter: /(?:lib\/queryClient|hooks\/use-toast|contexts\/PermissionsContext|lib\/crewUser)(?:\.tsx?)?$/ },
        args => ({ path: args.path, namespace: "test-boundary" }));
      build.onLoad({ filter: /.*/, namespace: "test-boundary" }, args => ({
        contents: args.path.includes("queryClient")
          ? "export const apiRequest=(...args)=>window.transport(...args);export const queryClient={invalidateQueries:async()=>{}};"
          : args.path.includes("PermissionsContext")
          ? "export const usePermissions=()=>({permissions:[],isLoading:false});"
          : args.path.includes("crewUser")
          ? "export const getCrewUserId=()=>undefined;"
          : "export const useToast=()=>({toast:value=>window.toasts.push(value)});",
        loader: "js",
      }));
    },
  }],
});
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") { res.setHeader("content-type", "application/javascript"); res.end(bundle.outputFiles[0].text); }
  else { res.setHeader("content-type", "text/html"); res.end('<div id="root"></div><script src="/bundle.js"></script>'); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => typeof window.start === "function");
  for (const category of ["briefing", "debriefing", "interview"]) {
    await page.evaluate(category => window.start(category), category);
    await page.getByTestId("button-add-first-section").waitFor();
    assert.equal(await page.evaluate(() => window.calls.filter(c => c.method === "POST" && c.url.endsWith("/initial-draft")).length), 1);
    await page.getByTestId("button-add-first-section").click();
    await page.getByTestId("input-section-title-1").fill(category + " section");
    await page.getByTestId("button-add-point-1").click();
    await page.getByTestId("textarea-point-text-1-1").fill(category + " point");
    await page.getByTestId("button-save-form-structure").click();
    await page.waitForFunction(() => window.saved === 1);
    assert.equal(await page.evaluate(() => window.structure.sections[0].questions[0].question_text), category + " point");
    console.log("PASS: " + category + " initializes once and persists a configured section and point");
    await page.getByTestId("button-release-version").click();
    await page.getByTestId("button-confirm-release").click();
    await page.getByTestId("button-edit-as-new-draft").waitFor();
    assert.equal(await page.evaluate(() => window.versions[0].status), "released");
    console.log("PASS: " + category + " releases the saved version and returns to read-only");
  }
  await page.evaluate(() => window.start("interview", false, true));
  await page.getByTestId("retry-initial-standard-draft").waitFor();
  assert.equal((await page.locator("body").innerText()).includes("private-uuid"), false);
  await page.evaluate(() => { window.fail = false; });
  await page.getByTestId("retry-initial-standard-draft").click();
  await page.getByTestId("button-add-first-section").waitFor();
  assert.equal(await page.evaluate(() => window.versions.length), 1);
  console.log("PASS: failed initialization stays safe, hides internals, and recovers through reconciliation");
  await page.evaluate(() => window.start("briefing", true));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.calls.filter(c => c.method !== "GET").length), 0);
  console.log("PASS: preview of an unversioned form creates no draft");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
