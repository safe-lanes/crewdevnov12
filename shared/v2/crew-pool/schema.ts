import { pgTable, serial, text, boolean, timestamp, date, integer, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";

// ============================================
// STANDARD AUDIT COLUMNS (add to ALL tables)
// ============================================
export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  familyName: text("family_name").notNull(),
  gender: text("gender"),
  dob: date("dob"),
  nationalityUuid: text("nationality_uuid"),
  presentRank: text("present_rank"),
  rankAppliedFor: text("rank_applied_for"),
  status: text("status").default("active"),
  reason: text("reason"),
  isActive: boolean("is_active").default(true),
  uploadedPhoto: text("uploaded_photo"),
  sourceRecCanUuid: text("source_rec_can_uuid"),
  archivedAt: timestamp("archived_at"),
  ...auditColumns,
}, (table) => ({
  statusActiveIdx: index("idx_crew_members_status_active").on(table.status, table.isActive),
}));

// ============================================
// CREW ASSIGNMENTS (1 table)
// ============================================
export const crewAssignments = pgTable("crew_assignments", {
  id: serial("id").primaryKey(),
  assignUuid: text("assign_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  vesselUuid: text("vessel_uuid"),
  isCurrent: boolean("is_current").default(false),
  signOnDate: date("sign_on_date"),
  signOffDate: date("sign_off_date"),
  contractPeriod: integer("contract_period"),
  reliefDue: date("relief_due"),
  portOfJoiningUuid: text("port_of_joining_uuid"),
  portOfLeavingUuid: text("port_of_leaving_uuid"),
  assignmentType: text("assignment_type"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_assignments_crew_uuid").on(table.crewUuid),
  vesselUuidIdx: index("idx_crew_assignments_vessel_uuid").on(table.vesselUuid),
  currentIdx: index("idx_crew_assignments_current").on(table.isCurrent),
}));

// ============================================
// CREW PROFILE (6 tables)
// ============================================
export const crewVesselTypesApplied = pgTable("crew_vessel_types_applied", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull(),
  vesselTypeUuid: text("vessel_type_uuid"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_vessel_types_applied_crew_uuid").on(table.crewUuid),
}));

export const crewPersonalDetails = pgTable("crew_personal_details", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull().unique(),
  height: text("height"),
  weight: text("weight"),
  eyeColor: text("eye_color"),
  hairColor: text("hair_color"),
  shoeSize: text("shoe_size"),
  boilerSuitSize: text("boiler_suit_size"),
  safetyShoeSize: text("safety_shoe_size"),
  bloodType: text("blood_type"),
  englishLevel: text("english_level"),
  additionalLanguages: text("additional_languages"),
  religion: text("religion"),
  ...auditColumns,
});

export const crewAddresses = pgTable("crew_addresses", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull().unique(),
  permanentAddress: text("permanent_address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  countryUuid: text("country_uuid"),
  phoneHome: text("phone_home"),
  phoneMobile: text("phone_mobile"),
  email: text("email"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  ...auditColumns,
});

export const crewFamilyInfo = pgTable("crew_family_info", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull().unique(),
  maritalStatus: text("marital_status"),
  spouseName: text("spouse_name"),
  spouseDob: date("spouse_dob"),
  spouseNationality: text("spouse_nationality"),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  ...auditColumns,
});

export const crewChildren = pgTable("crew_children", {
  id: serial("id").primaryKey(),
  childUuid: text("child_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  childName: text("child_name"),
  childDob: date("child_dob"),
  childGender: text("child_gender"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_children_crew_uuid").on(table.crewUuid),
}));

export const crewNextOfKin = pgTable("crew_next_of_kin", {
  id: serial("id").primaryKey(),
  crewUuid: text("crew_uuid").notNull().unique(),
  nokName: text("nok_name"),
  nokRelationship: text("nok_relationship"),
  nokAddress: text("nok_address"),
  nokPhone: text("nok_phone"),
  nokEmail: text("nok_email"),
  ...auditColumns,
});

// ============================================
// DOCUMENTS & CERTIFICATES (10 tables)
// ============================================
export const crewDocuments = pgTable("crew_documents", {
  id: serial("id").primaryKey(),
  docUuid: text("doc_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  documentType: text("document_type"),
  documentNumber: text("document_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  issueCountryUuid: text("issue_country_uuid"),
  issuePlace: text("issue_place"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_documents_crew_uuid").on(table.crewUuid),
}));

export const crewDocumentsAttachments = pgTable("crew_documents_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  docUuid: text("doc_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  docUuidIdx: index("idx_crew_documents_attachments_doc_uuid").on(table.docUuid),
}));

export const crewVisas = pgTable("crew_visas", {
  id: serial("id").primaryKey(),
  visaUuid: text("visa_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  visaType: text("visa_type"),
  countryUuid: text("country_uuid"),
  visaNumber: text("visa_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_visas_crew_uuid").on(table.crewUuid),
}));

export const crewVisasAttachments = pgTable("crew_visas_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  visaUuid: text("visa_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  visaUuidIdx: index("idx_crew_visas_attachments_visa_uuid").on(table.visaUuid),
}));

export const crewEducation = pgTable("crew_education", {
  id: serial("id").primaryKey(),
  eduUuid: text("edu_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  educationLevel: text("education_level"),
  institution: text("institution"),
  fieldOfStudy: text("field_of_study"),
  graduationDate: date("graduation_date"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_education_crew_uuid").on(table.crewUuid),
}));

export const crewEducationAttachments = pgTable("crew_education_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  eduUuid: text("edu_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  eduUuidIdx: index("idx_crew_education_attachments_edu_uuid").on(table.eduUuid),
}));

export const crewLicenses = pgTable("crew_licenses", {
  id: serial("id").primaryKey(),
  licUuid: text("lic_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  licenseType: text("license_type"),
  licenseNumber: text("license_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  issueCountryUuid: text("issue_country_uuid"),
  issuePlace: text("issue_place"),
  grade: text("grade"),
  remarks: text("remarks"),
  archivedAt: timestamp("archived_at"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_licenses_crew_uuid").on(table.crewUuid),
  activeIdx: index("idx_crew_licenses_active").on(table.crewUuid, table.expiryDate),
}));

export const crewLicensesAttachments = pgTable("crew_licenses_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  licUuid: text("lic_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  licUuidIdx: index("idx_crew_licenses_attachments_lic_uuid").on(table.licUuid),
}));

export const crewTrainingCourses = pgTable("crew_training_courses", {
  id: serial("id").primaryKey(),
  trainUuid: text("train_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  courseName: text("course_name"),
  courseType: text("course_type"),
  institution: text("institution"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  issueCountryUuid: text("issue_country_uuid"),
  certificateNumber: text("certificate_number"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_training_courses_crew_uuid").on(table.crewUuid),
}));

export const crewTrainingAttachments = pgTable("crew_training_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  trainUuid: text("train_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  trainUuidIdx: index("idx_crew_training_attachments_train_uuid").on(table.trainUuid),
}));

// ============================================
// SEA SERVICE (2 tables)
// ============================================
export const crewSeaService = pgTable("crew_sea_service", {
  id: serial("id").primaryKey(),
  seaUuid: text("sea_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  serviceType: text("service_type"),
  vesselName: text("vessel_name"),
  vesselTypeUuid: text("vessel_type_uuid"),
  vesselImo: text("vessel_imo"),
  vesselFlag: text("vessel_flag"),
  vesselGrt: text("vessel_grt"),
  vesselDwt: text("vessel_dwt"),
  rankHeld: text("rank_held"),
  signOnDate: date("sign_on_date"),
  signOffDate: date("sign_off_date"),
  companyName: text("company_name"),
  tradeArea: text("trade_area"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_sea_service_crew_uuid").on(table.crewUuid),
  typeIdx: index("idx_crew_sea_service_type").on(table.crewUuid, table.serviceType),
}));

export const crewSeaServiceAttachments = pgTable("crew_sea_service_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  seaUuid: text("sea_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  seaUuidIdx: index("idx_crew_sea_service_attachments_sea_uuid").on(table.seaUuid),
}));

// ============================================
// MEDICAL (4 tables)
// ============================================
export const crewPreJoiningMedicals = pgTable("crew_pre_joining_medicals", {
  id: serial("id").primaryKey(),
  medUuid: text("med_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  medicalType: text("medical_type"),
  examDate: date("exam_date"),
  expiryDate: date("expiry_date"),
  result: text("result"),
  clinicName: text("clinic_name"),
  doctorName: text("doctor_name"),
  remarks: text("remarks"),
  vesselUuid: text("vessel_uuid"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_pre_joining_medicals_crew_uuid").on(table.crewUuid),
}));

export const crewMedicalAttachments = pgTable("crew_medical_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  medUuid: text("med_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  medUuidIdx: index("idx_crew_medical_attachments_med_uuid").on(table.medUuid),
}));

export const crewDoctorVisits = pgTable("crew_doctor_visits", {
  id: serial("id").primaryKey(),
  visitUuid: text("visit_uuid").notNull().unique(),
  crewUuid: text("crew_uuid").notNull(),
  visitDate: date("visit_date"),
  clinicName: text("clinic_name"),
  doctorName: text("doctor_name"),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  followUpDate: date("follow_up_date"),
  remarks: text("remarks"),
  ...auditColumns,
}, (table) => ({
  crewUuidIdx: index("idx_crew_doctor_visits_crew_uuid").on(table.crewUuid),
}));

export const crewDoctorVisitsAttachments = pgTable("crew_doctor_visits_attachments", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  visitUuid: text("visit_uuid").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  ...auditColumns,
}, (table) => ({
  visitUuidIdx: index("idx_crew_doctor_visits_attachments_visit_uuid").on(table.visitUuid),
}));
