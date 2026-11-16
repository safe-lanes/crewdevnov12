import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import KpiSettingsPage from "../../client/src/modules/admin/KpiSettingsPage";
import type { KpiDefinition, KpiTargetPanel } from "../../shared/v2/admin/kpiTargets";
const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: transport.request }));
const kpi: KpiDefinition = { kpiUuid: "definition", code: "retention", label: "Retention Rate",
  menuGroup: "Training & Retention", unit: "percentage", direction: "minimum",
  calculationKey: "crew_retention", calculationVersion: "1", periodBasis: "annual_percentage",
  components: [{ componentUuid: "senior", code: "senior_officers", label: "Senior Officers" },
    { componentUuid: "officers", code: "officers", label: "Officers" },
    { componentUuid: "ratings", code: "ratings", label: "Ratings" }] };
let panel: KpiTargetPanel;
beforeEach(() => {
  panel = { kpi, year: new Date().getFullYear(), revision: 0,
    values: { senior: null, officers: null, ratings: null }, lastChanged: null, canSetTargets: true };
  transport.request.mockReset();
  transport.request.mockImplementation(async (method: string, url: string, body?: any) => {
    if (url === "/api/v2/admin/kpis") return { json: async () => ({ kpis: [kpi], canSetTargets: panel.canSetTargets }) };
    if (method === "PUT") panel = { ...panel, values: body.values, revision: 1,
      lastChanged: { name: "Frozen Editor", recordedAt: "2026-11-16T14:00:00Z" } };
    return { json: async () => panel };
  });
});
afterEach(cleanup);
async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><KpiSettingsPage /></QueryClientProvider>);
  fireEvent.click(await screen.findByTestId("tree-kpi-retention"));
  await screen.findByTestId("input-kpi-target-senior_officers");
}
describe("KPI target editor", () => {
  it("shows exactly three empty retention inputs and no invented last-change line", async () => {
    await open();
    expect(screen.getByTestId("input-kpi-target-senior_officers")).toHaveValue("");
    expect(screen.getByTestId("input-kpi-target-officers")).toHaveValue("");
    expect(screen.getByTestId("input-kpi-target-ratings")).toHaveValue("");
    expect(screen.queryByTestId("text-kpi-last-changed")).toBeNull();
  });
  it("saves zero as an exact value, leaves blanks null and refreshes frozen audit metadata", async () => {
    await open();
    fireEvent.click(screen.getByTestId("button-kpi-edit"));
    fireEvent.change(screen.getByTestId("input-kpi-target-senior_officers"), { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("button-kpi-save"));
    await screen.findByText("Frozen Editor");
    expect(transport.request).toHaveBeenCalledWith("PUT", expect.any(String), {
      revision: 0, values: { senior: "0", officers: null, ratings: null },
    });
    expect(screen.getByTestId("input-kpi-target-senior_officers")).toHaveValue("0");
  });
  it("clears a saved value and retains the last-change summary", async () => {
    panel.values.senior = "94";
    await open();
    fireEvent.click(screen.getByTestId("button-kpi-edit"));
    fireEvent.change(screen.getByTestId("input-kpi-target-senior_officers"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-kpi-save"));
    await screen.findByText("Frozen Editor");
    expect(screen.getByTestId("input-kpi-target-senior_officers")).toHaveValue("");
  });
  it("shows audit metadata to a reader without target-setting or Access Control authority", async () => {
    panel.canSetTargets = false;
    panel.lastChanged = { name: "Original Name", recordedAt: "2026-11-16T14:00:00Z" };
    await open();
    expect(screen.getByTestId("text-kpi-last-changed")).toHaveTextContent("Original Name");
    expect(screen.queryByTestId("button-kpi-edit")).toBeNull();
  });
  it("keeps edits after a failed save and shows a plain sentence, not raw server output", async () => {
    await open();
    fireEvent.click(screen.getByTestId("button-kpi-edit"));
    fireEvent.change(screen.getByTestId("input-kpi-target-senior_officers"), { target: { value: "91" } });
    transport.request.mockRejectedValueOnce(new Error('500: {"error":"raw_database_error"}'));
    fireEvent.click(screen.getByTestId("button-kpi-save"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByTestId("input-kpi-target-senior_officers")).toHaveValue("91");
    expect(screen.queryByText(/raw_database_error/)).toBeNull();
  });
});
