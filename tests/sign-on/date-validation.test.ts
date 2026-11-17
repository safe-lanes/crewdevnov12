import { describe, expect, it } from "vitest";
import { getSignOnDateError } from "../../shared/v2/vessel/signOnValidation";

describe("sign-on date validation", () => {
  it.each([undefined, null, ""])("requires explicit sign-on date %s", value => {
    expect(getSignOnDateError(value, "2026-11-17")).toBe("Sign On Date is required.");
  });
  it.each([" ", "2026-02-30", "2025-02-29", "2026-13-01", "0000-01-01", "17-Nov-2026", "2026-1-1", 123, {}])(
    "rejects malformed or impossible calendar date %s", value => {
      expect(getSignOnDateError(value, "2026-11-17")).toBe("Enter a valid Sign On Date.");
    },
  );
  it.each(["2024-02-29", "2026-11-16", "2026-11-17"])("accepts explicit past/today %s", value => {
    expect(getSignOnDateError(value, "2026-11-17")).toBeNull();
  });
  it("rejects a future date", () => {
    expect(getSignOnDateError("2026-11-18", "2026-11-17")).toMatch(/future date/);
  });
});
