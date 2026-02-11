import { TrainingMatrixVesselRevisionsRepository } from "../repositories/trainingMatrixVesselRevisionsRepository";
import { TrainingMatrixVesselDraftsRepository } from "../repositories/trainingMatrixVesselDraftsRepository";
import type { AdmTrainingMatrixVesselRevisionV2, InsertAdmTrainingMatrixVesselRevisionV2 } from "../../../../shared/v2/admin/types";

const tmVesselRevisionsRepo = new TrainingMatrixVesselRevisionsRepository();
const tmVesselDraftsRepo = new TrainingMatrixVesselDraftsRepository();

export const trainingMatrixVesselRevisionsService = {
  async getAll(): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    return tmVesselRevisionsRepo.findAll();
  },

  async getById(id: number): Promise<AdmTrainingMatrixVesselRevisionV2> {
    const record = await tmVesselRevisionsRepo.findById(id);
    if (!record) throw new Error(`Training matrix vessel revision not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmTrainingMatrixVesselRevisionV2[]> {
    return tmVesselRevisionsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmTrainingMatrixVesselRevisionV2, "tmvrUuid">): Promise<AdmTrainingMatrixVesselRevisionV2> {
    return tmVesselRevisionsRepo.create(data);
  },

  async getNextRevision(vesselId: string): Promise<string> {
    return tmVesselRevisionsRepo.getNextRevision(vesselId);
  },

  async submit(data: { vesselId: string; revisionData: string; revisionDate: string }): Promise<{
    success: boolean;
    revision: AdmTrainingMatrixVesselRevisionV2;
    metadata: { autoAssignedRevision: string; deletedDrafts: number };
  }> {
    const autoAssignedRevision = await tmVesselRevisionsRepo.getNextRevision(data.vesselId);

    const revision = await tmVesselRevisionsRepo.create({
      vesselId: data.vesselId,
      revision: autoAssignedRevision,
      revisionDate: data.revisionDate,
      revisionData: data.revisionData,
    });

    const existingDrafts = await tmVesselDraftsRepo.findByVesselId(data.vesselId);
    let deletedDrafts = 0;
    for (const draft of existingDrafts) {
      const deleted = await tmVesselDraftsRepo.hardDeleteById(draft.id);
      if (deleted) deletedDrafts++;
    }

    return {
      success: true,
      revision,
      metadata: { autoAssignedRevision, deletedDrafts },
    };
  },
};
