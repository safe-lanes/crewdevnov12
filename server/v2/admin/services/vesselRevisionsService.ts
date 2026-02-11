import { VesselRevisionsRepository } from "../repositories/vesselRevisionsRepository";
import { VesselDraftsRepository } from "../repositories/vesselDraftsRepository";
import type { AdmVesselRevisionV2, InsertAdmVesselRevisionV2 } from "../../../../shared/v2/admin/types";

const vesselRevisionsRepo = new VesselRevisionsRepository();
const vesselDraftsRepo = new VesselDraftsRepository();

export const vesselRevisionsService = {
  async getAll(): Promise<AdmVesselRevisionV2[]> {
    return vesselRevisionsRepo.findAll();
  },

  async getById(id: number): Promise<AdmVesselRevisionV2> {
    const record = await vesselRevisionsRepo.findById(id);
    if (!record) throw new Error(`Vessel revision not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmVesselRevisionV2[]> {
    return vesselRevisionsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmVesselRevisionV2, "vrUuid">): Promise<AdmVesselRevisionV2> {
    return vesselRevisionsRepo.create(data);
  },

  async getNextRevision(vesselId: string): Promise<string> {
    return vesselRevisionsRepo.getNextRevision(vesselId);
  },

  async submit(data: { vesselId: string; revisionData: string; revisionDate: string }): Promise<{
    success: boolean;
    revision: AdmVesselRevisionV2;
    metadata: { autoAssignedRevision: string; deletedDrafts: number };
  }> {
    const autoAssignedRevision = await vesselRevisionsRepo.getNextRevision(data.vesselId);

    const revision = await vesselRevisionsRepo.create({
      vesselId: data.vesselId,
      revision: autoAssignedRevision,
      revisionDate: data.revisionDate,
      revisionData: data.revisionData,
    });

    const existingDrafts = await vesselDraftsRepo.findByVesselId(data.vesselId);
    let deletedDrafts = 0;
    for (const draft of existingDrafts) {
      const deleted = await vesselDraftsRepo.hardDeleteById(draft.id);
      if (deleted) deletedDrafts++;
    }

    return {
      success: true,
      revision,
      metadata: { autoAssignedRevision, deletedDrafts },
    };
  },
};
