import { boolean, check, foreignKey, index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  completedAt: timestamp("completed_at"),
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
    .on(table.formUuid, table.subjectType, table.subjectRef),
  subjectRefIdx: index("idx_frm_company_submissions_subject_ref")
    .on(table.subjectType, table.subjectRef),
  statusCheck: check("ck_frm_company_submissions_status", sql`${table.status} IN ('in_progress', 'completed')`),
  completedAtCheck: check(
    "ck_frm_company_submissions_completed_at",
    sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL)
      OR (${table.status} = 'in_progress' AND ${table.completedAt} IS NULL)`,
  ),
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