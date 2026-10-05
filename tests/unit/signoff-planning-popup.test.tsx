import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnBoardStatusEditDialog_v2 } from "@/modules/vessel/components/OnBoardStatusEditDialog_v2";

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ userType: "Office", canView: () => false, canEdit: () => false }),
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
afterEach(cleanup);

const planningData = { planUuid: "test-plan", crewAssignUuid: "test-assignment",
  crewUuid: "test-crew", crewName: "Test seafarer", reliefStatus: "Confirmed" };

function setup() {
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
  it("offers the top button without forms grants, opens a separate popup and returns", async () => {
    const { changed } = setup();
    const button = await screen.findByRole("button", { name: "Sign-off forms" });
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
    fireEvent.click(await screen.findByRole("button", { name: "Sign-off forms" }));
    await screen.findByTestId("signoff-company-forms");
    rerender(ui(false));
    rerender(ui(true));
    expect(await screen.findByRole("button", { name: "Sign-off forms" })).toBeTruthy();
    expect(screen.queryByTestId("signoff-company-forms")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign-off forms" }));
    await screen.findByTestId("signoff-company-forms");
    rerender(ui(true, { ...planningData, crewAssignUuid: "other-assignment" }));
    expect(await screen.findByRole("button", { name: "Sign-off forms" })).toBeTruthy();
    expect(screen.queryByTestId("signoff-company-forms")).toBeNull();
  });
});