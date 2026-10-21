/** Bump for any change to date, matching, selection or state semantics. */
export const TRAINING_COMPLIANCE_VERSION = "1.0.0";
export type CourseState = "Valid" | "Valid, no expiry" | "Expires during contract"
  | "Expired at joining" | "Not held";
export type Obligation = "mandatory" | "recommended";
export type CheckIssue = { code: string; message: string; courseUuid?: string };
export type TrainingCertificate = {
  certificateUuid: string;
  courseUuid: string | null;
  name: string;
  number: string | null;
  issued: string | null;
  expiry: string | null;
};
export type TrainingRequirement = { courseUuid: string; name: string; obligation: Obligation };
export type TrainingMatrix = {
  revisionUuid: string;
  revision: string;
  requirements: TrainingRequirement[];
  equivalents: { requiredCourseUuid: string; acceptedCourseUuid: string }[];
};
export type ComplianceInput = {
  assignmentUuid: string;
  vesselUuid: string;
  contractRankUuid: string | null;
  plannedJoiningDate: string | null;
  contractRangeEndMonths: number | null;
  matrix: TrainingMatrix | null;
  certificates: TrainingCertificate[];
  issues?: CheckIssue[];
};
export type CourseResult = TrainingRequirement & {
  calculationVersion: string;
  state: CourseState | null;
  complete: boolean;
  validAtJoining: boolean | null;
  validThroughContract: boolean | null;
  chosenCertificate: TrainingCertificate | null;
  isEquivalent: boolean | null;
  issues: CheckIssue[];
  futureIssuedCertificateUuids: string[];
};
export type GroupSummary = { status: "valid" | "warning" | "gap" | "incomplete"; count: number };
export type ComplianceResult = {
  calculationVersion: string;
  assignmentUuid: string;
  vesselUuid: string | null;
  contractRankUuid: string | null;
  joiningDate: string | null;
  contractEnd: string | null;
  contractEndStatus: "set" | "not_set" | "invalid";
  matrixRevisionUuid: string | null;
  matrixRevision: string | null;
  rankRequirementsSource: "current_company_rank_requirements";
  status: "complete" | "incomplete";
  issues: CheckIssue[];
  courses: CourseResult[];
  summary: { mandatory: GroupSummary; recommended: GroupSummary };
  unlinkedCertificateUuids: string[];
};
