import { NcReportsRepository } from "../repositories";
import type {
  RhNcReportV2,
  InsertRhNcReportV2,
} from "../../../../shared/v2/rest-hours/types";

const ncReportsRepository = new NcReportsRepository();

const TIMESTAMP_FIELDS = [
  "preventiveActionDueDate",
  "preventiveActionDateCompleted",
  "officeClosureDate",
] as const;

function coerceDates<T extends Record<string, any>>(data: T): T {
  const result: Record<string, any> = { ...data };
  for (const field of TIMESTAMP_FIELDS) {
    if (field in result && result[field] != null && !(result[field] instanceof Date)) {
      result[field] = new Date(result[field]);
    }
  }
  return result as T;
}

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

export const ncReportsService = {
  async getAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthValue?: string;
  }): Promise<RhNcReportV2[]> {
    return ncReportsRepository.findAll(filters);
  },

  async getByUuid(ncReportUuid: string): Promise<RhNcReportV2> {
    const report = await ncReportsRepository.findByUuid(ncReportUuid);
    if (!report) {
      throw new Error(`NC report not found: ${ncReportUuid}`);
    }
    return report;
  },

  async getByVesselAndMonth(
    vesselId: string,
    monthValue: string
  ): Promise<RhNcReportV2[]> {
    if (!vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!monthValue) {
      throw new Error("Month value is required");
    }
    return ncReportsRepository.findAll({ vesselId, monthValue });
  },

  async getByCrewMember(crewMemberId: string): Promise<RhNcReportV2[]> {
    if (!crewMemberId) {
      throw new Error("Crew member ID is required");
    }
    return ncReportsRepository.findAll({ crewMemberId });
  },

  async create(
    data: Omit<InsertRhNcReportV2, "ncReportUuid"> & { auditUserUuid?: string }
  ): Promise<RhNcReportV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.crewMemberId) {
      throw new Error("Crew member ID is required");
    }

    const dataWithAudit = coerceDates(applyAuditUser(data, true));
    return ncReportsRepository.create(dataWithAudit);
  },

  async update(
    ncReportUuid: string,
    data: Partial<InsertRhNcReportV2> & { auditUserUuid?: string }
  ): Promise<RhNcReportV2> {
    await this.getByUuid(ncReportUuid);

    const dataWithAudit = coerceDates(applyAuditUser(data, false));
    const updated = await ncReportsRepository.update(ncReportUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update NC report: ${ncReportUuid}`);
    }
    return updated;
  },

  async delete(ncReportUuid: string): Promise<void> {
    await this.getByUuid(ncReportUuid);
    const success = await ncReportsRepository.softDelete(ncReportUuid);
    if (!success) {
      throw new Error(`Failed to delete NC report: ${ncReportUuid}`);
    }
  },
};
