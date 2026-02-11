import { TrainingMasterRepository } from "../repositories/trainingMasterRepository";
import { CompanyTrainingsRepository } from "../repositories/companyTrainingsRepository";
import type { AdmTrainingMasterV2, InsertAdmTrainingMasterV2 } from "../../../../shared/v2/admin/types";

const trainingMasterRepo = new TrainingMasterRepository();
const companyTrainingsRepo = new CompanyTrainingsRepository();

export const trainingMasterService = {
  async getAll(): Promise<AdmTrainingMasterV2[]> {
    return trainingMasterRepo.findAll();
  },

  async getById(id: number): Promise<AdmTrainingMasterV2> {
    const record = await trainingMasterRepo.findById(id);
    if (!record) throw new Error(`Training master not found: ${id}`);
    return record;
  },

  async create(data: Omit<InsertAdmTrainingMasterV2, "tmUuid">): Promise<AdmTrainingMasterV2> {
    const created = await trainingMasterRepo.create(data);
    if (data.applicableToCompany) {
      await companyTrainingsRepo.createFromMaster(
        created.id,
        data.trainingLabel || data.trainingName,
        "default"
      );
    }
    return created;
  },

  async updateById(id: number, data: Partial<InsertAdmTrainingMasterV2>): Promise<AdmTrainingMasterV2> {
    const existing = await trainingMasterRepo.findById(id);
    if (!existing) throw new Error(`Training master not found: ${id}`);

    if (existing.isDefault) {
      delete (data as any).trainingName;
      delete (data as any).category;
      delete (data as any).trainingGroup;
    }

    const updated = await trainingMasterRepo.updateById(id, data);
    if (!updated) throw new Error(`Training master not found: ${id}`);

    if (data.applicableToCompany !== undefined && data.applicableToCompany !== existing.applicableToCompany) {
      if (data.applicableToCompany) {
        await companyTrainingsRepo.createFromMaster(
          updated.id,
          data.trainingLabel || updated.trainingLabel || updated.trainingName,
          "default"
        );
      } else {
        await companyTrainingsRepo.deleteByMasterId(updated.id);
      }
    } else if (data.applicableToCompany && data.trainingLabel) {
      const companyTrainings = await companyTrainingsRepo.findByMasterId(updated.id);
      for (const ct of companyTrainings) {
        await companyTrainingsRepo.updateById(ct.id, { trainingLabel: data.trainingLabel });
      }
    }

    return updated;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await trainingMasterRepo.findById(id);
    if (!existing) throw new Error(`Training master not found: ${id}`);
    if (existing.isDefault) throw new Error("Cannot delete a default training master");

    if (existing.applicableToCompany) {
      await companyTrainingsRepo.deleteByMasterId(existing.id);
    }

    return trainingMasterRepo.softDeleteById(id);
  },

  async batchUpdate(updates: Array<{ id: number; data: Partial<InsertAdmTrainingMasterV2> }>): Promise<AdmTrainingMasterV2[]> {
    const results: AdmTrainingMasterV2[] = [];

    for (const update of updates) {
      const existing = await trainingMasterRepo.findById(update.id);
      if (!existing) continue;

      const updated = await trainingMasterRepo.updateById(update.id, update.data);
      if (!updated) continue;

      if (update.data.applicableToCompany !== undefined && update.data.applicableToCompany !== existing.applicableToCompany) {
        if (update.data.applicableToCompany) {
          await companyTrainingsRepo.createFromMaster(
            updated.id,
            update.data.trainingLabel || updated.trainingLabel || updated.trainingName,
            "default"
          );
        } else {
          await companyTrainingsRepo.deleteByMasterId(updated.id);
        }
      } else if (updated.applicableToCompany && update.data.trainingLabel) {
        const companyTrainings = await companyTrainingsRepo.findByMasterId(updated.id);
        for (const ct of companyTrainings) {
          await companyTrainingsRepo.updateById(ct.id, { trainingLabel: update.data.trainingLabel });
        }
      }

      results.push(updated);
    }

    return results;
  },

  async reorder(orders: Array<{ id: number; sortOrder: number }>): Promise<void> {
    return trainingMasterRepo.reorder(orders);
  },
};
