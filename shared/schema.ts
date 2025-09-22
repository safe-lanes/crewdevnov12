
import { mysqlTable, text, int, boolean, timestamp, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: text("username").notNull(),
  password: text("password").notNull(),
});

export const forms = mysqlTable("forms", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  rankGroup: text("rank_group").notNull(),
  versionNo: text("version_no").notNull(),
  versionDate: text("version_date").notNull(),
  configuration: text("configuration"), // JSON string for form configuration
});

export const rankGroups = mysqlTable("rank_groups", {
  id: int("id").primaryKey().autoincrement(),
  formId: int("form_id").notNull().references(() => forms.id),
  name: text("name").notNull(),
  ranks: text("ranks").notNull(), // JSON string
});

export const availableRanks = mysqlTable("available_ranks", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Senior Officers, Junior Officers, Ratings, etc.
  rankId: text("rank_id"), // User-editable rank ID (e.g., "S1", "S2")
  label: text("label"), // User-editable label (e.g., "Master", "2nd Off")
  applicableToCompany: boolean("applicable_to_company"), // User-editable company applicability
});

export const crewMembers = mysqlTable("crew_members", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  rank: text("rank").notNull(),
  nationality: text("nationality").notNull(),
  vessel: text("vessel").notNull(),
  vesselType: text("vessel_type").notNull(),
  signOnDate: text("sign_on_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appraisalResults = mysqlTable("appraisal_results", {
  id: int("id").primaryKey().autoincrement(),
  crewMemberId: text("crew_member_id").notNull().references(() => crewMembers.id),
  formId: int("form_id").notNull().references(() => forms.id),
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

export const recruitmentCandidates = mysqlTable("recruitment_candidates", {
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
  status: text("status").notNull().default("Applied"), // Applied, Screening, For Approval, Recruited, Waitlisted, Rejected
  applicationData: text("application_data"), // JSON string for comprehensive form data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vessels = mysqlTable("vessels", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  vesselGroup: text("vessel_group"),
  vesselType: text("vessel_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const seafarers = mysqlTable("seafarers", {
  id: int("id").primaryKey().autoincrement(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  rank: text("rank").notNull(),
  nationality: text("nationality").notNull(),
  status: text("status").notNull().default("Available"), // Available, Assigned, On Leave
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const revisions = mysqlTable("revisions", {
  id: int("id").primaryKey().autoincrement(),
  vesselId: int("vessel_id").notNull().references(() => vessels.id),
  revisionNo: text("revision_no").notNull(),
  flexDate: text("flex_date"),
  status: text("status").notNull().default("draft"), // draft, submitted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vesselRanks = mysqlTable("vessel_ranks", {
  id: int("id").primaryKey().autoincrement(),
  vesselId: int("vessel_id").notNull().references(() => vessels.id),
  revisionId: int("revision_id").notNull().references(() => revisions.id),
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

export const dataMasters = mysqlTable("data_masters", {
  id: text("id").primaryKey(), // "001", "002", "003", etc.
  name: text("name").notNull(), // "Nationality Master", "Country Master"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const masterDataEntries = mysqlTable("master_data_entries", {
  id: int("id").primaryKey().autoincrement(),
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
  orderBy: int("orderBy"),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFormSchema = createInsertSchema(forms).pick({
  name: true,
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
});

export const updateAvailableRankSchema = createInsertSchema(availableRanks).pick({
  name: true,
  category: true,
  rankId: true,
  label: true,
  applicableToCompany: true,
}).partial();

export const insertCrewMemberSchema = createInsertSchema(crewMembers).pick({
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  rank: true,
  nationality: true,
  vessel: true,
  vesselType: true,
  signOnDate: true,
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
export type InsertSeafarer = z.infer<typeof insertSeafarerSchema>;
export type Seafarer = typeof seafarers.$inferSelect;
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;
export type InsertVesselRank = z.infer<typeof insertVesselRankSchema>;
export type VesselRank = typeof vesselRanks.$inferSelect;
export type InsertDataMaster = z.infer<typeof insertDataMasterSchema>;
export type DataMaster = typeof dataMasters.$inferSelect;
export type InsertMasterDataEntry = z.infer<typeof insertMasterDataEntrySchema>;
export type MasterDataEntry = typeof masterDataEntries.$inferSelect;
