import { describe, it, expect } from "vitest";
import {
  monthInfo,
  addDays,
  addMonths,
  calendarDaysInclusive,
  cappedIndex,
  allocateDays,
  parseScaled,
  formatScaled,
  toCents,
  centsToString,
  divRound,
  roundCents,
  prorateCents,
  rateTimesQtyCents,
  percentageOfCents,
  precisionToUnitCents,
} from "../../server/v2/accounts/engine/periodMath";

/**
 * Unit tests for the wage-engine period math (30/360 day allocation) and
 * the scaled-integer money helpers. All expected figures for H1–H5 proration
 * arithmetic are asserted here at the cents level so the integration suite
 * failures can be attributed to data flow rather than arithmetic.
 */
describe("wage engine period math", () => {
  describe("monthInfo", () => {
    it("resolves standard months", () => {
      const m = monthInfo("2026-03");
      expect(m.daysInMonth).toBe(31);
      expect(m.monthStart).toBe("2026-03-01");
      expect(m.monthEnd).toBe("2026-03-31");
    });

    it("resolves February in a non-leap year (2026)", () => {
      const m = monthInfo("2026-02");
      expect(m.daysInMonth).toBe(28);
      expect(m.monthEnd).toBe("2026-02-28");
    });

    it("resolves February in a leap year (2028)", () => {
      expect(monthInfo("2028-02").daysInMonth).toBe(29);
    });

    it("rejects malformed periods", () => {
      expect(() => monthInfo("2026-13")).toThrow();
      expect(() => monthInfo("2026-3")).toThrow();
    });
  });

  describe("date helpers", () => {
    it("addDays crosses month boundaries", () => {
      expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("addMonths clamps the day-of-month", () => {
      expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
      expect(addMonths("2026-03-15", 12)).toBe("2027-03-15");
    });

    it("calendarDaysInclusive counts both endpoints", () => {
      expect(calendarDaysInclusive("2026-03-15", "2026-03-31")).toBe(17);
      expect(calendarDaysInclusive("2026-06-01", "2026-06-30")).toBe(30);
    });

    it("cappedIndex maps the 31st to 30", () => {
      expect(cappedIndex("2026-03-31")).toBe(30);
      expect(cappedIndex("2026-03-30")).toBe(30);
      expect(cappedIndex("2026-03-15")).toBe(15);
    });
  });

  describe("allocateDays (thirty_day_month)", () => {
    const M = (p: string) => monthInfo(p);

    it("H1: mid-month sign-on 15-Mar gives 17 days of 30", () => {
      const { days, daysBasis } = allocateDays(
        [{ from: "2026-03-15", to: "2026-03-31" }],
        M("2026-03"),
        "2026-03-15",
        "2026-03-31",
        "thirty_day_month",
      );
      expect(days).toEqual([17]);
      expect(daysBasis).toBe(30);
    });

    it("H2: full May split at the 16th gives 15 + 15", () => {
      const { days, daysBasis } = allocateDays(
        [
          { from: "2026-05-01", to: "2026-05-15" },
          { from: "2026-05-16", to: "2026-05-31" },
        ],
        M("2026-05"),
        "2026-05-01",
        "2026-05-31",
        "thirty_day_month",
      );
      expect(days).toEqual([15, 15]);
      expect(daysBasis).toBe(30);
    });

    it("H3: full August split at the 10th gives 9 + 21", () => {
      const { days, daysBasis } = allocateDays(
        [
          { from: "2026-08-01", to: "2026-08-09" },
          { from: "2026-08-10", to: "2026-08-31" },
        ],
        M("2026-08"),
        "2026-08-01",
        "2026-08-31",
        "thirty_day_month",
      );
      expect(days).toEqual([9, 21]);
      expect(daysBasis).toBe(30);
    });

    it("February full month counts as 30 of 30 (non-leap)", () => {
      const { days, daysBasis } = allocateDays(
        [{ from: "2026-02-01", to: "2026-02-28" }],
        M("2026-02"),
        "2026-02-01",
        "2026-02-28",
        "thirty_day_month",
      );
      expect(days).toEqual([30]);
      expect(daysBasis).toBe(30);
    });

    it("February full month counts as 30 of 30 (leap)", () => {
      const { days } = allocateDays(
        [{ from: "2028-02-01", to: "2028-02-29" }],
        M("2028-02"),
        "2028-02-01",
        "2028-02-29",
        "thirty_day_month",
      );
      expect(days).toEqual([30]);
    });

    it("segment ending on the 31st never exceeds 30 days", () => {
      const { days } = allocateDays(
        [{ from: "2026-01-05", to: "2026-01-31" }],
        M("2026-01"),
        "2026-01-05",
        "2026-01-31",
        "thirty_day_month",
      );
      expect(days).toEqual([27]);
    });

    it("full-month multi-segment days always sum to exactly 30", () => {
      const { days } = allocateDays(
        [
          { from: "2026-07-01", to: "2026-07-10" },
          { from: "2026-07-11", to: "2026-07-20" },
          { from: "2026-07-21", to: "2026-07-31" },
        ],
        M("2026-07"),
        "2026-07-01",
        "2026-07-31",
        "thirty_day_month",
      );
      expect(days).toEqual([10, 10, 10]);
      expect(days.reduce((a, b) => a + b, 0)).toBe(30);
    });
  });

  describe("allocateDays (calendar_days)", () => {
    it("uses real calendar days and the real month length as basis", () => {
      const { days, daysBasis } = allocateDays(
        [{ from: "2026-03-15", to: "2026-03-31" }],
        monthInfo("2026-03"),
        "2026-03-15",
        "2026-03-31",
        "calendar_days",
      );
      expect(days).toEqual([17]);
      expect(daysBasis).toBe(31);
    });
  });

  describe("scaled-integer parsing/formatting", () => {
    it("parses decimals exactly (no float drift)", () => {
      expect(parseScaled("4762", 2)).toBe(476200);
      expect(parseScaled("4.02", 4)).toBe(40200);
      expect(parseScaled("0.1", 2)).toBe(10);
      expect(parseScaled("-12.34", 2)).toBe(-1234);
    });

    it("rounds extra fractional digits half-up", () => {
      expect(parseScaled("1.005", 2)).toBe(101);
      expect(parseScaled("1.004", 2)).toBe(100);
    });

    it("round-trips through formatScaled", () => {
      expect(formatScaled(476200, 2)).toBe("4762.00");
      expect(formatScaled(-1234, 2)).toBe("-12.34");
      expect(centsToString(toCents("5777.17"))).toBe("5777.17");
    });
  });

  describe("rounding rules", () => {
    it("divRound half-up on nearest", () => {
      expect(divRound(5, 2, "nearest", 1)).toBe(3); // 2.5 -> 3
      expect(divRound(4, 2, "nearest", 1)).toBe(2);
    });

    it("divRound rejects negative amounts (engine works on magnitudes)", () => {
      expect(() => divRound(-5, 2, "nearest", 1)).toThrow();
    });

    it("up/down always move away from / toward zero magnitude", () => {
      expect(divRound(101, 100, "up", 1)).toBe(2);
      expect(divRound(199, 100, "down", 1)).toBe(1);
    });

    it("roundCents honours coarser units", () => {
      expect(roundCents(12345, "nearest", 100)).toBe(12300); // to 1.00
      expect(roundCents(12351, "nearest", 100)).toBe(12400);
    });

    it("precisionToUnitCents converts precision strings", () => {
      expect(precisionToUnitCents("0.01")).toBe(1);
      expect(precisionToUnitCents("1")).toBe(100);
      expect(precisionToUnitCents(null)).toBe(1);
    });
  });

  describe("H1 arithmetic (Master joins 15-Mar-2026, 17/30 days)", () => {
    const p = (monthly: string) =>
      centsToString(prorateCents(toCents(monthly), 17, 30, "nearest", 1));

    it("prorates every element to the expected cent", () => {
      expect(p("4762")).toBe("2698.47"); // Basic
      expect(p("3333")).toBe("1888.70"); // Fixed OT
      expect(p("200")).toBe("113.33"); // Subsistence
      expect(p("1900")).toBe("1076.67"); // Tanker allowance
      expect(p("1429")).toBe("809.77"); // Leave pay (settlement)
      expect(p("476")).toBe("269.73"); // Provident fund
    });

    it("net-on-board earnings sum to 5777.17", () => {
      const net =
        prorateCents(toCents("4762"), 17, 30, "nearest", 1) +
        prorateCents(toCents("3333"), 17, 30, "nearest", 1) +
        prorateCents(toCents("200"), 17, 30, "nearest", 1) +
        prorateCents(toCents("1900"), 17, 30, "nearest", 1);
      expect(centsToString(net)).toBe("5777.17");
    });
  });

  describe("H2/H3 split-month arithmetic", () => {
    it("H2: 1919×15/30 + 3619×15/30 = 2769.00", () => {
      const total =
        prorateCents(toCents("1919"), 15, 30, "nearest", 1) +
        prorateCents(toCents("3619"), 15, 30, "nearest", 1);
      expect(centsToString(total)).toBe("2769.00");
    });

    it("H3: 3619×9/30 + 3747×21/30 = 3708.60", () => {
      const y1 = prorateCents(toCents("3619"), 9, 30, "nearest", 1);
      const y2 = prorateCents(toCents("3747"), 21, 30, "nearest", 1);
      expect(centsToString(y1)).toBe("1085.70");
      expect(centsToString(y2)).toBe("2622.90");
      expect(centsToString(y1 + y2)).toBe("3708.60");
    });
  });

  describe("H4 variable OT arithmetic", () => {
    it("26 hours × 4.02 = 104.52 exactly", () => {
      const cents = rateTimesQtyCents(
        parseScaled("4.02", 4),
        parseScaled("26", 2),
        "nearest",
        1,
      );
      expect(centsToString(cents)).toBe("104.52");
    });
  });

  describe("percentage-of-gross arithmetic", () => {
    it("computes an exact percentage of a cents base", () => {
      // 10% of 1184.52
      expect(
        centsToString(
          percentageOfCents(toCents("1184.52"), parseScaled("10", 2), "nearest", 1),
        ),
      ).toBe("118.45");
    });
  });
});
