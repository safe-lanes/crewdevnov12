import { DatelineRepository } from "../repositories";
import type {
  RhDatelineAdjustmentV2,
  InsertRhDatelineAdjustmentV2,
} from "../../../../shared/v2/rest-hours/types";

const datelineRepository = new DatelineRepository();

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

export const datelineService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhDatelineAdjustmentV2[]> {
    return datelineRepository.findAll(filters);
  },

  async getByUuid(adjustmentUuid: string): Promise<RhDatelineAdjustmentV2> {
    const adjustment = await datelineRepository.findByUuid(adjustmentUuid);
    if (!adjustment) {
      throw new Error(`Dateline adjustment not found: ${adjustmentUuid}`);
    }
    return adjustment;
  },

  async getByVesselAndMonth(
    vesselId: string,
    monthValue: string
  ): Promise<RhDatelineAdjustmentV2[]> {
    if (!vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!monthValue) {
      throw new Error("Month value is required");
    }
    return datelineRepository.findAll({ vesselId, monthValue });
  },

  async create(
    data: Omit<InsertRhDatelineAdjustmentV2, "adjustmentUuid"> & { auditUserUuid?: string }
  ): Promise<RhDatelineAdjustmentV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return datelineRepository.create(dataWithAudit);
  },

  async update(
    adjustmentUuid: string,
    data: Partial<InsertRhDatelineAdjustmentV2> & { auditUserUuid?: string }
  ): Promise<RhDatelineAdjustmentV2> {
    await this.getByUuid(adjustmentUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await datelineRepository.update(adjustmentUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update dateline adjustment: ${adjustmentUuid}`);
    }
    return updated;
  },

  async delete(adjustmentUuid: string): Promise<void> {
    await this.getByUuid(adjustmentUuid);
    const success = await datelineRepository.softDelete(adjustmentUuid);
    if (!success) {
      throw new Error(`Failed to delete dateline adjustment: ${adjustmentUuid}`);
    }
  },
};
