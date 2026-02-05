import { VesselCommentsRepository } from "../repositories";
import type {
  RhVesselViolationCommentV2,
  InsertRhVesselViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";

const vesselCommentsRepository = new VesselCommentsRepository();

function applyAuditUser<T extends object>(
  data: T,
  isCreate = false
): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;

  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;

  return result;
}

export const vesselCommentsService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselViolationCommentV2[]> {
    return vesselCommentsRepository.findAll(filters);
  },

  async getByUuid(vesselCommentUuid: string): Promise<RhVesselViolationCommentV2> {
    const comment = await vesselCommentsRepository.findByUuid(vesselCommentUuid);
    if (!comment) {
      throw new Error(`Vessel comment not found: ${vesselCommentUuid}`);
    }
    return comment;
  },

  async getByVesselAndMonth(
    vesselId: string,
    monthValue: string
  ): Promise<RhVesselViolationCommentV2[]> {
    if (!vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!monthValue) {
      throw new Error("Month value is required");
    }
    return vesselCommentsRepository.findAll({ vesselId, monthValue });
  },

  async create(
    data: Omit<InsertRhVesselViolationCommentV2, "vesselCommentUuid"> & { auditUserUuid?: string }
  ): Promise<RhVesselViolationCommentV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return vesselCommentsRepository.create(dataWithAudit);
  },

  async update(
    vesselCommentUuid: string,
    data: Partial<InsertRhVesselViolationCommentV2> & { auditUserUuid?: string }
  ): Promise<RhVesselViolationCommentV2> {
    await this.getByUuid(vesselCommentUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await vesselCommentsRepository.update(vesselCommentUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update vessel comment: ${vesselCommentUuid}`);
    }
    return updated;
  },

  async delete(vesselCommentUuid: string): Promise<void> {
    await this.getByUuid(vesselCommentUuid);
    const success = await vesselCommentsRepository.softDelete(vesselCommentUuid);
    if (!success) {
      throw new Error(`Failed to delete vessel comment: ${vesselCommentUuid}`);
    }
  },
};
