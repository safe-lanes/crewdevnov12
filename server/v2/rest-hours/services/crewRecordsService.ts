import { CrewRecordsRepository, DailyRecordsRepository } from "../repositories";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import {
  getViolationDates,
  countViolationDays,
  calculateNCs,
  calculateRecordingPercentage,
} from "../utils/violationHelpers";

const crewRecordsRepository = new CrewRecordsRepository();
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

async function resolveVesselNames(vesselIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (vesselIds.length === 0) return map;

  const db = getDb();
  const uniqueIds = Array.from(new Set(vesselIds));

  try {
    const vessels = await db
      .select({
        vesselUuid: masterVessels.vesselUuid,
        vessel: masterVessels.vessel,
      })
      .from(masterVessels)
      .where(inArray(masterVessels.vesselUuid, uniqueIds));

    for (const v of vessels) {
      if (v.vesselUuid && v.vessel) {
        map.set(v.vesselUuid, v.vessel);
      }
    }
  } catch (error) {
    console.error('Failed to resolve vessel names:', error);
  }

  return map;
}

type EnrichedCrewRecord = RhCrewRecordV2 & {
  vesselName?: string;
  violationDates?: string | null;
  predictedViolationDates?: string | null;
};

async function enrichRecordsWithComputedFields(
  records: RhCrewRecordV2[],
  complianceMode: 'Rest' | 'Work' = 'Rest',
  opaMode: boolean = false
): Promise<EnrichedCrewRecord[]> {
  if (records.length === 0) return [];

  const vesselIds = Array.from(new Set(records.map(r => r.vesselId)));
  const vesselNameMap = await resolveVesselNames(vesselIds);

  const dailyRecordsMap = new Map<string, string>();
  for (const vesselId of vesselIds) {
    const monthValues = Array.from(new Set(
      records
        .filter(r => r.vesselId === vesselId)
        .map(r => r.monthValue)
    ));
    for (const monthValue of monthValues) {
      const dailyRecords = await dailyRecordsRepository.findAll({
        vesselId,
        monthYear: monthValue,
      });
      for (const dr of dailyRecords) {
        const key = `${dr.crewMemberId}-${dr.vesselId}-${dr.monthYear}`;
        dailyRecordsMap.set(key, dr.dailyRecords);
      }
    }
  }

  return records.map(record => {
    const vesselName = vesselNameMap.get(record.vesselId) || '';
    const key = `${record.crewMemberId}-${record.vesselId}-${record.monthValue}`;
    const dailyRecordsJson = dailyRecordsMap.get(key);

    let violationDatesJson: string | null = null;
    let predictedViolationDatesJson: string | null = null;

    if (dailyRecordsJson) {
      const vDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, false);
      const pDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, true);
      violationDatesJson = vDates.length > 0 ? JSON.stringify(vDates) : null;
      predictedViolationDatesJson = pDates.length > 0 ? JSON.stringify(pDates) : null;
    }

    const cappedPredictedNCs = (record.totalNCs && record.totalNCs >= 1) ? 0 : (record.predictedNCs || 0);

    return {
      ...record,
      predictedNCs: cappedPredictedNCs,
      vesselName,
      violationDates: violationDatesJson,
      predictedViolationDates: predictedViolationDatesJson,
    };
  });
}

export const crewRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthValue?: string;
  }): Promise<EnrichedCrewRecord[]> {
    const records = await crewRecordsRepository.findAll(filters);
    return enrichRecordsWithComputedFields(records);
  },

  async getByUuid(rhCrewRecordUuid: string): Promise<RhCrewRecordV2> {
    const record = await crewRecordsRepository.findByUuid(rhCrewRecordUuid);
    if (!record) {
      throw new Error(`Crew record not found: ${rhCrewRecordUuid}`);
    }
    return record;
  },

  async getByFilters(params: {
    vesselIds?: string[];
    monthValue?: string;
    ranks?: string[];
    search?: string;
  }): Promise<EnrichedCrewRecord[]> {
    const { vesselIds, monthValue, ranks, search } = params;

    let allRecords: RhCrewRecordV2[] = [];

    if (vesselIds && vesselIds.length > 0) {
      for (const vesselId of vesselIds) {
        const records = await crewRecordsRepository.findAll({
          vesselId,
          monthValue,
        });
        allRecords.push(...records);
      }
    } else {
      allRecords = await crewRecordsRepository.findAll({ monthValue });
    }

    if (vesselIds && vesselIds.length > 0 && monthValue) {
      const existingCrewIds = new Set(
        allRecords.map(r => r.crewMemberId)
      );

      const db = getDb();
      for (const vesselId of vesselIds) {
        const crewData = await db
          .select({
            crewUuid: crewAssignments.crewUuid,
            vesselUuid: crewAssignments.vesselUuid,
            signOnDate: crewAssignments.signOnDate,
            firstName: crewMembersV2.firstName,
            familyName: crewMembersV2.familyName,
            presentRank: crewMembersV2.presentRank,
            empNo: crewMembersV2.empNo,
          })
          .from(crewAssignments)
          .innerJoin(
            crewMembersV2,
            eq(crewAssignments.crewUuid, crewMembersV2.crewUuid)
          )
          .where(
            and(
              eq(crewAssignments.vesselUuid, vesselId),
              eq(crewAssignments.isCurrent, true),
              or(
                eq(crewMembersV2.isDeleted, false),
                isNull(crewMembersV2.isDeleted)
              )
            )
          );

        for (const crew of crewData) {
          const crewId = crew.empNo || crew.crewUuid;
          if (existingCrewIds.has(crewId)) {
            continue;
          }

          const placeholderRecord = {
            id: 0,
            rhCrewRecordUuid: `placeholder-${crew.crewUuid}-${monthValue}`,
            vesselId: vesselId,
            crewMemberId: crewId,
            rank: crew.presentRank || 'Unknown',
            name: `${crew.firstName || ''} ${crew.familyName || ''}`.trim() || 'Unknown',
            month: monthValue,
            monthValue: monthValue,
            signOnOffInfo: crew.signOnDate || null,
            recordingStatusPercent: 0,
            activityConflicting: false,
            totalViolations: 0,
            totalNCs: 0,
            predictedViolations: 0,
            predictedNCs: 0,
            sortOrder: null,
            createdAt: null,
            updatedAt: null,
            createdByUuid: null,
            updatedByUuid: null,
            isDeleted: false,
            isSync: false,
          } as RhCrewRecordV2;
          allRecords.push(placeholderRecord);
        }
      }
    }

    if (ranks && ranks.length > 0) {
      allRecords = allRecords.filter((record) =>
        ranks.includes(record.rank || "")
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      allRecords = allRecords.filter(
        (record) =>
          record.name?.toLowerCase().includes(searchLower) ||
          record.crewMemberId?.toLowerCase().includes(searchLower)
      );
    }

    return enrichRecordsWithComputedFields(allRecords);
  },

  async getViolationsByRank(params: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<Array<{ rank: string; violationDays: number }>> {
    const records = await crewRecordsRepository.findAll(params);
    
    const violationsByRank: Record<string, number> = {};
    for (const record of records) {
      const rank = record.rank || "Unknown";
      const violations = record.totalViolations || 0;
      if (violations > 0) {
        violationsByRank[rank] = (violationsByRank[rank] || 0) + violations;
      }
    }

    return Object.entries(violationsByRank)
      .map(([rank, violationDays]) => ({ rank, violationDays }))
      .sort((a, b) => b.violationDays - a.violationDays);
  },

  async getNcsByRank(params: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<Array<{ rank: string; ncCount: number }>> {
    const records = await crewRecordsRepository.findAll(params);
    
    const ncsByRank: Record<string, number> = {};
    for (const record of records) {
      const rank = record.rank || "Unknown";
      const ncs = record.totalNCs || 0;
      if (ncs > 0) {
        ncsByRank[rank] = (ncsByRank[rank] || 0) + ncs;
      }
    }

    return Object.entries(ncsByRank)
      .map(([rank, ncCount]) => ({ rank, ncCount }))
      .sort((a, b) => b.ncCount - a.ncCount);
  },

  async create(
    data: Omit<InsertRhCrewRecordV2, "rhCrewRecordUuid"> & { auditUserUuid?: string }
  ): Promise<RhCrewRecordV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.crewMemberId) {
      throw new Error("Crew member ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return crewRecordsRepository.create(dataWithAudit);
  },

  async update(
    rhCrewRecordUuid: string,
    data: Partial<InsertRhCrewRecordV2> & { auditUserUuid?: string }
  ): Promise<RhCrewRecordV2> {
    await this.getByUuid(rhCrewRecordUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await crewRecordsRepository.update(rhCrewRecordUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update crew record: ${rhCrewRecordUuid}`);
    }
    return updated;
  },

  async delete(rhCrewRecordUuid: string): Promise<void> {
    await this.getByUuid(rhCrewRecordUuid);
    const success = await crewRecordsRepository.softDelete(rhCrewRecordUuid);
    if (!success) {
      throw new Error(`Failed to delete crew record: ${rhCrewRecordUuid}`);
    }
  },
};
