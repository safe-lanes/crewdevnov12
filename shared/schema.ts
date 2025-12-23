
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
  isSystemRank: boolean("is_system_rank").default(false), // Protected starter pack ranks - cannot edit name or delete
});

export const trainingMaster = pgTable("training_master", {
  id: serial("id").primaryKey(),
  trainingId: text("training_id").notNull().unique(), // e.g., SA001, SB002 - Category+Group+Number
  trainingName: text("training_name").notNull(),
  category: text("category").notNull(), // Statutory (S), Industry (N), Others (M)
  trainingGroup: text("training_group").notNull(), // Safety (A), Security (B), Cargo (C), Navigation (D), Engine (E), Environment (F), General (G)
  requirementReference: text("requirement_reference"), // Free text - STCW reference, IMO Model Course, etc.
  applicableToCompany: boolean("applicable_to_company").default(false),
  trainingLabel: text("training_label"), // Company-specific custom name, defaults to trainingName
  sortOrder: integer("sort_order").default(0), // For manual reordering within Category+Group
  isDefault: boolean("is_default").default(false), // True for CSV-loaded trainings (cannot delete/edit name)
});

// Company Training Groups - stores customizable labels for groups A-J
export const companyTrainingGroups = pgTable("company_training_groups", {
  code: text("code").primaryKey(), // A, B, C, D, E, F, G, H, I, J
  label: text("label"), // Custom label (e.g., "Flag", "Value Add", "Class") - null means just show the letter
  displayOrder: integer("display_order").notNull(), // 1, 2, 3... for ordering
});

// Company Training - stores company-specific overrides for trainings
// Created automatically when "Applicable to Company" is checked in Training Master
export const companyTrainings = pgTable("company_trainings", {
  id: serial("id").primaryKey(),
  trainingMasterId: integer("training_master_id").notNull().references(() => trainingMaster.id).unique(), // Link to source training - unique to prevent duplicates
  companyId: text("company_id").notNull(), // Initially copied from trainingId, but editable
  trainingLabel: text("training_label").notNull(), // Synced from Training Master, displayed but not editable
  abr: text("abr"), // Abbreviation - blank by default, company adds their own
  requirement: text("requirement"), // Initially copied from requirementReference, editable
  groupCode: text("group_code"), // A-J, null means unassigned (appears at bottom)
  sortOrder: integer("sort_order").default(0), // For ordering within group
});

// Company Training Requirements - stores M/R status per training-rank combination
// M = Mandatory, R = Recommended, null = not set (checkbox unchecked)
export const companyTrainingRequirements = pgTable("company_training_requirements", {
  id: serial("id").primaryKey(),
  companyTrainingId: integer("company_training_id").notNull().references(() => companyTrainings.id, { onDelete: 'cascade' }),
  rankId: integer("rank_id").notNull().references(() => availableRanks.id, { onDelete: 'cascade' }),
  status: text("status"), // 'M' for Mandatory, 'R' for Recommended, null for neither
});

export const crewMembers = pgTable("crew_members", {
  id: text("id").primaryKey(),
  
  // Photo
  uploadedPhoto: text("uploaded_photo"), // Base64 encoded photo data
  
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
  status: text("status"), // Computed: On Board, On Leave, Inactive
  isActive: boolean("is_active").default(true), // Manual toggle: true=Active (On Board/On Leave), false=Inactive
  signOnDate: text("sign_on_date"), // Date crew signed on to vessel (planned or actual based on status)
  signOffDate: text("sign_off_date"),
  contractPeriod: text("contract_period"),
  reliefDue: text("relief_due"),
  nextAvailability: text("next_availability"), // When crew is next ready to join vessel (for On Leave status)
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
  crewPool: text("crew_pool"), // Crew pool grouping from Data Master 022
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
  status: text("status").notNull().default("draft"), // draft, preliminary, submitted, reviewed
  stageStatuses: text("stage_statuses"), // JSON: {stage1: {status, submittedAt, submittedBy}, stage2: {...}, stage3: {...}}
  stagePayloads: text("stage_payloads"), // JSON: {stage1: {...}, stage2: {...}, stage3: {...}}
});

export const recruitmentCandidates = pgTable("recruitment_candidates", {
  id: text("id").primaryKey(),
  fileNo: text("file_no").unique(),
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
  isDelete: boolean("is_delete").default(false), // Soft delete flag
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

// Training Matrix Vessel Drafts - stores draft training matrix data for vessels
export const trainingMatrixVesselDrafts = pgTable("training_matrix_vessel_drafts", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull().default("R1"),
  draftData: text("draft_data").notNull(), // JSON string of vessel training matrix data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Training Matrix Vessel Revisions - stores finalized training matrix revisions for vessels
export const trainingMatrixVesselRevisions = pgTable("training_matrix_vessel_revisions", {
  id: serial("id").primaryKey(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull(), // R0, R1, R2, etc.
  revisionDate: text("revision_date").notNull(), // Mandatory field in dd/mm/yyyy format
  revisionData: text("revision_data").notNull(), // JSON string of finalized vessel training matrix data
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

export const companyProcessing = pgTable("company_processing", {
  id: serial("id").primaryKey(),
  candidateId: text("candidate_id").notNull(), // References recruitment_candidates or crew_members
  processType: text("process_type").notNull(), // "recruitment", "onboarding", etc.
  status: text("status").notNull().default("pending"), // pending, in_progress, approved, rejected, completed
  b7Data: text("b7_data"), // JSON: {medicalClearance, documentVerification, trainingCompletion, flagStateRequirements, ...}
  comments: text("comments"), // JSON array: [{text, author, timestamp}, ...]
  approvals: text("approvals"), // JSON: {stage1: {status, approver, date}, stage2: {...}, ...}
  attachments: text("attachments"), // JSON array: [{filename, fileType, uploadDate, uploadedBy, fileSize, filePath}, ...]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const promotionForms = pgTable("promotion_forms", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
  currentRank: text("current_rank").notNull(),
  proposedRank: text("proposed_rank").notNull(),
  justification: text("justification"), // Why promotion is deserved
  status: text("status").notNull().default("draft"), // draft, submitted, under_review, approved, rejected
  submittedAt: timestamp("submitted_at"),
  submittedBy: text("submitted_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewerComments: text("reviewer_comments"),
  effectiveDate: text("effective_date"), // When promotion takes effect
  appraisalResultId: integer("appraisal_result_id").references(() => appraisalResults.id), // Optional link to appraisal
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
  level: integer("level"), // Hierarchy level: 1=Category, 2=Type, 3=Subtype
  parentId: text("parentId"), // Reference to parent entry's entryId for hierarchy
  code: text("code"), // Unique code for the vessel type (e.g., 'OIL_TANKER', 'LPG_TANKER')
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
  // License & DCE Master (ID 016) - Officer Matrix Label
  officerMatrixLabel: text("officerMatrixLabel"),
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
  
  // Crew Status - for managing primary/secondary during handover
  crewStatus: text("crew_status").default("primary"), // "primary" | "secondary"
  
  // On Board Status
  onBoardCrewId: text("on_board_crew_id"), // DEPRECATED - use crewMemberId instead
  onBoardCrewName: text("on_board_crew_name"), // DEPRECATED - join with crewMembers
  onBoardCrewNationality: text("on_board_crew_nationality"), // DEPRECATED - join with crewMembers
  signOnDate: text("sign_on_date"), // Actual sign-on date when crew boards vessel
  reliefDue: text("relief_due"),
  signOffDate: text("sign_off_date"),
  signOffPort: text("sign_off_port"),
  signOffReason: text("sign_off_reason"), // Reason for sign-off: Contract Completed, Terminated, Medical Reasons, Others
  reliefStatus: text("relief_status"),
  
  // Handover Workflow Fields
  takeOverDate: text("take_over_date"), // Date when secondary takes over as primary
  takeOverConfirmation: boolean("take_over_confirmation").default(false), // Checkbox confirmation
  handOverDate: text("hand_over_date"), // Auto-filled when handing over (matches takeOverDate of reliever)
  
  // Reliever Status
  relieverCrewId: text("reliever_crew_id"),
  relieverCrewName: text("reliever_crew_name"), // DEPRECATED - join with crewMembers
  relieverNationality: text("reliever_nationality"), // DEPRECATED - join with crewMembers
  relieverSignOnDate: text("reliever_sign_on_date"), // Planned or actual sign-on date based on joiningStatus
  joiningPort: text("joining_port"),
  joiningStatus: text("joining_status"), // Proposed, Planned, Confirmed, In Transit, Signed On
  contractPeriodMonths: integer("contract_period_months"),
  contractEndRangeStartMonths: integer("contract_end_range_start_months"),
  contractEndRangeEndMonths: integer("contract_end_range_end_months"),
  deploymentChecklistCompleted: boolean("deployment_checklist_completed"),
  applicableDocsChecked: boolean("applicable_docs_checked"),
  
  // Archive Status - for vessel crew archive functionality
  isArchived: boolean("is_archived").default(false), // true when crew signs off from vessel
  archivedDate: text("archived_date"), // Date when record was archived (sign-off date)
  
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
  assignments: text("assignments"), // JSON array: [{vesselName, rank, crewId, crewName, signOnDate, contractPeriod, proposalStatus, proposedBy, proposedDate, deployedDate, deployedBy}]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rotationArchive = pgTable("rotation_archive", {
  id: serial("id").primaryKey(),
  originalPlanId: integer("original_plan_id"), // Reference to original plan (may be null if plan deleted)
  originalDraftId: text("original_draft_id"), // Keep draftId for reference
  originalAssignmentIndex: integer("original_assignment_index"), // Index in original plan's assignments array
  
  vesselId: text("vessel_id"), // Vessel code (VSL-XXX format) - nullable for historical fidelity
  vesselName: text("vessel_name"), // nullable for historical fidelity
  rankId: text("rank_id"), // Rank ID if available
  rank: text("rank").notNull(),
  
  crewId: text("crew_id").notNull(),
  crewName: text("crew_name").notNull(),
  crewMemberId: text("crew_member_id"), // Database crew member ID if different from crewId
  
  signOnDate: text("sign_on_date").notNull(),
  joiningPort: text("joining_port"),
  contractPeriod: integer("contract_period"), // nullable for historical fidelity
  signOffDate: text("sign_off_date"), // Planned sign-off date
  
  proposedBy: text("proposed_by"), // nullable for historical fidelity (avoid synthetic "System" default)
  proposedDate: text("proposed_date"), // nullable for historical fidelity
  result: text("result").notNull(), // "Deployed" or "Rejected"
  archivedDate: text("archived_date").notNull(), // When deployed/rejected
  archivedBy: text("archived_by"), // nullable for historical fidelity (avoid synthetic "Current User" default)
  
  vesselPlanningId: integer("vessel_planning_id"), // ID of vessel_planning record created (for deployed)
  
  currentCrewInfo: text("current_crew_info"), // JSON: {id, name, contractStartDate, contractEndDate, rangeStartDate, rangeEndDate}
  fullAssignmentSnapshot: text("full_assignment_snapshot"), // Complete JSON snapshot of original assignment
  
  createdAt: timestamp("created_at").defaultNow(),
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
  isSystemRank: true,
});

export const updateAvailableRankSchema = createInsertSchema(availableRanks).pick({
  name: true,
  category: true,
  rankId: true,
  label: true,
  applicableToCompany: true,
  sortOrder: true,
  isSystemRank: true,
}).partial();

export const insertTrainingMasterSchema = createInsertSchema(trainingMaster).pick({
  trainingId: true,
  trainingName: true,
  category: true,
  trainingGroup: true,
  requirementReference: true,
  applicableToCompany: true,
  trainingLabel: true,
  sortOrder: true,
  isDefault: true,
});

export const updateTrainingMasterSchema = createInsertSchema(trainingMaster).pick({
  trainingId: true,
  trainingName: true,
  category: true,
  trainingGroup: true,
  requirementReference: true,
  applicableToCompany: true,
  trainingLabel: true,
  sortOrder: true,
  isDefault: true,
}).partial();

export const insertCompanyTrainingGroupSchema = createInsertSchema(companyTrainingGroups).pick({
  code: true,
  label: true,
  displayOrder: true,
});

export const updateCompanyTrainingGroupSchema = createInsertSchema(companyTrainingGroups).pick({
  label: true,
}).partial();

export const insertCompanyTrainingSchema = createInsertSchema(companyTrainings).pick({
  trainingMasterId: true,
  companyId: true,
  trainingLabel: true,
  abr: true,
  requirement: true,
  groupCode: true,
  sortOrder: true,
});

export const updateCompanyTrainingSchema = createInsertSchema(companyTrainings).pick({
  companyId: true,
  trainingLabel: true,
  abr: true,
  requirement: true,
  groupCode: true,
  sortOrder: true,
}).partial();

export const insertCompanyTrainingRequirementSchema = createInsertSchema(companyTrainingRequirements).pick({
  companyTrainingId: true,
  rankId: true,
  status: true,
});

export const upsertCompanyTrainingRequirementSchema = z.object({
  companyTrainingId: z.number(),
  rankId: z.number(),
  status: z.enum(['M', 'R']).nullable(),
});

export const insertCrewMemberSchema = createInsertSchema(crewMembers).pick({
  // Photo
  uploadedPhoto: true,
  
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
  isActive: true,
  nextAvailability: true,
  signOnDate: true,
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
  crewPool: true,
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
}).extend({
  id: z.string().optional(), // Make id optional, will be auto-generated if not provided
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
  stageStatuses: true,
  stagePayloads: true,
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

export const insertTrainingMatrixVesselDraftSchema = createInsertSchema(trainingMatrixVesselDrafts).pick({
  vesselId: true,
  revision: true,
  draftData: true,
});

export const insertTrainingMatrixVesselRevisionSchema = createInsertSchema(trainingMatrixVesselRevisions).pick({
  vesselId: true,
  revision: true,
  revisionDate: true,
  revisionData: true,
}).extend({
  revisionDate: z.string()
    .min(1, "Revision date is required")
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in dd/mm/yyyy format")
    .refine((dateStr) => {
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

export type InsertPromotionHierarchy = z.infer<typeof insertPromotionHierarchySchema>;
export type PromotionHierarchy = typeof promotionHierarchies.$inferSelect;

export const insertCompanyProcessingSchema = createInsertSchema(companyProcessing).pick({
  candidateId: true,
  processType: true,
  status: true,
  b7Data: true,
  comments: true,
  approvals: true,
  attachments: true,
});

export type InsertCompanyProcessing = z.infer<typeof insertCompanyProcessingSchema>;
export type CompanyProcessing = typeof companyProcessing.$inferSelect;

export const insertPromotionFormSchema = createInsertSchema(promotionForms).pick({
  crewMemberId: true,
  currentRank: true,
  proposedRank: true,
  justification: true,
  status: true,
  submittedAt: true,
  submittedBy: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewerComments: true,
  effectiveDate: true,
  appraisalResultId: true,
}).extend({
  submittedAt: z.string().or(z.date()).optional().transform((val) => val ? (typeof val === 'string' ? new Date(val) : val) : undefined),
  reviewedAt: z.string().or(z.date()).optional().transform((val) => val ? (typeof val === 'string' ? new Date(val) : val) : undefined),
});

export type InsertPromotionForm = z.infer<typeof insertPromotionFormSchema>;
export type PromotionForm = typeof promotionForms.$inferSelect;

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
  level: true,
  parentId: true,
  code: true,
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
  crewMemberId: true,
  crewStatus: true,
  onBoardCrewId: true,
  onBoardCrewName: true,
  onBoardCrewNationality: true,
  signOnDate: true,
  reliefDue: true,
  signOffDate: true,
  signOffPort: true,
  signOffReason: true,
  reliefStatus: true,
  takeOverDate: true,
  takeOverConfirmation: true,
  handOverDate: true,
  relieverCrewId: true,
  relieverCrewName: true,
  relieverNationality: true,
  relieverSignOnDate: true,
  joiningPort: true,
  joiningStatus: true,
  contractPeriodMonths: true,
  contractEndRangeStartMonths: true,
  contractEndRangeEndMonths: true,
  deploymentChecklistCompleted: true,
  applicableDocsChecked: true,
  isArchived: true,
  archivedDate: true,
});

export const insertRotationPlanSchema = createInsertSchema(rotationPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRotationArchiveSchema = createInsertSchema(rotationArchive).omit({
  id: true,
  createdAt: true,
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
export type TrainingMaster = typeof trainingMaster.$inferSelect;
export type InsertTrainingMaster = z.infer<typeof insertTrainingMasterSchema>;
export type UpdateTrainingMaster = z.infer<typeof updateTrainingMasterSchema>;
export type CompanyTrainingGroup = typeof companyTrainingGroups.$inferSelect;
export type InsertCompanyTrainingGroup = z.infer<typeof insertCompanyTrainingGroupSchema>;
export type UpdateCompanyTrainingGroup = z.infer<typeof updateCompanyTrainingGroupSchema>;
export type CompanyTraining = typeof companyTrainings.$inferSelect;
export type InsertCompanyTraining = z.infer<typeof insertCompanyTrainingSchema>;
export type UpdateCompanyTraining = z.infer<typeof updateCompanyTrainingSchema>;
export type CompanyTrainingRequirement = typeof companyTrainingRequirements.$inferSelect;
export type InsertCompanyTrainingRequirement = z.infer<typeof insertCompanyTrainingRequirementSchema>;
export type UpsertCompanyTrainingRequirement = z.infer<typeof upsertCompanyTrainingRequirementSchema>;
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
export type InsertTrainingMatrixVesselDraft = z.infer<typeof insertTrainingMatrixVesselDraftSchema>;
export type TrainingMatrixVesselDraft = typeof trainingMatrixVesselDrafts.$inferSelect;
export type InsertTrainingMatrixVesselRevision = z.infer<typeof insertTrainingMatrixVesselRevisionSchema>;
export type TrainingMatrixVesselRevision = typeof trainingMatrixVesselRevisions.$inferSelect;
export type InsertSeafarer = z.infer<typeof insertSeafarerSchema>;
export type Seafarer = typeof seafarers.$inferSelect;
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;
export type InsertVesselRank = z.infer<typeof insertVesselRankSchema>;
export type VesselRank = typeof vesselRanks.$inferSelect;
export type InsertCompanyRank = z.infer<typeof insertCompanyRankSchema>;
export type CompanyRank = typeof companyRanks.$inferSelect;
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
export type InsertRotationArchive = z.infer<typeof insertRotationArchiveSchema>;
export type RotationArchiveEntry = typeof rotationArchive.$inferSelect;
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
  status: z.enum(["On Board", "On Leave", "Available", "In Transit", "Inactive"]),
  isActive: z.boolean().optional(),
  vessel: z.string().nullable(),
  joinedDate: z.string().nullable(),
  sailingDue: z.string().nullable(),
  nextAvailability: z.string().nullable().optional(),
  presentAssignment: z.string().nullable(),
  emergencyContact: z.object({
    name: z.string(),
    relation: z.string(),
    phone: z.string(),
  }).nullable(),
});

export const experienceMetricSchema = z.object({
  company: z.number(),
  rank: z.number(), 
  tankers: z.number(),
  ocw: z.number(),
  endorsements: z.string(),
});

export const shipTypeItemSchema = z.object({
  type: z.string(),
  label: z.string(),
  months: z.number(),
  years: z.number(),
});

export const shipTypeExperienceSchema = z.object({
  items: z.array(shipTypeItemSchema),
  totalMonths: z.number(),
  totalYears: z.number(),
});

export const rankExperienceSchema = z.object({
  items: z.array(shipTypeItemSchema),
  totalMonths: z.number(),
  totalYears: z.number(),
});

export const serviceAssignmentSchema = z.object({
  vessel: z.string(),
  vesselId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  contractEndDate: z.string().nullable(),
  rangeEndDate: z.string().nullable(),
  type: z.enum(["onBoard", "planned", "completed"]),
  appraisalIds: z.array(z.number()).optional(),
  handoverIds: z.array(z.number()).optional(),
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
  rankExperience: rankExperienceSchema,
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

// Oil Major Compliance Rules Schema
export const oilMajorRules = pgTable("oil_major_rules", {
  id: serial("id").primaryKey(),
  oilMajorName: text("oil_major_name").notNull(),
  isActive: boolean("is_active").default(true),
  rules: text("rules").notNull(), // JSON string containing all rules for this oil major
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOilMajorRulesSchema = createInsertSchema(oilMajorRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOilMajorRules = z.infer<typeof insertOilMajorRulesSchema>;
export type OilMajorRules = typeof oilMajorRules.$inferSelect;

// Zod schema for the rule structure (for validation and typing)
export const rankPairRuleSchema = z.object({
  label: z.string(),
  rankPair: z.string(), // e.g., "Master + Chief Officer"
  requiredValue: z.number(), // in years
  unit: z.enum(["years", "days"]).default("years"),
});

export const experienceCategoryRulesSchema = z.object({
  yearsWithOperator: z.array(rankPairRuleSchema).optional(),
  yearsInRank: z.array(rankPairRuleSchema).optional(),
  yearsOnTankerType: z.array(rankPairRuleSchema).optional(),
  yearsOnAllTankers: z.array(rankPairRuleSchema).optional(),
  yearsAsOOW: z.array(rankPairRuleSchema).optional(),
});

export const dateJoinedRuleSchema = z.object({
  label: z.string(),
  rankPair: z.string(), // e.g., "Master Joining Date - Chief Officer Joining Date"
  requiredDays: z.number(), // minimum days gap
});

export const englishProficiencyRuleSchema = z.object({
  label: z.string(), // Description e.g., "English proficiency of Master must be good"
  rankPair: z.string(), // Officer(s) this applies to e.g., "Master", "Chief Officer"
  requiredLevel: z.string(), // e.g., "Good"
});

// Conditional rule schema for complex "If X then Y" requirements
export const conditionalRuleSchema = z.object({
  label: z.string(), // Full text of the conditional rule
  conditionType: z.enum([
    "officer_count_aggregate", // "If 3 junior deck officers onboard, aggregated experience..."
    "officer_below_threshold", // "If one of the 3 deck officers is below X months..."
    "officer_count_minimum", // "If 3 junior officers onboard, 2 must have at least..."
  ]),
  targetRanks: z.array(z.string()), // e.g., ["Second Officer", "Third Officer"] for junior deck
  conditionCount: z.number().optional(), // e.g., 3 for "If 3 junior deck officers"
  experienceCategory: z.string(), // e.g., "yearsAsOOW"
  requiredValue: z.number(), // Required experience value (in months or years)
  unit: z.enum(["months", "years"]).default("months"),
  thresholdValue: z.number().optional(), // For "below X months" conditions
  minimumOfficersMeetingReq: z.number().optional(), // For "2 of the officers must have..."
});

export const oilMajorRulesConfigSchema = z.object({
  experienceRules: experienceCategoryRulesSchema,
  dateJoinedRules: z.array(dateJoinedRuleSchema).optional(),
  englishProficiencyRules: z.array(englishProficiencyRuleSchema).optional(),
  conditionalRules: z.array(conditionalRuleSchema).optional(),
});

export type RankPairRule = z.infer<typeof rankPairRuleSchema>;
export type ExperienceCategoryRules = z.infer<typeof experienceCategoryRulesSchema>;
export type DateJoinedRule = z.infer<typeof dateJoinedRuleSchema>;
export type EnglishProficiencyRule = z.infer<typeof englishProficiencyRuleSchema>;
export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;
export type OilMajorRulesConfig = z.infer<typeof oilMajorRulesConfigSchema>;

// Compliance check result types
export const complianceRuleResultSchema = z.object({
  category: z.string(),
  label: z.string(),
  rankPair: z.string(),
  requiredValue: z.number(),
  actualValue: z.number(),
  unit: z.enum(["years", "days", "months", "proficiency", "officers", "conditional", "count"]),
  status: z.enum(["pass", "fail", "not_applicable"]),
});

export const oilMajorComplianceResultSchema = z.object({
  oilMajorId: z.number(),
  oilMajorName: z.string(),
  overallStatus: z.enum(["green", "yellow", "red"]),
  results: z.array(complianceRuleResultSchema),
});

export type ComplianceRuleResult = z.infer<typeof complianceRuleResultSchema>;
export type OilMajorComplianceResult = z.infer<typeof oilMajorComplianceResultSchema>;

// CBA Tables - Collective Bargaining Agreement rate tables
export const cbaTables = pgTable("cba_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tableData: text("table_data").notNull(), // JSON string for table structure and data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cbaTableEntries = pgTable("cba_table_entries", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => cbaTables.id),
  rank: text("rank"),
  vesselType: text("vessel_type"),
  category: text("category"),
  value: text("value").notNull(),
  effectiveDate: text("effective_date"),
  expiryDate: text("expiry_date"),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pay Elements Master Library (Rate Tables & Rules)
export const payElements = pgTable("pay_elements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // 'earning' | 'deduction' | 'contribution'
  category: text("category").notNull(),
  formula: text("formula").notNull(),
  rounding: text("rounding").notNull(),
  ceiling: integer("ceiling"),
  floor: integer("floor"),
  effectiveDate: text("effective_date").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'inactive'
  vesselGroups: text("vessel_groups"), // JSON array of vessel group IDs
  reflectInContract: boolean("reflect_in_contract").default(true), // Controls if element appears in Contract Data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Data (per crew member)
export const contractData = pgTable("contract_data", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
  vessel: text("vessel").notNull(),
  vesselGroup: text("vessel_group").notNull(),
  applicableFrom: text("applicable_from").notNull(),
  status: text("status").notNull().default("draft"), // 'draft' | 'active'
  currency: text("currency").notNull().default("USD"),
  lastModified: timestamp("last_modified").defaultNow(),
  modifiedBy: text("modified_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contract Pay Elements (inherited from master + custom)
export const contractPayElements = pgTable("contract_pay_elements", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contractData.id),
  payElementId: text("pay_element_id"), // null for custom elements
  payElementCode: text("pay_element_code").notNull(),
  payElementName: text("pay_element_name").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // 'earning' | 'deduction'
  applicable: boolean("applicable").notNull().default(false),
  formula: text("formula").notNull(),
  value: text("value"), // Can be amount or formula like "USD / HR"
  isCustom: boolean("is_custom").notNull().default(false), // True for user-added elements
  isInherited: boolean("is_inherited").notNull().default(true), // True for inherited from master
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Allotments
export const allotments = pgTable("allotments", {
  id: text("id").primaryKey(),
  crewId: text("crew_id").notNull().references(() => crewMembers.id),
  crewName: text("crew_name").notNull(),
  rank: text("rank").notNull(),
  beneficiaryName: text("beneficiary_name").notNull(),
  relationship: text("relationship").notNull(),
  allotmentType: text("allotment_type").notNull(), // 'percentage' or 'fixed'
  value: integer("value").notNull(), // percentage value or fixed amount
  currency: text("currency").notNull().default("USD"),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  priority: integer("priority").notNull().default(1),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'pending', 'expired'
  kycComplete: boolean("kyc_complete").notNull().default(false),
  bankVerified: boolean("bank_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cash Advances
export const advances = pgTable("advances", {
  id: text("id").primaryKey(),
  crewId: text("crew_id").notNull().references(() => crewMembers.id),
  crewName: text("crew_name").notNull(),
  rank: text("rank").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  reason: text("reason").notNull(),
  requestDate: text("request_date").notNull(),
  approver: text("approver"),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'disbursed', 'recovered'
  capCheck: boolean("cap_check").notNull().default(true),
  remainingCap: integer("remaining_cap").notNull().default(0),
  recoveryAmount: integer("recovery_amount"), // Amount to deduct from payroll
  ctmReference: text("ctm_reference"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bond Purchases
export const bondItems = pgTable("bond_items", {
  id: text("id").primaryKey(),
  crewId: text("crew_id").notNull().references(() => crewMembers.id),
  crewName: text("crew_name").notNull(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  totalPrice: integer("total_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  saleDate: text("sale_date").notNull(),
  autoDeduct: boolean("auto_deduct").notNull().default(true),
  deductionAmount: integer("deduction_amount"), // Amount to deduct from payroll
  status: text("status").notNull().default("pending"), // 'pending', 'deducted', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod validation schemas
export const insertCbaTableSchema = createInsertSchema(cbaTables).pick({
  name: true,
  description: true,
  tableData: true,
});

export const insertCbaTableEntrySchema = createInsertSchema(cbaTableEntries).pick({
  tableId: true,
  rank: true,
  vesselType: true,
  category: true,
  value: true,
  effectiveDate: true,
  expiryDate: true,
  currency: true,
});

export const insertPayElementSchema = createInsertSchema(payElements).pick({
  id: true,
  name: true,
  code: true,
  type: true,
  category: true,
  formula: true,
  rounding: true,
  ceiling: true,
  floor: true,
  effectiveDate: true,
  status: true,
  vesselGroups: true,
  reflectInContract: true,
});

export const insertContractDataSchema = createInsertSchema(contractData).pick({
  crewMemberId: true,
  vessel: true,
  vesselGroup: true,
  applicableFrom: true,
  status: true,
  currency: true,
  modifiedBy: true,
});

export const insertContractPayElementSchema = createInsertSchema(contractPayElements).pick({
  contractId: true,
  payElementId: true,
  payElementCode: true,
  payElementName: true,
  category: true,
  type: true,
  applicable: true,
  formula: true,
  value: true,
  isCustom: true,
  isInherited: true,
  sortOrder: true,
});

export const insertAllotmentSchema = createInsertSchema(allotments).pick({
  id: true,
  crewId: true,
  crewName: true,
  rank: true,
  beneficiaryName: true,
  relationship: true,
  allotmentType: true,
  value: true,
  currency: true,
  bankName: true,
  accountNumber: true,
  priority: true,
  validFrom: true,
  validTo: true,
  status: true,
  kycComplete: true,
  bankVerified: true,
});

export const insertAdvanceSchema = createInsertSchema(advances).pick({
  id: true,
  crewId: true,
  crewName: true,
  rank: true,
  amount: true,
  currency: true,
  reason: true,
  requestDate: true,
  approver: true,
  status: true,
  capCheck: true,
  remainingCap: true,
  recoveryAmount: true,
  ctmReference: true,
});

export const insertBondItemSchema = createInsertSchema(bondItems).pick({
  id: true,
  crewId: true,
  crewName: true,
  itemName: true,
  category: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  currency: true,
  saleDate: true,
  autoDeduct: true,
  deductionAmount: true,
  status: true,
});

// Type exports
export type CbaTable = typeof cbaTables.$inferSelect;
export type InsertCbaTable = z.infer<typeof insertCbaTableSchema>;
export type CbaTableEntry = typeof cbaTableEntries.$inferSelect;
export type InsertCbaTableEntry = z.infer<typeof insertCbaTableEntrySchema>;
export type PayElement = typeof payElements.$inferSelect;
export type InsertPayElement = z.infer<typeof insertPayElementSchema>;
export type ContractData = typeof contractData.$inferSelect;
export type InsertContractData = z.infer<typeof insertContractDataSchema>;
export type ContractPayElement = typeof contractPayElements.$inferSelect;
export type InsertContractPayElement = z.infer<typeof insertContractPayElementSchema>;
export type Allotment = typeof allotments.$inferSelect;
export type InsertAllotment = z.infer<typeof insertAllotmentSchema>;
export type Advance = typeof advances.$inferSelect;
export type InsertAdvance = z.infer<typeof insertAdvanceSchema>;
export type BondItem = typeof bondItems.$inferSelect;
export type InsertBondItem = z.infer<typeof insertBondItemSchema>;