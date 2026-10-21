import { describe, it, expect } from "vitest";
import { calculateTrainingCompliance } from "../../server/v2/shared/training-compliance/calculator";
import { trainingChecklistPolicy } from "../../server/v2/shared/training-compliance/checklistPolicy";
import type { ComplianceInput } from "../../server/v2/shared/training-compliance/types";

const base: ComplianceInput = {
  assignmentUuid: "assignment", vesselUuid: "vessel", contractRankUuid: "rank",
  plannedJoiningDate: "2026-01-31", contractRangeEndMonths: 1,
  matrix: { revisionUuid: "revision", revision: "R0",
    requirements: [{ courseUuid: "course", name: "Fire fighting", obligation: "mandatory" }], equivalents: [] },
  certificates: [],
};
const check = (input: Partial<ComplianceInput> = {}, on = false) =>
  trainingChecklistPolicy(calculateTrainingCompliance({ ...base, ...input }), on);
const certificate = (expiry: string | null) => [{ certificateUuid: "cert", courseUuid: "course",
  name: "Fire fighting", number: "CERT-1", issued: "2025-01-01", expiry, certificateExpires: false }];
describe("training checklist policy, independent of form override", () => {
  it("blocks a named mandatory Not held course", () => {
    expect(check().blockers).toMatchObject([{ courseName: "Fire fighting", status: "Not held" }]);
  });
  it("blocks expired at joining, inclusive expiry at joining becomes contract warning", () => {
    expect(check({ certificates: certificate("2026-01-30") }).blockers[0].status).toBe("Expired at joining");
    expect(check({ certificates: certificate("2026-01-31") }).blockers).toEqual([]);
    expect(check({ certificates: certificate("2026-01-31") }).warnings.join(" ")).toContain("Expires during contract");
  });
  it("defaults expiry during contract to warning, ON makes it blocking", () => {
    const input = { certificates: certificate("2026-02-01") };
    expect(check(input).blockers).toEqual([]);
    expect(check(input, true).blockers[0].status).toBe("Expires during contract");
  });
  it("accepts contract end inclusive and no expiry", () => {
    expect(check({ certificates: certificate("2026-02-28") }, true).blockers).toEqual([]);
    expect(check({ certificates: certificate(null) }, true).blockers).toEqual([]);
  });
  it("recommended gaps and invalid certificate dates never block", () => {
    for (const certificates of [[], certificate("invalid")]) {
      const result = check({ matrix: { ...base.matrix!, requirements: [
        { courseUuid: "course", name: "Recommended", obligation: "recommended" }] }, certificates }, true);
      expect(result.blockers).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
  it.each(["contractRankUuid", "plannedJoiningDate", "matrix"] as const)("blocks missing %s with its reason", field => {
    expect(check({ [field]: null }).blockers.some(b => b.status === "INCOMPLETE")).toBe(true);
  });
  it("missing contract end warns, does not block", () => {
    const result = check({ contractRangeEndMonths: null, certificates: certificate(null) }, true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Contract end not set");
  });
  it("malformed issue counts as held with correction warning", () => {
    const result = check({ certificates: [{ ...certificate(null)[0], issued: "bad-date" }] });
    expect(result.blockers).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Certificate dates invalid");
  });
});
