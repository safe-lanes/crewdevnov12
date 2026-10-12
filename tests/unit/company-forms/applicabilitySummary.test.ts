import { describe, expect, it } from "vitest";
import type { ApplicabilitySummaryPolicy } from "../../../client/src/components/company-forms/applicabilitySummary";
import { summarizeApplicability } from "../../../client/src/components/company-forms/applicabilitySummary";
import type { RuleDimension } from "../../../shared/v2/forms-engine/ruleDimensions";

const dimensions: Array<RuleDimension & { choices: Array<{ id: string; label: string }> }> = [
  { key: "vessel_type", label: "Vessel type", kind: "scalar", operators: ["in", "not_in"], available: true, choices: [{ id: "vt-a", label: "LPG tanker" }] },
  { key: "nationality", label: "Nationality", kind: "scalar", operators: ["in", "not_in"], available: true, choices: [{ id: "nat-a", label: "Indian" }] },
  { key: "rank", label: "Contract rank", kind: "scalar", operators: ["in", "not_in"], available: true, choices: [{ id: "rank-a", label: "Master" }] },
];

function policy(overrides: Partial<ApplicabilitySummaryPolicy> = {}): ApplicabilitySummaryPolicy {
  return {
    mode: "all",
    obligation: "mandatory",
    effectiveKind: "on_release",
    specificDate: null,
    effectiveFrom: null,
    sets: [],
    ...overrides,
  };
}

describe("summarizeApplicability", () => {
  it("states mandatory obligation and release timing", () => {
    expect(summarizeApplicability(policy(), dimensions))
      .toBe("Mandatory, from release, for all crew.");
  });

  it("states optional obligation", () => {
    expect(summarizeApplicability(policy({ obligation: "optional" }), dimensions))
      .toBe("Optional, from release, for all crew.");
  });

  it("formats a specific effective date as readable language", () => {
    expect(summarizeApplicability(policy({
      effectiveKind: "specific_date",
      specificDate: "2026-03-09",
    }), dimensions)).toBe("Mandatory, from 9 March 2026, for all crew.");
  });

  it("names all crew for the all mode and includes the actual release date when known", () => {
    expect(summarizeApplicability(policy({ effectiveFrom: "2026-03-10" }), dimensions, { status: "released" }))
      .toBe("Mandatory, from release (effective 10 March 2026), for all crew.");
  });

  it("explains manual start without implying a mandatory or blocking requirement", () => {
    const summary = summarizeApplicability(policy({ mode: "manual_only" }), dimensions);
    expect(summary).toContain("Manual start only");
    expect(summary).toContain("never makes the form mandatory");
    expect(summary).toContain("blocks progress");
    expect(summary).toContain("satisfies another requirement");
    expect(summary).toContain("skips a requirement");
    expect(summary).not.toContain("from release");
  });

  it("joins conditions with and, then alternate groups with or", () => {
    expect(summarizeApplicability(policy({
      mode: "conditional",
      sets: [
        { conditions: [
          { dimensionKey: "vessel_type", operator: "in", value: ["vt-a"] },
          { dimensionKey: "nationality", operator: "in", value: ["nat-a"] },
        ] },
        { conditions: [
          { dimensionKey: "rank", operator: "in", value: ["rank-a"] },
        ] },
      ],
    }), dimensions)).toBe("Mandatory, from release, for crew whose vessel type is LPG tanker and nationality is Indian, or crew whose contract rank is Master.");
  });

  it("retains readable labels for selected values that are no longer in current choices", () => {
    const summary = summarizeApplicability(policy({
      mode: "conditional",
      sets: [{ conditions: [{
        dimensionKey: "nationality",
        operator: "in",
        value: ["inactive-nationality"],
        valueLabels: [{ id: "inactive-nationality", label: "Formerly listed nationality" }],
      }] }],
    }), dimensions);
    expect(summary).toContain("Formerly listed nationality");
    expect(summary).not.toContain("inactive-nationality");
  });
});
