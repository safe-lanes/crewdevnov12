import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";

// Same actual popup JSX/handler fixture as the React tests, bundled with the
// production date input. All persistence responses are in memory.
const source=readFileSync("tests/crew-profile-validation/recruitment-popup.test.tsx","utf8");
const preamble=source.slice(source.indexOf("const source="),source.indexOf("const Dialog="));
const fixture=new Function("readFileSync","ts",
  ts.transpileModule(preamble,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+"\nreturn js;")(readFileSync,ts);
const shell=source.slice(source.indexOf("const Dialog="),source.indexOf("const Fixture="));
const entry=`
import React from "react";
import {createRoot} from "react-dom/client";
import {FormattedDateInput} from "./client/src/components/ui/formatted-date-input";
import {validateRecruitmentDate,validateCrewProfile} from "./shared/v2/crew-pool/profileValidation";
import {validateMobileNumber} from "./client/src/modules/recruitment/countryDialingCodes";
${shell}
const Fixture=new Function("React","FormattedDateInput","validateRecruitmentDate","validateCrewProfile","validateMobileNumber","Dialog","DialogContent","DialogHeader","DialogTitle","DialogFooter","Button",${JSON.stringify(fixture)})
 (React,FormattedDateInput,validateRecruitmentDate,validateCrewProfile,validateMobileNumber,Dialog,Wrap,Wrap,Wrap,Wrap,Button);
window.controls={toasts:[]};window.writes=[];window.fail=false;
const api={
 patch:async data=>{window.writes.push(data);if(window.fail)throw new Error("offline");return {ok:true};},
 refresh:async()=>{},ensure:async()=>{throw new Error("Unexpected creation");}
};
const root=createRoot(document.getElementById("root"));
root.render(<Fixture api={api} controls={window.controls}/>);
window.newCrew=()=>{
 window.writes=[];window.controls.toasts=[];
 root.render(<Fixture key="new-crew" api={api} controls={window.controls} member={null} initial={{firstName:"",recruitmentDate:""}}/>);
};
`;
const bundle=await build({stdin:{contents:entry,loader:"tsx",resolveDir:process.cwd()},
  bundle:true,write:false,jsx:"automatic",format:"iife",
  alias:{"@":path.resolve("client/src"),"@shared":path.resolve("shared")}});
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
try{
  const page=await browser.newPage({timezoneId:"Asia/Kolkata"});
  await page.clock.install({time:new Date("2026-11-17T06:30:00Z")});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const input=page.getByTestId("input-recruitment-date-manual");
  const save=page.getByRole("button",{name:"Save",exact:true});
  await input.fill("01-Dec-2026");await input.blur();
  assert.equal(await save.isDisabled(),true);
  assert.equal(await input.inputValue(),"01-Dec-2026");
  assert.match(await page.getByRole("alert").innerText(),/cannot be a future date/);
  assert.deepEqual(await page.evaluate(()=>window.writes),[]);
  console.log("PASS: future manual date remains visible and blocks Save without writes");
  assert.equal(await page.getByTestId("input-recruitment-date").getAttribute("max"),"2026-11-17");
  await input.fill("17-Nov-2026");await save.click();
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
  assert.equal(await page.getByTestId("header-date").innerText(),"2026-11-17");
  assert.deepEqual(await page.evaluate(()=>window.writes),[{recruitmentDate:"2026-11-17"}]);
  console.log("PASS: correcting to today saves once, updates the header and closes the popup");
  await page.getByRole("button",{name:"Open date"}).click();
  await page.evaluate(()=>{window.fail=true;});
  await input.fill("15-Nov-2026");await save.click();
  await page.waitForFunction(()=>window.controls.toasts.some(t=>t.title==="Error"));
  assert.equal(await input.inputValue(),"15-Nov-2026");
  assert.equal(await page.getByTestId("header-date").innerText(),"2026-11-17");
  assert.equal(await page.getByRole("dialog").isVisible(),true);
  assert.equal(await page.getByTestId("notes").innerText(),"Unsaved text");
  console.log("PASS: failed save preserves the draft, previous accepted date and unrelated edits");
  await page.getByRole("button",{name:"Cancel"}).click();
  await page.getByRole("button",{name:"Open date"}).click();
  assert.equal(await input.inputValue(),"17-Nov-2026");
  console.log("PASS: cancel/reopen restores the accepted date instead of a rejected draft");
  await page.evaluate(()=>window.newCrew());
  await page.waitForFunction(()=>window.controls.current.formData.firstName==="");
  await input.fill("01-Nov-2026");await save.click();
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
  assert.equal(await page.getByTestId("header-date").innerText(),"2026-11-01");
  assert.deepEqual(await page.evaluate(()=>window.writes),[]);
  assert.deepEqual(await page.evaluate(()=>window.controls.toasts),[]);
  console.log("PASS: empty-name new crew accepts a valid date locally and closes without persistence or success toast");
  await page.getByRole("button",{name:"Open date"}).click();
  assert.equal(await input.inputValue(),"01-Nov-2026");
  await input.fill("01-Dec-2026");await input.blur();
  assert.equal(await save.isDisabled(),true);
  await page.getByRole("button",{name:"Cancel"}).click();
  assert.equal(await page.getByTestId("header-date").innerText(),"2026-11-01");
  assert.deepEqual(await page.evaluate(()=>window.writes),[]);
  console.log("PASS: new-crew staged date survives reopen/cancel and future dates remain blocked");
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
