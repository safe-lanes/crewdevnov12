export function filterViolationsByMode(violations: string[], complianceMode: 'Rest' | 'Work', opaMode: boolean): string[] {
  const visibleCodes: string[] = [];

  if (complianceMode === 'Rest') {
    visibleCodes.push('A', 'C', 'EF', 'G');
  } else {
    visibleCodes.push('B', 'D');
  }

  if (opaMode) {
    visibleCodes.push('I', 'H');
  }

  return violations.filter(v => visibleCodes.includes(v));
}

export function getViolationDates(
  dailyRecordsJson: string,
  complianceMode: 'Rest' | 'Work',
  opaMode: boolean,
  isPlanMode: boolean,
  applicableDayRange?: { from: number; to: number }
): number[] {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return [];
    }

    const violationDatesSet = new Set<number>();

    dailyRecords.forEach((day: any) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return;
      }

      if (applicableDayRange && day.day != null) {
        if (day.day < applicableDayRange.from || day.day > applicableDayRange.to) {
          return;
        }
      }

      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return;
      }

      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);

      if (relevantViolations.length === 0) return;

      const diagnostics: Array<{ code: string; majorityDay?: number }> = day.violationDiagnostics || [];

      for (const violationCode of relevantViolations) {
        const diagnostic = diagnostics.find((d: { code: string }) => d.code === violationCode);
        const assignedDay = diagnostic?.majorityDay ?? day.day;

        if (assignedDay && assignedDay >= 1) {
          if (applicableDayRange && (assignedDay < applicableDayRange.from || assignedDay > applicableDayRange.to)) {
            continue;
          }
          violationDatesSet.add(assignedDay);
        }
      }
    });

    return Array.from(violationDatesSet).sort((a, b) => a - b);
  } catch (error) {
    console.error('Failed to get violation dates:', error);
    return [];
  }
}

export function countViolationDays(
  dailyRecordsJson: string,
  complianceMode: 'Rest' | 'Work',
  opaMode: boolean,
  isPlanMode: boolean,
  applicableDayRange?: { from: number; to: number }
): number {
  const violationDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, isPlanMode, applicableDayRange);
  return violationDates.length;
}

export function hasCodeCViolation(
  dailyRecordsJson: string,
  complianceMode: 'Rest' | 'Work',
  opaMode: boolean,
  isPlanMode: boolean,
  applicableDayRange?: { from: number; to: number }
): boolean {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return false;
    }

    return dailyRecords.some((day: any) => {
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }

      if (applicableDayRange && day.day != null) {
        if (day.day < applicableDayRange.from || day.day > applicableDayRange.to) {
          return false;
        }
      }

      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }

      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      return relevantViolations.includes('C');
    });
  } catch (error) {
    console.error('Failed to check Code [C] violation:', error);
    return false;
  }
}

export function calculateNCs(
  dailyRecordsJson: string,
  complianceMode: 'Rest' | 'Work',
  opaMode: boolean,
  applicableDayRange?: { from: number; to: number }
): { totalNCs: number; predictedNCs: number } {
  try {
    const completedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, false, applicableDayRange);
    const hasCompletedCode2 = hasCodeCViolation(dailyRecordsJson, complianceMode, opaMode, false, applicableDayRange);

    const totalNCs = (completedViolationDays >= 3 || hasCompletedCode2) ? 1 : 0;

    let predictedNCs = 0;
    if (totalNCs === 0) {
      const predictedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, true, applicableDayRange);
      const hasPredictedCode2 = hasCodeCViolation(dailyRecordsJson, complianceMode, opaMode, true, applicableDayRange);
      predictedNCs = (predictedViolationDays >= 3 || hasPredictedCode2) ? 1 : 0;
    }

    return { totalNCs, predictedNCs };
  } catch (error) {
    console.error('Failed to calculate NCs:', error);
    return { totalNCs: 0, predictedNCs: 0 };
  }
}

export function calculateRecordingPercentage(
  dailyRecordsJson: string,
  monthYear: string,
  applicableDayRange?: { from: number; to: number }
): number {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }

    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const applicableFrom = applicableDayRange?.from ?? 1;
    const applicableTo = applicableDayRange?.to ?? daysInMonth;
    const applicableDays = applicableTo - applicableFrom + 1;

    const filledDays = dailyRecords.filter((day: any) => {
      const isPlan = day.isPlan === true;
      if (isPlan) return false;
      if (applicableDayRange && day.day != null) {
        if (day.day < applicableFrom || day.day > applicableTo) return false;
      }
      return Array.isArray(day.hours) && day.hours.some((h: string) => h !== '');
    }).length;

    const percentage = Math.round((filledDays / applicableDays) * 100);
    return Math.min(100, Math.max(0, percentage));
  } catch (error) {
    console.error('Failed to calculate recording percentage:', error);
    return 0;
  }
}
