import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const vesselPlanningV2 = pgTable("vessel_planning_v2", {
  id: serial("id").primaryKey(),
  planUuid: text("plan_uuid").notNull().unique(),
  vesselUuid: text("vessel_uuid").notNull(),
  activeRevisionUuid: text("active_revision_uuid"),
  rankId: text("rank_id").notNull(),
  rank: text("rank").notNull(),
  crewUuid: text("crew_uuid"),
  crewStatus: text("crew_status").default("primary"),
  signOnDate: text("sign_on_date"),
  reliefDue: text("relief_due"),
  signOffDate: text("sign_off_date"),
  signOffPortUuid: text("sign_off_port_uuid"),
  signOffReason: text("sign_off_reason"),
  reliefStatus: text("relief_status"),
  takeOverDate: text("take_over_date"),
  takeOverConfirmation: boolean("take_over_confirmation").default(false),
  handOverDate: text("hand_over_date"),
  relieverCrewUuid: text("reliever_crew_uuid"),
  relieverSignOnDate: text("reliever_sign_on_date"),
  joiningPortUuid: text("joining_port_uuid"),
  joiningStatus: text("joining_status"),
  contractPeriodMonths: integer("contract_period_months"),
  contractEndRangeStartMonths: integer("contract_end_range_start_months"),
  contractEndRangeEndMonths: integer("contract_end_range_end_months"),
  relieverContractPeriodMonths: integer("reliever_contract_period_months"),
  relieverContractEndRangeStartMonths: integer("reliever_contract_end_range_start_months"),
  relieverContractEndRangeEndMonths: integer("reliever_contract_end_range_end_months"),
  deploymentChecklistCompleted: boolean("deployment_checklist_completed"),
  applicableDocsChecked: boolean("applicable_docs_checked"),
  isArchived: boolean("is_archived").default(false),
  archivedDate: text("archived_date"),
  ...auditColumns,
});

export const vesselPlanningAttachmentsV2 = pgTable("vessel_planning_attachments_v2", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  planUuid: text("plan_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  uploadedByUuid: text("uploaded_by_uuid"),
  uploadDate: text("upload_date"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const insertVesselPlanningV2Schema = createInsertSchema(vesselPlanningV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVesselPlanningAttachmentsV2Schema = createInsertSchema(vesselPlanningAttachmentsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVesselPlanningV2 = z.infer<typeof insertVesselPlanningV2Schema>;
export type VesselPlanningV2 = typeof vesselPlanningV2.$inferSelect;
export type InsertVesselPlanningAttachmentsV2 = z.infer<typeof insertVesselPlanningAttachmentsV2Schema>;
export type VesselPlanningAttachmentsV2 = typeof vesselPlanningAttachmentsV2.$inferSelect;
