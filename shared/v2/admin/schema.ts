import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const auditColumns = {
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdByUuid: text("created_by_uuid"),
  updatedByUuid: text("updated_by_uuid"),
  isDeleted: boolean("is_deleted").default(false),
  isSync: boolean("is_sync").default(false),
};

export const admFormsV2 = pgTable("adm_forms_v2", {
  id: serial("id").primaryKey(),
  formUuid: text("form_uuid").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("appraisal"),
  rankGroup: text("rank_group").notNull(),
  versionNo: text("version_no").notNull(),
  versionDate: text("version_date").notNull(),
  configuration: text("configuration"),
  sharedConfig: text("shared_config"),
  ...auditColumns,
});

export const admFormVersionsV2 = pgTable("adm_form_versions_v2", {
  id: serial("id").primaryKey(),
  fvUuid: text("fv_uuid").notNull().unique(),
  formId: integer("form_id").notNull(),
  rankGroupId: integer("rank_group_id"),
  versionNo: text("version_no").notNull(),
  versionDate: text("version_date").notNull(),
  status: text("status").notNull().default("draft"),
  configuration: text("configuration"),
  sharedConfig: text("shared_config"),
  releasedAt: timestamp("released_at"),
  ...auditColumns,
});

export const admRankGroupsV2 = pgTable("adm_rank_groups_v2", {
  id: serial("id").primaryKey(),
  rgUuid: text("rg_uuid").notNull().unique(),
  formId: integer("form_id").notNull(),
  name: text("name").notNull(),
  ranks: text("ranks").notNull(),
  archivedAt: timestamp("archived_at"),
  configuration: text("configuration"),
  ...auditColumns,
});

export const admAvailableRanksV2 = pgTable("adm_available_ranks_v2", {
  id: serial("id").primaryKey(),
  arUuid: text("ar_uuid").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  rankId: text("rank_id"),
  label: text("label"),
  applicableToCompany: boolean("applicable_to_company"),
  isSystemRank: boolean("is_system_rank").default(false),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const admPromotionHierarchiesV2 = pgTable("adm_promotion_hierarchies_v2", {
  id: serial("id").primaryKey(),
  phUuid: text("ph_uuid").notNull().unique(),
  groupName: text("group_name").notNull(),
  rankPath: text("rank_path").notNull(),
  isActive: boolean("is_active").default(true),
  ...auditColumns,
});
