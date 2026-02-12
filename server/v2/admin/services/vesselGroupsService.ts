import { VesselGroupsRepository } from "../repositories/vesselGroupsRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmVesselGroupV2, InsertAdmVesselGroupV2 } from "../../../../shared/v2/admin/types";

const vesselGroupsRepo = new VesselGroupsRepository();

export const vesselGroupsService = {
  async getAll(): Promise<AdmVesselGroupV2[]> {
    return vesselGroupsRepo.findAll();
  },

  async getById(id: number): Promise<AdmVesselGroupV2> {
    const record = await vesselGroupsRepo.findById(id);
    if (!record) throw new Error(`Vessel group not found: ${id}`);
    return record;
  },

  async create(data: Omit<InsertAdmVesselGroupV2, "vgUuid">): Promise<AdmVesselGroupV2> {
    const normalizedData = { ...data };
    if (Array.isArray(normalizedData.vesselIds)) {
      normalizedData.vesselIds = JSON.stringify(normalizedData.vesselIds);
    }
    return vesselGroupsRepo.create(applyAuditUser(normalizedData, true));
  },

  async updateById(id: number, data: Partial<InsertAdmVesselGroupV2>): Promise<AdmVesselGroupV2> {
    if (data.vesselIds && Array.isArray(data.vesselIds)) {
      data.vesselIds = JSON.stringify(data.vesselIds);
    }
    const updated = await vesselGroupsRepo.updateById(id, applyAuditUser(data));
    if (!updated) throw new Error(`Vessel group not found: ${id}`);
    return updated;
  },

  async deleteById(id: number): Promise<boolean> {
    const existing = await vesselGroupsRepo.findById(id);
    if (!existing) throw new Error(`Vessel group not found: ${id}`);
    return vesselGroupsRepo.softDeleteById(id);
  },
};
