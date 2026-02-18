
import { pgTable, text, integer, boolean, timestamp, varchar, serial, uniqueIndex, index, numeric } from "drizzle-orm/pg-core";
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
  sharedConfig: text("shared_config"), // JSON string for shared field configs (applies to all rank groups, e.g., appraisalTypeOptions)
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
  gender: text("gender"), // Male or Female
  dateOfBirth: text("date_of_birth"), // DOB
  age: text("age"), // Age in years
  nationality: text("nationality").notNull(),
  
  // Rank and Employment
  presentRank: text("present_rank").notNull(), // Changed from rank to match form
  rankAppliedFor: text("rank_applied_for"),
  employeeId: text("employee_id"), // From form
  
  // Vessel Information
  presentVessel: text("present_vessel"), // Optional - not all crew are assigned to a vessel
  vesselType: text("vessel_type"),
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

export const vessels = pgTable("vessels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vesselGroup: text("vessel_group"),
  vesselType: text("vessel_type").notNull(),
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
  appraisalResultId: integer("appraisal_result_id"), // Optional link to appraisal
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
  
  // On-Board Crew Contract Terms (person-specific, applies to primary crew member)
  contractPeriodMonths: integer("contract_period_months"),
  contractEndRangeStartMonths: integer("contract_end_range_start_months"),
  contractEndRangeEndMonths: integer("contract_end_range_end_months"),
  
  // Reliever Contract Terms (person-specific, separate from on-board crew)
  // When reliever signs on as primary, these values should be copied to the primary contract fields
  relieverContractPeriodMonths: integer("reliever_contract_period_months"),
  relieverContractEndRangeStartMonths: integer("reliever_contract_end_range_start_months"),
  relieverContractEndRangeEndMonths: integer("reliever_contract_end_range_end_months"),
  
  deploymentChecklistCompleted: boolean("deployment_checklist_completed"),
  applicableDocsChecked: boolean("applicable_docs_checked"),
  
  // Archive Status - for vessel crew archive functionality
  isArchived: boolean("is_archived").default(false), // true when crew signs off from vessel
  archivedDate: text("archived_date"), // Date when record was archived (sign-off date)
  
  // Handover Attachments - JSON array: [{filename, fileType, uploadDate, uploadedBy, fileSize, fileData}, ...]
  handoverAttachments: text("handover_attachments"),
  
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
  sharedConfig: true,
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

export const insertVesselSchema = createInsertSchema(vessels).pick({
  name: true,
  vesselGroup: true,
  vesselType: true,
});

export const insertRevisionSchema = createInsertSchema(revisions).pick({
  vesselId: true,
  revisionNo: true,
  flexDate: true,
  status: true,
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
  relieverContractPeriodMonths: true,
  relieverContractEndRangeStartMonths: true,
  relieverContractEndRangeEndMonths: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof forms.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;
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

// Legacy v1 type aliases (tables dropped - types kept as `any` for backward compatibility during migration)
export type FormVersion = any;
export type InsertFormVersion = any;
export type UpdateFormVersion = any;
export type RankGroup = any;
export type InsertRankGroup = any;
export type UpdateRankGroup = any;
export type AvailableRank = any;
export type InsertAvailableRank = any;
export type UpdateAvailableRank = any;
export type TrainingMaster = any;
export type InsertTrainingMaster = any;
export type UpdateTrainingMaster = any;
export type CompanyTrainingGroup = any;
export type InsertCompanyTrainingGroup = any;
export type UpdateCompanyTrainingGroup = any;
export type CompanyTraining = any;
export type InsertCompanyTraining = any;
export type UpdateCompanyTraining = any;
export type CompanyTrainingRequirement = any;
export type InsertCompanyTrainingRequirement = any;
export type UpsertCompanyTrainingRequirement = any;
export type AppraisalResult = any;
export type InsertAppraisalResult = any;
export type RecruitmentCandidate = any;
export type InsertRecruitmentCandidate = any;
export type VesselGroup = any;
export type InsertVesselGroup = any;
export type VesselDraft = any;
export type InsertVesselDraft = any;
export type VesselRevision = any;
export type InsertVesselRevision = any;
export type TrainingMatrixVesselDraft = any;
export type InsertTrainingMatrixVesselDraft = any;
export type TrainingMatrixVesselRevision = any;
export type InsertTrainingMatrixVesselRevision = any;
export type Seafarer = any;
export type InsertSeafarer = any;
export type VesselRank = any;
export type InsertVesselRank = any;
export type CompanyProcessing = any;
export type InsertCompanyProcessing = any;
export type DrugAlcoholTestRecord = any;
export type InsertDrugAlcoholTestRecord = any;
export type RestHoursVesselRecord = any;
export type InsertRestHoursVesselRecord = any;
export type RestHoursCrewRecord = any;
export type InsertRestHoursCrewRecord = any;
export type RestHoursDailyRecord = any;
export type InsertRestHoursDailyRecord = any;
export type FixedTask = any;
export type InsertFixedTask = any;
export type VariableTask = any;
export type InsertVariableTask = any;
export type VesselViolationComment = any;
export type InsertVesselViolationComment = any;
export type OfficeViolationComment = any;
export type InsertOfficeViolationComment = any;
export type NCReport = any;
export type InsertNCReport = any;
export type VesselDateLineAdjustment = any;
export type InsertVesselDateLineAdjustment = any;

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
  rankExperienceByVesselType: z.record(z.string(), z.number()).optional(),
  serviceTimeline: z.array(serviceAssignmentSchema),
  compliance: z.array(complianceItemSchema),
  careerProgression: z.array(careerStepSchema),
  appraisals: z.array(appraisalPointSchema),
});

export const dateLineAdjustmentSchema = z.object({
  day: z.number().min(1).max(31),
  type: z.enum(["advanced", "retarded"]),
});
export type DateLineAdjustmentItem = z.infer<typeof dateLineAdjustmentSchema>;


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

// ===============================================
// Promotion A2 Configuration Schema
// ===============================================
// Schema for configuring A2 Minimum Promotion Criteria per rank group
// Used by PromotionFormEditor to store "Required" field values

export const promotionA2OtherCriteriaSchema = z.object({
  id: z.string(), // e.g., "a2.6a", "a2.6b"
  label: z.string(), // Free text label for the criteria description
  requirement: z.string().optional(), // Requirement value (right column)
});

export const promotionA2CesTestSchema = z.object({
  id: z.string(), // e.g., "a2.7a", "a2.7b"
  description: z.string().optional(), // Test description (e.g., "IELTS", "Marlins")
  minScore: z.number().nullable(), // Minimum score required
});

// ===============================================
// Part B: Promotion Checklist Configuration Schema
// ===============================================
// Schema for configuring Promotion Checklist sections and assessment points
// Numbers are auto-generated: B1, B2... for sections; B1.1, B1.2... for points

export const promotionChecklistAssessmentPointSchema = z.object({
  id: z.string(), // Auto-generated: "B1.1", "B1.2", "B2.1", etc.
  text: z.string(), // Description of the assessment point
});

export const promotionChecklistSectionSchema = z.object({
  id: z.string(), // Auto-generated: "B1", "B2", "B3", etc.
  title: z.string(), // Section title (e.g., "Practical Training & Ship Handling")
  assessmentPoints: z.array(promotionChecklistAssessmentPointSchema).default([]),
});

export type PromotionChecklistAssessmentPoint = z.infer<typeof promotionChecklistAssessmentPointSchema>;
export type PromotionChecklistSection = z.infer<typeof promotionChecklistSectionSchema>;

export const promotionA2ConfigSchema = z.object({
  // A2.1 Higher License Criteria - selected license IDs from Master 016
  higherLicenseIds: z.array(z.string()).default([]),
  
  // A2.2 Age Criteria - min/max age range
  ageMin: z.number().nullable().default(null),
  ageMax: z.number().nullable().default(null),
  
  // A2.3 Experience & Sea Service Criteria
  experienceMonths: z.object({
    rankVessel: z.number().nullable().default(null), // A2.3a Minimum Rank Experience (Vessel)
    rankVesselType: z.number().nullable().default(null), // A2.3b Minimum Rank Experience (Vessel Type)
    companyService: z.number().nullable().default(null), // A2.3c Minimum Company Service in previous rank
    tankerExperience: z.number().nullable().default(null), // A2.3d Minimum Tanker Experience
  }).default({
    rankVessel: null,
    rankVesselType: null,
    companyService: null,
    tankerExperience: null,
  }),
  
  // A2.4 Recommendations Criteria - minimum number of recommendations
  minRecommendations: z.number().nullable().default(null),
  
  // A2.5 Promotion Checklist - minimum number of verifications
  minChecklistVerifications: z.number().nullable().default(null),
  
  // A2.5a Promotion Checklist Completed - minimum completion percentage (0-100)
  minChecklistCompletionPercent: z.number().nullable().default(null),
  
  // A2.6 Other Criteria - dynamic sub-items
  otherCriteria: z.array(promotionA2OtherCriteriaSchema).default([]),
  
  // A2.7 CES / Language Tests Criteria - dynamic sub-items with min scores
  cesTests: z.array(promotionA2CesTestSchema).default([]),
  
  // Part B: Promotion Checklist Configuration
  // Sections with assessment points - uses minChecklistVerifications from A2.5 for verification requirement
  checklistSections: z.array(promotionChecklistSectionSchema).default([]),
  
  // Metadata
  savedAt: z.string().optional(),
  savedBy: z.string().optional(),
});

export type PromotionA2Config = z.infer<typeof promotionA2ConfigSchema>;
export type PromotionA2OtherCriteria = z.infer<typeof promotionA2OtherCriteriaSchema>;
export type PromotionA2CesTest = z.infer<typeof promotionA2CesTestSchema>;

// ===============================================
// Promotion Reviews Table
// ===============================================
// Stores the form state for promotion review forms per crew member
export const promotionReviews = pgTable("promotion_reviews", {
  id: serial("id").primaryKey(),
  crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
  promotionToRank: text("promotion_to_rank").notNull(), // Target rank for this promotion review
  
  // A2 Criteria - Vessel Type Selection for A2.3b
  selectedVesselTypeForA2_3b: text("selected_vessel_type_for_a2_3b"),
  
  // A2 Criteria Verified Status (JSON object mapping criteria ID to status)
  // e.g., { "a2.1": "yes", "a2.2": "na", "a2.3a": "", ... }
  criteriaVerifiedStatus: text("criteria_verified_status"), // JSON string
  
  // A2 Criteria Meets Status (JSON object mapping criteria ID to computed meets status)
  // Stores auto-computed "Meets Criteria" values: 'yes', 'no', 'pending'
  // e.g., { "a2.1": "yes", "a2.3a": "no", "a2.3b": "pending", ... }
  criteriaMeetsStatus: text("criteria_meets_status"), // JSON string
  
  // CES/Language Tests data (JSON array)
  cesTestsData: text("ces_tests_data"), // JSON string
  
  // Comments for each criteria (JSON object)
  criteriaComments: text("criteria_comments"), // JSON string
  
  // Training Needs (JSON array)
  trainingNeeds: text("training_needs"), // JSON string
  
  // Part B - Approval data (JSON object)
  approvalData: text("approval_data"), // JSON string
  
  // A4 - Selected approvers for submission (JSON array of approver names)
  selectedApproversForSubmission: text("selected_approvers_for_submission"), // JSON string
  
  // Part C - Execution data
  promotionConfirmed: text("promotion_confirmed"), // 'yes', 'waitlist', 'rejected'
  vesselAssigned: text("vessel_assigned"),
  promotionDate: text("promotion_date"),
  promotionTiming: text("promotion_timing"), // 'on-board', 'prior-joining'
  
  // Form notes
  partANotes: text("part_a_notes"),
  partBNotes: text("part_b_notes"),
  partCNotes: text("part_c_notes"),
  
  // Part B - Promotion Checklist Progress Data (JSON string)
  // Stores the full checklist state including completed status, verifications, comments, attachments
  checklistProgressData: text("checklist_progress_data"),
  
  // Form status
  status: text("status").notNull().default("draft"), // 'draft', 'submitted', 'approved', 'rejected'
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPromotionReviewSchema = createInsertSchema(promotionReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PromotionReview = typeof promotionReviews.$inferSelect;
export type InsertPromotionReview = z.infer<typeof insertPromotionReviewSchema>;

// =============================================================================
// EXTERNAL API MASTER DATA TABLES (PostgreSQL)
// Used for syncing master data from external SAIL ERP API
// =============================================================================

// Nationalities Master
export const masterNationalities = pgTable(
  "master_nationalities",
  {
    id: serial("id").primaryKey(),
    natUuid: text("nat_uuid"),
    countryCode: text("country_code"),
    countryName: text("country_name"),
    nationality: text("nationality"),
    countryRefId: text("country_ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: integer("created_by"),
    isDeleted: boolean("is_deleted").default(false),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    natUuidIdx: index("idx_nationality_uuid").on(t.natUuid),
    countryCodeIdx: index("idx_nationality_country_code").on(t.countryCode),
  })
);

export const insertMasterNationalitySchema = createInsertSchema(masterNationalities).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterNationality = z.infer<typeof insertMasterNationalitySchema>;
export type MasterNationality = typeof masterNationalities.$inferSelect;

// Vessels Master
export const masterVessels = pgTable(
  "master_vessels",
  {
    id: serial("id").primaryKey(),
    vesselUuid: text("vessel_uuid"),
    vessel: text("vessel"),
    imoNumber: text("imo_number"),
    vesselType: text("vessel_type"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    vesselUuidIdx: index("idx_vessel_uuid").on(t.vesselUuid),
    imoIdx: index("idx_vessel_imo").on(t.imoNumber),
  })
);

export const insertMasterVesselSchema = createInsertSchema(masterVessels).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterVessel = z.infer<typeof insertMasterVesselSchema>;
export type MasterVessel = typeof masterVessels.$inferSelect;

// Vessel Types Master
export const masterVesselTypes = pgTable(
  "master_vessel_types",
  {
    id: serial("id").primaryKey(),
    vtUuid: text("vt_uuid"),
    vesselType: text("vessel_type"),
    tanker: boolean("tanker").default(false),
    oilTanker: boolean("oil_tanker").default(false),
    gasTanker: boolean("gas_tanker").default(false),
    chemicalTanker: boolean("chemical_tanker").default(false),
    container: boolean("container").default(false),
    dry: boolean("dry").default(false),
    other: boolean("other").default(false),
    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: integer("created_by"),
    updatedBy: integer("updated_by"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    vtUuidIdx: index("idx_vessel_type_uuid").on(t.vtUuid),
  })
);

export const insertMasterVesselTypeSchema = createInsertSchema(masterVesselTypes).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterVesselType = z.infer<typeof insertMasterVesselTypeSchema>;
export type MasterVesselType = typeof masterVesselTypes.$inferSelect;

// Additional Groups Master
export const masterAdditionalGroups = pgTable(
  "master_additional_groups",
  {
    id: serial("id").primaryKey(),
    agUuid: text("ag_uuid"),
    name: text("name"),
    vessels: text("vessels"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  }
);

export const insertMasterAdditionalGroupSchema = createInsertSchema(masterAdditionalGroups).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterAdditionalGroup = z.infer<typeof insertMasterAdditionalGroupSchema>;
export type MasterAdditionalGroup = typeof masterAdditionalGroups.$inferSelect;

// Ports Master
export const masterPorts = pgTable(
  "master_ports",
  {
    id: serial("id").primaryKey(),
    portUuid: text("port_uuid"),
    name: text("name"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    country: text("country"),
    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: integer("created_by"),
    portcode: text("port_code"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    portUuidIdx: index("idx_port_uuid").on(t.portUuid),
    portCodeIdx: index("idx_port_code").on(t.portcode),
  })
);

export const insertMasterPortSchema = createInsertSchema(masterPorts).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterPort = z.infer<typeof insertMasterPortSchema>;
export type MasterPort = typeof masterPorts.$inferSelect;

// Fleet Groups Master
export const masterFleetGroups = pgTable(
  "master_fleet_groups",
  {
    id: serial("id").primaryKey(),
    fgUuid: text("fg_uuid"),
    name: text("name"),
    vessels: text("vessels"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    fgUuidIdx: index("idx_fleet_group_uuid").on(t.fgUuid),
  })
);

export const insertMasterFleetGroupSchema = createInsertSchema(masterFleetGroups).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterFleetGroup = z.infer<typeof insertMasterFleetGroupSchema>;
export type MasterFleetGroup = typeof masterFleetGroups.$inferSelect;

// Languages Master
export const masterLanguages = pgTable(
  "master_languages",
  {
    id: serial("id").primaryKey(),
    langUuid: text("lang_uuid"),
    isoCode: text("iso_code"),
    languageName: text("language_name"),
    nativeName: text("native_name"),
    isForeignLanguage: boolean("is_foreign_language").default(false),
    displayOrder: integer("display_order"),
    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    langUuidIdx: index("idx_language_uuid").on(t.langUuid),
    isoCodeIdx: index("idx_language_iso").on(t.isoCode),
  })
);

export const insertMasterLanguageSchema = createInsertSchema(masterLanguages).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterLanguage = z.infer<typeof insertMasterLanguageSchema>;
export type MasterLanguage = typeof masterLanguages.$inferSelect;

// Countries Master
export const masterCountries = pgTable(
  "master_countries",
  {
    id: serial("id").primaryKey(),
    countryUuid: text("country_uuid"),
    countryName: text("country_name"),
    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: integer("created_by"),
    domain: text("domain"),
    orderBy: integer("order_by"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    countryUuidIdx: index("idx_country_uuid").on(t.countryUuid)
  })
);

export const insertMasterCountrySchema = createInsertSchema(masterCountries).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterCountry = z.infer<typeof insertMasterCountrySchema>;
export type MasterCountry = typeof masterCountries.$inferSelect;

// Users Master (External API)
export const masterUsers = pgTable(
  "master_users",
  {
    id: serial("id").primaryKey(),
    userUuid: text("user_uuid"),
    firstname: text("firstname"),
    lastname: text("lastname"),
    email: text("email"),
    fullname: text("fullname"),
    userType: text("user_type"),
    designation: text("designation"),
    department: text("department"),
    role: text("role"),
    displayName: text("display_name"),
    synchedAt: timestamp("synched_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userUuidIdx: index("idx_master_user_uuid").on(t.userUuid),
    emailIdx: index("idx_master_user_email").on(t.email),
  })
);

export const insertMasterUserSchema = createInsertSchema(masterUsers).omit({
  id: true,
  synchedAt: true,
});
export type InsertMasterUser = z.infer<typeof insertMasterUserSchema>;
export type MasterUser = typeof masterUsers.$inferSelect;

export const masterLicensesDce = pgTable(
  "master_licenses_dce",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    shortCode: text("short_code"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    entryIdIdx: index("idx_master_licenses_dce_entry_id").on(t.entryId),
    shortCodeIdx: index("idx_master_licenses_dce_short_code").on(t.shortCode),
  })
);

export const insertMasterLicenseDceSchema = createInsertSchema(masterLicensesDce).omit({
  id: true,
});
export type InsertMasterLicenseDce = z.infer<typeof insertMasterLicenseDceSchema>;
export type MasterLicenseDce = typeof masterLicensesDce.$inferSelect;

export const masterManningAgents = pgTable(
  "master_manning_agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    country: text("country"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    contactPerson: text("contact_person"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    nameIdx: index("idx_master_manning_agents_name").on(t.name),
  })
);

export const insertMasterManningAgentSchema = createInsertSchema(masterManningAgents).omit({
  id: true,
});
export type InsertMasterManningAgent = z.infer<typeof insertMasterManningAgentSchema>;
export type MasterManningAgent = typeof masterManningAgents.$inferSelect;

export const masterCrewPools = pgTable(
  "master_crew_pools",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    nameIdx: index("idx_master_crew_pools_name").on(t.name),
  })
);

export const insertMasterCrewPoolSchema = createInsertSchema(masterCrewPools).omit({
  id: true,
});
export type InsertMasterCrewPool = z.infer<typeof insertMasterCrewPoolSchema>;
export type MasterCrewPool = typeof masterCrewPools.$inferSelect;

export const masterAppraisalTypes = pgTable(
  "master_appraisal_types",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    entryIdIdx: index("idx_master_appraisal_types_entry_id").on(t.entryId),
  })
);

export const insertMasterAppraisalTypeSchema = createInsertSchema(masterAppraisalTypes).omit({
  id: true,
});
export type InsertMasterAppraisalType = z.infer<typeof insertMasterAppraisalTypeSchema>;
export type MasterAppraisalType = typeof masterAppraisalTypes.$inferSelect;

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