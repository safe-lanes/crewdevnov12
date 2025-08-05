/**
 * Common validation utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateString(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate that a date is not in the future
 */
export function isNotFutureDate(dateString: string): boolean {
  if (!isValidDateString(dateString)) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  return date <= today;
}

/**
 * Validate phone number format (basic)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Validate that a string contains only letters and spaces
 */
export function isValidName(name: string): boolean {
  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(name) && name.trim().length > 0;
}

/**
 * Validate rating value (1-5 scale)
 */
export function isValidRating(rating: string | number): boolean {
  const numValue = typeof rating === 'string' ? parseFloat(rating) : rating;
  return !isNaN(numValue) && numValue >= 1 && numValue <= 5;
}

/**
 * Check if a string is not empty after trimming
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate crew ID format (alphanumeric, 4-20 characters)
 */
export function isValidCrewId(id: string): boolean {
  const idRegex = /^[a-zA-Z0-9]{4,20}$/;
  return idRegex.test(id);
}