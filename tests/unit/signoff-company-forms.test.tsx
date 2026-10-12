import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignoffCompanyForms, verifySignoffAssignment } from "../../client/src/modules/vessel/components/SignoffCompanyForms";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/components/configured-form/companySubmissionContract", () => ({
  CompanySubmissionRenderer: ({ submissionUuid, requestContext }: {
    submissionUuid: string;
    requestContext?: { crewUuid?: string; planUuid?: string; vesselUuid?: string };
  }) => <div data-testid="persisted-renderer" data-context={JSON.stringify(requestContext)}>Persisted renderer {submissionUuid}</div>,
}));

const context = { planUuid: "plan-01", assignmentUuid: "assignment-01", crewUuid: "crew-01", vesselUuid: "vessel-01" };
const released = {
  formUuid: "form-01",
  formName: "Sign-off Declaration",
  formVersionUuid: "version-03",
  versionNo: "03",
  stageKey: "at_sign_off",
};
function response(body: unknown) { return { json: async () => body }; }

function fixture(submissions: unknown[] = [], checkOutcome = "COMPLETED") {
  request.mockImplementation(async (method: string, path: string) => {
    if (path === "/api/v2/vessel/planning/plan-01") {
      return response({ crewAssignUuid: context.assignmentUuid, crewUuid: context.crewUuid, vesselUuid: context.vesselUuid });
    }
    if (path.endsWith("/requirements")) return response({
      runs: [], requirements: [], outstandingEligible: true,
      stageChecks: {
        enforcementEnabled: true, completedAt: null, canRetry: false, failures: [],
        stages: [{
          stage_key: "at_sign_off", cycle_uuid: "cycle-signoff", deferred: checkOutcome === "DEFERRED",
          event_uuid: "event-signoff", outcome: checkOutcome, reason: null, recorded_at: "2026-10-01T00:00:00Z",
        }],
      },
    });
    if (path.includes("/eligible-forms?")) return response([released]);
    if (path.includes("/submissions") && method === "GET") return response({ submissions });
    if (path.includes("/submissions") && method === "POST") return response({ submissionUuid: "created-submission" });
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
}

function mount(props = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SignoffCompanyForms {...props} /></QueryClientProvider>);
}

afterEach(() => { request.mockReset(); });

describe("Planning at-sign-off company forms", () => {
  it("shows only at-sign-off declarations, including voided, without assignment IDs", async () => {
    fixture(["before_joining", "on_board", "at_sign_off"].map(stageKey => ({
      submissionUuid: stageKey, stageKey, formName: `Declaration ${stageKey}`, status: "voided",
      replacementHistory: [{ submissionUuid: "on_board", label: "Foreign-stage replacement" }],
    })));
    mount();
    await screen.findByText("Declaration at_sign_off · voided");
    expect(screen.queryByText("Declaration before_joining · voided")).toBeNull();
    expect(screen.queryByText("Declaration on_board · voided")).toBeNull();
    expect(screen.queryByText("Foreign-stage replacement")).toBeNull();
    expect(screen.queryByText(context.assignmentUuid)).toBeNull();
  });
  it("validates the exact incumbent link and rejects stale, archived, deleted, or signed-off rows", async () => {
    fixture();
    await expect(verifySignoffAssignment(context)).resolves.toMatchObject({ crewAssignUuid: context.assignmentUuid });
    expect(request).toHaveBeenCalledWith("GET", "/api/v2/vessel/planning/plan-01");
    const mismatches = [
      { crewAssignUuid: "different-assignment", crewUuid: context.crewUuid, vesselUuid: context.vesselUuid },
      { crewAssignUuid: context.assignmentUuid, crewUuid: "different-crew", vesselUuid: context.vesselUuid },
      { crewAssignUuid: context.assignmentUuid, crewUuid: context.crewUuid, vesselUuid: "different-vessel" },
      { crewAssignUuid: context.assignmentUuid, crewUuid: context.crewUuid, vesselUuid: context.vesselUuid, isDeleted: true },
      { crewAssignUuid: context.assignmentUuid, crewUuid: context.crewUuid, vesselUuid: context.vesselUuid, isArchived: true },
    ];
    for (const planning of mismatches) {
      request.mockResolvedValue(response(planning));
      await expect(verifySignoffAssignment(context)).rejects.toThrow("stale");
    }
    expect(request).toHaveBeenCalledTimes(6);
  });

  it("does not confuse a proposed planning date with an authoritative sign-off", async () => {
    request.mockResolvedValue(response({ crewAssignUuid: context.assignmentUuid,
      crewUuid: context.crewUuid, vesselUuid: context.vesselUuid, signOffDate: "2026-04-15" }));
    await expect(verifySignoffAssignment(context)).resolves.toMatchObject({signOffDate:"2026-04-15"});
  });

  it("requires manual released-version selection and passes full request context to the renderer", async () => {
    fixture();
    mount();
    const picker = await screen.findByTestId("select-signoff-form-version");
    await waitFor(() => expect(picker).toBeEnabled());
    expect(screen.getByTestId("button-start-signoff-form")).toBeDisabled();
    fireEvent.change(picker, { target: { value: released.formVersionUuid } });
    fireEvent.click(screen.getByTestId("button-start-signoff-form"));

    const renderer = await screen.findByTestId("persisted-renderer");
    expect(renderer).toHaveTextContent("created-submission");
    expect(renderer).toHaveAttribute("data-context", JSON.stringify({
      crewUuid: context.crewUuid,
      planUuid: context.planUuid,
      vesselUuid: context.vesselUuid,
    }));
    expect(request).toHaveBeenCalledWith(
      "POST",
      `/api/v2/company-form-submissions/subjects/crew_assignment/assignment-01/submissions?crewUuid=crew-01&planUuid=plan-01&vesselUuid=vessel-01`,
      { formUuid: released.formUuid, formVersionUuid: released.formVersionUuid },
    );
    expect(request.mock.calls.some((call) => call[0] === "GET" && call[1] ===
      `/api/v2/company-form-submissions/subjects/crew_assignment/assignment-01/submissions?crewUuid=crew-01&planUuid=plan-01&vesselUuid=vessel-01`)).toBe(true);
    expect(request.mock.calls.some((call) => call[1] ===
      `/api/v2/company-form-submissions/subjects/crew_assignment/assignment-01/eligible-forms?crewUuid=crew-01&planUuid=plan-01&vesselUuid=vessel-01&stageKey=at_sign_off`)).toBe(true);
  });

  it("keeps the manual sign-off picker closed while an enforced check is deferred", async () => {
    fixture([], "DEFERRED");
    mount();
    expect((await screen.findAllByText("Available once Relief Status is Planned or Confirmed.")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("select-signoff-form-version")).toBeDisabled();
    expect(screen.getByTestId("button-start-signoff-form")).toBeDisabled();
    expect(request.mock.calls.some((call) => call[0] === "POST")).toBe(false);
  });

  it("resumes one existing nonvoided at-sign-off declaration instead of creating a duplicate", async () => {
    fixture([{
      submissionUuid: "voided-replacement",
      formUuid: released.formUuid,
      stageKey: "at_sign_off",
      status: "voided",
    }, {
      submissionUuid: "existing",
      formUuid: released.formUuid,
      formVersionUuid: "older-pinned-version",
      stageKey: "at_sign_off",
      status: "in_progress",
    }]);
    mount();
    const picker = await screen.findByTestId("select-signoff-form-version");
    await waitFor(() => expect(picker).toBeEnabled());
    fireEvent.change(picker, { target: { value: released.formVersionUuid } });
    fireEvent.click(screen.getByTestId("button-start-signoff-form"));
    expect(await screen.findByTestId("persisted-renderer")).toHaveTextContent("existing");
    expect(request.mock.calls.some((call) => call[0] === "POST")).toBe(false);
  });

  it("does not infer an assignment when the exact planning link is absent", async () => {
    mount({ ...context, assignmentUuid: "" });
    expect(await screen.findByRole("alert")).toHaveTextContent("No exact onboard assignment");
    expect(request).not.toHaveBeenCalled();
  });
});