// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { masterLabel, masterReference, recruitmentDisplayData, type DisplayCatalogs } from '../../client/src/modules/recruitment/masterLabels';
import { resolveCountryUuidToName } from '../../client/src/utils/data/visaCountryTemplates';

const country = '11111111-1111-4111-8111-111111111111';
const vessel = '22222222-2222-4222-8222-222222222222';
const nationality = '33333333-3333-4333-8333-333333333333';
const language = '44444444-4444-4444-8444-444444444444';
const catalogs: DisplayCatalogs = {
  countries: [{ id: country, label: 'India' }],
  vesselTypes: [{ id: vessel, label: 'Bulk Carrier' }],
  nationalities: [{ id: nationality, label: 'Indian' }],
  languages: [{ id: language, label: 'Hindi' }],
};
const form = () => ({
  nationality, placeOfBirthCountry: country, nativeLanguage: language, countryOfResidence: country,
  vesselType: [vessel], presentRank: 'Master', rankAppliedFor: 'Master', manningAgent: 'Agency One',
  visas: [{ issuingCountry: country, countryId: country, countryName: 'India', serialNo: '0012' }],
  seaService: [{ vesselType: vessel, vesselTypeName: 'Bulk Carrier', vesselName: 'Ship' }],
  documents: [{ issuingCountryUuid: country }], licenses: [{ issuingCountryUuid: country }], trainingCourses: [{ issuingCountryUuid: country }],
});

describe('Recruitment master presentation and storage', () => {
  it('shows all imported master names without mutating their stored references', () => {
    const raw = form(), before = structuredClone(raw);
    const display = recruitmentDisplayData(raw, catalogs);
    expect(display).toMatchObject({
      nationality: 'Indian', placeOfBirthCountry: 'India', nativeLanguage: 'Hindi', countryOfResidence: 'India',
      vesselType: ['Bulk Carrier'], visas: [{ issuingCountry: 'India', serialNo: '0012' }],
      seaService: [{ vesselType: 'Bulk Carrier' }], presentRank: 'Master', rankAppliedFor: 'Master', manningAgent: 'Agency One',
    });
    expect(raw).toEqual(before);
    for (const key of ['documents', 'licenses', 'trainingCourses'] as const) expect(display[key][0].issuingCountryUuid).toBe(country);
  });
  it('uses API-enriched names before catalogs finish loading', () => {
    const display = recruitmentDisplayData(form(), { countries: [], vesselTypes: [], nationalities: [], languages: [] });
    expect(display.visas[0].issuingCountry).toBe('India');
    expect(display.seaService[0].vesselType).toBe('Bulk Carrier');
    expect(display.nationality).toContain('Unresolved nationality');
  });
  it('resolves delayed catalogs at render time without replacing edited fields', () => {
    const raw = form();
    raw.visas[0].serialNo = 'edited';
    delete (raw.seaService[0] as { vesselTypeName?: string }).vesselTypeName;
    const pending = recruitmentDisplayData(raw, { ...catalogs, vesselTypes: [] });
    expect(pending.seaService[0].vesselType).toContain('Unresolved vessel type');
    const loaded = recruitmentDisplayData(raw, catalogs);
    expect(loaded.seaService[0].vesselType).toBe('Bulk Carrier');
    expect(raw.visas[0].serialNo).toBe('edited');
    expect(raw.seaService[0].vesselType).toBe(vessel);
  });
  it('retains an unresolved reference, never the warning text, for saves', () => {
    for (const kind of ['country', 'vessel type', 'language', 'nationality']) {
      expect(masterLabel(country, [], kind)).toBe(`Unresolved ${kind} (master record unavailable)`);
      expect(masterReference(country, [])).toBe(country);
    }
    expect(masterLabel('COUNTRY-12', [], 'country')).toContain('Unresolved country');
  });
  it('maps known edited labels to UUIDs, retains blank clears and never guesses ambiguous matches', () => {
    expect(masterReference(' india ', catalogs.countries)).toBe(country);
    expect(masterReference('Bulk Carrier', catalogs.vesselTypes)).toBe(vessel);
    expect(masterReference('', catalogs.countries)).toBe('');
    expect(masterReference(country, catalogs.countries)).toBe(country);
    expect(masterReference('India', [...catalogs.countries, { id: vessel, label: 'India' }])).toBe('India');
  });
  it('keeps legacy/manual values and legacy country aliases working', () => {
    expect(masterLabel('Chemical Tanker', [], 'vessel type')).toBe('Chemical Tanker');
    expect(masterReference('Schengen', catalogs.countries)).toBe('Schengen');
    expect(resolveCountryUuidToName('USA')).toBe('United States');
    expect(resolveCountryUuidToName('COUNTRY-7', [{ id: 7, name: 'Indian' }])).toBe('India');
    expect(resolveCountryUuidToName('legacy-nuid', [{ nuid: 'legacy-nuid', name: 'British' }])).toBe('United Kingdom');
  });
  it('ignores a stale API country label when the country has been edited', () => {
    const raw = form();
    raw.visas[0].issuingCountry = 'Schengen';
    expect(recruitmentDisplayData(raw, catalogs).visas[0].issuingCountry).toBe('Schengen');
  });
  it('uses the renamed master label while keeping the UUID stable', () => {
    const renamed = { ...catalogs, vesselTypes: [{ id: vessel, label: 'Renamed Vessel Type' }] };
    expect(recruitmentDisplayData(form(), renamed).seaService[0].vesselType).toBe('Renamed Vessel Type');
    expect(masterReference(vessel, renamed.vesselTypes)).toBe(vessel);
  });
});
