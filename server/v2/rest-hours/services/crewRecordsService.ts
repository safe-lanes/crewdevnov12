import { CrewRecordsRepository, DailyRecordsRepository, VariableTasksRepository } from "../repositories";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import { eq, and, or, isNull, inArray, lte, gte } from "drizzle-orm";
import type {
  RhCrewRecordV2,
  InsertRhCrewRecordV2,
  RhDailyRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import {
  getViolationDates,
  countViolationDays,
  calculateNCs,
  calculateRecordingPercentage,
} from "../utils/violationHelpers";
import { detectActivityConflict } from "../utils/activityConflictHelpers";
import { rankResolutionService } from "./rankResolutionService";

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

// Normalize a rank for matching crew-record rank against daily-record rank
// (strip trailing suffixes like "_1", trim, lowercase).
function normalizeRank(rank: string | null | undefined): string {
  if (!rank) return '';
  return rank.replace(/_\d+$/, '').trim().toLowerCase();
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

  // Group daily records per crew/vessel/month. A promotion month has more than
  // one record (one per rank window); a normal month has exactly one. We keep the
  // full record (rank + applicable window) so each crew row can be enriched from
  // ONLY its own rank's daily grid + applicable period.
  const dailyRecordsMap = new Map<string, RhDailyRecordV2[]>();
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
        const arr = dailyRecordsMap.get(key) || [];
        arr.push(dr);
        dailyRecordsMap.set(key, arr);
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
    const dailyList = dailyRecordsMap.get(key) || [];

    // Pick the daily grid that belongs to THIS crew row's rank. With a single
    // record (non-promotion month) the first/only entry is used, keeping behaviour
    // byte-identical. With multiple rank-period records (promotion month) we match
    // by rank, falling back to the full-month (NULL window) record if present.
    let matchedDaily: RhDailyRecordV2 | undefined;
    if (dailyList.length <= 1) {
      matchedDaily = dailyList[0];
    } else {
      matchedDaily =
        dailyList.find(d => normalizeRank(d.rank) === normalizeRank(record.rank)) ??
        dailyList.find(d => !d.applicableFrom && !d.applicableTo) ??
        dailyList[dailyList.length - 1];
    }
    const dailyRecordsJson = matchedDaily?.dailyRecords;

    let violationDatesJson: string | null = null;
    let predictedViolationDatesJson: string | null = null;

    let liveRecordingPercent: number | undefined;
    let liveTotalViolations: number | undefined;
    let livePredictedViolations: number | undefined;
    let liveTotalNCs: number | undefined;
    let livePredictedNCs: number | undefined;

    if (dailyRecordsJson && record.monthValue) {
      const { firstDay, lastDay } = getMonthBounds(record.monthValue);
      let dayRange = (record._signOnDate || record._signOffDate)
        ? getApplicableDayRange(record._signOnDate, record._signOffDate, firstDay, lastDay, record.monthValue)
        : undefined;

      // Constrain to this rank's applicable window (promotion month). A NULL
      // window means the whole month, so non-promotion records are unchanged.
      if (matchedDaily && (matchedDaily.applicableFrom || matchedDaily.applicableTo)) {
        const windowRange = getApplicableDayRange(
          matchedDaily.applicableFrom,
          matchedDaily.applicableTo,
          firstDay,
          lastDay,
          record.monthValue
        );
        dayRange = dayRange
          ? { from: Math.max(dayRange.from, windowRange.from), to: Math.min(dayRange.to, windowRange.to) }
          : windowRange;
      }

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

    // Per-rank sign-on/off for a promotion (split) month. Each rank-period row
    // must show the period it represents, not the raw employment sign-on that is
    // stamped on every row in getByFilters. A NULL window (non-promotion month)
    // leaves both dates untouched, so behaviour stays byte-identical.
    let displaySignOn: string | null = _signOnDate ?? null;
    let displaySignOff: string | null = _signOffDate ?? null;
    let rankSignOnOffInfo: string | null | undefined;
    // Only recompute when this row has an assignment-hydrated employment sign-on
    // (_signOnDate). Read paths that don't hydrate assignment dates keep their
    // existing sign-on/off untouched, so they stay byte-identical.
    if (
      matchedDaily &&
      (matchedDaily.applicableFrom || matchedDaily.applicableTo) &&
      record.monthValue &&
      _signOnDate
    ) {
      const { firstDay, lastDay } = getMonthBounds(record.monthValue);
      const empSignOn: string | null = _signOnDate ?? null;
      const windowFrom = matchedDaily.applicableFrom ?? null;

      // Inspect the sibling rank windows for this crew/month: does an EARLIER
      // window exist (this row is a promoted-INTO rank), and what is the start of
      // the immediately following window (the handover date)?
      const thisFrom = matchedDaily.applicableFrom ?? null;
      let hasEarlierWindow = false;
      let nextStart: string | null = null;
      for (const d of dailyList) {
        if (d === matchedDaily) continue;
        const f = d.applicableFrom ?? null;
        if (!f || !thisFrom) continue;
        if (f < thisFrom) hasEarlierWindow = true;
        if (f > thisFrom && (!nextStart || f < nextStart)) nextStart = f;
      }

      // Sign-on: the window start is a genuine sign-on event only for a
      // promoted-INTO window (one preceded by an earlier rank window this month) —
      // there the window start IS the promotion/handover date. For the EARLIEST
      // window the start is just the month boundary, not a real sign-on, so use the
      // crew's real employment sign-on instead. A prior-month join then correctly
      // stays out of the viewed month and renders a blank S.On (only the sign-off /
      // handover shows), while a genuine mid-month join is preserved.
      if (windowFrom && hasEarlierWindow) {
        displaySignOn = (empSignOn && empSignOn > windowFrom) ? empSignOn : windowFrom;
      } else {
        displaySignOn = empSignOn;
      }

      // Sign-off = the start of the immediately following rank period (the handover
      // / promotion date) — ON-BOARD case ONLY, i.e. the crew was already aboard
      // before the promotion (employment sign-on precedes the handover date). For a
      // prior-joining promotion the crew signs on at the new rank, so the employment
      // sign-on equals the handover date and no synthetic sign-off is added.
      if (nextStart && empSignOn && empSignOn < nextStart) {
        displaySignOff = nextStart;
      }

      rankSignOnOffInfo = buildSignOnOffInfo(displaySignOn, displaySignOff, firstDay, lastDay);
    }

    return {
      ...cleanRecord,
      ...(liveRecordingPercent !== undefined ? { recordingStatusPercent: liveRecordingPercent } : {}),
      ...(liveTotalViolations !== undefined ? { totalViolations: liveTotalViolations } : {}),
      ...(livePredictedViolations !== undefined ? { predictedViolations: livePredictedViolations } : {}),
      ...(liveTotalNCs !== undefined ? { totalNCs: liveTotalNCs } : {}),
      activityConflicting: liveActivityConflicting,
      ...(rankSignOnOffInfo !== undefined ? { signOnOffInfo: rankSignOnOffInfo } : {}),
      signOnDate: displaySignOn,
      signOffDate: displaySignOff,
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

        // Per-rank DAILY records are the source of truth for whether this month is
        // split across ranks (a mid-month promotion writes one daily record per
        // rank window). Derive the split signal and per-window rank from the daily
        // records — NOT from persisted crew summary rows, which may be missing the
        // old-rank row precisely in the scenario we need to detect (so they would
        // report a single rank and wrongly collapse the boundary-touching pair).
        const dailyForVessel = monthValue
          ? await dailyRecordsRepository.findAll({ vesselId, monthYear: monthValue })
          : [];
        const dailyRecordsByCrewId = new Map<string, RhDailyRecordV2[]>();
        for (const dr of dailyForVessel) {
          const list = dailyRecordsByCrewId.get(dr.crewMemberId) || [];
          list.push(dr);
          dailyRecordsByCrewId.set(dr.crewMemberId, list);
        }
        // More than one daily rank means a genuine rank handover, so a previous
        // assignment that signs off on the exact day the next one signs on must
        // survive as a separate period. Without a rank split the boundary-touching
        // pair collapses as before (byte-identical).
        const distinctRanksByCrewId = new Map<string, Set<string>>();
        for (const [cid, drs] of Array.from(dailyRecordsByCrewId.entries())) {
          const set = new Set<string>();
          for (const dr of drs) if (dr.rank) set.add(dr.rank);
          distinctRanksByCrewId.set(cid, set);
        }

        // Map an assignment period to the rank of the daily-record window with the
        // GREATEST overlap against the assignment's in-month range. Overlap (not
        // sign-on containment) is required because an assignment can start before
        // the month under review, in which case its sign-on lies outside every
        // window and containment would wrongly fall back to an arbitrary rank.
        // Windows and the assignment are clamped to the month; ties break toward
        // the earliest window (deterministic, independent of repository order).
        // Fallbacks: earliest daily rank, then null.
        const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400000);
        const rankForAssignment = (
          cid: string,
          signOnDate: string | null,
          signOffDate: string | null,
        ): string | null => {
          const drs = (dailyRecordsByCrewId.get(cid) || [])
            .slice()
            .sort((a, b) => (a.applicableFrom || '').localeCompare(b.applicableFrom || ''));
          if (drs.length === 0) return null;
          const aStart = signOnDate && signOnDate > firstDay ? signOnDate : firstDay;
          const aEnd = signOffDate && signOffDate !== '' && signOffDate < lastDay ? signOffDate : lastDay;
          let best: RhDailyRecordV2 | null = null;
          let bestOverlap = -1;
          for (const dr of drs) {
            const wFrom = dr.applicableFrom && dr.applicableFrom > firstDay ? dr.applicableFrom : firstDay;
            const wTo = dr.applicableTo && dr.applicableTo !== '' && dr.applicableTo < lastDay ? dr.applicableTo : lastDay;
            const lo = aStart > wFrom ? aStart : wFrom;
            const hi = aEnd < wTo ? aEnd : wTo;
            const overlap = hi >= lo ? dayNum(hi) - dayNum(lo) + 1 : -1;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              best = dr;
            }
          }
          return best?.rank || drs[0].rank || null;
        };

        const resolvedAssignments: { key: string; crewId: string; assignment: CrewAssignment }[] = [];
        for (const [crewId, assignments] of assignmentsByCrewId) {
          if (assignments.length === 1) {
            resolvedAssignments.push({ key: crewId, crewId, assignment: assignments[0] });
            continue;
          }

          assignments.sort((a, b) => (a.signOnDate || '').localeCompare(b.signOnDate || ''));

          const hasRankSplit = (distinctRanksByCrewId.get(crewId)?.size || 0) > 1;

          const kept: CrewAssignment[] = [];
          for (const curr of assignments) {
            if (kept.length === 0) {
              kept.push(curr);
              continue;
            }
            const prev = kept[kept.length - 1];
            const prevOff = (prev.signOffDate && prev.signOffDate !== '') ? prev.signOffDate : null;
            const isSeparatePeriod = !!prevOff && !!curr.signOnDate && (
              curr.signOnDate > prevOff ||
              (curr.signOnDate === prevOff && hasRankSplit)
            );
            if (isSeparatePeriod) {
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

          // Multiple resolved assignments (rank handover, or sign-off/sign-on the
          // same month): match each assignment to a persisted record of its OWN
          // rank — derived from the daily-record window that contains the
          // assignment's sign-on date. This prevents a surviving record of one
          // rank (e.g. the promoted Master row) from being mis-assigned to the
          // other rank's assignment, which would mislabel the synthetic old-rank
          // row. When the daily window gives no rank signal (no RH daily records,
          // e.g. a plain sign-off/sign-on with no recording yet) we keep the
          // legacy sign-on/off-based matching (byte-identical).
          const expectedRank = rankForAssignment(crewId, assignment.signOnDate, effectiveSignOffDate);
          const pool = expectedRank
            ? candidateRecords.filter(r => (r.rank || '') === expectedRank)
            : candidateRecords;

          let bestRecord: RecordWithAssignment | null = null;
          if (pool.length === 1) {
            bestRecord = pool[0];
          } else if (pool.length > 1) {
            bestRecord = pool.find(r => r.signOnOffInfo === assignmentSignOnOff) || pool[0];
          }

          if (bestRecord) {
            matchedRecordIds.add(bestRecord.id);
            matchedKeys.add(key);
            bestRecord.signOnOffInfo = assignmentSignOnOff;
            bestRecord._signOnDate = assignment.signOnDate;
            bestRecord._signOffDate = effectiveSignOffDate;
          }
        }

        // For unrecorded months there are no daily records, so rankForAssignment
        // yields null and the placeholder would otherwise fall back to the crew's
        // LIVE present_rank — which back-propagates a later promotion onto earlier
        // months (e.g. a June promotion relabelling March). Resolve the rank each
        // crew held at the END of the viewed month from the promotion ledger so a
        // month entirely before the promotion shows the prior rank, while a month
        // on/after the promotion shows the new rank. Batched once per vessel.
        const placeholderCrewIds = resolvedAssignments
          .filter(({ key }) => !matchedKeys.has(key))
          .map(({ crewId }) => crewId);
        const rankAsOfMonthEnd = placeholderCrewIds.length > 0
          ? await rankResolutionService.resolveRanksAsOfDate(placeholderCrewIds, lastDay)
          : {};

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
            rank: rankForAssignment(crewId, assignment.signOnDate, effectiveSignOffDate) || rankAsOfMonthEnd[crewId] || assignment.presentRank || 'Unknown',
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
