import React from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormattedDateInput } from "../../client/src/components/ui/formatted-date-input";
import { validateRecruitmentDate, validateCrewProfile } from "../../shared/v2/crew-pool/profileValidation";
import { validateMobileNumber } from "../../client/src/modules/recruitment/countryDialingCodes";

// Execute the real popup JSX and save handler. Only the unrelated full form,
// network transport and dialog shell are replaced; no copies of save logic.
const source=readFileSync("client/src/modules/crew-pool/CrewInfoForm_v2.tsx","utf8");
const ast=ts.createSourceFile("form.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler="",popup="";
function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==="handleUpdateRecruitmentDate")
    handler=`const ${node.getText(ast)};`;
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==="Dialog"&&
      node.openingElement.attributes.getText(ast).includes("open={isRecruitmentDateEditOpen}"))
    popup=node.getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
if(!handler||!popup)throw new Error("Production recruitment popup/handler not found");
const fixture=`
const {useState,useRef}=React;
return function Fixture({api,controls,member="crew",initial={}}){
 const [formData,setFormData]=useState({firstName:"Crew",recruitmentDate:"2026-11-16",notes:"Unsaved text",...initial});
 const [tempRecruitmentDate,setTempRecruitmentDate]=useState(initial.recruitmentDate??"2026-11-16");
 const [isRecruitmentDateEditOpen,setIsRecruitmentDateEditOpen]=useState(true);
 const [isRecruitmentDateDraftValid,setIsRecruitmentDateDraftValid]=useState(false);
 const [isSavingRecruitmentDate,setIsSavingRecruitmentDate]=useState(false);
 const [recruitmentDateError,setRecruitmentDateError]=useState("");
 const recruitmentDateSavingRef=useRef(false),profileSaveRef=useRef(false),isBatchSavingRef=useRef(false),isCreatingCrewRef=useRef(false);
 const d3SessionRef=useRef({open:true});
 const profileLatestRef=useRef(formData);profileLatestRef.current=formData;
 const firstCreateOwnerRef=useRef(null),profileCreateUncertainRef=useRef(null);
 const isD3Blocked=()=>Boolean(controls.blocked),canEditSection=()=>true;
 const getEffectiveCrewUuid=()=>member;
 const ensureCrewExists=date=>api.ensure(date);
 const apiRequest=(method,url,data)=>api.patch(data);
 const toast=value=>controls.toasts.push(value);
 const queryClient={invalidateQueries:api.refresh};
 const updateFormData=(key,value)=>setFormData(previous=>({...previous,[key]:value}));
 const isSaving=isSavingRecruitmentDate;
 ${handler}
 controls.current={save:handleUpdateRecruitmentDate,formData,recruitmentDateError,
  invalidateSession:()=>{d3SessionRef.current={open:true};},
  markUncertain:()=>{profileCreateUncertainRef.current=d3SessionRef.current;},
  busyProfile:()=>{profileSaveRef.current=true;}};
 return <><output data-testid="header-date">{formData.recruitmentDate}</output>
 <output data-testid="notes">{formData.notes}</output>
 <button onClick={()=>{setTempRecruitmentDate(formData.recruitmentDate);setIsRecruitmentDateEditOpen(true);}}>Open date</button>
 ${popup}</>;
};`;
const js=ts.transpileModule(fixture,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const Dialog=({open,children,onOpenChange}:any)=>open?<section role="dialog">{children}<button onClick={()=>onOpenChange(false)}>Dismiss</button></section>:null;
const Wrap=({children}:any)=><div>{children}</div>;
const Button=({variant,...props}:any)=><button {...props}/>;
const Fixture=new Function("React","FormattedDateInput","validateRecruitmentDate","validateCrewProfile","validateMobileNumber","Dialog","DialogContent","DialogHeader","DialogTitle","DialogFooter","Button",js)
  (React,FormattedDateInput,validateRecruitmentDate,validateCrewProfile,validateMobileNumber,Dialog,Wrap,Wrap,Wrap,Wrap,Button);
beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(2026,10,17,12));});
afterEach(()=>vi.useRealTimers());
function setup(member:string|null="crew",initial:any={}){
  const api={patch:vi.fn().mockResolvedValue({ok:true}),ensure:vi.fn().mockResolvedValue("created"),refresh:vi.fn().mockResolvedValue(undefined)};
  const controls:any={toasts:[]};
  render(<Fixture api={api} controls={controls} member={member} initial={initial}/>);
  return {api,controls};
}
const type=(value:string)=>fireEvent.change(screen.getByTestId("input-recruitment-date-manual"),{target:{value}});
const save=()=>screen.getByRole("button",{name:"Save"});
function pending(){let resolve:any;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};}
describe("Production recruitment-date popup",()=>{
  it.each(["17-Nov-2026","01-Nov-2026"])("accepts %s locally with no First Name and no previous date",async value=>{
    const {api,controls}=setup(null,{firstName:"",recruitmentDate:""});
    type(value);fireEvent.click(save());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toHaveTextContent(value==="17-Nov-2026"?"2026-11-17":"2026-11-01");
    expect(api.ensure).not.toHaveBeenCalled();expect(api.patch).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();expect(controls.toasts).toEqual([]);
    expect(screen.getByTestId("notes")).toHaveTextContent("Unsaved text");
    fireEvent.click(screen.getByRole("button",{name:"Open date"}));
    expect(screen.getByTestId("input-recruitment-date-manual")).toHaveValue(value);
    type("15-Nov-2026");fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    expect(screen.getByTestId("header-date")).toHaveTextContent(value==="17-Nov-2026"?"2026-11-17":"2026-11-01");
  });
  it.each([{email:"bad"},{dateOfBirth:"2020-01-01"},{maritalStatus:"Married",spouseFirstName:""}])(
    "does not make date selection depend on unrelated profile validity",initial=>{
      const {api,controls}=setup(null,initial);
      type("17-Nov-2026");fireEvent.click(save());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(controls.current.formData).toMatchObject({...initial,recruitmentDate:"2026-11-17"});
      expect(api.ensure).not.toHaveBeenCalled();expect(api.patch).not.toHaveBeenCalled();
      expect(controls.toasts).toEqual([]);
    });
  it("does not treat an uncertain earlier creation as a harmless local edit",async()=>{
    const {api,controls}=setup(null,{firstName:"",recruitmentDate:""});
    controls.current.markUncertain();type("17-Nov-2026");fireEvent.click(save());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toBeEmptyDOMElement();
    expect(controls.toasts[0].title).toBe("Creation not confirmed");
    expect(api.ensure).not.toHaveBeenCalled();
  });
  it("does not accept a local date through a blocked session",async()=>{
    const {api,controls}=setup(null,{firstName:"",recruitmentDate:""});
    controls.blocked=true;type("17-Nov-2026");await act(async()=>controls.current.save());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toBeEmptyDOMElement();
    expect(api.ensure).not.toHaveBeenCalled();expect(controls.toasts).toEqual([]);
  });
  it.each(["18-Nov-2026","01-Dec-2026","31-Feb-2026","bad"])("blocks invalid visible date %s and does not write the old accepted value",async value=>{
    const {api,controls}=setup();
    type(value);
    fireEvent.blur(screen.getByTestId("input-recruitment-date-manual"));
    expect(save()).toBeDisabled();
    await act(async()=>controls.current.save());
    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("input-recruitment-date-manual")).toHaveValue(value);
    expect(controls.toasts).toEqual([]);
  });
  it.each(["17-Nov-2026","01-Jan-2020"])("saves %s only after confirmation and preserves unrelated edits",async value=>{
    const {api,controls}=setup();const request=pending();api.patch.mockReturnValueOnce(request.promise);
    type(value);fireEvent.click(save());fireEvent.click(save());
    expect(api.patch).toHaveBeenCalledOnce();
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Dismiss"}));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    expect(controls.toasts).toEqual([]);
    await act(async()=>request.resolve({ok:true}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(controls.current.formData.recruitmentDate).toBe(value==="17-Nov-2026"?"2026-11-17":"2020-01-01");
    expect(screen.getByTestId("notes")).toHaveTextContent("Unsaved text");
    expect(controls.toasts.map((t:any)=>t.title)).toEqual(["Saved"]);
    const profileRefresh=api.refresh.mock.calls.find(([arg]:any[])=>arg.queryKey.includes("full-profile"));
    expect(profileRefresh?.[0].refetchType).toBe("none");
  });
  it("preserves the previous date and editable draft on failure, then allows correction/retry",async()=>{
    const {api,controls}=setup();api.patch.mockRejectedValueOnce(new Error("offline"));
    type("17-Nov-2026");fireEvent.click(save());
    await waitFor(()=>expect(controls.toasts).toHaveLength(1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    expect(screen.getByTestId("input-recruitment-date-manual")).toHaveValue("17-Nov-2026");
    expect(controls.toasts[0].title).toBe("Error");expect(api.refresh).not.toHaveBeenCalled();
    type("15-Nov-2026");fireEvent.click(save());
    await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-15");
  });
  it("clears and cancels without saving and reopens from the accepted date",()=>{
    const {api}=setup();
    type("");expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    fireEvent.click(screen.getByRole("button",{name:"Open date"}));
    expect(screen.getByTestId("input-recruitment-date-manual")).toHaveValue("16-Nov-2026");
    expect(api.patch).not.toHaveBeenCalled();
  });
  it("rejects an invalid new-crew draft before automatic creation",async()=>{
    const {api,controls}=setup(null);
    type("01-Dec-2026");await act(async()=>controls.current.save());
    expect(api.ensure).not.toHaveBeenCalled();expect(api.patch).not.toHaveBeenCalled();
  });
  it("awaits automatic creation before accepting the date",async()=>{
    const {api}=setup(null);const request=pending();api.ensure.mockReturnValueOnce(request.promise);
    type("17-Nov-2026");fireEvent.click(save());
    expect(api.ensure).toHaveBeenCalledWith("2026-11-17");
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    await act(async()=>request.resolve("created"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-17");
  });
  it("keeps the draft open if automatic creation fails",async()=>{
    const {api,controls}=setup(null);api.ensure.mockResolvedValueOnce(null);
    type("17-Nov-2026");fireEvent.click(save());
    await waitFor(()=>expect(save()).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    expect(controls.toasts).toEqual([]);
  });
  it("does not apply a completed response to a different crew session",async()=>{
    const {api,controls}=setup();const request=pending();api.patch.mockReturnValueOnce(request.promise);
    type("17-Nov-2026");fireEvent.click(save());controls.current.invalidateSession();
    await act(async()=>request.resolve({ok:true}));
    expect(screen.getByTestId("header-date")).toHaveTextContent("2026-11-16");
    expect(controls.toasts).toEqual([]);
  });
  it("does not overlap another profile save",async()=>{
    const {api,controls}=setup();controls.current.busyProfile();
    type("17-Nov-2026");await act(async()=>controls.current.save());
    expect(api.patch).not.toHaveBeenCalled();
  });
});
