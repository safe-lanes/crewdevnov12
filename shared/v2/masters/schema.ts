import { pgTable, serial, text, timestamp, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const auditColumns = {
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const TRAINING_STATUS_MODULES = [
  "Promotion",
  "Appraisal",
  "Training & Retention",
  "Recruitment",
] as const;

export type TrainingStatusModule = (typeof TRAINING_STATUS_MODULES)[number];

export const masterTrainingStatus = pgTable(
  "master_training_status",
  {
    id: serial("id").primaryKey(),
    mtsUuid: text("mts_uuid").notNull().unique(),
    label: text("label").notNull(),
    module: text("module").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => ({
    moduleLabelUnique: unique("uq_master_training_status_module_label").on(t.module, t.label),
  }),
);

export const insertMasterTrainingStatusSchema = createInsertSchema(masterTrainingStatus).omit({
  id: true,
  mtsUuid: true,
  createdAt: true,
  updatedAt: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export type InsertMasterTrainingStatus = z.infer<typeof insertMasterTrainingStatusSchema>;
export type MasterTrainingStatus = typeof masterTrainingStatus.$inferSelect;

// API payloads
export const createTrainingStatusPayloadSchema = z.object({
  label: z.string().trim().min(1, "Status label is required"),
  modules: z.array(z.enum(TRAINING_STATUS_MODULES)).min(1, "Select at least one module"),
  auditUserUuid: z.string().nullish(),
});
export type CreateTrainingStatusPayload = z.infer<typeof createTrainingStatusPayloadSchema>;

export const updateTrainingStatusRowSchema = z.object({
  label: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  auditUserUuid: z.string().nullish(),
});
export type UpdateTrainingStatusRow = z.infer<typeof updateTrainingStatusRowSchema>;

export const groupUpdateTrainingStatusSchema = z.object({
  originalLabel: z.string().min(1),
  label: z.string().trim().min(1, "Status label is required"),
  modules: z.array(z.enum(TRAINING_STATUS_MODULES)),
  auditUserUuid: z.string().nullish(),
});
export type GroupUpdateTrainingStatus = z.infer<typeof groupUpdateTrainingStatusSchema>;

export const TRAINING_CATEGORY_MODULES = [
  "Promotion",
  "Appraisal",
  "Training & Retention",
  "Recruitment",
] as const;

export type TrainingCategoryModule = (typeof TRAINING_CATEGORY_MODULES)[number];

export const masterTrainingCategory = pgTable(
  "master_training_category",
  {
    id: serial("id").primaryKey(),
    mtcUuid: text("mtc_uuid").notNull().unique(),
    label: text("label").notNull(),
    module: text("module").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
  },
  (t) => ({
    moduleLabelUnique: unique("uq_master_training_category_module_label").on(t.module, t.label),
  }),
);

export const insertMasterTrainingCategorySchema = createInsertSchema(masterTrainingCategory).omit({
  id: true,
  mtcUuid: true,
  createdAt: true,
  updatedAt: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export type InsertMasterTrainingCategory = z.infer<typeof insertMasterTrainingCategorySchema>;
export type MasterTrainingCategory = typeof masterTrainingCategory.$inferSelect;

// API payloads
export const createTrainingCategoryPayloadSchema = z.object({
  label: z.string().trim().min(1, "Category label is required"),
  modules: z.array(z.enum(TRAINING_CATEGORY_MODULES)).min(1, "Select at least one module"),
  auditUserUuid: z.string().nullish(),
});
export type CreateTrainingCategoryPayload = z.infer<typeof createTrainingCategoryPayloadSchema>;

export const updateTrainingCategoryRowSchema = z.object({
  label: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  auditUserUuid: z.string().nullish(),
});
export type UpdateTrainingCategoryRow = z.infer<typeof updateTrainingCategoryRowSchema>;

export const groupUpdateTrainingCategorySchema = z.object({
  originalLabel: z.string().min(1),
  label: z.string().trim().min(1, "Category label is required"),
  modules: z.array(z.enum(TRAINING_CATEGORY_MODULES)),
  auditUserUuid: z.string().nullish(),
});
export type GroupUpdateTrainingCategory = z.infer<typeof groupUpdateTrainingCategorySchema>;
