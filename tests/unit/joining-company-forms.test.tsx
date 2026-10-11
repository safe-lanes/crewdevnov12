import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JoiningCompanyForms, verifyJoiningAssignment } from "../../client/src/modules/vessel/components/JoiningCompanyForms";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/components/configured-form/companySubmissionContract", () => ({
  CompanySubmissionRenderer: ({ submissionUuid }: { submissionUuid: string }) => <div>Persisted renderer {submissionUuid}</div>,
}));
const context = { planUuid: "plan", assignmentUuid: "recorded-assignment", crewUuid: "crew", vesselUuid: "vessel" };
const form = { formUuid: "form", formName: "Pre-Employment Declaration", formVersionUuid: "released-02", versionNo: "02", stageKey: "before_joining" };
function response(body: unknown) { return { json: async () => body }; }
function fixture({ eligible = [form], submissions = [] }: { eligible?: typeof form[]; submissions?: unknown[] } = {}) {
  request.mockImplementation(async (method: string, path: string) => {
    if (path === "/api/v2/vessel/planning/plan") return response({ relieverAssignUuid: context.assignmentUuid, relieverCrewUuid: context.crewUuid, vesselUuid: context.vesselUuid });
    if (path.includes("/reliever-assignment/")) return response({ assignUuid: context.assignmentUuid, crewUuid: context.crewUuid, vesselUuid: context.vesselUuid, assignmentType: "Planned" });
    if (path.includes("/eligible-forms?stageKey=before_joining")) return response(eligible);
    if (path.endsWith("/submissions") && method === "GET") return response({ submissions });
    if (path.endsWith("/submissions") && method === "POST") return response({ submissionUuid: "created" });
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
}
function mount(props = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><JoiningCompanyForms {...props} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); request.mockReset(); });

describe("Joining Company Forms use the recorded planning association", () => {
  it("shows only before-joining declarations and keeps assignment IDs out of the introduction", async () => {
    fixture({ submissions: ["before_joining", "on_board", "at_sign_off"].map(stageKey => ({
      submissionUuid: stageKey, stageKey, formName: `Declaration ${stageKey}`,
      status: "completed", replacementHistory: [{ submissionUuid: "on_board", label: "Foreign-stage replacement" }],
    })) });
    mount();
    await screen.findByText("Declaration before_joining · completed");
    expect(screen.queryByText("Declaration on_board · completed")).toBeNull();
    expect(screen.queryByText("Declaration at_sign_off · completed")).toBeNull();
    expect(screen.queryByText("Foreign-stage replacement")).toBeNull();
    expect(screen.queryByText(context.assignmentUuid)).toBeNull();
  });
  it("uses pinned version metadata and the display stage even outside today's eligible catalogue", async () => {
    fixture({ eligible: [], submissions: [{ submissionUuid: "history", formVersionUuid: "private-uuid",
      formUuid: "archived-form", formName: "Archived declaration", status: "voided",
      versionNo: "02", releasedAt: "2026-10-02T07:34:39Z", stageKey: "before_joining", stageLabel: "Before joining" }] });
    mount();
    expect(await screen.findByText("Version 02 · Released 02-Oct-2026")).toBeTruthy();
    expect(screen.getByText("Before joining")).toBeTruthy();
    expect(screen.queryByText(/private-uuid|before_joining/)).toBeNull();
  });
  it("reads the exact link without a crew/current-assignment discovery query", async () => {
    fixture();
    await verifyJoiningAssignment(context);
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      "/api/v2/vessel/planning/plan",
      "/api/v2/vessel/planning/plan/reliever-assignment/recorded-assignment",
    ]);
  });
  it("refuses stale or mismatched links without searching for a replacement", async () => {
    request.mockResolvedValue(response({ relieverAssignUuid: "different", relieverCrewUuid: "crew", vesselUuid: "vessel" }));
    await expect(verifyJoiningAssignment(context)).rejects.toThrow("association has changed");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not make an orphan start or lookup for an absent link", async () => {
    mount({ ...context, assignmentUuid: "" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Reconciliation");
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects a linked-reader response belonging to another crew member", async () => {
    fixture();
    const normal = request.getMockImplementation()!;
    request.mockImplementation((method: string, path: string) => path.includes("/reliever-assignment/")
      ? response({ assignUuid: context.assignmentUuid, crewUuid: "other-crew", vesselUuid: context.vesselUuid, assignmentType: "Planned" })
      : normal(method, path));
    await expect(verifyJoiningAssignment(context)).rejects.toThrow("not a valid deployed reliever");
  });
  it("requires manual released-version selection and uses submission-owned endpoints", async () => {
    fixture(); mount();
    const picker = await screen.findByTestId("select-joining-form-version");
    expect(screen.getByTestId("button-start-joining-form")).toBeDisabled();
    fireEvent.change(picker, { target: { value: form.formVersionUuid } });
    fireEvent.click(screen.getByTestId("button-start-joining-form"));
    expect(await screen.findByText("Persisted renderer created")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("POST", expect.stringContaining("/subjects/crew_assignment/recorded-assignment/submissions"), {
      formUuid: "form", formVersionUuid: "released-02",
    });
    expect(request.mock.calls.every((call) => !call[1].includes("/admin/"))).toBe(true);
  });
  it("resumes the existing pinned parent instead of creating another declaration", async () => {
    fixture({ submissions: [{ submissionUuid: "pinned-01", formUuid: "form", formVersionUuid: "older-version", stageKey: "before_joining", status: "completed" }] });
    mount();
    fireEvent.change(await screen.findByTestId("select-joining-form-version"), { target: { value: form.formVersionUuid } });
    fireEvent.click(screen.getByTestId("button-start-joining-form"));
    expect(await screen.findByText("Persisted renderer pinned-01")).toBeInTheDocument();
    expect(request.mock.calls.some((call) => call[0] === "POST")).toBe(false);
  });
  it("keeps readable voided history when the eligible catalogue is empty", async () => {
    fixture({ eligible: [], submissions: [{ submissionUuid: "voided-history", formUuid: "archived-form", formVersionUuid: "old-version", stageKey: "before_joining", status: "voided", replacedBySubmissionUuid: "replacement" }] });
    mount();
    expect(await screen.findByText("No released, lifecycle-valid before-joining forms are eligible for this assignment.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Read form" }));
    expect(await screen.findByText("Persisted renderer voided-history")).toBeInTheDocument();
  });
  it("shows a permission error rather than reporting empty eligibility", async () => {
    request.mockRejectedValue(new Error("403: Permission denied"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("403");
    expect(screen.queryByText(/No released, lifecycle-valid/)).not.toBeInTheDocument();
  });
  it("does not display a late creation result after switching relievers", async () => {
    fixture();
    const normal = request.getMockImplementation()!;
    const other = { planUuid: "other-plan", assignmentUuid: "other-assignment", crewUuid: "other-crew", vesselUuid: "vessel" };
    let resolveStart!: (value: unknown) => void;
    const deferred = new Promise((resolve) => { resolveStart = resolve; });
    request.mockImplementation((method: string, path: string, data?: unknown) => {
      if (method === "POST") return deferred;
      if (path === "/api/v2/vessel/planning/other-plan") return response({ relieverAssignUuid: other.assignmentUuid, relieverCrewUuid: other.crewUuid, vesselUuid: other.vesselUuid });
      if (path.includes("/other-plan/reliever-assignment/")) return response({ assignUuid: other.assignmentUuid, crewUuid: other.crewUuid, vesselUuid: other.vesselUuid, assignmentType: "Planned" });
      return normal(method, path, data);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (props: typeof context) => <QueryClientProvider client={client}><JoiningCompanyForms {...props} /></QueryClientProvider>;
    const view = render(ui(context));
    fireEvent.change(await screen.findByTestId("select-joining-form-version"), { target: { value: form.formVersionUuid } });
    fireEvent.click(screen.getByTestId("button-start-joining-form"));
    fireEvent.click(screen.getByTestId("button-start-joining-form"));
    await waitFor(() => expect(request.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(1));
    view.rerender(ui(other));
    await waitFor(() => expect(request.mock.calls.some(call =>
      String(call[1]).includes("/other-assignment/eligible-forms"))).toBe(true));
    await act(async () => { resolveStart(response({ submissionUuid: "late-old-parent" })); });
    expect(screen.queryByText("Persisted renderer late-old-parent")).not.toBeInTheDocument();
    expect(screen.queryByText(context.assignmentUuid)).toBeNull();
    expect(screen.queryByText("other-assignment")).toBeNull();
    expect(await screen.findByTestId("select-joining-form-version")).toHaveValue("");
  });
});