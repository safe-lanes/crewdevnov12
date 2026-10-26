import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReliefStatusEditDialog_v2 } from "@/modules/vessel/components/ReliefStatusEditDialog_v2";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  createAsync: vi.fn(),
  toast: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/modules/vessel/hooks/useVesselV2", () => ({
  useUpdatePlanningV2: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
  useCreatePlanningV2: () => ({ mutateAsync: mocks.createAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: [],
    roleName: "admin",
    userType: "office",
    canCompanyFormAction: () => true,
  }),
}));
vi.mock("@/modules/vessel/components/JoiningCompanyForms", () => ({ JoiningCompanyForms: () => null }));
vi.mock("@/modules/vessel/components/TrainingMatrixCompliance", () => ({ TrainingMatrixCompliance: () => null }));
vi.mock("@/modules/vessel/components/AcceptedChecklistHistory", () => ({ AcceptedChecklistHistory: () => null }));

const planningData = {
  planUuid: "plan-123",
  relieverAssignUuid: "assignment-456",
  relieverCrewUuid: "crew-789",
  relieverCrewId: "crew-789",
  relieverAssigned: true,
  relieverCrewName: "Mara Venn",
  relieverNationality: "Norwegian",
  relieverContractPeriodMonths: 6,
  relieverContractEndRangeStartMonths: 7,
  relieverContractEndRangeEndMonths: 8,
  plannedConfirmedDate: "2025-03-12",
  relieverSignOnDate: "2025-03-20",
  joiningStatus: "Planned",
  deploymentChecklistCompleted: false,
  applicableDocsChecked: false,
};

function renderDialog() {
  mocks.apiRequest.mockResolvedValue({ json: async () => ({ allowed: true }) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const onOpenChange = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ReliefStatusEditDialog_v2 open onOpenChange={onOpenChange} rank="Chief Officer" vesselUuid="vessel-1" rankId="rank-1" planningData={planningData} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...view, queryClient, invalidate, onOpenChange };
}

afterEach(() => {
  cleanup();
  delete (window as Window & { confirm?: typeof window.confirm }).confirm;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ReliefStatusEditDialog_v2 step 3 save behavior", () => {
  it("saves without closing, resets the dirty baseline, refreshes compliance, and serializes cleared own values as null", async () => {
    const user = userEvent.setup();
    mocks.mutateAsync.mockResolvedValue({ relieverContractEndRangeEndMonths: null });
    const { invalidate } = renderDialog();

    const rangeEnd = screen.getByTestId("input-reliever-contract-range-end") as HTMLInputElement;
    await user.clear(rangeEnd);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync.mock.calls[0][0].data).toMatchObject({
      relieverContractEndRangeEndMonths: null,
      plannedConfirmedDate: "2025-03-12",
    });
    expect(screen.getByText("Rank: Chief Officer")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["training-matrix-compliance", "plan-123", "assignment-456"],
    });

    const confirm = vi.fn().mockReturnValue(false);
    Object.defineProperty(window, "confirm", { configurable: true, value: confirm });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks to discard dirty edits and preserves or closes according to the native confirmation", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();
    await user.clear(screen.getByTestId("input-reliever-contract-range-end"));

    const confirm = vi.fn().mockReturnValue(false);
    Object.defineProperty(window, "confirm", { configurable: true, value: confirm });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Rank: Chief Officer")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the popup open after a successful checklist override acceptance", async () => {
    const user = userEvent.setup();
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error(JSON.stringify({
        error: "company_forms_checklist_blocked",
        message: "Checklist incomplete",
        canOverride: true,
        canOverrideTraining: false,
        blockers: [{ kind: "requirement", status: "UNRESOLVED", formName: "Safety briefing" }],
      })))
      .mockResolvedValueOnce({ checklistAcceptance: { warnings: [] } });
    const { invalidate } = renderDialog();

    await user.click(screen.getAllByRole("radio", { name: "Yes" })[0]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Checklist needs attention")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Request a Company Forms checklist override"));
    await user.type(screen.getByLabelText("Reason for Company Forms override"), "Port change confirmed by office");
    await user.click(screen.getByRole("button", { name: "Save planning change" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Rank: Chief Officer")).toBeInTheDocument();
    expect(screen.queryByText("Checklist needs attention")).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["training-matrix-compliance", "plan-123", "assignment-456"],
    });
  });
});
