/** Keep stored references separate from presentation; never save an unresolved label. */
export type MasterOption = { id: string; label: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function masterLabel(value: string, options: MasterOption[], kind: string, resolvedName?: string): string {
  if (!value) return '';
  const match = options.find(option => option.id === value);
  if (match) return match.label;
  if (resolvedName) return resolvedName;
  if (UUID.test(value) || /^COUNTRY-\d+$/.test(value)) return `Unresolved ${kind} (master record unavailable)`;
  return value; // Historical/manual names remain valid presentation values.
}

export function masterReference(value: string, options: MasterOption[]): string {
  if (!value || options.some(option => option.id === value)) return value;
  const matches = options.filter(option => option.label.toLowerCase() === value.trim().toLowerCase());
  return matches.length === 1 ? matches[0].id : value;
}

type DisplayForm = {
  nationality: string; placeOfBirthCountry: string; nativeLanguage: string; countryOfResidence: string;
  vesselType: string[];
  visas: Array<{ issuingCountry: string; countryId?: string; countryName?: string }>;
  seaService: Array<{ vesselType: string; vesselTypeName?: string }>;
};
export type DisplayCatalogs = { countries: MasterOption[]; nationalities: MasterOption[]; languages: MasterOption[]; vesselTypes: MasterOption[] };

/** A presentation-only copy for PDF export. The editable form retains its references. */
export function recruitmentDisplayData<T extends DisplayForm>(form: T, catalogs: DisplayCatalogs): T {
  return {
    ...form,
    nationality: masterLabel(form.nationality, catalogs.nationalities, 'nationality'),
    placeOfBirthCountry: masterLabel(form.placeOfBirthCountry, catalogs.countries, 'country'),
    nativeLanguage: masterLabel(form.nativeLanguage, catalogs.languages, 'language'),
    countryOfResidence: masterLabel(form.countryOfResidence, catalogs.countries, 'country'),
    vesselType: form.vesselType.map(value => masterLabel(value, catalogs.vesselTypes, 'vessel type')),
    visas: form.visas.map(visa => ({
      ...visa, issuingCountry: masterLabel(visa.issuingCountry, catalogs.countries, 'country',
        visa.issuingCountry === visa.countryId ? visa.countryName : undefined),
    })),
    seaService: form.seaService.map(service => ({
      ...service, vesselType: masterLabel(service.vesselType, catalogs.vesselTypes, 'vessel type', service.vesselTypeName),
    })),
  };
}
