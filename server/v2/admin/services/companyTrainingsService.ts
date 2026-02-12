import { CompanyTrainingsRepository } from "../repositories/companyTrainingsRepository";
import { TrainingMasterRepository } from "../repositories/trainingMasterRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmCompanyTrainingV2, InsertAdmCompanyTrainingV2 } from "../../../../shared/v2/admin/types";

const companyTrainingsRepo = new CompanyTrainingsRepository();
const trainingMasterRepo = new TrainingMasterRepository();

export const companyTrainingsService = {
  async getAll(): Promise<AdmCompanyTrainingV2[]> {
    return companyTrainingsRepo.findAll();
  },

  async getById(id: number): Promise<AdmCompanyTrainingV2> {
    const record = await companyTrainingsRepo.findById(id);
    if (!record) throw new Error(`Company training not found: ${id}`);
    return record;
  },

  async create(data: Omit<InsertAdmCompanyTrainingV2, "ctUuid">): Promise<AdmCompanyTrainingV2> {
    return companyTrainingsRepo.create(applyAuditUser(data, true));
  },

  async updateById(id: number, data: Partial<InsertAdmCompanyTrainingV2>): Promise<AdmCompanyTrainingV2> {
    const updated = await companyTrainingsRepo.updateById(id, applyAuditUser(data));
    if (!updated) throw new Error(`Company training not found: ${id}`);
    return updated;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await companyTrainingsRepo.findById(id);
    if (!existing) throw new Error(`Company training not found: ${id}`);
    return companyTrainingsRepo.softDeleteById(id);
  },

  async importFromMaster(): Promise<AdmCompanyTrainingV2[]> {
    const masters = await trainingMasterRepo.findAll();
    const applicableMasters = masters.filter(m => m.applicableToCompany);
    const results: AdmCompanyTrainingV2[] = [];

    for (const master of applicableMasters) {
      const existing = await companyTrainingsRepo.findByMasterId(master.id);
      if (existing.length === 0) {
        const created = await companyTrainingsRepo.createFromMaster(
          master.id,
          master.trainingLabel || master.trainingName,
          "default"
        );
        results.push(created);
      }
    }

    return results;
  },

  async reorder(orders: Array<{ id: number; sortOrder: number }>): Promise<void> {
    return companyTrainingsRepo.reorder(orders);
  },
};
