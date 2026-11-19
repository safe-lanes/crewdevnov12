import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReliefStatusEditDialog_v2 } from "../../client/src/modules/vessel/components/ReliefStatusEditDialog_v2";

const mocks = vi.hoisted(() => ({
  signOn: vi.fn(), toast: vi.fn(), request: vi.fn(), fetch: vi.fn(),
  update: { mutateAsync: vi.fn(), isPending: false },
  create: { mutateAsync: vi.fn(), isPending: false },
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
  useQuery: () => ({ data: { allowed: false }, isLoading: false }),
}));
vi.mock("@/hooks/use-app-dialog", () => ({ useAppDialog: () => ({ ask: vi.fn().mockResolvedValue(true), dialog: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ permissions: [], roleName: "Admin", userType: "Office", canCompanyFormAction: () => false }),
}));
vi.mock("../../client/src/modules/vessel/hooks/useVesselV2", () => ({
  useUpdatePlanningV2: () => mocks.update, useCreatePlanningV2: () => mocks.create,
}));
vi.mock("../../client/src/modules/vessel/api/vesselApiV2", () => ({ vesselApiV2: { signOnReliever: mocks.signOn } }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.request }));
vi.mock("@/components/ui/SearchablePortCombobox", () => ({ SearchablePortCombobox: () => <span>Port selector</span> }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>, TooltipTrigger: ({ children }: any) => <>{children}</>, TooltipContent: () => null,
}));
vi.mock("@/components/configured-form/RequiredFormDetails", () => ({ RequiredFormDetails: () => null }));
vi.mock("../../client/src/modules/vessel/components/JoiningCompanyForms", () => ({ JoiningCompanyForms: () => null }));
vi.mock("../../client/src/modules/vessel/components/AcceptedChecklistHistory", () => ({ AcceptedChecklistHistory: () => null }));
// An unavailable training panel must not change the user's existing sign-on policy.
vi.mock("../../client/src/modules/vessel/components/TrainingMatrixCompliance", () => ({
  TrainingMatrixCompliance: () => <span>Training compliance could not be loaded.</span>,
}));

const planning = {
  planUuid: "plan-test", relieverCrewUuid: "crew-test", relieverAssignUuid: "assign-test",
  relieverCrewName: "Test Crew", relieverNationality: "Test",
  joiningStatus: "Signed On", relieverSignOnDate: "2025-01-10",
  plannedConfirmedDate: "2025-01-05", travelStartDate: "2025-01-09",
};
const props = { open: true, onOpenChange: vi.fn(), rank: "Master", rankId: "rank-test", vesselUuid: "vessel-test" };
function submit() {
  fireEvent.submit(screen.getByTestId("button-submit-relief").closest("form")!);
}
function mount(data: any = planning) {
  return render(<ReliefStatusEditDialog_v2 {...props} planningData={data} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOn.mockReset().mockResolvedValue({
    planUuid: "plan-test", crewUuid: "crew-test", relieverCrewUuid: null,
    relieverSignOnDate: null, plannedConfirmedDate: null, travelStartDate: null, joiningStatus: null,
    signOnWarnings: [],
  });
  mocks.queryClient.invalidateQueries.mockReset().mockResolvedValue(undefined);
  mocks.update.mutateAsync.mockReset().mockResolvedValue({});
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ hasConflict: false }) });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("joining dialog sign-on completion", () => {
  it("closes on success without resetting entered dates from cleared reliever fields", async () => {
    mount();
    submit();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.signOn).toHaveBeenCalledTimes(1);
    expect(mocks.signOn).toHaveBeenCalledWith("plan-test", expect.objectContaining({ signOnDate: "2025-01-10" }));
    expect(screen.getByTestId("input-relieverSignOnDate-manual")).toHaveValue("10-Jan-2025");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Crew signed on successfully." }));
    expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
  });
  it.each(["", "bad", "2025-02-30"])("does not sign on when date is %s", async date => {
    mount({ ...planning, relieverSignOnDate: date });
    submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Validation Error" })));
    expect(mocks.signOn).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("blocks concurrent submit and Enter-equivalent form events until completion", async () => {
    let resolve!: (value: any) => void;
    mocks.signOn.mockImplementation(() => new Promise(r => { resolve = r; }));
    mount();
    submit();
    submit();
    await waitFor(() => expect(mocks.signOn).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("button-submit-relief")).toBeDisabled();
    submit();
    expect(mocks.signOn).toHaveBeenCalledTimes(1);
    resolve({ signOnWarnings: [] });
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    submit();
    expect(mocks.signOn).toHaveBeenCalledTimes(1);
  });
  it("does not submit a stale valid date when the visible date draft is invalid", async () => {
    mount();
    fireEvent.change(screen.getByTestId("input-relieverSignOnDate-manual"), { target: { value: "bad" } });
    expect(screen.getByTestId("button-submit-relief")).toBeDisabled();
    submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Validation Error" })));
    expect(mocks.signOn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("input-relieverSignOnDate-manual"), { target: { value: "11-Jan-2025" } });
    submit();
    await waitFor(() => expect(mocks.signOn).toHaveBeenCalledWith("plan-test", expect.objectContaining({ signOnDate: "2025-01-11" })));
  });
  it("preserves entered values on definite server rejection and allows a corrected retry", async () => {
    mocks.signOn.mockRejectedValueOnce(new Error('409: {"error":"Linked reliever assignment changed"}'));
    mount();
    submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error" })));
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("input-relieverSignOnDate-manual")).toHaveValue("10-Jan-2025");
    submit();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.signOn).toHaveBeenCalledTimes(2);
  });
  it("does not report a rejected sign-on after a successful write and failed refresh", async () => {
    mocks.queryClient.invalidateQueries.mockRejectedValue(new Error("refresh unavailable"));
    mount();
    submit();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Signed on — refresh needed" })));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.signOn).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Error" }));
  });
  it.each(["Failed to fetch", "500: response lost"])("requires checking authoritative state after ambiguous response %s", async message => {
    mocks.signOn.mockRejectedValue(new Error(message));
    mount();
    submit();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sign-on status needs checking" }));
    submit();
    expect(mocks.signOn).toHaveBeenCalledTimes(1);
  });
  it("shows post-commit follow-up warnings without treating sign-on as failed", async () => {
    mocks.signOn.mockResolvedValue({ signOnWarnings: ["Joining forms need review."] });
    mount();
    submit();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Signed on — follow-up needed", description: expect.stringContaining("Joining forms need review.") }));
  });
  it("keeps non-sign-on planning saves open with their existing reset behavior", async () => {
    mount({ ...planning, joiningStatus: "Confirmed" });
    submit();
    await waitFor(() => expect(mocks.update.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.signOn).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("does not sign on when the existing cross-vessel conflict check refuses", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ hasConflict: true, conflictVesselName: "Other Vessel" }) });
    mount();
    submit();
    await screen.findByText(/Other Vessel/);
    expect(mocks.signOn).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("does not retain completion lock when reopened for another crew", async () => {
    const view = mount();
    submit();
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    view.rerender(<ReliefStatusEditDialog_v2 {...props} open={false} planningData={planning} />);
    view.rerender(<ReliefStatusEditDialog_v2 {...props} planningData={{ ...planning, planUuid: "other-plan", relieverCrewUuid: "other-crew" }} />);
    submit();
    await waitFor(() => expect(mocks.signOn).toHaveBeenCalledTimes(2));
  });
});
