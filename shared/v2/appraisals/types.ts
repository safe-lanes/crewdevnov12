import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import {
  appraisalResultsV2,
  apprTrainingsV2,
  apprTargetsV2,
  apprCompetenceAssessmentsV2,
  apprBehaviouralAssessmentsV2,
  apprTrainingNeedsV2,
  apprRecommendationsV2,
  apprAppraiserCommentsV2,
  apprSeafarerCommentsV2,
  apprOfficeReviewsV2,
  apprTrainingFollowupsV2,
} from "./schema";

export const insertAppraisalResultV2Schema = createInsertSchema(appraisalResultsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppraisalResultV2 = z.infer<typeof insertAppraisalResultV2Schema>;
export type AppraisalResultV2 = typeof appraisalResultsV2.$inferSelect;

export const insertApprTrainingV2Schema = createInsertSchema(apprTrainingsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprTrainingV2 = z.infer<typeof insertApprTrainingV2Schema>;
export type ApprTrainingV2 = typeof apprTrainingsV2.$inferSelect;

export const insertApprTargetV2Schema = createInsertSchema(apprTargetsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprTargetV2 = z.infer<typeof insertApprTargetV2Schema>;
export type ApprTargetV2 = typeof apprTargetsV2.$inferSelect;

export const insertApprCompetenceAssessmentV2Schema = createInsertSchema(apprCompetenceAssessmentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprCompetenceAssessmentV2 = z.infer<typeof insertApprCompetenceAssessmentV2Schema>;
export type ApprCompetenceAssessmentV2 = typeof apprCompetenceAssessmentsV2.$inferSelect;

export const insertApprBehaviouralAssessmentV2Schema = createInsertSchema(apprBehaviouralAssessmentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprBehaviouralAssessmentV2 = z.infer<typeof insertApprBehaviouralAssessmentV2Schema>;
export type ApprBehaviouralAssessmentV2 = typeof apprBehaviouralAssessmentsV2.$inferSelect;

export const insertApprTrainingNeedV2Schema = createInsertSchema(apprTrainingNeedsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprTrainingNeedV2 = z.infer<typeof insertApprTrainingNeedV2Schema>;
export type ApprTrainingNeedV2 = typeof apprTrainingNeedsV2.$inferSelect;

export const insertApprRecommendationV2Schema = createInsertSchema(apprRecommendationsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprRecommendationV2 = z.infer<typeof insertApprRecommendationV2Schema>;
export type ApprRecommendationV2 = typeof apprRecommendationsV2.$inferSelect;

export const insertApprAppraiserCommentV2Schema = createInsertSchema(apprAppraiserCommentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprAppraiserCommentV2 = z.infer<typeof insertApprAppraiserCommentV2Schema>;
export type ApprAppraiserCommentV2 = typeof apprAppraiserCommentsV2.$inferSelect;

export const insertApprSeafarerCommentV2Schema = createInsertSchema(apprSeafarerCommentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprSeafarerCommentV2 = z.infer<typeof insertApprSeafarerCommentV2Schema>;
export type ApprSeafarerCommentV2 = typeof apprSeafarerCommentsV2.$inferSelect;

export const insertApprOfficeReviewV2Schema = createInsertSchema(apprOfficeReviewsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprOfficeReviewV2 = z.infer<typeof insertApprOfficeReviewV2Schema>;
export type ApprOfficeReviewV2 = typeof apprOfficeReviewsV2.$inferSelect;

export const insertApprTrainingFollowupV2Schema = createInsertSchema(apprTrainingFollowupsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprTrainingFollowupV2 = z.infer<typeof insertApprTrainingFollowupV2Schema>;
export type ApprTrainingFollowupV2 = typeof apprTrainingFollowupsV2.$inferSelect;
