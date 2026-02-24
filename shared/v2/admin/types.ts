import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  admFormsV2,
  admFormVersionsV2,
  admRankGroupsV2,
  admAvailableRanksV2,
  admPromotionHierarchiesV2,
  admTrainingMasterV2,
  admCompanyTrainingGroupsV2,
  admCompanyTrainingsV2,
  admCompanyTrainingRequirementsV2,
  admCompanyRanksV2,
  admVesselGroupsV2,
  admVesselDraftsV2,
  admVesselRevisionsV2,
  admTrainingMatrixVesselDraftsV2,
  admTrainingMatrixVesselRevisionsV2,
  admMenuMasterAc,
  admRoleMasterAc,
  admRoleAccessAc,
} from "./schema";

export const insertAdmFormV2Schema = createInsertSchema(admFormsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmFormVersionV2Schema = createInsertSchema(admFormVersionsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmRankGroupV2Schema = createInsertSchema(admRankGroupsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmAvailableRankV2Schema = createInsertSchema(admAvailableRanksV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmPromotionHierarchyV2Schema = createInsertSchema(admPromotionHierarchiesV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  rankPath: z.union([
    z.string(),
    z.array(z.string())
  ]).transform((val) => {
    if (Array.isArray(val)) {
      return JSON.stringify(val);
    }
    return val;
  })
});

export const insertAdmTrainingMasterV2Schema = createInsertSchema(admTrainingMasterV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmCompanyTrainingGroupV2Schema = createInsertSchema(admCompanyTrainingGroupsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmCompanyTrainingV2Schema = createInsertSchema(admCompanyTrainingsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmCompanyTrainingRequirementV2Schema = createInsertSchema(admCompanyTrainingRequirementsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmCompanyRankV2Schema = createInsertSchema(admCompanyRanksV2).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAdmVesselGroupV2Schema = createInsertSchema(admVesselGroupsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmVesselDraftV2Schema = createInsertSchema(admVesselDraftsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmVesselRevisionV2Schema = createInsertSchema(admVesselRevisionsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmTrainingMatrixVesselDraftV2Schema = createInsertSchema(admTrainingMatrixVesselDraftsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmTrainingMatrixVesselRevisionV2Schema = createInsertSchema(admTrainingMatrixVesselRevisionsV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdmFormV2 = typeof admFormsV2.$inferSelect;
export type InsertAdmFormV2 = z.infer<typeof insertAdmFormV2Schema>;

export type AdmFormVersionV2 = typeof admFormVersionsV2.$inferSelect;
export type InsertAdmFormVersionV2 = z.infer<typeof insertAdmFormVersionV2Schema>;

export type AdmRankGroupV2 = typeof admRankGroupsV2.$inferSelect;
export type InsertAdmRankGroupV2 = z.infer<typeof insertAdmRankGroupV2Schema>;

export type AdmAvailableRankV2 = typeof admAvailableRanksV2.$inferSelect;
export type InsertAdmAvailableRankV2 = z.infer<typeof insertAdmAvailableRankV2Schema>;

export type AdmPromotionHierarchyV2 = typeof admPromotionHierarchiesV2.$inferSelect;
export type InsertAdmPromotionHierarchyV2 = z.infer<typeof insertAdmPromotionHierarchyV2Schema>;

export type AdmTrainingMasterV2 = typeof admTrainingMasterV2.$inferSelect;
export type InsertAdmTrainingMasterV2 = z.infer<typeof insertAdmTrainingMasterV2Schema>;

export type AdmCompanyTrainingGroupV2 = typeof admCompanyTrainingGroupsV2.$inferSelect;
export type InsertAdmCompanyTrainingGroupV2 = z.infer<typeof insertAdmCompanyTrainingGroupV2Schema>;

export type AdmCompanyTrainingV2 = typeof admCompanyTrainingsV2.$inferSelect;
export type InsertAdmCompanyTrainingV2 = z.infer<typeof insertAdmCompanyTrainingV2Schema>;

export type AdmCompanyTrainingRequirementV2 = typeof admCompanyTrainingRequirementsV2.$inferSelect;
export type InsertAdmCompanyTrainingRequirementV2 = z.infer<typeof insertAdmCompanyTrainingRequirementV2Schema>;

export type AdmCompanyRankV2 = typeof admCompanyRanksV2.$inferSelect;
export type InsertAdmCompanyRankV2 = z.infer<typeof insertAdmCompanyRankV2Schema>;

export type AdmVesselGroupV2 = typeof admVesselGroupsV2.$inferSelect;
export type InsertAdmVesselGroupV2 = z.infer<typeof insertAdmVesselGroupV2Schema>;

export type AdmVesselDraftV2 = typeof admVesselDraftsV2.$inferSelect;
export type InsertAdmVesselDraftV2 = z.infer<typeof insertAdmVesselDraftV2Schema>;

export type AdmVesselRevisionV2 = typeof admVesselRevisionsV2.$inferSelect;
export type InsertAdmVesselRevisionV2 = z.infer<typeof insertAdmVesselRevisionV2Schema>;

export type AdmTrainingMatrixVesselDraftV2 = typeof admTrainingMatrixVesselDraftsV2.$inferSelect;
export type InsertAdmTrainingMatrixVesselDraftV2 = z.infer<typeof insertAdmTrainingMatrixVesselDraftV2Schema>;

export type AdmTrainingMatrixVesselRevisionV2 = typeof admTrainingMatrixVesselRevisionsV2.$inferSelect;
export type InsertAdmTrainingMatrixVesselRevisionV2 = z.infer<typeof insertAdmTrainingMatrixVesselRevisionV2Schema>;

export const insertAdmMenuMasterAcSchema = createInsertSchema(admMenuMasterAc).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmRoleMasterAcSchema = createInsertSchema(admRoleMasterAc).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdmRoleAccessAcSchema = createInsertSchema(admRoleAccessAc).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdmMenuMasterAc = typeof admMenuMasterAc.$inferSelect;
export type InsertAdmMenuMasterAc = z.infer<typeof insertAdmMenuMasterAcSchema>;

export type AdmRoleMasterAc = typeof admRoleMasterAc.$inferSelect;
export type InsertAdmRoleMasterAc = z.infer<typeof insertAdmRoleMasterAcSchema>;

export type AdmRoleAccessAc = typeof admRoleAccessAc.$inferSelect;
export type InsertAdmRoleAccessAc = z.infer<typeof insertAdmRoleAccessAcSchema>;
