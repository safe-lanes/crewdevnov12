import { civilDate, contractEndDate } from "./dates";
import { TRAINING_COMPLIANCE_VERSION as version, type ComplianceInput, type ComplianceResult,
  type CourseResult, type TrainingRequirement, type TrainingCertificate, type CheckIssue } from "./types";

export function incompleteTrainingCheck(input: { assignmentUuid: string; vesselUuid: string | null },
  issues: CheckIssue[]): ComplianceResult {
  return {
    calculationVersion: version, assignmentUuid: input.assignmentUuid, vesselUuid: input.vesselUuid,
    contractRankUuid: null, joiningDate: null, contractEnd: null, contractEndStatus: "not_set",
    matrixRevisionUuid: null, matrixRevision: null,
    rankRequirementsSource: "current_company_rank_requirements", status: "incomplete", issues, courses: [],
    summary: { mandatory: { status: "incomplete", count: 0 }, recommended: { status: "incomplete", count: 0 } },
    unlinkedCertificateUuids: [],
  };
}

function courseResult(requirement: TrainingRequirement, input: ComplianceInput,
  joining: string, end: string | null): CourseResult {
  const alternatives = new Set(input.matrix!.equivalents
    .filter(l => l.requiredCourseUuid === requirement.courseUuid).map(l => l.acceptedCourseUuid));
  const candidates: TrainingCertificate[] = [];
  const issues: CheckIssue[] = [], future: string[] = [];
  for (const cert of input.certificates) {
    if (!cert.courseUuid || (cert.courseUuid !== requirement.courseUuid && !alternatives.has(cert.courseUuid))) continue;
    const issued = civilDate(cert.issued);
    if (issued && issued > joining) { future.push(cert.certificateUuid); continue; }
    const expiry = cert.expiry?.trim() ? civilDate(cert.expiry) : null;
    if (!issued || (cert.expiry?.trim() && !expiry) || (expiry && expiry < issued) || !cert.certificateUuid) {
      issues.push({ code: "INVALID_CERTIFICATE_DATES", courseUuid: requirement.courseUuid,
        message: `Check the issue and expiry dates on ${cert.name || requirement.name}, then retry the training check.` });
      continue;
    }
    candidates.push({ ...cert, issued, expiry });
  }
  // No-expiry wins; otherwise latest expiry. Direct wins only on an equal expiry,
  // then newest issue date, then stable ID. Never traverse equivalent links.
  candidates.sort((a, b) => {
    const expiryOrder = (b.expiry ?? "99999").localeCompare(a.expiry ?? "99999");
    return expiryOrder || Number(b.courseUuid === requirement.courseUuid) - Number(a.courseUuid === requirement.courseUuid)
      || b.issued!.localeCompare(a.issued!) || a.certificateUuid.localeCompare(b.certificateUuid);
  });
  const chosen = candidates[0] ?? null;
  const validAtJoining = chosen ? chosen.expiry === null || chosen.expiry >= joining : false;
  let state: CourseResult["state"] = !chosen ? "Not held" : !validAtJoining ? "Expired at joining"
    : !end ? null : chosen.expiry === null ? "Valid, no expiry"
      : chosen.expiry < end ? "Expires during contract" : "Valid";
  if (!end) issues.push({ code: input.contractRangeEndMonths == null ? "CONTRACT_END_NOT_SET" : "INVALID_CONTRACT_END",
    courseUuid: requirement.courseUuid, message: input.contractRangeEndMonths == null
      ? "Contract end not set. Enter the reliever's contract range-end months and retry the check."
      : "The contract end cannot be calculated. Check the whole number of contract months and retry." });
  const invalidDates = issues.some(i => i.code === "INVALID_CERTIFICATE_DATES");
  if (invalidDates) state = null;
  return { ...requirement, calculationVersion: version, state, complete: issues.length === 0,
    validAtJoining: invalidDates ? null : validAtJoining,
    validThroughContract: invalidDates || !end ? null
      : chosen ? validAtJoining && (chosen.expiry === null || chosen.expiry >= end) : false,
    chosenCertificate: chosen, isEquivalent: chosen ? chosen.courseUuid !== requirement.courseUuid : null,
    issues, futureIssuedCertificateUuids: future.sort() };
}

/** Pure read-only calculation. No current date, names-as-identity or persistence. */
export function calculateTrainingCompliance(input: ComplianceInput): ComplianceResult {
  try {
    const issues = [...(input.issues ?? [])];
    const joining = civilDate(input.plannedJoiningDate);
    if (!input.contractRankUuid) issues.push({ code: "MISSING_RANK",
      message: "Contract rank was not recorded at Deploy. Record the contract rank and retry the check." });
    if (!joining) issues.push({ code: input.plannedJoiningDate ? "INVALID_JOINING_DATE" : "MISSING_JOINING_DATE",
      message: "The reliever's planned joining date is missing or invalid. Set it and retry the check." });
    if (!input.matrix) issues.push({ code: "MISSING_MATRIX",
      message: "No saved training matrix is available for this vessel. Ask the office to publish one, then retry." });
    const end = joining && input.contractRangeEndMonths != null ? contractEndDate(joining, input.contractRangeEndMonths) : null;
    const endStatus = input.contractRangeEndMonths == null ? "not_set" : end ? "set" : "invalid";
    if (!end) issues.push({ code: endStatus === "not_set" ? "CONTRACT_END_NOT_SET" : "INVALID_CONTRACT_END",
      message: endStatus === "not_set" ? "Contract end not set. Enter the reliever's contract range-end months and retry the check."
        : "The contract end cannot be calculated. Check the joining date and whole number of contract months, then retry." });
    const courses = input.contractRankUuid && joining && input.matrix
      ? input.matrix.requirements.map(r => courseResult(r, input, joining, end)) : [];
    issues.push(...courses.flatMap(c => c.issues));
    const complete = issues.length === 0;
    const summary = (obligation: "mandatory" | "recommended") => {
      const group = courses.filter(c => c.obligation === obligation);
      const status = !complete ? "incomplete" : group.some(c => ["Not held", "Expired at joining"].includes(c.state!)) ? "gap"
        : group.some(c => c.state === "Expires during contract") ? "warning" : "valid";
      return { status, count: group.length } as ComplianceResult["summary"]["mandatory"];
    };
    return { ...incompleteTrainingCheck(input, issues), contractRankUuid: input.contractRankUuid, joiningDate: joining,
      contractEnd: end, contractEndStatus: endStatus, matrixRevisionUuid: input.matrix?.revisionUuid ?? null,
      matrixRevision: input.matrix?.revision ?? null, status: complete ? "complete" : "incomplete", courses,
      summary: { mandatory: summary("mandatory"), recommended: summary("recommended") },
      unlinkedCertificateUuids: input.certificates.filter(c => !c.courseUuid).map(c => c.certificateUuid).sort() };
  } catch {
    return incompleteTrainingCheck(input, [{ code: "CALCULATION_FAILED",
      message: "The training check could not finish. Retry it; if it fails again, contact your office." }]);
  }
}
