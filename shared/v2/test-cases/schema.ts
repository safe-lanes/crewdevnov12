import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// STANDARD AUDIT COLUMNS (add to ALL tables)
// ============================================
const auditColumns = {
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

// ============================================
// TEST CASES (Crewing Test Case Manager)
// ============================================
// Allowed values — kept in sync with the DB CHECK constraints (migration 0133)
export const TEST_CASE_MODULES = [
  "Crew Pool",
  "Vessel",
  "Rest Hours",
  "Promotions",
  "Appraisals",
  "Drugs & Alcohol",
  "Recruitment",
  "Rotation",
  "Admin & Masters",
] as const;
export const TEST_CASE_CATEGORIES = ["Functional", "UAT"] as const;
export const TEST_CASE_PRIORITIES = ["High", "Medium", "Low"] as const;

export const testCasesV2 = pgTable("test_cases_v2", {
  id: serial("id").primaryKey(),
  tcUuid: text("tc_uuid").notNull().unique(),
  module: text("module").notNull(),
  reference: text("reference"),
  title: text("title").notNull(),
  areaFeature: text("area_feature"),
  category: text("category").notNull().default("Functional"),
  priority: text("priority").notNull().default("Medium"),
  preconditions: text("preconditions"),
  steps: text("steps"),
  expectedResult: text("expected_result"),
  testData: text("test_data"),
  comments: text("comments"),
  howToTest: text("how_to_test"),
  ...auditColumns,
});

export const insertTestCaseV2Schema = createInsertSchema(testCasesV2, {
  module: z.enum(TEST_CASE_MODULES),
  category: z.enum(TEST_CASE_CATEGORIES).optional(),
  priority: z.enum(TEST_CASE_PRIORITIES).optional(),
}).omit({
  id: true,
  tcUuid: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const updateTestCaseV2Schema = insertTestCaseV2Schema.partial();

export type InsertTestCaseV2 = z.infer<typeof insertTestCaseV2Schema>;
export type TestCaseV2 = typeof testCasesV2.$inferSelect;
