import { vesselPlanningRepository, vesselPlanningAttachmentsRepository } from "../repositories";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";

export const vesselPlanningService = {
  async getByVesselUuid(vesselUuid: string) {
    return vesselPlanningRepository.findByVesselUuid(vesselUuid);
  },

  async getByPlanUuid(planUuid: string) {
    const planning = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!planning) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    const attachments = await vesselPlanningAttachmentsRepository.findByPlanUuid(planUuid);
    return { ...planning, attachments };
  },

  async create(data: Omit<InsertVesselPlanningV2, "planUuid">) {
    return vesselPlanningRepository.create(data);
  },

  async update(planUuid: string, data: Partial<InsertVesselPlanningV2>) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningRepository.update(planUuid, data);
  },

  async archive(planUuid: string, archivedByUuid?: string) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningRepository.archive(planUuid, archivedByUuid);
  },

  async addAttachment(planUuid: string, data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid" | "planUuid">) {
    const existing = await vesselPlanningRepository.findByPlanUuid(planUuid);
    if (!existing) {
      throw new Error(`Planning record not found: ${planUuid}`);
    }
    return vesselPlanningAttachmentsRepository.create({ ...data, planUuid });
  },

  async deleteAttachment(attUuid: string) {
    return vesselPlanningAttachmentsRepository.softDelete(attUuid);
  },

  async updateReliever(planUuid: string, relieverData: {
    relieverCrewUuid: string;
    relieverSignOnDate?: string;
    joiningPortUuid?: string;
    joiningStatus?: string;
  }) {
    return vesselPlanningRepository.update(planUuid, relieverData);
  },

  async findByVesselAndRank(vesselUuid: string, rankId: string) {
    return vesselPlanningRepository.findByVesselAndRank(vesselUuid, rankId);
  },
};
