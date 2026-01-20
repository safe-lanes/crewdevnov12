import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// REUSABLE COLUMN HELPERS
// ============================================================================

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// ============================================================================
// TABLE 1: RECRUITMENT CANDIDATES V2 (Core)
// ============================================================================

export const recruitmentCandidatesV2 = pgTable(
  "recruitment_candidates_v2",
  {
    id: serial("id").primaryKey(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    fileNo: text("file_no").unique(),
    firstName: text("first_name"),
    middleName: text("middle_name"),
    familyName: text("family_name"),
    gender: text("gender"),
    dob: text("dob"),
    nationalityUuid: text("nationality_uuid"),
    presentRank: text("present_rank"),
    rankAppliedFor: text("rank_applied_for"),
    status: text("status").default("draft"),
    uploadedPhoto: text("uploaded_photo"),
    ...auditColumns,
  },
  (t) => [
    index("idx_rcv2_rec_can_uuid").on(t.recCanUuid),
    index("idx_rcv2_file_no").on(t.fileNo),
    index("idx_rcv2_nationality_uuid").on(t.nationalityUuid),
    index("idx_rcv2_status").on(t.status),
  ]
);

// ============================================================================
// TABLE 2: CANDIDATE VESSEL TYPES APPLIED (One-to-Many)
// ============================================================================

export const candVesselTypesApplied = pgTable(
  "cand_vessel_types_applied",
  {
    id: serial("id").primaryKey(),
    cvtaUuid: text("cvta_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    vesselTypeUuid: text("vessel_type_uuid"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_cvta_rec_can_uuid").on(t.recCanUuid),
    index("idx_cvta_vessel_type_uuid").on(t.vesselTypeUuid),
  ]
);

// ============================================================================
// TABLE 3: CANDIDATE PERSONAL DETAILS (One-to-One)
// ============================================================================

export const candPersonalDetails = pgTable(
  "cand_personal_details",
  {
    id: serial("id").primaryKey(),
    cpdUuid: text("cpd_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
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
  },
  (t) => [
    index("idx_cpd_rec_can_uuid").on(t.recCanUuid),
    index("idx_cpd_country_uuid").on(t.placeOfBirthCountryUuid),
    index("idx_cpd_language_uuid").on(t.nativeLanguageUuid),
  ]
);

// ============================================================================
// TABLE 4: CANDIDATE ADDRESSES (One-to-One)
// ============================================================================

export const candAddresses = pgTable(
  "cand_addresses",
  {
    id: serial("id").primaryKey(),
    addrUuid: text("addr_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    countryOfResidenceUuid: text("country_of_residence_uuid"),
    nearestAirport: text("nearest_airport"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    contactLandline: text("contact_landline"),
    mobile: text("mobile"),
    email: text("email"),
    ...auditColumns,
  },
  (t) => [
    index("idx_addr_rec_can_uuid").on(t.recCanUuid),
    index("idx_addr_country_uuid").on(t.countryOfResidenceUuid),
  ]
);

// ============================================================================
// TABLE 5: CANDIDATE FAMILY INFO (One-to-One)
// ============================================================================

export const candFamilyInfo = pgTable(
  "cand_family_info",
  {
    id: serial("id").primaryKey(),
    famUuid: text("fam_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    maritalStatus: text("marital_status"),
    numDependentChildren: text("num_dependent_children"),
    fatherName: text("father_name"),
    motherName: text("mother_name"),
    spouseFirstName: text("spouse_first_name"),
    spouseMiddleName: text("spouse_middle_name"),
    spouseFamilyName: text("spouse_family_name"),
    spouseDob: text("spouse_dob"),
    ...auditColumns,
  },
  (t) => [index("idx_fam_rec_can_uuid").on(t.recCanUuid)]
);

// ============================================================================
// TABLE 6: CANDIDATE CHILDREN (One-to-Many)
// ============================================================================

export const candChildren = pgTable(
  "cand_children",
  {
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
  },
  (t) => [index("idx_child_rec_can_uuid").on(t.recCanUuid)]
);

// ============================================================================
// TABLE 7: CANDIDATE NEXT OF KIN (One-to-Many)
// ============================================================================

export const candNextOfKin = pgTable(
  "cand_next_of_kin",
  {
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
  },
  (t) => [index("idx_nok_rec_can_uuid").on(t.recCanUuid)]
);

// ============================================================================
// PHASE 2: DOCUMENTS & CERTIFICATES (14 Tables)
// ============================================================================

// ============================================================================
// TABLE 8: CANDIDATE TRAVEL DOCUMENTS (Passports, Seaman Books)
// ============================================================================

export const candTravelDocuments = pgTable(
  "cand_travel_documents",
  {
    id: serial("id").primaryKey(),
    tdocUuid: text("tdoc_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    documentType: text("document_type"), // Passport, Seaman Book, CDC
    documentNumber: text("document_number"),
    issuingCountryUuid: text("issuing_country_uuid"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    placeOfIssue: text("place_of_issue"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_tdoc_rec_can_uuid").on(t.recCanUuid),
    index("idx_tdoc_document_type").on(t.documentType),
    index("idx_tdoc_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 9: CANDIDATE VISAS
// ============================================================================

export const candVisas = pgTable(
  "cand_visas",
  {
    id: serial("id").primaryKey(),
    visaUuid: text("visa_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    visaType: text("visa_type"),
    issuingCountryUuid: text("issuing_country_uuid"),
    serialNumber: text("serial_number"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    multipleEntry: boolean("multiple_entry").default(false),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_visa_rec_can_uuid").on(t.recCanUuid),
    index("idx_visa_country_uuid").on(t.issuingCountryUuid),
    index("idx_visa_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 10: CANDIDATE COC (Certificate of Competency)
// ============================================================================

export const candCoc = pgTable(
  "cand_coc",
  {
    id: serial("id").primaryKey(),
    cocUuid: text("coc_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    certificateType: text("certificate_type"), // Deck, Engine, ETO
    grade: text("grade"), // Management, Operational, Support
    limitation: text("limitation"),
    certificateNumber: text("certificate_number"),
    issuingCountryUuid: text("issuing_country_uuid"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_coc_rec_can_uuid").on(t.recCanUuid),
    index("idx_coc_certificate_type").on(t.certificateType),
    index("idx_coc_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 11: CANDIDATE COP (Certificate of Proficiency)
// ============================================================================

export const candCop = pgTable(
  "cand_cop",
  {
    id: serial("id").primaryKey(),
    copUuid: text("cop_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    certificateName: text("certificate_name"),
    certificateNumber: text("certificate_number"),
    issuingCountryUuid: text("issuing_country_uuid"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_cop_rec_can_uuid").on(t.recCanUuid),
    index("idx_cop_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 12: CANDIDATE STCW CERTIFICATES
// ============================================================================

export const candStcwCertificates = pgTable(
  "cand_stcw_certificates",
  {
    id: serial("id").primaryKey(),
    stcwUuid: text("stcw_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    stcwCode: text("stcw_code"), // e.g., A-VI/1, A-VI/2, A-VI/6
    certificateName: text("certificate_name"),
    certificateNumber: text("certificate_number"),
    issuingCountryUuid: text("issuing_country_uuid"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_stcw_rec_can_uuid").on(t.recCanUuid),
    index("idx_stcw_code").on(t.stcwCode),
    index("idx_stcw_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 13: CANDIDATE FLAG ENDORSEMENTS
// ============================================================================

export const candFlagEndorsements = pgTable(
  "cand_flag_endorsements",
  {
    id: serial("id").primaryKey(),
    flagUuid: text("flag_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    flagStateUuid: text("flag_state_uuid"),
    endorsementType: text("endorsement_type"), // COC Endorsement, COP Endorsement
    certificateNumber: text("certificate_number"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_flag_rec_can_uuid").on(t.recCanUuid),
    index("idx_flag_state_uuid").on(t.flagStateUuid),
    index("idx_flag_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 14: CANDIDATE MEDICAL CERTIFICATES
// ============================================================================

export const candMedicalCertificates = pgTable(
  "cand_medical_certificates",
  {
    id: serial("id").primaryKey(),
    medUuid: text("med_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    certificateType: text("certificate_type"), // PEME, Flag Medical, etc.
    certificateNumber: text("certificate_number"),
    clinicName: text("clinic_name"),
    clinicLocation: text("clinic_location"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    fitnessStatus: text("fitness_status"), // Fit, Fit with restrictions, Unfit
    restrictions: text("restrictions"),
    bloodType: text("blood_type"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_med_rec_can_uuid").on(t.recCanUuid),
    index("idx_med_certificate_type").on(t.certificateType),
    index("idx_med_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 15: CANDIDATE VACCINATIONS
// ============================================================================

export const candVaccinations = pgTable(
  "cand_vaccinations",
  {
    id: serial("id").primaryKey(),
    vaccUuid: text("vacc_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    vaccineName: text("vaccine_name"),
    vaccineType: text("vaccine_type"), // Required, Recommended
    dateAdministered: text("date_administered"),
    expiryDate: text("expiry_date"),
    batchNumber: text("batch_number"),
    administeredBy: text("administered_by"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_vacc_rec_can_uuid").on(t.recCanUuid),
    index("idx_vacc_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 16: CANDIDATE TRAINING CERTIFICATES
// ============================================================================

export const candTrainingCertificates = pgTable(
  "cand_training_certificates",
  {
    id: serial("id").primaryKey(),
    trainUuid: text("train_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    courseName: text("course_name"),
    courseCode: text("course_code"),
    certificateNumber: text("certificate_number"),
    trainingCenter: text("training_center"),
    trainingLocation: text("training_location"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_train_rec_can_uuid").on(t.recCanUuid),
    index("idx_train_course_name").on(t.courseName),
    index("idx_train_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 17: CANDIDATE EDUCATION
// ============================================================================

export const candEducation = pgTable(
  "cand_education",
  {
    id: serial("id").primaryKey(),
    eduUuid: text("edu_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    institutionName: text("institution_name"),
    qualification: text("qualification"),
    fieldOfStudy: text("field_of_study"),
    startDate: text("start_date"),
    completionDate: text("completion_date"),
    grade: text("grade"),
    countryUuid: text("country_uuid"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_edu_rec_can_uuid").on(t.recCanUuid),
    index("idx_edu_completion_date").on(t.completionDate),
  ]
);

// ============================================================================
// TABLE 18: CANDIDATE SEA SERVICE (Internal - Current Company)
// ============================================================================

export const candSeaServiceInternal = pgTable(
  "cand_sea_service_internal",
  {
    id: serial("id").primaryKey(),
    ssIntUuid: text("ss_int_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    vesselName: text("vessel_name"),
    vesselTypeUuid: text("vessel_type_uuid"),
    imoNumber: text("imo_number"),
    grossTonnage: text("gross_tonnage"),
    enginePower: text("engine_power"),
    rank: text("rank"),
    signOnDate: text("sign_on_date"),
    signOffDate: text("sign_off_date"),
    durationMonths: text("duration_months"),
    flagStateUuid: text("flag_state_uuid"),
    tradingArea: text("trading_area"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_ss_int_rec_can_uuid").on(t.recCanUuid),
    index("idx_ss_int_vessel_type_uuid").on(t.vesselTypeUuid),
    index("idx_ss_int_sign_on_date").on(t.signOnDate),
  ]
);

// ============================================================================
// TABLE 19: CANDIDATE SEA SERVICE (External - Other Companies)
// ============================================================================

export const candSeaServiceExternal = pgTable(
  "cand_sea_service_external",
  {
    id: serial("id").primaryKey(),
    ssExtUuid: text("ss_ext_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    companyName: text("company_name"),
    vesselName: text("vessel_name"),
    vesselTypeUuid: text("vessel_type_uuid"),
    imoNumber: text("imo_number"),
    grossTonnage: text("gross_tonnage"),
    enginePower: text("engine_power"),
    rank: text("rank"),
    signOnDate: text("sign_on_date"),
    signOffDate: text("sign_off_date"),
    durationMonths: text("duration_months"),
    flagStateUuid: text("flag_state_uuid"),
    tradingArea: text("trading_area"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_ss_ext_rec_can_uuid").on(t.recCanUuid),
    index("idx_ss_ext_company_name").on(t.companyName),
    index("idx_ss_ext_sign_on_date").on(t.signOnDate),
  ]
);

// ============================================================================
// TABLE 20: CANDIDATE LICENSES
// ============================================================================

export const candLicenses = pgTable(
  "cand_licenses",
  {
    id: serial("id").primaryKey(),
    licUuid: text("lic_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    licenseType: text("license_type"),
    licenseName: text("license_name"),
    licenseNumber: text("license_number"),
    issuingCountryUuid: text("issuing_country_uuid"),
    issueDate: text("issue_date"),
    expiryDate: text("expiry_date"),
    issuingAuthority: text("issuing_authority"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_lic_rec_can_uuid").on(t.recCanUuid),
    index("idx_lic_license_type").on(t.licenseType),
    index("idx_lic_expiry_date").on(t.expiryDate),
  ]
);

// ============================================================================
// TABLE 21: CANDIDATE DOCUMENT ATTACHMENTS
// ============================================================================

export const candDocumentAttachments = pgTable(
  "cand_document_attachments",
  {
    id: serial("id").primaryKey(),
    attachUuid: text("attach_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    parentTableName: text("parent_table_name"), // e.g., cand_travel_documents, cand_coc
    parentRecordUuid: text("parent_record_uuid"), // UUID of the parent record
    fileName: text("file_name"),
    fileType: text("file_type"), // pdf, jpg, png, etc.
    fileSize: integer("file_size"), // in bytes
    filePath: text("file_path"), // storage path or URL
    uploadedAt: timestamp("uploaded_at").defaultNow(),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_attach_rec_can_uuid").on(t.recCanUuid),
    index("idx_attach_parent_table").on(t.parentTableName),
    index("idx_attach_parent_record").on(t.parentRecordUuid),
  ]
);

// ============================================================================
// PHASE 3: SCREENING B1-B8 (29 Tables)
// ============================================================================

// ============================================================================
// B1: GENERAL SCREENING (4 tables)
// ============================================================================

// TABLE 22: SCREENING GENERAL INFO (One-to-One)
export const screeningGeneralInfo = pgTable(
  "screening_general_info",
  {
    id: serial("id").primaryKey(),
    sgiUuid: text("sgi_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    availabilityDate: text("availability_date"),
    noticePeriodDays: integer("notice_period_days"),
    expectedSalaryUsd: text("expected_salary_usd"),
    contractDurationPreference: text("contract_duration_preference"),
    willingToRelocate: boolean("willing_to_relocate"),
    preferredVesselTypes: text("preferred_vessel_types"),
    preferredTradingAreas: text("preferred_trading_areas"),
    reasonForLeaving: text("reason_for_leaving"),
    careerObjectives: text("career_objectives"),
    ...auditColumns,
  },
  (t) => [index("idx_sgi_rec_can_uuid").on(t.recCanUuid)]
);

// TABLE 23: SCREENING AVAILABILITY (One-to-Many)
export const screeningAvailability = pgTable(
  "screening_availability",
  {
    id: serial("id").primaryKey(),
    availUuid: text("avail_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    availableFromDate: text("available_from_date"),
    availableToDate: text("available_to_date"),
    availabilityType: text("availability_type"), // immediate, after_notice, specific_date
    remarks: text("remarks"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_avail_rec_can_uuid").on(t.recCanUuid),
    index("idx_avail_from_date").on(t.availableFromDate),
  ]
);

// TABLE 24: SCREENING SALARY HISTORY (One-to-Many)
export const screeningSalaryHistory = pgTable(
  "screening_salary_history",
  {
    id: serial("id").primaryKey(),
    salHistUuid: text("sal_hist_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    employerName: text("employer_name"),
    position: text("position"),
    salaryAmountUsd: text("salary_amount_usd"),
    currency: text("currency"),
    periodFrom: text("period_from"),
    periodTo: text("period_to"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_sal_hist_rec_can_uuid").on(t.recCanUuid),
    index("idx_sal_hist_employer").on(t.employerName),
  ]
);

// TABLE 25: SCREENING DOCUMENTS CHECKLIST (One-to-One)
export const screeningDocumentsChecklist = pgTable(
  "screening_documents_checklist",
  {
    id: serial("id").primaryKey(),
    docCheckUuid: text("doc_check_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    passportVerified: boolean("passport_verified").default(false),
    seamanBookVerified: boolean("seaman_book_verified").default(false),
    cocVerified: boolean("coc_verified").default(false),
    stcwVerified: boolean("stcw_verified").default(false),
    medicalVerified: boolean("medical_verified").default(false),
    flagEndorsementVerified: boolean("flag_endorsement_verified").default(false),
    visaVerified: boolean("visa_verified").default(false),
    checklistCompletedAt: timestamp("checklist_completed_at"),
    checklistCompletedByUuid: text("checklist_completed_by_uuid"),
    remarks: text("remarks"),
    ...auditColumns,
  },
  (t) => [index("idx_doc_check_rec_can_uuid").on(t.recCanUuid)]
);

// ============================================================================
// B2: SKILLS ASSESSMENT (5 tables)
// ============================================================================

// TABLE 26: SCREENING TECHNICAL SKILLS (One-to-Many)
export const screeningTechnicalSkills = pgTable(
  "screening_technical_skills",
  {
    id: serial("id").primaryKey(),
    techSkillUuid: text("tech_skill_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    skillCategory: text("skill_category"), // navigation, engineering, safety, etc.
    skillName: text("skill_name"),
    proficiencyLevel: text("proficiency_level"), // beginner, intermediate, advanced, expert
    yearsExperience: integer("years_experience"),
    lastUsedDate: text("last_used_date"),
    certificationUuid: text("certification_uuid"), // link to training cert if applicable
    assessedByUuid: text("assessed_by_uuid"),
    assessedAt: timestamp("assessed_at"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_tech_skill_rec_can_uuid").on(t.recCanUuid),
    index("idx_tech_skill_category").on(t.skillCategory),
  ]
);

// TABLE 27: SCREENING COMPETENCY RATINGS (One-to-Many)
export const screeningCompetencyRatings = pgTable(
  "screening_competency_ratings",
  {
    id: serial("id").primaryKey(),
    compRatingUuid: text("comp_rating_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    competencyArea: text("competency_area"), // leadership, teamwork, communication, etc.
    competencyName: text("competency_name"),
    rating: integer("rating"), // 1-5 scale
    ratingDescription: text("rating_description"),
    evidenceNotes: text("evidence_notes"),
    ratedByUuid: text("rated_by_uuid"),
    ratedAt: timestamp("rated_at"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_comp_rating_rec_can_uuid").on(t.recCanUuid),
    index("idx_comp_rating_area").on(t.competencyArea),
  ]
);

// TABLE 28: SCREENING EQUIPMENT EXPERIENCE (One-to-Many)
export const screeningEquipmentExperience = pgTable(
  "screening_equipment_experience",
  {
    id: serial("id").primaryKey(),
    equipExpUuid: text("equip_exp_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    equipmentCategory: text("equipment_category"), // navigation, cargo, safety, engine
    equipmentType: text("equipment_type"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    experienceLevel: text("experience_level"), // familiar, proficient, expert
    yearsExperience: integer("years_experience"),
    lastUsedDate: text("last_used_date"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_equip_exp_rec_can_uuid").on(t.recCanUuid),
    index("idx_equip_exp_category").on(t.equipmentCategory),
  ]
);

// TABLE 29: SCREENING LANGUAGE PROFICIENCY (One-to-Many)
export const screeningLanguageProficiency = pgTable(
  "screening_language_proficiency",
  {
    id: serial("id").primaryKey(),
    langProfUuid: text("lang_prof_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    languageUuid: text("language_uuid"),
    languageName: text("language_name"),
    speakingLevel: text("speaking_level"), // none, basic, conversational, fluent, native
    readingLevel: text("reading_level"),
    writingLevel: text("writing_level"),
    listeningLevel: text("listening_level"),
    testName: text("test_name"), // TOEFL, IELTS, etc.
    testScore: text("test_score"),
    testDate: text("test_date"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_lang_prof_rec_can_uuid").on(t.recCanUuid),
    index("idx_lang_prof_language").on(t.languageUuid),
  ]
);

// TABLE 30: SCREENING PRACTICAL TESTS (One-to-Many)
export const screeningPracticalTests = pgTable(
  "screening_practical_tests",
  {
    id: serial("id").primaryKey(),
    practTestUuid: text("pract_test_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    testCategory: text("test_category"), // simulator, hands-on, written
    testName: text("test_name"),
    testDescription: text("test_description"),
    testDate: text("test_date"),
    testLocation: text("test_location"),
    maxScore: integer("max_score"),
    achievedScore: integer("achieved_score"),
    passScore: integer("pass_score"),
    result: text("result"), // pass, fail, pending
    assessorUuid: text("assessor_uuid"),
    assessorNotes: text("assessor_notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_pract_test_rec_can_uuid").on(t.recCanUuid),
    index("idx_pract_test_category").on(t.testCategory),
    index("idx_pract_test_result").on(t.result),
  ]
);

// ============================================================================
// B3: INTERVIEW ASSESSMENT (4 tables)
// ============================================================================

// TABLE 31: SCREENING INTERVIEWS (One-to-Many)
export const screeningInterviews = pgTable(
  "screening_interviews",
  {
    id: serial("id").primaryKey(),
    interviewUuid: text("interview_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    interviewType: text("interview_type"), // phone, video, in-person, panel
    interviewStage: text("interview_stage"), // initial, technical, final
    scheduledDate: text("scheduled_date"),
    scheduledTime: text("scheduled_time"),
    duration: integer("duration"), // minutes
    location: text("location"),
    meetingLink: text("meeting_link"),
    status: text("status"), // scheduled, completed, cancelled, no-show
    overallRating: integer("overall_rating"), // 1-5
    recommendation: text("recommendation"), // proceed, hold, reject
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_interview_rec_can_uuid").on(t.recCanUuid),
    index("idx_interview_status").on(t.status),
    index("idx_interview_date").on(t.scheduledDate),
  ]
);

// TABLE 32: SCREENING INTERVIEW PANELISTS (One-to-Many, child of interviews)
export const screeningInterviewPanelists = pgTable(
  "screening_interview_panelists",
  {
    id: serial("id").primaryKey(),
    panelistUuid: text("panelist_uuid").unique().notNull(),
    interviewUuid: text("interview_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    panelistUserUuid: text("panelist_user_uuid"),
    panelistName: text("panelist_name"),
    panelistRole: text("panelist_role"), // lead, technical, hr
    individualRating: integer("individual_rating"),
    feedback: text("feedback"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_panelist_interview_uuid").on(t.interviewUuid),
    index("idx_panelist_rec_can_uuid").on(t.recCanUuid),
    index("idx_panelist_user").on(t.panelistUserUuid),
  ]
);

// TABLE 33: SCREENING INTERVIEW QUESTIONS (One-to-Many, child of interviews)
export const screeningInterviewQuestions = pgTable(
  "screening_interview_questions",
  {
    id: serial("id").primaryKey(),
    intQuestUuid: text("int_quest_uuid").unique().notNull(),
    interviewUuid: text("interview_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    questionCategory: text("question_category"), // technical, behavioral, situational
    questionText: text("question_text"),
    expectedAnswer: text("expected_answer"),
    candidateResponse: text("candidate_response"),
    rating: integer("rating"),
    notes: text("notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_int_quest_interview_uuid").on(t.interviewUuid),
    index("idx_int_quest_rec_can_uuid").on(t.recCanUuid),
    index("idx_int_quest_category").on(t.questionCategory),
  ]
);

// TABLE 34: SCREENING INTERVIEW NOTES (One-to-Many)
export const screeningInterviewNotes = pgTable(
  "screening_interview_notes",
  {
    id: serial("id").primaryKey(),
    intNoteUuid: text("int_note_uuid").unique().notNull(),
    interviewUuid: text("interview_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    noteType: text("note_type"), // observation, concern, strength, follow-up
    noteContent: text("note_content"),
    authorUuid: text("author_uuid"),
    authorName: text("author_name"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_int_note_interview_uuid").on(t.interviewUuid),
    index("idx_int_note_rec_can_uuid").on(t.recCanUuid),
  ]
);

// ============================================================================
// B4: REFERENCE CHECKS (4 tables)
// ============================================================================

// TABLE 35: SCREENING EMPLOYER REFERENCES (One-to-Many)
export const screeningEmployerReferences = pgTable(
  "screening_employer_references",
  {
    id: serial("id").primaryKey(),
    empRefUuid: text("emp_ref_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    companyName: text("company_name"),
    contactName: text("contact_name"),
    contactPosition: text("contact_position"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    relationshipToCandidate: text("relationship_to_candidate"),
    employmentPeriodFrom: text("employment_period_from"),
    employmentPeriodTo: text("employment_period_to"),
    positionHeld: text("position_held"),
    referenceStatus: text("reference_status"), // pending, contacted, completed, unable
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_emp_ref_rec_can_uuid").on(t.recCanUuid),
    index("idx_emp_ref_status").on(t.referenceStatus),
  ]
);

// TABLE 36: SCREENING REFERENCE RESPONSES (One-to-Many, child of employer refs)
export const screeningReferenceResponses = pgTable(
  "screening_reference_responses",
  {
    id: serial("id").primaryKey(),
    refRespUuid: text("ref_resp_uuid").unique().notNull(),
    empRefUuid: text("emp_ref_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    questionText: text("question_text"),
    responseText: text("response_text"),
    rating: integer("rating"),
    contactedDate: text("contacted_date"),
    contactedByUuid: text("contacted_by_uuid"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_ref_resp_emp_ref_uuid").on(t.empRefUuid),
    index("idx_ref_resp_rec_can_uuid").on(t.recCanUuid),
  ]
);

// TABLE 37: SCREENING PERSONAL REFERENCES (One-to-Many)
export const screeningPersonalReferences = pgTable(
  "screening_personal_references",
  {
    id: serial("id").primaryKey(),
    persRefUuid: text("pers_ref_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    referenceName: text("reference_name"),
    relationship: text("relationship"),
    occupation: text("occupation"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    yearsKnown: integer("years_known"),
    referenceStatus: text("reference_status"), // pending, contacted, completed, unable
    referenceNotes: text("reference_notes"),
    contactedDate: text("contacted_date"),
    contactedByUuid: text("contacted_by_uuid"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_pers_ref_rec_can_uuid").on(t.recCanUuid),
    index("idx_pers_ref_status").on(t.referenceStatus),
  ]
);

// TABLE 38: SCREENING SEA SERVICE VERIFICATION (One-to-Many)
export const screeningSeaServiceVerification = pgTable(
  "screening_sea_service_verification",
  {
    id: serial("id").primaryKey(),
    ssVerifUuid: text("ss_verif_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    seaServiceUuid: text("sea_service_uuid"), // link to cand_sea_service_internal or external
    seaServiceType: text("sea_service_type"), // internal, external
    verificationStatus: text("verification_status"), // pending, verified, discrepancy, unable
    verifiedByUuid: text("verified_by_uuid"),
    verifiedAt: timestamp("verified_at"),
    companyContactName: text("company_contact_name"),
    companyContactEmail: text("company_contact_email"),
    discrepancyNotes: text("discrepancy_notes"),
    verificationNotes: text("verification_notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_ss_verif_rec_can_uuid").on(t.recCanUuid),
    index("idx_ss_verif_status").on(t.verificationStatus),
  ]
);

// ============================================================================
// B5: BACKGROUND VERIFICATION (4 tables)
// ============================================================================

// TABLE 39: SCREENING BACKGROUND CHECKS (One-to-One)
export const screeningBackgroundChecks = pgTable(
  "screening_background_checks",
  {
    id: serial("id").primaryKey(),
    bgCheckUuid: text("bg_check_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    overallStatus: text("overall_status"), // pending, in_progress, passed, failed, incomplete
    initiatedDate: text("initiated_date"),
    completedDate: text("completed_date"),
    initiatedByUuid: text("initiated_by_uuid"),
    vendorName: text("vendor_name"), // third-party verification agency
    vendorReferenceNumber: text("vendor_reference_number"),
    expiryDate: text("expiry_date"),
    remarks: text("remarks"),
    ...auditColumns,
  },
  (t) => [
    index("idx_bg_check_rec_can_uuid").on(t.recCanUuid),
    index("idx_bg_check_status").on(t.overallStatus),
  ]
);

// TABLE 40: SCREENING CRIMINAL RECORDS (One-to-Many)
export const screeningCriminalRecords = pgTable(
  "screening_criminal_records",
  {
    id: serial("id").primaryKey(),
    crimRecUuid: text("crim_rec_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    countryUuid: text("country_uuid"),
    countryName: text("country_name"),
    checkType: text("check_type"), // national, local, international
    checkDate: text("check_date"),
    result: text("result"), // clear, record_found, pending, unable
    recordDetails: text("record_details"),
    certificateNumber: text("certificate_number"),
    issuingAuthority: text("issuing_authority"),
    expiryDate: text("expiry_date"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_crim_rec_rec_can_uuid").on(t.recCanUuid),
    index("idx_crim_rec_country").on(t.countryUuid),
    index("idx_crim_rec_result").on(t.result),
  ]
);

// TABLE 41: SCREENING EMPLOYMENT VERIFICATION (One-to-Many)
export const screeningEmploymentVerification = pgTable(
  "screening_employment_verification",
  {
    id: serial("id").primaryKey(),
    empVerifUuid: text("emp_verif_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    employerName: text("employer_name"),
    positionClaimed: text("position_claimed"),
    positionVerified: text("position_verified"),
    periodClaimedFrom: text("period_claimed_from"),
    periodClaimedTo: text("period_claimed_to"),
    periodVerifiedFrom: text("period_verified_from"),
    periodVerifiedTo: text("period_verified_to"),
    salaryVerified: boolean("salary_verified"),
    verificationStatus: text("verification_status"), // pending, verified, discrepancy, unable
    verifiedByUuid: text("verified_by_uuid"),
    verifiedAt: timestamp("verified_at"),
    discrepancyNotes: text("discrepancy_notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_emp_verif_rec_can_uuid").on(t.recCanUuid),
    index("idx_emp_verif_status").on(t.verificationStatus),
  ]
);

// TABLE 42: SCREENING EDUCATION VERIFICATION (One-to-Many)
export const screeningEducationVerification = pgTable(
  "screening_education_verification",
  {
    id: serial("id").primaryKey(),
    eduVerifUuid: text("edu_verif_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    educationUuid: text("education_uuid"), // link to cand_education
    institutionName: text("institution_name"),
    degreeClaimed: text("degree_claimed"),
    degreeVerified: text("degree_verified"),
    yearClaimedFrom: text("year_claimed_from"),
    yearClaimedTo: text("year_claimed_to"),
    yearVerifiedFrom: text("year_verified_from"),
    yearVerifiedTo: text("year_verified_to"),
    verificationStatus: text("verification_status"), // pending, verified, discrepancy, unable
    verifiedByUuid: text("verified_by_uuid"),
    verifiedAt: timestamp("verified_at"),
    discrepancyNotes: text("discrepancy_notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_edu_verif_rec_can_uuid").on(t.recCanUuid),
    index("idx_edu_verif_education").on(t.educationUuid),
    index("idx_edu_verif_status").on(t.verificationStatus),
  ]
);

// ============================================================================
// B6: PSYCHOLOGICAL ASSESSMENT (3 tables)
// ============================================================================

// TABLE 43: SCREENING PSYCHOMETRIC TESTS (One-to-Many)
export const screeningPsychometricTests = pgTable(
  "screening_psychometric_tests",
  {
    id: serial("id").primaryKey(),
    psychTestUuid: text("psych_test_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    testName: text("test_name"),
    testType: text("test_type"), // personality, aptitude, cognitive, emotional_intelligence
    testProvider: text("test_provider"),
    testDate: text("test_date"),
    expiryDate: text("expiry_date"),
    overallScore: text("overall_score"),
    percentile: integer("percentile"),
    result: text("result"), // suitable, borderline, not_suitable
    administeredByUuid: text("administered_by_uuid"),
    remarks: text("remarks"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_psych_test_rec_can_uuid").on(t.recCanUuid),
    index("idx_psych_test_type").on(t.testType),
    index("idx_psych_test_result").on(t.result),
  ]
);

// TABLE 44: SCREENING PSYCHOMETRIC DIMENSIONS (One-to-Many, child of psychometric tests)
export const screeningPsychometricDimensions = pgTable(
  "screening_psychometric_dimensions",
  {
    id: serial("id").primaryKey(),
    psychDimUuid: text("psych_dim_uuid").unique().notNull(),
    psychTestUuid: text("psych_test_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    dimensionName: text("dimension_name"), // stress_tolerance, decision_making, teamwork
    dimensionScore: text("dimension_score"),
    percentile: integer("percentile"),
    normalRange: text("normal_range"),
    interpretation: text("interpretation"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_psych_dim_psych_test_uuid").on(t.psychTestUuid),
    index("idx_psych_dim_rec_can_uuid").on(t.recCanUuid),
  ]
);

// TABLE 45: SCREENING BEHAVIORAL ASSESSMENTS (One-to-Many)
export const screeningBehavioralAssessments = pgTable(
  "screening_behavioral_assessments",
  {
    id: serial("id").primaryKey(),
    behAssessUuid: text("beh_assess_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    assessmentType: text("assessment_type"), // DISC, MBTI, Big5, custom
    assessmentDate: text("assessment_date"),
    assessorUuid: text("assessor_uuid"),
    assessorName: text("assessor_name"),
    primaryStyle: text("primary_style"),
    secondaryStyle: text("secondary_style"),
    strengthsIdentified: text("strengths_identified"),
    areasOfDevelopment: text("areas_of_development"),
    teamFitScore: integer("team_fit_score"),
    leadershipPotential: text("leadership_potential"),
    overallNotes: text("overall_notes"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_beh_assess_rec_can_uuid").on(t.recCanUuid),
    index("idx_beh_assess_type").on(t.assessmentType),
  ]
);

// ============================================================================
// B7: MEDICAL SCREENING (3 tables)
// ============================================================================

// TABLE 46: SCREENING PEME (Pre-Employment Medical Examination) (One-to-Many)
export const screeningPeme = pgTable(
  "screening_peme",
  {
    id: serial("id").primaryKey(),
    pemeUuid: text("peme_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    examDate: text("exam_date"),
    clinicName: text("clinic_name"),
    clinicLocation: text("clinic_location"),
    examType: text("exam_type"), // initial, renewal, special
    overallResult: text("overall_result"), // fit, unfit, fit_with_restrictions, pending
    restrictions: text("restrictions"),
    validUntil: text("valid_until"),
    examinerName: text("examiner_name"),
    examinerLicense: text("examiner_license"),
    certificateNumber: text("certificate_number"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_peme_rec_can_uuid").on(t.recCanUuid),
    index("idx_peme_result").on(t.overallResult),
    index("idx_peme_valid_until").on(t.validUntil),
  ]
);

// TABLE 47: SCREENING PEME RESULTS (One-to-Many, child of PEME)
export const screeningPemeResults = pgTable(
  "screening_peme_results",
  {
    id: serial("id").primaryKey(),
    pemeResultUuid: text("peme_result_uuid").unique().notNull(),
    pemeUuid: text("peme_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    testCategory: text("test_category"), // vision, hearing, cardiovascular, respiratory, etc.
    testName: text("test_name"),
    testResult: text("test_result"),
    normalRange: text("normal_range"),
    status: text("status"), // normal, abnormal, borderline
    remarks: text("remarks"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_peme_result_peme_uuid").on(t.pemeUuid),
    index("idx_peme_result_rec_can_uuid").on(t.recCanUuid),
    index("idx_peme_result_status").on(t.status),
  ]
);

// TABLE 48: SCREENING DRUG ALCOHOL TESTS (One-to-Many)
export const screeningDrugAlcoholTests = pgTable(
  "screening_drug_alcohol_tests",
  {
    id: serial("id").primaryKey(),
    daTestUuid: text("da_test_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    testType: text("test_type"), // pre_employment, random, post_incident
    testDate: text("test_date"),
    testLocation: text("test_location"),
    collectorName: text("collector_name"),
    specimenType: text("specimen_type"), // urine, blood, breath, hair
    chainOfCustodyNumber: text("chain_of_custody_number"),
    laboratoryName: text("laboratory_name"),
    result: text("result"), // negative, positive, inconclusive
    substancesTestedFor: text("substances_tested_for"),
    substancesDetected: text("substances_detected"),
    confirmedByMro: boolean("confirmed_by_mro"), // Medical Review Officer
    mroName: text("mro_name"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_da_test_rec_can_uuid").on(t.recCanUuid),
    index("idx_da_test_type").on(t.testType),
    index("idx_da_test_result").on(t.result),
  ]
);

// ============================================================================
// B8: FINAL EVALUATION (2 tables)
// ============================================================================

// TABLE 49: SCREENING FINAL EVALUATION (One-to-One)
export const screeningFinalEvaluation = pgTable(
  "screening_final_evaluation",
  {
    id: serial("id").primaryKey(),
    finalEvalUuid: text("final_eval_uuid").unique().notNull(),
    recCanUuid: text("rec_can_uuid").unique().notNull(),
    evaluationDate: text("evaluation_date"),
    evaluatorUuid: text("evaluator_uuid"),
    evaluatorName: text("evaluator_name"),
    technicalScore: integer("technical_score"),
    interviewScore: integer("interview_score"),
    referenceScore: integer("reference_score"),
    backgroundScore: integer("background_score"),
    medicalScore: integer("medical_score"),
    overallScore: integer("overall_score"),
    overallRating: text("overall_rating"), // excellent, good, acceptable, below_standard
    hiringRecommendation: text("hiring_recommendation"), // hire, conditional_hire, hold, reject
    recommendedRank: text("recommended_rank"),
    recommendedVesselType: text("recommended_vessel_type"),
    startDateRecommended: text("start_date_recommended"),
    salaryRecommended: text("salary_recommended"),
    conditionsForHire: text("conditions_for_hire"),
    evaluationNotes: text("evaluation_notes"),
    ...auditColumns,
  },
  (t) => [
    index("idx_final_eval_rec_can_uuid").on(t.recCanUuid),
    index("idx_final_eval_recommendation").on(t.hiringRecommendation),
    index("idx_final_eval_rating").on(t.overallRating),
  ]
);

// TABLE 50: SCREENING EVALUATION APPROVALS (One-to-Many)
export const screeningEvaluationApprovals = pgTable(
  "screening_evaluation_approvals",
  {
    id: serial("id").primaryKey(),
    evalApprovalUuid: text("eval_approval_uuid").unique().notNull(),
    finalEvalUuid: text("final_eval_uuid").notNull(),
    recCanUuid: text("rec_can_uuid").notNull(),
    approvalLevel: integer("approval_level"), // 1, 2, 3 for different authority levels
    approverUuid: text("approver_uuid"),
    approverName: text("approver_name"),
    approverRole: text("approver_role"),
    approvalStatus: text("approval_status"), // pending, approved, rejected, deferred
    approvalDate: text("approval_date"),
    comments: text("comments"),
    sortOrder: integer("sort_order").default(0),
    ...auditColumns,
  },
  (t) => [
    index("idx_eval_approval_final_eval_uuid").on(t.finalEvalUuid),
    index("idx_eval_approval_rec_can_uuid").on(t.recCanUuid),
    index("idx_eval_approval_status").on(t.approvalStatus),
  ]
);
