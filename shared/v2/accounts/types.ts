import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  accPayElementsV2,
  accContractsV2,
  accContractPayElementsV2,
  accAllotmentsV2,
  accAdvancesV2,
  accBondItemsV2,
  accPayrunsV2,
  accPayrunEntriesV2,
} from "./schema";

const auditOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================
// PAY ELEMENTS
// ============================================
export const insertAccPayElementV2Schema = createInsertSchema(
  accPayElementsV2,
).omit(auditOmit);
export type InsertAccPayElementV2 = z.infer<typeof insertAccPayElementV2Schema>;
export type AccPayElementV2 = typeof accPayElementsV2.$inferSelect;

// ============================================
// CONTRACTS
// ============================================
export const insertAccContractV2Schema = createInsertSchema(
  accContractsV2,
).omit(auditOmit);
export type InsertAccContractV2 = z.infer<typeof insertAccContractV2Schema>;
export type AccContractV2 = typeof accContractsV2.$inferSelect;

// ============================================
// CONTRACT PAY ELEMENTS
// ============================================
export const insertAccContractPayElementV2Schema = createInsertSchema(
  accContractPayElementsV2,
).omit(auditOmit);
export type InsertAccContractPayElementV2 = z.infer<
  typeof insertAccContractPayElementV2Schema
>;
export type AccContractPayElementV2 =
  typeof accContractPayElementsV2.$inferSelect;

// ============================================
// ALLOTMENTS
// ============================================
export const insertAccAllotmentV2Schema = createInsertSchema(
  accAllotmentsV2,
).omit(auditOmit);
export type InsertAccAllotmentV2 = z.infer<typeof insertAccAllotmentV2Schema>;
export type AccAllotmentV2 = typeof accAllotmentsV2.$inferSelect;

// ============================================
// ADVANCES
// ============================================
export const insertAccAdvanceV2Schema = createInsertSchema(accAdvancesV2).omit(
  auditOmit,
);
export type InsertAccAdvanceV2 = z.infer<typeof insertAccAdvanceV2Schema>;
export type AccAdvanceV2 = typeof accAdvancesV2.$inferSelect;

// ============================================
// BOND ITEMS
// ============================================
export const insertAccBondItemV2Schema = createInsertSchema(
  accBondItemsV2,
).omit(auditOmit);
export type InsertAccBondItemV2 = z.infer<typeof insertAccBondItemV2Schema>;
export type AccBondItemV2 = typeof accBondItemsV2.$inferSelect;

// ============================================
// PAYRUNS
// ============================================
export const insertAccPayrunV2Schema = createInsertSchema(accPayrunsV2).omit(
  auditOmit,
);
export type InsertAccPayrunV2 = z.infer<typeof insertAccPayrunV2Schema>;
export type AccPayrunV2 = typeof accPayrunsV2.$inferSelect;

// ============================================
// PAYRUN ENTRIES
// ============================================
export const insertAccPayrunEntryV2Schema = createInsertSchema(
  accPayrunEntriesV2,
).omit(auditOmit);
export type InsertAccPayrunEntryV2 = z.infer<
  typeof insertAccPayrunEntryV2Schema
>;
export type AccPayrunEntryV2 = typeof accPayrunEntriesV2.$inferSelect;
