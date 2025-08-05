/**
 * Utility functions for formatting data
 */

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Calculate time difference in human readable format
 */
export function formatTimeAgo(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''}`;
}

/**
 * Format a full name from parts
 */
export function formatFullName(firstName: string, middleName?: string, lastName?: string): string {
  return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

/**
 * Format a rating value for display
 */
export function formatRating(rating: string | number): string {
  const numValue = typeof rating === 'string' ? parseFloat(rating) : rating;
  return isNaN(numValue) ? '0.0' : numValue.toFixed(1);
}

/**
 * Get rating color based on value
 */
export function getRatingColor(rating: string | number): { bg: string; text: string } {
  const numValue = typeof rating === 'string' ? parseFloat(rating) : rating;
  
  if (numValue >= 4.0) {
    return { bg: 'bg-[#c3f2cb]', text: 'text-[#286e34]' };
  } else if (numValue >= 3.0) {
    return { bg: 'bg-[#ffeaa7]', text: 'text-[#814c02]' };
  } else if (numValue >= 2.0) {
    return { bg: 'bg-[#f9ecef]', text: 'text-[#811f1a]' };
  } else {
    return { bg: 'bg-red-600', text: 'text-white' };
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}