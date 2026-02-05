import { CrewRecordsRepository } from "../repositories";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
} from "../../../../shared/v2/rest-hours/types";

const crewRecordsRepository = new CrewRecordsRepository();

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

export const crewRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthValue?: string;
  }): Promise<RhCrewRecordV2[]> {
    return crewRecordsRepository.findAll(filters);
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
  }): Promise<RhCrewRecordV2[]> {
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

    // For V2: If no records found and vesselIds provided, generate placeholder rows from crew_assignments
    if (allRecords.length === 0 && vesselIds && vesselIds.length > 0 && monthValue) {
      const db = getDb();
      for (const vesselId of vesselIds) {
        // Fetch current crew members from crew_assignments joined with crew_members_v2
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
        
        // Create placeholder records for each crew member
        for (const crew of crewData) {
          // Use Partial<RhCrewRecordV2> and cast to avoid strict type checking for placeholder records
          const placeholderRecord = {
            id: 0,
            rhCrewRecordUuid: `placeholder-${crew.crewUuid}-${monthValue}`,
            vesselId: vesselId,
            crewMemberId: crew.empNo || crew.crewUuid,
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

    return allRecords;
  },

  async getViolationsByRank(params: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<Record<string, number>> {
    const records = await crewRecordsRepository.findAll(params);
    
    const violationsByRank: Record<string, number> = {};
    for (const record of records) {
      const rank = record.rank || "Unknown";
      const violations = record.totalViolations || 0;
      violationsByRank[rank] = (violationsByRank[rank] || 0) + violations;
    }

    return violationsByRank;
  },

  async getNcsByRank(params: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<Record<string, number>> {
    const records = await crewRecordsRepository.findAll(params);
    
    const ncsByRank: Record<string, number> = {};
    for (const record of records) {
      const rank = record.rank || "Unknown";
      const ncs = record.totalNCs || 0;
      ncsByRank[rank] = (ncsByRank[rank] || 0) + ncs;
    }

    return ncsByRank;
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
