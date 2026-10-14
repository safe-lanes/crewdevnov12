import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnBoardStatusEditDialog_v2 } from "@/modules/vessel/components/OnBoardStatusEditDialog_v2";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ userType: "Office", permissions: [], canView: () => false, canEdit: () => false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useVesselLookup", () => ({ useVesselLookup: () => ({ getVesselName: () => "Test vessel" }) }));
vi.mock("@/modules/vessel/hooks/useVesselV2", () => ({
  useUpdatePlanningV2: () => ({ isPending: false }),
  useCreatePlanningV2: () => ({ isPending: false }),
  useVesselPlanningV2: () => ({ data: [] }),
}));
vi.mock("@/modules/vessel/components/SignoffCompanyForms", () => ({
  SignoffCompanyForms: () => <div data-testid="signoff-company-forms" role="alert">Missing permission: Crew Database — View</div>,
}));
afterEach(() => { cleanup(); request.mockReset(); requirementsResponse = completedRequirements; });

const response = (body: unknown) => ({ json: async () => body });
const completedRequirements = {
  runs: [],
  requirements: [],
  outstandingEligible: true,
  stageChecks: {
    enforcementEnabled: true,
    completedAt: "2026-10-01T00:00:00Z",
    canRetry: false,
    stages: [{
      stage_key: "at_sign_off",
      cycle_uuid: "signoff-cycle",
      deferred: false,
      event_uuid: "signoff-event",
      outcome: "COMPLETED",
      reason: null,
      recorded_at: "2026-10-01T00:00:00Z",
    }],
    failures: [],
  },
};
let requirementsResponse = completedRequirements;
const planningData = { planUuid: "test-plan", crewAssignUuid: "test-assignment",
  crewUuid: "test-crew", crewName: "Test seafarer", reliefStatus: "Confirmed" };

function setup() {
  request.mockImplementation(async (_method: string, path: string) => {
    if (path.endsWith("/requirements")) return response(requirementsResponse);
    throw new Error(`Unexpected request: ${path}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const changed = vi.fn();
  const ui = (open = true, data = planningData) => <QueryClientProvider client={client}>
    <TooltipProvider><OnBoardStatusEditDialog_v2 open={open} onOpenChange={changed}
      vesselUuid="test-vessel" rank="Master" rankId="R001" planningData={data} /></TooltipProvider>
  </QueryClientProvider>;
  const view = render(ui());
  return { ...view, ui, changed };
}

describe("On Board Status Sign-off forms popup", () => {
  it.each(["MISSING", "PENDING", "DEFERRED"] as const)("keeps the sign-off form launch visible but disabled for %s readiness", async (readiness) => {
    requirementsResponse = {
      ...completedRequirements,
      stageChecks: {
        ...completedRequirements.stageChecks,
        stages: readiness === "MISSING" ? [] : [{
          stage_key: "at_sign_off",
          cycle_uuid: "signoff-cycle",
          deferred: readiness === "DEFERRED",
          event_uuid: "signoff-event",
          outcome: readiness,
          reason: null,
          recorded_at: null,
        }],
      },
    };
    setup();
    const formsButton = await screen.findByRole("button", { name: "Sign-off forms" });
    expect(await screen.findByText("Available once Relief Status is Planned or Confirmed.")).toBeInTheDocument();
    expect(formsButton).toBeDisabled();
    expect(screen.getByTestId("button-submit-onboard")).toBeEnabled();
  });

  it("offers the top button without forms grants, opens a separate popup and returns", async () => {
    const { changed } = setup();
    const button = await screen.findByRole("button", { name: "Sign-off forms" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByTestId("signoff-company-forms")).toBeNull();
    const buttons = Array.from(button.closest('[role="dialog"]')!.querySelectorAll("button"));
    expect(buttons.indexOf(button)).toBeLessThan(buttons.indexOf(screen.getByTestId("button-submit-onboard")));
    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "At-sign-off Company Forms" })).toBeTruthy();
    expect(screen.queryByTestId("button-submit-onboard")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Crew Database — View");
    expect(screen.queryByRole("heading", { name: /test-assignment/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to On Board Status" }));
    expect(await screen.findByTestId("button-submit-onboard")).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });

  it("resets the forms popup after the parent closes and after switching assignments", async () => {
    const { rerender, ui } = setup();
    const firstButton = await screen.findByRole("button", { name: "Sign-off forms" });
    await waitFor(() => expect(firstButton).toBeEnabled());
    fireEvent.click(firstButton);
    await screen.findByTestId("signoff-company-forms");
    rerender(ui(false));
    rerender(ui(true));
    const secondButton = await screen.findByRole("button", { name: "Sign-off forms" });
    await waitFor(() => expect(secondButton).toBeEnabled());
    expect(secondButton).toBeTruthy();
    expect(screen.queryByTestId("signoff-company-forms")).toBeNull();
    fireEvent.click(secondButton);
    await screen.findByTestId("signoff-company-forms");
    rerender(ui(true, { ...planningData, crewAssignUuid: "other-assignment" }));
    const switchedButton = await screen.findByRole("button", { name: "Sign-off forms" });
    await waitFor(() => expect(switchedButton).toBeEnabled());
    expect(switchedButton).toBeTruthy();
    expect(screen.queryByTestId("signoff-company-forms")).toBeNull();
  });
});