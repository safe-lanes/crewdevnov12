/** Bump for any change to date, matching, selection or state semantics. */
export const TRAINING_COMPLIANCE_VERSION = "1.4.0";
export type CourseState = "Valid" | "Valid, no expiry" | "Expires during contract"
  | "Expired at joining" | "Not held" | "Expiry not recorded";
export type Obligation = "mandatory" | "recommended";
/** Existing reader issues block by default; explicitly nonblocking issues are warnings. */
export type CheckIssue = {
  code: string; message: string; courseUuid?: string; certificateUuid?: string; blocking?: boolean;
};
export type TrainingCertificate = {
  certificateUuid: string;
  courseUuid: string | null;
  name: string;
  number: string | null;
  issued: string | null;
  expiry: string | null;
  /** The certificate's own course master, including accepted equivalents. */
  certificateExpires?: boolean;
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
  contractPeriodMonths?: number | null;
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
  contractEndSource: "range_end" | "contract_period" | null;
  matrixRevisionUuid: string | null;
  matrixRevision: string | null;
  rankRequirementsSource: "current_company_rank_requirements";
  /** Complete means calculation finished, NOT that the crew member is compliant. */
  status: "complete" | "incomplete";
  issues: CheckIssue[];
  courses: CourseResult[];
  summary: { mandatory: GroupSummary; recommended: GroupSummary };
  unlinkedCertificateUuids: string[];
};
