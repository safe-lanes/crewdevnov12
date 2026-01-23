import type { CrewPersonalDetails, CrewAddress } from '@shared/v2/crew-pool/types';

export interface PersonalDetailsFormData {
  cpdUuid?: string;
  heightCm: string;
  weightKg: string;
  bmi: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountryUuid: string;
  nativeLanguageUuid: string;
  foreignLanguages: string;
  englishProficiency: string;
  manningAgent: string;
  crewPool: string;
  availability: string;
  nextAvailability: string;
}

export interface AddressFormData {
  addrUuid?: string;
  countryOfResidenceUuid: string;
  nearestAirport: string;
  addressLine1: string;
  addressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
}

export function mapPersonalToForm(personal: CrewPersonalDetails | null): PersonalDetailsFormData {
  return {
    cpdUuid: personal?.cpdUuid,
    heightCm: personal?.heightCm || '',
    weightKg: personal?.weightKg || '',
    bmi: personal?.bmi || '',
    ageInYears: personal?.ageInYears || '',
    placeOfBirthCity: personal?.placeOfBirthCity || '',
    placeOfBirthCountryUuid: personal?.placeOfBirthCountryUuid || '',
    nativeLanguageUuid: personal?.nativeLanguageUuid || '',
    foreignLanguages: personal?.foreignLanguages || '',
    englishProficiency: personal?.englishProficiency || '',
    manningAgent: personal?.manningAgent || '',
    crewPool: personal?.crewPool || '',
    availability: personal?.availability || '',
    nextAvailability: personal?.nextAvailability || '',
  };
}

export function mapAddressToForm(address: CrewAddress | null): AddressFormData {
  return {
    addrUuid: address?.addrUuid,
    countryOfResidenceUuid: address?.countryOfResidenceUuid || '',
    nearestAirport: address?.nearestAirport || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    contactLandline: address?.contactLandline || '',
    mobile: address?.mobile || '',
    email: address?.email || '',
  };
}

export function mapFormToPersonal(form: PersonalDetailsFormData): Partial<CrewPersonalDetails> {
  return {
    heightCm: form.heightCm || undefined,
    weightKg: form.weightKg || undefined,
    bmi: form.bmi || undefined,
    ageInYears: form.ageInYears || undefined,
    placeOfBirthCity: form.placeOfBirthCity || undefined,
    placeOfBirthCountryUuid: form.placeOfBirthCountryUuid || undefined,
    nativeLanguageUuid: form.nativeLanguageUuid || undefined,
    foreignLanguages: form.foreignLanguages || undefined,
    englishProficiency: form.englishProficiency || undefined,
    manningAgent: form.manningAgent || undefined,
    crewPool: form.crewPool || undefined,
    availability: form.availability || undefined,
    nextAvailability: form.nextAvailability || undefined,
  };
}

export function mapFormToAddress(form: AddressFormData): Partial<CrewAddress> {
  return {
    countryOfResidenceUuid: form.countryOfResidenceUuid || undefined,
    nearestAirport: form.nearestAirport || undefined,
    addressLine1: form.addressLine1 || undefined,
    addressLine2: form.addressLine2 || undefined,
    contactLandline: form.contactLandline || undefined,
    mobile: form.mobile || undefined,
    email: form.email || undefined,
  };
}

export function getEmptyPersonalForm(): PersonalDetailsFormData {
  return {
    heightCm: '',
    weightKg: '',
    bmi: '',
    ageInYears: '',
    placeOfBirthCity: '',
    placeOfBirthCountryUuid: '',
    nativeLanguageUuid: '',
    foreignLanguages: '',
    englishProficiency: '',
    manningAgent: '',
    crewPool: '',
    availability: '',
    nextAvailability: '',
  };
}

export function getEmptyAddressForm(): AddressFormData {
  return {
    countryOfResidenceUuid: '',
    nearestAirport: '',
    addressLine1: '',
    addressLine2: '',
    contactLandline: '',
    mobile: '',
    email: '',
  };
}
