
import { mysqlTable, text, int, boolean, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const forms = mysqlTable("forms", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  rankGroup: text("rank_group").notNull(),
  versionNo: text("version_no").notNull(),
  versionDate: text("version_date").notNull(),
  configuration: text("configuration", { length: 65535 }), // JSON string for form configuration
});

export const rankGroups = mysqlTable("rank_groups", {
  id: int("id").primaryKey().autoincrement(),
  formId: int("form_id").notNull().references(() => forms.id),
  name: text("name").notNull(),
  ranks: text("ranks").notNull(), // JSON string for MySQL compatibility
});

export const availableRanks = mysqlTable("available_ranks", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Senior Officers, Junior Officers, Ratings, etc.
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
  appraisalData: text("appraisal_data", { length: 65535 }).notNull(), // JSON string
  competenceRating: text("competence_rating"),
  behavioralRating: text("behavioral_rating"),
  overallRating: text("overall_rating"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull().default("draft"), // draft, submitted, approved
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
});

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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Form = typeof forms.$inferSelect;
export type InsertRankGroup = z.infer<typeof insertRankGroupSchema>;
export type RankGroup = typeof rankGroups.$inferSelect;
export type InsertAvailableRank = z.infer<typeof insertAvailableRankSchema>;
export type AvailableRank = typeof availableRanks.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertAppraisalResult = z.infer<typeof insertAppraisalResultSchema>;
export type AppraisalResult = typeof appraisalResults.$inferSelect;
