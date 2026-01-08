// Database test helper utilities
// NOTE: These helpers work with test fixtures only - they do not modify actual database

/**
 * Generate a unique ID for test data
 */
export function generateTestId(): number {
  return Math.floor(Math.random() * 1000000) + 10000;
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}@test.example.com`;
}

/**
 * Generate a test date string
 */
export function generateTestDate(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Create a mock crew member with unique data
 */
export function createMockCrewMember(overrides: Partial<any> = {}) {
  return {
    id: generateTestId(),
    firstName: `Test${Math.random().toString(36).substring(7)}`,
    lastName: `User${Math.random().toString(36).substring(7)}`,
    rank: 'Third Officer',
    vesselId: 1,
    email: generateTestEmail('crew'),
    nationality: 'British',
    dateOfBirth: '1990-01-01',
    employmentDate: generateTestDate(-365),
    status: 'active',
    ...overrides,
  };
}

/**
 * Create a mock vessel with unique data
 */
export function createMockVessel(overrides: Partial<any> = {}) {
  return {
    id: generateTestId(),
    name: `MV Test ${Math.random().toString(36).substring(7)}`,
    imo: String(9000000 + Math.floor(Math.random() * 999999)),
    type: 'Container Ship',
    flag: 'Panama',
    grossTonnage: 45000,
    status: 'active',
    ...overrides,
  };
}

/**
 * Create a mock rest hour entry
 */
export function createMockRestHourEntry(
  crewMemberId: number,
  overrides: Partial<any> = {}
) {
  return {
    id: generateTestId(),
    crewMemberId,
    date: generateTestDate(),
    restPeriods: [
      { start: '00:00', end: '06:00' },
      { start: '12:00', end: '18:00' },
    ],
    totalRestHours: 12,
    isCompliant: true,
    ...overrides,
  };
}

/**
 * Create mock appraisal form
 */
export function createMockAppraisalForm(
  crewMemberId: number,
  vesselId: number,
  overrides: Partial<any> = {}
) {
  return {
    id: generateTestId(),
    crewMemberId,
    vesselId,
    appraisalPeriodStart: generateTestDate(-365),
    appraisalPeriodEnd: generateTestDate(),
    status: 'draft',
    ...overrides,
  };
}
