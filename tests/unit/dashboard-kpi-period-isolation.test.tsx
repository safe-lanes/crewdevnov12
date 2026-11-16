import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const seen = vi.hoisted(() => new Map<string, any>());
vi.mock("@/modules/dashboard/CrewRecruitmentRankChart", () => ({ CrewRecruitmentRankChart: (p: any) => { seen.set("recruitment", p); return null; } }));
vi.mock("@/modules/dashboard/CrewPromotionsRankChart", () => ({ CrewPromotionsRankChart: (p: any) => { seen.set("promotions", p); return null; } }));
vi.mock("@/modules/dashboard/CrewAppraisalsRankChart", () => ({ CrewAppraisalsRankChart: (p: any) => { seen.set("appraisals", p); return null; } }));
vi.mock("@/modules/dashboard/CrewPoolRankChart", () => ({ CrewPoolRankChart: (p: any) => { seen.set("pool", p); return null; } }));
vi.mock("@/modules/dashboard/DAAnalysisMetrics", () => ({ DAAnalysisMetrics: (p: any) => { seen.set("da", p); return null; } }));
vi.mock("@/modules/dashboard/CrewRetentionMetrics", () => ({ CrewRetentionMetrics: (p: any) => { seen.set("retention", p); return null; } }));
vi.mock("@/modules/dashboard/DashboardCard", () => ({ DashboardCard: (p: any) => <div>{p.renderContent?.("rank", null)}</div> }));
vi.mock("@/modules/dashboard/ManagementFilterBar", () => ({ ManagementFilterBar: (p: any) => <div>
  <button onClick={() => p.onPeriodChange({ mode: "year", year: new Date().getFullYear() })}>Apply same year</button>
  <button onClick={() => p.onPeriodChange({ mode: "date-range", dateFrom: new Date(2025, 0, 1), dateTo: new Date(2026, 11, 31) })}>Select official</button>
  <button onClick={() => p.onFiltersChange({ ...p.filters, ranks: ["Master"] })}>Select rank</button>
  <button onClick={p.onClear}>Clear</button>
</div> }));
import { DashboardPage } from "../../client/src/pages/DashboardPage";
import { useDashboardFiltersStore } from "../../client/src/stores/dashboardFiltersStore";
afterEach(() => { cleanup(); seen.clear(); useDashboardFiltersStore.getState().clearFilters(); });
describe("Retention default is isolated from the Dashboard shared period", () => {
  it("preserves every other card's default, explicit ranges and Clear; population filters do not change period intent", () => {
    render(<DashboardPage />);
    const assertShared = (period: any) => {
      for (const name of ["recruitment", "promotions", "appraisals", "pool", "da"]) {
        expect(seen.get(name).period).toEqual(period);
        expect(seen.get(name)).not.toHaveProperty("periodExplicitlySelected");
      }
    };
    const original = { mode: "year", year: new Date().getFullYear() };
    assertShared(original);
    expect(seen.get("retention").periodExplicitlySelected).toBe(false);
    fireEvent.click(screen.getByText("Select rank"));
    assertShared(original);
    expect(seen.get("retention").periodExplicitlySelected).toBe(false);
    fireEvent.click(screen.getByText("Apply same year"));
    assertShared(original);
    expect(seen.get("retention").periodExplicitlySelected).toBe(true);
    fireEvent.click(screen.getByText("Select official"));
    assertShared({ mode: "date-range", dateFrom: new Date(2025, 0, 1), dateTo: new Date(2026, 11, 31) });
    expect(seen.get("retention").periodExplicitlySelected).toBe(true);
    fireEvent.click(screen.getByText("Clear"));
    assertShared(original);
    expect(seen.get("retention").periodExplicitlySelected).toBe(false);
  });
});
