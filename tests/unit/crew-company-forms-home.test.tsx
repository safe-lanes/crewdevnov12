import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrewCompanyFormsHome } from "../../client/src/modules/crew-pool/components/CrewCompanyFormsHome";
import { CrewCompanyFormsHistory } from "../../client/src/modules/crew-pool/components/CrewCompanyFormsHistory";

vi.mock("../../client/src/components/configured-form/companySubmissionContract", () => ({
  CompanySubmissionRenderer: ({ submissionUuid, onBack, showSubmissionMetadata }: any) =>
    <div data-testid="saved-form">{submissionUuid}{showSubmissionMetadata && <span>Profile metadata enabled</span>}<button onClick={onBack}>Saved form back</button></div>,
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const saved = (id: string, stage: string, status: string) => ({
  submissionUuid: id, formName: "Safety declaration", versionNo: "02",
  stageKey: stage, stageLabel: { before_joining: "Before joining", on_board: "On board", at_sign_off: "At sign-off" }[stage],
  status, createdAt: "2026-10-03", systemSnapshotAt: null,
  replacementHistory: id === "void" ? [{
    submissionUuid: "new", direction: "replaced_by", label: "Voided — replaced by",
    targetLabel: "Safety declaration — Created 03-Oct-2026 — Voided by Recorded Office User",
  }] : [],
});
const data = {
  groups: [
    { subjectRef: "a", groupId: "a", display: { label: "Vessel One", status: "Cancelled" },
      totalCount: 3, submissions: [saved("void", "before_joining", "voided"), saved("new", "before_joining", "completed"), saved("aboard", "on_board", "in_progress")] },
    { subjectRef: "old", groupId: "old", display: { label: "Archived voyage", status: "Signed off", historyOnly: true },
      totalCount: 1, submissions: [saved("signedoff", "at_sign_off", "completed")] },
    { subjectRef: "empty", groupId: "empty", display: { label: "Empty voyage", status: "Planned" }, totalCount: 0, submissions: [] },
  ],
};
function mount(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
describe("G3 complete crew Company Form history", () => {
  it("groups all stages/statuses, keeps cancelled and history-only rows, and never exposes extra assignment props", async () => {
    const fetch = vi.fn(async () => reply(data)); vi.stubGlobal("fetch", fetch);
    mount(<CrewCompanyFormsHome crewUuid="crew" assignments={[{ assignUuid: "a", signOnDate: "2026-10-03" }, { assignUuid: "unpermitted" }]} onOpenSubmission={vi.fn()} />);
    await screen.findByTestId("crew-company-forms-group-a");
    expect(screen.getByText("G3. Company Forms")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.getAllByText(/Before joining/)).toHaveLength(2);
    expect(screen.getByText(/On board/)).toBeTruthy(); expect(screen.getByText(/At sign-off/)).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy(); expect(screen.getByText("Voided")).toBeTruthy();
    expect(screen.getAllByText("Completed")).toHaveLength(2);
    expect(screen.getByTestId("crew-company-forms-group-old")).toBeTruthy();
    expect(screen.queryByTestId("crew-company-forms-group-unpermitted")).toBeNull();
    expect(screen.getByText("No saved declarations for this assignment.")).toBeTruthy();
    expect(document.body.textContent).toContain("03-Oct-2026");
    expect(document.body.textContent).not.toContain("before_joining");
    expect(fetch.mock.calls.every((call: any[]) => String(call[0]).includes("/api/v2/company-form-submissions/"))).toBe(true);
  });
  it("opens the exact row and reciprocal target with readable void identity, including inside a disabled fieldset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(data))); const open = vi.fn();
    mount(<fieldset disabled><CrewCompanyFormsHome crewUuid="crew" onOpenSubmission={open} /></fieldset>);
    fireEvent.click(await screen.findByTestId("crew-company-forms-open-void")); expect(open).toHaveBeenLastCalledWith("void");
    const link = screen.getByTestId("crew-company-forms-link-void-new");
    expect(link.textContent).toContain("Recorded Office User");
    fireEvent.click(link); expect(open).toHaveBeenLastCalledWith("new");
  });
  it("opens pinned renderer and returns to the same profile home", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(data)));
    mount(<CrewCompanyFormsHistory crewUuid="crew" />);
    fireEvent.click(await screen.findByTestId("crew-company-forms-open-aboard"));
    await waitFor(() => expect(screen.getByTestId("saved-form").textContent).toContain("aboard"));
    expect(screen.getByText("Profile metadata enabled")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-close-crew-company-form"));
    await waitFor(() => expect(screen.queryByTestId("saved-form")).toBeNull());
    expect(screen.getByTestId("crew-company-forms-home")).toBeTruthy();
  });
  it("reports a permission refusal, not an empty or missing-configuration success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ error: "forbidden" }, 403)));
    mount(<CrewCompanyFormsHome crewUuid="crew" />);
    expect(await screen.findByText("You do not have permission to view these company-form records.")).toBeTruthy();
    expect(screen.queryByText(/No permitted assignment/)).toBeNull();
  });
  it("does not read a home for an unsaved profile", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    mount(<CrewCompanyFormsHome />);
    expect(screen.getByText(/Select a crew member/)).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
  });
});