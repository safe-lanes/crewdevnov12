import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  admFormsV2,
  admFormVersionsV2,
  admRankGroupsV2,
  admAvailableRanksV2,
  admPromotionHierarchiesV2,
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
