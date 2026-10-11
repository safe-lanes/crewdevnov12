import { boolean, check, foreignKey, index, pgTable, serial, text, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { admFormVersionsV2, admFormsV2 } from "../admin/schema";
import { crewAssignments } from "../crew-pool/schema";
import { frmSubjectStages, frmSubjectTypes } from "./subjectRegistry";

export const frmCompanySubmissions = pgTable("frm_company_submissions", {
  id: serial("id").primaryKey(),
  submissionUuid: text("submission_uuid").notNull().unique(),
  subjectType: text("subject_type").notNull(),
  subjectRef: text("subject_ref").notNull(),
  formUuid: text("form_uuid").notNull(),
  formVersionUuid: text("form_version_uuid").notNull(),
  stageKey: text("stage_key"),
  status: text("status").notNull().default("in_progress"),
  origin: text("origin").notNull().default("MANUAL"),
  requirementUuid: text("requirement_uuid"),
  completedAt: timestamp("completed_at"),
  voidedAt: timestamp("voided_at"),
  voidedByUuid: text("voided_by_uuid"),
  voidedByName: text("voided_by_name"),
  voidedByDesignation: text("voided_by_designation"),
  applicableSectionUuids: jsonb("applicable_section_uuids").$type<string[]>(),
  voidReason: text("void_reason"),
  voidedPreviousStatus: text("voided_previous_status"),
  replacedBySubmissionUuid: text("replaced_by_submission_uuid"),
  replacesSubmissionUuid: text("replaces_submission_uuid"),
  systemSnapshotAt: timestamp("system_snapshot_at"),
  systemSnapshotEvent: text("system_snapshot_event"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  subjectFk: foreignKey({
    name: "fk_frm_company_submissions_subject",
    columns: [table.subjectType],
    foreignColumns: [frmSubjectTypes.subjectType],
  }).onDelete("restrict").onUpdate("restrict"),
  formFk: foreignKey({
    name: "fk_frm_company_submissions_form",
    columns: [table.formUuid],
    foreignColumns: [admFormsV2.formUuid],
  }).onDelete("restrict").onUpdate("cascade"),
  formSubjectFk: foreignKey({
    name: "fk_frm_company_submissions_form_subject",
    columns: [table.formUuid, table.subjectType],
    foreignColumns: [admFormsV2.formUuid, admFormsV2.subjectType],
  }).onDelete("restrict").onUpdate("restrict"),
  replacedByFk: foreignKey({
    name: "fk_frm_company_submissions_replaced_by",
    columns: [table.replacedBySubmissionUuid],
    foreignColumns: [table.submissionUuid],
  }).onDelete("restrict").onUpdate("restrict"),
  replacesFk: foreignKey({
    name: "fk_frm_company_submissions_replaces",
    columns: [table.replacesSubmissionUuid],
    foreignColumns: [table.submissionUuid],
  }).onDelete("restrict").onUpdate("restrict"),
  versionFk: foreignKey({
    name: "fk_frm_company_submissions_version",
    columns: [table.formVersionUuid],
    foreignColumns: [admFormVersionsV2.fvUuid],
  }).onDelete("restrict").onUpdate("cascade"),
  stageFk: foreignKey({
    name: "fk_frm_company_submissions_stage",
    columns: [table.subjectType, table.stageKey],
    foreignColumns: [frmSubjectStages.subjectType, frmSubjectStages.stageKey],
  }).onDelete("restrict").onUpdate("restrict"),
  formSubjectRefUnique: uniqueIndex("uq_frm_company_submissions_form_subject_ref")
    .on(table.formUuid, table.subjectType, table.subjectRef)
    .where(sql`${table.status} <> 'voided'`),
  subjectRefIdx: index("idx_frm_company_submissions_subject_ref")
    .on(table.subjectType, table.subjectRef),
  statusCheck: check("ck_frm_company_submissions_status", sql`${table.status} IN ('in_progress', 'completed', 'voided')`),
  completedAtCheck: check(
    "ck_frm_company_submissions_completed_at",
    sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL)
      OR (${table.status} = 'in_progress' AND ${table.completedAt} IS NULL)
      OR (${table.status} = 'voided')`,
  ),
  voidedAuditCheck: check("ck_frm_company_submissions_voided_audit", sql`
    (${table.status} = 'voided'
      AND ${table.voidedAt} IS NOT NULL
      AND ${table.voidedByUuid} IS NOT NULL
      AND ${table.voidedByName} IS NOT NULL
      AND BTRIM(${table.voidedByName}) <> ''
      AND ${table.voidReason} IS NOT NULL
      AND BTRIM(${table.voidReason}) <> ''
      AND ${table.voidedPreviousStatus} IN ('in_progress', 'completed'))
    OR (${table.status} <> 'voided'
      AND ${table.voidedAt} IS NULL
      AND ${table.voidedByUuid} IS NULL
      AND ${table.voidedByName} IS NULL
      AND ${table.voidReason} IS NULL
      AND ${table.voidedPreviousStatus} IS NULL)
  `),
  systemSnapshotCheck: check("ck_frm_company_submissions_system_snapshot", sql`
    (${table.systemSnapshotAt} IS NULL AND ${table.systemSnapshotEvent} IS NULL)
    OR (${table.systemSnapshotAt} IS NOT NULL
      AND ${table.systemSnapshotEvent} IN ('section_submission', 'signature'))
  `),
}));

/**
 * Point-in-time System values. A row with a NULL value is an intentional frozen
 * NULL; no rows at all means no snapshot was ever recorded (legacy included).
 */
export const frmCompanySubmissionSystemSnapshots = pgTable("frm_company_submission_system_snapshots", {
  id: serial("id").primaryKey(),
  snapshotUuid: text("snapshot_uuid").notNull().unique(),
  submissionUuid: text("submission_uuid").notNull()
    .references(() => frmCompanySubmissions.submissionUuid, { onDelete: "restrict", onUpdate: "cascade" }),
  fieldKey: text("field_key").notNull(),
  sectionUuid: text("section_uuid").notNull(),
  questionUuid: text("question_uuid").notNull(),
  value: text("value"),
  systemValue: text("system_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdByUuid: text("created_by_uuid").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isSync: boolean("is_sync").notNull().default(false),
}, (table) => ({
  snapshotValueUnique: uniqueIndex("uq_frm_company_submission_system_snapshot_value")
    .on(table.submissionUuid, table.questionUuid),
  submissionIdx: index("idx_frm_company_submission_system_snapshots_submission")
    .on(table.submissionUuid),
}));

export const frmCompanySubmissionAssignments = pgTable("frm_company_submission_assignments", {
  id: serial("id").primaryKey(),
  submissionUuid: text("submission_uuid").notNull().unique(),
  assignUuid: text("assign_uuid").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
}, (table) => ({
  submissionFk: foreignKey({
    name: "fk_frm_company_submission_assignments_submission",
    columns: [table.submissionUuid],
    foreignColumns: [frmCompanySubmissions.submissionUuid],
  }).onDelete("restrict").onUpdate("cascade"),
  assignmentFk: foreignKey({
    name: "fk_frm_company_submission_assignments_assignment",
    columns: [table.assignUuid],
    foreignColumns: [crewAssignments.assignUuid],
  }).onDelete("restrict").onUpdate("cascade"),
}));