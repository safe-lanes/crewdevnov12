import { pgTable, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

const rotationDraftsAuditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const rotationDraftsV2 = pgTable("rotation_drafts_v2", {
  id: serial("id").primaryKey(),
  draftUuid: text("draft_uuid").notNull().unique(),
  draftId: text("draft_id").notNull(),
  lastEdited: text("last_edited"),
  planFromDate: text("plan_from_date").notNull(),
  planToDate: text("plan_to_date").notNull(),
  createdByUuid: text("created_by_uuid"),
  planStatus: text("plan_status").default("In Draft"),
  proposedByUuid: text("proposed_by_uuid"),
  proposedDate: text("proposed_date"),
  updatedByUuid: text("updated_by_uuid"),
  previousPlanStatus: text("previous_plan_status"),
  ...rotationDraftsAuditColumns,
});

export const rotationDraftVesselsV2 = pgTable("rotation_draft_vessels_v2", {
  id: serial("id").primaryKey(),
  rvUuid: text("rv_uuid").notNull().unique(),
  draftUuid: text("draft_uuid").notNull(),
  vesselUuid: text("vessel_uuid").notNull(),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const rotationDraftRanksV2 = pgTable("rotation_draft_ranks_v2", {
  id: serial("id").primaryKey(),
  rrUuid: text("rr_uuid").notNull().unique(),
  draftUuid: text("draft_uuid").notNull(),
  rankName: text("rank_name").notNull(),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const rotationEntriesV2 = pgTable("rotation_entries_v2", {
  id: serial("id").primaryKey(),
  entryUuid: text("entry_uuid").notNull().unique(),
  draftUuid: text("draft_uuid").notNull(),
  vesselUuid: text("vessel_uuid").notNull(),
  activeRevisionUuid: text("active_revision_uuid"),
  rankId: text("rank_id"),
  rank: text("rank").notNull(),
  crewUuid: text("crew_uuid"),
  signOnDate: text("sign_on_date"),
  joiningPortUuid: text("joining_port_uuid"),
  contractPeriod: integer("contract_period"),
  signOffDate: text("sign_off_date"),
  proposalStatus: text("proposal_status").default("Pending"),
  proposedByUuid: text("proposed_by_uuid"),
  proposedDate: text("proposed_date"),
  deployedDate: text("deployed_date"),
  deployedByUuid: text("deployed_by_uuid"),
  rejectionReason: text("rejection_reason"),
  deployedToPlanUuid: text("deployed_to_plan_uuid"),
  currentCrewUuid: text("current_crew_uuid"),
  currentCrewSignOnDate: text("current_crew_sign_on_date"),
  currentCrewContractEnd: text("current_crew_contract_end"),
  currentCrewRangeStart: text("current_crew_range_start"),
  currentCrewRangeEnd: text("current_crew_range_end"),
  ...auditColumns,
});

export const rotationArchiveV2 = pgTable("rotation_archive_v2", {
  id: serial("id").primaryKey(),
  archiveUuid: text("archive_uuid").notNull().unique(),
  draftUuid: text("draft_uuid").notNull(),
  entryUuid: text("entry_uuid"),
  vesselUuid: text("vessel_uuid").notNull(),
  rank: text("rank").notNull(),
  crewUuid: text("crew_uuid").notNull(),
  crewName: text("crew_name"),
  signOnDate: text("sign_on_date"),
  joiningPortUuid: text("joining_port_uuid"),
  contractPeriod: integer("contract_period"),
  result: text("result").notNull(),
  archivedByUuid: text("archived_by_uuid"),
  archivedDate: text("archived_date"),
  currentCrewUuid: text("current_crew_uuid"),
  currentCrewName: text("current_crew_name"),
  currentCrewSignOnDate: text("current_crew_sign_on_date"),
  currentCrewContractEnd: text("current_crew_contract_end"),
  currentCrewRangeStart: text("current_crew_range_start"),
  currentCrewRangeEnd: text("current_crew_range_end"),
  deployedToPlanUuid: text("deployed_to_plan_uuid"),
  rejectionReason: text("rejection_reason"),
  snapshotData: jsonb("snapshot_data"),
  sourcePlanId: integer("source_plan_id"),
  ...auditColumns,
});

export const insertRotationDraftsV2Schema = createInsertSchema(rotationDraftsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRotationDraftVesselsV2Schema = createInsertSchema(rotationDraftVesselsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRotationDraftRanksV2Schema = createInsertSchema(rotationDraftRanksV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRotationEntriesV2Schema = createInsertSchema(rotationEntriesV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRotationArchiveV2Schema = createInsertSchema(rotationArchiveV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRotationDraftsV2 = z.infer<typeof insertRotationDraftsV2Schema>;
export type RotationDraftsV2 = typeof rotationDraftsV2.$inferSelect;
export type InsertRotationDraftVesselsV2 = z.infer<typeof insertRotationDraftVesselsV2Schema>;
export type RotationDraftVesselsV2 = typeof rotationDraftVesselsV2.$inferSelect;
export type InsertRotationDraftRanksV2 = z.infer<typeof insertRotationDraftRanksV2Schema>;
export type RotationDraftRanksV2 = typeof rotationDraftRanksV2.$inferSelect;
export type InsertRotationEntriesV2 = z.infer<typeof insertRotationEntriesV2Schema>;
export type RotationEntriesV2 = typeof rotationEntriesV2.$inferSelect;
export type InsertRotationArchiveV2 = z.infer<typeof insertRotationArchiveV2Schema>;
export type RotationArchiveV2 = typeof rotationArchiveV2.$inferSelect;
