import type {
  CandidateV2,
  PersonalDetails,
  Address,
  FamilyInfo,
  Child,
  NextOfKin,
} from "../../../../../shared/v2/recruitment/types";

// ============================================================================
// CANDIDATE MAPPERS
// ============================================================================

export interface CandidateDisplayData {
  id: number;
  uuid: string;
  fileNo: string | null;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  familyName: string | null;
  gender: string | null;
  dob: string | null;
  nationalityUuid: string | null;
  presentRank: string | null;
  rankAppliedFor: string | null;
  status: string | null;
  uploadedPhoto: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export function mapCandidateToDisplay(candidate: CandidateV2): CandidateDisplayData {
  const nameParts = [
    candidate.firstName,
    candidate.middleName,
    candidate.familyName,
  ].filter(Boolean);
  
  return {
    id: candidate.id,
    uuid: candidate.recCanUuid,
    fileNo: candidate.fileNo,
    fullName: nameParts.join(" ") || "Unnamed Candidate",
    firstName: candidate.firstName,
    middleName: candidate.middleName,
    familyName: candidate.familyName,
    gender: candidate.gender,
    dob: candidate.dob,
    nationalityUuid: candidate.nationalityUuid,
    presentRank: candidate.presentRank,
    rankAppliedFor: candidate.rankAppliedFor,
    status: candidate.status,
    uploadedPhoto: candidate.uploadedPhoto,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

// ============================================================================
// PERSONAL DETAILS MAPPERS
// ============================================================================

export interface PersonalDetailsFormData {
  heightCm: string;
  weightKg: string;
  placeOfBirthCity: string;
  placeOfBirthCountryUuid: string;
  ageInYears: string;
  nativeLanguageUuid: string;
  foreignLanguages: string;
  englishProficiency: string;
  manningAgent: string;
}

export function mapPersonalDetailsToForm(data: PersonalDetails | null): PersonalDetailsFormData {
  return {
    heightCm: data?.heightCm || "",
    weightKg: data?.weightKg || "",
    placeOfBirthCity: data?.placeOfBirthCity || "",
    placeOfBirthCountryUuid: data?.placeOfBirthCountryUuid || "",
    ageInYears: data?.ageInYears || "",
    nativeLanguageUuid: data?.nativeLanguageUuid || "",
    foreignLanguages: data?.foreignLanguages || "",
    englishProficiency: data?.englishProficiency || "",
    manningAgent: data?.manningAgent || "",
  };
}

// ============================================================================
// ADDRESS MAPPERS
// ============================================================================

export interface AddressFormData {
  countryOfResidenceUuid: string;
  nearestAirport: string;
  addressLine1: string;
  addressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
}

export function mapAddressToForm(data: Address | null): AddressFormData {
  return {
    countryOfResidenceUuid: data?.countryOfResidenceUuid || "",
    nearestAirport: data?.nearestAirport || "",
    addressLine1: data?.addressLine1 || "",
    addressLine2: data?.addressLine2 || "",
    contactLandline: data?.contactLandline || "",
    mobile: data?.mobile || "",
    email: data?.email || "",
  };
}

// ============================================================================
// FAMILY INFO MAPPERS
// ============================================================================

export interface FamilyInfoFormData {
  maritalStatus: string;
  numDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDob: string;
}

export function mapFamilyInfoToForm(data: FamilyInfo | null): FamilyInfoFormData {
  return {
    maritalStatus: data?.maritalStatus || "",
    numDependentChildren: data?.numDependentChildren || "",
    fatherName: data?.fatherName || "",
    motherName: data?.motherName || "",
    spouseFirstName: data?.spouseFirstName || "",
    spouseMiddleName: data?.spouseMiddleName || "",
    spouseFamilyName: data?.spouseFamilyName || "",
    spouseDob: data?.spouseDob || "",
  };
}

// ============================================================================
// CHILD MAPPERS
// ============================================================================

export interface ChildFormData {
  firstName: string;
  middleName: string;
  familyName: string;
  dob: string;
  gender: string;
}

export function mapChildToForm(data: Child): ChildFormData {
  return {
    firstName: data.firstName || "",
    middleName: data.middleName || "",
    familyName: data.familyName || "",
    dob: data.dob || "",
    gender: data.gender || "",
  };
}

// ============================================================================
// NEXT OF KIN MAPPERS
// ============================================================================

export interface NextOfKinFormData {
  firstName: string;
  middleName: string;
  familyName: string;
  telephone: string;
  email: string;
  address: string;
  relationship: string;
}

export function mapNextOfKinToForm(data: NextOfKin): NextOfKinFormData {
  return {
    firstName: data.firstName || "",
    middleName: data.middleName || "",
    familyName: data.familyName || "",
    telephone: data.telephone || "",
    email: data.email || "",
    address: data.address || "",
    relationship: data.relationship || "",
  };
}
