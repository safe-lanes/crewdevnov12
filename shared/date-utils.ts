/**
 * Centralized Date Utilities
 * 
 * Standard Storage Format: ISO 8601 (YYYY-MM-DD)
 * - Universal, sortable, unambiguous
 * - Works with JavaScript Date(), SQL databases, and most APIs
 * 
 * This module provides:
 * - Flexible parsing: accepts multiple input formats
 * - Standard formatting: always outputs YYYY-MM-DD
 * - Type safety: enforces consistent date handling
 */

/**
 * Parse a date string in various formats and return a Date object
 * Accepts formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD
 * 
 * @param dateStr - Date string in any supported format
 * @returns Date object or null if parsing fails
 */
export function parseFlexibleDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  try {
    // Format 1: YYYY-MM-DD or YYYY/MM/DD (ISO format)
    if (trimmed.match(/^\d{4}[-/]\d{2}[-/]\d{2}$/)) {
      const normalized = trimmed.replace(/\//g, '-');
      const date = new Date(normalized);
      if (!isNaN(date.getTime())) return date;
    }

    // Format 2: DD-MM-YYYY or DD/MM/YYYY (European format)
    const europeanMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (europeanMatch) {
      const [, day, month, year] = europeanMatch;
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) return date;
    }

    // Format 3: MM-DD-YYYY or MM/DD/YYYY (US format)
    // Only try this if day > 12 (to avoid ambiguity)
    const usMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (usMatch) {
      const [, first, second, year] = usMatch;
      // If first number > 12, it must be DD-MM-YYYY
      if (parseInt(first) > 12) {
        const date = new Date(`${year}-${second}-${first}`);
        if (!isNaN(date.getTime())) return date;
      }
      // If second number > 12, it must be MM-DD-YYYY
      if (parseInt(second) > 12) {
        const date = new Date(`${year}-${first}-${second}`);
        if (!isNaN(date.getTime())) return date;
      }
      // Ambiguous case: assume European format (DD-MM-YYYY) as default
      const date = new Date(`${year}-${second}-${first}`);
      if (!isNaN(date.getTime())) return date;
    }

    // Format 4: Try native Date parsing as fallback
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;

    return null;
  } catch {
    return null;
  }
}

/**
 * Format a Date object to ISO 8601 string (YYYY-MM-DD)
 * This is the standard storage format for all dates
 * 
 * @param date - Date object or date string to format
 * @returns ISO formatted date string (YYYY-MM-DD) or null if invalid
 */
export function formatToISO(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? parseFlexibleDate(date) : date;
    if (!dateObj || isNaN(dateObj.getTime())) return null;

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Format a date for display (DD/MM/YYYY)
 * Used for user-facing date displays
 * 
 * @param date - Date object or date string
 * @returns Formatted date string (DD/MM/YYYY) or empty string if invalid
 */
export function formatForDisplay(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? parseFlexibleDate(date) : date;
    if (!dateObj || isNaN(dateObj.getTime())) return '';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Validate if a string is a valid date in any supported format
 * 
 * @param dateStr - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDate(dateStr: string | null | undefined): boolean {
  return parseFlexibleDate(dateStr) !== null;
}

/**
 * Convert any date format to ISO 8601 (YYYY-MM-DD)
 * This is the primary function for standardizing dates before storage
 * 
 * @param dateStr - Date string in any supported format
 * @returns ISO formatted date string or null if invalid
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  const date = parseFlexibleDate(dateStr);
  return formatToISO(date);
}
