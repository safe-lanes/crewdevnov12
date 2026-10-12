import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssignmentFormRequirements } from "../../client/src/modules/crew-pool/components/AssignmentFormRequirements";
import { AssignmentDimensionInspector } from "../../client/src/modules/crew-pool/components/AssignmentDimensionInspector";

const state = vi.hoisted(() => ({ permissions: [] as any[], response: {} as any, post: vi.fn() }));
vi.mock("../../client/src/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ permissions: state.permissions, userId: "test-actor", roleId: "test-role",
    canView: () => true /* existing unknown-menu default must not expose authoring facts */ }),
}));
vi.mock("../../client/src/lib/queryClient", () => ({
  apiRequest: async (method: string, path: string, body: object) => {
    if (method === "POST") { state.post(path, body); return { json: async () => ({ submissionUuid: "new-form" }) }; }
    return { json: async () => state.response };
  },
}));
const wrap = (node: React.ReactNode) => <QueryClientProvider client={new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})}>{node}</QueryClientProvider>;
afterEach(() => { cleanup(); state.permissions = []; state.post.mockClear(); });

describe("Company Form operational requirements presentation", () => {
  it("does not infer authoring rights from unknown-menu allow and preserves hook order when grants load", async () => {
    state.response = { dimensions: [{ key: "rank", label: "Rank", status: "resolved", labels: ["Pumpman"],
      values: ["internal-rank-uuid"], source: { table: "crew_assignment_rule_context" } }] };
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={query}><AssignmentDimensionInspector subjectRef="subject" /></QueryClientProvider>);
    expect(screen.queryByText("Form rule facts")).toBeNull();
    state.permissions = [{ menuName: "Forms", canview: true }];
    view.rerender(<QueryClientProvider client={query}><AssignmentDimensionInspector subjectRef="subject" /></QueryClientProvider>);
    fireEvent.click(screen.getByText("Form rule facts"));
    await screen.findByText("Pumpman");
    expect(view.container.textContent).not.toContain("internal-rank-uuid");
    expect(view.container.textContent).not.toContain("crew_assignment_rule_context");
    expect(view.container.textContent).not.toContain("Kind");
  });
  it("shows missing stage checks as information rather than hiding manual readiness", async () => {
    state.response = { runs: [], requirements: [], outstandingEligible: true };
    const view = render(wrap(<AssignmentFormRequirements subjectRef="subject" stageKey="on_board" canStartRequired onOpenSubmission={vi.fn()} />));
    await screen.findByText(/No legacy requirement check is recorded/);
    expect(view.container.textContent).not.toContain("unavailable");
  });
  it("starts an outstanding pin from its requirement and opens the returned form", async () => {
    state.response = { runs: [{ stage_key: "before_joining", outcome: "COMPLETED" }], outstandingEligible: true,
      stageChecks: { enforcementEnabled: true, completedAt: "2026-10-01T00:00:00Z", canRetry: false, failures: [],
        stages: [{ stage_key: "before_joining", cycle_uuid: "cycle", deferred: false, event_uuid: "event",
          outcome: "COMPLETED", reason: null, recorded_at: "2026-10-01T00:00:00Z" }] },
      requirements: [{ requirement_uuid: "requirement", form_name: "Safety form", stage_key: "before_joining",
        status: "OUTSTANDING", mandatory: true, history: [], current_submission_uuid: null }] };
    const open = vi.fn();
    render(wrap(<AssignmentFormRequirements subjectRef="subject" canStartRequired onOpenSubmission={open} />));
    fireEvent.click(await screen.findByText("Start required form"));
    await waitFor(() => expect(open).toHaveBeenCalledWith("new-form"));
    expect(state.post).toHaveBeenCalledWith(expect.stringContaining("/requirements/requirement/start"), {});
  });
  it.each([
    { readiness: "missing", stages: [] },
    { readiness: "pending", stages: [{ stage_key: "before_joining", cycle_uuid: "cycle", deferred: false, event_uuid: "event", outcome: "PENDING", reason: "Check pending", recorded_at: null }] },
    { readiness: "deferred", stages: [{ stage_key: "before_joining", cycle_uuid: "cycle", deferred: true, event_uuid: "event", outcome: "DEFERRED", reason: "Relief deferred", recorded_at: null }] },
  ])("keeps required form start disabled when enforced readiness is $readiness", async ({ stages }) => {
    state.response = {
      runs: [], outstandingEligible: true,
      stageChecks: { enforcementEnabled: true, completedAt: null, canRetry: false, failures: [], stages },
      requirements: [{ requirement_uuid: "blocked-requirement", form_name: "Safety form", stage_key: "before_joining",
        status: "OUTSTANDING", mandatory: true, history: [], current_submission_uuid: null }],
    };
    render(wrap(<AssignmentFormRequirements subjectRef="subject" canStartRequired onOpenSubmission={vi.fn()} />));
    const startButton = await screen.findByText("Start required form");
    expect(startButton).toBeDisabled();
    fireEvent.click(startButton);
    expect(state.post).not.toHaveBeenCalled();
  });
  it("renders an actionable safe explanation for the Fill in reason and retries only the recorded stage check", async () => {
    state.response = {
      runs: [], requirements: [], outstandingEligible: true,
      stageChecks: {
        enforcementEnabled: true, completedAt: null, canRetry: true,
        stages: [{ stage_key: "before_joining", cycle_uuid: "cycle-fill-in", deferred: false,
          event_uuid: "retryable-event", outcome: "PENDING", reason: "Fill in check pending", recorded_at: null }],
        failures: [{ stage_key: "before_joining", evidence: { reason: "Fill in is required before joining", formUuid: "private-form-id" } }],
      },
    };
    const view = render(wrap(<AssignmentFormRequirements subjectRef="subject" stageKey="before_joining" />));
    expect(await screen.findByText("A required pre-joining response is missing. Complete the requested information, then retry the stage check.")).toBeInTheDocument();
    expect(view.container.textContent).not.toContain("private-form-id");
    expect(view.container.textContent).not.toContain("Server reason");
    expect(view.container.textContent).not.toContain("Fill in is required before joining");
    expect(view.container.textContent).not.toContain("retryable-event");
    fireEvent.click(screen.getByRole("button", { name: "Retry check" }));
    await waitFor(() => expect(state.post).toHaveBeenCalledWith(
      expect.stringContaining("/checks/retryable-event/retry"),
      {},
    ));
    expect(state.post.mock.calls.every(([path]) =>
      String(path).includes("/checks/") && !String(path).includes("/authoring/"),
    )).toBe(true);
  });
  it("shows earlier manual conflicts without linking or auto-voiding them", async () => {
    state.response = { runs: [], outstandingEligible: true, requirements: [{ requirement_uuid: "required",
      form_name: "Safety form", stage_key: "at_signoff", status: "OUTSTANDING", mandatory: true,
      existing_form: { submissionUuid: "manual-form", origin: "MANUAL", status: "in_progress" } }] };
    const open = vi.fn();
    render(wrap(<AssignmentFormRequirements subjectRef="subject" canStartRequired onOpenSubmission={open} />));
    await screen.findByText("Manual form conflict");
    expect(screen.queryByText("Start required form")).toBeNull();
    fireEvent.click(screen.getByText("Open manual form"));
    expect(open).toHaveBeenCalledWith("manual-form"); expect(state.post).not.toHaveBeenCalled();
  });
});
