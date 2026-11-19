/** Recognize references without mistaking genuine manual country text for one. */
export function isVisaCountryReference(value?: string | null): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export type VisaCountryValue = {
  country?: string | null;
  countryUuid?: string | null;
  countryName?: string | null;
};

/** Presentation only: raw country/reference values remain available for saves. */
export function visaCountryPresentation(visa: VisaCountryValue) {
  if (visa.country && !isVisaCountryReference(visa.country)) {
    return { name: visa.country, unavailable: false };
  }
  if (visa.countryName && !isVisaCountryReference(visa.countryName)) {
    return { name: visa.countryName, unavailable: false };
  }
  // Some historical records only carried a text country in country_uuid.
  if (!visa.country && visa.countryUuid && !isVisaCountryReference(visa.countryUuid)) {
    return { name: visa.countryUuid, unavailable: false };
  }
  return {
    name: "",
    unavailable: isVisaCountryReference(visa.country) || isVisaCountryReference(visa.countryUuid),
  };
}

export type EditableVisaCountry = {
  issuingCountry?: string;
  country?: string;
  countryId?: string;
  countryUnavailable?: boolean;
};

/** Never turn a missing-master presentation message into stored country data. */
export function visaCountryForSave(visa: EditableVisaCountry): string {
  return visa.issuingCountry ||
    (visa.countryUnavailable ? visa.country || visa.countryId || "" : "");
}
