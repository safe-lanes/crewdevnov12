import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  rhVesselRecordsV2,
  rhCrewRecordsV2,
  rhDailyRecordsV2,
  rhVesselViolationCommentsV2,
  rhOfficeViolationCommentsV2,
  rhNcReportsV2,
  rhFixedTasksV2,
  rhVariableTasksV2,
  rhDatelineAdjustmentsV2,
} from "./schema";

// ============================================
// VESSEL RECORDS
// ============================================
export const insertRhVesselRecordV2Schema = createInsertSchema(rhVesselRecordsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhVesselRecordV2 = z.infer<typeof insertRhVesselRecordV2Schema>;
export type RhVesselRecordV2 = typeof rhVesselRecordsV2.$inferSelect;

// ============================================
// CREW RECORDS
// ============================================
export const insertRhCrewRecordV2Schema = createInsertSchema(rhCrewRecordsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhCrewRecordV2 = z.infer<typeof insertRhCrewRecordV2Schema>;
export type RhCrewRecordV2 = typeof rhCrewRecordsV2.$inferSelect;

// ============================================
// DAILY RECORDS
// ============================================
export const insertRhDailyRecordV2Schema = createInsertSchema(rhDailyRecordsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhDailyRecordV2 = z.infer<typeof insertRhDailyRecordV2Schema>;
export type RhDailyRecordV2 = typeof rhDailyRecordsV2.$inferSelect;

// ============================================
// VESSEL VIOLATION COMMENTS
// ============================================
export const insertRhVesselViolationCommentV2Schema = createInsertSchema(rhVesselViolationCommentsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhVesselViolationCommentV2 = z.infer<typeof insertRhVesselViolationCommentV2Schema>;
export type RhVesselViolationCommentV2 = typeof rhVesselViolationCommentsV2.$inferSelect;

// ============================================
// OFFICE VIOLATION COMMENTS
// ============================================
export const insertRhOfficeViolationCommentV2Schema = createInsertSchema(rhOfficeViolationCommentsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhOfficeViolationCommentV2 = z.infer<typeof insertRhOfficeViolationCommentV2Schema>;
export type RhOfficeViolationCommentV2 = typeof rhOfficeViolationCommentsV2.$inferSelect;

// ============================================
// NC REPORTS
// ============================================
export const insertRhNcReportV2Schema = createInsertSchema(rhNcReportsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhNcReportV2 = z.infer<typeof insertRhNcReportV2Schema>;
export type RhNcReportV2 = typeof rhNcReportsV2.$inferSelect;

// ============================================
// FIXED TASKS
// ============================================
export const insertRhFixedTaskV2Schema = createInsertSchema(rhFixedTasksV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhFixedTaskV2 = z.infer<typeof insertRhFixedTaskV2Schema>;
export type RhFixedTaskV2 = typeof rhFixedTasksV2.$inferSelect;

// ============================================
// VARIABLE TASKS
// ============================================
export const insertRhVariableTaskV2Schema = createInsertSchema(rhVariableTasksV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhVariableTaskV2 = z.infer<typeof insertRhVariableTaskV2Schema>;
export type RhVariableTaskV2 = typeof rhVariableTasksV2.$inferSelect;

// ============================================
// DATELINE ADJUSTMENTS
// ============================================
export const insertRhDatelineAdjustmentV2Schema = createInsertSchema(rhDatelineAdjustmentsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRhDatelineAdjustmentV2 = z.infer<typeof insertRhDatelineAdjustmentV2Schema>;
export type RhDatelineAdjustmentV2 = typeof rhDatelineAdjustmentsV2.$inferSelect;

// ============================================
// DATELINE ADJUSTMENT ITEM (for JSON validation)
// ============================================
export const dateLineAdjustmentItemSchema = z.object({
  day: z.number().min(1).max(31),
  type: z.enum(["advanced", "retarded"]),
});
export type DateLineAdjustmentItem = z.infer<typeof dateLineAdjustmentItemSchema>;
