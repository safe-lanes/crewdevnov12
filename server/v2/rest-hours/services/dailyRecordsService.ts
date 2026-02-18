import { DailyRecordsRepository, CrewRecordsRepository, VesselRecordsRepository } from "../repositories";
import type {
  RhDailyRecordV2,
  InsertRhDailyRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import {
  calculateRecordingPercentage,
  countViolationDays,
  calculateNCs,
} from "../utils/violationHelpers";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, or, isNull } from "drizzle-orm";

const dailyRecordsRepository = new DailyRecordsRepository();
const crewRecordsRepository = new CrewRecordsRepository();
const vesselRecordsRepository = new VesselRecordsRepository();

async function getOnboardCrewCount(vesselId: string): Promise<number> {
  const db = getDb();
  const crewData = await db
    .select({ crewUuid: crewAssignments.crewUuid })
    .from(crewAssignments)
    .innerJoin(crewMembersV2, eq(crewAssignments.crewUuid, crewMembersV2.crewUuid))
    .where(
      and(
        eq(crewAssignments.vesselUuid, vesselId),
        eq(crewAssignments.isCurrent, true),
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
      )
    );
  return crewData.length;
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

function formatMonthDisplay(monthValue: string): string {
  if (!monthValue) return '';
  const [year, month] = monthValue.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]}-${year}`;
}

async function postSaveSync(crewMemberId: string, vesselId: string, monthYear: string) {
  try {
    const dailyRecord = await dailyRecordsRepository.findByKey(crewMemberId, vesselId, monthYear);
    if (!dailyRecord) {
      return;
    }

    const dailyRecordsJson = dailyRecord.dailyRecords || '[]';
    const recordingPercent = calculateRecordingPercentage(dailyRecordsJson, monthYear);

    const totalViolations = countViolationDays(dailyRecordsJson, 'Rest', false, false);
    const predictedViolations = countViolationDays(dailyRecordsJson, 'Rest', false, true);
    const { totalNCs, predictedNCs } = calculateNCs(dailyRecordsJson, 'Rest', false);

    const existingCrewRecords = await crewRecordsRepository.findAll({
      vesselId,
      crewMemberId,
      monthValue: monthYear,
    });
    const existingCrewRecord = existingCrewRecords[0];

    if (existingCrewRecord) {
      await crewRecordsRepository.update(existingCrewRecord.rhCrewRecordUuid, {
        recordingStatusPercent: recordingPercent,
        totalViolations,
        predictedViolations,
        totalNCs,
        predictedNCs,
      });
    } else {
      await crewRecordsRepository.create({
        crewMemberId,
        vesselId,
        rank: dailyRecord.rank || '',
        name: dailyRecord.name || '',
        monthValue: monthYear,
        month: formatMonthDisplay(monthYear),
        signOnOffInfo: '',
        recordingStatusPercent: recordingPercent,
        activityConflicting: false,
        totalViolations,
        totalNCs,
        predictedViolations,
        predictedNCs,
      });
    }

    await updateVesselRecordSync(vesselId, monthYear);
  } catch (error) {
    console.error('Failed to sync crew/vessel records after daily record save:', error);
  }
}

async function updateVesselRecordSync(vesselId: string, monthValue: string) {
  try {
    const crewRecords = await crewRecordsRepository.findAll({
      vesselId,
      monthValue,
    });

    if (crewRecords.length === 0) {
      return;
    }

    const onboardCrewCount = await getOnboardCrewCount(vesselId);
    const totalCrew = Math.max(onboardCrewCount, crewRecords.length);

    const totalPercent = crewRecords.reduce((sum, record) => sum + (record.recordingStatusPercent || 0), 0);
    const averagePercent = Math.round(totalPercent / crewRecords.length);
    const totalViolations = crewRecords.reduce((sum, r) => sum + (r.totalViolations || 0), 0);
    const crewWithViolations = crewRecords.filter(r => (r.totalViolations || 0) > 0).length;
    const totalNCs = crewRecords.reduce((sum, r) => sum + (r.totalNCs || 0), 0);
    const crewWithNCs = crewRecords.filter(r => (r.totalNCs || 0) > 0).length;
    const predictedViolations = crewRecords.reduce((sum, r) => sum + (r.predictedViolations || 0), 0);
    const crewWithPredictedViolations = crewRecords.filter(r => (r.predictedViolations || 0) > 0).length;
    const predictedNCs = crewRecords.reduce((sum, r) => sum + (r.predictedNCs || 0), 0);
    const crewWithPredictedNCs = crewRecords.filter(r => (r.totalNCs || 0) === 0 && (r.predictedNCs || 0) > 0).length;

    const existingVesselRecords = await vesselRecordsRepository.findAll({
      vesselId,
      monthValue,
    });
    const existingVesselRecord = existingVesselRecords[0];

    if (existingVesselRecord) {
      await vesselRecordsRepository.update(existingVesselRecord.rhVesselUuid, {
        totalCrew,
        recordingStatusPercent: averagePercent,
        totalViolations,
        crewWithViolations,
        totalNCs,
        crewWithNCs,
        predictedViolations,
        crewWithPredictedViolations,
        predictedNCs,
        crewWithPredictedNCs,
      });
    } else {
      await vesselRecordsRepository.create({
        vesselId,
        monthValue,
        month: formatMonthDisplay(monthValue),
        totalCrew,
        recordingStatusPercent: averagePercent,
        activityConflicting: false,
        totalViolations,
        crewWithViolations,
        totalNCs,
        crewWithNCs,
        predictedViolations,
        crewWithPredictedViolations,
        predictedNCs,
        crewWithPredictedNCs,
        officeReviewStatus: '',
      });
    }
  } catch (error) {
    console.error('Failed to sync vessel record:', error);
  }
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
    const record = await dailyRecordsRepository.create(dataWithAudit);

    await postSaveSync(record.crewMemberId, record.vesselId, record.monthYear);

    return record;
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

    await postSaveSync(updated.crewMemberId, updated.vesselId, updated.monthYear);

    return updated;
  },

  async delete(rhDailyUuid: string): Promise<void> {
    const record = await this.getByUuid(rhDailyUuid);
    const success = await dailyRecordsRepository.softDelete(rhDailyUuid);
    if (!success) {
      throw new Error(`Failed to delete daily record: ${rhDailyUuid}`);
    }

    await postSaveSync(record.crewMemberId, record.vesselId, record.monthYear);
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

  async resyncAllRecords(): Promise<{ processed: number }> {
    const allDailyRecords = await dailyRecordsRepository.findAll({});
    let processed = 0;

    for (const record of allDailyRecords) {
      try {
        await postSaveSync(record.crewMemberId, record.vesselId, record.monthYear);
        processed++;
      } catch (e) {
        console.error(`Failed to resync record ${record.rhDailyUuid}:`, e);
      }
    }

    return { processed };
  },
};
