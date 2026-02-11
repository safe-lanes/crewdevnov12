import { AvailableRanksRepository } from "../repositories/availableRanksRepository";
import type { AdmAvailableRankV2, InsertAdmAvailableRankV2 } from "../../../../shared/v2/admin/types";

const availableRanksRepo = new AvailableRanksRepository();

export const availableRanksService = {
  async getAll(companyOnly?: boolean): Promise<AdmAvailableRankV2[]> {
    let ranks = await availableRanksRepo.findAll();
    if (companyOnly) {
      ranks = ranks.filter(r => r.applicableToCompany === true);
    }
    return ranks;
  },

  async getByUuid(arUuid: string): Promise<AdmAvailableRankV2> {
    const rank = await availableRanksRepo.findByUuid(arUuid);
    if (!rank) throw new Error(`Available rank not found: ${arUuid}`);
    return rank;
  },

  async create(data: Omit<InsertAdmAvailableRankV2, "arUuid">): Promise<AdmAvailableRankV2> {
    return availableRanksRepo.create(data);
  },

  async update(arUuid: string, data: Partial<InsertAdmAvailableRankV2>): Promise<AdmAvailableRankV2> {
    const existing = await availableRanksRepo.findByUuid(arUuid);
    if (!existing) throw new Error(`Available rank not found: ${arUuid}`);

    if (existing.isSystemRank && data.name && data.name !== existing.name) {
      throw new Error("Cannot change the name of a system rank. System ranks are protected.");
    }

    const result = await availableRanksRepo.update(arUuid, data);
    if (!result) throw new Error(`Available rank not found: ${arUuid}`);
    return result;
  },

  async delete(arUuid: string): Promise<boolean> {
    const existing = await availableRanksRepo.findByUuid(arUuid);
    if (!existing) throw new Error(`Available rank not found: ${arUuid}`);
    if (existing.isSystemRank) {
      throw new Error("Cannot delete a system rank. System ranks are protected and part of the starter pack.");
    }
    return availableRanksRepo.softDelete(arUuid);
  },

  async deleteAll(): Promise<boolean> {
    return availableRanksRepo.softDeleteAll();
  },

  async reorder(orders: { arUuid: string; sortOrder: number }[]): Promise<boolean> {
    return availableRanksRepo.updateSortOrders(orders);
  },
};
