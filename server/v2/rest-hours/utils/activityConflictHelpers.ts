import type { RhVariableTaskV2 } from "../../../../shared/v2/rest-hours/types";

interface VariableTaskCells {
  day: number;
  startCell: number;
  endCell: number;
}

const MONTH_MAP: Record<string, number> = {
  'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
  'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
};

function parseDateTime(
  dateTimeStr: string,
  task: RhVariableTaskV2
): { day: number; month: number; year: number; hour: number; minute: number } | null {
  const v1Match = dateTimeStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (v1Match) {
    return {
      day: parseInt(v1Match[1], 10),
      month: parseInt(v1Match[2], 10),
      year: parseInt(v1Match[3], 10),
      hour: parseInt(v1Match[4], 10),
      minute: parseInt(v1Match[5], 10),
    };
  }
  const v2Match = dateTimeStr.match(/^(\d{2})-(\w{3})-(\d{4})\s*\/\s*(\d{2}):(\d{2})$/);
  if (v2Match) {
    const monthNum = MONTH_MAP[v2Match[2]];
    if (!monthNum) return null;
    return {
      day: parseInt(v2Match[1], 10),
      month: monthNum,
      year: parseInt(v2Match[3], 10),
      hour: parseInt(v2Match[4], 10),
      minute: parseInt(v2Match[5], 10),
    };
  }
  const sortField = dateTimeStr === task.startDateTime
    ? task.startDateTimeSort
    : task.finishDateTimeSort;
  if (sortField) {
    const isoMatch = sortField.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (isoMatch) {
      return {
        day: parseInt(isoMatch[3], 10),
        month: parseInt(isoMatch[2], 10),
        year: parseInt(isoMatch[1], 10),
        hour: parseInt(isoMatch[4], 10),
        minute: parseInt(isoMatch[5], 10),
      };
    }
  }
  return null;
}

function timeToCell(hour: number, minute: number): number {
  return hour * 2 + (minute >= 30 ? 1 : 0);
}

export function parseVariableTaskToCells(task: RhVariableTaskV2, monthYear: string): VariableTaskCells[] {
  const results: VariableTaskCells[] = [];
  try {
    const start = parseDateTime(task.startDateTime, task);
    const finish = parseDateTime(task.finishDateTime, task);
    if (!start || !finish) return results;

    const [targetYear, targetMonth] = monthYear.split('-').map(Number);

    const startDate = new Date(start.year, start.month - 1, start.day);
    const finishDate = new Date(finish.year, finish.month - 1, finish.day);
    const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const targetMonthEnd = new Date(targetYear, targetMonth, 0);

    if (finishDate < targetMonthStart || startDate > targetMonthEnd) {
      return results;
    }

    if (start.day === finish.day && start.month === finish.month && start.year === finish.year) {
      if (start.month === targetMonth && start.year === targetYear) {
        const startCell = timeToCell(start.hour, start.minute);
        const endCell = timeToCell(finish.hour, finish.minute) - 1;
        if (startCell <= endCell) {
          results.push({ day: start.day, startCell, endCell });
        }
      }
      return results;
    }

    let currentDate = new Date(startDate);
    while (currentDate <= finishDate) {
      const currentDay = currentDate.getDate();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      if (currentMonth === targetMonth && currentYear === targetYear) {
        const isFirstDay = currentDate.getTime() === startDate.getTime();
        const isLastDay = currentDate.getTime() === finishDate.getTime();

        let startCell = 0;
        let endCell = 47;

        if (isFirstDay) {
          startCell = timeToCell(start.hour, start.minute);
        }
        if (isLastDay) {
          endCell = timeToCell(finish.hour, finish.minute) - 1;
        }

        if (startCell <= endCell && endCell >= 0) {
          results.push({ day: currentDay, startCell, endCell });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    console.error('Failed to parse variable task time range:', e);
  }
  return results;
}

export function isCrewMemberInTask(task: RhVariableTaskV2, crewMemberId: string): boolean {
  if (!task.crewInvolvedDetails) return false;
  try {
    const details = JSON.parse(task.crewInvolvedDetails);
    if (details.crew && Array.isArray(details.crew)) {
      return details.crew.some((c: { id: string }) => c.id === crewMemberId);
    }
  } catch {
    return false;
  }
  return false;
}

export function detectActivityConflict(
  crewMemberId: string,
  variableTasks: RhVariableTaskV2[],
  dailyRecordsJson: string,
  monthYear: string
): boolean {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) return false;

    const crewTasks = variableTasks.filter(t => isCrewMemberInTask(t, crewMemberId));
    if (crewTasks.length === 0) return false;

    const cellsByDay = new Map<number, { startCell: number; endCell: number }[]>();
    for (const task of crewTasks) {
      const cells = parseVariableTaskToCells(task, monthYear);
      for (const cell of cells) {
        const existing = cellsByDay.get(cell.day) || [];
        existing.push({ startCell: cell.startCell, endCell: cell.endCell });
        cellsByDay.set(cell.day, existing);
      }
    }

    if (cellsByDay.size === 0) return false;

    for (const dayRecord of dailyRecords) {
      if (dayRecord.isPlan === true) continue;

      // A retarded (duplicate) row is a date-line repeat of the calendar day.
      // The Variable Task belongs to the ORIGINAL (primary) day, so validate it
      // only against the primary row — never against the repeated day.
      if (dayRecord.occurrence === 'duplicate') continue;

      const dayNum = dayRecord.day;
      const taskCellRanges = cellsByDay.get(dayNum);
      if (!taskCellRanges) continue;

      const hours: string[] = dayRecord.hours;
      if (!Array.isArray(hours) || hours.length < 48) continue;

      for (const range of taskCellRanges) {
        for (let i = range.startCell; i <= range.endCell && i < 48; i++) {
          if (hours[i] !== 'a') {
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to detect activity conflict:', e);
  }
  return false;
}

export function detectActivityConflictsForVessel(
  variableTasks: RhVariableTaskV2[],
  dailyRecordsMap: Map<string, string>,
  crewMemberIds: string[],
  vesselId: string,
  monthYear: string
): Map<string, boolean> {
  const result = new Map<string, boolean>();

  for (const crewMemberId of crewMemberIds) {
    const key = `${crewMemberId}-${vesselId}-${monthYear}`;
    const dailyRecordsJson = dailyRecordsMap.get(key);

    if (!dailyRecordsJson) {
      result.set(crewMemberId, false);
      continue;
    }

    result.set(crewMemberId, detectActivityConflict(crewMemberId, variableTasks, dailyRecordsJson, monthYear));
  }

  return result;
}
