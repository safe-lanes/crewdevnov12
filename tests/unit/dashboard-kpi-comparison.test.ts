import { describe, expect, it } from "vitest";
import {
  dashboardRange, rollingRetentionRange, retentionComparisonPeriod, daComparisonPeriod,
  kpiYearForRange, rangeLabel, kpiStatus, meetsKpi, kpiLine,
} from "../../client/src/modules/dashboard/kpiComparison";

const today = new Date(2026, 10, 16);
const current = { from: "2026-01-01", to: "2026-12-31" };
const completed = { from: "2025-01-01", to: "2025-12-31" };
const official = { from: "2025-01-01", to: "2026-12-31" };
describe("Dashboard KPI period and comparison rules", () => {
  it("uses an inclusive rolling default ending today and its end-year KPI", () => {
    const rolling = rollingRetentionRange(today);
    expect(rolling).toEqual({ from: "2024-11-17", to: "2026-11-16" });
    expect(rangeLabel(rolling)).toBe("17 Nov 2024 – 16 Nov 2026");
    expect(kpiYearForRange(rolling)).toBe(2026);
    expect(retentionComparisonPeriod(rolling, false)).toBe("final");
    expect(kpiStatus(95, "90", "minimum", "final", false)).toEqual({ status: "Met", tone: "met" });
    expect(kpiStatus(89.9, "90", "minimum", "final", false)).toEqual({ status: "Missed", tone: "missed" });
  });
  it("handles leap-day clamping and month ends without a UTC date shift", () => {
    expect(rollingRetentionRange(new Date(2024, 1, 29))).toEqual({ from: "2022-03-01", to: "2024-02-29" });
    expect(rollingRetentionRange(new Date(2026, 2, 31))).toEqual({ from: "2024-04-01", to: "2026-03-31" });
    expect(rollingRetentionRange(new Date(2026, 10, 17)).from).toBe("2024-11-18");
  });
  it("compares official two whole calendar years using the end year", () => {
    expect(retentionComparisonPeriod(official, true)).toBe("final");
    expect(kpiYearForRange(official)).toBe(2026);
    expect(rangeLabel(official)).toBe("1 Jan 2025 – 31 Dec 2026");
    expect(retentionComparisonPeriod({ from: "2023-01-01", to: "2024-12-31" }, true)).toBe("final");
    expect(kpiStatus(90, "90", "minimum", "final", false).status).toBe("Met");
    expect(kpiStatus(89, "90", "minimum", "final", false).status).toBe("Missed");
  });
  it.each([
    current, { from: "2026-01-01", to: "2026-03-31" }, { from: "2026-02-01", to: "2026-02-28" },
    { from: "2024-11-17", to: "2026-11-16" }, { from: "2024-01-01", to: "2026-12-31" },
  ])("keeps selected nonofficial Retention range reference-only: %j", range => {
    const mode = retentionComparisonPeriod(range, true);
    expect(mode).toBe("reference");
    expect(kpiStatus(100, "90", "minimum", mode, false)).toEqual({ status: null, tone: "neutral" });
  });
  it.each([0, 1, 2])("D&A in-progress at/below maximum is neutral, never achieved: %s", actual => {
    expect(daComparisonPeriod(current, today)).toBe("in-progress");
    expect(kpiStatus(actual, "2", "maximum", "in-progress", false)).toEqual({ status: "Within KPI so far", tone: "neutral" });
  });
  it("D&A in-progress above maximum is already Missed", () => {
    expect(kpiStatus(3, "2", "maximum", "in-progress", false)).toEqual({ status: "Missed", tone: "missed" });
  });
  it.each([0, 1, 2])("D&A completed year at/below maximum is Met: %s", actual => {
    expect(daComparisonPeriod(completed, today)).toBe("final");
    expect(kpiStatus(actual, "2", "maximum", "final", false).status).toBe("Met");
  });
  it("D&A completed year above maximum is Missed", () => {
    expect(kpiStatus(3, "2", "maximum", "final", false).status).toBe("Missed");
  });
  it.each([official, { from: "2026-01-01", to: "2026-03-31" }, { from: "2026-01-02", to: "2026-12-31" },
    { from: "2027-01-01", to: "2027-12-31" }, { from: "2026-05-01", to: "2026-05-31" }])(
    "D&A nonannual/future range is reference-only: %j", range => {
      expect(daComparisonPeriod(range, today)).toBe("reference");
      expect(kpiStatus(0, "2", "maximum", daComparisonPeriod(range, today), false).status).toBeNull();
    });
  it("finishes a calendar year only on the following day", () => {
    expect(daComparisonPeriod(current, new Date(2026, 11, 31))).toBe("in-progress");
    expect(daComparisonPeriod(current, new Date(2027, 0, 1))).toBe("final");
  });
  it("zero is a real KPI, not absent", () => {
    expect(kpiStatus(0, "0", "maximum", "in-progress", false).status).toBe("Within KPI so far");
    expect(kpiStatus(1, "0", "maximum", "in-progress", false).status).toBe("Missed");
    expect(kpiStatus(0, "0", "maximum", "final", false).status).toBe("Met");
    expect(kpiLine({ code: "alcohol", direction: "maximum", unit: "count", components: [] }, "0")).toBe("KPI: At most 0");
  });
  it.each(["final", "in-progress", "reference"] as const)("population filters suppress every comparison in %s", mode => {
    for (const actual of [0, 100]) for (const direction of ["minimum", "maximum"] as const)
      expect(kpiStatus(actual, "90", direction, mode, true)).toEqual({ status: null, tone: "neutral" });
  });
  it("missing and unavailable values never create a comparison or zero", () => {
    expect(kpiStatus(null, "0", "maximum", "final", false).status).toBeNull();
    expect(kpiStatus(0, null, "maximum", "final", false).status).toBeNull();
    expect(kpiStatus(NaN, "0", "maximum", "final", false).status).toBeNull();
  });
  it("compares exact decimals and reads stored direction and unit", () => {
    expect(meetsKpi(90, "90.000001", "minimum")).toBe(false);
    expect(meetsKpi(90.000001, "90.000001", "minimum")).toBe(true);
    expect(meetsKpi(2, "1.999999", "maximum")).toBe(false);
    expect(meetsKpi(1e-7, "0.000001", "maximum")).toBe(true);
    expect(kpiLine({ code: "not-a-name-rule", direction: "minimum", unit: "percentage", components: [] }, "90")).toBe("KPI: At least 90%");
  });
  it("resolves existing selector values inclusively and rejects invalid or incomplete ranges", () => {
    expect(dashboardRange({ mode: "year", year: 2026 })).toEqual(current);
    expect(dashboardRange({ mode: "year-month", year: 2024, month: 2 })).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(dashboardRange({ mode: "year-quarter", year: 2026, quarter: 2 })).toEqual({ from: "2026-04-01", to: "2026-06-30" });
    expect(dashboardRange({ mode: "date-range", dateFrom: new Date(2025, 0, 1), dateTo: new Date(2026, 11, 31) })).toEqual(official);
    expect(dashboardRange({ mode: "date-range", dateFrom: today })).toBeNull();
    expect(dashboardRange({ mode: "date-range", dateFrom: today, dateTo: new Date("bad") })).toBeNull();
    expect(dashboardRange({ mode: "date-range", dateFrom: today, dateTo: new Date(2020, 0, 1) })).toBeNull();
    expect(dashboardRange({ mode: "year-month", year: 2026, month: 13 })).toBeNull();
    expect(retentionComparisonPeriod(null, false)).toBe("reference");
    expect(kpiYearForRange(null)).toBeNull();
  });
});
