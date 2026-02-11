import { CompanyRanksRepository } from "../repositories/companyRanksRepository";
import type { AdmCompanyRankV2, InsertAdmCompanyRankV2 } from "../../../../shared/v2/admin/types";

const companyRanksRepo = new CompanyRanksRepository();

export const companyRanksService = {
  async getAll(): Promise<AdmCompanyRankV2[]> {
    return companyRanksRepo.findAll();
  },

  async getByName(rankName: string): Promise<AdmCompanyRankV2> {
    const record = await companyRanksRepo.findByName(rankName);
    if (!record) throw new Error(`Company rank not found: ${rankName}`);
    return record;
  },

  async saveAll(ranks: InsertAdmCompanyRankV2[]): Promise<AdmCompanyRankV2[]> {
    return companyRanksRepo.saveAll(ranks);
  },
};
