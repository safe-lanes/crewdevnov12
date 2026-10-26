import { describe, expect, it } from "vitest";
import { calculateTrainingCompliance } from "../../server/v2/shared/training-compliance/calculator";
import { needsSuggestion, qualifyingCertificate, suggestionTarget } from "../../server/v2/training-needs/complianceSuggestionPolicy";
import type { ComplianceInput } from "../../server/v2/shared/training-compliance/types";

const base: ComplianceInput = { assignmentUuid: "assignment", vesselUuid: "vessel",
  contractRankUuid: "rank", plannedJoiningDate: "2027-01-31", contractRangeEndMonths: 3,
  matrix: { revisionUuid: "revision", revision: "R0",
    requirements: [{ courseUuid: "required", name: "Fire fighting", obligation: "mandatory" }],
    equivalents: [{ requiredCourseUuid: "required", acceptedCourseUuid: "higher" }] }, certificates: [] };
const check = (expiry?: string | null, extra: Partial<ComplianceInput> = {}) =>
  calculateTrainingCompliance({ ...base, ...(expiry === undefined ? {} : { certificates: [
    { certificateUuid: "certificate", courseUuid: "higher", name: "Advanced", number: "001",
      issued: "2026-01-01", expiry, certificateExpires: expiry !== null }] }), ...extra });

describe("pre-joining suggestion eligibility and closure", () => {
  it.each([undefined, "2027-01-30", "2027-03-01"])("suggests only the three mandatory gap states (%s)", expiry => {
    expect(needsSuggestion(check(expiry).courses[0])).toBe(true);
  });
  it("does not suggest recommended, valid or missing-expiry courses", () => {
    const recommended = { ...base.matrix!, requirements: [{ ...base.matrix!.requirements[0], obligation: "recommended" as const }] };
    expect(needsSuggestion(check(undefined, { matrix: recommended }).courses[0])).toBe(false);
    expect(needsSuggestion(check("2027-04-30").courses[0])).toBe(false);
    const missing = check(null);
    missing.courses[0].state = "Expiry not recorded";
    expect(needsSuggestion(missing.courses[0])).toBe(false);
  });
  it("uses day before expiry, including month/year boundaries", () => {
    const result = check("2027-03-01");
    expect(suggestionTarget(result.courses[0], result)).toBe("2027-02-28");
  });
  it("uses joining as the target for a joining gap", () => {
    const result = check();
    expect(suggestionTarget(result.courses[0], result)).toBe("2027-01-31");
  });
  it("closes using a qualifying equivalent and inclusive end-day validity", () => {
    expect(qualifyingCertificate(check("2027-04-30").courses[0])).toBe("certificate");
    expect(qualifyingCertificate(check(null).courses[0])).toBe("certificate");
  });
  it("does not close on expiry during contract, expired, future-issued or invalid expiry", () => {
    for (const result of [check("2027-04-29"), check("2026-01-01"), check("bad"),
      check("2028-01-01", { certificates: [{ certificateUuid: "future", courseUuid: "required",
        name: "Future", number: null, issued: "2027-02-01", expiry: "2028-01-01" }] })])
      expect(qualifyingCertificate(result.courses[0])).toBeNull();
  });
  it("unknown contract end retains joining-date eligibility, without inventing a target expiry", () => {
    const result = check(undefined, { contractRangeEndMonths: null });
    expect(needsSuggestion(result.courses[0])).toBe(true);
    expect(suggestionTarget(result.courses[0], result)).toBe("2027-01-31");
  });
});
