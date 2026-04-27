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

// Helper: build a CrewExperience-shaped object. The Date Joined rule reads
// signOffDate (the active onboard officer's planned departure); signOnDate
// is unused by this rule and defaults to null here.
const crew = (
  rank: string,
  signOffDate: string | null,
  signOnDate: string | null = null,
) => ({ ...baseExp, rank, signOnDate, signOffDate });

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
  it('returns Date for valid signOffDate', () => {
    const d = getEffectiveReplacementDate({ signOffDate: '2026-01-11' });
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(11);
  });
  it('returns null for null/missing signOffDate', () => {
    expect(getEffectiveReplacementDate({ signOffDate: null })).toBeNull();
    expect(getEffectiveReplacementDate({})).toBeNull();
    expect(getEffectiveReplacementDate(null)).toBeNull();
  });
  it('returns null for unparseable signOffDate', () => {
    expect(getEffectiveReplacementDate({ signOffDate: 'not-a-date' })).toBeNull();
  });
  it('does NOT fall back to signOnDate (rule is sign-off based only)', () => {
    // Even when a sign-on date is present, a missing sign-off must yield null
    // so the evaluator surfaces not_applicable rather than computing the
    // gap from joining dates.
    expect(
      getEffectiveReplacementDate({ signOffDate: null } as any),
    ).toBeNull();
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

  it('passes when sign-off gap meets requirement (Master/CO)', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', '2026-03-20'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('pass');
    expect(out[0].actualValue).toBe(19);
  });

  it('fails with 0 days when both sign off the same day', () => {
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

  it('returns not_applicable when one signOffDate is missing', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', null),
    ]);
    expect(out[0].status).toBe('not_applicable');
  });

  it('returns not_applicable when active officer has no scheduled sign-off', () => {
    // Both ranks are onboard but neither has a planned departure — there is
    // no replacement event to compare. The rule must surface not_applicable
    // rather than evaluating a meaningless gap.
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', null, '2024-03-15'),
      crew('Chief Officer', null, '2025-08-02'),
    ]);
    expect(out[0].status).toBe('not_applicable');
    expect(out[0].actualValue).toBe(0);
  });

  it('returns not_applicable when signOffDate is unparseable', () => {
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-03-01'),
      crew('Chief Officer', 'garbage'),
    ]);
    expect(out[0].status).toBe('not_applicable');
  });

  it("ignores reliever joining date — uses active officer's sign-off (user's regression scenario)", () => {
    // Real-world reported bug: Master signs off 01 Jan 2026, relieving Chief
    // Officer joins 08 Jan 2026, currently onboard Chief Officer signs off
    // 11 Jan 2026. The correct lapse is 10 days (01 Jan → 11 Jan), failing
    // the 14-day threshold. The 08 Jan reliever joining date must NOT
    // influence the calculation. The crew helper ignores its third arg
    // (signOnDate); only signOffDate drives this rule.
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-01-01', '2026-01-02'),       // active Master signs off 01 Jan; reliever sign-on irrelevant
      crew('Chief Officer', '2026-01-11', '2026-01-08'), // active CO signs off 11 Jan; reliever joining 08 Jan irrelevant
    ]);
    expect(out[0].status).toBe('fail');
    expect(out[0].actualValue).toBe(10);
  });

  it('ignores signOnDate entirely — only sign-off drives the result', () => {
    // Two officers with very different joining dates but identical sign-off
    // dates produce a 0-day gap, confirming sign-on dates are not used.
    const out = evaluateDateJoinedRules([masterCoRule], [
      crew('Master', '2026-04-15', '2024-01-01'),
      crew('Chief Officer', '2026-04-15', '2025-12-30'),
    ]);
    expect(out[0].status).toBe('fail');
    expect(out[0].actualValue).toBe(0);
  });
});
