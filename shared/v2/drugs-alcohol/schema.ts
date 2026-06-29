import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const daTestRecordsV2 = pgTable("da_test_records_v2", {
  id: serial("id").primaryKey(),
  daUuid: text("da_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  testType: text("test_type").notNull(),
  alcoholDrugType: text("alcohol_drug_type"),
  placeLocation: text("place_location"),
  dateTimeTestCompleted: text("date_time_test_completed"),
  externalTestResultsDate: text("external_test_results_date"),
  incidentId: text("incident_id"),
  equipmentNotApplicable: boolean("equipment_not_applicable").default(false),
  testHistory: text("test_history"),
  frequencyMonths: integer("frequency_months").default(12),
  plannedPort: text("planned_port"),
  plannedDate: text("planned_date"),
  plannedComments: text("planned_comments"),
  incidentTitle: text("incident_title"),
  incidentDateTime: text("incident_date_time"),
  alcoholTestDateTime: text("alcohol_test_date_time"),
  drugTestDateTime: text("drug_test_date_time"),
  violations: integer("violations").default(0),
  testDateTime: text("test_date_time"),
  otherTestType: text("other_test_type"),
  reasonForTesting: text("reason_for_testing"),
  description: text("description"),
  initiatedBy: text("initiated_by"),
  comments: text("comments"),
  status: text("status").notNull().default("draft"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const daTestingEquipmentV2 = pgTable("da_testing_equipment_v2", {
  id: serial("id").primaryKey(),
  eqUuid: text("eq_uuid").notNull().unique(),
  testRecordUuid: text("test_record_uuid").notNull(),
  equipmentId: text("equipment_id"),
  makeModel: text("make_model"),
  serialNo: text("serial_no"),
  lastCalibrated: text("last_calibrated"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const daPersonnelTestedV2 = pgTable("da_personnel_tested_v2", {
  id: serial("id").primaryKey(),
  ptUuid: text("pt_uuid").notNull().unique(),
  testRecordUuid: text("test_record_uuid").notNull(),
  crewId: text("crew_id"),
  rank: text("rank"),
  name: text("name"),
  alcoholTestChecked: boolean("alcohol_test_checked").default(false),
  alcoholTestDate: text("alcohol_test_date"),
  alcoholTestTime: text("alcohol_test_time"),
  alcoholResults: text("alcohol_results"),
  alcoholViolation: boolean("alcohol_violation").default(false),
  drugTestChecked: boolean("drug_test_checked").default(false),
  drugTestDate: text("drug_test_date"),
  drugTestTime: text("drug_test_time"),
  drugResults: text("drug_results"),
  drugViolation: boolean("drug_violation").default(false),
  witness: text("witness"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const daSignaturesV2 = pgTable("da_signatures_v2", {
  id: serial("id").primaryKey(),
  sigUuid: text("sig_uuid").notNull().unique(),
  testRecordUuid: text("test_record_uuid").notNull(),
  confirmed: boolean("confirmed").default(false),
  name: text("name"),
  date: text("date"),
  ...auditColumns,
});

export const daAttachmentsV2 = pgTable("da_attachments_v2", {
  id: serial("id").primaryKey(),
  attUuid: text("att_uuid").notNull().unique(),
  testRecordUuid: text("test_record_uuid").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  uploadDate: text("upload_date"),
  uploadedBy: text("uploaded_by"),
  fileSize: text("file_size"),
  filePath: text("file_path"),
  fileData: text("file_data"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const insertDaTestRecordV2Schema = createInsertSchema(daTestRecordsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDaTestingEquipmentV2Schema = createInsertSchema(daTestingEquipmentV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDaPersonnelTestedV2Schema = createInsertSchema(daPersonnelTestedV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDaSignatureV2Schema = createInsertSchema(daSignaturesV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDaAttachmentV2Schema = createInsertSchema(daAttachmentsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DaTestRecordV2 = typeof daTestRecordsV2.$inferSelect;
export type InsertDaTestRecordV2 = z.infer<typeof insertDaTestRecordV2Schema>;

export type DaTestingEquipmentV2 = typeof daTestingEquipmentV2.$inferSelect;
export type InsertDaTestingEquipmentV2 = z.infer<typeof insertDaTestingEquipmentV2Schema>;

export type DaPersonnelTestedV2 = typeof daPersonnelTestedV2.$inferSelect;
export type InsertDaPersonnelTestedV2 = z.infer<typeof insertDaPersonnelTestedV2Schema>;

export type DaSignatureV2 = typeof daSignaturesV2.$inferSelect;
export type InsertDaSignatureV2 = z.infer<typeof insertDaSignatureV2Schema>;

export type DaAttachmentV2 = typeof daAttachmentsV2.$inferSelect;
export type InsertDaAttachmentV2 = z.infer<typeof insertDaAttachmentV2Schema>;
