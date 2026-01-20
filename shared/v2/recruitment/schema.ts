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
