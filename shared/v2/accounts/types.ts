import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  accTenantConfigV2,
  accPayElementsV2,
  accWageScalesV2,
  accWageScaleLinesV2,
  accCbaReferenceV2,
  accEngagementsV2,
  accEngagementPhasesV2,
  accEngagementPayElementsV2,
  accMonthlyTransactionsV2,
  accAdvancesV2,
  accBondItemsV2,
  accAllotmentsV2,
  accCtmV2,
  accCtmLinesV2,
  accPortageBillsV2,
  accPortageApprovalsV2,
  accCalculationRunsV2,
  accWageLedgerV2,
  accSettlementsV2,
  accSettlementAdjustmentsV2,
  accSettlementApprovalsV2,
} from "./schema";

const auditOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================
// A. TENANT CONFIGURATION
// ============================================
export const insertAccTenantConfigV2Schema = createInsertSchema(
  accTenantConfigV2,
).omit(auditOmit);
export type InsertAccTenantConfigV2 = z.infer<
  typeof insertAccTenantConfigV2Schema
>;
export type AccTenantConfigV2 = typeof accTenantConfigV2.$inferSelect;

// ============================================
// B. MASTER TIER
// ============================================
export const insertAccPayElementV2Schema = createInsertSchema(
  accPayElementsV2,
).omit(auditOmit);
export type InsertAccPayElementV2 = z.infer<typeof insertAccPayElementV2Schema>;
export type AccPayElementV2 = typeof accPayElementsV2.$inferSelect;

export const insertAccWageScaleV2Schema = createInsertSchema(
  accWageScalesV2,
).omit(auditOmit);
export type InsertAccWageScaleV2 = z.infer<typeof insertAccWageScaleV2Schema>;
export type AccWageScaleV2 = typeof accWageScalesV2.$inferSelect;

export const insertAccWageScaleLineV2Schema = createInsertSchema(
  accWageScaleLinesV2,
).omit(auditOmit);
export type InsertAccWageScaleLineV2 = z.infer<
  typeof insertAccWageScaleLineV2Schema
>;
export type AccWageScaleLineV2 = typeof accWageScaleLinesV2.$inferSelect;

export const insertAccCbaReferenceV2Schema = createInsertSchema(
  accCbaReferenceV2,
).omit(auditOmit);
export type InsertAccCbaReferenceV2 = z.infer<
  typeof insertAccCbaReferenceV2Schema
>;
export type AccCbaReferenceV2 = typeof accCbaReferenceV2.$inferSelect;

// ============================================
// C. ENGAGEMENT TIER
// ============================================
export const insertAccEngagementV2Schema = createInsertSchema(
  accEngagementsV2,
).omit(auditOmit);
export type InsertAccEngagementV2 = z.infer<typeof insertAccEngagementV2Schema>;
export type AccEngagementV2 = typeof accEngagementsV2.$inferSelect;

export const insertAccEngagementPhaseV2Schema = createInsertSchema(
  accEngagementPhasesV2,
).omit(auditOmit);
export type InsertAccEngagementPhaseV2 = z.infer<
  typeof insertAccEngagementPhaseV2Schema
>;
export type AccEngagementPhaseV2 = typeof accEngagementPhasesV2.$inferSelect;

export const insertAccEngagementPayElementV2Schema = createInsertSchema(
  accEngagementPayElementsV2,
).omit(auditOmit);
export type InsertAccEngagementPayElementV2 = z.infer<
  typeof insertAccEngagementPayElementV2Schema
>;
export type AccEngagementPayElementV2 =
  typeof accEngagementPayElementsV2.$inferSelect;

// ============================================
// D. TRANSACTION TIER
// ============================================
export const insertAccMonthlyTransactionV2Schema = createInsertSchema(
  accMonthlyTransactionsV2,
).omit(auditOmit);
export type InsertAccMonthlyTransactionV2 = z.infer<
  typeof insertAccMonthlyTransactionV2Schema
>;
export type AccMonthlyTransactionV2 =
  typeof accMonthlyTransactionsV2.$inferSelect;

export const insertAccAdvanceV2Schema = createInsertSchema(accAdvancesV2).omit(
  auditOmit,
);
export type InsertAccAdvanceV2 = z.infer<typeof insertAccAdvanceV2Schema>;
export type AccAdvanceV2 = typeof accAdvancesV2.$inferSelect;

export const insertAccBondItemV2Schema = createInsertSchema(
  accBondItemsV2,
).omit(auditOmit);
export type InsertAccBondItemV2 = z.infer<typeof insertAccBondItemV2Schema>;
export type AccBondItemV2 = typeof accBondItemsV2.$inferSelect;

export const insertAccAllotmentV2Schema = createInsertSchema(
  accAllotmentsV2,
).omit(auditOmit);
export type InsertAccAllotmentV2 = z.infer<typeof insertAccAllotmentV2Schema>;
export type AccAllotmentV2 = typeof accAllotmentsV2.$inferSelect;

export const insertAccCtmV2Schema = createInsertSchema(accCtmV2).omit(
  auditOmit,
);
export type InsertAccCtmV2 = z.infer<typeof insertAccCtmV2Schema>;
export type AccCtmV2 = typeof accCtmV2.$inferSelect;

export const insertAccCtmLineV2Schema = createInsertSchema(accCtmLinesV2).omit(
  auditOmit,
);
export type InsertAccCtmLineV2 = z.infer<typeof insertAccCtmLineV2Schema>;
export type AccCtmLineV2 = typeof accCtmLinesV2.$inferSelect;

// ============================================
// E. LEDGER & LIFECYCLE
// ============================================
export const insertAccPortageBillV2Schema = createInsertSchema(
  accPortageBillsV2,
).omit(auditOmit);
export type InsertAccPortageBillV2 = z.infer<
  typeof insertAccPortageBillV2Schema
>;
export type AccPortageBillV2 = typeof accPortageBillsV2.$inferSelect;

export const insertAccPortageApprovalV2Schema = createInsertSchema(
  accPortageApprovalsV2,
).omit(auditOmit);
export type InsertAccPortageApprovalV2 = z.infer<
  typeof insertAccPortageApprovalV2Schema
>;
export type AccPortageApprovalV2 = typeof accPortageApprovalsV2.$inferSelect;

export const insertAccCalculationRunV2Schema = createInsertSchema(
  accCalculationRunsV2,
).omit(auditOmit);
export type InsertAccCalculationRunV2 = z.infer<
  typeof insertAccCalculationRunV2Schema
>;
export type AccCalculationRunV2 = typeof accCalculationRunsV2.$inferSelect;

export const insertAccWageLedgerV2Schema = createInsertSchema(
  accWageLedgerV2,
).omit(auditOmit);
export type InsertAccWageLedgerV2 = z.infer<typeof insertAccWageLedgerV2Schema>;
export type AccWageLedgerV2 = typeof accWageLedgerV2.$inferSelect;

export const insertAccSettlementV2Schema = createInsertSchema(
  accSettlementsV2,
).omit(auditOmit);
export type InsertAccSettlementV2 = z.infer<typeof insertAccSettlementV2Schema>;
export type AccSettlementV2 = typeof accSettlementsV2.$inferSelect;

export const insertAccSettlementAdjustmentV2Schema = createInsertSchema(
  accSettlementAdjustmentsV2,
).omit(auditOmit);
export type InsertAccSettlementAdjustmentV2 = z.infer<
  typeof insertAccSettlementAdjustmentV2Schema
>;
export type AccSettlementAdjustmentV2 =
  typeof accSettlementAdjustmentsV2.$inferSelect;

export const insertAccSettlementApprovalV2Schema = createInsertSchema(
  accSettlementApprovalsV2,
).omit(auditOmit);
export type InsertAccSettlementApprovalV2 = z.infer<
  typeof insertAccSettlementApprovalV2Schema
>;
export type AccSettlementApprovalV2 =
  typeof accSettlementApprovalsV2.$inferSelect;
