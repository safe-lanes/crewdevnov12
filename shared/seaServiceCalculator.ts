/**
 * Sea Service Period Calculation Utility
 * Calculates and formats sea service periods as Years/Months/Days
 */

/**
 * Parse date string in multiple formats to Date object
 * Supports: dd/mm/yyyy, ISO 8601 (2025-05-01T00:00:00.000Z)
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
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
      return new Date(year, month, day);
    }
  }
  
  return null;
}

/**
 * Calculate sea service period from joining date to current date
 * Returns formatted string like "5 Years 3 Months 15 Days"
 */
export function calculateSeaServicePeriod(joiningDate: string | null | undefined): string {
  if (!joiningDate) return 'N/A';
  
  const startDate = parseDate(joiningDate);
  if (!startDate) return 'N/A';
  
  const endDate = new Date();
  
  // Calculate differences
  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();
  
  // Adjust for negative days
  if (days < 0) {
    months--;
    // Get days in previous month
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }
  
  // Handle future dates
  if (years < 0) return 'N/A';
  
  // Format output
  const parts: string[] = [];
  
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  }
  
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
  }
  
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
  }
  
  return parts.join(' ');
}

/**
 * Calculate sea service period in months (decimal)
 * Useful for calculations and comparisons
 */
export function calculateSeaServiceMonths(joiningDate: string | null | undefined): number {
  if (!joiningDate) return 0;
  
  const startDate = parseDate(joiningDate);
  if (!startDate) return 0;
  
  const endDate = new Date();
  
  // Calculate total months
  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  const days = endDate.getDate() - startDate.getDate();
  
  // Convert to months
  let totalMonths = years * 12 + months;
  
  // Add fractional month for days
  totalMonths += days / 30;
  
  return Math.max(0, totalMonths);
}
