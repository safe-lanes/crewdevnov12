import { masterLabel, type MasterOption } from "./masterLabels";
import { resolveCountryUuidToName, type VisaCountryApiEntry } from "@/utils/data/visaCountryTemplates";

type VisaCountry = { issuingCountry: string; countryId?: string; countryName?: string };

/** Use the same name resolution for the visible visa row and popup matching. */
export function recruitmentVisaCountryLabel(
  visa: VisaCountry,
  countries: MasterOption[],
  legacyEntries?: VisaCountryApiEntry[],
): string {
  const legacyName = resolveCountryUuidToName(visa.issuingCountry, legacyEntries);
  return masterLabel(visa.issuingCountry, countries, "country",
    visa.issuingCountry === visa.countryId && visa.countryName ? visa.countryName :
      legacyName !== visa.issuingCountry ? legacyName : undefined);
}

/** Presentation-only matching keys. Never write these back into visa records. */
export function recruitmentVisaCountryKeys(
  visas: VisaCountry[],
  countries: MasterOption[],
  legacyEntries?: VisaCountryApiEntry[],
): string[] {
  const keys = new Set<string>();
  for (const visa of visas) {
    for (const reference of [visa.countryId, visa.issuingCountry]) {
      if (reference?.trim()) keys.add(reference.trim());
    }
    const label = recruitmentVisaCountryLabel(visa, countries, legacyEntries).trim();
    if (label && !/^Unresolved country \(master record unavailable\)$/i.test(label)) {
      keys.add(label);
    }
  }
  return [...keys];
}
