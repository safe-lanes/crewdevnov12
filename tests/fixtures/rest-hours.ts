// Test fixtures for rest hours data

export const mockRestHourEntry = {
  id: 1,
  crewMemberId: 1,
  date: '2025-01-06',
  restPeriods: [
    { start: '00:00', end: '06:00' },
    { start: '12:00', end: '18:00' },
  ],
  totalRestHours: 12,
  isCompliant: true,
};

export const mockRestHourEntries = [
  mockRestHourEntry,
  {
    id: 2,
    crewMemberId: 1,
    date: '2025-01-05',
    restPeriods: [
      { start: '00:00', end: '05:00' },
      { start: '14:00', end: '18:00' },
    ],
    totalRestHours: 9,
    isCompliant: false,
  },
  {
    id: 3,
    crewMemberId: 2,
    date: '2025-01-06',
    restPeriods: [
      { start: '00:00', end: '07:00' },
      { start: '13:00', end: '20:00' },
    ],
    totalRestHours: 14,
    isCompliant: true,
  },
];

export const mockViolation = {
  code: 'REST_MIN_24H',
  description: 'Minimum 10 hours rest in any 24-hour period',
  severity: 'critical',
  date: '2025-01-05',
  crewMemberId: 1,
};

export const mockViolations = [
  mockViolation,
  {
    code: 'REST_MIN_7D',
    description: 'Minimum 77 hours rest in any 7-day period',
    severity: 'warning',
    date: '2025-01-05',
    crewMemberId: 1,
  },
];
