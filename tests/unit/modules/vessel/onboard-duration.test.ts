import { describe, expect, it } from "vitest";
import { formatOnboardDuration } from "../../../../client/src/modules/vessel/onboardDuration";

describe("read-only onboard duration", () => {
    it.each([
        ["2026-01-10", "2026-04-22", "3 months, 12 days"],
        ["2026-01-10", "2026-02-11", "1 month, 1 day"],
        ["2026-01-10", "2026-01-10", "0 months, 0 days"],
        ["2026-01-10", "2026-01-11", "0 months, 1 day"],
        ["2025-01-10", "2026-04-22", "15 months, 12 days"],
        ["2026-01-31", "2026-02-28", "1 month, 0 days"],
        ["2024-01-31", "2024-02-29", "1 month, 0 days"],
        ["2024-02-29", "2025-02-28", "12 months, 0 days"],
        ["2026-01-31", "2026-03-30", "1 month, 30 days"],
        ["2026-01-31", "2026-03-31", "2 months, 0 days"],
        ["2026-03-07", "2026-03-09", "0 months, 2 days"],
        ["2026-10-31", "2026-11-02", "0 months, 2 days"],
        ["10-Jan-2026", "22-Apr-2026", "3 months, 12 days"],
        ["10-01-2026", "22-04-2026", "3 months, 12 days"],
    ])("%s through %s is %s", (start, end, duration) => {
        expect(formatOnboardDuration(start, end)).toBe(`Onboard: ${duration}.`);
    });

    it.each([
        [undefined, "2026-04-22"], [null, "2026-04-22"], ["", "2026-04-22"],
        ["2026-01-10", undefined], ["2026-01-10", ""],
        ["not-a-date", "2026-04-22"], ["2026-02-30", "2026-04-22"],
        ["2026-01-10", "2026-13-22"], ["2026-04-22", "2026-01-10"],
    ])("returns unavailable for %s through %s", (start, end) => {
        expect(formatOnboardDuration(start, end)).toBe("Onboard duration unavailable.");
    });
});
