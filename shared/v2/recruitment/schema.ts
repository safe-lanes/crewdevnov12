import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// Common audit columns for all tables
export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// ============================================================================
// CANDIDATE CORE TABLES (7 tables)
// ============================================================================

export const recruitmentCandidates = pgTable("recruitment_candidates", {
  id: text("id").primaryKey(),
  recCanUuid: text("rec_can_uuid").unique().notNull(),
  fileNo: text("file_no"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  gender: text("gender"),
  dob: text("dob"),
  nationality: text("nationality"),
  nationalityUuid: text("nationality_uuid"),
  presentRank: text("present_rank"),
  rankAppliedFor: text("rank_applied_for"),
  vesselType: text("vessel_type"),
  status: text("status").default("Draft"),
  applicationData: text("application_data"),
  uploadedPhoto: text("uploaded_photo"),
  ...auditColumns,
});

export const candVesselTypesApplied = pgTable("cand_vessel_types_applied", {
  id: serial("id").primaryKey(),
  cvtaUuid: text("cvta_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  vesselTypeUuid: text("vessel_type_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candPersonalDetails = pgTable("cand_personal_details", {
  id: serial("id").primaryKey(),
  cpdUuid: text("cpd_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  heightCm: text("height_cm"),
  weightKg: text("weight_kg"),
  placeOfBirthCity: text("place_of_birth_city"),
  placeOfBirthCountryUuid: text("place_of_birth_country_uuid"),
  ageInYears: text("age_in_years"),
  nativeLanguageUuid: text("native_language_uuid"),
  foreignLanguages: text("foreign_languages"),
  englishProficiency: text("english_proficiency"),
  manningAgent: text("manning_agent"),
  ...auditColumns,
});

export const candAddresses = pgTable("cand_addresses", {
  id: serial("id").primaryKey(),
  addrUuid: text("addr_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  countryOfResidenceUuid: text("country_of_residence_uuid"),
  nearestAirport: text("nearest_airport"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  contactLandline: text("contact_landline"),
  mobile: text("mobile"),
  email: text("email"),
  ...auditColumns,
});

export const candFamilyInfo = pgTable("cand_family_info", {
  id: serial("id").primaryKey(),
  famUuid: text("fam_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  maritalStatus: text("marital_status"),
  numDependentChildren: text("num_dependent_children"),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  spouseFirstName: text("spouse_first_name"),
  spouseMiddleName: text("spouse_middle_name"),
  spouseFamilyName: text("spouse_family_name"),
  spouseDob: text("spouse_dob"),
  ...auditColumns,
});

export const candChildren = pgTable("cand_children", {
  id: serial("id").primaryKey(),
  childUuid: text("child_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  dob: text("dob"),
  gender: text("gender"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candNextOfKin = pgTable("cand_next_of_kin", {
  id: serial("id").primaryKey(),
  nokUuid: text("nok_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  telephone: text("telephone"),
  email: text("email"),
  address: text("address"),
  relationship: text("relationship"),
  ...auditColumns,
});

// ============================================================================
// DOCUMENTS & ATTACHMENTS (14 tables)
// ============================================================================

export const candDocuments = pgTable("cand_documents", {
  id: serial("id").primaryKey(),
  docUuid: text("doc_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  documentId: text("document_id"),
  documentName: text("document_name"),
  number: text("number"),
  issued: text("issued"),
  expiry: text("expiry"),
  issuingAuthority: text("issuing_authority"),
  issuingCountryUuid: text("issuing_country_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candDocumentsAttachments = pgTable("cand_documents_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  docUuid: text("doc_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candVisas = pgTable("cand_visas", {
  id: serial("id").primaryKey(),
  visaUuid: text("visa_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  countryUuid: text("country_uuid"),
  serialNo: text("serial_no"),
  issued: text("issued"),
  expiry: text("expiry"),
  visaType: text("visa_type"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candVisasAttachments = pgTable("cand_visas_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  visaUuid: text("visa_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candEducation = pgTable("cand_education", {
  id: serial("id").primaryKey(),
  eduUuid: text("edu_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  dateOfCompletion: text("date_of_completion"),
  institution: text("institution"),
  subjectsField: text("subjects_field"),
  qualifications: text("qualifications"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candEducationAttachments = pgTable("cand_education_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  eduUuid: text("edu_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candLicenses = pgTable("cand_licenses", {
  id: serial("id").primaryKey(),
  licUuid: text("lic_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  licenseId: text("license_id"),
  certificateDocument: text("certificate_document"),
  abbr: text("abbr"),
  requirement: text("requirement"),
  certificateNo: text("certificate_no"),
  issuingAuthority: text("issuing_authority"),
  issuingCountryUuid: text("issuing_country_uuid"),
  issued: text("issued"),
  expiry: text("expiry"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candLicensesAttachments = pgTable("cand_licenses_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  licUuid: text("lic_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candTrainingCourses = pgTable("cand_training_courses", {
  id: serial("id").primaryKey(),
  trainUuid: text("train_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  courseId: text("course_id"),
  trainingCourse: text("training_course"),
  abbr: text("abbr"),
  requirement: text("requirement"),
  certificateNo: text("certificate_no"),
  issuingAuthority: text("issuing_authority"),
  issuingCountryUuid: text("issuing_country_uuid"),
  issued: text("issued"),
  expiry: text("expiry"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candTrainingAttachments = pgTable("cand_training_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  trainUuid: text("train_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candSeaService = pgTable("cand_sea_service", {
  id: serial("id").primaryKey(),
  seaUuid: text("sea_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  vesselName: text("vessel_name"),
  vesselUuid: text("vessel_uuid"),
  vesselTypeUuid: text("vessel_type_uuid"),
  deadweight: text("deadweight"),
  engineTypePower: text("engine_type_power"),
  ownerOperator: text("owner_operator"),
  rank: text("rank"),
  fromDate: text("from_date"),
  toDate: text("to_date"),
  periodMonths: text("period_months"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candSeaServiceAttachments = pgTable("cand_sea_service_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  seaUuid: text("sea_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candAdditionalInfo = pgTable("cand_additional_info", {
  id: serial("id").primaryKey(),
  infoUuid: text("info_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  information: text("information"),
  response: text("response"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candAdditionalInfoAttachments = pgTable("cand_additional_info_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  infoUuid: text("info_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B1: Initial Screening (3 tables)
// ============================================================================

export const screeningB1Initial = pgTable("screening_b1_initial", {
  id: serial("id").primaryKey(),
  b1Uuid: text("b1_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  ageMeetsCriteria: text("age_meets_criteria"),
  rankMeetsCriteria: text("rank_meets_criteria"),
  certificatesValid: text("certificates_valid"),
  shortlisted: text("shortlisted"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB1Comments = pgTable("screening_b1_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b1Uuid: text("b1_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB1Attachments = pgTable("screening_b1_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b1Uuid: text("b1_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B2: References (4 tables)
// ============================================================================

export const screeningB2References = pgTable("screening_b2_references", {
  id: serial("id").primaryKey(),
  b2Uuid: text("b2_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  referencesCompleted: text("references_completed"),
  employerFeedback: text("employer_feedback"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB2ReferenceItems = pgTable("screening_b2_reference_items", {
  id: serial("id").primaryKey(),
  refUuid: text("ref_uuid").unique().notNull(),
  b2Uuid: text("b2_uuid").notNull(),
  refDate: text("ref_date"),
  nameDesignation: text("name_designation"),
  contactInfo: text("contact_info"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB2Comments = pgTable("screening_b2_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b2Uuid: text("b2_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB2Attachments = pgTable("screening_b2_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b2Uuid: text("b2_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B3: Security (4 tables)
// ============================================================================

export const screeningB3Security = pgTable("screening_b3_security", {
  id: serial("id").primaryKey(),
  b3Uuid: text("b3_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  checksCompleted: text("checks_completed"),
  results: text("results"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB3Authorities = pgTable("screening_b3_authorities", {
  id: serial("id").primaryKey(),
  authUuid: text("auth_uuid").unique().notNull(),
  b3Uuid: text("b3_uuid").notNull(),
  checkDate: text("check_date"),
  authority: text("authority"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB3Comments = pgTable("screening_b3_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b3Uuid: text("b3_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB3Attachments = pgTable("screening_b3_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b3Uuid: text("b3_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B4: Certificates (4 tables)
// ============================================================================

export const screeningB4Certificates = pgTable("screening_b4_certificates", {
  id: serial("id").primaryKey(),
  b4Uuid: text("b4_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  certificatesAuthenticated: text("certificates_authenticated"),
  results: text("results"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB4CertItems = pgTable("screening_b4_cert_items", {
  id: serial("id").primaryKey(),
  certUuid: text("cert_uuid").unique().notNull(),
  b4Uuid: text("b4_uuid").notNull(),
  authDate: text("auth_date"),
  certificate: text("certificate"),
  authority: text("authority"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB4Comments = pgTable("screening_b4_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b4Uuid: text("b4_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB4Attachments = pgTable("screening_b4_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b4Uuid: text("b4_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B5: Tests (4 tables)
// ============================================================================

export const screeningB5Tests = pgTable("screening_b5_tests", {
  id: serial("id").primaryKey(),
  b5Uuid: text("b5_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  testsCompleted: text("tests_completed"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB5TestItems = pgTable("screening_b5_test_items", {
  id: serial("id").primaryKey(),
  testUuid: text("test_uuid").unique().notNull(),
  b5Uuid: text("b5_uuid").notNull(),
  testDate: text("test_date"),
  subject: text("subject"),
  score: text("score"),
  result: text("result"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB5Comments = pgTable("screening_b5_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b5Uuid: text("b5_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB5Attachments = pgTable("screening_b5_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b5Uuid: text("b5_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B6: Interviews (4 tables)
// ============================================================================

export const screeningB6Interviews = pgTable("screening_b6_interviews", {
  id: serial("id").primaryKey(),
  b6Uuid: text("b6_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  interviewCompleted: text("interview_completed"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB6InterviewItems = pgTable("screening_b6_interview_items", {
  id: serial("id").primaryKey(),
  intUuid: text("int_uuid").unique().notNull(),
  b6Uuid: text("b6_uuid").notNull(),
  interviewDate: text("interview_date"),
  interviewerUuid: text("interviewer_uuid"),
  status: text("status"),
  result: text("result"),
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB6Comments = pgTable("screening_b6_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b6Uuid: text("b6_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB6Attachments = pgTable("screening_b6_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b6Uuid: text("b6_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B7: Training (2 tables)
// ============================================================================

export const screeningB7Training = pgTable("screening_b7_training", {
  id: serial("id").primaryKey(),
  b7Uuid: text("b7_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB7TrainingItems = pgTable("screening_b7_training_items", {
  id: serial("id").primaryKey(),
  trainItemUuid: text("train_item_uuid").unique().notNull(),
  b7Uuid: text("b7_uuid").notNull(),
  training: text("training"),
  identifiedByUuid: text("identified_by_uuid"),
  category: text("category"),
  dueDate: text("due_date"),
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// SCREENING B8: Shortlisting (4 tables)
// ============================================================================

export const screeningB8Shortlisting = pgTable("screening_b8_shortlisting", {
  id: serial("id").primaryKey(),
  b8Uuid: text("b8_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  shortlisted: text("shortlisted"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const screeningB8SelectedApprovers = pgTable("screening_b8_selected_approvers", {
  id: serial("id").primaryKey(),
  approverUuid: text("approver_uuid").unique().notNull(),
  b8Uuid: text("b8_uuid").notNull(),
  userUuid: text("user_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB8Comments = pgTable("screening_b8_comments", {
  id: serial("id").primaryKey(),
  commentUuid: text("comment_uuid").unique().notNull(),
  b8Uuid: text("b8_uuid").notNull(),
  fieldKey: text("field_key"),
  userUuid: text("user_uuid"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const screeningB8Attachments = pgTable("screening_b8_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").unique().notNull(),
  b8Uuid: text("b8_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================================================
// APPROVALS & DECISION (6 tables)
// ============================================================================

export const candApprovals = pgTable("cand_approvals", {
  id: serial("id").primaryKey(),
  approvalUuid: text("approval_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  approvalDate: text("approval_date"),
  approverUuid: text("approver_uuid"),
  status: text("status"),
  approvalResult: text("approval_result"),
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candSuitability = pgTable("cand_suitability", {
  id: serial("id").primaryKey(),
  suitUuid: text("suit_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  ...auditColumns,
});

export const candSuitabilityVesselTypes = pgTable("cand_suitability_vessel_types", {
  id: serial("id").primaryKey(),
  svtUuid: text("svt_uuid").unique().notNull(),
  suitUuid: text("suit_uuid").notNull(),
  vesselTypeUuid: text("vessel_type_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candSuitabilityFleetGroups = pgTable("cand_suitability_fleet_groups", {
  id: serial("id").primaryKey(),
  sfgUuid: text("sfg_uuid").unique().notNull(),
  suitUuid: text("suit_uuid").notNull(),
  fleetGroupUuid: text("fleet_group_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const candRecruitmentDecision = pgTable("cand_recruitment_decision", {
  id: serial("id").primaryKey(),
  decisionUuid: text("decision_uuid").unique().notNull(),
  recCanUuid: text("rec_can_uuid").notNull(),
  recruitmentStatus: text("recruitment_status"),
  submittedByUuid: text("submitted_by_uuid"),
  submittedDate: text("submitted_date"),
  ...auditColumns,
});

export const candAssignedGroups = pgTable("cand_assigned_groups", {
  id: serial("id").primaryKey(),
  cagUuid: text("cag_uuid").unique().notNull(),
  decisionUuid: text("decision_uuid").notNull(),
  groupUuid: text("group_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});
