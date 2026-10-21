import { describe, expect, it } from "vitest";
import { calculateOnboardCompliance, onboardDot } from "@server/v2/shared/training-compliance/onboard";
import { calculateTrainingCompliance } from "@server/v2/shared/training-compliance/calculator";
import { contractEndDate } from "@server/v2/shared/training-compliance/dates";
import type { TrainingCertificate } from "@server/v2/shared/training-compliance/types";

const certificate = (expiry: string | null, overrides: Partial<TrainingCertificate> = {}): TrainingCertificate =>
  ({ certificateUuid: "direct", courseUuid: "required", name: "AFF", number: "AFF-1",
    issued: "2026-01-01", expiry, certificateExpires: true, ...overrides });
const base = {
  assignmentUuid: "contract", vesselUuid: "fixture-vessel", contractRankUuid: "captured-rank",
  referenceDate: "2026-10-21", plannedReliefDate: "2027-04-21" as string | null,
  matrix: { revisionUuid: "r0", revision: "R0",
    requirements: [{ courseUuid: "required", name: "AFF", obligation: "mandatory" as const }],
    equivalents: [{ requiredCourseUuid: "required", acceptedCourseUuid: "equivalent" }] },
};
const check = (certificates: TrainingCertificate[], plannedReliefDate: string | null = base.plannedReliefDate) => {
  const result = calculateOnboardCompliance({ ...base, plannedReliefDate, certificates });
  return { result, dot: onboardDot(result.courses[0], result, base.referenceDate) };
};

describe("on-board matrix is a display adapter over the same calculation", () => {
  it.each([
    ["valid", [certificate("2027-06-01")], "green", false, "Valid"],
    ["permanent", [certificate(null, { certificateExpires: false })], "green", false, "Valid, no expiry"],
    ["before relief", [certificate("2027-02-01")], "amber", false, "Expires before planned relief"],
    ["expired", [certificate("2026-10-20")], "red", false, "Expired"],
    ["missing", [], "red", true, "Not held"],
    ["unknown expiry", [certificate(null)], "amber", true, "Expiry not recorded"],
  ] as const)("%s has its required dot and exact words", (_, certificates, color, outline, label) => {
    expect(check([...certificates]).dot).toMatchObject({ color, outline, label });
  });
  it("lists both before-relief and within-two-month reasons", () => {
    expect(check([certificate("2026-11-01")]).dot.reasons)
      .toEqual(["Expires before planned relief", "Expires within 2 months"]);
  });
  it("uses a two-month fallback without inventing a relief date", () => {
    const { result, dot } = check([certificate("2026-12-21")], null);
    expect(result).toMatchObject({ status: "complete", contractEnd: null, contractEndStatus: "not_set" });
    expect(dot).toMatchObject({ color: "amber", label: "Expires within 2 months" });
    expect(check([certificate("2026-12-22")], null).dot.label).toBe("Valid");
  });
  it("does not warn about expiry after known relief just because it is within two months", () => {
    expect(check([certificate("2026-12-01")], "2026-11-01").dot.label).toBe("Valid");
  });
  it("expiry is inclusive of today and planned relief", () => {
    expect(check([certificate("2026-10-21")], null).dot.label).toBe("Expires within 2 months");
    expect(check([certificate("2026-11-01")], "2026-11-01").dot.label).toBe("Valid");
  });
  it("clamps the fallback to month end", () => {
    expect(contractEndDate("2026-12-31", 2)).toBe("2027-02-28");
    const result = calculateOnboardCompliance({ ...base, referenceDate: "2026-12-31",
      plannedReliefDate: null, certificates: [certificate("2027-02-28")] });
    expect(onboardDot(result.courses[0], result, "2026-12-31").label).toBe("Expires within 2 months");
  });
  it("chooses the longest accepted equivalent, not a last-row expiry", () => {
    const { result, dot } = check([certificate("2026-11-01"),
      certificate("2027-06-01", { certificateUuid: "equiv", courseUuid: "equivalent" })]);
    expect(result.courses[0]).toMatchObject({ chosenCertificate: { certificateUuid: "equiv" }, isEquivalent: true });
    expect(dot.label).toBe("Valid");
  });
  it("future-issued certificates do not count today", () => {
    expect(check([certificate("2028-01-01", { issued: "2026-10-22" })]).dot.label).toBe("Not held");
  });
  it("invalid expiry is incomplete, never green or red missing", () => {
    const { result, dot } = check([certificate("bad-date")]);
    expect(result.status).toBe("incomplete");
    expect(dot).toMatchObject({ color: "grey", outline: false });
    expect(dot.label).toContain("Certificate dates invalid");
  });
  it("invalid or past relief is incomplete, with a plain planned-relief reason", () => {
    for (const date of ["2026-10-20", "bad-date"]) {
      const { result, dot } = check([certificate("2027-06-01")], date);
      expect(result.status).toBe("incomplete");
      expect(dot.color).toBe("grey");
      expect(dot.label).toContain("planned relief date");
    }
  });
  it("missing captured rank never falls back to present rank", () => {
    const result = calculateOnboardCompliance({ ...base, contractRankUuid: null, certificates: [] });
    expect(result).toMatchObject({ status: "incomplete", contractRankUuid: null, courses: [] });
    expect(result.issues.some(i => i.code === "MISSING_RANK")).toBe(true);
  });
  it("identical rank, dates, matrix, certificates and equivalents yield identical results on both screens", () => {
    const certificates = [certificate("2026-11-01"), certificate("2027-08-01", { certificateUuid: "equiv", courseUuid: "equivalent" })];
    const reliever = calculateTrainingCompliance({ ...base, plannedJoiningDate: base.referenceDate,
      contractRangeEndMonths: 6, certificates });
    const onboard = calculateOnboardCompliance({ ...base, certificates });
    expect(onboard.courses).toEqual(reliever.courses);
    expect(onboard.summary).toEqual(reliever.summary);
    expect(onboard.contractEnd).toBe(reliever.contractEnd);
    expect(onboard.calculationVersion).toBe(reliever.calculationVersion);
  });
});
