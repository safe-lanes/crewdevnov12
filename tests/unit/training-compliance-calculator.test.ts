import { describe, expect, it } from "vitest";
import { calculateTrainingCompliance } from "@server/v2/shared/training-compliance/calculator";
import { contractEndDate } from "@server/v2/shared/training-compliance/dates";
import { TRAINING_COMPLIANCE_VERSION, type ComplianceInput, type TrainingCertificate } from "@server/v2/shared/training-compliance/types";

const cert = (id: string, expiry: string | null, courseUuid = "course-a", issued = "2026-01-01"): TrainingCertificate =>
  ({ certificateUuid: id, courseUuid, name: id, number: id, issued, expiry, certificateExpires: false });
function input(certificates: TrainingCertificate[] = []): ComplianceInput {
  return { assignmentUuid: "assignment", vesselUuid: "vessel", contractRankUuid: "captured-rank",
    plannedJoiningDate: "2026-10-21", contractRangeEndMonths: 6, certificates,
    matrix: { revisionUuid: "saved-r0", revision: "R0",
      requirements: [{ courseUuid: "course-a", name: "Required A", obligation: "mandatory" }],
      equivalents: [{ requiredCourseUuid: "course-a", acceptedCourseUuid: "course-b" },
        { requiredCourseUuid: "course-b", acceptedCourseUuid: "course-c" }] } };
}
describe("shared training compliance kernel", () => {
  it.each([
    ["Valid", cert("direct", "2027-05-01")],
    ["Valid, no expiry", cert("permanent", null)],
    ["Expires during contract", cert("mid-contract", "2026-12-01")],
    ["Expired at joining", cert("expired", "2026-10-20")],
  ])("returns %s and records its certificate and version", (state, certificate) => {
    const result = calculateTrainingCompliance(input([certificate]));
    expect(result.status).toBe("complete");
    expect(result.contractEnd).toBe("2027-04-21");
    expect(result.courses[0]).toMatchObject({ state, chosenCertificate: certificate,
      isEquivalent: false, calculationVersion: TRAINING_COMPLIANCE_VERSION });
    expect(result.calculationVersion).toBe(TRAINING_COMPLIANCE_VERSION);
  });
  it("never shows a missing certificate blank or valid", () => {
    expect(calculateTrainingCompliance(input()).courses[0]).toMatchObject({ state: "Not held", chosenCertificate: null, isEquivalent: null });
  });
  it("uses a direct accepted equivalent but never a transitive alternative", () => {
    expect(calculateTrainingCompliance(input([cert("equivalent", null, "course-b")])).courses[0])
      .toMatchObject({ state: "Valid, no expiry", isEquivalent: true });
    expect(calculateTrainingCompliance(input([cert("transitive", null, "course-c")])).courses[0].state).toBe("Not held");
  });
  it("does not infer the reverse link", () => {
    const value = input([cert("a", null)]);
    value.matrix!.requirements[0].courseUuid = "course-b";
    expect(calculateTrainingCompliance(value).courses[0].state).toBe("Not held");
  });
  it("chooses the longest expiry even when it is an equivalent", () => {
    const row = calculateTrainingCompliance(input([cert("short", "2026-11-01"), cert("long", "2027-05-01", "course-b")])).courses[0];
    expect(row).toMatchObject({ state: "Valid", chosenCertificate: { certificateUuid: "long" }, isEquivalent: true });
  });
  it("no expiry is longer than any finite certificate", () => {
    expect(calculateTrainingCompliance(input([cert("finite", "2099-01-01"), cert("permanent", null)])).courses[0]
      .chosenCertificate?.certificateUuid).toBe("permanent");
  });
  it.each(["2026-10-21", "2027-04-21"])("expiry day %s is inclusive", expiry => {
    const row = calculateTrainingCompliance(input([cert("boundary", expiry)])).courses[0];
    expect(row.validAtJoining).toBe(true);
    expect(row.state).toBe(expiry === "2026-10-21" ? "Expires during contract" : "Valid");
  });
  it("does not count a future-issued certificate even if it lasts longer", () => {
    const row = calculateTrainingCompliance(input([cert("held", "2026-12-01"), cert("future", "2099-01-01", "course-a", "2026-10-22")])).courses[0];
    expect(row.chosenCertificate?.certificateUuid).toBe("held");
    expect(row.futureIssuedCertificateUuids).toEqual(["future"]);
  });
  it("future-only is Not held at joining", () => {
    expect(calculateTrainingCompliance(input([cert("future", null, "course-a", "2026-10-22")])).courses[0].state).toBe("Not held");
  });
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2028-02-29", 12, "2029-02-28"],
    ["2026-10-21", 0, "2026-10-21"],
  ])("clamps %s plus %s months to %s", (joining, months, expected) => {
    expect(contractEndDate(joining, months)).toBe(expected);
  });
  it.each(["contractRankUuid", "plannedJoiningDate", "matrix"] as const)("fails closed for missing %s", key => {
    const value = input([cert("held", null)]);
    value[key] = null;
    const result = calculateTrainingCompliance(value);
    expect(result.status).toBe("incomplete");
    expect(result.summary.mandatory.status).toBe("incomplete");
  });
  it("invalid dates never become no-expiry or silently roll forward", () => {
    expect(calculateTrainingCompliance(input([cert("invalid", "2026-02-30")])).status).toBe("incomplete");
    expect(contractEndDate("2026-02-30", 1)).toBeNull();
  });
  it("unexpected calculation failure is incomplete with no raw exception", () => {
    const value = input();
    value.certificates = null as unknown as TrainingCertificate[];
    const result = calculateTrainingCompliance(value);
    expect(result).toMatchObject({ status: "incomplete", issues: [{ code: "CALCULATION_FAILED",
      message: expect.stringContaining("Retry") }], summary: { mandatory: { status: "incomplete" } } });
  });
  it("blank stored expiry is explicitly no expiry, not an invalid date", () => {
    expect(calculateTrainingCompliance(input([cert("blank-expiry", "")])).courses[0])
      .toMatchObject({ state: "Valid, no expiry", chosenCertificate: { expiry: null } });
  });
  it.each([null, "", "   "])("a missing issue date %s is held with a warning, never invented", issued => {
    const result = calculateTrainingCompliance(input([{ ...cert("unknown-issue", null), issued }]));
    expect(result.status).toBe("complete");
    expect(result.courses[0]).toMatchObject({ state: "Valid, no expiry", complete: true,
      chosenCertificate: { issued: null }, issues: [expect.objectContaining({
        code: "ISSUE_DATE_NOT_RECORDED", message: "Issue date not recorded", blocking: false })] });
    expect(result.summary.mandatory.status).toBe("warning");
  });
  it.each([-1, 1.5, Number.NaN])("rejects invalid contract months %s", months => {
    const result = calculateTrainingCompliance({ ...input([cert("held", null)]), contractRangeEndMonths: months });
    expect(result.status).toBe("incomplete");
    expect(result.contractEnd).toBeNull();
    expect(result.summary.mandatory.status).toBe("incomplete");
  });
  it("sets malformed certificates aside without invalidating the remaining good certificate", () => {
    const result = calculateTrainingCompliance(input([cert("good", null), cert("bad", "invalid")]));
    expect(result.status).toBe("complete");
    expect(result.courses[0]).toMatchObject({ state: "Valid, no expiry", complete: true, validAtJoining: true,
      validThroughContract: true, chosenCertificate: { certificateUuid: "good" } });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_CERTIFICATE_DATES",
      certificateUuid: "bad", blocking: false, message: "Certificate dates invalid: correct the record" }));
    expect(result.summary.mandatory.status).toBe("warning");
  });
  it.each([
    ["2027-05-01", "Valid", true],
    ["2026-10-21", "Valid", true],
    [null, "Valid, no expiry", true],
    ["2026-10-20", "Expired at joining", false],
  ])("without contract end, keeps joining state for expiry %s", (expiry, state, atJoining) => {
    const result = calculateTrainingCompliance({ ...input([cert("held", expiry)]), contractRangeEndMonths: null });
    expect(result).toMatchObject({ status: "complete", contractEnd: null, contractEndStatus: "not_set" });
    expect(result.courses[0]).toMatchObject({ state, complete: true, validAtJoining: atJoining,
      validThroughContract: null, chosenCertificate: { certificateUuid: "held" } });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CONTRACT_END_NOT_SET",
      blocking: false, message: "Contract end not set: enter Contract End Range to check validity for the whole contract" }));
  });
  it("missing contract end never hides a missing certificate gap", () => {
    const result = calculateTrainingCompliance({ ...input(), contractRangeEndMonths: null });
    expect(result.status).toBe("complete");
    expect(result.courses[0].state).toBe("Not held");
    expect(result.summary.mandatory.status).toBe("gap");
  });
  it.each([
    cert("bad-expiry", "bad"),
  ])("all-invalid matching records are incomplete: $certificateUuid", invalid => {
    const result = calculateTrainingCompliance(input([invalid]));
    expect(result.status).toBe("incomplete");
    expect(result.courses[0]).toMatchObject({ state: null, complete: false, chosenCertificate: null });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_CERTIFICATE_DATES", blocking: true }));
  });
  it.each([
    cert("bad-issue", "2027-05-01", "course-a", "bad"),
    cert("bad-issue-permanent", null, "course-a", "bad"),
    cert("inverted", "2026-01-01", "course-a", "2026-02-01"),
  ])("invalid issue does not set aside a valid-expiry certificate: $certificateUuid", certificate => {
    const result = calculateTrainingCompliance(input([certificate]));
    expect(result.status).toBe("complete");
    expect(result.courses[0].chosenCertificate?.certificateUuid).toBe(certificate.certificateUuid);
    expect(result.courses[0].chosenCertificate?.issued).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_ISSUE_DATE",
      blocking: false, message: "Certificate dates invalid: correct the record" }));
  });
  it("an expired remaining certificate remains a gap, not incomplete or valid", () => {
    const result = calculateTrainingCompliance(input([cert("bad", "bad"), cert("expired", "2026-10-20")]));
    expect(result.status).toBe("complete");
    expect(result.courses[0]).toMatchObject({ state: "Expired at joining",
      chosenCertificate: { certificateUuid: "expired" } });
    expect(result.summary.mandatory.status).toBe("gap");
  });
  it("missing issue dates do not outrank longer validity or invent an issue date", () => {
    const result = calculateTrainingCompliance(input([cert("dated", "2026-12-01"),
      { ...cert("undated", "2027-05-01"), issued: null }]));
    expect(result.courses[0]).toMatchObject({ state: "Valid", chosenCertificate: {
      certificateUuid: "undated", issued: null } });
    expect(result.status).toBe("complete");
  });
  it("equal expiries with missing issue dates sort deterministically without throwing", () => {
    const result = calculateTrainingCompliance(input([
      { ...cert("b", "2027-05-01"), issued: null }, { ...cert("a", "2027-05-01"), issued: null }]));
    expect(result.status).toBe("complete");
    expect(result.courses[0].chosenCertificate?.certificateUuid).toBe("a");
  });
});
