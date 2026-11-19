import { and, eq, inArray } from "drizzle-orm";
import { masterCountries } from "../../../../shared/schema";
import { isVisaCountryReference, visaCountryPresentation, type VisaCountryValue } from "../../../../shared/v2/crew-pool/visaCountry";
import { getDb } from "../../db";

/** One tenant-scoped lookup per batch; no writes and no global country cache. */
export async function resolveVisaCountryNames<T extends VisaCountryValue>(visas: T[], db = getDb()) {
  const references = [...new Set(visas.flatMap(visa => {
    if (!visaCountryPresentation(visa).unavailable) return [];
    const reference = isVisaCountryReference(visa.country) ? visa.country : visa.countryUuid;
    return reference ? [reference.trim()] : [];
  }))];
  const rows: { uuid: string; name: string | null }[] = references.length ? await db
    .select({ uuid: masterCountries.countryUuid, name: masterCountries.countryName })
    .from(masterCountries)
    .where(and(inArray(masterCountries.countryUuid, references), eq(masterCountries.isDeleted, false))) : [];
  const names = new Map(rows.map(row => [row.uuid, row.name]));
  return visas.map(visa => {
    const reference = isVisaCountryReference(visa.country) ? visa.country : visa.countryUuid;
    const display = visaCountryPresentation({
      ...visa, countryName: reference ? names.get(reference.trim()) : undefined,
    });
    return { ...visa, countryName: display.name || null, countryUnavailable: display.unavailable };
  });
}
