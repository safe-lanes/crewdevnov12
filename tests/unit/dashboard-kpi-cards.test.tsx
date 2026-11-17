import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("@/modules/admin/api/adminApiV2", () => ({ adminApiV2: { getCompanyRanks: async () => [
  { rank: "Master", seniorOfficer: true, officer: true }, { rank: "AB", rating: true },
] } }));
vi.mock("@/hooks/v2/useMasterDataV2", () => ({ useNationalitiesV2: () => ({ data: [] }) }));
vi.mock("@/modules/dashboard/useDrilldownParam", () => ({ useDrilldownParam: () => ({ state: {}, isOpen: false, open: vi.fn(), close: vi.fn() }) }));
vi.mock("@/modules/dashboard/CrewRetentionDrilldownDialog", () => ({ CrewRetentionDrilldownDialog: (props: any) =>
  <div data-testid="retention-drilldown-range">{JSON.stringify(props.range)}</div> }));
vi.mock("@/modules/dashboard/DAViolationsDrilldownDialog", () => ({ DAViolationsDrilldownDialog: () => null }));
vi.mock("@/modules/dashboard/useDashboardKpis", async importOriginal => ({
  ...await importOriginal<any>(), useDashboardToday: () => new Date(2026, 10, 16),
}));
import { CrewRetentionMetrics } from "../../client/src/modules/dashboard/CrewRetentionMetrics";
import { DAAnalysisMetrics } from "../../client/src/modules/dashboard/DAAnalysisMetrics";
import { useDashboardFiltersStore } from "../../client/src/stores/dashboardFiltersStore";
const current = { mode: "year" as const, year: 2026 };
const values = () => ({
  year: 2026, scope: "company", kpis: [
    { code: "retention", direction: "minimum", unit: "percentage", components: [
      { code: "senior_officers", value: "90" }, { code: "officers", value: "95" }, { code: "ratings", value: "90" }] },
    { code: "alcohol_violations", direction: "maximum", unit: "count", components: [{ code: "overall", value: "0" }] },
    { code: "drug_violations", direction: "maximum", unit: "count", components: [{ code: "overall", value: "2" }] },
  ],
});
let unavailable = false, fail = false, missing = false;
let client: QueryClient;
beforeEach(() => {
  unavailable = fail = missing = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input);
    if (url.includes("dashboard-kpis")) {
      if (fail) return new Response("failure", { status: 500 });
      const data = values();
      if (missing) data.kpis.forEach(k => k.components.forEach(c => { (c as any).value = null; }));
      return new Response(JSON.stringify(data));
    }
    if (url.includes("training-retention/retention"))
      return new Response(JSON.stringify({ S: 1, UT: 0, BT: 0, AE: unavailable ? 0 : 10, retentionRate: unavailable ? null : 90 }));
    return new Response(JSON.stringify({ alcoholViolations: 1, drugViolations: 2 }));
  });
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });
const wrap = (children: React.ReactNode) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const cards = (props: Record<string, any> = {}) => <>
  <CrewRetentionMetrics period={current} periodExplicitlySelected={false} {...props} />
  <DAAnalysisMetrics period={current} {...props} />
</>;
describe("Dashboard KPI card display", () => {
  it("shows one rolling Retention card and current annual D&A, with separate requests and shared KPI read", async () => {
    render(wrap(cards()));
    await screen.findByText("Within KPI so far");
    expect(screen.getByText("Rolling 2 years: 17 Nov 2024 – 16 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2026 – 16 Nov 2026 (year to date)")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-retention-senior")).toHaveTextContent("On track");
    expect(screen.getByTestId("kpi-retention-officer")).toHaveTextContent("Off track");
    expect(screen.getAllByText("On track")[0]).toHaveAttribute("title",
      "Forecast based on the last 24 months. The official result uses 1 Jan 2025 to 31 Dec 2026.");
    expect(screen.getAllByText("Off track")[0]).toHaveAttribute("title",
      "Forecast based on the last 24 months. The official result uses 1 Jan 2025 to 31 Dec 2026.");
    expect(screen.getAllByTestId("metrics-crew-retention")).toHaveLength(1);
    expect(screen.getByTestId("text-retention-senior")).toHaveClass("text-emerald-600");
    expect(screen.getByTestId("text-retention-officer")).toHaveClass("text-red-600");
    expect(screen.getByTestId("text-da-alcohol-violations")).toHaveClass("text-red-600");
    expect(screen.getByTestId("text-da-drug-violations")).toHaveClass("text-gray-900");
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter(u => u.includes("dashboard-kpis"))).toHaveLength(1);
    expect(urls.some(u => u.includes("retention?periodFrom=2024-11-17&periodTo=2026-11-16"))).toBe(true);
    expect(urls.some(u => u.includes("violations?periodFrom=2026-01-01&periodTo=2026-12-31"))).toBe(true);
    expect(screen.getByTestId("retention-drilldown-range")).toHaveTextContent('"from":"2024-11-17"');
  });
  it.each(["ranks", "crewPools", "manningAgents", "nationalities"])("%s selection suppresses all status words and colours", async filter => {
    render(wrap(cards({ [filter]: filter === "ranks" ? ["Master", "AB"] : ["Selected"] })));
    await screen.findByTestId("kpi-da-drug");
    expect(screen.queryByText("Within KPI so far")).not.toBeInTheDocument();
    expect(screen.queryByText("Met")).not.toBeInTheDocument();
    expect(screen.queryByText("Missed")).not.toBeInTheDocument();
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
    expect(screen.queryByText("Off track")).not.toBeInTheDocument();
    expect(screen.getAllByText("Company-wide target — shown for reference while filters are applied.")).toHaveLength(2);
    expect(screen.getByTestId("text-da-alcohol-violations")).toHaveClass("text-gray-900");
    expect(screen.getByTestId("text-retention-senior")).toHaveClass("text-gray-900");
  });
  it("explicit current-year selection and manual rolling dates are grey reference on Retention", async () => {
    const view = render(wrap(cards({ periodExplicitlySelected: true })));
    await screen.findByTestId("kpi-retention-senior");
    expect(screen.getByTestId("kpi-retention-senior").firstElementChild).toHaveClass("text-slate-400");
    expect(screen.getByTestId("kpi-retention-senior")).not.toHaveTextContent("Met");
    view.rerender(wrap(cards({ periodExplicitlySelected: true, period: { mode: "date-range", dateFrom: new Date(2024, 10, 17), dateTo: new Date(2026, 10, 16) } })));
    await waitFor(() => expect(screen.getAllByText("17 Nov 2024 – 16 Nov 2026")).toHaveLength(2));
    expect(screen.getByTestId("kpi-retention-senior").firstElementChild).toHaveClass("text-slate-400");
    expect(screen.queryByText("Within KPI so far")).not.toBeInTheDocument();
  });
  it("official two-year selection compares Retention but not D&A", async () => {
    render(wrap(cards({ periodExplicitlySelected: true, period: { mode: "date-range", dateFrom: new Date(2025, 0, 1), dateTo: new Date(2026, 11, 31) } })));
    await screen.findByTestId("kpi-retention-senior");
    expect(screen.getByTestId("kpi-retention-senior")).toHaveTextContent("Met");
    expect(screen.getByTestId("kpi-retention-officer")).toHaveTextContent("Missed");
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
    expect(screen.queryByText("Off track")).not.toBeInTheDocument();
    expect(screen.getByTestId("metrics-crew-retention")).toHaveTextContent("KPI (2026)");
    expect(screen.getByTestId("kpi-da-drug").firstElementChild).toHaveClass("text-slate-400");
    expect(screen.getByTestId("kpi-da-drug")).not.toHaveTextContent("Within KPI so far");
  });
  it("completed D&A year keeps its full dates and final results, never a year-to-date label", async () => {
    render(wrap(<DAAnalysisMetrics period={{ mode: "year", year: 2025 }} />));
    await screen.findByTestId("kpi-da-drug");
    expect(screen.getByText("1 Jan 2025 – 31 Dec 2025")).toBeInTheDocument();
    expect(screen.queryByText(/year to date/)).not.toBeInTheDocument();
    expect(screen.getByTestId("kpi-da-drug")).toHaveTextContent("Met");
    expect(screen.getByTestId("kpi-da-alcohol")).toHaveTextContent("Missed");
    expect(screen.getByTestId("text-da-drug-violations")).toHaveClass("text-emerald-600");
  });
  it("unavailable Retention preserves N/A without status, but still shows its saved KPI", async () => {
    unavailable = true;
    render(wrap(cards()));
    await screen.findByTestId("kpi-retention-senior");
    await waitFor(() => expect(screen.getByTestId("text-retention-senior")).toHaveTextContent("N/A"));
    expect(screen.getByTestId("kpi-retention-senior")).toHaveTextContent("KPI: At least 90%");
    expect(screen.getByTestId("kpi-retention-senior")).not.toHaveTextContent("Met");
  });
  it("no KPI produces no KPI lines, year caption or status", async () => {
    missing = true;
    render(wrap(cards()));
    await screen.findByTestId("text-retention-senior");
    await waitFor(() => expect(screen.getByTestId("text-da-drug-violations")).toHaveTextContent("2"));
    expect(screen.queryByTestId("kpi-retention-senior")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kpi-da-drug")).not.toBeInTheDocument();
    expect(screen.queryByText("KPI (2026)")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-retention-senior")).toHaveClass("text-gray-900");
  });
  it("KPI failure leaves actuals visible, announces failure and retries successfully", async () => {
    fail = true;
    render(wrap(cards()));
    await screen.findByTestId("error-dashboard-kpis-retention");
    expect(screen.getByTestId("text-retention-senior")).toHaveTextContent("90.0%");
    expect(screen.getByTestId("text-da-drug-violations")).toHaveTextContent("2");
    expect(screen.queryByTestId("kpi-retention-senior")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getAllByText("Retry")[0]);
    await screen.findByTestId("kpi-retention-senior");
    expect(screen.queryByTestId("error-dashboard-kpis-retention")).not.toBeInTheDocument();
  });
  it("Clear restores selection intent without changing the shared default, even after an equal explicit year", () => {
    const store = useDashboardFiltersStore;
    store.getState().clearFilters();
    const original = store.getState().period;
    expect(store.getState().periodExplicitlySelected).toBe(false);
    store.getState().setFilters({ ...store.getState().filters, ranks: ["Master"] });
    expect(store.getState().periodExplicitlySelected).toBe(false);
    store.getState().setPeriod({ ...original });
    expect(store.getState().period).toEqual(original);
    expect(store.getState().periodExplicitlySelected).toBe(true);
    store.getState().clearFilters();
    expect(store.getState().period).toEqual(original);
    expect(store.getState().periodExplicitlySelected).toBe(false);
    expect(store.getState().filters.ranks).toEqual([]);
  });
});
