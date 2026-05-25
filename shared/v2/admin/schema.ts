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
  isLockForm: boolean("is_lock_form").notNull().default(false),
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

export const admTrainingMasterV2 = pgTable("adm_training_master_v2", {
  id: serial("id").primaryKey(),
  tmUuid: text("tm_uuid").notNull().unique(),
  trainingId: text("training_id").notNull().unique(),
  trainingName: text("training_name").notNull(),
  category: text("category").notNull(),
  trainingGroup: text("training_group").notNull(),
  requirementReference: text("requirement_reference"),
  applicableToCompany: boolean("applicable_to_company").default(false),
  trainingLabel: text("training_label"),
  sortOrder: integer("sort_order").default(0),
  isDefault: boolean("is_default").default(false),
  ...auditColumns,
});

export const admCompanyTrainingGroupsV2 = pgTable("adm_company_training_groups_v2", {
  id: serial("id").primaryKey(),
  ctgUuid: text("ctg_uuid").notNull().unique(),
  code: text("code").notNull().unique(),
  label: text("label"),
  displayOrder: integer("display_order").notNull(),
  ...auditColumns,
});

export const admCompanyTrainingsV2 = pgTable("adm_company_trainings_v2", {
  id: serial("id").primaryKey(),
  ctUuid: text("ct_uuid").notNull().unique(),
  trainingMasterId: integer("training_master_id").notNull(),
  companyId: text("company_id").notNull(),
  trainingLabel: text("training_label").notNull(),
  abr: text("abr"),
  requirement: text("requirement"),
  groupCode: text("group_code"),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const admCompanyTrainingRequirementsV2 = pgTable("adm_company_training_requirements_v2", {
  id: serial("id").primaryKey(),
  ctrUuid: text("ctr_uuid").notNull().unique(),
  companyTrainingId: integer("company_training_id").notNull(),
  rankId: integer("rank_id").notNull(),
  status: text("status"),
  ...auditColumns,
});

export const admCompanyRanksV2 = pgTable("adm_company_ranks_v2", {
  id: text("id").primaryKey(),
  crUuid: text("cr_uuid").notNull().unique(),
  rank: text("rank").notNull(),
  rankId: text("rank_id").notNull(),
  role: text("role"),
  originalRankId: text("original_rank_id"),
  isRoleRow: boolean("is_role_row").default(false),
  officer: boolean("officer").default(false),
  rating: boolean("rating").default(false),
  seniorOfficer: boolean("senior_officer").default(false),
  deckOfficer: boolean("deck_officer").default(false),
  engOfficer: boolean("eng_officer").default(false),
  pettyOfficer: boolean("petty_officer").default(false),
  deckRating: boolean("deck_rating").default(false),
  engineRating: boolean("engine_rating").default(false),
  generalRating: boolean("general_rating").default(false),
  cateringRating: boolean("catering_rating").default(false),
  safetyOfficer: boolean("safety_officer").default(false),
  sso: boolean("sso").default(false),
  medicalOfficer: boolean("medical_officer").default(false),
  navigatingOfficer: boolean("navigating_officer").default(false),
  emtOfficer: boolean("emt_officer").default(false),
  ...auditColumns,
});

export const admVesselGroupsV2 = pgTable("adm_vessel_groups_v2", {
  id: serial("id").primaryKey(),
  vgUuid: text("vg_uuid").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  vesselIds: text("vessel_ids").notNull(),
  ...auditColumns,
});

export const admVesselDraftsV2 = pgTable("adm_vessel_drafts_v2", {
  id: serial("id").primaryKey(),
  vdUuid: text("vd_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull().default("R1"),
  draftData: text("draft_data").notNull(),
  ...auditColumns,
});

export const admVesselRevisionsV2 = pgTable("adm_vessel_revisions_v2", {
  id: serial("id").primaryKey(),
  vrUuid: text("vr_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull(),
  revisionDate: text("revision_date").notNull(),
  revisionData: text("revision_data").notNull(),
  ...auditColumns,
});

export const admTrainingMatrixVesselDraftsV2 = pgTable("adm_training_matrix_vessel_drafts_v2", {
  id: serial("id").primaryKey(),
  tmvdUuid: text("tmvd_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull().default("R1"),
  draftData: text("draft_data").notNull(),
  ...auditColumns,
});

export const admTrainingMatrixVesselRevisionsV2 = pgTable("adm_training_matrix_vessel_revisions_v2", {
  id: serial("id").primaryKey(),
  tmvrUuid: text("tmvr_uuid").notNull().unique(),
  vesselId: text("vessel_id").notNull(),
  revision: text("revision").notNull(),
  revisionDate: text("revision_date").notNull(),
  revisionData: text("revision_data").notNull(),
  ...auditColumns,
});

export const admMenuMasterAc = pgTable("adm_menumaster_ac", {
  id: serial("id").primaryKey(),
  muid: text("muid").notNull().unique(),
  name: text("name").notNull().unique(),
  displayName: text("display_name"),
  route: text("route").notNull().unique(),
  parentMenu: text("parent_menu"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const admRoleMasterAc = pgTable("adm_rolemaster_ac", {
  id: serial("id").primaryKey(),
  ruid: text("ruid").notNull().unique(),
  assignedRole: text("assigned_role").notNull(),
  roletype: text("roletype").notNull(),
  orderby: integer("orderby"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});

export const admVesselOrgChartV2 = pgTable("adm_vessel_org_chart_v2", {
  id: serial("id").primaryKey(),
  ocUuid: text("oc_uuid").notNull().unique(),
  rank: text("rank").notNull(),
  rankId: text("rank_id").notNull(),
  parentRankId: text("parent_rank_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...auditColumns,
});

export const admRoleAccessAc = pgTable("adm_roleaccess_ac", {
  id: serial("id").primaryKey(),
  rauid: text("rauid").notNull().unique(),
  canview: boolean("canview").notNull().default(false),
  cancreate: boolean("cancreate").notNull().default(false),
  canedit: boolean("canedit").notNull().default(false),
  candelete: boolean("candelete").notNull().default(false),
  menuId: text("menu_id").notNull(),
  roleId: text("role_id").notNull(),
  sortOrder: integer("sort_order").default(0),
  ...auditColumns,
});
