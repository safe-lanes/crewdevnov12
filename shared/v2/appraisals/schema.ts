import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";



export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const appraisalResultsV2 = pgTable("appraisal_results_v2", {
  id: serial("id").primaryKey(),
  appraisalUuid: text("appraisal_uuid").notNull().unique(),
  crewMemberId: text("crew_member_id").notNull(),
  formUuid: text("form_uuid"),
  formIdLegacy: integer("form_id_legacy"),
  formVersionId: integer("form_version_id"),
  formVersionUuid: text("form_version_uuid"),
  appraisalType: text("appraisal_type").notNull(),
  appraisalDate: text("appraisal_date").notNull(),
  seafarersName: text("seafarers_name"),
  seafarersRank: text("seafarers_rank"),
  nationality: text("nationality"),
  vessel: text("vessel"),
  signOn: text("sign_on"),
  appraisalPeriodFrom: text("appraisal_period_from"),
  appraisalPeriodTo: text("appraisal_period_to"),
  personalityIndexCategory: text("personality_index_category"),
  primaryAppraiser: text("primary_appraiser"),
  competenceRating: text("competence_rating"),
  behavioralRating: text("behavioral_rating"),
  overallRating: text("overall_rating"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull().default("draft"),
  stage1Status: text("stage1_status"),
  stage1SubmittedAt: text("stage1_submitted_at"),
  stage1SubmittedBy: text("stage1_submitted_by"),
  stage2Status: text("stage2_status"),
  stage2SubmittedAt: text("stage2_submitted_at"),
  stage2SubmittedBy: text("stage2_submitted_by"),
  stage3Status: text("stage3_status"),
  stage3SubmittedAt: text("stage3_submitted_at"),
  stage3SubmittedBy: text("stage3_submitted_by"),
  isLockForm: boolean("is_lock_form").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprTrainingsV2 = pgTable("appr_trainings_v2", {
  id: serial("id").primaryKey(),
  trainingUuid: text("training_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  evaluation: text("evaluation"),
  comment: text("comment"),
  source: text("source").notNull().default("manual"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprTargetsV2 = pgTable("appr_targets_v2", {
  id: serial("id").primaryKey(),
  targetUuid: text("target_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  targetSetting: text("target_setting"),
  evaluation: text("evaluation"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprCompetenceAssessmentsV2 = pgTable("appr_competence_assessments_v2", {
  id: serial("id").primaryKey(),
  competenceUuid: text("competence_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  assessmentCriteria: text("assessment_criteria"),
  weight: integer("weight"),
  effectiveness: text("effectiveness"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprBehaviouralAssessmentsV2 = pgTable("appr_behavioural_assessments_v2", {
  id: serial("id").primaryKey(),
  behaviouralUuid: text("behavioural_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  assessmentCriteria: text("assessment_criteria"),
  weight: integer("weight"),
  effectiveness: text("effectiveness"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprTrainingNeedsV2 = pgTable("appr_training_needs_v2", {
  id: serial("id").primaryKey(),
  trainingNeedUuid: text("training_need_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  correspondingInDb: text("corresponding_in_db"),
  identifiedByUuid: text("identified_by_uuid"),
  comment: text("comment"),
  source: text("source").notNull().default("manual"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprRecommendationsV2 = pgTable("appr_recommendations_v2", {
  id: serial("id").primaryKey(),
  recommendationUuid: text("recommendation_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  question: text("question"),
  answer: text("answer"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprAppraiserCommentsV2 = pgTable("appr_appraiser_comments_v2", {
  id: serial("id").primaryKey(),
  appraiserCommentUuid: text("appraiser_comment_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  rank: text("rank"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprSeafarerCommentsV2 = pgTable("appr_seafarer_comments_v2", {
  id: serial("id").primaryKey(),
  seafarerCommentUuid: text("seafarer_comment_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  rank: text("rank"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprOfficeReviewsV2 = pgTable("appr_office_reviews_v2", {
  id: serial("id").primaryKey(),
  officeReviewUuid: text("office_review_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  name: text("name"),
  position: text("position"),
  feedback: text("feedback"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprTrainingFollowupsV2 = pgTable("appr_training_followups_v2", {
  id: serial("id").primaryKey(),
  trainingFollowupUuid: text("training_followup_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  training: text("training"),
  correspondingInDb: text("corresponding_in_db"),
  identifiedByUuid: text("identified_by_uuid"),
  category: text("category"),
  status: text("status"),
  targetDate: text("target_date"),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const apprReviewersV2 = pgTable("appr_reviewers_v2", {
  id: serial("id").primaryKey(),
  reviewerUuid: text("reviewer_uuid").notNull().unique(),
  appraisalUuid: text("appraisal_uuid").notNull(),
  userUuid: text("user_uuid"),
  reviewerName: text("reviewer_name"),
  designation: text("designation"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});
