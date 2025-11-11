
import { pgTable, text, integer, boolean, timestamp, varchar, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
});

export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("appraisal"), // 'appraisal' or 'promotion'
  rankGroup: text("rank_group").notNull(),
  versionNo: text("version_no").notNull(),
  versionDate: text("version_date").notNull(),
  configuration: text("configuration"), // JSON string for form configuration
});

export const rankGroups = pgTable("rank_groups", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => forms.id),
  name: text("name").notNull(),
  ranks: text("ranks").notNull(), // JSON string
});

export const availableRanks = pgTable("available_ranks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Senior Officers, Junior Officers, Ratings, etc.
  rankId: text("rank_id"), // User-editable rank ID (e.g., "S1", "S2")
  label: text("label"), // User-editable label (e.g., "Master", "2nd Off")
  applicableToCompany: boolean("applicable_to_company"), // User-editable company applicability
  sortOrder: integer("sort_order").default(0), // For drag-and-drop reordering
});

export const crewMembers = pgTable("crew_members", {
  id: text("id").primaryKey(),
  
  // Basic Personal Information
  empNo: text("emp_no"), // Employee Number
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  familyName: text("family_name"), // Changed from lastName to match form
  dateOfBirth: text("date_of_birth"), // DOB
  age: text("age"), // Age in years
  nationality: text("nationality").notNull(),
  
  // Rank and Employment
  presentRank: text("present_rank").notNull(), // Changed from rank to match form
  rankAppliedFor: text("rank_applied_for"),
  employeeId: text("employee_id"), // From form
  
  // Vessel Information
  presentVessel: text("present_vessel").notNull(), // Changed from vessel
  vesselType: text("vessel_type").notNull(),
  lastVessel: text("last_vessel"),
  
  // Contract and Status
  status: text("status"), // On Leave, Available, etc.
  joiningDate: text("joining_date"), // Changed from signOnDate
  signOnDate: text("sign_on_date"), // Keep both for backward compatibility
  signOffDate: text("sign_off_date"),
  contractPeriod: text("contract_period"),
  reliefDue: text("relief_due"),
  reason: text("reason"), // For sign-off reason
  availability: text("availability"),
  
  // Contact Information
  email: text("email"),
  mobile: text("mobile"),
  contactLandline: text("contact_landline"),
  
  // Address Information
  countryOfResidence: text("country_of_residence"),
  nearestAirport: text("nearest_airport"),
  residentialAddressLine1: text("residential_address_line1"),
  residentialAddressLine2: text("residential_address_line2"),
  
  // Physical Information
  placeOfBirthCity: text("place_of_birth_city"),
  placeOfBirthCountry: text("place_of_birth_country"),
  heightCm: text("height_cm"),
  weightKg: text("weight_kg"),
  bmi: text("bmi"),
  
  // Language and Personal Details
  nativeLanguage: text("native_language"),
  foreignLanguages: text("foreign_languages"),
  englishProficiency: text("english_proficiency"),
  maritalStatus: text("marital_status"),
  numberOfDependentChildren: text("number_of_dependent_children"),
  
  // Family Information
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  spouseFirstName: text("spouse_first_name"),
  spouseMiddleName: text("spouse_middle_name"),
  spouseFamilyName: text("spouse_family_name"),
  spouseDateOfBirth: text("spouse_date_of_birth"),
  
  // Next of Kin Information
  nokFirstName: text("nok_first_name"),
  nokMiddleName: text("nok_middle_name"),
  nokFamilyName: text("nok_family_name"),
  nokTelephone: text("nok_telephone"),
  nokEmail: text("nok_email"),
  nokAddress: text("nok_address"),
  nokRelationship: text("nok_relationship"),
  
  // Additional Information
  manningAgent: text("manning_agent"),
  vesselTypes: text("vessel_types"), // JSON array of vessel types
  
  // Complex Data as JSON
  documents: text("documents"), // JSON array of documents
  visas: text("visas"), // JSON array of visas
  education: text("education"), // JSON array of education records
  licenses: text("licenses"), // JSON array of licenses
  trainingCourses: text("training_courses"), // JSON array of training courses
  currentCompanySeaService: text("current_company_sea_service"), // JSON array
  externalSeaService: text("external_sea_service"), // JSON array
  preJoiningMedicals: text("pre_joining_medicals"), // JSON array
  doctorVisits: text("doctor_visits"), // JSON array
  children: text("children"), // JSON array of children information
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appraisalResults = pgTable("appraisal_results", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
  formId: integer("form_id").notNull().references(() => forms.id),
  appraisalType: text("appraisal_type").notNull(),
  appraisalDate: text("appraisal_date").notNull(),
  appraisalData: text("appraisal_data").notNull(), // JSON string
  competenceRating: text("competence_rating"),
  behavioralRating: text("behavioral_rating"),
  overallRating: text("overall_rating"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull().default("draft"), // draft, submitted, approved
});

export const recruitmentCandidates = pgTable("recruitment_candidates", {
  id: text("id").primaryKey(),
  fileNo: text("file_no").notNull().unique(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  familyName: text("family_name").notNull(),
  dob: text("dob").notNull(),
  nationality: text("nationality").notNull(),
  rankAppliedFor: text("rank_applied_for").notNull(),
  presentRank: text("present_rank").notNull(),
  vesselType: text("vessel_type").notNull(),
  status: text("status").notNull().default("Draft"), // Draft, Applied, Screening, For Approval, Recruited, Waitlisted, Rejected
  applicationData: text("application_data"), // JSON string for comprehensive form data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vessels = pgTable("vessels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vesselGroup: text("vessel_group"),
  vesselType: text("vessel_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselGroups = pgTable("vessel_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  vesselIds: text("vessel_ids").notNull(), // JSON array of vessel IDs from master data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselDrafts = pgTable("vessel_drafts", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull().default("R1"),
  draftData: text("draft_data").notNull(), // JSON string of vessel rank data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselRevisions = pgTable("vessel_revisions", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull(), // R0, R1, R2, etc.
  revisionDate: text("revision_date").notNull(), // Mandatory field in dd/mm/yyyy format
  revisionData: text("revision_data").notNull(), // JSON string of finalized vessel rank data
  createdAt: timestamp("created_at").defaultNow(),
});

export const seafarers = pgTable("seafarers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  rank: text("rank").notNull(),
  nationality: text("nationality").notNull(),
  status: text("status").notNull().default("Available"), // Available, Assigned, On Leave
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const revisions = pgTable("revisions", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  revisionNo: text("revision_no").notNull(),
  flexDate: text("flex_date"),
  status: text("status").notNull().default("draft"), // draft, submitted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselRanks = pgTable("vessel_ranks", {
  id: serial("id").primaryKey(),
  vesselId: integer("vessel_id").notNull().references(() => vessels.id),
  revisionId: integer("revision_id").notNull().references(() => revisions.id),
  rank: text("rank").notNull(),
  rankId: text("rank_id").notNull(),
  role: text("role"), // Role name like "3rd Off_1", "3rd Off_2"
  originalRankId: text("original_rank_id"), // ID of original rank for role rows
  isRoleRow: boolean("is_role_row").default(false),
  officer: boolean("officer").default(false),
  rating: boolean("rating").default(false),
  seniorOfficer: boolean("senior_officer").default(false),
  deckOfficer: boolean("deck_officer").default(false),
  engOfficer: boolean("eng_officer").default(false),
  pettyOfficer: boolean("petty_officer").default(false),
  deckRating: boolean("deck_rating").default(false),
  engineRating: boolean("engine_rating").default(false),
  generalRating: boolean("general_rating").default(false),
  cateringRating: boolean("catering_rating").default(false),
  safetyOfficer: boolean("safety_officer").default(false),
  sso: boolean("sso").default(false),
  medicalOfficer: boolean("medical_officer").default(false),
  navigatingOfficer: boolean("navigating_officer").default(false),
  emtOfficer: boolean("emt_officer").default(false),
  actualManning: text("actual_manning"), // JSON string for selected seafarers
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyRanks = pgTable("company_ranks", {
  id: text("id").primaryKey(), // Will use generated IDs like "5_role_1_1727188561"
  rank: text("rank").notNull(),
  rankId: text("rank_id").notNull(),
  role: text("role"), // Role name like "3rd Off_1", "3rd Off_2"
  originalRankId: text("original_rank_id"), // ID of original rank for role rows
  isRoleRow: boolean("is_role_row").default(false),
  officer: boolean("officer").default(false),
  rating: boolean("rating").default(false),
  seniorOfficer: boolean("senior_officer").default(false),
  deckOfficer: boolean("deck_officer").default(false),
  engOfficer: boolean("eng_officer").default(false),
  pettyOfficer: boolean("petty_officer").default(false),
  deckRating: boolean("deck_rating").default(false),
  engineRating: boolean("engine_rating").default(false),
  generalRating: boolean("general_rating").default(false),
  cateringRating: boolean("catering_rating").default(false),
  safetyOfficer: boolean("safety_officer").default(false),
  sso: boolean("sso").default(false),
  medicalOfficer: boolean("medical_officer").default(false),
  navigatingOfficer: boolean("navigating_officer").default(false),
  emtOfficer: boolean("emt_officer").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const promotionHierarchies = pgTable("promotion_hierarchies", {
  id: serial("id").primaryKey(),
  groupName: text("group_name").notNull(), // e.g., "Deck Officers", "Engine Officers"
  rankPath: text("rank_path").notNull(), // JSON array of rank labels in progression order
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dataMasters = pgTable("data_masters", {
  id: text("id").primaryKey(), // "001", "002", "003", etc.
  name: text("name").notNull(), // "Nationality Master", "Country Master"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const masterDataEntries = pgTable("master_data_entries", {
  id: serial("id").primaryKey(),
  masterId: text("master_id").notNull().references(() => dataMasters.id),
  entryId: text("entry_id").notNull(),
  nuid: text("nuid"),
  name: text("name").notNull(), 
  description: text("description"),
  countryName: text("countryName"),
  country: text("country"),
  cid: text("cid"),
  countryCode: text("countryCode"),
  nationality: text("nationality"),
  countryRefId: text("countryRefId"),
  vtuid: text("vtuid"),
  vesselType: text("vesselType"),
  tanker: boolean("tanker").default(false),
  oilTanker: boolean("oilTanker").default(false),
  gasTanker: boolean("gasTanker").default(false),
  chemicalTanker: boolean("chemicalTanker").default(false),
  bulk: boolean("bulk").default(false),
  isActive: boolean("isActive").default(true),
  isDeleted: boolean("isDeleted").default(false),
  createdBy: text("createdBy"),
  domain: text("domain"),
  orderBy: integer("orderBy"),
  // Fleet Groups specific fields (masterId 015)
  fuid: text("fuid"),
  managerId: text("managerId"),
  // Additional Groups Master (ID 016) fields
  aguid: text("aguid"),
  userId: text("userId"),
  vesselIds: text("vesselIds"), // JSON string for vessel IDs array
  // Vessel Owners Master (ID 017) fields
  vouid: text("vouid"),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  nameOfContactPerson: text("nameOfContactPerson"),
  // Designation Master (ID 012) fields
  duid: text("duid"),
  shortCode: text("shortCode"),
  type: text("type"),
  department: text("department"),
  // User Master (ID 013) fields
  uuid: text("uuid"),
  lastname: text("lastname"),
  firstname: text("firstname"),
  addressLine1: text("addressLine1"),
  addressLine2: text("addressLine2"),
  addressLine3: text("addressLine3"),
  city: text("city"),
  state: text("state"),
  zipcode: text("zipcode"),
  loginId: text("loginId"),
  roleId: text("roleId"),
  designationId: text("designationId"),
  profilePic: text("profilePic"),
  userType: text("userType"),
  departmentId: text("departmentId"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ID Counters table for auto-generating sequential IDs
export const idCounters = pgTable("id_counters", {
  id: serial("id").primaryKey(),
  counterType: text("counter_type").notNull().unique(), // 'crew_id', 'employee_id', etc.
  currentValue: integer("current_value").notNull().default(0), // Current highest number used
  prefix: text("prefix").notNull(), // 'A' for crew, 'E' for employee, etc.
  format: text("format").notNull().default("000000"), // Padding format, e.g., "000000" for 6 digits
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselPlanning = pgTable("vessel_planning", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  rankId: text("rank_id").notNull(),
  rank: text("rank").notNull(),
  
  // Foreign key to crew member - SINGLE SOURCE OF TRUTH
  crewMemberId: text("crew_member_id"), // References crewMembers.id or employeeId
  
  // On Board Status
  onBoardCrewId: text("on_board_crew_id"), // DEPRECATED - use crewMemberId instead
  onBoardCrewName: text("on_board_crew_name"), // DEPRECATED - join with crewMembers
  onBoardCrewNationality: text("on_board_crew_nationality"), // DEPRECATED - join with crewMembers
  reliefDue: text("relief_due"),
  signOffDate: text("sign_off_date"),
  signOffPort: text("sign_off_port"),
  reliefStatus: text("relief_status"),
  
  // Reliever Status
  relieverCrewId: text("reliever_crew_id"),
  relieverCrewName: text("reliever_crew_name"), // DEPRECATED - join with crewMembers
  relieverNationality: text("reliever_nationality"), // DEPRECATED - join with crewMembers
  joiningDate: text("joining_date"),
  joiningPort: text("joining_port"),
  joiningStatus: text("joining_status"),
  contractPeriodMonths: integer("contract_period_months"),
  contractEndRangeStartMonths: integer("contract_end_range_start_months"),
  contractEndRangeEndMonths: integer("contract_end_range_end_months"),
  deploymentChecklistCompleted: boolean("deployment_checklist_completed"),
  applicableDocsChecked: boolean("applicable_docs_checked"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rotationPlans = pgTable("rotation_plans", {
  id: serial("id").primaryKey(),
  draftId: text("draft_id").notNull(),
  lastEdited: text("last_edited").notNull(),
  vessels: text("vessels").notNull(), // JSON array of vessel names
  crew: text("crew").notNull(), // Comma-separated crew roles (e.g., "Master, Chief Officer")
  planFromDate: text("plan_from_date").notNull(),
  planToDate: text("plan_to_date").notNull(),
  createdBy: text("created_by").notNull(),
  planStatus: text("plan_status").notNull().default("In Draft"), // In Draft, Proposed, Partially Approved, Approved, Rejected, Archived
  proposedBy: text("proposed_by"), // Who proposed the plan
  proposedDate: text("proposed_date"), // When it was proposed
  assignments: text("assignments"), // JSON array: [{vesselName, rank, crewId, crewName, joiningDate, contractPeriod, proposalStatus, proposedBy, proposedDate, deployedDate, deployedBy}]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const drugAlcoholTestRecords = pgTable("drug_alcohol_test_records", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // VSL-XXX format from master data
  testType: text("test_type").notNull(), // 'annual', 'periodic', 'monthly', 'post-incident', 'others'
  
  // Part A - General Information
  alcoholDrugType: text("alcohol_drug_type"), // JSON array: ["Alcohol"] or ["Drug"] or ["Alcohol", "Drug"]
  placeLocation: text("place_location"), // Test location/port
  dateTimeTestCompleted: text("date_time_test_completed"), // Format: "31 May 2023 - 1010 Hours"
  externalTestResultsDate: text("external_test_results_date"), // Date external lab results received
  incidentId: text("incident_id"), // For linking to Incident Module
  
  // Part B2 - Testing Equipment (stored as JSON for simplicity during development)
  // Will be normalized to separate table in production
  testingEquipment: text("testing_equipment"), // JSON array of equipment entries
  equipmentNotApplicable: boolean("equipment_not_applicable").default(false), // N/A checkbox
  
  // Test history as JSON array: [{ date, port, violations }, ...]
  // Stores up to last 3 test records
  testHistory: text("test_history"), // JSON: [{date: "31 May 2023", port: "Punta Gorda", violations: 0}, ...]
  
  // Frequency (in months) - 12 for annual, 3 for periodic, 1 for monthly
  frequencyMonths: integer("frequency_months").notNull().default(12),
  
  // Planned test information (from Plan popup)
  plannedPort: text("planned_port"),
  plannedDate: text("planned_date"),
  plannedComments: text("planned_comments"),
  
  // Post-incident specific fields
  incidentTitle: text("incident_title"),
  incidentDateTime: text("incident_date_time"), // Format: "31 May 2023 - 1010 Hours"
  alcoholTestDateTime: text("alcohol_test_date_time"),
  drugTestDateTime: text("drug_test_date_time"),
  violations: integer("violations").default(0), // Number of violations found during test
  
  // Other tests specific fields
  testDateTime: text("test_date_time"), // Format: "31 May 2023 - 1010 Hours"
  otherTestType: text("other_test_type"), // "Alcohol" or "Drug" for other tests
  reasonForTesting: text("reason_for_testing"),
  description: text("description"),
  initiatedBy: text("initiated_by"), // Free text e.g., "Vessel - Master", "Office - HSQ Dept."
  
  // Part B - Personnel Details
  personnelTested: text("personnel_tested"), // JSON array: [{id, rank, name, alcoholTest: {checked, date, time}, alcoholResults, alcoholViolation, drugTest: {checked, date, time}, drugResults, drugViolation, witness}]
  comments: text("comments"), // Comments section
  masterDeputySignature: text("master_deputy_signature"), // JSON: {confirmed: boolean, name: string, date: string}
  attachmentFile: text("attachment_file"), // Filename for uploaded document
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const restHoursVesselRecords = pgTable("rest_hours_vessel_records", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  vesselName: text("vessel_name").notNull(), // Vessel name
  month: text("month").notNull(), // Format: "Feb-2025" (MMM-YYYY)
  monthValue: text("month_value").notNull(), // Format: "2025-02" (YYYY-MM) for filtering/sorting
  
  // Aggregated data from crew records
  totalCrew: integer("total_crew").notNull().default(0),
  recordingStatusPercent: integer("recording_status_percent").notNull().default(0), // 0-100
  activityConflicting: boolean("activity_conflicting").notNull().default(false), // Yes/No
  crewWithActivityConflicts: integer("crew_with_activity_conflicts").notNull().default(0),
  crewWithActivityConflictsDetails: text("crew_with_activity_conflicts_details"), // JSON array: [{name: string, rank: string}]
  totalViolations: integer("total_violations").notNull().default(0),
  crewWithViolations: integer("crew_with_violations").notNull().default(0),
  crewWithViolationsDetails: text("crew_with_violations_details"), // JSON array: [{name: string, rank: string}]
  totalNCs: integer("total_ncs").notNull().default(0), // Non-conformities
  crewWithNCs: integer("crew_with_ncs").notNull().default(0),
  crewWithNCsDetails: text("crew_with_ncs_details"), // JSON array: [{name: string, rank: string}]
  predictedViolations: integer("predicted_violations").notNull().default(0),
  crewWithPredictedViolations: integer("crew_with_predicted_violations").notNull().default(0),
  crewWithPredictedViolationsDetails: text("crew_with_predicted_violations_details"), // JSON array: [{name: string, rank: string}]
  predictedNCs: integer("predicted_ncs").notNull().default(0),
  crewWithPredictedNCs: integer("crew_with_predicted_ncs").notNull().default(0),
  crewWithPredictedNCsDetails: text("crew_with_predicted_ncs_details"), // JSON array: [{name: string, rank: string}]
  vesselReviewStatus: text("vessel_review_status").notNull().default("Due"), // "Completed", "Due", "Overdue"
  vesselReviewSubmittedDate: timestamp("vessel_review_submitted_date"), // When vessel submitted their review
  officeReviewStatus: text("office_review_status").notNull().default("Due"), // "Completed", "Due", "Overdue"
  officeReviewSubmittedDate: timestamp("office_review_submitted_date"), // When office submitted their review
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const restHoursCrewRecords = pgTable("rest_hours_crew_records", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  vesselName: text("vessel_name").notNull(), // Vessel name
  crewMemberId: text("crew_member_id").notNull(), // Crew member ID
  rank: text("rank").notNull(), // Crew member rank
  name: text("name").notNull(), // Full name (First Middle Last)
  month: text("month").notNull(), // Format: "Feb-2025" (MMM-YYYY)
  monthValue: text("month_value").notNull(), // Format: "2025-02" (YYYY-MM) for filtering/sorting
  
  // Partial month info for sign on/off
  signOnOffInfo: text("sign_on_off_info"), // e.g., "S.Off / 14th" or "S.On / 12th"
  
  // Individual crew member data
  recordingStatusPercent: integer("recording_status_percent").notNull().default(0), // 0-100
  activityConflicting: boolean("activity_conflicting").notNull().default(false), // Yes/No
  totalViolations: integer("total_violations").notNull().default(0),
  totalNCs: integer("total_ncs").notNull().default(0), // Non-conformities
  predictedViolations: integer("predicted_violations").notNull().default(0),
  predictedNCs: integer("predicted_ncs").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const restHoursDailyRecords = pgTable("rest_hours_daily_records", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull(), // Reference to crew member
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  rank: text("rank").notNull(), // Rank at time of recording
  name: text("name").notNull(), // Full name for display
  monthYear: text("month_year").notNull(), // Format: "2024-03" (YYYY-MM)
  
  // Daily records stored as JSON
  // Structure: [{
  //   day: 1-31, 
  //   dayOfWeek: "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun",
  //   hours: ["w"|"d"|"a"|"", ...], // 48 entries (2 per hour for 00:00-23:30), blank string = rest
  //   isPlan: boolean, // True if this is planned hours (grey), false if recorded
  //   comments: string,
  //   violations: [1,2,3,...], // array of violation code numbers
  //   hoursOfRest24hr: number, // Auto-calculated hours of rest in 24hr period
  //   hoursOfWork24hr: number, // Auto-calculated hours of work in 24hr period  
  //   hoursOfRest48hr: number, // Rolling 48hr window
  //   hoursOfWork48hr: number,
  //   hoursOfRest7day: number, // Rolling 7-day window
  //   hoursOfWork7day: number,
  //   hoursOfRest96hr: number, // Rolling 96hr window (4 days)
  //   hoursOfWork96hr: number
  // }]
  dailyRecords: text("daily_records").notNull(), // JSON array of daily records
  
  // Form settings
  showPlanning: boolean("show_planning").default(false),
  opaMode: boolean("opa_mode").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselViolationComments = pgTable("vessel_violation_comments", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  monthValue: text("month_value").notNull(), // Format: "2025-11" (YYYY-MM)
  comment: text("comment"), // Vessel comments, explanations, corrective actions
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const officeViolationComments = pgTable("office_violation_comments", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  monthValue: text("month_value").notNull(), // Format: "2025-11" (YYYY-MM)
  comment: text("comment"), // Office comments, explanations, corrective actions
  
  reviewerName: text("reviewer_name"), // Office reviewer name
  reviewerPosition: text("reviewer_position"), // Office reviewer position
  reviewDate: timestamp("review_date"), // Date of office review
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ncReports = pgTable("nc_reports", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull(), // Crew member ID
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  rank: text("rank").notNull(), // Crew member's rank
  monthValue: text("month_value").notNull(), // Format: "2025-11" (YYYY-MM)
  
  ncReference: text("nc_reference").notNull().default("STCW/MLC/ILO"), // Always STCW/MLC/ILO
  
  identifiedRootCause: text("identified_root_cause"), // User input
  immediateCorrectiveAction: text("immediate_corrective_action"), // User input
  preventiveAction: text("preventive_action"), // User input
  
  preventiveActionStatus: text("preventive_action_status").notNull().default("Pending"), // "Pending" | "Completed"
  preventiveActionDueDate: timestamp("preventive_action_due_date"), // Due date for preventive action
  preventiveActionDateCompleted: timestamp("preventive_action_date_completed"), // Date when preventive action was completed
  
  officeClosureVerifiedByName: text("office_closure_verified_by_name"), // Office user name
  officeClosureVerifiedByPosition: text("office_closure_verified_by_position"), // Auto-filled position
  officeClosureDate: timestamp("office_closure_date"), // Date of office closure
  
  status: text("status").notNull().default("Open"), // "Open" | "Closed"
  submissionStatus: text("submission_status").notNull().default("draft"), // "draft" | "vessel-submitted" | "office-submitted"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fixedTasks = pgTable("fixed_tasks", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull(), // Reference to crew member
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  rank: text("rank").notNull(), // Rank at time of recording
  name: text("name").notNull(), // Full name for display
  monthYear: text("month_year").notNull(), // Format: "2025-10" (YYYY-MM)
  
  // Fixed task hours for Sea and Port (48 entries each)
  // Each entry is a 30-minute slot: ["w"|"d"|"", ...]
  // "w" = watch duty, "d" = day work, "" = rest
  seaHours: text("sea_hours").notNull(), // JSON array of 48 entries
  portHours: text("port_hours").notNull(), // JSON array of 48 entries
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselDateLineAdjustments = pgTable("vessel_dateline_adjustments", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(), // Vessel ID from master data
  monthValue: text("month_value").notNull(), // Format: "2025-11" (YYYY-MM)
  
  // JSON array of date line adjustments: [{ day: 15, type: "advanced" | "retarded" }, ...]
  adjustments: text("adjustments").notNull(), // JSON: [{day: number, type: string}]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFormSchema = createInsertSchema(forms).pick({
  name: true,
  category: true,
  rankGroup: true,
  versionNo: true,
  versionDate: true,
  configuration: true,
});

export const insertRankGroupSchema = createInsertSchema(rankGroups).pick({
  formId: true,
  name: true,
  ranks: true,
});

export const insertAvailableRankSchema = createInsertSchema(availableRanks).pick({
  name: true,
  category: true,
  rankId: true,
  label: true,
  applicableToCompany: true,
  sortOrder: true,
});

export const updateAvailableRankSchema = createInsertSchema(availableRanks).pick({
  name: true,
  category: true,
  rankId: true,
  label: true,
  applicableToCompany: true,
  sortOrder: true,
}).partial();

export const insertCrewMemberSchema = createInsertSchema(crewMembers).pick({
  // Basic Personal Information
  empNo: true,
  firstName: true,
  middleName: true,
  familyName: true, // Changed from lastName
  dateOfBirth: true,
  age: true,
  nationality: true,
  
  // Rank and Employment
  presentRank: true, // Changed from rank
  rankAppliedFor: true,
  employeeId: true,
  
  // Vessel Information
  presentVessel: true, // Changed from vessel
  vesselType: true,
  lastVessel: true,
  
  // Contract and Status
  status: true,
  joiningDate: true,
  signOnDate: true, // Keep for backward compatibility
  signOffDate: true,
  contractPeriod: true,
  reliefDue: true,
  reason: true,
  availability: true,
  
  // Contact Information
  email: true,
  mobile: true,
  contactLandline: true,
  
  // Address Information
  countryOfResidence: true,
  nearestAirport: true,
  residentialAddressLine1: true,
  residentialAddressLine2: true,
  
  // Physical Information
  placeOfBirthCity: true,
  placeOfBirthCountry: true,
  heightCm: true,
  weightKg: true,
  bmi: true,
  
  // Language and Personal Details
  nativeLanguage: true,
  foreignLanguages: true,
  englishProficiency: true,
  maritalStatus: true,
  numberOfDependentChildren: true,
  
  // Family Information
  fatherName: true,
  motherName: true,
  spouseFirstName: true,
  spouseMiddleName: true,
  spouseFamilyName: true,
  spouseDateOfBirth: true,
  
  // Next of Kin Information
  nokFirstName: true,
  nokMiddleName: true,
  nokFamilyName: true,
  nokTelephone: true,
  nokEmail: true,
  nokAddress: true,
  nokRelationship: true,
  
  // Additional Information
  manningAgent: true,
  vesselTypes: true,
  
  // Complex Data as JSON
  documents: true,
  visas: true,
  education: true,
  licenses: true,
  trainingCourses: true,
  currentCompanySeaService: true,
  externalSeaService: true,
  preJoiningMedicals: true,
  doctorVisits: true,
  children: true,
});

export const insertAppraisalResultSchema = createInsertSchema(appraisalResults).pick({
  crewMemberId: true,
  formId: true,
  appraisalType: true,
  appraisalDate: true,
  appraisalData: true,
  competenceRating: true,
  behavioralRating: true,
  overallRating: true,
  submittedBy: true,
  status: true,
});

export const insertRecruitmentCandidateSchema = createInsertSchema(recruitmentCandidates).pick({
  id: true,
  fileNo: true,
  firstName: true,
  middleName: true,
  familyName: true,
  dob: true,
  nationality: true,
  rankAppliedFor: true,
  presentRank: true,
  vesselType: true,
  status: true,
  applicationData: true,
});

export const insertVesselSchema = createInsertSchema(vessels).pick({
  name: true,
  vesselGroup: true,
  vesselType: true,
});

export const insertVesselGroupSchema = createInsertSchema(vesselGroups).pick({
  name: true,
  description: true,
  vesselIds: true,
});

export const insertVesselDraftSchema = createInsertSchema(vesselDrafts).pick({
  vesselId: true,
  revision: true,
  draftData: true,
});

export const insertVesselRevisionSchema = createInsertSchema(vesselRevisions).pick({
  vesselId: true,
  revision: true,
  revisionDate: true,
  revisionData: true,
}).extend({
  revisionDate: z.string()
    .min(1, "Revision date is required")
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in dd/mm/yyyy format")
    .refine((dateStr) => {
      // Validate that it's an actual valid date
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      );
    }, {
      message: "Invalid date - please provide a valid date in dd/mm/yyyy format"
    })
});

export const insertSeafarerSchema = createInsertSchema(seafarers).pick({
  firstName: true,
  middleName: true,
  lastName: true,
  rank: true,
  nationality: true,
  status: true,
});

export const insertRevisionSchema = createInsertSchema(revisions).pick({
  vesselId: true,
  revisionNo: true,
  flexDate: true,
  status: true,
});

export const insertVesselRankSchema = createInsertSchema(vesselRanks).pick({
  vesselId: true,
  revisionId: true,
  rank: true,
  rankId: true,
  role: true,
  originalRankId: true,
  isRoleRow: true,
  officer: true,
  rating: true,
  seniorOfficer: true,
  deckOfficer: true,
  engOfficer: true,
  pettyOfficer: true,
  deckRating: true,
  engineRating: true,
  generalRating: true,
  cateringRating: true,
  safetyOfficer: true,
  sso: true,
  medicalOfficer: true,
  navigatingOfficer: true,
  emtOfficer: true,
  actualManning: true,
});

export const insertCompanyRankSchema = createInsertSchema(companyRanks).pick({
  id: true,
  rank: true,
  rankId: true,
  role: true,
  originalRankId: true,
  isRoleRow: true,
  officer: true,
  rating: true,
  seniorOfficer: true,
  deckOfficer: true,
  engOfficer: true,
  pettyOfficer: true,
  deckRating: true,
  engineRating: true,
  generalRating: true,
  cateringRating: true,
  safetyOfficer: true,
  sso: true,
  medicalOfficer: true,
  navigatingOfficer: true,
  emtOfficer: true,
});

export const insertPromotionHierarchySchema = createInsertSchema(promotionHierarchies).pick({
  groupName: true,
  rankPath: true,
  isActive: true,
}).extend({
  rankPath: z.union([
    z.string(), // Accept string from database
    z.array(z.string()) // Accept array from frontend
  ]).transform((val) => {
    // Normalize to string for database storage
    if (Array.isArray(val)) {
      return JSON.stringify(val);
    }
    return val;
  })
});

export const insertDataMasterSchema = createInsertSchema(dataMasters).pick({
  id: true,
  name: true,
  description: true,
});

export const insertMasterDataEntrySchema = createInsertSchema(masterDataEntries).pick({
  masterId: true,
  entryId: true,
  nuid: true,
  name: true,
  description: true,
  countryName: true,
  country: true,
  cid: true,
  countryCode: true,
  nationality: true,
  countryRefId: true,
  vtuid: true,
  vesselType: true,
  tanker: true,
  oilTanker: true,
  gasTanker: true,
  chemicalTanker: true,
  bulk: true,
  isActive: true,
  isDeleted: true,
  createdBy: true,
  domain: true,
  orderBy: true,
  fuid: true,
  managerId: true,
  aguid: true,
  userId: true,
  vesselIds: true,
  vouid: true,
  address: true,
  email: true,
  phone: true,
  company: true,
  nameOfContactPerson: true,
  duid: true,
  shortCode: true,
  type: true,
  department: true,
  uuid: true,
  lastname: true,
  firstname: true,
  addressLine1: true,
  addressLine2: true,
  addressLine3: true,
  city: true,
  state: true,
  zipcode: true,
  loginId: true,
  roleId: true,
  designationId: true,
  profilePic: true,
  userType: true,
  departmentId: true,
});

export const insertIdCounterSchema = createInsertSchema(idCounters).pick({
  counterType: true,
  currentValue: true,
  prefix: true,
  format: true,
});

export const insertVesselPlanningSchema = createInsertSchema(vesselPlanning).pick({
  vesselId: true,
  rankId: true,
  rank: true,
  onBoardCrewId: true,
  onBoardCrewName: true,
  onBoardCrewNationality: true,
  reliefDue: true,
  signOffDate: true,
  signOffPort: true,
  reliefStatus: true,
  relieverCrewId: true,
  relieverCrewName: true,
  relieverNationality: true,
  joiningDate: true,
  joiningPort: true,
  joiningStatus: true,
  contractPeriodMonths: true,
  contractEndRangeStartMonths: true,
  contractEndRangeEndMonths: true,
  deploymentChecklistCompleted: true,
  applicableDocsChecked: true,
});

export const insertRotationPlanSchema = createInsertSchema(rotationPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrugAlcoholTestRecordSchema = createInsertSchema(drugAlcoholTestRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestHoursVesselRecordSchema = createInsertSchema(restHoursVesselRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestHoursCrewRecordSchema = createInsertSchema(restHoursCrewRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestHoursDailyRecordSchema = createInsertSchema(restHoursDailyRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFixedTaskSchema = createInsertSchema(fixedTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVesselViolationCommentSchema = createInsertSchema(vesselViolationComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfficeViolationCommentSchema = createInsertSchema(officeViolationComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  reviewDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export const insertNCReportSchema = createInsertSchema(ncReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  preventiveActionDueDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  preventiveActionDateCompleted: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  officeClosureDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof forms.$inferSelect;
export type InsertRankGroup = z.infer<typeof insertRankGroupSchema>;
export type RankGroup = typeof rankGroups.$inferSelect;
export type InsertAvailableRank = z.infer<typeof insertAvailableRankSchema>;
export type UpdateAvailableRank = z.infer<typeof updateAvailableRankSchema>;
export type AvailableRank = typeof availableRanks.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertAppraisalResult = z.infer<typeof insertAppraisalResultSchema>;
export type AppraisalResult = typeof appraisalResults.$inferSelect;
export type InsertRecruitmentCandidate = z.infer<typeof insertRecruitmentCandidateSchema>;
export type RecruitmentCandidate = typeof recruitmentCandidates.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertVesselGroup = z.infer<typeof insertVesselGroupSchema>;
export type VesselGroup = typeof vesselGroups.$inferSelect;
export type InsertVesselDraft = z.infer<typeof insertVesselDraftSchema>;
export type VesselDraft = typeof vesselDrafts.$inferSelect;
export type InsertVesselRevision = z.infer<typeof insertVesselRevisionSchema>;
export type VesselRevision = typeof vesselRevisions.$inferSelect;
export type InsertSeafarer = z.infer<typeof insertSeafarerSchema>;
export type Seafarer = typeof seafarers.$inferSelect;
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;
export type InsertVesselRank = z.infer<typeof insertVesselRankSchema>;
export type VesselRank = typeof vesselRanks.$inferSelect;
export type InsertCompanyRank = z.infer<typeof insertCompanyRankSchema>;
export type CompanyRank = typeof companyRanks.$inferSelect;
export type InsertPromotionHierarchy = z.infer<typeof insertPromotionHierarchySchema>;
export type PromotionHierarchy = typeof promotionHierarchies.$inferSelect;
export type InsertIdCounter = z.infer<typeof insertIdCounterSchema>;
export type IdCounter = typeof idCounters.$inferSelect;
export type InsertDataMaster = z.infer<typeof insertDataMasterSchema>;
export type DataMaster = typeof dataMasters.$inferSelect;
export type InsertMasterDataEntry = z.infer<typeof insertMasterDataEntrySchema>;
export type MasterDataEntry = typeof masterDataEntries.$inferSelect;
export type InsertVesselPlanning = z.infer<typeof insertVesselPlanningSchema>;
export type VesselPlanning = typeof vesselPlanning.$inferSelect;
export type InsertRotationPlan = z.infer<typeof insertRotationPlanSchema>;
export type RotationPlan = typeof rotationPlans.$inferSelect;
export type InsertDrugAlcoholTestRecord = z.infer<typeof insertDrugAlcoholTestRecordSchema>;
export type DrugAlcoholTestRecord = typeof drugAlcoholTestRecords.$inferSelect;
export type InsertRestHoursVesselRecord = z.infer<typeof insertRestHoursVesselRecordSchema>;
export type RestHoursVesselRecord = typeof restHoursVesselRecords.$inferSelect;
export type InsertRestHoursCrewRecord = z.infer<typeof insertRestHoursCrewRecordSchema>;
export type RestHoursCrewRecord = typeof restHoursCrewRecords.$inferSelect;
export type InsertRestHoursDailyRecord = z.infer<typeof insertRestHoursDailyRecordSchema>;
export type RestHoursDailyRecord = typeof restHoursDailyRecords.$inferSelect;
export type InsertFixedTask = z.infer<typeof insertFixedTaskSchema>;
export type FixedTask = typeof fixedTasks.$inferSelect;
export type InsertVesselViolationComment = z.infer<typeof insertVesselViolationCommentSchema>;
export type VesselViolationComment = typeof vesselViolationComments.$inferSelect;
export type InsertOfficeViolationComment = z.infer<typeof insertOfficeViolationCommentSchema>;
export type OfficeViolationComment = typeof officeViolationComments.$inferSelect;
export type InsertNCReport = z.infer<typeof insertNCReportSchema>;
export type NCReport = typeof ncReports.$inferSelect;

// Dashboard Types
export const dashboardStatusSchema = z.object({
  status: z.enum(["On Board", "On Leave", "Available", "In Transit"]),
  vessel: z.string(),
  joinedDate: z.string(),
  sailingDue: z.string(),
  presentAssignment: z.string(),
  emergencyContact: z.object({
    name: z.string(),
    relation: z.string(),
    phone: z.string(),
  }),
});

export const experienceMetricSchema = z.object({
  company: z.number(),
  rank: z.number(), 
  tankers: z.number(),
  ocw: z.number(),
  endorsements: z.string(),
});

export const shipTypeExperienceSchema = z.object({
  oilTanker: z.number(),
  chemicalTanker: z.number(),
  gasTanker: z.number(),
  bulk: z.number(),
});

export const serviceAssignmentSchema = z.object({
  vessel: z.string(),
  startMonth: z.number(),
  endMonth: z.number(),
  type: z.enum(["active", "completed"]),
});

export const complianceItemSchema = z.object({
  category: z.string(),
  status: z.enum(["compliant", "issues", "pending"]),
  details: z.string().optional(),
  lastUpdated: z.string().optional(),
});

export const careerStepSchema = z.object({
  position: z.string(),
  date: z.string().optional(),
  status: z.object({
    recommend: z.boolean(),
    advance: z.boolean(), 
    demote: z.boolean(),
    approved: z.boolean(),
  }),
});

export const appraisalPointSchema = z.object({
  year: z.number(),
  score: z.number(),
});

export const crewDashboardSummarySchema = z.object({
  status: dashboardStatusSchema,
  experience: experienceMetricSchema,
  shipTypes: shipTypeExperienceSchema,
  serviceTimeline: z.array(serviceAssignmentSchema),
  compliance: z.array(complianceItemSchema),
  careerProgression: z.array(careerStepSchema),
  appraisals: z.array(appraisalPointSchema),
});

// Variable Tasks Schema for RH Planning
export const variableTasks = pgTable("variable_tasks", {
  id: serial("id").primaryKey(),
  startDateTime: text("start_date_time").notNull(),
  finishDateTime: text("finish_date_time").notNull(),
  startDateTimeSort: text("start_date_time_sort").notNull(), // ISO format for sorting
  finishDateTimeSort: text("finish_date_time_sort").notNull(), // ISO format for sorting
  task: text("task").notNull(), // Display text for task
  status: text("status").notNull(), // 'Planned' or 'Completed'
  crewInvolved: integer("crew_involved").notNull(), // Count of crew members
  remarks: text("remarks"),
  periodValue: text("period_value"), // e.g., "2025-10"
  vesselId: text("vessel_id"),
  
  // New fields for form
  isDraft: boolean("is_draft").notNull().default(true),
  recordType: text("record_type").notNull(), // 'task' or 'port-call'
  statusType: text("status_type").notNull(), // 'planned' or 'completed'
  selectedTasks: text("selected_tasks"), // JSON array of task IDs
  otherTask: text("other_task"), // Free text for unlisted tasks
  crewInvolvedDetails: text("crew_involved_details"), // JSON array of crew member IDs and groups
  comments: text("comments"),
});

export const insertVariableTaskSchema = createInsertSchema(variableTasks).omit({ id: true });
export type InsertVariableTask = z.infer<typeof insertVariableTaskSchema>;
export type VariableTask = typeof variableTasks.$inferSelect;

export const dateLineAdjustmentSchema = z.object({
  day: z.number().min(1).max(31),
  type: z.enum(["advanced", "retarded"]),
});
export type DateLineAdjustmentItem = z.infer<typeof dateLineAdjustmentSchema>;

export const insertVesselDateLineAdjustmentSchema = createInsertSchema(vesselDateLineAdjustments).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  vesselId: z.string().min(1, "Vessel ID is required"),
  monthValue: z.string().regex(/^\d{4}-\d{2}$/, "Month value must be in YYYY-MM format"),
  adjustments: z.string().refine(
    (val) => {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) && parsed.every(item => 
          typeof item.day === 'number' && 
          item.day >= 1 && 
          item.day <= 31 &&
          (item.type === 'advanced' || item.type === 'retarded')
        );
      } catch {
        return false;
      }
    },
    { message: "Adjustments must be a valid JSON array of {day, type} objects" }
  ),
});
export type InsertVesselDateLineAdjustment = z.infer<typeof insertVesselDateLineAdjustmentSchema>;
export type VesselDateLineAdjustment = typeof vesselDateLineAdjustments.$inferSelect;

export type DashboardStatus = z.infer<typeof dashboardStatusSchema>;
export type ExperienceMetric = z.infer<typeof experienceMetricSchema>;
export type ShipTypeExperience = z.infer<typeof shipTypeExperienceSchema>;
export type ServiceAssignment = z.infer<typeof serviceAssignmentSchema>;
export type ComplianceItem = z.infer<typeof complianceItemSchema>;
export type CareerStep = z.infer<typeof careerStepSchema>;
export type AppraisalPoint = z.infer<typeof appraisalPointSchema>;
export type CrewDashboardSummary = z.infer<typeof crewDashboardSummarySchema>;
