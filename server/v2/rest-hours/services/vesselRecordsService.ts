import { VesselRecordsRepository } from "../repositories";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";

const vesselRecordsRepository = new VesselRecordsRepository();

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

export const vesselRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselRecordV2[]> {
    return vesselRecordsRepository.findAll(filters);
  },

  async getByUuid(rhVesselUuid: string): Promise<RhVesselRecordV2> {
    const record = await vesselRecordsRepository.findByUuid(rhVesselUuid);
    if (!record) {
      throw new Error(`Vessel record not found: ${rhVesselUuid}`);
    }
    return record;
  },

  async getByFilters(
    vesselIds: string[],
    monthValue?: string
  ): Promise<RhVesselRecordV2[]> {
    if (!vesselIds || vesselIds.length === 0) {
      return [];
    }

    const allRecords: RhVesselRecordV2[] = [];
    for (const vesselId of vesselIds) {
      const records = await vesselRecordsRepository.findAll({
        vesselId,
        monthValue,
      });
      allRecords.push(...records);
    }

    return allRecords;
  },

  async create(
    data: Omit<InsertRhVesselRecordV2, "rhVesselUuid"> & { auditUserUuid?: string }
  ): Promise<RhVesselRecordV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return vesselRecordsRepository.create(dataWithAudit);
  },

  async update(
    rhVesselUuid: string,
    data: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string }
  ): Promise<RhVesselRecordV2> {
    await this.getByUuid(rhVesselUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await vesselRecordsRepository.update(rhVesselUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update vessel record: ${rhVesselUuid}`);
    }
    return updated;
  },

  async delete(rhVesselUuid: string): Promise<void> {
    await this.getByUuid(rhVesselUuid);
    const success = await vesselRecordsRepository.softDelete(rhVesselUuid);
    if (!success) {
      throw new Error(`Failed to delete vessel record: ${rhVesselUuid}`);
    }
  },

  async submitVesselReview(
    rhVesselUuid: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    await this.getByUuid(rhVesselUuid);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      vesselReviewStatus: "Submitted",
      vesselReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(rhVesselUuid, updateData);
  },

  async submitOfficeReview(
    rhVesselUuid: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    await this.getByUuid(rhVesselUuid);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      officeReviewStatus: "Submitted",
      officeReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(rhVesselUuid, updateData);
  },
};
