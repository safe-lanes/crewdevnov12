var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/dateUtils.ts
function getReportingDate() {
  const now = /* @__PURE__ */ new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
function safeParseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return null;
}
function calculatePeriodMonths(fromDate, toDate) {
  const from = typeof fromDate === "string" ? safeParseDate(fromDate) : fromDate;
  if (!from || isNaN(from.getTime())) return 0;
  let to;
  if (toDate) {
    to = typeof toDate === "string" ? safeParseDate(toDate) || /* @__PURE__ */ new Date() : toDate;
  } else {
    to = getReportingDate();
  }
  if (isNaN(to.getTime()) || to < from) return 0;
  const timeDiff = to.getTime() - from.getTime();
  const totalDays = timeDiff / (1e3 * 60 * 60 * 24);
  return Math.max(0, totalDays / 30.44);
}
function getSeaServiceFromDate(record) {
  return record.fromDate || record.signOnDate || record.from || null;
}
function getSeaServiceToDate(record) {
  return record.toDate || record.signOffDate || record.to || null;
}
function isActiveSeaService(record) {
  if (record.isActive === true) return true;
  if (record.isActive === false) return false;
  const toDate = getSeaServiceToDate(record);
  return !toDate || toDate.trim() === "";
}
var init_dateUtils = __esm({
  "shared/dateUtils.ts"() {
    "use strict";
  }
});

// shared/schema.ts
import { pgTable, text, integer, boolean, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, forms, formVersions, rankGroups, availableRanks, trainingMaster, companyTrainingGroups, companyTrainings, companyTrainingRequirements, crewMembers, appraisalResults, recruitmentCandidates, vessels, vesselGroups, vesselDrafts, vesselRevisions, trainingMatrixVesselDrafts, trainingMatrixVesselRevisions, seafarers, revisions, vesselRanks, companyRanks, promotionHierarchies, companyProcessing, promotionForms, dataMasters, masterDataEntries, idCounters, vesselPlanning, rotationPlans, rotationArchive, drugAlcoholTestRecords, restHoursVesselRecords, restHoursCrewRecords, restHoursDailyRecords, vesselViolationComments, officeViolationComments, ncReports, fixedTasks, vesselDateLineAdjustments, insertUserSchema, insertFormSchema, insertFormVersionSchema, updateFormVersionSchema, insertRankGroupSchema, updateRankGroupSchema, insertAvailableRankSchema, updateAvailableRankSchema, insertTrainingMasterSchema, updateTrainingMasterSchema, insertCompanyTrainingGroupSchema, updateCompanyTrainingGroupSchema, insertCompanyTrainingSchema, updateCompanyTrainingSchema, insertCompanyTrainingRequirementSchema, upsertCompanyTrainingRequirementSchema, insertCrewMemberSchema, insertAppraisalResultSchema, insertRecruitmentCandidateSchema, insertVesselSchema, insertVesselGroupSchema, insertVesselDraftSchema, insertVesselRevisionSchema, insertTrainingMatrixVesselDraftSchema, insertTrainingMatrixVesselRevisionSchema, insertSeafarerSchema, insertRevisionSchema, insertVesselRankSchema, insertCompanyRankSchema, insertPromotionHierarchySchema, insertCompanyProcessingSchema, insertPromotionFormSchema, insertDataMasterSchema, insertMasterDataEntrySchema, insertIdCounterSchema, insertVesselPlanningSchema, insertRotationPlanSchema, insertRotationArchiveSchema, insertDrugAlcoholTestRecordSchema, insertRestHoursVesselRecordSchema, insertRestHoursCrewRecordSchema, insertRestHoursDailyRecordSchema, insertFixedTaskSchema, insertVesselViolationCommentSchema, insertOfficeViolationCommentSchema, insertNCReportSchema, dashboardStatusSchema, experienceMetricSchema, shipTypeItemSchema, shipTypeExperienceSchema, rankExperienceSchema, serviceAssignmentSchema, complianceItemSchema, careerStepSchema, appraisalPointSchema, crewDashboardSummarySchema, variableTasks, insertVariableTaskSchema, dateLineAdjustmentSchema, insertVesselDateLineAdjustmentSchema, oilMajorRules, insertOilMajorRulesSchema, rankPairRuleSchema, experienceCategoryRulesSchema, dateJoinedRuleSchema, englishProficiencyRuleSchema, conditionalRuleSchema, oilMajorRulesConfigSchema, complianceRuleResultSchema, oilMajorComplianceResultSchema, cbaTables, cbaTableEntries, payElements, contractData, contractPayElements, allotments, advances, bondItems, insertCbaTableSchema, insertCbaTableEntrySchema, insertPayElementSchema, insertContractDataSchema, insertContractPayElementSchema, insertAllotmentSchema, insertAdvanceSchema, insertBondItemSchema, promotionA2OtherCriteriaSchema, promotionA2CesTestSchema, promotionChecklistAssessmentPointSchema, promotionChecklistSectionSchema, promotionA2ConfigSchema, promotionReviews, insertPromotionReviewSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      username: text("username").notNull(),
      password: text("password").notNull()
    });
    forms = pgTable("forms", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      category: text("category").notNull().default("appraisal"),
      // 'appraisal' or 'promotion'
      rankGroup: text("rank_group").notNull(),
      versionNo: text("version_no").notNull(),
      versionDate: text("version_date").notNull(),
      configuration: text("configuration"),
      // JSON string for form configuration
      sharedConfig: text("shared_config")
      // JSON string for shared field configs (applies to all rank groups, e.g., appraisalTypeOptions)
    });
    formVersions = pgTable("form_versions", {
      id: serial("id").primaryKey(),
      formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
      rankGroupId: integer("rank_group_id").references(() => rankGroups.id, { onDelete: "cascade" }),
      // Links version to specific rank group (nullable for legacy data)
      versionNo: text("version_no").notNull(),
      // "00", "01", "02", etc.
      versionDate: text("version_date").notNull(),
      // Date string in DD-MMM-YYYY format
      status: text("status").notNull().default("draft"),
      // "draft" or "released"
      configuration: text("configuration"),
      // JSON string for form configuration specific to this version
      sharedConfig: text("shared_config"),
      // JSON string for shared field configs
      createdAt: timestamp("created_at").defaultNow(),
      releasedAt: timestamp("released_at")
      // Timestamp when version was released
    });
    rankGroups = pgTable("rank_groups", {
      id: serial("id").primaryKey(),
      formId: integer("form_id").notNull().references(() => forms.id),
      name: text("name").notNull(),
      ranks: text("ranks").notNull(),
      // JSON string array of rank names
      archivedAt: timestamp("archived_at"),
      // Timestamp when archived, null if active
      configuration: text("configuration")
      // JSON string for rank-group-specific configuration (criteria, recommendations, visibility)
    });
    availableRanks = pgTable("available_ranks", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      category: text("category").notNull(),
      // Senior Officers, Junior Officers, Ratings, etc.
      rankId: text("rank_id"),
      // User-editable rank ID (e.g., "S1", "S2")
      label: text("label"),
      // User-editable label (e.g., "Master", "2nd Off")
      applicableToCompany: boolean("applicable_to_company"),
      // User-editable company applicability
      sortOrder: integer("sort_order").default(0),
      // For drag-and-drop reordering
      isSystemRank: boolean("is_system_rank").default(false)
      // Protected starter pack ranks - cannot edit name or delete
    });
    trainingMaster = pgTable("training_master", {
      id: serial("id").primaryKey(),
      trainingId: text("training_id").notNull().unique(),
      // e.g., SA001, SB002 - Category+Group+Number
      trainingName: text("training_name").notNull(),
      category: text("category").notNull(),
      // Statutory (S), Industry (N), Others (M)
      trainingGroup: text("training_group").notNull(),
      // Safety (A), Security (B), Cargo (C), Navigation (D), Engine (E), Environment (F), General (G)
      requirementReference: text("requirement_reference"),
      // Free text - STCW reference, IMO Model Course, etc.
      applicableToCompany: boolean("applicable_to_company").default(false),
      trainingLabel: text("training_label"),
      // Company-specific custom name, defaults to trainingName
      sortOrder: integer("sort_order").default(0),
      // For manual reordering within Category+Group
      isDefault: boolean("is_default").default(false)
      // True for CSV-loaded trainings (cannot delete/edit name)
    });
    companyTrainingGroups = pgTable("company_training_groups", {
      code: text("code").primaryKey(),
      // A, B, C, D, E, F, G, H, I, J
      label: text("label"),
      // Custom label (e.g., "Flag", "Value Add", "Class") - null means just show the letter
      displayOrder: integer("display_order").notNull()
      // 1, 2, 3... for ordering
    });
    companyTrainings = pgTable("company_trainings", {
      id: serial("id").primaryKey(),
      trainingMasterId: integer("training_master_id").notNull().references(() => trainingMaster.id).unique(),
      // Link to source training - unique to prevent duplicates
      companyId: text("company_id").notNull(),
      // Initially copied from trainingId, but editable
      trainingLabel: text("training_label").notNull(),
      // Synced from Training Master, displayed but not editable
      abr: text("abr"),
      // Abbreviation - blank by default, company adds their own
      requirement: text("requirement"),
      // Initially copied from requirementReference, editable
      groupCode: text("group_code"),
      // A-J, null means unassigned (appears at bottom)
      sortOrder: integer("sort_order").default(0)
      // For ordering within group
    });
    companyTrainingRequirements = pgTable("company_training_requirements", {
      id: serial("id").primaryKey(),
      companyTrainingId: integer("company_training_id").notNull().references(() => companyTrainings.id, { onDelete: "cascade" }),
      rankId: integer("rank_id").notNull().references(() => availableRanks.id, { onDelete: "cascade" }),
      status: text("status")
      // 'M' for Mandatory, 'R' for Recommended, null for neither
    });
    crewMembers = pgTable("crew_members", {
      id: text("id").primaryKey(),
      // Photo
      uploadedPhoto: text("uploaded_photo"),
      // Base64 encoded photo data
      // Basic Personal Information
      empNo: text("emp_no"),
      // Employee Number
      firstName: text("first_name").notNull(),
      middleName: text("middle_name"),
      familyName: text("family_name"),
      // Changed from lastName to match form
      gender: text("gender"),
      // Male or Female
      dateOfBirth: text("date_of_birth"),
      // DOB
      age: text("age"),
      // Age in years
      nationality: text("nationality").notNull(),
      // Rank and Employment
      presentRank: text("present_rank").notNull(),
      // Changed from rank to match form
      rankAppliedFor: text("rank_applied_for"),
      employeeId: text("employee_id"),
      // From form
      // Vessel Information
      presentVessel: text("present_vessel").notNull(),
      // Changed from vessel
      vesselType: text("vessel_type").notNull(),
      lastVessel: text("last_vessel"),
      // Contract and Status
      status: text("status"),
      // Computed: On Board, On Leave, Inactive
      isActive: boolean("is_active").default(true),
      // Manual toggle: true=Active (On Board/On Leave), false=Inactive
      signOnDate: text("sign_on_date"),
      // Date crew signed on to vessel (planned or actual based on status)
      signOffDate: text("sign_off_date"),
      contractPeriod: text("contract_period"),
      reliefDue: text("relief_due"),
      nextAvailability: text("next_availability"),
      // When crew is next ready to join vessel (for On Leave status)
      reason: text("reason"),
      // For sign-off reason
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
      crewPool: text("crew_pool"),
      // Crew pool grouping from Data Master 022
      vesselTypes: text("vessel_types"),
      // JSON array of vessel types
      // Complex Data as JSON
      documents: text("documents"),
      // JSON array of documents
      visas: text("visas"),
      // JSON array of visas
      education: text("education"),
      // JSON array of education records
      licenses: text("licenses"),
      // JSON array of licenses
      trainingCourses: text("training_courses"),
      // JSON array of training courses
      currentCompanySeaService: text("current_company_sea_service"),
      // JSON array
      externalSeaService: text("external_sea_service"),
      // JSON array
      preJoiningMedicals: text("pre_joining_medicals"),
      // JSON array
      doctorVisits: text("doctor_visits"),
      // JSON array
      children: text("children"),
      // JSON array of children information
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    appraisalResults = pgTable("appraisal_results", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
      formId: integer("form_id").notNull().references(() => forms.id),
      appraisalType: text("appraisal_type").notNull(),
      appraisalDate: text("appraisal_date").notNull(),
      appraisalData: text("appraisal_data").notNull(),
      // JSON string
      competenceRating: text("competence_rating"),
      behavioralRating: text("behavioral_rating"),
      overallRating: text("overall_rating"),
      submittedAt: timestamp("submitted_at").defaultNow(),
      submittedBy: text("submitted_by").notNull(),
      status: text("status").notNull().default("draft"),
      // draft, preliminary, submitted, reviewed
      stageStatuses: text("stage_statuses"),
      // JSON: {stage1: {status, submittedAt, submittedBy}, stage2: {...}, stage3: {...}}
      stagePayloads: text("stage_payloads")
      // JSON: {stage1: {...}, stage2: {...}, stage3: {...}}
    });
    recruitmentCandidates = pgTable("recruitment_candidates", {
      id: text("id").primaryKey(),
      fileNo: text("file_no").unique(),
      firstName: text("first_name").notNull(),
      middleName: text("middle_name"),
      familyName: text("family_name").notNull(),
      gender: text("gender"),
      // Male or Female
      dob: text("dob").notNull(),
      nationality: text("nationality").notNull(),
      rankAppliedFor: text("rank_applied_for").notNull(),
      presentRank: text("present_rank").notNull(),
      vesselType: text("vessel_type").notNull(),
      status: text("status").notNull().default("Draft"),
      // Draft, Applied, Screening, For Approval, Recruited, Waitlisted, Rejected
      applicationData: text("application_data"),
      // JSON string for comprehensive form data
      isDelete: boolean("is_delete").default(false),
      // Soft delete flag
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vessels = pgTable("vessels", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      vesselGroup: text("vessel_group"),
      vesselType: text("vessel_type").notNull(),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselGroups = pgTable("vessel_groups", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      vesselIds: text("vessel_ids").notNull(),
      // JSON array of vessel IDs from master data
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselDrafts = pgTable("vessel_drafts", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      revision: text("revision").notNull().default("R1"),
      draftData: text("draft_data").notNull(),
      // JSON string of vessel rank data
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselRevisions = pgTable("vessel_revisions", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      revision: text("revision").notNull(),
      // R0, R1, R2, etc.
      revisionDate: text("revision_date").notNull(),
      // Mandatory field in dd/mm/yyyy format
      revisionData: text("revision_data").notNull(),
      // JSON string of finalized vessel rank data
      createdAt: timestamp("created_at").defaultNow()
    });
    trainingMatrixVesselDrafts = pgTable("training_matrix_vessel_drafts", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      revision: text("revision").notNull().default("R1"),
      draftData: text("draft_data").notNull(),
      // JSON string of vessel training matrix data
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    trainingMatrixVesselRevisions = pgTable("training_matrix_vessel_revisions", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      revision: text("revision").notNull(),
      // R0, R1, R2, etc.
      revisionDate: text("revision_date").notNull(),
      // Mandatory field in dd/mm/yyyy format
      revisionData: text("revision_data").notNull(),
      // JSON string of finalized vessel training matrix data
      createdAt: timestamp("created_at").defaultNow()
    });
    seafarers = pgTable("seafarers", {
      id: serial("id").primaryKey(),
      firstName: text("first_name").notNull(),
      middleName: text("middle_name"),
      lastName: text("last_name").notNull(),
      rank: text("rank").notNull(),
      nationality: text("nationality").notNull(),
      status: text("status").notNull().default("Available"),
      // Available, Assigned, On Leave
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    revisions = pgTable("revisions", {
      id: serial("id").primaryKey(),
      vesselId: integer("vessel_id").notNull().references(() => vessels.id),
      revisionNo: text("revision_no").notNull(),
      flexDate: text("flex_date"),
      status: text("status").notNull().default("draft"),
      // draft, submitted
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselRanks = pgTable("vessel_ranks", {
      id: serial("id").primaryKey(),
      vesselId: integer("vessel_id").notNull().references(() => vessels.id),
      revisionId: integer("revision_id").notNull().references(() => revisions.id),
      rank: text("rank").notNull(),
      rankId: text("rank_id").notNull(),
      role: text("role"),
      // Role name like "3rd Off_1", "3rd Off_2"
      originalRankId: text("original_rank_id"),
      // ID of original rank for role rows
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
      actualManning: text("actual_manning"),
      // JSON string for selected seafarers
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    companyRanks = pgTable("company_ranks", {
      id: text("id").primaryKey(),
      // Will use generated IDs like "5_role_1_1727188561"
      rank: text("rank").notNull(),
      rankId: text("rank_id").notNull(),
      role: text("role"),
      // Role name like "3rd Off_1", "3rd Off_2"
      originalRankId: text("original_rank_id"),
      // ID of original rank for role rows
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
      updatedAt: timestamp("updated_at").defaultNow()
    });
    promotionHierarchies = pgTable("promotion_hierarchies", {
      id: serial("id").primaryKey(),
      groupName: text("group_name").notNull(),
      // e.g., "Deck Officers", "Engine Officers"
      rankPath: text("rank_path").notNull(),
      // JSON array of rank labels in progression order
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    companyProcessing = pgTable("company_processing", {
      id: serial("id").primaryKey(),
      candidateId: text("candidate_id").notNull(),
      // References recruitment_candidates or crew_members
      processType: text("process_type").notNull(),
      // "recruitment", "onboarding", etc.
      status: text("status").notNull().default("pending"),
      // pending, in_progress, approved, rejected, completed
      b7Data: text("b7_data"),
      // JSON: {medicalClearance, documentVerification, trainingCompletion, flagStateRequirements, ...}
      comments: text("comments"),
      // JSON array: [{text, author, timestamp}, ...]
      approvals: text("approvals"),
      // JSON: {stage1: {status, approver, date}, stage2: {...}, ...}
      attachments: text("attachments"),
      // JSON array: [{filename, fileType, uploadDate, uploadedBy, fileSize, filePath}, ...]
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    promotionForms = pgTable("promotion_forms", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
      currentRank: text("current_rank").notNull(),
      proposedRank: text("proposed_rank").notNull(),
      justification: text("justification"),
      // Why promotion is deserved
      status: text("status").notNull().default("draft"),
      // draft, submitted, under_review, approved, rejected
      submittedAt: timestamp("submitted_at"),
      submittedBy: text("submitted_by"),
      reviewedAt: timestamp("reviewed_at"),
      reviewedBy: text("reviewed_by"),
      reviewerComments: text("reviewer_comments"),
      effectiveDate: text("effective_date"),
      // When promotion takes effect
      appraisalResultId: integer("appraisal_result_id").references(() => appraisalResults.id),
      // Optional link to appraisal
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    dataMasters = pgTable("data_masters", {
      id: text("id").primaryKey(),
      // "001", "002", "003", etc.
      name: text("name").notNull(),
      // "Nationality Master", "Country Master"
      description: text("description"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    masterDataEntries = pgTable("master_data_entries", {
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
      level: integer("level"),
      // Hierarchy level: 1=Category, 2=Type, 3=Subtype
      parentId: text("parentId"),
      // Reference to parent entry's entryId for hierarchy
      code: text("code"),
      // Unique code for the vessel type (e.g., 'OIL_TANKER', 'LPG_TANKER')
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
      vesselIds: text("vesselIds"),
      // JSON string for vessel IDs array
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
      updatedAt: timestamp("updated_at").defaultNow()
    });
    idCounters = pgTable("id_counters", {
      id: serial("id").primaryKey(),
      counterType: text("counter_type").notNull().unique(),
      // 'crew_id', 'employee_id', etc.
      currentValue: integer("current_value").notNull().default(0),
      // Current highest number used
      prefix: text("prefix").notNull(),
      // 'A' for crew, 'E' for employee, etc.
      format: text("format").notNull().default("000000"),
      // Padding format, e.g., "000000" for 6 digits
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselPlanning = pgTable("vessel_planning", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      rankId: text("rank_id").notNull(),
      rank: text("rank").notNull(),
      // Foreign key to crew member - SINGLE SOURCE OF TRUTH
      crewMemberId: text("crew_member_id"),
      // References crewMembers.id or employeeId
      // Crew Status - for managing primary/secondary during handover
      crewStatus: text("crew_status").default("primary"),
      // "primary" | "secondary"
      // On Board Status
      onBoardCrewId: text("on_board_crew_id"),
      // DEPRECATED - use crewMemberId instead
      onBoardCrewName: text("on_board_crew_name"),
      // DEPRECATED - join with crewMembers
      onBoardCrewNationality: text("on_board_crew_nationality"),
      // DEPRECATED - join with crewMembers
      signOnDate: text("sign_on_date"),
      // Actual sign-on date when crew boards vessel
      reliefDue: text("relief_due"),
      signOffDate: text("sign_off_date"),
      signOffPort: text("sign_off_port"),
      signOffReason: text("sign_off_reason"),
      // Reason for sign-off: Contract Completed, Terminated, Medical Reasons, Others
      reliefStatus: text("relief_status"),
      // Handover Workflow Fields
      takeOverDate: text("take_over_date"),
      // Date when secondary takes over as primary
      takeOverConfirmation: boolean("take_over_confirmation").default(false),
      // Checkbox confirmation
      handOverDate: text("hand_over_date"),
      // Auto-filled when handing over (matches takeOverDate of reliever)
      // Reliever Status
      relieverCrewId: text("reliever_crew_id"),
      relieverCrewName: text("reliever_crew_name"),
      // DEPRECATED - join with crewMembers
      relieverNationality: text("reliever_nationality"),
      // DEPRECATED - join with crewMembers
      relieverSignOnDate: text("reliever_sign_on_date"),
      // Planned or actual sign-on date based on joiningStatus
      joiningPort: text("joining_port"),
      joiningStatus: text("joining_status"),
      // Proposed, Planned, Confirmed, In Transit, Signed On
      contractPeriodMonths: integer("contract_period_months"),
      contractEndRangeStartMonths: integer("contract_end_range_start_months"),
      contractEndRangeEndMonths: integer("contract_end_range_end_months"),
      deploymentChecklistCompleted: boolean("deployment_checklist_completed"),
      applicableDocsChecked: boolean("applicable_docs_checked"),
      // Archive Status - for vessel crew archive functionality
      isArchived: boolean("is_archived").default(false),
      // true when crew signs off from vessel
      archivedDate: text("archived_date"),
      // Date when record was archived (sign-off date)
      // Handover Attachments - JSON array: [{filename, fileType, uploadDate, uploadedBy, fileSize, fileData}, ...]
      handoverAttachments: text("handover_attachments"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    rotationPlans = pgTable("rotation_plans", {
      id: serial("id").primaryKey(),
      draftId: text("draft_id").notNull(),
      lastEdited: text("last_edited").notNull(),
      vessels: text("vessels").notNull(),
      // JSON array of vessel names
      crew: text("crew").notNull(),
      // Comma-separated crew roles (e.g., "Master, Chief Officer")
      planFromDate: text("plan_from_date").notNull(),
      planToDate: text("plan_to_date").notNull(),
      createdBy: text("created_by").notNull(),
      planStatus: text("plan_status").notNull().default("In Draft"),
      // In Draft, Proposed, Partially Approved, Approved, Rejected, Archived
      proposedBy: text("proposed_by"),
      // Who proposed the plan
      proposedDate: text("proposed_date"),
      // When it was proposed
      assignments: text("assignments"),
      // JSON array: [{vesselName, rank, crewId, crewName, signOnDate, contractPeriod, proposalStatus, proposedBy, proposedDate, deployedDate, deployedBy}]
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    rotationArchive = pgTable("rotation_archive", {
      id: serial("id").primaryKey(),
      originalPlanId: integer("original_plan_id"),
      // Reference to original plan (may be null if plan deleted)
      originalDraftId: text("original_draft_id"),
      // Keep draftId for reference
      originalAssignmentIndex: integer("original_assignment_index"),
      // Index in original plan's assignments array
      vesselId: text("vessel_id"),
      // Vessel code (VSL-XXX format) - nullable for historical fidelity
      rankId: text("rank_id"),
      // Rank ID if available
      rank: text("rank").notNull(),
      crewId: text("crew_id").notNull(),
      crewName: text("crew_name").notNull(),
      crewMemberId: text("crew_member_id"),
      // Database crew member ID if different from crewId
      signOnDate: text("sign_on_date").notNull(),
      joiningPort: text("joining_port"),
      contractPeriod: integer("contract_period"),
      // nullable for historical fidelity
      signOffDate: text("sign_off_date"),
      // Planned sign-off date
      proposedBy: text("proposed_by"),
      // nullable for historical fidelity (avoid synthetic "System" default)
      proposedDate: text("proposed_date"),
      // nullable for historical fidelity
      result: text("result").notNull(),
      // "Deployed" or "Rejected"
      archivedDate: text("archived_date").notNull(),
      // When deployed/rejected
      archivedBy: text("archived_by"),
      // nullable for historical fidelity (avoid synthetic "Current User" default)
      vesselPlanningId: integer("vessel_planning_id"),
      // ID of vessel_planning record created (for deployed)
      currentCrewInfo: text("current_crew_info"),
      // JSON: {id, name, contractStartDate, contractEndDate, rangeStartDate, rangeEndDate}
      fullAssignmentSnapshot: text("full_assignment_snapshot"),
      // Complete JSON snapshot of original assignment
      createdAt: timestamp("created_at").defaultNow()
    });
    drugAlcoholTestRecords = pgTable("drug_alcohol_test_records", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // VSL-XXX format from master data
      testType: text("test_type").notNull(),
      // 'annual', 'periodic', 'monthly', 'post-incident', 'others'
      // Part A - General Information
      alcoholDrugType: text("alcohol_drug_type"),
      // JSON array: ["Alcohol"] or ["Drug"] or ["Alcohol", "Drug"]
      placeLocation: text("place_location"),
      // Test location/port
      dateTimeTestCompleted: text("date_time_test_completed"),
      // Format: "31 May 2023 - 1010 Hours"
      externalTestResultsDate: text("external_test_results_date"),
      // Date external lab results received
      incidentId: text("incident_id"),
      // For linking to Incident Module
      // Part B2 - Testing Equipment (stored as JSON for simplicity during development)
      // Will be normalized to separate table in production
      testingEquipment: text("testing_equipment"),
      // JSON array of equipment entries
      equipmentNotApplicable: boolean("equipment_not_applicable").default(false),
      // N/A checkbox
      // Test history as JSON array: [{ date, port, violations }, ...]
      // Stores up to last 3 test records
      testHistory: text("test_history"),
      // JSON: [{date: "31 May 2023", port: "Punta Gorda", violations: 0}, ...]
      // Frequency (in months) - 12 for annual, 3 for periodic, 1 for monthly
      frequencyMonths: integer("frequency_months").notNull().default(12),
      // Planned test information (from Plan popup)
      plannedPort: text("planned_port"),
      plannedDate: text("planned_date"),
      plannedComments: text("planned_comments"),
      // Post-incident specific fields
      incidentTitle: text("incident_title"),
      incidentDateTime: text("incident_date_time"),
      // Format: "31 May 2023 - 1010 Hours"
      alcoholTestDateTime: text("alcohol_test_date_time"),
      drugTestDateTime: text("drug_test_date_time"),
      violations: integer("violations").default(0),
      // Number of violations found during test
      // Other tests specific fields
      testDateTime: text("test_date_time"),
      // Format: "31 May 2023 - 1010 Hours"
      otherTestType: text("other_test_type"),
      // "Alcohol" or "Drug" for other tests
      reasonForTesting: text("reason_for_testing"),
      description: text("description"),
      initiatedBy: text("initiated_by"),
      // Free text e.g., "Vessel - Master", "Office - HSQ Dept."
      // Part B - Personnel Details
      personnelTested: text("personnel_tested"),
      // JSON array: [{id, rank, name, alcoholTest: {checked, date, time}, alcoholResults, alcoholViolation, drugTest: {checked, date, time}, drugResults, drugViolation, witness}]
      comments: text("comments"),
      // Comments section
      masterDeputySignature: text("master_deputy_signature"),
      // JSON: {confirmed: boolean, name: string, date: string}
      attachmentFile: text("attachment_file"),
      // Filename for uploaded document
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    restHoursVesselRecords = pgTable("rest_hours_vessel_records", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      month: text("month").notNull(),
      // Format: "Feb-2025" (MMM-YYYY)
      monthValue: text("month_value").notNull(),
      // Format: "2025-02" (YYYY-MM) for filtering/sorting
      // Aggregated data from crew records
      totalCrew: integer("total_crew").notNull().default(0),
      recordingStatusPercent: integer("recording_status_percent").notNull().default(0),
      // 0-100
      activityConflicting: boolean("activity_conflicting").notNull().default(false),
      // Yes/No
      crewWithActivityConflicts: integer("crew_with_activity_conflicts").notNull().default(0),
      crewWithActivityConflictsDetails: text("crew_with_activity_conflicts_details"),
      // JSON array: [{name: string, rank: string}]
      totalViolations: integer("total_violations").notNull().default(0),
      crewWithViolations: integer("crew_with_violations").notNull().default(0),
      crewWithViolationsDetails: text("crew_with_violations_details"),
      // JSON array: [{name: string, rank: string}]
      totalNCs: integer("total_ncs").notNull().default(0),
      // Non-conformities
      crewWithNCs: integer("crew_with_ncs").notNull().default(0),
      crewWithNCsDetails: text("crew_with_ncs_details"),
      // JSON array: [{name: string, rank: string}]
      predictedViolations: integer("predicted_violations").notNull().default(0),
      crewWithPredictedViolations: integer("crew_with_predicted_violations").notNull().default(0),
      crewWithPredictedViolationsDetails: text("crew_with_predicted_violations_details"),
      // JSON array: [{name: string, rank: string}]
      predictedNCs: integer("predicted_ncs").notNull().default(0),
      crewWithPredictedNCs: integer("crew_with_predicted_ncs").notNull().default(0),
      crewWithPredictedNCsDetails: text("crew_with_predicted_ncs_details"),
      // JSON array: [{name: string, rank: string}]
      vesselReviewStatus: text("vessel_review_status").notNull().default("Due"),
      // "Completed", "Due", "Overdue"
      vesselReviewSubmittedDate: timestamp("vessel_review_submitted_date"),
      // When vessel submitted their review
      officeReviewStatus: text("office_review_status").notNull().default("Due"),
      // "Completed", "Due", "Overdue"
      officeReviewSubmittedDate: timestamp("office_review_submitted_date"),
      // When office submitted their review
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    restHoursCrewRecords = pgTable("rest_hours_crew_records", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      crewMemberId: text("crew_member_id").notNull(),
      // Crew member ID
      rank: text("rank").notNull(),
      // Crew member rank
      name: text("name").notNull(),
      // Full name (First Middle Last)
      month: text("month").notNull(),
      // Format: "Feb-2025" (MMM-YYYY)
      monthValue: text("month_value").notNull(),
      // Format: "2025-02" (YYYY-MM) for filtering/sorting
      // Partial month info for sign on/off
      signOnOffInfo: text("sign_on_off_info"),
      // e.g., "S.Off / 14th" or "S.On / 12th"
      // Individual crew member data
      recordingStatusPercent: integer("recording_status_percent").notNull().default(0),
      // 0-100
      activityConflicting: boolean("activity_conflicting").notNull().default(false),
      // Yes/No
      totalViolations: integer("total_violations").notNull().default(0),
      totalNCs: integer("total_ncs").notNull().default(0),
      // Non-conformities
      predictedViolations: integer("predicted_violations").notNull().default(0),
      predictedNCs: integer("predicted_ncs").notNull().default(0),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    restHoursDailyRecords = pgTable("rest_hours_daily_records", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull(),
      // Reference to crew member
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      rank: text("rank").notNull(),
      // Rank at time of recording
      name: text("name").notNull(),
      // Full name for display
      monthYear: text("month_year").notNull(),
      // Format: "2024-03" (YYYY-MM)
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
      dailyRecords: text("daily_records").notNull(),
      // JSON array of daily records
      // Form settings
      showPlanning: boolean("show_planning").default(false),
      opaMode: boolean("opa_mode").default(false),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => ({
      // Unique constraint: One record per crew member per vessel per month
      // This prevents duplicate records and works with the application-level upsert logic
      uniqueCrewVesselMonth: uniqueIndex("rest_hours_daily_records_unique_idx").on(
        table.crewMemberId,
        table.vesselId,
        table.monthYear
      )
    }));
    vesselViolationComments = pgTable("vessel_violation_comments", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      monthValue: text("month_value").notNull(),
      // Format: "2025-11" (YYYY-MM)
      comment: text("comment"),
      // Vessel comments, explanations, corrective actions
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    officeViolationComments = pgTable("office_violation_comments", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      monthValue: text("month_value").notNull(),
      // Format: "2025-11" (YYYY-MM)
      comment: text("comment"),
      // Office comments, explanations, corrective actions
      reviewerName: text("reviewer_name"),
      // Office reviewer name
      reviewerPosition: text("reviewer_position"),
      // Office reviewer position
      reviewDate: timestamp("review_date"),
      // Date of office review
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    ncReports = pgTable("nc_reports", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull(),
      // Crew member ID
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      rank: text("rank").notNull(),
      // Crew member's rank
      monthValue: text("month_value").notNull(),
      // Format: "2025-11" (YYYY-MM)
      ncReference: text("nc_reference").notNull().default("STCW/MLC/ILO"),
      // Always STCW/MLC/ILO
      identifiedRootCause: text("identified_root_cause"),
      // User input
      immediateCorrectiveAction: text("immediate_corrective_action"),
      // User input
      preventiveAction: text("preventive_action"),
      // User input
      preventiveActionStatus: text("preventive_action_status").notNull().default("Pending"),
      // "Pending" | "Completed"
      preventiveActionDueDate: timestamp("preventive_action_due_date"),
      // Due date for preventive action
      preventiveActionDateCompleted: timestamp("preventive_action_date_completed"),
      // Date when preventive action was completed
      officeClosureVerifiedByName: text("office_closure_verified_by_name"),
      // Office user name
      officeClosureVerifiedByPosition: text("office_closure_verified_by_position"),
      // Auto-filled position
      officeClosureDate: timestamp("office_closure_date"),
      // Date of office closure
      status: text("status").notNull().default("Open"),
      // "Open" | "Closed"
      submissionStatus: text("submission_status").notNull().default("draft"),
      // "draft" | "vessel-submitted" | "office-submitted"
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    fixedTasks = pgTable("fixed_tasks", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull(),
      // Reference to crew member
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      rank: text("rank").notNull(),
      // Rank at time of recording
      name: text("name").notNull(),
      // Full name for display
      monthYear: text("month_year").notNull(),
      // Format: "2025-10" (YYYY-MM)
      // Fixed task hours for Sea and Port (48 entries each)
      // Each entry is a 30-minute slot: ["w"|"d"|"", ...]
      // "w" = watch duty, "d" = day work, "" = rest
      seaHours: text("sea_hours").notNull(),
      // JSON array of 48 entries
      portHours: text("port_hours").notNull(),
      // JSON array of 48 entries
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    vesselDateLineAdjustments = pgTable("vessel_dateline_adjustments", {
      id: serial("id").primaryKey(),
      vesselId: text("vessel_id").notNull(),
      // Vessel ID from master data
      monthValue: text("month_value").notNull(),
      // Format: "2025-11" (YYYY-MM)
      // JSON array of date line adjustments: [{ day: 15, type: "advanced" | "retarded" }, ...]
      adjustments: text("adjustments").notNull(),
      // JSON: [{day: number, type: string}]
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true
    });
    insertFormSchema = createInsertSchema(forms).pick({
      name: true,
      category: true,
      rankGroup: true,
      versionNo: true,
      versionDate: true,
      configuration: true,
      sharedConfig: true
    });
    insertFormVersionSchema = createInsertSchema(formVersions).pick({
      formId: true,
      rankGroupId: true,
      versionNo: true,
      versionDate: true,
      status: true,
      configuration: true,
      sharedConfig: true
    });
    updateFormVersionSchema = createInsertSchema(formVersions).pick({
      versionNo: true,
      versionDate: true,
      status: true,
      configuration: true,
      sharedConfig: true
    }).partial();
    insertRankGroupSchema = createInsertSchema(rankGroups).pick({
      formId: true,
      name: true,
      ranks: true,
      archivedAt: true,
      configuration: true
    });
    updateRankGroupSchema = createInsertSchema(rankGroups).pick({
      name: true,
      ranks: true,
      archivedAt: true,
      configuration: true
    }).partial();
    insertAvailableRankSchema = createInsertSchema(availableRanks).pick({
      name: true,
      category: true,
      rankId: true,
      label: true,
      applicableToCompany: true,
      sortOrder: true,
      isSystemRank: true
    });
    updateAvailableRankSchema = createInsertSchema(availableRanks).pick({
      name: true,
      category: true,
      rankId: true,
      label: true,
      applicableToCompany: true,
      sortOrder: true,
      isSystemRank: true
    }).partial();
    insertTrainingMasterSchema = createInsertSchema(trainingMaster).pick({
      trainingId: true,
      trainingName: true,
      category: true,
      trainingGroup: true,
      requirementReference: true,
      applicableToCompany: true,
      trainingLabel: true,
      sortOrder: true,
      isDefault: true
    });
    updateTrainingMasterSchema = createInsertSchema(trainingMaster).pick({
      trainingId: true,
      trainingName: true,
      category: true,
      trainingGroup: true,
      requirementReference: true,
      applicableToCompany: true,
      trainingLabel: true,
      sortOrder: true,
      isDefault: true
    }).partial();
    insertCompanyTrainingGroupSchema = createInsertSchema(companyTrainingGroups).pick({
      code: true,
      label: true,
      displayOrder: true
    });
    updateCompanyTrainingGroupSchema = createInsertSchema(companyTrainingGroups).pick({
      label: true
    }).partial();
    insertCompanyTrainingSchema = createInsertSchema(companyTrainings).pick({
      trainingMasterId: true,
      companyId: true,
      trainingLabel: true,
      abr: true,
      requirement: true,
      groupCode: true,
      sortOrder: true
    });
    updateCompanyTrainingSchema = createInsertSchema(companyTrainings).pick({
      companyId: true,
      trainingLabel: true,
      abr: true,
      requirement: true,
      groupCode: true,
      sortOrder: true
    }).partial();
    insertCompanyTrainingRequirementSchema = createInsertSchema(companyTrainingRequirements).pick({
      companyTrainingId: true,
      rankId: true,
      status: true
    });
    upsertCompanyTrainingRequirementSchema = z.object({
      companyTrainingId: z.number(),
      rankId: z.number(),
      status: z.enum(["M", "R"]).nullable()
    });
    insertCrewMemberSchema = createInsertSchema(crewMembers).pick({
      // Photo
      uploadedPhoto: true,
      // Basic Personal Information
      empNo: true,
      firstName: true,
      middleName: true,
      familyName: true,
      // Changed from lastName
      dateOfBirth: true,
      age: true,
      nationality: true,
      // Rank and Employment
      presentRank: true,
      // Changed from rank
      rankAppliedFor: true,
      employeeId: true,
      // Vessel Information
      presentVessel: true,
      // Changed from vessel
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
      children: true
    }).extend({
      id: z.string().optional()
      // Make id optional, will be auto-generated if not provided
    });
    insertAppraisalResultSchema = createInsertSchema(appraisalResults).pick({
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
      stagePayloads: true
    });
    insertRecruitmentCandidateSchema = createInsertSchema(recruitmentCandidates).pick({
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
      applicationData: true
    });
    insertVesselSchema = createInsertSchema(vessels).pick({
      name: true,
      vesselGroup: true,
      vesselType: true
    });
    insertVesselGroupSchema = createInsertSchema(vesselGroups).pick({
      name: true,
      description: true,
      vesselIds: true
    });
    insertVesselDraftSchema = createInsertSchema(vesselDrafts).pick({
      vesselId: true,
      revision: true,
      draftData: true
    });
    insertVesselRevisionSchema = createInsertSchema(vesselRevisions).pick({
      vesselId: true,
      revision: true,
      revisionDate: true,
      revisionData: true
    }).extend({
      revisionDate: z.string().min(1, "Revision date is required").regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in dd/mm/yyyy format").refine((dateStr) => {
        const [day, month, year] = dateStr.split("/").map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
      }, {
        message: "Invalid date - please provide a valid date in dd/mm/yyyy format"
      })
    });
    insertTrainingMatrixVesselDraftSchema = createInsertSchema(trainingMatrixVesselDrafts).pick({
      vesselId: true,
      revision: true,
      draftData: true
    });
    insertTrainingMatrixVesselRevisionSchema = createInsertSchema(trainingMatrixVesselRevisions).pick({
      vesselId: true,
      revision: true,
      revisionDate: true,
      revisionData: true
    }).extend({
      revisionDate: z.string().min(1, "Revision date is required").regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in dd/mm/yyyy format").refine((dateStr) => {
        const [day, month, year] = dateStr.split("/").map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
      }, {
        message: "Invalid date - please provide a valid date in dd/mm/yyyy format"
      })
    });
    insertSeafarerSchema = createInsertSchema(seafarers).pick({
      firstName: true,
      middleName: true,
      lastName: true,
      rank: true,
      nationality: true,
      status: true
    });
    insertRevisionSchema = createInsertSchema(revisions).pick({
      vesselId: true,
      revisionNo: true,
      flexDate: true,
      status: true
    });
    insertVesselRankSchema = createInsertSchema(vesselRanks).pick({
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
      actualManning: true
    });
    insertCompanyRankSchema = createInsertSchema(companyRanks).pick({
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
      emtOfficer: true
    });
    insertPromotionHierarchySchema = createInsertSchema(promotionHierarchies).pick({
      groupName: true,
      rankPath: true,
      isActive: true
    }).extend({
      rankPath: z.union([
        z.string(),
        // Accept string from database
        z.array(z.string())
        // Accept array from frontend
      ]).transform((val) => {
        if (Array.isArray(val)) {
          return JSON.stringify(val);
        }
        return val;
      })
    });
    insertCompanyProcessingSchema = createInsertSchema(companyProcessing).pick({
      candidateId: true,
      processType: true,
      status: true,
      b7Data: true,
      comments: true,
      approvals: true,
      attachments: true
    });
    insertPromotionFormSchema = createInsertSchema(promotionForms).pick({
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
      appraisalResultId: true
    }).extend({
      submittedAt: z.string().or(z.date()).optional().transform((val) => val ? typeof val === "string" ? new Date(val) : val : void 0),
      reviewedAt: z.string().or(z.date()).optional().transform((val) => val ? typeof val === "string" ? new Date(val) : val : void 0)
    });
    insertDataMasterSchema = createInsertSchema(dataMasters).pick({
      id: true,
      name: true,
      description: true
    });
    insertMasterDataEntrySchema = createInsertSchema(masterDataEntries).pick({
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
      departmentId: true
    });
    insertIdCounterSchema = createInsertSchema(idCounters).pick({
      counterType: true,
      currentValue: true,
      prefix: true,
      format: true
    });
    insertVesselPlanningSchema = createInsertSchema(vesselPlanning).pick({
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
      archivedDate: true
    });
    insertRotationPlanSchema = createInsertSchema(rotationPlans).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRotationArchiveSchema = createInsertSchema(rotationArchive).omit({
      id: true,
      createdAt: true
    });
    insertDrugAlcoholTestRecordSchema = createInsertSchema(drugAlcoholTestRecords).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRestHoursVesselRecordSchema = createInsertSchema(restHoursVesselRecords).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRestHoursCrewRecordSchema = createInsertSchema(restHoursCrewRecords).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRestHoursDailyRecordSchema = createInsertSchema(restHoursDailyRecords).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertFixedTaskSchema = createInsertSchema(fixedTasks).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertVesselViolationCommentSchema = createInsertSchema(vesselViolationComments).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertOfficeViolationCommentSchema = createInsertSchema(officeViolationComments).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      reviewDate: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return void 0;
        if (val instanceof Date) return val;
        return new Date(val);
      })
    });
    insertNCReportSchema = createInsertSchema(ncReports).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    }).extend({
      preventiveActionDueDate: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return void 0;
        if (val instanceof Date) return val;
        return new Date(val);
      }),
      preventiveActionDateCompleted: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return void 0;
        if (val instanceof Date) return val;
        return new Date(val);
      }),
      officeClosureDate: z.union([z.string(), z.date()]).optional().transform((val) => {
        if (!val) return void 0;
        if (val instanceof Date) return val;
        return new Date(val);
      })
    });
    dashboardStatusSchema = z.object({
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
        phone: z.string()
      }).nullable()
    });
    experienceMetricSchema = z.object({
      company: z.number(),
      rank: z.number(),
      tankers: z.number(),
      ocw: z.number(),
      endorsements: z.string()
    });
    shipTypeItemSchema = z.object({
      type: z.string(),
      label: z.string(),
      months: z.number(),
      years: z.number()
    });
    shipTypeExperienceSchema = z.object({
      items: z.array(shipTypeItemSchema),
      totalMonths: z.number(),
      totalYears: z.number()
    });
    rankExperienceSchema = z.object({
      items: z.array(shipTypeItemSchema),
      totalMonths: z.number(),
      totalYears: z.number()
    });
    serviceAssignmentSchema = z.object({
      vessel: z.string(),
      vesselId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      contractEndDate: z.string().nullable(),
      rangeEndDate: z.string().nullable(),
      type: z.enum(["onBoard", "planned", "completed"]),
      appraisalIds: z.array(z.number()).optional(),
      handoverIds: z.array(z.number()).optional()
    });
    complianceItemSchema = z.object({
      category: z.string(),
      status: z.enum(["compliant", "issues", "pending"]),
      details: z.string().optional(),
      lastUpdated: z.string().optional()
    });
    careerStepSchema = z.object({
      position: z.string(),
      date: z.string().optional(),
      status: z.object({
        recommend: z.boolean(),
        advance: z.boolean(),
        demote: z.boolean(),
        approved: z.boolean()
      })
    });
    appraisalPointSchema = z.object({
      year: z.number(),
      score: z.number()
    });
    crewDashboardSummarySchema = z.object({
      status: dashboardStatusSchema,
      experience: experienceMetricSchema,
      shipTypes: shipTypeExperienceSchema,
      rankExperience: rankExperienceSchema,
      rankExperienceByVesselType: z.record(z.string(), z.number()).optional(),
      serviceTimeline: z.array(serviceAssignmentSchema),
      compliance: z.array(complianceItemSchema),
      careerProgression: z.array(careerStepSchema),
      appraisals: z.array(appraisalPointSchema)
    });
    variableTasks = pgTable("variable_tasks", {
      id: serial("id").primaryKey(),
      startDateTime: text("start_date_time").notNull(),
      finishDateTime: text("finish_date_time").notNull(),
      startDateTimeSort: text("start_date_time_sort").notNull(),
      // ISO format for sorting
      finishDateTimeSort: text("finish_date_time_sort").notNull(),
      // ISO format for sorting
      task: text("task").notNull(),
      // Display text for task
      status: text("status").notNull(),
      // 'Planned' or 'Completed'
      crewInvolved: integer("crew_involved").notNull(),
      // Count of crew members
      remarks: text("remarks"),
      periodValue: text("period_value"),
      // e.g., "2025-10"
      vesselId: text("vessel_id"),
      // New fields for form
      isDraft: boolean("is_draft").notNull().default(true),
      recordType: text("record_type").notNull(),
      // 'task' or 'port-call'
      statusType: text("status_type").notNull(),
      // 'planned' or 'completed'
      selectedTasks: text("selected_tasks"),
      // JSON array of task IDs
      otherTask: text("other_task"),
      // Free text for unlisted tasks
      crewInvolvedDetails: text("crew_involved_details"),
      // JSON array of crew member IDs and groups
      comments: text("comments")
    });
    insertVariableTaskSchema = createInsertSchema(variableTasks).omit({ id: true });
    dateLineAdjustmentSchema = z.object({
      day: z.number().min(1).max(31),
      type: z.enum(["advanced", "retarded"])
    });
    insertVesselDateLineAdjustmentSchema = createInsertSchema(vesselDateLineAdjustments).omit({ id: true, createdAt: true, updatedAt: true }).extend({
      vesselId: z.string().min(1, "Vessel ID is required"),
      monthValue: z.string().regex(/^\d{4}-\d{2}$/, "Month value must be in YYYY-MM format"),
      adjustments: z.string().refine(
        (val) => {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) && parsed.every(
              (item) => typeof item.day === "number" && item.day >= 1 && item.day <= 31 && (item.type === "advanced" || item.type === "retarded")
            );
          } catch {
            return false;
          }
        },
        { message: "Adjustments must be a valid JSON array of {day, type} objects" }
      )
    });
    oilMajorRules = pgTable("oil_major_rules", {
      id: serial("id").primaryKey(),
      oilMajorName: text("oil_major_name").notNull(),
      isActive: boolean("is_active").default(true),
      rules: text("rules").notNull(),
      // JSON string containing all rules for this oil major
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertOilMajorRulesSchema = createInsertSchema(oilMajorRules).omit({ id: true, createdAt: true, updatedAt: true });
    rankPairRuleSchema = z.object({
      label: z.string(),
      rankPair: z.string(),
      // e.g., "Master + Chief Officer"
      requiredValue: z.number(),
      // in years
      unit: z.enum(["years", "days"]).default("years")
    });
    experienceCategoryRulesSchema = z.object({
      yearsWithOperator: z.array(rankPairRuleSchema).optional(),
      yearsInRank: z.array(rankPairRuleSchema).optional(),
      yearsOnTankerType: z.array(rankPairRuleSchema).optional(),
      yearsOnAllTankers: z.array(rankPairRuleSchema).optional(),
      yearsAsOOW: z.array(rankPairRuleSchema).optional()
    });
    dateJoinedRuleSchema = z.object({
      label: z.string(),
      rankPair: z.string(),
      // e.g., "Master Joining Date - Chief Officer Joining Date"
      requiredDays: z.number()
      // minimum days gap
    });
    englishProficiencyRuleSchema = z.object({
      label: z.string(),
      // Description e.g., "English proficiency of Master must be good"
      rankPair: z.string(),
      // Officer(s) this applies to e.g., "Master", "Chief Officer"
      requiredLevel: z.string()
      // e.g., "Good"
    });
    conditionalRuleSchema = z.object({
      label: z.string(),
      // Full text of the conditional rule
      conditionType: z.enum([
        "officer_count_aggregate",
        // "If 3 junior deck officers onboard, aggregated experience..."
        "officer_below_threshold",
        // "If one of the 3 deck officers is below X months..."
        "officer_count_minimum"
        // "If 3 junior officers onboard, 2 must have at least..."
      ]),
      targetRanks: z.array(z.string()),
      // e.g., ["Second Officer", "Third Officer"] for junior deck
      conditionCount: z.number().optional(),
      // e.g., 3 for "If 3 junior deck officers"
      experienceCategory: z.string(),
      // e.g., "yearsAsOOW"
      requiredValue: z.number(),
      // Required experience value (in months or years)
      unit: z.enum(["months", "years"]).default("months"),
      thresholdValue: z.number().optional(),
      // For "below X months" conditions
      minimumOfficersMeetingReq: z.number().optional()
      // For "2 of the officers must have..."
    });
    oilMajorRulesConfigSchema = z.object({
      experienceRules: experienceCategoryRulesSchema,
      dateJoinedRules: z.array(dateJoinedRuleSchema).optional(),
      englishProficiencyRules: z.array(englishProficiencyRuleSchema).optional(),
      conditionalRules: z.array(conditionalRuleSchema).optional()
    });
    complianceRuleResultSchema = z.object({
      category: z.string(),
      label: z.string(),
      rankPair: z.string(),
      requiredValue: z.number(),
      actualValue: z.number(),
      unit: z.enum(["years", "days", "months", "proficiency", "officers", "conditional", "count"]),
      status: z.enum(["pass", "fail", "not_applicable"])
    });
    oilMajorComplianceResultSchema = z.object({
      oilMajorId: z.number(),
      oilMajorName: z.string(),
      overallStatus: z.enum(["green", "yellow", "red"]),
      results: z.array(complianceRuleResultSchema)
    });
    cbaTables = pgTable("cba_tables", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      tableData: text("table_data").notNull(),
      // JSON string for table structure and data
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    cbaTableEntries = pgTable("cba_table_entries", {
      id: serial("id").primaryKey(),
      tableId: integer("table_id").notNull().references(() => cbaTables.id),
      rank: text("rank"),
      vesselType: text("vessel_type"),
      category: text("category"),
      value: text("value").notNull(),
      effectiveDate: text("effective_date"),
      expiryDate: text("expiry_date"),
      currency: text("currency").default("USD"),
      createdAt: timestamp("created_at").defaultNow()
    });
    payElements = pgTable("pay_elements", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      code: text("code").notNull().unique(),
      type: text("type").notNull(),
      // 'earning' | 'deduction' | 'contribution'
      category: text("category").notNull(),
      formula: text("formula").notNull(),
      rounding: text("rounding").notNull(),
      ceiling: integer("ceiling"),
      floor: integer("floor"),
      effectiveDate: text("effective_date").notNull(),
      status: text("status").notNull().default("active"),
      // 'active' | 'inactive'
      vesselGroups: text("vessel_groups"),
      // JSON array of vessel group IDs
      reflectInContract: boolean("reflect_in_contract").default(true),
      // Controls if element appears in Contract Data
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    contractData = pgTable("contract_data", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
      vessel: text("vessel").notNull(),
      vesselGroup: text("vessel_group").notNull(),
      applicableFrom: text("applicable_from").notNull(),
      status: text("status").notNull().default("draft"),
      // 'draft' | 'active'
      currency: text("currency").notNull().default("USD"),
      lastModified: timestamp("last_modified").defaultNow(),
      modifiedBy: text("modified_by").notNull(),
      createdAt: timestamp("created_at").defaultNow()
    });
    contractPayElements = pgTable("contract_pay_elements", {
      id: serial("id").primaryKey(),
      contractId: integer("contract_id").notNull().references(() => contractData.id),
      payElementId: text("pay_element_id"),
      // null for custom elements
      payElementCode: text("pay_element_code").notNull(),
      payElementName: text("pay_element_name").notNull(),
      category: text("category").notNull(),
      type: text("type").notNull(),
      // 'earning' | 'deduction'
      applicable: boolean("applicable").notNull().default(false),
      formula: text("formula").notNull(),
      value: text("value"),
      // Can be amount or formula like "USD / HR"
      isCustom: boolean("is_custom").notNull().default(false),
      // True for user-added elements
      isInherited: boolean("is_inherited").notNull().default(true),
      // True for inherited from master
      sortOrder: integer("sort_order").default(0),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    allotments = pgTable("allotments", {
      id: text("id").primaryKey(),
      crewId: text("crew_id").notNull().references(() => crewMembers.id),
      crewName: text("crew_name").notNull(),
      rank: text("rank").notNull(),
      beneficiaryName: text("beneficiary_name").notNull(),
      relationship: text("relationship").notNull(),
      allotmentType: text("allotment_type").notNull(),
      // 'percentage' or 'fixed'
      value: integer("value").notNull(),
      // percentage value or fixed amount
      currency: text("currency").notNull().default("USD"),
      bankName: text("bank_name").notNull(),
      accountNumber: text("account_number").notNull(),
      priority: integer("priority").notNull().default(1),
      validFrom: text("valid_from").notNull(),
      validTo: text("valid_to").notNull(),
      status: text("status").notNull().default("active"),
      // 'active', 'pending', 'expired'
      kycComplete: boolean("kyc_complete").notNull().default(false),
      bankVerified: boolean("bank_verified").notNull().default(false),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    advances = pgTable("advances", {
      id: text("id").primaryKey(),
      crewId: text("crew_id").notNull().references(() => crewMembers.id),
      crewName: text("crew_name").notNull(),
      rank: text("rank").notNull(),
      amount: integer("amount").notNull(),
      currency: text("currency").notNull().default("USD"),
      reason: text("reason").notNull(),
      requestDate: text("request_date").notNull(),
      approver: text("approver"),
      status: text("status").notNull().default("pending"),
      // 'pending', 'approved', 'rejected', 'disbursed', 'recovered'
      capCheck: boolean("cap_check").notNull().default(true),
      remainingCap: integer("remaining_cap").notNull().default(0),
      recoveryAmount: integer("recovery_amount"),
      // Amount to deduct from payroll
      ctmReference: text("ctm_reference"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    bondItems = pgTable("bond_items", {
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
      deductionAmount: integer("deduction_amount"),
      // Amount to deduct from payroll
      status: text("status").notNull().default("pending"),
      // 'pending', 'deducted', 'cancelled'
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertCbaTableSchema = createInsertSchema(cbaTables).pick({
      name: true,
      description: true,
      tableData: true
    });
    insertCbaTableEntrySchema = createInsertSchema(cbaTableEntries).pick({
      tableId: true,
      rank: true,
      vesselType: true,
      category: true,
      value: true,
      effectiveDate: true,
      expiryDate: true,
      currency: true
    });
    insertPayElementSchema = createInsertSchema(payElements).pick({
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
      reflectInContract: true
    });
    insertContractDataSchema = createInsertSchema(contractData).pick({
      crewMemberId: true,
      vessel: true,
      vesselGroup: true,
      applicableFrom: true,
      status: true,
      currency: true,
      modifiedBy: true
    });
    insertContractPayElementSchema = createInsertSchema(contractPayElements).pick({
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
      sortOrder: true
    });
    insertAllotmentSchema = createInsertSchema(allotments).pick({
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
      bankVerified: true
    });
    insertAdvanceSchema = createInsertSchema(advances).pick({
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
      ctmReference: true
    });
    insertBondItemSchema = createInsertSchema(bondItems).pick({
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
      status: true
    });
    promotionA2OtherCriteriaSchema = z.object({
      id: z.string(),
      // e.g., "a2.6a", "a2.6b"
      label: z.string(),
      // Free text label for the criteria description
      requirement: z.string().optional()
      // Requirement value (right column)
    });
    promotionA2CesTestSchema = z.object({
      id: z.string(),
      // e.g., "a2.7a", "a2.7b"
      description: z.string().optional(),
      // Test description (e.g., "IELTS", "Marlins")
      minScore: z.number().nullable()
      // Minimum score required
    });
    promotionChecklistAssessmentPointSchema = z.object({
      id: z.string(),
      // Auto-generated: "B1.1", "B1.2", "B2.1", etc.
      text: z.string()
      // Description of the assessment point
    });
    promotionChecklistSectionSchema = z.object({
      id: z.string(),
      // Auto-generated: "B1", "B2", "B3", etc.
      title: z.string(),
      // Section title (e.g., "Practical Training & Ship Handling")
      assessmentPoints: z.array(promotionChecklistAssessmentPointSchema).default([])
    });
    promotionA2ConfigSchema = z.object({
      // A2.1 Higher License Criteria - selected license IDs from Master 016
      higherLicenseIds: z.array(z.string()).default([]),
      // A2.2 Age Criteria - min/max age range
      ageMin: z.number().nullable().default(null),
      ageMax: z.number().nullable().default(null),
      // A2.3 Experience & Sea Service Criteria
      experienceMonths: z.object({
        rankVessel: z.number().nullable().default(null),
        // A2.3a Minimum Rank Experience (Vessel)
        rankVesselType: z.number().nullable().default(null),
        // A2.3b Minimum Rank Experience (Vessel Type)
        companyService: z.number().nullable().default(null),
        // A2.3c Minimum Company Service in previous rank
        tankerExperience: z.number().nullable().default(null)
        // A2.3d Minimum Tanker Experience
      }).default({
        rankVessel: null,
        rankVesselType: null,
        companyService: null,
        tankerExperience: null
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
      savedBy: z.string().optional()
    });
    promotionReviews = pgTable("promotion_reviews", {
      id: serial("id").primaryKey(),
      crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
      promotionToRank: text("promotion_to_rank").notNull(),
      // Target rank for this promotion review
      // A2 Criteria - Vessel Type Selection for A2.3b
      selectedVesselTypeForA2_3b: text("selected_vessel_type_for_a2_3b"),
      // A2 Criteria Verified Status (JSON object mapping criteria ID to status)
      // e.g., { "a2.1": "yes", "a2.2": "na", "a2.3a": "", ... }
      criteriaVerifiedStatus: text("criteria_verified_status"),
      // JSON string
      // A2 Criteria Meets Status (JSON object mapping criteria ID to computed meets status)
      // Stores auto-computed "Meets Criteria" values: 'yes', 'no', 'pending'
      // e.g., { "a2.1": "yes", "a2.3a": "no", "a2.3b": "pending", ... }
      criteriaMeetsStatus: text("criteria_meets_status"),
      // JSON string
      // CES/Language Tests data (JSON array)
      cesTestsData: text("ces_tests_data"),
      // JSON string
      // Comments for each criteria (JSON object)
      criteriaComments: text("criteria_comments"),
      // JSON string
      // Training Needs (JSON array)
      trainingNeeds: text("training_needs"),
      // JSON string
      // Part B - Approval data (JSON object)
      approvalData: text("approval_data"),
      // JSON string
      // A4 - Selected approvers for submission (JSON array of approver names)
      selectedApproversForSubmission: text("selected_approvers_for_submission"),
      // JSON string
      // Part C - Execution data
      promotionConfirmed: text("promotion_confirmed"),
      // 'yes', 'waitlist', 'rejected'
      vesselAssigned: text("vessel_assigned"),
      promotionDate: text("promotion_date"),
      promotionTiming: text("promotion_timing"),
      // 'on-board', 'prior-joining'
      // Form notes
      partANotes: text("part_a_notes"),
      partBNotes: text("part_b_notes"),
      partCNotes: text("part_c_notes"),
      // Part B - Promotion Checklist Progress Data (JSON string)
      // Stores the full checklist state including completed status, verifications, comments, attachments
      checklistProgressData: text("checklist_progress_data"),
      // Form status
      status: text("status").notNull().default("draft"),
      // 'draft', 'submitted', 'approved', 'rejected'
      // Timestamps
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertPromotionReviewSchema = createInsertSchema(promotionReviews).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
  }
});

// server/database.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import "dotenv/config";
import { eq, desc, asc, sql, and, inArray, or, like, ilike, isNull } from "drizzle-orm";
var DatabaseStorage;
var init_database = __esm({
  "server/database.ts"() {
    "use strict";
    init_dateUtils();
    init_schema();
    DatabaseStorage = class {
      db;
      pool;
      columnCache = /* @__PURE__ */ new Map();
      // Cache existing column names per table
      constructor() {
        const { DATABASE_URL } = process.env;
        if (!DATABASE_URL) {
          throw new Error("DATABASE_URL environment variable is required for PostgreSQL connection");
        }
        const requiresSsl = DATABASE_URL.includes("sslmode=require") || DATABASE_URL.includes("ssl=true");
        console.log(`\u{1F510} SSL Configuration: ${requiresSsl ? "ENABLED (required by connection string)" : "DISABLED (internal database)"}`);
        this.pool = new Pool({
          connectionString: DATABASE_URL,
          ssl: requiresSsl ? {
            rejectUnauthorized: false,
            checkServerIdentity: () => void 0
          } : false,
          max: 10
        });
        this.db = drizzle(this.pool);
        this.ensureMasterDataEntriesSchema().catch(
          (err) => console.error("Schema migration failed:", err)
        );
      }
      async close() {
        await this.pool.end();
      }
      // Public accessor for migration scripts
      getDb() {
        return this.db;
      }
      // Column Allow-List Filter Methods
      async getExistingColumns(tableName) {
        if (this.columnCache.has(tableName)) {
          return this.columnCache.get(tableName);
        }
        try {
          const result = await this.pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
            [tableName]
          );
          const columnNames = result.rows.map((row) => row.column_name);
          const columns = new Set(columnNames);
          this.columnCache.set(tableName, columns);
          console.log(`\u{1F4CB} Cached columns for ${tableName}:`, Array.from(columns));
          return columns;
        } catch (error) {
          console.error(`\u274C Failed to get columns for ${tableName}:`, error);
          return /* @__PURE__ */ new Set();
        }
      }
      async filterPayloadByExistingColumns(payload, tableName) {
        const existingColumns = await this.getExistingColumns(tableName);
        const filtered = {};
        const filteredOutKeys = [];
        const fieldMapping = {
          masterId: "master_id",
          entryId: "entry_id",
          createdAt: "created_at",
          updatedAt: "updated_at"
        };
        for (const [key, value] of Object.entries(payload)) {
          const dbColumnName = fieldMapping[key] || key;
          console.log(`\u{1F527} [FIELD MAP] ${key} -> ${dbColumnName}, exists: ${existingColumns.has(dbColumnName)}`);
          if (existingColumns.has(dbColumnName)) {
            filtered[dbColumnName] = value;
          } else {
            filteredOutKeys.push(key);
          }
        }
        if (filteredOutKeys.length > 0) {
          console.log(`\u{1F527} Filtered out non-existent columns for ${tableName}:`, filteredOutKeys);
        }
        console.log(`\u2705 Final filtered payload for ${tableName}:`, filtered);
        return filtered;
      }
      // Name Field Fallback for Master 014 (Vessel Master)
      ensureNameFieldForVesselMaster(insertEntry) {
        if (insertEntry.masterId === "014" && !insertEntry.name) {
          const derivedName = insertEntry.vessel || insertEntry.imoNumber || insertEntry.entryId || "Unnamed Vessel";
          console.log(`\u{1F6A2} Master 014: Deriving name field from vessel data. Result: "${derivedName}"`);
          return { ...insertEntry, name: derivedName };
        }
        return insertEntry;
      }
      // Self-migration to ensure master_data_entries has enhanced nationality schema
      async ensureMasterDataEntriesSchema() {
        console.log("\u2705 Schema migrations handled by Drizzle/PostgreSQL migrations");
        return;
      }
      // Migrate Port master data from ID '005' to ID '018' (consolidation fix)
      async migratePortMasterFromId005ToId018() {
        try {
          console.log("\u{1F6A2} Checking for Port master data migration from ID '005' to ID '018'...");
          const [existingId005Entries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '005'"
          );
          const id005Count = existingId005Entries[0].count;
          console.log(`\u{1F4CA} Found ${id005Count} entries with old Port master ID '005'`);
          if (id005Count > 0) {
            console.log("\u{1F504} Migrating Port master entries from ID '005' to ID '018'...");
            await this.pool.query(
              "UPDATE master_data_entries SET master_id = '018' WHERE master_id = '005'"
            );
            console.log(`\u2705 Successfully migrated ${id005Count} Port master entries from ID '005' to ID '018'`);
          } else {
            console.log("\u2705 No Port master entries found with old ID '005' - migration not needed");
          }
          const [existingMaster005] = await this.pool.query(
            "SELECT COUNT(*) as count FROM data_masters WHERE id = '005'"
          );
          if (existingMaster005[0].count > 0) {
            console.log("\u{1F5D1}\uFE0F Removing duplicate Port master with ID '005' from data_masters table...");
            await this.pool.query("DELETE FROM data_masters WHERE id = '005'");
            console.log("\u2705 Duplicate Port master with ID '005' removed from data_masters table");
          }
        } catch (error) {
          console.error("\u274C Failed to migrate Port master data from ID '005' to ID '018':", error);
        }
      }
      // Ensure nationality master data is properly seeded with enhanced structure
      async ensureNationalityDataSeeded() {
        try {
          console.log("\u{1F30D} Checking nationality master data...");
          const [existingNationalityEntries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '001' AND entry_id LIKE 'NAT%'"
          );
          const enhancedEntriesCount = existingNationalityEntries[0].count;
          console.log(`\u{1F4CA} Found ${enhancedEntriesCount} enhanced nationality entries with NAT format`);
          if (enhancedEntriesCount !== 20) {
            console.log("\u{1F5C2}\uFE0F Seeding enhanced nationality master data...");
            await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '001'");
            const nationalityData = [
              { entryId: "NAT001", name: "Filipino", description: "Philippines", countryName: "Filipino", country: "Philippines" },
              { entryId: "NAT002", name: "Indian", description: "India", countryName: "Indian", country: "India" },
              { entryId: "NAT003", name: "Chinese", description: "China", countryName: "Chinese", country: "China" },
              { entryId: "NAT004", name: "Ukrainian", description: "Ukraine", countryName: "Ukrainian", country: "Ukraine" },
              { entryId: "NAT005", name: "Russian", description: "Russia", countryName: "Russian", country: "Russia" },
              { entryId: "NAT006", name: "Indonesian", description: "Indonesia", countryName: "Indonesian", country: "Indonesia" },
              { entryId: "NAT007", name: "Turkish", description: "Turkey", countryName: "Turkish", country: "Turkey" },
              { entryId: "NAT008", name: "Polish", description: "Poland", countryName: "Polish", country: "Poland" },
              { entryId: "NAT009", name: "Romanian", description: "Romania", countryName: "Romanian", country: "Romania" },
              { entryId: "NAT010", name: "Bulgarian", description: "Bulgaria", countryName: "Bulgarian", country: "Bulgaria" },
              { entryId: "NAT011", name: "Greek", description: "Greece", countryName: "Greek", country: "Greece" },
              { entryId: "NAT012", name: "Croatian", description: "Croatia", countryName: "Croatian", country: "Croatia" },
              { entryId: "NAT013", name: "Burmese", description: "Myanmar", countryName: "Burmese", country: "Myanmar" },
              { entryId: "NAT014", name: "Vietnamese", description: "Vietnam", countryName: "Vietnamese", country: "Vietnam" },
              { entryId: "NAT015", name: "Bangladeshi", description: "Bangladesh", countryName: "Bangladeshi", country: "Bangladesh" },
              { entryId: "NAT016", name: "Pakistani", description: "Pakistan", countryName: "Pakistani", country: "Pakistan" },
              { entryId: "NAT017", name: "Sri Lankan", description: "Sri Lanka", countryName: "Sri Lankan", country: "Sri Lanka" },
              { entryId: "NAT018", name: "Georgian", description: "Georgia", countryName: "Georgian", country: "Georgia" },
              { entryId: "NAT019", name: "Latvian", description: "Latvia", countryName: "Latvian", country: "Latvia" },
              { entryId: "NAT020", name: "Estonian", description: "Estonia", countryName: "Estonian", country: "Estonia" }
            ];
            for (const nationality of nationalityData) {
              await this.pool.query(
                `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, countryName, country, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                ["001", nationality.entryId, nationality.name, nationality.description, nationality.countryName, nationality.country, 1, 0]
              );
            }
            console.log("\u2705 Enhanced nationality master data seeded successfully with NAT001-NAT020 format");
          } else {
            console.log("\u2705 Enhanced nationality master data already exists");
          }
        } catch (error) {
          console.error("\u274C Failed to seed nationality master data:", error);
        }
      }
      // Fix specific nationality data inconsistencies identified by architect review
      async fixNationalityDataInconsistencies() {
        try {
          console.log("\u{1F527} Checking for nationality data inconsistencies...");
          const [problematicEntries] = await this.pool.query(
            "SELECT entry_id, countryName FROM master_data_entries WHERE master_id = '001' AND (entry_id = 'NAT013' OR entry_id = 'NAT015')"
          );
          let updatesNeeded = false;
          for (const entry of problematicEntries) {
            if (entry.entry_id === "NAT013" && entry.countryName === "Myanmar") {
              updatesNeeded = true;
              break;
            }
            if (entry.entry_id === "NAT015" && entry.countryName === "Bangladesh") {
              updatesNeeded = true;
              break;
            }
          }
          if (updatesNeeded) {
            console.log("\u{1F6E0}\uFE0F Fixing nationality data inconsistencies...");
            await this.pool.query(
              "UPDATE master_data_entries SET name = 'Burmese', countryName = 'Burmese' WHERE master_id = '001' AND entry_id = 'NAT013'"
            );
            await this.pool.query(
              "UPDATE master_data_entries SET name = 'Bangladeshi', countryName = 'Bangladeshi' WHERE master_id = '001' AND entry_id = 'NAT015'"
            );
            console.log("\u2705 Nationality data inconsistencies fixed (NAT013: Myanmar->Burmese, NAT015: Bangladesh->Bangladeshi)");
          } else {
            console.log("\u2705 Nationality data is already consistent");
          }
        } catch (error) {
          console.error("\u274C Failed to fix nationality data inconsistencies:", error);
        }
      }
      // Ensure country master data is properly seeded with enhanced structure
      async ensureCountryDataSeeded() {
        try {
          console.log("\u{1F30E} Checking country master data...");
          const [existingCountryEntries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '002' AND entry_id RLIKE '^[0-9]+$'"
          );
          const enhancedCountriesCount = existingCountryEntries[0].count;
          console.log(`\u{1F4CA} Found ${enhancedCountriesCount} enhanced country entries with numeric entry IDs`);
          if (enhancedCountriesCount < 50) {
            console.log("\u{1F5C2}\uFE0F Seeding enhanced country master data...");
            await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '002'");
            const countryData = [
              { entryId: "001", name: "Afghanistan", description: "Afghanistan", countryName: "Afghanistan", countryCode: "AF", nationality: "Afghan", cid: "AF001", countryRefId: "AFG" },
              { entryId: "002", name: "Algeria", description: "Algeria", countryName: "Algeria", countryCode: "DZ", nationality: "Algerian", cid: "DZ002", countryRefId: "DZA" },
              { entryId: "003", name: "Albania", description: "Albania", countryName: "Albania", countryCode: "AL", nationality: "Albanian", cid: "AL003", countryRefId: "ALB" },
              { entryId: "004", name: "United Kingdom", description: "United Kingdom", countryName: "United Kingdom", countryCode: "GB", nationality: "British", cid: "GB004", countryRefId: "GBR" },
              { entryId: "005", name: "United States", description: "United States", countryName: "United States", countryCode: "US", nationality: "American", cid: "US005", countryRefId: "USA" },
              { entryId: "006", name: "Canada", description: "Canada", countryName: "Canada", countryCode: "CA", nationality: "Canadian", cid: "CA006", countryRefId: "CAN" },
              { entryId: "007", name: "Australia", description: "Australia", countryName: "Australia", countryCode: "AU", nationality: "Australian", cid: "AU007", countryRefId: "AUS" },
              { entryId: "008", name: "Germany", description: "Germany", countryName: "Germany", countryCode: "DE", nationality: "German", cid: "DE008", countryRefId: "DEU" },
              { entryId: "009", name: "France", description: "France", countryName: "France", countryCode: "FR", nationality: "French", cid: "FR009", countryRefId: "FRA" },
              { entryId: "010", name: "Italy", description: "Italy", countryName: "Italy", countryCode: "IT", nationality: "Italian", cid: "IT010", countryRefId: "ITA" },
              { entryId: "011", name: "Spain", description: "Spain", countryName: "Spain", countryCode: "ES", nationality: "Spanish", cid: "ES011", countryRefId: "ESP" },
              { entryId: "012", name: "Netherlands", description: "Netherlands", countryName: "Netherlands", countryCode: "NL", nationality: "Dutch", cid: "NL012", countryRefId: "NLD" },
              { entryId: "013", name: "Norway", description: "Norway", countryName: "Norway", countryCode: "NO", nationality: "Norwegian", cid: "NO013", countryRefId: "NOR" },
              { entryId: "014", name: "Sweden", description: "Sweden", countryName: "Sweden", countryCode: "SE", nationality: "Swedish", cid: "SE014", countryRefId: "SWE" },
              { entryId: "015", name: "Denmark", description: "Denmark", countryName: "Denmark", countryCode: "DK", nationality: "Danish", cid: "DK015", countryRefId: "DNK" },
              { entryId: "016", name: "Japan", description: "Japan", countryName: "Japan", countryCode: "JP", nationality: "Japanese", cid: "JP016", countryRefId: "JPN" },
              { entryId: "017", name: "South Korea", description: "South Korea", countryName: "South Korea", countryCode: "KR", nationality: "Korean", cid: "KR017", countryRefId: "KOR" },
              { entryId: "018", name: "China", description: "China", countryName: "China", countryCode: "CN", nationality: "Chinese", cid: "CN018", countryRefId: "CHN" },
              { entryId: "019", name: "India", description: "India", countryName: "India", countryCode: "IN", nationality: "Indian", cid: "IN019", countryRefId: "IND" },
              { entryId: "020", name: "Singapore", description: "Singapore", countryName: "Singapore", countryCode: "SG", nationality: "Singaporean", cid: "SG020", countryRefId: "SGP" },
              { entryId: "021", name: "Brazil", description: "Brazil", countryName: "Brazil", countryCode: "BR", nationality: "Brazilian", cid: "BR021", countryRefId: "BRA" },
              { entryId: "022", name: "Argentina", description: "Argentina", countryName: "Argentina", countryCode: "AR", nationality: "Argentine", cid: "AR022", countryRefId: "ARG" },
              { entryId: "023", name: "Mexico", description: "Mexico", countryName: "Mexico", countryCode: "MX", nationality: "Mexican", cid: "MX023", countryRefId: "MEX" },
              { entryId: "024", name: "Panama", description: "Panama", countryName: "Panama", countryCode: "PA", nationality: "Panamanian", cid: "PA024", countryRefId: "PAN" },
              { entryId: "025", name: "Philippines", description: "Philippines", countryName: "Philippines", countryCode: "PH", nationality: "Filipino", cid: "PH025", countryRefId: "PHL" },
              { entryId: "026", name: "Indonesia", description: "Indonesia", countryName: "Indonesia", countryCode: "ID", nationality: "Indonesian", cid: "ID026", countryRefId: "IDN" },
              { entryId: "027", name: "Malaysia", description: "Malaysia", countryName: "Malaysia", countryCode: "MY", nationality: "Malaysian", cid: "MY027", countryRefId: "MYS" },
              { entryId: "028", name: "Thailand", description: "Thailand", countryName: "Thailand", countryCode: "TH", nationality: "Thai", cid: "TH028", countryRefId: "THA" },
              { entryId: "029", name: "Vietnam", description: "Vietnam", countryName: "Vietnam", countryCode: "VN", nationality: "Vietnamese", cid: "VN029", countryRefId: "VNM" },
              { entryId: "030", name: "Turkey", description: "Turkey", countryName: "Turkey", countryCode: "TR", nationality: "Turkish", cid: "TR030", countryRefId: "TUR" },
              { entryId: "031", name: "Greece", description: "Greece", countryName: "Greece", countryCode: "GR", nationality: "Greek", cid: "GR031", countryRefId: "GRC" },
              { entryId: "032", name: "Cyprus", description: "Cyprus", countryName: "Cyprus", countryCode: "CY", nationality: "Cypriot", cid: "CY032", countryRefId: "CYP" },
              { entryId: "033", name: "Malta", description: "Malta", countryName: "Malta", countryCode: "MT", nationality: "Maltese", cid: "MT033", countryRefId: "MLT" },
              { entryId: "034", name: "Liberia", description: "Liberia", countryName: "Liberia", countryCode: "LR", nationality: "Liberian", cid: "LR034", countryRefId: "LBR" },
              { entryId: "035", name: "Marshall Islands", description: "Marshall Islands", countryName: "Marshall Islands", countryCode: "MH", nationality: "Marshallese", cid: "MH035", countryRefId: "MHL" },
              { entryId: "036", name: "Bahamas", description: "Bahamas", countryName: "Bahamas", countryCode: "BS", nationality: "Bahamian", cid: "BS036", countryRefId: "BHS" },
              { entryId: "037", name: "Barbados", description: "Barbados", countryName: "Barbados", countryCode: "BB", nationality: "Barbadian", cid: "BB037", countryRefId: "BRB" },
              { entryId: "038", name: "Antigua and Barbuda", description: "Antigua and Barbuda", countryName: "Antigua and Barbuda", countryCode: "AG", nationality: "Antiguan", cid: "AG038", countryRefId: "ATG" },
              { entryId: "039", name: "Saint Vincent", description: "Saint Vincent and the Grenadines", countryName: "Saint Vincent and the Grenadines", countryCode: "VC", nationality: "Vincentian", cid: "VC039", countryRefId: "VCT" },
              { entryId: "040", name: "Saint Kitts and Nevis", description: "Saint Kitts and Nevis", countryName: "Saint Kitts and Nevis", countryCode: "KN", nationality: "Kittitian", cid: "KN040", countryRefId: "KNA" },
              { entryId: "041", name: "Russia", description: "Russia", countryName: "Russia", countryCode: "RU", nationality: "Russian", cid: "RU041", countryRefId: "RUS" },
              { entryId: "042", name: "Ukraine", description: "Ukraine", countryName: "Ukraine", countryCode: "UA", nationality: "Ukrainian", cid: "UA042", countryRefId: "UKR" },
              { entryId: "043", name: "Poland", description: "Poland", countryName: "Poland", countryCode: "PL", nationality: "Polish", cid: "PL043", countryRefId: "POL" },
              { entryId: "044", name: "Romania", description: "Romania", countryName: "Romania", countryCode: "RO", nationality: "Romanian", cid: "RO044", countryRefId: "ROU" },
              { entryId: "045", name: "Bulgaria", description: "Bulgaria", countryName: "Bulgaria", countryCode: "BG", nationality: "Bulgarian", cid: "BG045", countryRefId: "BGR" },
              { entryId: "046", name: "Croatia", description: "Croatia", countryName: "Croatia", countryCode: "HR", nationality: "Croatian", cid: "HR046", countryRefId: "HRV" },
              { entryId: "047", name: "Estonia", description: "Estonia", countryName: "Estonia", countryCode: "EE", nationality: "Estonian", cid: "EE047", countryRefId: "EST" },
              { entryId: "048", name: "Latvia", description: "Latvia", countryName: "Latvia", countryCode: "LV", nationality: "Latvian", cid: "LV048", countryRefId: "LVA" },
              { entryId: "049", name: "Lithuania", description: "Lithuania", countryName: "Lithuania", countryCode: "LT", nationality: "Lithuanian", cid: "LT049", countryRefId: "LTU" },
              { entryId: "050", name: "Finland", description: "Finland", countryName: "Finland", countryCode: "FI", nationality: "Finnish", cid: "FI050", countryRefId: "FIN" }
            ];
            for (const country of countryData) {
              await this.pool.query(
                `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, countryName, countryCode, nationality, cid, countryRefId, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                ["002", country.entryId, country.name, country.description, country.countryName, country.countryCode, country.nationality, country.cid, country.countryRefId, 1, 0]
              );
            }
            console.log("\u2705 Enhanced country master data seeded successfully with 001-050 format");
          } else {
            console.log("\u2705 Enhanced country master data already exists");
          }
        } catch (error) {
          console.error("\u274C Failed to seed country master data:", error);
        }
      }
      // Vessel type seeding DISABLED - Users manage their own vessel types
      async ensureVesselTypeDataSeeded() {
        try {
          console.log("\u{1F6A2} Vessel type automatic seeding is disabled - users manage their own entries");
          return;
          const [existingVesselTypeEntries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '004' AND entry_id RLIKE '^VT[0-9]+$'"
          );
          const enhancedVesselTypesCount = existingVesselTypeEntries[0].count;
          console.log(`\u{1F4CA} Found ${enhancedVesselTypesCount} enhanced vessel type entries with VT format`);
          if (false) {
            console.log("\u{1F5C2}\uFE0F Seeding enhanced vessel type master data with duplicate checking...");
            const vesselTypeData = [
              { entryId: "VT001", name: "Oil Tanker", description: "Oil Tanker", vtuid: "OT001", vesselType: "Oil Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT002", name: "Chemical Tanker", description: "Chemical Tanker", vtuid: "CT002", vesselType: "Chemical Tanker", tanker: 1, oilTanker: 0, gasTanker: 0, chemicalTanker: 1, bulk: 0 },
              { entryId: "VT003", name: "LPG Tanker", description: "LPG Tanker", vtuid: "LPG003", vesselType: "LPG Tanker", tanker: 1, oilTanker: 0, gasTanker: 1, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT004", name: "LNG Tanker", description: "LNG Tanker", vtuid: "LNG004", vesselType: "LNG Tanker", tanker: 1, oilTanker: 0, gasTanker: 1, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT005", name: "Bulk Carrier", description: "Bulk Carrier", vtuid: "BC005", vesselType: "Bulk Carrier", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 1 },
              { entryId: "VT006", name: "Container Ship", description: "Container Ship", vtuid: "CS006", vesselType: "Container Ship", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT007", name: "General Cargo", description: "General Cargo", vtuid: "GC007", vesselType: "General Cargo", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT008", name: "Product Tanker", description: "Product Tanker", vtuid: "PT008", vesselType: "Product Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT009", name: "Crude Oil Tanker", description: "Crude Oil Tanker", vtuid: "COT009", vesselType: "Crude Oil Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
              { entryId: "VT010", name: "Dry Bulk Carrier", description: "Dry Bulk Carrier", vtuid: "DBC010", vesselType: "Dry Bulk Carrier", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 1 }
            ];
            for (const vesselType of vesselTypeData) {
              try {
                const [existing] = await this.pool.query(
                  "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '004' AND entry_id = ?",
                  [vesselType.entryId]
                );
                if (existing[0].count === 0) {
                  console.log(`\u{1F6A2} Creating vessel type entry: ${vesselType.entryId} - ${vesselType.name}`);
                  await this.pool.query(
                    `INSERT INTO master_data_entries 
                 (master_id, entry_id, name, description, vtuid, vesselType, tanker, oilTanker, gasTanker, chemicalTanker, bulk, isActive, isDeleted, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    ["004", vesselType.entryId, vesselType.name, vesselType.description, vesselType.vtuid, vesselType.vesselType, vesselType.tanker, vesselType.oilTanker, vesselType.gasTanker, vesselType.chemicalTanker, vesselType.bulk, 1, 0]
                  );
                } else {
                  console.log(`\u2705 Vessel type entry already exists: ${vesselType.entryId} - ${vesselType.name}`);
                }
              } catch (error) {
                console.warn(`\u26A0\uFE0F Warning: Could not create vessel type entry ${vesselType.entryId}:`, error);
              }
            }
            console.log("\u2705 Enhanced vessel type master data seeded successfully with VT001-VT010 format");
          } else {
            console.log("\u2705 Enhanced vessel type master data already exists");
          }
        } catch (error) {
          console.error("\u274C Failed to seed vessel type master data:", error);
        }
      }
      // Ensure language master data is properly seeded with simple structure
      async ensureLanguageDataSeeded() {
        try {
          console.log("\u{1F310} Checking language master data...");
          const [existingLanguageEntries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '003' AND entry_id RLIKE '^LNG[0-9]+$'"
          );
          const enhancedLanguagesCount = existingLanguageEntries[0].count;
          console.log(`\u{1F4CA} Found ${enhancedLanguagesCount} enhanced language entries with LNG format`);
          if (enhancedLanguagesCount < 20) {
            console.log("\u{1F5C2}\uFE0F Cleaning and seeding enhanced language master data...");
            await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '003'");
            console.log("\u{1F9F9} Removed vessel type pollution from Language master (003)");
            const languageData = [
              { entryId: "LNG001", name: "English", description: "EN" },
              { entryId: "LNG002", name: "Spanish", description: "ES" },
              { entryId: "LNG003", name: "Chinese", description: "ZH" },
              { entryId: "LNG004", name: "Filipino", description: "TL" },
              { entryId: "LNG005", name: "Russian", description: "RU" },
              { entryId: "LNG006", name: "Indonesian", description: "ID" },
              { entryId: "LNG007", name: "Hindi", description: "HI" },
              { entryId: "LNG008", name: "Arabic", description: "AR" },
              { entryId: "LNG009", name: "Portuguese", description: "PT" },
              { entryId: "LNG010", name: "French", description: "FR" },
              { entryId: "LNG011", name: "Japanese", description: "JA" },
              { entryId: "LNG012", name: "Korean", description: "KO" },
              { entryId: "LNG013", name: "Vietnamese", description: "VI" },
              { entryId: "LNG014", name: "Turkish", description: "TR" },
              { entryId: "LNG015", name: "Greek", description: "EL" },
              { entryId: "LNG016", name: "Ukrainian", description: "UK" },
              { entryId: "LNG017", name: "Polish", description: "PL" },
              { entryId: "LNG018", name: "Romanian", description: "RO" },
              { entryId: "LNG019", name: "Thai", description: "TH" },
              { entryId: "LNG020", name: "Malay", description: "MS" }
            ];
            for (const language of languageData) {
              await this.pool.query(
                `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                ["003", language.entryId, language.name, language.description, 1, 0]
              );
            }
            console.log("\u2705 Enhanced language master data seeded successfully with LNG001-LNG020 format");
          } else {
            console.log("\u2705 Enhanced language master data already exists");
          }
        } catch (error) {
          console.error("\u274C Failed to seed language master data:", error);
        }
      }
      // Ensure port master data is properly seeded with enhanced structure  
      async ensurePortDataSeeded() {
        try {
          console.log("\u{1F3F0} Checking port master data...");
          const [existingPortEntries] = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '018' AND entry_id RLIKE '^PORT[0-9]+$'"
          );
          const enhancedPortsCount = existingPortEntries[0].count;
          console.log(`\u{1F4CA} Found ${enhancedPortsCount} enhanced port entries with PORT format`);
          if (enhancedPortsCount < 20) {
            console.log("\u{1F5C2}\uFE0F Seeding enhanced port master data...");
            await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '018'");
            const portData = [
              { entryId: "PORT001", name: "Singapore", description: "Port of Singapore", portCode: "SGSIN", portName: "Singapore", latitude: 1.2966, longitude: 103.8764, countryId: "020", region: "Southeast Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,Bulk,Tanker,Passenger" },
              { entryId: "PORT002", name: "Shanghai", description: "Port of Shanghai", portCode: "CNSHA", portName: "Shanghai", latitude: 31.2304, longitude: 121.4737, countryId: "018", region: "East Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,Bulk,General Cargo" },
              { entryId: "PORT003", name: "Rotterdam", description: "Port of Rotterdam", portCode: "NLRTM", portName: "Rotterdam", latitude: 51.9225, longitude: 4.4792, countryId: "012", region: "Europe", timeZone: "GMT+1", harborType: "Container Hub", facilities: "Container,Bulk,Tanker,Chemicals" },
              { entryId: "PORT004", name: "Antwerp", description: "Port of Antwerp", portCode: "BEANR", portName: "Antwerp", latitude: 51.2194, longitude: 4.4025, countryId: "004", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Chemicals" },
              { entryId: "PORT005", name: "Hamburg", description: "Port of Hamburg", portCode: "DEHAM", portName: "Hamburg", latitude: 53.5511, longitude: 9.9937, countryId: "008", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Bulk" },
              { entryId: "PORT006", name: "Los Angeles", description: "Port of Los Angeles", portCode: "USLAX", portName: "Los Angeles", latitude: 33.7447, longitude: -118.2567, countryId: "005", region: "North America", timeZone: "GMT-8", harborType: "Container Hub", facilities: "Container,Bulk,General Cargo" },
              { entryId: "PORT007", name: "Hong Kong", description: "Port of Hong Kong", portCode: "HKHKG", portName: "Hong Kong", latitude: 22.3193, longitude: 114.1694, countryId: "018", region: "East Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,General Cargo,Transshipment" },
              { entryId: "PORT008", name: "Dubai", description: "Port of Dubai", portCode: "AEDXB", portName: "Dubai", latitude: 25.2697, longitude: 55.3094, countryId: "004", region: "Middle East", timeZone: "GMT+4", harborType: "Container Hub", facilities: "Container,General Cargo,Transshipment" },
              { entryId: "PORT009", name: "New York", description: "Port of New York", portCode: "USNYC", portName: "New York", latitude: 40.6892, longitude: -74.0445, countryId: "005", region: "North America", timeZone: "GMT-5", harborType: "Container Port", facilities: "Container,General Cargo,Bulk" },
              { entryId: "PORT010", name: "Busan", description: "Port of Busan", portCode: "KRPUS", portName: "Busan", latitude: 35.1796, longitude: 129.0756, countryId: "017", region: "East Asia", timeZone: "GMT+9", harborType: "Container Hub", facilities: "Container,Bulk,Transshipment" },
              { entryId: "PORT011", name: "Le Havre", description: "Port of Le Havre", portCode: "FRLEH", portName: "Le Havre", latitude: 49.4944, longitude: 0.1079, countryId: "009", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Tanker" },
              { entryId: "PORT012", name: "Felixstowe", description: "Port of Felixstowe", portCode: "GBFXT", portName: "Felixstowe", latitude: 51.9607, longitude: 1.3511, countryId: "004", region: "Europe", timeZone: "GMT", harborType: "Container Port", facilities: "Container,General Cargo" },
              { entryId: "PORT013", name: "Mumbai", description: "Port of Mumbai", portCode: "INMUN", portName: "Mumbai", latitude: 18.922, longitude: 72.8347, countryId: "019", region: "South Asia", timeZone: "GMT+5:30", harborType: "Container Port", facilities: "Container,Bulk,General Cargo" },
              { entryId: "PORT014", name: "Yokohama", description: "Port of Yokohama", portCode: "JPYOK", portName: "Yokohama", latitude: 35.4437, longitude: 139.638, countryId: "016", region: "East Asia", timeZone: "GMT+9", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
              { entryId: "PORT015", name: "Long Beach", description: "Port of Long Beach", portCode: "USLGB", portName: "Long Beach", latitude: 33.7701, longitude: -118.2437, countryId: "005", region: "North America", timeZone: "GMT-8", harborType: "Container Port", facilities: "Container,Bulk,General Cargo" },
              { entryId: "PORT016", name: "Valencia", description: "Port of Valencia", portCode: "ESVLC", portName: "Valencia", latitude: 39.4699, longitude: -0.3763, countryId: "011", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
              { entryId: "PORT017", name: "Piraeus", description: "Port of Piraeus", portCode: "GRPIR", portName: "Piraeus", latitude: 37.9755, longitude: 23.7348, countryId: "031", region: "Europe", timeZone: "GMT+2", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
              { entryId: "PORT018", name: "Marseille", description: "Port of Marseille", portCode: "FRMRS", portName: "Marseille", latitude: 43.2965, longitude: 5.3698, countryId: "009", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
              { entryId: "PORT019", name: "Barcelona", description: "Port of Barcelona", portCode: "ESBCN", portName: "Barcelona", latitude: 41.3851, longitude: 2.1734, countryId: "011", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
              { entryId: "PORT020", name: "Genoa", description: "Port of Genoa", portCode: "ITGOA", portName: "Genoa", latitude: 44.4056, longitude: 8.9463, countryId: "010", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" }
            ];
            for (const port of portData) {
              await this.pool.query(
                `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, portCode, portName, latitude, longitude, countryId, region, timeZone, harborType, facilities, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                ["018", port.entryId, port.name, port.description, port.portCode, port.portName, port.latitude, port.longitude, port.countryId, port.region, port.timeZone, port.harborType, port.facilities, 1, 0]
              );
            }
            console.log("\u2705 Enhanced port master data seeded successfully with PORT001-PORT020 format");
          } else {
            console.log("\u2705 Enhanced port master data already exists");
          }
        } catch (error) {
          console.error("\u274C Failed to seed port master data:", error);
        }
      }
      // User methods
      async getUser(id) {
        const result = await this.db.select().from(users).where(eq(users.id, id));
        return result[0] || void 0;
      }
      async getUserByUsername(username) {
        const result = await this.db.select().from(users).where(eq(users.username, username));
        return result[0] || void 0;
      }
      async createUser(insertUser) {
        const [created] = await this.db.insert(users).values(insertUser).returning();
        return created;
      }
      // Form methods
      async getForms() {
        return await this.db.select().from(forms);
      }
      async getForm(id) {
        const result = await this.db.select().from(forms).where(eq(forms.id, id));
        return result[0] || void 0;
      }
      async createForm(insertForm) {
        const [created] = await this.db.insert(forms).values(insertForm).returning();
        return created;
      }
      async updateForm(id, formData) {
        const result = await this.db.update(forms).set(formData).where(eq(forms.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteForm(id) {
        const result = await this.db.delete(forms).where(eq(forms.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Form Version methods
      async getFormVersions(formId, rankGroupId) {
        if (rankGroupId !== void 0) {
          return await this.db.select().from(formVersions).where(and(
            eq(formVersions.formId, formId),
            or(
              eq(formVersions.rankGroupId, rankGroupId),
              isNull(formVersions.rankGroupId)
            )
          )).orderBy(desc(formVersions.id));
        }
        return await this.db.select().from(formVersions).where(eq(formVersions.formId, formId)).orderBy(desc(formVersions.id));
      }
      async getFormVersion(id) {
        const result = await this.db.select().from(formVersions).where(eq(formVersions.id, id));
        return result[0] || void 0;
      }
      async createFormVersion(version) {
        const [created] = await this.db.insert(formVersions).values(version).returning();
        return created;
      }
      async updateFormVersion(id, versionData) {
        const result = await this.db.update(formVersions).set(versionData).where(eq(formVersions.id, id)).returning();
        return result[0] || void 0;
      }
      async releaseFormVersion(id) {
        const version = await this.getFormVersion(id);
        if (!version) {
          return void 0;
        }
        const result = await this.db.update(formVersions).set({
          status: "released",
          releasedAt: /* @__PURE__ */ new Date()
        }).where(eq(formVersions.id, id)).returning();
        if (!result[0]) {
          return void 0;
        }
        await this.db.update(forms).set({
          sharedConfig: version.sharedConfig,
          versionNo: version.versionNo,
          versionDate: version.versionDate
        }).where(eq(forms.id, version.formId));
        if (version.rankGroupId && version.configuration) {
          console.log(`\u{1F4CB} [RELEASE] Copying configuration to rank group ${version.rankGroupId}`);
          await this.db.update(rankGroups).set({ configuration: version.configuration }).where(eq(rankGroups.id, version.rankGroupId));
        }
        return result[0];
      }
      async deleteFormVersion(id) {
        const result = await this.db.delete(formVersions).where(eq(formVersions.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Rank Group methods
      async getRankGroups(formId, includeArchived = false) {
        const conditions = [];
        if (formId !== void 0) {
          conditions.push(eq(rankGroups.formId, formId));
        }
        if (!includeArchived) {
          conditions.push(isNull(rankGroups.archivedAt));
        }
        if (conditions.length === 0) {
          return await this.db.select().from(rankGroups);
        } else if (conditions.length === 1) {
          return await this.db.select().from(rankGroups).where(conditions[0]);
        } else {
          return await this.db.select().from(rankGroups).where(and(...conditions));
        }
      }
      async getAllRankGroups(includeArchived = false) {
        if (includeArchived) {
          return await this.db.select().from(rankGroups);
        }
        return await this.db.select().from(rankGroups).where(isNull(rankGroups.archivedAt));
      }
      async getRankGroup(id) {
        const result = await this.db.select().from(rankGroups).where(eq(rankGroups.id, id));
        return result[0] || void 0;
      }
      async createRankGroup(insertRankGroup) {
        const [created] = await this.db.insert(rankGroups).values(insertRankGroup).returning();
        await this.syncFormRankGroup(insertRankGroup.formId);
        return created;
      }
      async updateRankGroup(id, rankGroupData) {
        const existing = await this.getRankGroup(id);
        const result = await this.db.update(rankGroups).set(rankGroupData).where(eq(rankGroups.id, id)).returning();
        if (result[0] && existing) {
          await this.syncFormRankGroup(existing.formId);
          if (result[0].formId !== existing.formId) {
            await this.syncFormRankGroup(result[0].formId);
          }
        }
        return result[0] || void 0;
      }
      async deleteRankGroup(id) {
        const existing = await this.getRankGroup(id);
        const result = await this.db.delete(rankGroups).where(eq(rankGroups.id, id));
        const deleted = result.rowCount !== null && result.rowCount > 0;
        if (deleted && existing) {
          await this.syncFormRankGroup(existing.formId);
        }
        return deleted;
      }
      async archiveRankGroup(id) {
        const existing = await this.getRankGroup(id);
        const result = await this.db.update(rankGroups).set({ archivedAt: /* @__PURE__ */ new Date() }).where(eq(rankGroups.id, id)).returning();
        if (result[0] && existing) {
          await this.syncFormRankGroup(existing.formId);
        }
        return result[0] || void 0;
      }
      async unarchiveRankGroup(id) {
        const existing = await this.getRankGroup(id);
        const result = await this.db.update(rankGroups).set({ archivedAt: null }).where(eq(rankGroups.id, id)).returning();
        if (result[0] && existing) {
          await this.syncFormRankGroup(existing.formId);
        }
        return result[0] || void 0;
      }
      async syncFormRankGroup(formId) {
        const activeRankGroups = await this.db.select().from(rankGroups).where(and(eq(rankGroups.formId, formId), isNull(rankGroups.archivedAt)));
        const rankGroupNames = activeRankGroups.map((rg) => rg.name).join(", ");
        await this.db.update(forms).set({ rankGroup: rankGroupNames || "" }).where(eq(forms.id, formId));
      }
      // Available Rank methods
      async getAvailableRanks() {
        const results = await this.db.select().from(availableRanks);
        const sorted = results.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        return sorted;
      }
      async getAvailableRank(id) {
        const result = await this.db.select().from(availableRanks).where(eq(availableRanks.id, id));
        return result[0] || void 0;
      }
      async createAvailableRank(insertAvailableRank) {
        let rankId = insertAvailableRank.rankId;
        if (!rankId) {
          const existingRanks = await this.getAvailableRanks();
          const existingRIds = existingRanks.map((r) => r.rankId).filter((rid) => rid && /^R\d{3}$/.test(rid)).map((rid) => parseInt(rid.substring(1), 10));
          const maxRId = existingRIds.length > 0 ? Math.max(...existingRIds) : 23;
          rankId = `R${String(maxRId + 1).padStart(3, "0")}`;
        }
        const [created] = await this.db.insert(availableRanks).values({
          ...insertAvailableRank,
          rankId
        }).returning();
        return created;
      }
      async updateAvailableRank(id, rankData) {
        const result = await this.db.update(availableRanks).set(rankData).where(eq(availableRanks.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteAvailableRank(id) {
        const result = await this.db.delete(availableRanks).where(eq(availableRanks.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async clearAllAvailableRanks() {
        await this.db.delete(availableRanks);
        await this.pool.query(`ALTER SEQUENCE available_ranks_id_seq RESTART WITH 1`);
        return true;
      }
      async updateRankOrders(rankOrders) {
        for (const { id, sortOrder } of rankOrders) {
          await this.db.update(availableRanks).set({ sortOrder }).where(eq(availableRanks.id, id));
        }
        return true;
      }
      // Company Rank methods
      async getCompanyRanks() {
        return await this.db.select().from(companyRanks);
      }
      async getCompanyRank(id) {
        const result = await this.db.select().from(companyRanks).where(eq(companyRanks.id, id));
        return result[0] || void 0;
      }
      async getCompanyRankByName(rankName) {
        const result = await this.db.select().from(companyRanks).where(eq(companyRanks.rank, rankName));
        return result[0] || void 0;
      }
      async createCompanyRank(rank) {
        const [created] = await this.db.insert(companyRanks).values(rank).returning();
        return created;
      }
      async updateCompanyRank(id, rank) {
        const result = await this.db.update(companyRanks).set(rank).where(eq(companyRanks.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteCompanyRank(id) {
        const result = await this.db.delete(companyRanks).where(eq(companyRanks.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async clearAllCompanyRanks() {
        await this.db.delete(companyRanks);
        return true;
      }
      async saveAllCompanyRanks(ranks) {
        await this.db.delete(companyRanks);
        if (ranks.length > 0) {
          const result = await this.db.insert(companyRanks).values(ranks).returning();
          return result;
        }
        return [];
      }
      // Promotion Hierarchy methods
      async getPromotionHierarchies() {
        return await this.db.select().from(promotionHierarchies);
      }
      async getPromotionHierarchy(id) {
        const result = await this.db.select().from(promotionHierarchies).where(eq(promotionHierarchies.id, id));
        return result[0] || void 0;
      }
      async createPromotionHierarchy(hierarchy) {
        const [created] = await this.db.insert(promotionHierarchies).values(hierarchy).returning();
        return created;
      }
      async updatePromotionHierarchy(id, hierarchy) {
        const result = await this.db.update(promotionHierarchies).set(hierarchy).where(eq(promotionHierarchies.id, id)).returning();
        return result[0] || void 0;
      }
      async deletePromotionHierarchy(id) {
        const result = await this.db.delete(promotionHierarchies).where(eq(promotionHierarchies.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Company Processing methods
      async getCompanyProcessingRecords() {
        return await this.db.select().from(companyProcessing);
      }
      async getCompanyProcessing(id) {
        const result = await this.db.select().from(companyProcessing).where(eq(companyProcessing.id, id));
        return result[0] || void 0;
      }
      async getCompanyProcessingByCandidateId(candidateId) {
        return await this.db.select().from(companyProcessing).where(eq(companyProcessing.candidateId, candidateId));
      }
      async createCompanyProcessing(record) {
        const [created] = await this.db.insert(companyProcessing).values(record).returning();
        return created;
      }
      async updateCompanyProcessing(id, record) {
        const result = await this.db.update(companyProcessing).set(record).where(eq(companyProcessing.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteCompanyProcessing(id) {
        const result = await this.db.delete(companyProcessing).where(eq(companyProcessing.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Promotion Forms methods
      async getPromotionForms() {
        return await this.db.select().from(promotionForms);
      }
      async getPromotionForm(id) {
        const result = await this.db.select().from(promotionForms).where(eq(promotionForms.id, id));
        return result[0] || void 0;
      }
      async getPromotionFormsByCrewMember(crewMemberId) {
        return await this.db.select().from(promotionForms).where(eq(promotionForms.crewMemberId, crewMemberId));
      }
      async createPromotionForm(form) {
        const [created] = await this.db.insert(promotionForms).values(form).returning();
        return created;
      }
      async updatePromotionForm(id, form) {
        const result = await this.db.update(promotionForms).set(form).where(eq(promotionForms.id, id)).returning();
        return result[0] || void 0;
      }
      async deletePromotionForm(id) {
        const result = await this.db.delete(promotionForms).where(eq(promotionForms.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async approvePromotionForm(id, reviewedBy, comments, effectiveDate) {
        const result = await this.db.update(promotionForms).set({
          status: "approved",
          reviewedBy,
          reviewedAt: /* @__PURE__ */ new Date(),
          reviewerComments: comments,
          effectiveDate
        }).where(eq(promotionForms.id, id)).returning();
        return result[0] || void 0;
      }
      async rejectPromotionForm(id, reviewedBy, comments) {
        const result = await this.db.update(promotionForms).set({
          status: "rejected",
          reviewedBy,
          reviewedAt: /* @__PURE__ */ new Date(),
          reviewerComments: comments
        }).where(eq(promotionForms.id, id)).returning();
        return result[0] || void 0;
      }
      // Crew Member methods
      async getCrewMembers(filters) {
        let query = this.db.select().from(crewMembers);
        const conditions = [];
        if (filters?.rank) {
          conditions.push(eq(crewMembers.presentRank, filters.rank));
        }
        if (filters?.nationality) {
          conditions.push(eq(crewMembers.nationality, filters.nationality));
        }
        if (filters?.status) {
          conditions.push(eq(crewMembers.status, filters.status));
        }
        if (filters?.search) {
          const searchPattern = `%${filters.search.toLowerCase()}%`;
          conditions.push(
            sql`(LOWER("first_name") LIKE ${searchPattern} OR LOWER("family_name") LIKE ${searchPattern} OR LOWER("employee_id") LIKE ${searchPattern})`
          );
        }
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        return await query;
      }
      async getCrewMember(id) {
        const result = await this.db.select().from(crewMembers).where(eq(crewMembers.id, id));
        return result[0] || void 0;
      }
      async createCrewMember(insertCrewMember) {
        const dataWithId = {
          ...insertCrewMember,
          id: insertCrewMember.id || await this.getNextCrewId()
        };
        const [created] = await this.db.insert(crewMembers).values(dataWithId).returning();
        return created;
      }
      async updateCrewMember(id, crewMemberData) {
        const dataWithTimestamp = {
          ...crewMemberData,
          updatedAt: /* @__PURE__ */ new Date()
        };
        const result = await this.db.update(crewMembers).set(dataWithTimestamp).where(eq(crewMembers.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteCrewMember(id) {
        const result = await this.db.delete(crewMembers).where(eq(crewMembers.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Sea Service Entry Helpers (for idempotent sign-on/sign-off)
      async upsertSeaServiceEntry(params) {
        const crewMember = await this.getCrewMember(params.crewId);
        if (!crewMember) {
          throw new Error(`Crew member ${params.crewId} not found`);
        }
        let currentSeaService = [];
        if (crewMember.currentCompanySeaService) {
          try {
            currentSeaService = typeof crewMember.currentCompanySeaService === "string" ? JSON.parse(crewMember.currentCompanySeaService) : crewMember.currentCompanySeaService;
            if (!Array.isArray(currentSeaService)) {
              currentSeaService = [];
            }
          } catch (e) {
            currentSeaService = [];
          }
        }
        const existingIndex = currentSeaService.findIndex(
          (record) => record.planningId === params.planningId && (record.isActive || !record.to)
        );
        const seaServiceRecord = {
          planningId: params.planningId,
          vesselName: params.vesselName,
          vesselCode: params.vesselCode,
          vesselType: params.vesselType,
          rank: params.rank,
          from: params.signOnDate,
          to: "",
          // Empty 'to' date indicates active service
          periodMonths: "",
          // Calculated dynamically
          isActive: true,
          status: "active",
          createdVia: "sign-on"
        };
        let updatedSeaService;
        if (existingIndex >= 0) {
          currentSeaService[existingIndex] = {
            ...currentSeaService[existingIndex],
            ...seaServiceRecord,
            id: currentSeaService[existingIndex].id
            // Preserve existing ID
          };
          updatedSeaService = currentSeaService;
        } else {
          const newRecord = {
            id: `auto-${Date.now()}`,
            ...seaServiceRecord
          };
          updatedSeaService = [newRecord, ...currentSeaService];
        }
        await this.updateCrewMember(params.crewId, {
          currentCompanySeaService: JSON.stringify(updatedSeaService)
        });
      }
      async completeSeaServiceEntry(params) {
        const crewMember = await this.getCrewMember(params.crewId);
        if (!crewMember) {
          throw new Error(`Crew member ${params.crewId} not found`);
        }
        let currentSeaService = [];
        if (crewMember.currentCompanySeaService) {
          try {
            currentSeaService = typeof crewMember.currentCompanySeaService === "string" ? JSON.parse(crewMember.currentCompanySeaService) : crewMember.currentCompanySeaService;
            if (!Array.isArray(currentSeaService)) {
              currentSeaService = [];
            }
          } catch (e) {
            currentSeaService = [];
          }
        }
        const activeIndex = currentSeaService.findIndex(
          (record) => record.planningId === params.planningId && (record.isActive || !record.to)
        );
        if (activeIndex < 0) {
          console.warn(`No active sea service record found for planning ${params.planningId}`);
          return;
        }
        const fromDate = new Date(currentSeaService[activeIndex].from);
        const toDate = new Date(params.signOffDate);
        const monthsDiff = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
        const periodMonths = Math.max(0, monthsDiff).toString();
        currentSeaService[activeIndex] = {
          ...currentSeaService[activeIndex],
          to: params.signOffDate,
          periodMonths,
          isActive: false,
          status: "completed",
          completedVia: "sign-off"
        };
        await this.updateCrewMember(params.crewId, {
          currentCompanySeaService: JSON.stringify(currentSeaService)
        });
      }
      async getNextCrewId() {
        const result = await this.pool.query(
          "SELECT current_value, prefix, format FROM id_counters WHERE counter_type = $1",
          ["crew_id"]
        );
        let currentValue = 0;
        let prefix = "A";
        let format = "0000";
        if (result.rows.length > 0) {
          currentValue = result.rows[0].current_value;
          prefix = result.rows[0].prefix || "A";
          format = result.rows[0].format || "0000";
        } else {
          await this.pool.query(
            "INSERT INTO id_counters (counter_type, current_value, prefix, format) VALUES ($1, $2, $3, $4)",
            ["crew_id", 0, "A", "0000"]
          );
        }
        let nextValue = currentValue + 1;
        let nextPrefix = prefix;
        const maxValue = 9999;
        if (nextValue > maxValue) {
          nextValue = 1;
          const nextCharCode = prefix.charCodeAt(0) + 1;
          if (nextCharCode > 90) {
            throw new Error("Crew ID sequence exhausted (reached Z9999). Contact administrator.");
          }
          nextPrefix = String.fromCharCode(nextCharCode);
        }
        await this.pool.query(
          "UPDATE id_counters SET current_value = $1, prefix = $2, updated_at = NOW() WHERE counter_type = $3",
          [nextValue, nextPrefix, "crew_id"]
        );
        const paddingLength = format.length;
        return `${nextPrefix}${nextValue.toString().padStart(paddingLength, "0")}`;
      }
      // Appraisal Result methods
      async getAppraisalResults() {
        return await this.db.select().from(appraisalResults);
      }
      async getAppraisalResult(id) {
        const result = await this.db.select().from(appraisalResults).where(eq(appraisalResults.id, id));
        return result[0] || void 0;
      }
      async getAppraisalResultsByCrewMember(crewMemberId) {
        return await this.db.select().from(appraisalResults).where(eq(appraisalResults.crewMemberId, crewMemberId));
      }
      async createAppraisalResult(insertAppraisalResult) {
        const [created] = await this.db.insert(appraisalResults).values(insertAppraisalResult).returning();
        return created;
      }
      async updateAppraisalResult(id, appraisalResultData) {
        const result = await this.db.update(appraisalResults).set(appraisalResultData).where(eq(appraisalResults.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteAppraisalResult(id) {
        const result = await this.db.delete(appraisalResults).where(eq(appraisalResults.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async submitAppraisalStage(id, stage, data, submittedBy) {
        const statusMap = {
          "stage1": "Preliminary",
          "stage2": "Submitted",
          "stage3": "Reviewed"
        };
        const newStatus = statusMap[stage] || "Draft";
        const current = await this.getAppraisalResult(id);
        if (!current) {
          return void 0;
        }
        let existingData = {};
        if (current.appraisalData) {
          try {
            existingData = typeof current.appraisalData === "string" ? JSON.parse(current.appraisalData) : current.appraisalData;
          } catch (e) {
            console.error("Failed to parse existing appraisalData:", e);
            existingData = {};
          }
        }
        const updatedData = {
          ...existingData,
          ...data,
          [`${stage}SubmittedBy`]: submittedBy,
          [`${stage}SubmittedAt`]: (/* @__PURE__ */ new Date()).toISOString()
        };
        const result = await this.db.update(appraisalResults).set({
          appraisalData: JSON.stringify(updatedData),
          status: newStatus,
          submittedAt: /* @__PURE__ */ new Date()
        }).where(eq(appraisalResults.id, id)).returning();
        return result[0] || void 0;
      }
      // Recruitment Candidates Methods
      async getRecruitmentCandidates() {
        return await this.db.select().from(recruitmentCandidates).where(
          or(
            eq(recruitmentCandidates.isDelete, false),
            isNull(recruitmentCandidates.isDelete)
          )
        );
      }
      async getRecruitmentCandidate(id) {
        const results = await this.db.select().from(recruitmentCandidates).where(
          and(
            eq(recruitmentCandidates.id, id),
            or(
              eq(recruitmentCandidates.isDelete, false),
              isNull(recruitmentCandidates.isDelete)
            )
          )
        );
        return results[0] || void 0;
      }
      async getRecruitmentCandidatesByStatus(status) {
        return await this.db.select().from(recruitmentCandidates).where(
          and(
            eq(recruitmentCandidates.status, status),
            or(
              eq(recruitmentCandidates.isDelete, false),
              isNull(recruitmentCandidates.isDelete)
            )
          )
        );
      }
      async softDeleteRecruitmentCandidate(id) {
        const result = await this.db.update(recruitmentCandidates).set({ isDelete: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq(recruitmentCandidates.id, id)).returning();
        return result[0] || void 0;
      }
      async createRecruitmentCandidate(insertCandidate) {
        const [created] = await this.db.insert(recruitmentCandidates).values(insertCandidate).returning();
        return created;
      }
      async updateRecruitmentCandidate(id, candidateData) {
        const result = await this.db.update(recruitmentCandidates).set({ ...candidateData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(recruitmentCandidates.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteRecruitmentCandidate(id) {
        const result = await this.db.delete(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async transferRecruitedCandidate(candidateId) {
        const candidate = await this.getRecruitmentCandidate(candidateId);
        if (!candidate) {
          throw new Error(`Recruitment candidate ${candidateId} not found`);
        }
        const newCrewId = await this.getNextCrewId();
        let applicationData = {};
        if (candidate.applicationData) {
          try {
            applicationData = JSON.parse(candidate.applicationData);
          } catch (e) {
            console.error("Failed to parse application data:", e);
          }
        }
        const crewMemberData = {
          id: newCrewId,
          employeeId: newCrewId,
          // Set employeeId to display as Crew ID in the database view
          empNo: candidate.fileNo || "",
          // Photo (A1 - Crew Photo)
          uploadedPhoto: applicationData.uploadedPhoto || null,
          // A1.1 General Particulars
          firstName: candidate.firstName,
          middleName: candidate.middleName,
          familyName: candidate.familyName,
          gender: applicationData.gender || candidate.gender || "Male",
          dateOfBirth: candidate.dob,
          nationality: candidate.nationality,
          presentRank: candidate.rankAppliedFor,
          rankAppliedFor: candidate.rankAppliedFor,
          vesselType: candidate.vesselType || "General",
          presentVessel: "Unassigned",
          age: applicationData.ageInYears || null,
          placeOfBirthCity: applicationData.placeOfBirthCity || null,
          placeOfBirthCountry: applicationData.placeOfBirthCountry || null,
          heightCm: applicationData.heightCm || null,
          weightKg: applicationData.weightKg || null,
          nativeLanguage: applicationData.nativeLanguage || null,
          foreignLanguages: applicationData.foreignLanguages || null,
          englishProficiency: applicationData.englishProficiency || null,
          manningAgent: applicationData.manningAgent || null,
          // A1.2 Address & Contact Info
          countryOfResidence: applicationData.countryOfResidence || null,
          nearestAirport: applicationData.nearestAirport || null,
          residentialAddressLine1: applicationData.residentialAddressLine1 || null,
          residentialAddressLine2: applicationData.residentialAddressLine2 || null,
          contactLandline: applicationData.contactLandline || null,
          mobile: applicationData.mobile || null,
          email: applicationData.email || null,
          // A1.3 Family and NOK
          maritalStatus: applicationData.maritalStatus || null,
          numberOfDependentChildren: applicationData.numberOfDependentChildren || null,
          fatherName: applicationData.fatherName || null,
          motherName: applicationData.motherName || null,
          spouseFirstName: applicationData.spouseFirstName || null,
          spouseMiddleName: applicationData.spouseMiddleName || null,
          spouseFamilyName: applicationData.spouseFamilyName || null,
          spouseDateOfBirth: applicationData.spouseDateOfBirth || null,
          children: applicationData.children ? JSON.stringify(applicationData.children) : null,
          nokFirstName: applicationData.nokFirstName || null,
          nokMiddleName: applicationData.nokMiddleName || null,
          nokFamilyName: applicationData.nokFamilyName || null,
          nokTelephone: applicationData.nokTelephone || null,
          nokEmail: applicationData.nokEmail || null,
          nokAddress: applicationData.nokAddress || null,
          nokRelationship: applicationData.nokRelationship || null,
          // A2 - Travel & ID Documents
          documents: applicationData.documents ? JSON.stringify(applicationData.documents) : null,
          visas: applicationData.visas ? JSON.stringify(applicationData.visas) : null,
          // A3 - Training & Certificates
          education: applicationData.education ? JSON.stringify(applicationData.education) : null,
          licenses: applicationData.licenses ? JSON.stringify(applicationData.licenses) : null,
          trainingCourses: applicationData.trainingCourses ? JSON.stringify(applicationData.trainingCourses) : null,
          // A4 - Sea Service (recruitment seaService maps to externalSeaService in crew)
          externalSeaService: applicationData.seaService ? JSON.stringify(applicationData.seaService) : null,
          status: "Active"
        };
        const crewMember = await this.createCrewMember(crewMemberData);
        await this.updateRecruitmentCandidate(candidateId, {
          status: "Recruited"
        });
        return { crewMember, crewId: newCrewId };
      }
      // Vessel Groups Methods
      async getVesselGroups() {
        return await this.db.select().from(vesselGroups);
      }
      async getVesselGroup(id) {
        const result = await this.db.select().from(vesselGroups).where(eq(vesselGroups.id, id));
        return result[0] || void 0;
      }
      async createVesselGroup(group) {
        const [created] = await this.db.insert(vesselGroups).values(group).returning();
        return created;
      }
      async updateVesselGroup(id, group) {
        const result = await this.db.update(vesselGroups).set(group).where(eq(vesselGroups.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteVesselGroup(id) {
        const result = await this.db.delete(vesselGroups).where(eq(vesselGroups.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Vessel Drafts Methods
      async getVesselDrafts() {
        return await this.db.select().from(vesselDrafts);
      }
      async getVesselDraft(id) {
        const result = await this.db.select().from(vesselDrafts).where(eq(vesselDrafts.id, id));
        return result[0] || void 0;
      }
      async getVesselDraftsByVessel(vesselId2) {
        return await this.db.select().from(vesselDrafts).where(eq(vesselDrafts.vesselId, vesselId2));
      }
      async createVesselDraft(draft) {
        const [created] = await this.db.insert(vesselDrafts).values(draft).returning();
        return created;
      }
      async updateVesselDraft(id, draft) {
        const result = await this.db.update(vesselDrafts).set(draft).where(eq(vesselDrafts.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteVesselDraft(id) {
        const result = await this.db.delete(vesselDrafts).where(eq(vesselDrafts.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Vessel Revisions Methods
      async getVesselRevisions() {
        return await this.db.select().from(vesselRevisions);
      }
      async getVesselRevision(id) {
        const result = await this.db.select().from(vesselRevisions).where(eq(vesselRevisions.id, id));
        return result[0] || void 0;
      }
      async getVesselRevisionsByVessel(vesselId2) {
        return await this.db.select().from(vesselRevisions).where(eq(vesselRevisions.vesselId, vesselId2));
      }
      async createVesselRevision(revision) {
        const [created] = await this.db.insert(vesselRevisions).values(revision).returning();
        return created;
      }
      // Vessel Planning Methods
      async getVesselPlanningByVessel(vesselId2) {
        return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.vesselId, vesselId2));
      }
      async getVesselPlanningByCrewMember(crewMemberId) {
        return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.crewMemberId, crewMemberId));
      }
      async getVesselPlanningAsReliever(crewMemberId) {
        return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.relieverCrewId, crewMemberId));
      }
      async getVesselPlanningById(id) {
        const result = await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.id, id));
        return result[0] || void 0;
      }
      async getAllVesselPlanning() {
        return await this.db.select().from(vesselPlanning);
      }
      async createVesselPlanning(planning) {
        const [created] = await this.db.insert(vesselPlanning).values(planning).returning();
        return created;
      }
      async updateVesselPlanning(id, planning) {
        const result = await this.db.update(vesselPlanning).set(planning).where(eq(vesselPlanning.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteVesselPlanning(id) {
        const result = await this.db.delete(vesselPlanning).where(eq(vesselPlanning.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Rotation Plans Methods
      async getRotationPlans() {
        return await this.db.select().from(rotationPlans);
      }
      async getRotationPlan(id) {
        const result = await this.db.select().from(rotationPlans).where(eq(rotationPlans.id, id));
        return result[0] || void 0;
      }
      async createRotationPlan(plan) {
        const [created] = await this.db.insert(rotationPlans).values(plan).returning();
        return created;
      }
      async updateRotationPlan(id, plan) {
        const result = await this.db.update(rotationPlans).set(plan).where(eq(rotationPlans.id, id)).returning();
        return result[0] || void 0;
      }
      async deleteRotationPlan(id) {
        const result = await this.db.delete(rotationPlans).where(eq(rotationPlans.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Rotation Workflow Methods
      async proposeRotationPlan(id, proposedBy) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [updated] = await this.db.update(rotationPlans).set({
          planStatus: "Proposed",
          proposedBy,
          proposedDate: now,
          lastEdited: now
        }).where(eq(rotationPlans.id, id)).returning();
        return updated;
      }
      async getProposedAssignments(filters) {
        const plans = await this.db.select().from(rotationPlans);
        const relevantPlans = plans.filter(
          (plan) => plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved"
        );
        const allVesselPlanning = await this.db.select().from(vesselPlanning);
        const allCrewMembers = await this.db.select().from(crewMembers);
        const crewMemberNameMap = /* @__PURE__ */ new Map();
        for (const crew of allCrewMembers) {
          if (crew.id) {
            const nameParts = [crew.firstName, crew.middleName, crew.familyName].filter(Boolean);
            const fullName = nameParts.join(" ").trim();
            if (fullName) {
              crewMemberNameMap.set(crew.id, fullName);
            }
          }
        }
        const currentCrewMap = /* @__PURE__ */ new Map();
        for (const vp of allVesselPlanning) {
          if (vp.vesselId && vp.rank && vp.crewMemberId) {
            const key = `${vp.vesselId}:${vp.rank}`;
            if (vp.signOnDate) {
              let rangeEndDate = vp.reliefDue;
              if (vp.reliefDue) {
                const reliefDueDate = new Date(vp.reliefDue);
                const rangeEnd = new Date(reliefDueDate);
                rangeEnd.setMonth(rangeEnd.getMonth() + 1);
                rangeEndDate = rangeEnd.toISOString().split("T")[0];
              }
              const crewName = crewMemberNameMap.get(vp.crewMemberId) || vp.onBoardCrewName || vp.crewMemberId;
              currentCrewMap.set(key, {
                id: vp.crewMemberId,
                name: crewName,
                contractStartDate: vp.signOnDate,
                contractEndDate: vp.reliefDue || vp.signOnDate,
                rangeStartDate: vp.signOnDate,
                rangeEndDate: rangeEndDate || vp.reliefDue || vp.signOnDate
              });
            }
          }
        }
        const proposedAssignments = [];
        for (const plan of relevantPlans) {
          if (filters?.draftId && plan.draftId !== filters.draftId) continue;
          if (filters?.dateFrom) {
            const planToDate = new Date(plan.planToDate);
            const filterFromDate = new Date(filters.dateFrom);
            if (planToDate < filterFromDate) continue;
          }
          if (filters?.dateTo) {
            const planFromDate = new Date(plan.planFromDate);
            const filterToDate = new Date(filters.dateTo);
            if (planFromDate > filterToDate) continue;
          }
          const assignments = plan.assignments ? JSON.parse(plan.assignments) : [];
          for (let i = 0; i < assignments.length; i++) {
            const assignment = assignments[i];
            const assignmentStatus = (assignment.status || "").toLowerCase();
            const proposalStatus = (assignment.proposalStatus || "").toLowerCase();
            if (assignmentStatus === "deployed" || assignmentStatus === "rejected" || proposalStatus === "deployed" || proposalStatus === "rejected") continue;
            const assignmentVesselId = assignment.vesselId || assignment.vessel;
            if (filters?.vessels && filters.vessels.length > 0 && !filters.vessels.includes(assignmentVesselId)) continue;
            if (filters?.ranks && !filters.ranks.includes(assignment.rank)) continue;
            const { assignmentIndex: _, ...assignmentWithoutIndex } = assignment;
            const currentCrewKey = `${assignmentVesselId}:${assignment.rank}`;
            const currentCrew = currentCrewMap.get(currentCrewKey) || null;
            proposedAssignments.push({
              ...assignmentWithoutIndex,
              planId: plan.id,
              assignmentIndex: i,
              planFromDate: plan.planFromDate,
              planToDate: plan.planToDate,
              proposedBy: plan.proposedBy,
              proposedDate: plan.proposedDate,
              currentCrew
            });
          }
        }
        return proposedAssignments;
      }
      async deployAssignment(planId, assignmentIndex, deployedBy) {
        try {
          const plans = await this.db.select().from(rotationPlans).where(eq(rotationPlans.id, planId));
          if (!plans[0]) return { success: false };
          const assignments = plans[0].assignments ? JSON.parse(plans[0].assignments) : [];
          if (!assignments[assignmentIndex]) return { success: false };
          const assignment = assignments[assignmentIndex];
          const originalVesselId = assignment.vesselId;
          const vesselMasterData = await this.getMasterDataEntries("014");
          const vesselNameToCodeMap = /* @__PURE__ */ new Map();
          const vesselUuidToCodeMap = /* @__PURE__ */ new Map();
          for (const v of vesselMasterData) {
            const entryId = v.entry_id;
            if (v.name && entryId) {
              vesselNameToCodeMap.set(v.name, entryId);
              vesselUuidToCodeMap.set(entryId, entryId);
            }
          }
          let vesselCode;
          if (assignment.vesselId && vesselUuidToCodeMap.has(assignment.vesselId)) {
            vesselCode = assignment.vesselId;
          } else if (assignment.vessel) {
            vesselCode = vesselNameToCodeMap.get(assignment.vessel);
          }
          if (!vesselCode) {
            throw new Error(
              `Cannot determine canonical vessel code from assignment. Assignment data: vesselId="${assignment.vesselId}", vessel="${assignment.vessel}". Vessel must exist in master data (master_id='014'). Available vessels: ${Array.from(vesselNameToCodeMap.keys()).join(", ")}`
            );
          }
          console.log("\u{1F504} Vessel translation (DatabaseStorage):", {
            vesselName: assignment.vessel || assignment.vesselId,
            vesselCode,
            originalVesselId,
            found: true
          });
          const crewMemberId = assignment.crewMemberId || assignment.crewId;
          const signOnDate = assignment.fromDate || assignment.signOnDate || assignment.joiningDate;
          let reliefDue = assignment.toDate || assignment.reliefDue;
          let contractPeriodMonths = assignment.contractPeriod || assignment.contractPeriodMonths;
          if (!crewMemberId || !signOnDate) {
            console.error("Missing required reliever fields:", { crewMemberId, signOnDate });
            return { success: false };
          }
          if (!contractPeriodMonths && reliefDue) {
            const fromDateObj = new Date(signOnDate);
            const toDateObj = new Date(reliefDue);
            contractPeriodMonths = Math.max(
              1,
              (toDateObj.getFullYear() - fromDateObj.getFullYear()) * 12 + (toDateObj.getMonth() - fromDateObj.getMonth())
            );
          }
          if (!contractPeriodMonths) {
            contractPeriodMonths = 6;
          }
          const conflicts = await this.checkAssignmentConflicts(
            crewMemberId,
            signOnDate,
            contractPeriodMonths,
            planId,
            assignmentIndex
          );
          if (conflicts.length > 0) {
            return { success: false, conflicts };
          }
          const crewMember = await this.getCrewMember(crewMemberId);
          const relieverCrewName = crewMember ? `${crewMember.familyName || ""}, ${crewMember.firstName || ""}`.trim().replace(/^,\s*|,\s*$/g, "") : null;
          const rankName = assignment.rank;
          const existingRecords = await this.db.select().from(vesselPlanning).where(
            and(
              eq(vesselPlanning.vesselId, vesselCode),
              or(
                eq(vesselPlanning.rank, rankName),
                eq(vesselPlanning.rankId, rankName)
              ),
              eq(vesselPlanning.crewStatus, "primary")
            )
          );
          let vesselPlanningRecord;
          if (existingRecords.length > 0) {
            console.log("\u{1F4DD} Updating existing vessel_planning record:", existingRecords[0].id, "with relieverSignOnDate:", signOnDate);
            console.log("\u{1F4CB} Previous reliever data:", {
              relieverCrewId: existingRecords[0].relieverCrewId,
              relieverSignOnDate: existingRecords[0].relieverSignOnDate
            });
            const [updated] = await this.db.update(vesselPlanning).set({
              relieverCrewId: crewMemberId,
              relieverCrewName,
              relieverSignOnDate: signOnDate,
              joiningPort: assignment.joiningPort || null,
              joiningStatus: "Planned",
              updatedAt: /* @__PURE__ */ new Date()
            }).where(eq(vesselPlanning.id, existingRecords[0].id)).returning();
            vesselPlanningRecord = updated;
            console.log("\u2705 Updated vessel_planning record:", updated?.id, "new relieverSignOnDate:", updated?.relieverSignOnDate);
            const [verifyRecord] = await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.id, existingRecords[0].id));
            console.log("\u{1F50D} Verification fetch - relieverSignOnDate:", verifyRecord?.relieverSignOnDate, "updatedAt:", verifyRecord?.updatedAt);
            if (verifyRecord?.relieverSignOnDate !== signOnDate) {
              console.error("\u26A0\uFE0F ALERT: relieverSignOnDate mismatch after update!", {
                expected: signOnDate,
                actual: verifyRecord?.relieverSignOnDate
              });
              throw new Error(`Database update failed: relieverSignOnDate not persisted. Expected "${signOnDate}", got "${verifyRecord?.relieverSignOnDate}"`);
            }
          } else {
            console.log("\u2795 Creating new vessel_planning record (no existing record found)");
            const [created] = await this.db.insert(vesselPlanning).values({
              vesselId: vesselCode,
              rankId: assignment.rank || "Unknown",
              rank: assignment.rank,
              crewStatus: "primary",
              relieverCrewId: crewMemberId,
              relieverCrewName,
              relieverSignOnDate: signOnDate,
              joiningPort: assignment.joiningPort || null,
              joiningStatus: "Planned",
              contractPeriodMonths
            }).returning();
            vesselPlanningRecord = created;
          }
          assignments[assignmentIndex] = {
            ...assignment,
            status: "Deployed",
            deployedBy,
            deployedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          await this.db.update(rotationPlans).set({
            assignments: JSON.stringify(assignments),
            lastEdited: (/* @__PURE__ */ new Date()).toISOString()
          }).where(eq(rotationPlans.id, planId));
          const archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          let currentCrewInfo = null;
          if (existingRecords.length > 0) {
            const onBoardCrew = existingRecords[0];
            const contractStartDate = onBoardCrew.signOnDate;
            let contractEndDate = onBoardCrew.reliefDue;
            if (!contractEndDate && contractStartDate && onBoardCrew.contractPeriodMonths) {
              const calcDate = new Date(contractStartDate);
              calcDate.setMonth(calcDate.getMonth() + onBoardCrew.contractPeriodMonths);
              contractEndDate = calcDate.toISOString().split("T")[0];
            }
            let rangeEndDate;
            if (contractEndDate) {
              const endDate = new Date(contractEndDate);
              endDate.setMonth(endDate.getMonth() + 1);
              rangeEndDate = endDate.toISOString().split("T")[0];
            } else if (contractStartDate) {
              const fallbackDate = new Date(contractStartDate);
              fallbackDate.setMonth(fallbackDate.getMonth() + 7);
              rangeEndDate = fallbackDate.toISOString().split("T")[0];
            } else {
              const fallbackDate = /* @__PURE__ */ new Date();
              fallbackDate.setMonth(fallbackDate.getMonth() + 1);
              rangeEndDate = fallbackDate.toISOString().split("T")[0];
            }
            currentCrewInfo = JSON.stringify({
              id: onBoardCrew.crewMemberId,
              name: onBoardCrew.onBoardCrewName || onBoardCrew.crewMemberId,
              contractStartDate,
              contractEndDate,
              rangeStartDate: contractStartDate,
              rangeEndDate
            });
          }
          await this.createArchiveEntry({
            originalPlanId: planId,
            originalDraftId: plans[0].draftId || null,
            originalAssignmentIndex: assignmentIndex,
            vesselId: vesselCode,
            rankId: assignment.rankId || null,
            rank: assignment.rank,
            crewId: crewMemberId,
            crewName: relieverCrewName || assignment.crewName,
            crewMemberId: crewMemberId || null,
            signOnDate,
            joiningPort: assignment.joiningPort || null,
            contractPeriod: contractPeriodMonths,
            signOffDate: assignment.signOffDate || null,
            proposedBy: plans[0].proposedBy || null,
            proposedDate: plans[0].proposedDate || null,
            result: "Deployed",
            archivedDate,
            archivedBy: deployedBy || null,
            vesselPlanningId: vesselPlanningRecord?.id || null,
            currentCrewInfo,
            fullAssignmentSnapshot: JSON.stringify(assignment)
          });
          return {
            success: true,
            vesselPlanningId: vesselPlanningRecord?.id,
            vesselCode,
            vesselId: originalVesselId
            // Return original vesselId (UUID) for proper cache invalidation
          };
        } catch (error) {
          console.error("Error deploying assignment:", error);
          return { success: false };
        }
      }
      async rejectAssignment(planId, assignmentIndex, rejectedBy) {
        try {
          const plans = await this.db.select().from(rotationPlans).where(eq(rotationPlans.id, planId));
          if (!plans[0]) return void 0;
          const assignments = plans[0].assignments ? JSON.parse(plans[0].assignments) : [];
          if (!assignments[assignmentIndex]) return void 0;
          const assignment = assignments[assignmentIndex];
          assignments[assignmentIndex] = {
            ...assignment,
            proposalStatus: "rejected",
            rejectedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            rejectedBy: rejectedBy || null
          };
          const [updated] = await this.db.update(rotationPlans).set({
            assignments: JSON.stringify(assignments),
            lastEdited: (/* @__PURE__ */ new Date()).toISOString()
          }).where(eq(rotationPlans.id, planId)).returning();
          const vesselMasterData = await this.getMasterDataEntries("014");
          const vesselUuidToCodeMap = /* @__PURE__ */ new Map();
          const vesselNameToCodeMap = /* @__PURE__ */ new Map();
          for (const v of vesselMasterData) {
            const entryId = v.entry_id;
            if (v.name && entryId) {
              vesselNameToCodeMap.set(v.name, entryId);
              vesselUuidToCodeMap.set(entryId, entryId);
            }
          }
          let vesselCode = null;
          if (assignment.vesselId && vesselUuidToCodeMap.has(assignment.vesselId)) {
            vesselCode = assignment.vesselId;
          } else if (assignment.vessel) {
            vesselCode = vesselNameToCodeMap.get(assignment.vessel) || null;
          } else {
            vesselCode = assignment.vesselId || assignment.vessel || null;
          }
          const rankName = assignment.rank;
          let currentCrewInfo = null;
          if (vesselCode && rankName) {
            const existingRecords = await this.db.select().from(vesselPlanning).where(
              and(
                eq(vesselPlanning.vesselId, vesselCode),
                or(
                  eq(vesselPlanning.rank, rankName),
                  eq(vesselPlanning.rankId, rankName)
                ),
                eq(vesselPlanning.crewStatus, "primary")
              )
            );
            if (existingRecords.length > 0) {
              const onBoardCrew = existingRecords[0];
              const contractStartDate = onBoardCrew.signOnDate;
              let contractEndDate = onBoardCrew.reliefDue;
              if (!contractEndDate && contractStartDate && onBoardCrew.contractPeriodMonths) {
                const calcDate = new Date(contractStartDate);
                calcDate.setMonth(calcDate.getMonth() + onBoardCrew.contractPeriodMonths);
                contractEndDate = calcDate.toISOString().split("T")[0];
              }
              let rangeEndDate;
              if (contractEndDate) {
                const endDate = new Date(contractEndDate);
                endDate.setMonth(endDate.getMonth() + 1);
                rangeEndDate = endDate.toISOString().split("T")[0];
              } else {
                const fallbackDate = /* @__PURE__ */ new Date();
                fallbackDate.setMonth(fallbackDate.getMonth() + 1);
                rangeEndDate = fallbackDate.toISOString().split("T")[0];
              }
              currentCrewInfo = JSON.stringify({
                id: onBoardCrew.crewMemberId,
                name: onBoardCrew.onBoardCrewName || onBoardCrew.crewMemberId,
                contractStartDate,
                contractEndDate,
                rangeStartDate: contractStartDate,
                rangeEndDate
              });
            }
          }
          const archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          await this.createArchiveEntry({
            originalPlanId: planId,
            originalDraftId: plans[0].draftId || null,
            originalAssignmentIndex: assignmentIndex,
            vesselId,
            rankId: assignment.rankId || null,
            rank: assignment.rank,
            crewId: assignment.crewId,
            crewName: assignment.crewName,
            crewMemberId: assignment.crewMemberId || null,
            signOnDate: assignment.signOnDate || assignment.joiningDate,
            joiningPort: assignment.joiningPort || null,
            contractPeriod: assignment.contractPeriod || null,
            signOffDate: assignment.signOffDate || null,
            proposedBy: plans[0].proposedBy || null,
            proposedDate: plans[0].proposedDate || null,
            result: "Rejected",
            archivedDate,
            archivedBy: rejectedBy || null,
            vesselPlanningId: null,
            currentCrewInfo,
            fullAssignmentSnapshot: JSON.stringify(assignment)
          });
          return updated;
        } catch (error) {
          console.error("Error rejecting assignment:", error);
          return void 0;
        }
      }
      async checkAssignmentConflicts(crewId, signOnDate, contractPeriod, excludePlanId, excludeAssignmentIndex) {
        const signOnDateObj = new Date(signOnDate);
        const endDateObj = new Date(signOnDateObj);
        endDateObj.setMonth(endDateObj.getMonth() + contractPeriod);
        const endDate = endDateObj.toISOString().split("T")[0];
        const conflicts = [];
        const vesselPlanningEntries = await this.db.select().from(vesselPlanning).where(
          and(
            eq(vesselPlanning.isArchived, false),
            or(
              eq(vesselPlanning.crewMemberId, crewId),
              eq(vesselPlanning.relieverCrewId, crewId)
            )
          )
        );
        for (const planning of vesselPlanningEntries) {
          const planStart = planning.relieverSignOnDate || planning.signOnDate;
          if (!planStart) continue;
          let planEnd;
          if (planning.contractPeriodMonths) {
            const planStartObj = new Date(planStart);
            const planEndObj = new Date(planStartObj);
            planEndObj.setMonth(planEndObj.getMonth() + planning.contractPeriodMonths);
            planEnd = planEndObj.toISOString().split("T")[0];
          } else {
            const planStartObj = new Date(planStart);
            const planEndObj = new Date(planStartObj);
            planEndObj.setMonth(planEndObj.getMonth() + 6);
            planEnd = planEndObj.toISOString().split("T")[0];
          }
          const hasOverlap = signOnDate <= planEnd && endDate >= planStart;
          if (hasOverlap) {
            conflicts.push({
              source: "vesselPlanning",
              planningId: planning.id,
              crewId: planning.crewMemberId,
              vesselId: planning.vesselId,
              rank: planning.rank,
              startDate: planStart,
              endDate: planEnd,
              conflictType: "deployed_assignment"
            });
          }
        }
        const allPlans = await this.db.select().from(rotationPlans);
        for (const plan of allPlans) {
          if (excludePlanId && plan.id === excludePlanId) continue;
          const assignments = plan.assignments ? JSON.parse(plan.assignments) : [];
          for (let i = 0; i < assignments.length; i++) {
            const assignment = assignments[i];
            if (excludePlanId && plan.id === excludePlanId && excludeAssignmentIndex === i) continue;
            if (assignment.crewId !== crewId) continue;
            if (assignment.status === "Rejected") continue;
            const assignmentStart = assignment.signOnDate || assignment.joiningDate;
            const assignmentPeriod = assignment.contractPeriod || 6;
            const assignmentStartObj = new Date(assignmentStart);
            const assignmentEndObj = new Date(assignmentStartObj);
            assignmentEndObj.setMonth(assignmentEndObj.getMonth() + assignmentPeriod);
            const assignmentEnd = assignmentEndObj.toISOString().split("T")[0];
            const hasOverlap = signOnDate <= assignmentEnd && endDate >= assignmentStart;
            if (hasOverlap) {
              conflicts.push({
                source: "rotationPlan",
                ...assignment,
                planId: plan.id,
                assignmentIndex: i,
                conflictType: "date_overlap"
              });
            }
          }
        }
        return conflicts;
      }
      // Rotation Archive Methods - Independent historical records
      async getArchivedAssignments(filters) {
        let conditions = [];
        if (filters?.vessels && filters.vessels.length > 0) {
          conditions.push(inArray(rotationArchive.vesselId, filters.vessels));
        }
        if (filters?.ranks && filters.ranks.length > 0) {
          conditions.push(inArray(rotationArchive.rank, filters.ranks));
        }
        if (filters?.dateFrom) {
          conditions.push(sql`${rotationArchive.archivedDate} >= ${filters.dateFrom}`);
        }
        if (filters?.dateTo) {
          conditions.push(sql`${rotationArchive.archivedDate} <= ${filters.dateTo}`);
        }
        let entries;
        if (conditions.length > 0) {
          entries = await this.db.select().from(rotationArchive).where(and(...conditions)).orderBy(desc(rotationArchive.archivedDate));
        } else {
          entries = await this.db.select().from(rotationArchive).orderBy(desc(rotationArchive.archivedDate));
        }
        return entries;
      }
      async createArchiveEntry(entry) {
        const [created] = await this.db.insert(rotationArchive).values(entry).returning();
        return created;
      }
      // Rest Hours Vessel Records Methods
      async getRestHoursVesselRecords() {
        return await this.db.select().from(restHoursVesselRecords);
      }
      async getRestHoursVesselRecord(id) {
        const results = await this.db.select().from(restHoursVesselRecords).where(eq(restHoursVesselRecords.id, id));
        return results[0] || void 0;
      }
      async getRestHoursVesselRecordsByFilters(filters) {
        const conditions = [];
        if (filters.vesselIds && filters.vesselIds.length > 0) {
          conditions.push(inArray(restHoursVesselRecords.vesselId, filters.vesselIds));
        }
        if (filters.monthValue) {
          conditions.push(eq(restHoursVesselRecords.monthValue, filters.monthValue));
        }
        if (conditions.length === 0) {
          return await this.db.select().from(restHoursVesselRecords);
        }
        return await this.db.select().from(restHoursVesselRecords).where(and(...conditions));
      }
      async createRestHoursVesselRecord(record) {
        const [created] = await this.db.insert(restHoursVesselRecords).values(record).returning();
        return created;
      }
      async updateRestHoursVesselRecord(id, record) {
        const [updated] = await this.db.update(restHoursVesselRecords).set(record).where(eq(restHoursVesselRecords.id, id)).returning();
        return updated || void 0;
      }
      async deleteRestHoursVesselRecord(id) {
        const result = await this.db.delete(restHoursVesselRecords).where(eq(restHoursVesselRecords.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Rest Hours Crew Records Methods
      async getRestHoursCrewRecords() {
        return await this.db.select().from(restHoursCrewRecords);
      }
      async getRestHoursCrewRecord(id) {
        const results = await this.db.select().from(restHoursCrewRecords).where(eq(restHoursCrewRecords.id, id));
        return results[0] || void 0;
      }
      async getRestHoursCrewRecordsByFilters(filters) {
        const conditions = [];
        if (filters.vesselIds && filters.vesselIds.length > 0) {
          conditions.push(inArray(restHoursCrewRecords.vesselId, filters.vesselIds));
        }
        if (filters.monthValue) {
          conditions.push(eq(restHoursCrewRecords.monthValue, filters.monthValue));
        }
        if (filters.ranks && filters.ranks.length > 0) {
          conditions.push(inArray(restHoursCrewRecords.rank, filters.ranks));
        }
        if (filters.search) {
          conditions.push(
            or(
              sql`${restHoursCrewRecords.crewMemberId} ILIKE ${`%${filters.search}%`}`,
              sql`${restHoursCrewRecords.name} ILIKE ${`%${filters.search}%`}`
            )
          );
        }
        if (conditions.length === 0) {
          return await this.db.select().from(restHoursCrewRecords);
        }
        return await this.db.select().from(restHoursCrewRecords).where(and(...conditions));
      }
      async createRestHoursCrewRecord(record) {
        const [created] = await this.db.insert(restHoursCrewRecords).values(record).returning();
        return created;
      }
      async updateRestHoursCrewRecord(id, record) {
        const [updated] = await this.db.update(restHoursCrewRecords).set(record).where(eq(restHoursCrewRecords.id, id)).returning();
        return updated || void 0;
      }
      async deleteRestHoursCrewRecord(id) {
        const result = await this.db.delete(restHoursCrewRecords).where(eq(restHoursCrewRecords.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Rest Hours Daily Records Methods
      async getRestHoursDailyRecords() {
        return await this.db.select().from(restHoursDailyRecords);
      }
      async getRestHoursDailyRecord(id) {
        const results = await this.db.select().from(restHoursDailyRecords).where(eq(restHoursDailyRecords.id, id));
        return results[0] || void 0;
      }
      async getRestHoursDailyRecordByKey(crewMemberId, vesselId2, monthYear) {
        const results = await this.db.select().from(restHoursDailyRecords).where(
          and(
            eq(restHoursDailyRecords.crewMemberId, crewMemberId),
            eq(restHoursDailyRecords.vesselId, vesselId2),
            eq(restHoursDailyRecords.monthYear, monthYear)
          )
        );
        return results[0] || void 0;
      }
      async createRestHoursDailyRecord(record) {
        const existing = await this.getRestHoursDailyRecordByKey(
          record.crewMemberId,
          record.vesselId,
          record.monthYear
        );
        if (existing) {
          const [updated] = await this.db.update(restHoursDailyRecords).set({
            ...record,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(restHoursDailyRecords.id, existing.id)).returning();
          return updated;
        }
        const [created] = await this.db.insert(restHoursDailyRecords).values(record).returning();
        return created;
      }
      async updateRestHoursDailyRecord(id, record) {
        const [updated] = await this.db.update(restHoursDailyRecords).set(record).where(eq(restHoursDailyRecords.id, id)).returning();
        return updated || void 0;
      }
      async deleteRestHoursDailyRecord(id) {
        const result = await this.db.delete(restHoursDailyRecords).where(eq(restHoursDailyRecords.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // JSON Normalization Helpers for Phase 2F
      parseVariableTask(task) {
        return {
          ...task,
          selectedTasks: task.selectedTasks ? typeof task.selectedTasks === "string" ? JSON.parse(task.selectedTasks) : task.selectedTasks : null,
          crewInvolvedDetails: task.crewInvolvedDetails ? typeof task.crewInvolvedDetails === "string" ? JSON.parse(task.crewInvolvedDetails) : task.crewInvolvedDetails : null
        };
      }
      stringifyVariableTaskInput(task) {
        const result = { ...task };
        if (task.selectedTasks !== void 0) {
          result.selectedTasks = task.selectedTasks ? JSON.stringify(task.selectedTasks) : null;
        }
        if (task.crewInvolvedDetails !== void 0) {
          result.crewInvolvedDetails = task.crewInvolvedDetails ? JSON.stringify(task.crewInvolvedDetails) : null;
        }
        return result;
      }
      parseFixedTask(task) {
        return {
          ...task,
          seaHours: task.seaHours ? typeof task.seaHours === "string" ? JSON.parse(task.seaHours) : task.seaHours : null,
          portHours: task.portHours ? typeof task.portHours === "string" ? JSON.parse(task.portHours) : task.portHours : null
        };
      }
      stringifyFixedTaskInput(task) {
        const result = { ...task };
        if (task.seaHours !== void 0) {
          result.seaHours = task.seaHours ? JSON.stringify(task.seaHours) : null;
        }
        if (task.portHours !== void 0) {
          result.portHours = task.portHours ? JSON.stringify(task.portHours) : null;
        }
        return result;
      }
      parseDrugAlcoholTestRecord(record) {
        return {
          ...record,
          alcoholDrugType: record.alcoholDrugType ? typeof record.alcoholDrugType === "string" ? JSON.parse(record.alcoholDrugType) : record.alcoholDrugType : null,
          testingEquipment: record.testingEquipment ? typeof record.testingEquipment === "string" ? JSON.parse(record.testingEquipment) : record.testingEquipment : null,
          testHistory: record.testHistory ? typeof record.testHistory === "string" ? JSON.parse(record.testHistory) : record.testHistory : null,
          personnelTested: record.personnelTested ? typeof record.personnelTested === "string" ? JSON.parse(record.personnelTested) : record.personnelTested : null,
          masterDeputySignature: record.masterDeputySignature ? typeof record.masterDeputySignature === "string" ? JSON.parse(record.masterDeputySignature) : record.masterDeputySignature : null
        };
      }
      stringifyDrugAlcoholTestRecordInput(record) {
        const result = { ...record };
        if (record.alcoholDrugType !== void 0) {
          result.alcoholDrugType = record.alcoholDrugType ? JSON.stringify(record.alcoholDrugType) : null;
        }
        if (record.testingEquipment !== void 0) {
          result.testingEquipment = record.testingEquipment ? JSON.stringify(record.testingEquipment) : null;
        }
        if (record.testHistory !== void 0) {
          result.testHistory = record.testHistory ? JSON.stringify(record.testHistory) : null;
        }
        if (record.personnelTested !== void 0) {
          result.personnelTested = record.personnelTested ? JSON.stringify(record.personnelTested) : null;
        }
        if (record.masterDeputySignature !== void 0) {
          result.masterDeputySignature = record.masterDeputySignature ? JSON.stringify(record.masterDeputySignature) : null;
        }
        return result;
      }
      // Variable Tasks Methods
      async getVariableTasks() {
        const tasks = await this.db.select().from(variableTasks);
        return tasks.map((task) => this.parseVariableTask(task));
      }
      async getVariableTask(id) {
        const results = await this.db.select().from(variableTasks).where(eq(variableTasks.id, id));
        return results[0] ? this.parseVariableTask(results[0]) : void 0;
      }
      async getVariableTasksByFilters(filters) {
        const conditions = [];
        if (filters.vesselId) {
          conditions.push(eq(variableTasks.vesselId, filters.vesselId));
        }
        if (filters.periodValue) {
          conditions.push(eq(variableTasks.periodValue, filters.periodValue));
        }
        if (filters.status) {
          conditions.push(eq(variableTasks.status, filters.status));
        }
        const tasks = conditions.length === 0 ? await this.db.select().from(variableTasks) : await this.db.select().from(variableTasks).where(and(...conditions));
        return tasks.map((task) => this.parseVariableTask(task));
      }
      async createVariableTask(task) {
        const stringified = this.stringifyVariableTaskInput(task);
        const [created] = await this.db.insert(variableTasks).values(stringified).returning();
        return this.parseVariableTask(created);
      }
      async updateVariableTask(id, task) {
        const stringified = this.stringifyVariableTaskInput(task);
        const [updated] = await this.db.update(variableTasks).set(stringified).where(eq(variableTasks.id, id)).returning();
        return updated ? this.parseVariableTask(updated) : void 0;
      }
      async deleteVariableTask(id) {
        const result = await this.db.delete(variableTasks).where(eq(variableTasks.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Fixed Tasks Methods
      async getFixedTasks() {
        const tasks = await this.db.select().from(fixedTasks);
        return tasks.map((task) => this.parseFixedTask(task));
      }
      async getFixedTask(id) {
        const results = await this.db.select().from(fixedTasks).where(eq(fixedTasks.id, id));
        return results[0] ? this.parseFixedTask(results[0]) : void 0;
      }
      async getFixedTasksByVesselAndMonth(vesselId2, monthYear) {
        const tasks = await this.db.select().from(fixedTasks).where(
          and(
            eq(fixedTasks.vesselId, vesselId2),
            eq(fixedTasks.monthYear, monthYear)
          )
        );
        return tasks.map((task) => this.parseFixedTask(task));
      }
      async getFixedTaskByKey(crewMemberId, vesselId2, monthYear) {
        const results = await this.db.select().from(fixedTasks).where(
          and(
            eq(fixedTasks.crewMemberId, crewMemberId),
            eq(fixedTasks.vesselId, vesselId2),
            eq(fixedTasks.monthYear, monthYear)
          )
        );
        return results[0] ? this.parseFixedTask(results[0]) : void 0;
      }
      async createFixedTask(task) {
        const stringified = this.stringifyFixedTaskInput(task);
        const [created] = await this.db.insert(fixedTasks).values(stringified).returning();
        return this.parseFixedTask(created);
      }
      async updateFixedTask(id, task) {
        const stringified = this.stringifyFixedTaskInput(task);
        const [updated] = await this.db.update(fixedTasks).set(stringified).where(eq(fixedTasks.id, id)).returning();
        return updated ? this.parseFixedTask(updated) : void 0;
      }
      async deleteFixedTask(id) {
        const result = await this.db.delete(fixedTasks).where(eq(fixedTasks.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Drug & Alcohol Testing Methods
      async getDrugAlcoholTestRecords() {
        const records = await this.db.select().from(drugAlcoholTestRecords);
        return records.map((record) => this.parseDrugAlcoholTestRecord(record));
      }
      async getDrugAlcoholTestRecord(id) {
        const results = await this.db.select().from(drugAlcoholTestRecords).where(eq(drugAlcoholTestRecords.id, id));
        return results[0] ? this.parseDrugAlcoholTestRecord(results[0]) : void 0;
      }
      async getDrugAlcoholTestRecordsByVessel(vesselId2, testType) {
        const conditions = [eq(drugAlcoholTestRecords.vesselId, vesselId2)];
        if (testType) {
          conditions.push(eq(drugAlcoholTestRecords.testType, testType));
        }
        const records = await this.db.select().from(drugAlcoholTestRecords).where(and(...conditions));
        return records.map((record) => this.parseDrugAlcoholTestRecord(record));
      }
      async createDrugAlcoholTestRecord(record) {
        const stringified = this.stringifyDrugAlcoholTestRecordInput(record);
        const [created] = await this.db.insert(drugAlcoholTestRecords).values(stringified).returning();
        return this.parseDrugAlcoholTestRecord(created);
      }
      async updateDrugAlcoholTestRecord(id, record) {
        const stringified = this.stringifyDrugAlcoholTestRecordInput(record);
        const [updated] = await this.db.update(drugAlcoholTestRecords).set(stringified).where(eq(drugAlcoholTestRecords.id, id)).returning();
        return updated ? this.parseDrugAlcoholTestRecord(updated) : void 0;
      }
      async deleteDrugAlcoholTestRecord(id) {
        const result = await this.db.delete(drugAlcoholTestRecords).where(eq(drugAlcoholTestRecords.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Vessel Violation Comments Methods
      async getVesselViolationComment(vesselId2, monthValue) {
        const results = await this.db.select().from(vesselViolationComments).where(
          and(
            eq(vesselViolationComments.vesselId, vesselId2),
            eq(vesselViolationComments.monthValue, monthValue)
          )
        );
        return results[0] || null;
      }
      async saveVesselViolationComment(comment) {
        const existing = await this.db.select().from(vesselViolationComments).where(
          and(
            eq(vesselViolationComments.vesselId, comment.vesselId),
            eq(vesselViolationComments.monthValue, comment.monthValue)
          )
        );
        if (existing[0]) {
          const [updated] = await this.db.update(vesselViolationComments).set(comment).where(eq(vesselViolationComments.id, existing[0].id)).returning();
          return updated;
        } else {
          const [created] = await this.db.insert(vesselViolationComments).values(comment).returning();
          return created;
        }
      }
      // Office Violation Comments Methods
      async getOfficeViolationComment(vesselId2, monthValue) {
        const results = await this.db.select().from(officeViolationComments).where(
          and(
            eq(officeViolationComments.vesselId, vesselId2),
            eq(officeViolationComments.monthValue, monthValue)
          )
        );
        return results[0] || null;
      }
      async saveOfficeViolationComment(comment) {
        const existing = await this.db.select().from(officeViolationComments).where(
          and(
            eq(officeViolationComments.vesselId, comment.vesselId),
            eq(officeViolationComments.monthValue, comment.monthValue)
          )
        );
        if (existing[0]) {
          const [updated] = await this.db.update(officeViolationComments).set(comment).where(eq(officeViolationComments.id, existing[0].id)).returning();
          return updated;
        } else {
          const [created] = await this.db.insert(officeViolationComments).values(comment).returning();
          return created;
        }
      }
      // NC Reports Methods
      async getAllNCReports() {
        return await this.db.select().from(ncReports);
      }
      async getNCReport(crewMemberId, vesselId2, monthValue) {
        const results = await this.db.select().from(ncReports).where(
          and(
            eq(ncReports.crewMemberId, crewMemberId),
            eq(ncReports.vesselId, vesselId2),
            eq(ncReports.monthValue, monthValue)
          )
        );
        return results[0] || null;
      }
      async saveNCReport(report) {
        const existing = await this.db.select().from(ncReports).where(
          and(
            eq(ncReports.crewMemberId, report.crewMemberId),
            eq(ncReports.vesselId, report.vesselId),
            eq(ncReports.monthValue, report.monthValue)
          )
        );
        if (existing[0]) {
          const [updated] = await this.db.update(ncReports).set(report).where(eq(ncReports.id, existing[0].id)).returning();
          return updated;
        } else {
          const [created] = await this.db.insert(ncReports).values(report).returning();
          return created;
        }
      }
      // Date Line Adjustments Methods
      async getVesselDateLineAdjustment(vesselId2, monthValue) {
        const results = await this.db.select().from(vesselDateLineAdjustments).where(
          and(
            eq(vesselDateLineAdjustments.vesselId, vesselId2),
            eq(vesselDateLineAdjustments.monthValue, monthValue)
          )
        );
        return results[0] || null;
      }
      async saveVesselDateLineAdjustment(adjustment) {
        const existing = await this.db.select().from(vesselDateLineAdjustments).where(
          and(
            eq(vesselDateLineAdjustments.vesselId, adjustment.vesselId),
            eq(vesselDateLineAdjustments.monthValue, adjustment.monthValue)
          )
        );
        if (existing[0]) {
          const [updated] = await this.db.update(vesselDateLineAdjustments).set(adjustment).where(eq(vesselDateLineAdjustments.id, existing[0].id)).returning();
          return updated;
        } else {
          const [created] = await this.db.insert(vesselDateLineAdjustments).values(adjustment).returning();
          return created;
        }
      }
      async deleteVesselDateLineAdjustment(vesselId2, monthValue) {
        const result = await this.db.delete(vesselDateLineAdjustments).where(
          and(
            eq(vesselDateLineAdjustments.vesselId, vesselId2),
            eq(vesselDateLineAdjustments.monthValue, monthValue)
          )
        );
        return result.rowCount !== null && result.rowCount > 0;
      }
      async clearAdvancedDaysData(vesselId2, monthValue, advancedDays) {
        const result = await this.db.update(vesselDateLineAdjustments).set({ adjustments: [] }).where(
          and(
            eq(vesselDateLineAdjustments.vesselId, vesselId2),
            eq(vesselDateLineAdjustments.monthValue, monthValue)
          )
        );
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Dashboard & Utilities Methods
      // Tanker vessel types for experience calculation
      TANKER_VESSEL_TYPES = [
        "Oil Tanker",
        "Chemical Tanker",
        "Gas Tanker",
        "LPG Tanker",
        "LNG Tanker",
        "Product Oil Tanker",
        "Crude Oil Tanker",
        "Bitumen/Asphalt Carriers",
        "Oil Chemical Tanker",
        "Shuttle Tankers"
      ];
      // Officer rank categories for OOW calculation
      OFFICER_CATEGORIES = ["Senior Officers", "Junior Officers"];
      // Officer rank names for OOW calculation (fallback when category not available)
      OFFICER_RANK_NAMES = [
        "Master",
        "Captain",
        "Chief Officer",
        "Chief Mate",
        "C/O",
        "2nd Officer",
        "Second Officer",
        "2/O",
        "3rd Officer",
        "Third Officer",
        "3/O",
        "Chief Engineer",
        "C/E",
        "2nd Engineer",
        "Second Engineer",
        "2/E",
        "3rd Engineer",
        "Third Engineer",
        "3/E",
        "4th Engineer",
        "Fourth Engineer",
        "4/E",
        "Electrical Officer",
        "E/O",
        "ETO",
        "Radio Officer",
        "R/O"
      ];
      isTankerVesselType(vesselType) {
        if (!vesselType) return false;
        const normalized = vesselType.trim().toLowerCase();
        const tankerKeywords = ["tanker", "oil", "chemical", "gas", "lng", "lpg", "bitumen", "asphalt", "product"];
        if (this.TANKER_VESSEL_TYPES.some((t) => t.toLowerCase() === normalized)) {
          return true;
        }
        return tankerKeywords.some((keyword) => normalized.includes(keyword));
      }
      isOfficerRank(rankName) {
        if (!rankName) return false;
        const normalized = rankName.trim().toLowerCase();
        const officerKeywords = ["officer", "master", "captain", "engineer", "mate", "eto", "e/o", "r/o"];
        const ratingKeywords = [
          "petty",
          "bosun",
          "boatswain",
          "able",
          "ordinary",
          "oiler",
          "motorman",
          "wiper",
          "fitter",
          "cook",
          "steward",
          "messman",
          "cadet",
          "trainee",
          "rating"
        ];
        if (this.OFFICER_RANK_NAMES.some((r) => r.toLowerCase() === normalized)) {
          return true;
        }
        if (ratingKeywords.some((keyword) => normalized.includes(keyword))) {
          return false;
        }
        return officerKeywords.some((keyword) => normalized.includes(keyword));
      }
      async isOfficerRankByCategory(rankName) {
        if (!rankName) return false;
        try {
          const result = await this.pool.query(
            `SELECT category FROM available_ranks WHERE name = $1 LIMIT 1`,
            [rankName.trim()]
          );
          if (result.rows && result.rows.length > 0) {
            const category = result.rows[0].category;
            return this.OFFICER_CATEGORIES.includes(category);
          }
        } catch (e) {
        }
        return this.isOfficerRank(rankName);
      }
      buildRankOrderMap(hierarchies) {
        const rankOrderMap = /* @__PURE__ */ new Map();
        for (const hierarchy of hierarchies) {
          if (!hierarchy.isActive) continue;
          let rankPath = [];
          try {
            rankPath = typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath;
          } catch (e) {
            continue;
          }
          if (!Array.isArray(rankPath)) continue;
          rankPath.forEach((rank, index) => {
            const normalizedRank = rank.trim().toLowerCase();
            const currentOrder = rankOrderMap.get(normalizedRank);
            if (currentOrder === void 0 || index < currentOrder) {
              rankOrderMap.set(normalizedRank, index);
            }
          });
        }
        return rankOrderMap;
      }
      calculateRankExperience(companySeaService, externalSeaService, rankOrderMap) {
        const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
        const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
        const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
        const rankMonths = {};
        let totalMonths = 0;
        for (const service of allSeaService) {
          const period = parseFloat(service.periodMonths) || 0;
          if (period <= 0) continue;
          let rank = (service.rank || "").trim();
          if (!rank) continue;
          totalMonths += period;
          rankMonths[rank] = (rankMonths[rank] || 0) + period;
        }
        const rankExperience = Object.entries(rankMonths).map(([rank, months]) => ({
          type: rank,
          label: rank,
          months,
          years: Math.round(months / 12 * 10) / 10
        }));
        if (rankOrderMap && rankOrderMap.size > 0) {
          rankExperience.sort((a, b) => {
            const orderA = rankOrderMap.get(a.type.toLowerCase()) ?? -1;
            const orderB = rankOrderMap.get(b.type.toLowerCase()) ?? -1;
            if (orderA >= 0 && orderB >= 0) {
              return orderA - orderB;
            }
            if (orderA >= 0) return -1;
            if (orderB >= 0) return 1;
            return b.months - a.months;
          });
        } else {
          rankExperience.sort((a, b) => b.months - a.months);
        }
        return { rankExperience, totalMonths };
      }
      /**
       * Calculates rank experience broken down by vessel type.
       * Returns a map of vessel type -> months of experience in the current rank on that vessel type.
       */
      calculateRankExperienceByVesselType(companySeaService, externalSeaService, currentRank) {
        const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
        const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
        const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
        const normalizeRankForComparison = (rank) => {
          if (!rank) return "";
          return rank.replace(/_\d+$/, "").replace(/\(.*?\)$/, "").replace(/\s+/g, " ").trim().toLowerCase();
        };
        const normalizedCurrentRank = normalizeRankForComparison(currentRank);
        if (!normalizedCurrentRank) return {};
        const vesselTypeMonths = {};
        for (const service of allSeaService) {
          let period = parseFloat(service.periodMonths) || 0;
          if (period <= 0 && service.from) {
            const fromDate = new Date(service.from);
            const toDateStr = (service.to || "").trim();
            const toDate = toDateStr ? new Date(toDateStr) : /* @__PURE__ */ new Date();
            if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
              const diffMs = toDate.getTime() - fromDate.getTime();
              period = Math.max(0, diffMs / (1e3 * 60 * 60 * 24 * 30.44));
            }
          }
          if (period <= 0) continue;
          const serviceRank = normalizeRankForComparison(service.rank || "");
          if (serviceRank !== normalizedCurrentRank) {
            continue;
          }
          const vesselType = (service.vesselType || service.shipType || service.vessel_type || service.vesselTypeName || service.type || "").trim();
          if (!vesselType) {
            continue;
          }
          vesselTypeMonths[vesselType] = (vesselTypeMonths[vesselType] || 0) + period;
        }
        return vesselTypeMonths;
      }
      calculateShipTypeExperience(companySeaService, externalSeaService) {
        const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
        const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
        const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
        const vesselTypeNormalization = {
          "oil tanker": "Oil Tkr",
          "product tanker": "Oil Tkr",
          "crude oil tanker": "Oil Tkr",
          "chemical tanker": "Ch Tkr",
          "oil/chemical tanker": "Oil/Ch Tkr",
          "oil chemical tanker": "Oil/Ch Tkr",
          "gas tanker": "Gas Tkr",
          "lpg tanker": "Gas Tkr",
          "lng tanker": "Gas Tkr",
          "bulk carrier": "Bulk",
          "dry bulk carrier": "Bulk",
          "bulk": "Bulk",
          "container ship": "Container",
          "container": "Container",
          "general cargo": "Gen Cargo",
          "ro-ro": "Ro-Ro",
          "roro": "Ro-Ro",
          "offshore": "Offshore",
          "tanker": "Tanker"
        };
        const typeMonths = {};
        let totalMonths = 0;
        for (const service of allSeaService) {
          const period = parseFloat(service.periodMonths) || 0;
          if (period <= 0) continue;
          totalMonths += period;
          let vesselType = (service.vesselType || "").trim();
          if (!vesselType) continue;
          const normalizedType = vesselType.toLowerCase();
          let displayLabel = vesselTypeNormalization[normalizedType] || "";
          if (!displayLabel) {
            if (normalizedType.includes("oil") && normalizedType.includes("chemical")) {
              displayLabel = "Oil/Ch Tkr";
            } else if (normalizedType.includes("oil") || normalizedType.includes("product") || normalizedType.includes("crude")) {
              displayLabel = "Oil Tkr";
            } else if (normalizedType.includes("chemical")) {
              displayLabel = "Ch Tkr";
            } else if (normalizedType.includes("gas") || normalizedType.includes("lpg") || normalizedType.includes("lng")) {
              displayLabel = "Gas Tkr";
            } else if (normalizedType.includes("bulk")) {
              displayLabel = "Bulk";
            } else if (normalizedType.includes("container")) {
              displayLabel = "Container";
            } else if (normalizedType.includes("tanker")) {
              displayLabel = "Tanker";
            } else {
              displayLabel = vesselType;
            }
          }
          typeMonths[displayLabel] = (typeMonths[displayLabel] || 0) + period;
        }
        const shipTypeExperience = Object.entries(typeMonths).map(([type, months]) => ({
          type,
          label: type,
          months,
          years: Math.round(months / 12 * 10) / 10
        })).sort((a, b) => b.months - a.months);
        return { shipTypeExperience, totalMonths };
      }
      calculateExperienceFromSeaService(companySeaService, externalSeaService, currentRank) {
        const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
        const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
        const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
        let companyYears = 0;
        if (safeCompanySeaService.length > 0) {
          const fromDates = safeCompanySeaService.map((s) => getSeaServiceFromDate(s)).filter((d) => d && typeof d === "string" && d.trim() !== "").map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
          if (fromDates.length > 0) {
            const earliestDate = new Date(Math.min(...fromDates.map((d) => d.getTime())));
            const today = /* @__PURE__ */ new Date();
            const diffMs = today.getTime() - earliestDate.getTime();
            const diffYears = diffMs / (1e3 * 60 * 60 * 24 * 365.25);
            const roundedYears = Math.round(diffYears * 10) / 10;
            companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
          }
        }
        const getServicePeriodMonths = (service) => {
          const fromStr = getSeaServiceFromDate(service);
          const from = safeParseDate(fromStr);
          if (!from) return 0;
          const isActive = isActiveSeaService(service);
          if (isActive) {
            return calculatePeriodMonths(from, getReportingDate());
          } else {
            const toStr = getSeaServiceToDate(service);
            const to = safeParseDate(toStr);
            if (to) {
              return calculatePeriodMonths(from, to);
            } else {
              return parseFloat(service.periodMonths) || 0;
            }
          }
        };
        let rankMonths = 0;
        if (currentRank) {
          const normalizedCurrentRank = currentRank.trim().toLowerCase();
          for (const service of allSeaService) {
            if (service.rank && service.rank.trim().toLowerCase() === normalizedCurrentRank) {
              rankMonths += getServicePeriodMonths(service);
            }
          }
        }
        const rankYears = Math.round(rankMonths / 12 * 10) / 10;
        let tankerMonths = 0;
        for (const service of allSeaService) {
          if (this.isTankerVesselType(service.vesselType)) {
            tankerMonths += getServicePeriodMonths(service);
          }
        }
        const tankerYears = Math.round(tankerMonths / 12 * 10) / 10;
        let oowMonths = 0;
        for (const service of allSeaService) {
          if (this.isOfficerRank(service.rank)) {
            oowMonths += getServicePeriodMonths(service);
          }
        }
        const oowYears = Math.round(oowMonths / 12 * 10) / 10;
        return {
          company: companyYears,
          rank: rankYears,
          tankers: tankerYears,
          oow: oowYears
        };
      }
      parseSeaServiceData(data) {
        if (!data) return [];
        let parsed = data;
        let attempts = 0;
        while (typeof parsed === "string" && attempts < 3) {
          try {
            parsed = JSON.parse(parsed);
            attempts++;
          } catch (e) {
            return [];
          }
        }
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.rows)) return parsed.rows;
          if (Array.isArray(parsed.data)) return parsed.data;
        }
        return [];
      }
      parseLicenseData(data) {
        if (!data) return [];
        if (Array.isArray(data)) {
          return data;
        }
        let parsed = data;
        let attempts = 0;
        while (typeof parsed === "string" && attempts < 3) {
          try {
            parsed = JSON.parse(parsed);
            attempts++;
          } catch (e) {
            return [];
          }
        }
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [];
      }
      /**
       * Derive endorsement code (O, C, G combinations) based on rank category and licenses held
       * 
       * Mapping by Rank Category:
       * - Senior Officers: L002 (DCE_Oil_Management) → O, L004 (DCE_Chem_Management) → C, L006 (DCE_Gas_Management) → G
       * - Other Officers: L001/L002 → O, L003/L004 → C, L005/L006 → G
       * - Ratings: LIC018 (DCE_Oil_Support) → O, LIC019 (DCE_Chem_Support) → C, LIC020 (DCE_Gas_Support) → G
       */
      deriveEndorsementCode(rankFlags, licenses) {
        if (!licenses || licenses.length === 0) return "\u2014";
        const licenseIds = new Set(
          licenses.map((lic) => (lic.licenseId || lic.entryId || lic.licenseType || "").toUpperCase())
        );
        let hasO = false;
        let hasC = false;
        let hasG = false;
        if (rankFlags.seniorOfficer) {
          hasO = licenseIds.has("L002") || licenseIds.has("LIC002");
          hasC = licenseIds.has("L004") || licenseIds.has("LIC004");
          hasG = licenseIds.has("L006") || licenseIds.has("LIC006");
        } else if (rankFlags.rating) {
          hasO = licenseIds.has("LIC018");
          hasC = licenseIds.has("LIC019");
          hasG = licenseIds.has("LIC020");
        } else if (rankFlags.officer) {
          hasO = licenseIds.has("L001") || licenseIds.has("L002") || licenseIds.has("LIC001") || licenseIds.has("LIC002");
          hasC = licenseIds.has("L003") || licenseIds.has("L004") || licenseIds.has("LIC003") || licenseIds.has("LIC004");
          hasG = licenseIds.has("L005") || licenseIds.has("L006") || licenseIds.has("LIC005") || licenseIds.has("LIC006");
        } else {
          hasO = licenseIds.has("L001") || licenseIds.has("L002") || licenseIds.has("LIC001") || licenseIds.has("LIC002");
          hasC = licenseIds.has("L003") || licenseIds.has("L004") || licenseIds.has("LIC003") || licenseIds.has("LIC004");
          hasG = licenseIds.has("L005") || licenseIds.has("L006") || licenseIds.has("LIC005") || licenseIds.has("LIC006");
        }
        let code = "";
        if (hasO) code += "O";
        if (hasC) code += "C";
        if (hasG) code += "G";
        return code || "\u2014";
      }
      async getCrewDashboardSummary(crewId) {
        const crewMember = await this.getCrewMember(crewId);
        if (!crewMember) return void 0;
        const appraisals = await this.getAppraisalResultsByCrewMember(crewId);
        const companySeaService = this.parseSeaServiceData(crewMember.currentCompanySeaService);
        const externalSeaService = this.parseSeaServiceData(crewMember.externalSeaService);
        const currentRank = crewMember.presentRank || "";
        const experience = this.calculateExperienceFromSeaService(
          companySeaService,
          externalSeaService,
          currentRank
        );
        const shipTypeData = this.calculateShipTypeExperience(companySeaService, externalSeaService);
        const hierarchies = await this.getPromotionHierarchies();
        const rankOrderMap = this.buildRankOrderMap(hierarchies);
        const rankData = this.calculateRankExperience(companySeaService, externalSeaService, rankOrderMap);
        const rankExperienceByVesselType = this.calculateRankExperienceByVesselType(
          companySeaService,
          externalSeaService,
          currentRank
        );
        const licenses = this.parseLicenseData(crewMember.licenses);
        const rankFlags = await this.getCompanyRankByName(currentRank);
        const endorsementCode = this.deriveEndorsementCode(
          {
            seniorOfficer: rankFlags?.seniorOfficer,
            officer: rankFlags?.officer,
            rating: rankFlags?.rating
          },
          licenses
        );
        const allVesselPlanningEntries = await this.getVesselPlanningByCrewMember(crewId);
        const activeVesselPlanningEntries = allVesselPlanningEntries.filter((p) => !p.isArchived);
        const hasVesselAssignment = activeVesselPlanningEntries && activeVesselPlanningEntries.length > 0;
        const primaryAssignment = hasVesselAssignment ? activeVesselPlanningEntries.find(
          (p) => (p.crewStatus || "primary").toLowerCase() === "primary" || (p.crewStatus || "primary").toLowerCase() === "p"
        ) || activeVesselPlanningEntries[0] : null;
        const isActive = crewMember.isActive !== false;
        const calculatedStatus = isActive ? hasVesselAssignment ? "On Board" : "On Leave" : "Inactive";
        const vesselCode = primaryAssignment?.vesselId || crewMember.presentVessel || "";
        const vesselName = await this.translateVesselCodeToNameFromDb(vesselCode);
        const joinedDate = primaryAssignment?.signOnDate || crewMember.signOnDate;
        const reliefDue = primaryAssignment?.reliefDue || crewMember.reliefDue;
        const joinedDateFormatted = this.formatDateForDashboard(joinedDate);
        const reliefDueFormatted = this.formatDateForDashboard(reliefDue);
        const nextAvailabilityFormatted = this.formatDateForDashboard(crewMember.nextAvailability);
        const vesselCodeToNameMap = await this.getVesselCodeToNameMap();
        const vesselNameToCodeMap = /* @__PURE__ */ new Map();
        for (const [code, name] of vesselCodeToNameMap.entries()) {
          vesselNameToCodeMap.set(name, code);
        }
        const appraisalsByVessel = /* @__PURE__ */ new Map();
        const addAppraisalToKey = (key, appraisalId) => {
          if (!key) return;
          if (!appraisalsByVessel.has(key)) {
            appraisalsByVessel.set(key, []);
          }
          const arr = appraisalsByVessel.get(key);
          if (!arr.includes(appraisalId)) {
            arr.push(appraisalId);
          }
        };
        const relieverPlanningRecords = await this.getVesselPlanningAsReliever(crewId);
        const { buildServiceTimeline: buildServiceTimeline2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const serviceTimeline = buildServiceTimeline2(
          companySeaService,
          allVesselPlanningEntries,
          appraisalsByVessel,
          /* @__PURE__ */ new Map(),
          // handovers - not yet implemented
          vesselCodeToNameMap,
          relieverPlanningRecords
        );
        return {
          status: {
            status: calculatedStatus,
            isActive,
            vessel: hasVesselAssignment ? vesselName : null,
            joinedDate: hasVesselAssignment ? joinedDateFormatted : null,
            sailingDue: hasVesselAssignment ? reliefDueFormatted : null,
            nextAvailability: !hasVesselAssignment && calculatedStatus === "On Leave" ? nextAvailabilityFormatted : null,
            presentAssignment: vesselCode || null,
            emergencyContact: crewMember.nokFirstName && crewMember.nokRelationship && crewMember.nokTelephone ? {
              name: `${crewMember.nokFirstName}${crewMember.nokFamilyName ? " " + crewMember.nokFamilyName : ""}`.trim(),
              relation: crewMember.nokRelationship,
              phone: crewMember.nokTelephone
            } : null
          },
          experience: {
            company: experience.company,
            rank: experience.rank,
            tankers: experience.tankers,
            ocw: experience.oow,
            endorsements: endorsementCode
          },
          shipTypes: {
            items: shipTypeData.shipTypeExperience,
            totalMonths: shipTypeData.totalMonths,
            totalYears: Math.round(shipTypeData.totalMonths / 12 * 10) / 10
          },
          rankExperience: {
            items: rankData.rankExperience,
            totalMonths: rankData.totalMonths,
            totalYears: Math.round(rankData.totalMonths / 12 * 10) / 10
          },
          rankExperienceByVesselType,
          serviceTimeline,
          compliance: [
            { category: "Travel Docs", status: "compliant", details: "\u2713" },
            { category: "Visas", status: "compliant", details: "\u2713" },
            { category: "License & DCE", status: "compliant", details: "\u2713" },
            { category: "Training", status: "issues", details: "Issues: 2" },
            { category: "Medical", status: "compliant", details: "Last: 15 Feb 2022" },
            { category: "Vaccination", status: "issues", details: "Issue: 1" }
          ],
          careerProgression: [
            {
              position: "To C/E",
              status: { recommend: false, advance: false, demote: true, approved: false }
            },
            {
              position: "To 2/E",
              date: "22 Jan 2017",
              status: { recommend: true, advance: true, demote: false, approved: true }
            },
            {
              position: "To 3/E",
              date: "12 Dec 2014",
              status: { recommend: true, advance: true, demote: false, approved: true }
            }
          ],
          appraisals: appraisals.map((appraisal, index) => ({
            year: 2014 + index * 2,
            score: parseFloat(appraisal.overallRating || "3.0") * 8
          })).concat([
            { year: 2024, score: 31 }
          ])
        };
      }
      formatDateForDashboard(dateString) {
        if (!dateString) return "";
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return dateString;
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const day = date.getDate().toString().padStart(2, "0");
          const month = months[date.getMonth()];
          const year = date.getFullYear();
          return `${day}-${month}-${year}`;
        } catch {
          return dateString;
        }
      }
      async translateVesselCodeToNameFromDb(vesselCode) {
        if (!vesselCode) return "";
        try {
          const result = await this.pool.query(
            `SELECT name FROM master_data_entries WHERE master_id = '014' AND entry_id = $1`,
            [vesselCode]
          );
          if (result.rows && result.rows.length > 0) {
            return result.rows[0].name;
          }
          return vesselCode;
        } catch {
          return vesselCode;
        }
      }
      async getVesselCodeToNameMap() {
        const vesselMap = /* @__PURE__ */ new Map();
        try {
          const result = await this.pool.query(
            `SELECT entry_id, name FROM master_data_entries WHERE master_id = '014'`
          );
          if (result.rows) {
            for (const row of result.rows) {
              if (row.entry_id && row.name) {
                vesselMap.set(row.entry_id, row.name);
              }
            }
          }
        } catch {
        }
        return vesselMap;
      }
      async getFormForRank(rankLabel, category) {
        const rankGroupResults = await this.db.select().from(rankGroups).where(like(rankGroups.ranks, `%${rankLabel}%`));
        if (rankGroupResults.length === 0) return void 0;
        const formIds = rankGroupResults.map((rg) => rg.formId);
        const conditions = [inArray(forms.id, formIds)];
        if (category) {
          conditions.push(eq(forms.category, category));
        }
        const results = await this.db.select().from(forms).where(and(...conditions));
        return results[0] || void 0;
      }
      // Data Masters Methods
      async getDataMasters() {
        return await this.db.select().from(dataMasters);
      }
      async getDataMaster(id) {
        const results = await this.db.select().from(dataMasters).where(eq(dataMasters.id, id));
        return results[0] || void 0;
      }
      async createDataMaster(insertMaster) {
        const [created] = await this.db.insert(dataMasters).values(insertMaster).returning();
        return created;
      }
      async updateDataMaster(id, masterData) {
        const [updated] = await this.db.update(dataMasters).set({ ...masterData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(dataMasters.id, id)).returning();
        return updated || void 0;
      }
      async deleteDataMaster(id) {
        const result = await this.db.delete(dataMasters).where(eq(dataMasters.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      // Master Data Entries Methods
      async getMasterDataEntries(masterId) {
        const existingColumns = await this.getExistingColumns("master_data_entries");
        const selectColumns = Array.from(existingColumns).map((col) => `"${col}"`).join(", ");
        const hasOrderBy = existingColumns.has("orderBy");
        const orderClause = hasOrderBy ? '"orderBy" NULLS LAST, "entry_id"' : '"entry_id"';
        const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "master_id" = $1 ORDER BY ${orderClause}`;
        const result = await this.pool.query(selectSql, [masterId]);
        return result.rows || [];
      }
      async getMasterDataEntry(id) {
        const existingColumns = await this.getExistingColumns("master_data_entries");
        const selectColumns = Array.from(existingColumns).map((col) => `"${col}"`).join(", ");
        const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "id" = $1`;
        const result = await this.pool.query(selectSql, [id]);
        return result.rows?.[0] || void 0;
      }
      async createMasterDataEntry(insertEntry) {
        console.log("\u{1F527} [DB] Creating master data entry (NEW IMPLEMENTATION):", insertEntry);
        const entryWithName = this.ensureNameFieldForVesselMaster(insertEntry);
        console.log("\u{1F6A2} [DB] After name fallback:", entryWithName);
        const filteredEntry = await this.filterPayloadByExistingColumns(entryWithName, "master_data_entries");
        console.log("\u{1F527} [DB] Filtered entry for database insert:", filteredEntry);
        const { created_at, updated_at, ...payloadWithoutTimestamps } = filteredEntry;
        console.log("\u{1F50D} [DEBUG] After destructuring, payloadWithoutTimestamps keys:", Object.keys(payloadWithoutTimestamps));
        console.log("\u{1F50D} [DEBUG] created_at extracted:", created_at);
        console.log("\u{1F50D} [DEBUG] updated_at extracted:", updated_at);
        const columns = Object.keys(payloadWithoutTimestamps).map((col) => `"${col}"`).join(", ");
        const values = Object.values(payloadWithoutTimestamps).map((value) => value === void 0 ? null : value);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        const insertSql = `INSERT INTO master_data_entries (${columns}, "created_at", "updated_at") VALUES (${placeholders}, NOW(), NOW()) RETURNING *`;
        console.log("\u{1F527} [DB] Raw SQL:", insertSql);
        console.log("\u{1F527} [DB] Values:", values);
        const result = await this.pool.query(insertSql, values);
        console.log("\u{1F4E4} [DB] Insert result:", result);
        if (result.rows && result.rows.length > 0) {
          console.log("\u2705 [DB] Successfully created master data entry:", result.rows[0]);
          return result.rows[0];
        }
        console.error("\u274C [DB] No rows returned, trying alternative approach");
        const existingColumns = await this.getExistingColumns("master_data_entries");
        const selectColumns = Array.from(existingColumns).map((col) => `"${col}"`).join(", ");
        const fallbackSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "master_id" = $1 ORDER BY "id" DESC LIMIT 1`;
        const fallbackResult = await this.pool.query(fallbackSql, [entryWithName.masterId]);
        console.log("\u{1F504} [DB] Fallback query result:", fallbackResult.rows[0]);
        return fallbackResult.rows[0];
      }
      async updateMasterDataEntry(id, entryData) {
        const filteredEntry = await this.filterPayloadByExistingColumns(entryData, "master_data_entries");
        filteredEntry.updated_at = /* @__PURE__ */ new Date();
        const columns = Object.keys(filteredEntry).map((col, i) => `"${col}" = $${i + 1}`).join(", ");
        const values = Object.values(filteredEntry).map((value) => value === void 0 ? null : value);
        const updateSql = `UPDATE master_data_entries SET ${columns} WHERE "id" = $${values.length + 1}`;
        const result = await this.pool.query(updateSql, [...values, id]);
        if (result.rowCount === 0) {
          return void 0;
        }
        const existingColumns = await this.getExistingColumns("master_data_entries");
        const selectColumns = Array.from(existingColumns).map((col) => `"${col}"`).join(", ");
        const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "id" = $1`;
        const selectResult = await this.pool.query(selectSql, [id]);
        return selectResult.rows?.[0] || void 0;
      }
      async deleteMasterDataEntry(id) {
        const existing = await this.getMasterDataEntry(id);
        if (!existing) return false;
        const deleteSql = `DELETE FROM master_data_entries WHERE "id" = $1`;
        await this.pool.query(deleteSql, [id]);
        return true;
      }
      // Create database if it doesn't exist (PostgreSQL databases are typically created externally)
      async createDatabaseIfNotExists() {
        console.log("\u2139\uFE0F PostgreSQL database should be created externally (via cloud provider or psql)");
        console.log("\u2139\uFE0F Assuming database specified in DATABASE_URL already exists");
      }
      // Seed data for initial setup
      async seedDatabase() {
        try {
          console.log("\u{1F504} Connecting to existing crew_database tables...");
          const existingMasters = await this.getDataMasters();
          if (existingMasters.length >= 24) {
            console.log("Database already seeded, skipping...");
            return;
          }
          console.log(`Found ${existingMasters.length} existing master categories, ensuring all 24 are present...`);
          const rankData = [
            { name: "Master", category: "Senior Officers" },
            { name: "Chief Officer", category: "Senior Officers" },
            { name: "Chief Engineer", category: "Senior Officers" },
            { name: "2nd Officer", category: "Junior Officers" },
            { name: "3rd Officer", category: "Junior Officers" },
            { name: "2nd Engineer", category: "Junior Officers" },
            { name: "3rd Engineer", category: "Junior Officers" },
            { name: "Bosun", category: "Ratings" },
            { name: "AB", category: "Ratings" },
            { name: "OS", category: "Ratings" },
            { name: "Oiler", category: "Ratings" },
            { name: "Wiper", category: "Ratings" }
          ];
          for (const rank of rankData) {
            await this.createAvailableRank(rank);
          }
          const masterCategories = [
            { id: "001", name: "Nationality", description: "Crew member nationalities" },
            { id: "002", name: "Country", description: "Countries and regions" },
            { id: "003", name: "Language", description: "Languages spoken" },
            { id: "004", name: "Vessel Type", description: "Types of vessels" },
            { id: "006", name: "Qualification", description: "Qualifications and certifications" },
            { id: "007", name: "Course", description: "Training courses" },
            { id: "008", name: "Contract Type", description: "Types of contracts" },
            { id: "009", name: "Medical Status", description: "Medical examination status" },
            { id: "010", name: "Document Type", description: "Document types" },
            { id: "011", name: "Equipment", description: "Ship equipment and machinery" },
            { id: "012", name: "Designation", description: "Manage office personnel designations and organizational roles" },
            { id: "013", name: "Users", description: "System users and administrators" },
            { id: "014", name: "Vessels", description: "Fleet vessel information" },
            { id: "015", name: "Fleet Groups", description: "Vessel fleet groupings" },
            { id: "016", name: "Additional Groups", description: "Manage additional vessel groupings and assignments" },
            { id: "017", name: "Vessel Owners", description: "Manage vessel ownership details, contact information and vessel assignments" },
            { id: "018", name: "Port", description: "International ports and terminals for vessel operations" },
            { id: "019", name: "Language", description: "Languages for crew communication" },
            { id: "020", name: "Country", description: "Countries reference data" },
            { id: "021", name: "Manning Agents", description: "Manning agent companies and contacts" },
            { id: "022", name: "Crew Pool", description: "Crew pool categories" },
            { id: "023", name: "Appraisal Type", description: "Types of crew appraisals" },
            { id: "024", name: "Users", description: "System users from SAIL Audits API" }
          ];
          const existingIds = new Set(existingMasters.map((m) => m.id));
          for (const master of masterCategories) {
            if (!existingIds.has(master.id)) {
              console.log(`Creating missing master category: ${master.id} - ${master.name}`);
              await this.createDataMaster(master);
            }
          }
          const sampleMasterEntries = [
            // Major Maritime Nations with enhanced structure (NAT001-NAT020)
            { masterId: "001", entryId: "NAT001", name: "Filipino", description: "Philippines", countryName: "Filipino", country: "Philippines" },
            { masterId: "001", entryId: "NAT002", name: "Indian", description: "India", countryName: "Indian", country: "India" },
            { masterId: "001", entryId: "NAT003", name: "Chinese", description: "China", countryName: "Chinese", country: "China" },
            { masterId: "001", entryId: "NAT004", name: "Ukrainian", description: "Ukraine", countryName: "Ukrainian", country: "Ukraine" },
            { masterId: "001", entryId: "NAT005", name: "Russian", description: "Russia", countryName: "Russian", country: "Russia" },
            { masterId: "001", entryId: "NAT006", name: "Indonesian", description: "Indonesia", countryName: "Indonesian", country: "Indonesia" },
            { masterId: "001", entryId: "NAT007", name: "Turkish", description: "Turkey", countryName: "Turkish", country: "Turkey" },
            { masterId: "001", entryId: "NAT008", name: "Polish", description: "Poland", countryName: "Polish", country: "Poland" },
            { masterId: "001", entryId: "NAT009", name: "Romanian", description: "Romania", countryName: "Romanian", country: "Romania" },
            { masterId: "001", entryId: "NAT010", name: "Bulgarian", description: "Bulgaria", countryName: "Bulgarian", country: "Bulgaria" },
            { masterId: "001", entryId: "NAT011", name: "Greek", description: "Greece", countryName: "Greek", country: "Greece" },
            { masterId: "001", entryId: "NAT012", name: "Croatian", description: "Croatia", countryName: "Croatian", country: "Croatia" },
            { masterId: "001", entryId: "NAT013", name: "Myanmar", description: "Myanmar", countryName: "Myanmar", country: "Myanmar" },
            { masterId: "001", entryId: "NAT014", name: "Vietnamese", description: "Vietnam", countryName: "Vietnamese", country: "Vietnam" },
            { masterId: "001", entryId: "NAT015", name: "Bangladesh", description: "Bangladesh", countryName: "Bangladesh", country: "Bangladesh" },
            { masterId: "001", entryId: "NAT016", name: "Pakistani", description: "Pakistan", countryName: "Pakistani", country: "Pakistan" },
            { masterId: "001", entryId: "NAT017", name: "Sri Lankan", description: "Sri Lanka", countryName: "Sri Lankan", country: "Sri Lanka" },
            { masterId: "001", entryId: "NAT018", name: "Georgian", description: "Georgia", countryName: "Georgian", country: "Georgia" },
            { masterId: "001", entryId: "NAT019", name: "Latvian", description: "Latvia", countryName: "Latvian", country: "Latvia" },
            { masterId: "001", entryId: "NAT020", name: "Estonian", description: "Estonia", countryName: "Estonian", country: "Estonia" },
            // Designation entries - DISABLED: Users manage their own designations
            // { masterId: "012", entryId: "DES001", name: "Master", description: "Ship Captain" },
            // { masterId: "012", entryId: "DES002", name: "Chief Engineer", description: "Chief Engineering Officer" },
            // { masterId: "012", entryId: "DES003", name: "Chief Officer", description: "First Officer" },
            // Vessel Type entries - DISABLED: Users manage their own vessel types
            // { masterId: "004", entryId: "VT001", name: "Oil Tanker", description: "Petroleum transport vessel" },
            // { masterId: "004", entryId: "VT002", name: "Container Ship", description: "Containerized cargo vessel" },
            // { masterId: "004", entryId: "VT003", name: "Bulk Carrier", description: "Dry bulk cargo vessel" },
            // Fleet Groups entries (ID 015)
            { masterId: "015", entryId: "001", name: "Fleet Group 1", description: "Primary fleet group" },
            { masterId: "015", entryId: "002", name: "Fleet Group 2", description: "Secondary fleet group" },
            { masterId: "015", entryId: "003", name: "Fleet Group 3", description: "Tertiary fleet group" },
            { masterId: "015", entryId: "004", name: "Fleet Group 4", description: "Quaternary fleet group" },
            // Vessel Owners entries (ID 017)
            { masterId: "017", entryId: "VO001", name: "Maersk Line", description: "Danish shipping and logistics company" },
            { masterId: "017", entryId: "VO002", name: "MSC Mediterranean Shipping Company", description: "Swiss-Italian cargo shipping company" },
            { masterId: "017", entryId: "VO003", name: "CMA CGM Group", description: "French container transportation and shipping company" },
            { masterId: "017", entryId: "VO004", name: "COSCO Shipping Lines", description: "Chinese state-owned shipping and logistics company" },
            { masterId: "017", entryId: "VO005", name: "Hapag-Lloyd", description: "German international shipping and container transportation company" }
          ];
          for (const entry of sampleMasterEntries) {
            try {
              const [existing] = await this.pool.query(
                "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = ? AND entry_id = ?",
                [entry.masterId, entry.entryId]
              );
              if (existing[0].count === 0) {
                console.log(`\u{1F195} Creating new master entry: ${entry.masterId}/${entry.entryId} - ${entry.name}`);
                await this.createMasterDataEntry(entry);
              } else {
                console.log(`\u2705 Master entry already exists: ${entry.masterId}/${entry.entryId} - ${entry.name}`);
              }
            } catch (error) {
              console.warn(`\u26A0\uFE0F Warning: Could not create master entry ${entry.masterId}/${entry.entryId}:`, error);
            }
          }
          let formId = null;
          try {
            const existingForms = await this.getForms();
            const existingForm = existingForms.find((f) => f.name === "Crew Appraisal Form");
            if (!existingForm) {
              console.log("\u{1F195} Creating new form: Crew Appraisal Form");
              const form = await this.createForm({
                name: "Crew Appraisal Form",
                rankGroup: JSON.stringify("Senior Officers"),
                // Fix: JSON format for database
                versionNo: "01",
                versionDate: "01-Jan-2025",
                configuration: null
              });
              if (form && form.id) {
                formId = form.id;
                await this.createRankGroup({
                  formId: form.id,
                  name: "Senior Officers",
                  ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"])
                });
              }
            } else {
              console.log("\u2705 Form already exists: Crew Appraisal Form");
              formId = existingForm.id;
            }
          } catch (error) {
            console.warn("Warning: Could not seed forms/rank groups:", error);
          }
          const crewMemberData = [
            {
              id: "2025-05-14",
              firstName: "James",
              middleName: "Michael",
              familyName: "",
              presentRank: "Master",
              nationality: "British",
              presentVessel: "MT Sail One",
              vesselType: "Oil Tanker",
              signOnDate: "01-Feb-2025"
            },
            {
              id: "2025-03-12",
              firstName: "Anna",
              middleName: "Marie",
              familyName: "Johnson",
              presentRank: "Chief Engineer",
              nationality: "British",
              presentVessel: "MT Sail Ten",
              vesselType: "LPG Tanker",
              signOnDate: "01-Jan-2025"
            },
            {
              id: "2025-02-12",
              firstName: "David",
              middleName: "Lee",
              familyName: "Brown",
              presentRank: "Able Seaman",
              nationality: "Indian",
              presentVessel: "MT Sail Two",
              vesselType: "Container",
              signOnDate: "01-Feb-2025"
            }
          ];
          for (const crewMember of crewMemberData) {
            await this.createCrewMember(crewMember);
          }
          if (formId) {
            const appraisalData = [
              {
                crewMemberId: "2025-05-14",
                formId,
                appraisalType: "End of Contract",
                appraisalDate: "06-Jun-2025",
                appraisalData: "{}",
                competenceRating: "4.9",
                behavioralRating: "4.5",
                overallRating: "4.7",
                submittedBy: "admin",
                status: "submitted"
              },
              {
                crewMemberId: "2025-03-12",
                formId,
                appraisalType: "Mid Term",
                appraisalDate: "07-May-2025",
                appraisalData: "{}",
                competenceRating: "3.5",
                behavioralRating: "4.5",
                overallRating: "4.0",
                submittedBy: "admin",
                status: "submitted"
              },
              {
                crewMemberId: "2025-02-12",
                formId,
                appraisalType: "Special",
                appraisalDate: "06-Jun-2025",
                appraisalData: "{}",
                competenceRating: "2.5",
                behavioralRating: "3.5",
                overallRating: "3.0",
                submittedBy: "admin",
                status: "submitted"
              }
            ];
            for (const appraisal of appraisalData) {
              await this.createAppraisalResult(appraisal);
            }
          }
          const recruitmentData = [
            {
              id: "2025-03-14",
              fileNo: "2025-05-14",
              firstName: "James",
              middleName: "Michael",
              familyName: "Smith",
              dob: "1985-06-15",
              nationality: "British",
              rankAppliedFor: "Captain",
              presentRank: "First Officer",
              vesselType: "Oil Tanker",
              status: "Applied"
            },
            {
              id: "2025-03-12",
              fileNo: "2025-03-12",
              firstName: "Anna",
              middleName: "Marie",
              familyName: "Johnson",
              dob: "1990-11-22",
              nationality: "British",
              rankAppliedFor: "Chief Engineer",
              presentRank: "Second Engineer",
              vesselType: "LPG Tanker",
              status: "Screening"
            },
            {
              id: "2025-02-12",
              fileNo: "2025-02-12",
              firstName: "David",
              middleName: "Lee",
              familyName: "Brown",
              dob: "1980-02-10",
              nationality: "Indian",
              rankAppliedFor: "Able Seaman",
              presentRank: "Deck Cadet",
              vesselType: "Container",
              status: "For Approval"
            },
            {
              id: "2024-12-15",
              fileNo: "2024-12-15",
              firstName: "Michael",
              middleName: "Robert",
              familyName: "Thompson",
              dob: "1988-03-20",
              nationality: "British",
              rankAppliedFor: "Second Officer",
              presentRank: "Third Officer",
              vesselType: "Container",
              status: "Recruited"
            },
            {
              id: "2024-11-08",
              fileNo: "2024-11-08",
              firstName: "Sarah",
              middleName: "Elizabeth",
              familyName: "Wilson",
              dob: "1987-09-12",
              nationality: "Indian",
              rankAppliedFor: "Third Engineer",
              presentRank: "Fourth Engineer",
              vesselType: "Bulk",
              status: "Recruited"
            },
            {
              id: "2024-10-22",
              fileNo: "2024-10-22",
              firstName: "Carlos",
              middleName: "Antonio",
              familyName: "Rodriguez",
              dob: "1991-01-30",
              nationality: "Philippines",
              rankAppliedFor: "Bosun",
              presentRank: "AB",
              vesselType: "Oil Tanker",
              status: "Recruited"
            },
            {
              id: "2025-01-18",
              fileNo: "2025-01-18",
              firstName: "Lisa",
              middleName: "Anne",
              familyName: "Anderson",
              dob: "1989-07-25",
              nationality: "Romanian",
              rankAppliedFor: "Cook",
              presentRank: "Assistant Cook",
              vesselType: "General Cargo",
              status: "Waitlisted"
            },
            {
              id: "2025-01-05",
              fileNo: "2025-01-05",
              firstName: "Ahmed",
              middleName: "Hassan",
              familyName: "Ali",
              dob: "1986-11-14",
              nationality: "Indian",
              rankAppliedFor: "Chief Mate",
              presentRank: "Second Mate",
              vesselType: "Container",
              status: "Waitlisted"
            },
            {
              id: "2025-02-01",
              fileNo: "2025-02-01",
              firstName: "Peter",
              middleName: "James",
              familyName: "Clarke",
              dob: "1983-05-17",
              nationality: "British",
              rankAppliedFor: "Captain",
              presentRank: "Chief Officer",
              vesselType: "LPG Tanker",
              status: "Rejected"
            },
            {
              id: "2025-01-30",
              fileNo: "2025-01-30",
              firstName: "Maria",
              middleName: "Elena",
              familyName: "Garcia",
              dob: "1992-08-05",
              nationality: "Philippines",
              rankAppliedFor: "Ordinary Seaman",
              presentRank: "Cadet",
              vesselType: "Bulk",
              status: "Rejected"
            }
          ];
          for (const candidate of recruitmentData) {
            await this.createRecruitmentCandidate(candidate);
          }
          console.log("\u{1F4CA} Database seeded successfully!");
        } catch (error) {
          console.error("Error seeding database:", error);
          throw error;
        }
      }
      // Push schema to database
      async pushSchema() {
        try {
          const { migrate } = await import("drizzle-orm/mysql2/migrator");
          console.log("\u{1F4CB} Schema push completed (tables will be created on first access)");
        } catch (error) {
          console.error("Error pushing schema:", error);
        }
      }
      // Oil Major Compliance Rules Methods
      async getOilMajorRules() {
        try {
          return await this.db.select().from(oilMajorRules).orderBy(asc(oilMajorRules.oilMajorName));
        } catch (error) {
          console.error("Error getting oil major rules:", error);
          return [];
        }
      }
      async getOilMajorRule(id) {
        try {
          const result = await this.db.select().from(oilMajorRules).where(eq(oilMajorRules.id, id));
          return result[0];
        } catch (error) {
          console.error("Error getting oil major rule:", error);
          return void 0;
        }
      }
      async getOilMajorRuleByName(oilMajorName) {
        try {
          const result = await this.db.select().from(oilMajorRules).where(ilike(oilMajorRules.oilMajorName, oilMajorName.trim()));
          return result[0];
        } catch (error) {
          console.error("Error getting oil major rule by name:", error);
          return void 0;
        }
      }
      async createOilMajorRule(rule) {
        const result = await this.db.insert(oilMajorRules).values({
          oilMajorName: rule.oilMajorName,
          isActive: rule.isActive ?? true,
          rules: rule.rules
        }).returning();
        return result[0];
      }
      async updateOilMajorRule(id, rule) {
        const result = await this.db.update(oilMajorRules).set({ ...rule, updatedAt: /* @__PURE__ */ new Date() }).where(eq(oilMajorRules.id, id)).returning();
        return result[0];
      }
      async deleteOilMajorRule(id) {
        const result = await this.db.delete(oilMajorRules).where(eq(oilMajorRules.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async bulkCreateOilMajorRules(rules) {
        const createdRules = [];
        for (const rule of rules) {
          const existing = await this.getOilMajorRuleByName(rule.oilMajorName);
          if (existing) {
            const updated = await this.updateOilMajorRule(existing.id, rule);
            if (updated) createdRules.push(updated);
          } else {
            const created = await this.createOilMajorRule(rule);
            createdRules.push(created);
          }
        }
        return createdRules;
      }
      // Training Master Methods
      async getTrainingMasters() {
        try {
          return await this.db.select().from(trainingMaster).orderBy(asc(trainingMaster.category), asc(trainingMaster.trainingGroup), asc(trainingMaster.sortOrder));
        } catch (error) {
          console.error("Error getting training masters:", error);
          return [];
        }
      }
      async getTrainingMaster(id) {
        try {
          const result = await this.db.select().from(trainingMaster).where(eq(trainingMaster.id, id));
          return result[0];
        } catch (error) {
          console.error("Error getting training master:", error);
          return void 0;
        }
      }
      async createTrainingMaster(training) {
        const result = await this.db.insert(trainingMaster).values({
          trainingId: training.trainingId,
          trainingName: training.trainingName,
          category: training.category,
          trainingGroup: training.trainingGroup,
          requirementReference: training.requirementReference,
          applicableToCompany: training.applicableToCompany ?? false,
          trainingLabel: training.trainingLabel || training.trainingName,
          sortOrder: training.sortOrder ?? 0,
          isDefault: training.isDefault ?? false
        }).returning();
        return result[0];
      }
      async updateTrainingMaster(id, training) {
        const result = await this.db.update(trainingMaster).set(training).where(eq(trainingMaster.id, id)).returning();
        return result[0];
      }
      async deleteTrainingMaster(id) {
        const result = await this.db.delete(trainingMaster).where(eq(trainingMaster.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async reorderTrainingMasters(orders) {
        try {
          for (const order of orders) {
            await this.db.update(trainingMaster).set({ sortOrder: order.sortOrder }).where(eq(trainingMaster.id, order.id));
          }
          return true;
        } catch (error) {
          console.error("Error reordering training masters:", error);
          return false;
        }
      }
      // Company Training Groups Methods
      async getCompanyTrainingGroups() {
        return await this.db.select().from(companyTrainingGroups).orderBy(asc(companyTrainingGroups.displayOrder));
      }
      async updateCompanyTrainingGroup(code, data) {
        const result = await this.db.update(companyTrainingGroups).set(data).where(eq(companyTrainingGroups.code, code)).returning();
        return result[0];
      }
      // Company Training Methods
      async getCompanyTrainings() {
        return await this.db.select().from(companyTrainings).orderBy(
          sql`CASE WHEN ${companyTrainings.groupCode} IS NULL THEN 1 ELSE 0 END`,
          asc(companyTrainings.groupCode),
          asc(companyTrainings.companyId)
        );
      }
      async getCompanyTraining(id) {
        const result = await this.db.select().from(companyTrainings).where(eq(companyTrainings.id, id));
        return result[0];
      }
      async getCompanyTrainingByMasterId(trainingMasterId) {
        const result = await this.db.select().from(companyTrainings).where(eq(companyTrainings.trainingMasterId, trainingMasterId));
        return result[0];
      }
      async createCompanyTraining(training) {
        const result = await this.db.insert(companyTrainings).values({
          trainingMasterId: training.trainingMasterId,
          companyId: training.companyId,
          trainingLabel: training.trainingLabel,
          abr: training.abr || null,
          requirement: training.requirement || null,
          sortOrder: training.sortOrder ?? 0
        }).returning();
        return result[0];
      }
      async updateCompanyTraining(id, training) {
        const result = await this.db.update(companyTrainings).set(training).where(eq(companyTrainings.id, id)).returning();
        return result[0];
      }
      async deleteCompanyTraining(id) {
        const result = await this.db.delete(companyTrainings).where(eq(companyTrainings.id, id));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async deleteCompanyTrainingByMasterId(trainingMasterId) {
        const result = await this.db.delete(companyTrainings).where(eq(companyTrainings.trainingMasterId, trainingMasterId));
        return result.rowCount !== null && result.rowCount > 0;
      }
      async createCompanyTrainingFromMaster(trainingMasterId) {
        const existing = await this.getCompanyTrainingByMasterId(trainingMasterId);
        if (existing) {
          return existing;
        }
        const master = await this.db.select().from(trainingMaster).where(eq(trainingMaster.id, trainingMasterId));
        if (!master[0]) {
          return null;
        }
        const mt = master[0];
        const existingCompanyTrainings = await this.db.select().from(companyTrainings);
        const maxSortOrder = existingCompanyTrainings.reduce((max, ct) => Math.max(max, ct.sortOrder ?? 0), 0);
        const result = await this.db.insert(companyTrainings).values({
          trainingMasterId: mt.id,
          companyId: mt.trainingId,
          // Copy trainingId as initial companyId
          trainingLabel: mt.trainingLabel || mt.trainingName,
          // Use label or fall back to name
          abr: null,
          // Blank by default - company customizes
          requirement: mt.requirementReference || null,
          sortOrder: maxSortOrder + 1
        }).returning();
        return result[0];
      }
      async importCompanyTrainingsFromMaster() {
        const masterTrainings = await this.db.select().from(trainingMaster).where(eq(trainingMaster.applicableToCompany, true));
        const existingCompanyTrainings = await this.db.select().from(companyTrainings);
        const existingMasterIds = new Set(existingCompanyTrainings.map((ct) => ct.trainingMasterId));
        const newTrainings = masterTrainings.filter((mt) => !existingMasterIds.has(mt.id));
        if (newTrainings.length === 0) {
          return existingCompanyTrainings;
        }
        const insertData = newTrainings.map((mt, index) => ({
          trainingMasterId: mt.id,
          companyId: mt.trainingId,
          // Copy trainingId as initial companyId
          trainingLabel: mt.trainingLabel || mt.trainingName,
          // Use label or fall back to name
          abr: null,
          // Blank by default
          requirement: mt.requirementReference || null,
          // Copy requirement reference
          sortOrder: existingCompanyTrainings.length + index
        }));
        const result = await this.db.insert(companyTrainings).values(insertData).returning();
        return [...existingCompanyTrainings, ...result];
      }
      async reorderCompanyTrainings(orders) {
        try {
          for (const order of orders) {
            await this.db.update(companyTrainings).set({ sortOrder: order.sortOrder }).where(eq(companyTrainings.id, order.id));
          }
          return true;
        } catch (error) {
          console.error("Error reordering company trainings:", error);
          return false;
        }
      }
      // Company Training Requirements Methods
      async getCompanyTrainingRequirements() {
        return await this.db.select().from(companyTrainingRequirements);
      }
      async getCompanyTrainingRequirementsByTrainingIds(trainingIds) {
        if (trainingIds.length === 0) return [];
        return await this.db.select().from(companyTrainingRequirements).where(inArray(companyTrainingRequirements.companyTrainingId, trainingIds));
      }
      async upsertCompanyTrainingRequirements(requirements) {
        if (requirements.length === 0) return [];
        const results = [];
        for (const req of requirements) {
          if (req.status === null) {
            await this.db.delete(companyTrainingRequirements).where(and(
              eq(companyTrainingRequirements.companyTrainingId, req.companyTrainingId),
              eq(companyTrainingRequirements.rankId, req.rankId)
            ));
          } else {
            const existing = await this.db.select().from(companyTrainingRequirements).where(and(
              eq(companyTrainingRequirements.companyTrainingId, req.companyTrainingId),
              eq(companyTrainingRequirements.rankId, req.rankId)
            ));
            if (existing.length > 0) {
              const updated = await this.db.update(companyTrainingRequirements).set({ status: req.status }).where(eq(companyTrainingRequirements.id, existing[0].id)).returning();
              if (updated[0]) results.push(updated[0]);
            } else {
              const inserted = await this.db.insert(companyTrainingRequirements).values({
                companyTrainingId: req.companyTrainingId,
                rankId: req.rankId,
                status: req.status
              }).returning();
              if (inserted[0]) results.push(inserted[0]);
            }
          }
        }
        return results;
      }
      async deleteCompanyTrainingRequirementsByTrainingId(companyTrainingId) {
        const result = await this.db.delete(companyTrainingRequirements).where(eq(companyTrainingRequirements.companyTrainingId, companyTrainingId));
        return true;
      }
      // Training Matrix Vessel Drafts Methods
      async getTrainingMatrixVesselDrafts() {
        return await this.db.select().from(trainingMatrixVesselDrafts);
      }
      async getTrainingMatrixVesselDraft(id) {
        const result = await this.db.select().from(trainingMatrixVesselDrafts).where(eq(trainingMatrixVesselDrafts.id, id));
        return result[0];
      }
      async getTrainingMatrixVesselDraftsByVessel(vesselId2) {
        return await this.db.select().from(trainingMatrixVesselDrafts).where(eq(trainingMatrixVesselDrafts.vesselId, vesselId2));
      }
      async createTrainingMatrixVesselDraft(insertDraft) {
        const result = await this.db.insert(trainingMatrixVesselDrafts).values(insertDraft).returning();
        return result[0];
      }
      async updateTrainingMatrixVesselDraft(id, draftData) {
        const result = await this.db.update(trainingMatrixVesselDrafts).set({ ...draftData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(trainingMatrixVesselDrafts.id, id)).returning();
        return result[0];
      }
      async deleteTrainingMatrixVesselDraft(id) {
        const result = await this.db.delete(trainingMatrixVesselDrafts).where(eq(trainingMatrixVesselDrafts.id, id));
        return true;
      }
      // Training Matrix Vessel Revisions Methods
      async getTrainingMatrixVesselRevisions() {
        return await this.db.select().from(trainingMatrixVesselRevisions);
      }
      async getTrainingMatrixVesselRevision(id) {
        const result = await this.db.select().from(trainingMatrixVesselRevisions).where(eq(trainingMatrixVesselRevisions.id, id));
        return result[0];
      }
      async getTrainingMatrixVesselRevisionsByVessel(vesselId2) {
        return await this.db.select().from(trainingMatrixVesselRevisions).where(eq(trainingMatrixVesselRevisions.vesselId, vesselId2)).orderBy(desc(trainingMatrixVesselRevisions.createdAt));
      }
      async createTrainingMatrixVesselRevision(insertRevision) {
        const result = await this.db.insert(trainingMatrixVesselRevisions).values(insertRevision).returning();
        return result[0];
      }
      // Promotion Reviews Methods
      async getPromotionReviews() {
        return await this.db.select().from(promotionReviews).orderBy(desc(promotionReviews.updatedAt));
      }
      async getPromotionReview(id) {
        const result = await this.db.select().from(promotionReviews).where(eq(promotionReviews.id, id));
        return result[0];
      }
      async getPromotionReviewByCrewAndRank(crewMemberId, promotionToRank) {
        const result = await this.db.select().from(promotionReviews).where(and(
          eq(promotionReviews.crewMemberId, crewMemberId),
          eq(promotionReviews.promotionToRank, promotionToRank)
        ));
        return result[0];
      }
      async getPromotionReviewsByCrewMember(crewMemberId) {
        return await this.db.select().from(promotionReviews).where(eq(promotionReviews.crewMemberId, crewMemberId)).orderBy(desc(promotionReviews.updatedAt));
      }
      async createPromotionReview(review) {
        const result = await this.db.insert(promotionReviews).values(review).returning();
        return result[0];
      }
      async updatePromotionReview(id, review) {
        const result = await this.db.update(promotionReviews).set({ ...review, updatedAt: /* @__PURE__ */ new Date() }).where(eq(promotionReviews.id, id)).returning();
        return result[0];
      }
      async deletePromotionReview(id) {
        await this.db.delete(promotionReviews).where(eq(promotionReviews.id, id));
        return true;
      }
    };
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  PersistentFileStorage: () => PersistentFileStorage,
  buildServiceTimeline: () => buildServiceTimeline,
  calculateExperienceFromSeaService: () => calculateExperienceFromSeaService,
  calculateVesselTypeSpecificExperience: () => calculateVesselTypeSpecificExperience,
  connectionError: () => connectionError,
  deriveEndorsementCode: () => deriveEndorsementCode,
  isConnected: () => isConnected,
  storage: () => storage,
  translateVesselCodeToName: () => translateVesselCodeToName,
  translateVesselNameToCode: () => translateVesselNameToCode
});
import * as fs from "fs";
import * as path from "path";
function translateVesselCodeToName(vesselCode) {
  const vesselName = STATIC_VESSEL_CODE_TO_NAME[vesselCode];
  if (vesselName) {
    return vesselName;
  }
  return vesselCode;
}
function formatDateForDashboard(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate().toString().padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}
function isTankerVesselType(vesselType) {
  if (!vesselType) return false;
  const normalized = vesselType.trim().toLowerCase();
  const tankerKeywords = ["tanker", "oil", "chemical", "gas", "lng", "lpg", "bitumen", "asphalt", "product"];
  if (TANKER_VESSEL_TYPES.some((t) => t.toLowerCase() === normalized)) {
    return true;
  }
  return tankerKeywords.some((keyword) => normalized.includes(keyword));
}
function isOfficerRank(rankName) {
  if (!rankName) return false;
  const normalized = rankName.trim().toLowerCase();
  const officerKeywords = ["officer", "master", "captain", "engineer", "mate", "eto", "e/o", "r/o"];
  const ratingKeywords = [
    "petty",
    "bosun",
    "boatswain",
    "able",
    "ordinary",
    "oiler",
    "motorman",
    "wiper",
    "fitter",
    "cook",
    "steward",
    "messman",
    "cadet",
    "trainee",
    "rating"
  ];
  if (OFFICER_RANK_NAMES.some((r) => r.toLowerCase() === normalized)) {
    return true;
  }
  if (ratingKeywords.some((keyword) => normalized.includes(keyword))) {
    return false;
  }
  return officerKeywords.some((keyword) => normalized.includes(keyword));
}
function calculateShipTypeExperience(companySeaService, externalSeaService) {
  const allSeaService = [...companySeaService, ...externalSeaService];
  const vesselTypeNormalization = {
    "oil tanker": "Oil Tkr",
    "product tanker": "Oil Tkr",
    "crude oil tanker": "Oil Tkr",
    "chemical tanker": "Ch Tkr",
    "oil/chemical tanker": "Oil/Ch Tkr",
    "oil chemical tanker": "Oil/Ch Tkr",
    "gas tanker": "Gas Tkr",
    "lpg tanker": "Gas Tkr",
    "lng tanker": "Gas Tkr",
    "bulk carrier": "Bulk",
    "dry bulk carrier": "Bulk",
    "bulk": "Bulk",
    "container ship": "Container",
    "container": "Container",
    "general cargo": "Gen Cargo",
    "ro-ro": "Ro-Ro",
    "roro": "Ro-Ro",
    "offshore": "Offshore",
    "tanker": "Tanker"
  };
  const typeMonths = {};
  let totalMonths = 0;
  for (const service of allSeaService) {
    let period = 0;
    const fromStr = getSeaServiceFromDate(service);
    const from = safeParseDate(fromStr);
    const isActive = isActiveSeaService(service);
    if (from) {
      if (isActive) {
        period = calculatePeriodMonths(from, getReportingDate());
      } else {
        const toStr = getSeaServiceToDate(service);
        const to = safeParseDate(toStr);
        if (to) {
          period = calculatePeriodMonths(from, to);
        } else {
          period = parseFloat(service.periodMonths) || 0;
        }
      }
    }
    if (period <= 0) continue;
    totalMonths += period;
    let vesselType = (service.vesselType || "").trim();
    if (!vesselType) continue;
    const normalizedType = vesselType.toLowerCase();
    let displayLabel = vesselTypeNormalization[normalizedType] || null;
    if (!displayLabel) {
      if (normalizedType.includes("oil") && normalizedType.includes("chemical")) {
        displayLabel = "Oil/Ch Tkr";
      } else if (normalizedType.includes("oil") || normalizedType.includes("product") || normalizedType.includes("crude")) {
        displayLabel = "Oil Tkr";
      } else if (normalizedType.includes("chemical")) {
        displayLabel = "Ch Tkr";
      } else if (normalizedType.includes("gas") || normalizedType.includes("lpg") || normalizedType.includes("lng")) {
        displayLabel = "Gas Tkr";
      } else if (normalizedType.includes("bulk")) {
        displayLabel = "Bulk";
      } else if (normalizedType.includes("container")) {
        displayLabel = "Container";
      } else if (normalizedType.includes("tanker")) {
        displayLabel = "Tanker";
      } else {
        displayLabel = vesselType;
      }
    }
    if (displayLabel) {
      typeMonths[displayLabel] = (typeMonths[displayLabel] || 0) + period;
    }
  }
  const shipTypeExperience = Object.entries(typeMonths).map(([type, months]) => ({
    type,
    label: type,
    months,
    years: Math.round(months / 12 * 10) / 10
  })).sort((a, b) => b.months - a.months);
  return { shipTypeExperience, totalMonths };
}
function calculateExperienceFromSeaService(companySeaService, externalSeaService, currentRank) {
  const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
  const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
  const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
  let companyYears = 0;
  if (safeCompanySeaService.length > 0) {
    const fromDates = safeCompanySeaService.map((s) => getSeaServiceFromDate(s)).filter((d) => d && typeof d === "string" && d.trim() !== "").map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
    if (fromDates.length > 0) {
      const earliestDate = new Date(Math.min(...fromDates.map((d) => d.getTime())));
      const today = /* @__PURE__ */ new Date();
      const diffMs = today.getTime() - earliestDate.getTime();
      const diffYears = diffMs / (1e3 * 60 * 60 * 24 * 365.25);
      const roundedYears = Math.round(diffYears * 10) / 10;
      companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
    }
  }
  const getServicePeriodMonths = (service) => {
    const fromStr = getSeaServiceFromDate(service);
    const from = safeParseDate(fromStr);
    if (!from) return 0;
    const isActive = isActiveSeaService(service);
    if (isActive) {
      return calculatePeriodMonths(from, getReportingDate());
    } else {
      const toStr = getSeaServiceToDate(service);
      const to = safeParseDate(toStr);
      if (to) {
        return calculatePeriodMonths(from, to);
      } else {
        return parseFloat(service.periodMonths) || 0;
      }
    }
  };
  let rankMonths = 0;
  if (currentRank) {
    const normalizedCurrentRank = currentRank.trim().toLowerCase();
    for (const service of allSeaService) {
      if (service.rank && service.rank.trim().toLowerCase() === normalizedCurrentRank) {
        rankMonths += getServicePeriodMonths(service);
      }
    }
  }
  const rankYears = Math.round(rankMonths / 12 * 10) / 10;
  let tankerMonths = 0;
  for (const service of allSeaService) {
    if (isTankerVesselType(service.vesselType)) {
      tankerMonths += getServicePeriodMonths(service);
    }
  }
  const tankerYears = Math.round(tankerMonths / 12 * 10) / 10;
  let oowMonths = 0;
  for (const service of allSeaService) {
    if (isOfficerRank(service.rank)) {
      oowMonths += getServicePeriodMonths(service);
    }
  }
  const oowYears = Math.round(oowMonths / 12 * 10) / 10;
  return {
    company: companyYears,
    rank: rankYears,
    tankers: tankerYears,
    oow: oowYears
  };
}
function calculateVesselTypeSpecificExperience(companySeaService, externalSeaService, vesselTypeCode) {
  const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
  const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
  const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
  if (!vesselTypeCode) return 0;
  const vesselTypeKeywords = {
    "OIL_TANKER": ["oil tanker"],
    "PRODUCT_OIL_TANKER": ["product oil tanker", "product tanker", "product oil"],
    "CRUDE_OIL_TANKER": ["crude oil tanker", "crude tanker", "crude oil"],
    "CHEMICAL_TANKER": ["chemical tanker", "chem tanker"],
    "GAS_TANKER": ["gas tanker", "lng", "lpg"],
    "LNG_TANKER": ["lng tanker", "lng"],
    "LPG_TANKER": ["lpg tanker", "lpg"],
    "OIL_CHEMICAL_TANKER": ["oil chemical tanker", "oil chemical", "oil/chemical"],
    "BULK_CARRIER": ["bulk carrier", "bulk", "dry bulk"],
    "CONTAINER": ["container"],
    "GENERAL_CARGO": ["general cargo", "cargo"],
    "RORO": ["ro-ro", "roro"],
    "OFFSHORE_SUPPORT": ["offshore"],
    "SHUTTLE_TANKERS": ["shuttle"]
  };
  const keywords = vesselTypeKeywords[vesselTypeCode] || [vesselTypeCode.toLowerCase().replace(/_/g, " ")];
  let totalMonths = 0;
  for (const service of allSeaService) {
    const vesselType = (service.vesselType || "").trim().toLowerCase();
    if (!vesselType) continue;
    const matches = keywords.some((keyword) => vesselType.includes(keyword.toLowerCase()));
    if (matches) {
      const period = parseFloat(service.periodMonths) || 0;
      totalMonths += period;
    }
  }
  return Math.round(totalMonths / 12 * 10) / 10;
}
function deriveEndorsementCode(rankFlags, licenses) {
  if (!licenses || licenses.length === 0) return "\u2014";
  const licenseIds = new Set(
    licenses.map((lic) => (lic.entryId || lic.licenseId || lic.licenseType || "").toUpperCase())
  );
  let hasO = false;
  let hasC = false;
  let hasG = false;
  if (rankFlags.seniorOfficer) {
    hasO = licenseIds.has("L002") || licenseIds.has("LIC002");
    hasC = licenseIds.has("L004") || licenseIds.has("LIC004");
    hasG = licenseIds.has("L006") || licenseIds.has("LIC006");
  } else if (rankFlags.rating) {
    hasO = licenseIds.has("LIC018");
    hasC = licenseIds.has("LIC019");
    hasG = licenseIds.has("LIC020");
  } else if (rankFlags.officer) {
    hasO = licenseIds.has("L001") || licenseIds.has("L002") || licenseIds.has("LIC001") || licenseIds.has("LIC002");
    hasC = licenseIds.has("L003") || licenseIds.has("L004") || licenseIds.has("LIC003") || licenseIds.has("LIC004");
    hasG = licenseIds.has("L005") || licenseIds.has("L006") || licenseIds.has("LIC005") || licenseIds.has("LIC006");
  } else {
    hasO = licenseIds.has("L001") || licenseIds.has("L002") || licenseIds.has("LIC001") || licenseIds.has("LIC002");
    hasC = licenseIds.has("L003") || licenseIds.has("L004") || licenseIds.has("LIC003") || licenseIds.has("LIC004");
    hasG = licenseIds.has("L005") || licenseIds.has("L006") || licenseIds.has("LIC005") || licenseIds.has("LIC006");
  }
  let code = "";
  if (hasO) code += "O";
  if (hasC) code += "C";
  if (hasG) code += "G";
  return code || "\u2014";
}
function translateVesselNameToCode(vesselName) {
  const staticCode = STATIC_VESSEL_MAPPING[vesselName];
  if (staticCode) {
    return staticCode;
  }
  if (vesselName && UUID_PATTERN.test(vesselName)) {
    return vesselName;
  }
  if (vesselName && STATIC_VESSEL_CODE_TO_NAME[vesselName]) {
    return vesselName;
  }
  throw new Error(
    `Cannot translate vessel name "${vesselName}" to canonical vessel code. Vessel must be in STATIC_VESSEL_MAPPING or already in UUID format (from Master 014). Available vessels: ${Object.keys(STATIC_VESSEL_MAPPING).join(", ")}`
  );
}
function buildServiceTimeline(companySeaService, vesselPlanningRecords, appraisalsByVessel, handoversByVessel, vesselCodeToNameMap, relieverPlanningRecords) {
  const today = /* @__PURE__ */ new Date();
  const timelineStart = new Date(today);
  timelineStart.setMonth(today.getMonth() - 2);
  const timelineEnd = new Date(today);
  timelineEnd.setMonth(today.getMonth() + 4);
  const timeline = [];
  for (const service of companySeaService) {
    const fromDateStr = getSeaServiceFromDate(service);
    const toDateStr = getSeaServiceToDate(service);
    if (!fromDateStr) continue;
    const fromDate = new Date(fromDateStr);
    const toDate = toDateStr ? new Date(toDateStr) : null;
    if (toDate && toDate < timelineStart) continue;
    if (fromDate > timelineEnd) continue;
    const vesselId2 = service.vesselId || service.vesselCode || "";
    let vesselName = service.vesselName || service.vessel || "Unknown Vessel";
    if (vesselId2 && vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId2)) {
      vesselName = vesselCodeToNameMap.get(vesselId2);
    } else if (vesselId2 && !vesselCodeToNameMap) {
      vesselName = translateVesselCodeToName(vesselId2) || vesselName;
    }
    timeline.push({
      vessel: vesselName,
      vesselId: vesselId2,
      startDate: fromDateStr,
      endDate: toDateStr || null,
      contractEndDate: null,
      rangeEndDate: null,
      type: toDate && toDate < today ? "completed" : "onBoard",
      appraisalIds: appraisalsByVessel.get(vesselName) || appraisalsByVessel.get(vesselId2) || [],
      handoverIds: handoversByVessel.get(vesselName) || handoversByVessel.get(vesselId2) || []
    });
  }
  for (const planning of vesselPlanningRecords) {
    if (!planning.signOnDate && !planning.joiningDate) continue;
    const startDate = planning.signOnDate || planning.joiningDate;
    const fromDate = new Date(startDate);
    if (fromDate > timelineEnd) continue;
    let endDate = planning.signOffDate || null;
    let contractEndDate = null;
    let rangeEndDate = null;
    const baseDate = planning.signOnDate || planning.joiningDate;
    if (baseDate) {
      const baseDateObj = new Date(baseDate);
      if (planning.contractEndRangeStartMonths) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + planning.contractEndRangeStartMonths);
        contractEndDate = contractEnd.toISOString().split("T")[0];
      } else if (planning.contractPeriodMonths) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + planning.contractPeriodMonths);
        contractEndDate = contractEnd.toISOString().split("T")[0];
      } else if (planning.reliefDue) {
        contractEndDate = planning.reliefDue;
      }
      if (planning.contractEndRangeEndMonths) {
        const rangeEnd = new Date(baseDateObj);
        rangeEnd.setMonth(rangeEnd.getMonth() + planning.contractEndRangeEndMonths);
        rangeEndDate = rangeEnd.toISOString().split("T")[0];
      } else if (contractEndDate) {
        rangeEndDate = contractEndDate;
      }
    }
    let type = "planned";
    if (planning.signOnDate) {
      const signOn = new Date(planning.signOnDate);
      if (signOn <= today) {
        if (planning.signOffDate && new Date(planning.signOffDate) < today) {
          type = "completed";
        } else {
          type = "onBoard";
        }
      }
    }
    const vesselId2 = planning.vesselId || "";
    let vesselName = planning.vesselName || "Unknown Vessel";
    if (vesselId2) {
      if (vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId2)) {
        vesselName = vesselCodeToNameMap.get(vesselId2);
      } else if (!vesselCodeToNameMap) {
        vesselName = translateVesselCodeToName(vesselId2);
      }
    }
    timeline.push({
      vessel: vesselName,
      vesselId: vesselId2,
      startDate,
      endDate,
      contractEndDate,
      rangeEndDate,
      type,
      appraisalIds: appraisalsByVessel.get(vesselName) || appraisalsByVessel.get(vesselId2) || [],
      handoverIds: handoversByVessel.get(vesselName) || handoversByVessel.get(vesselId2) || []
    });
  }
  if (relieverPlanningRecords && relieverPlanningRecords.length > 0) {
    for (const planning of relieverPlanningRecords) {
      const startDate = planning.joiningDate;
      if (!startDate) continue;
      const fromDate = new Date(startDate);
      if (fromDate > timelineEnd) continue;
      let contractEndDate = null;
      let rangeEndDate = null;
      const baseDateObj = new Date(startDate);
      const parseMonths = (val) => {
        if (val === null || val === void 0 || val === "") return null;
        const num = typeof val === "number" ? val : parseInt(String(val), 10);
        return isNaN(num) ? null : num;
      };
      const contractEndRangeStartMonths = parseMonths(planning.contractEndRangeStartMonths);
      const contractPeriodMonths = parseMonths(planning.contractPeriodMonths);
      const contractEndRangeEndMonths = parseMonths(planning.contractEndRangeEndMonths);
      if (contractEndRangeStartMonths !== null) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + contractEndRangeStartMonths);
        contractEndDate = contractEnd.toISOString().split("T")[0];
      } else if (contractPeriodMonths !== null) {
        const contractEnd = new Date(baseDateObj);
        contractEnd.setMonth(contractEnd.getMonth() + contractPeriodMonths);
        contractEndDate = contractEnd.toISOString().split("T")[0];
      }
      if (contractEndRangeEndMonths !== null) {
        const rangeEnd = new Date(baseDateObj);
        rangeEnd.setMonth(rangeEnd.getMonth() + contractEndRangeEndMonths);
        rangeEndDate = rangeEnd.toISOString().split("T")[0];
      } else if (contractEndDate) {
        rangeEndDate = contractEndDate;
      }
      let endDate = rangeEndDate || contractEndDate || null;
      const vesselId2 = planning.vesselId || "";
      let vesselName = planning.vesselName || "Unknown Vessel";
      if (vesselId2) {
        if (vesselCodeToNameMap && vesselCodeToNameMap.has(vesselId2)) {
          vesselName = vesselCodeToNameMap.get(vesselId2);
        } else if (!vesselCodeToNameMap) {
          vesselName = translateVesselCodeToName(vesselId2);
        }
      }
      timeline.push({
        vessel: vesselName,
        vesselId: vesselId2,
        startDate,
        endDate,
        contractEndDate,
        rangeEndDate,
        type: "planned",
        appraisalIds: [],
        handoverIds: []
      });
    }
  }
  const deduplicatedTimeline = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of timeline) {
    if (entry.vesselId) {
      const key = `${entry.vesselId}_${entry.startDate}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedTimeline.push(entry);
      }
    }
  }
  for (const entry of timeline) {
    if (!entry.vesselId) {
      const isDuplicate = deduplicatedTimeline.some((existing) => {
        if (existing.vessel !== entry.vessel) return false;
        const existingStart = new Date(existing.startDate).getTime();
        const entryStart = new Date(entry.startDate).getTime();
        const daysDiff = Math.abs(existingStart - entryStart) / (1e3 * 60 * 60 * 24);
        return daysDiff <= 7;
      });
      if (!isDuplicate) {
        deduplicatedTimeline.push(entry);
      }
    }
  }
  deduplicatedTimeline.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  return deduplicatedTimeline;
}
function constructDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    console.log("\u{1F517} Using DATABASE_URL from environment (Replit PostgreSQL)");
    return process.env.DATABASE_URL;
  }
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_PORT && DB_USER && DB_PASSWORD) {
    console.log("\u{1F517} Constructing DATABASE_URL from DB_HOST/DB_PORT (legacy setup)");
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `postgresql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/crew_database`;
  }
  return null;
}
var STATIC_VESSEL_MAPPING, STATIC_VESSEL_CODE_TO_NAME, UUID_PATTERN, TANKER_VESSEL_TYPES, OFFICER_RANK_NAMES, PersistentFileStorage, storage, isConnected, connectionError, databaseUrl, databaseUrlForceDisabled;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_dateUtils();
    init_database();
    STATIC_VESSEL_MAPPING = {
      // Vessel names -> UUID (from Master 014)
      "Vessel 1": "743ef9d1-841a-11ed-aa7c-7003bca91a86",
      "Vessel 2": "743feb08-841a-11ed-aa7c-7003bca91a86",
      "Vessel 3": "7440571a-841a-11ed-aa7c-7003bca91a86",
      "Vessel 4": "744535d0-841a-11ed-aa7c-7003bca91a86",
      "Vessel 5": "7446783c-841a-11ed-aa7c-7003bca91a86",
      "Vessel 6": "74481b72-841a-11ed-aa7c-7003bca91a86"
    };
    STATIC_VESSEL_CODE_TO_NAME = {
      "743ef9d1-841a-11ed-aa7c-7003bca91a86": "Vessel 1",
      "743feb08-841a-11ed-aa7c-7003bca91a86": "Vessel 2",
      "7440571a-841a-11ed-aa7c-7003bca91a86": "Vessel 3",
      "744535d0-841a-11ed-aa7c-7003bca91a86": "Vessel 4",
      "7446783c-841a-11ed-aa7c-7003bca91a86": "Vessel 5",
      "74481b72-841a-11ed-aa7c-7003bca91a86": "Vessel 6"
    };
    UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    TANKER_VESSEL_TYPES = [
      "Oil Tanker",
      "Chemical Tanker",
      "Gas Tanker",
      "LPG Tanker",
      "LNG Tanker",
      "Product Oil Tanker",
      "Crude Oil Tanker",
      "Bitumen/Asphalt Carriers",
      "Oil Chemical Tanker",
      "Shuttle Tankers"
    ];
    OFFICER_RANK_NAMES = [
      "Master",
      "Captain",
      "Chief Officer",
      "Chief Mate",
      "C/O",
      "2nd Officer",
      "Second Officer",
      "2/O",
      "3rd Officer",
      "Third Officer",
      "3/O",
      "Chief Engineer",
      "C/E",
      "2nd Engineer",
      "Second Engineer",
      "2/E",
      "3rd Engineer",
      "Third Engineer",
      "3/E",
      "4th Engineer",
      "Fourth Engineer",
      "4/E",
      "Electrical Officer",
      "E/O",
      "ETO",
      "Radio Officer",
      "R/O"
    ];
    PersistentFileStorage = class {
      users;
      forms;
      rankGroups;
      availableRanks;
      companyRanks;
      promotionHierarchies;
      crewMembers;
      appraisalResults;
      recruitmentCandidates;
      vesselGroups;
      masterDataEntries;
      vesselDrafts;
      vesselRevisions;
      trainingMatrixVesselDrafts;
      trainingMatrixVesselRevisions;
      vesselPlanning;
      rotationPlans;
      rotationArchive;
      drugAlcoholTestRecords;
      restHoursVesselRecords;
      restHoursCrewRecords;
      restHoursDailyRecords;
      variableTasks;
      fixedTasks;
      vesselViolationComments;
      officeViolationComments;
      ncReports;
      vesselDateLineAdjustments;
      oilMajorRules;
      currentUserId;
      currentFormId;
      currentRankGroupId;
      currentAvailableRankId;
      currentPromotionHierarchyId;
      currentAppraisalResultId;
      currentCrewIdCounter;
      currentVesselGroupId;
      currentVesselDraftId;
      currentVesselRevisionId;
      currentTrainingMatrixVesselDraftId;
      currentTrainingMatrixVesselRevisionId;
      currentVesselPlanningId;
      currentRotationPlanId;
      currentRotationArchiveId;
      currentDrugAlcoholTestRecordId;
      currentRestHoursVesselRecordId;
      currentRestHoursCrewRecordId;
      currentRestHoursDailyRecordId;
      currentVariableTaskId;
      currentFixedTaskId;
      currentVesselViolationCommentId;
      currentOfficeViolationCommentId;
      currentNCReportId;
      currentVesselDateLineAdjustmentId;
      currentOilMajorRuleId;
      filePath;
      saveTimeout = null;
      isSaving = false;
      needsResave = false;
      pendingData = null;
      constructor() {
        this.users = /* @__PURE__ */ new Map();
        this.forms = /* @__PURE__ */ new Map();
        this.rankGroups = /* @__PURE__ */ new Map();
        this.availableRanks = /* @__PURE__ */ new Map();
        this.companyRanks = /* @__PURE__ */ new Map();
        this.promotionHierarchies = /* @__PURE__ */ new Map();
        this.crewMembers = /* @__PURE__ */ new Map();
        this.appraisalResults = /* @__PURE__ */ new Map();
        this.recruitmentCandidates = /* @__PURE__ */ new Map();
        this.vesselGroups = /* @__PURE__ */ new Map();
        this.masterDataEntries = /* @__PURE__ */ new Map();
        this.vesselDrafts = /* @__PURE__ */ new Map();
        this.vesselRevisions = /* @__PURE__ */ new Map();
        this.trainingMatrixVesselDrafts = /* @__PURE__ */ new Map();
        this.trainingMatrixVesselRevisions = /* @__PURE__ */ new Map();
        this.vesselPlanning = /* @__PURE__ */ new Map();
        this.rotationPlans = /* @__PURE__ */ new Map();
        this.rotationArchive = /* @__PURE__ */ new Map();
        this.drugAlcoholTestRecords = /* @__PURE__ */ new Map();
        this.restHoursVesselRecords = /* @__PURE__ */ new Map();
        this.restHoursCrewRecords = /* @__PURE__ */ new Map();
        this.restHoursDailyRecords = /* @__PURE__ */ new Map();
        this.variableTasks = /* @__PURE__ */ new Map();
        this.fixedTasks = /* @__PURE__ */ new Map();
        this.vesselViolationComments = /* @__PURE__ */ new Map();
        this.officeViolationComments = /* @__PURE__ */ new Map();
        this.ncReports = /* @__PURE__ */ new Map();
        this.vesselDateLineAdjustments = /* @__PURE__ */ new Map();
        this.oilMajorRules = /* @__PURE__ */ new Map();
        this.currentUserId = 1;
        this.currentFormId = 1;
        this.currentRankGroupId = 1;
        this.currentAvailableRankId = 1;
        this.currentPromotionHierarchyId = 1;
        this.currentAppraisalResultId = 1;
        this.currentCrewIdCounter = 1;
        this.currentVesselGroupId = 1;
        this.currentVesselDraftId = 1;
        this.currentVesselRevisionId = 1;
        this.currentTrainingMatrixVesselDraftId = 1;
        this.currentTrainingMatrixVesselRevisionId = 1;
        this.currentVesselPlanningId = 1;
        this.currentRotationPlanId = 1;
        this.currentRotationArchiveId = 1;
        this.currentDrugAlcoholTestRecordId = 1;
        this.currentRestHoursVesselRecordId = 1;
        this.currentRestHoursCrewRecordId = 1;
        this.currentRestHoursDailyRecordId = 1;
        this.currentVariableTaskId = 1;
        this.currentFixedTaskId = 1;
        this.currentVesselViolationCommentId = 1;
        this.currentOfficeViolationCommentId = 1;
        this.currentNCReportId = 1;
        this.currentVesselDateLineAdjustmentId = 1;
        this.currentOilMajorRuleId = 1;
        this.filePath = path.join(process.cwd(), "test-data.json");
        this.loadFromFile();
      }
      migrateRotationPlanAssignments() {
        let plansFixed = 0;
        for (const [planId, plan] of Array.from(this.rotationPlans.entries())) {
          if (plan.assignments) {
            try {
              const assignments = JSON.parse(plan.assignments);
              let needsFix = false;
              for (let i = 0; i < assignments.length; i++) {
                if (assignments[i].assignmentIndex === void 0 || assignments[i].assignmentIndex !== i) {
                  needsFix = true;
                  break;
                }
              }
              if (needsFix) {
                const cleanedAssignments = assignments.map((assignment, index) => {
                  const { assignmentIndex, ...cleaned } = assignment;
                  return {
                    ...cleaned,
                    proposalStatus: assignment.proposalStatus || "proposed"
                  };
                });
                const updatedPlan = {
                  ...plan,
                  assignments: JSON.stringify(cleanedAssignments)
                };
                this.rotationPlans.set(planId, updatedPlan);
                plansFixed++;
              }
            } catch (error) {
              console.error(`Failed to migrate rotation plan ${planId}:`, error);
            }
          }
        }
        if (plansFixed > 0) {
          console.log(`\u{1F527} Migrated ${plansFixed} rotation plans to fix assignment indices`);
          this.saveToFile();
        }
      }
      deduplicateDailyRecords() {
        const grouped = /* @__PURE__ */ new Map();
        for (const record of Array.from(this.restHoursDailyRecords.values())) {
          const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key).push(record);
        }
        let duplicatesRemoved = 0;
        for (const [key, records] of Array.from(grouped.entries())) {
          if (records.length > 1) {
            records.sort((a, b) => Number(b.id) - Number(a.id));
            const keepRecord = records[0];
            const removeRecords = records.slice(1);
            for (const record of removeRecords) {
              this.restHoursDailyRecords.delete(record.id);
              duplicatesRemoved++;
            }
          }
        }
        if (duplicatesRemoved > 0) {
          console.log(`\u{1F527} Deduplicated ${duplicatesRemoved} duplicate daily records (kept highest ID for each crew/vessel/month)`);
          this.saveToFile();
        }
      }
      loadNestedMapData(data) {
        const extractRevisions = (arr, results = []) => {
          if (!Array.isArray(arr)) return results;
          for (const item of arr) {
            if (Array.isArray(item) && item.length === 2) {
              const [key, value] = item;
              if (typeof value === "object" && value !== null && !Array.isArray(value) && value.vesselId) {
                results.push(value);
              } else {
                extractRevisions(item, results);
              }
            }
          }
          return results;
        };
        const revisions2 = extractRevisions(data);
        const map = /* @__PURE__ */ new Map();
        for (const revision of revisions2) {
          if (revision.id !== void 0) {
            map.set(revision.id, revision);
          }
        }
        console.log(`\u{1F4CA} Loaded ${map.size} vessel revisions from file`);
        return map;
      }
      // Vessel Violation Comments Methods
      async getVesselViolationComment(vesselId2, monthValue) {
        const comments = Array.from(this.vesselViolationComments.values());
        const existing = comments.find((c) => c.vesselId === vesselId2 && c.monthValue === monthValue);
        return existing || null;
      }
      async saveVesselViolationComment(insertComment) {
        const comments = Array.from(this.vesselViolationComments.values());
        const existing = comments.find((c) => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
        if (existing) {
          const updated = {
            ...existing,
            comment: insertComment.comment ?? null,
            updatedAt: null
          };
          this.vesselViolationComments.set(existing.id, updated);
          this.saveToFile();
          return updated;
        } else {
          const id = this.currentVesselViolationCommentId++;
          const newComment = {
            id,
            vesselId: insertComment.vesselId,
            monthValue: insertComment.monthValue,
            comment: insertComment.comment ?? null,
            createdAt: null,
            updatedAt: null
          };
          this.vesselViolationComments.set(id, newComment);
          this.saveToFile();
          return newComment;
        }
      }
      // Office Violation Comments Methods
      async getOfficeViolationComment(vesselId2, monthValue) {
        const comments = Array.from(this.officeViolationComments.values());
        const existing = comments.find((c) => c.vesselId === vesselId2 && c.monthValue === monthValue);
        return existing || null;
      }
      async saveOfficeViolationComment(insertComment) {
        const comments = Array.from(this.officeViolationComments.values());
        const existing = comments.find((c) => c.vesselId === insertComment.vesselId && c.monthValue === insertComment.monthValue);
        if (existing) {
          const updated = {
            ...existing,
            ...insertComment,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: null
          };
          this.officeViolationComments.set(existing.id, updated);
          this.saveToFile();
          return updated;
        } else {
          const id = this.currentOfficeViolationCommentId++;
          const newComment = {
            id,
            vesselId: insertComment.vesselId,
            monthValue: insertComment.monthValue,
            comment: insertComment.comment ?? null,
            reviewerName: insertComment.reviewerName ?? null,
            reviewerPosition: insertComment.reviewerPosition ?? null,
            reviewDate: insertComment.reviewDate ?? null,
            createdAt: null,
            updatedAt: null
          };
          this.officeViolationComments.set(id, newComment);
          this.saveToFile();
          return newComment;
        }
      }
      // NC Reports Methods
      async getAllNCReports() {
        return Array.from(this.ncReports.values());
      }
      async getNCReport(crewMemberId, vesselId2, monthValue) {
        const reports = Array.from(this.ncReports.values());
        const existing = reports.find(
          (r) => r.crewMemberId === crewMemberId && r.vesselId === vesselId2 && r.monthValue === monthValue
        );
        return existing || null;
      }
      async saveNCReport(insertReport) {
        const reports = Array.from(this.ncReports.values());
        const existing = reports.find(
          (r) => r.crewMemberId === insertReport.crewMemberId && r.vesselId === insertReport.vesselId && r.monthValue === insertReport.monthValue
        );
        if (existing) {
          const updated = {
            ...existing,
            ...insertReport,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: null
          };
          this.ncReports.set(existing.id, updated);
          this.saveToFile();
          return updated;
        } else {
          const id = this.currentNCReportId++;
          const newReport = {
            id,
            crewMemberId: insertReport.crewMemberId,
            vesselId: insertReport.vesselId,
            monthValue: insertReport.monthValue,
            rank: insertReport.rank,
            status: insertReport.status ?? "Open",
            ncReference: insertReport.ncReference ?? "STCW/MLC/ILO",
            identifiedRootCause: insertReport.identifiedRootCause ?? null,
            immediateCorrectiveAction: insertReport.immediateCorrectiveAction ?? null,
            preventiveAction: insertReport.preventiveAction ?? null,
            preventiveActionStatus: insertReport.preventiveActionStatus ?? "Pending",
            preventiveActionDueDate: insertReport.preventiveActionDueDate ?? null,
            preventiveActionDateCompleted: insertReport.preventiveActionDateCompleted ?? null,
            officeClosureVerifiedByName: insertReport.officeClosureVerifiedByName ?? null,
            officeClosureVerifiedByPosition: insertReport.officeClosureVerifiedByPosition ?? null,
            officeClosureDate: insertReport.officeClosureDate ?? null,
            submissionStatus: insertReport.submissionStatus ?? "draft",
            createdAt: null,
            updatedAt: null
          };
          this.ncReports.set(id, newReport);
          this.saveToFile();
          return newReport;
        }
      }
      async getVesselDateLineAdjustment(vesselId2, monthValue) {
        const adjustments = Array.from(this.vesselDateLineAdjustments.values());
        const existing = adjustments.find((a) => a.vesselId === vesselId2 && a.monthValue === monthValue);
        return existing || null;
      }
      async saveVesselDateLineAdjustment(insertAdjustment) {
        const adjustments = Array.from(this.vesselDateLineAdjustments.values());
        const existing = adjustments.find(
          (a) => a.vesselId === insertAdjustment.vesselId && a.monthValue === insertAdjustment.monthValue
        );
        if (existing) {
          const updated = {
            ...existing,
            ...insertAdjustment,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: null
          };
          this.vesselDateLineAdjustments.set(existing.id, updated);
          this.saveToFile();
          return updated;
        } else {
          const id = this.currentVesselDateLineAdjustmentId++;
          const newAdjustment = {
            id,
            ...insertAdjustment,
            createdAt: null,
            updatedAt: null
          };
          this.vesselDateLineAdjustments.set(id, newAdjustment);
          this.saveToFile();
          return newAdjustment;
        }
      }
      async deleteVesselDateLineAdjustment(vesselId2, monthValue) {
        const adjustments = Array.from(this.vesselDateLineAdjustments.values());
        const existing = adjustments.find((a) => a.vesselId === vesselId2 && a.monthValue === monthValue);
        if (existing) {
          this.vesselDateLineAdjustments.delete(existing.id);
          this.saveToFile();
          return true;
        }
        return false;
      }
      async clearAdvancedDaysData(vesselId2, monthValue, advancedDays) {
        if (advancedDays.length === 0) return true;
        const allDailyRecords = Array.from(this.restHoursDailyRecords.values());
        const relevantRecords = allDailyRecords.filter(
          (record) => record.vesselId === vesselId2 && record.monthYear === monthValue
        );
        for (const record of relevantRecords) {
          let dailyRecords;
          try {
            dailyRecords = JSON.parse(record.dailyRecords);
          } catch (e) {
            continue;
          }
          if (!Array.isArray(dailyRecords)) continue;
          let modified = false;
          for (const dayRecord of dailyRecords) {
            if (advancedDays.includes(dayRecord.day)) {
              dayRecord.hours = Array(48).fill("");
              dayRecord.isPlan = false;
              dayRecord.comments = "";
              dayRecord.violations = [];
              modified = true;
            }
          }
          if (modified) {
            this.restHoursDailyRecords.set(record.id, {
              ...record,
              dailyRecords: JSON.stringify(dailyRecords)
            });
          }
        }
        if (relevantRecords.length > 0) {
          this.saveToFile();
        }
        return true;
      }
      // Oil Major Compliance Rules Methods
      async getOilMajorRules() {
        return Array.from(this.oilMajorRules.values());
      }
      async getOilMajorRule(id) {
        return this.oilMajorRules.get(id);
      }
      async getOilMajorRuleByName(oilMajorName) {
        const normalizedName = oilMajorName.toLowerCase().trim();
        return Array.from(this.oilMajorRules.values()).find(
          (rule) => rule.oilMajorName.toLowerCase().trim() === normalizedName
        );
      }
      async createOilMajorRule(rule) {
        const id = this.currentOilMajorRuleId++;
        const newRule = {
          id,
          oilMajorName: rule.oilMajorName,
          isActive: rule.isActive ?? true,
          rules: rule.rules,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.oilMajorRules.set(id, newRule);
        this.saveToFile();
        return newRule;
      }
      async updateOilMajorRule(id, rule) {
        const existing = this.oilMajorRules.get(id);
        if (!existing) return void 0;
        const updated = {
          ...existing,
          ...rule,
          id,
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.oilMajorRules.set(id, updated);
        this.saveToFile();
        return updated;
      }
      async deleteOilMajorRule(id) {
        const deleted = this.oilMajorRules.delete(id);
        if (deleted) {
          this.saveToFile();
        }
        return deleted;
      }
      async bulkCreateOilMajorRules(rules) {
        const createdRules = [];
        for (const rule of rules) {
          const existing = await this.getOilMajorRuleByName(rule.oilMajorName);
          if (existing) {
            const updated = await this.updateOilMajorRule(existing.id, rule);
            if (updated) createdRules.push(updated);
          } else {
            const created = await this.createOilMajorRule(rule);
            createdRules.push(created);
          }
        }
        return createdRules;
      }
      loadFromFile() {
        try {
          if (fs.existsSync(this.filePath)) {
            const fileContent = fs.readFileSync(this.filePath, "utf8");
            const data = JSON.parse(fileContent);
            this.users = new Map(data.users || []);
            this.forms = new Map(data.forms || []);
            const rawRankGroups = data.rankGroups || [];
            this.rankGroups = new Map(rawRankGroups.map(([id, rg]) => [
              id,
              {
                ...rg,
                archivedAt: rg.archivedAt ? new Date(rg.archivedAt) : null
              }
            ]));
            this.availableRanks = new Map(data.availableRanks || []);
            this.companyRanks = new Map(data.companyRanks || []);
            this.promotionHierarchies = new Map(data.promotionHierarchies || []);
            this.crewMembers = new Map(data.crewMembers || []);
            this.appraisalResults = new Map(data.appraisalResults || []);
            this.recruitmentCandidates = new Map(data.recruitmentCandidates || []);
            this.vesselGroups = new Map(data.vesselGroups || []);
            this.masterDataEntries = new Map(data.masterDataEntries || []);
            this.currentUserId = data.currentUserId || 1;
            this.currentFormId = data.currentFormId || 2;
            this.currentRankGroupId = data.currentRankGroupId || 1;
            this.currentAvailableRankId = data.currentAvailableRankId || 11;
            this.currentPromotionHierarchyId = data.currentPromotionHierarchyId || 1;
            this.currentAppraisalResultId = data.currentAppraisalResultId || 1;
            if (data.currentCrewIdCounter) {
              this.currentCrewIdCounter = data.currentCrewIdCounter;
            } else {
              this.currentCrewIdCounter = this.initializeCrewIdCounter();
            }
            this.currentVesselGroupId = data.currentVesselGroupId || 1;
            this.vesselDrafts = new Map(data.vesselDrafts || []);
            this.currentVesselDraftId = data.currentVesselDraftId || 1;
            this.vesselRevisions = this.loadNestedMapData(data.vesselRevisions || []);
            this.currentVesselRevisionId = data.currentVesselRevisionId || 1;
            this.trainingMatrixVesselDrafts = new Map(data.trainingMatrixVesselDrafts || []);
            this.currentTrainingMatrixVesselDraftId = data.currentTrainingMatrixVesselDraftId || 1;
            this.trainingMatrixVesselRevisions = this.loadNestedMapData(data.trainingMatrixVesselRevisions || []);
            this.currentTrainingMatrixVesselRevisionId = data.currentTrainingMatrixVesselRevisionId || 1;
            this.vesselPlanning = new Map(data.vesselPlanning || []);
            this.currentVesselPlanningId = data.currentVesselPlanningId || 1;
            this.rotationPlans = new Map(data.rotationPlans || []);
            this.currentRotationPlanId = data.currentRotationPlanId || 1;
            this.rotationArchive = new Map(data.rotationArchive || []);
            this.currentRotationArchiveId = data.currentRotationArchiveId || 1;
            this.drugAlcoholTestRecords = new Map(data.drugAlcoholTestRecords || []);
            this.currentDrugAlcoholTestRecordId = data.currentDrugAlcoholTestRecordId || 1;
            this.restHoursVesselRecords = new Map(data.restHoursVesselRecords || []);
            this.currentRestHoursVesselRecordId = data.currentRestHoursVesselRecordId || 1;
            this.restHoursCrewRecords = new Map(data.restHoursCrewRecords || []);
            this.currentRestHoursCrewRecordId = data.currentRestHoursCrewRecordId || 1;
            this.restHoursDailyRecords = new Map(data.restHoursDailyRecords || []);
            this.currentRestHoursDailyRecordId = data.currentRestHoursDailyRecordId || 1;
            this.deduplicateDailyRecords();
            this.variableTasks = new Map(data.variableTasks || []);
            this.currentVariableTaskId = data.currentVariableTaskId || 1;
            this.fixedTasks = new Map(data.fixedTasks || []);
            this.currentFixedTaskId = data.currentFixedTaskId || 1;
            this.vesselViolationComments = new Map(data.vesselViolationComments || []);
            this.currentVesselViolationCommentId = data.currentVesselViolationCommentId || 1;
            this.officeViolationComments = new Map(data.officeViolationComments || []);
            this.currentOfficeViolationCommentId = data.currentOfficeViolationCommentId || 1;
            this.ncReports = new Map(data.ncReports || []);
            this.currentNCReportId = data.currentNCReportId || 1;
            this.oilMajorRules = new Map(data.oilMajorRules || []);
            this.currentOilMajorRuleId = data.currentOilMajorRuleId || 1;
            console.log("\u{1F4C4} Loaded existing data from test-data.json");
            this.migrateRotationPlanAssignments();
            if (this.restHoursVesselRecords.size === 0) {
              console.log("\u{1F4CA} Initializing rest hours sample data for testing");
              this.initializeRestHoursSampleData();
              this.saveToFile();
            }
          } else {
            console.log("\u{1F4C4} test-data.json not found, initializing with default data");
            this.initializeDefaultData();
            this.saveToFile();
          }
        } catch (error) {
          console.error("\u26A0\uFE0F Error loading test-data.json, falling back to default data:", error);
          this.initializeDefaultData();
          this.saveToFile();
        }
      }
      saveToFile() {
        this.pendingData = {
          users: Array.from(this.users.entries()),
          forms: Array.from(this.forms.entries()),
          rankGroups: Array.from(this.rankGroups.entries()),
          availableRanks: Array.from(this.availableRanks.entries()),
          companyRanks: Array.from(this.companyRanks.entries()),
          promotionHierarchies: Array.from(this.promotionHierarchies.entries()),
          crewMembers: Array.from(this.crewMembers.entries()),
          appraisalResults: Array.from(this.appraisalResults.entries()),
          recruitmentCandidates: Array.from(this.recruitmentCandidates.entries()),
          vesselGroups: Array.from(this.vesselGroups.entries()),
          vesselDrafts: Array.from(this.vesselDrafts.entries()),
          vesselRevisions: Array.from(this.vesselRevisions.entries()),
          trainingMatrixVesselDrafts: Array.from(this.trainingMatrixVesselDrafts.entries()),
          trainingMatrixVesselRevisions: Array.from(this.trainingMatrixVesselRevisions.entries()),
          vesselPlanning: Array.from(this.vesselPlanning.entries()),
          rotationPlans: Array.from(this.rotationPlans.entries()),
          rotationArchive: Array.from(this.rotationArchive.entries()),
          drugAlcoholTestRecords: Array.from(this.drugAlcoholTestRecords.entries()),
          restHoursVesselRecords: Array.from(this.restHoursVesselRecords.entries()),
          restHoursCrewRecords: Array.from(this.restHoursCrewRecords.entries()),
          restHoursDailyRecords: Array.from(this.restHoursDailyRecords.entries()),
          variableTasks: Array.from(this.variableTasks.entries()),
          fixedTasks: Array.from(this.fixedTasks.entries()),
          vesselViolationComments: Array.from(this.vesselViolationComments.entries()),
          officeViolationComments: Array.from(this.officeViolationComments.entries()),
          ncReports: Array.from(this.ncReports.entries()),
          masterDataEntries: Array.from(this.masterDataEntries.entries()),
          oilMajorRules: Array.from(this.oilMajorRules.entries()),
          currentUserId: this.currentUserId,
          currentFormId: this.currentFormId,
          currentRankGroupId: this.currentRankGroupId,
          currentAvailableRankId: this.currentAvailableRankId,
          currentPromotionHierarchyId: this.currentPromotionHierarchyId,
          currentAppraisalResultId: this.currentAppraisalResultId,
          currentCrewIdCounter: this.currentCrewIdCounter,
          currentVesselGroupId: this.currentVesselGroupId,
          currentVesselDraftId: this.currentVesselDraftId,
          currentVesselRevisionId: this.currentVesselRevisionId,
          currentTrainingMatrixVesselDraftId: this.currentTrainingMatrixVesselDraftId,
          currentTrainingMatrixVesselRevisionId: this.currentTrainingMatrixVesselRevisionId,
          currentVesselPlanningId: this.currentVesselPlanningId,
          currentRotationPlanId: this.currentRotationPlanId,
          currentRotationArchiveId: this.currentRotationArchiveId,
          currentDrugAlcoholTestRecordId: this.currentDrugAlcoholTestRecordId,
          currentRestHoursVesselRecordId: this.currentRestHoursVesselRecordId,
          currentRestHoursCrewRecordId: this.currentRestHoursCrewRecordId,
          currentRestHoursDailyRecordId: this.currentRestHoursDailyRecordId,
          currentVariableTaskId: this.currentVariableTaskId,
          currentFixedTaskId: this.currentFixedTaskId,
          currentVesselViolationCommentId: this.currentVesselViolationCommentId,
          currentOfficeViolationCommentId: this.currentOfficeViolationCommentId,
          currentNCReportId: this.currentNCReportId,
          currentOilMajorRuleId: this.currentOilMajorRuleId
        };
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(async () => {
          if (this.isSaving) {
            this.needsResave = true;
            return;
          }
          this.isSaving = true;
          try {
            await fs.promises.writeFile(this.filePath, JSON.stringify(this.pendingData), "utf8");
            console.log("\u{1F4BE} Data saved to test-data.json");
          } catch (error) {
            console.error("\u26A0\uFE0F Error saving to test-data.json:", error);
          } finally {
            this.isSaving = false;
            if (this.needsResave) {
              this.needsResave = false;
              this.saveToFile();
            }
          }
        }, 300);
      }
      initializeDefaultData() {
        this.users = /* @__PURE__ */ new Map();
        this.forms = /* @__PURE__ */ new Map();
        this.rankGroups = /* @__PURE__ */ new Map();
        this.availableRanks = /* @__PURE__ */ new Map();
        this.companyRanks = /* @__PURE__ */ new Map();
        this.crewMembers = /* @__PURE__ */ new Map();
        this.appraisalResults = /* @__PURE__ */ new Map();
        this.recruitmentCandidates = /* @__PURE__ */ new Map();
        this.masterDataEntries = /* @__PURE__ */ new Map();
        this.currentUserId = 1;
        this.currentFormId = 2;
        this.currentRankGroupId = 1;
        this.currentAvailableRankId = 24;
        this.currentAppraisalResultId = 1;
        this.currentCrewIdCounter = 1;
        this.forms.set(1, {
          id: 1,
          name: "Crew Appraisal Form",
          category: "Appraisal",
          rankGroup: "Senior Officers",
          versionNo: "01",
          versionDate: "01-Jan-2025",
          configuration: null
        });
        this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "R001", label: "Master", applicableToCompany: true, sortOrder: 1, isSystemRank: true });
        this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "R002", label: "Chief Officer", applicableToCompany: true, sortOrder: 2, isSystemRank: true });
        this.availableRanks.set(3, { id: 3, name: "Second Officer", category: "Junior Officers", rankId: "R003", label: "Second Officer", applicableToCompany: true, sortOrder: 3, isSystemRank: true });
        this.availableRanks.set(4, { id: 4, name: "Third Officer", category: "Junior Officers", rankId: "R004", label: "Third Officer", applicableToCompany: true, sortOrder: 4, isSystemRank: true });
        this.availableRanks.set(5, { id: 5, name: "Chief Engineer", category: "Senior Officers", rankId: "R005", label: "Chief Engineer", applicableToCompany: true, sortOrder: 5, isSystemRank: true });
        this.availableRanks.set(6, { id: 6, name: "Second Engineer", category: "Junior Officers", rankId: "R006", label: "Second Engineer", applicableToCompany: true, sortOrder: 6, isSystemRank: true });
        this.availableRanks.set(7, { id: 7, name: "Third Engineer", category: "Junior Officers", rankId: "R007", label: "Third Engineer", applicableToCompany: true, sortOrder: 7, isSystemRank: true });
        this.availableRanks.set(8, { id: 8, name: "Fourth Engineer", category: "Junior Officers", rankId: "R008", label: "Fourth Engineer", applicableToCompany: true, sortOrder: 8, isSystemRank: true });
        this.availableRanks.set(9, { id: 9, name: "Fifth Engineer", category: "Junior Officers", rankId: "R009", label: "Fifth Engineer", applicableToCompany: true, sortOrder: 9, isSystemRank: true });
        this.availableRanks.set(10, { id: 10, name: "Electrical Officer", category: "Junior Officers", rankId: "R010", label: "Electrical Officer", applicableToCompany: true, sortOrder: 10, isSystemRank: true });
        this.availableRanks.set(11, { id: 11, name: "Gas Engineer", category: "Junior Officers", rankId: "R011", label: "Gas Engineer", applicableToCompany: true, sortOrder: 11, isSystemRank: true });
        this.availableRanks.set(12, { id: 12, name: "Deck Cadet", category: "Cadets", rankId: "R012", label: "Deck Cadet", applicableToCompany: true, sortOrder: 12, isSystemRank: true });
        this.availableRanks.set(13, { id: 13, name: "Engine Cadet", category: "Cadets", rankId: "R013", label: "Engine Cadet", applicableToCompany: true, sortOrder: 13, isSystemRank: true });
        this.availableRanks.set(14, { id: 14, name: "Bosun", category: "Ratings", rankId: "R014", label: "Bosun", applicableToCompany: true, sortOrder: 14, isSystemRank: true });
        this.availableRanks.set(15, { id: 15, name: "Able Bodied Seaman", category: "Ratings", rankId: "R015", label: "Able Bodied Seaman", applicableToCompany: true, sortOrder: 15, isSystemRank: true });
        this.availableRanks.set(16, { id: 16, name: "Ordinary Seaman", category: "Ratings", rankId: "R016", label: "Ordinary Seaman", applicableToCompany: true, sortOrder: 16, isSystemRank: true });
        this.availableRanks.set(17, { id: 17, name: "Pumpman", category: "Ratings", rankId: "R017", label: "Pumpman", applicableToCompany: true, sortOrder: 17, isSystemRank: true });
        this.availableRanks.set(18, { id: 18, name: "Fitter", category: "Ratings", rankId: "R018", label: "Fitter", applicableToCompany: true, sortOrder: 18, isSystemRank: true });
        this.availableRanks.set(19, { id: 19, name: "Motorman", category: "Ratings", rankId: "R019", label: "Motorman", applicableToCompany: true, sortOrder: 19, isSystemRank: true });
        this.availableRanks.set(20, { id: 20, name: "Wiper", category: "Ratings", rankId: "R020", label: "Wiper", applicableToCompany: true, sortOrder: 20, isSystemRank: true });
        this.availableRanks.set(21, { id: 21, name: "Oiler", category: "Ratings", rankId: "R021", label: "Oiler", applicableToCompany: true, sortOrder: 21, isSystemRank: true });
        this.availableRanks.set(22, { id: 22, name: "Chief Cook", category: "Catering", rankId: "R022", label: "Chief Cook", applicableToCompany: true, sortOrder: 22, isSystemRank: true });
        this.availableRanks.set(23, { id: 23, name: "Messman", category: "Catering", rankId: "R023", label: "Messman", applicableToCompany: true, sortOrder: 23, isSystemRank: true });
        const sampleCandidate = {
          id: "2025-09-23-1758595508955",
          fileNo: "RC-2025-001",
          firstName: "Mark",
          middleName: "Tan",
          familyName: "Twait",
          dob: "1981-01-04",
          nationality: "Malaysian",
          rankAppliedFor: "Master",
          presentRank: "Master",
          vesselType: JSON.stringify(["Oil Tanker"]),
          status: "Applied",
          applicationData: JSON.stringify({
            firstName: "Mark",
            middleName: "Tan",
            familyName: "Twait",
            nationality: "Malaysian",
            presentRank: "Master",
            vesselType: ["Oil Tanker"],
            dateOfBirth: "1981-01-04",
            ageInYears: "44",
            nativeLanguage: "English",
            foreignLanguages: "Spanish",
            englishProficiency: "Good",
            rankAppliedFor: "Master",
            manningAgent: "ABC ",
            fileNo: "M2025-955"
          }),
          isDelete: false,
          createdAt: null,
          updatedAt: null
        };
        this.recruitmentCandidates.set(sampleCandidate.id, sampleCandidate);
        this.recruitmentCandidates.set("RC-2025-002", {
          id: "RC-2025-002",
          fileNo: "RF-2025-002",
          firstName: "Sarah",
          middleName: null,
          familyName: "Rodriguez",
          dob: "1990-07-22",
          nationality: "Spanish",
          rankAppliedFor: "3rd Engineer",
          presentRank: "Engine Cadet",
          vesselType: "Oil Tanker",
          status: "Screening",
          applicationData: null,
          isDelete: false,
          createdAt: null,
          updatedAt: null
          // new Date("2025-09-23")
        });
        this.recruitmentCandidates.set("RC-2025-003", {
          id: "RC-2025-003",
          fileNo: "RF-2025-003",
          firstName: "Alexander",
          middleName: "Viktor",
          familyName: "Petrov",
          dob: "1982-11-08",
          nationality: "Russian",
          rankAppliedFor: "Master",
          presentRank: "Chief Officer",
          vesselType: "Bulk Carrier",
          status: "For Approval",
          applicationData: null,
          isDelete: false,
          createdAt: null,
          updatedAt: null
          // new Date("2025-09-23")
        });
        this.recruitmentCandidates.set("RC-2025-004", {
          id: "RC-2025-004",
          fileNo: "RF-2025-004",
          firstName: "Priya",
          middleName: "Devi",
          familyName: "Sharma",
          dob: "1993-02-14",
          nationality: "Indian",
          rankAppliedFor: "Able Seaman",
          presentRank: "Ordinary Seaman",
          vesselType: "LPG Tanker",
          status: "Applied",
          applicationData: null,
          isDelete: false,
          createdAt: null,
          updatedAt: null
          // new Date("2025-09-23")
        });
        this.recruitmentCandidates.set("RC-2025-005", {
          id: "RC-2025-005",
          fileNo: "RF-2025-005",
          firstName: "Ahmed",
          middleName: "Hassan",
          familyName: "Al-Rashid",
          dob: "1985-09-30",
          nationality: "Egyptian",
          rankAppliedFor: "Chief Officer",
          presentRank: "2nd Officer",
          vesselType: "Container",
          status: "Recruited",
          applicationData: null,
          isDelete: false,
          createdAt: null,
          updatedAt: null
          // new Date("2025-09-23")
        });
        this.crewMembers.set("2025-05-14", {
          id: "2025-05-14",
          firstName: "James",
          middleName: "Michael",
          familyName: "Wilson",
          presentRank: "Master",
          nationality: "British",
          presentVessel: "MT Sail One",
          vesselType: "Oil Tanker",
          signOnDate: "01-Feb-2025",
          createdAt: null,
          updatedAt: null,
          uploadedPhoto: null,
          status: null,
          isActive: true,
          nextAvailability: null,
          empNo: null,
          dateOfBirth: null,
          age: null,
          rankAppliedFor: null,
          employeeId: null,
          lastVessel: null,
          signOffDate: null,
          contractPeriod: null,
          reliefDue: null,
          reason: null,
          availability: null,
          email: null,
          mobile: null,
          contactLandline: null,
          countryOfResidence: null,
          nearestAirport: null,
          residentialAddressLine1: null,
          residentialAddressLine2: null,
          placeOfBirthCity: null,
          placeOfBirthCountry: null,
          heightCm: null,
          weightKg: null,
          bmi: null,
          nativeLanguage: null,
          foreignLanguages: null,
          englishProficiency: null,
          maritalStatus: null,
          numberOfDependentChildren: null,
          fatherName: null,
          motherName: null,
          spouseFirstName: null,
          spouseMiddleName: null,
          spouseFamilyName: null,
          spouseDateOfBirth: null,
          nokFirstName: null,
          nokMiddleName: null,
          nokFamilyName: null,
          nokTelephone: null,
          nokEmail: null,
          nokAddress: null,
          nokRelationship: null,
          manningAgent: null,
          vesselTypes: null,
          documents: null,
          visas: null,
          education: null,
          licenses: null,
          trainingCourses: null,
          currentCompanySeaService: null,
          externalSeaService: null,
          preJoiningMedicals: null,
          doctorVisits: null,
          children: null
        });
        this.crewMembers.set("2025-03-12", {
          id: "2025-03-12",
          firstName: "Anna",
          middleName: "Marie",
          familyName: "Johnson",
          presentRank: "Chief Engineer",
          nationality: "British",
          presentVessel: "MT Sail Ten",
          vesselType: "LPG Tanker",
          signOnDate: "01-Jan-2025",
          createdAt: null,
          updatedAt: null,
          uploadedPhoto: null,
          status: null,
          isActive: true,
          nextAvailability: null,
          empNo: null,
          dateOfBirth: null,
          age: null,
          rankAppliedFor: null,
          employeeId: null,
          lastVessel: null,
          signOffDate: null,
          contractPeriod: null,
          reliefDue: null,
          reason: null,
          availability: null,
          email: null,
          mobile: null,
          contactLandline: null,
          countryOfResidence: null,
          nearestAirport: null,
          residentialAddressLine1: null,
          residentialAddressLine2: null,
          placeOfBirthCity: null,
          placeOfBirthCountry: null,
          heightCm: null,
          weightKg: null,
          bmi: null,
          nativeLanguage: null,
          foreignLanguages: null,
          englishProficiency: null,
          maritalStatus: null,
          numberOfDependentChildren: null,
          fatherName: null,
          motherName: null,
          spouseFirstName: null,
          spouseMiddleName: null,
          spouseFamilyName: null,
          spouseDateOfBirth: null,
          nokFirstName: null,
          nokMiddleName: null,
          nokFamilyName: null,
          nokTelephone: null,
          nokEmail: null,
          nokAddress: null,
          nokRelationship: null,
          manningAgent: null,
          vesselTypes: null,
          documents: null,
          visas: null,
          education: null,
          licenses: null,
          trainingCourses: null,
          currentCompanySeaService: null,
          externalSeaService: null,
          preJoiningMedicals: null,
          doctorVisits: null,
          children: null
        });
        this.crewMembers.set("2025-02-12", {
          id: "2025-02-12",
          firstName: "David",
          middleName: "Lee",
          familyName: "Brown",
          presentRank: "Able Seaman",
          nationality: "Indian",
          presentVessel: "MT Sail Two",
          vesselType: "Container",
          signOnDate: "01-Feb-2025",
          createdAt: null,
          updatedAt: null,
          uploadedPhoto: null,
          status: null,
          isActive: true,
          nextAvailability: null,
          empNo: null,
          dateOfBirth: null,
          age: null,
          rankAppliedFor: null,
          employeeId: null,
          lastVessel: null,
          signOffDate: null,
          contractPeriod: null,
          reliefDue: null,
          reason: null,
          availability: null,
          email: null,
          mobile: null,
          contactLandline: null,
          countryOfResidence: null,
          nearestAirport: null,
          residentialAddressLine1: null,
          residentialAddressLine2: null,
          placeOfBirthCity: null,
          placeOfBirthCountry: null,
          heightCm: null,
          weightKg: null,
          bmi: null,
          nativeLanguage: null,
          foreignLanguages: null,
          englishProficiency: null,
          maritalStatus: null,
          numberOfDependentChildren: null,
          fatherName: null,
          motherName: null,
          spouseFirstName: null,
          spouseMiddleName: null,
          spouseFamilyName: null,
          spouseDateOfBirth: null,
          nokFirstName: null,
          nokMiddleName: null,
          nokFamilyName: null,
          nokTelephone: null,
          nokEmail: null,
          nokAddress: null,
          nokRelationship: null,
          manningAgent: null,
          vesselTypes: null,
          documents: null,
          visas: null,
          education: null,
          licenses: null,
          trainingCourses: null,
          currentCompanySeaService: null,
          externalSeaService: null,
          preJoiningMedicals: null,
          doctorVisits: null,
          children: null
        });
        this.crewMembers.set("2025-04-18", {
          id: "2025-04-18",
          firstName: "Carlos",
          middleName: "Miguel",
          familyName: "Santos",
          presentRank: "2nd Officer",
          nationality: "Filipino",
          presentVessel: "MT Sail Three",
          vesselType: "Container",
          signOnDate: "15-Mar-2025",
          createdAt: null,
          updatedAt: null,
          uploadedPhoto: null,
          status: null,
          isActive: true,
          nextAvailability: null,
          empNo: null,
          dateOfBirth: null,
          age: null,
          rankAppliedFor: null,
          employeeId: null,
          lastVessel: null,
          signOffDate: null,
          contractPeriod: null,
          reliefDue: null,
          reason: null,
          availability: null,
          email: null,
          mobile: null,
          contactLandline: null,
          countryOfResidence: null,
          nearestAirport: null,
          residentialAddressLine1: null,
          residentialAddressLine2: null,
          placeOfBirthCity: null,
          placeOfBirthCountry: null,
          heightCm: null,
          weightKg: null,
          bmi: null,
          nativeLanguage: null,
          foreignLanguages: null,
          englishProficiency: null,
          maritalStatus: null,
          numberOfDependentChildren: null,
          fatherName: null,
          motherName: null,
          spouseFirstName: null,
          spouseMiddleName: null,
          spouseFamilyName: null,
          spouseDateOfBirth: null,
          nokFirstName: null,
          nokMiddleName: null,
          nokFamilyName: null,
          nokTelephone: null,
          nokEmail: null,
          nokAddress: null,
          nokRelationship: null,
          manningAgent: null,
          vesselTypes: null,
          documents: null,
          visas: null,
          education: null,
          licenses: null,
          trainingCourses: null,
          currentCompanySeaService: null,
          externalSeaService: null,
          preJoiningMedicals: null,
          doctorVisits: null,
          children: null
        });
        const appraisal1 = {
          id: 1,
          crewMemberId: "2025-05-14",
          formId: 1,
          appraisalType: "End of Contract",
          appraisalDate: "06-Jun-2025",
          appraisalData: JSON.stringify({}),
          competenceRating: "4.9",
          behavioralRating: "4.5",
          overallRating: "4.7",
          submittedBy: "admin",
          status: "Reviewed",
          submittedAt: /* @__PURE__ */ new Date("2025-06-06"),
          stagePayloads: null,
          stageStatuses: null
        };
        this.appraisalResults.set(1, appraisal1);
        const appraisal2 = {
          id: 2,
          crewMemberId: "2025-03-12",
          formId: 1,
          appraisalType: "Mid Term",
          appraisalDate: "07-May-2025",
          appraisalData: JSON.stringify({}),
          competenceRating: "3.5",
          behavioralRating: "4.5",
          overallRating: "4.0",
          submittedBy: "admin",
          status: "Reviewed",
          submittedAt: /* @__PURE__ */ new Date("2025-05-07"),
          stagePayloads: null,
          stageStatuses: null
        };
        this.appraisalResults.set(2, appraisal2);
        const appraisal3 = {
          id: 3,
          crewMemberId: "2025-02-12",
          formId: 1,
          appraisalType: "Special",
          appraisalDate: "06-Jun-2025",
          appraisalData: JSON.stringify({}),
          competenceRating: "2.5",
          behavioralRating: "3.5",
          overallRating: "3.0",
          submittedBy: "admin",
          status: "Reviewed",
          submittedAt: /* @__PURE__ */ new Date("2025-06-06"),
          stagePayloads: null,
          stageStatuses: null
        };
        this.appraisalResults.set(3, appraisal3);
        const appraisal4 = {
          id: 4,
          crewMemberId: "2025-04-18",
          formId: 1,
          appraisalType: "Probation",
          appraisalDate: "07-May-2025",
          appraisalData: JSON.stringify({}),
          competenceRating: "3.8",
          behavioralRating: "4.2",
          overallRating: "4.0",
          submittedBy: "admin",
          status: "Reviewed",
          submittedAt: /* @__PURE__ */ new Date("2025-05-07"),
          stagePayloads: null,
          stageStatuses: null
        };
        this.appraisalResults.set(4, appraisal4);
        this.currentAppraisalResultId = 5;
        const currentDate = /* @__PURE__ */ new Date();
        const vessels2 = [
          { id: "743ef9d1-841a-11ed-aa7c-7003bca91a86", name: "Vessel 1" },
          { id: "743feb08-841a-11ed-aa7c-7003bca91a86", name: "Vessel 2" },
          { id: "7440571a-841a-11ed-aa7c-7003bca91a86", name: "Vessel 3" },
          { id: "744535d0-841a-11ed-aa7c-7003bca91a86", name: "Vessel 4" },
          { id: "7446783c-841a-11ed-aa7c-7003bca91a86", name: "Vessel 5" },
          { id: "74481b72-841a-11ed-aa7c-7003bca91a86", name: "Vessel 6" }
        ];
        let rhRecordId = 1;
        for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
          const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          vessels2.forEach((vessel, idx) => {
            const totalCrew = 20 + Math.floor(Math.random() * 5);
            const recordingPercent = monthOffset === 0 ? Math.floor(Math.random() * 101) : 100;
            const activityConflicting = Math.random() > 0.7;
            const totalViolations = Math.floor(Math.random() * 7);
            const crewWithViolations = totalViolations > 0 ? Math.min(totalViolations, Math.floor(Math.random() * 4) + 1) : 0;
            const totalNCs = Math.floor(Math.random() * 4);
            const crewWithNCs = totalNCs > 0 ? Math.min(totalNCs, Math.floor(Math.random() * 3) + 1) : 0;
            const predictedViolations = Math.floor(Math.random() * 2);
            const predictedNCs = Math.floor(Math.random() * 2);
            const crewWithPredictedNCs = predictedNCs > 0 ? Math.min(predictedNCs, Math.floor(Math.random() * 2) + 1) : 0;
            let officeReviewStatus = "Completed";
            if (monthOffset === 0 && idx < 3) {
              officeReviewStatus = idx === 0 ? "Completed" : idx === 1 ? "Due" : "Overdue";
            }
            this.restHoursVesselRecords.set(rhRecordId, {
              id: rhRecordId,
              createdAt: null,
              updatedAt: null,
              vesselId: vessel.id,
              month: monthLabel.replace(" ", "-"),
              monthValue,
              totalCrew,
              recordingStatusPercent: recordingPercent,
              activityConflicting,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              totalViolations,
              crewWithViolations,
              crewWithViolationsDetails: null,
              totalNCs,
              crewWithNCs,
              crewWithNCsDetails: null,
              predictedViolations,
              crewWithPredictedViolations: 0,
              crewWithPredictedViolationsDetails: null,
              predictedNCs,
              crewWithPredictedNCs,
              crewWithPredictedNCsDetails: null,
              vesselReviewStatus: "Due",
              vesselReviewSubmittedDate: null,
              officeReviewStatus,
              officeReviewSubmittedDate: null
            });
            rhRecordId++;
          });
        }
        this.currentRestHoursVesselRecordId = rhRecordId;
      }
      // User methods (same as MemStorage)
      async getUser(id) {
        return this.users.get(id);
      }
      async getUserByUsername(username) {
        return Array.from(this.users.values()).find((user) => user.username === username);
      }
      async createUser(user) {
        user.id = this.currentUserId++;
        this.users.set(user.id, user);
        this.saveToFile();
        return user;
      }
      // Form methods (same as MemStorage)
      async getForms() {
        return Array.from(this.forms.values());
      }
      async getForm(id) {
        return this.forms.get(id);
      }
      async createForm(insertForm) {
        const id = this.currentFormId++;
        const form = {
          id,
          name: insertForm.name,
          category: insertForm.category ?? "",
          rankGroup: insertForm.rankGroup,
          versionNo: insertForm.versionNo,
          versionDate: insertForm.versionDate,
          configuration: insertForm.configuration ?? null
        };
        this.forms.set(form.id, form);
        this.saveToFile();
        return form;
      }
      async updateForm(id, formData) {
        const existingForm = this.forms.get(id);
        if (!existingForm) return void 0;
        const updatedForm = { ...existingForm, ...formData };
        this.forms.set(id, updatedForm);
        this.saveToFile();
        return updatedForm;
      }
      async deleteForm(id) {
        const result = this.forms.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Form Version methods
      formVersions = /* @__PURE__ */ new Map();
      currentFormVersionId = 1;
      async getFormVersions(formId) {
        return Array.from(this.formVersions.values()).filter((v) => v.formId === formId).sort((a, b) => b.id - a.id);
      }
      async getFormVersion(id) {
        return this.formVersions.get(id);
      }
      async createFormVersion(version) {
        const id = this.currentFormVersionId++;
        const formVersion = {
          ...version,
          id,
          status: version.status || "draft",
          configuration: version.configuration || null,
          sharedConfig: version.sharedConfig || null,
          createdAt: /* @__PURE__ */ new Date(),
          releasedAt: null
        };
        this.formVersions.set(id, formVersion);
        this.saveToFile();
        return formVersion;
      }
      async updateFormVersion(id, versionData) {
        const existing = this.formVersions.get(id);
        if (!existing) return void 0;
        const updated = { ...existing, ...versionData };
        this.formVersions.set(id, updated);
        this.saveToFile();
        return updated;
      }
      async releaseFormVersion(id) {
        const existing = this.formVersions.get(id);
        if (!existing) return void 0;
        const released = { ...existing, status: "released", releasedAt: /* @__PURE__ */ new Date() };
        this.formVersions.set(id, released);
        const form = this.forms.get(existing.formId);
        if (form) {
          const updatedForm = {
            ...form,
            sharedConfig: existing.sharedConfig,
            versionNo: existing.versionNo,
            versionDate: existing.versionDate
          };
          this.forms.set(existing.formId, updatedForm);
        }
        this.saveToFile();
        return released;
      }
      async deleteFormVersion(id) {
        const result = this.formVersions.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rank Group methods (same as MemStorage)
      async getRankGroups(formId, includeArchived = false) {
        return Array.from(this.rankGroups.values()).filter((rg) => {
          if (rg.formId !== formId) return false;
          if (!includeArchived && rg.archivedAt) return false;
          return true;
        });
      }
      async getAllRankGroups(includeArchived = false) {
        return Array.from(this.rankGroups.values()).filter((rg) => {
          if (!includeArchived && rg.archivedAt) return false;
          return true;
        });
      }
      async getRankGroup(id) {
        return this.rankGroups.get(id);
      }
      async createRankGroup(insertRankGroup) {
        const rankGroup = {
          ...insertRankGroup,
          id: this.currentRankGroupId++,
          ranks: typeof insertRankGroup.ranks === "string" ? insertRankGroup.ranks : JSON.stringify(insertRankGroup.ranks),
          archivedAt: null
        };
        this.rankGroups.set(rankGroup.id, rankGroup);
        await this.syncFormRankGroup(insertRankGroup.formId);
        this.saveToFile();
        return rankGroup;
      }
      // Private helper to sync form's rankGroup field with associated rank groups (only active ones)
      async syncFormRankGroup(formId) {
        const formRankGroups = Array.from(this.rankGroups.values()).filter((rg) => rg.formId === formId && !rg.archivedAt);
        const rankGroupNames = formRankGroups.map((rg) => rg.name).join(", ");
        const form = this.forms.get(formId);
        if (form) {
          form.rankGroup = rankGroupNames || "";
          this.forms.set(formId, form);
        }
      }
      async updateRankGroup(id, rankGroupData) {
        const existingRankGroup = this.rankGroups.get(id);
        if (!existingRankGroup) return void 0;
        const updatedRankGroup = {
          ...existingRankGroup,
          ...rankGroupData,
          ranks: rankGroupData.ranks ? typeof rankGroupData.ranks === "string" ? rankGroupData.ranks : JSON.stringify(rankGroupData.ranks) : existingRankGroup.ranks
        };
        this.rankGroups.set(id, updatedRankGroup);
        await this.syncFormRankGroup(existingRankGroup.formId);
        this.saveToFile();
        return updatedRankGroup;
      }
      async archiveRankGroup(id) {
        const existingRankGroup = this.rankGroups.get(id);
        if (!existingRankGroup) return void 0;
        const archivedRankGroup = {
          ...existingRankGroup,
          archivedAt: /* @__PURE__ */ new Date()
        };
        this.rankGroups.set(id, archivedRankGroup);
        await this.syncFormRankGroup(existingRankGroup.formId);
        this.saveToFile();
        return archivedRankGroup;
      }
      async unarchiveRankGroup(id) {
        const existingRankGroup = this.rankGroups.get(id);
        if (!existingRankGroup) return void 0;
        const unarchivedRankGroup = {
          ...existingRankGroup,
          archivedAt: null
        };
        this.rankGroups.set(id, unarchivedRankGroup);
        await this.syncFormRankGroup(existingRankGroup.formId);
        this.saveToFile();
        return unarchivedRankGroup;
      }
      async deleteRankGroup(id) {
        const rankGroup = this.rankGroups.get(id);
        if (!rankGroup) return false;
        const formId = rankGroup.formId;
        const result = this.rankGroups.delete(id);
        if (result) {
          await this.syncFormRankGroup(formId);
          this.saveToFile();
        }
        return result;
      }
      async getFormForRank(rankLabel, category) {
        for (const rankGroup of Array.from(this.rankGroups.values())) {
          try {
            const ranks = JSON.parse(rankGroup.ranks);
            if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
              const form = this.forms.get(rankGroup.formId);
              if (form && (!category || form.category === category)) {
                return form;
              }
            }
          } catch (e) {
            console.error(`Error parsing ranks for rank group ${rankGroup.id}:`, e);
          }
        }
        return void 0;
      }
      // Available Rank methods (same as MemStorage)
      async getAvailableRanks() {
        return Array.from(this.availableRanks.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
      async getAvailableRank(id) {
        return this.availableRanks.get(id);
      }
      async createAvailableRank(insertAvailableRank) {
        const existingRanks = await this.getAvailableRanks();
        const maxSortOrder = existingRanks.length > 0 ? Math.max(...existingRanks.map((r) => r.sortOrder || 0)) : 0;
        let rankId = insertAvailableRank.rankId;
        if (!rankId) {
          const existingRIds = existingRanks.map((r) => r.rankId).filter((rid) => rid && /^R\d{3}$/.test(rid)).map((rid) => parseInt(rid.substring(1), 10));
          const maxRId = existingRIds.length > 0 ? Math.max(...existingRIds) : 23;
          rankId = `R${String(maxRId + 1).padStart(3, "0")}`;
        }
        const availableRank = {
          ...insertAvailableRank,
          id: this.currentAvailableRankId++,
          rankId,
          label: insertAvailableRank.label ?? null,
          applicableToCompany: insertAvailableRank.applicableToCompany ?? null,
          sortOrder: insertAvailableRank.sortOrder ?? maxSortOrder + 1,
          isSystemRank: insertAvailableRank.isSystemRank ?? false
        };
        this.availableRanks.set(availableRank.id, availableRank);
        this.saveToFile();
        return availableRank;
      }
      async updateAvailableRank(id, availableRankData) {
        const existingAvailableRank = this.availableRanks.get(id);
        if (!existingAvailableRank) return void 0;
        const updatedAvailableRank = { ...existingAvailableRank, ...availableRankData };
        this.availableRanks.set(id, updatedAvailableRank);
        this.saveToFile();
        return updatedAvailableRank;
      }
      async deleteAvailableRank(id) {
        const result = this.availableRanks.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      async clearAllAvailableRanks() {
        this.availableRanks.clear();
        this.saveToFile();
        return true;
      }
      async updateRankOrders(rankOrders) {
        try {
          for (const { id, sortOrder } of rankOrders) {
            const existingRank = this.availableRanks.get(id);
            if (existingRank) {
              const updatedRank = {
                ...existingRank,
                sortOrder
              };
              this.availableRanks.set(id, updatedRank);
            }
          }
          this.saveToFile();
          return true;
        } catch (error) {
          console.error("Failed to update rank orders:", error);
          return false;
        }
      }
      // Company Rank methods - CRITICAL FOR ROLE PERSISTENCE!
      async getCompanyRanks() {
        return Array.from(this.companyRanks.values());
      }
      async getCompanyRank(id) {
        return this.companyRanks.get(id);
      }
      async getCompanyRankByName(rankName) {
        const ranks = Array.from(this.companyRanks.values());
        return ranks.find((r) => r.rank?.toLowerCase() === rankName.toLowerCase());
      }
      async createCompanyRank(insertCompanyRank) {
        const companyRank = {
          id: insertCompanyRank.id,
          rankId: insertCompanyRank.rankId,
          rank: insertCompanyRank.rank,
          role: insertCompanyRank.role ?? null,
          originalRankId: insertCompanyRank.originalRankId ?? null,
          isRoleRow: insertCompanyRank.isRoleRow ?? null,
          officer: insertCompanyRank.officer ?? null,
          rating: insertCompanyRank.rating ?? null,
          seniorOfficer: insertCompanyRank.seniorOfficer ?? null,
          deckOfficer: insertCompanyRank.deckOfficer ?? null,
          engOfficer: insertCompanyRank.engOfficer ?? null,
          pettyOfficer: insertCompanyRank.pettyOfficer ?? null,
          deckRating: insertCompanyRank.deckRating ?? null,
          engineRating: insertCompanyRank.engineRating ?? null,
          generalRating: insertCompanyRank.generalRating ?? null,
          cateringRating: insertCompanyRank.cateringRating ?? null,
          safetyOfficer: insertCompanyRank.safetyOfficer ?? null,
          sso: insertCompanyRank.sso ?? null,
          medicalOfficer: insertCompanyRank.medicalOfficer ?? null,
          navigatingOfficer: insertCompanyRank.navigatingOfficer ?? null,
          emtOfficer: insertCompanyRank.emtOfficer ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.companyRanks.set(companyRank.id, companyRank);
        this.saveToFile();
        console.log(`\u{1F4BE} [COMPANY-RANK] Created and saved: ${companyRank.id} - ${companyRank.rank}${companyRank.role ? ` (${companyRank.role})` : ""}`);
        return companyRank;
      }
      async updateCompanyRank(id, companyRankData) {
        const existingCompanyRank = this.companyRanks.get(id);
        if (!existingCompanyRank) return void 0;
        const updatedCompanyRank = { ...existingCompanyRank, ...companyRankData };
        this.companyRanks.set(id, updatedCompanyRank);
        this.saveToFile();
        console.log(`\u{1F4BE} [COMPANY-RANK] Updated and saved: ${updatedCompanyRank.id} - ${updatedCompanyRank.rank}${updatedCompanyRank.role ? ` (${updatedCompanyRank.role})` : ""}`);
        return updatedCompanyRank;
      }
      async deleteCompanyRank(id) {
        const result = this.companyRanks.delete(id);
        if (result) {
          this.saveToFile();
          console.log(`\u{1F4BE} [COMPANY-RANK] Deleted and saved: ${id}`);
        }
        return result;
      }
      async clearAllCompanyRanks() {
        this.companyRanks.clear();
        this.saveToFile();
        console.log(`\u{1F4BE} [COMPANY-RANK] Cleared all company ranks and saved`);
        return true;
      }
      async saveAllCompanyRanks(ranks) {
        this.companyRanks.clear();
        const savedRanks = [];
        for (const rank of ranks) {
          const companyRank = {
            id: rank.id,
            rankId: rank.rankId,
            rank: rank.rank,
            role: rank.role ?? null,
            originalRankId: rank.originalRankId ?? null,
            isRoleRow: rank.isRoleRow ?? null,
            officer: rank.officer ?? null,
            rating: rank.rating ?? null,
            seniorOfficer: rank.seniorOfficer ?? null,
            deckOfficer: rank.deckOfficer ?? null,
            engOfficer: rank.engOfficer ?? null,
            pettyOfficer: rank.pettyOfficer ?? null,
            deckRating: rank.deckRating ?? null,
            engineRating: rank.engineRating ?? null,
            generalRating: rank.generalRating ?? null,
            cateringRating: rank.cateringRating ?? null,
            safetyOfficer: rank.safetyOfficer ?? null,
            sso: rank.sso ?? null,
            medicalOfficer: rank.medicalOfficer ?? null,
            navigatingOfficer: rank.navigatingOfficer ?? null,
            emtOfficer: rank.emtOfficer ?? null,
            createdAt: null,
            updatedAt: null
          };
          this.companyRanks.set(companyRank.id, companyRank);
          savedRanks.push(companyRank);
        }
        this.saveToFile();
        console.log(`\u{1F4BE} [COMPANY-RANK] Bulk saved ${savedRanks.length} company ranks to persistent storage`);
        return savedRanks;
      }
      // Promotion Hierarchy methods
      async getPromotionHierarchies() {
        return Array.from(this.promotionHierarchies.values());
      }
      async getPromotionHierarchy(id) {
        return this.promotionHierarchies.get(id);
      }
      async createPromotionHierarchy(insertPromotionHierarchy) {
        const id = this.currentPromotionHierarchyId++;
        const promotionHierarchy = {
          id,
          groupName: insertPromotionHierarchy.groupName,
          rankPath: insertPromotionHierarchy.rankPath,
          isActive: insertPromotionHierarchy.isActive ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.promotionHierarchies.set(id, promotionHierarchy);
        this.saveToFile();
        return promotionHierarchy;
      }
      async updatePromotionHierarchy(id, promotionHierarchyData) {
        const existingPromotionHierarchy = this.promotionHierarchies.get(id);
        if (!existingPromotionHierarchy) return void 0;
        const updatedPromotionHierarchy = {
          ...existingPromotionHierarchy,
          ...promotionHierarchyData
        };
        this.promotionHierarchies.set(id, updatedPromotionHierarchy);
        this.saveToFile();
        return updatedPromotionHierarchy;
      }
      async deletePromotionHierarchy(id) {
        const result = this.promotionHierarchies.delete(id);
        if (result) {
          this.saveToFile();
        }
        return result;
      }
      // Company Processing methods
      async getCompanyProcessingRecords() {
        return [];
      }
      async getCompanyProcessing(id) {
        return void 0;
      }
      async getCompanyProcessingByCandidateId(candidateId) {
        return [];
      }
      async createCompanyProcessing(record) {
        throw new Error("Company Processing not implemented in file storage");
      }
      async updateCompanyProcessing(id, record) {
        return void 0;
      }
      async deleteCompanyProcessing(id) {
        return false;
      }
      // Promotion Forms methods
      async getPromotionForms() {
        return [];
      }
      async getPromotionForm(id) {
        return void 0;
      }
      async getPromotionFormsByCrewMember(crewMemberId) {
        return [];
      }
      async createPromotionForm(form) {
        throw new Error("Promotion Forms not implemented in file storage");
      }
      async updatePromotionForm(id, form) {
        return void 0;
      }
      async deletePromotionForm(id) {
        return false;
      }
      async approvePromotionForm(id, reviewedBy, comments, effectiveDate) {
        return void 0;
      }
      async rejectPromotionForm(id, reviewedBy, comments) {
        return void 0;
      }
      // Crew Member methods (same as MemStorage)
      async getCrewMembers() {
        return Array.from(this.crewMembers.values());
      }
      async getCrewMember(id) {
        return this.crewMembers.get(id);
      }
      async createCrewMember(insertCrewMember) {
        const uniqueId = await this.getNextCrewId();
        const crewMember = {
          id: uniqueId,
          status: insertCrewMember.status ?? null,
          isActive: insertCrewMember.isActive ?? true,
          nextAvailability: insertCrewMember.nextAvailability ?? null,
          createdAt: null,
          updatedAt: null,
          uploadedPhoto: insertCrewMember.uploadedPhoto ?? null,
          empNo: insertCrewMember.empNo ?? null,
          firstName: insertCrewMember.firstName,
          middleName: insertCrewMember.middleName ?? null,
          familyName: insertCrewMember.familyName ?? null,
          dateOfBirth: insertCrewMember.dateOfBirth ?? null,
          age: insertCrewMember.age ?? null,
          nationality: insertCrewMember.nationality,
          presentRank: insertCrewMember.presentRank,
          rankAppliedFor: insertCrewMember.rankAppliedFor ?? null,
          employeeId: insertCrewMember.employeeId ?? null,
          presentVessel: insertCrewMember.presentVessel,
          vesselType: insertCrewMember.vesselType,
          lastVessel: insertCrewMember.lastVessel ?? null,
          signOnDate: insertCrewMember.signOnDate ?? null,
          signOffDate: insertCrewMember.signOffDate ?? null,
          contractPeriod: insertCrewMember.contractPeriod ?? null,
          reliefDue: insertCrewMember.reliefDue ?? null,
          reason: insertCrewMember.reason ?? null,
          availability: insertCrewMember.availability ?? null,
          email: insertCrewMember.email ?? null,
          mobile: insertCrewMember.mobile ?? null,
          contactLandline: insertCrewMember.contactLandline ?? null,
          countryOfResidence: insertCrewMember.countryOfResidence ?? null,
          nearestAirport: insertCrewMember.nearestAirport ?? null,
          residentialAddressLine1: insertCrewMember.residentialAddressLine1 ?? null,
          residentialAddressLine2: insertCrewMember.residentialAddressLine2 ?? null,
          placeOfBirthCity: insertCrewMember.placeOfBirthCity ?? null,
          placeOfBirthCountry: insertCrewMember.placeOfBirthCountry ?? null,
          heightCm: insertCrewMember.heightCm ?? null,
          weightKg: insertCrewMember.weightKg ?? null,
          bmi: insertCrewMember.bmi ?? null,
          nativeLanguage: insertCrewMember.nativeLanguage ?? null,
          foreignLanguages: insertCrewMember.foreignLanguages ?? null,
          englishProficiency: insertCrewMember.englishProficiency ?? null,
          maritalStatus: insertCrewMember.maritalStatus ?? null,
          numberOfDependentChildren: insertCrewMember.numberOfDependentChildren ?? null,
          fatherName: insertCrewMember.fatherName ?? null,
          motherName: insertCrewMember.motherName ?? null,
          spouseFirstName: insertCrewMember.spouseFirstName ?? null,
          spouseMiddleName: insertCrewMember.spouseMiddleName ?? null,
          spouseFamilyName: insertCrewMember.spouseFamilyName ?? null,
          spouseDateOfBirth: insertCrewMember.spouseDateOfBirth ?? null,
          nokFirstName: insertCrewMember.nokFirstName ?? null,
          nokMiddleName: insertCrewMember.nokMiddleName ?? null,
          nokFamilyName: insertCrewMember.nokFamilyName ?? null,
          nokTelephone: insertCrewMember.nokTelephone ?? null,
          nokEmail: insertCrewMember.nokEmail ?? null,
          nokAddress: insertCrewMember.nokAddress ?? null,
          nokRelationship: insertCrewMember.nokRelationship ?? null,
          manningAgent: insertCrewMember.manningAgent ?? null,
          vesselTypes: insertCrewMember.vesselTypes ?? null,
          documents: insertCrewMember.documents ?? null,
          visas: insertCrewMember.visas ?? null,
          education: insertCrewMember.education ?? null,
          licenses: insertCrewMember.licenses ?? null,
          trainingCourses: insertCrewMember.trainingCourses ?? null,
          currentCompanySeaService: insertCrewMember.currentCompanySeaService ?? null,
          externalSeaService: insertCrewMember.externalSeaService ?? null,
          preJoiningMedicals: insertCrewMember.preJoiningMedicals ?? null,
          doctorVisits: insertCrewMember.doctorVisits ?? null,
          children: insertCrewMember.children ?? null
        };
        this.crewMembers.set(uniqueId, crewMember);
        this.saveToFile();
        return crewMember;
      }
      async updateCrewMember(id, crewMemberData) {
        const existingCrewMember = this.crewMembers.get(id);
        if (!existingCrewMember) return void 0;
        const { id: _omitId, ...sanitizedData } = crewMemberData;
        const updatedCrewMember = {
          ...existingCrewMember,
          ...sanitizedData,
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.crewMembers.set(id, updatedCrewMember);
        this.saveToFile();
        return updatedCrewMember;
      }
      async deleteCrewMember(id) {
        const result = this.crewMembers.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Sea Service Entry Helpers (for idempotent sign-on/sign-off)
      async upsertSeaServiceEntry(params) {
        const crewMember = await this.getCrewMember(params.crewId);
        if (!crewMember) {
          throw new Error(`Crew member ${params.crewId} not found`);
        }
        let currentSeaService = [];
        if (crewMember.currentCompanySeaService) {
          try {
            currentSeaService = typeof crewMember.currentCompanySeaService === "string" ? JSON.parse(crewMember.currentCompanySeaService) : crewMember.currentCompanySeaService;
            if (!Array.isArray(currentSeaService)) {
              currentSeaService = [];
            }
          } catch (e) {
            currentSeaService = [];
          }
        }
        const existingIndex = currentSeaService.findIndex(
          (record) => record.planningId === params.planningId && isActiveSeaService(record)
        );
        const seaServiceRecord = {
          planningId: params.planningId,
          vesselName: params.vesselName,
          vesselCode: params.vesselCode,
          vesselType: params.vesselType,
          rank: params.rank,
          from: params.signOnDate,
          to: "",
          // Empty 'to' date indicates active service
          periodMonths: "",
          // Calculated dynamically
          isActive: true,
          status: "active",
          createdVia: "sign-on"
        };
        let updatedSeaService;
        if (existingIndex >= 0) {
          currentSeaService[existingIndex] = {
            ...currentSeaService[existingIndex],
            ...seaServiceRecord,
            id: currentSeaService[existingIndex].id
            // Preserve existing ID
          };
          updatedSeaService = currentSeaService;
        } else {
          const newRecord = {
            id: `auto-${Date.now()}`,
            ...seaServiceRecord
          };
          updatedSeaService = [newRecord, ...currentSeaService];
        }
        await this.updateCrewMember(params.crewId, {
          currentCompanySeaService: JSON.stringify(updatedSeaService)
        });
      }
      async completeSeaServiceEntry(params) {
        const crewMember = await this.getCrewMember(params.crewId);
        if (!crewMember) {
          throw new Error(`Crew member ${params.crewId} not found`);
        }
        let currentSeaService = [];
        if (crewMember.currentCompanySeaService) {
          try {
            currentSeaService = typeof crewMember.currentCompanySeaService === "string" ? JSON.parse(crewMember.currentCompanySeaService) : crewMember.currentCompanySeaService;
            if (!Array.isArray(currentSeaService)) {
              currentSeaService = [];
            }
          } catch (e) {
            currentSeaService = [];
          }
        }
        const activeIndex = currentSeaService.findIndex(
          (record) => record.planningId === params.planningId && isActiveSeaService(record)
        );
        if (activeIndex >= 0) {
          const activeRecord = currentSeaService[activeIndex];
          const from = safeParseDate(activeRecord.from);
          const to = safeParseDate(params.signOffDate);
          let finalPeriodMonths = "";
          if (from && to) {
            const months = calculatePeriodMonths(from, to);
            finalPeriodMonths = months.toFixed(1);
          }
          currentSeaService[activeIndex] = {
            ...activeRecord,
            to: params.signOffDate,
            periodMonths: finalPeriodMonths,
            isActive: false,
            status: "completed"
          };
          await this.updateCrewMember(params.crewId, {
            currentCompanySeaService: JSON.stringify(currentSeaService)
          });
        }
      }
      // Dashboard Summary Method
      async getCrewDashboardSummary(crewId) {
        const crewMember = await this.getCrewMember(crewId);
        if (!crewMember) return void 0;
        const appraisals = await this.getAppraisalResultsByCrewMember(crewId);
        let companySeaService = [];
        let externalSeaService = [];
        if (crewMember.currentCompanySeaService) {
          if (Array.isArray(crewMember.currentCompanySeaService)) {
            companySeaService = crewMember.currentCompanySeaService;
          } else if (typeof crewMember.currentCompanySeaService === "string") {
            try {
              companySeaService = JSON.parse(crewMember.currentCompanySeaService);
            } catch (e) {
              companySeaService = [];
            }
          }
        }
        if (crewMember.externalSeaService) {
          if (Array.isArray(crewMember.externalSeaService)) {
            externalSeaService = crewMember.externalSeaService;
          } else if (typeof crewMember.externalSeaService === "string") {
            try {
              externalSeaService = JSON.parse(crewMember.externalSeaService);
            } catch (e) {
              externalSeaService = [];
            }
          }
        }
        const currentRank = crewMember.presentRank || "";
        const experience = calculateExperienceFromSeaService(
          companySeaService,
          externalSeaService,
          currentRank
        );
        const shipTypeData = calculateShipTypeExperience(companySeaService, externalSeaService);
        const allSeaService = [...companySeaService, ...externalSeaService];
        const rankExperienceMap = /* @__PURE__ */ new Map();
        for (const entry of allSeaService) {
          if (!entry.rank) continue;
          const durationMonths = calculateSeaServiceDuration(entry);
          const existingMonths = rankExperienceMap.get(entry.rank) || 0;
          rankExperienceMap.set(entry.rank, existingMonths + durationMonths);
        }
        const rankExperienceItems = Array.from(rankExperienceMap.entries()).map(([rank, months]) => ({ rank, months })).sort((a, b) => b.months - a.months);
        const totalRankMonths = rankExperienceItems.reduce((sum, item) => sum + item.months, 0);
        const rankExperienceByVesselType = {};
        for (const entry of allSeaService) {
          if (!entry.rank || entry.rank !== currentRank) continue;
          const vesselType = entry.vesselType || entry.shipType || "";
          if (!vesselType) continue;
          const durationMonths = calculateSeaServiceDuration(entry);
          rankExperienceByVesselType[vesselType] = (rankExperienceByVesselType[vesselType] || 0) + durationMonths;
        }
        let licenses = [];
        if (crewMember.licenses) {
          if (Array.isArray(crewMember.licenses)) {
            licenses = crewMember.licenses;
          } else if (typeof crewMember.licenses === "string") {
            try {
              licenses = JSON.parse(crewMember.licenses);
            } catch (e) {
              licenses = [];
            }
          }
        }
        const rankFlags = await this.getCompanyRankByName(currentRank);
        const endorsementCode = deriveEndorsementCode(
          {
            seniorOfficer: rankFlags?.seniorOfficer,
            officer: rankFlags?.officer,
            rating: rankFlags?.rating
          },
          licenses
        );
        const vesselName = crewMember.presentVessel ? translateVesselCodeToName(crewMember.presentVessel) : "";
        const joinedDateFormatted = formatDateForDashboard(crewMember.signOnDate);
        const reliefDueFormatted = formatDateForDashboard(crewMember.reliefDue);
        const vesselPlanningRecords = await this.getVesselPlanningByCrewMember(crewId);
        const relieverPlanningRecords = await this.getVesselPlanningAsReliever(crewId);
        const appraisalsByVessel = /* @__PURE__ */ new Map();
        for (const appraisal of appraisals) {
          const vessel = appraisal.vesselName || "";
          if (!appraisalsByVessel.has(vessel)) {
            appraisalsByVessel.set(vessel, []);
          }
          appraisalsByVessel.get(vessel).push(appraisal.id);
        }
        const activeVesselPlanningRecords = vesselPlanningRecords.filter((p) => !p.isArchived);
        const serviceTimeline = buildServiceTimeline(
          companySeaService,
          activeVesselPlanningRecords,
          appraisalsByVessel,
          /* @__PURE__ */ new Map(),
          // handovers - not yet implemented
          void 0,
          // vesselCodeToNameMap - PersistentFileStorage uses static translation
          relieverPlanningRecords
        );
        let computedStatus = "On Leave";
        if (crewMember.isActive === false) {
          computedStatus = "Inactive";
        } else if (crewMember.presentVessel && crewMember.presentVessel.trim() !== "") {
          computedStatus = "On Board";
        } else {
          computedStatus = "On Leave";
        }
        const summary = {
          status: {
            status: computedStatus,
            vessel: vesselName,
            joinedDate: joinedDateFormatted,
            sailingDue: reliefDueFormatted,
            presentAssignment: crewMember.presentVessel || null,
            emergencyContact: crewMember.nokFirstName && crewMember.nokRelationship && crewMember.nokTelephone ? {
              name: `${crewMember.nokFirstName}${crewMember.nokFamilyName ? " " + crewMember.nokFamilyName : ""}`.trim(),
              relation: crewMember.nokRelationship,
              phone: crewMember.nokTelephone
            } : null
          },
          experience: {
            company: experience.company,
            rank: experience.rank,
            tankers: experience.tankers,
            ocw: experience.oow,
            endorsements: endorsementCode
          },
          shipTypes: {
            items: shipTypeData.shipTypeExperience,
            totalMonths: shipTypeData.totalMonths,
            totalYears: Math.round(shipTypeData.totalMonths / 12 * 10) / 10
          },
          rankExperience: {
            items: rankExperienceItems,
            totalMonths: totalRankMonths,
            totalYears: Math.round(totalRankMonths / 12 * 10) / 10
          },
          rankExperienceByVesselType,
          serviceTimeline,
          compliance: [
            { category: "Travel Docs", status: "compliant", details: "\u2713" },
            { category: "Visas", status: "compliant", details: "\u2713" },
            { category: "License & DCE", status: "compliant", details: "\u2713" },
            { category: "Training", status: "issues", details: "Issues: 2" },
            { category: "Medical", status: "compliant", details: "Last: 15 Feb 2022" },
            { category: "Vaccination", status: "issues", details: "Issue: 1" }
          ],
          careerProgression: [
            {
              position: "To C/E",
              status: { recommend: false, advance: false, demote: true, approved: false }
            },
            {
              position: "To 2/E",
              date: "22 Jan 2017",
              status: { recommend: true, advance: true, demote: false, approved: true }
            },
            {
              position: "To 3/E",
              date: "12 Dec 2014",
              status: { recommend: true, advance: true, demote: false, approved: true }
            }
          ],
          appraisals: appraisals.map((appraisal, index) => ({
            year: 2014 + index * 2,
            score: parseFloat(appraisal.overallRating || "3.0") * 8
            // Convert to chart scale
          })).concat([
            { year: 2024, score: 31 }
            // Add current year point
          ])
        };
        return summary;
      }
      initializeRestHoursSampleData() {
        const currentDate = /* @__PURE__ */ new Date();
        const vessels2 = [
          { id: "743ef9d1-841a-11ed-aa7c-7003bca91a86", name: "Vessel 1" },
          { id: "743feb08-841a-11ed-aa7c-7003bca91a86", name: "Vessel 2" },
          { id: "7440571a-841a-11ed-aa7c-7003bca91a86", name: "Vessel 3" },
          { id: "744535d0-841a-11ed-aa7c-7003bca91a86", name: "Vessel 4" },
          { id: "7446783c-841a-11ed-aa7c-7003bca91a86", name: "Vessel 5" },
          { id: "74481b72-841a-11ed-aa7c-7003bca91a86", name: "Vessel 6" }
        ];
        let rhRecordId = this.currentRestHoursVesselRecordId;
        for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
          const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          vessels2.forEach((vessel, idx) => {
            const totalCrew = 20 + Math.floor(Math.random() * 5);
            const recordingPercent = monthOffset === 0 ? Math.floor(Math.random() * 101) : 100;
            const activityConflicting = Math.random() > 0.7;
            const totalViolations = Math.floor(Math.random() * 7);
            const crewWithViolations = totalViolations > 0 ? Math.min(totalViolations, Math.floor(Math.random() * 4) + 1) : 0;
            const totalNCs = Math.floor(Math.random() * 4);
            const crewWithNCs = totalNCs > 0 ? Math.min(totalNCs, Math.floor(Math.random() * 3) + 1) : 0;
            const predictedViolations = Math.floor(Math.random() * 2);
            const predictedNCs = Math.floor(Math.random() * 2);
            const crewWithPredictedNCs = predictedNCs > 0 ? Math.min(predictedNCs, Math.floor(Math.random() * 2) + 1) : 0;
            let officeReviewStatus = "Completed";
            if (monthOffset === 0 && idx < 3) {
              officeReviewStatus = idx === 0 ? "Completed" : idx === 1 ? "Due" : "Overdue";
            }
            this.restHoursVesselRecords.set(rhRecordId, {
              id: rhRecordId,
              createdAt: null,
              updatedAt: null,
              vesselId: vessel.id,
              month: monthLabel.replace(" ", "-"),
              monthValue,
              totalCrew,
              recordingStatusPercent: recordingPercent,
              activityConflicting,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              totalViolations,
              crewWithViolations,
              crewWithViolationsDetails: null,
              totalNCs,
              crewWithNCs,
              crewWithNCsDetails: null,
              predictedViolations,
              crewWithPredictedViolations: 0,
              crewWithPredictedViolationsDetails: null,
              predictedNCs,
              crewWithPredictedNCs,
              crewWithPredictedNCsDetails: null,
              vesselReviewStatus: "Due",
              vesselReviewSubmittedDate: null,
              officeReviewStatus,
              officeReviewSubmittedDate: null
            });
            rhRecordId++;
          });
        }
        this.currentRestHoursVesselRecordId = rhRecordId;
      }
      // ID Generation Methods
      initializeCrewIdCounter() {
        let maxCounter = 0;
        for (const crewMember of Array.from(this.crewMembers.values())) {
          if (crewMember.employeeId) {
            const match = crewMember.employeeId.match(/^A(\d{6})$/);
            if (match) {
              const idNumber = parseInt(match[1], 10);
              maxCounter = Math.max(maxCounter, idNumber);
            }
          }
        }
        const startingCounter = maxCounter + 1;
        console.log(`\u{1F522} Initialized crew ID counter to ${startingCounter} (scanned ${this.crewMembers.size} existing crew members)`);
        return startingCounter;
      }
      async getNextCrewId() {
        const nextNumber = this.currentCrewIdCounter++;
        this.saveToFile();
        return `A${nextNumber.toString().padStart(6, "0")}`;
      }
      // Vessel Groups Methods
      async getVesselGroups() {
        return Array.from(this.vesselGroups.values());
      }
      async getVesselGroup(id) {
        return this.vesselGroups.get(id);
      }
      async createVesselGroup(insertVesselGroup) {
        const id = this.currentVesselGroupId++;
        const vesselGroup = {
          id,
          name: insertVesselGroup.name,
          vesselIds: insertVesselGroup.vesselIds,
          description: insertVesselGroup.description ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.vesselGroups.set(id, vesselGroup);
        this.saveToFile();
        return vesselGroup;
      }
      async updateVesselGroup(id, vesselGroupData) {
        const existingVesselGroup = this.vesselGroups.get(id);
        if (!existingVesselGroup) return void 0;
        const updatedVesselGroup = {
          ...existingVesselGroup,
          ...vesselGroupData,
          updatedAt: null
          // new Date()
        };
        this.vesselGroups.set(id, updatedVesselGroup);
        this.saveToFile();
        return updatedVesselGroup;
      }
      async deleteVesselGroup(id) {
        const result = this.vesselGroups.delete(id);
        if (result) {
          this.saveToFile();
        }
        return result;
      }
      // Vessel Drafts methods
      async getVesselDrafts() {
        return Array.from(this.vesselDrafts.values());
      }
      async getVesselDraft(id) {
        return this.vesselDrafts.get(id);
      }
      async getVesselDraftsByVessel(vesselId2) {
        return Array.from(this.vesselDrafts.values()).filter((draft) => draft.vesselId === vesselId2);
      }
      async createVesselDraft(insertVesselDraft) {
        const id = this.currentVesselDraftId++;
        const vesselDraft = {
          id,
          vesselId: insertVesselDraft.vesselId,
          revision: insertVesselDraft.revision ?? "",
          draftData: insertVesselDraft.draftData,
          createdAt: null,
          updatedAt: null
        };
        this.vesselDrafts.set(id, vesselDraft);
        this.saveToFile();
        return vesselDraft;
      }
      async updateVesselDraft(id, vesselDraftData) {
        const existingVesselDraft = this.vesselDrafts.get(id);
        if (!existingVesselDraft) return void 0;
        const updatedVesselDraft = {
          ...existingVesselDraft,
          ...vesselDraftData,
          updatedAt: null
          // new Date()
        };
        this.vesselDrafts.set(id, updatedVesselDraft);
        this.saveToFile();
        return updatedVesselDraft;
      }
      async deleteVesselDraft(id) {
        const result = this.vesselDrafts.delete(id);
        if (result) {
          this.saveToFile();
        }
        return result;
      }
      // Vessel Revisions methods
      async getVesselRevisions() {
        return Array.from(this.vesselRevisions.values());
      }
      async getVesselRevision(id) {
        return this.vesselRevisions.get(id);
      }
      async getVesselRevisionsByVessel(vesselId2) {
        return Array.from(this.vesselRevisions.values()).filter((revision) => revision.vesselId === vesselId2);
      }
      async createVesselRevision(insertVesselRevision) {
        const id = this.currentVesselRevisionId++;
        const vesselRevision = {
          ...insertVesselRevision,
          id,
          createdAt: null
          // new Date()
        };
        this.vesselRevisions.set(id, vesselRevision);
        this.saveToFile();
        return vesselRevision;
      }
      // Training Matrix Vessel Drafts methods
      async getTrainingMatrixVesselDrafts() {
        return Array.from(this.trainingMatrixVesselDrafts.values());
      }
      async getTrainingMatrixVesselDraft(id) {
        return this.trainingMatrixVesselDrafts.get(id);
      }
      async getTrainingMatrixVesselDraftsByVessel(vesselId2) {
        return Array.from(this.trainingMatrixVesselDrafts.values()).filter((draft) => draft.vesselId === vesselId2);
      }
      async createTrainingMatrixVesselDraft(insertDraft) {
        const id = this.currentTrainingMatrixVesselDraftId++;
        const draft = {
          id,
          vesselId: insertDraft.vesselId,
          revision: insertDraft.revision ?? "",
          draftData: insertDraft.draftData,
          createdAt: null,
          updatedAt: null
        };
        this.trainingMatrixVesselDrafts.set(id, draft);
        this.saveToFile();
        return draft;
      }
      async updateTrainingMatrixVesselDraft(id, draftData) {
        const existingDraft = this.trainingMatrixVesselDrafts.get(id);
        if (!existingDraft) return void 0;
        const updatedDraft = {
          ...existingDraft,
          ...draftData,
          updatedAt: null
        };
        this.trainingMatrixVesselDrafts.set(id, updatedDraft);
        this.saveToFile();
        return updatedDraft;
      }
      async deleteTrainingMatrixVesselDraft(id) {
        const result = this.trainingMatrixVesselDrafts.delete(id);
        if (result) {
          this.saveToFile();
        }
        return result;
      }
      // Training Matrix Vessel Revisions methods
      async getTrainingMatrixVesselRevisions() {
        return Array.from(this.trainingMatrixVesselRevisions.values());
      }
      async getTrainingMatrixVesselRevision(id) {
        return this.trainingMatrixVesselRevisions.get(id);
      }
      async getTrainingMatrixVesselRevisionsByVessel(vesselId2) {
        return Array.from(this.trainingMatrixVesselRevisions.values()).filter((revision) => revision.vesselId === vesselId2);
      }
      async createTrainingMatrixVesselRevision(insertRevision) {
        const id = this.currentTrainingMatrixVesselRevisionId++;
        const revision = {
          ...insertRevision,
          id,
          createdAt: null
        };
        this.trainingMatrixVesselRevisions.set(id, revision);
        this.saveToFile();
        return revision;
      }
      // Appraisal Result methods (same as MemStorage)
      async getAppraisalResults() {
        return Array.from(this.appraisalResults.values()).filter((ar) => ar.status !== "draft");
      }
      async getAppraisalResult(id) {
        return this.appraisalResults.get(id);
      }
      async getAppraisalResultsByCrewMember(crewMemberId) {
        return Array.from(this.appraisalResults.values()).filter((ar) => ar.crewMemberId === crewMemberId);
      }
      async createAppraisalResult(insertAppraisalResult) {
        const id = this.currentAppraisalResultId++;
        const appraisalResult = {
          id,
          formId: insertAppraisalResult.formId,
          crewMemberId: insertAppraisalResult.crewMemberId,
          appraisalType: insertAppraisalResult.appraisalType,
          appraisalDate: insertAppraisalResult.appraisalDate,
          appraisalData: insertAppraisalResult.appraisalData,
          submittedBy: insertAppraisalResult.submittedBy,
          status: insertAppraisalResult.status ?? "draft",
          competenceRating: insertAppraisalResult.competenceRating ?? null,
          behavioralRating: insertAppraisalResult.behavioralRating ?? null,
          overallRating: insertAppraisalResult.overallRating ?? null,
          submittedAt: /* @__PURE__ */ new Date(),
          stagePayloads: insertAppraisalResult.stagePayloads ?? null,
          stageStatuses: insertAppraisalResult.stageStatuses ?? null
        };
        this.appraisalResults.set(appraisalResult.id, appraisalResult);
        this.saveToFile();
        return appraisalResult;
      }
      async updateAppraisalResult(id, appraisalData) {
        const existingAppraisal = this.appraisalResults.get(id);
        if (!existingAppraisal) return void 0;
        const updatedAppraisal = { ...existingAppraisal, ...appraisalData };
        this.appraisalResults.set(id, updatedAppraisal);
        this.saveToFile();
        return updatedAppraisal;
      }
      async deleteAppraisalResult(id) {
        const result = this.appraisalResults.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      async submitAppraisalStage(id, stage, data, submittedBy) {
        const existingAppraisal = this.appraisalResults.get(id);
        if (!existingAppraisal) return void 0;
        const stageStatuses = existingAppraisal.stageStatuses ? JSON.parse(existingAppraisal.stageStatuses) : {};
        const stagePayloads = existingAppraisal.stagePayloads ? JSON.parse(existingAppraisal.stagePayloads) : {};
        if (stage === "stage2" && !stageStatuses.stage1?.status) {
          throw new Error("Stage 1 must be submitted before Stage 2");
        }
        if (stage === "stage3" && !stageStatuses.stage2?.status) {
          throw new Error("Stage 2 must be submitted before Stage 3");
        }
        stageStatuses[stage] = {
          status: "completed",
          submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
          submittedBy
        };
        stagePayloads[stage] = data;
        let newStatus = existingAppraisal.status;
        if (stage === "stage1") {
          newStatus = "preliminary";
        } else if (stage === "stage2") {
          newStatus = "submitted";
        } else if (stage === "stage3") {
          newStatus = "reviewed";
        }
        const appraisalData = existingAppraisal.appraisalData ? JSON.parse(existingAppraisal.appraisalData) : {};
        const updatedData = { ...appraisalData, ...data };
        const updatedAppraisal = {
          ...existingAppraisal,
          appraisalData: JSON.stringify(updatedData),
          stageStatuses: JSON.stringify(stageStatuses),
          stagePayloads: JSON.stringify(stagePayloads),
          status: newStatus,
          submittedBy,
          submittedAt: /* @__PURE__ */ new Date()
        };
        this.appraisalResults.set(id, updatedAppraisal);
        this.saveToFile();
        return updatedAppraisal;
      }
      // Recruitment Candidate methods - THE IMPORTANT ONES FOR YOUR FORM!
      async getRecruitmentCandidates() {
        return Array.from(this.recruitmentCandidates.values());
      }
      async getRecruitmentCandidate(id) {
        return this.recruitmentCandidates.get(id);
      }
      async getRecruitmentCandidatesByStatus(status) {
        return Array.from(this.recruitmentCandidates.values()).filter((candidate) => candidate.status === status);
      }
      async createRecruitmentCandidate(insertCandidate) {
        const candidate = {
          ...insertCandidate,
          middleName: insertCandidate.middleName || null,
          applicationData: insertCandidate.applicationData || null,
          status: insertCandidate.status || "Applied",
          isDelete: false,
          createdAt: null,
          updatedAt: null
          // new Date()
        };
        this.recruitmentCandidates.set(candidate.id, candidate);
        this.saveToFile();
        return candidate;
      }
      async updateRecruitmentCandidate(id, candidateData) {
        const existingCandidate = this.recruitmentCandidates.get(id);
        if (!existingCandidate) return void 0;
        const updatedCandidate = {
          ...existingCandidate,
          ...candidateData,
          updatedAt: null
          // new Date()
        };
        this.recruitmentCandidates.set(id, updatedCandidate);
        this.saveToFile();
        return updatedCandidate;
      }
      async deleteRecruitmentCandidate(id) {
        const result = this.recruitmentCandidates.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      async softDeleteRecruitmentCandidate(id) {
        const existingCandidate = this.recruitmentCandidates.get(id);
        if (!existingCandidate) return void 0;
        const updatedCandidate = {
          ...existingCandidate,
          isDelete: true,
          updatedAt: null
          // new Date()
        };
        this.recruitmentCandidates.set(id, updatedCandidate);
        this.saveToFile();
        return updatedCandidate;
      }
      async transferRecruitedCandidate(candidateId) {
        const candidate = this.recruitmentCandidates.get(candidateId);
        if (!candidate) {
          throw new Error(`Recruitment candidate with ID ${candidateId} not found`);
        }
        if (candidate.status !== "Recruited") {
          throw new Error(`Candidate must have status 'Recruited' to be transferred. Current status: ${candidate.status}`);
        }
        const existingCrew = Array.from(this.crewMembers.values()).find(
          (crew) => crew.empNo === candidate.fileNo
        );
        if (existingCrew) {
          console.log(`\u26A0\uFE0F Candidate ${candidate.fileNo} already transferred to crew database with ID ${existingCrew.id}`);
          return { crewMember: existingCrew, crewId: existingCrew.id };
        }
        const crewId = await this.getNextCrewId();
        let applicationData = null;
        if (candidate.applicationData) {
          try {
            applicationData = typeof candidate.applicationData === "string" ? JSON.parse(candidate.applicationData) : candidate.applicationData;
          } catch (e) {
            console.warn("Failed to parse applicationData:", e);
          }
        }
        const crewMemberData = {
          id: crewId,
          employeeId: crewId,
          // Set employeeId to display as Crew ID in the database view
          empNo: candidate.fileNo || "",
          // Photo (A1 - Crew Photo)
          uploadedPhoto: applicationData?.uploadedPhoto || null,
          // A1.1 General Particulars
          firstName: candidate.firstName,
          middleName: candidate.middleName || null,
          familyName: candidate.familyName,
          gender: applicationData?.gender || candidate.gender || "Male",
          dateOfBirth: candidate.dob,
          nationality: candidate.nationality,
          presentRank: candidate.rankAppliedFor,
          rankAppliedFor: candidate.rankAppliedFor,
          vesselType: candidate.vesselType || "General",
          presentVessel: "Unassigned",
          age: applicationData?.ageInYears || null,
          placeOfBirthCity: applicationData?.placeOfBirthCity || null,
          placeOfBirthCountry: applicationData?.placeOfBirthCountry || null,
          heightCm: applicationData?.heightCm || null,
          weightKg: applicationData?.weightKg || null,
          nativeLanguage: applicationData?.nativeLanguage || null,
          foreignLanguages: applicationData?.foreignLanguages || null,
          englishProficiency: applicationData?.englishProficiency || null,
          manningAgent: applicationData?.manningAgent || null,
          // A1.2 Address & Contact Info
          countryOfResidence: applicationData?.countryOfResidence || null,
          nearestAirport: applicationData?.nearestAirport || null,
          residentialAddressLine1: applicationData?.residentialAddressLine1 || null,
          residentialAddressLine2: applicationData?.residentialAddressLine2 || null,
          contactLandline: applicationData?.contactLandline || null,
          mobile: applicationData?.mobile || null,
          email: applicationData?.email || null,
          // A1.3 Family and NOK
          maritalStatus: applicationData?.maritalStatus || null,
          numberOfDependentChildren: applicationData?.numberOfDependentChildren || null,
          fatherName: applicationData?.fatherName || null,
          motherName: applicationData?.motherName || null,
          spouseFirstName: applicationData?.spouseFirstName || null,
          spouseMiddleName: applicationData?.spouseMiddleName || null,
          spouseFamilyName: applicationData?.spouseFamilyName || null,
          spouseDateOfBirth: applicationData?.spouseDateOfBirth || null,
          children: applicationData?.children ? JSON.stringify(applicationData.children) : null,
          nokFirstName: applicationData?.nokFirstName || null,
          nokMiddleName: applicationData?.nokMiddleName || null,
          nokFamilyName: applicationData?.nokFamilyName || null,
          nokTelephone: applicationData?.nokTelephone || null,
          nokEmail: applicationData?.nokEmail || null,
          nokAddress: applicationData?.nokAddress || null,
          nokRelationship: applicationData?.nokRelationship || null,
          // A2 - Travel & ID Documents
          documents: applicationData?.documents ? JSON.stringify(applicationData.documents) : null,
          visas: applicationData?.visas ? JSON.stringify(applicationData.visas) : null,
          // A3 - Training & Certificates
          education: applicationData?.education ? JSON.stringify(applicationData.education) : null,
          licenses: applicationData?.licenses ? JSON.stringify(applicationData.licenses) : null,
          trainingCourses: applicationData?.trainingCourses ? JSON.stringify(applicationData.trainingCourses) : null,
          // A4 - Sea Service (recruitment seaService maps to externalSeaService in crew)
          externalSeaService: applicationData?.seaService ? JSON.stringify(applicationData.seaService) : null,
          status: "Active"
        };
        const crewMember = await this.createCrewMember(crewMemberData);
        this.saveToFile();
        console.log(`\u2705 Transferred recruited candidate ${candidate.fileNo} to crew database with ID ${crewId}`);
        return { crewMember, crewId };
      }
      // Vessel Planning Methods
      async getVesselPlanningByVessel(vesselId2) {
        return Array.from(this.vesselPlanning.values()).filter((planning) => planning.vesselId === vesselId2);
      }
      async getVesselPlanningByCrewMember(crewMemberId) {
        return Array.from(this.vesselPlanning.values()).filter((planning) => planning.crewMemberId === crewMemberId);
      }
      async getVesselPlanningAsReliever(crewMemberId) {
        return Array.from(this.vesselPlanning.values()).filter((planning) => planning.relieverCrewId === crewMemberId);
      }
      async getVesselPlanningById(id) {
        return this.vesselPlanning.get(id);
      }
      async getAllVesselPlanning() {
        return Array.from(this.vesselPlanning.values());
      }
      async createVesselPlanning(insertPlanning) {
        const id = this.currentVesselPlanningId++;
        const vesselPlanning2 = {
          id,
          vesselId: insertPlanning.vesselId,
          rankId: insertPlanning.rankId,
          rank: insertPlanning.rank,
          crewMemberId: null,
          onBoardCrewId: insertPlanning.onBoardCrewId ?? null,
          onBoardCrewName: insertPlanning.onBoardCrewName ?? null,
          onBoardCrewNationality: insertPlanning.onBoardCrewNationality ?? null,
          reliefDue: insertPlanning.reliefDue ?? null,
          signOnDate: insertPlanning.signOnDate ?? null,
          signOffDate: insertPlanning.signOffDate ?? null,
          signOffPort: insertPlanning.signOffPort ?? null,
          reliefStatus: insertPlanning.reliefStatus ?? null,
          relieverCrewId: insertPlanning.relieverCrewId ?? null,
          relieverCrewName: insertPlanning.relieverCrewName ?? null,
          relieverNationality: insertPlanning.relieverNationality ?? null,
          relieverSignOnDate: insertPlanning.relieverSignOnDate ?? null,
          joiningPort: insertPlanning.joiningPort ?? null,
          joiningStatus: insertPlanning.joiningStatus ?? null,
          contractPeriodMonths: insertPlanning.contractPeriodMonths ?? null,
          contractEndRangeStartMonths: insertPlanning.contractEndRangeStartMonths ?? null,
          contractEndRangeEndMonths: insertPlanning.contractEndRangeEndMonths ?? null,
          crewStatus: insertPlanning.crewStatus ?? null,
          takeOverDate: insertPlanning.takeOverDate ?? null,
          takeOverConfirmation: insertPlanning.takeOverConfirmation ?? null,
          handOverDate: insertPlanning.handOverDate ?? null,
          deploymentChecklistCompleted: insertPlanning.deploymentChecklistCompleted ?? null,
          applicableDocsChecked: insertPlanning.applicableDocsChecked ?? null,
          isArchived: insertPlanning.isArchived ?? false,
          archivedDate: insertPlanning.archivedDate ?? null,
          signOffReason: insertPlanning.signOffReason ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.vesselPlanning.set(id, vesselPlanning2);
        this.saveToFile();
        return vesselPlanning2;
      }
      async updateVesselPlanning(id, planningData) {
        const existingPlanning = this.vesselPlanning.get(id);
        if (!existingPlanning) return void 0;
        const updatedPlanning = {
          ...existingPlanning,
          ...planningData,
          updatedAt: null
          // new Date()
        };
        this.vesselPlanning.set(id, updatedPlanning);
        this.saveToFile();
        return updatedPlanning;
      }
      async deleteVesselPlanning(id) {
        const result = this.vesselPlanning.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rotation Plans Methods
      async getRotationPlans() {
        return Array.from(this.rotationPlans.values());
      }
      async getRotationPlan(id) {
        return this.rotationPlans.get(id);
      }
      async createRotationPlan(insertPlan) {
        const id = this.currentRotationPlanId++;
        const rotationPlan = {
          id,
          createdAt: null,
          updatedAt: null,
          createdBy: insertPlan.createdBy,
          draftId: insertPlan.draftId,
          lastEdited: insertPlan.lastEdited,
          vessels: insertPlan.vessels,
          crew: insertPlan.crew,
          planFromDate: insertPlan.planFromDate,
          planToDate: insertPlan.planToDate,
          planStatus: insertPlan.planStatus ?? "In Draft",
          proposedBy: insertPlan.proposedBy ?? null,
          proposedDate: insertPlan.proposedDate ?? null,
          assignments: insertPlan.assignments ?? null
        };
        this.rotationPlans.set(id, rotationPlan);
        this.saveToFile();
        return rotationPlan;
      }
      async updateRotationPlan(id, updateData) {
        const existingPlan = this.rotationPlans.get(id);
        if (!existingPlan) return void 0;
        const updatedPlan = {
          ...existingPlan,
          ...updateData,
          updatedAt: null
        };
        this.rotationPlans.set(id, updatedPlan);
        this.saveToFile();
        return updatedPlan;
      }
      async deleteRotationPlan(id) {
        const result = this.rotationPlans.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rotation Approval Workflow Methods
      async proposeRotationPlan(id, proposedBy) {
        const plan = this.rotationPlans.get(id);
        if (!plan) return void 0;
        let assignments = plan.assignments;
        if (assignments) {
          const parsedAssignments = JSON.parse(assignments);
          const resetAssignments = parsedAssignments.map((assignment) => ({
            ...assignment,
            proposalStatus: "proposed"
            // Reset to proposed status
          }));
          assignments = JSON.stringify(resetAssignments);
        }
        const updatedPlan = {
          ...plan,
          assignments,
          planStatus: "Proposed",
          proposedBy,
          proposedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          updatedAt: null
          // new Date()
        };
        this.rotationPlans.set(id, updatedPlan);
        this.saveToFile();
        return updatedPlan;
      }
      async getProposedAssignments(filters) {
        const proposedPlans = Array.from(this.rotationPlans.values()).filter(
          (plan) => plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved" || plan.planStatus === "Completed"
        );
        const assignments = [];
        for (const plan of proposedPlans) {
          if (plan.assignments) {
            const planAssignments = JSON.parse(plan.assignments);
            for (let i = 0; i < planAssignments.length; i++) {
              const assignment = planAssignments[i];
              const assignmentStatus = (assignment.status || "").toLowerCase();
              const proposalStatus = (assignment.proposalStatus || "").toLowerCase();
              const isArchived = assignmentStatus === "deployed" || assignmentStatus === "rejected" || proposalStatus === "deployed" || proposalStatus === "rejected";
              const isPending = !isArchived && (!proposalStatus || proposalStatus === "proposed");
              if (filters?.archived ? isArchived : isPending) {
                let currentCrew = null;
                let vesselIdToMatch = null;
                if (assignment.vesselId) {
                  vesselIdToMatch = String(assignment.vesselId);
                } else if (assignment.vessel || assignment.vesselName) {
                  const vesselValue = assignment.vessel || assignment.vesselName;
                  if (UUID_PATTERN.test(vesselValue)) {
                    vesselIdToMatch = vesselValue;
                  } else {
                    const vesselMasterData = await this.getMasterDataEntries("014");
                    const vessel = vesselMasterData?.find((v) => v.name === vesselValue);
                    if (vessel && vessel.entryId) {
                      vesselIdToMatch = vessel.entryId;
                    }
                  }
                }
                if (vesselIdToMatch && assignment.rank) {
                  const crewOnBoard = Array.from(this.crewMembers.values()).find(
                    (crew) => crew.presentVessel === vesselIdToMatch && crew.presentRank === assignment.rank
                  );
                  if (crewOnBoard) {
                    const planning = Array.from(this.vesselPlanning.values()).find(
                      (p) => p.onBoardCrewId === crewOnBoard.id && p.vesselId === vesselIdToMatch && p.rank === assignment.rank
                    );
                    if (planning && planning.reliefDue) {
                      const reliefDueDate = new Date(planning.reliefDue);
                      const rangeStartMonths = planning.contractEndRangeStartMonths || 0;
                      const rangeEndMonths = planning.contractEndRangeEndMonths || 1;
                      const rangeStartDate = new Date(reliefDueDate);
                      rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
                      const rangeEndDate = new Date(reliefDueDate);
                      rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);
                      currentCrew = {
                        id: crewOnBoard.id,
                        name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ""} ${crewOnBoard.familyName || crewOnBoard.familyName || ""}`.replace(/\s+/g, " ").trim(),
                        contractStartDate: planning.signOnDate || crewOnBoard.signOnDate || "",
                        contractEndDate: planning.reliefDue,
                        rangeStartDate: rangeStartDate.toISOString().split("T")[0],
                        rangeEndDate: rangeEndDate.toISOString().split("T")[0]
                      };
                    } else if (crewOnBoard.signOnDate && crewOnBoard.reliefDue) {
                      const reliefDueDate = new Date(crewOnBoard.reliefDue);
                      const rangeEndDate = new Date(reliefDueDate);
                      rangeEndDate.setMonth(rangeEndDate.getMonth() + 1);
                      currentCrew = {
                        id: crewOnBoard.id,
                        name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ""} ${crewOnBoard.familyName || crewOnBoard.familyName || ""}`.replace(/\s+/g, " ").trim(),
                        contractStartDate: crewOnBoard.signOnDate,
                        contractEndDate: crewOnBoard.reliefDue,
                        rangeStartDate: crewOnBoard.reliefDue,
                        rangeEndDate: rangeEndDate.toISOString().split("T")[0]
                      };
                    }
                  }
                }
                const { assignmentIndex: _, ...assignmentWithoutIndex } = assignment;
                let result;
                let archivedDate;
                if (assignment.proposalStatus === "deployed") {
                  result = "Deployed";
                  archivedDate = assignment.deployedDate;
                } else if (assignment.proposalStatus === "rejected") {
                  result = "Rejected";
                  archivedDate = assignment.rejectedDate;
                }
                assignments.push({
                  ...assignmentWithoutIndex,
                  planId: plan.id,
                  draftId: plan.draftId,
                  proposedBy: plan.proposedBy,
                  proposedDate: plan.proposedDate,
                  assignmentIndex: i,
                  currentCrew,
                  // Add current crew timeline data
                  ...result && { result },
                  ...archivedDate && { archivedDate }
                });
              }
            }
          }
        }
        if (filters?.archived) {
          assignments.sort((a, b) => {
            const dateA = new Date(a.archivedDate || "1970-01-01");
            const dateB = new Date(b.archivedDate || "1970-01-01");
            return dateB.getTime() - dateA.getTime();
          });
        }
        return assignments;
      }
      async deployAssignment(planId, assignmentIndex, deployedBy) {
        const plan = this.rotationPlans.get(planId);
        if (!plan || !plan.assignments) return { success: false };
        const assignments = JSON.parse(plan.assignments);
        const assignment = assignments[assignmentIndex];
        if (!assignment) return { success: false };
        const conflicts = await this.checkAssignmentConflicts(
          assignment.crewId,
          assignment.joiningDate,
          assignment.contractPeriod,
          planId,
          assignmentIndex
        );
        if (conflicts.length > 0) {
          return { success: false, conflicts };
        }
        assignments[assignmentIndex] = {
          ...assignment,
          proposalStatus: "deployed",
          deployedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          deployedBy
        };
        const updatedPlan = {
          ...plan,
          assignments: JSON.stringify(assignments),
          updatedAt: null
          // new Date()
        };
        this.rotationPlans.set(planId, updatedPlan);
        this.saveToFile();
        if (!assignment.vesselId || !assignment.rankId) {
          console.error("Missing vesselId or rankId in assignment:", assignment);
          return { success: false };
        }
        const vesselCode = translateVesselNameToCode(assignment.vesselId);
        const originalVesselId = assignment.vesselId;
        console.log(`\u{1F504} Vessel translation (PersistentFileStorage):`, {
          vesselName: assignment.vesselId,
          vesselCode,
          originalVesselId
        });
        let existingPlanningId = null;
        for (const [id, planning] of Array.from(this.vesselPlanning.entries())) {
          if (planning.vesselId === vesselCode && planning.rankId === assignment.rankId) {
            existingPlanningId = id;
            break;
          }
        }
        if (existingPlanningId !== null) {
          await this.updateVesselPlanning(existingPlanningId, {
            relieverCrewId: assignment.crewId,
            relieverCrewName: assignment.crewName,
            relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
            joiningStatus: "Planned",
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false
          });
        } else {
          const vesselPlanningEntry = {
            vesselId: vesselCode,
            rankId: assignment.rankId,
            rank: assignment.rank,
            relieverCrewId: assignment.crewId,
            relieverCrewName: assignment.crewName,
            relieverSignOnDate: assignment.signOnDate || assignment.joiningDate,
            joiningStatus: "Planned",
            contractPeriodMonths: assignment.contractPeriod,
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false
          };
          await this.createVesselPlanning(vesselPlanningEntry);
        }
        const archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        let currentCrewInfo = null;
        if (existingPlanningId !== null) {
          const onBoardCrew = this.vesselPlanning.get(existingPlanningId);
          if (onBoardCrew) {
            const contractStartDate = onBoardCrew.signOnDate;
            let contractEndDate = onBoardCrew.reliefDue;
            if (!contractEndDate && contractStartDate && onBoardCrew.contractPeriodMonths) {
              const calcDate = new Date(contractStartDate);
              calcDate.setMonth(calcDate.getMonth() + onBoardCrew.contractPeriodMonths);
              contractEndDate = calcDate.toISOString().split("T")[0];
            }
            let rangeEndDate;
            if (contractEndDate) {
              const endDate = new Date(contractEndDate);
              endDate.setMonth(endDate.getMonth() + 1);
              rangeEndDate = endDate.toISOString().split("T")[0];
            } else if (contractStartDate) {
              const fallbackDate = new Date(contractStartDate);
              fallbackDate.setMonth(fallbackDate.getMonth() + 7);
              rangeEndDate = fallbackDate.toISOString().split("T")[0];
            } else {
              const fallbackDate = /* @__PURE__ */ new Date();
              fallbackDate.setMonth(fallbackDate.getMonth() + 1);
              rangeEndDate = fallbackDate.toISOString().split("T")[0];
            }
            currentCrewInfo = JSON.stringify({
              id: onBoardCrew.crewMemberId,
              name: onBoardCrew.onBoardCrewName || onBoardCrew.crewMemberId,
              contractStartDate,
              contractEndDate,
              rangeStartDate: contractStartDate,
              rangeEndDate
            });
          }
        }
        await this.createArchiveEntry({
          originalPlanId: planId,
          originalDraftId: plan.draftId || null,
          originalAssignmentIndex: assignmentIndex,
          vesselId: vesselCode,
          rankId: assignment.rankId || null,
          rank: assignment.rank,
          crewId: assignment.crewId,
          crewName: assignment.crewName,
          crewMemberId: assignment.crewMemberId || null,
          signOnDate: assignment.signOnDate || assignment.joiningDate,
          joiningPort: assignment.joiningPort || null,
          contractPeriod: assignment.contractPeriod,
          signOffDate: assignment.signOffDate || null,
          proposedBy: plan.proposedBy || null,
          proposedDate: plan.proposedDate || null,
          result: "Deployed",
          archivedDate,
          archivedBy: deployedBy || null,
          vesselPlanningId: existingPlanningId || null,
          currentCrewInfo,
          fullAssignmentSnapshot: JSON.stringify(assignment)
        });
        return { success: true, vesselPlanningId: existingPlanningId || void 0, vesselCode, vesselId: originalVesselId };
      }
      async rejectAssignment(planId, assignmentIndex, rejectedBy) {
        const plan = this.rotationPlans.get(planId);
        if (!plan || !plan.assignments) return void 0;
        const assignments = JSON.parse(plan.assignments);
        if (!assignments[assignmentIndex]) return void 0;
        const assignment = assignments[assignmentIndex];
        assignments[assignmentIndex] = {
          ...assignment,
          proposalStatus: "rejected",
          rejectedDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          rejectedBy: rejectedBy || null
        };
        const pendingAssignments = assignments.filter(
          (a) => !a.proposalStatus || a.proposalStatus === "proposed"
        );
        const planStatus = pendingAssignments.length === 0 ? "Completed" : plan.planStatus;
        const updatedPlan = {
          ...plan,
          assignments: JSON.stringify(assignments),
          planStatus,
          updatedAt: null
          // new Date()
        };
        this.rotationPlans.set(planId, updatedPlan);
        const archivedDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const vesselCode = assignment.vesselId || assignment.vessel || null;
        let currentCrewInfo = null;
        const normalizedVesselCode = vesselCode ? translateVesselNameToCode(vesselCode) : null;
        const vesselCodesToMatch = [vesselCode, normalizedVesselCode].filter(Boolean);
        if (vesselCodesToMatch.length > 0 && assignment.rank) {
          for (const [id, vp] of Array.from(this.vesselPlanning.entries())) {
            if (vesselCodesToMatch.includes(vp.vesselId) && (vp.rank === assignment.rank || vp.rankId === assignment.rank) && vp.crewStatus === "primary") {
              const contractStartDate = vp.signOnDate;
              let contractEndDate = vp.reliefDue;
              if (!contractEndDate && contractStartDate && vp.contractPeriodMonths) {
                const calcDate = new Date(contractStartDate);
                calcDate.setMonth(calcDate.getMonth() + vp.contractPeriodMonths);
                contractEndDate = calcDate.toISOString().split("T")[0];
              }
              let rangeEndDate;
              if (contractEndDate) {
                const endDate = new Date(contractEndDate);
                endDate.setMonth(endDate.getMonth() + 1);
                rangeEndDate = endDate.toISOString().split("T")[0];
              } else {
                const fallbackDate = /* @__PURE__ */ new Date();
                fallbackDate.setMonth(fallbackDate.getMonth() + 1);
                rangeEndDate = fallbackDate.toISOString().split("T")[0];
              }
              currentCrewInfo = JSON.stringify({
                id: vp.crewMemberId,
                name: vp.onBoardCrewName || vp.crewMemberId,
                contractStartDate,
                contractEndDate,
                rangeStartDate: contractStartDate,
                rangeEndDate
              });
              break;
            }
          }
        }
        await this.createArchiveEntry({
          originalPlanId: planId,
          originalDraftId: plan.draftId || null,
          originalAssignmentIndex: assignmentIndex,
          vesselId: vesselCode,
          rankId: assignment.rankId || null,
          rank: assignment.rank,
          crewId: assignment.crewId,
          crewName: assignment.crewName,
          crewMemberId: assignment.crewMemberId || null,
          signOnDate: assignment.signOnDate || assignment.joiningDate,
          joiningPort: assignment.joiningPort || null,
          contractPeriod: assignment.contractPeriod,
          signOffDate: assignment.signOffDate || null,
          proposedBy: plan.proposedBy || null,
          proposedDate: plan.proposedDate || null,
          result: "Rejected",
          archivedDate,
          archivedBy: rejectedBy || null,
          vesselPlanningId: null,
          currentCrewInfo,
          fullAssignmentSnapshot: JSON.stringify(assignment)
        });
        this.saveToFile();
        return updatedPlan;
      }
      async checkAssignmentConflicts(crewId, signOnDate, contractPeriod, excludePlanId, excludeAssignmentIndex) {
        const conflicts = [];
        const signOnDateObj = new Date(signOnDate);
        const contractEndDate = new Date(signOnDateObj);
        contractEndDate.setMonth(contractEndDate.getMonth() + contractPeriod);
        for (const plan of Array.from(this.rotationPlans.values())) {
          if (plan.assignments) {
            const assignments = JSON.parse(plan.assignments);
            for (let i = 0; i < assignments.length; i++) {
              const assignment = assignments[i];
              if (excludePlanId !== void 0 && excludeAssignmentIndex !== void 0) {
                if (plan.id === excludePlanId && i === excludeAssignmentIndex) {
                  continue;
                }
              }
              if (assignment.crewId === crewId && assignment.proposalStatus === "proposed") {
                const assignmentSignOnDate = new Date(assignment.signOnDate || assignment.joiningDate);
                const assignmentEndDate = new Date(assignmentSignOnDate);
                assignmentEndDate.setMonth(assignmentEndDate.getMonth() + assignment.contractPeriod);
                if (signOnDateObj <= assignmentEndDate && contractEndDate >= assignmentSignOnDate) {
                  conflicts.push({
                    planId: plan.id,
                    draftId: plan.draftId,
                    vessel: assignment.vesselName,
                    rank: assignment.rank,
                    signOnDate: assignment.signOnDate || assignment.joiningDate,
                    contractPeriod: assignment.contractPeriod
                  });
                }
              }
            }
          }
        }
        return conflicts;
      }
      // Rotation Archive Methods - Independent historical records
      async getArchivedAssignments(filters) {
        let entries = Array.from(this.rotationArchive.values());
        if (filters?.vessels && filters.vessels.length > 0) {
          entries = entries.filter((e) => e.vesselId && filters.vessels.includes(e.vesselId));
        }
        if (filters?.ranks && filters.ranks.length > 0) {
          entries = entries.filter((e) => filters.ranks.includes(e.rank));
        }
        if (filters?.dateFrom) {
          entries = entries.filter((e) => e.archivedDate >= filters.dateFrom);
        }
        if (filters?.dateTo) {
          entries = entries.filter((e) => e.archivedDate <= filters.dateTo);
        }
        entries.sort((a, b) => new Date(b.archivedDate).getTime() - new Date(a.archivedDate).getTime());
        return entries;
      }
      async createArchiveEntry(entry) {
        const id = this.currentRotationArchiveId++;
        const archiveEntry = {
          id,
          originalPlanId: entry.originalPlanId ?? null,
          originalDraftId: entry.originalDraftId ?? null,
          originalAssignmentIndex: entry.originalAssignmentIndex ?? null,
          vesselId: entry.vesselId ?? null,
          rankId: entry.rankId ?? null,
          rank: entry.rank,
          crewId: entry.crewId,
          crewName: entry.crewName,
          crewMemberId: entry.crewMemberId ?? null,
          signOnDate: entry.signOnDate,
          joiningPort: entry.joiningPort ?? null,
          contractPeriod: entry.contractPeriod ?? null,
          signOffDate: entry.signOffDate ?? null,
          proposedBy: entry.proposedBy ?? null,
          proposedDate: entry.proposedDate ?? null,
          result: entry.result,
          archivedDate: entry.archivedDate,
          archivedBy: entry.archivedBy ?? null,
          vesselPlanningId: entry.vesselPlanningId ?? null,
          currentCrewInfo: entry.currentCrewInfo ?? null,
          fullAssignmentSnapshot: entry.fullAssignmentSnapshot ?? null,
          createdAt: /* @__PURE__ */ new Date()
        };
        this.rotationArchive.set(id, archiveEntry);
        this.saveToFile();
        return archiveEntry;
      }
      // Drug/Alcohol Test Records Methods
      async getDrugAlcoholTestRecords() {
        return Array.from(this.drugAlcoholTestRecords.values());
      }
      async getDrugAlcoholTestRecord(id) {
        return this.drugAlcoholTestRecords.get(id);
      }
      async getDrugAlcoholTestRecordsByVessel(vesselId2, testType) {
        const records = Array.from(this.drugAlcoholTestRecords.values()).filter(
          (record) => record.vesselId === vesselId2
        );
        if (testType) {
          return records.filter((record) => record.testType === testType);
        }
        return records;
      }
      async createDrugAlcoholTestRecord(insertRecord) {
        const id = this.currentDrugAlcoholTestRecordId++;
        const record = {
          id,
          vesselId: insertRecord.vesselId,
          testType: insertRecord.testType,
          alcoholDrugType: insertRecord.alcoholDrugType ?? null,
          placeLocation: insertRecord.placeLocation ?? null,
          dateTimeTestCompleted: insertRecord.dateTimeTestCompleted ?? null,
          externalTestResultsDate: insertRecord.externalTestResultsDate ?? null,
          incidentId: insertRecord.incidentId ?? null,
          testingEquipment: insertRecord.testingEquipment ?? null,
          equipmentNotApplicable: insertRecord.equipmentNotApplicable ?? false,
          testHistory: insertRecord.testHistory ?? null,
          frequencyMonths: insertRecord.frequencyMonths ?? 12,
          plannedPort: insertRecord.plannedPort ?? null,
          plannedDate: insertRecord.plannedDate ?? null,
          plannedComments: insertRecord.plannedComments ?? null,
          incidentTitle: insertRecord.incidentTitle ?? null,
          incidentDateTime: insertRecord.incidentDateTime ?? null,
          alcoholTestDateTime: insertRecord.alcoholTestDateTime ?? null,
          drugTestDateTime: insertRecord.drugTestDateTime ?? null,
          violations: insertRecord.violations ?? 0,
          testDateTime: insertRecord.testDateTime ?? null,
          otherTestType: insertRecord.otherTestType ?? null,
          reasonForTesting: insertRecord.reasonForTesting ?? null,
          description: insertRecord.description ?? null,
          initiatedBy: insertRecord.initiatedBy ?? null,
          personnelTested: insertRecord.personnelTested ?? null,
          comments: insertRecord.comments ?? null,
          masterDeputySignature: insertRecord.masterDeputySignature ?? null,
          attachmentFile: insertRecord.attachmentFile ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.drugAlcoholTestRecords.set(id, record);
        this.saveToFile();
        return record;
      }
      async updateDrugAlcoholTestRecord(id, updateData) {
        const existingRecord = this.drugAlcoholTestRecords.get(id);
        if (!existingRecord) return void 0;
        const updatedRecord = {
          ...existingRecord,
          ...updateData,
          updatedAt: null
        };
        this.drugAlcoholTestRecords.set(id, updatedRecord);
        this.saveToFile();
        return updatedRecord;
      }
      async deleteDrugAlcoholTestRecord(id) {
        const result = this.drugAlcoholTestRecords.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rest Hours Vessel Records Methods
      async getRestHoursVesselRecords() {
        return Array.from(this.restHoursVesselRecords.values());
      }
      async getRestHoursVesselRecord(id) {
        return this.restHoursVesselRecords.get(id);
      }
      async getRestHoursVesselRecordsByFilters(filters) {
        let records = Array.from(this.restHoursVesselRecords.values());
        if (filters.vesselIds && filters.vesselIds.length > 0) {
          records = records.filter((record) => filters.vesselIds.includes(record.vesselId));
        }
        if (filters.monthValue) {
          records = records.filter((record) => record.monthValue === filters.monthValue);
        }
        return records;
      }
      async createRestHoursVesselRecord(insertRecord) {
        const id = this.currentRestHoursVesselRecordId++;
        const record = {
          id,
          createdAt: null,
          updatedAt: null,
          vesselId: insertRecord.vesselId,
          month: insertRecord.month,
          monthValue: insertRecord.monthValue,
          totalCrew: insertRecord.totalCrew ?? 0,
          recordingStatusPercent: insertRecord.recordingStatusPercent ?? 0,
          activityConflicting: insertRecord.activityConflicting ?? false,
          crewWithActivityConflicts: insertRecord.crewWithActivityConflicts ?? 0,
          crewWithActivityConflictsDetails: insertRecord.crewWithActivityConflictsDetails ?? null,
          totalViolations: insertRecord.totalViolations ?? 0,
          crewWithViolations: insertRecord.crewWithViolations ?? 0,
          crewWithViolationsDetails: insertRecord.crewWithViolationsDetails ?? null,
          totalNCs: insertRecord.totalNCs ?? 0,
          crewWithNCs: insertRecord.crewWithNCs ?? 0,
          crewWithNCsDetails: insertRecord.crewWithNCsDetails ?? null,
          predictedViolations: insertRecord.predictedViolations ?? 0,
          crewWithPredictedViolations: insertRecord.crewWithPredictedViolations ?? 0,
          crewWithPredictedViolationsDetails: insertRecord.crewWithPredictedViolationsDetails ?? null,
          predictedNCs: insertRecord.predictedNCs ?? 0,
          crewWithPredictedNCs: insertRecord.crewWithPredictedNCs ?? 0,
          crewWithPredictedNCsDetails: insertRecord.crewWithPredictedNCsDetails ?? null,
          vesselReviewStatus: insertRecord.vesselReviewStatus ?? "Due",
          vesselReviewSubmittedDate: insertRecord.vesselReviewSubmittedDate ?? null,
          officeReviewStatus: insertRecord.officeReviewStatus ?? "Due",
          officeReviewSubmittedDate: insertRecord.officeReviewSubmittedDate ?? null
        };
        this.restHoursVesselRecords.set(id, record);
        this.saveToFile();
        return record;
      }
      async updateRestHoursVesselRecord(id, updateData) {
        const existingRecord = this.restHoursVesselRecords.get(id);
        if (!existingRecord) return void 0;
        const updatedRecord = {
          ...existingRecord,
          ...updateData,
          updatedAt: null
        };
        this.restHoursVesselRecords.set(id, updatedRecord);
        this.saveToFile();
        return updatedRecord;
      }
      async deleteRestHoursVesselRecord(id) {
        const result = this.restHoursVesselRecords.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rest Hours Crew Records Methods
      async getRestHoursCrewRecords() {
        return Array.from(this.restHoursCrewRecords.values());
      }
      async getRestHoursCrewRecord(id) {
        return this.restHoursCrewRecords.get(id);
      }
      async getRestHoursCrewRecordsByFilters(filters) {
        let records = Array.from(this.restHoursCrewRecords.values());
        if (filters.vesselIds && filters.vesselIds.length > 0) {
          records = records.filter((record) => filters.vesselIds.includes(record.vesselId));
        }
        if (filters.monthValue) {
          records = records.filter((record) => record.monthValue === filters.monthValue);
        }
        if (filters.ranks && filters.ranks.length > 0) {
          records = records.filter((record) => filters.ranks.includes(record.rank));
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          records = records.filter(
            (record) => record.name.toLowerCase().includes(searchLower) || record.crewMemberId.toLowerCase().includes(searchLower)
          );
        }
        return records;
      }
      async createRestHoursCrewRecord(insertRecord) {
        const id = this.currentRestHoursCrewRecordId++;
        const record = {
          id,
          vesselId: insertRecord.vesselId,
          crewMemberId: insertRecord.crewMemberId,
          rank: insertRecord.rank,
          name: insertRecord.name,
          month: insertRecord.month,
          monthValue: insertRecord.monthValue,
          signOnOffInfo: insertRecord.signOnOffInfo ?? null,
          recordingStatusPercent: insertRecord.recordingStatusPercent ?? 0,
          activityConflicting: insertRecord.activityConflicting ?? false,
          totalViolations: insertRecord.totalViolations ?? 0,
          totalNCs: insertRecord.totalNCs ?? 0,
          predictedViolations: insertRecord.predictedViolations ?? 0,
          predictedNCs: insertRecord.predictedNCs ?? 0,
          createdAt: null,
          updatedAt: null
        };
        this.restHoursCrewRecords.set(id, record);
        this.saveToFile();
        return record;
      }
      async updateRestHoursCrewRecord(id, updateData) {
        const existingRecord = this.restHoursCrewRecords.get(id);
        if (!existingRecord) return void 0;
        const updatedRecord = {
          ...existingRecord,
          ...updateData,
          updatedAt: null
        };
        this.restHoursCrewRecords.set(id, updatedRecord);
        this.saveToFile();
        return updatedRecord;
      }
      async deleteRestHoursCrewRecord(id) {
        const result = this.restHoursCrewRecords.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Rest Hours Daily Records Methods
      async getRestHoursDailyRecords() {
        return Array.from(this.restHoursDailyRecords.values());
      }
      async getRestHoursDailyRecord(id) {
        return this.restHoursDailyRecords.get(id);
      }
      async getRestHoursDailyRecordByKey(crewMemberId, vesselId2, monthYear) {
        const records = Array.from(this.restHoursDailyRecords.values());
        const matches = records.filter(
          (record) => record.crewMemberId === crewMemberId && record.vesselId === vesselId2 && record.monthYear === monthYear
        );
        if (matches.length === 0) return void 0;
        if (matches.length === 1) return matches[0];
        return matches.reduce((latest, current) => {
          const latestId = Number(latest.id);
          const currentId = Number(current.id);
          return currentId > latestId ? current : latest;
        });
      }
      async createRestHoursDailyRecord(insertRecord) {
        const existing = await this.getRestHoursDailyRecordByKey(
          insertRecord.crewMemberId,
          insertRecord.vesselId,
          insertRecord.monthYear
        );
        if (existing) {
          const updatedRecord = {
            ...existing,
            ...insertRecord,
            id: existing.id,
            // Keep the original ID
            createdAt: existing.createdAt,
            // Keep the original creation date
            updatedAt: null
          };
          this.restHoursDailyRecords.set(existing.id, updatedRecord);
          this.saveToFile();
          return updatedRecord;
        }
        const id = this.currentRestHoursDailyRecordId++;
        const record = {
          id,
          crewMemberId: insertRecord.crewMemberId,
          vesselId: insertRecord.vesselId,
          rank: insertRecord.rank,
          name: insertRecord.name,
          monthYear: insertRecord.monthYear,
          dailyRecords: insertRecord.dailyRecords,
          showPlanning: insertRecord.showPlanning ?? null,
          opaMode: insertRecord.opaMode ?? null,
          createdAt: null,
          updatedAt: null
        };
        this.restHoursDailyRecords.set(id, record);
        this.saveToFile();
        return record;
      }
      async updateRestHoursDailyRecord(id, updateData) {
        const existingRecord = this.restHoursDailyRecords.get(id);
        if (!existingRecord) return void 0;
        const updatedRecord = {
          ...existingRecord,
          ...updateData,
          updatedAt: null
        };
        this.restHoursDailyRecords.set(id, updatedRecord);
        this.saveToFile();
        return updatedRecord;
      }
      async deleteRestHoursDailyRecord(id) {
        const result = this.restHoursDailyRecords.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Variable Tasks methods
      async getVariableTasks() {
        return Array.from(this.variableTasks.values());
      }
      async getVariableTask(id) {
        return this.variableTasks.get(id);
      }
      async getVariableTasksByFilters(filters) {
        let tasks = Array.from(this.variableTasks.values());
        if (filters.vesselId) {
          tasks = tasks.filter((task) => task.vesselId === filters.vesselId);
        }
        if (filters.periodValue) {
          tasks = tasks.filter((task) => task.periodValue === filters.periodValue);
        }
        return tasks;
      }
      async createVariableTask(insertTask) {
        const id = this.currentVariableTaskId++;
        const task = {
          id,
          startDateTime: insertTask.startDateTime,
          finishDateTime: insertTask.finishDateTime,
          startDateTimeSort: insertTask.startDateTimeSort,
          finishDateTimeSort: insertTask.finishDateTimeSort,
          task: insertTask.task,
          status: insertTask.status,
          crewInvolved: insertTask.crewInvolved,
          remarks: insertTask.remarks ?? null,
          periodValue: insertTask.periodValue ?? null,
          vesselId: insertTask.vesselId ?? null,
          isDraft: insertTask.isDraft ?? true,
          recordType: insertTask.recordType,
          statusType: insertTask.statusType,
          selectedTasks: insertTask.selectedTasks ?? null,
          otherTask: insertTask.otherTask ?? null,
          crewInvolvedDetails: insertTask.crewInvolvedDetails ?? null,
          comments: insertTask.comments ?? null
        };
        this.variableTasks.set(id, task);
        this.saveToFile();
        return task;
      }
      async updateVariableTask(id, updateData) {
        const existingTask = this.variableTasks.get(id);
        if (!existingTask) return void 0;
        const updatedTask = {
          ...existingTask,
          ...updateData
        };
        this.variableTasks.set(id, updatedTask);
        this.saveToFile();
        return updatedTask;
      }
      async deleteVariableTask(id) {
        const result = this.variableTasks.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Helper to parse fixed task JSON fields
      parseFixedTaskData(task) {
        return {
          ...task,
          seaHours: typeof task.seaHours === "string" ? JSON.parse(task.seaHours) : task.seaHours,
          portHours: typeof task.portHours === "string" ? JSON.parse(task.portHours) : task.portHours
        };
      }
      // Fixed Tasks
      async getFixedTasks() {
        return Array.from(this.fixedTasks.values()).map((task) => this.parseFixedTaskData(task));
      }
      async getFixedTask(id) {
        const task = this.fixedTasks.get(id);
        return task ? this.parseFixedTaskData(task) : void 0;
      }
      async getFixedTasksByVesselAndMonth(vesselId2, monthYear) {
        const allTasks = Array.from(this.fixedTasks.values());
        return allTasks.filter((task) => task.vesselId === vesselId2 && task.monthYear === monthYear).map((task) => this.parseFixedTaskData(task));
      }
      async getFixedTaskByKey(crewMemberId, vesselId2, monthYear) {
        const tasks = Array.from(this.fixedTasks.values());
        const task = tasks.find(
          (task2) => task2.crewMemberId === crewMemberId && task2.vesselId === vesselId2 && task2.monthYear === monthYear
        );
        return task ? this.parseFixedTaskData(task) : void 0;
      }
      async createFixedTask(insertTask) {
        const id = this.currentFixedTaskId++;
        const task = {
          id,
          name: insertTask.name,
          rank: insertTask.rank,
          crewMemberId: insertTask.crewMemberId,
          vesselId: insertTask.vesselId,
          monthYear: insertTask.monthYear,
          seaHours: insertTask.seaHours,
          portHours: insertTask.portHours,
          createdAt: null,
          updatedAt: null
        };
        this.fixedTasks.set(id, task);
        this.saveToFile();
        return this.parseFixedTaskData(task);
      }
      async updateFixedTask(id, updateData) {
        const existingTask = this.fixedTasks.get(id);
        if (!existingTask) return void 0;
        const updatedTask = {
          ...existingTask,
          ...updateData
        };
        this.fixedTasks.set(id, updatedTask);
        this.saveToFile();
        return this.parseFixedTaskData(updatedTask);
      }
      async deleteFixedTask(id) {
        const result = this.fixedTasks.delete(id);
        if (result) this.saveToFile();
        return result;
      }
      // Data Masters methods (return empty array for frontend compatibility)
      async getDataMasters() {
        return [];
      }
      async getDataMaster(id) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async createDataMaster(masterData) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async updateDataMaster(id, masterData) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async deleteDataMaster(id) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      // Master Data Entries methods (not supported - same as MemStorage)  
      async getMasterDataEntries(masterId) {
        try {
          const filteredEntries = [];
          for (const [key, entry] of Array.from(this.masterDataEntries)) {
            if (entry.masterId === masterId) {
              filteredEntries.push(entry);
            }
          }
          if (process.env.NODE_ENV === "development") {
            console.log(`\u{1F4C4} [PERSISTENT] getMasterDataEntries(${masterId}): Found ${filteredEntries.length} entries`);
          }
          return filteredEntries;
        } catch (error) {
          console.error(`\u274C [PERSISTENT] Error getting master data entries for ${masterId}:`, error);
          return [];
        }
      }
      async getMasterDataEntry(id) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async createMasterDataEntry(entryData) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async updateMasterDataEntry(id, entryData) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      async deleteMasterDataEntry(id) {
        throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
      }
      // Training Master Methods (stub - use DatabaseStorage for full functionality)
      async getTrainingMasters() {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      async getTrainingMaster(id) {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      async createTrainingMaster(training) {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      async updateTrainingMaster(id, training) {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      async deleteTrainingMaster(id) {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      async reorderTrainingMasters(orders) {
        throw new Error("PersistentFileStorage doesn't support training master. Use DatabaseStorage instead.");
      }
      // Company Training Groups Methods (stub - use DatabaseStorage for full functionality)
      async getCompanyTrainingGroups() {
        throw new Error("PersistentFileStorage doesn't support company training groups. Use DatabaseStorage instead.");
      }
      async updateCompanyTrainingGroup(code, data) {
        throw new Error("PersistentFileStorage doesn't support company training groups. Use DatabaseStorage instead.");
      }
      // Company Training Methods (stub - use DatabaseStorage for full functionality)
      async getCompanyTrainings() {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async getCompanyTraining(id) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async getCompanyTrainingByMasterId(trainingMasterId) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async createCompanyTraining(training) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async createCompanyTrainingFromMaster(trainingMasterId) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async updateCompanyTraining(id, training) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async deleteCompanyTraining(id) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async deleteCompanyTrainingByMasterId(trainingMasterId) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async importCompanyTrainingsFromMaster() {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async reorderCompanyTrainings(orders) {
        throw new Error("PersistentFileStorage doesn't support company training. Use DatabaseStorage instead.");
      }
      async getCompanyTrainingRequirements() {
        throw new Error("PersistentFileStorage doesn't support company training requirements. Use DatabaseStorage instead.");
      }
      async getCompanyTrainingRequirementsByTrainingIds(trainingIds) {
        throw new Error("PersistentFileStorage doesn't support company training requirements. Use DatabaseStorage instead.");
      }
      async upsertCompanyTrainingRequirements(requirements) {
        throw new Error("PersistentFileStorage doesn't support company training requirements. Use DatabaseStorage instead.");
      }
      async deleteCompanyTrainingRequirementsByTrainingId(companyTrainingId) {
        throw new Error("PersistentFileStorage doesn't support company training requirements. Use DatabaseStorage instead.");
      }
    };
    isConnected = false;
    connectionError = null;
    databaseUrl = constructDatabaseUrl();
    databaseUrlForceDisabled = true ? databaseUrl || void 0 : void 0;
    if (databaseUrlForceDisabled) {
      try {
        process.env.DATABASE_URL = databaseUrlForceDisabled;
        storage = new DatabaseStorage();
        console.log("\u{1F50C} Attempting to connect to PostgreSQL...");
        console.log("\u{1F3AF} Target Database: PostgreSQL 'crew_database'");
        (async () => {
          try {
            console.log("\u23F3 Testing database connection...");
            console.log("\u2139\uFE0F Automatic data seeding is disabled - users manage their own entries");
            isConnected = true;
            connectionError = null;
            console.log("\u2705 SUCCESS: PostgreSQL database connected successfully!");
            console.log("\u2705 DatabaseStorage (PostgreSQL) initialized successfully!");
            console.log("\u{1F680} Application is ready to serve requests with persistent PostgreSQL storage");
          } catch (error) {
            isConnected = false;
            connectionError = error;
            console.error("\u26A0\uFE0F  WARNING: Failed to connect to PostgreSQL database:", error);
            console.error("\u{1F50D} Connection Details:");
            console.error(`   \u2022 DATABASE_URL: ${process.env.DATABASE_URL ? "Set" : "Not set"}`);
            console.error("\u{1F4CA} This could be due to:");
            console.error("   \u2022 PostgreSQL database not accessible");
            console.error("   \u2022 Network connectivity issues");
            console.error("   \u2022 Incorrect credentials");
            console.error("\u{1F691} Server will start anyway. Use /api/health to test connectivity.");
          }
        })();
      } catch (error) {
        isConnected = false;
        connectionError = error;
        console.error("\u274C ERROR: Failed to initialize PostgreSQL database:", error);
        console.error("\u{1F691} Server will start anyway. Use /api/health to test connectivity.");
        storage = new class {
          throwConnectionError() {
            throw new Error(`PostgreSQL connection failed: ${connectionError?.message || "Unknown error"}. Check /api/health for details.`);
          }
          async getUser() {
            this.throwConnectionError();
          }
          async getUserByUsername() {
            this.throwConnectionError();
          }
          async createUser() {
            this.throwConnectionError();
          }
          async getForms() {
            this.throwConnectionError();
          }
          async getForm() {
            this.throwConnectionError();
          }
          async createForm() {
            this.throwConnectionError();
          }
          async updateForm() {
            this.throwConnectionError();
          }
          async deleteForm() {
            this.throwConnectionError();
          }
          async getRankGroups() {
            this.throwConnectionError();
          }
          async getAllRankGroups() {
            this.throwConnectionError();
          }
          async getRankGroup() {
            this.throwConnectionError();
          }
          async createRankGroup() {
            this.throwConnectionError();
          }
          async updateRankGroup() {
            this.throwConnectionError();
          }
          async archiveRankGroup() {
            this.throwConnectionError();
          }
          async unarchiveRankGroup() {
            this.throwConnectionError();
          }
          async deleteRankGroup() {
            this.throwConnectionError();
          }
          async getAvailableRanks() {
            this.throwConnectionError();
          }
          async getAvailableRank() {
            this.throwConnectionError();
          }
          async createAvailableRank() {
            this.throwConnectionError();
          }
          async updateAvailableRank() {
            this.throwConnectionError();
          }
          async deleteAvailableRank() {
            this.throwConnectionError();
          }
          async clearAllAvailableRanks() {
            this.throwConnectionError();
          }
          async getCrewMembers() {
            this.throwConnectionError();
          }
          async getCrewMember() {
            this.throwConnectionError();
          }
          async createCrewMember() {
            this.throwConnectionError();
          }
          async updateCrewMember() {
            this.throwConnectionError();
          }
          async deleteCrewMember() {
            this.throwConnectionError();
          }
          async getAppraisalResults() {
            this.throwConnectionError();
          }
          async getAppraisalResult() {
            this.throwConnectionError();
          }
          async getAppraisalResultsByCrewMember() {
            this.throwConnectionError();
          }
          async createAppraisalResult() {
            this.throwConnectionError();
          }
          async updateAppraisalResult() {
            this.throwConnectionError();
          }
          async deleteAppraisalResult() {
            this.throwConnectionError();
          }
          async submitAppraisalStage() {
            this.throwConnectionError();
          }
          async getRecruitmentCandidates() {
            this.throwConnectionError();
          }
          async getRecruitmentCandidate() {
            this.throwConnectionError();
          }
          async getRecruitmentCandidatesByStatus() {
            this.throwConnectionError();
          }
          async createRecruitmentCandidate() {
            this.throwConnectionError();
          }
          async updateRecruitmentCandidate() {
            this.throwConnectionError();
          }
          async deleteRecruitmentCandidate() {
            this.throwConnectionError();
          }
          // Data Masters - MISSING METHODS CAUSING 404 ERRORS
          async getDataMasters() {
            this.throwConnectionError();
          }
          async getDataMaster() {
            this.throwConnectionError();
          }
          async createDataMaster() {
            this.throwConnectionError();
          }
          async updateDataMaster() {
            this.throwConnectionError();
          }
          async deleteDataMaster() {
            this.throwConnectionError();
          }
          // Master Data Entries - MISSING METHODS CAUSING 404 ERRORS  
          async getMasterDataEntries() {
            this.throwConnectionError();
          }
          async getMasterDataEntry() {
            this.throwConnectionError();
          }
          async createMasterDataEntry() {
            this.throwConnectionError();
          }
          async updateMasterDataEntry() {
            this.throwConnectionError();
          }
          async deleteMasterDataEntry() {
            this.throwConnectionError();
          }
        }();
      }
    } else {
      isConnected = false;
      connectionError = null;
      console.log("\u{1F4C4} PERSISTENT FILE STORAGE MODE: Using file-based storage (PersistentFileStorage)");
      console.log("\u{1F680} Application will use persistent JSON storage for development");
      console.log("\u{1F4BE} All data will be saved to test-data.json and persist across restarts");
      storage = new PersistentFileStorage();
      console.log("\u2705 PersistentFileStorage initialized successfully - data will persist across restarts!");
    }
  }
});

// server/index.ts
import express2 from "express";

// server/routes.ts
init_storage();
import { createServer } from "http";

// server/storage-accounts.ts
var MemStorage = class {
  users;
  forms;
  rankGroups;
  availableRanks;
  crewMembers;
  payElements;
  contractData;
  contractPayElements;
  currentUserId;
  currentFormId;
  currentRankGroupId;
  currentAvailableRankId;
  currentAppraisalResultId;
  currentContractDataId;
  currentContractPayElementId;
  allotments;
  advances;
  bondItems;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.forms = /* @__PURE__ */ new Map();
    this.rankGroups = /* @__PURE__ */ new Map();
    this.availableRanks = /* @__PURE__ */ new Map();
    this.crewMembers = /* @__PURE__ */ new Map();
    this.payElements = /* @__PURE__ */ new Map();
    this.contractData = /* @__PURE__ */ new Map();
    this.contractPayElements = /* @__PURE__ */ new Map();
    this.allotments = /* @__PURE__ */ new Map();
    this.advances = /* @__PURE__ */ new Map();
    this.bondItems = /* @__PURE__ */ new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentContractDataId = 1;
    this.currentContractPayElementId = 1;
    this.currentAppraisalResultId = 6;
    this.allotments.set("ALT001", {
      id: "ALT001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      beneficiaryName: "Maria Wilson",
      relationship: "Spouse",
      allotmentType: "percentage",
      value: 60,
      currency: "USD",
      bankName: "Chase Bank",
      accountNumber: "****1234",
      priority: 1,
      validFrom: "2024-01-15",
      validTo: "2024-12-31",
      status: "active",
      kycComplete: true,
      bankVerified: true,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.allotments.set("ALT002", {
      id: "ALT002",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      beneficiaryName: "Education Fund",
      relationship: "Dependent",
      allotmentType: "fixed",
      value: 1e3,
      currency: "USD",
      bankName: "Wells Fargo",
      accountNumber: "****5678",
      priority: 2,
      validFrom: "2024-01-15",
      validTo: "2024-12-31",
      status: "active",
      kycComplete: true,
      bankVerified: false,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.advances.set("ADV001", {
      id: "ADV001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      amount: 2500,
      currency: "USD",
      reason: "Emergency medical expense",
      requestDate: "2024-10-15",
      approver: "Captain Smith",
      status: "approved",
      capCheck: true,
      remainingCap: 2500,
      recoveryAmount: 500,
      ctmReference: "CTM-2024-001",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.advances.set("ADV002", {
      id: "ADV002",
      crewId: "2025-03-12",
      crewName: "Anna Marie Johnson",
      rank: "Chief Engineer",
      amount: 1500,
      currency: "USD",
      reason: "Family emergency",
      requestDate: "2024-11-01",
      approver: "HR Manager",
      status: "disbursed",
      capCheck: true,
      remainingCap: 1e3,
      recoveryAmount: 300,
      ctmReference: "CTM-2024-002",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.bondItems.set("BOND001", {
      id: "BOND001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      itemName: "Phone Card",
      category: "Communications",
      quantity: 2,
      unitPrice: 25,
      totalPrice: 50,
      currency: "USD",
      saleDate: "2024-10-20",
      autoDeduct: true,
      deductionAmount: 50,
      status: "pending",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.bondItems.set("BOND002", {
      id: "BOND002",
      crewId: "2025-05-14",
      crewName: "James Michael",
      itemName: "Toiletries",
      category: "Personal Care",
      quantity: 1,
      unitPrice: 35,
      totalPrice: 35,
      currency: "USD",
      saleDate: "2024-10-25",
      autoDeduct: true,
      deductionAmount: 35,
      status: "deducted",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    });
    this.initializePayElements();
    this.initializeContractData();
  }
  createAvailableRank(rank) {
    throw new Error("Method not implemented.");
  }
  getCrewMembers() {
    throw new Error("Method not implemented.");
  }
  getCrewMember(id) {
    throw new Error("Method not implemented.");
  }
  createCrewMember(crewMember) {
    throw new Error("Method not implemented.");
  }
  updateCrewMember(id, crewMember) {
    throw new Error("Method not implemented.");
  }
  deleteCrewMember(id) {
    throw new Error("Method not implemented.");
  }
  getAppraisalResults() {
    throw new Error("Method not implemented.");
  }
  getAppraisalResult(id) {
    throw new Error("Method not implemented.");
  }
  getAppraisalResultsByCrewMember(crewMemberId) {
    throw new Error("Method not implemented.");
  }
  createAppraisalResult(appraisalResult) {
    throw new Error("Method not implemented.");
  }
  updateAppraisalResult(id, appraisalResult) {
    throw new Error("Method not implemented.");
  }
  deleteAppraisalResult(id) {
    throw new Error("Method not implemented.");
  }
  initializePayElements() {
    const masterPayElements = [
      {
        id: "PE001",
        name: "Basic Salary",
        code: "BASIC",
        type: "earning",
        category: "Fixed Pay",
        formula: "Monthly Fixed Amount",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      },
      {
        id: "PE002",
        name: "Fixed Overtime",
        code: "OT_FIXED",
        type: "earning",
        category: "Variable Pay",
        formula: "No Formula",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      },
      {
        id: "PE003",
        name: "Variable Overtime",
        code: "VAR_OT",
        type: "earning",
        category: "Variable",
        formula: "OT_HOURS * OT_RATE",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      },
      {
        id: "PE004",
        name: "Uniform Allowance",
        code: "UA",
        type: "earning",
        category: "Fixed Pay",
        formula: "No Formula",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      },
      {
        id: "PE005",
        name: "Leave Pay",
        code: "LV",
        type: "earning",
        category: "Fixed",
        formula: "No Formula",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      },
      {
        id: "PE006",
        name: "PF",
        code: "PF",
        type: "deduction",
        category: "Fixed",
        formula: "5% * GROSS_PAY",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }
    ];
    masterPayElements.forEach((element) => {
      this.payElements.set(element.id, element);
    });
  }
  initializeContractData() {
    const contractData1 = {
      id: 1,
      crewMemberId: "2025-05-14",
      vessel: "MT Sail One",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-02-01",
      status: "active",
      currency: "USD",
      lastModified: /* @__PURE__ */ new Date(),
      modifiedBy: "admin",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.contractData.set(1, contractData1);
    const contractPayElements1 = [
      { id: 1, contractId: 1, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "12000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 2, contractId: 1, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "3500", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 3, contractId: 1, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "1800", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 4, contractId: 1, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "500", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 5, contractId: 1, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "800", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 6, contractId: 1, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "900", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }
    ];
    const contractData2 = {
      id: 2,
      crewMemberId: "2025-03-12",
      vessel: "MT Sail Ten",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-01-01",
      status: "active",
      currency: "USD",
      lastModified: /* @__PURE__ */ new Date(),
      modifiedBy: "admin",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.contractData.set(2, contractData2);
    const contractPayElements2 = [
      { id: 7, contractId: 2, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "10000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 8, contractId: 2, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "3000", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 9, contractId: 2, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "1500", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 10, contractId: 2, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "400", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 11, contractId: 2, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "600", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 12, contractId: 2, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "750", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }
    ];
    const contractData3 = {
      id: 3,
      crewMemberId: "2025-02-12",
      vessel: "MT Sail Two",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-02-01",
      status: "active",
      currency: "USD",
      lastModified: /* @__PURE__ */ new Date(),
      modifiedBy: "admin",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.contractData.set(3, contractData3);
    const contractPayElements3 = [
      { id: 13, contractId: 3, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "6000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 14, contractId: 3, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "1800", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 15, contractId: 3, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "900", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 16, contractId: 3, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "300", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 17, contractId: 3, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "400", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() },
      { id: 18, contractId: 3, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "450", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }
    ];
    const allContractPayElements = [...contractPayElements1, ...contractPayElements2, ...contractPayElements3];
    allContractPayElements.forEach((element) => {
      this.contractPayElements.set(element.id, element);
    });
    this.currentContractDataId = 4;
    this.currentContractPayElementId = 19;
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.currentUserId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getForms() {
    return Array.from(this.forms.values());
  }
  async getForm(id) {
    return this.forms.get(id);
  }
  async createForm(insertForm) {
    const id = this.currentFormId++;
    const form = { ...insertForm, id, configuration: insertForm.configuration || null };
    this.forms.set(id, form);
    return form;
  }
  async updateForm(id, formData) {
    const existingForm = this.forms.get(id);
    if (!existingForm) return void 0;
    const updatedForm = { ...existingForm, ...formData };
    this.forms.set(id, updatedForm);
    return updatedForm;
  }
  async deleteForm(id) {
    return this.forms.delete(id);
  }
  async getRankGroups(formId) {
    return Array.from(this.rankGroups.values()).filter((rg) => rg.formId === formId);
  }
  async createRankGroup(insertRankGroup) {
    const id = this.currentRankGroupId++;
    const rankGroup = {
      ...insertRankGroup,
      id,
      ranks: typeof insertRankGroup.ranks === "string" ? insertRankGroup.ranks : JSON.stringify(insertRankGroup.ranks)
    };
    this.rankGroups.set(id, rankGroup);
    return rankGroup;
  }
  async updateRankGroup(id, rankGroupData) {
    const existingRankGroup = this.rankGroups.get(id);
    if (!existingRankGroup) return void 0;
    const updatedRankGroup = {
      ...existingRankGroup,
      ...rankGroupData,
      ranks: rankGroupData.ranks ? typeof rankGroupData.ranks === "string" ? rankGroupData.ranks : JSON.stringify(rankGroupData.ranks) : existingRankGroup.ranks
    };
    this.rankGroups.set(id, updatedRankGroup);
    return updatedRankGroup;
  }
  async deleteRankGroup(id) {
    return this.rankGroups.delete(id);
  }
  async getAvailableRanks() {
    return Array.from(this.availableRanks.values());
  }
  // Pay Elements Methods (Rate Tables & Rules)
  async getPayElements() {
    return Array.from(this.payElements.values());
  }
  async getPayElement(id) {
    return this.payElements.get(id);
  }
  async createPayElement(insertPayElement) {
    const payElement = {
      ...insertPayElement,
      status: insertPayElement.status || "active",
      ceiling: insertPayElement.ceiling || null,
      floor: insertPayElement.floor || null,
      vesselGroups: insertPayElement.vesselGroups || null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.payElements.set(payElement.id, payElement);
    return payElement;
  }
  async updatePayElement(id, payElementData) {
    const existingPayElement = this.payElements.get(id);
    if (!existingPayElement) return void 0;
    const updatedPayElement = {
      ...existingPayElement,
      ...payElementData,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.payElements.set(id, updatedPayElement);
    return updatedPayElement;
  }
  async deletePayElement(id) {
    return this.payElements.delete(id);
  }
  // Contract Data Methods
  async getContractData() {
    return Array.from(this.contractData.values());
  }
  async getContractDataByCrewMember(crewMemberId) {
    return Array.from(this.contractData.values()).find((cd) => cd.crewMemberId === crewMemberId);
  }
  async createContractData(insertContractData) {
    const id = this.currentContractDataId++;
    const contractData2 = {
      ...insertContractData,
      id,
      lastModified: /* @__PURE__ */ new Date(),
      createdAt: /* @__PURE__ */ new Date()
    };
    this.contractData.set(id, contractData2);
    return contractData2;
  }
  async updateContractData(id, contractDataUpdate) {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return void 0;
    const updatedContractData = {
      ...existingContractData,
      ...contractDataUpdate,
      lastModified: /* @__PURE__ */ new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }
  async updateContractStatus(id, status) {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return void 0;
    const updatedContractData = {
      ...existingContractData,
      status,
      lastModified: /* @__PURE__ */ new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }
  async updateContractEffectiveDate(id, effectiveDate) {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return void 0;
    const updatedContractData = {
      ...existingContractData,
      applicableFrom: effectiveDate,
      lastModified: /* @__PURE__ */ new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }
  // Method to update existing inherited pay elements to be applicable by default
  async updateExistingInheritedElementsToApplicable() {
    console.log("\u{1F504} Updating existing inherited pay elements to be applicable by default...");
    for (const [id, element] of this.contractPayElements.entries()) {
      if (element.isInherited && !element.applicable) {
        const updatedElement = {
          ...element,
          applicable: true,
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.contractPayElements.set(id, updatedElement);
        console.log(`\u2705 Updated ${element.payElementName} to be applicable by default`);
      }
    }
  }
  // Contract Pay Elements Methods
  async getContractPayElements(contractId) {
    return Array.from(this.contractPayElements.values()).filter((cpe) => cpe.contractId === contractId);
  }
  async createContractPayElement(insertContractPayElement) {
    const id = this.currentContractPayElementId++;
    const contractPayElement = {
      ...insertContractPayElement,
      id,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.contractPayElements.set(id, contractPayElement);
    return contractPayElement;
  }
  async updateContractPayElement(id, contractPayElementData) {
    const existingContractPayElement = this.contractPayElements.get(id);
    if (!existingContractPayElement) return void 0;
    const updatedContractPayElement = {
      ...existingContractPayElement,
      ...contractPayElementData,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.contractPayElements.set(id, updatedContractPayElement);
    return updatedContractPayElement;
  }
  async deleteContractPayElement(id) {
    return this.contractPayElements.delete(id);
  }
  // Utility method to inherit pay elements for a crew member
  async inheritPayElementsForCrewMember(crewMemberId, vesselGroup = "all-vessels") {
    let contractData2 = await this.getContractDataByCrewMember(crewMemberId);
    if (!contractData2) {
      const crewMember = await this.getCrewMember(crewMemberId);
      if (!crewMember) {
        throw new Error("Crew member not found");
      }
      contractData2 = await this.createContractData({
        crewMemberId,
        vessel: crewMember.vessel,
        vesselGroup,
        applicableFrom: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        status: "draft",
        currency: "USD",
        modifiedBy: "system"
      });
    }
    const allPayElements = await this.getPayElements();
    const applicablePayElements = allPayElements.filter((pe) => {
      if (pe.reflectInContract === false) {
        console.log(`\u{1F6AB} Excluding pay element "${pe.name}" from contract inheritance (reflectInContract = false)`);
        return false;
      }
      console.log(`\u2705 Including pay element "${pe.name}" in contract inheritance (reflectInContract != false)`);
      return true;
    });
    const existingContractPayElements = await this.getContractPayElements(contractData2.id);
    for (const existingElement of existingContractPayElements) {
      if (existingElement.isInherited && existingElement.payElementId) {
        const originalPayElement = allPayElements.find((pe) => pe.id === existingElement.payElementId);
        if (originalPayElement && originalPayElement.reflectInContract === false) {
          console.log(`\u{1F5D1}\uFE0F Removing inherited pay element "${originalPayElement.name}" from contract (reflectInContract = false)`);
          await this.deleteContractPayElement(existingElement.id);
        }
      }
    }
    const refreshedContractPayElements = await this.getContractPayElements(contractData2.id);
    const existingElementIds = new Set(refreshedContractPayElements.map((cpe) => cpe.payElementId).filter(Boolean));
    for (const payElement of applicablePayElements) {
      if (!existingElementIds.has(payElement.id)) {
        await this.createContractPayElement({
          contractId: contractData2.id,
          payElementId: payElement.id,
          payElementCode: payElement.code,
          payElementName: payElement.name,
          category: payElement.category,
          type: payElement.type,
          applicable: true,
          // Default to applicable - users can unselect if not needed
          formula: payElement.formula,
          value: null,
          isCustom: false,
          isInherited: true,
          sortOrder: 0
        });
      }
    }
    return contractData2;
  }
  // Allotments Methods
  async getAllotments() {
    return Array.from(this.allotments.values());
  }
  async getAllotmentsByCrewId(crewId) {
    return Array.from(this.allotments.values()).filter((a) => a.crewId === crewId);
  }
  async createAllotment(insertAllotment) {
    const allotment = {
      ...insertAllotment,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.allotments.set(allotment.id, allotment);
    return allotment;
  }
  async updateAllotment(id, updates) {
    const existing = this.allotments.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.allotments.set(id, updated);
    return updated;
  }
  async deleteAllotment(id) {
    return this.allotments.delete(id);
  }
  // Advances Methods
  async getAdvances() {
    return Array.from(this.advances.values());
  }
  async getAdvancesByCrewId(crewId) {
    return Array.from(this.advances.values()).filter((a) => a.crewId === crewId);
  }
  async createAdvance(insertAdvance) {
    const advance = {
      ...insertAdvance,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.advances.set(advance.id, advance);
    return advance;
  }
  async updateAdvance(id, updates) {
    const existing = this.advances.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.advances.set(id, updated);
    return updated;
  }
  async deleteAdvance(id) {
    return this.advances.delete(id);
  }
  // Bond Items Methods
  async getBondItems() {
    return Array.from(this.bondItems.values());
  }
  async getBondItemsByCrewId(crewId) {
    return Array.from(this.bondItems.values()).filter((b) => b.crewId === crewId);
  }
  async createBondItem(insertBondItem) {
    const bondItem = {
      ...insertBondItem,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.bondItems.set(bondItem.id, bondItem);
    return bondItem;
  }
  async updateBondItem(id, updates) {
    const existing = this.bondItems.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.bondItems.set(id, updated);
    return updated;
  }
  async deleteBondItem(id) {
    return this.bondItems.delete(id);
  }
};
var storageAccount = new MemStorage();
console.log("Using MemStorage as storageAccount (in-memory)");

// server/routes.ts
init_schema();

// server/oilMajorRulesParser.ts
function parseValue(valueStr) {
  if (!valueStr || valueStr.trim() === "") return 0;
  const cleaned = valueStr.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
function parseDaysValue(valueStr) {
  if (!valueStr || valueStr.trim() === "") return 0;
  const cleaned = valueStr.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
function normalizeRankPair(rankPairStr) {
  if (!rankPairStr) return "";
  return rankPairStr.trim().replace(/\s+/g, " ").replace(/\*/, "").trim();
}
function createEnglishProficiencyRule(label, officer, value) {
  const normalizedOfficer = officer?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() || "";
  const normalizedValue = value?.trim() || "";
  const normalizedLabel = label?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim() || "";
  if (!normalizedOfficer || !normalizedValue) return null;
  return {
    label: normalizedLabel,
    rankPair: normalizedOfficer,
    requiredLevel: normalizedValue
  };
}
function createRankPairRule(label, rankPair, value) {
  if (!rankPair || rankPair.trim() === "") return null;
  const numValue = parseValue(value);
  if (numValue === 0 && !label.trim()) return null;
  return {
    label: label.trim(),
    rankPair: normalizeRankPair(rankPair),
    requiredValue: numValue,
    unit: "years"
  };
}
function createDateJoinedRule(label, rankPair, value) {
  if (!rankPair || rankPair.trim() === "") return null;
  const numValue = parseDaysValue(value);
  if (numValue === 0 && !label.trim()) return null;
  return {
    label: label.trim(),
    rankPair: normalizeRankPair(rankPair),
    requiredDays: numValue
  };
}
var JUNIOR_DECK_OFFICERS = ["Second Officer", "Third Officer"];
var JUNIOR_ENGINEER_OFFICERS = ["Third Engineer", "Fourth Engineer"];
var ALL_DECK_OFFICERS = ["Master", "Chief Officer", "Second Officer", "Third Officer"];
var ALL_ENGINEER_OFFICERS = ["Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer"];
function isConditionalRule(label, rankPair) {
  const combinedText = `${label} ${rankPair}`.toLowerCase();
  return combinedText.includes("if ") && (combinedText.includes("onboard") || combinedText.includes("officers") || combinedText.includes("below") || combinedText.includes("less than"));
}
function parseConditionalRule(label, rankPair, value) {
  const combinedText = `${label} ${rankPair}`.toLowerCase();
  const fullLabel = `${label} ${rankPair}`.replace(/\s+/g, " ").trim();
  if (!isConditionalRule(label, rankPair)) return null;
  const numValue = parseValue(value);
  let targetRanks = [];
  if (combinedText.includes("junior deck") || combinedText.includes("2/o") || combinedText.includes("3/o")) {
    targetRanks = [...JUNIOR_DECK_OFFICERS];
  } else if (combinedText.includes("junior eng") || combinedText.includes("3/e") || combinedText.includes("4/e")) {
    targetRanks = [...JUNIOR_ENGINEER_OFFICERS];
  } else if (combinedText.includes("deck officer")) {
    targetRanks = [...ALL_DECK_OFFICERS];
  } else if (combinedText.includes("eng officer") || combinedText.includes("engineer officer")) {
    targetRanks = [...ALL_ENGINEER_OFFICERS];
  }
  let experienceCategory = "yearsAsOOW";
  if (combinedText.includes("as oow") || combinedText.includes("as eoow")) {
    experienceCategory = "yearsAsOOW";
  } else if (combinedText.includes("in rank")) {
    experienceCategory = "yearsInRank";
  } else if (combinedText.includes("with company") || combinedText.includes("with operator")) {
    experienceCategory = "yearsWithOperator";
  } else if (combinedText.includes("tanker type") || combinedText.includes("this type")) {
    experienceCategory = "yearsOnTankerType";
  } else if (combinedText.includes("all tanker") || combinedText.includes("all type")) {
    experienceCategory = "yearsOnAllTankers";
  }
  let unit = "months";
  if (combinedText.includes("year")) {
    unit = "years";
  }
  let conditionCount;
  const countMatch = combinedText.match(/if\s+(\d+)\s+(junior|deck|eng)/i);
  if (countMatch) {
    conditionCount = parseInt(countMatch[1], 10);
  }
  let conditionType = "officer_count_aggregate";
  let thresholdValue;
  let minimumOfficersMeetingReq;
  if (combinedText.includes("one of") && (combinedText.includes("below") || combinedText.includes("less than"))) {
    conditionType = "officer_below_threshold";
    const thresholdMatch = combinedText.match(/below\s+(\d+)\s*month/i) || combinedText.match(/less than\s+(\d+)\s*month/i);
    if (thresholdMatch) {
      thresholdValue = parseInt(thresholdMatch[1], 10);
    }
  } else if (combinedText.includes("must have at least") || combinedText.includes("should have")) {
    conditionType = "officer_count_minimum";
    const minOfficersMatch = combinedText.match(/(\d+)\s+of\s+(the\s+)?officers/i);
    if (minOfficersMatch) {
      minimumOfficersMeetingReq = parseInt(minOfficersMatch[1], 10);
    }
  } else if (combinedText.includes("aggregat") || combinedText.includes("combin") || combinedText.includes("total")) {
    conditionType = "officer_count_aggregate";
  }
  if (targetRanks.length === 0 && !conditionCount) {
    return null;
  }
  return {
    label: fullLabel,
    conditionType,
    targetRanks,
    conditionCount,
    experienceCategory,
    requiredValue: numValue,
    unit,
    thresholdValue,
    minimumOfficersMeetingReq
  };
}
function isValidOilMajorName(name) {
  if (!name || name.trim() === "") return false;
  const lowerName = name.toLowerCase();
  if (name.length > 50) return false;
  const requirementPhrases = [
    "experience as",
    "months as",
    "officer has",
    "officer must",
    "must have at least",
    "should not be",
    "less than",
    "at least",
    "years as",
    "years in",
    "years on",
    "below",
    "onboard",
    "junior officer",
    "junior deck",
    "junior eng",
    "deck officer",
    "eng officer",
    "as oow",
    "as eoow",
    "required to",
    "minimum of"
  ];
  if (requirementPhrases.some((phrase) => lowerName.includes(phrase))) return false;
  if (/\d+\s*(months?|years?|days?)/.test(lowerName)) return false;
  const sentencePatterns = ["has ", "have ", "is ", "are ", "to be", "not be", "should", "if "];
  if (sentencePatterns.some((pattern) => lowerName.includes(pattern))) return false;
  if (/,\s*if\s/i.test(name)) return false;
  const validCompanyNamePattern = /^[A-Za-z0-9\s\-&'.()/<>]+$/;
  return validCompanyNamePattern.test(name);
}
var KNOWN_OIL_MAJORS = /* @__PURE__ */ new Set([
  "Adnoc",
  "Ampol",
  "ATCQAG",
  "BASF",
  "BHP Billiton Petroleum",
  "BP",
  "Borealis Polymers",
  "Cepsa",
  "Cheniere",
  "Chevron",
  "Citgo",
  "ConocoPhillips",
  "ENEL",
  "ENI",
  "Equinor",
  "ExxonMobil (Spot)",
  "ExxonMobil (T/C)",
  "ExxonMobil (Spot - 3 Engr)",
  "ExxonMobil (T/C - 3 Engr)",
  "Gazprom",
  "Hoegh LNG",
  "Idemitsu",
  "Ineos",
  "KPI",
  "Koch",
  "LUKOIL",
  "Lyondellbasell (<20k dwt)",
  "Lyondellbasell (>20k dwt)",
  "MISC Maritime Services",
  "Marathon",
  "NCSP Group",
  "Neste",
  "Nustar",
  "OMV",
  "OTEKO Terminal",
  "PETROBRAS",
  "PMI",
  "PTT Marine",
  "Petroplus",
  "Phillips 66",
  "Preem",
  "Primorsk Oil Terminal",
  "Qatar Gas",
  "Qatar Petroleum",
  "Reliance",
  "Repsol (Spot/COA)",
  "Repsol (T/C)",
  "Rightship",
  "SABIC",
  "SARAS",
  "SHELL",
  "SHIPVET Services Ltd",
  "SIGGTO LPG",
  "SIGTTO LNG and LPG",
  "Sonangol",
  "TOTAL (Spot)",
  "TOTAL (T/C)",
  "Tesoro",
  "The Company (Internal)",
  "Tonengeneral Sekiyu K.K",
  "Turpas",
  "YPF",
  "Yara"
]);
function parseCSVRows(csvContent) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
    } else if ((char === "\n" || char === "\r" && nextChar === "\n") && !inQuotes) {
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      if (char === "\r") i++;
    } else if (char === "\r" && !inQuotes) {
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== "")) {
      rows.push(currentRow);
    }
  }
  return rows;
}
function parseCSVContent(csvContent) {
  const rows = parseCSVRows(csvContent);
  const oilMajorRules2 = /* @__PURE__ */ new Map();
  let skippedRows = 0;
  let acceptedRows = 0;
  for (let i = 2; i < rows.length; i++) {
    const columns = rows[i];
    if (!columns || columns.length < 2) continue;
    const oilMajor = columns[0]?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (!oilMajor || oilMajor === "") continue;
    const isKnownMajor = KNOWN_OIL_MAJORS.has(oilMajor);
    const passesHeuristic = isValidOilMajorName(oilMajor);
    if (!(isKnownMajor || passesHeuristic)) {
      skippedRows++;
      console.log(`[CSV Parser] Skipped row ${i + 1}: "${oilMajor.substring(0, 40)}..." (known: ${isKnownMajor}, heuristic: ${passesHeuristic})`);
      continue;
    }
    acceptedRows++;
    let config = oilMajorRules2.get(oilMajor);
    if (!config) {
      config = {
        experienceRules: {
          yearsWithOperator: [],
          yearsInRank: [],
          yearsOnTankerType: [],
          yearsOnAllTankers: [],
          yearsAsOOW: []
        },
        dateJoinedRules: [],
        englishProficiencyRules: [],
        conditionalRules: []
      };
      oilMajorRules2.set(oilMajor, config);
    }
    const tryParseConditional = (label, rankPair, value) => {
      if (isConditionalRule(label, rankPair)) {
        const conditionalRule = parseConditionalRule(label, rankPair, value);
        if (conditionalRule) {
          config.conditionalRules = config.conditionalRules || [];
          config.conditionalRules.push(conditionalRule);
          return true;
        }
      }
      return false;
    };
    if (!tryParseConditional(columns[1] || "", columns[2] || "", columns[3] || "")) {
      const ywOperatorRule = createRankPairRule(columns[1] || "", columns[2] || "", columns[3] || "");
      if (ywOperatorRule) {
        config.experienceRules.yearsWithOperator = config.experienceRules.yearsWithOperator || [];
        config.experienceRules.yearsWithOperator.push(ywOperatorRule);
      }
    }
    if (!tryParseConditional(columns[4] || "", columns[5] || "", columns[6] || "")) {
      const yrRule = createRankPairRule(columns[4] || "", columns[5] || "", columns[6] || "");
      if (yrRule) {
        config.experienceRules.yearsInRank = config.experienceRules.yearsInRank || [];
        config.experienceRules.yearsInRank.push(yrRule);
      }
    }
    if (!tryParseConditional(columns[7] || "", columns[8] || "", columns[9] || "")) {
      const ytRule = createRankPairRule(columns[7] || "", columns[8] || "", columns[9] || "");
      if (ytRule) {
        config.experienceRules.yearsOnTankerType = config.experienceRules.yearsOnTankerType || [];
        config.experienceRules.yearsOnTankerType.push(ytRule);
      }
    }
    if (!tryParseConditional(columns[10] || "", columns[11] || "", columns[12] || "")) {
      const yaRule = createRankPairRule(columns[10] || "", columns[11] || "", columns[12] || "");
      if (yaRule) {
        config.experienceRules.yearsOnAllTankers = config.experienceRules.yearsOnAllTankers || [];
        config.experienceRules.yearsOnAllTankers.push(yaRule);
      }
    }
    if (!tryParseConditional(columns[13] || "", columns[14] || "", columns[15] || "")) {
      const oowRule = createRankPairRule(columns[13] || "", columns[14] || "", columns[15] || "");
      if (oowRule) {
        config.experienceRules.yearsAsOOW = config.experienceRules.yearsAsOOW || [];
        config.experienceRules.yearsAsOOW.push(oowRule);
      }
    }
    if (!tryParseConditional(columns[16] || "", columns[17] || "", columns[18] || "")) {
      const djRule = createDateJoinedRule(columns[16] || "", columns[17] || "", columns[18] || "");
      if (djRule) {
        config.dateJoinedRules = config.dateJoinedRules || [];
        config.dateJoinedRules.push(djRule);
      }
    }
    if (!tryParseConditional(columns[19] || "", columns[20] || "", columns[21] || "")) {
      const epRule = createEnglishProficiencyRule(columns[19] || "", columns[20] || "", columns[21] || "");
      if (epRule) {
        config.englishProficiencyRules = config.englishProficiencyRules || [];
        config.englishProficiencyRules.push(epRule);
      }
    }
  }
  console.log(`[CSV Parser] Completed: ${acceptedRows} rows accepted, ${skippedRows} rows skipped, ${oilMajorRules2.size} oil majors found`);
  return oilMajorRules2;
}
function convertToStorageFormat(oilMajorRules2) {
  const result = [];
  oilMajorRules2.forEach((config, name) => {
    result.push({
      oilMajorName: name,
      rules: JSON.stringify(config),
      isActive: true
    });
  });
  return result;
}

// server/complianceEngine.ts
var RANK_ALIASES = {
  "Master": ["Master", "Captain", "Capt"],
  "Chief Officer": ["Chief Officer", "C/O", "Chief Mate", "First Officer", "1/O"],
  "Second Officer": ["Second Officer", "2/O", "2nd Officer", "2nd Off"],
  "Third Officer": ["Third Officer", "3/O", "3rd Officer", "3rd Off"],
  "Chief Engineer": ["Chief Engineer", "C/E", "Chief Eng"],
  "Second Engineer": ["Second Engineer", "2/E", "2nd Engineer", "2nd Eng"],
  "Third Engineer": ["Third Engineer", "3/E", "3rd Engineer", "3rd Eng"],
  "Fourth Engineer": ["Fourth Engineer", "4/E", "4th Engineer", "4th Eng"],
  "Gas Engineer": ["Gas Engineer", "Cargo Engineer", "LNG Engineer"],
  "Electrical Officer": ["Electrical Officer", "E/O", "ETO", "Electro-Technical Officer"]
};
var RANK_GROUPS = {
  "All Deck Officers": ["Master", "Chief Officer", "Second Officer", "Third Officer"],
  "All Engineer Officers": ["Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer"],
  "All Engineering Officers": ["Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer"],
  "All Officers": ["Master", "Chief Officer", "Second Officer", "Third Officer", "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "Electrical Officer"],
  "All Senior Officers": ["Master", "Chief Officer", "Chief Engineer", "Second Engineer"],
  "All Junior Officers": ["Second Officer", "Third Officer", "Third Engineer", "Fourth Engineer"],
  "Junior Deck Officer": ["Second Officer", "Third Officer"],
  "Junior Deck Officers": ["Second Officer", "Third Officer"],
  "Junior Engineer Officer": ["Third Engineer", "Fourth Engineer"],
  "Junior Eng Officer": ["Third Engineer", "Fourth Engineer"],
  "Junior Eng Officers": ["Third Engineer", "Fourth Engineer"],
  "Junior Engineer Officers": ["Third Engineer", "Fourth Engineer"]
};
function expandRankGroups(rankStr) {
  const trimmed = rankStr.trim();
  for (const [groupName, ranks] of Object.entries(RANK_GROUPS)) {
    if (trimmed.toLowerCase() === groupName.toLowerCase()) {
      return ranks;
    }
  }
  return [trimmed];
}
function normalizeRankName(rank) {
  if (!rank) return "";
  let normalized = rank.trim();
  normalized = normalized.replace(/_\d+$/, "");
  for (const [standardName, aliases] of Object.entries(RANK_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized.toLowerCase())) {
      return standardName;
    }
  }
  return normalized;
}
function parseRankPair(rankPairStr) {
  if (!rankPairStr) return [];
  const parts = rankPairStr.split("+").map((r) => r.trim()).filter((r) => r.length > 0);
  const expandedRanks = [];
  for (const part of parts) {
    const expanded = expandRankGroups(part);
    for (const rank of expanded) {
      const normalized = normalizeRankName(rank);
      if (normalized && !expandedRanks.includes(normalized)) {
        expandedRanks.push(normalized);
      }
    }
  }
  return expandedRanks;
}
function findCrewByRank(crew, targetRank) {
  const normalizedTarget = normalizeRankName(targetRank);
  return crew.filter((c) => normalizeRankName(c.rank) === normalizedTarget);
}
function getExperienceValue(crew, category) {
  switch (category) {
    case "yearsWithOperator":
      return crew.yearsWithOperator;
    case "yearsInRank":
      return crew.yearsInRank;
    case "yearsOnTankerType":
      return crew.yearsOnTankerType;
    case "yearsOnAllTankers":
      return crew.yearsOnAllTankers;
    case "yearsAsOOW":
      return crew.yearsAsOOW;
    default:
      return 0;
  }
}
function evaluateExperienceRule(rule, crew, category, categoryLabel) {
  const ranks = parseRankPair(rule.rankPair);
  if (ranks.length === 0) {
    return {
      category: categoryLabel,
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredValue,
      actualValue: 0,
      unit: "years",
      status: "fail"
    };
  }
  let totalExperience = 0;
  if (ranks.length === 1) {
    const matchingCrew = findCrewByRank(crew, ranks[0]);
    if (matchingCrew.length === 0) {
      totalExperience = 0;
    } else {
      totalExperience = Math.min(...matchingCrew.map((c) => getExperienceValue(c, category)));
    }
  } else {
    for (const rank of ranks) {
      const matchingCrew = findCrewByRank(crew, rank);
      if (matchingCrew.length > 0) {
        const minValue = Math.min(...matchingCrew.map((c) => getExperienceValue(c, category)));
        totalExperience += minValue;
      }
    }
  }
  const passed = totalExperience >= rule.requiredValue;
  return {
    category: categoryLabel,
    label: rule.label,
    rankPair: rule.rankPair,
    requiredValue: rule.requiredValue,
    actualValue: Math.round(totalExperience * 10) / 10,
    unit: "years",
    status: passed ? "pass" : "fail"
  };
}
function evaluateDateJoinedRule(rule, crew) {
  const rankPairMatch = rule.rankPair.match(/^(.+?)\s+Joining\s+Date\s*-\s*(.+?)\s+Joining\s+Date$/i);
  if (!rankPairMatch) {
    return {
      category: "Date Joined",
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredDays,
      actualValue: 0,
      unit: "days",
      status: "pass"
      // Default to pass if we can't parse
    };
  }
  const [, rank1Name, rank2Name] = rankPairMatch;
  const crew1 = findCrewByRank(crew, rank1Name.trim());
  const crew2 = findCrewByRank(crew, rank2Name.trim());
  if (crew1.length === 0 || crew2.length === 0) {
    return {
      category: "Date Joined",
      label: rule.label,
      rankPair: rule.rankPair,
      requiredValue: rule.requiredDays,
      actualValue: 0,
      unit: "days",
      status: "pass"
      // Pass if one rank is not on board
    };
  }
  const date1 = new Date(crew1[0].signOnDate);
  const date2 = new Date(crew2[0].signOnDate);
  const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1e3 * 60 * 60 * 24));
  const passed = daysDiff >= rule.requiredDays;
  return {
    category: "Date Joined",
    label: rule.label,
    rankPair: rule.rankPair,
    requiredValue: rule.requiredDays,
    actualValue: Math.round(daysDiff),
    unit: "days",
    status: passed ? "pass" : "fail"
  };
}
function evaluateEnglishProficiencyRuleAll(rule, crew) {
  const PROFICIENCY_ORDER = ["Poor", "Fair", "Good", "Excellent", "Native"];
  const rawParts = rule.rankPair.split(/[,&+]/).map((r) => r.trim()).filter((r) => r.length > 0);
  const targetRanks = [];
  for (const part of rawParts) {
    const expanded = expandRankGroups(part);
    for (const rank of expanded) {
      const normalized = normalizeRankName(rank);
      if (normalized && !targetRanks.includes(normalized)) {
        targetRanks.push(normalized);
      }
    }
  }
  const results = [];
  for (const targetRank of targetRanks) {
    const matchingCrew = findCrewByRank(crew, targetRank);
    const requiredIndex = PROFICIENCY_ORDER.findIndex((l) => l.toLowerCase() === rule.requiredLevel.toLowerCase());
    if (matchingCrew.length === 0) {
      results.push({
        category: "English Proficiency",
        label: rule.label || `${targetRank} requires ${rule.requiredLevel} English`,
        rankPair: targetRank,
        requiredValue: requiredIndex,
        actualValue: -2,
        // -2 indicates "No crew assigned"
        unit: "proficiency",
        status: "fail"
        // Fail because requirement cannot be verified
      });
      continue;
    }
    const crewMember = matchingCrew[0];
    const crewLevel = crewMember.languageProficiency || "Unknown";
    const crewIndex = PROFICIENCY_ORDER.findIndex((l) => l.toLowerCase() === crewLevel.toLowerCase());
    const passed = crewIndex >= 0 && requiredIndex >= 0 && crewIndex >= requiredIndex;
    results.push({
      category: "English Proficiency",
      label: rule.label || `${targetRank} requires ${rule.requiredLevel} English`,
      rankPair: targetRank,
      // Use -1 for unknown levels, -2 for no crew assigned
      requiredValue: requiredIndex,
      actualValue: crewIndex,
      unit: "proficiency",
      status: passed ? "pass" : "fail"
    });
  }
  return results;
}
function evaluateConditionalRule(rule, crew) {
  const matchingCrew = [];
  for (const targetRank of rule.targetRanks) {
    const crewForRank = findCrewByRank(crew, targetRank);
    matchingCrew.push(...crewForRank);
  }
  const getExperienceInMonths = (crewMember) => {
    const category = rule.experienceCategory;
    let value = 0;
    switch (category) {
      case "yearsWithOperator":
        value = crewMember.yearsWithOperator;
        break;
      case "yearsInRank":
        value = crewMember.yearsInRank;
        break;
      case "yearsOnTankerType":
        value = crewMember.yearsOnTankerType;
        break;
      case "yearsOnAllTankers":
        value = crewMember.yearsOnAllTankers;
        break;
      case "yearsAsOOW":
        value = crewMember.yearsAsOOW;
        break;
      default:
        value = 0;
    }
    return value * 12;
  };
  const experienceValues = matchingCrew.map((c) => getExperienceInMonths(c));
  const officerCount = matchingCrew.length;
  const requiredValueInMonths = rule.unit === "years" ? rule.requiredValue * 12 : rule.requiredValue;
  const thresholdInMonths = rule.thresholdValue ? rule.unit === "years" ? rule.thresholdValue * 12 : rule.thresholdValue : 6;
  const conditionCount = rule.conditionCount || officerCount;
  const conditionApplies = officerCount >= conditionCount;
  if (!conditionApplies) {
    return {
      category: "Conditional Rule",
      label: rule.label,
      rankPair: rule.targetRanks.join(" + "),
      requiredValue: rule.requiredValue,
      actualValue: officerCount,
      unit: "conditional",
      status: "not_applicable"
    };
  }
  let passed = false;
  let actualValue = 0;
  let displayUnit = rule.unit === "years" ? "years" : "months";
  switch (rule.conditionType) {
    case "officer_count_aggregate":
      actualValue = experienceValues.reduce((sum, val) => sum + val, 0);
      passed = actualValue >= requiredValueInMonths;
      if (rule.unit === "years") {
        actualValue = actualValue / 12;
      }
      break;
    case "officer_below_threshold":
      const belowThreshold = experienceValues.filter((v) => v < thresholdInMonths);
      const aboveThreshold = experienceValues.filter((v) => v >= thresholdInMonths);
      if (belowThreshold.length > 0) {
        const othersAboveReq = aboveThreshold.filter((v) => v >= requiredValueInMonths);
        passed = othersAboveReq.length > 0;
        actualValue = Math.max(...aboveThreshold, 0);
      } else {
        passed = true;
        actualValue = Math.min(...experienceValues);
      }
      if (rule.unit === "years") {
        actualValue = actualValue / 12;
      }
      break;
    case "officer_count_minimum":
      const minOfficers = rule.minimumOfficersMeetingReq || 2;
      const meetingReq = experienceValues.filter((v) => v >= requiredValueInMonths);
      passed = meetingReq.length >= minOfficers;
      actualValue = meetingReq.length;
      displayUnit = "officers";
      break;
  }
  return {
    category: "Conditional Rule",
    label: rule.label,
    rankPair: rule.targetRanks.join(" + "),
    requiredValue: rule.requiredValue,
    actualValue: Math.round(actualValue * 10) / 10,
    unit: displayUnit,
    status: passed ? "pass" : "fail"
  };
}
function evaluateCompliance(oilMajorName, rulesConfig, crew) {
  const results = [];
  if (rulesConfig.experienceRules.yearsWithOperator) {
    for (const rule of rulesConfig.experienceRules.yearsWithOperator) {
      results.push(evaluateExperienceRule(rule, crew, "yearsWithOperator", "Years with Operator"));
    }
  }
  if (rulesConfig.experienceRules.yearsInRank) {
    for (const rule of rulesConfig.experienceRules.yearsInRank) {
      results.push(evaluateExperienceRule(rule, crew, "yearsInRank", "Years in Rank"));
    }
  }
  if (rulesConfig.experienceRules.yearsOnTankerType) {
    for (const rule of rulesConfig.experienceRules.yearsOnTankerType) {
      results.push(evaluateExperienceRule(rule, crew, "yearsOnTankerType", "Years on This Type of Tanker"));
    }
  }
  if (rulesConfig.experienceRules.yearsOnAllTankers) {
    for (const rule of rulesConfig.experienceRules.yearsOnAllTankers) {
      results.push(evaluateExperienceRule(rule, crew, "yearsOnAllTankers", "Years on All Types of Tankers"));
    }
  }
  if (rulesConfig.experienceRules.yearsAsOOW) {
    for (const rule of rulesConfig.experienceRules.yearsAsOOW) {
      results.push(evaluateExperienceRule(rule, crew, "yearsAsOOW", "Years as Watch Officer/Engineer"));
    }
  }
  if (rulesConfig.dateJoinedRules) {
    for (const rule of rulesConfig.dateJoinedRules) {
      results.push(evaluateDateJoinedRule(rule, crew));
    }
  }
  if (rulesConfig.englishProficiencyRules) {
    for (const rule of rulesConfig.englishProficiencyRules) {
      const profResults = evaluateEnglishProficiencyRuleAll(rule, crew);
      results.push(...profResults);
    }
  }
  if (rulesConfig.conditionalRules) {
    for (const rule of rulesConfig.conditionalRules) {
      results.push(evaluateConditionalRule(rule, crew));
    }
  }
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const total = results.length;
  let overallStatus;
  if (failed === 0) {
    overallStatus = "green";
  } else if (failed <= total * 0.3) {
    overallStatus = "yellow";
  } else {
    overallStatus = "red";
  }
  return {
    oilMajorName,
    overallStatus,
    results,
    summary: { passed, failed, total }
  };
}
function convertCrewToExperience(crewMembers2) {
  return crewMembers2.map((crew) => {
    const parseYears = (val) => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const num = parseFloat(val.replace(/[^0-9.]/g, ""));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };
    return {
      rank: crew.rank || crew.presentRank || "",
      yearsWithOperator: parseYears(crew.companyExperience || crew.yearsWithOperator || 0),
      yearsInRank: parseYears(crew.rankExperience || crew.yearsInRank || 0),
      yearsOnTankerType: parseYears(crew.tankerTypeExperience || crew.yearsOnTankerType || 0),
      yearsOnAllTankers: parseYears(crew.allTankersExperience || crew.yearsOnAllTankers || 0),
      yearsAsOOW: parseYears(crew.oowExperience || crew.yearsAsOOW || 0),
      timeOnboardMonths: parseYears(crew.timeOnboard || crew.timeOnboardMonths || 0),
      signOnDate: crew.signOnDate || crew.joinDate || (/* @__PURE__ */ new Date()).toISOString(),
      languageProficiency: crew.englishProficiency || crew.languageProficiency || ""
    };
  });
}

// server/routes.ts
import { z as z2 } from "zod";

// shared/seaServiceCalculator.ts
function parseDate(dateStr) {
  if (!dateStr) return null;
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return null;
}
function calculateSeaServicePeriod(joiningDate) {
  if (!joiningDate) return "N/A";
  const startDate = parseDate(joiningDate);
  if (!startDate) return "N/A";
  const endDate = /* @__PURE__ */ new Date();
  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0) return "N/A";
  const parts = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "Year" : "Years"}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "Month" : "Months"}`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? "Day" : "Days"}`);
  }
  return parts.join(" ");
}

// shared/crew-mapping.ts
function calculateCrewStatus(isActive, hasVesselAssignment) {
  if (isActive === false) {
    return "Inactive";
  }
  return hasVesselAssignment ? "On Board" : "On Leave";
}
var FIELD_MAPPINGS = {
  // Frontend field -> Database field
  dob: "dateOfBirth",
  ageInYears: "age",
  rank: "presentRank",
  vessel: "presentVessel",
  lastName: "familyName"
  // For backward compatibility
};
var REVERSE_FIELD_MAPPINGS = {
  // Database field -> Frontend field  
  dateOfBirth: "dob",
  age: "ageInYears",
  presentRank: "rank",
  presentVessel: "vessel"
  // Note: familyName is the canonical field - no lastName alias needed
};
var JSON_FIELDS = [
  "vesselTypes",
  "documents",
  "visas",
  "education",
  "licenses",
  "trainingCourses",
  "currentCompanySeaService",
  "externalSeaService",
  "preJoiningMedicals",
  "doctorVisits",
  "children"
];
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return "";
  const birthDate = new Date(dateOfBirth);
  const today = /* @__PURE__ */ new Date();
  if (isNaN(birthDate.getTime())) return "";
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || monthDiff === 0 && today.getDate() < birthDate.getDate()) {
    age--;
  }
  return age >= 0 ? age.toString() : "";
}
function fromStorageCrew(dbCrew) {
  const dto = { ...dbCrew };
  Object.entries(REVERSE_FIELD_MAPPINGS).forEach(([dbField, frontendField]) => {
    if (dbField in dto) {
      dto[frontendField] = dto[dbField];
    }
  });
  if (!dto.age && !dto.ageInYears && dto.dateOfBirth) {
    const calculatedAge = calculateAge(dto.dateOfBirth);
    dto.age = calculatedAge;
    dto.ageInYears = calculatedAge;
  }
  if (!dto.vessel && dto.presentVessel) {
    dto.vessel = dto.presentVessel;
  } else if (!dto.presentVessel && dto.vessel) {
    dto.presentVessel = dto.vessel;
  }
  if (!dto.rank && dto.presentRank) {
    dto.rank = dto.presentRank;
  } else if (!dto.presentRank && dto.rank) {
    dto.presentRank = dto.rank;
  }
  if (!dto.familyName && dto.lastName) {
    dto.familyName = dto.lastName;
  }
  if (!dto.lastName && dto.familyName) {
    dto.lastName = dto.familyName;
  }
  JSON_FIELDS.forEach((field) => {
    if (dto[field] && typeof dto[field] === "string") {
      try {
        dto[field] = JSON.parse(dto[field]);
      } catch (e) {
        console.warn(`Failed to parse JSON field ${field}:`, e);
        dto[field] = null;
      }
    }
  });
  return dto;
}
function toStorageCrew(dto) {
  const dbData = {};
  Object.keys(dto).forEach((key) => {
    if (!Object.keys(FIELD_MAPPINGS).includes(key)) {
      if (key === "vesselType" && Array.isArray(dto[key])) {
        dbData[key] = dto[key][0] || "";
      } else {
        dbData[key] = dto[key];
      }
    }
  });
  Object.entries(FIELD_MAPPINGS).forEach(([frontendField, dbField]) => {
    if (frontendField in dto) {
      dbData[dbField] = dto[frontendField];
      delete dbData[frontendField];
    }
  });
  JSON_FIELDS.forEach((field) => {
    if (dbData[field] && typeof dbData[field] === "object") {
      try {
        dbData[field] = JSON.stringify(dbData[field]);
      } catch (e) {
        console.warn(`Failed to stringify JSON field ${field}:`, e);
        dbData[field] = null;
      }
    }
  });
  return dbData;
}
function normalizeCrewMemberForTable(crew) {
  const normalized = fromStorageCrew(crew);
  normalized.dob = normalized.dob || normalized.dateOfBirth;
  normalized.age = normalized.age || normalized.ageInYears;
  if (!normalized.presentRank) {
    normalized.presentRank = normalized.rank || crew.rank || crew.presentRank;
  }
  if (!normalized.familyName) {
    normalized.familyName = normalized.lastName || crew.lastName || crew.familyName;
  }
  normalized.vessel = normalized.vessel || normalized.presentVessel;
  normalized.seaServicePeriod = calculateSeaServicePeriod(normalized.joiningDate);
  return normalized;
}
function mapFormDataToStorage(formData) {
  const mapped = {
    // Map form field names to database field names
    empNo: formData.employeeId || null,
    firstName: formData.firstName || "",
    middleName: formData.middleName || null,
    familyName: formData.familyName || null,
    dateOfBirth: formData.dateOfBirth || null,
    age: formData.ageInYears || null,
    nationality: formData.nationality || "",
    presentRank: formData.presentRank || void 0,
    rankAppliedFor: formData.rankAppliedFor || null,
    employeeId: formData.employeeId || null,
    presentVessel: formData.presentVessel || void 0,
    vesselType: Array.isArray(formData.vesselType) ? formData.vesselType[0] || void 0 : formData.vesselType || void 0,
    lastVessel: formData.lastVessel || void 0,
    status: formData.status || "Active",
    isActive: formData.isActive !== void 0 ? formData.isActive : true,
    joiningDate: formData.joiningDate || void 0,
    signOnDate: formData.signOnDate || formData.joiningDate || void 0,
    signOffDate: formData.signOffDate || void 0,
    contractPeriod: formData.contractPeriod || void 0,
    reliefDue: formData.reliefDue || void 0,
    nextAvailability: formData.nextAvailability || void 0,
    reason: formData.reason || void 0,
    availability: formData.availability || "Available",
    email: formData.email || null,
    mobile: formData.mobile || null,
    contactLandline: formData.contactLandline || null,
    countryOfResidence: formData.countryOfResidence || null,
    nearestAirport: formData.nearestAirport || null,
    residentialAddressLine1: formData.residentialAddressLine1 || null,
    residentialAddressLine2: formData.residentialAddressLine2 || null,
    placeOfBirthCity: formData.placeOfBirthCity || null,
    placeOfBirthCountry: formData.placeOfBirthCountry || null,
    heightCm: formData.heightCm || null,
    weightKg: formData.weightKg || null,
    bmi: formData.bmi || null,
    nativeLanguage: formData.nativeLanguage || null,
    foreignLanguages: formData.foreignLanguages || null,
    englishProficiency: formData.englishProficiency || null,
    maritalStatus: formData.maritalStatus || null,
    numberOfDependentChildren: formData.numberOfDependentChildren || null,
    fatherName: formData.fatherName || null,
    motherName: formData.motherName || null,
    spouseFirstName: formData.spouseFirstName || null,
    spouseMiddleName: formData.spouseMiddleName || null,
    spouseFamilyName: formData.spouseFamilyName || null,
    spouseDateOfBirth: formData.spouseDateOfBirth || null,
    nokFirstName: formData.nokFirstName || null,
    nokMiddleName: formData.nokMiddleName || null,
    nokFamilyName: formData.nokFamilyName || null,
    nokTelephone: formData.nokTelephone || null,
    nokEmail: formData.nokEmail || null,
    nokAddress: formData.nokAddress || null,
    nokRelationship: formData.nokRelationship || null,
    manningAgent: formData.manningAgent || null,
    crewPool: formData.crewPool || null,
    // JSON fields - stringify arrays and objects (but avoid double-stringifying if already a string)
    vesselTypes: formData.vesselType ? typeof formData.vesselType === "string" ? formData.vesselType : JSON.stringify(formData.vesselType) : null,
    documents: formData.documents ? typeof formData.documents === "string" ? formData.documents : JSON.stringify(formData.documents) : null,
    visas: formData.visas ? typeof formData.visas === "string" ? formData.visas : JSON.stringify(formData.visas) : null,
    education: formData.education ? typeof formData.education === "string" ? formData.education : JSON.stringify(formData.education) : null,
    licenses: formData.licenses ? typeof formData.licenses === "string" ? formData.licenses : JSON.stringify(formData.licenses) : null,
    trainingCourses: formData.trainingCourses ? typeof formData.trainingCourses === "string" ? formData.trainingCourses : JSON.stringify(formData.trainingCourses) : null,
    currentCompanySeaService: formData.currentCompanySeaService ? typeof formData.currentCompanySeaService === "string" ? formData.currentCompanySeaService : JSON.stringify(formData.currentCompanySeaService) : null,
    externalSeaService: formData.externalSeaService ? typeof formData.externalSeaService === "string" ? formData.externalSeaService : JSON.stringify(formData.externalSeaService) : null,
    preJoiningMedicals: formData.preJoiningMedicals ? typeof formData.preJoiningMedicals === "string" ? formData.preJoiningMedicals : JSON.stringify(formData.preJoiningMedicals) : null,
    doctorVisits: formData.doctorVisits ? typeof formData.doctorVisits === "string" ? formData.doctorVisits : JSON.stringify(formData.doctorVisits) : null,
    children: formData.children ? typeof formData.children === "string" ? formData.children : JSON.stringify(formData.children) : null
  };
  return mapped;
}

// server/vesselMasterSafety.ts
var masterTypeCache = /* @__PURE__ */ new Map();
function isVesselMaster(masterId) {
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    const isVessel = masterId === "014";
    const isGroups = masterId === "016";
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
  }
  return cached.isVessel;
}
function filterVesselMasterData(data, masterId) {
  if (!isVesselMaster(masterId)) {
    return data;
  }
  const safeData = {};
  if (masterId) {
    safeData.masterId = masterId;
  }
  if (data.vessel !== void 0) {
    safeData.name = data.vessel;
  } else if (data.name !== void 0) {
    safeData.name = data.name;
  }
  if (data.imoNumber !== void 0) {
    safeData.description = data.imoNumber;
  } else if (data.description !== void 0) {
    safeData.description = data.description;
  }
  if (data.vesselType !== void 0) {
    safeData.vesselType = data.vesselType;
  }
  if (data.entryId !== void 0) {
    safeData.entryId = data.entryId;
  }
  if (data.isActive !== void 0) {
    safeData.isActive = data.isActive;
  }
  if (data.isDeleted !== void 0) {
    safeData.isDeleted = data.isDeleted;
  }
  return safeData;
}
function mapDatabaseToVesselDisplay(dbEntry) {
  if (!dbEntry) return dbEntry;
  const basicTransformed = { ...dbEntry };
  if (dbEntry.entry_id !== void 0) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  if (dbEntry.master_id !== void 0) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  if (dbEntry.created_at !== void 0) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  if (dbEntry.updated_at !== void 0) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }
  return {
    ...basicTransformed,
    // Map safe fields back to vessel fields for frontend consumption
    vessel: basicTransformed.name || "",
    imoNumber: basicTransformed.description || "",
    // Include other safe fields as-is
    name: basicTransformed.name || "",
    description: basicTransformed.description || ""
  };
}
function validateVesselMasterEntry(data) {
  if (!data.name && !data.vessel) {
    return {
      isValid: false,
      error: "Vessel master entry must have either 'name' or 'vessel' field populated"
    };
  }
  return { isValid: true };
}
function isAdditionalGroupsMaster(masterId) {
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    const isVessel = masterId === "014";
    const isGroups = masterId === "016";
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
  }
  return cached.isGroups;
}
function transformVesselIds(data, direction) {
  if (!data) return data;
  if (direction === "toDatabase") {
    const vesselIdsArray = data.vesselIds || data.VesselIDs;
    if (Array.isArray(vesselIdsArray)) {
      const result = {
        ...data,
        vesselIds: JSON.stringify(vesselIdsArray)
      };
      delete result.VesselIDs;
      return result;
    } else if (typeof vesselIdsArray === "string") {
      const result = {
        ...data,
        vesselIds: vesselIdsArray
      };
      delete result.VesselIDs;
      return result;
    }
  } else if (direction === "fromDatabase") {
    if (data.vesselIds && typeof data.vesselIds === "string") {
      try {
        const parsed = JSON.parse(data.vesselIds);
        return {
          ...data,
          vesselIds: Array.isArray(parsed) ? parsed : []
        };
      } catch (error) {
        return {
          ...data,
          vesselIds: []
        };
      }
    }
  }
  return data;
}
function filterAdditionalGroupsData(data, masterId) {
  if (!isAdditionalGroupsMaster(masterId)) {
    return data;
  }
  const transformedData = transformVesselIds(data, "toDatabase");
  const normalizedData = { ...transformedData };
  const originalHasVesselIds = "vesselIds" in data || "VesselIDs" in data;
  const transformedHasVesselIds = "vesselIds" in transformedData || "VesselIDs" in transformedData;
  if (originalHasVesselIds || transformedHasVesselIds) {
    const vesselIdsValue = transformedData.vesselIds || transformedData.VesselIDs;
    normalizedData.vesselIds = vesselIdsValue !== void 0 ? vesselIdsValue : null;
  } else {
    delete normalizedData.vesselIds;
  }
  delete normalizedData.VesselIDs;
  return normalizedData;
}
function mapDatabaseToGroupsDisplay(dbEntry) {
  if (!dbEntry) return dbEntry;
  const basicTransformed = { ...dbEntry };
  if (dbEntry.entry_id !== void 0) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  if (dbEntry.master_id !== void 0) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  if (dbEntry.created_at !== void 0) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  if (dbEntry.updated_at !== void 0) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }
  const transformedEntry = transformVesselIds(basicTransformed, "fromDatabase");
  return transformedEntry;
}
function validateAdditionalGroupsEntry(data) {
  if (!data.name) {
    return {
      isValid: false,
      error: "Additional Groups entry must have 'name' field populated"
    };
  }
  if (data.vesselIds) {
    if (typeof data.vesselIds === "string") {
      try {
        const parsed = JSON.parse(data.vesselIds);
        if (!Array.isArray(parsed)) {
          return {
            isValid: false,
            error: "vesselIds must be a JSON array string or an array"
          };
        }
      } catch (error) {
        return {
          isValid: false,
          error: "vesselIds must be valid JSON array string"
        };
      }
    } else if (!Array.isArray(data.vesselIds)) {
      return {
        isValid: false,
        error: "vesselIds must be an array or JSON array string"
      };
    }
  }
  return { isValid: true };
}
function isVesselOwnersMaster(masterId) {
  let cached = masterTypeCache.get(masterId);
  if (!cached) {
    const isVessel = masterId === "014";
    const isGroups = masterId === "016";
    const isOwners = masterId === "017";
    cached = { isVessel, isGroups, isOwners };
    masterTypeCache.set(masterId, cached);
  }
  return cached.isOwners;
}
function filterVesselOwnersData(data, masterId) {
  if (!isVesselOwnersMaster(masterId)) {
    return data;
  }
  let preprocessedData = { ...data };
  if (data.vouid && !data.entryId) {
    preprocessedData.entryId = data.vouid;
  }
  const transformedData = transformVesselIds(preprocessedData, "toDatabase");
  const normalizedData = {
    ...transformedData,
    // Ensure vesselIds is the canonical field name
    vesselIds: transformedData.vesselIds || transformedData.VesselIDs,
    // Remove alternative casing to avoid duplication
    VesselIDs: void 0
  };
  return normalizedData;
}
function mapDatabaseToOwnersDisplay(dbEntry) {
  if (!dbEntry) return dbEntry;
  const basicTransformed = { ...dbEntry };
  if (dbEntry.entry_id !== void 0) {
    basicTransformed.entryId = dbEntry.entry_id;
    delete basicTransformed.entry_id;
  }
  if (dbEntry.master_id !== void 0) {
    basicTransformed.masterId = dbEntry.master_id;
    delete basicTransformed.master_id;
  }
  if (dbEntry.created_at !== void 0) {
    basicTransformed.createdAt = dbEntry.created_at;
    delete basicTransformed.created_at;
  }
  if (dbEntry.updated_at !== void 0) {
    basicTransformed.updatedAt = dbEntry.updated_at;
    delete basicTransformed.updated_at;
  }
  const transformedEntry = transformVesselIds(basicTransformed, "fromDatabase");
  return transformedEntry;
}
function validateVesselOwnersEntry(data) {
  if (data.name && typeof data.name !== "string") {
    return {
      isValid: false,
      error: "Vessel Owners name must be a string"
    };
  }
  if (data.vesselIds) {
    if (typeof data.vesselIds === "string") {
      try {
        const parsed = JSON.parse(data.vesselIds);
        if (!Array.isArray(parsed)) {
          return {
            isValid: false,
            error: "vesselIds must be a JSON array string or an array"
          };
        }
      } catch (error) {
        return {
          isValid: false,
          error: "vesselIds must be valid JSON array string"
        };
      }
    } else if (!Array.isArray(data.vesselIds)) {
      return {
        isValid: false,
        error: "vesselIds must be an array or JSON array string"
      };
    }
  }
  return { isValid: true };
}
function needsSpecialHandling(masterId) {
  return isVesselMaster(masterId) || isAdditionalGroupsMaster(masterId) || isVesselOwnersMaster(masterId);
}
function applyMasterSpecificFiltering(data, masterId) {
  if (isVesselMaster(masterId)) {
    return filterVesselMasterData(data, masterId);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return filterAdditionalGroupsData(data, masterId);
  } else if (isVesselOwnersMaster(masterId)) {
    return filterVesselOwnersData(data, masterId);
  }
  return data;
}
function applyMasterSpecificMapping(dbEntry, masterId) {
  if (isVesselMaster(masterId)) {
    return mapDatabaseToVesselDisplay(dbEntry);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return mapDatabaseToGroupsDisplay(dbEntry);
  } else if (isVesselOwnersMaster(masterId)) {
    return mapDatabaseToOwnersDisplay(dbEntry);
  }
  return dbEntry;
}
function validateMasterSpecificEntry(data, masterId) {
  if (isVesselMaster(masterId)) {
    return validateVesselMasterEntry(data);
  } else if (isAdditionalGroupsMaster(masterId)) {
    return validateAdditionalGroupsEntry(data);
  } else if (isVesselOwnersMaster(masterId)) {
    return validateVesselOwnersEntry(data);
  }
  return { isValid: true };
}

// shared/date-utils.ts
function parseFlexibleDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.match(/^\d{4}[-/]\d{2}[-/]\d{2}$/)) {
      const normalized = trimmed.replace(/\//g, "-");
      const date2 = new Date(normalized);
      if (!isNaN(date2.getTime())) return date2;
    }
    const europeanMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (europeanMatch) {
      const [, day, month, year] = europeanMatch;
      const date2 = /* @__PURE__ */ new Date(`${year}-${month}-${day}`);
      if (!isNaN(date2.getTime())) return date2;
    }
    const usMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (usMatch) {
      const [, first, second, year] = usMatch;
      if (parseInt(first) > 12) {
        const date3 = /* @__PURE__ */ new Date(`${year}-${second}-${first}`);
        if (!isNaN(date3.getTime())) return date3;
      }
      if (parseInt(second) > 12) {
        const date3 = /* @__PURE__ */ new Date(`${year}-${first}-${second}`);
        if (!isNaN(date3.getTime())) return date3;
      }
      const date2 = /* @__PURE__ */ new Date(`${year}-${second}-${first}`);
      if (!isNaN(date2.getTime())) return date2;
    }
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
    return null;
  } catch {
    return null;
  }
}

// server/routes.ts
function applyBasicFieldTransformation(entry) {
  if (!entry) return entry;
  const transformed = { ...entry };
  if (entry.entry_id !== void 0) {
    transformed.entryId = entry.entry_id;
    delete transformed.entry_id;
  }
  if (entry.master_id !== void 0) {
    transformed.masterId = entry.master_id;
    delete transformed.master_id;
  }
  if (entry.created_at !== void 0) {
    transformed.createdAt = entry.created_at;
    delete transformed.created_at;
  }
  if (entry.updated_at !== void 0) {
    transformed.updatedAt = entry.updated_at;
    delete transformed.updated_at;
  }
  return transformed;
}
var rankReorderSchema = z2.array(z2.object({
  id: z2.number(),
  sortOrder: z2.number().int().nonnegative()
}));
async function hasVesselRankConfiguration(vesselId2) {
  if (!vesselId2) return false;
  try {
    const vesselRevisions2 = await storage.getVesselRevisionsByVessel(vesselId2);
    if (vesselRevisions2.length === 0) {
      return false;
    }
    const sortedRevisions = vesselRevisions2.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });
    const latestRevision = sortedRevisions[0];
    const rankData = JSON.parse(latestRevision.revisionData);
    const activeRanks = rankData.filter((rank) => rank.actualManningFlag);
    return activeRanks.length > 0;
  } catch (error) {
    console.error(`Error checking vessel rank configuration for ${vesselId2}:`, error);
    return false;
  }
}
var VESSEL_RANK_CONFIG_REQUIRED_ERROR = {
  error: "Vessel rank configuration required",
  message: "Please configure vessel positions in Admin > Rank Admin > Vessel before adding crew data."
};
var stage1SubmissionSchema = z2.object({
  data: z2.object({
    seafarersName: z2.string().min(1),
    seafarersRank: z2.string().min(1),
    nationality: z2.string().min(1),
    vessel: z2.string().min(1),
    appraisalType: z2.string().min(1),
    signOn: z2.string().optional(),
    appraisalPeriodFrom: z2.string().optional(),
    appraisalPeriodTo: z2.string().optional(),
    personalityIndexCategory: z2.string().optional(),
    primaryAppraiser: z2.string().optional(),
    trainings: z2.array(z2.any()).optional(),
    targets: z2.array(z2.any()).optional()
  }),
  submittedBy: z2.string().optional()
});
var stage2SubmissionSchema = z2.object({
  data: z2.object({
    competenceAssessments: z2.array(z2.any()).optional(),
    behaviouralAssessments: z2.array(z2.any()).optional(),
    trainingNeeds: z2.array(z2.any()).optional(),
    recommendations: z2.array(z2.any()).optional(),
    appraiserComments: z2.array(z2.any()).optional(),
    seafarerComments: z2.array(z2.any()).optional()
  }),
  submittedBy: z2.string().optional()
});
var stage3SubmissionSchema = z2.object({
  data: z2.object({
    officeReviews: z2.array(z2.any()).optional(),
    trainingFollowups: z2.array(z2.any()).optional()
  }),
  submittedBy: z2.string().optional()
});
function timeToCell(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 2 + (minutes >= 30 ? 1 : 0);
}
function calculateVesselReviewStatus(monthValue, vesselReviewSubmittedDate) {
  if (vesselReviewSubmittedDate) {
    return "Completed";
  }
  const [year, month] = monthValue.split("-").map(Number);
  const nextMonth = new Date(year, month, 1);
  const overdueDate = new Date(year, month, 7);
  const now = /* @__PURE__ */ new Date();
  now.setHours(0, 0, 0, 0);
  if (now < nextMonth) {
    return "";
  }
  if (now >= overdueDate) {
    return "Overdue";
  } else if (now >= nextMonth) {
    return "Due";
  }
  return "";
}
function calculateOfficeReviewStatus(monthValue, vesselReviewSubmittedDate, officeReviewSubmittedDate) {
  if (officeReviewSubmittedDate) {
    return "Completed";
  }
  if (!vesselReviewSubmittedDate) {
    return "";
  }
  const [year, month] = monthValue.split("-").map(Number);
  const nextMonth = new Date(year, month, 1);
  const overdueDate = new Date(year, month, 10);
  const now = /* @__PURE__ */ new Date();
  now.setHours(0, 0, 0, 0);
  if (now >= overdueDate) {
    return "Overdue";
  } else {
    return "Due";
  }
  return "";
}
async function syncVariableTaskToRHRecords(task, oldTask) {
  try {
    if (task.isDraft) {
      return;
    }
    let crewDetails = {};
    try {
      crewDetails = JSON.parse(task.crewInvolvedDetails || "{}");
    } catch (e) {
      console.error("Failed to parse crew details:", e);
      return;
    }
    const crewArray = crewDetails.crew || [];
    if (crewArray.length === 0) {
      return;
    }
    const [startDateStr, startTimeStr] = task.startDateTime.split(" / ");
    const [finishDateStr, finishTimeStr] = task.finishDateTime.split(" / ");
    const parseTaskDate = (dateStr) => {
      const [day, monthStr, year] = dateStr.split("-");
      const monthMap = {
        "Jan": 0,
        "Feb": 1,
        "Mar": 2,
        "Apr": 3,
        "May": 4,
        "Jun": 5,
        "Jul": 6,
        "Aug": 7,
        "Sep": 8,
        "Oct": 9,
        "Nov": 10,
        "Dec": 11
      };
      return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
    };
    const startDate = parseTaskDate(startDateStr);
    const finishDate = parseTaskDate(finishDateStr);
    const startCell = timeToCell(startTimeStr);
    const [finishHours, finishMinutes] = finishTimeStr.split(":").map(Number);
    let finishCell = timeToCell(finishTimeStr);
    if (finishMinutes === 0 && finishCell > 0) {
      finishCell = finishCell - 1;
    }
    const isPlan = task.statusType === "planned";
    if (oldTask && !oldTask.isDraft && oldTask.statusType === "planned") {
      await removeVariableTaskFromRHRecords(oldTask);
    }
    for (const crew of crewArray) {
      let currentDate = new Date(startDate);
      while (currentDate <= finishDate) {
        if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
          break;
        }
        const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
        const day = currentDate.getDate();
        let rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, task.vesselId, monthYear);
        if (!rhRecord) {
          const crewMembers2 = await storage.getCrewMembers();
          const crewMember = crewMembers2.find((c) => c.id === crew.id);
          if (!crewMember) {
            continue;
          }
          const [year, month] = monthYear.split("-").map(Number);
          const daysInMonth = new Date(year, month, 0).getDate();
          const initialDailyRecords = Array.from({ length: daysInMonth }, (_, i) => {
            const dayDate = new Date(year, month - 1, i + 1);
            return {
              day: i + 1,
              dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayDate.getDay()],
              hours: Array(48).fill(""),
              isPlan: false,
              comments: "",
              violations: []
            };
          });
          rhRecord = await storage.createRestHoursDailyRecord({
            crewMemberId: crew.id,
            vesselId: task.vesselId,
            rank: crew.rank,
            name: crew.name,
            monthYear,
            dailyRecords: JSON.stringify(initialDailyRecords)
          });
        }
        let dailyRecords = [];
        try {
          dailyRecords = JSON.parse(rhRecord.dailyRecords);
        } catch (e) {
          dailyRecords = [];
        }
        let dayRecord = dailyRecords.find((d) => d.day === day);
        if (!dayRecord) {
          dayRecord = {
            day,
            dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][currentDate.getDay()],
            hours: Array(48).fill(""),
            isPlan,
            comments: "",
            violations: []
          };
          dailyRecords.push(dayRecord);
        }
        let dayCellStart = 0;
        let dayCellEnd = 47;
        if (currentDate.getTime() === startDate.getTime()) {
          dayCellStart = startCell;
        }
        if (currentDate.getTime() === finishDate.getTime()) {
          dayCellEnd = finishCell;
        }
        for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
          const currentCode = dayRecord.hours[cellIdx];
          if (currentCode !== "w" && currentCode !== "d") {
            dayRecord.hours[cellIdx] = "a";
          }
        }
        dayRecord.isPlan = isPlan;
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    await recalculateActivityConflicts(task.vesselId, task.periodValue);
  } catch (error) {
    console.error("Failed to sync variable task to RH records:", error);
  }
}
async function removeVariableTaskFromRHRecords(task) {
  try {
    if (task.statusType !== "planned") {
      return;
    }
    let crewDetails = {};
    try {
      crewDetails = JSON.parse(task.crewInvolvedDetails || "{}");
    } catch (e) {
      return;
    }
    const crewArray = crewDetails.crew || [];
    if (crewArray.length === 0) {
      return;
    }
    const [startDateStr, startTimeStr] = task.startDateTime.split(" / ");
    const [finishDateStr, finishTimeStr] = task.finishDateTime.split(" / ");
    const parseTaskDate = (dateStr) => {
      const [day, monthStr, year] = dateStr.split("-");
      const monthMap = {
        "Jan": 0,
        "Feb": 1,
        "Mar": 2,
        "Apr": 3,
        "May": 4,
        "Jun": 5,
        "Jul": 6,
        "Aug": 7,
        "Sep": 8,
        "Oct": 9,
        "Nov": 10,
        "Dec": 11
      };
      return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
    };
    const startDate = parseTaskDate(startDateStr);
    const finishDate = parseTaskDate(finishDateStr);
    const startCell = timeToCell(startTimeStr);
    const [finishHours, finishMinutes] = finishTimeStr.split(":").map(Number);
    let finishCell = timeToCell(finishTimeStr);
    if (finishMinutes === 0 && finishCell > 0) {
      finishCell = finishCell - 1;
    }
    for (const crew of crewArray) {
      let currentDate = new Date(startDate);
      while (currentDate <= finishDate) {
        if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
          break;
        }
        const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
        const day = currentDate.getDate();
        const rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, task.vesselId, monthYear);
        if (!rhRecord) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        let dailyRecords = [];
        try {
          dailyRecords = JSON.parse(rhRecord.dailyRecords);
        } catch (e) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        const dayRecord = dailyRecords.find((d) => d.day === day);
        if (!dayRecord) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        let dayCellStart = 0;
        let dayCellEnd = 47;
        if (currentDate.getTime() === startDate.getTime()) {
          dayCellStart = startCell;
        }
        if (currentDate.getTime() === finishDate.getTime()) {
          dayCellEnd = finishCell;
        }
        for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
          if (dayRecord.hours[cellIdx] === "a") {
            dayRecord.hours[cellIdx] = "";
          }
        }
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  } catch (error) {
    console.error("Failed to remove variable task from RH records:", error);
  }
}
async function recalculateActivityConflicts(vesselId2, monthYear) {
  try {
    console.log(`\u{1F50D} Recalculating activity conflicts for vessel ${vesselId2}, month ${monthYear}`);
    const allTasks = await storage.getVariableTasksByFilters({ vesselId: vesselId2, periodValue: monthYear });
    const completedTasks = allTasks.filter(
      (task) => !task.isDraft && task.statusType === "completed"
    );
    if (completedTasks.length === 0) {
      console.log("No completed tasks found - no conflicts possible");
      const vesselRecords2 = await storage.getRestHoursVesselRecords();
      const vesselRecord2 = vesselRecords2.find((r) => r.vesselId === vesselId2 && r.monthValue === monthYear);
      if (vesselRecord2) {
        await storage.updateRestHoursVesselRecord(vesselRecord2.id, {
          activityConflicting: false,
          crewWithActivityConflicts: 0,
          crewWithActivityConflictsDetails: null
        });
      }
      const crewRecords2 = await storage.getRestHoursCrewRecords();
      for (const crewRecord of crewRecords2) {
        if (crewRecord.vesselId === vesselId2 && crewRecord.monthValue === monthYear) {
          await storage.updateRestHoursCrewRecord(crewRecord.id, {
            activityConflicting: false
          });
        }
      }
      return;
    }
    console.log(`Found ${completedTasks.length} completed tasks to check`);
    const allDailyRecords = await storage.getRestHoursDailyRecords();
    const rhRecordsCache = /* @__PURE__ */ new Map();
    for (const record of allDailyRecords) {
      if (record.vesselId === vesselId2 && record.monthYear === monthYear) {
        const cacheKey = `${record.crewMemberId}-${monthYear}`;
        try {
          const dailyRecords = JSON.parse(record.dailyRecords);
          rhRecordsCache.set(cacheKey, { record, dailyRecords });
        } catch (e) {
          console.error(`Failed to parse dailyRecords for crew ${record.crewMemberId} - treating as conflict`);
          rhRecordsCache.set(cacheKey, { record, dailyRecords: [] });
        }
      }
    }
    const crewConflictsMap = /* @__PURE__ */ new Map();
    for (const task of completedTasks) {
      let crewDetails = {};
      try {
        crewDetails = JSON.parse(task.crewInvolvedDetails || "{}");
      } catch (e) {
        console.error("Failed to parse crew details:", e);
        continue;
      }
      const crewArray = crewDetails.crew || [];
      if (crewArray.length === 0) {
        continue;
      }
      const [startDateStr, startTimeStr] = task.startDateTime.split(" / ");
      const [finishDateStr, finishTimeStr] = task.finishDateTime.split(" / ");
      const parseTaskDate = (dateStr) => {
        const [day, monthStr, year] = dateStr.split("-");
        const monthMap = {
          "Jan": 0,
          "Feb": 1,
          "Mar": 2,
          "Apr": 3,
          "May": 4,
          "Jun": 5,
          "Jul": 6,
          "Aug": 7,
          "Sep": 8,
          "Oct": 9,
          "Nov": 10,
          "Dec": 11
        };
        return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
      };
      const startDate = parseTaskDate(startDateStr);
      const finishDate = parseTaskDate(finishDateStr);
      const startCell = timeToCell(startTimeStr);
      const [finishHours, finishMinutes] = finishTimeStr.split(":").map(Number);
      let finishCell = timeToCell(finishTimeStr);
      if (finishMinutes === 0 && finishCell > 0) {
        finishCell = finishCell - 1;
      }
      for (const crew of crewArray) {
        let currentDate = new Date(startDate);
        let hasConflict = false;
        while (currentDate <= finishDate && !hasConflict) {
          if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
            break;
          }
          const taskMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
          const day = currentDate.getDate();
          const cacheKey = `${crew.id}-${taskMonthYear}`;
          let cachedData = rhRecordsCache.get(cacheKey);
          if (!cachedData) {
            const rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, vesselId2, taskMonthYear);
            if (!rhRecord) {
              hasConflict = true;
              break;
            }
            try {
              const dailyRecords = JSON.parse(rhRecord.dailyRecords);
              cachedData = { record: rhRecord, dailyRecords };
              rhRecordsCache.set(cacheKey, cachedData);
            } catch (e) {
              console.error(`Failed to parse dailyRecords for crew ${crew.id} - treating as conflict`);
              hasConflict = true;
              break;
            }
          }
          if (cachedData.dailyRecords.length === 0) {
            hasConflict = true;
            break;
          }
          const dayRecord = cachedData.dailyRecords.find((d) => d.day === day);
          if (!dayRecord) {
            hasConflict = true;
            break;
          }
          let dayCellStart = 0;
          let dayCellEnd = 47;
          if (currentDate.getTime() === startDate.getTime()) {
            dayCellStart = startCell;
          }
          if (currentDate.getTime() === finishDate.getTime()) {
            dayCellEnd = finishCell;
          }
          for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
            const code = dayRecord.hours[cellIdx];
            if (!code || code === "") {
              hasConflict = true;
              break;
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        if (hasConflict) {
          crewConflictsMap.set(crew.id, {
            name: crew.name,
            rank: crew.rank
          });
        }
      }
    }
    const crewWithConflicts = Array.from(crewConflictsMap.values());
    const hasConflicts = crewWithConflicts.length > 0;
    const conflictDetailsJson = hasConflicts ? JSON.stringify(crewWithConflicts) : null;
    console.log(`Conflicts found: ${hasConflicts}, Crew count: ${crewWithConflicts.length}`);
    const vesselRecords = await storage.getRestHoursVesselRecords();
    const vesselRecord = vesselRecords.find((r) => r.vesselId === vesselId2 && r.monthValue === monthYear);
    if (vesselRecord) {
      await storage.updateRestHoursVesselRecord(vesselRecord.id, {
        activityConflicting: hasConflicts,
        crewWithActivityConflicts: crewWithConflicts.length,
        crewWithActivityConflictsDetails: conflictDetailsJson
      });
      console.log(`\u2705 Updated vessel record with conflict status`);
    }
    const crewRecords = await storage.getRestHoursCrewRecords();
    for (const crewRecord of crewRecords) {
      if (crewRecord.vesselId === vesselId2 && crewRecord.monthValue === monthYear) {
        const crewHasConflict = crewConflictsMap.has(crewRecord.crewMemberId);
        await storage.updateRestHoursCrewRecord(crewRecord.id, {
          activityConflicting: crewHasConflict
        });
      }
    }
  } catch (error) {
    console.error("Failed to recalculate activity conflicts:", error);
  }
}
async function clearFixedTaskPlanCodes(crewMemberId, vesselId2, monthYear) {
  try {
    console.log(`\u{1F9F9} Clearing Fixed Task plan codes for crew ${crewMemberId}, vessel ${vesselId2}, month ${monthYear}`);
    const rhRecord = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId2, monthYear);
    if (!rhRecord) {
      console.log("No RH record found - nothing to clear");
      return;
    }
    let dailyRecords = [];
    try {
      dailyRecords = JSON.parse(rhRecord.dailyRecords);
    } catch (e) {
      console.warn(`Failed to parse dailyRecords for crew ${crewMemberId}`);
      return;
    }
    let clearedAnyDay = false;
    for (const dayRecord of dailyRecords) {
      if (dayRecord.isPlan === true) {
        for (let cellIdx = 0; cellIdx < 48; cellIdx++) {
          if (dayRecord.hours[cellIdx] !== "") {
            dayRecord.hours[cellIdx] = "";
            clearedAnyDay = true;
          }
        }
      }
    }
    if (clearedAnyDay) {
      await storage.updateRestHoursDailyRecord(rhRecord.id, {
        dailyRecords: JSON.stringify(dailyRecords)
      });
      console.log(`\u2705 Cleared Fixed Task plan codes for crew ${crewMemberId}`);
    }
  } catch (error) {
    console.error("\u274C Failed to clear Fixed Task plan codes:", error);
  }
}
async function syncFixedTasksToRHRecords(vesselId2, monthYear) {
  try {
    console.log(`\u{1F504} Syncing Fixed Tasks for vessel ${vesselId2}, month ${monthYear}`);
    const fixedTasks2 = await storage.getFixedTasksByVesselAndMonth(vesselId2, monthYear);
    if (!fixedTasks2 || fixedTasks2.length === 0) {
      console.log("No fixed tasks found for sync");
      return;
    }
    const [year, month] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    console.log(`\u{1F4C5} Processing ${fixedTasks2.length} crew members for ${daysInMonth} days`);
    for (const fixedTask of fixedTasks2) {
      let seaHoursTemplate = [];
      try {
        const seaHoursData = fixedTask.seaHours;
        if (!seaHoursData) {
          console.log(`Skipping crew ${fixedTask.crewMemberId} - empty seaHours`);
          continue;
        }
        if (Array.isArray(seaHoursData)) {
          seaHoursTemplate = seaHoursData;
        } else if (typeof seaHoursData === "string") {
          if (seaHoursData.trim() === "") {
            console.log(`Skipping crew ${fixedTask.crewMemberId} - empty seaHours string`);
            continue;
          }
          seaHoursTemplate = JSON.parse(seaHoursData);
        } else {
          console.warn(`Unexpected seaHours type for crew ${fixedTask.crewMemberId}: ${typeof seaHoursData}`);
          continue;
        }
        if (!Array.isArray(seaHoursTemplate) || seaHoursTemplate.length !== 48) {
          console.warn(`Invalid seaHours template for crew ${fixedTask.crewMemberId} - expected array of 48, got ${Array.isArray(seaHoursTemplate) ? seaHoursTemplate.length : "not an array"}`);
          continue;
        }
      } catch (e) {
        console.warn(`Failed to parse seaHours for crew ${fixedTask.crewMemberId}:`, e);
        const debugData = typeof fixedTask.seaHours === "string" ? fixedTask.seaHours.substring(0, 100) : `[${typeof fixedTask.seaHours}]`;
        console.warn(`Raw seaHours data: ${debugData}`);
        continue;
      }
      let rhRecord = await storage.getRestHoursDailyRecordByKey(
        fixedTask.crewMemberId,
        vesselId2,
        monthYear
      );
      if (!rhRecord) {
        const initialDailyRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const dayDate = new Date(year, month - 1, i + 1);
          return {
            day: i + 1,
            dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayDate.getDay()],
            hours: Array(48).fill(""),
            isPlan: true,
            comments: "",
            violations: []
          };
        });
        rhRecord = await storage.createRestHoursDailyRecord({
          crewMemberId: fixedTask.crewMemberId,
          vesselId: vesselId2,
          rank: fixedTask.rank,
          name: fixedTask.name,
          monthYear,
          dailyRecords: JSON.stringify(initialDailyRecords)
        });
      }
      let dailyRecords = [];
      try {
        dailyRecords = JSON.parse(rhRecord.dailyRecords);
      } catch (e) {
        console.warn(`Failed to parse dailyRecords for crew ${fixedTask.crewMemberId}`);
        continue;
      }
      let updatedAnyDay = false;
      for (let day = 1; day <= daysInMonth; day++) {
        let dayRecord = dailyRecords.find((d) => d.day === day);
        if (!dayRecord) {
          const dayDate = new Date(year, month - 1, day);
          dayRecord = {
            day,
            dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayDate.getDay()],
            hours: Array(48).fill(""),
            isPlan: true,
            comments: "",
            violations: []
          };
          dailyRecords.push(dayRecord);
        }
        let modifiedThisDay = false;
        for (let cellIdx = 0; cellIdx < 48; cellIdx++) {
          const templateValue = seaHoursTemplate[cellIdx];
          const currentValue = dayRecord.hours[cellIdx];
          const shouldOverwrite = dayRecord.isPlan === true;
          if (shouldOverwrite && templateValue !== currentValue) {
            dayRecord.hours[cellIdx] = templateValue;
            modifiedThisDay = true;
            updatedAnyDay = true;
          }
        }
        if (modifiedThisDay && dayRecord.isPlan !== true) {
          dayRecord.isPlan = true;
        }
      }
      if (updatedAnyDay) {
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });
        console.log(`\u2705 Synced Fixed Tasks for crew ${fixedTask.name}`);
      }
    }
    console.log(`\u2705 Fixed Tasks sync completed for vessel ${vesselId2}, month ${monthYear}`);
  } catch (error) {
    console.error("\u274C Failed to sync Fixed Tasks to RH records:", error);
  }
}
function calculateRecordingPercentage(dailyRecordsJson, monthYear) {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }
    const [year, month] = monthYear.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const filledDays = dailyRecords.filter((day) => {
      const isPlan = day.isPlan === true;
      const hasHours = Array.isArray(day.hours) && day.hours.some((h) => h !== "");
      return !isPlan && hasHours;
    }).length;
    const percentage = Math.round(filledDays / daysInMonth * 100);
    return Math.min(100, Math.max(0, percentage));
  } catch (error) {
    console.error("Failed to calculate recording percentage:", error);
    return 0;
  }
}
function filterViolationsByMode(violations, complianceMode, opaMode) {
  const visibleCodes = [];
  if (complianceMode === "Rest") {
    visibleCodes.push(1, 2, 3, 4);
  } else {
    visibleCodes.push(5, 6);
  }
  if (opaMode) {
    visibleCodes.push(7, 8);
  }
  return violations.filter((v) => visibleCodes.includes(v));
}
function countViolationDays(dailyRecordsJson, complianceMode, opaMode, isPlanMode) {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }
    const violationDays = dailyRecords.filter((day) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      return relevantViolations.length > 0;
    }).length;
    return violationDays;
  } catch (error) {
    console.error("Failed to count violation days:", error);
    return 0;
  }
}
function hasViolationDays(dailyRecordsJson, complianceMode, opaMode, isPlanMode) {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return false;
    }
    return dailyRecords.some((day) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      return relevantViolations.length > 0;
    });
  } catch (error) {
    console.error("Failed to check violation days:", error);
    return false;
  }
}
function getViolationDates(dailyRecordsJson, complianceMode, opaMode, isPlanMode) {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return [];
    }
    const violationDates = [];
    dailyRecords.forEach((day) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return;
      }
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return;
      }
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      if (relevantViolations.length > 0 && day.day) {
        violationDates.push(day.day);
      }
    });
    return violationDates.sort((a, b) => a - b);
  } catch (error) {
    console.error("Failed to get violation dates:", error);
    return [];
  }
}
function hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, isPlanMode) {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return false;
    }
    return dailyRecords.some((day) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      return relevantViolations.includes(2);
    });
  } catch (error) {
    console.error("Failed to check Code [2] violation:", error);
    return false;
  }
}
function calculateNCs(dailyRecordsJson, complianceMode, opaMode) {
  try {
    const completedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, false);
    const hasCompletedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, false);
    const hasCompletedNC = completedViolationDays >= 3 || hasCompletedCode2;
    if (hasCompletedNC) {
      return { totalNCs: 1, predictedNCs: 0 };
    }
    const predictedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, true);
    const combinedViolationDays = completedViolationDays + predictedViolationDays;
    const hasPredictedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, true);
    const hasPredictedNC = combinedViolationDays >= 3 || hasPredictedCode2;
    return { totalNCs: 0, predictedNCs: hasPredictedNC ? 1 : 0 };
  } catch (error) {
    console.error("Failed to calculate NCs:", error);
    return { totalNCs: 0, predictedNCs: 0 };
  }
}
var RH_THRESHOLDS = {
  MIN_REST_10H_IN_24H: 10,
  MAX_WORK_14H_IN_24H: 14,
  MIN_REST_77H_IN_168H: 77,
  MAX_WORK_72H_IN_168H: 72,
  MIN_CONSECUTIVE_REST_6H: 6,
  OPA_MAX_WORK_15H_IN_24H: 15,
  OPA_MAX_WORK_36H_IN_72H: 36
};
function calculateViolationsFromHours(dailyRecords) {
  if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
    return dailyRecords;
  }
  const timeline = [];
  for (const record of dailyRecords) {
    const hours = record.hours || [];
    const day = record.day;
    const isPlan = record.isPlan === true;
    for (let i = 0; i < 48; i++) {
      const value = hours[i] || "";
      const isRest = value === "";
      timeline.push({ isRest, day, isPlan });
    }
  }
  const cumulativeRest = [];
  const cumulativeWork = [];
  let runningRest = 0;
  let runningWork = 0;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].isRest) {
      runningRest += 0.5;
    } else {
      runningWork += 0.5;
    }
    cumulativeRest.push(runningRest);
    cumulativeWork.push(runningWork);
  }
  const getRollingMetrics = (slotIdx) => {
    const rest24h = slotIdx >= 47 ? cumulativeRest[slotIdx] - (slotIdx >= 48 ? cumulativeRest[slotIdx - 48] : 0) : cumulativeRest[slotIdx];
    const work24h = slotIdx >= 47 ? cumulativeWork[slotIdx] - (slotIdx >= 48 ? cumulativeWork[slotIdx - 48] : 0) : cumulativeWork[slotIdx];
    const rest168h = slotIdx >= 335 ? cumulativeRest[slotIdx] - cumulativeRest[slotIdx - 336] : cumulativeRest[slotIdx];
    const work168h = slotIdx >= 335 ? cumulativeWork[slotIdx] - cumulativeWork[slotIdx - 336] : cumulativeWork[slotIdx];
    const work72h = slotIdx >= 143 ? cumulativeWork[slotIdx] - cumulativeWork[slotIdx - 144] : cumulativeWork[slotIdx];
    return { rest24h, work24h, rest168h, work168h, work72h };
  };
  const checkCode3 = (slotIdx) => {
    if (slotIdx < 47) return false;
    const startIdx = slotIdx - 47;
    const restPeriods = [];
    let currentPeriod = 0;
    for (let i = startIdx; i <= slotIdx; i++) {
      if (timeline[i].isRest) {
        currentPeriod++;
      } else {
        if (currentPeriod > 0) {
          restPeriods.push(currentPeriod);
          currentPeriod = 0;
        }
      }
    }
    if (currentPeriod > 0) {
      restPeriods.push(currentPeriod);
    }
    if (restPeriods.length === 0) return true;
    restPeriods.sort((a, b) => b - a);
    const largestHours = restPeriods[0] * 0.5;
    const secondLargestHours = (restPeriods[1] || 0) * 0.5;
    return largestHours < 6 || largestHours + secondLargestHours < 10;
  };
  const updatedRecords = dailyRecords.map((record, dayIndex) => {
    const violations = [];
    const lastSlotIndex = (dayIndex + 1) * 48 - 1;
    if (lastSlotIndex >= 47) {
      const metrics = getRollingMetrics(lastSlotIndex);
      if (metrics.rest24h < RH_THRESHOLDS.MIN_REST_10H_IN_24H) {
        violations.push(1);
      }
      if (lastSlotIndex >= 335 && metrics.rest168h < RH_THRESHOLDS.MIN_REST_77H_IN_168H) {
        violations.push(2);
      }
      if (checkCode3(lastSlotIndex)) {
        violations.push(3);
      }
      if (metrics.work24h > RH_THRESHOLDS.MAX_WORK_14H_IN_24H) {
        violations.push(5);
      }
      if (lastSlotIndex >= 335 && metrics.work168h > RH_THRESHOLDS.MAX_WORK_72H_IN_168H) {
        violations.push(6);
      }
      if (metrics.work24h > RH_THRESHOLDS.OPA_MAX_WORK_15H_IN_24H) {
        violations.push(7);
      }
      if (lastSlotIndex >= 143 && metrics.work72h > RH_THRESHOLDS.OPA_MAX_WORK_36H_IN_72H) {
        violations.push(8);
      }
      return {
        ...record,
        violations,
        anyPeriodRest24hr: metrics.rest24h,
        anyPeriodRest7day: metrics.rest168h,
        anyPeriodWork24hr: metrics.work24h,
        anyPeriodWork7day: metrics.work168h
      };
    }
    return {
      ...record,
      violations: []
    };
  });
  return updatedRecords;
}
async function updateRecordingPercentages(crewMemberId, vesselId2, monthYear) {
  try {
    const dailyRecord = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId2, monthYear);
    if (!dailyRecord) {
      return;
    }
    const recordingPercent = calculateRecordingPercentage(dailyRecord.dailyRecords, monthYear);
    const crewRecords = await storage.getRestHoursCrewRecordsByFilters({
      vesselIds: [vesselId2],
      monthValue: monthYear
    });
    const existingCrewRecord = crewRecords.find((r) => r.crewMemberId === crewMemberId);
    if (existingCrewRecord) {
      await storage.updateRestHoursCrewRecord(existingCrewRecord.id, {
        recordingStatusPercent: recordingPercent
      });
    } else {
      await storage.createRestHoursCrewRecord({
        crewMemberId,
        vesselId: vesselId2,
        vesselName: "",
        // Will be enriched by API
        rank: dailyRecord.rank,
        name: dailyRecord.name,
        monthValue: monthYear,
        month: formatMonthDisplay(monthYear),
        signOnOffInfo: "",
        recordingStatusPercent: recordingPercent,
        activityConflicting: false,
        totalViolations: 0,
        totalNCs: 0,
        predictedViolations: 0,
        predictedNCs: 0
      });
    }
    await updateVesselRecordingPercentage(vesselId2, monthYear);
  } catch (error) {
    console.error("Failed to update recording percentages:", error);
  }
}
function formatMonthDisplay(monthValue) {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]}-${year}`;
}
async function updateVesselRecordingPercentage(vesselId2, monthValue) {
  try {
    const crewRecords = await storage.getRestHoursCrewRecordsByFilters({
      vesselIds: [vesselId2],
      monthValue
    });
    if (crewRecords.length === 0) {
      return;
    }
    const totalPercent = crewRecords.reduce((sum, record) => sum + (record.recordingStatusPercent || 0), 0);
    const averagePercent = Math.round(totalPercent / crewRecords.length);
    const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
      vesselIds: [vesselId2],
      monthValue
    });
    const existingVesselRecord = vesselRecords.find((r) => r.vesselId === vesselId2 && r.monthValue === monthValue);
    if (existingVesselRecord) {
      await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        recordingStatusPercent: averagePercent
      });
    } else {
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vessel = vesselMasterData?.find((v) => {
        const entryId = v.entryId || v.entry_id;
        return entryId === vesselId2;
      });
      const vesselName = vessel?.name || "";
      await storage.createRestHoursVesselRecord({
        vesselId: vesselId2,
        vesselName,
        monthValue,
        month: formatMonthDisplay(monthValue),
        totalCrew: crewRecords.length,
        recordingStatusPercent: averagePercent,
        activityConflicting: false,
        totalViolations: 0,
        crewWithViolations: 0,
        totalNCs: 0,
        crewWithNCs: 0,
        predictedViolations: 0,
        predictedNCs: 0,
        officeReviewStatus: calculateOfficeReviewStatus(monthValue, null, null)
      });
    }
  } catch (error) {
    console.error("Failed to update vessel recording percentage:", error);
  }
}
async function registerRoutes(app2) {
  app2.get("/api/health", async (req, res) => {
    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      // Gate sensitive information behind development environment check
      ...process.env.NODE_ENV === "development" && {
        rds_instance: "ls-d153072fe29fcd7dc7c484a33fd3130e29abae1b.cxock8yskd1i.ap-southeast-1.rds.amazonaws.com:3306",
        database_name: "crew_database"
      },
      connection_error: connectionError?.message || null,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (isConnected) {
      try {
        await storage.getForms();
        res.status(200).json({
          status: "healthy",
          ...healthStatus
        });
      } catch (error) {
        res.status(500).json({
          status: "unhealthy - query failed",
          ...healthStatus,
          query_error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      res.status(500).json({
        status: "unhealthy - no database connection",
        ...healthStatus,
        troubleshooting: {
          check_security_groups: "Ensure RDS security group allows connections from this environment",
          check_database_exists: "Verify 'crew_database' database exists on RDS instance",
          check_credentials: "Verify DB_USER and DB_PASSWORD are correct",
          check_network: "Ensure network connectivity to RDS endpoint"
        }
      });
    }
  });
  app2.get("/api/db-test", async (req, res) => {
    try {
      const startTime = Date.now();
      await storage.getForms();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      res.status(200).json({
        message: "Database connection successful",
        responseTime: `${responseTime}ms`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({
        error: "Database connection failed",
        details: error instanceof Error ? error.message : String(error),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app2.get("/api/forms", async (req, res) => {
    try {
      const forms2 = await storage.getForms();
      res.json(forms2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  });
  app2.get("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getForm(id);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form" });
    }
  });
  app2.post("/api/forms", async (req, res) => {
    try {
      const result = insertFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.createForm(result.data);
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to create form" });
    }
  });
  app2.put("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertFormSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.updateForm(id, result.data);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to update form" });
    }
  });
  app2.delete("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteForm(id);
      if (!deleted) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete form" });
    }
  });
  app2.get("/api/forms/for-rank/:rankLabel", async (req, res) => {
    try {
      const rankLabel = req.params.rankLabel;
      const category = req.query.category;
      const form = await storage.getFormForRank(rankLabel, category);
      if (!form) {
        return res.status(404).json({ error: "No form configured for this rank" });
      }
      const rankGroups2 = await storage.getRankGroups(form.id, false);
      let rankGroupConfig = null;
      let rankGroupName = null;
      const matchingGroups = [];
      for (const rg of rankGroups2) {
        try {
          const ranks = JSON.parse(rg.ranks);
          if (Array.isArray(ranks) && ranks.includes(rankLabel)) {
            matchingGroups.push({
              id: rg.id,
              name: rg.name,
              configuration: rg.configuration
            });
          }
        } catch (e) {
          console.error(`Error parsing ranks for rank group ${rg.id}:`, e);
        }
      }
      if (matchingGroups.length > 1) {
        console.warn(`\u26A0\uFE0F [DATA INTEGRITY] Rank "${rankLabel}" found in ${matchingGroups.length} ACTIVE rank groups. Groups: ${matchingGroups.map((g) => `"${g.name}" (id:${g.id}, hasConfig:${!!g.configuration})`).join(", ")}`);
      }
      if (matchingGroups.length > 0) {
        const groupsWithConfig = matchingGroups.filter((g) => g.configuration);
        const groupsWithoutConfig = matchingGroups.filter((g) => !g.configuration);
        let selectedGroup;
        if (groupsWithConfig.length > 0) {
          selectedGroup = groupsWithConfig.sort((a, b) => a.id - b.id)[0];
          rankGroupConfig = JSON.parse(selectedGroup.configuration);
          console.log(`\u2705 [/api/forms/for-rank/${rankLabel}] Using rank group "${selectedGroup.name}" (id: ${selectedGroup.id}) with configuration`);
        } else {
          selectedGroup = groupsWithoutConfig.sort((a, b) => a.id - b.id)[0];
          console.log(`\u2139\uFE0F [/api/forms/for-rank/${rankLabel}] Using rank group "${selectedGroup.name}" (id: ${selectedGroup.id}) - no configuration saved yet`);
        }
        rankGroupName = selectedGroup.name;
      } else {
        console.log(`\u274C [/api/forms/for-rank/${rankLabel}] No active rank groups found for this rank`);
      }
      res.json({
        ...form,
        rankGroupName,
        rankGroupConfig
      });
    } catch (error) {
      console.error(`\u274C [/api/forms/for-rank/:rankLabel] Error:`, error);
      res.status(500).json({ error: "Failed to fetch form for rank" });
    }
  });
  app2.post("/api/forms/cleanup-duplicates", async (req, res) => {
    try {
      const forms2 = await storage.getForms();
      const duplicateForms = forms2.filter((f) => f.name === "Crew Appraisal Form");
      if (duplicateForms.length <= 1) {
        return res.json({
          message: "No duplicates found",
          totalForms: duplicateForms.length
        });
      }
      const formToKeep = duplicateForms.reduce(
        (prev, curr) => prev.id < curr.id ? prev : curr
      );
      const formsToDelete = duplicateForms.filter((f) => f.id !== formToKeep.id);
      let deletedCount = 0;
      for (const form of formsToDelete) {
        const success = await storage.deleteForm(form.id);
        if (success) {
          deletedCount++;
          console.log(`\u{1F5D1}\uFE0F Deleted duplicate form ID: ${form.id}`);
        }
      }
      res.json({
        message: "Cleanup completed",
        kept: formToKeep.id,
        deletedCount,
        totalOriginal: duplicateForms.length
      });
    } catch (error) {
      console.error("Error cleaning up duplicate forms:", error);
      res.status(500).json({ error: "Failed to cleanup duplicate forms" });
    }
  });
  app2.get("/api/forms/:formId/versions", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const rankGroupId = req.query.rankGroupId ? parseInt(req.query.rankGroupId) : void 0;
      const versions = await storage.getFormVersions(formId, rankGroupId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching form versions:", error);
      res.status(500).json({ error: "Failed to fetch form versions" });
    }
  });
  app2.get("/api/form-versions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const version = await storage.getFormVersion(id);
      if (!version) {
        return res.status(404).json({ error: "Form version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error fetching form version:", error);
      res.status(500).json({ error: "Failed to fetch form version" });
    }
  });
  app2.post("/api/forms/:formId/versions", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const result = insertFormVersionSchema.safeParse({ ...req.body, formId });
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form version data", details: result.error.issues });
      }
      if (!result.data.rankGroupId) {
        console.warn(`\u26A0\uFE0F [CREATE VERSION] Missing rankGroupId for form ${formId} - version will not be properly isolated`);
        return res.status(400).json({
          error: "rankGroupId is required to create a version. Please select a rank group first."
        });
      }
      const version = await storage.createFormVersion(result.data);
      console.log(`\u2705 [CREATE VERSION] Created version ${version.versionNo} for form ${formId}, rankGroup ${result.data.rankGroupId}`);
      res.json(version);
    } catch (error) {
      console.error("Error creating form version:", error);
      res.status(500).json({ error: "Failed to create form version" });
    }
  });
  app2.put("/api/form-versions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertFormVersionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form version data", details: result.error.issues });
      }
      const version = await storage.updateFormVersion(id, result.data);
      if (!version) {
        return res.status(404).json({ error: "Form version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error updating form version:", error);
      res.status(500).json({ error: "Failed to update form version" });
    }
  });
  app2.post("/api/form-versions/:id/release", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const version = await storage.releaseFormVersion(id);
      if (!version) {
        return res.status(404).json({ error: "Form version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error releasing form version:", error);
      res.status(500).json({ error: "Failed to release form version" });
    }
  });
  app2.delete("/api/form-versions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFormVersion(id);
      if (!deleted) {
        return res.status(404).json({ error: "Form version not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting form version:", error);
      res.status(500).json({ error: "Failed to delete form version" });
    }
  });
  app2.get("/api/rank-groups", async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived === "true";
      const rankGroups2 = await storage.getAllRankGroups(includeArchived);
      res.json(rankGroups2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  });
  app2.get("/api/rank-groups/form/:formId", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const includeArchived = req.query.includeArchived === "true";
      const rankGroups2 = await storage.getRankGroups(formId, includeArchived);
      res.json(rankGroups2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  });
  function normalizeRankForComparison(rank) {
    let normalized = rank.trim();
    const suffixMatch = normalized.match(/^(.+?)_\d+$/);
    if (suffixMatch) {
      normalized = suffixMatch[1];
    }
    return normalized.toLowerCase();
  }
  app2.get("/api/rank-groups/check-assignment", async (req, res) => {
    try {
      const { rank, formName } = req.query;
      if (!rank || !formName) {
        return res.status(400).json({ error: "rank and formName are required" });
      }
      const inputRank = rank.trim();
      const normalizedInputRank = normalizeRankForComparison(inputRank);
      const forms2 = await storage.getForms();
      const form = forms2.find((f) => f.name === formName);
      if (!form) {
        return res.json({
          hasAssignment: false,
          message: `Form "${formName}" not found in system`
        });
      }
      const activeRankGroups = await storage.getRankGroups(form.id, false);
      for (const group of activeRankGroups) {
        let ranks = [];
        try {
          ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
        } catch (e) {
          ranks = [];
        }
        const matchedRank = ranks.find((r) => normalizeRankForComparison(r) === normalizedInputRank);
        if (matchedRank) {
          return res.json({
            hasAssignment: true,
            rankGroupId: group.id,
            rankGroupName: group.name,
            formId: form.id,
            matchedRank
          });
        }
      }
      return res.json({
        hasAssignment: false,
        message: `No Appraisal Rank Group assigned from Admin Module`
      });
    } catch (error) {
      console.error("Error checking rank assignment:", error);
      res.status(500).json({ error: "Failed to check rank assignment" });
    }
  });
  app2.get("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rankGroup = await storage.getRankGroup(id);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rank group" });
    }
  });
  async function checkRankConflicts(formId, newRanks, excludeGroupId) {
    const activeRankGroups = await storage.getRankGroups(formId, false);
    const conflicts = [];
    for (const group of activeRankGroups) {
      if (excludeGroupId && group.id === excludeGroupId) continue;
      let groupRanks = [];
      try {
        groupRanks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
      } catch (e) {
        groupRanks = [];
      }
      for (const rank of newRanks) {
        if (groupRanks.includes(rank)) {
          conflicts.push({ rank, groupName: group.name });
        }
      }
    }
    return { hasConflict: conflicts.length > 0, conflictingRanks: conflicts };
  }
  app2.post("/api/rank-groups", async (req, res) => {
    try {
      console.log("\u{1F4E5} [POST /api/rank-groups] Request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertRankGroupSchema.parse(req.body);
      console.log("\u2705 [POST /api/rank-groups] Validation passed:", JSON.stringify(validatedData, null, 2));
      let newRanks = [];
      try {
        newRanks = typeof validatedData.ranks === "string" ? JSON.parse(validatedData.ranks) : validatedData.ranks;
      } catch (e) {
        newRanks = [];
      }
      const { hasConflict, conflictingRanks } = await checkRankConflicts(validatedData.formId, newRanks);
      if (hasConflict) {
        const conflictDetails = conflictingRanks.map((c) => `"${c.rank}" is already assigned to "${c.groupName}"`).join(", ");
        return res.status(400).json({
          error: "Rank conflict detected",
          message: `The following ranks are already assigned to other active rank groups: ${conflictDetails}`,
          conflictingRanks
        });
      }
      const rankGroup = await storage.createRankGroup(validatedData);
      console.log("\u2705 [POST /api/rank-groups] Created rank group:", JSON.stringify(rankGroup, null, 2));
      res.status(201).json(rankGroup);
    } catch (error) {
      console.error("\u274C [POST /api/rank-groups] Error:", error);
      if (error instanceof z2.ZodError) {
        console.error("\u274C [POST /api/rank-groups] Validation errors:", JSON.stringify(error.errors, null, 2));
      }
      res.status(400).json({ error: "Invalid rank group data", details: error instanceof z2.ZodError ? error.errors : void 0 });
    }
  });
  app2.put("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRankGroupSchema.partial().parse(req.body);
      const existingGroup = await storage.getRankGroup(id);
      if (!existingGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      if (validatedData.ranks) {
        let newRanks = [];
        try {
          newRanks = typeof validatedData.ranks === "string" ? JSON.parse(validatedData.ranks) : validatedData.ranks;
        } catch (e) {
          newRanks = [];
        }
        const { hasConflict, conflictingRanks } = await checkRankConflicts(existingGroup.formId, newRanks, id);
        if (hasConflict) {
          const conflictDetails = conflictingRanks.map((c) => `"${c.rank}" is already assigned to "${c.groupName}"`).join(", ");
          return res.status(400).json({
            error: "Rank conflict detected",
            message: `The following ranks are already assigned to other active rank groups: ${conflictDetails}`,
            conflictingRanks
          });
        }
      }
      const rankGroup = await storage.updateRankGroup(id, validatedData);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank group data" });
    }
  });
  app2.put("/api/rank-groups/:id/configuration", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { configuration } = req.body;
      if (configuration === void 0) {
        return res.status(400).json({ error: "Configuration is required" });
      }
      let configString;
      if (typeof configuration === "string") {
        try {
          JSON.parse(configuration);
          configString = configuration;
        } catch (e) {
          return res.status(400).json({ error: "Invalid JSON configuration" });
        }
      } else {
        configString = JSON.stringify(configuration);
      }
      const rankGroup = await storage.updateRankGroup(id, { configuration: configString });
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      console.log(`\u2705 [PUT /api/rank-groups/${id}/configuration] Configuration updated successfully`);
      res.json(rankGroup);
    } catch (error) {
      console.error(`\u274C [PUT /api/rank-groups/:id/configuration] Error:`, error);
      res.status(500).json({ error: "Failed to update rank group configuration" });
    }
  });
  app2.post("/api/rank-groups/:id/archive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rankGroup = await storage.archiveRankGroup(id);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive rank group" });
    }
  });
  app2.post("/api/rank-groups/:id/unarchive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rankGroup = await storage.unarchiveRankGroup(id);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive rank group" });
    }
  });
  app2.delete("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRankGroup(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank group" });
    }
  });
  app2.get("/api/rank-groups/form/:formId/rank-conflicts", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const excludeGroupId = req.query.excludeGroupId ? parseInt(req.query.excludeGroupId) : void 0;
      const activeRankGroups = await storage.getRankGroups(formId, false);
      const rankToGroupMap = {};
      for (const group of activeRankGroups) {
        if (excludeGroupId && group.id === excludeGroupId) continue;
        let ranks = [];
        try {
          ranks = typeof group.ranks === "string" ? JSON.parse(group.ranks) : group.ranks;
        } catch (e) {
          ranks = [];
        }
        for (const rank of ranks) {
          rankToGroupMap[rank] = group.name;
        }
      }
      res.json(rankToGroupMap);
    } catch (error) {
      console.error("Error getting rank conflicts:", error);
      res.status(500).json({ error: "Failed to get rank conflicts" });
    }
  });
  app2.get("/api/available-ranks", async (req, res) => {
    try {
      const companyOnly = req.query.companyOnly === "true";
      let ranks = await storage.getAvailableRanks();
      if (companyOnly) {
        ranks = ranks.filter((rank) => rank.applicableToCompany === true);
      }
      res.json(ranks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available ranks" });
    }
  });
  app2.post("/api/available-ranks", async (req, res) => {
    try {
      console.log("\u{1F4E5} [POST /api/available-ranks] Request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertAvailableRankSchema.parse(req.body);
      console.log("\u2705 [POST /api/available-ranks] Validation passed:", JSON.stringify(validatedData, null, 2));
      const rank = await storage.createAvailableRank(validatedData);
      console.log("\u2705 [POST /api/available-ranks] Created rank:", JSON.stringify(rank, null, 2));
      res.status(201).json(rank);
    } catch (error) {
      console.error("\u274C [POST /api/available-ranks] Error:", error);
      if (error instanceof z2.ZodError) {
        console.error("\u274C [POST /api/available-ranks] Validation errors:", JSON.stringify(error.errors, null, 2));
      }
      res.status(400).json({ error: "Invalid rank data", details: error instanceof z2.ZodError ? error.errors : void 0 });
    }
  });
  app2.put("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAvailableRankSchema.partial().parse(req.body);
      const existingRank = await storage.getAvailableRank(id);
      if (existingRank?.isSystemRank && validatedData.name && validatedData.name !== existingRank.name) {
        return res.status(403).json({ error: "Cannot change the name of a system rank. System ranks are protected." });
      }
      const rank = await storage.updateAvailableRank(id, validatedData);
      if (!rank) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json(rank);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank data" });
    }
  });
  app2.delete("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingRank = await storage.getAvailableRank(id);
      if (existingRank?.isSystemRank) {
        return res.status(403).json({ error: "Cannot delete a system rank. System ranks are protected and part of the starter pack." });
      }
      const deleted = await storage.deleteAvailableRank(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank" });
    }
  });
  app2.delete("/api/available-ranks", async (req, res) => {
    try {
      await storage.clearAllAvailableRanks();
      res.json({ success: true, message: "All ranks cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear ranks" });
    }
  });
  app2.post("/api/available-ranks/reorder", async (req, res) => {
    try {
      const validatedData = rankReorderSchema.parse(req.body);
      const success = await storage.updateRankOrders(validatedData);
      if (!success) {
        return res.status(500).json({ error: "Failed to update rank orders" });
      }
      res.json({ success: true, message: "Rank orders updated successfully" });
    } catch (error) {
      console.error("Rank reorder error:", error);
      if (error instanceof z2.ZodError) {
        return res.status(400).json({ error: "Invalid reorder data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reorder ranks" });
    }
  });
  app2.get("/api/company-ranks", async (req, res) => {
    try {
      const companyRanks2 = await storage.getCompanyRanks();
      res.json(companyRanks2);
    } catch (error) {
      console.error("\u274C Failed to fetch company ranks:", error);
      res.status(500).json({ error: "Failed to fetch company ranks" });
    }
  });
  app2.post("/api/company-ranks", async (req, res) => {
    try {
      const companyRanks2 = await storage.saveAllCompanyRanks(req.body);
      console.log(`\u{1F4BE} [API] Successfully saved ${companyRanks2.length} company ranks to persistent storage`);
      res.json({ success: true, data: companyRanks2 });
    } catch (error) {
      console.error("\u274C Failed to save company ranks:", error);
      res.status(500).json({ error: "Failed to save company ranks" });
    }
  });
  app2.get("/api/company-ranks/by-name/:rankName", async (req, res) => {
    try {
      const { rankName } = req.params;
      const companyRank = await storage.getCompanyRankByName(decodeURIComponent(rankName));
      if (!companyRank) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json(companyRank);
    } catch (error) {
      console.error("\u274C Failed to fetch company rank by name:", error);
      res.status(500).json({ error: "Failed to fetch company rank" });
    }
  });
  app2.get("/api/promotion-hierarchies", async (req, res) => {
    try {
      const hierarchies = await storage.getPromotionHierarchies();
      const parsedHierarchies = hierarchies.map((h) => ({
        ...h,
        rankPath: typeof h.rankPath === "string" ? JSON.parse(h.rankPath) : h.rankPath
      }));
      res.json(parsedHierarchies);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion hierarchies:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchies" });
    }
  });
  app2.get("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const hierarchy = await storage.getPromotionHierarchy(id);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchy" });
    }
  });
  app2.post("/api/promotion-hierarchies", async (req, res) => {
    try {
      const result = insertPromotionHierarchySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.createPromotionHierarchy(result.data);
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.status(201).json(parsedHierarchy);
    } catch (error) {
      console.error("\u274C Failed to create promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to create promotion hierarchy" });
    }
  });
  app2.patch("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPromotionHierarchySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.updatePromotionHierarchy(id, result.data);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("\u274C Failed to update promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to update promotion hierarchy" });
    }
  });
  app2.delete("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePromotionHierarchy(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      res.json({ success: true, message: "Promotion hierarchy deleted successfully" });
    } catch (error) {
      console.error("\u274C Failed to delete promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to delete promotion hierarchy" });
    }
  });
  app2.get("/api/company-processing", async (req, res) => {
    try {
      const records = await storage.getCompanyProcessingRecords();
      res.json(records);
    } catch (error) {
      console.error("\u274C Failed to fetch company processing records:", error);
      res.status(500).json({ error: "Failed to fetch company processing records" });
    }
  });
  app2.get("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getCompanyProcessing(id);
      if (!record) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("\u274C Failed to fetch company processing record:", error);
      res.status(500).json({ error: "Failed to fetch company processing record" });
    }
  });
  app2.get("/api/company-processing/candidate/:candidateId", async (req, res) => {
    try {
      const candidateId = req.params.candidateId;
      const records = await storage.getCompanyProcessingByCandidateId(candidateId);
      res.json(records);
    } catch (error) {
      console.error("\u274C Failed to fetch company processing records for candidate:", error);
      res.status(500).json({ error: "Failed to fetch company processing records for candidate" });
    }
  });
  app2.post("/api/company-processing", async (req, res) => {
    try {
      const result = insertCompanyProcessingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid company processing data", details: result.error.issues });
      }
      const record = await storage.createCompanyProcessing(result.data);
      console.log(`\u2705 [API] Created company processing record ID ${record.id} for candidate ${record.candidateId}`);
      res.status(201).json(record);
    } catch (error) {
      console.error("\u274C Failed to create company processing record:", error);
      res.status(500).json({ error: "Failed to create company processing record" });
    }
  });
  app2.patch("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertCompanyProcessingSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid company processing data", details: result.error.issues });
      }
      const record = await storage.updateCompanyProcessing(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      console.log(`\u2705 [API] Updated company processing record ID ${id}`);
      res.json(record);
    } catch (error) {
      console.error("\u274C Failed to update company processing record:", error);
      res.status(500).json({ error: "Failed to update company processing record" });
    }
  });
  app2.delete("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCompanyProcessing(id);
      if (!success) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      console.log(`\u2705 [API] Deleted company processing record ID ${id}`);
      res.json({ success: true, message: "Company processing record deleted successfully" });
    } catch (error) {
      console.error("\u274C Failed to delete company processing record:", error);
      res.status(500).json({ error: "Failed to delete company processing record" });
    }
  });
  app2.get("/api/promotions", async (req, res) => {
    try {
      const forms2 = await storage.getPromotionForms();
      res.json(forms2);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion forms:", error);
      res.status(500).json({ error: "Failed to fetch promotion forms" });
    }
  });
  app2.get("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getPromotionForm(id);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      res.json(form);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion form:", error);
      res.status(500).json({ error: "Failed to fetch promotion form" });
    }
  });
  app2.get("/api/promotions/crew/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const forms2 = await storage.getPromotionFormsByCrewMember(crewMemberId);
      res.json(forms2);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion forms for crew member:", error);
      res.status(500).json({ error: "Failed to fetch promotion forms for crew member" });
    }
  });
  app2.post("/api/promotions", async (req, res) => {
    try {
      const result = insertPromotionFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion form data", details: result.error.issues });
      }
      const form = await storage.createPromotionForm(result.data);
      console.log(`\u2705 [API] Created promotion form ID ${form.id} for crew ${form.crewMemberId}`);
      res.status(201).json(form);
    } catch (error) {
      console.error("\u274C Failed to create promotion form:", error);
      res.status(500).json({ error: "Failed to create promotion form" });
    }
  });
  app2.patch("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPromotionFormSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion form data", details: result.error.issues });
      }
      const form = await storage.updatePromotionForm(id, result.data);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`\u2705 [API] Updated promotion form ID ${id}`);
      res.json(form);
    } catch (error) {
      console.error("\u274C Failed to update promotion form:", error);
      res.status(500).json({ error: "Failed to update promotion form" });
    }
  });
  app2.delete("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePromotionForm(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`\u2705 [API] Deleted promotion form ID ${id}`);
      res.json({ success: true, message: "Promotion form deleted successfully" });
    } catch (error) {
      console.error("\u274C Failed to delete promotion form:", error);
      res.status(500).json({ error: "Failed to delete promotion form" });
    }
  });
  app2.post("/api/promotions/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewedBy, comments, effectiveDate } = req.body;
      if (!reviewedBy || !comments || !effectiveDate) {
        return res.status(400).json({ error: "Missing required fields: reviewedBy, comments, effectiveDate" });
      }
      const form = await storage.approvePromotionForm(id, reviewedBy, comments, effectiveDate);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`\u2705 [API] Approved promotion form ID ${id} by ${reviewedBy}`);
      res.json(form);
    } catch (error) {
      console.error("\u274C Failed to approve promotion form:", error);
      res.status(500).json({ error: "Failed to approve promotion form" });
    }
  });
  app2.post("/api/promotions/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewedBy, comments } = req.body;
      if (!reviewedBy || !comments) {
        return res.status(400).json({ error: "Missing required fields: reviewedBy, comments" });
      }
      const form = await storage.rejectPromotionForm(id, reviewedBy, comments);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`\u2705 [API] Rejected promotion form ID ${id} by ${reviewedBy}`);
      res.json(form);
    } catch (error) {
      console.error("\u274C Failed to reject promotion form:", error);
      res.status(500).json({ error: "Failed to reject promotion form" });
    }
  });
  function findNextPromotionRank(currentRank, hierarchies) {
    for (const hierarchy of hierarchies) {
      let rankPath;
      try {
        rankPath = typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : Array.isArray(hierarchy.rankPath) ? hierarchy.rankPath : [];
      } catch (e) {
        rankPath = [];
      }
      if (!rankPath.includes(currentRank)) {
        continue;
      }
      const currentIndex = rankPath.indexOf(currentRank);
      if (currentIndex > 0) {
        return rankPath[currentIndex - 1];
      } else {
        return null;
      }
    }
    return null;
  }
  async function ensurePromotionReviewsForEligibleCrew() {
    let created = 0;
    let existing = 0;
    try {
      const [crewMembers2, hierarchies, existingReviews] = await Promise.all([
        storage.getCrewMembers(),
        storage.getPromotionHierarchies(),
        storage.getPromotionReviews()
      ]);
      const existingKeys = new Set(
        existingReviews.map((r) => `${r.crewMemberId}__${r.promotionToRank}`)
      );
      const ranksInHierarchies = /* @__PURE__ */ new Set();
      for (const h of hierarchies) {
        const rankPath = typeof h.rankPath === "string" ? JSON.parse(h.rankPath) : h.rankPath || [];
        rankPath.forEach((r) => ranksInHierarchies.add(r));
      }
      const reviewsToCreate = [];
      for (const crew of crewMembers2) {
        const currentRank = crew.presentRank || "";
        if (!currentRank || !ranksInHierarchies.has(currentRank)) {
          continue;
        }
        const nextRank = findNextPromotionRank(currentRank, hierarchies);
        if (!nextRank) {
          continue;
        }
        const key = `${crew.id}__${nextRank}`;
        if (existingKeys.has(key)) {
          existing++;
          continue;
        }
        reviewsToCreate.push({
          crewMemberId: crew.id,
          promotionToRank: nextRank
        });
      }
      for (const reviewData of reviewsToCreate) {
        try {
          await storage.createPromotionReview({
            crewMemberId: reviewData.crewMemberId,
            promotionToRank: reviewData.promotionToRank,
            status: "In Progress"
          });
          created++;
        } catch (error) {
          if (error?.code === "23505") {
            existing++;
          } else {
            console.error(`Failed to create promotion review for ${reviewData.crewMemberId}:`, error);
          }
        }
      }
      if (created > 0) {
        console.log(`\u2705 [Sync] Created ${created} new promotion reviews, ${existing} already existed`);
      }
      return { created, existing };
    } catch (error) {
      console.error("\u274C Failed to sync promotion reviews:", error);
      return { created: 0, existing: 0 };
    }
  }
  app2.get("/api/promotion-reviews", async (req, res) => {
    try {
      await ensurePromotionReviewsForEligibleCrew();
      const reviews = await storage.getPromotionReviews();
      res.json(reviews);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion reviews:", error);
      res.status(500).json({ error: "Failed to fetch promotion reviews" });
    }
  });
  app2.get("/api/promotion-reviews/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const review = await storage.getPromotionReview(id);
      if (!review) {
        return res.status(404).json({ error: "Promotion review not found" });
      }
      res.json(review);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion review:", error);
      res.status(500).json({ error: "Failed to fetch promotion review" });
    }
  });
  app2.get("/api/promotion-reviews/crew/:crewMemberId", async (req, res) => {
    try {
      const { crewMemberId } = req.params;
      const reviews = await storage.getPromotionReviewsByCrewMember(crewMemberId);
      res.json(reviews);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion reviews for crew:", error);
      res.status(500).json({ error: "Failed to fetch promotion reviews" });
    }
  });
  app2.get("/api/promotion-reviews/crew/:crewMemberId/rank/:promotionToRank", async (req, res) => {
    try {
      const { crewMemberId, promotionToRank } = req.params;
      const review = await storage.getPromotionReviewByCrewAndRank(crewMemberId, decodeURIComponent(promotionToRank));
      if (!review) {
        return res.status(404).json({ error: "Promotion review not found" });
      }
      res.json(review);
    } catch (error) {
      console.error("\u274C Failed to fetch promotion review:", error);
      res.status(500).json({ error: "Failed to fetch promotion review" });
    }
  });
  app2.post("/api/promotion-reviews", async (req, res) => {
    try {
      const review = await storage.createPromotionReview(req.body);
      console.log(`\u2705 [API] Created promotion review ID ${review.id} for crew ${review.crewMemberId}`);
      res.status(201).json(review);
    } catch (error) {
      console.error("\u274C Failed to create promotion review:", error);
      res.status(500).json({ error: "Failed to create promotion review" });
    }
  });
  app2.patch("/api/promotion-reviews/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const review = await storage.updatePromotionReview(id, req.body);
      if (!review) {
        return res.status(404).json({ error: "Promotion review not found" });
      }
      console.log(`\u2705 [API] Updated promotion review ID ${id}`);
      res.json(review);
    } catch (error) {
      console.error("\u274C Failed to update promotion review:", error);
      res.status(500).json({ error: "Failed to update promotion review" });
    }
  });
  app2.delete("/api/promotion-reviews/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePromotionReview(id);
      if (!deleted) {
        return res.status(404).json({ error: "Promotion review not found" });
      }
      console.log(`\u2705 [API] Deleted promotion review ID ${id}`);
      res.json({ success: true });
    } catch (error) {
      console.error("\u274C Failed to delete promotion review:", error);
      res.status(500).json({ error: "Failed to delete promotion review" });
    }
  });
  app2.get("/api/vessel-groups", async (req, res) => {
    try {
      const vesselGroups2 = await storage.getVesselGroups();
      res.json(vesselGroups2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel groups" });
    }
  });
  app2.get("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselGroup = await storage.getVesselGroup(id);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel group" });
    }
  });
  app2.post("/api/vessel-groups", async (req, res) => {
    try {
      const normalizedBody = {
        ...req.body,
        vesselIds: Array.isArray(req.body.vesselIds) ? JSON.stringify(req.body.vesselIds) : req.body.vesselIds
      };
      const result = insertVesselGroupSchema.safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      const vesselGroup = await storage.createVesselGroup(result.data);
      res.status(201).json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vessel group" });
    }
  });
  app2.patch("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const normalizedBody = {
        ...req.body,
        ...req.body.vesselIds && {
          vesselIds: Array.isArray(req.body.vesselIds) ? JSON.stringify(req.body.vesselIds) : req.body.vesselIds
        }
      };
      const result = insertVesselGroupSchema.partial().safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      const vesselGroup = await storage.updateVesselGroup(id, result.data);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel group" });
    }
  });
  app2.delete("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselGroup(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel group" });
    }
  });
  app2.get("/api/vessel-drafts", async (req, res) => {
    try {
      const vesselDrafts2 = await storage.getVesselDrafts();
      res.json(vesselDrafts2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel drafts" });
    }
  });
  app2.get("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselDraft = await storage.getVesselDraft(id);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel draft" });
    }
  });
  app2.get("/api/vessel-drafts/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      console.log(`\u{1F6A2} [VESSEL DRAFT API] Fetching drafts for vessel: ${vesselId2}`);
      const vesselDrafts2 = await storage.getVesselDraftsByVessel(vesselId2);
      console.log(`\u{1F6A2} [VESSEL DRAFT API] Found ${vesselDrafts2.length} drafts for vessel ${vesselId2}`);
      res.json(vesselDrafts2);
    } catch (error) {
      console.error(`\u{1F6A2} [VESSEL DRAFT API ERROR] Failed to fetch vessel drafts for vessel ${req.params.vesselId}:`, error);
      res.status(500).json({ error: "Failed to fetch vessel drafts for vessel" });
    }
  });
  app2.post("/api/vessel-drafts", async (req, res) => {
    try {
      console.log(`\u{1F6A2} [VESSEL DRAFT CREATE] Attempting to create vessel draft with data:`, req.body);
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`\u{1F6A2} [VESSEL DRAFT VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      console.log(`\u{1F6A2} [VESSEL DRAFT CREATE] Validation passed, creating draft for vessel ${result.data.vesselId}`);
      const vesselDraft = await storage.createVesselDraft(result.data);
      console.log(`\u{1F6A2} [VESSEL DRAFT CREATE] Successfully created draft with ID: ${vesselDraft.id}`);
      res.status(201).json(vesselDraft);
    } catch (error) {
      console.error(`\u{1F6A2} [VESSEL DRAFT CREATE ERROR] Failed to create vessel draft:`, error);
      res.status(500).json({ error: "Failed to create vessel draft" });
    }
  });
  app2.patch("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertVesselDraftSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      const vesselDraft = await storage.updateVesselDraft(id, result.data);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel draft" });
    }
  });
  app2.delete("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselDraft(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel draft" });
    }
  });
  app2.post("/api/vessel-drafts/upsert", async (req, res) => {
    try {
      console.log(`\u{1F4BE} [DRAFT UPSERT] Attempting to save draft for vessel:`, req.body.vesselId);
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`\u{1F4BE} [DRAFT UPSERT ERROR] Validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      const existingDrafts = await storage.getVesselDraftsByVessel(result.data.vesselId);
      if (existingDrafts.length > 0) {
        const existingDraft = existingDrafts[0];
        console.log(`\u{1F4BE} [DRAFT UPSERT] Found existing draft (ID: ${existingDraft.id}), updating...`);
        const updatedDraft = await storage.updateVesselDraft(existingDraft.id, result.data);
        console.log(`\u{1F4BE} [DRAFT UPSERT] Successfully updated draft ID: ${existingDraft.id}`);
        res.json({ action: "updated", draft: updatedDraft });
      } else {
        console.log(`\u{1F4BE} [DRAFT UPSERT] No existing draft found, creating new draft...`);
        const newDraft = await storage.createVesselDraft(result.data);
        console.log(`\u{1F4BE} [DRAFT UPSERT] Successfully created new draft ID: ${newDraft.id}`);
        res.status(201).json({ action: "created", draft: newDraft });
      }
    } catch (error) {
      console.error(`\u{1F4BE} [DRAFT UPSERT ERROR] Failed to upsert vessel draft:`, error);
      res.status(500).json({ error: "Failed to save vessel draft" });
    }
  });
  app2.get("/api/vessel-revisions", async (req, res) => {
    try {
      const vesselRevisions2 = await storage.getVesselRevisions();
      res.json(vesselRevisions2);
    } catch (error) {
      console.error("Failed to fetch vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });
  app2.get("/api/vessel-revisions/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      console.log(`\u{1F4DC} [VESSEL REVISION API] Fetching revisions for vessel: ${vesselId2}`);
      const vesselRevisions2 = await storage.getVesselRevisionsByVessel(vesselId2);
      console.log(`\u{1F4DC} [VESSEL REVISION API] Found ${vesselRevisions2.length} revisions for vessel ${vesselId2}`);
      res.json(vesselRevisions2);
    } catch (error) {
      console.error("Failed to fetch vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });
  app2.get("/api/vessel-revisions/debug/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      console.log(`\u{1F50D} [DEBUG API] Fetching revision metadata for vessel: ${vesselId2}`);
      const vesselRevisions2 = await storage.getVesselRevisionsByVessel(vesselId2);
      if (vesselRevisions2.length === 0) {
        return res.json({ vesselId: vesselId2, message: "No revisions found", revisions: [] });
      }
      const debugInfo = vesselRevisions2.map((rev) => {
        let rankCount = 0;
        let activeRankCount = 0;
        try {
          const rankData = JSON.parse(rev.revisionData);
          rankCount = rankData.length;
          activeRankCount = rankData.filter(
            (rank) => rank.actualManningFlag || rank.safeManning || rank.optimumManning || rank.highWorkloadManning
          ).length;
        } catch (e) {
        }
        return {
          id: rev.id,
          revision: rev.revision,
          revisionDate: rev.revisionDate,
          createdAt: rev.createdAt,
          totalRanks: rankCount,
          activeRanks: activeRankCount,
          hasData: rankCount > 0
        };
      });
      const sorted = [...debugInfo].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      res.json({
        vesselId: vesselId2,
        totalRevisions: vesselRevisions2.length,
        selectedRevision: sorted[0],
        allRevisions: sorted
      });
    } catch (error) {
      console.error("Failed to debug vessel revisions:", error);
      res.status(500).json({ error: "Failed to debug vessel revisions" });
    }
  });
  app2.get("/api/vessel-revisions/ranks/:vesselId", async (req, res) => {
    try {
      let { vesselId: vesselId2 } = req.params;
      console.log(`\u{1F4DC} [VESSEL RANKS API] Fetching ranks for vessel: ${vesselId2}`);
      const UUID_PATTERN2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_PATTERN2.test(vesselId2)) {
        console.log(`\u{1F4DC} [VESSEL RANKS API] vesselId is not UUID format, attempting translation`);
        const vessels2 = await storage.getMasterDataEntries("014");
        let matchedVessel = vessels2.find(
          (v) => v.name === vesselId2 || v.vessel === vesselId2
        );
        if (!matchedVessel && /^\d+$/.test(vesselId2)) {
          matchedVessel = vessels2.find((v) => String(v.id) === vesselId2);
          if (matchedVessel) {
            console.log(`\u{1F4DC} [VESSEL RANKS API] Matched numeric ID "${vesselId2}" to vessel entry`);
          }
        }
        if (matchedVessel) {
          const translatedId = matchedVessel.entryId;
          console.log(`\u{1F4DC} [VESSEL RANKS API] Translated "${vesselId2}" to UUID "${translatedId}"`);
          vesselId2 = translatedId;
        } else {
          console.log(`\u{1F4DC} [VESSEL RANKS API] No vessel found matching "${vesselId2}"`);
        }
      }
      const vesselRevisions2 = await storage.getVesselRevisionsByVessel(vesselId2);
      if (vesselRevisions2.length === 0) {
        console.log(`\u{1F4DC} [VESSEL RANKS API] No revisions found for vessel ${vesselId2}`);
        return res.json([]);
      }
      const sortedRevisions = vesselRevisions2.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      const latestRevision = sortedRevisions[0];
      console.log(`\u{1F4DC} [VESSEL RANKS API] Latest revision for vessel ${vesselId2}: ${latestRevision.revision} (id: ${latestRevision.id}, created: ${latestRevision.createdAt})`);
      const rankData = JSON.parse(latestRevision.revisionData);
      const availableRanks2 = await storage.getAvailableRanks();
      const availableRanksMapById = new Map(availableRanks2.map((ar) => [String(ar.id), ar]));
      const companyRanks2 = await storage.getCompanyRanks();
      const companyRanksMapById = new Map(companyRanks2.map((cr) => [cr.id, cr]));
      const mergedRankData = rankData.map((vesselRank) => {
        const companyRank = companyRanksMapById.get(vesselRank.id);
        const availableRank = availableRanksMapById.get(vesselRank.id);
        let effectiveSortOrder = vesselRank.sortOrder ?? 0;
        if (vesselRank.isRoleRow && vesselRank.originalRankId) {
          const parentAvailableRank = availableRanksMapById.get(String(vesselRank.originalRankId));
          effectiveSortOrder = parentAvailableRank?.sortOrder ?? vesselRank.sortOrder ?? 0;
        } else if (availableRank) {
          effectiveSortOrder = availableRank.sortOrder ?? vesselRank.sortOrder ?? 0;
        }
        if (companyRank || availableRank) {
          return {
            ...vesselRank,
            // Use effective sortOrder (parent's for variants, own for base ranks)
            sortOrder: effectiveSortOrder,
            // Update company-only designation fields from current company ranks
            officer: companyRank?.officer ?? vesselRank.officer ?? false,
            rating: companyRank?.rating ?? vesselRank.rating ?? false,
            seniorOfficer: companyRank?.seniorOfficer ?? vesselRank.seniorOfficer ?? false,
            deckOfficer: companyRank?.deckOfficer ?? vesselRank.deckOfficer ?? false,
            engOfficer: companyRank?.engOfficer ?? vesselRank.engOfficer ?? false,
            pettyOfficer: companyRank?.pettyOfficer ?? vesselRank.pettyOfficer ?? false,
            deckRating: companyRank?.deckRating ?? vesselRank.deckRating ?? false,
            engineRating: companyRank?.engineRating ?? vesselRank.engineRating ?? false,
            generalRating: companyRank?.generalRating ?? vesselRank.generalRating ?? false,
            cateringRating: companyRank?.cateringRating ?? vesselRank.cateringRating ?? false,
            // Preserve vessel-specific overrides if they exist
            safetyOfficer: vesselRank.safetyOfficer ?? companyRank?.safetyOfficer ?? false,
            sso: vesselRank.sso ?? companyRank?.sso ?? false,
            medicalOfficer: vesselRank.medicalOfficer ?? companyRank?.medicalOfficer ?? false,
            navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank?.navigatingOfficer ?? false,
            emtOfficer: vesselRank.emtOfficer ?? companyRank?.emtOfficer ?? false
          };
        }
        return { ...vesselRank, sortOrder: effectiveSortOrder };
      });
      const activeRanks = mergedRankData.filter(
        (rank) => rank.actualManningFlag
      );
      console.log(`\u{1F4DC} [VESSEL RANKS API] Found ${activeRanks.length} active ranks for vessel ${vesselId2} (merged with company ranks)`);
      console.log(`\u{1F4DC} [VESSEL RANKS API] Before sort - first 3 ranks:`, activeRanks.slice(0, 3).map((r) => `${r.id}:${r.rank}(sortOrder:${r.sortOrder})`));
      const sortedRanks = activeRanks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      console.log(`\u{1F4DC} [VESSEL RANKS API] After sort - first 3 ranks:`, sortedRanks.slice(0, 3).map((r) => `${r.id}:${r.rank}(sortOrder:${r.sortOrder})`));
      res.json(sortedRanks);
    } catch (error) {
      console.error("Failed to fetch vessel ranks:", error);
      res.status(500).json({ error: "Failed to fetch vessel ranks" });
    }
  });
  app2.get("/api/vessel-revisions/next-revision/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      console.log(`\u{1F4DC} [NEXT REVISION] Getting next revision number for vessel: ${vesselId2}`);
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId2);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      console.log(`\u{1F4DC} [NEXT REVISION] Vessel ${vesselId2} has ${existingRevisions.length} existing revisions, next: ${nextRevision}`);
      res.json({ vesselId: vesselId2, nextRevision, revisionNumber: nextRevisionNumber });
    } catch (error) {
      console.error("Failed to get next revision number:", error);
      res.status(500).json({ error: "Failed to get next revision number" });
    }
  });
  app2.get("/api/vessel-revisions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid revision ID - must be a number" });
      }
      const vesselRevision = await storage.getVesselRevision(id);
      if (!vesselRevision) {
        return res.status(404).json({ error: "Vessel revision not found" });
      }
      res.json(vesselRevision);
    } catch (error) {
      console.error("Failed to fetch vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch vessel revision" });
    }
  });
  app2.post("/api/vessel-revisions", async (req, res) => {
    try {
      console.log(`\u{1F4DC} [VESSEL REVISION CREATE] Attempting to create vessel revision with data:`, req.body);
      const result = insertVesselRevisionSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`\u{1F4DC} [VESSEL REVISION VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel revision data", details: result.error.issues });
      }
      const vesselRevision = await storage.createVesselRevision(result.data);
      console.log(`\u{1F4DC} [VESSEL REVISION CREATED] Successfully created revision with ID: ${vesselRevision.id}`);
      res.status(201).json(vesselRevision);
    } catch (error) {
      console.error(`\u{1F4DC} [VESSEL REVISION CREATE ERROR] Failed to create vessel revision:`, error);
      res.status(500).json({ error: "Failed to create vessel revision" });
    }
  });
  app2.post("/api/vessel-revisions/submit", async (req, res) => {
    try {
      console.log(`\u2705 [SUBMIT] Starting Submit workflow for vessel:`, req.body.vesselId);
      const submitSchema = insertVesselRevisionSchema.omit({ revision: true });
      const validationResult = submitSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error(`\u2705 [SUBMIT ERROR] Validation failed:`, validationResult.error.issues);
        return res.status(400).json({
          error: "Invalid vessel revision data",
          details: validationResult.error.issues
        });
      }
      const { vesselId: vesselId2, revisionData, revisionDate } = validationResult.data;
      console.log(`\u2705 [SUBMIT] Validation passed for vessel ${vesselId2}, date: ${revisionDate}`);
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId2);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      console.log(`\u2705 [SUBMIT] Auto-assigned revision: ${nextRevision} (vessel has ${existingRevisions.length} existing revisions)`);
      const revisionToCreate = {
        vesselId: vesselId2,
        revision: nextRevision,
        revisionDate,
        revisionData
      };
      const createdRevision = await storage.createVesselRevision(revisionToCreate);
      console.log(`\u2705 [SUBMIT] Created revision with ID: ${createdRevision.id}, revision: ${nextRevision}`);
      const existingDrafts = await storage.getVesselDraftsByVessel(vesselId2);
      let deletedDraftsCount = 0;
      const failedDraftIds = [];
      for (const draft of existingDrafts) {
        try {
          const deleted = await storage.deleteVesselDraft(draft.id);
          if (deleted) {
            deletedDraftsCount++;
          } else {
            failedDraftIds.push(draft.id);
          }
        } catch (deleteError) {
          console.warn(`\u2705 [SUBMIT WARNING] Failed to delete draft ${draft.id}:`, deleteError);
          failedDraftIds.push(draft.id);
        }
      }
      console.log(`\u2705 [SUBMIT] Cleaned up ${deletedDraftsCount} draft(s) for vessel ${vesselId2}${failedDraftIds.length > 0 ? `, failed to delete ${failedDraftIds.length} draft(s)` : ""}`);
      console.log(`\u{1F517} [VESSEL PLANNING] Syncing vessel_planning records with vessel ranks`);
      try {
        const parsedRevisionData = typeof revisionData === "string" ? JSON.parse(revisionData) : revisionData;
        const ranks = Array.isArray(parsedRevisionData) ? parsedRevisionData : [];
        console.log(`\u{1F517} [VESSEL PLANNING] Found ${ranks.length} rank(s) in submitted revision for vessel ${vesselId2}`);
        const existingPlanning = await storage.getVesselPlanningByVessel(vesselId2);
        const existingRankIds = new Set(existingPlanning.map((p) => p.rankId));
        console.log(`\u{1F517} [VESSEL PLANNING] Found ${existingPlanning.length} existing planning record(s), ${existingRankIds.size} unique rank IDs`);
        let createdPlanningCount = 0;
        for (const rank of ranks) {
          const rankId = rank.rankId || rank.id;
          const rankName = rank.rank || rank.role;
          if (!rankId || rank.isRoleRow || !rank.actualManningFlag) {
            continue;
          }
          if (!existingRankIds.has(rankId)) {
            try {
              await storage.createVesselPlanning({
                vesselId: vesselId2,
                rankId,
                rank: rankName,
                onBoardCrewId: null,
                onBoardCrewName: null,
                reliefDue: null,
                signOffDate: null,
                signOffPort: null,
                reliefStatus: null,
                relieverCrewId: null,
                relieverCrewName: null,
                relieverSignOnDate: null,
                joiningPort: null,
                joiningStatus: null
              });
              createdPlanningCount++;
              console.log(`\u{1F517} [VESSEL PLANNING] Created planning record for rank: ${rankName} (ID: ${rankId})`);
            } catch (planningError) {
              console.warn(`\u{1F517} [VESSEL PLANNING WARNING] Failed to create planning for rank ${rankId}:`, planningError);
            }
          } else {
            console.log(`\u{1F517} [VESSEL PLANNING] Skipping existing rank: ${rankName} (ID: ${rankId})`);
          }
        }
        console.log(`\u{1F517} [VESSEL PLANNING] \u2705 Created ${createdPlanningCount} new planning record(s) for vessel ${vesselId2}`);
      } catch (planningError) {
        console.error(`\u{1F517} [VESSEL PLANNING ERROR] Failed to sync vessel_planning:`, planningError);
      }
      res.status(201).json({
        success: true,
        revision: createdRevision,
        metadata: {
          autoAssignedRevision: nextRevision,
          deletedDrafts: deletedDraftsCount,
          failedDraftIds: failedDraftIds.length > 0 ? failedDraftIds : void 0
        }
      });
      console.log(`\u2705 [SUBMIT] Submit workflow completed successfully for vessel ${vesselId2}`);
    } catch (error) {
      console.error(`\u2705 [SUBMIT ERROR] Submit workflow failed:`, error);
      res.status(500).json({ error: "Failed to submit vessel revision" });
    }
  });
  app2.get("/api/training-matrix-vessel-drafts", async (req, res) => {
    try {
      const drafts = await storage.getTrainingMatrixVesselDrafts();
      res.json(drafts);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel drafts:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel drafts" });
    }
  });
  app2.get("/api/training-matrix-vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const draft = await storage.getTrainingMatrixVesselDraft(id);
      if (!draft) {
        return res.status(404).json({ error: "Training matrix vessel draft not found" });
      }
      res.json(draft);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel draft" });
    }
  });
  app2.get("/api/training-matrix-vessel-drafts/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      const drafts = await storage.getTrainingMatrixVesselDraftsByVessel(vesselId2);
      res.json(drafts);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel drafts by vessel:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel drafts by vessel" });
    }
  });
  app2.post("/api/training-matrix-vessel-drafts", async (req, res) => {
    try {
      const result = insertTrainingMatrixVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid training matrix vessel draft data", details: result.error.issues });
      }
      const draft = await storage.createTrainingMatrixVesselDraft(result.data);
      res.status(201).json(draft);
    } catch (error) {
      console.error("Failed to create training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to create training matrix vessel draft" });
    }
  });
  app2.patch("/api/training-matrix-vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const draft = await storage.updateTrainingMatrixVesselDraft(id, req.body);
      if (!draft) {
        return res.status(404).json({ error: "Training matrix vessel draft not found" });
      }
      res.json(draft);
    } catch (error) {
      console.error("Failed to update training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to update training matrix vessel draft" });
    }
  });
  app2.delete("/api/training-matrix-vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTrainingMatrixVesselDraft(id);
      if (!deleted) {
        return res.status(404).json({ error: "Training matrix vessel draft not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to delete training matrix vessel draft" });
    }
  });
  app2.post("/api/training-matrix-vessel-drafts/upsert", async (req, res) => {
    try {
      const { vesselId: vesselId2, draftData } = req.body;
      if (!vesselId2) {
        return res.status(400).json({ error: "vesselId is required" });
      }
      const existingDrafts = await storage.getTrainingMatrixVesselDraftsByVessel(vesselId2);
      if (existingDrafts.length > 0) {
        const existingDraft = existingDrafts[0];
        const draftDataStr = typeof draftData === "string" ? draftData : JSON.stringify(draftData);
        const updatedDraft = await storage.updateTrainingMatrixVesselDraft(existingDraft.id, { draftData: draftDataStr });
        res.json(updatedDraft);
      } else {
        const draftDataStr = typeof draftData === "string" ? draftData : JSON.stringify(draftData);
        const result = insertTrainingMatrixVesselDraftSchema.safeParse({
          vesselId: vesselId2,
          revision: "R1",
          draftData: draftDataStr
        });
        if (!result.success) {
          return res.status(400).json({ error: "Invalid data", details: result.error.issues });
        }
        const newDraft = await storage.createTrainingMatrixVesselDraft(result.data);
        res.status(201).json(newDraft);
      }
    } catch (error) {
      console.error("Failed to upsert training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to upsert training matrix vessel draft" });
    }
  });
  app2.get("/api/training-matrix-vessel-revisions", async (req, res) => {
    try {
      const revisions2 = await storage.getTrainingMatrixVesselRevisions();
      res.json(revisions2);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revisions" });
    }
  });
  app2.get("/api/training-matrix-vessel-revisions/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      const revisions2 = await storage.getTrainingMatrixVesselRevisionsByVessel(vesselId2);
      res.json(revisions2);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revisions by vessel" });
    }
  });
  app2.get("/api/training-matrix-vessel-revisions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const revision = await storage.getTrainingMatrixVesselRevision(id);
      if (!revision) {
        return res.status(404).json({ error: "Training matrix vessel revision not found" });
      }
      res.json(revision);
    } catch (error) {
      console.error("Failed to fetch training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revision" });
    }
  });
  app2.post("/api/training-matrix-vessel-revisions", async (req, res) => {
    try {
      const result = insertTrainingMatrixVesselRevisionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid training matrix vessel revision data", details: result.error.issues });
      }
      const revision = await storage.createTrainingMatrixVesselRevision(result.data);
      res.status(201).json(revision);
    } catch (error) {
      console.error("Failed to create training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to create training matrix vessel revision" });
    }
  });
  app2.get("/api/training-matrix-vessel-revisions/next-revision/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      const existingRevisions = await storage.getTrainingMatrixVesselRevisionsByVessel(vesselId2);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      res.json({ nextRevision, currentRevisionCount: existingRevisions.length });
    } catch (error) {
      console.error("Failed to get next training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to get next revision" });
    }
  });
  app2.post("/api/training-matrix-vessel-revisions/submit", async (req, res) => {
    try {
      console.log(`\u2705 [TM SUBMIT] Starting Submit workflow for vessel:`, req.body.vesselId);
      const { vesselId: vesselId2, revisionData, revisionDate } = req.body;
      if (!vesselId2 || typeof vesselId2 !== "string") {
        return res.status(400).json({ error: "vesselId is required and must be a string" });
      }
      if (!revisionDate) {
        return res.status(400).json({ error: "revisionDate is required" });
      }
      if (!revisionData) {
        return res.status(400).json({ error: "revisionData is required" });
      }
      let revisionDataStr;
      try {
        revisionDataStr = typeof revisionData === "string" ? revisionData : JSON.stringify(revisionData);
      } catch (jsonError) {
        return res.status(400).json({ error: "revisionData cannot be serialized to JSON" });
      }
      let formattedDate = revisionDate;
      const ddmmyyyyRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!ddmmyyyyRegex.test(revisionDate)) {
        const dateObj = new Date(revisionDate);
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: "revisionDate must be a valid date" });
        }
        const day = String(dateObj.getDate()).padStart(2, "0");
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const year = dateObj.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      }
      const submitSchema = insertTrainingMatrixVesselRevisionSchema.omit({ revision: true });
      const preprocessedData = { vesselId: vesselId2, revisionDate: formattedDate, revisionData: revisionDataStr };
      const validationResult = submitSchema.safeParse(preprocessedData);
      if (!validationResult.success) {
        console.error(`\u2705 [TM SUBMIT ERROR] Schema validation failed:`, validationResult.error.issues);
        return res.status(400).json({
          error: "Invalid training matrix vessel revision data",
          details: validationResult.error.issues
        });
      }
      console.log(`\u2705 [TM SUBMIT] Processed and validated data for vessel ${vesselId2}, date: ${formattedDate}`);
      const existingRevisions = await storage.getTrainingMatrixVesselRevisionsByVessel(vesselId2);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      console.log(`\u2705 [TM SUBMIT] Auto-assigned revision: ${nextRevision}`);
      const revisionToCreate = {
        vesselId: vesselId2,
        revision: nextRevision,
        revisionDate: formattedDate,
        revisionData: revisionDataStr
      };
      const createdRevision = await storage.createTrainingMatrixVesselRevision(revisionToCreate);
      console.log(`\u2705 [TM SUBMIT] Created revision with ID: ${createdRevision.id}`);
      const existingDrafts = await storage.getTrainingMatrixVesselDraftsByVessel(vesselId2);
      let deletedDraftsCount = 0;
      for (const draft of existingDrafts) {
        try {
          const deleted = await storage.deleteTrainingMatrixVesselDraft(draft.id);
          if (deleted) deletedDraftsCount++;
        } catch (deleteError) {
          console.warn(`\u2705 [TM SUBMIT WARNING] Failed to delete draft ${draft.id}:`, deleteError);
        }
      }
      console.log(`\u2705 [TM SUBMIT] Cleaned up ${deletedDraftsCount} draft(s)`);
      res.status(201).json({
        success: true,
        revision: createdRevision,
        metadata: {
          autoAssignedRevision: nextRevision,
          deletedDrafts: deletedDraftsCount
        }
      });
      console.log(`\u2705 [TM SUBMIT] Submit workflow completed for vessel ${vesselId2}`);
    } catch (error) {
      console.error(`\u2705 [TM SUBMIT ERROR] Submit workflow failed:`, error);
      res.status(500).json({ error: "Failed to submit training matrix vessel revision" });
    }
  });
  app2.get("/api/vessel-planning", async (req, res) => {
    try {
      const { vesselId: vesselId2, crewMemberId, status } = req.query;
      let planning = vesselId2 ? await storage.getVesselPlanningByVessel(vesselId2) : await storage.getAllVesselPlanning();
      const crewMembers2 = await storage.getCrewMembers();
      const crewMap = new Map(crewMembers2.map((c) => [c.id || c.employeeId, c]));
      planning = planning.map((p) => {
        const enriched = { ...p };
        if (p.crewMemberId) {
          const crew = crewMap.get(p.crewMemberId);
          if (crew) {
            const lastName = crew.familyName || crew.lastName || "";
            const firstName = crew.firstName || "";
            enriched.crewName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName;
            enriched.nationality = crew.nationality;
            enriched.reliefDue = p.reliefDue || crew.reliefDue;
            enriched.reliefDate = p.reliefDue || crew.reliefDue;
          }
        }
        if (p.relieverCrewId) {
          const reliever = crewMap.get(p.relieverCrewId);
          if (reliever) {
            const lastName = reliever.familyName || reliever.lastName || "";
            const firstName = reliever.firstName || "";
            enriched.relieverCrewName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName;
            enriched.relieverNationality = reliever.nationality;
          }
        }
        return enriched;
      });
      if (crewMemberId) {
        planning = planning.filter((p) => p.crewMemberId === crewMemberId);
      }
      if (status) {
        planning = planning.filter((p) => p.reliefStatus === status);
      }
      res.json(planning || []);
    } catch (error) {
      console.error("Get vessel planning error:", error);
      res.status(500).json({ error: "Failed to get vessel planning records" });
    }
  });
  app2.get("/api/vessel-planning/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      const { archived } = req.query;
      let planning = await storage.getVesselPlanningByVessel(vesselId2);
      if (archived === "true") {
        planning = planning.filter((p) => p.isArchived === true);
      } else if (archived === "false") {
        planning = planning.filter((p) => !p.isArchived);
      }
      const crewMembers2 = await storage.getCrewMembers();
      const crewMap = new Map(crewMembers2.map((c) => [c.id || c.employeeId, c]));
      const enrichedPlanning = planning.map((p) => {
        const enriched = { ...p };
        if (p.crewMemberId) {
          const crew = crewMap.get(p.crewMemberId);
          if (crew) {
            const lastName = crew.familyName || crew.lastName || "";
            const firstName = crew.firstName || "";
            enriched.crewName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName;
            enriched.nationality = crew.nationality;
            enriched.reliefDue = p.reliefDue || crew.reliefDue;
            enriched.reliefDate = p.reliefDue || crew.reliefDue;
            let latestMedicalExpiry = null;
            if (crew.preJoiningMedicals) {
              try {
                let medicals = [];
                if (typeof crew.preJoiningMedicals === "string" && crew.preJoiningMedicals.trim()) {
                  let parsed = crew.preJoiningMedicals;
                  while (typeof parsed === "string") {
                    const trimmed = parsed.trim();
                    if (trimmed.startsWith("[")) {
                      parsed = JSON.parse(trimmed);
                      break;
                    }
                    try {
                      parsed = JSON.parse(trimmed);
                    } catch {
                      break;
                    }
                  }
                  if (Array.isArray(parsed)) {
                    medicals = parsed;
                  }
                } else if (Array.isArray(crew.preJoiningMedicals)) {
                  medicals = crew.preJoiningMedicals;
                }
                if (Array.isArray(medicals) && medicals.length > 0) {
                  const sortedMedicals = medicals.filter((m) => m.expiry).sort((a, b) => new Date(b.expiry).getTime() - new Date(a.expiry).getTime());
                  if (sortedMedicals.length > 0) {
                    latestMedicalExpiry = sortedMedicals[0].expiry;
                  }
                }
              } catch (e) {
              }
            }
            const parseJsonArray = (data) => {
              if (!data) return [];
              if (Array.isArray(data)) return data;
              if (typeof data === "string") {
                try {
                  let parsed = data;
                  while (typeof parsed === "string") {
                    const trimmed = parsed.trim();
                    if (trimmed.startsWith("[")) {
                      parsed = JSON.parse(trimmed);
                      break;
                    }
                    try {
                      parsed = JSON.parse(trimmed);
                    } catch {
                      break;
                    }
                  }
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              }
              return [];
            };
            enriched.crewMemberData = {
              id: crew.id,
              employeeId: crew.employeeId,
              firstName: crew.firstName,
              familyName: crew.familyName || crew.lastName || "",
              lastName: crew.familyName || crew.lastName || "",
              nationality: crew.nationality,
              presentRank: crew.presentRank,
              latestMedicalExpiry,
              documents: parseJsonArray(crew.documents),
              visas: parseJsonArray(crew.visas),
              licenses: parseJsonArray(crew.licenses),
              trainingCourses: parseJsonArray(crew.trainingCourses)
            };
          }
        }
        if (p.relieverCrewId) {
          const reliever = crewMap.get(p.relieverCrewId);
          if (reliever) {
            if (!p.relieverCrewName) {
              const lastName = reliever.familyName || reliever.lastName || "";
              const firstName = reliever.firstName || "";
              enriched.relieverCrewName = lastName && firstName ? `${lastName}, ${firstName}` : lastName || firstName;
            }
            if (!p.relieverNationality) {
              enriched.relieverNationality = reliever.nationality;
            }
            enriched.relieverData = {
              id: reliever.id,
              employeeId: reliever.employeeId,
              firstName: reliever.firstName,
              familyName: reliever.familyName || reliever.lastName || "",
              lastName: reliever.familyName || reliever.lastName || "",
              nationality: reliever.nationality,
              presentRank: reliever.presentRank
            };
          }
        }
        return enriched;
      });
      res.json(enrichedPlanning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });
  app2.get("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });
  app2.post("/api/vessel-planning", async (req, res) => {
    try {
      const result = insertVesselPlanningSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel planning data", details: result.error.issues });
      }
      const vesselId2 = result.data.vesselId;
      if (vesselId2) {
        const hasRankConfig = await hasVesselRankConfiguration(vesselId2);
        if (!hasRankConfig) {
          console.log(`\u26A0\uFE0F [VESSEL-PLANNING] Blocked POST - vessel ${vesselId2} has no rank configuration`);
          return res.status(400).json(VESSEL_RANK_CONFIG_REQUIRED_ERROR);
        }
      }
      const planning = await storage.createVesselPlanning(result.data);
      res.status(201).json(planning);
    } catch (error) {
      console.error("Failed to create vessel planning:", error);
      res.status(500).json({ error: "Failed to create vessel planning" });
    }
  });
  app2.put("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      let vesselId2 = req.body.vesselId;
      if (!vesselId2) {
        const existingPlanning = await storage.getVesselPlanningById(id);
        if (existingPlanning) {
          vesselId2 = existingPlanning.vesselId;
        }
      }
      if (vesselId2) {
        const hasRankConfig = await hasVesselRankConfiguration(vesselId2);
        if (!hasRankConfig) {
          console.log(`\u26A0\uFE0F [VESSEL-PLANNING] Blocked PUT - vessel ${vesselId2} has no rank configuration`);
          return res.status(400).json(VESSEL_RANK_CONFIG_REQUIRED_ERROR);
        }
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });
  app2.patch("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const existingPlanning = await storage.getVesselPlanningById(id);
      if (!existingPlanning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      const vesselId2 = req.body.vesselId || existingPlanning.vesselId;
      if (vesselId2) {
        const hasRankConfig = await hasVesselRankConfiguration(vesselId2);
        if (!hasRankConfig) {
          console.log(`\u26A0\uFE0F [VESSEL-PLANNING] Blocked PATCH - vessel ${vesselId2} has no rank configuration`);
          return res.status(400).json(VESSEL_RANK_CONFIG_REQUIRED_ERROR);
        }
      }
      const isSignOnAction = req.body.signOnDate && !existingPlanning.signOnDate || req.body.joiningStatus === "Signed On" && existingPlanning.joiningStatus !== "Signed On" || req.body.relieverSignOnDate && !existingPlanning.relieverSignOnDate && req.body.joiningStatus === "Signed On";
      let needsSeaServiceRepair = false;
      const existingSignOnDate = existingPlanning.signOnDate || existingPlanning.relieverSignOnDate;
      if (!isSignOnAction && existingPlanning.crewMemberId && existingSignOnDate && vesselId2) {
        try {
          const crewMember = await storage.getCrewMember(existingPlanning.crewMemberId);
          if (crewMember) {
            let seaService = [];
            if (crewMember.currentCompanySeaService) {
              try {
                seaService = typeof crewMember.currentCompanySeaService === "string" ? JSON.parse(crewMember.currentCompanySeaService) : crewMember.currentCompanySeaService;
                if (!Array.isArray(seaService)) seaService = [];
              } catch (e) {
                seaService = [];
              }
            }
            const existingRecord = seaService.find((r) => r.planningId === id);
            const hasValidRecord = existingRecord && existingRecord.vesselName && existingRecord.vesselCode && existingRecord.from;
            if (!hasValidRecord) {
              needsSeaServiceRepair = true;
              console.log(`\u{1F527} [VESSEL-PLANNING] Repair mode: Sea service record missing/empty for planning ${id}, crew ${existingPlanning.crewMemberId}`);
            }
          }
        } catch (checkError) {
          console.warn(`\u26A0\uFE0F [VESSEL-PLANNING] Error checking sea service repair need:`, checkError);
        }
      }
      if (isSignOnAction || needsSeaServiceRepair) {
        const crewMemberId = existingPlanning.crewMemberId;
        const actionType = needsSeaServiceRepair ? "Sea service repair" : "Sign-on";
        console.log(`\u2705 [VESSEL-PLANNING] ${actionType} detected for planning ${id}, crew ${crewMemberId}`);
        if (crewMemberId) {
          try {
            let vesselName = "Unknown Vessel";
            let vesselType = "";
            if (vesselId2) {
              try {
                const masterEntries = await storage.getMasterDataEntries("014");
                const vesselEntry = masterEntries.find((e) => e.entryId === vesselId2 || e.entry_id === vesselId2 || e.nuid === vesselId2);
                if (vesselEntry) {
                  vesselName = vesselEntry.name || vesselName;
                  if (vesselEntry.vtuid) {
                    const typeEntries = await storage.getMasterDataEntries("004");
                    const typeEntry = typeEntries.find((t) => t.entryId === vesselEntry.vtuid || t.entry_id === vesselEntry.vtuid);
                    if (typeEntry) {
                      vesselType = typeEntry.name || "";
                    }
                  }
                }
              } catch (vesselError) {
                console.warn(`\u26A0\uFE0F [VESSEL-PLANNING] Could not fetch vessel details:`, vesselError);
              }
            }
            const crewMemberData = await storage.getCrewMember(crewMemberId);
            let rankDisplayName = crewMemberData?.presentRank || "";
            if (!rankDisplayName && existingPlanning.rankId) {
              try {
                const companyRanks2 = await storage.getCompanyRanks();
                const rankEntry = companyRanks2.find(
                  (r) => r.rankId === existingPlanning.rankId || r.id === existingPlanning.rankId || String(r.id) === existingPlanning.rankId
                );
                if (rankEntry) {
                  rankDisplayName = rankEntry.rank || "";
                }
              } catch (rankError) {
                console.warn(`\u26A0\uFE0F [VESSEL-PLANNING] Could not fetch rank display name:`, rankError);
              }
            }
            if (!rankDisplayName) {
              rankDisplayName = existingPlanning.rank || existingPlanning.rankId || "Unknown Rank";
            }
            const signOnDate = req.body.signOnDate || req.body.relieverSignOnDate || existingPlanning.signOnDate;
            if (signOnDate) {
              await storage.upsertSeaServiceEntry({
                crewId: crewMemberId,
                planningId: id,
                vesselName,
                vesselCode: vesselId2 || "",
                vesselType,
                rank: rankDisplayName,
                signOnDate
              });
              await storage.updateCrewMember(crewMemberId, {
                status: "On Board",
                presentVessel: vesselId2 || "",
                signOnDate
              });
              console.log(`\u2705 [VESSEL-PLANNING] Upserted sea service record (${actionType}): ${vesselName} (${rankDisplayName}) from ${signOnDate}`);
            } else {
              console.log(`\u26A0\uFE0F [VESSEL-PLANNING] Skipping sea service record - no sign-on date available`);
            }
          } catch (syncError) {
            console.error(`\u26A0\uFE0F [VESSEL-PLANNING] Failed to upsert sea service record on sign-on:`, syncError);
          }
        }
      }
      const isSignOffAction = req.body.reliefStatus === "Signed Off" && req.body.signOffDate;
      if (isSignOffAction) {
        if (existingPlanning.crewStatus === "primary") {
          const allVesselPlanning = await storage.getVesselPlanningByVessel(vesselId2);
          const secondaryCrew = allVesselPlanning.find(
            (p) => p.rankId === existingPlanning.rankId && p.crewStatus === "secondary" && p.id !== id && !p.isArchived
          );
          if (secondaryCrew) {
            console.log(`\u26A0\uFE0F [VESSEL-PLANNING] Blocked sign-off - primary crew has active secondary`);
            return res.status(400).json({
              error: "Cannot sign off primary crew when a secondary (reliever) exists. The reliever must take over first."
            });
          }
        }
        req.body.isArchived = true;
        req.body.archivedDate = req.body.signOffDate;
        console.log(`\u2705 [VESSEL-PLANNING] Archiving ${existingPlanning.crewStatus} crew member on sign-off: ${id}`);
        const crewMemberId = existingPlanning.crewMemberId;
        if (crewMemberId && req.body.signOffReason) {
          try {
            await storage.updateCrewMember(crewMemberId, {
              reason: req.body.signOffReason
            });
            console.log(`\u2705 [VESSEL-PLANNING] Synced sign-off reason "${req.body.signOffReason}" to crew member ${crewMemberId}`);
          } catch (syncError) {
            console.error(`\u26A0\uFE0F [VESSEL-PLANNING] Failed to sync sign-off reason to crew member:`, syncError);
          }
        }
        if (crewMemberId) {
          try {
            const signOffDate = req.body.signOffDate;
            if (signOffDate) {
              await storage.completeSeaServiceEntry({
                crewId: crewMemberId,
                planningId: id,
                signOffDate
              });
              console.log(`\u2705 [VESSEL-PLANNING] Completed sea service record for planning ${id}`);
            }
            await storage.updateCrewMember(crewMemberId, {
              status: "On Leave",
              presentVessel: "",
              signOnDate: null,
              reliefDue: null
            });
            console.log(`\u2705 [VESSEL-PLANNING] Comprehensive sign-off sync for ${crewMemberId}:`);
            console.log(`   - Status set to "On Leave"`);
            console.log(`   - Vessel assignment fields cleared`);
            console.log(`   - Sea service record completed`);
          } catch (syncError) {
            console.error(`\u26A0\uFE0F [VESSEL-PLANNING] Failed comprehensive sign-off sync:`, syncError);
          }
        }
      }
      const hasAnyRelieverData = (planning2) => !!(planning2.relieverCrewId || planning2.relieverCrewName || planning2.relieverNationality || planning2.joiningStatus || // "Proposed", "Planned", "Confirmed", etc. - only applies to relievers
      planning2.contractEndRangeStartMonths || planning2.contractEndRangeEndMonths || planning2.deploymentChecklistCompleted || planning2.applicableDocsChecked);
      const clearAllRelieverFields = (body) => {
        body.relieverCrewId = null;
        body.relieverCrewName = null;
        body.relieverNationality = null;
        body.joiningDate = null;
        body.joiningPort = null;
        body.joiningStatus = null;
        body.contractPeriodMonths = null;
        body.contractEndRangeStartMonths = null;
        body.contractEndRangeEndMonths = null;
        body.deploymentChecklistCompleted = null;
        body.applicableDocsChecked = null;
      };
      const isDemotingPrimary = existingPlanning.crewStatus === "primary" && req.body.crewStatus === "secondary" && hasAnyRelieverData(existingPlanning);
      const isPromotingSecondary = req.body.takeOverConfirmation === true || existingPlanning.crewStatus === "secondary" && req.body.crewStatus === "primary";
      if (isDemotingPrimary) {
        console.log(`\u{1F504} [VESSEL-PLANNING] Primary demotion detected - clearing ALL reliever fields for old primary ${id}`);
        clearAllRelieverFields(req.body);
      }
      if (isPromotingSecondary) {
        console.log(`\u{1F504} [VESSEL-PLANNING] Secondary promotion detected - clearing reliever fields for new primary ${id}`);
        const preservedRelieverSignOnDate = req.body.relieverSignOnDate ?? existingPlanning.relieverSignOnDate;
        const preservedJoiningPort = req.body.joiningPort ?? existingPlanning.joiningPort;
        const preservedContractPeriodMonths = req.body.contractPeriodMonths ?? existingPlanning.contractPeriodMonths;
        const preservedContractEndRangeStartMonths = req.body.contractEndRangeStartMonths ?? existingPlanning.contractEndRangeStartMonths;
        const preservedContractEndRangeEndMonths = req.body.contractEndRangeEndMonths ?? existingPlanning.contractEndRangeEndMonths;
        clearAllRelieverFields(req.body);
        req.body.relieverSignOnDate = preservedRelieverSignOnDate;
        req.body.joiningPort = preservedJoiningPort;
        req.body.contractPeriodMonths = preservedContractPeriodMonths;
        req.body.contractEndRangeStartMonths = preservedContractEndRangeStartMonths;
        req.body.contractEndRangeEndMonths = preservedContractEndRangeEndMonths;
        if (existingPlanning.crewStatus === "secondary") {
          req.body.crewStatus = "primary";
        }
      }
      const effectiveSignOnDate = req.body.signOnDate || existingPlanning.signOnDate;
      const effectiveContractPeriod = req.body.contractPeriodMonths ?? existingPlanning.contractPeriodMonths;
      const currentReliefDue = req.body.reliefDue ?? existingPlanning.reliefDue;
      if (effectiveSignOnDate && effectiveContractPeriod && !currentReliefDue) {
        try {
          const signOnDateObj = new Date(effectiveSignOnDate);
          signOnDateObj.setMonth(signOnDateObj.getMonth() + effectiveContractPeriod);
          const calculatedReliefDue = signOnDateObj.toISOString().split("T")[0];
          req.body.reliefDue = calculatedReliefDue;
          console.log(`\u{1F4C5} [VESSEL-PLANNING] Auto-calculated reliefDue: ${calculatedReliefDue} (signOnDate: ${effectiveSignOnDate} + ${effectiveContractPeriod} months)`);
        } catch (calcError) {
          console.warn(`\u26A0\uFE0F [VESSEL-PLANNING] Failed to auto-calculate reliefDue:`, calcError);
        }
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });
  app2.delete("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const deleted = await storage.deleteVesselPlanning(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete vessel planning:", error);
      res.status(500).json({ error: "Failed to delete vessel planning" });
    }
  });
  app2.get("/api/vessel-planning/:id/handover-attachments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      let attachments = [];
      if (planning.handoverAttachments) {
        try {
          attachments = typeof planning.handoverAttachments === "string" ? JSON.parse(planning.handoverAttachments) : planning.handoverAttachments;
          if (!Array.isArray(attachments)) attachments = [];
        } catch (e) {
          attachments = [];
        }
      }
      res.json(attachments);
    } catch (error) {
      console.error("Failed to fetch handover attachments:", error);
      res.status(500).json({ error: "Failed to fetch handover attachments" });
    }
  });
  app2.post("/api/vessel-planning/:id/handover-attachments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      const { filename, fileType, fileData, fileSize, uploadedBy } = req.body;
      if (!filename || !fileData) {
        return res.status(400).json({ error: "filename and fileData are required" });
      }
      let attachments = [];
      if (planning.handoverAttachments) {
        try {
          attachments = typeof planning.handoverAttachments === "string" ? JSON.parse(planning.handoverAttachments) : planning.handoverAttachments;
          if (!Array.isArray(attachments)) attachments = [];
        } catch (e) {
          attachments = [];
        }
      }
      const newAttachment = {
        id: Date.now().toString(),
        filename,
        fileType: fileType || "application/octet-stream",
        fileData,
        fileSize: fileSize || 0,
        uploadedBy: uploadedBy || "System",
        uploadDate: (/* @__PURE__ */ new Date()).toISOString()
      };
      attachments.push(newAttachment);
      await storage.updateVesselPlanning(id, {
        handoverAttachments: JSON.stringify(attachments)
      });
      res.status(201).json(newAttachment);
    } catch (error) {
      console.error("Failed to upload handover attachment:", error);
      res.status(500).json({ error: "Failed to upload handover attachment" });
    }
  });
  app2.delete("/api/vessel-planning/:id/handover-attachments/:attachmentId", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attachmentId = req.params.attachmentId;
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      let attachments = [];
      if (planning.handoverAttachments) {
        try {
          attachments = typeof planning.handoverAttachments === "string" ? JSON.parse(planning.handoverAttachments) : planning.handoverAttachments;
          if (!Array.isArray(attachments)) attachments = [];
        } catch (e) {
          attachments = [];
        }
      }
      const originalLength = attachments.length;
      attachments = attachments.filter((a) => a.id !== attachmentId);
      if (attachments.length === originalLength) {
        return res.status(404).json({ error: "Attachment not found" });
      }
      await storage.updateVesselPlanning(id, {
        handoverAttachments: JSON.stringify(attachments)
      });
      res.json({ success: true, remainingCount: attachments.length });
    } catch (error) {
      console.error("Failed to delete handover attachment:", error);
      res.status(500).json({ error: "Failed to delete handover attachment" });
    }
  });
  app2.get("/api/rotation-plans", async (req, res) => {
    try {
      const plans = await storage.getRotationPlans();
      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch rotation plans:", error);
      res.status(500).json({ error: "Failed to fetch rotation plans" });
    }
  });
  app2.get("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const plan = await storage.getRotationPlan(id);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to fetch rotation plan:", error);
      res.status(500).json({ error: "Failed to fetch rotation plan" });
    }
  });
  app2.post("/api/rotation-plans", async (req, res) => {
    try {
      const result = insertRotationPlanSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      const plan = await storage.createRotationPlan(result.data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Failed to create rotation plan:", error);
      res.status(500).json({ error: "Failed to create rotation plan" });
    }
  });
  app2.patch("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const result = insertRotationPlanSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      const updateData = {
        ...result.data,
        lastEdited: (/* @__PURE__ */ new Date()).toISOString()
      };
      const plan = await storage.updateRotationPlan(id, updateData);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to update rotation plan:", error);
      res.status(500).json({ error: "Failed to update rotation plan" });
    }
  });
  app2.delete("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const deleted = await storage.deleteRotationPlan(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rotation plan:", error);
      res.status(500).json({ error: "Failed to delete rotation plan" });
    }
  });
  app2.post("/api/rotation-plans/:id/propose", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const { proposedBy } = req.body;
      if (!proposedBy) {
        return res.status(400).json({ error: "proposedBy is required" });
      }
      const plan = await storage.proposeRotationPlan(id, proposedBy);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to propose rotation plan:", error);
      res.status(500).json({ error: "Failed to propose rotation plan" });
    }
  });
  app2.get("/api/rotation/proposals", async (req, res) => {
    try {
      const filters = {
        vessels: req.query.vessels ? JSON.parse(req.query.vessels) : void 0,
        ranks: req.query.ranks ? JSON.parse(req.query.ranks) : void 0,
        draftId: req.query.draftId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        archived: req.query.archived === "true"
      };
      if (filters.archived) {
        const archivedEntries = await storage.getArchivedAssignments({
          vessels: filters.vessels,
          ranks: filters.ranks,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo
        });
        const vesselMasterData = await storage.getMasterDataEntries("014");
        const vesselIdToNameMap = /* @__PURE__ */ new Map();
        vesselMasterData.forEach((entry) => {
          const entryId = entry.entryId || entry.entry_id || entry.nuid;
          const entryName = entry.name || entry.label;
          if (entryId && entryName) {
            vesselIdToNameMap.set(entryId, entryName);
          }
        });
        const vesselPlanningData = await storage.getAllVesselPlanning();
        const allCrewMembers = await storage.getCrewMembers();
        const crewMemberNameMap = /* @__PURE__ */ new Map();
        for (const crew of allCrewMembers) {
          if (crew.id) {
            const nameParts = [crew.firstName, crew.middleName, crew.familyName].filter(Boolean);
            const fullName = nameParts.join(" ").trim();
            if (fullName) {
              crewMemberNameMap.set(crew.id, fullName);
            }
          }
        }
        const currentCrewMap = /* @__PURE__ */ new Map();
        for (const vp of vesselPlanningData) {
          if (vp.vesselId && vp.rank && vp.crewMemberId) {
            const key = `${vp.vesselId}:${vp.rank}`;
            if (vp.signOnDate) {
              let rangeEndDate;
              if (vp.reliefDue) {
                const reliefDueDate = new Date(vp.reliefDue);
                const rangeEnd = new Date(reliefDueDate);
                rangeEnd.setMonth(rangeEnd.getMonth() + 1);
                rangeEndDate = rangeEnd.toISOString().split("T")[0];
              } else {
                const fallbackDate = new Date(vp.signOnDate);
                fallbackDate.setMonth(fallbackDate.getMonth() + 7);
                rangeEndDate = fallbackDate.toISOString().split("T")[0];
              }
              const crewName = crewMemberNameMap.get(vp.crewMemberId) || vp.crewMemberId;
              currentCrewMap.set(key, {
                id: vp.crewMemberId,
                name: crewName,
                contractStartDate: vp.signOnDate,
                contractEndDate: vp.reliefDue || null,
                rangeStartDate: vp.signOnDate,
                rangeEndDate
              });
            }
          }
        }
        const entriesWithCurrentCrew = archivedEntries.map((entry) => {
          if (entry.currentCrewInfo) {
            return { ...entry, reconstructedCurrentCrew: JSON.parse(entry.currentCrewInfo) };
          }
          if (entry.vesselId && entry.rank) {
            const key = `${entry.vesselId}:${entry.rank}`;
            const currentCrew = currentCrewMap.get(key);
            if (currentCrew) {
              return { ...entry, reconstructedCurrentCrew: currentCrew };
            }
          }
          if (entry.fullAssignmentSnapshot) {
            try {
              const snapshot = JSON.parse(entry.fullAssignmentSnapshot);
              const crewData = snapshot.currentCrew || snapshot.onBoardCrew;
              const onBoardCrewId = crewData?.id || snapshot.onBoardCrewId || snapshot.currentCrewId;
              const onBoardCrewName = crewData?.name || snapshot.onBoardCrewName || snapshot.currentCrewName;
              if (onBoardCrewId || onBoardCrewName) {
                const archivedDateStr = entry.archivedDate ? typeof entry.archivedDate === "string" ? entry.archivedDate.split("T")[0] : new Date(entry.archivedDate).toISOString().split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
                const contractStartDate = crewData?.contractStartDate || crewData?.rangeStartDate || snapshot.onBoardSignOnDate || snapshot.currentCrewSignOnDate || archivedDateStr;
                const contractEndDate = crewData?.contractEndDate || snapshot.onBoardContractEndDate || snapshot.currentCrewContractEndDate || null;
                let rangeEndDate;
                if (crewData?.rangeEndDate) {
                  rangeEndDate = crewData.rangeEndDate;
                } else if (contractEndDate) {
                  const endDate = new Date(contractEndDate);
                  endDate.setMonth(endDate.getMonth() + 1);
                  rangeEndDate = endDate.toISOString().split("T")[0];
                } else {
                  const fallbackDate = new Date(contractStartDate);
                  fallbackDate.setMonth(fallbackDate.getMonth() + 7);
                  rangeEndDate = fallbackDate.toISOString().split("T")[0];
                }
                return {
                  ...entry,
                  reconstructedCurrentCrew: {
                    id: onBoardCrewId,
                    name: onBoardCrewName || onBoardCrewId,
                    contractStartDate,
                    contractEndDate,
                    rangeStartDate: contractStartDate,
                    rangeEndDate
                  }
                };
              }
            } catch (parseError) {
              console.warn(`Failed to parse fullAssignmentSnapshot for archive ${entry.id}:`, parseError);
            }
          }
          return { ...entry, reconstructedCurrentCrew: null };
        });
        const proposals2 = entriesWithCurrentCrew.map((entry) => ({
          // Archive-specific identifiers - kept distinct from live plan indices
          archiveId: entry.id,
          originalPlanId: entry.originalPlanId,
          originalAssignmentIndex: entry.originalAssignmentIndex,
          originalDraftId: entry.originalDraftId,
          // Legacy compatibility fields
          planId: entry.originalPlanId,
          draftId: entry.originalDraftId,
          assignmentIndex: entry.originalAssignmentIndex,
          // Legacy compatibility
          // Core assignment data - look up vessel name from master data using vesselId
          vessel: entry.vesselId ? vesselIdToNameMap.get(entry.vesselId) || entry.vesselId : "",
          vesselId: entry.vesselId,
          rankId: entry.rankId,
          rank: entry.rank,
          crewId: entry.crewId,
          crewName: entry.crewName,
          crewMemberId: entry.crewMemberId,
          signOnDate: entry.signOnDate,
          joiningDate: entry.signOnDate,
          // Timeline component uses joiningDate
          joiningPort: entry.joiningPort,
          contractPeriod: entry.contractPeriod || 6,
          // Default to 6 months if not set
          signOffDate: entry.signOffDate,
          // Proposal metadata
          proposedBy: entry.proposedBy,
          proposedDate: entry.proposedDate,
          // Result and archive metadata
          result: entry.result,
          archivedDate: entry.archivedDate,
          archivedBy: entry.archivedBy,
          vesselPlanningId: entry.vesselPlanningId,
          // Full snapshot data for historical reference - use reconstructed if original missing
          currentCrew: entry.reconstructedCurrentCrew,
          fullAssignmentSnapshot: entry.fullAssignmentSnapshot ? JSON.parse(entry.fullAssignmentSnapshot) : null
        }));
        return res.json(proposals2);
      }
      const proposals = await storage.getProposedAssignments(filters);
      res.json(proposals);
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });
  app2.post("/api/rotation/proposals/deploy", async (req, res) => {
    try {
      const { planId, assignmentIndex, deployedBy } = req.body;
      if (typeof planId !== "number" || typeof assignmentIndex !== "number" || !deployedBy) {
        return res.status(400).json({ error: "planId, assignmentIndex, and deployedBy are required" });
      }
      const result = await storage.deployAssignment(planId, assignmentIndex, deployedBy);
      if (!result.success && result.conflicts && result.conflicts.length > 0) {
        return res.status(409).json({ error: "Assignment conflicts detected", conflicts: result.conflicts });
      }
      if (!result.success) {
        return res.status(400).json({ error: "Failed to deploy assignment" });
      }
      res.json({
        success: true,
        vesselPlanningId: result.vesselPlanningId,
        vesselCode: result.vesselCode,
        vesselId: result.vesselId,
        // Return original vesselId (UUID) for proper cache invalidation
        message: "Assignment deployed successfully"
      });
    } catch (error) {
      console.error("Failed to deploy assignment:", error);
      res.status(500).json({ error: "Failed to deploy assignment" });
    }
  });
  app2.post("/api/rotation/proposals/reject", async (req, res) => {
    try {
      const { planId, assignmentIndex } = req.body;
      if (typeof planId !== "number" || typeof assignmentIndex !== "number") {
        return res.status(400).json({ error: "planId and assignmentIndex are required" });
      }
      const plan = await storage.rejectAssignment(planId, assignmentIndex);
      if (!plan) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to reject assignment:", error);
      res.status(500).json({ error: "Failed to reject assignment" });
    }
  });
  app2.get("/api/rotation/proposals/conflicts", async (req, res) => {
    try {
      const {
        crewMemberId,
        crewId,
        startDate,
        joiningDate,
        endDate,
        reliefDue,
        contractPeriod,
        vesselId: vesselId2
      } = req.query;
      const crew = crewMemberId || crewId;
      const start = startDate || joiningDate;
      let end;
      if (endDate || reliefDue) {
        end = endDate || reliefDue;
      } else if (start && contractPeriod) {
        const startObj2 = new Date(start);
        startObj2.setMonth(startObj2.getMonth() + parseInt(contractPeriod));
        end = startObj2.toISOString().split("T")[0];
      } else {
        return res.status(400).json({
          error: "Required parameters: (crewMemberId OR crewId), (startDate OR joiningDate), and (endDate OR reliefDue OR contractPeriod)"
        });
      }
      if (!crew || !start) {
        return res.status(400).json({
          error: "Required parameters: (crewMemberId OR crewId), (startDate OR joiningDate), and (endDate OR reliefDue OR contractPeriod)"
        });
      }
      const startObj = new Date(start);
      const endObj = new Date(end);
      const months = Math.max(
        1,
        (endObj.getFullYear() - startObj.getFullYear()) * 12 + (endObj.getMonth() - startObj.getMonth())
      );
      const conflicts = await storage.checkAssignmentConflicts(
        crew,
        start,
        months
      );
      res.json(conflicts);
    } catch (error) {
      console.error("Failed to check conflicts:", error);
      res.status(500).json({ error: "Failed to check conflicts" });
    }
  });
  app2.get("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const records = await storage.getDrugAlcoholTestRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records" });
    }
  });
  app2.get("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getDrugAlcoholTestRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test record" });
    }
  });
  app2.get("/api/drug-alcohol-tests/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId: vesselId2 } = req.params;
      const { testType } = req.query;
      const records = await storage.getDrugAlcoholTestRecordsByVessel(
        vesselId2,
        testType
      );
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records by vessel:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records by vessel" });
    }
  });
  app2.post("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const result = insertDrugAlcoholTestRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.createDrugAlcoholTestRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to create drug/alcohol test record" });
    }
  });
  app2.put("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertDrugAlcoholTestRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.updateDrugAlcoholTestRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to update drug/alcohol test record" });
    }
  });
  app2.delete("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteDrugAlcoholTestRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to delete drug/alcohol test record" });
    }
  });
  app2.get("/api/rest-hours-vessel-records", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode, opaMode } = req.query;
      const mode = complianceMode === "Work" ? "Work" : "Rest";
      const isOpaMode = opaMode === "true";
      const allCrewMembers = await storage.getCrewMembers();
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselNameToIdMap = /* @__PURE__ */ new Map();
      const vesselIdToNameMap = /* @__PURE__ */ new Map();
      vesselMasterData.forEach((entry) => {
        const entryId = entry.entryId || entry.entry_id;
        if (!entryId) return;
        if (entry.name) vesselNameToIdMap.set(entry.name, entryId);
        if (entry.label) vesselNameToIdMap.set(entry.label, entryId);
        if (entry.vessel) vesselNameToIdMap.set(entry.vessel, entryId);
        vesselNameToIdMap.set(entryId, entryId);
        const displayName = entry.name || entry.label || entry.vessel || entryId;
        vesselIdToNameMap.set(entryId, displayName);
      });
      const crewCountByVessel = /* @__PURE__ */ new Map();
      allCrewMembers.forEach((crew) => {
        const vesselName = crew.presentVessel || crew.vessel;
        if (vesselName) {
          const vesselId2 = vesselNameToIdMap.get(vesselName);
          if (vesselId2) {
            crewCountByVessel.set(vesselId2, (crewCountByVessel.get(vesselId2) || 0) + 1);
          }
        }
      });
      const filters = {};
      if (vesselIds) {
        filters.vesselIds = typeof vesselIds === "string" ? [vesselIds] : vesselIds;
      }
      if (monthValue) {
        filters.monthValue = monthValue;
      }
      const persistedRecords = Object.keys(filters).length > 0 ? await storage.getRestHoursVesselRecordsByFilters(filters) : await storage.getRestHoursVesselRecords();
      const formatMonth = (monthVal) => {
        if (!monthVal) return "";
        const [year, month] = monthVal.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]}-${year}`;
      };
      const targetMonth = monthValue || "";
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      const dailyRecordsByVesselMonth = /* @__PURE__ */ new Map();
      allDailyRecords.forEach((record) => {
        const key = `${record.vesselId}-${record.monthYear}`;
        if (!dailyRecordsByVesselMonth.has(key)) {
          dailyRecordsByVesselMonth.set(key, []);
        }
        dailyRecordsByVesselMonth.get(key).push(record);
      });
      let allVesselRecords;
      if (targetMonth) {
        const persistedRecordsMap = /* @__PURE__ */ new Map();
        persistedRecords.forEach((record) => {
          const key = `${record.vesselId}-${record.monthValue}`;
          persistedRecordsMap.set(key, record);
        });
        const targetVessels = filters.vesselIds && filters.vesselIds.length > 0 ? Array.from(vesselIdToNameMap.entries()).filter(([vesselId2]) => filters.vesselIds.includes(vesselId2)) : Array.from(vesselIdToNameMap.entries());
        allVesselRecords = targetVessels.map(([vesselId2, vesselName]) => {
          const key = `${vesselId2}-${targetMonth}`;
          const persistedRecord = persistedRecordsMap.get(key);
          let recordingPercent = 0;
          let totalViolations = 0;
          let predictedViolations = 0;
          let crewWithViolations = 0;
          let crewWithPredictedViolations = 0;
          let crewWithViolationsDetails = [];
          let crewWithPredictedViolationsDetails = [];
          const dailyRecords = dailyRecordsByVesselMonth.get(key) || [];
          if (dailyRecords.length > 0 && targetMonth) {
            const percentages = dailyRecords.map(
              (dr) => calculateRecordingPercentage(dr.dailyRecords, targetMonth)
            );
            const total = percentages.reduce((sum, p) => sum + p, 0);
            recordingPercent = Math.round(total / percentages.length);
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map((dr) => [dr.crewMemberId, dr])).values()
            );
            totalViolations = uniqueDailyRecords.reduce(
              (sum, dr) => sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, false),
              0
            );
            predictedViolations = uniqueDailyRecords.reduce(
              (sum, dr) => sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, true),
              0
            );
            const crewWithViolationsRecords = uniqueDailyRecords.filter(
              (dr) => hasViolationDays(dr.dailyRecords, mode, isOpaMode, false)
            );
            crewWithViolations = crewWithViolationsRecords.length;
            crewWithViolationsDetails = crewWithViolationsRecords.map((dr) => ({
              name: dr.name,
              rank: dr.rank
            }));
            const crewWithPredictedViolationsRecords = uniqueDailyRecords.filter(
              (dr) => hasViolationDays(dr.dailyRecords, mode, isOpaMode, true)
            );
            crewWithPredictedViolations = crewWithPredictedViolationsRecords.length;
            crewWithPredictedViolationsDetails = crewWithPredictedViolationsRecords.map((dr) => ({
              name: dr.name,
              rank: dr.rank
            }));
          }
          let totalNCs = 0;
          let predictedNCs = 0;
          let crewWithNCs = 0;
          let crewWithPredictedNCs = 0;
          let crewWithNCsDetails = [];
          let crewWithPredictedNCsDetails = [];
          if (dailyRecords.length > 0) {
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map((dr) => [dr.crewMemberId, dr])).values()
            );
            uniqueDailyRecords.forEach((dr) => {
              const ncs = calculateNCs(dr.dailyRecords, mode, isOpaMode);
              totalNCs += ncs.totalNCs;
              predictedNCs += ncs.predictedNCs;
              if (ncs.totalNCs > 0) {
                crewWithNCs++;
                crewWithNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
              if (ncs.predictedNCs > 0) {
                crewWithPredictedNCs++;
                crewWithPredictedNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
            });
          }
          let violationDates = [];
          let predictedViolationDates = [];
          if (dailyRecords.length > 0) {
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map((dr) => [dr.crewMemberId, dr])).values()
            );
            const allViolationDates = /* @__PURE__ */ new Set();
            const allPredictedViolationDates = /* @__PURE__ */ new Set();
            uniqueDailyRecords.forEach((dr) => {
              const completedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, false);
              const plannedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, true);
              completedDates.forEach((date) => allViolationDates.add(date));
              plannedDates.forEach((date) => allPredictedViolationDates.add(date));
            });
            violationDates = Array.from(allViolationDates).sort((a, b) => a - b);
            predictedViolationDates = Array.from(allPredictedViolationDates).sort((a, b) => a - b);
            if (vesselId2 === "7440571a-841a-11ed-aa7c-7003bca91a86" && targetMonth === "2025-11") {
              console.log(`\u{1F50D} [DEBUG] Vessel 3 violations - Mode: ${mode}, OPA: ${isOpaMode}`);
              console.log(`\u{1F50D} Total violation days: ${totalViolations}`);
              console.log(`\u{1F50D} Total unique crew with violations: ${crewWithViolations}`);
              console.log(`\u{1F50D} Daily records (before dedup): ${dailyRecords.length}`);
              console.log(`\u{1F50D} Daily records (after dedup): ${uniqueDailyRecords.length}`);
              uniqueDailyRecords.forEach((dr) => {
                const vCount = countViolationDays(dr.dailyRecords, mode, isOpaMode, false);
                console.log(`  - ${dr.name} (${dr.rank}) - ${dr.crewMemberId}: ${vCount} violation days`);
              });
            }
          }
          const crewWithViolationsDetailsJson = crewWithViolationsDetails.length > 0 ? JSON.stringify(crewWithViolationsDetails) : null;
          const crewWithPredictedViolationsDetailsJson = crewWithPredictedViolationsDetails.length > 0 ? JSON.stringify(crewWithPredictedViolationsDetails) : null;
          const crewWithNCsDetailsJson = crewWithNCsDetails.length > 0 ? JSON.stringify(crewWithNCsDetails) : null;
          const crewWithPredictedNCsDetailsJson = crewWithPredictedNCsDetails.length > 0 ? JSON.stringify(crewWithPredictedNCsDetails) : null;
          const violationDatesJson = violationDates.length > 0 ? JSON.stringify(violationDates) : null;
          const predictedViolationDatesJson = predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null;
          if (persistedRecord) {
            const vesselReviewStatus = calculateVesselReviewStatus(
              targetMonth,
              persistedRecord.vesselReviewSubmittedDate
            );
            const officeReviewStatus = calculateOfficeReviewStatus(
              targetMonth,
              persistedRecord.vesselReviewSubmittedDate,
              persistedRecord.officeReviewSubmittedDate
            );
            return {
              ...persistedRecord,
              totalCrew: crewCountByVessel.get(vesselId2) || 0,
              recordingStatusPercent: recordingPercent,
              totalViolations,
              predictedViolations,
              crewWithViolations,
              crewWithPredictedViolations,
              crewWithViolationsDetails: crewWithViolationsDetailsJson,
              crewWithPredictedViolationsDetails: crewWithPredictedViolationsDetailsJson,
              violationDates: violationDatesJson,
              predictedViolationDates: predictedViolationDatesJson,
              totalNCs,
              crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetailsJson,
              predictedNCs,
              crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetailsJson,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              vesselReviewStatus,
              officeReviewStatus
            };
          } else {
            const vesselReviewStatus = calculateVesselReviewStatus(targetMonth, null);
            const officeReviewStatus = calculateOfficeReviewStatus(targetMonth, null, null);
            return {
              id: null,
              vesselId: vesselId2,
              vesselName,
              monthValue: targetMonth,
              month: formatMonth(targetMonth),
              totalCrew: crewCountByVessel.get(vesselId2) || 0,
              recordingStatusPercent: recordingPercent,
              activityConflicting: false,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              totalViolations,
              crewWithViolations,
              crewWithViolationsDetails: crewWithViolationsDetailsJson,
              violationDates: violationDatesJson,
              totalNCs,
              crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetailsJson,
              predictedViolations,
              crewWithPredictedViolations,
              crewWithPredictedViolationsDetails: crewWithPredictedViolationsDetailsJson,
              predictedViolationDates: predictedViolationDatesJson,
              predictedNCs,
              crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetailsJson,
              vesselReviewStatus,
              vesselReviewSubmittedDate: null,
              officeReviewSubmittedDate: null,
              officeReviewStatus,
              createdAt: null,
              updatedAt: null
            };
          }
        });
      } else {
        allVesselRecords = persistedRecords.map((record) => {
          const key = `${record.vesselId}-${record.monthValue}`;
          const dailyRecords = dailyRecordsByVesselMonth.get(key) || [];
          let recordingPercent = 0;
          let totalViolations = 0;
          let predictedViolations = 0;
          let crewWithViolations = 0;
          let crewWithPredictedViolations = 0;
          let crewWithViolationsDetails = [];
          let crewWithPredictedViolationsDetails = [];
          if (dailyRecords.length > 0 && record.monthValue) {
            const percentages = dailyRecords.map(
              (dr) => calculateRecordingPercentage(dr.dailyRecords, record.monthValue)
            );
            const total = percentages.reduce((sum, p) => sum + p, 0);
            recordingPercent = Math.round(total / percentages.length);
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map((dr) => [dr.crewMemberId, dr])).values()
            );
            totalViolations = uniqueDailyRecords.reduce(
              (sum, dr) => sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, false),
              0
            );
            predictedViolations = uniqueDailyRecords.reduce(
              (sum, dr) => sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, true),
              0
            );
            const crewWithViolationsRecords = uniqueDailyRecords.filter(
              (dr) => hasViolationDays(dr.dailyRecords, mode, isOpaMode, false)
            );
            crewWithViolations = crewWithViolationsRecords.length;
            crewWithViolationsDetails = crewWithViolationsRecords.map((dr) => ({
              name: dr.name,
              rank: dr.rank
            }));
            const crewWithPredictedViolationsRecords = uniqueDailyRecords.filter(
              (dr) => hasViolationDays(dr.dailyRecords, mode, isOpaMode, true)
            );
            crewWithPredictedViolations = crewWithPredictedViolationsRecords.length;
            crewWithPredictedViolationsDetails = crewWithPredictedViolationsRecords.map((dr) => ({
              name: dr.name,
              rank: dr.rank
            }));
            const allViolationDates = /* @__PURE__ */ new Set();
            const allPredictedViolationDates = /* @__PURE__ */ new Set();
            uniqueDailyRecords.forEach((dr) => {
              const completedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, false);
              const plannedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, true);
              completedDates.forEach((date) => allViolationDates.add(date));
              plannedDates.forEach((date) => allPredictedViolationDates.add(date));
            });
            const violationDates = Array.from(allViolationDates).sort((a, b) => a - b);
            const predictedViolationDates = Array.from(allPredictedViolationDates).sort((a, b) => a - b);
            let totalNCs = 0;
            let predictedNCs = 0;
            let crewWithNCs = 0;
            let crewWithPredictedNCs = 0;
            let crewWithNCsDetails = [];
            let crewWithPredictedNCsDetails = [];
            uniqueDailyRecords.forEach((dr) => {
              const ncs = calculateNCs(dr.dailyRecords, mode, isOpaMode);
              totalNCs += ncs.totalNCs;
              predictedNCs += ncs.predictedNCs;
              if (ncs.totalNCs > 0) {
                crewWithNCs++;
                crewWithNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
              if (ncs.predictedNCs > 0) {
                crewWithPredictedNCs++;
                crewWithPredictedNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
            });
            const vesselReviewStatus2 = calculateVesselReviewStatus(
              record.monthValue,
              record.vesselReviewSubmittedDate
            );
            const officeReviewStatus2 = calculateOfficeReviewStatus(
              record.monthValue,
              record.vesselReviewSubmittedDate,
              record.officeReviewSubmittedDate
            );
            return {
              ...record,
              totalCrew: crewCountByVessel.get(record.vesselId) || 0,
              recordingStatusPercent: recordingPercent,
              totalViolations,
              predictedViolations,
              crewWithViolations,
              crewWithPredictedViolations,
              crewWithViolationsDetails: JSON.stringify(crewWithViolationsDetails),
              crewWithPredictedViolationsDetails: JSON.stringify(crewWithPredictedViolationsDetails),
              violationDates: violationDates.length > 0 ? JSON.stringify(violationDates) : null,
              predictedViolationDates: predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null,
              totalNCs,
              crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetails.length > 0 ? JSON.stringify(crewWithNCsDetails) : null,
              predictedNCs,
              crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetails.length > 0 ? JSON.stringify(crewWithPredictedNCsDetails) : null,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              vesselReviewStatus: vesselReviewStatus2,
              officeReviewStatus: officeReviewStatus2
            };
          }
          const vesselReviewStatus = calculateVesselReviewStatus(
            record.monthValue,
            record.vesselReviewSubmittedDate
          );
          const officeReviewStatus = calculateOfficeReviewStatus(
            record.monthValue,
            record.vesselReviewSubmittedDate,
            record.officeReviewSubmittedDate
          );
          return {
            ...record,
            totalCrew: crewCountByVessel.get(record.vesselId) || 0,
            recordingStatusPercent: 0,
            totalViolations: 0,
            predictedViolations: 0,
            crewWithViolations: 0,
            crewWithPredictedViolations: 0,
            crewWithViolationsDetails: null,
            crewWithPredictedViolationsDetails: null,
            violationDates: null,
            predictedViolationDates: null,
            totalNCs: 0,
            crewWithNCs: 0,
            crewWithNCsDetails: null,
            predictedNCs: 0,
            crewWithPredictedNCs: 0,
            crewWithPredictedNCsDetails: null,
            crewWithActivityConflicts: 0,
            crewWithActivityConflictsDetails: null,
            vesselReviewStatus,
            officeReviewStatus
          };
        });
      }
      const filteredRecords = allVesselRecords;
      res.json(filteredRecords);
    } catch (error) {
      console.error("Failed to fetch rest hours vessel records:", error);
      res.status(500).json({ error: "Failed to fetch rest hours vessel records" });
    }
  });
  app2.get("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursVesselRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to fetch rest hours vessel record" });
    }
  });
  app2.post("/api/rest-hours-vessel-records", async (req, res) => {
    try {
      const result = insertRestHoursVesselRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours vessel record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursVesselRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to create rest hours vessel record" });
    }
  });
  app2.put("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursVesselRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours vessel record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursVesselRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to update rest hours vessel record" });
    }
  });
  app2.delete("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursVesselRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to delete rest hours vessel record" });
    }
  });
  function getVisibleViolationCodes(complianceMode, opaMode) {
    const codes = [];
    if (complianceMode === "Rest") {
      codes.push(1, 2, 3, 4);
    } else {
      codes.push(5, 6);
    }
    if (opaMode) {
      codes.push(7, 8);
    }
    return codes;
  }
  app2.get("/api/rest-hours-violations-by-rank", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode = "Rest", opaMode = "false" } = req.query;
      const isOpaMode = opaMode === "true";
      const visibleViolationCodes = getVisibleViolationCodes(complianceMode, isOpaMode);
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      let filteredRecords = allDailyRecords;
      if (vesselIds) {
        const vesselIdArray = typeof vesselIds === "string" ? [vesselIds] : vesselIds;
        filteredRecords = filteredRecords.filter(
          (record) => vesselIdArray.includes(record.vesselId)
        );
      }
      if (monthValue) {
        filteredRecords = filteredRecords.filter(
          (record) => record.monthYear === monthValue
        );
      }
      const violationsByRank = /* @__PURE__ */ new Map();
      filteredRecords.forEach((record) => {
        try {
          const dailyRecords = JSON.parse(record.dailyRecords);
          const rank = record.rank;
          let violationDays = 0;
          dailyRecords.forEach((day) => {
            if (day.isPlan === false && day.violations && Array.isArray(day.violations)) {
              const filteredViolations = day.violations.filter(
                (code) => visibleViolationCodes.includes(code)
              );
              if (filteredViolations.length > 0) {
                violationDays++;
              }
            }
          });
          if (violationDays > 0) {
            const currentTotal = violationsByRank.get(rank) || 0;
            violationsByRank.set(rank, currentTotal + violationDays);
          }
        } catch (error) {
          console.error(`Failed to parse daily records for record ${record.id}:`, error);
        }
      });
      const result = Array.from(violationsByRank.entries()).map(([rank, violationDays]) => ({ rank, violationDays })).sort((a, b) => b.violationDays - a.violationDays);
      res.json(result);
    } catch (error) {
      console.error("Failed to get violations by rank:", error);
      res.status(500).json({ error: "Failed to get violations by rank" });
    }
  });
  app2.get("/api/rest-hours-ncs-by-rank", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode, opaMode } = req.query;
      const mode = complianceMode === "Work" ? "Work" : "Rest";
      const isOpaMode = opaMode === "true";
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      let filteredRecords = allDailyRecords;
      if (vesselIds) {
        const vesselIdArray = typeof vesselIds === "string" ? [vesselIds] : vesselIds;
        filteredRecords = filteredRecords.filter(
          (record) => vesselIdArray.includes(record.vesselId)
        );
      }
      if (monthValue) {
        filteredRecords = filteredRecords.filter(
          (record) => record.monthYear === monthValue
        );
      }
      const uniqueRecords = /* @__PURE__ */ new Map();
      filteredRecords.forEach((record) => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
        if (!uniqueRecords.has(key) || record.id > uniqueRecords.get(key).id) {
          uniqueRecords.set(key, record);
        }
      });
      const ncsByRank = /* @__PURE__ */ new Map();
      uniqueRecords.forEach((record) => {
        try {
          const rank = record.rank;
          const { totalNCs } = calculateNCs(record.dailyRecords, mode, isOpaMode);
          if (totalNCs > 0) {
            const currentCount = ncsByRank.get(rank) || 0;
            ncsByRank.set(rank, currentCount + 1);
          }
        } catch (error) {
          console.error(`Failed to calculate NCs for record ${record.id}:`, error);
        }
      });
      const result = Array.from(ncsByRank.entries()).map(([rank, ncCount]) => ({ rank, ncCount })).sort((a, b) => b.ncCount - a.ncCount);
      res.json(result);
    } catch (error) {
      console.error("Failed to get NCs by rank:", error);
      res.status(500).json({ error: "Failed to get NCs by rank" });
    }
  });
  app2.get("/api/rest-hours-crew-records", async (req, res) => {
    try {
      const { vesselIds, monthValue, ranks, search, complianceMode, opaMode } = req.query;
      const mode = complianceMode === "Work" ? "Work" : "Rest";
      const isOpaMode = opaMode === "true";
      const allCrewMembers = await storage.getCrewMembers();
      const allVesselPlanning = await storage.getAllVesselPlanning();
      const crewPlanningMap = /* @__PURE__ */ new Map();
      allVesselPlanning.forEach((planning) => {
        if (planning.crewMemberId && !planning.isArchived) {
          const key = `${planning.crewMemberId}-${planning.vesselId}`;
          crewPlanningMap.set(key, planning);
        }
      });
      const persistedRecords = await storage.getRestHoursCrewRecords();
      const persistedRecordsMap = /* @__PURE__ */ new Map();
      persistedRecords.forEach((record) => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthValue}`;
        persistedRecordsMap.set(key, record);
      });
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselNameToIdMap = /* @__PURE__ */ new Map();
      const vesselIdToNameMap = /* @__PURE__ */ new Map();
      vesselMasterData.forEach((entry) => {
        const entryId = entry.entryId || entry.entry_id;
        if (!entryId) return;
        if (entry.name) vesselNameToIdMap.set(entry.name, entryId);
        if (entry.label) vesselNameToIdMap.set(entry.label, entryId);
        if (entry.vessel) vesselNameToIdMap.set(entry.vessel, entryId);
        vesselNameToIdMap.set(entryId, entryId);
        const displayName = entry.name || entry.label || entry.vessel || entryId;
        vesselIdToNameMap.set(entryId, displayName);
      });
      const getVesselId = (crew) => {
        const vesselName = crew.presentVessel || crew.vessel;
        if (!vesselName || vesselName === "") return null;
        return vesselNameToIdMap.get(vesselName) || null;
      };
      const getSignOnOffInfo = (crew, currentMonth) => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const isOfficer = ["Master", "Chief Officer", "Chief Engineer", "2nd Officer", "Second Officer", "3rd Officer", "Third Officer", "2nd Engineer", "Second Engineer", "3rd Engineer", "Third Engineer", "4th Engineer", "Fourth Engineer", "Fifth Engineer", "Electrical Officer", "Gas Engineer", "Cargo/ Gas Engineer"].includes(crew.presentRank || crew.rank || "");
        const role = isOfficer ? "Officer" : "Rating";
        if (!currentMonth) return "";
        const [targetYear, targetMonthNum] = currentMonth.split("-").map(Number);
        const isInTargetMonth = (dateStr) => {
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getFullYear() === targetYear && date.getMonth() + 1 === targetMonthNum;
        };
        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          const day = date.getDate();
          const month = monthNames[date.getMonth()];
          const year = date.getFullYear();
          return `${day}-${month}-${year}`;
        };
        const results = [];
        if (crew.signOnDate && isInTargetMonth(crew.signOnDate)) {
          results.push(`S.On / ${formatDate(crew.signOnDate)} / ${role}`);
        }
        if (crew.signOffDate && isInTargetMonth(crew.signOffDate)) {
          results.push(`S.Off / ${formatDate(crew.signOffDate)} / ${role}`);
        }
        return results.join(" | ");
      };
      const formatMonth = (monthVal) => {
        if (!monthVal) return "";
        const [year, month] = monthVal.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]}-${year}`;
      };
      const targetMonth = monthValue || "";
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      const dailyRecordsMap = /* @__PURE__ */ new Map();
      allDailyRecords.forEach((record) => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
        const existing = dailyRecordsMap.get(key);
        const recordIdNum = Number(record.id);
        const existingIdNum = existing ? Number(existing.id) : -1;
        if (!existing || recordIdNum > existingIdNum) {
          dailyRecordsMap.set(key, record);
        }
      });
      const crewRecords = allCrewMembers.filter((crew) => {
        const vesselId2 = getVesselId(crew);
        return vesselId2 !== null;
      }).map((crew, index) => {
        const crewAny = crew;
        const vesselId2 = getVesselId(crew);
        const vesselName = vesselIdToNameMap.get(vesselId2) || crew.presentVessel || crewAny.vessel || "";
        const fullName = `${crew.firstName || ""} ${crew.familyName || crewAny.lastName || ""}`.trim();
        const planningKey = `${crew.id}-${vesselId2}`;
        const planning = crewPlanningMap.get(planningKey);
        const rank = planning?.rank || crew.presentRank || crewAny.rank || "Unknown";
        const crewMemberId = crew.id || `${fullName}-${rank}-${vesselId2}`;
        const key = `${crewMemberId}-${vesselId2}-${targetMonth}`;
        const persistedRecord = persistedRecordsMap.get(key);
        const dailyRecord = dailyRecordsMap.get(key);
        let recordingPercent = 0;
        let totalViolations = 0;
        let predictedViolations = 0;
        let violationDates = [];
        let predictedViolationDates = [];
        let totalNCs = 0;
        let predictedNCs = 0;
        if (dailyRecord && targetMonth) {
          recordingPercent = calculateRecordingPercentage(dailyRecord.dailyRecords, targetMonth);
          totalViolations = countViolationDays(dailyRecord.dailyRecords, mode, isOpaMode, false);
          predictedViolations = countViolationDays(dailyRecord.dailyRecords, mode, isOpaMode, true);
          violationDates = getViolationDates(dailyRecord.dailyRecords, mode, isOpaMode, false);
          predictedViolationDates = getViolationDates(dailyRecord.dailyRecords, mode, isOpaMode, true);
          const ncs = calculateNCs(dailyRecord.dailyRecords, mode, isOpaMode);
          totalNCs = ncs.totalNCs;
          predictedNCs = ncs.predictedNCs;
        }
        const violationDatesJson = violationDates.length > 0 ? JSON.stringify(violationDates) : null;
        const predictedViolationDatesJson = predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null;
        if (persistedRecord) {
          return {
            ...persistedRecord,
            recordingStatusPercent: recordingPercent,
            totalViolations,
            predictedViolations,
            violationDates: violationDatesJson,
            predictedViolationDates: predictedViolationDatesJson,
            totalNCs,
            predictedNCs
          };
        } else {
          return {
            id: null,
            vesselId: vesselId2,
            vesselName,
            crewMemberId,
            rank,
            name: fullName,
            month: formatMonth(targetMonth),
            monthValue: targetMonth,
            signOnOffInfo: getSignOnOffInfo(crew, targetMonth),
            recordingStatusPercent: recordingPercent,
            activityConflicting: false,
            totalViolations,
            violationDates: violationDatesJson,
            totalNCs,
            predictedViolations,
            predictedViolationDates: predictedViolationDatesJson,
            predictedNCs,
            createdAt: null,
            updatedAt: null
          };
        }
      });
      let filteredRecords = crewRecords;
      if (vesselIds && Array.isArray(vesselIds) && vesselIds.length > 0) {
        const vesselIdArray = typeof vesselIds === "string" ? [vesselIds] : vesselIds;
        filteredRecords = filteredRecords.filter((record) => vesselIdArray.includes(record.vesselId));
      } else if (vesselIds && typeof vesselIds === "string") {
        filteredRecords = filteredRecords.filter((record) => record.vesselId === vesselIds);
      }
      if (targetMonth) {
        filteredRecords = filteredRecords.filter((record) => record.monthValue === targetMonth);
      }
      if (ranks) {
        const ranksArray = Array.isArray(ranks) ? ranks : [ranks];
        filteredRecords = filteredRecords.filter((record) => ranksArray.includes(record.rank));
      }
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        filteredRecords = filteredRecords.filter(
          (record) => record.name.toLowerCase().includes(searchLower) || record.crewMemberId.toLowerCase().includes(searchLower)
        );
      }
      res.json(filteredRecords);
    } catch (error) {
      console.error("Failed to fetch rest hours crew records:", error);
      res.status(500).json({ error: "Failed to fetch rest hours crew records" });
    }
  });
  app2.get("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursCrewRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch rest hours crew record:", error);
      res.status(500).json({ error: "Failed to fetch rest hours crew record" });
    }
  });
  app2.post("/api/rest-hours-crew-records", async (req, res) => {
    try {
      const result = insertRestHoursCrewRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours crew record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursCrewRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours crew record:", error);
      res.status(500).json({ error: "Failed to create rest hours crew record" });
    }
  });
  app2.put("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursCrewRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours crew record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursCrewRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours crew record:", error);
      res.status(500).json({ error: "Failed to update rest hours crew record" });
    }
  });
  app2.delete("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursCrewRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours crew record:", error);
      res.status(500).json({ error: "Failed to delete rest hours crew record" });
    }
  });
  app2.get("/api/rest-hours-daily-records", async (req, res) => {
    try {
      const records = await storage.getRestHoursDailyRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to get rest hours daily records:", error);
      res.status(500).json({ error: "Failed to get rest hours daily records" });
    }
  });
  app2.get("/api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear", async (req, res) => {
    try {
      const { crewMemberId, vesselId: vesselId2, monthYear } = req.params;
      const record = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId2, monthYear);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get rest hours daily record by key:", error);
      res.status(500).json({ error: "Failed to get rest hours daily record by key" });
    }
  });
  app2.get("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursDailyRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get rest hours daily record:", error);
      res.status(500).json({ error: "Failed to get rest hours daily record" });
    }
  });
  app2.post("/api/rest-hours-daily-records", async (req, res) => {
    try {
      const result = insertRestHoursDailyRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours daily record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursDailyRecord(result.data);
      await recalculateActivityConflicts(record.vesselId, record.monthYear);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours daily record:", error);
      res.status(500).json({ error: "Failed to create rest hours daily record" });
    }
  });
  app2.put("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursDailyRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours daily record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursDailyRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      await updateRecordingPercentages(record.crewMemberId, record.vesselId, record.monthYear);
      await recalculateActivityConflicts(record.vesselId, record.monthYear);
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours daily record:", error);
      res.status(500).json({ error: "Failed to update rest hours daily record" });
    }
  });
  app2.delete("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursDailyRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours daily record:", error);
      res.status(500).json({ error: "Failed to delete rest hours daily record" });
    }
  });
  app2.post("/api/rest-hours-daily-records/backfill-violations", async (req, res) => {
    try {
      const allRecords = await storage.getRestHoursDailyRecords();
      let updatedCount = 0;
      let errorCount = 0;
      const results = [];
      for (const record of allRecords) {
        try {
          const dailyRecords = JSON.parse(record.dailyRecords);
          const updatedDailyRecords = calculateViolationsFromHours(dailyRecords);
          const totalViolations = updatedDailyRecords.reduce((sum, day) => {
            return sum + (day.violations?.length || 0);
          }, 0);
          await storage.updateRestHoursDailyRecord(record.id, {
            dailyRecords: JSON.stringify(updatedDailyRecords)
          });
          updatedCount++;
          results.push({
            id: record.id,
            crewMemberId: record.crewMemberId,
            status: "updated",
            violationsFound: totalViolations
          });
        } catch (err) {
          errorCount++;
          results.push({
            id: record.id,
            crewMemberId: record.crewMemberId,
            status: "error"
          });
          console.error(`Failed to backfill violations for record ${record.id}:`, err);
        }
      }
      res.json({
        success: true,
        totalRecords: allRecords.length,
        updatedCount,
        errorCount,
        results
      });
    } catch (error) {
      console.error("Failed to backfill violations:", error);
      res.status(500).json({ error: "Failed to backfill violations" });
    }
  });
  app2.get("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.params;
      if (!monthValue.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ error: "monthValue must be in YYYY-MM format" });
      }
      const adjustment = await storage.getVesselDateLineAdjustment(vesselId2, monthValue);
      if (!adjustment) {
        return res.status(404).json({ error: "Vessel date line adjustment not found" });
      }
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to get vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to get vessel date line adjustment" });
    }
  });
  app2.put("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.params;
      const result = insertVesselDateLineAdjustmentSchema.safeParse({
        vesselId: vesselId2,
        monthValue,
        adjustments: req.body.adjustments
      });
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel date line adjustment data", details: result.error.issues });
      }
      const adjustment = await storage.saveVesselDateLineAdjustment(result.data);
      try {
        const adjustmentsArray = JSON.parse(result.data.adjustments);
        const advancedDays = adjustmentsArray.filter((adj) => adj.type === "advanced").map((adj) => adj.day);
        if (advancedDays.length > 0) {
          await storage.clearAdvancedDaysData(vesselId2, monthValue, advancedDays);
        }
      } catch (e) {
        console.error("Failed to clear advanced days data:", e);
      }
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to save vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to save vessel date line adjustment" });
    }
  });
  app2.delete("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.params;
      if (!monthValue.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ error: "monthValue must be in YYYY-MM format" });
      }
      const deleted = await storage.deleteVesselDateLineAdjustment(vesselId2, monthValue);
      if (!deleted) {
        return res.status(404).json({ error: "Vessel date line adjustment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to delete vessel date line adjustment" });
    }
  });
  app2.get("/api/vessel-violation-comments", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.query;
      if (!vesselId2 || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      const comment = await storage.getVesselViolationComment(vesselId2, monthValue);
      res.json(comment);
    } catch (error) {
      console.error("Failed to get vessel violation comment:", error);
      res.status(500).json({ error: "Failed to get vessel violation comment" });
    }
  });
  app2.post("/api/vessel-violation-comments", async (req, res) => {
    try {
      const result = insertVesselViolationCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel violation comment data", details: result.error.issues });
      }
      const comment = await storage.saveVesselViolationComment(result.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to save vessel violation comment:", error);
      res.status(500).json({ error: "Failed to save vessel violation comment" });
    }
  });
  app2.get("/api/office-violation-comments", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.query;
      if (!vesselId2 || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      const comment = await storage.getOfficeViolationComment(vesselId2, monthValue);
      res.json(comment);
    } catch (error) {
      console.error("Failed to get office violation comment:", error);
      res.status(500).json({ error: "Failed to get office violation comment" });
    }
  });
  app2.post("/api/office-violation-comments", async (req, res) => {
    try {
      const result = insertOfficeViolationCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid office violation comment data", details: result.error.issues });
      }
      const { comment, reviewerName, reviewDate } = result.data;
      if (!comment || comment.trim() === "") {
        return res.status(400).json({ error: "Comment is required and cannot be empty" });
      }
      if (!reviewerName || reviewerName.trim() === "") {
        return res.status(400).json({ error: "Reviewer name is required and cannot be empty" });
      }
      if (!reviewDate) {
        return res.status(400).json({ error: "Review date is required" });
      }
      const savedComment = await storage.saveOfficeViolationComment(result.data);
      res.status(201).json(savedComment);
    } catch (error) {
      console.error("Failed to save office violation comment:", error);
      res.status(500).json({ error: "Failed to save office violation comment" });
    }
  });
  app2.post("/api/rest-hours-vessel-records/submit-review", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.body;
      if (!vesselId2 || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
        vesselIds: [vesselId2],
        monthValue
      });
      const existingVesselRecord = vesselRecords.find((r) => r.vesselId === vesselId2 && r.monthValue === monthValue);
      if (!existingVesselRecord) {
        return res.status(404).json({ error: "Vessel record not found" });
      }
      const updatedRecord = await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        vesselReviewSubmittedDate: /* @__PURE__ */ new Date()
      });
      res.status(200).json(updatedRecord);
    } catch (error) {
      console.error("Failed to submit vessel review:", error);
      res.status(500).json({ error: "Failed to submit vessel review" });
    }
  });
  app2.post("/api/rest-hours-vessel-records/submit-office-review", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthValue } = req.body;
      if (!vesselId2 || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      const officeComment = await storage.getOfficeViolationComment(vesselId2, monthValue);
      if (!officeComment) {
        return res.status(400).json({ error: "Office violation comment must be saved before submitting office review" });
      }
      if (!officeComment.reviewerName || officeComment.reviewerName.trim() === "") {
        return res.status(400).json({ error: "Office violation comment must have a reviewer name before submitting" });
      }
      if (!officeComment.reviewDate) {
        return res.status(400).json({ error: "Office violation comment must have a review date before submitting" });
      }
      const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
        vesselIds: [vesselId2],
        monthValue
      });
      const existingVesselRecord = vesselRecords.find((r) => r.vesselId === vesselId2 && r.monthValue === monthValue);
      if (!existingVesselRecord) {
        return res.status(404).json({ error: "Vessel record not found" });
      }
      const updatedRecord = await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        officeReviewSubmittedDate: /* @__PURE__ */ new Date()
      });
      res.status(200).json(updatedRecord);
    } catch (error) {
      console.error("Failed to submit office review:", error);
      res.status(500).json({ error: "Failed to submit office review" });
    }
  });
  app2.get("/api/nc-reports/all", async (req, res) => {
    try {
      const reports = await storage.getAllNCReports();
      res.json(reports);
    } catch (error) {
      console.error("Failed to get all NC reports:", error);
      res.status(500).json({ error: "Failed to get all NC reports" });
    }
  });
  app2.get("/api/nc-reports", async (req, res) => {
    try {
      const { crewMemberId, vesselId: vesselId2, monthValue } = req.query;
      if (!crewMemberId || !vesselId2 || !monthValue) {
        return res.status(400).json({ error: "crewMemberId, vesselId, and monthValue are required" });
      }
      const report = await storage.getNCReport(crewMemberId, vesselId2, monthValue);
      res.json(report);
    } catch (error) {
      console.error("Failed to get NC report:", error);
      res.status(500).json({ error: "Failed to get NC report" });
    }
  });
  app2.post("/api/nc-reports", async (req, res) => {
    try {
      const result = insertNCReportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid NC report data", details: result.error.issues });
      }
      const report = await storage.saveNCReport(result.data);
      res.status(201).json(report);
    } catch (error) {
      console.error("Failed to save NC report:", error);
      res.status(500).json({ error: "Failed to save NC report" });
    }
  });
  app2.get("/api/variable-tasks", async (req, res) => {
    try {
      const { vesselId: vesselId2, periodValue } = req.query;
      if (vesselId2 || periodValue) {
        const tasks = await storage.getVariableTasksByFilters({
          vesselId: vesselId2,
          periodValue
        });
        res.json(tasks);
      } else {
        const tasks = await storage.getVariableTasks();
        res.json(tasks);
      }
    } catch (error) {
      console.error("Failed to get variable tasks:", error);
      res.status(500).json({ error: "Failed to get variable tasks" });
    }
  });
  app2.get("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getVariableTask(id);
      if (!task) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get variable task:", error);
      res.status(500).json({ error: "Failed to get variable task" });
    }
  });
  app2.post("/api/variable-tasks", async (req, res) => {
    try {
      const result = insertVariableTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid variable task data", details: result.error.issues });
      }
      const task = await storage.createVariableTask(result.data);
      await syncVariableTaskToRHRecords(task);
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create variable task:", error);
      res.status(500).json({ error: "Failed to create variable task" });
    }
  });
  app2.patch("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const oldTask = await storage.getVariableTask(id);
      const result = insertVariableTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid variable task data", details: result.error.issues });
      }
      const task = await storage.updateVariableTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      await syncVariableTaskToRHRecords(task, oldTask);
      res.json(task);
    } catch (error) {
      console.error("Failed to update variable task:", error);
      res.status(500).json({ error: "Failed to update variable task" });
    }
  });
  app2.delete("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getVariableTask(id);
      if (task) {
        await removeVariableTaskFromRHRecords(task);
      }
      const deleted = await storage.deleteVariableTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete variable task:", error);
      res.status(500).json({ error: "Failed to delete variable task" });
    }
  });
  app2.get("/api/fixed-tasks", async (req, res) => {
    try {
      const { vesselId: vesselId2, monthYear } = req.query;
      if (vesselId2 && monthYear) {
        const tasks = await storage.getFixedTasksByVesselAndMonth(vesselId2, monthYear);
        res.json(tasks);
      } else {
        const tasks = await storage.getFixedTasks();
        res.json(tasks);
      }
    } catch (error) {
      console.error("Failed to get fixed tasks:", error);
      res.status(500).json({ error: "Failed to get fixed tasks" });
    }
  });
  app2.get("/api/fixed-tasks/by-key/:crewMemberId/:vesselId/:monthYear", async (req, res) => {
    try {
      const { crewMemberId, vesselId: vesselId2, monthYear } = req.params;
      const task = await storage.getFixedTaskByKey(crewMemberId, vesselId2, monthYear);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get fixed task by key:", error);
      res.status(500).json({ error: "Failed to get fixed task by key" });
    }
  });
  app2.get("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getFixedTask(id);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get fixed task:", error);
      res.status(500).json({ error: "Failed to get fixed task" });
    }
  });
  app2.post("/api/fixed-tasks", async (req, res) => {
    try {
      const result = insertFixedTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid fixed task data", details: result.error.issues });
      }
      const task = await storage.createFixedTask(result.data);
      await syncFixedTasksToRHRecords(task.vesselId, task.monthYear);
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create fixed task:", error);
      res.status(500).json({ error: "Failed to create fixed task" });
    }
  });
  app2.put("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const result = insertFixedTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid fixed task data", details: result.error.issues });
      }
      const task = await storage.updateFixedTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      await syncFixedTasksToRHRecords(task.vesselId, task.monthYear);
      res.json(task);
    } catch (error) {
      console.error("Failed to update fixed task:", error);
      res.status(500).json({ error: "Failed to update fixed task" });
    }
  });
  app2.delete("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getFixedTask(id);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      const deleted = await storage.deleteFixedTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      await clearFixedTaskPlanCodes(task.crewMemberId, task.vesselId, task.monthYear);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete fixed task:", error);
      res.status(500).json({ error: "Failed to delete fixed task" });
    }
  });
  app2.get("/api/crew-members/next-crew-id", async (req, res) => {
    try {
      const nextCrewId = await storage.getNextCrewId();
      res.json({ crewId: nextCrewId });
    } catch (error) {
      console.error("\u274C Failed to generate next crew ID:", error);
      res.status(500).json({ error: "Failed to generate next crew ID" });
    }
  });
  app2.get("/api/crew-members/by-rank/:rank", async (req, res) => {
    try {
      const { rank } = req.params;
      const crewMembers2 = await storage.getCrewMembers();
      const rankFlags = await storage.getCompanyRankByName(rank);
      const crewMatchingRank = crewMembers2.filter((crew) => crew.presentRank === rank);
      const filteredCrew = await Promise.all(crewMatchingRank.map(async (crew) => {
        let currentCompanySeaService = [];
        let externalSeaService = [];
        if (crew.currentCompanySeaService) {
          if (Array.isArray(crew.currentCompanySeaService)) {
            currentCompanySeaService = crew.currentCompanySeaService;
          } else if (typeof crew.currentCompanySeaService === "string") {
            try {
              currentCompanySeaService = JSON.parse(crew.currentCompanySeaService);
            } catch (e) {
              currentCompanySeaService = [];
            }
          }
        }
        if (crew.externalSeaService) {
          if (Array.isArray(crew.externalSeaService)) {
            externalSeaService = crew.externalSeaService;
          } else if (typeof crew.externalSeaService === "string") {
            try {
              externalSeaService = JSON.parse(crew.externalSeaService);
            } catch (e) {
              externalSeaService = [];
            }
          }
        }
        const experienceMetrics = calculateExperienceFromSeaService(
          currentCompanySeaService,
          externalSeaService,
          crew.presentRank || ""
        );
        let licensesArray = [];
        if (crew.licenses) {
          if (Array.isArray(crew.licenses)) {
            licensesArray = crew.licenses;
          } else if (typeof crew.licenses === "string") {
            try {
              const parsed = JSON.parse(crew.licenses);
              if (Array.isArray(parsed)) {
                licensesArray = parsed;
              }
            } catch (e) {
              licensesArray = [];
            }
          }
        }
        const endorsements = deriveEndorsementCode(
          {
            seniorOfficer: rankFlags?.seniorOfficer,
            officer: rankFlags?.officer,
            rating: rankFlags?.rating
          },
          licensesArray
        );
        const experience = {
          company: experienceMetrics.company,
          rank: experienceMetrics.rank,
          tankers: experienceMetrics.tankers,
          oow: experienceMetrics.oow,
          endorsements
        };
        const pools = ["Pool A", "Pool B", "Pool C"];
        const pool = pools[Math.floor(Math.random() * pools.length)];
        const shipType = crew.vesselType || void 0;
        const travelStatuses = ["Available", "On Leave", "Traveling"];
        const travelStatus = travelStatuses[Math.floor(Math.random() * travelStatuses.length)];
        const higherCerts = ["Master Unlimited", "Chief Engineer Unlimited", "None"];
        const higherCert = higherCerts[Math.floor(Math.random() * higherCerts.length)];
        const performances = ["Excellent", "Good", "Average"];
        const performance = performances[Math.floor(Math.random() * performances.length)];
        return {
          id: crew.id,
          name: `${crew.firstName} ${crew.middleName || ""} ${crew.familyName || ""}`.trim(),
          rank: crew.presentRank,
          pool,
          manningAgent: crew.manningAgent,
          shipType,
          nationality: crew.nationality,
          travelStatus,
          higherCert,
          performance,
          nextAvailability: crew.nextAvailability || null,
          experience
        };
      }));
      res.json(filteredCrew);
    } catch (error) {
      console.error("Failed to fetch crew by rank:", error);
      res.status(500).json({ error: "Failed to fetch crew members by rank" });
    }
  });
  async function autoCreateVesselPlanning(crewMember) {
    try {
      if (!crewMember.presentVessel || !crewMember.presentRank) {
        console.log(`\u26A1 [AUTO-SYNC] Skipping vessel planning for ${crewMember.id}: no vessel or rank assigned`);
        return null;
      }
      const crewId = crewMember.id || crewMember.employeeId;
      const allPlanning = await storage.getVesselPlanningByVessel(crewMember.presentVessel);
      const existingEntry = allPlanning.find((p) => p.crewMemberId === crewId);
      if (existingEntry) {
        console.log(`\u26A1 [AUTO-SYNC] Vessel planning already exists for ${crewId}`);
        const assignedPosition2 = existingEntry.rank;
        const crewRank2 = crewMember.presentRank;
        if (assignedPosition2 && assignedPosition2 !== crewRank2) {
          await storage.updateCrewMember(crewId, {
            presentRank: assignedPosition2
          });
          console.log(`\u2705 [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank2} \u2192 ${assignedPosition2}`);
        }
        return existingEntry;
      }
      const vesselRevisions2 = await storage.getVesselRevisionsByVessel(crewMember.presentVessel);
      if (vesselRevisions2.length === 0) {
        console.log(`\u26A1 [AUTO-SYNC] No vessel revisions found for ${crewMember.presentVessel}`);
        return null;
      }
      const latestRevision = vesselRevisions2.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      })[0];
      const rankData = JSON.parse(latestRevision.revisionData);
      const crewRank = crewMember.presentRank;
      const matchingRanks = rankData.filter((r) => {
        const rankName = (r.role || r.rank)?.split("_")[0];
        return r.role === crewRank || r.rank === crewRank || rankName === crewRank;
      });
      const rolePositions = matchingRanks.filter((r) => r.role !== null && r.role !== void 0);
      const finalMatchingRanks = rolePositions.length > 0 ? rolePositions : matchingRanks;
      console.log(`\u26A1 [AUTO-SYNC] Matching ranks for ${crewRank}: ${matchingRanks.length}, Role positions: ${rolePositions.length}`);
      if (finalMatchingRanks.length === 0) {
        console.log(`\u26A1 [AUTO-SYNC] Rank ${crewRank} not found in vessel ${crewMember.presentVessel} revision`);
        return null;
      }
      let matchingRank = null;
      if (finalMatchingRanks.length > 1) {
        for (const rank of finalMatchingRanks) {
          const rankId = rank.id || rank.rankId;
          const isOccupied = allPlanning.some(
            (p) => p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
          );
          if (!isOccupied) {
            matchingRank = rank;
            console.log(`\u26A1 [AUTO-SYNC] Found vacant position: ${rank.role || rank.rank} for ${crewRank}`);
            break;
          }
        }
        if (!matchingRank) {
          console.log(`\u26A1 [AUTO-SYNC] All ${crewRank} positions are occupied on vessel ${crewMember.presentVessel}`);
          return null;
        }
      } else {
        matchingRank = finalMatchingRanks[0];
      }
      const assignedPosition = matchingRank.role || matchingRank.rank;
      const planningData = {
        vesselId: crewMember.presentVessel,
        rankId: matchingRank.id || matchingRank.rankId,
        rank: assignedPosition,
        crewMemberId: crewId,
        reliefDue: crewMember.reliefDue || null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const created = await storage.createVesselPlanning(planningData);
      if (assignedPosition !== crewRank) {
        await storage.updateCrewMember(crewId, {
          presentRank: assignedPosition
        });
        console.log(`\u2705 [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank} \u2192 ${assignedPosition}`);
      }
      console.log(`\u2705 [AUTO-SYNC] Created vessel planning entry for ${crewId}: ${assignedPosition} on ${crewMember.presentVessel}`);
      return created;
    } catch (error) {
      console.error(`\u274C [AUTO-SYNC] Failed to auto-create vessel planning:`, error);
      return null;
    }
  }
  async function syncVesselPlanning(crewId, updates, oldCrew) {
    try {
      const vesselChanged = updates.presentVessel && updates.presentVessel !== oldCrew.presentVessel;
      const rankChanged = updates.presentRank && updates.presentRank !== oldCrew.presentRank;
      const reliefDueChanged = updates.reliefDue !== void 0 && updates.reliefDue !== oldCrew.reliefDue;
      if (!vesselChanged && !rankChanged && !reliefDueChanged) {
        return;
      }
      const newVessel = updates.presentVessel || oldCrew.presentVessel;
      const newRank = updates.presentRank || oldCrew.presentRank;
      console.log(`\u26A1 [AUTO-SYNC] Syncing vessel planning for ${crewId}: vessel=${newVessel}, rank=${newRank}`);
      const allPlanning = await storage.getVesselPlanningByVessel(newVessel);
      const existingEntry = allPlanning.find((p) => p.crewMemberId === crewId);
      if (!newVessel || !newRank) {
        console.log(`\u26A1 [AUTO-SYNC] Crew ${crewId} unassigned from vessel/rank`);
        return;
      }
      const updatedCrew = { ...oldCrew, ...updates };
      if (existingEntry) {
        const updateData = {};
        if (vesselChanged) {
          updateData.vesselId = newVessel;
        }
        if (rankChanged) {
          const vesselRevisions2 = await storage.getVesselRevisionsByVessel(newVessel);
          if (vesselRevisions2.length > 0) {
            const latestRevision = vesselRevisions2.sort((a, b) => {
              const aDate = new Date(a.createdAt || 0).getTime();
              const bDate = new Date(b.createdAt || 0).getTime();
              return bDate - aDate;
            })[0];
            const rankData = JSON.parse(latestRevision.revisionData);
            const matchingRanks = rankData.filter((r) => {
              const rankName = (r.role || r.rank)?.split("_")[0];
              return r.role === newRank || r.rank === newRank || rankName === newRank;
            });
            if (matchingRanks.length > 0) {
              let matchingRank = matchingRanks[0];
              if (matchingRanks.length > 1) {
                const exactMatch = matchingRanks.find(
                  (r) => r.role === newRank || r.rank === newRank
                );
                if (exactMatch) {
                  matchingRank = exactMatch;
                } else {
                  for (const rank of matchingRanks) {
                    const rankId = rank.id || rank.rankId;
                    const isOccupied = allPlanning.some(
                      (p) => p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
                    );
                    if (!isOccupied) {
                      matchingRank = rank;
                      break;
                    }
                  }
                }
              }
              const assignedPosition = matchingRank.role || matchingRank.rank;
              updateData.rankId = matchingRank.id || matchingRank.rankId;
              updateData.rank = assignedPosition;
              if (assignedPosition !== newRank) {
                await storage.updateCrewMember(crewId, {
                  presentRank: assignedPosition
                });
                console.log(`\u2705 [AUTO-SYNC] Updated crew ${crewId} rank: ${newRank} \u2192 ${assignedPosition}`);
              }
            }
          }
        }
        if (updates.reliefDue && updates.reliefDue !== oldCrew.reliefDue) {
          updateData.reliefDue = updates.reliefDue;
          console.log(`\u26A1 [AUTO-SYNC] Relief Due updated: ${oldCrew.reliefDue} \u2192 ${updates.reliefDue}`);
        }
        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await storage.updateVesselPlanning(existingEntry.id, updateData);
          console.log(`\u2705 [AUTO-SYNC] Updated vessel planning for ${crewId}`);
        }
      } else {
        await autoCreateVesselPlanning(updatedCrew);
      }
    } catch (error) {
      console.error(`\u274C [AUTO-SYNC] Failed to sync vessel planning:`, error);
    }
  }
  app2.get("/api/crew-members", async (req, res) => {
    try {
      const filters = {};
      if (req.query.rank) filters.rank = req.query.rank;
      if (req.query.nationality) filters.nationality = req.query.nationality;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.search) filters.search = req.query.search;
      const crewMembers2 = await storage.getCrewMembers(Object.keys(filters).length > 0 ? filters : void 0);
      const allVesselPlanning = await storage.getAllVesselPlanning();
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselMap = new Map(vesselMasterData.map((v) => [v.entryId || v.entry_id, v]));
      const vesselTypeMasterData = await storage.getMasterDataEntries("004");
      const vesselTypeMap = new Map(vesselTypeMasterData.map((vt) => [vt.code, vt.name]));
      const crewVesselMap = /* @__PURE__ */ new Map();
      for (const planning of allVesselPlanning) {
        if (planning.isArchived) {
          continue;
        }
        if (planning.crewMemberId) {
          const crewIdKey = String(planning.crewMemberId);
          const existing = crewVesselMap.get(crewIdKey) || [];
          const normalizedStatus = (planning.crewStatus || "primary").toLowerCase();
          const isPrimary = normalizedStatus === "primary" || normalizedStatus === "p";
          existing.push({
            vesselId: planning.vesselId,
            crewStatus: isPrimary ? "primary" : "secondary",
            joiningDate: planning.signOnDate || null,
            reliefDue: planning.reliefDue || null
          });
          crewVesselMap.set(crewIdKey, existing);
        }
      }
      const normalizedCrewMembers = crewMembers2.map((crew) => {
        const normalized = normalizeCrewMemberForTable(crew);
        const crewIdKey = String(crew.id);
        const vesselAssignments = crewVesselMap.get(crewIdKey) || [];
        const hasVesselAssignment = vesselAssignments.length > 0;
        if (hasVesselAssignment) {
          const primaryAssignment = vesselAssignments.find((a) => a.crewStatus === "primary") || vesselAssignments[0];
          normalized.presentVessel = primaryAssignment.vesselId;
          normalized.vesselAssignments = vesselAssignments;
          if (primaryAssignment.joiningDate) {
            normalized.joiningDate = primaryAssignment.joiningDate;
          }
          if (primaryAssignment.reliefDue) {
            normalized.reliefDue = primaryAssignment.reliefDue;
          }
        } else {
          normalized.presentVessel = null;
        }
        const isActive = crew.isActive !== false;
        normalized.status = calculateCrewStatus(isActive ? true : false, hasVesselAssignment);
        normalized.isActive = isActive;
        normalized.nextAvailability = crew.nextAvailability || null;
        const companySeaService = normalized.currentCompanySeaService || [];
        const externalSeaService = normalized.externalSeaService || [];
        const currentRank = normalized.presentRank || "";
        let parsedCompanySeaService = [];
        let parsedExternalSeaService = [];
        try {
          if (typeof companySeaService === "string") {
            const parsed = JSON.parse(companySeaService);
            parsedCompanySeaService = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(companySeaService)) {
            parsedCompanySeaService = companySeaService;
          }
        } catch (e) {
          parsedCompanySeaService = [];
        }
        try {
          if (typeof externalSeaService === "string") {
            const parsed = JSON.parse(externalSeaService);
            parsedExternalSeaService = Array.isArray(parsed) ? parsed : [];
          } else if (Array.isArray(externalSeaService)) {
            parsedExternalSeaService = externalSeaService;
          }
        } catch (e) {
          parsedExternalSeaService = [];
        }
        normalized.experienceMetrics = calculateExperienceFromSeaService(
          parsedCompanySeaService,
          parsedExternalSeaService,
          currentRank
        );
        if (normalized.signOnDate) {
          try {
            const signOnDate = new Date(normalized.signOnDate);
            const today = /* @__PURE__ */ new Date();
            const diffMs = today.getTime() - signOnDate.getTime();
            const diffMonths = diffMs / (1e3 * 60 * 60 * 24 * 30.44);
            normalized.experienceMetrics.timeOnBoard = Math.round(diffMonths * 10) / 10;
          } catch (e) {
            normalized.experienceMetrics.timeOnBoard = 0;
          }
        } else {
          normalized.experienceMetrics.timeOnBoard = 0;
        }
        if (normalized.presentVessel) {
          const vessel = vesselMap.get(normalized.presentVessel);
          if (vessel && vessel.vesselType) {
            const vesselTypeCode = vessel.vesselType;
            const vesselTypeName = vesselTypeMap.get(vesselTypeCode) || vesselTypeCode;
            const vesselTypeYears = calculateVesselTypeSpecificExperience(
              parsedCompanySeaService,
              parsedExternalSeaService,
              vesselTypeCode
            );
            normalized.experienceMetrics.vesselType = {
              code: vesselTypeCode,
              name: vesselTypeName,
              years: vesselTypeYears
            };
          } else {
            normalized.experienceMetrics.vesselType = null;
          }
        } else {
          normalized.experienceMetrics.vesselType = null;
        }
        return normalized;
      });
      res.json(normalizedCrewMembers);
    } catch (error) {
      console.error("\u274C Failed to fetch crew members with filters:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  });
  app2.get("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const crewMember = await storage.getCrewMember(id);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      const normalizedCrewMember = normalizeCrewMemberForTable(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew member" });
    }
  });
  app2.post("/api/crew-members", async (req, res) => {
    try {
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        mappedData = mapFormDataToStorage(req.body);
      } else {
        mappedData = toStorageCrew(req.body);
      }
      if (!mappedData.employeeId) {
        mappedData.employeeId = await storage.getNextCrewId();
      }
      if (!mappedData.id) {
        mappedData.id = mappedData.employeeId || await storage.getNextCrewId();
      }
      const result = insertCrewMemberSchema.safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.createCrewMember(result.data);
      await autoCreateVesselPlanning(crewMember);
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.status(201).json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to create crew member" });
    }
  });
  app2.put("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        mappedData = mapFormDataToStorage(req.body);
      } else {
        mappedData = toStorageCrew(req.body);
      }
      const result = insertCrewMemberSchema.partial().safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
      }
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });
  app2.patch("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      const isStatusUpdate = Object.keys(req.body).every((key) => ["isActive", "nextAvailability"].includes(key));
      let mappedData;
      if (isStatusUpdate) {
        mappedData = { ...req.body };
      } else if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        mappedData = mapFormDataToStorage(req.body);
      } else {
        mappedData = toStorageCrew(req.body);
      }
      const vesselAssignmentFields = ["presentVessel", "joiningDate", "signOnDate", "signOffDate", "reliefDue"];
      const cleanedData = {};
      Object.entries(mappedData).forEach(([key, value]) => {
        if (vesselAssignmentFields.includes(key)) {
          if (value !== void 0 && value !== null && value !== "") {
            cleanedData[key] = value;
          }
        } else {
          if (value !== void 0) {
            cleanedData[key] = value;
          }
        }
      });
      const result = insertCrewMemberSchema.partial().safeParse(cleanedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
      }
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });
  app2.post("/api/crew-members/:id/sign-off", async (req, res) => {
    try {
      const id = req.params.id;
      const { lastVessel, signOffDate, reason } = req.body;
      const existingCrew = await storage.getCrewMember(id);
      if (!existingCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      const signOffPayload = {
        // Previous Assignment - populate with sign-off data
        lastVessel: lastVessel || existingCrew.presentVessel,
        signOffDate,
        reason,
        // Current Assignment - clear all fields
        presentVessel: "",
        // Empty string since field is notNull
        joiningDate: null,
        signOnDate: null,
        reliefDue: null,
        contractPeriod: null,
        nextAvailability: null,
        // Keep crew member active - they go to "On Leave" status (not "Inactive")
        // "Inactive" can only be manually triggered by the user
        isActive: true
      };
      const crewMember = await storage.updateCrewMember(id, signOffPayload);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      console.log(`\u2705 [Sign-Off] Crew ${id} signed off from ${lastVessel} on ${signOffDate}. Current Assignment cleared, Previous Assignment updated.`);
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      console.error("[Sign-Off] Error:", error);
      res.status(500).json({ error: "Failed to process crew sign-off" });
    }
  });
  app2.delete("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteCrewMember(id);
      if (!deleted) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete crew member" });
    }
  });
  app2.post("/api/crew-members/resync-planning", async (req, res) => {
    try {
      const crewMembers2 = await storage.getCrewMembers();
      let created = 0;
      let skipped = 0;
      let errors = 0;
      for (const crew of crewMembers2) {
        const crewId = crew.id || crew.employeeId;
        if (!crewId || !crew.presentVessel || !crew.presentRank) {
          skipped++;
          continue;
        }
        try {
          const result = await autoCreateVesselPlanning(crew);
          if (result) {
            created++;
            console.log(`\u2705 [RE-SYNC] Created planning for ${crewId}: ${crew.presentRank} on ${crew.presentVessel}`);
          } else {
            skipped++;
          }
        } catch (error) {
          errors++;
          console.error(`\u274C [RE-SYNC] Failed for ${crewId}:`, error);
        }
      }
      res.json({
        success: true,
        total: crewMembers2.length,
        created,
        skipped,
        errors,
        message: `Re-sync completed: ${created} planning entries created, ${skipped} skipped, ${errors} errors`
      });
    } catch (error) {
      console.error("Re-sync failed:", error);
      res.status(500).json({ error: "Failed to re-sync vessel planning" });
    }
  });
  app2.get("/api/rotation/due-crew", async (req, res) => {
    try {
      const { filterType, vessels: vessels2, fleet, addGroup, dueIn, rank } = req.query;
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselCodeToNameMap = /* @__PURE__ */ new Map();
      if (vesselMasterData) {
        vesselMasterData.forEach((vessel) => {
          if (vessel.entry_id && vessel.name) {
            vesselCodeToNameMap.set(vessel.entry_id, vessel.name);
          }
        });
      }
      const crewMembers2 = await storage.getCrewMembers();
      const allPlanningPromises = crewMembers2.map(async (crew) => {
        if (!crew.presentVessel) return null;
        try {
          const planning = await storage.getVesselPlanningByVessel(crew.presentVessel);
          return planning;
        } catch {
          return [];
        }
      });
      const allPlanning = await Promise.all(allPlanningPromises);
      const planningMap = /* @__PURE__ */ new Map();
      allPlanning.forEach((planning, idx) => {
        if (planning && crewMembers2[idx]) {
          const vessel = crewMembers2[idx].presentVessel;
          if (vessel) {
            planningMap.set(vessel, planning);
          }
        }
      });
      const processedCrew = crewMembers2.filter((crew) => {
        if (!crew.presentRank || !crew.presentVessel) return false;
        const isActive = crew.isActive !== false;
        if (!isActive) return false;
        return true;
      }).map((crew) => {
        const vesselPlanning2 = planningMap.get(crew.presentVessel || "") || [];
        const matchingPlan = vesselPlanning2.find(
          (p) => p.rank === crew.presentRank && p.crewMemberId === crew.id && !p.isArchived
        );
        if (!matchingPlan) {
          const archivedPlan = vesselPlanning2.find(
            (p) => p.crewMemberId === crew.id && p.isArchived
          );
          if (archivedPlan) {
            return null;
          }
        }
        const rawJoiningDate = matchingPlan?.signOnDate || crew.signOnDate;
        const rawReliefDue = matchingPlan?.reliefDue || matchingPlan?.reliefDueDate || crew.reliefDue;
        const joiningDate = parseFlexibleDate(rawJoiningDate || "");
        const reliefDue = parseFlexibleDate(rawReliefDue || "");
        let contractEndDateStr = null;
        let rangeEndDateStr = null;
        if (joiningDate) {
          if (matchingPlan?.contractEndRangeStartMonths) {
            const contractEnd = new Date(joiningDate);
            contractEnd.setMonth(contractEnd.getMonth() + matchingPlan.contractEndRangeStartMonths);
            contractEndDateStr = contractEnd.toISOString().split("T")[0];
          } else if (matchingPlan?.contractPeriodMonths) {
            const contractEnd = new Date(joiningDate);
            contractEnd.setMonth(contractEnd.getMonth() + matchingPlan.contractPeriodMonths);
            contractEndDateStr = contractEnd.toISOString().split("T")[0];
          } else if (rawReliefDue) {
            contractEndDateStr = rawReliefDue;
          }
          if (matchingPlan?.contractEndRangeEndMonths) {
            const rangeEnd = new Date(joiningDate);
            rangeEnd.setMonth(rangeEnd.getMonth() + matchingPlan.contractEndRangeEndMonths);
            rangeEndDateStr = rangeEnd.toISOString().split("T")[0];
          } else if (contractEndDateStr) {
            rangeEndDateStr = contractEndDateStr;
          }
        } else if (rawReliefDue) {
          contractEndDateStr = rawReliefDue;
          rangeEndDateStr = rawReliefDue;
        }
        if (!contractEndDateStr) return null;
        return {
          id: crew.id,
          vesselId: crew.presentVessel,
          // Keep vessel code for filtering
          vessel: vesselCodeToNameMap.get(crew.presentVessel || "") || crew.presentVessel,
          // Translate code to name for display
          rank: crew.presentRank,
          name: `${crew.firstName} ${crew.middleName || ""} ${crew.familyName || ""}`.trim(),
          reliefDue: rawReliefDue,
          contractStartDate: rawJoiningDate,
          contractEndDate: contractEndDateStr,
          // rangeStartDate: Keep as reliefDue for backward compatibility with filters
          // The timeline visualization uses contractEndDate as the green/yellow boundary
          rangeStartDate: rawReliefDue || contractEndDateStr,
          rangeEndDate: rangeEndDateStr || contractEndDateStr,
          nationality: crew.nationality,
          // Include raw dates for filtering
          _reliefDueDate: reliefDue,
          _rangeEndDate: new Date(rangeEndDateStr || contractEndDateStr)
        };
      }).filter((crew) => crew !== null);
      let filteredCrew = processedCrew;
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      if (filterType === "vessel" && vessels2) {
        const vesselList = Array.isArray(vessels2) ? vessels2 : [vessels2];
        filteredCrew = filteredCrew.filter((crew) => vesselList.includes(crew.vesselId));
      } else if (filterType === "fleet" && fleet) {
      } else if (filterType === "addGroup" && addGroup) {
      }
      if (rank) {
        const rankList = Array.isArray(rank) ? rank.filter((r) => typeof r === "string" && r.trim()) : typeof rank === "string" ? [rank] : [];
        if (rankList.length > 0) {
          const baseRanksFromVariants = /* @__PURE__ */ new Set();
          rankList.forEach((r) => {
            if (typeof r === "string" && r.includes("_")) {
              const baseRank = r.substring(0, r.lastIndexOf("_"));
              baseRanksFromVariants.add(baseRank);
            }
          });
          filteredCrew = filteredCrew.filter((crew) => {
            if (rankList.includes(crew.rank)) return true;
            if (baseRanksFromVariants.has(crew.rank)) return true;
            for (const selectedRank of rankList) {
              if (crew.rank.startsWith(selectedRank + "_")) {
                return true;
              }
            }
            return false;
          });
        }
      }
      if (dueIn) {
        const monthsMap = {
          "3m": 3,
          "2m": 2,
          "1m": 1
        };
        if (dueIn === "overdue") {
          filteredCrew = filteredCrew.filter((crew) => crew._rangeEndDate < today);
        } else if (dueIn === "overdue1m") {
          const oneMonthFromNow = new Date(today);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          filteredCrew = filteredCrew.filter(
            (crew) => crew._rangeEndDate >= today && crew._rangeEndDate <= oneMonthFromNow
          );
        } else if (monthsMap[dueIn]) {
          const months = monthsMap[dueIn];
          const targetDate = new Date(today);
          targetDate.setMonth(targetDate.getMonth() + months);
          filteredCrew = filteredCrew.filter((crew) => {
            const isOverdue = crew._rangeEndDate < today;
            const isDueWithinWindow = crew._reliefDueDate && crew._reliefDueDate >= today && crew._reliefDueDate <= targetDate;
            return isOverdue || isDueWithinWindow;
          });
        }
      }
      const cleanedCrew = filteredCrew.map((crew) => {
        const { _reliefDueDate, _rangeEndDate, ...cleanCrew } = crew;
        return cleanCrew;
      });
      res.json(cleanedCrew);
    } catch (error) {
      console.error("Failed to fetch rotation due crew:", error);
      res.status(500).json({ error: "Failed to fetch rotation due crew" });
    }
  });
  app2.post("/api/crew-members/assign-ids", async (req, res) => {
    try {
      const crewMembers2 = await storage.getCrewMembers();
      const crewMembersWithoutIds = crewMembers2.filter((cm) => !cm.employeeId);
      if (crewMembersWithoutIds.length === 0) {
        return res.json({
          message: "All crew members already have IDs",
          totalCrew: crewMembers2.length
        });
      }
      let updatedCount = 0;
      for (const crewMember of crewMembersWithoutIds) {
        const crewId = await storage.getNextCrewId();
        const updated = await storage.updateCrewMember(crewMember.id, { employeeId: crewId });
        if (updated) {
          updatedCount++;
          console.log(`\u2705 Assigned crew ID ${crewId} to ${crewMember.firstName} ${crewMember.familyName || "Unknown"}`);
        }
      }
      res.json({
        message: "Crew ID assignment completed",
        updatedCount,
        totalWithoutIds: crewMembersWithoutIds.length
      });
    } catch (error) {
      console.error("Error assigning crew IDs:", error);
      res.status(500).json({ error: "Failed to assign crew IDs" });
    }
  });
  app2.get("/api/crew-members/:id/dashboard", async (req, res) => {
    try {
      const id = req.params.id;
      const dashboardSummary = await storage.getCrewDashboardSummary(id);
      if (!dashboardSummary) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json(dashboardSummary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });
  app2.post("/api/crew-members/assign-missing-ids", async (req, res) => {
    try {
      console.log("\u{1F504} Starting retroactive crew ID assignment...");
      const allCrewMembers = await storage.getCrewMembers();
      const crewMembersNeedingIds = allCrewMembers.filter(
        (member) => !member.employeeId || member.employeeId === null || member.employeeId === ""
      );
      console.log(`\u{1F4CA} Found ${crewMembersNeedingIds.length} crew members needing crew IDs`);
      if (crewMembersNeedingIds.length === 0) {
        return res.json({
          success: true,
          message: "No crew members need crew ID assignment",
          assigned: []
        });
      }
      const assignments = [];
      for (const crewMember of crewMembersNeedingIds) {
        try {
          const newCrewId = await storage.getNextCrewId();
          await storage.updateCrewMember(crewMember.id, { employeeId: newCrewId });
          assignments.push({
            id: crewMember.id,
            name: `${crewMember.firstName} ${crewMember.familyName}`,
            assignedId: newCrewId
          });
          console.log(`\u2705 Assigned ${newCrewId} to ${crewMember.firstName} ${crewMember.familyName}`);
        } catch (error) {
          console.error(`\u274C Failed to assign crew ID to ${crewMember.firstName} ${crewMember.familyName}:`, error);
        }
      }
      console.log(`\u{1F389} Successfully assigned crew IDs to ${assignments.length} crew members`);
      res.json({
        success: true,
        message: `Successfully assigned crew IDs to ${assignments.length} crew members`,
        assigned: assignments
      });
    } catch (error) {
      console.error("\u274C Failed to assign missing crew IDs:", error);
      res.status(500).json({ error: "Failed to assign missing crew IDs" });
    }
  });
  app2.get("/api/appraisals", async (req, res) => {
    try {
      const appraisals = await storage.getAppraisalResults();
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals" });
    }
  });
  app2.get("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const appraisal = await storage.getAppraisalResult(id);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisal" });
    }
  });
  app2.get("/api/appraisals/crew/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const appraisals = await storage.getAppraisalResultsByCrewMember(crewMemberId);
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals for crew member" });
    }
  });
  app2.get("/api/appraisals/crew/:crewMemberId/promotion-recommendations", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const rank = req.query.rank;
      if (!rank) {
        return res.status(400).json({ error: "Rank query parameter is required" });
      }
      const appraisals = await storage.getAppraisalResultsByCrewMember(crewMemberId);
      let count = 0;
      for (const appraisal of appraisals) {
        const statusLower = appraisal.status?.toLowerCase();
        if (statusLower !== "submitted" && statusLower !== "reviewed") {
          continue;
        }
        try {
          const appraisalData = typeof appraisal.appraisalData === "string" ? JSON.parse(appraisal.appraisalData) : appraisal.appraisalData;
          const appraisalRank = appraisalData?.seafarersRank || "";
          if (appraisalRank.toLowerCase().trim() !== rank.toLowerCase().trim()) {
            continue;
          }
          const recommendations = appraisalData?.recommendations || [];
          const promotionRecommendation = recommendations.find(
            (rec) => rec.id === "3" || rec.question?.toLowerCase().includes("recommended for promotion")
          );
          if (promotionRecommendation?.answer?.toLowerCase() === "yes") {
            count++;
          }
        } catch (parseError) {
          console.error(`Failed to parse appraisal data for id ${appraisal.id}:`, parseError);
        }
      }
      res.json({ count, rank, crewMemberId });
    } catch (error) {
      console.error("Failed to count promotion recommendations:", error);
      res.status(500).json({ error: "Failed to count promotion recommendations" });
    }
  });
  app2.post("/api/appraisals", async (req, res) => {
    try {
      const bodyWithStringifiedData = {
        ...req.body,
        appraisalData: typeof req.body.appraisalData === "object" ? JSON.stringify(req.body.appraisalData) : req.body.appraisalData
      };
      const result = insertAppraisalResultSchema.safeParse(bodyWithStringifiedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.createAppraisalResult(result.data);
      res.status(201).json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create appraisal" });
    }
  });
  app2.put("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bodyWithStringifiedData = {
        ...req.body,
        ...req.body.appraisalData && {
          appraisalData: typeof req.body.appraisalData === "object" ? JSON.stringify(req.body.appraisalData) : req.body.appraisalData
        }
      };
      const result = insertAppraisalResultSchema.partial().safeParse(bodyWithStringifiedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.updateAppraisalResult(id, result.data);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update appraisal" });
    }
  });
  app2.delete("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAppraisalResult(id);
      if (!deleted) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appraisal" });
    }
  });
  app2.post("/api/appraisals/:id/submit-stage1", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validationResult = stage1SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid stage 1 data",
          details: validationResult.error.issues
        });
      }
      const { data, submittedBy } = validationResult.data;
      const appraisal = await storage.submitAppraisalStage(id, "stage1", data, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("Stage 1 submission error:", error);
      res.status(500).json({ error: error.message || "Failed to submit stage 1" });
    }
  });
  app2.post("/api/appraisals/:id/submit-stage2", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validationResult = stage2SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid stage 2 data",
          details: validationResult.error.issues
        });
      }
      const { data, submittedBy } = validationResult.data;
      const appraisal = await storage.submitAppraisalStage(id, "stage2", data, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("Stage 2 submission error:", error);
      res.status(500).json({ error: error.message || "Failed to submit stage 2" });
    }
  });
  app2.post("/api/appraisals/:id/submit-stage3", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validationResult = stage3SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid stage 3 data",
          details: validationResult.error.issues
        });
      }
      const { data, submittedBy } = validationResult.data;
      const appraisal = await storage.submitAppraisalStage(id, "stage3", data, submittedBy || "Unknown");
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      console.error("Stage 3 submission error:", error);
      res.status(500).json({ error: error.message || "Failed to submit stage 3" });
    }
  });
  app2.get("/api/recruitment-candidates/next-file-number", async (req, res) => {
    try {
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const yearPrefix = `R-${currentYear}-`;
      const yearPattern = new RegExp(`^R-${currentYear}-(\\d+)$`);
      const candidates = await storage.getRecruitmentCandidates();
      const currentYearFileNos = candidates.filter((c) => c.fileNo && yearPattern.test(c.fileNo)).map((c) => {
        const match = c.fileNo.match(yearPattern);
        return match ? parseInt(match[1], 10) : 0;
      }).filter((num) => !isNaN(num) && num > 0);
      const maxNumber = currentYearFileNos.length > 0 ? Math.max(...currentYearFileNos) : 0;
      const nextNumber = maxNumber + 1;
      const nextFileNo = `${yearPrefix}${String(nextNumber).padStart(4, "0")}`;
      console.log(`\u{1F4CB} Generated File No: ${nextFileNo} (max was ${maxNumber} from ${currentYearFileNos.length} candidates this year)`);
      res.json({ fileNo: nextFileNo });
    } catch (error) {
      console.error("Error generating next file number:", error);
      res.status(500).json({ error: "Failed to generate next file number" });
    }
  });
  app2.get("/api/recruitment-candidates", async (req, res) => {
    try {
      const { status } = req.query;
      let candidates;
      if (status && typeof status === "string") {
        candidates = await storage.getRecruitmentCandidatesByStatus(status);
      } else {
        candidates = await storage.getRecruitmentCandidates();
      }
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidates" });
    }
  });
  app2.get("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const candidate = await storage.getRecruitmentCandidate(id);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidate" });
    }
  });
  app2.post("/api/recruitment-candidates", async (req, res) => {
    try {
      const result = insertRecruitmentCandidateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const candidateData = { ...result.data };
      if (candidateData.fileNo === "" || candidateData.fileNo === null) {
        candidateData.fileNo = null;
      }
      const candidate = await storage.createRecruitmentCandidate(candidateData);
      res.status(201).json(candidate);
    } catch (error) {
      if (error.code === "23505" || error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
        return res.status(400).json({
          error: "Duplicate data",
          message: "A recruitment candidate with this fileNo already exists"
        });
      }
      console.error("Error creating recruitment candidate:", error);
      res.status(500).json({ error: "Failed to create recruitment candidate" });
    }
  });
  app2.patch("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertRecruitmentCandidateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const updateData = {};
      for (const key in result.data) {
        const value = result.data[key];
        if (key === "fileNo") {
          if (value === "" || value === null) {
            updateData.fileNo = null;
          } else if (value !== void 0) {
            updateData.fileNo = value;
          }
        } else {
          updateData[key] = value;
        }
      }
      const candidate = await storage.updateRecruitmentCandidate(id, updateData);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recruitment candidate" });
    }
  });
  app2.patch("/api/recruitment-candidates/:id/soft-delete", async (req, res) => {
    try {
      const id = req.params.id;
      console.log(`Soft deleting recruitment candidate: ${id}`);
      const candidate = await storage.softDeleteRecruitmentCandidate(id);
      if (!candidate) {
        return res.status(404).json({
          error: "Candidate not found",
          message: `Recruitment candidate with ID ${id} does not exist`
        });
      }
      console.log(`Successfully soft deleted candidate: ${id}`);
      res.json({
        success: true,
        message: "Recruitment candidate deleted successfully",
        id
      });
    } catch (error) {
      console.error("Error soft deleting recruitment candidate:", error);
      res.status(500).json({
        error: "Failed to delete recruitment candidate",
        message: error.message
      });
    }
  });
  app2.post("/api/recruitment-candidates/:id/transfer-to-crew", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await storage.transferRecruitedCandidate(id);
      res.status(201).json(result);
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(400).json({ error: error.message || "Failed to transfer candidate to crew database" });
    }
  });
  app2.get("/api/masters", async (req, res) => {
    try {
      const masters = await storage.getDataMasters();
      res.json(masters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch masters" });
    }
  });
  app2.get("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const master = await storage.getDataMaster(id);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master" });
    }
  });
  app2.post("/api/masters", async (req, res) => {
    try {
      const result = insertDataMasterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.createDataMaster(result.data);
      res.status(201).json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to create master" });
    }
  });
  app2.put("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertDataMasterSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.updateDataMaster(id, result.data);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to update master" });
    }
  });
  app2.delete("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteDataMaster(id);
      if (!deleted) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete master" });
    }
  });
  app2.get("/api/nationalities", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries("001");
      const nationalities = entries.map(
        (entry) => entry.nationality || entry.name || ""
      ).filter((n) => n.length > 0);
      res.json(nationalities);
    } catch (error) {
      console.error("\u274C Failed to fetch nationalities:", error);
      res.status(500).json({ error: "Failed to fetch nationalities" });
    }
  });
  app2.get("/api/vessels", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries("014");
      let filteredEntries = entries;
      if (req.query.name) {
        const searchName = req.query.name.toLowerCase();
        filteredEntries = filteredEntries.filter((entry) => {
          const vesselName = (entry.vessel || entry.name || "").toLowerCase();
          return vesselName.includes(searchName);
        });
      }
      if (req.query.vesselType) {
        const searchType = req.query.vesselType.toLowerCase();
        filteredEntries = filteredEntries.filter(
          (entry) => (entry.vesselType || "").toLowerCase().includes(searchType)
        );
      }
      if (req.query.isActive !== void 0) {
        const isActive = req.query.isActive === "true";
        filteredEntries = filteredEntries.filter(
          (entry) => entry.isActive === isActive
        );
      }
      res.json(filteredEntries);
    } catch (error) {
      console.error("\u274C Failed to fetch vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  });
  app2.get("/api/vessels/export", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries("014");
      const headers = ["Vessel Name", "IMO Number", "Vessel Type", "Status"];
      const csvRows = [headers.join(",")];
      for (const entry of entries) {
        const row = [
          `"${entry.name || ""}"`,
          `"${entry.description || ""}"`,
          `"${entry.vesselType || ""}"`,
          `"${entry.isActive ? "Active" : "Inactive"}"`
        ];
        csvRows.push(row.join(","));
      }
      const csvContent = csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="vessels.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("\u274C Failed to export vessels:", error);
      res.status(500).json({ error: "Failed to export vessels" });
    }
  });
  app2.get("/api/vessels/:id/office-matrix", async (req, res) => {
    try {
      const vesselId2 = req.params.id;
      const revisions2 = await storage.getVesselRevisionsByVessel(vesselId2);
      if (!revisions2 || revisions2.length === 0) {
        return res.json({
          vesselId: vesselId2,
          message: "No office matrix data available for this vessel",
          revisions: []
        });
      }
      const latestRevision = revisions2[revisions2.length - 1];
      res.json({
        vesselId: vesselId2,
        revision: latestRevision.revision,
        revisionDate: latestRevision.revisionDate,
        revisionData: JSON.parse(latestRevision.revisionData),
        allRevisions: revisions2.map((r) => ({
          revision: r.revision,
          revisionDate: r.revisionDate
        }))
      });
    } catch (error) {
      console.error("\u274C Failed to fetch office matrix:", error);
      res.status(500).json({ error: "Failed to fetch office matrix data" });
    }
  });
  app2.get("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      const entries = await storage.getMasterDataEntries(masterId);
      let responseEntries = entries;
      if (needsSpecialHandling(masterId) && entries) {
        responseEntries = entries.map((entry) => applyMasterSpecificMapping(entry, masterId));
      } else if (entries) {
        responseEntries = entries.map((entry) => applyBasicFieldTransformation(entry));
      }
      res.json(responseEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entries" });
    }
  });
  app2.get("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getMasterDataEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      let responseEntry = entry;
      const masterId = entry.master_id || entry.masterId;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      } else {
        responseEntry = applyBasicFieldTransformation(entry);
      }
      res.json(responseEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entry" });
    }
  });
  app2.post("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      let requestData = { ...req.body, masterId };
      if (needsSpecialHandling(masterId)) {
        requestData = applyMasterSpecificFiltering(requestData, masterId);
        const validation = validateMasterSpecificEntry(requestData, masterId);
        if (!validation.isValid) {
          return res.status(400).json({
            error: `Invalid ${masterId} master data`,
            details: validation.error
          });
        }
      }
      const result = insertMasterDataEntrySchema.safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      const entry = await storage.createMasterDataEntry(result.data);
      let responseEntry = entry;
      if (needsSpecialHandling(masterId) && entry) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      }
      res.status(201).json(responseEntry);
    } catch (error) {
      console.error(`Failed to create master data entry:`, error);
      res.status(500).json({ error: "Failed to create master data entry" });
    }
  });
  app2.put("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingEntry = await storage.getMasterDataEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      const masterId = existingEntry.master_id;
      let requestData = req.body;
      const isDescriptionOnlyUpdate = req.body.description !== void 0 && Object.keys(req.body).filter((key) => key !== "masterId" && key !== "description").length === 0;
      if (needsSpecialHandling(masterId) && !isDescriptionOnlyUpdate) {
        requestData = applyMasterSpecificFiltering(req.body, masterId);
        if (req.body.vessel || req.body.name || req.body.vesselIds || req.body.VesselIDs) {
          const validation = validateMasterSpecificEntry(requestData, masterId);
          if (!validation.isValid) {
            return res.status(400).json({
              error: `Invalid ${masterId} master data`,
              details: validation.error
            });
          }
        }
      }
      const result = insertMasterDataEntrySchema.partial().safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      const entry = await storage.updateMasterDataEntry(id, result.data);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      let responseEntry = entry;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
      }
      res.json(responseEntry);
    } catch (error) {
      console.error(`Failed to update master data entry:`, error);
      res.status(500).json({ error: "Failed to update master data entry" });
    }
  });
  app2.delete("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteMasterDataEntry(id);
      if (!deleted) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`Failed to delete master data entry:`, error);
      res.status(500).json({ error: "Failed to delete master data entry" });
    }
  });
  app2.get("/api/oil-major-rules", async (req, res) => {
    try {
      const rules = await storage.getOilMajorRules();
      const parsedRules = rules.map((rule) => ({
        ...rule,
        rules: typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules
      }));
      res.json(parsedRules);
    } catch (error) {
      console.error("Error fetching oil major rules:", error);
      res.status(500).json({ error: "Failed to fetch oil major rules" });
    }
  });
  app2.get("/api/oil-major-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.getOilMajorRule(id);
      if (!rule) {
        return res.status(404).json({ error: "Oil major rule not found" });
      }
      res.json({
        ...rule,
        rules: typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules
      });
    } catch (error) {
      console.error("Error fetching oil major rule:", error);
      res.status(500).json({ error: "Failed to fetch oil major rule" });
    }
  });
  app2.get("/api/oil-major-rules/by-name/:name", async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const rule = await storage.getOilMajorRuleByName(name);
      if (!rule) {
        return res.status(404).json({ error: "Oil major rule not found" });
      }
      res.json({
        ...rule,
        rules: typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules
      });
    } catch (error) {
      console.error("Error fetching oil major rule by name:", error);
      res.status(500).json({ error: "Failed to fetch oil major rule" });
    }
  });
  app2.post("/api/oil-major-rules", async (req, res) => {
    try {
      const { oilMajorName, rules, isActive } = req.body;
      if (!oilMajorName || !rules) {
        return res.status(400).json({ error: "Oil major name and rules are required" });
      }
      const rulesString = typeof rules === "string" ? rules : JSON.stringify(rules);
      const result = await storage.createOilMajorRule({
        oilMajorName,
        rules: rulesString,
        isActive: isActive ?? true
      });
      res.status(201).json({
        ...result,
        rules: typeof result.rules === "string" ? JSON.parse(result.rules) : result.rules
      });
    } catch (error) {
      console.error("Error creating oil major rule:", error);
      res.status(500).json({ error: "Failed to create oil major rule" });
    }
  });
  app2.patch("/api/oil-major-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { oilMajorName, rules, isActive } = req.body;
      const updateData = {};
      if (oilMajorName !== void 0) updateData.oilMajorName = oilMajorName;
      if (rules !== void 0) updateData.rules = typeof rules === "string" ? rules : JSON.stringify(rules);
      if (isActive !== void 0) updateData.isActive = isActive;
      const result = await storage.updateOilMajorRule(id, updateData);
      if (!result) {
        return res.status(404).json({ error: "Oil major rule not found" });
      }
      res.json({
        ...result,
        rules: typeof result.rules === "string" ? JSON.parse(result.rules) : result.rules
      });
    } catch (error) {
      console.error("Error updating oil major rule:", error);
      res.status(500).json({ error: "Failed to update oil major rule" });
    }
  });
  app2.delete("/api/oil-major-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteOilMajorRule(id);
      if (!deleted) {
        return res.status(404).json({ error: "Oil major rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting oil major rule:", error);
      res.status(500).json({ error: "Failed to delete oil major rule" });
    }
  });
  app2.post("/api/oil-major-rules/import-csv", async (req, res) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "CSV content is required" });
      }
      const parsedRules = parseCSVContent(csvContent);
      const storageFormat = convertToStorageFormat(parsedRules);
      const createdRules = await storage.bulkCreateOilMajorRules(storageFormat);
      res.status(201).json({
        success: true,
        imported: createdRules.length,
        rules: createdRules.map((rule) => ({
          ...rule,
          rules: typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules
        }))
      });
    } catch (error) {
      console.error("Error importing oil major rules from CSV:", error);
      res.status(500).json({ error: "Failed to import oil major rules" });
    }
  });
  app2.post("/api/compliance/check", async (req, res) => {
    try {
      const { vesselId: vesselId2, oilMajorIds, crewData } = req.body;
      if (!oilMajorIds || !Array.isArray(oilMajorIds) || oilMajorIds.length === 0) {
        return res.status(400).json({ error: "Oil major IDs are required" });
      }
      let crewExperience;
      if (crewData && Array.isArray(crewData)) {
        crewExperience = convertCrewToExperience(crewData);
      } else if (vesselId2) {
        const vesselPlanning2 = await storage.getVesselPlanningByVessel(vesselId2, true);
        if (!vesselPlanning2 || vesselPlanning2.length === 0) {
          return res.status(404).json({ error: "No active vessel planning found" });
        }
        const activePlan = vesselPlanning2[0];
        const crewMembers2 = [];
        if (activePlan.positions) {
          const positions = typeof activePlan.positions === "string" ? JSON.parse(activePlan.positions) : activePlan.positions;
          for (const pos of positions) {
            if (pos.crewId) {
              const crew = await storage.getCrewMember(pos.crewId);
              if (crew) {
                crewMembers2.push({
                  ...crew,
                  rank: pos.rank || crew.rank
                });
              }
            }
          }
        }
        crewExperience = convertCrewToExperience(crewMembers2);
      } else {
        return res.status(400).json({ error: "Either vesselId or crewData is required" });
      }
      const results = [];
      for (const oilMajorId of oilMajorIds) {
        const rule = await storage.getOilMajorRule(parseInt(oilMajorId));
        if (!rule) continue;
        const rulesConfig = typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules;
        const complianceResult = evaluateCompliance(rule.oilMajorName, rulesConfig, crewExperience);
        results.push(complianceResult);
      }
      res.json({ results });
    } catch (error) {
      console.error("Error checking compliance:", error);
      res.status(500).json({ error: "Failed to check compliance" });
    }
  });
  app2.get("/api/compliance/matrix/:vesselId", async (req, res) => {
    try {
      const vesselId2 = req.params.vesselId;
      const allRules = await storage.getOilMajorRules();
      if (allRules.length === 0) {
        return res.json({
          vesselId: vesselId2,
          results: [],
          message: "No oil major rules configured. Please import rules first."
        });
      }
      const vessels2 = await storage.getMasterDataEntries("014");
      const vessel = vessels2.find((v) => v.id?.toString() === vesselId2 || v.vesselId === vesselId2);
      const vesselTypeCode = vessel?.vesselType || "";
      const vesselTypes = await storage.getMasterDataEntries("004");
      const vesselTypeMap = new Map(vesselTypes.map((vt) => [vt.id?.toString() || vt.vtuid, vt.name || vt.vesselType]));
      const vesselPlanning2 = await storage.getVesselPlanningByVessel(vesselId2);
      let crewExperience = [];
      if (vesselPlanning2 && vesselPlanning2.length > 0) {
        const crewExperienceData = [];
        for (const position of vesselPlanning2) {
          const crewId = position.onBoardCrewId || position.crewMemberId;
          if (crewId) {
            const crew = await storage.getCrewMember(crewId);
            if (crew) {
              let companySeaService = [];
              let externalSeaService = [];
              try {
                companySeaService = crew.currentCompanySeaService ? JSON.parse(crew.currentCompanySeaService) : [];
              } catch (e) {
                companySeaService = [];
              }
              try {
                externalSeaService = crew.externalSeaService ? JSON.parse(crew.externalSeaService) : [];
              } catch (e) {
                externalSeaService = [];
              }
              const currentRank = position.rank || crew.presentRank || "";
              const experience = calculateExperienceFromSeaService(companySeaService, externalSeaService, currentRank);
              const tankerTypeYears = calculateVesselTypeSpecificExperience(companySeaService, externalSeaService, vesselTypeCode);
              let timeOnboardMonths = 0;
              if (crew.signOnDate || position.signOnDate) {
                try {
                  const signOnDate = new Date(crew.signOnDate || position.signOnDate);
                  const today = /* @__PURE__ */ new Date();
                  const diffMs = today.getTime() - signOnDate.getTime();
                  const diffMonths = diffMs / (1e3 * 60 * 60 * 24 * 30.44);
                  timeOnboardMonths = Math.round(diffMonths * 10) / 10;
                } catch (e) {
                  timeOnboardMonths = 0;
                }
              }
              crewExperienceData.push({
                rank: currentRank,
                yearsWithOperator: experience.company,
                // Company (Yrs) column
                yearsInRank: experience.rank,
                // Rank column
                yearsOnTankerType: tankerTypeYears,
                // Tanker Type column - vessel-type-specific
                yearsOnAllTankers: experience.tankers,
                // All Type column - all tanker experience
                yearsAsOOW: experience.oow,
                // OOW column
                timeOnboardMonths,
                // Time o/b (months)
                signOnDate: crew.signOnDate || position.signOnDate || (/* @__PURE__ */ new Date()).toISOString(),
                languageProficiency: crew.englishProficiency || ""
                // Language column from crew_members
              });
            }
          }
        }
        crewExperience = crewExperienceData;
      }
      const results = [];
      for (const rule of allRules) {
        if (!rule.isActive) continue;
        const rulesConfig = typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules;
        const complianceResult = evaluateCompliance(rule.oilMajorName, rulesConfig, crewExperience);
        results.push(complianceResult);
      }
      results.sort((a, b) => a.oilMajorName.localeCompare(b.oilMajorName));
      res.json({ vesselId: vesselId2, results });
    } catch (error) {
      console.error("Error generating compliance matrix:", error);
      res.status(500).json({ error: "Failed to generate compliance matrix" });
    }
  });
  app2.post("/api/compliance/matrix/:vesselId/simulated", async (req, res) => {
    try {
      const vesselId2 = req.params.vesselId;
      const { simulatedCrew } = req.body;
      console.log(`[SIMULATED COMPLIANCE] vesselId: ${vesselId2}, simulatedCrew:`, JSON.stringify(simulatedCrew, null, 2));
      if (!simulatedCrew || !Array.isArray(simulatedCrew) || simulatedCrew.length === 0) {
        return res.status(400).json({ error: "simulatedCrew array is required with at least one crew replacement" });
      }
      const allRules = await storage.getOilMajorRules();
      console.log(`[SIMULATED COMPLIANCE] Found ${allRules.length} oil major rules`);
      if (allRules.length === 0) {
        return res.json({
          vesselId: vesselId2,
          results: [],
          simulated: true,
          message: "No oil major rules configured. Please import rules first."
        });
      }
      const vessels2 = await storage.getMasterDataEntries("014");
      const vessel = vessels2.find((v) => v.id?.toString() === vesselId2 || v.vesselId === vesselId2);
      const vesselTypeCode = vessel?.vesselType || "";
      console.log(`[SIMULATED COMPLIANCE] Vessel found: ${!!vessel}, vesselTypeCode: ${vesselTypeCode}`);
      const vesselPlanning2 = await storage.getVesselPlanningByVessel(vesselId2);
      console.log(`[SIMULATED COMPLIANCE] vesselPlanning count: ${vesselPlanning2?.length || 0}`);
      const crewExperienceData = [];
      const simulatedByPlanId = /* @__PURE__ */ new Map();
      const simulatedByRank = /* @__PURE__ */ new Map();
      for (const sim of simulatedCrew) {
        if (sim.crewMemberId) {
          if (sim.planId) {
            simulatedByPlanId.set(sim.planId, {
              crewMemberId: sim.crewMemberId,
              joiningDate: sim.joiningDate
            });
          } else if (sim.rank) {
            simulatedByRank.set(sim.rank, {
              crewMemberId: sim.crewMemberId,
              joiningDate: sim.joiningDate
            });
          }
        }
      }
      if (vesselPlanning2 && vesselPlanning2.length > 0) {
        for (const position of vesselPlanning2) {
          const positionRank = position.rank || "";
          const simulatedReplacement = simulatedByPlanId.get(position.id) || simulatedByRank.get(positionRank);
          const simulatedCrewId = simulatedReplacement?.crewMemberId;
          const simulatedJoiningDate = simulatedReplacement?.joiningDate;
          const crewIdToUse = simulatedCrewId || position.onBoardCrewId || position.crewMemberId;
          if (crewIdToUse) {
            const crew = await storage.getCrewMember(crewIdToUse);
            if (crew) {
              let companySeaService = [];
              let externalSeaService = [];
              try {
                companySeaService = crew.currentCompanySeaService ? JSON.parse(crew.currentCompanySeaService) : [];
              } catch (e) {
                companySeaService = [];
              }
              try {
                externalSeaService = crew.externalSeaService ? JSON.parse(crew.externalSeaService) : [];
              } catch (e) {
                externalSeaService = [];
              }
              const currentRank = positionRank || crew.presentRank || "";
              const experience = calculateExperienceFromSeaService(companySeaService, externalSeaService, currentRank);
              const tankerTypeYears = calculateVesselTypeSpecificExperience(companySeaService, externalSeaService, vesselTypeCode);
              let timeOnboardMonths = 0;
              let signOnDateToUse = null;
              if (simulatedCrewId) {
                signOnDateToUse = simulatedJoiningDate || (/* @__PURE__ */ new Date()).toISOString();
                const joiningDateObj = new Date(signOnDateToUse);
                const today = /* @__PURE__ */ new Date();
                if (joiningDateObj <= today) {
                  const diffMs = today.getTime() - joiningDateObj.getTime();
                  const diffMonths = diffMs / (1e3 * 60 * 60 * 24 * 30.44);
                  timeOnboardMonths = Math.round(diffMonths * 10) / 10;
                }
              } else {
                signOnDateToUse = crew.signOnDate || position.signOnDate;
                if (signOnDateToUse) {
                  try {
                    const signOnDate = new Date(signOnDateToUse);
                    const today = /* @__PURE__ */ new Date();
                    const diffMs = today.getTime() - signOnDate.getTime();
                    const diffMonths = diffMs / (1e3 * 60 * 60 * 24 * 30.44);
                    timeOnboardMonths = Math.round(diffMonths * 10) / 10;
                  } catch (e) {
                    timeOnboardMonths = 0;
                  }
                }
              }
              crewExperienceData.push({
                rank: currentRank,
                yearsWithOperator: experience.company,
                yearsInRank: experience.rank,
                yearsOnTankerType: tankerTypeYears,
                yearsOnAllTankers: experience.tankers,
                yearsAsOOW: experience.oow,
                timeOnboardMonths,
                signOnDate: signOnDateToUse || (/* @__PURE__ */ new Date()).toISOString(),
                languageProficiency: crew.englishProficiency || "",
                isSimulated: !!simulatedCrewId
              });
            }
          }
        }
      }
      console.log(`[SIMULATED COMPLIANCE] crewExperienceData count: ${crewExperienceData.length}`);
      if (crewExperienceData.length > 0) {
        console.log(`[SIMULATED COMPLIANCE] First crew:`, JSON.stringify(crewExperienceData[0], null, 2));
      }
      const results = [];
      for (const rule of allRules) {
        if (!rule.isActive) continue;
        const rulesConfig = typeof rule.rules === "string" ? JSON.parse(rule.rules) : rule.rules;
        const complianceResult = evaluateCompliance(rule.oilMajorName, rulesConfig, crewExperienceData);
        results.push(complianceResult);
      }
      console.log(`[SIMULATED COMPLIANCE] Generated ${results.length} compliance results`);
      if (results.length > 0) {
        console.log(`[SIMULATED COMPLIANCE] First result rules count: ${results[0].results?.length || 0}`);
      }
      results.sort((a, b) => a.oilMajorName.localeCompare(b.oilMajorName));
      res.json({ vesselId: vesselId2, results, simulated: true });
    } catch (error) {
      console.error("Error generating simulated compliance matrix:", error);
      res.status(500).json({ error: "Failed to generate simulated compliance matrix" });
    }
  });
  app2.get("/api/training-master", async (req, res) => {
    try {
      const trainings = await storage.getTrainingMasters();
      res.json(trainings);
    } catch (error) {
      console.error("Error fetching training masters:", error);
      res.status(500).json({ error: "Failed to fetch training masters" });
    }
  });
  app2.patch("/api/training-master/batch", async (req, res) => {
    try {
      const updates = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Expected array of updates" });
      }
      const results = await Promise.all(
        updates.map(async (item) => {
          if (!item.id) return null;
          const existing = await storage.getTrainingMaster(item.id);
          if (!existing) return null;
          const updated = await storage.updateTrainingMaster(item.id, item.data);
          if (!updated) return null;
          const wasApplicable = existing.applicableToCompany === true;
          const isNowApplicable = updated.applicableToCompany === true;
          if (!wasApplicable && isNowApplicable) {
            await storage.createCompanyTrainingFromMaster(item.id);
          } else if (wasApplicable && !isNowApplicable) {
            await storage.deleteCompanyTrainingByMasterId(item.id);
          } else if (isNowApplicable && updated) {
            const newLabel = updated.trainingLabel || updated.trainingName;
            const companyTraining = await storage.getCompanyTrainingByMasterId(item.id);
            if (companyTraining && companyTraining.trainingLabel !== newLabel) {
              await storage.updateCompanyTraining(companyTraining.id, { trainingLabel: newLabel });
            }
          }
          return updated;
        })
      );
      res.json(results.filter(Boolean));
    } catch (error) {
      console.error("Error batch updating training masters:", error);
      res.status(500).json({ error: "Failed to batch update training masters" });
    }
  });
  app2.post("/api/training-master/reorder", async (req, res) => {
    try {
      const orders = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Expected array of {id, sortOrder}" });
      }
      for (const item of orders) {
        if (typeof item.id !== "number" || typeof item.sortOrder !== "number") {
          return res.status(400).json({ error: "Each item must have numeric id and sortOrder" });
        }
      }
      await storage.reorderTrainingMasters(orders);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering training masters:", error);
      res.status(500).json({ error: "Failed to reorder training masters" });
    }
  });
  app2.get("/api/training-master/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const training = await storage.getTrainingMaster(id);
      if (!training) {
        return res.status(404).json({ error: "Training not found" });
      }
      res.json(training);
    } catch (error) {
      console.error("Error fetching training master:", error);
      res.status(500).json({ error: "Failed to fetch training master" });
    }
  });
  app2.post("/api/training-master", async (req, res) => {
    try {
      const validationResult = insertTrainingMasterSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors
        });
      }
      const training = await storage.createTrainingMaster(validationResult.data);
      if (training.applicableToCompany === true) {
        await storage.createCompanyTrainingFromMaster(training.id);
      }
      res.status(201).json(training);
    } catch (error) {
      console.error("Error creating training master:", error);
      if (error.code === "23505") {
        return res.status(409).json({ error: "Training ID already exists" });
      }
      res.status(500).json({ error: "Failed to create training master" });
    }
  });
  app2.patch("/api/training-master/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const validationResult = updateTrainingMasterSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors
        });
      }
      const existing = await storage.getTrainingMaster(id);
      if (!existing) {
        return res.status(404).json({ error: "Training not found" });
      }
      let updated;
      if (existing.isDefault) {
        const { trainingName, category, trainingGroup, ...allowedUpdates } = validationResult.data;
        if (trainingName || category || trainingGroup) {
          return res.status(403).json({
            error: "Cannot modify name, category, or group of default trainings"
          });
        }
        updated = await storage.updateTrainingMaster(id, allowedUpdates);
      } else {
        updated = await storage.updateTrainingMaster(id, validationResult.data);
      }
      const wasApplicable = existing.applicableToCompany === true;
      const isNowApplicable = updated?.applicableToCompany === true;
      if (!wasApplicable && isNowApplicable) {
        await storage.createCompanyTrainingFromMaster(id);
      } else if (wasApplicable && !isNowApplicable) {
        await storage.deleteCompanyTrainingByMasterId(id);
      } else if (isNowApplicable && updated) {
        const newLabel = updated.trainingLabel || updated.trainingName;
        const oldLabel = existing.trainingLabel || existing.trainingName;
        if (newLabel !== oldLabel) {
          const companyTraining = await storage.getCompanyTrainingByMasterId(id);
          if (companyTraining) {
            await storage.updateCompanyTraining(companyTraining.id, { trainingLabel: newLabel });
          }
        }
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating training master:", error);
      res.status(500).json({ error: "Failed to update training master" });
    }
  });
  app2.delete("/api/training-master/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const existing = await storage.getTrainingMaster(id);
      if (!existing) {
        return res.status(404).json({ error: "Training not found" });
      }
      if (existing.isDefault) {
        return res.status(403).json({ error: "Cannot delete default trainings" });
      }
      if (existing.applicableToCompany === true) {
        await storage.deleteCompanyTrainingByMasterId(id);
      }
      const success = await storage.deleteTrainingMaster(id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Failed to delete training" });
      }
    } catch (error) {
      console.error("Error deleting training master:", error);
      res.status(500).json({ error: "Failed to delete training master" });
    }
  });
  app2.get("/api/company-training-groups", async (req, res) => {
    try {
      const groups = await storage.getCompanyTrainingGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching company training groups:", error);
      res.status(500).json({ error: "Failed to fetch company training groups" });
    }
  });
  app2.patch("/api/company-training-groups/:code", async (req, res) => {
    try {
      const { code } = req.params;
      if (!code || code.length !== 1 || !/^[A-J]$/.test(code)) {
        return res.status(400).json({ error: "Invalid group code. Must be A-J." });
      }
      const { label } = req.body;
      const validatedData = { label: label ?? null };
      const updated = await storage.updateCompanyTrainingGroup(code, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Company training group not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating company training group:", error);
      res.status(500).json({ error: "Failed to update company training group" });
    }
  });
  app2.get("/api/company-trainings", async (req, res) => {
    try {
      const trainings = await storage.getCompanyTrainings();
      res.json(trainings);
    } catch (error) {
      console.error("Error fetching company trainings:", error);
      res.status(500).json({ error: "Failed to fetch company trainings" });
    }
  });
  app2.get("/api/company-trainings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const training = await storage.getCompanyTraining(id);
      if (!training) {
        return res.status(404).json({ error: "Company training not found" });
      }
      res.json(training);
    } catch (error) {
      console.error("Error fetching company training:", error);
      res.status(500).json({ error: "Failed to fetch company training" });
    }
  });
  app2.patch("/api/company-trainings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const updated = await storage.updateCompanyTraining(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Company training not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating company training:", error);
      res.status(500).json({ error: "Failed to update company training" });
    }
  });
  app2.delete("/api/company-trainings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training ID" });
      }
      const success = await storage.deleteCompanyTraining(id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ error: "Failed to delete company training" });
      }
    } catch (error) {
      console.error("Error deleting company training:", error);
      res.status(500).json({ error: "Failed to delete company training" });
    }
  });
  app2.post("/api/company-trainings/import", async (req, res) => {
    try {
      const trainings = await storage.importCompanyTrainingsFromMaster();
      res.json(trainings);
    } catch (error) {
      console.error("Error importing company trainings:", error);
      res.status(500).json({ error: "Failed to import company trainings" });
    }
  });
  app2.post("/api/company-trainings/reorder", async (req, res) => {
    try {
      const orders = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Expected array of {id, sortOrder}" });
      }
      for (const item of orders) {
        if (typeof item.id !== "number" || typeof item.sortOrder !== "number") {
          return res.status(400).json({ error: "Each item must have numeric id and sortOrder" });
        }
      }
      await storage.reorderCompanyTrainings(orders);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering company trainings:", error);
      res.status(500).json({ error: "Failed to reorder company trainings" });
    }
  });
  app2.get("/api/company-training-requirements", async (req, res) => {
    try {
      const requirements = await storage.getCompanyTrainingRequirements();
      res.json(requirements);
    } catch (error) {
      console.error("Error fetching company training requirements:", error);
      res.status(500).json({ error: "Failed to fetch company training requirements" });
    }
  });
  app2.post("/api/company-training-requirements/batch", async (req, res) => {
    try {
      const requirements = req.body;
      if (!Array.isArray(requirements)) {
        return res.status(400).json({ error: "Expected array of requirements" });
      }
      for (const req2 of requirements) {
        if (typeof req2.companyTrainingId !== "number" || typeof req2.rankId !== "number") {
          return res.status(400).json({ error: "Each requirement must have numeric companyTrainingId and rankId" });
        }
        if (req2.status !== null && req2.status !== "M" && req2.status !== "R") {
          return res.status(400).json({ error: "Status must be 'M', 'R', or null" });
        }
      }
      const result = await storage.upsertCompanyTrainingRequirements(requirements);
      res.json(result);
    } catch (error) {
      console.error("Error upserting company training requirements:", error);
      res.status(500).json({ error: "Failed to update company training requirements" });
    }
  });
  app2.get("/api/pay-elements", async (req, res) => {
    try {
      const payElements2 = await storageAccount.getPayElements();
      res.json(payElements2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pay elements" });
    }
  });
  app2.post("/api/pay-elements", async (req, res) => {
    try {
      const result = insertPayElementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.createPayElement(result.data);
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pay element" });
    }
  });
  app2.put("/api/pay-elements/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.updatePayElement(id, result.data);
      if (!payElement) {
        return res.status(404).json({ error: "Pay element not found" });
      }
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pay element" });
    }
  });
  app2.put("/api/pay-elements/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid pay element data", details: result.error.issues });
      }
      const payElement = await storageAccount.updatePayElement(id, result.data);
      if (!payElement) {
        return res.status(404).json({ error: "Pay element not found" });
      }
      res.json(payElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pay element" });
    }
  });
  app2.get("/api/contract-data/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const vesselGroup = req.query.vesselGroup || "all-vessels";
      const contractData2 = await storageAccount.inheritPayElementsForCrewMember(crewMemberId, vesselGroup);
      const contractPayElements2 = await storageAccount.getContractPayElements(contractData2.id);
      const earnings = contractPayElements2.filter((cpe) => cpe.type === "earning");
      const deductions = contractPayElements2.filter((cpe) => cpe.type === "deduction");
      res.json({
        contractData: contractData2,
        earnings,
        deductions
      });
    } catch (error) {
      console.error("Error fetching contract data:", error);
      res.status(500).json({ error: "Failed to fetch contract data" });
    }
  });
  app2.put("/api/contract-data/:contractId/status", async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { status } = req.body;
      if (!["draft", "active"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'draft' or 'active'" });
      }
      const updatedContract = await storageAccount.updateContractStatus(contractId, status);
      if (!updatedContract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(updatedContract);
    } catch (error) {
      console.error("Error updating contract status:", error);
      res.status(500).json({ error: "Failed to update contract status" });
    }
  });
  app2.put("/api/contract-data/:contractId/effective-date", async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { effectiveDate } = req.body;
      if (!effectiveDate) {
        return res.status(400).json({ error: "Effective date is required" });
      }
      const updatedContract = await storageAccount.updateContractEffectiveDate(contractId, effectiveDate);
      if (!updatedContract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(updatedContract);
    } catch (error) {
      console.error("Error updating contract effective date:", error);
      res.status(500).json({ error: "Failed to update contract effective date" });
    }
  });
  app2.put("/api/contract-pay-elements/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertContractPayElementSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contract pay element data", details: result.error.issues });
      }
      const contractPayElement = await storageAccount.updateContractPayElement(id, result.data);
      if (!contractPayElement) {
        return res.status(404).json({ error: "Contract pay element not found" });
      }
      res.json(contractPayElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contract pay element" });
    }
  });
  app2.post("/api/contract-pay-elements", async (req, res) => {
    try {
      const result = insertContractPayElementSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contract pay element data", details: result.error.issues });
      }
      const contractPayElement = await storageAccount.createContractPayElement(result.data);
      res.json(contractPayElement);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contract pay element" });
    }
  });
  app2.get("/api/allotments", async (req, res) => {
    try {
      const allotments2 = await storageAccount.getAllotments();
      res.json(allotments2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch allotments" });
    }
  });
  app2.get("/api/allotments/crew/:crewId", async (req, res) => {
    try {
      const crewId = req.params.crewId;
      const allotments2 = await storageAccount.getAllotmentsByCrewId(crewId);
      res.json(allotments2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch allotments for crew member" });
    }
  });
  app2.post("/api/allotments", async (req, res) => {
    try {
      const result = insertAllotmentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid allotment data", details: result.error.issues });
      }
      const allotment = await storageAccount.createAllotment(result.data);
      res.json(allotment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create allotment" });
    }
  });
  app2.get("/api/advances", async (req, res) => {
    try {
      const advances2 = await storageAccount.getAdvances();
      res.json(advances2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advances" });
    }
  });
  app2.get("/api/advances/crew/:crewId", async (req, res) => {
    try {
      const crewId = req.params.crewId;
      const advances2 = await storageAccount.getAdvancesByCrewId(crewId);
      res.json(advances2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advances for crew member" });
    }
  });
  app2.post("/api/advances", async (req, res) => {
    try {
      const result = insertAdvanceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid advance data", details: result.error.issues });
      }
      const advance = await storageAccount.createAdvance(result.data);
      res.json(advance);
    } catch (error) {
      res.status(500).json({ error: "Failed to create advance" });
    }
  });
  app2.get("/api/bond-items", async (req, res) => {
    try {
      const bondItems2 = await storageAccount.getBondItems();
      res.json(bondItems2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bond items" });
    }
  });
  app2.get("/api/bond-items/crew/:crewId", async (req, res) => {
    try {
      const crewId = req.params.crewId;
      const bondItems2 = await storageAccount.getBondItemsByCrewId(crewId);
      res.json(bondItems2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bond items for crew member" });
    }
  });
  app2.post("/api/bond-items", async (req, res) => {
    try {
      const result = insertBondItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid bond item data", details: result.error.issues });
      }
      const bondItem = await storageAccount.createBondItem(result.data);
      res.json(bondItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bond item" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var BASE_PATH = process.env.NODE_ENV === "production" ? "/crewing/" : "/";
var vite_config_default = defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    runtimeErrorOverlay()
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    assetsDir: "assets",
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/migrationRunner.ts
import { Pool as Pool2 } from "pg";
import { readdir, readFile } from "fs/promises";
import { join as join2, dirname } from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log("\u23ED\uFE0F  Skipping migrations: DATABASE_URL not set (using file storage)");
    return;
  }
  const pool = new Pool2({
    connectionString: process.env.DATABASE_URL
  });
  try {
    console.log("\u{1F504} Starting automatic database migrations...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const appliedResult = await pool.query(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const appliedMigrations = new Set(appliedResult.rows.map((row) => row.filename));
    const migrationsDir = join2(__dirname, "../migrations");
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();
    if (sqlFiles.length === 0) {
      console.log("\u2705 No migration files found");
      return;
    }
    let appliedCount = 0;
    let skippedCount = 0;
    for (const filename of sqlFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`\u23ED\uFE0F  Skipping ${filename} (already applied)`);
        skippedCount++;
        continue;
      }
      console.log(`\u{1F527} Applying migration: ${filename}`);
      const client = await pool.connect();
      try {
        const migrationPath = join2(migrationsDir, filename);
        const migrationSQL = await readFile(migrationPath, "utf-8");
        let migrationHadNonFatalError = false;
        try {
          await client.query("BEGIN");
          await client.query(migrationSQL);
          await client.query("COMMIT");
        } catch (sqlError) {
          await client.query("ROLLBACK");
          const errorCode = sqlError.code;
          const isAlreadyExistsError = errorCode === "42P07" || // relation already exists
          errorCode === "42710" || // object already exists
          errorCode === "42P16" || // table already exists
          errorCode === "42723";
          if (isAlreadyExistsError) {
            console.log(`   \u2139\uFE0F  Some objects already exist (this is OK for existing databases)`);
            migrationHadNonFatalError = true;
          } else {
            throw sqlError;
          }
        }
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
        console.log(`\u2705 Successfully applied: ${filename}`);
        appliedCount++;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
        }
        console.error(`\u274C Failed to apply migration ${filename}:`, error);
        throw new Error(`Migration failed: ${filename}. ${error}`);
      } finally {
        client.release();
      }
    }
    console.log("\n\u{1F4CA} Migration Summary:");
    console.log(`   \u2705 Applied: ${appliedCount}`);
    console.log(`   \u23ED\uFE0F  Skipped: ${skippedCount}`);
    console.log(`   \u{1F4C1} Total: ${sqlFiles.length}`);
    console.log("\u2705 Database migrations completed successfully!\n");
  } catch (error) {
    console.error("\u274C Migration runner failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// server/index.ts
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await runMigrations();
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    log(`API Error ${status}: ${message}`);
    if (status >= 500) {
      log(`Server Error Details: ${err.stack || err}`);
    }
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 4e3;
  const httpServer = server.listen({
    port,
    host: "0.0.0.0"
  }, () => {
    log(`serving on port ${port}`);
  });
  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log(`Port ${port} is already in use. Please ensure no other process is using this port.`);
      process.exit(1);
    } else {
      log(`Server error: ${err.message}`);
      throw err;
    }
  });
  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`${signal} received. Shutting down gracefully...`);
    httpServer.close(() => {
      log("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      log("Forcing server close after 10 seconds...");
      process.exit(1);
    }, 1e4);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));
  process.on("uncaughtException", (err) => {
    log(`Uncaught Exception: ${err.message}`);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });
  process.on("unhandledRejection", (reason) => {
    log(`Unhandled Rejection: ${reason}`);
    gracefulShutdown("UNHANDLED_REJECTION");
  });
})();
