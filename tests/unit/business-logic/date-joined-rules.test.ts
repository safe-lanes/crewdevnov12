import { describe, it, expect } from 'vitest';
import { parseDateJoinedRankPair } from '../../../server/v2/vessel/controllers/complianceController';

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
