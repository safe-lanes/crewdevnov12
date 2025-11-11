/**
 * Shared types for Rest Hours module
 * Centralized to avoid duplication across components
 */

export interface ViolationDiagnostic {
  code: number;
  reason: string;
  dayIndex?: number;
  windowStart?: string | number;  // Can be "Multiple windows" or a formatted date string or timestamp
  windowEnd?: number;
  violatingRanges?: Array<{ startCell: number; endCell: number; startDay: number; monthName?: string }>;
}

/**
 * Persisted Daily Record - fields saved to storage
 * Represents a single day's rest hours data (or one occurrence for retarded days)
 */
export interface PersistedDailyRecord {
  entryId: string;          // Unique identifier (e.g., "day-9-primary", "day-9-duplicate")
  day: number;              // Calendar day (1-31)
  dayOfWeek: string;        // "Mon", "Tue", etc.
  occurrence: 'primary' | 'duplicate';  // For retarded days, each occurrence is independent
  hours: string[];          // 48 entries (2 per hour for 00:00-23:30): "w", "d", "a", "" (blank = rest)
  isPlan: boolean;          // True if planned hours (grey), false if recorded
  comments: string;         // Daily comments
  violations: number[];     // Violation code numbers
}

/**
 * Extended Daily Record - includes computed metrics and diagnostics
 * Used by RHRecordingForm and violation analysis components
 */
export interface ExtendedDailyRecord extends PersistedDailyRecord {
  violationDiagnostics?: ViolationDiagnostic[]; // Detailed violation explanations
  hoursOfRest24hr: number;  // Calendar day: 00:00-24:00
  hoursOfWork24hr: number;
  hoursOfRest48hr: number;  // Rolling 48hr window
  hoursOfWork48hr: number;
  hoursOfRest7day: number;  // Rolling 7-day window
  hoursOfWork7day: number;
  hoursOfRest96hr: number;  // Rolling 96hr window
  hoursOfWork96hr: number;
  anyPeriodRest24hr: number;  // Minimum rest hours in ANY 24-hour window
  anyPeriodRest7day: number;  // Minimum rest hours in ANY 7-day window
  anyPeriodWork24hr: number;  // Maximum work hours in ANY 24-hour window
  anyPeriodWork7day: number;  // Maximum work hours in ANY 7-day window
}

/**
 * Type alias for timeline calculations (minimal fields needed)
 */
export type TimelineDailyRecord = Pick<ExtendedDailyRecord, 
  'entryId' | 'day' | 'dayOfWeek' | 'occurrence' | 'hours' | 'isPlan' | 'comments' | 'violations'
>;

/**
 * Type alias for violation dialogs (subset of fields)
 */
export type ViolationDailyRecord = Pick<ExtendedDailyRecord,
  'entryId' | 'day' | 'dayOfWeek' | 'occurrence' | 'hours' | 'isPlan' | 'comments' | 'violations' | 
  'violationDiagnostics' | 'hoursOfRest24hr' | 'hoursOfWork24hr' | 
  'anyPeriodRest24hr' | 'anyPeriodWork24hr' | 'anyPeriodRest7day' | 'anyPeriodWork7day'
>;

/**
 * Normalizes legacy daily records by adding occurrence and entryId defaults
 * Call this when hydrating data from storage or API
 */
export function ensureDailyRecordDefaults(record: any): ExtendedDailyRecord {
  const occurrence = record.occurrence || 'primary';
  const entryId = record.entryId || `day-${record.day}-${occurrence}`;
  
  return {
    ...record,
    entryId,
    occurrence,
    violationDiagnostics: record.violationDiagnostics || [],
    hoursOfRest24hr: record.hoursOfRest24hr || 0,
    hoursOfWork24hr: record.hoursOfWork24hr || 0,
    hoursOfRest48hr: record.hoursOfRest48hr || 0,
    hoursOfWork48hr: record.hoursOfWork48hr || 0,
    hoursOfRest7day: record.hoursOfRest7day || 0,
    hoursOfWork7day: record.hoursOfWork7day || 0,
    hoursOfRest96hr: record.hoursOfRest96hr || 0,
    hoursOfWork96hr: record.hoursOfWork96hr || 0,
    anyPeriodRest24hr: record.anyPeriodRest24hr || 0,
    anyPeriodRest7day: record.anyPeriodRest7day || 0,
    anyPeriodWork24hr: record.anyPeriodWork24hr || 0,
    anyPeriodWork7day: record.anyPeriodWork7day || 0,
  };
}

/**
 * Creates a new blank daily record with defaults
 */
export function createBlankDailyRecord(
  day: number,
  dayOfWeek: string,
  occurrence: 'primary' | 'duplicate' = 'primary'
): ExtendedDailyRecord {
  return {
    entryId: `day-${day}-${occurrence}`,
    day,
    dayOfWeek,
    occurrence,
    hours: Array(48).fill(''),
    isPlan: false,
    comments: '',
    violations: [],
    violationDiagnostics: [],
    hoursOfRest24hr: 24,
    hoursOfWork24hr: 0,
    hoursOfRest48hr: 48,
    hoursOfWork48hr: 0,
    hoursOfRest7day: 168,
    hoursOfWork7day: 0,
    hoursOfRest96hr: 96,
    hoursOfWork96hr: 0,
    anyPeriodRest24hr: 24,
    anyPeriodRest7day: 168,
    anyPeriodWork24hr: 0,
    anyPeriodWork7day: 0,
  };
}
