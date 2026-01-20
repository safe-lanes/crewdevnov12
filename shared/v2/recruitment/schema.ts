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
