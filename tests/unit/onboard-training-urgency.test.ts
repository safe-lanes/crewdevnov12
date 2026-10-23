import { describe, expect, it } from "vitest";
import { certificateExpiryWindows, onboardDot } from "../../server/v2/shared/training-compliance/onboard";
import { civilDate, contractEndDate } from "../../server/v2/shared/training-compliance/dates";
import type { ComplianceResult, CourseResult } from "../../server/v2/shared/training-compliance/types";

describe("today-relative urgency windows share the original calendar-month calculation", () => {
  it.each([
    ["2026-09-29", ["Expired"]],
    ["2026-09-30", ["3M", "2M", "1M"]],
    ["2026-10-30", ["3M", "2M", "1M"]],
    ["2026-10-31", ["3M", "2M"]],
    ["2026-11-30", ["3M", "2M"]],
    ["2026-12-01", ["3M"]],
    ["2026-12-30", ["3M"]],
    ["2026-12-31", []],
    [null, []], ["", []], ["2026-02-30", []], ["not a date", []],
  ])("expiry %s against 30-Sep-2026 yields %j", (expiry, expected) => {
    expect(certificateExpiryWindows(expiry as string | null, "2026-09-30")).toEqual(expected);
  });
  it("clamps month ends and retains leap-day inclusion", () => {
    expect(certificateExpiryWindows("2028-02-29", "2028-01-31")).toEqual(["3M", "2M", "1M"]);
    expect(certificateExpiryWindows("2027-02-28", "2027-01-31")).toEqual(["3M", "2M", "1M"]);
    expect(certificateExpiryWindows("2027-03-01", "2027-01-31")).toEqual(["3M", "2M"]);
    expect(certificateExpiryWindows("2027-01-01", "invalid")).toEqual([]);
  });
  it("is exactly equivalent to the old inclusive two-month predicate over boundary dates", () => {
    for (const today of ["2026-01-31", "2026-09-30", "2027-12-31", "2028-01-31"]) {
      for (const expiry of ["2026-01-30", today, contractEndDate(today, 1), contractEndDate(today, 2),
        contractEndDate(today, 3), "2028-02-30", null]) {
        const date = civilDate(expiry), boundary = contractEndDate(today, 2);
        const old = Boolean(date && boundary && date >= today && date <= boundary);
        expect(certificateExpiryWindows(expiry, today).includes("2M")).toBe(old);
      }
    }
  });
  it("does not change the existing dot overlay's contract-relative condition", () => {
    const course = { courseUuid: "course", complete: true, state: "Valid", issues: [],
      chosenCertificate: { expiry: "2026-10-31" } } as CourseResult;
    const check = { contractEnd: "2026-10-01", status: "complete", issues: [] } as unknown as ComplianceResult;
    expect(onboardDot(course, check, "2026-09-30").reasons).toEqual(["Valid"]);
    expect(onboardDot(course, { ...check, contractEnd: null }, "2026-09-30").reasons)
      .toEqual(["Expires within 2 months"]);
    expect(onboardDot({ ...course, state: "Expires during contract" }, check, "2026-09-30").reasons)
      .toEqual(["Expires before planned relief", "Expires within 2 months"]);
  });
});
