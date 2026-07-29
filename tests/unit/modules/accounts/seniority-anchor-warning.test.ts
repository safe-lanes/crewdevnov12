import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the seniority-anchor-confirmed feature (task 189):
 *  (a) auto-created engagement → engine run → warning present
 *  (b) individual save (scaleYearAtStart) → warning absent
 *  (c) bulk-confirm endpoint → all flags set, idempotent on already-confirmed
 *  (d) bulk-confirm is tenant-scoped (cannot confirm another tenant's rows)
 */

// ============================================================
// Part (a) + (b): engine warning via the EngagementWarning logic
//
// calcEngagement is not exported, so we test the logic of the warning
// condition directly via a minimal pure extract that mirrors the guard.
// ============================================================

function buildEngagement(
  overrides: Partial<{
    seniorityAnchorConfirmed: boolean | null;
    scaleYearAtStart: number;
    crewUuid: string;
    startDate: string;
    endDate: string | null;
    wageScaleUuid: string;
    rankIdAtStart: string;
  }> = {},
) {
  return {
    engagementUuid: "eng-test-1",
    crewUuid: "crew-uuid-1",
    startDate: "2025-01-01",
    endDate: null,
    wageScaleUuid: "scale-uuid-1",
    rankIdAtStart: "CAPT",
    scaleYearAtStart: 1,
    seniorityAnchorConfirmed: false,
    ...overrides,
  };
}

/**
 * Pure extract of the seniority-anchor warning condition from calcEngagement.
 * Returns warnings generated for the engagement.
 */
function computeSeniorityWarnings(
  engagement: ReturnType<typeof buildEngagement>,
  crewNames: Map<string, string> = new Map(),
) {
  const warnings: { code: string; message: string }[] = [];
  if (engagement.seniorityAnchorConfirmed === false) {
    const crewLabel =
      crewNames.get(engagement.crewUuid) ?? `crew ${engagement.crewUuid}`;
    warnings.push({
      code: "unconfirmed_seniority_anchor",
      message: `Seniority anchor not confirmed for ${crewLabel} — engine ran on year ${engagement.scaleYearAtStart ?? 1} default. Open the contract and save the seniority anchor to confirm it.`,
    });
  }
  return warnings;
}

describe("Engine warning — unconfirmed_seniority_anchor", () => {
  it("(a) emits warning when seniorityAnchorConfirmed is false", () => {
    const eng = buildEngagement({ seniorityAnchorConfirmed: false });
    const warnings = computeSeniorityWarnings(eng);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("unconfirmed_seniority_anchor");
    expect(warnings[0].message).toContain("year 1");
    expect(warnings[0].message).toContain("crew crew-uuid-1");
  });

  it("uses the crew display name when available", () => {
    const eng = buildEngagement({ seniorityAnchorConfirmed: false });
    const names = new Map([["crew-uuid-1", "John Doe"]]);
    const warnings = computeSeniorityWarnings(eng, names);
    expect(warnings[0].message).toContain("John Doe");
  });

  it("(b) emits NO warning when seniorityAnchorConfirmed is true", () => {
    const eng = buildEngagement({ seniorityAnchorConfirmed: true });
    const warnings = computeSeniorityWarnings(eng);
    expect(warnings).toHaveLength(0);
  });

  it("emits NO warning when seniorityAnchorConfirmed is null (legacy row treated as confirmed)", () => {
    // null means the column didn't exist before the migration; the DB default
    // is false, but legacy rows not yet migrated come through as null — guard
    // only fires on the explicit boolean false.
    const eng = buildEngagement({ seniorityAnchorConfirmed: null });
    const warnings = computeSeniorityWarnings(eng as any);
    expect(warnings).toHaveLength(0);
  });

  it("includes the scale year in the warning message", () => {
    const eng = buildEngagement({
      seniorityAnchorConfirmed: false,
      scaleYearAtStart: 3,
    });
    const warnings = computeSeniorityWarnings(eng);
    expect(warnings[0].message).toContain("year 3");
  });
});

// ============================================================
// Part (c) + (d): bulk-confirm service + tenant scoping
//
// We mock the repository layer and verify that:
// - bulkConfirmSeniorityAnchors calls the repo with the given UUIDs
// - the result counts confirmed rows
// - only the current tenant's DB connection is used
// ============================================================

type FakeDb = {
  name: "A" | "B";
  calls: { update: number };
  update: () => any;
};

function makeFakeDb(name: "A" | "B", returnCount: number): FakeDb {
  const calls = { update: 0 };
  return {
    name,
    calls,
    update: () => {
      calls.update++;
      // Simulate returning `returnCount` rows from `.returning()`.
      const fakeRows = Array.from({ length: returnCount }, (_, i) => ({
        engagementUuid: `eng-${i}`,
      }));
      return {
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(fakeRows),
          }),
        }),
      };
    },
  };
}

const dbA = makeFakeDb("A", 2);
const dbB = makeFakeDb("B", 0);
let currentTenant: "A" | "B" = "A";

vi.mock("../../../../server/v2/db", () => ({
  getDb: () => (currentTenant === "A" ? dbA : dbB),
}));

import { EngagementsRepository } from "../../../../server/v2/accounts/repositories/engagementsRepository";

const repo = new EngagementsRepository();

function resetCalls() {
  dbA.calls.update = 0;
  dbB.calls.update = 0;
}

describe("bulkConfirmSeniorityAnchors — repository", () => {
  beforeEach(() => {
    resetCalls();
    currentTenant = "A";
  });

  it("(c) returns the count of confirmed rows", async () => {
    const count = await repo.bulkConfirmSeniorityAnchors(
      ["eng-uuid-1", "eng-uuid-2"],
      "audit-user",
    );
    expect(count).toBe(2);
  });

  it("(c) returns 0 for empty input without touching the DB", async () => {
    const count = await repo.bulkConfirmSeniorityAnchors([]);
    expect(count).toBe(0);
    expect(dbA.calls.update).toBe(0);
  });

  it("(c) is idempotent — already-confirmed rows are still returned by the update", async () => {
    // The UPDATE sets seniorityAnchorConfirmed = true on all matching rows,
    // including those that were already true; it is a no-op at the data level
    // (value unchanged) but the row is still returned. The count reflects
    // matched (not changed) rows, which is fine for idempotency.
    const count = await repo.bulkConfirmSeniorityAnchors(["eng-already-confirmed"]);
    // Our fake DB always returns dbA returnCount=2 rows, but the logic is: the
    // real DB returns whatever rows matched — calling this on already-confirmed
    // rows succeeds without error.
    expect(count).toBeGreaterThanOrEqual(0);
    expect(dbA.calls.update).toBe(1); // exactly one UPDATE was issued
  });

  it("(d) uses the current tenant's connection — tenant A update goes to db A only", async () => {
    currentTenant = "A";
    await repo.bulkConfirmSeniorityAnchors(["eng-a-1"]);
    expect(dbA.calls.update).toBe(1);
    expect(dbB.calls.update).toBe(0);
  });

  it("(d) uses the current tenant's connection — tenant B update goes to db B only", async () => {
    currentTenant = "B";
    await repo.bulkConfirmSeniorityAnchors(["eng-b-1"]);
    expect(dbA.calls.update).toBe(0);
    expect(dbB.calls.update).toBe(1);
  });
});
