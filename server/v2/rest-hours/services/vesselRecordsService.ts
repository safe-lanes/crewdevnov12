import { VesselRecordsRepository, CrewRecordsRepository } from "../repositories";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { crewRecordsService } from "./crewRecordsService";

const vesselRecordsRepository = new VesselRecordsRepository();
const crewRecordsRepository = new CrewRecordsRepository();

function getMonthBounds(monthValue: string): { firstDay: string; lastDay: string } {
  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = `${monthValue}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
  return { firstDay, lastDay };
}

async function getOnboardCrewCountsForMonths(
  records: Array<{ vesselId: string; monthValue: string }>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (records.length === 0) return map;

  const db = getDb();
  const vesselIds = Array.from(new Set(records.map(r => r.vesselId)));

  const rows = await db
    .select({
      vesselUuid: crewAssignments.vesselUuid,
      signOnDate: crewAssignments.signOnDate,
      signOffDate: crewAssignments.signOffDate,
      isCurrent: crewAssignments.isCurrent,
      crewUuid: crewAssignments.crewUuid,
      empNo: crewMembersV2.empNo,
    })
    .from(crewAssignments)
    .innerJoin(crewMembersV2, eq(crewAssignments.crewUuid, crewMembersV2.crewUuid))
    .where(
      and(
        inArray(crewAssignments.vesselUuid, vesselIds),
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
      )
    );

  for (const record of records) {
    const { firstDay, lastDay } = getMonthBounds(record.monthValue);
    const key = `${record.vesselId}|${record.monthValue}`;

    const deduped = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (row.vesselUuid !== record.vesselId) continue;
      if (!row.signOnDate || row.signOnDate > lastDay) continue;
      const effectiveSignOff = (row.signOffDate && row.signOffDate !== '') ? row.signOffDate : null;
      if (effectiveSignOff && effectiveSignOff < firstDay) continue;

      const crewId = row.empNo || row.crewUuid;
      const dedupKey = `${row.vesselUuid}|${crewId}`;
      const existing = deduped.get(dedupKey);
      if (!existing) {
        deduped.set(dedupKey, row);
      } else {
        const existingDate = existing.signOnDate || '';
        const newDate = row.signOnDate || '';
        if (newDate > existingDate) {
          deduped.set(dedupKey, row);
        } else if (newDate === existingDate && row.isCurrent && !existing.isCurrent) {
          deduped.set(dedupKey, row);
        }
      }
    }

    map.set(key, deduped.size);
  }

  return map;
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

async function enrichVesselRecordsWithLiveCounts(
  records: RhVesselRecordV2[]
): Promise<RhVesselRecordV2[]> {
  if (records.length === 0) return [];

  const vesselIds = Array.from(new Set(records.map(r => r.vesselId)));
  const monthValues = Array.from(new Set(records.map(r => r.monthValue)));

  const recordKeys = records.map(r => ({ vesselId: r.vesselId, monthValue: r.monthValue }));

  const [crewCountsMap, allEnrichedCrew] = await Promise.all([
    getOnboardCrewCountsForMonths(recordKeys),
    crewRecordsService.getAllBulk({ vesselIds, monthValue: monthValues.length === 1 ? monthValues[0] : undefined }),
  ]);

  const crewByVesselMonth = new Map<string, typeof allEnrichedCrew>();
  for (const crew of allEnrichedCrew) {
    const key = `${crew.vesselId}|${crew.monthValue}`;
    let group = crewByVesselMonth.get(key);
    if (!group) {
      group = [];
      crewByVesselMonth.set(key, group);
    }
    group.push(crew);
  }

  return records.map(record => {
    const onboardCrewCount = crewCountsMap.get(`${record.vesselId}|${record.monthValue}`) || 0;
    const totalCrew = Math.max(onboardCrewCount, record.totalCrew || 0);

    const key = `${record.vesselId}|${record.monthValue}`;
    const crewRecords = crewByVesselMonth.get(key);

    if (crewRecords && crewRecords.length > 0) {
      const totalViolations = crewRecords.reduce((sum, r) => sum + (r.totalViolations || 0), 0);
      const crewWithViolations = crewRecords.filter(r => (r.totalViolations || 0) > 0).length;
      const totalNCs = crewRecords.reduce((sum, r) => sum + (r.totalNCs || 0), 0);
      const crewWithNCs = crewRecords.filter(r => (r.totalNCs || 0) > 0).length;
      const predictedViolations = crewRecords.reduce((sum, r) => sum + (r.predictedViolations || 0), 0);
      const crewWithPredictedViolations = crewRecords.filter(r => (r.predictedViolations || 0) > 0).length;
      const predictedNCs = crewRecords.reduce((sum, r) => sum + (r.predictedNCs || 0), 0);
      const crewWithPredictedNCs = crewRecords.filter(r => (r.totalNCs || 0) === 0 && (r.predictedNCs || 0) > 0).length;

      const totalPercent = crewRecords.reduce((sum, r) => sum + (r.recordingStatusPercent || 0), 0);
      const averagePercent = Math.round(totalPercent / crewRecords.length);

      const crewWithConflicts = crewRecords.filter(r => r.activityConflicting === true);
      const activityConflicting = crewWithConflicts.length > 0;
      const crewWithActivityConflictsCount = crewWithConflicts.length;
      const crewWithActivityConflictsDetails = crewWithConflicts.length > 0
        ? JSON.stringify(crewWithConflicts.map(r => ({ name: r.name, rank: r.rank })))
        : null;

      return {
        ...record,
        totalCrew,
        totalViolations,
        crewWithViolations,
        totalNCs,
        crewWithNCs,
        predictedViolations,
        crewWithPredictedViolations,
        predictedNCs,
        crewWithPredictedNCs,
        recordingStatusPercent: averagePercent,
        activityConflicting,
        crewWithActivityConflicts: crewWithActivityConflictsCount,
        crewWithActivityConflictsDetails,
      };
    }

    return {
      ...record,
      totalCrew,
    };
  });
}

export const vesselRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselRecordV2[]> {
    const records = await vesselRecordsRepository.findAll(filters);
    return enrichVesselRecordsWithLiveCounts(records);
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

    return enrichVesselRecordsWithLiveCounts(allRecords);
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

  async getByVesselId(vesselId: string): Promise<RhVesselRecordV2> {
    const record = await vesselRecordsRepository.findByVesselId(vesselId);
    if (!record) {
      throw new Error(`Vessel record not found for vesselId: ${vesselId}`);
    }
    return record;
  },

  async submitVesselReview(
    vesselId: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      vesselReviewStatus: "Submitted",
      vesselReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(record.rhVesselUuid, updateData);
  },

  async submitOfficeReview(
    vesselId: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      officeReviewStatus: "Submitted",
      officeReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(record.rhVesselUuid, updateData);
  },
};
