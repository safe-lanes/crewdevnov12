/**
 * Timeline Normalization and Rolling Window Calculations
 * 
 * This module handles the conversion of daily rest hour records into a continuous
 * half-hour timeline, accounting for International Date Line crossing adjustments.
 * It provides true rolling window calculations for regulatory compliance.
 */

export interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[];
  isPlan: boolean;
  comments: string;
  violations: string[];
}

export interface DateLineAdjustment {
  day: number;
  type: 'advanced' | 'retarded';
}

export interface TimelineSlot {
  slotIndex: number;
  sourceDay: number;
  occurrence: 'primary' | 'duplicate';
  halfHourIndex: number;
  status: string;
  isAdvanced: boolean;
  isRetarded: boolean;
}

export interface RollingWindowMetrics {
  rest24h: number;
  work24h: number;
  rest72h: number;
  work72h: number;
  rest96h: number;
  work96h: number;
  rest168h: number;
  work168h: number;
}

/**
 * Builds a continuous timeline of half-hour slots from daily records
 * accounting for Advanced (skipped) and Retarded (repeated) days.
 * 
 * @param dailyRecords - Array of daily records for the month
 * @param adjustments - Array of date line adjustments
 * @returns Array of timeline slots in chronological order
 */
export function buildTimeline(
  dailyRecords: DailyRecord[],
  adjustments: DateLineAdjustment[] = []
): TimelineSlot[] {
  const timeline: TimelineSlot[] = [];
  const adjustmentMap = new Map<number, 'advanced' | 'retarded'>();
  
  adjustments.forEach(adj => {
    adjustmentMap.set(adj.day, adj.type);
  });
  
  let slotIndex = 0;
  
  for (const record of dailyRecords) {
    const adjustmentType = adjustmentMap.get(record.day);
    
    if (adjustmentType === 'advanced') {
      continue;
    }
    
    const addDayToTimeline = (occurrence: 'primary' | 'duplicate') => {
      for (let halfHourIdx = 0; halfHourIdx < 48; halfHourIdx++) {
        timeline.push({
          slotIndex: slotIndex++,
          sourceDay: record.day,
          occurrence,
          halfHourIndex: halfHourIdx,
          status: record.hours[halfHourIdx] || '',
          isAdvanced: false,
          isRetarded: adjustmentType === 'retarded',
        });
      }
    };
    
    addDayToTimeline('primary');
    
    if (adjustmentType === 'retarded') {
      addDayToTimeline('duplicate');
    }
  }
  
  return timeline;
}

/**
 * Calculates rest hours from a status value
 * 
 * REST SEMANTICS (critical for regulatory compliance):
 * - Empty string ('') = REST (default assumption)
 * - 'r' or 'R' = REST (explicit marking)
 * - Any other value (including 'w') = NOT rest
 * 
 * @param status - 'r' for rest, 'w' for work, empty for rest (default)
 * @returns 0.5 hours if rest, 0 otherwise
 */
function calculateRestHours(status: string): number {
  const lowerStatus = status.toLowerCase();
  return (status === '' || lowerStatus === 'r') ? 0.5 : 0;
}

/**
 * Calculates work hours from a status value
 * 
 * WORK SEMANTICS (matches existing system: Work = 24 - Rest):
 * - Empty string ('') = NOT work (0 hours)
 * - 'r' or 'R' = NOT work (0 hours)
 * - EVERYTHING ELSE = WORK (0.5 hours)
 * 
 * This includes:
 * - 'w' or 'W' = explicit work
 * - 'd' or 'D' = daywork  
 * - 'a' or 'A' = absence
 * - Any other marker = work
 * 
 * This ensures work hours = complement of rest hours, matching
 * the existing calculation: work = 24 - rest
 * 
 * @param status - 'r' for rest, empty for rest, anything else for work
 * @returns 0.5 hours if work, 0 if rest
 */
function calculateWorkHours(status: string): number {
  const lowerStatus = status.toLowerCase();
  return (status === '' || lowerStatus === 'r') ? 0 : 0.5;
}

/**
 * Builds prefix sum arrays for efficient rolling window calculations
 * 
 * @param timeline - Array of timeline slots
 * @returns Object with cumulative rest and work hour arrays
 */
export function buildPrefixSums(timeline: TimelineSlot[]): {
  cumulativeRest: number[];
  cumulativeWork: number[];
} {
  const cumulativeRest: number[] = [0];
  const cumulativeWork: number[] = [0];
  
  for (let i = 0; i < timeline.length; i++) {
    const slot = timeline[i];
    const restHours = calculateRestHours(slot.status);
    const workHours = calculateWorkHours(slot.status);
    
    cumulativeRest.push(cumulativeRest[i] + restHours);
    cumulativeWork.push(cumulativeWork[i] + workHours);
  }
  
  return { cumulativeRest, cumulativeWork };
}

/**
 * Calculates rolling window metrics for a specific slot position
 * using prefix sums for O(1) complexity per window.
 * 
 * @param slotIndex - The ending position of the rolling window
 * @param cumulativeRest - Prefix sum array for rest hours
 * @param cumulativeWork - Prefix sum array for work hours
 * @returns Object containing all rolling window metrics
 */
export function calculateRollingMetrics(
  slotIndex: number,
  cumulativeRest: number[],
  cumulativeWork: number[]
): RollingWindowMetrics {
  const windowSizes = {
    h24: 48,
    h72: 144,
    h96: 192,
    h168: 336,
  };
  
  const getRangeSum = (cumulative: number[], endIdx: number, windowSlots: number): number => {
    const startIdx = Math.max(0, endIdx - windowSlots + 1);
    return cumulative[endIdx + 1] - cumulative[startIdx];
  };
  
  return {
    rest24h: getRangeSum(cumulativeRest, slotIndex, windowSizes.h24),
    work24h: getRangeSum(cumulativeWork, slotIndex, windowSizes.h24),
    rest72h: getRangeSum(cumulativeRest, slotIndex, windowSizes.h72),
    work72h: getRangeSum(cumulativeWork, slotIndex, windowSizes.h72),
    rest96h: getRangeSum(cumulativeRest, slotIndex, windowSizes.h96),
    work96h: getRangeSum(cumulativeWork, slotIndex, windowSizes.h96),
    rest168h: getRangeSum(cumulativeRest, slotIndex, windowSizes.h168),
    work168h: getRangeSum(cumulativeWork, slotIndex, windowSizes.h168),
  };
}

/**
 * Prepends previous month's timeline to support cross-month rolling windows
 * 
 * @param currentTimeline - Timeline for current month
 * @param previousMonthRecords - Daily records from previous month
 * @param previousMonthAdjustments - Date line adjustments from previous month
 * @param lookbackSlots - Number of slots to include from previous month (default 336 for 168 hours)
 * @returns Extended timeline with previous month data prepended
 */
export function prependPreviousMonthTimeline(
  currentTimeline: TimelineSlot[],
  previousMonthRecords: DailyRecord[],
  previousMonthAdjustments: DateLineAdjustment[] = [],
  lookbackSlots: number = 336
): TimelineSlot[] {
  const prevTimeline = buildTimeline(previousMonthRecords, previousMonthAdjustments);
  
  const slotsToInclude = Math.min(lookbackSlots, prevTimeline.length);
  const relevantPrevSlots = prevTimeline.slice(-slotsToInclude);
  
  const adjustedPrevSlots = relevantPrevSlots.map((slot, idx) => ({
    ...slot,
    slotIndex: idx - slotsToInclude,
  }));
  
  const adjustedCurrentSlots = currentTimeline.map((slot, idx) => ({
    ...slot,
    slotIndex: idx,
  }));
  
  return [...adjustedPrevSlots, ...adjustedCurrentSlots];
}

/**
 * Violation codes for regulatory non-compliance
 */
export enum ViolationCode {
  VIOLATION_1 = '[1]',
  VIOLATION_2 = '[2]',
  VIOLATION_3 = '[3]',
  VIOLATION_4 = '[4]',
  VIOLATION_5 = '[5]',
  VIOLATION_6 = '[6]',
  VIOLATION_7 = '[7]',
  VIOLATION_8 = '[8]',
}

export interface Violation {
  code: ViolationCode;
  reason: string;
  slotIndex: number;
  sourceDay: number;
  occurrence: 'primary' | 'duplicate';
  metrics?: Partial<RollingWindowMetrics>;
}

/**
 * Regulatory thresholds for maritime rest hours compliance
 */
const REGULATORY_THRESHOLDS = {
  MIN_REST_10H_IN_24H: 10,
  MAX_WORK_14H_IN_24H: 14,
  MIN_REST_77H_IN_168H: 77,
  MAX_WORK_72H_IN_168H: 72,
  MIN_CONSECUTIVE_REST_6H: 6,
  MIN_REST_IN_72H: 36,
};

/**
 * Analyzes consecutive rest periods within a 24-hour window
 * Returns both the lengths and the slot ranges of all continuous rest periods found
 */
function analyzeRestPeriodsWithRanges(timeline: TimelineSlot[], endIdx: number): {
  lengths: number[];
  ranges: Array<{ startSlot: number; endSlot: number; length: number }>;
} {
  const startIdx = Math.max(0, endIdx - 47);
  const lengths: number[] = [];
  const ranges: Array<{ startSlot: number; endSlot: number; length: number }> = [];
  let currentPeriodLength = 0;
  let currentPeriodStart = -1;
  
  for (let i = startIdx; i <= endIdx; i++) {
    const isRest = timeline[i].status === '' || timeline[i].status.toLowerCase() === 'r';
    
    if (isRest) {
      if (currentPeriodLength === 0) {
        currentPeriodStart = i;
      }
      currentPeriodLength++;
    } else {
      if (currentPeriodLength > 0) {
        lengths.push(currentPeriodLength);
        ranges.push({
          startSlot: currentPeriodStart,
          endSlot: i - 1,
          length: currentPeriodLength
        });
        currentPeriodLength = 0;
        currentPeriodStart = -1;
      }
    }
  }
  
  if (currentPeriodLength > 0) {
    lengths.push(currentPeriodLength);
    ranges.push({
      startSlot: currentPeriodStart,
      endSlot: endIdx,
      length: currentPeriodLength
    });
  }
  
  return { lengths, ranges };
}

/**
 * Legacy function for backward compatibility
 */
function analyzeRestPeriods(timeline: TimelineSlot[], endIdx: number): number[] {
  return analyzeRestPeriodsWithRanges(timeline, endIdx).lengths;
}

/**
 * Export for UI layer highlighting purposes
 */
export { analyzeRestPeriodsWithRanges, checkCode4ViolationWithRange };

/**
 * Checks Code [3]: Hours of rest may be divided into periods,
 * where the TWO LARGEST periods must sum to ≥10h, and at least one must be ≥6h
 */
function checkCode3Violation(timeline: TimelineSlot[], slotIdx: number): boolean {
  const restPeriods = analyzeRestPeriods(timeline, slotIdx);
  
  if (restPeriods.length === 0) return true;
  
  // Take the two largest periods (any number of periods is allowed)
  const sorted = [...restPeriods].sort((a, b) => b - a);
  const largest = sorted[0] || 0;
  const secondLargest = sorted[1] || 0;
  
  const largestHours = largest * 0.5;
  const totalHours = (largest + secondLargest) * 0.5;
  
  return largestHours < 6 || totalHours < 10;
}

/**
 * Checks Code [4]: Work interval between rest periods must not exceed 14 hours
 * Returns violation status and the violating work gap range if found
 */
function checkCode4ViolationWithRange(timeline: TimelineSlot[], slotIdx: number): {
  hasViolation: boolean;
  violatingRange?: { startSlot: number; endSlot: number };
} {
  const startIdx = Math.max(0, slotIdx - 47);
  let currentWorkGap = 0;
  let currentWorkGapStart = -1;
  let inRestPeriod = false;
  
  for (let i = startIdx; i <= slotIdx; i++) {
    const isRest = timeline[i].status === '' || timeline[i].status.toLowerCase() === 'r';
    
    if (isRest) {
      if (!inRestPeriod) {
        if (currentWorkGap > 28) {
          return {
            hasViolation: true,
            violatingRange: {
              startSlot: currentWorkGapStart,
              endSlot: i - 1
            }
          };
        }
        currentWorkGap = 0;
        currentWorkGapStart = -1;
      }
      inRestPeriod = true;
    } else {
      if (inRestPeriod) {
        currentWorkGap = 1;
        currentWorkGapStart = i;
        inRestPeriod = false;
      } else {
        currentWorkGap++;
      }
    }
  }
  
  if (!inRestPeriod && currentWorkGap > 28) {
    return {
      hasViolation: true,
      violatingRange: {
        startSlot: currentWorkGapStart,
        endSlot: slotIdx
      }
    };
  }
  
  return { hasViolation: false };
}

/**
 * Legacy function for backward compatibility
 */
function checkCode4Violation(timeline: TimelineSlot[], slotIdx: number): boolean {
  return checkCode4ViolationWithRange(timeline, slotIdx).hasViolation;
}

/**
 * Detects all regulatory violations across the timeline using rolling windows
 * 
 * @param timeline - Continuous timeline of half-hour slots
 * @param cumulativeRest - Prefix sum array for rest hours
 * @param cumulativeWork - Prefix sum array for work hours
 * @param complianceMode - 'Rest' or 'Work' mode
 * @param enableOPA - Whether to apply OPA 90 rules (US-specific)
 * @returns Array of violations found at each timeline position
 */
export function detectViolations(
  timeline: TimelineSlot[],
  cumulativeRest: number[],
  cumulativeWork: number[],
  complianceMode: 'Rest' | 'Work',
  enableOPA: boolean = false
): Violation[] {
  const violations: Violation[] = [];
  
  for (let slotIdx = 0; slotIdx < timeline.length; slotIdx++) {
    const slot = timeline[slotIdx];
    
    if (slotIdx < 47) continue;
    
    const metrics = calculateRollingMetrics(slotIdx, cumulativeRest, cumulativeWork);
    
    if (complianceMode === 'Rest') {
      if (metrics.rest24h < REGULATORY_THRESHOLDS.MIN_REST_10H_IN_24H) {
        violations.push({
          code: ViolationCode.VIOLATION_1,
          reason: `Minimum 10 hours rest in 24-hour period: ${metrics.rest24h.toFixed(1)}h (< 10h required)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (slotIdx >= 335 && metrics.rest168h < REGULATORY_THRESHOLDS.MIN_REST_77H_IN_168H) {
        violations.push({
          code: ViolationCode.VIOLATION_2,
          reason: `Minimum 77 hours rest in 168-hour period: ${metrics.rest168h.toFixed(1)}h (< 77h required)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (checkCode3Violation(timeline, slotIdx)) {
        // Get actual rest period lengths for diagnostic message
        const restPeriods = analyzeRestPeriods(timeline, slotIdx);
        const sorted = [...restPeriods].sort((a, b) => b - a); // Clone to avoid mutation
        const largest = sorted[0] || 0;
        const secondLargest = sorted[1] || 0;
        const largestHours = (largest * 0.5).toFixed(1);
        const secondLargestHours = (secondLargest * 0.5).toFixed(1);
        const totalHours = ((largest + secondLargest) * 0.5).toFixed(1);
        const numPeriods = restPeriods.length;
        
        // Show all period lengths for transparency
        const allPeriodsHours = sorted.map(p => (p * 0.5).toFixed(1)).join('h, ') + 'h';
        
        let reason = ``;
        if (numPeriods === 0) {
          reason = `No rest periods found (only blank cells count as rest, not 'd' or 'a')`;
        } else if (numPeriods > 2) {
          reason = `${numPeriods} rest periods: ${allPeriodsHours}. Top 2: ${largestHours}h + ${secondLargestHours}h = ${totalHours}h (need ≥6h longest, ≥10h total)`;
        } else if (numPeriods === 1) {
          reason = `1 rest period: ${largestHours}h (need ≥6h and ≥10h total for single period)`;
        } else {
          reason = `2 rest periods: ${largestHours}h + ${secondLargestHours}h = ${totalHours}h (need ≥6h longest, ≥10h total)`;
        }
        
        violations.push({
          code: ViolationCode.VIOLATION_3,
          reason,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (checkCode4Violation(timeline, slotIdx)) {
        violations.push({
          code: ViolationCode.VIOLATION_4,
          reason: `Work interval between rest periods exceeds 14 hours`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
    }
    
    if (complianceMode === 'Work') {
      if (metrics.work24h > REGULATORY_THRESHOLDS.MAX_WORK_14H_IN_24H) {
        violations.push({
          code: ViolationCode.VIOLATION_5,
          reason: `Maximum 14 hours work in 24-hour period: ${metrics.work24h.toFixed(1)}h (> 14h limit)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (slotIdx >= 335 && metrics.work168h > REGULATORY_THRESHOLDS.MAX_WORK_72H_IN_168H) {
        violations.push({
          code: ViolationCode.VIOLATION_6,
          reason: `Maximum 72 hours work in 168-hour period: ${metrics.work168h.toFixed(1)}h (> 72h limit)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (enableOPA && metrics.work24h > 15) {
        violations.push({
          code: ViolationCode.VIOLATION_7,
          reason: `OPA 90: Maximum 15 hours work in 24-hour period: ${metrics.work24h.toFixed(1)}h (> 15h limit)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
      
      if (enableOPA && slotIdx >= 143 && metrics.work72h > 36) {
        violations.push({
          code: ViolationCode.VIOLATION_8,
          reason: `OPA 90: Maximum 36 hours work in 72-hour period: ${metrics.work72h.toFixed(1)}h (> 36h limit)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
        });
      }
    }
  }
  
  return violations;
}

/**
 * Groups violations by source day for display in the daily records table
 * 
 * @param violations - Array of all violations from timeline
 * @returns Map of day number to array of violation codes
 */
export function groupViolationsByDay(violations: Violation[]): Map<number, string[]> {
  const dayViolations = new Map<number, string[]>();
  
  for (const violation of violations) {
    const existing = dayViolations.get(violation.sourceDay) || [];
    if (!existing.includes(violation.code)) {
      existing.push(violation.code);
    }
    dayViolations.set(violation.sourceDay, existing);
  }
  
  return dayViolations;
}
