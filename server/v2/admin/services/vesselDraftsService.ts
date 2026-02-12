import { VesselDraftsRepository } from "../repositories/vesselDraftsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmVesselDraftV2, InsertAdmVesselDraftV2 } from "../../../../shared/v2/admin/types";

const vesselDraftsRepo = new VesselDraftsRepository();

export const vesselDraftsService = {
  async getAll(): Promise<AdmVesselDraftV2[]> {
    return vesselDraftsRepo.findAll();
  },

  async getById(id: number): Promise<AdmVesselDraftV2> {
    const record = await vesselDraftsRepo.findById(id);
    if (!record) throw new Error(`Vessel draft not found: ${id}`);
    return record;
  },

  async getByVesselId(vesselId: string): Promise<AdmVesselDraftV2[]> {
    return vesselDraftsRepo.findByVesselId(vesselId);
  },

  async create(data: Omit<InsertAdmVesselDraftV2, "vdUuid">): Promise<AdmVesselDraftV2> {
    return vesselDraftsRepo.create(applyAuditUser(data, true));
  },

  async updateById(id: number, data: Partial<InsertAdmVesselDraftV2>): Promise<AdmVesselDraftV2> {
    const updated = await vesselDraftsRepo.updateById(id, applyAuditUser(data));
    if (!updated) throw new Error(`Vessel draft not found: ${id}`);
    return updated;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await vesselDraftsRepo.findById(id);
    if (!existing) throw new Error(`Vessel draft not found: ${id}`);
    return vesselDraftsRepo.softDeleteById(id);
  },

  async upsert(data: Omit<InsertAdmVesselDraftV2, "vdUuid">): Promise<AdmVesselDraftV2> {
    const existingDrafts = await vesselDraftsRepo.findByVesselId(data.vesselId);
    if (existingDrafts.length > 0) {
      const updated = await vesselDraftsRepo.updateById(existingDrafts[0].id, applyAuditUser(data));
      if (!updated) throw new Error(`Vessel draft not found for vessel: ${data.vesselId}`);
      return updated;
    }
    return vesselDraftsRepo.create(applyAuditUser(data, true));
  },
};
