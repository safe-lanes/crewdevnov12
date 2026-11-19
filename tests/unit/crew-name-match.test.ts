// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyCrew, matchCrewNames, normalizeName, type CrewIdentity } from '../../server/v2/crew-pool/services/crew-name-match/matcher';

const crew = (changes: Partial<CrewIdentity> = {}): CrewIdentity => ({
  crewUuid: 'crew-1', empNo: 'K 2332', firstName: 'AZHAR', middleName: null, familyName: 'SIDDIQUE',
  status: 'On Leave', isActive: true, archivedAt: null, isDeleted: false, ...changes,
});
const match = (name: string, crews = [crew()]) => matchCrewNames([{ row: 2, name }], crews)[0];

describe('Crew name identity matching', () => {
  it.each(['AZHAR SIDDIQUE', 'SIDDIQUE AZHAR', ' siddique   azhar ', 'AZHAR\u00a0SIDDIQUE'])('matches direct/reverse full names: %s', name => {
    expect(match(name).outcome).toBe('Active');
    expect(match(name).candidates[0].crew.empNo).toBe('K 2332');
  });
  it('preserves original input and never mutates crew records', () => {
    const record = Object.freeze(crew());
    const input = Object.freeze({ row: 7, name: ' siddique  azhar ' });
    expect(matchCrewNames([input], [record])[0].input).toEqual(input);
  });
  it('handles multiword components and middle names without arbitrary token sorting', () => {
    const records = [crew({ firstName: 'ANNA MARIA', middleName: 'JO', familyName: 'DE SILVA' })];
    expect(match('DE SILVA ANNA MARIA JO', records).outcome).toBe('Active');
    expect(match('JO MARIA SILVA ANNA DE', records).outcome).toBe('Not Found');
    expect(match('ANNA MARIA DE SILVA', records).outcome).toBe('Not Found');
  });
  it('matches a complete legacy name stored only in first name', () => {
    const record = crew({ firstName: 'AZHAR SIDDIQUE', middleName: null, familyName: null });
    const result = match('AZHAR SIDDIQUE', [record]);
    expect(result.outcome).toBe('Active');
    expect(result.candidates[0].methods).toEqual(['First Name Only']);
  });
  it('matches the exact reverse of a complete legacy name stored only in first name', () => {
    const record = crew({ firstName: 'SIDDIQUE AZHAR', middleName: null, familyName: null });
    const result = match('AZHAR SIDDIQUE', [record]);
    expect(result.outcome).toBe('Active');
    expect(result.candidates[0].methods).toEqual(['First Name Only Reverse']);
  });
  it('reverses every legacy first-name token and never accepts an arbitrary rearrangement', () => {
    const record = crew({ firstName: 'SIDDIQUE AZHAR MOHAMMED', middleName: null, familyName: null });
    expect(match('MOHAMMED AZHAR SIDDIQUE', [record]).candidates[0].methods).toEqual(['First Name Only Reverse']);
    expect(match('AZHAR MOHAMMED SIDDIQUE', [record]).outcome).toBe('Not Found');
  });
  it('does not add a first-name-only reverse method for a one-token legacy name', () => {
    const result = match('AZHAR', [crew({ firstName: 'AZHAR', middleName: null, familyName: null })]);
    expect(result.candidates[0].methods).toEqual(['First Name Only']);
  });
  it('does not use first-name-only matching when separate name components exist', () => {
    const record = crew({ firstName: 'AZHAR SIDDIQUE', middleName: null, familyName: 'KHAN' });
    expect(match('AZHAR SIDDIQUE', [record]).outcome).toBe('Not Found');
  });
  it('marks a first-name-only fallback conflict as ambiguous', () => {
    const result = match('AZHAR SIDDIQUE', [
      crew(),
      crew({ crewUuid: 'legacy', empNo: 'K 9999', firstName: 'AZHAR SIDDIQUE', middleName: null, familyName: null }),
    ]);
    expect(result.outcome).toBe('Ambiguous');
    expect(result.candidates.map(candidate => candidate.methods)).toContainEqual(['First Name Only']);
  });
  it('marks a first-name-only reverse conflict as ambiguous', () => {
    const result = match('AZHAR SIDDIQUE', [
      crew(),
      crew({ crewUuid: 'legacy-reverse', empNo: 'K 9998', firstName: 'SIDDIQUE AZHAR', middleName: null, familyName: null }),
    ]);
    expect(result.outcome).toBe('Ambiguous');
    expect(result.candidates.map(candidate => candidate.methods)).toContainEqual(['First Name Only Reverse']);
  });
  it('does not fuzzy match or strip punctuation/accents', () => {
    expect(match('AZAR SIDDIQUE').outcome).toBe('Not Found');
    expect(match('JEAN PAUL ONEIL', [crew({ firstName: 'JEAN-PAUL', familyName: "O'NEIL" })]).outcome).toBe('Not Found');
    expect(match('JOSE SIDDIQUE', [crew({ firstName: 'JOSÉ' })]).outcome).toBe('Not Found');
    expect(normalizeName('Jose\u0301')).toBe(normalizeName('José'));
  });
  it('deduplicates the same crew matching both variants', () => {
    const result = match('RAJ RAJ', [crew({ firstName: 'RAJ', familyName: 'RAJ' })]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].methods).toEqual(['Direct', 'Reverse']);
  });
  it('does not prefer a direct active match over a reverse terminated match', () => {
    const result = match('AZHAR SIDDIQUE', [crew(), crew({ crewUuid: 'crew-2', empNo: 'K 9', firstName: 'SIDDIQUE', familyName: 'AZHAR', status: 'Terminated', isActive: false })]);
    expect(result.outcome).toBe('Ambiguous');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map(c => c.status)).toContain('Terminated');
  });
  it('reports duplicate names as multiple distinct crews', () => {
    expect(match('AZHAR SIDDIQUE', [crew(), crew({ crewUuid: 'crew-2', empNo: 'K 9' })]).outcome).toBe('Ambiguous');
  });
  it('archived candidates cannot silently disappear behind an active candidate', () => {
    expect(match('AZHAR SIDDIQUE', [crew(), crew({ crewUuid: 'crew-2', archivedAt: new Date() })]).outcome).toBe('Ambiguous');
    expect(match('AZHAR SIDDIQUE', [crew({ archivedAt: new Date() })]).outcome).toBe('Review Required');
  });
  it('excludes deleted records and missing deletion flags', () => {
    expect(match('AZHAR SIDDIQUE', [crew({ isDeleted: true }), crew({ isDeleted: null })]).outcome).toBe('Not Found');
  });
  it('retains duplicates and detects employee folder collisions across different arrangements', () => {
    const results = matchCrewNames([{ row: 2, name: 'AZHAR SIDDIQUE' }, { row: 3, name: 'AZHAR SIDDIQUE' }, { row: 4, name: 'SIDDIQUE AZHAR' }], [crew()]);
    expect(results).toHaveLength(3);
    expect(results[0].warnings.join(' ')).toContain('Repeated');
    expect(results.every(row => row.warnings.some(warning => warning.includes('folder-renaming')))).toBe(true);
  });
  it('does not treat invalid input as not found', () => {
    expect(match('').outcome).toBe('Review Required');
    expect(matchCrewNames([{ row: 2, name: 'AZHAR SIDDIQUE', error: 'Formula' }], [crew()])[0].candidates).toEqual([]);
  });
  it('uses only the dataset supplied for the current tenant', () => {
    expect(match('AZHAR SIDDIQUE', [crew({ firstName: 'OTHER' })]).outcome).toBe('Not Found');
  });
  it('fails explicitly before an excessive number of candidates can expand into a report', () => {
    const inputs = Array.from({ length: 101 }, (_, i) => ({ row: i + 2, name: 'AZHAR SIDDIQUE' }));
    const records = Array.from({ length: 1000 }, (_, i) => crew({ crewUuid: `crew-${i}`, empNo: `K ${i}` }));
    expect(() => matchCrewNames(inputs, records)).toThrow('Too many candidate rows');
  });
});

describe('Current status classification', () => {
  it.each(['Terminated', 'Terminated - NFR', 'Terminated Employment', 'Terminated Employment - NFR'])('recognizes %s even with inconsistent active flag', status => {
    expect(classifyCrew(crew({ status, isActive: true }))).toMatchObject({ status: 'Terminated', reason: expect.stringContaining('inconsistent') });
  });
  it.each(['Active', 'On Board', 'On Leave'])('recognizes %s only with active flag true', status => {
    expect(classifyCrew(crew({ status })).status).toBe('Active');
    expect(classifyCrew(crew({ status, isActive: false })).status).toBe('Review Required');
    expect(classifyCrew(crew({ status, isActive: null })).status).toBe('Review Required');
  });
  it.each(['Inactive', '', 'Unknown', 'Terminated Something New', null])('does not invent classification for %s', status => {
    expect(classifyCrew(crew({ status })).status).toBe('Review Required');
  });
  it('requires an employee ID and flags archives', () => {
    expect(classifyCrew(crew({ empNo: '  ' })).status).toBe('Review Required');
    expect(classifyCrew(crew({ archivedAt: '2026-01-01', status: 'Terminated' })).status).toBe('Review Required');
  });
  it('handles a reactivated current record without consulting old termination history', () => {
    expect(classifyCrew(crew({ status: 'On Leave', isActive: true })).status).toBe('Active');
    expect(classifyCrew(crew({ status: 'Inactive', isActive: false })).status).toBe('Review Required');
  });
  it('processes 10000 rows without losing their source row identity', () => {
    const inputs = Array.from({ length: 10000 }, (_, i) => ({ row: i + 2, name: `PERSON ${i}` }));
    const records = inputs.map((_, i) => crew({ crewUuid: `uuid-${i}`, empNo: `000${i}`, firstName: 'PERSON', familyName: String(i) }));
    const results = matchCrewNames(inputs, records);
    expect(results).toHaveLength(10000);
    expect(results.every(row => row.outcome === 'Active')).toBe(true);
    expect(results[9999].input.row).toBe(10001);
  });
});
