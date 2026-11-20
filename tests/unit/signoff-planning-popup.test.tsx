import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnBoardStatusEditDialog_v2 } from "@/modules/vessel/components/OnBoardStatusEditDialog_v2";

const request = vi.hoisted(() => vi.fn());
const updatePlanning = vi.hoisted(() => vi.fn(async () => ({})));
const permissions = vi.hoisted(() => ({ value: [] as Array<{menuName: string; canedit: boolean}> }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: request }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ userType: "Office", permissions: permissions.value, canView: () => false, canEdit: () => false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useVesselLookup", () => ({ useVesselLookup: () => ({ getVesselName: () => "Test vessel" }) }));
vi.mock("@/modules/vessel/hooks/useVesselV2", () => ({
  useUpdatePlanningV2: () => ({ isPending: false, mutateAsync: updatePlanning }),
  useCreatePlanningV2: () => ({ isPending: false }),
  useVesselPlanningV2: () => ({ data: [] }),
}));
vi.mock("@/modules/vessel/components/SignoffCompanyForms", () => ({
  SignoffCompanyForms: () => <div data-testid="signoff-company-forms" role="alert">Missing permission: Crew Database — View</div>,
}));
vi.mock("@/modules/vessel/api/vesselApiV2", () => ({
  vesselApiV2: { getVesselPlanning: vi.fn(async () => []) },
}));
afterEach(() => {
  cleanup(); request.mockReset(); updatePlanning.mockClear();
  permissions.value = []; requirementsResponse = completedRequirements;
});

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

describe("Defer relief disclosure", () => {
  function setupEligible() {
    permissions.value = [{ menuName: "Vessel", canedit: true }];
    return setup();
  }
  const toggle = () => screen.getByTestId("button-toggle-defer-relief");
  const reason = () => screen.getByLabelText(/Written reason/);
  const writes = () => request.mock.calls.filter(call => call[0] !== "GET");

  it("starts collapsed and expands without saving or deferring", () => {
    setupEligible();
    expect(toggle()).toHaveAttribute("type", "button");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    const panel = screen.getByTestId("defer-relief-action");
    expect(panel).not.toBeVisible();
    expect(toggle()).toHaveAttribute("aria-controls", panel.id);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();
    expect(reason()).toHaveAttribute("required");
    expect(reason()).toHaveAttribute("maxlength", "2000");
    expect(screen.getByTestId("button-defer-relief")).toBeDisabled();
    expect(writes()).toHaveLength(0);
    expect(updatePlanning).not.toHaveBeenCalled();
  });

  it("retains unsent text across collapse and reopening", () => {
    setupEligible();
    fireEvent.click(toggle());
    fireEvent.change(reason(), { target: { value: "Voyage extension" } });
    fireEvent.click(toggle());
    expect(screen.getByTestId("defer-relief-action")).not.toBeVisible();
    fireEvent.click(toggle());
    expect(reason()).toHaveValue("Voyage extension");
    expect(writes()).toHaveLength(0);
  });

  it("resets disclosure and reason on closing/reopening the popup", () => {
    const { rerender, ui } = setupEligible();
    fireEvent.click(toggle());
    fireEvent.change(reason(), { target: { value: "Old reason" } });
    rerender(ui(false));
    rerender(ui(true));
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle());
    expect(reason()).toHaveValue("");
  });

  it.each(["planUuid", "crewAssignUuid", "crewUuid"] as const)(
    "collapses when the %s changes", (key) => {
      const { rerender, ui } = setupEligible();
      fireEvent.click(toggle());
      rerender(ui(true, { ...planningData, [key]: `other-${key}` }));
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
    },
  );

  it.each([
    { planUuid: "" }, { crewAssignUuid: "" }, { crewName: "" }, { reliefStatus: "Deferred" },
  ])("keeps the action unavailable for ineligible planning data %j", (patch) => {
    const { rerender, ui } = setupEligible();
    rerender(ui(true, { ...planningData, ...patch }));
    expect(screen.queryByTestId("button-toggle-defer-relief")).toBeNull();
  });

  it("does not offer deferral without Vessel edit permission", () => {
    setup();
    expect(screen.queryByTestId("button-toggle-defer-relief")).toBeNull();
  });

  it("blocks empty reasons, collapse and repeat submission while recording", async () => {
    setupEligible();
    let finish!: () => void;
    request.mockImplementation(async (method: string, path: string) => {
      if (method === "POST") await new Promise<void>(resolve => { finish = resolve; });
      return response(completedRequirements);
    });
    fireEvent.click(toggle());
    fireEvent.change(reason(), { target: { value: "   " } });
    expect(screen.getByTestId("button-defer-relief")).toBeDisabled();
    fireEvent.change(reason(), { target: { value: " Voyage extension " } });
    fireEvent.click(screen.getByTestId("button-defer-relief"));
    expect(toggle()).toBeDisabled();
    expect(reason()).toBeDisabled();
    expect(screen.getByTestId("button-defer-relief")).toBeDisabled();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByTestId("button-defer-relief"));
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(writes()).toHaveLength(1);
    expect(request).toHaveBeenCalledWith("POST", "/api/v2/vessel/planning/test-plan/defer-relief", { reason: "Voyage extension" });
    finish();
    await waitFor(() => expect(screen.queryByTestId("button-toggle-defer-relief")).toBeNull());
    expect(updatePlanning).not.toHaveBeenCalled();
  });

  it("retains an error and reason for retry without closing the popup", async () => {
    const { changed } = setupEligible();
    request.mockImplementation(async (method: string) => {
      if (method === "POST") throw new Error("Deferral refused");
      return response(completedRequirements);
    });
    fireEvent.click(toggle());
    fireEvent.change(reason(), { target: { value: "Voyage extension" } });
    fireEvent.click(screen.getByTestId("button-defer-relief"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Deferral refused");
    expect(reason()).toHaveValue("Voyage extension");
    expect(toggle()).toBeEnabled();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(screen.getByRole("alert")).toHaveTextContent("Deferral refused");
  });

  it("keeps ordinary Save independent of the expanded blank reason", async () => {
    const { rerender, ui, changed } = setupEligible();
    rerender(ui(true, { ...planningData, contractPeriodMonths: 4 } as typeof planningData));
    fireEvent.click(toggle());
    fireEvent.click(screen.getByTestId("button-submit-onboard"));
    await waitFor(() => expect(updatePlanning).toHaveBeenCalledTimes(1));
    expect(writes()).toHaveLength(0);
    expect(changed).toHaveBeenCalledWith(false);
  });
});