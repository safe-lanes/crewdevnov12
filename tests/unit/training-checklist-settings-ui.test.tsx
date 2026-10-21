import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrainingCompliancePolicySetting, TrainingComplianceRolePermissionEditor } from "../../client/src/modules/vessel/components/TrainingComplianceAccessEditors";
import { AcceptedChecklistHistory } from "../../client/src/modules/vessel/components/AcceptedChecklistHistory";
import { apiRequest } from "../../client/src/lib/queryClient";
vi.mock("../../client/src/lib/queryClient", () => ({ apiRequest: vi.fn() }));
let client: QueryClient;
const json = (body: unknown) => new Response(JSON.stringify(body));
function mount(ui: React.ReactNode) { return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(apiRequest).mockReset();
});
afterEach(() => { cleanup(); client.clear(); });
describe("training checklist settings and saved evidence", () => {
  it("shows default-off tenant setting with its exact name and saves only the flag", async () => {
    vi.mocked(apiRequest).mockImplementation(async (method: string) => json({ blockExpiringDuringContract: method === "PUT" }));
    mount(<TrainingCompliancePolicySetting />);
    expect(await screen.findByText("Block mandatory courses expiring during contract")).toBeTruthy();
    const checkbox = await screen.findByTestId("training-block-expiring");
    await waitFor(() => expect(checkbox.getAttribute("data-state")).toBe("unchecked"));
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save policy" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/v2/admin/training-compliance/settings",
      { blockExpiringDuringContract: true }));
  });
  it("saves an independent default-off grant per exact parent role UUID", async () => {
    vi.mocked(apiRequest).mockImplementation(async (method: string) => json({ allowed: method === "PUT" }));
    mount(<TrainingComplianceRolePermissionEditor roleUuid="parent-role-uuid" />);
    const checkbox = await screen.findByTestId("training-compliance-permission-checkbox");
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByTestId("save-training-compliance-permission"));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("PUT",
      "/api/v2/admin/access-control/roles/parent-role-uuid/training-compliance", { allowed: true }));
  });
  it("failed setting request gives a plain sentence and Retry", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(Error("500: RAW SQL SECRET")).mockResolvedValue(json({ blockExpiringDuringContract: false }));
    mount(<TrainingCompliancePolicySetting />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("training-block-expiring")).toBeTruthy();
    expect(screen.queryByText(/RAW SQL SECRET/)).toBeNull();
  });
  it("shows frozen names, server actor/time, no-expiry, override reason and fingerprint without current-data lookup", async () => {
    vi.mocked(apiRequest).mockResolvedValue(json([{
      snapshotUuid: "snapshot", recordedAt: "2026-10-21T09:00:00Z", fingerprint: "frozen-hash",
      actor: { masterUserId: 42, roleName: "Crew manager" },
      evidence: { header: { crewName: "TEST ONLY Seafarer", vesselName: "TEST ONLY Vessel", contractRankLabel: "Chief Officer" },
        blockExpiringDuringContract: false, check: { calculationVersion: "1.2.0", joiningDate: "2026-10-01", contractEnd: null,
          matrixRevision: "R0", courses: [{ name: "Fire fighting", state: "Valid, no expiry", isEquivalent: true,
            chosenCertificate: { name: "Equivalent course", number: "CERT-FROZEN", issued: "2025-01-01", expiry: null } }] },
        overrides: { training: { reason: "Fixture review exception" }, companyForms: null } },
    }]));
    mount(<AcceptedChecklistHistory open planUuid="plan-uuid" onOpenChange={() => {}} />);
    expect(await screen.findByText("TEST ONLY Seafarer")).toBeTruthy();
    expect(screen.getByText(/21-Oct-2026 09:00 UTC by Crew manager · user 42/)).toBeTruthy();
    expect(screen.getByText("Chief Officer")).toBeTruthy();
    expect(screen.getByText(/CERT-FROZEN.*No expiry/)).toBeTruthy();
    expect(screen.getByText(/Fixture review exception/)).toBeTruthy();
    expect(screen.getByText("frozen-hash")).toBeTruthy();
    expect(vi.mocked(apiRequest).mock.calls.every(call => String(call[1]).endsWith("/checklist-history"))).toBe(true);
  });
});
