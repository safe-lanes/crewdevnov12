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
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
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
    const dailyRecord = await dailyRecordsRepository.findByKey(crewMemberId, vesselId, monthYear);
    if (!dailyRecord) {
      return;
    }

    const dailyRecordsJson = dailyRecord.dailyRecords || '[]';

    const assignments = await getCrewAssignmentsForMonth(crewMemberId, vesselId, monthYear);
    const { firstDay, lastDay } = getMonthBounds(monthYear);

    let variableTasks: Awaited<ReturnType<typeof variableTasksRepository.findAll>> = [];
    try {
      variableTasks = await variableTasksRepository.findAll({ vesselId, periodValue: monthYear });
    } catch (e) {
      console.error('Failed to fetch variable tasks during postSaveSync:', e);
    }

    const existingCrewRecords = await crewRecordsRepository.findAll({
      vesselId,
      crewMemberId,
      monthValue: monthYear,
    });

    let crewName = dailyRecord.name || '';
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
      resolvedAssignments = kept;
    }

    const effectiveAssignments = resolvedAssignments.length > 0
      ? resolvedAssignments
      : [{ signOnDate: null, signOffDate: null, isCurrent: null }];

    const matchedRecordUuids = new Set<string>();

    for (const assignment of effectiveAssignments) {
      const effectiveSignOff = assignment.isCurrent ? null : assignment.signOffDate;
      const dayRange = (assignment.signOnDate || effectiveSignOff)
        ? getApplicableDayRange(assignment.signOnDate, effectiveSignOff, firstDay, lastDay, monthYear)
        : undefined;

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

      let matchedRecord = existingCrewRecords.find(
        r => !matchedRecordUuids.has(r.rhCrewRecordUuid) && r.signOnOffInfo === signOnOffInfo
      );
      if (!matchedRecord && existingCrewRecords.length > 0) {
        matchedRecord = existingCrewRecords.find(r => !matchedRecordUuids.has(r.rhCrewRecordUuid));
      }

      if (matchedRecord) {
        matchedRecordUuids.add(matchedRecord.rhCrewRecordUuid);
        await crewRecordsRepository.update(matchedRecord.rhCrewRecordUuid, {
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

    const onboardCrewCount = await getOnboardCrewCount(vesselId, monthValue);
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

    const crewWithConflicts = crewRecords.filter(r => r.activityConflicting === true);
    const activityConflicting = crewWithConflicts.length > 0;
    const crewWithActivityConflictsCount = crewWithConflicts.length;
    const crewWithActivityConflictsDetails = crewWithConflicts.length > 0
      ? JSON.stringify(crewWithConflicts.map(r => ({ name: r.name, rank: r.rank })))
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
