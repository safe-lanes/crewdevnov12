import { civilDate, contractEndDate } from "./dates";
import { TRAINING_COMPLIANCE_VERSION as version, type ComplianceInput, type ComplianceResult,
  type CourseResult, type TrainingRequirement, type TrainingCertificate, type CheckIssue } from "./types";

export function incompleteTrainingCheck(input: { assignmentUuid: string; vesselUuid: string | null },
  issues: CheckIssue[]): ComplianceResult {
  return {
    calculationVersion: version, assignmentUuid: input.assignmentUuid, vesselUuid: input.vesselUuid,
    contractRankUuid: null, joiningDate: null, contractEnd: null, contractEndStatus: "not_set", contractEndSource: null,
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
    let issued = civilDate(cert.issued);
    const missingIssue = !cert.issued?.trim();
    if (missingIssue) issues.push({ code: "ISSUE_DATE_NOT_RECORDED", courseUuid: requirement.courseUuid,
      certificateUuid: cert.certificateUuid, blocking: false, message: "Issue date not recorded" });
    const expiry = cert.expiry?.trim() ? civilDate(cert.expiry) : null;
    const invalidIssue = (!missingIssue && !issued) || Boolean(expiry && issued && expiry < issued);
    if (invalidIssue) {
      issues.push({ code: "INVALID_ISSUE_DATE", courseUuid: requirement.courseUuid,
        certificateUuid: cert.certificateUuid, blocking: false, message: "Certificate dates invalid: correct the record" });
      issued = null;
    }
    if ((cert.expiry?.trim() && !expiry) || !cert.certificateUuid) {
      issues.push({ code: "INVALID_CERTIFICATE_DATES", courseUuid: requirement.courseUuid,
        certificateUuid: cert.certificateUuid, blocking: false,
        message: "Certificate dates invalid: correct the record" });
      continue;
    }
    if (issued && issued > joining) { future.push(cert.certificateUuid); continue; }
    if (!expiry && cert.certificateExpires !== false) issues.push({
      code: "EXPIRY_NOT_RECORDED", courseUuid: requirement.courseUuid,
      certificateUuid: cert.certificateUuid, blocking: false,
      message: "Expiry not recorded: enter the expiry date in crew profile → D3 Training Courses.",
    });
    candidates.push({ ...cert, issued, expiry });
  }
  // No-expiry wins; otherwise latest expiry. Direct wins only on an equal expiry,
  // then newest issue date, then stable ID. Never traverse equivalent links.
  candidates.sort((a, b) => {
    // Known validity at joining beats unknown expiry; an unknown expiry still
    // represents a held certificate rather than a proved-expired one.
    const quality = (c: TrainingCertificate) => c.expiry === null && c.certificateExpires !== false ? 1
      : c.expiry === null || c.expiry >= joining ? 2 : 0;
    const knownOrder = quality(b) - quality(a);
    if (knownOrder) return knownOrder;
    const expiryOrder = (b.expiry ?? "99999").localeCompare(a.expiry ?? "99999");
    return expiryOrder || Number(b.courseUuid === requirement.courseUuid) - Number(a.courseUuid === requirement.courseUuid)
      || (b.issued ?? "").localeCompare(a.issued ?? "") || a.certificateUuid.localeCompare(b.certificateUuid);
  });
  const chosen = candidates[0] ?? null;
  const unknownExpiry = chosen?.expiry === null && chosen.certificateExpires !== false;
  const validAtJoining = unknownExpiry ? null : chosen ? chosen.expiry === null || chosen.expiry >= joining : false;
  let state: CourseResult["state"] = !chosen ? "Not held" : !validAtJoining ? "Expired at joining"
    : chosen.expiry === null ? "Valid, no expiry" : !end ? "Valid"
      : chosen.expiry < end ? "Expires during contract" : "Valid";
  if (unknownExpiry) state = "Expiry not recorded";
  const months = input.contractRangeEndMonths ?? input.contractPeriodMonths;
  if (!end) issues.push({ code: months == null ? "CONTRACT_END_NOT_SET" : "INVALID_CONTRACT_END",
    courseUuid: requirement.courseUuid, blocking: months != null,
    message: months == null
      ? "Contract end not set: enter Contract End Range to check validity for the whole contract"
      : "The contract end cannot be calculated. Check the whole number of contract months and retry." });
  const invalidOnly = !chosen && issues.some(i => i.code === "INVALID_CERTIFICATE_DATES");
  if (invalidOnly) {
    for (const issue of issues) if (issue.code === "INVALID_CERTIFICATE_DATES") issue.blocking = true;
    state = null;
  }
  return { ...requirement, calculationVersion: version, state, complete: !issues.some(i => i.blocking !== false),
    validAtJoining: invalidOnly ? null : validAtJoining,
    validThroughContract: invalidOnly || !end || unknownExpiry ? null
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
    const months = input.contractRangeEndMonths ?? input.contractPeriodMonths;
    const explicitEnd = input.plannedContractEndDate !== undefined;
    const end = explicitEnd ? civilDate(input.plannedContractEndDate ?? null)
      : joining && months != null ? contractEndDate(joining, months) : null;
    const endStatus = explicitEnd ? input.plannedContractEndDate == null ? "not_set"
      : end && joining && end >= joining ? "set" : "invalid"
      : months == null ? "not_set" : end ? "set" : "invalid";
    const endSource = explicitEnd ? endStatus === "set" ? "planned_relief" : null
      : input.contractRangeEndMonths != null ? "range_end"
      : input.contractPeriodMonths != null ? "contract_period" : null;
    if (!end || endStatus === "invalid") issues.push({ code: endStatus === "not_set" ? "CONTRACT_END_NOT_SET" : "INVALID_CONTRACT_END",
      blocking: endStatus !== "not_set",
      message: endStatus === "not_set" ? "Contract end not set: enter Contract End Range to check validity for the whole contract"
        : explicitEnd ? "The planned relief date is invalid or earlier than today. Correct it in Planning and retry."
        : "The contract end cannot be calculated. Check the joining date and whole number of contract months, then retry." });
    const courses = input.contractRankUuid && joining && input.matrix
      ? input.matrix.requirements.map(r => courseResult(r, input, joining, end)) : [];
    issues.push(...courses.flatMap(c => c.issues));
    const complete = !issues.some(i => i.blocking !== false);
    const summary = (obligation: "mandatory" | "recommended") => {
      const group = courses.filter(c => c.obligation === obligation);
      const status = !complete ? "incomplete" : group.some(c => ["Not held", "Expired at joining"].includes(c.state!)) ? "gap"
        : group.some(c => c.state === "Expires during contract" || c.state === "Expiry not recorded" || c.issues.some(i => i.blocking === false))
          || (group.length > 0 && endStatus === "not_set") ? "warning" : "valid";
      return { status, count: group.length } as ComplianceResult["summary"]["mandatory"];
    };
    return { ...incompleteTrainingCheck(input, issues), contractRankUuid: input.contractRankUuid, joiningDate: joining,
      contractEnd: end, contractEndStatus: endStatus, contractEndSource: endSource, matrixRevisionUuid: input.matrix?.revisionUuid ?? null,
      matrixRevision: input.matrix?.revision ?? null, status: complete ? "complete" : "incomplete", courses,
      summary: { mandatory: summary("mandatory"), recommended: summary("recommended") },
      unlinkedCertificateUuids: input.certificates.filter(c => !c.courseUuid).map(c => c.certificateUuid).sort() };
  } catch {
    return incompleteTrainingCheck(input, [{ code: "CALCULATION_FAILED",
      message: "The training check could not finish. Retry it; if it fails again, contact your office." }]);
  }
}
