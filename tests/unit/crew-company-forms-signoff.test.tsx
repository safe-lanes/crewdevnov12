import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrewCompanyFormsHome } from "../../client/src/modules/crew-pool/components/CrewCompanyFormsHome";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const submission = (submissionUuid: string, stageKey = "at_sign_off", status = "in_progress") => ({
  submissionUuid,
  subjectType: "crew_assignment",
  subjectRef: "assign / 7",
  formUuid: "form-1",
  formVersionUuid: "version-1",
  stageKey,
  stageLabel: "At sign-off",
  formName: "Departure declaration",
  versionNo: "04",
  status,
  canEdit: true,
  canVoid: false,
  createdAt: "2026-10-03",
  completedAt: null,
  voidedAt: null,
  voidedByUuid: null,
  voidedByName: null,
  voidReason: null,
  voidedPreviousStatus: null,
  replacedBySubmissionUuid: null,
  replacesSubmissionUuid: null,
  systemSnapshotAt: null,
  systemSnapshotEvent: null,
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <CrewCompanyFormsHome crewUuid="crew / 2" onOpenSubmission={openSubmission} />
    </QueryClientProvider>,
  );
}

const openSubmission = vi.fn();

describe("G3 office sign-off creation and unfinished indicators", () => {
  it("offers the picker only for server-provided at-sign-off startable stage and keeps exact subject context", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/home/")) {
        return response({
          groups: [
            {
              subjectRef: "assign / 7", groupId: "eligible", totalCount: 0, submissions: [],
              startableStages: ["at_sign_off"],
            },
            {
              subjectRef: "other-assignment", groupId: "ineligible", totalCount: 0, submissions: [],
              startableStages: ["on_board"],
            },
          ],
        });
      }
      if (url.includes("/eligible-forms")) {
        expect(url).toContain("/subjects/crew_assignment/assign%20%2F%207/eligible-forms?stageKey=at_sign_off&crewUuid=crew%20%2F%202");
        return response({ forms: [{ formUuid: "form-1", formVersionUuid: "version-1", formName: "Departure declaration", versionNo: "04" }] });
      }
      if (url.includes("/submissions?") && init?.method === "POST") {
        return response({ submissionUuid: "created-submission" });
      }
      if (url.includes("/submissions?")) return response({ submissions: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    openSubmission.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    mount();

    await screen.findByTestId("crew-company-forms-group-assign / 7");
    expect(screen.getByTestId("crew-company-forms-signoff-picker-assign / 7")).toBeTruthy();
    expect(screen.queryByTestId("crew-company-forms-signoff-picker-other-assignment")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose a form" }));
    await screen.findByRole("option", { name: /Departure declaration/ });
    fireEvent.change(screen.getByLabelText("Eligible sign-off form"), { target: { value: "form-1:version-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Start or resume" }));

    await waitFor(() => expect(openSubmission).toHaveBeenCalledWith("created-submission"));
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes("/subjects/crew_assignment/assign%20%2F%207/eligible-forms?stageKey=at_sign_off&crewUuid=crew%20%2F%202"))).toBe(true);
    expect(urls.some((url) => url.includes("/subjects/crew_assignment/assign%20%2F%207/submissions?crewUuid=crew%20%2F%202"))).toBe(true);
    const post = fetchMock.mock.calls.find(([input, init]) =>
      String(input).includes("/submissions?") && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({ formUuid: "form-1", formVersionUuid: "version-1" });
  });

  it("re-fetches subject history and resumes a nonvoided form rather than starting another", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/home/")) {
        return response({
          groups: [{
            subjectRef: "assignment", groupId: "group", totalCount: 1, submissions: [],
            startableStages: ["at_sign_off"],
          }],
        });
      }
      if (url.includes("/eligible-forms")) {
        return response({ forms: [{ formUuid: "form-1", formVersionUuid: "new-release", formName: "Departure declaration" }] });
      }
      if (url.includes("/submissions?")) return response({ submissions: [submission("existing-submission", "on_board")] });
      throw new Error(`Unexpected request: ${url}`);
    });
    openSubmission.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await screen.findByTestId("crew-company-forms-group-assignment");
    fireEvent.click(screen.getByRole("button", { name: "Choose a form" }));
    await screen.findByRole("option", { name: /Departure declaration/ });
    fireEvent.change(screen.getByLabelText("Eligible sign-off form"), { target: { value: "form-1:new-release" } });
    fireEvent.click(screen.getByRole("button", { name: "Start or resume" }));

    await waitFor(() => expect(openSubmission).toHaveBeenCalledWith("existing-submission"));
    expect(fetchMock.mock.calls.some(([input, init]) =>
      String(input).includes("/submissions?") && (init as RequestInit | undefined)?.method === "POST",
    )).toBe(false);
  });

  it("counts only authorized unfinished-stage in-progress declarations and links to the exact row", async () => {
    const fetchMock = vi.fn(async () => response({
      groups: [
        {
          subjectRef: "signed-off", groupId: "signed", totalCount: 3,
          unfinishedStageKeys: ["at_sign_off"],
          submissions: [
            submission("unfinished-one"),
            submission("finished", "at_sign_off", "completed"),
            submission("voided", "at_sign_off", "voided"),
          ],
        },
        { subjectRef: "cancelled", groupId: "cancelled", totalCount: 1, submissions: [submission("cancelled-work")] },
      ],
    }));
    openSubmission.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await screen.findByTestId("crew-company-forms-group-signed-off");
    expect(screen.getByTestId("crew-company-forms-unfinished-signed-off").textContent).toContain("1 unfinished sign-off declaration");
    expect(screen.getByTestId("crew-company-forms-unfinished-submission-unfinished-one")).toBeTruthy();
    expect(screen.queryByTestId("crew-company-forms-unfinished-submission-finished")).toBeNull();
    expect(screen.queryByTestId("crew-company-forms-unfinished-cancelled")).toBeNull();
    fireEvent.click(screen.getByTestId("crew-company-forms-unfinished-open-unfinished-one"));
    expect(openSubmission).toHaveBeenCalledWith("unfinished-one");
  });

  it("surfaces explicit permission failures from eligible-form requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/home/")) {
        return response({ groups: [{ subjectRef: "assignment", groupId: "group", totalCount: 0, submissions: [], startableStages: ["at_sign_off"] }] });
      }
      return response({ error: "forbidden" }, 403);
    }));
    mount();
    await screen.findByTestId("crew-company-forms-group-assignment");
    fireEvent.click(screen.getByRole("button", { name: "Choose a form" }));
    expect(await screen.findByText("You do not have permission to view eligible sign-off forms.")).toBeTruthy();
  });
});