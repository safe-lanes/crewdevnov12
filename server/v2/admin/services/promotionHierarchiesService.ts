import { PromotionHierarchiesRepository } from "../repositories/promotionHierarchiesRepository";
import { applyAuditUser } from "../utils/auditUser";
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

  async getById(id: number): Promise<any> {
    const hierarchy = await promotionHierarchiesRepo.findById(id);
    if (!hierarchy) throw new Error(`Promotion hierarchy not found: ${id}`);
    return parseRankPath(hierarchy);
  },

  async getByUuid(phUuid: string): Promise<any> {
    const hierarchy = await promotionHierarchiesRepo.findByUuid(phUuid);
    if (!hierarchy) throw new Error(`Promotion hierarchy not found: ${phUuid}`);
    return parseRankPath(hierarchy);
  },

  async create(data: Omit<InsertAdmPromotionHierarchyV2, "phUuid">): Promise<any> {
    const hierarchy = await promotionHierarchiesRepo.create(applyAuditUser(data, true));
    return parseRankPath(hierarchy);
  },

  async updateById(id: number, data: Partial<InsertAdmPromotionHierarchyV2>): Promise<any> {
    const result = await promotionHierarchiesRepo.updateById(id, applyAuditUser(data));
    if (!result) throw new Error(`Promotion hierarchy not found: ${id}`);
    return parseRankPath(result);
  },

  async update(phUuid: string, data: Partial<InsertAdmPromotionHierarchyV2>): Promise<any> {
    const result = await promotionHierarchiesRepo.update(phUuid, applyAuditUser(data));
    if (!result) throw new Error(`Promotion hierarchy not found: ${phUuid}`);
    return parseRankPath(result);
  },

  async deleteById(id: number): Promise<boolean> {
    return promotionHierarchiesRepo.softDeleteById(id);
  },

  async delete(phUuid: string): Promise<boolean> {
    return promotionHierarchiesRepo.softDelete(phUuid);
  },
};
