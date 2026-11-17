import React from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as rules from "../../shared/v2/crew-pool/profileValidation";
import * as mappers from "../../client/src/modules/crew-pool/mappers/v2ToLegacyMapper";
import { validateMobileNumber } from "../../client/src/modules/recruitment/countryDialingCodes";
import { confirmedProfileRejection, saveProfileDependents } from "../../client/src/modules/crew-pool/saveProfileDependents";

// Execute the production form's actual handlers and click-outside effect in React.
// Only presentation and unrelated C–G dependencies are stubbed; no copies of save logic.
const source = readFileSync("client/src/modules/crew-pool/CrewInfoForm_v2.tsx", "utf8");
const ast = ts.createSourceFile("form.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string) {
  let result = "";
  const visit = (node: ts.Node) => {
    if (!result && ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
      result = `const ${node.getText(ast)};`;
    if (!result) ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!result) throw new Error(`Missing actual form handler ${name}`);
  return result;
}
const production = [
  "profileEditKey", "persistProfileDependents", "validateProfileBeforeSave", "getEffectiveCrewUuid",
  "ensureCrewExists", "handleSectionAutoSave", "toggleEditSection", "handleSaveDraft", "createCrewMutation", "handleUpdateRecruitmentDate",
].map(declaration).join("\n");
const effect = source.slice(source.indexOf("  // Click-outside detection for B1/B2/B3"),
  source.indexOf("  // Helper function to calculate age from date of birth"));
const setters = [...new Set((production.match(/\bset[A-Z]\w+/g) || []))]
  .filter(name => !["setFormData","setEditingSections","setCreatedCrewId","setIsBatchSaving","setIsCreatingCrew","setTimeout",
    "setIsRecruitmentDateEditOpen","setTempRecruitmentDate","setIsSavingRecruitmentDate"].includes(name));
const errorFields: Record<string,string> = {
  setFirstNameError:"firstName",setRecruitmentDateError:"recruitmentDate",setDobError:"dateOfBirth",
  setMobileError:"mobile",setEmailError:"email",setNokEmailError:"nokEmail",
  setSpouseFirstNameError:"spouseFirstName",setSpouseFamilyNameError:"spouseFamilyName",setSpouseDobError:"spouseDateOfBirth",
};
const code = `
const {useState,useRef,useEffect}=React;
const {validateCrewProfile,validateRecruitmentDate,validateCrewDob:validateDob,validateProfileEmail:validateEmail}=rules;
const {mapLegacyCrewToV2,mapLegacyPersonalDetailsToV2,mapLegacyAddressToV2,mapLegacyFamilyInfoToV2}=mappers;
return function Harness({initial,api,controls,member="crew"}){
 const [formData,setFormData]=useState(initial);
 const [errors,setErrors]=useState({});
 const [editingSections,setEditingSections]=useState({B1:true,B2:false,B3:false});
 const [createdCrewId,setCreatedCrewId]=useState(null);
 const [isBatchSaving,setIsBatchSaving]=useState(false);
 const [isCreatingCrew,setIsCreatingCrew]=useState(false);
 const [isRecruitmentDateEditOpen,setIsRecruitmentDateEditOpen]=useState(false);
 const [tempRecruitmentDate,setTempRecruitmentDate]=useState("");
 const [isSavingRecruitmentDate,setIsSavingRecruitmentDate]=useState(false);
 const recruitmentDateSavingRef=useRef(false);
 const isRecruitmentDateDraftValid=true;
 const profileSaveRef=useRef(false), isBatchSavingRef=useRef(false),isCreatingCrewRef=useRef(false);
 const profileLatestRef=useRef(formData);profileLatestRef.current=formData;
 const profileCreateUncertainRef=useRef(null);
 const profileDependentsRef=useRef({session:null,uncertain:new Set()});
 const d3SessionRef=useRef({open:true,crewKey:member,pendingDeletes:new Set()});
 const firstCreateOwnerRef=useRef(null),createdCrewIdOwnerRef=useRef(null),createdCrewIdRef=useRef(null);
 const d3FirstCreates={begin:()=>({finish:()=>{}})};
 const crewMember=member?{crewUuid:member}:null;
 const isD3Blocked=()=>false,isCrewTerminated=false;
 const canEditSection=()=>true;
 const canSaveD3Defaults=false,d3DataReady=true;
 const d3RowsForSave=rows=>rows;
 const runSeaServiceOverlapCheck=()=>({});
 const getVesselTypeRequiredMessage=()=>"Vessel type is required.";
 const todayStr=rules.calendarToday();
 const validateIssuedDate=()=>"", validateExpiryDate=()=>"";
 const toast=message=>{controls.toasts.push(message);};
 const [deletedChildUuids,setDeletedChildUuids]=useState(initial.deleted || []);
 const uploadedPhoto=null;
 const withAuditUser=data=>data;
 const V2_QUERY_KEY="/api/v2/crew-pool";
 const invalidateCrewData=()=>{};
 const queryClient={invalidateQueries:async()=>{},refetchQueries:async()=>{},cancelQueries:async()=>{}};
 const crewPoolApiV2=api;
 const updateFormData=(key,value)=>setFormData(prev=>({...prev,[key]:value}));
 const apiRequest=async(method,url,data)=>{await api.updateCrew(member,data);return {ok:true};};
 const updateCrewMutationV2={mutateAsync:({crewUuid,data})=>api.updateCrew(crewUuid,mapLegacyCrewToV2(data))};
 const createCrewMutationV2={mutateAsync:data=>api.createCrew(mapLegacyCrewToV2(data))};
 const savePersonalDetailsMutationV2={mutateAsync:({crewUuid,data})=>api.savePersonalDetails(crewUuid,mapLegacyPersonalDetailsToV2(data))};
 const saveAddressMutationV2={mutateAsync:({crewUuid,data})=>api.saveAddress(crewUuid,mapLegacyAddressToV2(data))};
 const saveFamilyInfoMutationV2={mutateAsync:({crewUuid,data})=>api.saveFamilyInfo(crewUuid,mapLegacyFamilyInfoToV2(data))};
 const saveVesselTypesMutationV2={mutateAsync:({crewUuid,vesselTypeUuids})=>api.saveVesselTypesApplied(crewUuid,vesselTypeUuids)};
 ${setters.filter(n=>n!=="setDeletedChildUuids").map(n=>`const ${n}=value=>setErrors(prev=>({...prev,${JSON.stringify(errorFields[n] || n)}:value}));`).join("\n")}
 ${production}
 ${effect}
 controls.current={formData,errors,editingSections,createdCrewId,deletedChildUuids,isBatchSaving,isRecruitmentDateEditOpen,isSavingRecruitmentDate,
   change:(data)=>setFormData(prev=>({...prev,...data})),
   section:(s)=>setEditingSections({B1:false,B2:false,B3:false,[s]:true}),
   switchSession:()=>{d3SessionRef.current={open:true,crewKey:"other"};},
   generalSave:handleSaveDraft,dateSave:handleUpdateRecruitmentDate,
   selectDate:date=>{setTempRecruitmentDate(date);setIsRecruitmentDateEditOpen(true);}};
 return <><div ref={sectionB1Ref}>
 <input aria-label="DOB" value={formData.dateOfBirth||""} onChange={e=>setFormData({...formData,dateOfBirth:e.target.value})}
 onBlur={()=>setDobError(validateDob(formData.dateOfBirth))}/>
 </div><div ref={sectionB2Ref}/><div ref={sectionB3Ref}/>
 <div role="alert">{Object.values(errors).filter(v=>typeof v==="string").join(" ")}</div>
 {["B1","B2","B3"].map(s=><button key={s} onMouseDown={e=>e.stopPropagation()} onClick={()=>toggleEditSection(s)}>Edit {s}</button>)}
 <button onMouseDown={e=>e.stopPropagation()} onClick={handleSaveDraft}>Save</button>
 <button onMouseDown={e=>e.stopPropagation()} onClick={handleSaveDraft}>Mobile Save</button>
 <button>Outside</button></>;
};
`;
const harnessCode = code.replace(" ${production}", production).replace(" ${effect}", effect)
  .replace(" const [errors,setErrors]", " const sectionB1Ref=useRef(null),sectionB2Ref=useRef(null),sectionB3Ref=useRef(null);\n const [errors,setErrors]");
const transpiled = ts.transpileModule(harnessCode, {
  compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS},
}).outputText;
const Harness = new Function("React","rules","mappers","validateMobileNumber","saveProfileDependents","confirmedProfileRejection",transpiled)
  (React,rules,mappers,validateMobileNumber,saveProfileDependents,confirmedProfileRejection);

const empty = () => ({
  firstName:"Crew",recruitmentDate:"2026-01-01",dateOfBirth:"1990-01-01",presentRank:"",
  countryOfResidence:"INDIA",email:"",mobile:"",maritalStatus:"Single",children:[],vesselType:[],
  trainingCourses:[],documents:[],visas:[],education:[],licenses:[],currentCompanySeaService:[],externalSeaService:[],
  preJoiningMedicals:[],doctorVisits:[],briefings:[],debriefings:[],
});
function setup(overrides:any={},member:string|null="crew") {
  const stored:any={dob:"1990-01-01"};
  const api:any={
    createCrew:vi.fn(async(data:any)=>({...data,crewUuid:"created"})),
    updateCrew:vi.fn(async(_:any,data:any)=>Object.assign(stored,data)),
    savePersonalDetails:vi.fn(async()=>({})),saveAddress:vi.fn(async()=>({})),saveFamilyInfo:vi.fn(async()=>({})),
    saveVesselTypesApplied:vi.fn(async()=>({})),saveNextOfKin:vi.fn(async()=>({})),
    deleteChild:vi.fn(async()=>({})),createChild:vi.fn(async()=>({childUuid:"child-created"})),updateChild:vi.fn(async()=>({})),
  };
  const controls:any={toasts:[]};
  const rendered=render(<Harness initial={{...empty(),...overrides}} api={api} controls={controls} member={member}/>);
  return {api,stored,controls,...rendered};
}
function deferred() {
  let resolve!: (value?:any)=>void;
  const promise=new Promise<any>(r=>{resolve=r;});
  return {promise,resolve};
}
const outside=()=>fireEvent.mouseDown(screen.getByText("Outside"));
const noWrites=(api:any)=>Object.values(api).forEach((fn:any)=>expect(fn).not.toHaveBeenCalled());
const noSuccess=(controls:any)=>expect(controls.toasts.some((t:any)=>["Saved","Auto-saved","Record Created"].includes(t.title))).toBe(false);

describe("Actual Crew Pool handlers and click-outside effect",()=>{
  it("stages a date with no writes, then creates once with that date after First Name is entered",async()=>{
    const {api,controls}=setup({firstName:"",recruitmentDate:"",deleted:["pending-child"]},null);
    // Leave an existing validation error visible; date staging must not clear it.
    outside();await waitFor(()=>expect(controls.current.errors.firstName).toBeTruthy());
    const errors={...controls.current.errors};
    act(()=>controls.current.selectDate("2026-11-01"));
    await act(async()=>controls.current.dateSave());
    expect(controls.current.isRecruitmentDateEditOpen).toBe(false);
    expect(controls.current.formData.recruitmentDate).toBe("2026-11-01");
    expect(controls.current.errors.firstName).toBe(errors.firstName);
    expect(controls.current.deletedChildUuids).toEqual(["pending-child"]);
    noWrites(api);noSuccess(controls);
    outside();noWrites(api);
    act(()=>controls.current.change({firstName:"Fixture"}));
    outside();
    await waitFor(()=>expect(controls.current.createdCrewId).toBe("created"));
    await waitFor(()=>expect(controls.current.isBatchSaving).toBe(false));
    expect(api.createCrew).toHaveBeenCalledOnce();
    expect(api.createCrew.mock.calls[0][0]).toMatchObject({firstName:"Fixture",recruitmentDate:"2026-11-01"});
    outside();await waitFor(()=>expect(controls.current.isBatchSaving).toBe(false));
    expect(api.createCrew).toHaveBeenCalledOnce();
  });
  it("stages a valid date with other invalid fields, but prevents creation until corrected",async()=>{
    const {api,controls}=setup({firstName:"",recruitmentDate:"",email:"bad"},null);
    act(()=>controls.current.selectDate("2026-11-01"));
    await act(async()=>controls.current.dateSave());
    expect(controls.current.isRecruitmentDateEditOpen).toBe(false);noWrites(api);
    act(()=>controls.current.change({firstName:"Fixture"}));
    outside();noWrites(api);
    act(()=>controls.current.change({email:"good@example.com"}));
    outside();
    await waitFor(()=>expect(controls.current.isBatchSaving).toBe(false));
    expect(api.createCrew).toHaveBeenCalledOnce();
    expect(api.createCrew.mock.calls[0][0].recruitmentDate).toBe("2026-11-01");
  });
  it("keeps a creation-ready popup open on a lost create response without locally accepting or retrying",async()=>{
    const {api,controls}=setup({},null);api.createCrew.mockRejectedValueOnce(new Error("response lost"));
    act(()=>controls.current.selectDate("2026-11-01"));
    await act(async()=>controls.current.dateSave());
    expect(controls.current.formData.recruitmentDate).toBe("2026-01-01");
    expect(controls.current.isRecruitmentDateEditOpen).toBe(true);
    await act(async()=>controls.current.dateSave());
    expect(api.createCrew).toHaveBeenCalledOnce();
    expect(controls.toasts.some((t:any)=>t.title==="Creation not confirmed")).toBe(true);
    noSuccess(controls);
  });
  it.each(["outside","Edit B2","Save","Mobile Save"])("blocks invalid DOB via %s",async trigger=>{
    const {api,stored,controls}=setup();
    fireEvent.change(screen.getByLabelText("DOB"),{target:{value:"2020-01-01"}});
    fireEvent.blur(screen.getByLabelText("DOB"));
    trigger==="outside"?outside():fireEvent.click(screen.getByText(trigger));
    await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("18"));
    noWrites(api);noSuccess(controls);expect(stored.dob).toBe("1990-01-01");
    expect(controls.current.editingSections.B1).toBe(true);
  });
  it.each(["outside","Edit B2","Save"])("does not create invalid new crew via %s",async trigger=>{
    const {api,controls}=setup({dateOfBirth:"2020-01-01"},null);
    trigger==="outside"?outside():fireEvent.click(screen.getByText(trigger));
    await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("18"));
    noWrites(api);noSuccess(controls);
  });
  it("waits for all B1 requests and prevents overlapping triggers",async()=>{
    const {api,controls}=setup();const pending=deferred();
    api.savePersonalDetails.mockReturnValueOnce(pending.promise);
    outside();
    await waitFor(()=>expect(api.savePersonalDetails).toHaveBeenCalledOnce());
    noSuccess(controls);expect(controls.current.editingSections.B1).toBe(true);
    outside();fireEvent.click(screen.getByText("Save"));fireEvent.click(screen.getByText("Edit B2"));
    expect(api.updateCrew).toHaveBeenCalledOnce();
    await act(async()=>pending.resolve({}));
    await waitFor(()=>expect(controls.current.editingSections.B1).toBe(false));
    expect(controls.toasts.filter((t:any)=>t.title==="Auto-saved")).toHaveLength(1);
  });
  it("retains edits on a companion request failure without success",async()=>{
    const {api,controls}=setup();api.savePersonalDetails.mockRejectedValueOnce(new Error("offline"));
    outside();
    await waitFor(()=>expect(controls.toasts.some((t:any)=>t.title==="Save not completed")).toBe(true));
    noSuccess(controls);expect(controls.current.editingSections.B1).toBe(true);
  });
  it("does not close newer edits or report them saved after an older request",async()=>{
    const {api,controls}=setup();const pending=deferred();api.savePersonalDetails.mockReturnValueOnce(pending.promise);
    outside();await waitFor(()=>expect(api.savePersonalDetails).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText("DOB"),{target:{value:"2020-01-01"}});
    await act(async()=>pending.resolve({}));
    expect(controls.current.formData.dateOfBirth).toBe("2020-01-01");
    expect(controls.current.editingSections.B1).toBe(true);noSuccess(controls);
  });
  it("ignores a stale completion after the selected session changes",async()=>{
    const {api,controls}=setup();const pending=deferred();api.savePersonalDetails.mockReturnValueOnce(pending.promise);
    outside();await waitFor(()=>expect(api.savePersonalDetails).toHaveBeenCalledOnce());
    controls.current.switchSession();await act(async()=>pending.resolve({}));
    noSuccess(controls);expect(controls.current.editingSections.B1).toBe(true);
  });
  it("accepts corrected DOB and persists it via auto-save",async()=>{
    const {api,stored,controls}=setup({dateOfBirth:"2020-01-01"});
    outside();noWrites(api);
    fireEvent.change(screen.getByLabelText("DOB"),{target:{value:"1991-01-01"}});outside();
    await waitFor(()=>expect(controls.current.editingSections.B1).toBe(false));
    expect(stored.dob).toBe("1991-01-01");expect(controls.current.errors.dateOfBirth).toBe("");
  });
  it.each([{email:"bad"},{mobile:"+91 123"}])("blocks invalid B2 values on outside and section switch",async bad=>{
    const {api,controls}=setup(bad);act(()=>controls.current.section("B2"));
    outside();fireEvent.click(screen.getByText("Edit B3"));
    await waitFor(()=>expect(controls.toasts.length).toBeGreaterThan(0));noWrites(api);noSuccess(controls);
    expect(controls.current.editingSections.B2).toBe(true);
  });
  it("validates B3 before family writes or pending child deletions",async()=>{
    const {api,controls}=setup({maritalStatus:"Married",nokEmail:"bad",deleted:["pending-child"]});
    act(()=>controls.current.section("B3"));outside();
    await waitFor(()=>expect(controls.toasts.length).toBeGreaterThan(0));
    noWrites(api);noSuccess(controls);expect(controls.current.deletedChildUuids).toEqual(["pending-child"]);
  });
  it("does not auto-save a valid section before rejecting another open invalid section",async()=>{
    const {api,controls}=setup({email:"bad"});
    fireEvent.click(screen.getByText("Save"));
    outside();fireEvent.click(screen.getByText("Edit B3"));
    await waitFor(()=>expect(controls.current.errors.email).toBeTruthy());
    noWrites(api);noSuccess(controls);
  });
  it("does not run click-outside validation when clicking inside the edited section",()=>{
    const {api,controls}=setup({dateOfBirth:"2020-01-01"});
    fireEvent.mouseDown(screen.getByLabelText("DOB"));
    expect(controls.toasts).toEqual([]);noWrites(api);
  });
  it.each(["Save","Mobile Save","Outside","Edit B2"])("blocks future recruitment date for %s before any writes",async action=>{
    const {api,controls}=setup({recruitmentDate:"2099-01-01",deleted:["pending-child"]});
    if(action==="Outside")outside();else fireEvent.click(screen.getByText(action));
    await waitFor(()=>expect(controls.current.errors.recruitmentDate).toContain("future"));
    noWrites(api);noSuccess(controls);
    expect(controls.current.deletedChildUuids).toEqual(["pending-child"]);
  });
  it("does not automatically create a crew with a future recruitment date",async()=>{
    const {api,controls}=setup({recruitmentDate:"2099-01-01"},null);
    outside();
    await waitFor(()=>expect(controls.current.errors.recruitmentDate).toContain("future"));
    noWrites(api);noSuccess(controls);
  });
  it.each([{email:"bad"},{nokEmail:"bad"},{maritalStatus:"Married",spouseFirstName:""}])
    ("validates all B1–B3 fields before any full Save requests",async bad=>{
      const {api,controls}=setup({...bad,deleted:["pending-child"]});
      fireEvent.click(screen.getByText("Save"));
      await waitFor(()=>expect(controls.toasts.length).toBeGreaterThan(0));
      noWrites(api);noSuccess(controls);expect(controls.current.deletedChildUuids).toEqual(["pending-child"]);
    });
  it("waits for every full Save operation before success",async()=>{
    const {api,controls,stored}=setup();const pending=deferred();
    api.saveNextOfKin.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByText("Save"));
    await waitFor(()=>expect(api.saveNextOfKin).toHaveBeenCalledOnce());
    noSuccess(controls);
    await act(async()=>pending.resolve({}));
    await waitFor(()=>expect(controls.current.isBatchSaving).toBe(false));
    expect(controls.toasts.some((t:any)=>t.title==="Saved")).toBe(true);
    expect(stored.dob).toBe("1990-01-01");
  });
  it("reports full Save child deletion failure and retains its pending identity",async()=>{
    const {api,controls}=setup({deleted:["pending-child"]});
    api.deleteChild.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(()=>expect(controls.toasts.some((t:any)=>t.title==="Partially Saved")).toBe(true));
    expect(controls.current.deletedChildUuids).toEqual(["pending-child"]);noSuccess(controls);
  });
  it("retains a created crew identity after a companion failure and updates on retry",async()=>{
    const {api,controls}=setup({},null);api.saveAddress.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(()=>expect(controls.toasts.some((t:any)=>t.title==="Error")).toBe(true));
    expect(controls.current.createdCrewId).toBe("created");noSuccess(controls);
    outside();
    await waitFor(()=>expect(api.updateCrew).toHaveBeenCalled());
    expect(api.createCrew).toHaveBeenCalledOnce();
  });
  it("blocks blind create retries after a lost response",async()=>{
    const {api,controls}=setup({},null);api.createCrew.mockRejectedValueOnce(new Error("network lost"));
    outside();await waitFor(()=>expect(controls.current.isBatchSaving).toBe(false));
    outside();fireEvent.click(screen.getByText("Save"));
    await waitFor(()=>expect(controls.toasts.some((t:any)=>t.title==="Creation not confirmed")).toBe(true));
    expect(api.createCrew).toHaveBeenCalledOnce();noSuccess(controls);
  });
});
