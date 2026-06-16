import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";
import {
  promoCriteriaMasterV2,
  promotionReviewsV2,
  promoCriteriaStatusV2,
  promoCesTestsV2,
  promoCriteriaCommentsV2,
  promoTrainingCommentsV2,
  promoTrainingNeedsV2,
  promoApprovalsV2,
  promoChecklistProgressV2,
  promoSuitabilityV2,
  promoExecutionLedgerV2,
} from "./schema";

export const insertPromoCriteriaMasterV2Schema = createInsertSchema(promoCriteriaMasterV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoCriteriaMasterV2 = z.infer<typeof insertPromoCriteriaMasterV2Schema>;
export type PromoCriteriaMasterV2 = typeof promoCriteriaMasterV2.$inferSelect;

export const insertPromotionReviewV2Schema = createInsertSchema(promotionReviewsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromotionReviewV2 = z.infer<typeof insertPromotionReviewV2Schema>;
export type PromotionReviewV2 = typeof promotionReviewsV2.$inferSelect;

export const insertPromoCriteriaStatusV2Schema = createInsertSchema(promoCriteriaStatusV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoCriteriaStatusV2 = z.infer<typeof insertPromoCriteriaStatusV2Schema>;
export type PromoCriteriaStatusV2 = typeof promoCriteriaStatusV2.$inferSelect;

export const insertPromoCesTestV2Schema = createInsertSchema(promoCesTestsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoCesTestV2 = z.infer<typeof insertPromoCesTestV2Schema>;
export type PromoCesTestV2 = typeof promoCesTestsV2.$inferSelect;

export const insertPromoCriteriaCommentV2Schema = createInsertSchema(promoCriteriaCommentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoCriteriaCommentV2 = z.infer<typeof insertPromoCriteriaCommentV2Schema>;
export type PromoCriteriaCommentV2 = typeof promoCriteriaCommentsV2.$inferSelect;

export const insertPromoTrainingCommentV2Schema = createInsertSchema(promoTrainingCommentsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoTrainingCommentV2 = z.infer<typeof insertPromoTrainingCommentV2Schema>;
export type PromoTrainingCommentV2 = typeof promoTrainingCommentsV2.$inferSelect;

export const insertPromoTrainingNeedV2Schema = createInsertSchema(promoTrainingNeedsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoTrainingNeedV2 = z.infer<typeof insertPromoTrainingNeedV2Schema>;
export type PromoTrainingNeedV2 = typeof promoTrainingNeedsV2.$inferSelect;

export const insertPromoApprovalV2Schema = createInsertSchema(promoApprovalsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoApprovalV2 = z.infer<typeof insertPromoApprovalV2Schema>;
export type PromoApprovalV2 = typeof promoApprovalsV2.$inferSelect;

export const insertPromoChecklistProgressV2Schema = createInsertSchema(promoChecklistProgressV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoChecklistProgressV2 = z.infer<typeof insertPromoChecklistProgressV2Schema>;
export type PromoChecklistProgressV2 = typeof promoChecklistProgressV2.$inferSelect;

export const insertPromoSuitabilityV2Schema = createInsertSchema(promoSuitabilityV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoSuitabilityV2 = z.infer<typeof insertPromoSuitabilityV2Schema>;
export type PromoSuitabilityV2 = typeof promoSuitabilityV2.$inferSelect;

export const insertPromoExecutionLedgerV2Schema = createInsertSchema(promoExecutionLedgerV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromoExecutionLedgerV2 = z.infer<typeof insertPromoExecutionLedgerV2Schema>;
export type PromoExecutionLedgerV2 = typeof promoExecutionLedgerV2.$inferSelect;
