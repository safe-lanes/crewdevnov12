import { CrewRecordsRepository, DailyRecordsRepository, VariableTasksRepository } from "../repositories";
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
import { detectActivityConflict } from "../utils/activityConflictHelpers";

const crewRecordsRepository = new CrewRecordsRepository();
const dailyRecordsRepository = new DailyRecordsRepository();
const variableTasksRepository = new VariableTasksRepository();

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

function formatMonthDisplay(monthValue: string): string {
  if (!monthValue) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = monthValue.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  return `${months[monthIdx]}-${year}`;
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

  const variableTasksMap = new Map<string, Awaited<ReturnType<typeof variableTasksRepository.findAll>>>();
  for (const vesselId of vesselIds) {
    const monthValues = Array.from(new Set(
      records
        .filter(r => r.vesselId === vesselId)
        .map(r => r.monthValue)
    ));
    for (const monthValue of monthValues) {
      const vtKey = `${vesselId}-${monthValue}`;
      if (!variableTasksMap.has(vtKey)) {
        const tasks = await variableTasksRepository.findAll({ vesselId, periodValue: monthValue, isDraft: false });
        variableTasksMap.set(vtKey, tasks);
      }
    }
  }

  return records.map(record => {
    const vesselName = vesselNameMap.get(record.vesselId) || '';
    const key = `${record.crewMemberId}-${record.vesselId}-${record.monthValue}`;
    const dailyRecordsJson = dailyRecordsMap.get(key);

    let violationDatesJson: string | null = null;
    let predictedViolationDatesJson: string | null = null;

    let liveRecordingPercent: number | undefined;
    let liveTotalViolations: number | undefined;
    let livePredictedViolations: number | undefined;
    let liveTotalNCs: number | undefined;
    let livePredictedNCs: number | undefined;

    if (dailyRecordsJson && record.monthValue) {
      const { firstDay, lastDay } = getMonthBounds(record.monthValue);
      const dayRange = (record._signOnDate || record._signOffDate)
        ? getApplicableDayRange(record._signOnDate, record._signOffDate, firstDay, lastDay, record.monthValue)
        : undefined;

      const vDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, false, dayRange);
      const pDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, true, dayRange);
      violationDatesJson = vDates.length > 0 ? JSON.stringify(vDates) : null;
      predictedViolationDatesJson = pDates.length > 0 ? JSON.stringify(pDates) : null;

      liveTotalViolations = vDates.length;
      livePredictedViolations = pDates.length;

      const liveNCs = calculateNCs(dailyRecordsJson, complianceMode, opaMode, dayRange);
      liveTotalNCs = liveNCs.totalNCs;
      livePredictedNCs = liveNCs.predictedNCs;

      liveRecordingPercent = calculateRecordingPercentage(dailyRecordsJson, record.monthValue, dayRange);
    }

    let liveActivityConflicting = false;
    if (dailyRecordsJson && record.monthValue) {
      const vtKey = `${record.vesselId}-${record.monthValue}`;
      const variableTasks = variableTasksMap.get(vtKey) || [];
      if (variableTasks.length > 0) {
        liveActivityConflicting = detectActivityConflict(
          record.crewMemberId,
          variableTasks,
          dailyRecordsJson,
          record.monthValue
        );
      }
    }

    const finalTotalNCs = liveTotalNCs ?? (record.totalNCs || 0);
    const finalPredictedNCs = livePredictedNCs ?? (record.predictedNCs || 0);
    const cappedPredictedNCs = (finalTotalNCs >= 1) ? 0 : finalPredictedNCs;

    const { _signOnDate, _signOffDate, ...cleanRecord } = record as any;

    return {
      ...cleanRecord,
      ...(liveRecordingPercent !== undefined ? { recordingStatusPercent: liveRecordingPercent } : {}),
      ...(liveTotalViolations !== undefined ? { totalViolations: liveTotalViolations } : {}),
      ...(livePredictedViolations !== undefined ? { predictedViolations: livePredictedViolations } : {}),
      ...(liveTotalNCs !== undefined ? { totalNCs: liveTotalNCs } : {}),
      activityConflicting: liveActivityConflicting,
      signOnDate: _signOnDate ?? null,
      signOffDate: _signOffDate ?? null,
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
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<EnrichedCrewRecord[]> {
    const { complianceMode, opaMode, ...repoFilters } = filters || {};
    const records = await crewRecordsRepository.findAll(repoFilters);
    return enrichRecordsWithComputedFields(records, complianceMode, opaMode);
  },

  async getAllBulk(params: {
    vesselIds: string[];
    monthValue?: string;
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<EnrichedCrewRecord[]> {
    const { vesselIds, monthValue, complianceMode, opaMode } = params;
    if (!vesselIds || vesselIds.length === 0) return [];

    let allRecords: RecordWithAssignment[] = [];
    for (const vesselId of vesselIds) {
      const records = await crewRecordsRepository.findAll({ vesselId, monthValue });
      allRecords.push(...records);
    }

    {
      const monthsToLookup = monthValue
        ? [monthValue]
        : Array.from(new Set(allRecords.map(r => r.monthValue).filter(Boolean)));

      const db = getDb();

      for (const vesselId of vesselIds) {
        for (const mv of monthsToLookup) {
          const { firstDay, lastDay } = getMonthBounds(mv);

          const crewData = await db
            .select({
              crewUuid: crewAssignments.crewUuid,
              vesselUuid: crewAssignments.vesselUuid,
              signOnDate: crewAssignments.signOnDate,
              signOffDate: crewAssignments.signOffDate,
              isCurrent: crewAssignments.isCurrent,
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
                // Only Signed On crew (see getByFilters): excludes Planned/Confirmed/In Transit.
                eq(crewAssignments.assignmentType, "OnBoard"),
                lte(crewAssignments.signOnDate, lastDay),
                or(
                  isNull(crewAssignments.signOffDate),
                  eq(crewAssignments.signOffDate, ''),
                  gte(crewAssignments.signOffDate, firstDay)
                )
              )
            );

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
                assignmentByCrewId.set(crewId, crew);
              }
            }
          }

          for (const record of allRecords) {
            if (record.vesselId !== vesselId || record.monthValue !== mv) continue;
            const assignment = assignmentByCrewId.get(record.crewMemberId);
            if (assignment) {
              const effectiveSignOffDate = assignment.isCurrent ? null : assignment.signOffDate;
              record._signOnDate = assignment.signOnDate;
              record._signOffDate = effectiveSignOffDate;
            }
          }
        }
      }
    }

    return enrichRecordsWithComputedFields(allRecords, complianceMode, opaMode);
  },

  async getByUuid(rhCrewRecordUuid: string): Promise<RhCrewRecordV2> {
    const record = await crewRecordsRepository.findByUuid(rhCrewRecordUuid);
    if (!record) {
      throw new Error(`Crew record not found: ${rhCrewRecordUuid}`);
    }
    return record;
  },

  async getBulkByMonths(params: {
    vesselIds?: string[];
    monthValues: string[];
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<EnrichedCrewRecord[]> {
    const { vesselIds, monthValues, complianceMode, opaMode } = params;
    if (!monthValues || monthValues.length === 0) return [];

    const records = await crewRecordsRepository.findAll({
      vesselIds: vesselIds && vesselIds.length > 0 ? vesselIds : undefined,
      monthValues,
    });

    return enrichRecordsWithComputedFields(records, complianceMode, opaMode);
  },

  async getByFilters(params: {
    vesselIds?: string[];
    monthValue?: string;
    ranks?: string[];
    search?: string;
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<EnrichedCrewRecord[]> {
    const { vesselIds, monthValue, ranks, search, complianceMode, opaMode } = params;

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

    const vesselIdsForEnrichment = (vesselIds && vesselIds.length > 0)
      ? vesselIds
      : Array.from(new Set(allRecords.map(r => r.vesselId).filter(Boolean)));

    if (vesselIdsForEnrichment.length > 0 && monthValue) {
      const { firstDay, lastDay } = getMonthBounds(monthValue);

      const db = getDb();
      for (const vesselId of vesselIdsForEnrichment) {

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
              // Only crew who are actually Signed On. assignment_type flips to
              // "OnBoard" at sign-on; Planned/Confirmed/In Transit stay "Planned".
              eq(crewAssignments.assignmentType, "OnBoard"),
              // Date-based overlap: signed on before/during month end
              // AND still on board or signed off during/after month start
              lte(crewAssignments.signOnDate, lastDay),
              or(
                isNull(crewAssignments.signOffDate),
                eq(crewAssignments.signOffDate, ''),
                gte(crewAssignments.signOffDate, firstDay)
              )
            )
          );

        type CrewAssignment = typeof crewData[0];

        const assignmentsByCrewId = new Map<string, CrewAssignment[]>();
        for (const crew of crewData) {
          const crewId = crew.empNo || crew.crewUuid;
          const list = assignmentsByCrewId.get(crewId) || [];
          list.push(crew);
          assignmentsByCrewId.set(crewId, list);
        }

        const resolvedAssignments: { key: string; crewId: string; assignment: CrewAssignment }[] = [];
        for (const [crewId, assignments] of assignmentsByCrewId) {
          if (assignments.length === 1) {
            resolvedAssignments.push({ key: crewId, crewId, assignment: assignments[0] });
            continue;
          }

          assignments.sort((a, b) => (a.signOnDate || '').localeCompare(b.signOnDate || ''));

          const kept: CrewAssignment[] = [];
          for (const curr of assignments) {
            if (kept.length === 0) {
              kept.push(curr);
              continue;
            }
            const prev = kept[kept.length - 1];
            const prevOff = (prev.signOffDate && prev.signOffDate !== '') ? prev.signOffDate : null;
            if (prevOff && curr.signOnDate && curr.signOnDate > prevOff) {
              kept.push(curr);
            } else {
              const prevDate = prev.signOnDate || '';
              const currDate = curr.signOnDate || '';
              if (currDate > prevDate) {
                kept[kept.length - 1] = curr;
              } else if (currDate === prevDate && curr.isCurrent && !prev.isCurrent) {
                kept[kept.length - 1] = curr;
              }
            }
          }

          if (kept.length === 1) {
            resolvedAssignments.push({ key: crewId, crewId, assignment: kept[0] });
          } else {
            for (const a of kept) {
              resolvedAssignments.push({
                key: `${crewId}|${a.signOnDate || ''}`,
                crewId,
                assignment: a,
              });
            }
          }
        }

        // How many resolved assignments does each crew have this month? A single
        // resolved assignment can still map to MULTIPLE crew records when the
        // crew was promoted mid-month (the per-rank split from Task #601): one
        // record per rank period. Multiple resolved assignments only happen on a
        // genuine sign-off/sign-on within the same month.
        const assignmentCountByCrewId = new Map<string, number>();
        for (const ra of resolvedAssignments) {
          assignmentCountByCrewId.set(ra.crewId, (assignmentCountByCrewId.get(ra.crewId) || 0) + 1);
        }

        const matchedRecordIds = new Set<number>();
        const matchedKeys = new Set<string>();
        for (const { key, crewId, assignment } of resolvedAssignments) {
          const effectiveSignOffDate = assignment.isCurrent ? null : assignment.signOffDate;
          const assignmentSignOnOff = buildSignOnOffInfo(
            assignment.signOnDate,
            effectiveSignOffDate,
            firstDay,
            lastDay
          );

          const candidateRecords = allRecords.filter(
            r => r.vesselId === vesselId && r.crewMemberId === crewId && !matchedRecordIds.has(r.id)
          );

          if (candidateRecords.length === 0) continue;

          const isSingleAssignment = (assignmentCountByCrewId.get(crewId) || 0) === 1;

          // Single resolved assignment: surface the best record for EACH distinct
          // rank. For the common (non-promotion) case there is exactly one rank,
          // so this collapses to a single record — byte-identical to before.
          // For a mid-month promotion there are multiple ranks, so we keep one
          // row per rank instead of dropping the old-rank row.
          if (isSingleAssignment) {
            const recordsByRank = new Map<string, RecordWithAssignment[]>();
            for (const r of candidateRecords) {
              const rk = r.rank || '';
              const list = recordsByRank.get(rk) || [];
              list.push(r);
              recordsByRank.set(rk, list);
            }

            for (const rankRecords of Array.from(recordsByRank.values())) {
              const bestRecord = rankRecords.length === 1
                ? rankRecords[0]
                : (rankRecords.find((r: RecordWithAssignment) => r.signOnOffInfo === assignmentSignOnOff) || rankRecords[0]);
              matchedRecordIds.add(bestRecord.id);
              bestRecord.signOnOffInfo = assignmentSignOnOff;
              bestRecord._signOnDate = assignment.signOnDate;
              bestRecord._signOffDate = effectiveSignOffDate;
            }
            matchedKeys.add(key);
            continue;
          }

          // Multiple resolved assignments (sign-off/sign-on same month): keep one
          // record per assignment, matched by sign-on/off info.
          let bestRecord: RecordWithAssignment | null = null;
          if (candidateRecords.length === 1) {
            bestRecord = candidateRecords[0];
          } else if (candidateRecords.length > 1) {
            bestRecord = candidateRecords.find(r => r.signOnOffInfo === assignmentSignOnOff) || null;
            if (!bestRecord) {
              bestRecord = candidateRecords[0];
            }
          }

          if (bestRecord) {
            matchedRecordIds.add(bestRecord.id);
            matchedKeys.add(key);
            bestRecord.signOnOffInfo = assignmentSignOnOff;
            bestRecord._signOnDate = assignment.signOnDate;
            bestRecord._signOffDate = effectiveSignOffDate;
          }
        }

        for (const { key, crewId, assignment } of resolvedAssignments) {
          if (matchedKeys.has(key)) continue;

          const effectiveSignOffDate = assignment.isCurrent ? null : assignment.signOffDate;

          const signOnOffInfo = buildSignOnOffInfo(
            assignment.signOnDate,
            effectiveSignOffDate,
            firstDay,
            lastDay
          );

          const placeholderRecord: RecordWithAssignment = {
            id: 0,
            rhCrewRecordUuid: `placeholder-${assignment.crewUuid}-${assignment.signOnDate || ''}-${monthValue}`,
            vesselId: vesselId,
            crewMemberId: crewId,
            rank: assignment.presentRank || 'Unknown',
            name: `${assignment.firstName || ''} ${assignment.familyName || ''}`.trim() || 'Unknown',
            month: formatMonthDisplay(monthValue),
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
            _signOnDate: assignment.signOnDate,
            _signOffDate: effectiveSignOffDate,
          };
          allRecords.push(placeholderRecord);
        }

        const resolvedCrewIds = new Set(resolvedAssignments.map(a => a.crewId));
        allRecords = allRecords.filter(r => {
          if (r.vesselId !== vesselId) return true;
          if (!resolvedCrewIds.has(r.crewMemberId)) return true;
          if (r.id === 0) return true;
          return matchedRecordIds.has(r.id);
        });
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

    return enrichRecordsWithComputedFields(allRecords, complianceMode, opaMode);
  },

  async getViolationsByRank(params: {
    vesselId?: string;
    vesselIds?: string[];
    monthValue?: string;
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<Array<{ rank: string; violationDays: number }>> {
    const { vesselId, vesselIds, monthValue, complianceMode, opaMode } = params;

    const effectiveVesselIds = vesselIds && vesselIds.length > 0
      ? vesselIds
      : (vesselId ? [vesselId] : undefined);

    let records: EnrichedCrewRecord[] = [];
    if (effectiveVesselIds && effectiveVesselIds.length > 0) {
      for (const vId of effectiveVesselIds) {
        const part = await this.getAll({ vesselId: vId, monthValue, complianceMode, opaMode });
        records.push(...part);
      }
    } else {
      records = await this.getAll({ monthValue, complianceMode, opaMode });
    }

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
    vesselIds?: string[];
    monthValue?: string;
    complianceMode?: 'Rest' | 'Work';
    opaMode?: boolean;
  }): Promise<Array<{ rank: string; ncCount: number }>> {
    const { vesselId, vesselIds, monthValue, complianceMode, opaMode } = params;

    const effectiveVesselIds = vesselIds && vesselIds.length > 0
      ? vesselIds
      : (vesselId ? [vesselId] : undefined);

    let records: EnrichedCrewRecord[] = [];
    if (effectiveVesselIds && effectiveVesselIds.length > 0) {
      for (const vId of effectiveVesselIds) {
        const part = await this.getAll({ vesselId: vId, monthValue, complianceMode, opaMode });
        records.push(...part);
      }
    } else {
      records = await this.getAll({ monthValue, complianceMode, opaMode });
    }

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
