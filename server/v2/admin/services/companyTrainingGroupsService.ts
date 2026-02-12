import { CompanyTrainingGroupsRepository } from "../repositories/companyTrainingGroupsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmCompanyTrainingGroupV2 } from "../../../../shared/v2/admin/types";

const companyTrainingGroupsRepo = new CompanyTrainingGroupsRepository();

export const companyTrainingGroupsService = {
  async getAll(): Promise<AdmCompanyTrainingGroupV2[]> {
    return companyTrainingGroupsRepo.findAll();
  },

  async getById(id: number): Promise<AdmCompanyTrainingGroupV2> {
    const record = await companyTrainingGroupsRepo.findById(id);
    if (!record) throw new Error(`Company training group not found: ${id}`);
    return record;
  },

  async updateByCode(code: string, data: any): Promise<AdmCompanyTrainingGroupV2> {
    const updated = await companyTrainingGroupsRepo.updateByCode(code, applyAuditUser({ label: data.label, auditUserUuid: data.auditUserUuid }));
    if (!updated) throw new Error(`Company training group not found: ${code}`);
    return updated;
  },
};
