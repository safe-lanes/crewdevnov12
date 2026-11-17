import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "playwright";
import assert from "node:assert/strict";

// Use the exact production-handler React fixture from the interaction suite.
// Chromium runs locally with in-memory responses, not real crew APIs.
const source = readFileSync("tests/crew-profile-validation/interaction.test.tsx", "utf8");
const preamble = source.slice(source.indexOf("const source ="), source.indexOf("const Harness ="));
const fixture = new Function("readFileSync", "ts",
  ts.transpileModule(preamble, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn transpiled;")(readFileSync, ts);
const empty = source.slice(source.indexOf("const empty ="), source.indexOf("function setup("));
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import * as rules from "./shared/v2/crew-pool/profileValidation";
import * as mappers from "./client/src/modules/crew-pool/mappers/v2ToLegacyMapper";
import {validateMobileNumber} from "./client/src/modules/recruitment/countryDialingCodes";
import {saveProfileDependents,confirmedProfileRejection} from "./client/src/modules/crew-pool/saveProfileDependents";
const Harness=new Function("React","rules","mappers","validateMobileNumber","saveProfileDependents","confirmedProfileRejection",${JSON.stringify(fixture)})
 (React,rules,mappers,validateMobileNumber,saveProfileDependents,confirmedProfileRejection);
${empty}
window.controls={toasts:[]};window.writes=[];window.stored={dob:"1990-01-01"};
const api={};
for(const method of ["updateCrew","createCrew","savePersonalDetails","saveAddress","saveFamilyInfo","saveNextOfKin","saveVesselTypesApplied","deleteChild","createChild","updateChild"]){
 api[method]=async(...args)=>{window.writes.push(method);if(method==="updateCrew")Object.assign(window.stored,args[1]);if(method==="createCrew")Object.assign(window.stored,args[0]);return {crewUuid:"created",childUuid:"child-created"};};
}
const root=createRoot(document.getElementById("root"));
root.render(<Harness initial={empty()} api={api} controls={window.controls}/>);
window.newCrew=()=>{
 window.writes=[];window.controls.toasts=[];
 root.render(<Harness key="new-crew" initial={{...empty(),firstName:"",recruitmentDate:""}} member={null} api={api} controls={window.controls}/>);
};
`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
});
const browser = await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
try {
  const page=await browser.newPage();
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByLabel("DOB",{exact:true}).fill("2020-01-01");
  await page.getByText("Outside",{exact:true}).click();
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await page.getByRole("button",{name:"Mobile Save",exact:true}).click();
  assert.match(await page.getByRole("alert").innerText(),/at least 18/);
  assert.deepEqual(await page.evaluate(()=>window.writes),[]);
  console.log("PASS: outside, desktop Save and mobile Save reject underage DOB without writes");
  await page.getByLabel("DOB",{exact:true}).fill("1991-01-01");
  await page.getByText("Outside",{exact:true}).click();
  await page.waitForFunction(()=>window.controls.toasts.some(t=>t.title==="Auto-saved"));
  assert.equal(await page.evaluate(()=>window.stored.dob),"1991-01-01");
  console.log("PASS: corrected DOB saves and retains the corrected persisted value");
  const writes=await page.evaluate(()=>window.writes.length);
  await page.evaluate(()=>{window.controls.current.change({email:"invalid"});window.controls.current.section("B2");});
  await page.getByText("Outside",{exact:true}).click();
  assert.match(await page.getByRole("alert").innerText(),/valid email/);
  assert.equal(await page.evaluate(()=>window.writes.length),writes);
  console.log("PASS: invalid B2 email blocks auto-save in Chromium");
  await page.evaluate(()=>{window.controls.current.change({email:"",maritalStatus:"Married",spouseFirstName:"",spouseFamilyName:"",nokEmail:"invalid"});window.controls.current.section("B3");});
  await page.getByText("Outside",{exact:true}).click();
  assert.match(await page.getByRole("alert").innerText(),/Spouse first name/);
  assert.equal(await page.evaluate(()=>window.writes.length),writes);
  console.log("PASS: invalid B3 spouse/NOK values block all section writes");
  await page.evaluate(()=>window.newCrew());
  await page.waitForFunction(()=>window.controls.current.formData.firstName==="");
  await page.evaluate(()=>window.controls.current.selectDate("2026-11-01"));
  await page.waitForFunction(()=>window.controls.current.isRecruitmentDateEditOpen);
  await page.evaluate(()=>window.controls.current.dateSave());
  await page.waitForFunction(()=>!window.controls.current.isRecruitmentDateEditOpen);
  assert.equal(await page.evaluate(()=>window.controls.current.formData.recruitmentDate),"2026-11-01");
  assert.deepEqual(await page.evaluate(()=>window.writes),[]);
  assert.deepEqual(await page.evaluate(()=>window.controls.toasts),[]);
  console.log("PASS: actual handler stages a recruitment date on an empty new form without creating a crew");
  await page.evaluate(()=>window.controls.current.change({firstName:"Fixture"}));
  await page.waitForFunction(()=>window.controls.current.formData.firstName==="Fixture");
  await page.getByText("Outside",{exact:true}).click();
  await page.waitForFunction(()=>window.controls.current.createdCrewId==="created"&&!window.controls.current.isBatchSaving);
  assert.equal(await page.evaluate(()=>window.stored.recruitmentDate),"2026-11-01");
  assert.equal(await page.evaluate(()=>window.writes.filter(m=>m==="createCrew").length),1);
  await page.getByText("Outside",{exact:true}).click();
  assert.equal(await page.evaluate(()=>window.writes.filter(m=>m==="createCrew").length),1);
  console.log("PASS: entering First Name later creates the crew once using the staged date");
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
