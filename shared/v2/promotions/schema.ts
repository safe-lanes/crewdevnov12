import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const promoCriteriaMasterV2 = pgTable("promo_criteria_master_v2", {
  id: serial("id").primaryKey(),
  criteriaUuid: text("criteria_uuid").notNull().unique(),
  criteriaCode: text("criteria_code").notNull(),
  criteriaLabel: text("criteria_label").notNull(),
  section: text("section"),
  isParent: boolean("is_parent").default(false),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promotionReviewsV2 = pgTable("promotion_reviews_v2", {
  id: serial("id").primaryKey(),
  reviewUuid: text("review_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  promotionToRank: text("promotion_to_rank").notNull(),
  selectedVesselTypeForA23b: text("selected_vessel_type_for_a2_3b"),
  promotionConfirmed: text("promotion_confirmed"),
  vesselAssigned: text("vessel_assigned"),
  promotionDate: text("promotion_date"),
  promotionTiming: text("promotion_timing"),
  partANotes: text("part_a_notes"),
  partBNotes: text("part_b_notes"),
  partCNotes: text("part_c_notes"),
  status: text("status").notNull().default("draft"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoCriteriaStatusV2 = pgTable("promo_criteria_status_v2", {
  id: serial("id").primaryKey(),
  csUuid: text("cs_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  criteriaCode: text("criteria_code").notNull(),
  verifiedStatus: text("verified_status"),
  meetsStatus: text("meets_status"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoCesTestsV2 = pgTable("promo_ces_tests_v2", {
  id: serial("id").primaryKey(),
  ctUuid: text("ct_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  testId: text("test_id"),
  description: text("description"),
  date: text("date"),
  minScore: text("min_score"),
  score: text("score"),
  result: text("result"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoCriteriaCommentsV2 = pgTable("promo_criteria_comments_v2", {
  id: serial("id").primaryKey(),
  ccUuid: text("cc_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  criteriaCode: text("criteria_code").notNull(),
  commentId: text("comment_id"),
  commentUser: text("comment_user"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoTrainingCommentsV2 = pgTable("promo_training_comments_v2", {
  id: serial("id").primaryKey(),
  tcUuid: text("tc_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  trainingRowId: text("training_row_id").notNull(),
  commentId: text("comment_id"),
  commentUser: text("comment_user"),
  commentText: text("comment_text"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoTrainingNeedsV2 = pgTable("promo_training_needs_v2", {
  id: serial("id").primaryKey(),
  tnUuid: text("tn_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  trainingRowId: text("training_row_id"),
  training: text("training"),
  correspondingInDb: text("corresponding_in_db"),
  category: text("category"),
  status: text("status"),
  completionDate: text("completion_date"),
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoApprovalsV2 = pgTable("promo_approvals_v2", {
  id: serial("id").primaryKey(),
  apUuid: text("ap_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  approverId: text("approver_id"),
  date: text("date"),
  approver: text("approver"),
  status: text("status"),
  approval: text("approval"),
  comments: text("comments"),
  isFromPartA: boolean("is_from_part_a").default(false),
  isSelectedForSubmission: boolean("is_selected_for_submission").default(false),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const promoChecklistProgressV2 = pgTable("promo_checklist_progress_v2", {
  id: serial("id").primaryKey(),
  cpUuid: text("cp_uuid").notNull().unique(),
  reviewUuid: text("review_uuid").notNull(),
  sectionId: text("section_id").notNull(),
  assessmentPointId: text("assessment_point_id").notNull(),
  completed: boolean("completed").default(false),
  sectionTitle: text("section_title"),
  assessmentPointText: text("assessment_point_text"),
  verifierName: text("verifier_name"),
  verifierRank: text("verifier_rank"),
  date: text("date"),
  verificationsData: text("verifications_data"),
  commentsData: text("comments_data"),
  attachmentsData: text("attachments_data"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});
