import { describe, it, expect } from "vitest";
import { findUncoveredAssignments } from "../../../../server/v2/accounts/engine/wageEngineService";
import { assignmentOverlapsMonth } from "../../../../server/v2/accounts/engine/engineReads";

/**
 * Missing-engagement safety net (task #207): every vessel-month calculation
 * run must persistently warn about crew whose crewing assignment overlaps
 * the period but who have NO engagement — regardless of WHY the engagement
 * is missing (pre-scale sign-on, unmapped rank, unparseable dates, overlap
 * conflicts, deleted engagement …). The warning is persisted on the run row
 * (code "missing_engagement") so it survives page reloads, unlike the
 * transient sync-results panel.
 */
describe("findUncoveredAssignments", () => {
  const a = (crewUuid: string, assignUuid = `as-${crewUuid}`) => ({
    assignUuid,
    crewUuid,
    signOnDate: "2025-06-10",
    signOffDate: null as string | null,
  });

  it("flags crew with an overlapping assignment but no engagement", () => {
    const uncovered = findUncoveredAssignments(
      [a("crew-1"), a("crew-2"), a("crew-3")],
      [{ crewUuid: "crew-2" }],
    );
    expect(uncovered.map((u) => u.crewUuid)).toEqual(["crew-1", "crew-3"]);
  });

  it("empty when every assignment's crew has an engagement", () => {
    expect(
      findUncoveredAssignments(
        [a("crew-1")],
        [{ crewUuid: "crew-1" }, { crewUuid: "crew-9" }],
      ),
    ).toEqual([]);
  });

  it("flags everyone when there are no engagements at all", () => {
    expect(
      findUncoveredAssignments([a("crew-1"), a("crew-2")], []),
    ).toHaveLength(2);
  });

  it("a frozen/settled engagement still counts as coverage (no false alarm)", () => {
    // runForVesselPeriod builds the coverage universe from
    // findEngagedCrewForVesselPeriod (ANY non-deleted, non-cancelled
    // engagement, incl. settled/draft), so a settled crew member must not
    // be reported as missing.
    expect(
      findUncoveredAssignments([a("crew-settled")], [
        { crewUuid: "crew-settled" },
      ]),
    ).toEqual([]);
  });
});

describe("assignmentOverlapsMonth (free-text assignment dates)", () => {
  const MARCH = ["2026-03-01", "2026-03-31"] as const;
  const ov = (signOnDate: string | null, signOffDate: string | null) =>
    assignmentOverlapsMonth({ signOnDate, signOffDate }, ...MARCH);

  it("plain ISO overlap rules", () => {
    expect(ov("2025-06-10", null)).toBe(true); // open-ended
    expect(ov("2026-03-15", "2026-04-10")).toBe(true);
    expect(ov("2026-04-01", null)).toBe(false); // starts after month
    expect(ov("2025-06-10", "2026-02-28")).toBe(false); // ends before month
  });

  it("parses ISO timestamps and loose date strings defensively", () => {
    expect(ov("2025-06-10T00:00:00.000Z", null)).toBe(true);
    expect(ov("June 10, 2025", null)).toBe(true);
    expect(ov("April 1, 2026", null)).toBe(false);
  });

  it("fail-loud: unparseable sign-on counts as overlapping (never silently excluded)", () => {
    expect(ov("not-a-date", null)).toBe(true);
    expect(ov("not-a-date", "also-junk")).toBe(true);
  });

  it("unparseable sign-off is treated as open-ended", () => {
    expect(ov("2025-06-10", "garbage")).toBe(true);
  });

  it("missing sign-on means not on board", () => {
    expect(ov(null, null)).toBe(false);
    expect(ov("  ", null)).toBe(false);
  });
});
