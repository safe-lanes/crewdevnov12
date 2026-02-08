export function filterViolationsByMode(violations: number[], complianceMode: 'Rest' | 'Work', opaMode: boolean): number[] {
  const visibleCodes: number[] = [];

  if (complianceMode === 'Rest') {
    visibleCodes.push(1, 2, 3, 4);
  } else {
    visibleCodes.push(5, 6);
  }

  if (opaMode) {
    visibleCodes.push(7, 8);
  }

  return violations.filter(v => visibleCodes.includes(v));
}

export function getViolationDates(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): number[] {
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

      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return;
      }

      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);

      if (relevantViolations.length === 0) return;

      const diagnostics: Array<{ code: number; majorityDay?: number }> = day.violationDiagnostics || [];

      for (const violationCode of relevantViolations) {
        const diagnostic = diagnostics.find((d: { code: number }) => d.code === violationCode);
        const assignedDay = diagnostic?.majorityDay ?? day.day;

        if (assignedDay && assignedDay >= 1) {
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

export function countViolationDays(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): number {
  const violationDates = getViolationDates(dailyRecordsJson, complianceMode, opaMode, isPlanMode);
  return violationDates.length;
}

export function hasCode2Violation(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): boolean {
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

      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }

      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      return relevantViolations.includes(2);
    });
  } catch (error) {
    console.error('Failed to check Code [2] violation:', error);
    return false;
  }
}

export function calculateNCs(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean): { totalNCs: number; predictedNCs: number } {
  try {
    const completedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, false);
    const hasCompletedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, false);

    const totalNCs = (completedViolationDays >= 3 || hasCompletedCode2) ? 1 : 0;

    const predictedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, true);
    const hasPredictedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, true);

    const predictedNCs = (predictedViolationDays >= 3 || hasPredictedCode2) ? 1 : 0;

    return { totalNCs, predictedNCs };
  } catch (error) {
    console.error('Failed to calculate NCs:', error);
    return { totalNCs: 0, predictedNCs: 0 };
  }
}

export function calculateRecordingPercentage(dailyRecordsJson: string, monthYear: string): number {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }

    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const filledDays = dailyRecords.filter((day: any) => {
      const isPlan = day.isPlan === true;
      const hasHours = Array.isArray(day.hours) && day.hours.some((h: string) => h !== '');
      return !isPlan && hasHours;
    }).length;

    const percentage = Math.round((filledDays / daysInMonth) * 100);
    return Math.min(100, Math.max(0, percentage));
  } catch (error) {
    console.error('Failed to calculate recording percentage:', error);
    return 0;
  }
}
