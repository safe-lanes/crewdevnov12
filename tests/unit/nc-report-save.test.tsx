import React, { useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NCReportDialog } from "../../client/src/modules/rest-hours/components/NCReportDialog";
import { restHoursApiV2 } from "../../client/src/modules/rest-hours/api/restHoursApiV2";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), userType: "Office", dateValid: true }));
vi.mock("../../client/src/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("../../client/src/hooks/useRankScope", () => ({ useRankScope: () => ({ userType: mocks.userType }) }));
vi.mock("../../client/src/modules/rest-hours/hooks/useRestHoursV2Data", () => ({
  useV2Vessels: () => ({ vessels: [] }),
}));
vi.mock("../../client/src/hooks/v2/useMasterDataV2", () => ({ useUsersV2: () => ({ data: [], isLoading: false }) }));
vi.mock("../../client/src/modules/rest-hours/api/restHoursApiV2", () => ({
  restHoursApiV2: {
    dailyRecords: { getByKey: vi.fn().mockResolvedValue(null) },
    ncReports: { getAll: vi.fn(), getByUuid: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("../../client/src/modules/rest-hours/components/RHDateInput", () => ({
  RHDateInput: ({ value, onChange, validationRef, id, disabled, ...props }: any) => {
    useImperativeHandle(validationRef, () => ({ validate: () => mocks.dateValid }));
    return <input id={id} data-testid={props["data-testid"]} disabled={disabled} type="date"
      value={value ? value.toISOString().slice(0, 10) : ""}
      onChange={e => onChange(e.target.value ? new Date(`${e.target.value}T12:00:00Z`) : undefined)} />;
  },
}));

const api = restHoursApiV2.ncReports;
const key = ["v2", "rest-hours", "nc-reports", "by-crew", "TEST-CREW"];
const record: any = { crewMemberId: "TEST-CREW", vesselId: "TEST-VESSEL", monthValue: "2026-11", rank: "Master", name: "Test Crew" };
const report = (stage = "draft") => ({
  ...record, id: 1, ncReportUuid: "TEST-REPORT", submissionStatus: stage,
  status: stage === "office-submitted" ? "Closed" : "Open",
  identifiedRootCause: "Cause", immediateCorrectiveAction: "Correction", preventiveAction: "Prevention",
  preventiveActionStatus: "Pending", preventiveActionDueDate: "2026-11-01T12:00:00Z",
});
let client: QueryClient;
let saved: any;
function mount() {
  return render(<QueryClientProvider client={client}>
    <NCReportDialog open onOpenChange={() => {}} crewRecord={record} vesselName="TEST-VESSEL" />
  </QueryClientProvider>);
}
async function ready() { await screen.findByTestId("button-save"); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userType = "Office"; mocks.dateValid = true;
  saved = report();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  vi.mocked(api.getAll).mockImplementation(async () => saved ? [saved] : []);
  vi.mocked(api.getByUuid).mockImplementation(async () => saved);
  vi.mocked(api.create).mockImplementation(async (data: any) => (saved = { ...report(), ...data }));
  vi.mocked(api.update).mockImplementation(async (_uuid: string, data: any) => (saved = { ...saved, ...data }));
});
afterEach(() => { cleanup(); client.clear(); });

describe("NC report Save and submission", () => {
  it("preserves Vessel submission after Save and reopening", async () => {
    const view = mount(); await ready();
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument());
    fireEvent.change(screen.getByTestId("textarea-root-cause"), { target: { value: "Updated cause" } });
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
    expect(saved.submissionStatus).toBe("vessel-submitted");
    expect(saved.identifiedRootCause).toBe("Updated cause");
    expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.objectContaining({ description: "NC Report saved successfully" }));
    view.unmount(); mount(); await ready();
    expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
    expect(client.getQueryData<any>(key).submissionStatus).toBe("vessel-submitted");
  });

  it("saves Draft without making submission fields mandatory", async () => {
    saved = { ...report(), identifiedRootCause: "", immediateCorrectiveAction: "", preventiveAction: "", preventiveActionDueDate: null };
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    expect(vi.mocked(api.update).mock.calls[0][1]).not.toHaveProperty("submissionStatus");
    expect(vi.mocked(api.update).mock.calls[0][1]).not.toHaveProperty("status");
    await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
    expect(screen.getByTestId("button-vessel-submit")).toBeVisible();
  });

  it("retains the created UUID before the first refetch completes", async () => {
    saved = null;
    const view = mount(); await ready();
    // Following the first successful create, keep list refresh pending.
    vi.mocked(api.getAll).mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
    expect(vi.mocked(api.create).mock.calls[0][0]).toMatchObject({ submissionStatus: "draft", status: "Open" });
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
    // Fill Vessel fields and submit, still without a completed list refetch.
    fireEvent.change(screen.getByTestId("textarea-root-cause"), { target: { value: "Cause" } });
    fireEvent.change(screen.getByTestId("textarea-corrective-action"), { target: { value: "Correction" } });
    fireEvent.change(screen.getByTestId("textarea-preventive-action"), { target: { value: "Prevention" } });
    fireEvent.change(screen.getByTestId("button-preventive-action-due-date"), { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.create).toHaveBeenCalledOnce();
    expect(vi.mocked(api.update).mock.calls.every(([uuid]) => uuid === "TEST-REPORT")).toBe(true);
    await waitFor(() => expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument());
    view.unmount();
  });

  it("does not reset status or typed content on failed Save", async () => {
    saved = report("vessel-submitted");
    vi.mocked(api.update).mockRejectedValueOnce(new Error("503: unavailable"));
    mount(); await ready();
    fireEvent.change(screen.getByTestId("textarea-root-cause"), { target: { value: "Unsaved correction" } });
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByTestId("textarea-root-cause")).toHaveValue("Unsaved correction");
    expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
    expect(saved.submissionStatus).toBe("vessel-submitted");
    expect(mocks.toast.mock.calls.some(([value]) => value.title === "Success")).toBe(false);
  });

  it("does not advance status on failed submission", async () => {
    vi.mocked(api.update).mockRejectedValueOnce(new Error("500: failed"));
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByTestId("button-vessel-submit")).toBeVisible();
    expect(saved.submissionStatus).toBe("draft");
  });

  it("refreshes a stale Save conflict to Office locked without losing typed content or retrying", async () => {
    mount(); await ready();
    fireEvent.change(screen.getByTestId("textarea-root-cause"), { target: { value: "Unsaved correction" } });
    saved = report("office-submitted");
    vi.mocked(api.update).mockRejectedValueOnce(new Error('409: {"error":"Report is locked"}'));
    fireEvent.click(screen.getByTestId("button-save"));
    await screen.findByText("This report has been submitted by office and is locked.");
    expect(api.getByUuid).toHaveBeenCalledWith("TEST-REPORT");
    expect(api.update).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-save")).not.toBeInTheDocument();
    expect(screen.getByTestId("textarea-root-cause")).toHaveValue("Unsaved correction");
    expect(mocks.toast.mock.calls.some(([value]) => value.title === "Success")).toBe(false);
  });

  it("uses authoritative response status instead of mutation intent", async () => {
    vi.mocked(api.update).mockImplementationOnce(async (_uuid, data) => (saved = { ...saved, ...data, submissionStatus: "vessel-submitted" }));
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument());
    expect(client.getQueryData<any>(key).submissionStatus).toBe("vessel-submitted");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "NC Report saved successfully" }));
  });

  it.each(["draft", "vessel-submitted"])("allows eligible Office submission from %s", async stage => {
    saved = {
      ...report(stage), preventiveActionStatus: "Completed", preventiveActionDateCompleted: "2026-11-01T12:00:00Z",
      officeClosureVerifiedByName: "Test Office User", officeClosureVerifiedByPosition: "Office User",
      officeClosureDate: "2026-11-01T12:00:00Z",
    };
    mount(); await ready();
    expect(screen.getByTestId("button-office-submit")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-office-submit"));
    await screen.findByText("This report has been submitted by office and is locked.");
    expect(saved).toMatchObject({ submissionStatus: "office-submitted", status: "Closed" });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "NC Report submitted by office successfully" }));
  });

  it("preserves Office requirements and hides Office action for Ship users", async () => {
    const view = mount(); await ready();
    expect(screen.getByTestId("button-office-submit")).toBeDisabled();
    view.unmount(); mocks.userType = "Ship";
    mount(); await ready();
    expect(screen.queryByTestId("button-office-submit")).not.toBeInTheDocument();
  });

  it("retains Vessel required-field and date validation", async () => {
    saved = { ...report(), identifiedRootCause: "" };
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    expect(api.update).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Validation Error" }));
    mocks.dateValid = false;
    fireEvent.click(screen.getByTestId("button-save"));
    expect(api.update).not.toHaveBeenCalled();
  });

  it("requires Date Completed for completed Vessel preventive action", async () => {
    saved = { ...report(), preventiveActionStatus: "Completed", preventiveActionDateCompleted: null };
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    expect(api.update).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Please enter Date Completed when status is Completed." }));
  });

  it("keeps Office-submitted records locked on initial load", async () => {
    saved = report("office-submitted");
    mount();
    await screen.findByText("This report has been submitted by office and is locked.");
    expect(screen.queryByTestId("button-save")).not.toBeInTheDocument();
    expect(screen.getByTestId("textarea-root-cause")).toBeDisabled();
  });

  it("handles repeated saves without restoring the Vessel button", async () => {
    saved = report("vessel-submitted");
    mount(); await ready();
    for (let i = 1; i <= 3; i++) {
      fireEvent.click(screen.getByTestId("button-save"));
      await waitFor(() => expect(api.update).toHaveBeenCalledTimes(i));
      await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
      expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
    }
    expect(api.create).not.toHaveBeenCalled();
  });

  it("does not lose the committed UUID or stage if the following refresh fails", async () => {
    mount(); await ready();
    vi.mocked(api.getAll).mockRejectedValue(new Error("Network unavailable"));
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("button-save")).toBeEnabled());
    fireEvent.click(screen.getByTestId("button-save"));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
    expect(api.create).not.toHaveBeenCalled();
    expect(saved.submissionStatus).toBe("vessel-submitted");
  });

  it("does not offer create/save when the initial report load fails", async () => {
    vi.mocked(api.getAll).mockRejectedValueOnce(new Error("Network unavailable"));
    mount();
    await screen.findByText("Unable to load the NC report. No changes have been saved.");
    expect(screen.queryByTestId("button-save")).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await ready();
    expect(screen.getByTestId("textarea-root-cause")).toHaveValue("Cause");
  });

  it("ignores a canceled pre-submission read that resolves late", async () => {
    mount(); await ready();
    let finishOldRead!: (reports: any[]) => void;
    vi.mocked(api.getAll).mockImplementationOnce(() => new Promise(resolve => { finishOldRead = resolve; }));
    await act(async () => { void client.refetchQueries({ queryKey: key, exact: true }); });
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument());
    await act(async () => { finishOldRead([report("draft")]); });
    expect(client.getQueryData<any>(key).submissionStatus).toBe("vessel-submitted");
    expect(screen.queryByTestId("button-vessel-submit")).not.toBeInTheDocument();
  });

  it("invalidates report-list variants used by the shared entry points", async () => {
    const listKeys = [
      ["v2", "rest-hours", "nc-reports", "all"],
      ["v2", "rest-hours", "nc-reports", "all", { vesselIds: ["TEST-VESSEL"], monthsInPeriod: ["2026-11"] }],
    ];
    listKeys.forEach(listKey => client.setQueryData(listKey, [report()]));
    mount(); await ready();
    fireEvent.click(screen.getByTestId("button-vessel-submit"));
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    await waitFor(() => listKeys.forEach(listKey => expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)));
  });
});
