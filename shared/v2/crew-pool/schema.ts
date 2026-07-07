import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

// ============================================
// STANDARD AUDIT COLUMNS (add to ALL tables)
// ============================================
export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// ============================================
// CREW CORE (1 table)
// ============================================
export const crewMembersV2 = pgTable("crew_members_v2", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull().unique(),
  empNo: text("emp_no").notNull().unique(),
  employeeId: text("employee_id").unique(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  gender: text("gender"),
  dob: text("dob"),
  nationalityUuid: text("nationality_uuid"),
  vesselTypeUuid: text("vessel_type_uuid"),
  presentRank: text("present_rank"),
  rankAppliedFor: text("rank_applied_for"),
  status: text("status"),
  recruitmentDate: text("recruitment_date"),
  availability: text("availability"),
  nextAvailability: text("next_availability"),
  isActive: boolean("is_active").default(true),
  uploadedPhoto: text("uploaded_photo"),
  sourceRecCanUuid: text("source_rec_can_uuid"),
  archivedAt: timestamp("archived_at"),
  // Termination mirror columns (latest termination summary; source of truth lives in crew_terminations)
  lastTerminationDate: text("last_termination_date"),
  lastTerminationReason: text("last_termination_reason"),
  lastTerminationCategory: text("last_termination_category"),
  terminationInitiatedBy: text("termination_initiated_by"),
  notForHire: boolean("not_for_hire").default(false),
  ...auditColumns,
});

// ============================================
// CREW TERMINATIONS (1 table)
// ============================================
export const crewTerminations = pgTable("crew_terminations", {
  id: serial("id").primaryKey(),
  termUuid: text("term_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  terminationDate: text("termination_date"),
  initiatedBy: text("initiated_by"),
  reason: text("reason"),
  category: text("category"),
  notForHire: boolean("not_for_hire").default(false),
  comments: text("comments"),
  // Server-derived submitter identity (from auth context). Display strings
  // are retained for historical reporting since name/role are looked up
  // outside of this DB (SAIL Audits) and may change over time.
  submittedByUserId: text("submitted_by_user_id"),
  submittedByName: text("submitted_by_name"),
  submittedByRole: text("submitted_by_role"),
  // Snapshots of identifiers at the time of termination (for retention reporting)
  rankIdSnapshot: text("rank_id_snapshot"),
  poolIdSnapshot: text("pool_id_snapshot"),
  manningAgentIdSnapshot: text("manning_agent_id_snapshot"),
  ...auditColumns,
});

// ============================================
// CREW ASSIGNMENTS (1 table)
// ============================================
export const crewAssignments = pgTable("crew_assignments", {
  id: serial("id").primaryKey(),
  assignUuid: text("assign_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselUuid: text("vessel_uuid"),
  lastVesselUuid: text("last_vessel_uuid"),
  isCurrent: boolean("is_current").default(false),
  signOnDate: text("sign_on_date"),
  signOffDate: text("sign_off_date"),
  contractPeriod: text("contract_period"),
  reliefDue: text("relief_due"),
  reason: text("reason"),
  portOfJoiningUuid: text("port_of_joining_uuid"),
  portOfLeavingUuid: text("port_of_leaving_uuid"),
  assignmentType: text("assignment_type"),
  ...auditColumns,
});

// ============================================
// CREW PROFILE (6 tables)
// ============================================
export const crewVesselTypesApplied = pgTable("crew_vessel_types_applied", {
  id: serial("id").primaryKey(),
  cvtaUuid: text("cvta_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselTypeUuid: text("vessel_type_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewPersonalDetails = pgTable("crew_personal_details", {
  id: serial("id").primaryKey(),
  cpdUuid: text("cpd_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  heightCm: text("height_cm"),
  weightKg: text("weight_kg"),
  bmi: text("bmi"),
  ageInYears: text("age_in_years"),
  placeOfBirthCity: text("place_of_birth_city"),
  placeOfBirthCountryUuid: text("place_of_birth_country_uuid"),
  nativeLanguageUuid: text("native_language_uuid"),
  foreignLanguages: text("foreign_languages"),
  englishProficiency: text("english_proficiency"),
  manningAgent: text("manning_agent"),
  crewPool: text("crew_pool"),
  availability: text("availability"),
  nextAvailability: text("next_availability"),
  ...auditColumns,
});

export const crewAddresses = pgTable("crew_addresses", {
  id: serial("id").primaryKey(),
  addrUuid: text("addr_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  countryOfResidenceUuid: text("country_of_residence_uuid"),
  nearestAirport: text("nearest_airport"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  contactLandline: text("contact_landline"),
  mobile: text("mobile"),
  email: text("email"),
  ...auditColumns,
});

export const crewFamilyInfo = pgTable("crew_family_info", {
  id: serial("id").primaryKey(),
  famUuid: text("fam_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
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

export const crewChildren = pgTable("crew_children", {
  id: serial("id").primaryKey(),
  childUuid: text("child_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  dob: text("dob"),
  gender: text("gender"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewNextOfKin = pgTable("crew_next_of_kin", {
  id: serial("id").primaryKey(),
  nokUuid: text("nok_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  familyName: text("family_name"),
  telephone: text("telephone"),
  email: text("email"),
  address: text("address"),
  relationship: text("relationship"),
  ...auditColumns,
});

// ============================================
// DOCUMENTS & ATTACHMENTS (4 tables)
// ============================================
export const crewDocuments = pgTable("crew_documents", {
  id: serial("id").primaryKey(),
  docUuid: text("doc_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
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

export const crewDocumentsAttachments = pgTable("crew_documents_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

export const crewVisas = pgTable("crew_visas", {
  id: serial("id").primaryKey(),
  visaUuid: text("visa_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  countryUuid: text("country_uuid"),
  country: text("country"),
  serialNo: text("serial_no"),
  issued: text("issued"),
  expiry: text("expiry"),
  visaType: text("visa_type"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewVisasAttachments = pgTable("crew_visas_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

// ============================================
// EDUCATION (2 tables)
// ============================================
export const crewEducation = pgTable("crew_education", {
  id: serial("id").primaryKey(),
  eduUuid: text("edu_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  dateOfCompletion: text("date_of_completion"),
  institution: text("institution"),
  subjectsField: text("subjects_field"),
  qualifications: text("qualifications"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewEducationAttachments = pgTable("crew_education_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

// ============================================
// LICENSES (2 tables)
// ============================================
export const crewLicenses = pgTable("crew_licenses", {
  id: serial("id").primaryKey(),
  licUuid: text("lic_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  licenseId: text("license_id"),
  certificateDocument: text("certificate_document"),
  abbr: text("abbr"),
  requirement: text("requirement"),
  certificateNo: text("certificate_no"),
  issuingAuthority: text("issuing_authority"),
  issuingCountryUuid: text("issuing_country_uuid"),
  issued: text("issued"),
  expiry: text("expiry"),
  archivedAt: timestamp("archived_at"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewLicensesAttachments = pgTable("crew_licenses_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

// ============================================
// TRAINING COURSES (2 tables)
// ============================================
export const crewTrainingCourses = pgTable("crew_training_courses", {
  id: serial("id").primaryKey(),
  trainUuid: text("train_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
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

export const crewTrainingAttachments = pgTable("crew_training_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

// ============================================
// SEA SERVICE (2 tables)
// ============================================
export const crewSeaService = pgTable("crew_sea_service", {
  id: serial("id").primaryKey(),
  seaUuid: text("sea_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  serviceType: text("service_type"),
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
  experienceCategories: text("experience_categories").array(),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewSeaServiceAttachments = pgTable("crew_sea_service_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
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

// ============================================
// MEDICAL (4 tables)
// ============================================
export const crewPreJoiningMedicals = pgTable("crew_pre_joining_medicals", {
  id: serial("id").primaryKey(),
  medUuid: text("med_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselUuid: text("vessel_uuid"),
  vesselName: text("vessel_name"),
  examinationDate: text("examination_date"),
  bp: text("bp"),
  weight: text("weight"),
  anyMedicationPrescribed: text("any_medication_prescribed"),
  clinicHospital: text("clinic_hospital"),
  fitForDuty: text("fit_for_duty"),
  expiryDate: text("expiry_date"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewMedicalAttachments = pgTable("crew_medical_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  medUuid: text("med_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewDoctorVisits = pgTable("crew_doctor_visits", {
  id: serial("id").primaryKey(),
  visitUuid: text("visit_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vessel: text("vessel"),
  port: text("port"),
  visitDate: text("visit_date"),
  doctorName: text("doctor_name"),
  clinicHospital: text("clinic_hospital"),
  reason: text("reason"),
  doctorComments: text("doctor_comments"),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  followUpDate: text("follow_up_date"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewDoctorVisitsAttachments = pgTable("crew_doctor_visits_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  visitUuid: text("visit_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

// ============================================
// G. BRIEFING & DE-BRIEFING (4 tables)
// ============================================
export const crewBriefings = pgTable("crew_briefings", {
  id: serial("id").primaryKey(),
  briefingUuid: text("briefing_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselUuid: text("vessel_uuid"),
  vesselName: text("vessel_name"),
  joiningRank: text("joining_rank"),
  dateSignOn: text("date_sign_on"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewBriefingAttachments = pgTable("crew_briefing_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  briefingUuid: text("briefing_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewDebriefings = pgTable("crew_debriefings", {
  id: serial("id").primaryKey(),
  debriefingUuid: text("debriefing_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselUuid: text("vessel_uuid"),
  vesselName: text("vessel_name"),
  rankServed: text("rank_served"),
  dateSignOn: text("date_sign_on"),
  dateSignedOff: text("date_signed_off"),
  reasonForSignOff: text("reason_for_sign_off"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const crewDebriefingAttachments = pgTable("crew_debriefing_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  debriefingUuid: text("debriefing_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});
