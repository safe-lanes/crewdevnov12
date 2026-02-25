import { CrewRecordsRepository, DailyRecordsRepository } from "../repositories";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import { eq, and, or, isNull, inArray, lte, gte } from "drizzle-orm";
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

// ─── Date helpers ────────────────────────────────────────────────────────────

function getMonthBounds(monthValue: string): { firstDay: string; lastDay: string } {
  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = `${monthValue}-01`;
  const lastDayDate = new Date(year, month, 0);
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
  return { firstDay, lastDay };
}

function dateInMonth(date: string | null | undefined, firstDay: string, lastDay: string): boolean {
  if (!date) return false;
  return date >= firstDay && date <= lastDay;
}

function formatDateDisplay(date: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  return `${String(day).padStart(2, '0')}-${months[monthIdx]}-${year}`;
}

function buildSignOnOffInfo(
  signOnDate: string | null | undefined,
  signOffDate: string | null | undefined,
  firstDay: string,
  lastDay: string
): string | null {
  const signOnInMonth = dateInMonth(signOnDate, firstDay, lastDay);
  const signOffInMonth = dateInMonth(signOffDate, firstDay, lastDay);

  if (signOnInMonth && signOffInMonth) {
    return `S.On: ${formatDateDisplay(signOnDate!)} | S.Off: ${formatDateDisplay(signOffDate!)}`;
  } else if (signOnInMonth) {
    return `S.On: ${formatDateDisplay(signOnDate!)}`;
  } else if (signOffInMonth) {
    return `S.Off: ${formatDateDisplay(signOffDate!)}`;
  }
  return null;
}

function getApplicableDayRange(
  signOnDate: string | null | undefined,
  signOffDate: string | null | undefined,
  firstDay: string,
  lastDay: string,
  monthValue: string
): { from: number; to: number } {
  const [year, month] = monthValue.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  let from = 1;
  let to = daysInMonth;

  if (signOnDate && signOnDate >= firstDay && signOnDate <= lastDay) {
    from = parseInt(signOnDate.split('-')[2], 10);
  }

  if (signOffDate && signOffDate >= firstDay && signOffDate <= lastDay) {
    to = parseInt(signOffDate.split('-')[2], 10);
  }

  return { from, to };
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

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

// ─── Vessel name resolution ───────────────────────────────────────────────────

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

// ─── Enrich records ───────────────────────────────────────────────────────────

type EnrichedCrewRecord = RhCrewRecordV2 & {
  vesselName?: string;
  violationDates?: string | null;
  predictedViolationDates?: string | null;
};

type RecordWithAssignment = RhCrewRecordV2 & {
  _signOnDate?: string | null;
  _signOffDate?: string | null;
};

async function enrichRecordsWithComputedFields(
  records: RecordWithAssignment[],
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

    if (dailyRecordsJson && record.monthValue) {
      const { firstDay, lastDay } = getMonthBounds(record.monthValue);
      const dayRange = (record._signOnDate || record._signOffDate)
        ? getApplicableDayRange(record._signOnDate, record._signOffDate, firstDay, lastDay, record.monthValue)
        : undefined;

      const vDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, false, dayRange);
      const pDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, true, dayRange);
      violationDatesJson = vDates.length > 0 ? JSON.stringify(vDates) : null;
      predictedViolationDatesJson = pDates.length > 0 ? JSON.stringify(pDates) : null;
    }

    const cappedPredictedNCs = (record.totalNCs && record.totalNCs >= 1) ? 0 : (record.predictedNCs || 0);

    const { _signOnDate, _signOffDate, ...cleanRecord } = record as any;

    return {
      ...cleanRecord,
      predictedNCs: cappedPredictedNCs,
      vesselName,
      violationDates: violationDatesJson,
      predictedViolationDates: predictedViolationDatesJson,
    };
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

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

    let allRecords: RecordWithAssignment[] = [];

    if (vesselIds && vesselIds.length > 0) {
      for (const vesselId of vesselIds) {
        const records = await crewRecordsRepository.findAll({
          vesselId,
          monthValue,
        });
        allRecords.push(...records);
      }
    } else {
      const records = await crewRecordsRepository.findAll({ monthValue });
      allRecords.push(...records);
    }

    if (vesselIds && vesselIds.length > 0 && monthValue) {
      const { firstDay, lastDay } = getMonthBounds(monthValue);

      const db = getDb();
      for (const vesselId of vesselIds) {

        // Query ALL assignments for this vessel that overlap with the given month.
        // Overlap condition:
        //   signOnDate <= lastDay of month
        //   AND (signOffDate >= firstDay of month OR signOffDate is null/empty)
        // We also include isCurrent=true crew who may have no signOnDate yet (backward compat).
        const crewData = await db
          .select({
            crewUuid: crewAssignments.crewUuid,
            vesselUuid: crewAssignments.vesselUuid,
            signOnDate: crewAssignments.signOnDate,
            signOffDate: crewAssignments.signOffDate,
            isCurrent: crewAssignments.isCurrent,
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
              or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted)),
              or(
                // Case 1: Date-based overlap — signed on before/during month end
                // AND still on board or signed off during/after month start
                and(
                  lte(crewAssignments.signOnDate, lastDay),
                  or(
                    isNull(crewAssignments.signOffDate),
                    eq(crewAssignments.signOffDate, ''),
                    gte(crewAssignments.signOffDate, firstDay)
                  )
                ),
                // Case 2: Backward compat — currently on board with no sign-on date recorded
                eq(crewAssignments.isCurrent, true)
              )
            )
          );

        // Deduplicate by crewId — if multiple assignments match (e.g. rejoined crew),
        // keep the one with the latest signOnDate. On a tie, prefer isCurrent=true
        // so stale records with an erroneous signOffDate never win over the live record.
        const assignmentByCrewId = new Map<string, typeof crewData[0]>();
        for (const crew of crewData) {
          const crewId = crew.empNo || crew.crewUuid;
          const existing = assignmentByCrewId.get(crewId);
          if (!existing) {
            assignmentByCrewId.set(crewId, crew);
          } else {
            const existingDate = existing.signOnDate || '';
            const newDate = crew.signOnDate || '';
            if (newDate > existingDate) {
              assignmentByCrewId.set(crewId, crew);
            } else if (newDate === existingDate && crew.isCurrent && !existing.isCurrent) {
              // Same signOnDate — the currently-active assignment wins
              assignmentByCrewId.set(crewId, crew);
            }
          }
        }

        // Update signOnOffInfo for existing records from the DB using the assignment data
        for (const record of allRecords) {
          if (record.vesselId !== vesselId) continue;
          const assignment = assignmentByCrewId.get(record.crewMemberId);
          if (assignment) {
            // If the crew member is still on board (isCurrent=true), suppress any
            // signOffDate — they haven't actually left yet regardless of stored value.
            const effectiveSignOffDate = assignment.isCurrent ? null : assignment.signOffDate;
            record.signOnOffInfo = buildSignOnOffInfo(
              assignment.signOnDate,
              effectiveSignOffDate,
              firstDay,
              lastDay
            );
            record._signOnDate = assignment.signOnDate;
            record._signOffDate = effectiveSignOffDate;
          }
        }

        // Build set of crew IDs that already have a DB record this month
        const existingCrewIds = new Set(
          allRecords.filter(r => r.vesselId === vesselId).map(r => r.crewMemberId)
        );

        // Add placeholder records for crew on board this month without existing records
        for (const [crewId, crew] of assignmentByCrewId) {
          if (existingCrewIds.has(crewId)) continue;

          const effectiveSignOffDate = crew.isCurrent ? null : crew.signOffDate;

          const signOnOffInfo = buildSignOnOffInfo(
            crew.signOnDate,
            effectiveSignOffDate,
            firstDay,
            lastDay
          );

          const placeholderRecord: RecordWithAssignment = {
            id: 0,
            rhCrewRecordUuid: `placeholder-${crew.crewUuid}-${monthValue}`,
            vesselId: vesselId,
            crewMemberId: crewId,
            rank: crew.presentRank || 'Unknown',
            name: `${crew.firstName || ''} ${crew.familyName || ''}`.trim() || 'Unknown',
            month: monthValue,
            monthValue: monthValue,
            signOnOffInfo,
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
            _signOnDate: crew.signOnDate,
            _signOffDate: effectiveSignOffDate,
          };
          allRecords.push(placeholderRecord);
          existingCrewIds.add(crewId);
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
