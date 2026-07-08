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
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted)),
        // Only Signed On crew count toward total crew / recording %, so the
        // count stays consistent with the (Signed On only) RH Records list.
        eq(crewAssignments.assignmentType, "OnBoard")
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
  records: RhVesselRecordV2[],
  complianceMode: 'Rest' | 'Work' = 'Rest',
  opaMode: boolean = false
): Promise<RhVesselRecordV2[]> {
  if (records.length === 0) return [];

  const vesselIds = Array.from(new Set(records.map(r => r.vesselId)));
  const monthValues = Array.from(new Set(records.map(r => r.monthValue)));

  const recordKeys = records.map(r => ({ vesselId: r.vesselId, monthValue: r.monthValue }));

  const [crewCountsMap, allEnrichedCrew] = await Promise.all([
    getOnboardCrewCountsForMonths(recordKeys),
    crewRecordsService.getAllBulk({
      vesselIds,
      monthValue: monthValues.length === 1 ? monthValues[0] : undefined,
      complianceMode,
      opaMode,
    }),
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
      const totalNCs = crewRecords.reduce((sum, r) => sum + (r.totalNCs || 0), 0);
      const predictedViolations = crewRecords.reduce((sum, r) => sum + (r.predictedViolations || 0), 0);
      const predictedNCs = crewRecords.reduce((sum, r) => sum + (r.predictedNCs || 0), 0);

      const crewViolMap = new Map<string, number>();
      const crewNCMap = new Map<string, number>();
      const crewPredViolMap = new Map<string, number>();
      const crewPredNCMap = new Map<string, { totalNCs: number; predictedNCs: number }>();
      const crewConflictMap = new Map<string, { name: string; rank: string }>();
      for (const r of crewRecords) {
        const cid = r.crewMemberId || '';
        crewViolMap.set(cid, (crewViolMap.get(cid) || 0) + (r.totalViolations || 0));
        crewNCMap.set(cid, (crewNCMap.get(cid) || 0) + (r.totalNCs || 0));
        crewPredViolMap.set(cid, (crewPredViolMap.get(cid) || 0) + (r.predictedViolations || 0));
        const prev = crewPredNCMap.get(cid) || { totalNCs: 0, predictedNCs: 0 };
        crewPredNCMap.set(cid, {
          totalNCs: prev.totalNCs + (r.totalNCs || 0),
          predictedNCs: prev.predictedNCs + (r.predictedNCs || 0),
        });
        if (r.activityConflicting === true) {
          crewConflictMap.set(cid, { name: r.name || '', rank: r.rank || '' });
        }
      }
      const crewWithViolations = [...crewViolMap.values()].filter(v => v > 0).length;
      const crewWithNCs = [...crewNCMap.values()].filter(v => v > 0).length;
      const crewWithPredictedViolations = [...crewPredViolMap.values()].filter(v => v > 0).length;
      const crewWithPredictedNCs = [...crewPredNCMap.values()].filter(
        v => v.totalNCs === 0 && v.predictedNCs > 0
      ).length;

      const totalPercent = crewRecords.reduce((sum, r) => sum + (r.recordingStatusPercent || 0), 0);
      const divisor = Math.max(totalCrew, crewRecords.length) || 1;
      const averagePercent = Math.round(totalPercent / divisor);

      const activityConflicting = crewConflictMap.size > 0;
      const crewWithActivityConflictsCount = crewConflictMap.size;
      const crewWithActivityConflictsDetails = crewConflictMap.size > 0
        ? JSON.stringify([...crewConflictMap.values()])
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
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<RhVesselRecordV2[]> {
    const { complianceMode, opaMode, ...repoFilters } = filters || {};
    const records = await vesselRecordsRepository.findAll(repoFilters);
    return enrichVesselRecordsWithLiveCounts(records, complianceMode, opaMode);
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
    monthValue?: string,
    complianceMode: 'Rest' | 'Work' = 'Rest',
    opaMode: boolean = false
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

    return enrichVesselRecordsWithLiveCounts(allRecords, complianceMode, opaMode);
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

  async getByVesselId(vesselId: string, monthValue?: string): Promise<RhVesselRecordV2> {
    const record = await vesselRecordsRepository.findByVesselId(vesselId, monthValue);
    if (!record) {
      throw new Error(`Vessel record not found for vesselId: ${vesselId}`);
    }
    return record;
  },

  async submitVesselReview(
    vesselId: string,
    data: {
      auditUserUuid?: string;
      monthValue?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId, data.monthValue);

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
      monthValue?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId, data.monthValue);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      officeReviewStatus: "Submitted",
      officeReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(record.rhVesselUuid, updateData);
  },
};
