import type { ComplianceInput, CourseState, TrainingCertificate } from "../../server/v2/shared/training-compliance/types";

const basic = "a3030000-0000-4000-8000-000000000001";
const advanced = "a3030000-0000-4000-8000-000000000002";
const specialist = "a3030000-0000-4000-8000-000000000003";
const certificate = (number: string, expiry: string | null, issued = "2026-01-01", courseUuid = basic): TrainingCertificate =>
  ({ certificateUuid: number, courseUuid, number, name: courseUuid === basic ? "Basic fire fighting"
    : courseUuid === advanced ? "Advanced fire fighting" : "Specialist fire fighting", issued, expiry });
const input = (certificates: TrainingCertificate[], changes: Partial<ComplianceInput> = {}): ComplianceInput => ({
  assignmentUuid: "synthetic-assignment", vesselUuid: "synthetic-vessel", contractRankUuid: "captured-rank",
  plannedJoiningDate: "2026-10-21", contractRangeEndMonths: 6, certificates,
  matrix: { revisionUuid: "synthetic-saved-r0", revision: "R0",
    requirements: [{ courseUuid: basic, name: "Basic fire fighting", obligation: "mandatory" }],
    equivalents: [{ requiredCourseUuid: basic, acceptedCourseUuid: advanced },
      { requiredCourseUuid: advanced, acceptedCourseUuid: specialist }] }, ...changes,
});
export type TrainingComplianceCase = {
  title: string;
  input: ComplianceInput;
  state: CourseState | null;
  chosen: string | null;
  end: string | null;
  complete: boolean;
  issue?: string;
};
const row = (title: string, value: ComplianceInput, state: CourseState | null, chosen: string | null,
  changes: Partial<TrainingComplianceCase> = {}): TrainingComplianceCase =>
  ({ title, input: value, state, chosen, end: "2027-04-21", complete: true, ...changes });
export const trainingComplianceCases: TrainingComplianceCase[] = [
  row("Direct certificate valid through contract", input([certificate("BF-1", "2027-05-01")]), "Valid", "BF-1"),
  row("Explicit accepted equivalent", input([certificate("AF-1", "2027-05-01", "2026-01-01", advanced)]), "Valid", "AF-1"),
  row("Two certificates: longest validity wins", input([certificate("BF-old", "2026-12-01"),
    certificate("BF-new", "2027-05-01")]), "Valid", "BF-new"),
  row("Longer equivalent beats shorter direct", input([certificate("BF-short", "2026-12-01"),
    certificate("AF-long", "2027-05-01", "2026-01-01", advanced)]), "Valid", "AF-long"),
  row("No expiry", input([certificate("BF-permanent", null)]), "Valid, no expiry", "BF-permanent"),
  row("No expiry wins over finite expiry", input([certificate("BF-finite", "2099-01-01"),
    certificate("BF-permanent", null)]), "Valid, no expiry", "BF-permanent"),
  row("Expiry on joining day is inclusive", input([certificate("BF-joining", "2026-10-21")]),
    "Expires during contract", "BF-joining"),
  row("Expiry on contract-end day is inclusive", input([certificate("BF-end", "2027-04-21")]), "Valid", "BF-end"),
  row("Expires between joining and contract end", input([certificate("BF-middle", "2026-12-01")]),
    "Expires during contract", "BF-middle"),
  row("Already expired at joining", input([certificate("BF-expired", "2026-10-20")]), "Expired at joining", "BF-expired"),
  row("No certificate held", input([]), "Not held", null),
  row("Future-issued certificate does not count", input([certificate("BF-future", "2027-05-01", "2026-10-22")]), "Not held", null),
  row("Future longer certificate ignored", input([certificate("BF-current", "2026-12-01"),
    certificate("BF-future", "2099-01-01", "2026-10-22")]), "Expires during contract", "BF-current"),
  row("Issue on joining day counts", input([certificate("BF-issued", "2027-05-01", "2026-10-21")]), "Valid", "BF-issued"),
  row("Calendar months clamp to February end", input([certificate("BF-Feb", "2027-02-28")],
    { plannedJoiningDate: "2027-01-31", contractRangeEndMonths: 1 }), "Valid", "BF-Feb", { end: "2027-02-28" }),
  row("Leap-year February end", input([certificate("BF-leap", "2028-02-29")],
    { plannedJoiningDate: "2028-01-31", contractRangeEndMonths: 1 }), "Valid", "BF-leap", { end: "2028-02-29" }),
  row("Contract end not set", input([certificate("BF-1", "2027-05-01")], { contractRangeEndMonths: null }),
    null, "BF-1", { end: null, complete: false, issue: "CONTRACT_END_NOT_SET" }),
  row("Contract rank not captured", input([certificate("BF-1", "2027-05-01")], { contractRankUuid: null }),
    null, null, { complete: false, issue: "MISSING_RANK" }),
  row("Planned joining date absent", input([certificate("BF-1", "2027-05-01")], { plannedJoiningDate: null }),
    null, null, { end: null, complete: false, issue: "MISSING_JOINING_DATE" }),
  row("Saved matrix unavailable", input([certificate("BF-1", "2027-05-01")], { matrix: null }),
    null, null, { complete: false, issue: "MISSING_MATRIX" }),
  row("Failed certificate calculation", input(null as unknown as TrainingCertificate[]),
    null, null, { end: null, complete: false, issue: "CALCULATION_FAILED" }),
  row("No transitive equivalence", input([certificate("SF-1", "2027-05-01", "2026-01-01", specialist)]), "Not held", null),
  row("Invalid expiry is not no-expiry", input([certificate("BF-invalid", "2026-02-30")]),
    null, null, { complete: false, issue: "INVALID_CERTIFICATE_DATES" }),
  row("Equal expiry: direct certificate wins", input([certificate("AF-tie", "2027-05-01", "2026-02-01", advanced),
    certificate("BF-tie", "2027-05-01")]), "Valid", "BF-tie"),
];
