export interface CandidateCore {
  id?: number;
  recCanUuid: string;
  fileNo: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dob: string;
  nationalityUuid: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  uploadedPhoto: string;
}

export interface CandidateVesselType {
  id?: number;
  cvtaUuid: string;
  recCanUuid: string;
  vesselTypeUuid: string;
  sortOrder: number;
}

export interface CandidatePersonalDetails {
  id?: number;
  cpdUuid: string;
  recCanUuid: string;
  heightCm: string;
  weightKg: string;
  placeOfBirthCity: string;
  placeOfBirthCountryUuid: string;
  ageInYears: string;
  nativeLanguageUuid: string;
  foreignLanguages: string;
  englishProficiency: string;
  manningAgent: string;
}

export interface CandidateAddress {
  id?: number;
  addrUuid: string;
  recCanUuid: string;
  countryOfResidenceUuid: string;
  nearestAirport: string;
  addressLine1: string;
  addressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
}

export interface CandidateFamilyInfo {
  id?: number;
  famUuid: string;
  recCanUuid: string;
  maritalStatus: string;
  numDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDob: string;
}

export interface CandidateChild {
  id?: number;
  childUuid: string;
  recCanUuid: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dob: string;
  gender: string;
  sortOrder: number;
}

export interface CandidateNextOfKin {
  id?: number;
  nokUuid: string;
  recCanUuid: string;
  firstName: string;
  middleName: string;
  familyName: string;
  telephone: string;
  email: string;
  address: string;
  relationship: string;
}

export interface CandidateDocument {
  id?: number;
  docUuid: string;
  recCanUuid: string;
  documentId: string;
  documentName: string;
  number: string;
  issued: string;
  expiry: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateVisa {
  id?: number;
  visaUuid: string;
  recCanUuid: string;
  countryUuid: string;
  serialNo: string;
  issued: string;
  expiry: string;
  visaType: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateEducation {
  id?: number;
  eduUuid: string;
  recCanUuid: string;
  dateOfCompletion: string;
  institution: string;
  subjectsField: string;
  qualifications: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateLicense {
  id?: number;
  licUuid: string;
  recCanUuid: string;
  licenseId: string;
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  issued: string;
  expiry: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateTrainingCourse {
  id?: number;
  trainUuid: string;
  recCanUuid: string;
  courseId: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  issued: string;
  expiry: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateSeaService {
  id?: number;
  seaUuid: string;
  recCanUuid: string;
  vesselName: string;
  vesselUuid: string;
  vesselTypeUuid: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  fromDate: string;
  toDate: string;
  periodMonths: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface CandidateAdditionalInfo {
  id?: number;
  infoUuid: string;
  recCanUuid: string;
  information: string;
  response: string;
  sortOrder: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id?: number;
  attUuid: string;
  parentUuid: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  fileData: string;
  uploadedByUuid: string;
  sortOrder: number;
}

export interface ScreeningB1 {
  id?: number;
  b1Uuid: string;
  recCanUuid: string;
  ageMeetsCriteria: string;
  rankMeetsCriteria: string;
  certificatesValid: string;
  shortlisted: string;
  submittedByUuid: string;
  submittedDate: string;
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface ScreeningB2 {
  id?: number;
  b2Uuid: string;
  recCanUuid: string;
  referencesCompleted: string;
  employerFeedback: string;
  submittedByUuid: string;
  submittedDate: string;
  referenceItems?: ReferenceItem[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface ReferenceItem {
  id?: number;
  refUuid: string;
  b2Uuid: string;
  refDate: string;
  nameDesignation: string;
  contactInfo: string;
  sortOrder: number;
}

export interface ScreeningB3 {
  id?: number;
  b3Uuid: string;
  recCanUuid: string;
  checksCompleted: string;
  results: string;
  submittedByUuid: string;
  submittedDate: string;
  authorities?: AuthorityItem[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface AuthorityItem {
  id?: number;
  authUuid: string;
  b3Uuid: string;
  checkDate: string;
  authority: string;
  sortOrder: number;
}

export interface ScreeningB4 {
  id?: number;
  b4Uuid: string;
  recCanUuid: string;
  certificatesAuthenticated: string;
  results: string;
  submittedByUuid: string;
  submittedDate: string;
  certItems?: CertItem[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface CertItem {
  id?: number;
  certUuid: string;
  b4Uuid: string;
  authDate: string;
  certificate: string;
  authority: string;
  sortOrder: number;
}

export interface ScreeningB5 {
  id?: number;
  b5Uuid: string;
  recCanUuid: string;
  testsCompleted: string;
  submittedByUuid: string;
  submittedDate: string;
  testItems?: TestItem[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface TestItem {
  id?: number;
  testUuid: string;
  b5Uuid: string;
  testDate: string;
  subject: string;
  score: string;
  result: string;
  sortOrder: number;
}

export interface ScreeningB6 {
  id?: number;
  b6Uuid: string;
  recCanUuid: string;
  interviewCompleted: string;
  submittedByUuid: string;
  submittedDate: string;
  interviewItems?: InterviewItem[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface InterviewItem {
  id?: number;
  intUuid: string;
  b6Uuid: string;
  interviewDate: string;
  interviewerUuid: string;
  status: string;
  result: string;
  comments: string;
  sortOrder: number;
}

export interface ScreeningB7 {
  id?: number;
  b7Uuid: string;
  recCanUuid: string;
  submittedByUuid: string;
  submittedDate: string;
  trainingItems?: TrainingItem[];
}

export interface TrainingItem {
  id?: number;
  trainItemUuid: string;
  b7Uuid: string;
  training: string;
  identifiedByUuid: string;
  category: string;
  dueDate: string;
  comments: string;
  sortOrder: number;
}

export interface ScreeningB8 {
  id?: number;
  b8Uuid: string;
  recCanUuid: string;
  shortlisted: string;
  submittedByUuid: string;
  submittedDate: string;
  selectedApprovers?: SelectedApprover[];
  comments?: ScreeningComment[];
  attachments?: Attachment[];
}

export interface SelectedApprover {
  id?: number;
  selUuid: string;
  b8Uuid: string;
  approverUuid: string;
  sortOrder: number;
}

export interface ScreeningComment {
  id?: number;
  commentUuid: string;
  parentUuid: string;
  fieldKey: string;
  userUuid: string;
  commentText: string;
  sortOrder: number;
}

export interface CandidateApproval {
  id?: number;
  appUuid: string;
  recCanUuid: string;
  approvalDate: string;
  approverUuid: string;
  status: string;
  approval: string;
  comments: string;
  sortOrder: number;
}

export interface CandidateSuitability {
  id?: number;
  suitUuid: string;
  recCanUuid: string;
  vesselTypes?: SuitabilityVesselType[];
  fleetGroups?: SuitabilityFleetGroup[];
}

export interface SuitabilityVesselType {
  id?: number;
  svtUuid: string;
  suitUuid: string;
  vesselTypeUuid: string;
  sortOrder: number;
}

export interface SuitabilityFleetGroup {
  id?: number;
  sfgUuid: string;
  suitUuid: string;
  fleetGroupUuid: string;
  sortOrder: number;
}

export interface CandidateRecruitmentDecision {
  id?: number;
  decUuid: string;
  recCanUuid: string;
  recruitmentStatus: string;
  submittedByUuid: string;
  submittedDate: string;
  assignedGroups?: AssignedGroup[];
}

export interface AssignedGroup {
  id?: number;
  agUuid: string;
  decUuid: string;
  groupUuid: string;
  sortOrder: number;
}

export interface V2CandidateListItem {
  id: number;
  recCanUuid: string;
  fileNo: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dob: string;
  nationalityUuid: string;
  nationality: string;
  vesselType: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type FormSection = 
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' 
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8'
  | 'C1' | 'C2' | 'C3';
