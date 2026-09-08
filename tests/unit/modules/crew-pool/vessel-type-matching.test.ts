import { describe, expect, it } from 'vitest';
import { matchVesselTypeToMaster } from '../../../../client/src/modules/crew-pool/mappers/v2ToLegacyMapper';

describe('matchVesselTypeToMaster', () => {
  const masterTypes = ['Bulk Carrier', 'Crude Oil Tanker', 'Container Ship'];

  it('returns the canonical master value for an exact match', () => {
    expect(matchVesselTypeToMaster('Crude Oil Tanker', masterTypes)).toBe('Crude Oil Tanker');
  });

  it('matches harmless casing and whitespace differences', () => {
    expect(matchVesselTypeToMaster('  crude oil tanker ', masterTypes)).toBe('Crude Oil Tanker');
  });

  it('leaves the field blank when the API classification is not configured', () => {
    expect(matchVesselTypeToMaster('Oil Products Tanker', masterTypes)).toBe('');
  });
});