import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { admFormVersionsV2, admFormsV2, admRoleMasterAc } from "../admin/schema";

const auditColumns = {
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const FORM_PART_TYPES = ["fixed", "configurable"] as const;
export const RESPONSIBLE_MODES = ["role", "department", "not_applicable"] as const;
export const QUESTION_RESPONSE_TYPES = [
  "yes_no",
  "yes_no_na",
  "single_select",
  "multi_select",
  "free_text",
  "date",
  "number",
  "checkbox",
  "info_only",
] as const;
export const SECTION_LAYOUT_PREFERENCES = ["auto", "list", "matrix"] as const;

export const frmFormParts = pgTable(
  "frm_form_parts",
  {
    id: serial("id").primaryKey(),
    formPartUuid: text("form_part_uuid").notNull().unique(),
    formUuid: text("form_uuid")
      .notNull()
      .references(() => admFormsV2.formUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    partCode: text("part_code").notNull(),
    partTitle: text("part_title").notNull(),
    partType: text("part_type").notNull(),
    isOfficeOnly: boolean("is_office_only").notNull().default(false),
    ...auditColumns,
  },
  (table) => ({
    formUuidIdx: index("idx_frm_form_parts_form_uuid").on(table.formUuid),
  }),
);

export const frmSections = pgTable(
  "frm_sections",
  {
    id: serial("id").primaryKey(),
    sectionUuid: text("section_uuid").notNull().unique(),
    formVersionUuid: text("form_version_uuid")
      .notNull()
      .references(() => admFormVersionsV2.fvUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    formPartUuid: text("form_part_uuid")
      .notNull()
      .references(() => frmFormParts.formPartUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    sectionCode: text("section_code").notNull(),
    sectionTitle: text("section_title").notNull(),
    applicableVesselTypes: text("applicable_vessel_types"),
    responsibleMode: text("responsible_mode").notNull().default("not_applicable"),
    responsibleRoleUuid: text("responsible_role_uuid").references(() => admRoleMasterAc.ruid, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    responsibleDepartment: text("responsible_department"),
    commentBoxRequired: boolean("comment_box_required").notNull().default(false),
    signatureRequired: boolean("signature_required").notNull().default(false),
    defaultOptionSetUuid: text("default_option_set_uuid"),
    layoutPreference: text("layout_preference").notNull().default("auto"),
    ...auditColumns,
  },
  (table) => ({
    formVersionUuidIdx: index("idx_frm_sections_form_version_uuid").on(table.formVersionUuid),
    formPartUuidIdx: index("idx_frm_sections_form_part_uuid").on(table.formPartUuid),
    responsibleRoleUuidIdx: index("idx_frm_sections_responsible_role_uuid").on(table.responsibleRoleUuid),
    defaultOptionSetUuidIdx: index("idx_frm_sections_default_option_set_uuid").on(table.defaultOptionSetUuid),
  }),
);

export const frmOptionSets = pgTable(
  "frm_option_sets",
  {
    id: serial("id").primaryKey(),
    optionSetUuid: text("option_set_uuid").notNull().unique(),
    formVersionUuid: text("form_version_uuid")
      .notNull()
      .references(() => admFormVersionsV2.fvUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    setName: text("set_name"),
    lowEndLabel: text("low_end_label"),
    highEndLabel: text("high_end_label"),
    ...auditColumns,
  },
  (table) => ({
    formVersionUuidIdx: index("idx_frm_option_sets_form_version_uuid").on(table.formVersionUuid),
  }),
);

export const frmOptions = pgTable(
  "frm_options",
  {
    id: serial("id").primaryKey(),
    optionUuid: text("option_uuid").notNull().unique(),
    optionSetUuid: text("option_set_uuid")
      .notNull()
      .references(() => frmOptionSets.optionSetUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    optionLabel: text("option_label").notNull(),
    optionValue: text("option_value").notNull(),
    ...auditColumns,
  },
  (table) => ({
    optionSetUuidIdx: index("idx_frm_options_option_set_uuid").on(table.optionSetUuid),
  }),
);

export const frmQuestions = pgTable(
  "frm_questions",
  {
    id: serial("id").primaryKey(),
    questionUuid: text("question_uuid").notNull().unique(),
    sectionUuid: text("section_uuid")
      .notNull()
      .references(() => frmSections.sectionUuid, { onDelete: "restrict", onUpdate: "cascade" }),
    questionCode: text("question_code").notNull(),
    questionText: text("question_text").notNull(),
    responseType: text("response_type").notNull(),
    isMandatory: boolean("is_mandatory").notNull().default(false),
    commentEnabled: boolean("comment_enabled").notNull().default(true),
    optionSetUuid: text("option_set_uuid").references(() => frmOptionSets.optionSetUuid, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    ...auditColumns,
  },
  (table) => ({
    sectionUuidIdx: index("idx_frm_questions_section_uuid").on(table.sectionUuid),
  }),
);

const insertAuditOmit = {
  id: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
} as const;

export const insertFrmFormPartSchema = createInsertSchema(frmFormParts).omit(insertAuditOmit);
export const insertFrmSectionSchema = createInsertSchema(frmSections).omit(insertAuditOmit);
export const insertFrmQuestionSchema = createInsertSchema(frmQuestions).omit(insertAuditOmit);
export const insertFrmOptionSetSchema = createInsertSchema(frmOptionSets).omit(insertAuditOmit);
export const insertFrmOptionSchema = createInsertSchema(frmOptions).omit(insertAuditOmit);

const rowUuidSchema = z.string().uuid();

export const formStructureOptionInputSchema = z.object({
  option_uuid: rowUuidSchema.optional(),
  option_label: z.string().trim().min(1).max(500),
  option_value: z.string().trim().min(1).max(500),
  sort_order: z.number().int().nonnegative().optional(),
}).strict();

export const formStructureOptionSetInputSchema = z.object({
  option_set_uuid: rowUuidSchema.optional(),
  option_set_name: z.string().trim().max(500).nullable().optional(),
  low_end_label: z.string().trim().min(1).max(500).nullable().optional(),
  high_end_label: z.string().trim().min(1).max(500).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
  options: z.array(formStructureOptionInputSchema).default([]),
}).strict();

export const formStructureQuestionInputSchema = z.object({
  question_uuid: rowUuidSchema.optional(),
  question_code: z.string().trim().min(1).max(100),
  question_text: z.string().trim().min(1).max(2000),
  response_type: z.enum(QUESTION_RESPONSE_TYPES),
  is_mandatory: z.boolean().default(false),
  comment_enabled: z.boolean().default(true),
  option_set_uuid: rowUuidSchema.nullable().optional(),
  // Read responses include the descriptors resolved from the question's
  // effective option set. They are accepted on a read-modify-write payload
  // but persistence remains set-owned.
  low_end_label: z.string().trim().min(1).max(500).nullable().optional(),
  high_end_label: z.string().trim().min(1).max(500).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
  options: z.array(formStructureOptionInputSchema).default([]),
}).strict().superRefine((question, ctx) => {
  const needsOptions = question.response_type === "single_select" || question.response_type === "multi_select";
  if (!needsOptions && (question.options.length > 0 || question.option_set_uuid)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: `${question.response_type} questions cannot define options`,
    });
  }
});

export const formStructureSectionInputSchema = z.object({
  section_uuid: rowUuidSchema.optional(),
  section_code: z.string().trim().min(1).max(100),
  section_title: z.string().trim().min(1).max(500),
  applicable_vessel_types: z.array(rowUuidSchema).default([]),
  responsible_mode: z.enum(RESPONSIBLE_MODES).default("not_applicable"),
  responsible_role_uuid: rowUuidSchema.nullable().optional(),
  responsible_department: z.string().trim().max(500).nullable().optional(),
  comment_box_required: z.boolean().default(false),
  signature_required: z.boolean().default(false),
  default_option_set_uuid: rowUuidSchema.nullable().optional(),
  layout_preference: z.enum(SECTION_LAYOUT_PREFERENCES).default("auto"),
  effectiveLayout: z.enum(["list", "matrix"]).optional(),
  sort_order: z.number().int().nonnegative().optional(),
  questions: z.array(formStructureQuestionInputSchema).default([]),
}).strict().superRefine((section, ctx) => {
  for (let index = 0; index < section.questions.length; index++) {
    const question = section.questions[index];
    const needsOptions = question.response_type === "single_select" || question.response_type === "multi_select";
    if (
      needsOptions &&
      question.options.length === 0 &&
      !question.option_set_uuid &&
      !section.default_option_set_uuid
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questions", index, "options"],
        message: `${question.response_type} questions require options, an option_set_uuid, or a section default_option_set_uuid`,
      });
    }
  }
  if (section.responsible_mode === "role") {
    if (!section.responsible_role_uuid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsible_role_uuid"],
        message: "responsible_role_uuid is required when responsible_mode is role",
      });
    }
    if (section.responsible_department) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsible_department"],
        message: "responsible_department must be empty when responsible_mode is role",
      });
    }
  } else if (section.responsible_mode === "department") {
    if (!section.responsible_department) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsible_department"],
        message: "responsible_department is required when responsible_mode is department",
      });
    }
    if (section.responsible_role_uuid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responsible_role_uuid"],
        message: "responsible_role_uuid must be empty when responsible_mode is department",
      });
    }
  } else if (section.responsible_role_uuid || section.responsible_department) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["responsible_mode"],
      message: "responsible targets must be empty when responsible_mode is not_applicable",
    });
  }
});

export const formStructureInputSchema = z.object({
  form_version_uuid: rowUuidSchema.optional(),
  form_part_uuid: rowUuidSchema.optional(),
  option_sets: z.array(formStructureOptionSetInputSchema).default([]),
  sections: z.array(formStructureSectionInputSchema),
}).strict();

export type FormStructureOptionInput = z.infer<typeof formStructureOptionInputSchema>;
export type FormStructureOptionSetInput = z.infer<typeof formStructureOptionSetInputSchema>;
export type FormStructureQuestionInput = z.infer<typeof formStructureQuestionInputSchema>;
export type FormStructureSectionInput = z.infer<typeof formStructureSectionInputSchema>;
export type FormStructureInput = z.infer<typeof formStructureInputSchema>;

export type InsertFrmFormPart = z.infer<typeof insertFrmFormPartSchema>;
export type FrmFormPart = typeof frmFormParts.$inferSelect;
export type InsertFrmSection = z.infer<typeof insertFrmSectionSchema>;
export type FrmSection = typeof frmSections.$inferSelect;
export type InsertFrmQuestion = z.infer<typeof insertFrmQuestionSchema>;
export type FrmQuestion = typeof frmQuestions.$inferSelect;
export type InsertFrmOptionSet = z.infer<typeof insertFrmOptionSetSchema>;
export type FrmOptionSet = typeof frmOptionSets.$inferSelect;
export type InsertFrmOption = z.infer<typeof insertFrmOptionSchema>;
export type FrmOption = typeof frmOptions.$inferSelect;