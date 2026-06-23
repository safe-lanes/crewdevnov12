import { DailyRecordsRepository, CrewRecordsRepository, VesselRecordsRepository, VariableTasksRepository } from "../repositories";
import type {
  RhDailyRecordV2,
  InsertRhDailyRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import {
  calculateRecordingPercentage,
  countViolationDays,
  calculateNCs,
} from "../utils/violationHelpers";
import { detectActivityConflict } from "../utils/activityConflictHelpers";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";

const dailyRecordsRepository = new DailyRecordsRepository();
const crewRecordsRepository = new CrewRecordsRepository();
const variableTasksRepository = new VariableTasksRepository();
const vesselRecordsRepository = new VesselRecordsRepository();

async function getOnboardCrewCount(vesselId: string, monthValue: string): Promise<number> {
  const db = getDb();
  const { firstDay, lastDay } = getMonthBounds(monthValue);
  const crewData = await db
    .select({
      crewUuid: crewAssignments.crewUuid,
      signOnDate: crewAssignments.signOnDate,
      signOffDate: crewAssignments.signOffDate,
      isCurrent: crewAssignments.isCurrent,
      empNo: crewMembersV2.empNo,
    })
    .from(crewAssignments)
    .innerJoin(crewMembersV2, eq(crewAssignments.crewUuid, crewMembersV2.crewUuid))
    .where(
      and(
        eq(crewAssignments.vesselUuid, vesselId),
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted)),
        // Only Signed On crew counted, consistent with the RH Records list.
        eq(crewAssignments.assignmentType, "OnBoard")
      )
    );

  const deduped = new Map<string, typeof crewData[0]>();
  for (const row of crewData) {
    if (!row.signOnDate || row.signOnDate > lastDay) continue;
    const effectiveSignOff = (row.signOffDate && row.signOffDate !== '') ? row.signOffDate : null;
    if (effectiveSignOff && effectiveSignOff < firstDay) continue;

    const crewId = row.empNo || row.crewUuid;
    const existing = deduped.get(crewId);
    if (!existing) {
      deduped.set(crewId, row);
    } else {
      const existingDate = existing.signOnDate || '';
      const newDate = row.signOnDate || '';
      if (newDate > existingDate) {
        deduped.set(crewId, row);
      } else if (newDate === existingDate && row.isCurrent && !existing.isCurrent) {
        deduped.set(crewId, row);
      }
    }
  }

  return deduped.size;
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

// The ISO day immediately before `date` (UTC-safe). Used to end an assignment's
// stats window the day before the next assignment's sign-on at a handover so the
// handover day belongs solely to the later rank period.
function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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
): { from: number; to: number } | undefined {
  if (!signOnDate && !signOffDate) return undefined;

  const [year, month] = monthValue.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  let from = 1;
  let to = daysInMonth;
  let changed = false;

  if (signOnDate && signOnDate >= firstDay && signOnDate <= lastDay) {
    from = parseInt(signOnDate.split('-')[2], 10);
    changed = true;
  }

  if (signOffDate && signOffDate >= firstDay && signOffDate <= lastDay) {
    to = parseInt(signOffDate.split('-')[2], 10);
    changed = true;
  }

  return changed ? { from, to } : undefined;
}

// Convert a record's rank-period window (date strings) into the {from,to} day
// range the violation helpers use. NULL window ⇒ undefined ⇒ whole month, so a
// non-promotion record behaves exactly as before.
function windowToDayRange(
  record: { applicableFrom?: string | null; applicableTo?: string | null },
  monthValue: string
): { from: number; to: number } | undefined {
  if (!record.applicableFrom && !record.applicableTo) return undefined;
  const [year, month] = monthValue.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let from = 1;
  let to = daysInMonth;
  if (record.applicableFrom) from = parseInt(record.applicableFrom.split('-')[2], 10);
  if (record.applicableTo) to = parseInt(record.applicableTo.split('-')[2], 10);
  return { from, to };
}

// Intersect two optional day ranges. undefined means "whole month", so the
// intersection of undefined with X is X. A non-overlapping result has from > to.
function intersectRanges(
  a: { from: number; to: number } | undefined,
  b: { from: number; to: number } | undefined
): { from: number; to: number } | undefined {
  if (!a) return b;
  if (!b) return a;
  return { from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) };
}

async function getCrewAssignmentsForMonth(
  crewMemberId: string,
  vesselId: string,
  monthValue: string
): Promise<{ signOnDate: string | null; signOffDate: string | null; isCurrent: boolean | null }[]> {
  try {
    const { firstDay, lastDay } = getMonthBounds(monthValue);
    const db = getDb();

    const rows = await db
      .select({
        crewUuid: crewAssignments.crewUuid,
        empNo: crewMembersV2.empNo,
        signOnDate: crewAssignments.signOnDate,
        signOffDate: crewAssignments.signOffDate,
        isCurrent: crewAssignments.isCurrent,
      })
      .from(crewAssignments)
      .innerJoin(crewMembersV2, eq(crewAssignments.crewUuid, crewMembersV2.crewUuid))
      .where(
        and(
          eq(crewAssignments.vesselUuid, vesselId),
          or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted)),
          and(
            lte(crewAssignments.signOnDate, lastDay),
            or(
              isNull(crewAssignments.signOffDate),
              eq(crewAssignments.signOffDate, ''),
              gte(crewAssignments.signOffDate, firstDay)
            )
          )
        )
      );

    const matches = rows.filter(r => {
      const id = r.empNo || r.crewUuid;
      return id === crewMemberId;
    });

    return matches.map(m => ({
      signOnDate: m.signOnDate || null,
      signOffDate: (m.signOffDate && m.signOffDate !== '') ? m.signOffDate : null,
      isCurrent: m.isCurrent ?? null,
    }));
  } catch (error) {
    console.error('Failed to get crew assignments for month:', error);
    return [];
  }
}

async function postSaveSync(crewMemberId: string, vesselId: string, monthYear: string) {
  try {
    // All rank-period records for the month. Non-promotion months have exactly
    // one record with a NULL window, so the loop below collapses to the original
    // single-record behaviour.
    const dailyRecords = await dailyRecordsRepository.findAllByKey(crewMemberId, vesselId, monthYear);
    if (dailyRecords.length === 0) {
      return;
    }

    const assignments = await getCrewAssignmentsForMonth(crewMemberId, vesselId, monthYear);
    const { firstDay, lastDay } = getMonthBounds(monthYear);

    let variableTasks: Awaited<ReturnType<typeof variableTasksRepository.findAll>> = [];
    try {
      variableTasks = await variableTasksRepository.findAll({ vesselId, periodValue: monthYear, isDraft: false });
    } catch (e) {
      console.error('Failed to fetch variable tasks during postSaveSync:', e);
    }

    const existingCrewRecords = await crewRecordsRepository.findAll({
      vesselId,
      crewMemberId,
      monthValue: monthYear,
    });

    let crewName = dailyRecords.find(r => r.name && r.name !== 'undefined undefined')?.name || '';
    if (!crewName || crewName === 'undefined undefined') {
      const db = getDb();
      const crewRows = await db
        .select({ firstName: crewMembersV2.firstName, familyName: crewMembersV2.familyName })
        .from(crewMembersV2)
        .where(eq(crewMembersV2.empNo, crewMemberId));
      if (crewRows.length > 0) {
        crewName = [crewRows[0].firstName, crewRows[0].familyName].filter(Boolean).join(' ');
      }
    }

    // A mid-month promotion splits the month into per-rank daily records (more
    // than one distinct rank). When that has happened, a previous assignment
    // that signs OFF on the exact day the next one signs ON is a genuine rank
    // handover (e.g. a prior-joining promotion redeployed on the same vessel)
    // and BOTH periods must survive so each rank gets its own crew row. Without
    // a rank split (e.g. a same-rank re-sign on the same day) the boundary-
    // touching pair collapses exactly as before — behaviour is byte-identical.
    const hasRankSplit = new Set(dailyRecords.map(r => r.rank).filter(Boolean)).size > 1;

    let resolvedAssignments = assignments;
    if (assignments.length > 1) {
      const sorted = [...assignments].sort(
        (a, b) => (a.signOnDate || '').localeCompare(b.signOnDate || '')
      );
      const kept: typeof assignments = [];
      for (const curr of sorted) {
        if (kept.length === 0) {
          kept.push(curr);
          continue;
        }
        const prev = kept[kept.length - 1];
        const prevOff = prev.signOffDate;
        // Separate period when the next sign-on is strictly after the previous
        // sign-off (a gap), or exactly on it when a rank split confirms the
        // handover (the sign-off date is the last day of the old rank period).
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
      resolvedAssignments = kept;
    }

    const effectiveAssignments = resolvedAssignments.length > 0
      ? resolvedAssignments
      : [{ signOnDate: null, signOffDate: null, isCurrent: null }];

    const matchedRecordUuids = new Set<string>();

    // Outer loop: each rank period (daily record). Inner loop: each assignment.
    // The summary day range is the intersection of the rank window and the
    // assignment window so that each rank period produces its own crew row.
    for (const dailyRecord of dailyRecords) {
      const dailyRecordsJson = dailyRecord.dailyRecords || '[]';
      const recordWindow = windowToDayRange(dailyRecord, monthYear);

      for (let ai = 0; ai < effectiveAssignments.length; ai++) {
        const assignment = effectiveAssignments[ai];
        const effectiveSignOff = assignment.isCurrent ? null : assignment.signOffDate;
        // For the stats/day-range ONLY, end this assignment's window the day
        // before the next assignment's sign-on when they meet at a handover
        // boundary, so the handover day belongs solely to the later rank period
        // (otherwise the boundary day would also fall inside this assignment and
        // produce a spurious one-day row for the other rank). The displayed
        // sign-on/off below still uses the real sign-off date.
        const nextSignOn = effectiveAssignments[ai + 1]?.signOnDate ?? null;
        let rangeSignOff = effectiveSignOff;
        if (nextSignOn && (rangeSignOff === null || nextSignOn <= rangeSignOff)) {
          rangeSignOff = previousDay(nextSignOn);
        }
        const assignmentRange = (assignment.signOnDate || rangeSignOff)
          ? getApplicableDayRange(assignment.signOnDate, rangeSignOff, firstDay, lastDay, monthYear)
          : undefined;

        const dayRange = intersectRanges(recordWindow, assignmentRange);
        // Skip rank-period / assignment combinations that do not overlap.
        if (dayRange && dayRange.from > dayRange.to) {
          continue;
        }

        const recordingPercent = calculateRecordingPercentage(dailyRecordsJson, monthYear, dayRange);
        const totalViolations = countViolationDays(dailyRecordsJson, 'Rest', false, false, dayRange);
        const predictedViolations = countViolationDays(dailyRecordsJson, 'Rest', false, true, dayRange);
        const { totalNCs, predictedNCs } = calculateNCs(dailyRecordsJson, 'Rest', false, dayRange);

        const signOnOffInfo = (assignment.signOnDate || effectiveSignOff)
          ? buildSignOnOffInfo(assignment.signOnDate, effectiveSignOff, firstDay, lastDay)
          : null;

        let activityConflicting = false;
        if (variableTasks.length > 0) {
          try {
            activityConflicting = detectActivityConflict(crewMemberId, variableTasks, dailyRecordsJson, monthYear);
          } catch (e) {
            console.error('Failed to detect activity conflict during postSaveSync:', e);
          }
        }

        // Match the crew summary row preferring same rank + sign-on/off, then
        // sign-on/off alone (legacy behaviour), then any unused row.
        let matchedRecord = existingCrewRecords.find(
          r => !matchedRecordUuids.has(r.rhCrewRecordUuid)
            && r.rank === dailyRecord.rank
            && r.signOnOffInfo === signOnOffInfo
        );
        if (!matchedRecord) {
          matchedRecord = existingCrewRecords.find(
            r => !matchedRecordUuids.has(r.rhCrewRecordUuid) && r.signOnOffInfo === signOnOffInfo
          );
        }
        if (!matchedRecord && existingCrewRecords.length > 0) {
          matchedRecord = existingCrewRecords.find(r => !matchedRecordUuids.has(r.rhCrewRecordUuid));
        }

        if (matchedRecord) {
          matchedRecordUuids.add(matchedRecord.rhCrewRecordUuid);
          await crewRecordsRepository.update(matchedRecord.rhCrewRecordUuid, {
            rank: dailyRecord.rank || matchedRecord.rank,
            recordingStatusPercent: recordingPercent,
            totalViolations,
            predictedViolations,
            totalNCs,
            predictedNCs,
            activityConflicting,
            signOnOffInfo,
          });
        } else {
          await crewRecordsRepository.create({
            crewMemberId,
            vesselId,
            rank: dailyRecord.rank || '',
            name: crewName,
            monthValue: monthYear,
            month: formatMonthDisplay(monthYear),
            signOnOffInfo: signOnOffInfo ?? null,
            recordingStatusPercent: recordingPercent,
            activityConflicting,
            totalViolations,
            totalNCs,
            predictedViolations,
            predictedNCs,
          });
        }
      }
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

    const uniqueCrewIds = new Set(crewRecords.map(r => r.crewMemberId));
    const uniqueCrewCount = uniqueCrewIds.size;

    const onboardCrewCount = await getOnboardCrewCount(vesselId, monthValue);
    const totalCrew = Math.max(onboardCrewCount, uniqueCrewCount);

    const totalPercent = crewRecords.reduce((sum, record) => sum + (record.recordingStatusPercent || 0), 0);
    const averagePercent = Math.round(totalPercent / crewRecords.length);
    const totalViolations = crewRecords.reduce((sum, r) => sum + (r.totalViolations || 0), 0);
    const totalNCs = crewRecords.reduce((sum, r) => sum + (r.totalNCs || 0), 0);
    const predictedViolations = crewRecords.reduce((sum, r) => sum + (r.predictedViolations || 0), 0);
    const predictedNCs = crewRecords.reduce((sum, r) => sum + (r.predictedNCs || 0), 0);

    const crewViolationMap = new Map<string, number>();
    const crewNCMap = new Map<string, number>();
    const crewPredViolMap = new Map<string, number>();
    const crewPredNCMap = new Map<string, { totalNCs: number; predictedNCs: number }>();
    const crewConflictMap = new Map<string, { name: string; rank: string }>();
    for (const r of crewRecords) {
      const cid = r.crewMemberId;
      crewViolationMap.set(cid, (crewViolationMap.get(cid) || 0) + (r.totalViolations || 0));
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
    const crewWithViolations = [...crewViolationMap.values()].filter(v => v > 0).length;
    const crewWithNCs = [...crewNCMap.values()].filter(v => v > 0).length;
    const crewWithPredictedViolations = [...crewPredViolMap.values()].filter(v => v > 0).length;
    const crewWithPredictedNCs = [...crewPredNCMap.values()].filter(
      v => v.totalNCs === 0 && v.predictedNCs > 0
    ).length;

    const activityConflicting = crewConflictMap.size > 0;
    const crewWithActivityConflictsCount = crewConflictMap.size;
    const crewWithActivityConflictsDetails = crewConflictMap.size > 0
      ? JSON.stringify([...crewConflictMap.values()])
      : null;

    const existingVesselRecords = await vesselRecordsRepository.findAll({
      vesselId,
      monthValue,
    });
    const existingVesselRecord = existingVesselRecords[0];

    if (existingVesselRecord) {
      await vesselRecordsRepository.update(existingVesselRecord.rhVesselUuid, {
        totalCrew,
        recordingStatusPercent: averagePercent,
        activityConflicting,
        crewWithActivityConflicts: crewWithActivityConflictsCount,
        crewWithActivityConflictsDetails: crewWithActivityConflictsDetails,
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
        activityConflicting,
        crewWithActivityConflicts: crewWithActivityConflictsCount,
        crewWithActivityConflictsDetails: crewWithActivityConflictsDetails,
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
    monthYear: string,
    rank?: string
  ): Promise<RhDailyRecordV2 | undefined> {
    if (!crewMemberId || !vesselId || !monthYear) {
      throw new Error("Crew member ID, vessel ID, and month year are required");
    }
    return dailyRecordsRepository.findByKey(crewMemberId, vesselId, monthYear, rank);
  },

  // Recompute the crew/vessel summary rows for a crew/vessel/month from the
  // current daily records (used by the promotion split to surface both rank
  // periods without going through a save).
  async resyncSummaries(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<void> {
    await postSaveSync(crewMemberId, vesselId, monthYear);
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

    // The identity/unique-key columns (crewMemberId, vesselId, monthYear, rank)
    // must never change on an update — they define the row's identity and the
    // unique index (crew_member_id, vessel_id, month_year, rank). After a
    // mid-month promotion a crew has two per-rank records; the recording form
    // sends the crew's CURRENT present_rank, so saving the old-rank row would
    // otherwise try to set rank to the new rank and collide with the new-rank
    // record. Strip these columns so an update only ever modifies the data.
    const { crewMemberId, vesselId, monthYear, rank, ...mutableData } = data;
    const dataWithAudit = applyAuditUser(mutableData, false);
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
