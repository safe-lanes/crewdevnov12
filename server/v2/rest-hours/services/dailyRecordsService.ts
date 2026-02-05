import { DailyRecordsRepository } from "../repositories";
import type {
  RhDailyRecordV2,
  InsertRhDailyRecordV2,
} from "../../../../shared/v2/rest-hours/types";

const dailyRecordsRepository = new DailyRecordsRepository();

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

export const dailyRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthYear?: string;
  }): Promise<RhDailyRecordV2[]> {
    return dailyRecordsRepository.findAll(filters);
  },

  async getByUuid(rhDailyUuid: string): Promise<RhDailyRecordV2> {
    const record = await dailyRecordsRepository.findByUuid(rhDailyUuid);
    if (!record) {
      throw new Error(`Daily record not found: ${rhDailyUuid}`);
    }
    return record;
  },

  async getByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhDailyRecordV2 | undefined> {
    if (!crewMemberId || !vesselId || !monthYear) {
      throw new Error("Crew member ID, vessel ID, and month year are required");
    }
    return dailyRecordsRepository.findByKey(crewMemberId, vesselId, monthYear);
  },

  async create(
    data: Omit<InsertRhDailyRecordV2, "rhDailyUuid"> & { auditUserUuid?: string }
  ): Promise<RhDailyRecordV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.crewMemberId) {
      throw new Error("Crew member ID is required");
    }
    if (!data.monthYear) {
      throw new Error("Month year is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return dailyRecordsRepository.create(dataWithAudit);
  },

  async update(
    rhDailyUuid: string,
    data: Partial<InsertRhDailyRecordV2> & { auditUserUuid?: string }
  ): Promise<RhDailyRecordV2> {
    await this.getByUuid(rhDailyUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await dailyRecordsRepository.update(rhDailyUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update daily record: ${rhDailyUuid}`);
    }
    return updated;
  },

  async delete(rhDailyUuid: string): Promise<void> {
    await this.getByUuid(rhDailyUuid);
    const success = await dailyRecordsRepository.softDelete(rhDailyUuid);
    if (!success) {
      throw new Error(`Failed to delete daily record: ${rhDailyUuid}`);
    }
  },

  async backfillViolations(params: {
    vesselId: string;
    monthYear: string;
  }): Promise<{ processed: number; violationsFound: number }> {
    const { vesselId, monthYear } = params;

    if (!vesselId || !monthYear) {
      throw new Error("Vessel ID and month year are required for backfill");
    }

    const records = await dailyRecordsRepository.findAll({
      vesselId,
      monthYear,
    });

    let processed = 0;
    let violationsFound = 0;

    for (const record of records) {
      processed++;

      try {
        const dailyData = JSON.parse(record.dailyRecords || "[]");
        for (const day of dailyData as any[]) {
          const restHours = day.restHours ?? 0;
          if (restHours < 10) {
            violationsFound++;
          }
        }
      } catch (e) {
      }
    }

    return { processed, violationsFound };
  },
};
