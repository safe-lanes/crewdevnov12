import { TrainingMatrixVesselDraftsRepository } from "../repositories/trainingMatrixVesselDraftsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmTrainingMatrixVesselDraftV2, InsertAdmTrainingMatrixVesselDraftV2 } from "../../../../shared/v2/admin/types";

const tmVesselDraftsRepo = new TrainingMatrixVesselDraftsRepository();

export const trainingMatrixVesselDraftsService = {
  async getAll(): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    return tmVesselDraftsRepo.findAll();
  },

  async getById(id: number): Promise<AdmTrainingMatrixVesselDraftV2> {
    const record = await tmVesselDraftsRepo.findById(id);
    if (!record) throw new Error(`Training matrix vessel draft not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselDraftV2[]> {
    return tmVesselDraftsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmTrainingMatrixVesselDraftV2, "tmvdUuid">): Promise<AdmTrainingMatrixVesselDraftV2> {
    return tmVesselDraftsRepo.create(applyAuditUser(data, true));
  },

  async updateById(id: number, data: Partial<InsertAdmTrainingMatrixVesselDraftV2>): Promise<AdmTrainingMatrixVesselDraftV2> {
    const updated = await tmVesselDraftsRepo.updateById(id, applyAuditUser(data));
    if (!updated) throw new Error(`Training matrix vessel draft not found: ${id}`);
    return updated;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await tmVesselDraftsRepo.findById(id);
    if (!existing) throw new Error(`Training matrix vessel draft not found: ${id}`);
    return tmVesselDraftsRepo.softDeleteById(id);
  },

  async upsert(data: Omit<InsertAdmTrainingMatrixVesselDraftV2, "tmvdUuid">): Promise<AdmTrainingMatrixVesselDraftV2> {
    const existingDrafts = await tmVesselDraftsRepo.findByVesselId(data.vesselId);
    if (existingDrafts.length > 0) {
      const updated = await tmVesselDraftsRepo.updateById(existingDrafts[0].id, applyAuditUser(data));
      if (!updated) throw new Error(`Training matrix vessel draft not found for vessel: ${data.vesselId}`);
      return updated;
    }
    return tmVesselDraftsRepo.create(applyAuditUser(data, true));
  },
};
