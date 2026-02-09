import { OfficeCommentsRepository } from "../repositories";
import type {
  RhOfficeViolationCommentV2,
  InsertRhOfficeViolationCommentV2,
} from "../../../../shared/v2/rest-hours/types";

const officeCommentsRepository = new OfficeCommentsRepository();

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

export const officeCommentsService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhOfficeViolationCommentV2[]> {
    return officeCommentsRepository.findAll(filters);
  },

  async getByUuid(officeCommentUuid: string): Promise<RhOfficeViolationCommentV2> {
    const comment = await officeCommentsRepository.findByUuid(officeCommentUuid);
    if (!comment) {
      throw new Error(`Office comment not found: ${officeCommentUuid}`);
    }
    return comment;
  },

  async getByVesselAndMonth(
    vesselId: string,
    monthValue: string
  ): Promise<RhOfficeViolationCommentV2[]> {
    if (!vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!monthValue) {
      throw new Error("Month value is required");
    }
    return officeCommentsRepository.findAll({ vesselId, monthValue });
  },

  async create(
    data: Omit<InsertRhOfficeViolationCommentV2, "officeCommentUuid"> & { auditUserUuid?: string }
  ): Promise<RhOfficeViolationCommentV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const processedData = { ...data };
    if (processedData.reviewDate && !(processedData.reviewDate instanceof Date)) {
      const parsed = new Date(processedData.reviewDate as any);
      processedData.reviewDate = isNaN(parsed.getTime()) ? null : parsed;
    }

    const existing = await officeCommentsRepository.findAll({
      vesselId: data.vesselId,
      monthValue: data.monthValue,
    });

    if (existing.length > 0) {
      const dataWithAudit = applyAuditUser(processedData, false);
      const { vesselId, monthValue, ...updateFields } = dataWithAudit;
      const updated = await officeCommentsRepository.update(existing[0].officeCommentUuid, updateFields);
      if (!updated) {
        throw new Error("Failed to update existing office comment");
      }
      return updated;
    }

    const dataWithAudit = applyAuditUser(processedData, true);
    return officeCommentsRepository.create(dataWithAudit);
  },

  async update(
    officeCommentUuid: string,
    data: Partial<InsertRhOfficeViolationCommentV2> & { auditUserUuid?: string }
  ): Promise<RhOfficeViolationCommentV2> {
    await this.getByUuid(officeCommentUuid);

    const processedData = { ...data };
    if (processedData.reviewDate && !(processedData.reviewDate instanceof Date)) {
      const parsed = new Date(processedData.reviewDate as any);
      processedData.reviewDate = isNaN(parsed.getTime()) ? null : parsed;
    }

    const dataWithAudit = applyAuditUser(processedData, false);
    const updated = await officeCommentsRepository.update(officeCommentUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update office comment: ${officeCommentUuid}`);
    }
    return updated;
  },

  async delete(officeCommentUuid: string): Promise<void> {
    await this.getByUuid(officeCommentUuid);
    const success = await officeCommentsRepository.softDelete(officeCommentUuid);
    if (!success) {
      throw new Error(`Failed to delete office comment: ${officeCommentUuid}`);
    }
  },
};
