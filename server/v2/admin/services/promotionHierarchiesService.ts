import { PromotionHierarchiesRepository } from "../repositories/promotionHierarchiesRepository";
import type { AdmPromotionHierarchyV2, InsertAdmPromotionHierarchyV2 } from "../../../../shared/v2/admin/types";

const promotionHierarchiesRepo = new PromotionHierarchiesRepository();

function parseRankPath(hierarchy: AdmPromotionHierarchyV2) {
  return {
    ...hierarchy,
    rankPath: typeof hierarchy.rankPath === "string" ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath,
  };
}

export const promotionHierarchiesService = {
  async getAll(): Promise<any[]> {
    const hierarchies = await promotionHierarchiesRepo.findAll();
    return hierarchies.map(parseRankPath);
  },

  async getByUuid(phUuid: string): Promise<any> {
    const hierarchy = await promotionHierarchiesRepo.findByUuid(phUuid);
    if (!hierarchy) throw new Error(`Promotion hierarchy not found: ${phUuid}`);
    return parseRankPath(hierarchy);
  },

  async create(data: Omit<InsertAdmPromotionHierarchyV2, "phUuid">): Promise<any> {
    const hierarchy = await promotionHierarchiesRepo.create(data);
    return parseRankPath(hierarchy);
  },

  async update(phUuid: string, data: Partial<InsertAdmPromotionHierarchyV2>): Promise<any> {
    const result = await promotionHierarchiesRepo.update(phUuid, data);
    if (!result) throw new Error(`Promotion hierarchy not found: ${phUuid}`);
    return parseRankPath(result);
  },

  async delete(phUuid: string): Promise<boolean> {
    return promotionHierarchiesRepo.softDelete(phUuid);
  },
};
