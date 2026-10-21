import { describe, expect, it } from "vitest";
import { calculateTrainingCompliance } from "../../server/v2/shared/training-compliance/calculator";
import { trainingChecklistPolicy } from "../../server/v2/shared/training-compliance/checklistPolicy";
import type { ComplianceInput, TrainingCertificate } from "../../server/v2/shared/training-compliance/types";
const cert = (id: string, expiry: string | null, certificateExpires = true, courseUuid = "course"): TrainingCertificate =>
  ({ certificateUuid: id, name: id, number: id, courseUuid, issued: "2026-01-01", expiry, certificateExpires });
const input = (certificates: TrainingCertificate[]): ComplianceInput => ({
  assignmentUuid: "assignment", vesselUuid: "vessel", contractRankUuid: "rank",
  plannedJoiningDate: "2026-10-21", contractRangeEndMonths: 6, certificates,
  matrix: { revisionUuid: "revision", revision: "R0", requirements: [
    { courseUuid: "course", name: "Fire fighting", obligation: "mandatory" }],
    equivalents: [{ requiredCourseUuid: "course", acceptedCourseUuid: "equivalent" }] },
});
describe("expiry classification and independent tenant policy", () => {
  it("expiring certificate without date is amber warning, not permanent or incomplete", () => {
    const result = calculateTrainingCompliance(input([cert("missing", null)]));
    expect(result.status).toBe("complete");
    expect(result.courses[0]).toMatchObject({ state: "Expiry not recorded", validAtJoining: null,
      validThroughContract: null, chosenCertificate: { certificateUuid: "missing" } });
    expect(result.summary.mandatory.status).toBe("warning");
    expect(result.courses[0].issues[0].message).toContain("crew profile → D3");
    expect(trainingChecklistPolicy(result, false, false).blockers).toEqual([]);
    expect(trainingChecklistPolicy(result, false, false).warnings.join()).toContain("Expiry not recorded");
  });
  it("only the missing-expiry policy blocks it, independently of contract-expiry policy", () => {
    const result = calculateTrainingCompliance(input([cert("missing", null)]));
    expect(trainingChecklistPolicy(result, true, false).blockers).toEqual([]);
    expect(trainingChecklistPolicy(result, false, true).blockers[0]).toMatchObject({
      status: "Expiry not recorded", courseName: "Fire fighting", reason: expect.stringContaining("D3") });
  });
  it("recommended missing expiry never blocks either policy", () => {
    const data = input([cert("missing", null)]);
    data.matrix!.requirements[0].obligation = "recommended";
    expect(trainingChecklistPolicy(calculateTrainingCompliance(data), true, true).blockers).toEqual([]);
  });
  it("explicit No retains permanent-certificate validity", () => {
    expect(calculateTrainingCompliance(input([cert("permanent", null, false)])).courses[0])
      .toMatchObject({ state: "Valid, no expiry", validAtJoining: true, validThroughContract: true });
  });
  it("missing course policy cannot accidentally imply permanent validity", () => {
    expect(calculateTrainingCompliance(input([{ ...cert("unknown", null), certificateExpires: undefined }])).courses[0].state)
      .toBe("Expiry not recorded");
  });
  it("prefers a known-valid dated certificate over an undated expiring one", () => {
    expect(calculateTrainingCompliance(input([cert("missing", null), cert("dated", "2027-05-01")])).courses[0])
      .toMatchObject({ state: "Valid", chosenCertificate: { certificateUuid: "dated" } });
  });
  it("unknown expiry is not hidden by a proved-expired older certificate", () => {
    expect(calculateTrainingCompliance(input([cert("missing", null), cert("old", "2026-10-20")])).courses[0])
      .toMatchObject({ state: "Expiry not recorded", chosenCertificate: { certificateUuid: "missing" } });
  });
  it("uses the equivalent certificate's own expiry classification", () => {
    expect(calculateTrainingCompliance(input([cert("equiv", null, false, "equivalent")])).courses[0])
      .toMatchObject({ state: "Valid, no expiry", isEquivalent: true });
    expect(calculateTrainingCompliance(input([cert("equiv", null, true, "equivalent")])).courses[0])
      .toMatchObject({ state: "Expiry not recorded", isEquivalent: true });
  });
});
