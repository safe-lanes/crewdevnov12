/**
 * Shared date utilities for consistent date handling across frontend and backend
 * Ensures UI and server calculations use the same "today" value
 */

/**
 * Get the current reporting date (today) as a Date object
 * This is the single source of truth for "today" in all calculations
 * @returns Date object representing today at midnight UTC
 */
export function getReportingDate(): Date {
  const now = new Date();
  // Return date at midnight UTC for consistency
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Format date to ISO string (YYYY-MM-DD) for database storage and display
 * @param date Date object or ISO string
 * @returns ISO date string (YYYY-MM-DD) or empty string if invalid
 */
export function formatDateToISO(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    return dateObj.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Safely parse a date string to Date object
 * Handles multiple formats: ISO 8601, dd/mm/yyyy
 * @param dateStr Date string to parse
 * @returns Date object or null if invalid
 */
export function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Try ISO format first (most common from database)
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try dd/mm/yyyy format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  return null;
}

/**
 * Calculate period in months between two dates
 * @param fromDate Start date
 * @param toDate End date (defaults to today if active contract)
 * @returns Number of months (decimal) or 0 if invalid
 */
export function calculatePeriodMonths(
  fromDate: string | Date | null | undefined,
  toDate?: string | Date | null | undefined
): number {
  const from = typeof fromDate === 'string' ? safeParseDate(fromDate) : fromDate;
  if (!from || isNaN(from.getTime())) return 0;
  
  // Use provided toDate or default to today for active contracts
  let to: Date;
  if (toDate) {
    to = typeof toDate === 'string' ? safeParseDate(toDate) || new Date() : toDate;
  } else {
    to = getReportingDate();
  }
  
  if (isNaN(to.getTime()) || to < from) return 0;
  
  const timeDiff = to.getTime() - from.getTime();
  const totalDays = timeDiff / (1000 * 60 * 60 * 24);
  return Math.max(0, totalDays / 30.44); // Convert days to months (30.44 = average days per month)
}

/**
 * Check if a sea service record is active (currently on board)
 * @param record Sea service record with 'to' date and optional isActive flag
 * @returns true if the record represents an active/ongoing contract
 */
export function isActiveSeaService(record: any): boolean {
  return !record.to || record.to === '' || record.isActive === true;
}

/**
 * Generate a stable hash for legacy sea service records
 * Used for backfilling planningId on existing records
 * @param crewId Crew member ID
 * @param vesselCode Vessel code/ID
 * @param fromDate Sign-on date
 * @returns Hash string for legacy record identification
 */
export function generateLegacyHash(
  crewId: string,
  vesselCode: string,
  fromDate: string
): string {
  return `legacy-${crewId}-${vesselCode}-${fromDate}`.replace(/\s+/g, '-');
}
