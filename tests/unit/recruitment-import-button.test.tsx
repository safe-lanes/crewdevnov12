import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecruitmentModuleV2 } from "../../client/src/modules/recruitment/RecruitmentModule_v2";

const state = vi.hoisted(() => ({
  permissions: [{ menuName: "In Progress" }], loading: false, create: false, view: true,
  role: "Viewer", candidates: [], queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: state.permissions, isLoading: state.loading, roleName: state.role,
    canView: () => state.view, canCreate: () => state.create,
    canEdit: () => false, canDelete: () => false,
  }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => state.queryClient }));
vi.mock("wouter", () => ({ useLocation: () => ["/recruitment", vi.fn()] }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCompanyRanks", () => ({ useCompanyRanks: () => ({ rankOptions: [], isLoading: false }) }));
vi.mock("@/hooks/useRankNormalization", () => ({ useRankNormalization: () => ({ normalizeRank: (rank: string) => rank }) }));
vi.mock("@/hooks/v2/useMasterDataV2", () => ({
  useNationalitiesV2: () => ({ data: [] }),
  useVesselTypesV2: () => ({ data: [] }),
  useManningAgentsV2: () => ({ data: [] }),
}));
vi.mock("../../client/src/modules/recruitment/hooks/useRecruitmentV2", () => ({
  useV2Candidates: () => ({ data: state.candidates, isLoading: false }),
  useV2DeleteCandidate: () => ({ mutate: vi.fn() }),
  useV2ScreeningStagesSummary: () => ({ data: [] }),
}));
vi.mock("../../client/src/components/main/MainLayout", () => ({ default: ({ children }: any) => <main>{children}</main> }));
vi.mock("@/components/Section/SectionTitleComponents", () => ({ default: ({ children }: any) => <header>{children}</header> }));
vi.mock("@/components/AgGrid/AgGridTable", () => ({ default: () => <div>Candidate table</div> }));
vi.mock("@/components/ProtectedRoute", () => ({ NoAccessPage: () => <div>No table access</div> }));
vi.mock("../../client/src/modules/recruitment/RecruitmentApplicationForm_v2", () => ({ RecruitmentApplicationFormV2: () => <div>New crew form</div> }));
vi.mock("../../client/src/modules/recruitment/ExcelImportCandidateDialog", () => ({
  ExcelImportCandidateDialog: ({ open }: any) => open ? <div role="dialog">Candidate import</div> : null,
}));
vi.mock("../../client/src/modules/recruitment/RecruitmentSideBar_v2", () => ({
  default: ({ setSelectedRecruitmentPage }: any) => <button onClick={() => setSelectedRecruitmentPage("recruited")}>Recruited tab</button>,
}));
beforeEach(() => {
  state.permissions = [{ menuName: "In Progress" }];
  state.loading = false;
  state.create = false;
  state.view = true;
  state.role = "Viewer";
  window.history.replaceState({}, "", "/recruitment");
});
afterEach(cleanup);

describe("Import button has no extra permission gate", () => {
  it.each(["Viewer", "Manning Agent", "Vessel User"])("opens import for %s without create permission", role => {
    state.role = role;
    render(<RecruitmentModuleV2 />);
    const button = screen.getByRole("button", { name: "Import Candidate" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toHaveTextContent("Candidate import");
    expect(screen.queryByTestId("button-new-crew-v2")).not.toBeInTheDocument();
  });
  it("does not wait for permission loading", () => {
    state.loading = true;
    render(<RecruitmentModuleV2 />);
    expect(screen.getByRole("button", { name: "Import Candidate" })).toBeEnabled();
  });
  it("does not grant access to the candidate table when view permission is absent", () => {
    state.view = false;
    render(<RecruitmentModuleV2 />);
    expect(screen.getByText("No table access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Candidate" })).toBeEnabled();
  });
  it("works when permission data is unavailable", () => {
    state.permissions = [];
    render(<RecruitmentModuleV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Import Candidate" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("remains specific to In Progress", () => {
    render(<RecruitmentModuleV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Recruited tab" }));
    expect(screen.queryByRole("button", { name: "Import Candidate" })).not.toBeInTheDocument();
  });
  it("keeps New Crew's separate create permission", () => {
    state.create = true;
    render(<RecruitmentModuleV2 />);
    expect(screen.getByTestId("button-new-crew-v2")).toBeEnabled();
  });
});
