import { describe, it, expect } from 'vitest';
import {
  parseDateJoinedRankPair,
  evaluateDateJoinedRules,
  getEffectiveReplacementDate,
} from '../../../server/v2/vessel/controllers/complianceController';

const baseExp = {
  yearsWithOperator: 0,
  yearsInRank: 0,
  yearsOnTankerType: 0,
  yearsOnAllTankers: 0,
  englishProficiency: -1,
  timeOnboardMonths: 0,
  crewName: 'Test Crew',
  seaServices: [],
};

const crew = (rank: string, signOnDate: string | null) => ({ ...baseExp, rank, signOnDate });

describe('parseDateJoinedRankPair', () => {
  it('splits on hyphen and strips "Joining Date"', () => {
    expect(parseDateJoinedRankPair('Master Joining Date - Chief Officer Joining Date'))
      .toEqual(['Master', 'Chief Officer']);
  });
  it('splits on plus separator', () => {
    expect(parseDateJoinedRankPair('Master + Chief Officer'))
      .toEqual(['Master', 'Chief Officer']);
  });
  it('splits on comma separator', () => {
    expect(parseDateJoinedRankPair('Chief Engineer, Second Engineer'))
      .toEqual(['Chief Engineer', 'Second Engineer']);
  });
  it('strips Joining Date with comma separator', () => {
    expect(parseDateJoinedRankPair('Chief Engineer Joining Date, 2nd Engineer Joining Date'))
      .toEqual(['Chief Engineer', '2nd Engineer']);
  });
  it('returns empty array for empty / non-string input', () => {
    expect(parseDateJoinedRankPair('')).toEqual([]);
    expect(parseDateJoinedRankPair(undefined as unknown as string)).toEqual([]);
  });
  it('returns single rank when only one provided', () => {
    expect(parseDateJoinedRankPair('Master')).toEqual(['Master']);
  });
  it('handles mixed casing of "joining date"', () => {
    expect(parseDateJoinedRankPair('MASTER JOINING DATE - C/O JOINING DATE'))
      .toEqual(['MASTER', 'C/O']);
  });
});

describe('getEffectiveReplacementDate', () => {
  it('returns Date for valid signOnDate', () => {
    const d = getEffectiveReplacementDate({ signOnDate: '2026-03-01' });
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
  });
  it('returns null for null/missing signOnDate', () => {
    expect(getEffectiveReplacementDate({ signOnDate: null })).toBeNull();
    expect(getEffectiveReplacementDate(null)).toBeNull();
  });
  it('returns null for unparseable signOnDate', () => {
    expect(getEffectiveReplacementDate({ signOnDate: 'not-a-date' })).toBeNull();
  });
});

describe('evaluateDateJoinedRules', () => {
  const masterCoRule = {
    label: '14-day Master/CO',
    rankPair: 'Master Joining Date - Chief Officer Joining Date',
    requiredDays: 14,
  };
  const ceSecondRule = {
    label: '14-day C/E and 2/E',
    rankPair: 'Chief Engineer + 2nd Engineer',
    requiredDays: 14,
  };

  it('passes when gap meets requirement (Master/CO)', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', '2026-03-20'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('pass');
    expect(out[0].actualValue).toBe(19);
  });

  it('fails with 0 days when both signed on the same day', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', '2026-03-01'),
    ]);
    expect(out[0].status).toBe('fail');
    expect(out[0].actualValue).toBe(0);
  });

  it('fails with non-zero gap below requirement', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', '2026-03-10'),
    ]);
    expect(out[0].status).toBe('fail');
    expect(out[0].actualValue).toBe(9);
  });

  it('passes for C/E + 2/E parity (handles + separator)', () => {
    const out = evaluateDateJoinedRules([ceSecondRule], [
      crew('Chief Engineer', '2026-03-01'),
      crew('2nd Engineer', '2026-04-01'),
    ]);
    expect(out[0].status).toBe('pass');
    expect(out[0].actualValue).toBe(31);
  });

  it('returns not_applicable when paired crew is missing', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
    ]);
    expect(out[0].status).toBe('not_applicable');
  });

  it('returns not_applicable when one signOnDate is missing', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', null),
    ]);
    expect(out[0].status).toBe('not_applicable');
  });

  it('returns not_applicable when signOnDate is unparseable', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', 'garbage'),
    ]);
    expect(out[0].status).toBe('not_applicable');
  });

  it('honors simulated joining date via signOnDate (one-sided sim)', () => {
    // Simulation flow populates the simulated rank's signOnDate with the
    // simulated joining date; the unchanged rank keeps its real planning date.
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),               // unchanged incumbent
      crew('Chief Officer', '2026-04-15'),        // simulated CO joining 15 Apr
    ]);
    expect(out[0].status).toBe('pass');
    expect(out[0].actualValue).toBe(45);
  });
});
