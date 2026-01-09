/**
 * Timeline Normalization and Rolling Window Calculations
 * 
 * This module handles the conversion of daily rest hour records into a continuous
 * half-hour timeline, accounting for International Date Line crossing adjustments.
 * It provides true rolling window calculations for regulatory compliance.
 */

import type { TimelineDailyRecord } from './types';

// Re-export for backward compatibility
export type DailyRecord = TimelineDailyRecord;

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
 * Builds a continuous timeline of half-hour slots from daily records.
 * 
 * IMPORTANT: Records now contain their own occurrence field. Retarded days
 * have TWO separate records in the dailyRecords array (one primary, one duplicate).
 * This function simply converts each record into 48 timeline slots, respecting
 * the record's occurrence field.
 * 
 * @param dailyRecords - Array of daily records (retarded days have 2 entries)
 * @param adjustments - Array of date line adjustments (used for isAdvanced/isRetarded flags only)
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
    
    // Skip advanced days entirely
    if (adjustmentType === 'advanced') {
      continue;
    }
    
    // Add one set of 48 slots for this record, using its own occurrence field
    for (let halfHourIdx = 0; halfHourIdx < 48; halfHourIdx++) {
      timeline.push({
        slotIndex: slotIndex++,
        sourceDay: record.day,
        occurrence: record.occurrence,
        halfHourIndex: halfHourIdx,
        status: record.hours[halfHourIdx] || '',
        isAdvanced: false,
        isRetarded: adjustmentType === 'retarded' && record.occurrence === 'duplicate',
      });
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
 * Calculates the minimum rest hours in ANY 24-hour rolling window that ends
 * on the given day. This checks all 48 possible 24-hour windows (one ending
 * at each half-hour slot of the day) and returns the minimum.
 * 
 * For "any 24-hour period" compliance (MLC 2006), we need to find the worst-case
 * scenario across all possible 24-hour windows, not just the one ending at midnight.
 * 
 * IMPORTANT: arrayIndices must be actual array positions in the full timeline (0, 1, 2...),
 * NOT the logical slotIndex values which may be negative for previous month data.
 * 
 * @param arrayIndices - Array of positions in the full timeline array for this day's slots
 * @param cumulativeRest - Prefix sum array for rest hours (built from full timeline)
 * @returns Minimum rest hours found in any 24-hour window ending on this day
 */
export function calculateMinRestInAny24HourPeriod(
  arrayIndices: number[],
  cumulativeRest: number[]
): number {
  const WINDOW_SIZE_24H = 48; // 24 hours = 48 half-hour slots
  
  let minRest = 24; // Maximum possible rest in 24 hours
  
  for (const arrayIdx of arrayIndices) {
    // Only check windows that have full 24-hour history
    if (arrayIdx >= WINDOW_SIZE_24H - 1) {
      const startIdx = arrayIdx - WINDOW_SIZE_24H + 1;
      const restIn24h = cumulativeRest[arrayIdx + 1] - cumulativeRest[startIdx];
      minRest = Math.min(minRest, restIn24h);
    }
  }
  
  return minRest;
}

/**
 * Calculates the maximum work hours in ANY 24-hour rolling window that ends
 * on the given day. This checks all 48 possible 24-hour windows and returns
 * the maximum work hours found.
 * 
 * For work mode compliance, we track the worst-case (maximum) work hours.
 * 
 * IMPORTANT: arrayIndices must be actual array positions in the full timeline (0, 1, 2...),
 * NOT the logical slotIndex values which may be negative for previous month data.
 * 
 * @param arrayIndices - Array of positions in the full timeline array for this day's slots
 * @param cumulativeWork - Prefix sum array for work hours (built from full timeline)
 * @returns Maximum work hours found in any 24-hour window ending on this day
 */
export function calculateMaxWorkInAny24HourPeriod(
  arrayIndices: number[],
  cumulativeWork: number[]
): number {
  const WINDOW_SIZE_24H = 48;
  
  let maxWork = 0;
  
  for (const arrayIdx of arrayIndices) {
    if (arrayIdx >= WINDOW_SIZE_24H - 1) {
      const startIdx = arrayIdx - WINDOW_SIZE_24H + 1;
      const workIn24h = cumulativeWork[arrayIdx + 1] - cumulativeWork[startIdx];
      maxWork = Math.max(maxWork, workIn24h);
    }
  }
  
  return maxWork;
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
  /** 
   * The day at the start of the 24-hour (or 72-hour for [8]) violation window.
   * Used for majority-day assignment to handle retarded days correctly.
   * For a 24-hour window ending at slotIndex, this is timeline[slotIndex-47].sourceDay.
   */
  windowStartDay?: number;
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
    
    // Calculate window start day for 24-hour violations (used for majority-day assignment)
    const windowStartIdx24h = slotIdx - 47;
    const windowStartDay24h = windowStartIdx24h >= 0 ? timeline[windowStartIdx24h].sourceDay : undefined;
    
    if (complianceMode === 'Rest') {
      if (metrics.rest24h < REGULATORY_THRESHOLDS.MIN_REST_10H_IN_24H) {
        violations.push({
          code: ViolationCode.VIOLATION_1,
          reason: `Minimum 10 hours rest in 24-hour period: ${metrics.rest24h.toFixed(1)}h (< 10h required)`,
          slotIndex: slotIdx,
          sourceDay: slot.sourceDay,
          occurrence: slot.occurrence,
          metrics,
          windowStartDay: windowStartDay24h,
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
      
      // Check for Code [3] violation with optional work-anchored window filtering
      // When WORK_ANCHORED_24H_WINDOW.enabled is true, only check windows that START with work ('w') or duty ('d')
      let shouldCheckCode3 = true;
      if (WORK_ANCHORED_24H_WINDOW.enabled) {
        // The 24-hour window starts 47 slots before the current slot (48 slots total, 0-indexed)
        if (windowStartIdx24h >= 0) {
          const windowStartStatus = timeline[windowStartIdx24h].status.toLowerCase();
          // Only check if window starts with work 'w' or duty 'd' (not blank/rest)
          shouldCheckCode3 = windowStartStatus === 'w' || windowStartStatus === 'd';
        }
      }
      
      if (shouldCheckCode3 && checkCode3Violation(timeline, slotIdx)) {
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
          windowStartDay: windowStartDay24h,
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
          windowStartDay: windowStartDay24h,
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
          windowStartDay: windowStartDay24h,
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
          windowStartDay: windowStartDay24h,
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
 * Violation day assignment strategy configuration.
 * 
 * - 'legacy': Violations appear on every day where the violation window is detected (original behavior)
 * - 'hybrid': Uses code-specific strategies:
 *     - 24-hour violations (codes 1, 3, 4, 5, 7): Show on END day of violation window
 *     - 7-day violations (codes 2, 6): Show on FIRST day of violation window
 *     - Code [8] (72h OPA): Show on END day
 * 
 * To revert to original behavior, change mode to 'legacy'
 */
export const VIOLATION_ASSIGNMENT_STRATEGY: {
  mode: 'legacy' | 'hybrid';
} = {
  mode: 'hybrid',
};

/**
 * Majority-day assignment for 24-hour violations.
 * 
 * When enabled, 24-hour violations ([1], [3], [4], [5], [7]) are assigned to the day
 * that contains the MAJORITY of the 24-hour violation window, rather than always
 * using the END day.
 * 
 * This addresses the issue where a violation window might have 23 hours on Day 8
 * but only 1 hour on Day 9, yet would incorrectly show on Day 9 with END-day logic.
 * 
 * Behavior:
 * - Calculates which day has more slots in the 24-hour window
 * - On 50-50 tie (12 hours each), uses the EARLIER day
 * - If majority falls in previous month (day < 1), violation is NOT shown in current month
 * 
 * TO REVERT: Set enabled to false (single-line change)
 * 
 * SCOPE: Only affects 24-hour violation codes ([1], [3], [4], [5], [7]).
 * Does NOT affect Code [8] (72h window) or 7-day violations ([2], [6]).
 */
export const MAJORITY_DAY_ASSIGNMENT: {
  enabled: boolean;
} = {
  enabled: true, // Set to false to revert to END-day assignment
};

/**
 * EXPERIMENTAL: Work-anchored 24-hour window for Violation [3] only.
 * 
 * ⚠️ WARNING: This setting is NON-COMPLIANT with MLC 2006 Std. A2.3.13 ⚠️
 * 
 * MLC 2006 requires checking "any 24-hour period" as a continuous sliding window,
 * meaning ALL possible 24-hour intervals must be evaluated, not just those starting
 * when work begins. Port State Control inspections use the same approach.
 * 
 * This experimental flag is for TESTING PURPOSES ONLY:
 * - When enabled: Violation [3] only checks 24-hour windows that START with 'w' (work) or 'd' (duty)
 * - When disabled (default): Standard compliant behavior - all 24-hour windows are checked
 * 
 * TO REVERT: Set enabled to false (single-line change)
 * 
 * SCOPE: This flag ONLY affects Violation [3] detection.
 * It does NOT affect:
 * - The "RH in 24 Hr" column display values
 * - Other violation calculations (1, 2, 4, 5, 6, 7, 8)
 * - Any other metrics or rolling window calculations
 */
export const WORK_ANCHORED_24H_WINDOW: {
  enabled: boolean;
} = {
  enabled: true, // Set to false to revert to MLC-compliant behavior
};

/**
 * 24-hour violation codes that use majority-day or END-day assignment.
 * These violations span a 24-hour (48 half-hour slots) window.
 * When MAJORITY_DAY_ASSIGNMENT.enabled is true, uses majority-day logic.
 * Otherwise, uses END-day assignment.
 */
const TWENTY_FOUR_HOUR_VIOLATION_CODES = [
  '[1]', // MIN_REST_10H_IN_24H
  '[3]', // REST_PERIOD_STRUCTURE
  '[4]', // MAX_WORK_INTERVAL
  '[5]', // MAX_WORK_14H_IN_24H
  '[7]', // OPA 90: MAX_WORK_15H_IN_24H
];

/**
 * 72-hour violation code that always uses END-day assignment.
 * Code [8] spans 72 hours (144 slots) across potentially 3+ days,
 * so majority-day logic is not applied.
 */
const SEVENTY_TWO_HOUR_VIOLATION_CODES = [
  '[8]', // OPA 90: MAX_WORK_36H_IN_72H
];

/**
 * 7-day violation codes that should use START-day (first occurrence) assignment.
 * These violations are assigned to the first day where the violation is detected.
 * If the first day is in the previous month (negative sourceDay), clamp to day 1.
 */
const START_DAY_VIOLATION_CODES = [
  '[2]', // MIN_REST_77H_IN_168H
  '[6]', // MAX_WORK_72H_IN_168H
];

/**
 * Calculates the majority day for a 24-hour violation window using actual slot metadata.
 * 
 * This function uses the windowStartDay and sourceDay (endDay) from the violation
 * to determine which day contains the majority of the 48 half-hour slots.
 * 
 * Unlike simple modulo arithmetic, this approach correctly handles:
 * - Retarded days (duplicate occurrences with same day number)
 * - Cross-month boundaries
 * - Timeline with previous month data prepended
 * 
 * @param windowStartDay - The day at the start of the 24-hour window (from violation.windowStartDay)
 * @param endDay - The day at the end of the 24-hour window (from violation.sourceDay)
 * @param slotIndex - The ending slot index of the violation window
 * @returns The day number that has the majority of slots, or null if majority is in previous month
 */
function calculateMajorityDayFor24HourWindow(
  windowStartDay: number | undefined,
  endDay: number,
  slotIndex: number
): number | null {
  // If windowStartDay is not available, fall back to end day (legacy behavior)
  if (windowStartDay === undefined) {
    return endDay;
  }
  
  // If both days are the same, the entire window is on that day
  if (windowStartDay === endDay) {
    if (endDay < 1) {
      return null; // Entire window in previous month
    }
    return endDay;
  }
  
  // Window spans two days: windowStartDay to endDay
  // Calculate slots on each day using the position within the end day
  // Position 0-47 in the day: slot 0 = first half-hour, slot 47 = last half-hour
  // For a window ending at position P in endDay:
  // - Slots on endDay = P + 1 (positions 0 through P)
  // - Slots on startDay = 48 - (P + 1) = 47 - P
  
  const positionInEndDay = ((slotIndex % 48) + 48) % 48; // Handle negative indices
  const slotsOnEndDay = positionInEndDay + 1;
  const slotsOnStartDay = 48 - slotsOnEndDay;
  
  // Determine majority day
  // On a 50-50 tie (24 slots each, when positionInEndDay == 23), use the EARLIER day
  if (slotsOnEndDay > slotsOnStartDay) {
    // End day has majority
    if (endDay < 1) {
      return null; // Majority in previous month
    }
    return endDay;
  } else {
    // Start day has majority (or tied - prefer earlier day per user requirement)
    if (windowStartDay < 1) {
      return null; // Majority in previous month
    }
    return windowStartDay;
  }
}

/**
 * Represents a continuous violation event (consecutive slots with same violation code)
 */
interface ViolationEvent {
  code: string;
  startSlotIndex: number;
  endSlotIndex: number;
  startDay: number;
  endDay: number;
  /** The windowStartDay from the first violation in the event (for majority-day calculation) */
  windowStartDay?: number;
}

/**
 * Groups consecutive violation slots into discrete events.
 * A new event starts when there's a gap in slot indices or different violation code.
 * 
 * @param violations - Array of violations sorted by slotIndex
 * @param code - The violation code to group
 * @returns Array of violation events with startDay, endDay, and windowStartDay
 */
function groupConsecutiveViolations(violations: Violation[], code: string): ViolationEvent[] {
  const codeViolations = violations
    .filter(v => v.code === code)
    .sort((a, b) => a.slotIndex - b.slotIndex);
  
  if (codeViolations.length === 0) return [];
  
  const events: ViolationEvent[] = [];
  let currentEvent: ViolationEvent = {
    code,
    startSlotIndex: codeViolations[0].slotIndex,
    endSlotIndex: codeViolations[0].slotIndex,
    startDay: codeViolations[0].sourceDay,
    endDay: codeViolations[0].sourceDay,
    windowStartDay: codeViolations[0].windowStartDay,
  };
  
  for (let i = 1; i < codeViolations.length; i++) {
    const v = codeViolations[i];
    if (v.slotIndex === currentEvent.endSlotIndex + 1) {
      currentEvent.endSlotIndex = v.slotIndex;
      currentEvent.endDay = v.sourceDay;
    } else {
      events.push(currentEvent);
      currentEvent = {
        code,
        startSlotIndex: v.slotIndex,
        endSlotIndex: v.slotIndex,
        startDay: v.sourceDay,
        endDay: v.sourceDay,
        windowStartDay: v.windowStartDay,
      };
    }
  }
  events.push(currentEvent);
  
  return events;
}

/**
 * Groups violations by source day for display in the daily records table.
 * 
 * When VIOLATION_ASSIGNMENT_STRATEGY.mode is 'hybrid':
 * - 24-hour violations (codes 1, 3, 4, 5, 7):
 *     - If MAJORITY_DAY_ASSIGNMENT.enabled: Show on day with majority of the 24-hour window
 *     - Otherwise: Show on END day of violation window
 *     - If majority is in previous month, violation is NOT shown in current month
 * - 72-hour violations (code 8): Show on END day of violation window
 * - 7-day violations (codes 2, 6): Show on FIRST day of violation window (clamped to >=1 for visibility)
 * - This prevents the same violation from appearing on multiple days
 * 
 * When mode is 'legacy':
 * - Violations appear on every day where detected (original behavior)
 * 
 * @param violations - Array of all violations from timeline
 * @returns Map of day number to array of violation codes
 */
export function groupViolationsByDay(violations: Violation[]): Map<number, string[]> {
  const dayViolations = new Map<number, string[]>();
  
  if (VIOLATION_ASSIGNMENT_STRATEGY.mode === 'hybrid') {
    const processedCodes = new Set<string>();
    
    for (const violation of violations) {
      if (processedCodes.has(violation.code)) continue;
      
      const is24HourViolation = TWENTY_FOUR_HOUR_VIOLATION_CODES.includes(violation.code);
      const is72HourViolation = SEVENTY_TWO_HOUR_VIOLATION_CODES.includes(violation.code);
      const isStartDayViolation = START_DAY_VIOLATION_CODES.includes(violation.code);
      
      if (is24HourViolation || is72HourViolation || isStartDayViolation) {
        processedCodes.add(violation.code);
        const events = groupConsecutiveViolations(violations, violation.code);
        
        for (const event of events) {
          let assignedDay: number | null;
          
          if (isStartDayViolation) {
            // 7-day violations: use START day, clamped to day 1
            assignedDay = Math.max(1, event.startDay);
          } else if (is24HourViolation && MAJORITY_DAY_ASSIGNMENT.enabled) {
            // 24-hour violations with majority-day logic enabled
            // Use the first violation's windowStartDay and slot to determine majority day
            assignedDay = calculateMajorityDayFor24HourWindow(
              event.windowStartDay,
              event.startDay,
              event.startSlotIndex
            );
            // If majority is in previous month, assignedDay will be null - skip this violation
          } else {
            // 72-hour violations or 24-hour with majority-day disabled: use END day
            assignedDay = event.endDay;
          }
          
          // Skip if no valid day (majority in previous month)
          if (assignedDay === null || assignedDay < 1) continue;
          
          const existing = dayViolations.get(assignedDay) || [];
          if (!existing.includes(event.code)) {
            existing.push(event.code);
          }
          dayViolations.set(assignedDay, existing);
        }
      } else {
        const existing = dayViolations.get(violation.sourceDay) || [];
        if (!existing.includes(violation.code)) {
          existing.push(violation.code);
        }
        dayViolations.set(violation.sourceDay, existing);
      }
    }
  } else {
    for (const violation of violations) {
      const existing = dayViolations.get(violation.sourceDay) || [];
      if (!existing.includes(violation.code)) {
        existing.push(violation.code);
      }
      dayViolations.set(violation.sourceDay, existing);
    }
  }
  
  return dayViolations;
}
