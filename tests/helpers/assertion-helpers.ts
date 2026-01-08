// Custom assertion helpers for tests
import { expect } from 'vitest';

/**
 * Assert that a value is a valid date string (YYYY-MM-DD)
 */
export function expectValidDate(value: string) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  expect(value).toMatch(dateRegex);
  expect(new Date(value).toString()).not.toBe('Invalid Date');
}

/**
 * Assert that a value is a valid email
 */
export function expectValidEmail(value: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  expect(value).toMatch(emailRegex);
}

/**
 * Assert that an object has all required keys
 */
export function expectHasKeys(obj: object, keys: string[]) {
  keys.forEach((key) => {
    expect(obj).toHaveProperty(key);
  });
}

/**
 * Assert that a crew member object is valid
 */
export function expectValidCrewMember(crewMember: any) {
  expectHasKeys(crewMember, [
    'id',
    'firstName',
    'lastName',
    'rank',
    'vesselId',
  ]);
  expect(typeof crewMember.id).toBe('number');
  expect(typeof crewMember.firstName).toBe('string');
  expect(typeof crewMember.lastName).toBe('string');
}

/**
 * Assert that a vessel object is valid
 */
export function expectValidVessel(vessel: any) {
  expectHasKeys(vessel, ['id', 'name', 'imo', 'type', 'status']);
  expect(typeof vessel.id).toBe('number');
  expect(typeof vessel.name).toBe('string');
}

/**
 * Assert that a rest hour entry is valid
 */
export function expectValidRestHourEntry(entry: any) {
  expectHasKeys(entry, [
    'id',
    'crewMemberId',
    'date',
    'restPeriods',
    'totalRestHours',
  ]);
  expect(typeof entry.id).toBe('number');
  expect(typeof entry.crewMemberId).toBe('number');
  expectValidDate(entry.date);
  expect(Array.isArray(entry.restPeriods)).toBe(true);
}

/**
 * Assert rest hour compliance
 */
export function expectCompliantRestHours(
  totalHours: number,
  minRequired: number = 10
) {
  expect(totalHours).toBeGreaterThanOrEqual(minRequired);
}

/**
 * Assert that an array has no duplicates based on a key
 */
export function expectNoDuplicates<T>(array: T[], key: keyof T) {
  const values = array.map((item) => item[key]);
  const uniqueValues = new Set(values);
  expect(uniqueValues.size).toBe(values.length);
}

/**
 * Assert that dates are in order (ascending or descending)
 */
export function expectDatesInOrder(
  dates: string[],
  order: 'asc' | 'desc' = 'asc'
) {
  const sortedDates = [...dates].sort((a, b) => {
    const comparison = new Date(a).getTime() - new Date(b).getTime();
    return order === 'asc' ? comparison : -comparison;
  });
  expect(dates).toEqual(sortedDates);
}

/**
 * Assert violation structure is valid
 */
export function expectValidViolation(violation: any) {
  expectHasKeys(violation, ['code', 'description', 'severity']);
  expect(['critical', 'warning', 'info']).toContain(violation.severity);
}
