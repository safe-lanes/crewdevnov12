import { mapApiResponseToVisaCountries, mergeWithDefaultCountries, type VisaCountryApiEntry } from "../../../../shared/visaCountryTemplates";
import type { CatalogEntry } from "./contract";

/** Match the web picker choices, but save the same references as the web form.
 * Presentation IDs (COUNTRY-n / default alpha codes) are not country UUIDs.
 * The web form keeps a readable name when no country master matches it.
 */
export function visaCountryCatalog(entries: VisaCountryApiEntry[], countries: CatalogEntry[]): CatalogEntry[] {
  const choices = mergeWithDefaultCountries(mapApiResponseToVisaCountries(entries));
  return choices.filter(choice => choice.name.trim()).flatMap(choice => {
    const matches = countries.filter(country => country.label.trim().toLowerCase() === choice.name.trim().toLowerCase());
    // Preserve ambiguity so the parser reports it rather than choosing an ID.
    return matches.length ? matches.map(country => ({ label: choice.name, value: country.value }))
      : [{ label: choice.name, value: choice.name }];
  });
}
