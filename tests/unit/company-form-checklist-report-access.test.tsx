import React from "react";
import { describe,it,expect,vi } from "vitest";
import { render,screen,cleanup } from "@testing-library/react";
const grants=vi.hoisted(()=>({view:true}));
vi.mock("@/contexts/PermissionsContext",()=>({usePermissions:()=>({
  canView:()=>false,canCompanyFormAction:()=>grants.view,isLoading:false,permissions:[{menuName:"Crew Database"}],
})}));
vi.mock("wouter",()=>({Redirect:()=>null}));
import { ProtectedRoute } from "../../client/src/components/ProtectedRoute";
describe("Company Forms report entry",()=>{
  it("admits Company Forms View without granting the legacy Reports menu",()=>{
    render(<ProtectedRoute menuName="Reports" companyFormsReports><span>Scoped forms report</span></ProtectedRoute>);
    expect(screen.getByText("Scoped forms report")).toBeTruthy();cleanup();
  });
  it("does not admit unrelated modules through Company Forms View",()=>{
    render(<ProtectedRoute menuName="Admin"><span>Unrelated module</span></ProtectedRoute>);
    expect(screen.queryByText("Unrelated module")).toBeNull();
    expect(screen.getByTestId("no-access-page")).toBeTruthy();cleanup();
  });
  it("refuses the report when neither grant exists",()=>{
    grants.view=false;
    render(<ProtectedRoute menuName="Reports" companyFormsReports><span>Scoped forms report</span></ProtectedRoute>);
    expect(screen.queryByText("Scoped forms report")).toBeNull();cleanup();grants.view=true;
  });
});
