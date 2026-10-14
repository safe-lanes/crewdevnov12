import { foreignKey, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const frmSubjectTypes = pgTable("frm_subject_types", {
  subjectType: text("subject_type").primaryKey(),
  label: text("label").notNull(),
});

export const frmSubjectStages = pgTable("frm_subject_stages", {
  subjectType: text("subject_type").notNull(),
  stageKey: text("stage_key").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  subjectStagePk: primaryKey({
    name: "pk_frm_subject_stages",
    columns: [table.subjectType, table.stageKey],
  }),
  subjectFk: foreignKey({
    name: "fk_frm_subject_stages_subject",
    columns: [table.subjectType],
    foreignColumns: [frmSubjectTypes.subjectType],
  }).onDelete("restrict").onUpdate("restrict"),
}));