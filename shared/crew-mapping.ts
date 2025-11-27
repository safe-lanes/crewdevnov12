import { CrewMember, InsertCrewMember } from "./schema";
import { calculateSeaServicePeriod } from "./seaServiceCalculator";

// Frontend/Table representation with normalized field names
export interface CrewMemberDTO {
  id: string;
  
  // Basic Personal Information
  empNo?: string | null;
  firstName: string;
  middleName?: string | null;
  familyName?: string | null; // Maps to lastName in some contexts
  lastName?: string | null; // For backward compatibility
  dob?: string | null; // Maps to dateOfBirth in DB
  dateOfBirth?: string | null; // Database field name
  ageInYears?: string | null; // Maps to age in DB
  age?: string | null; // Database field name
  nationality: string;
  
  // Rank and Employment  
  rank?: string | null; // Maps to presentRank in DB
  presentRank?: string | null;
  rankAppliedFor?: string | null;
  employeeId?: string | null;
  
  // Vessel Information
  vessel?: string | null; // Maps to presentVessel in DB
  presentVessel?: string | null;
  vesselType: string;
  lastVessel?: string | null;
  
  // Contract and Status
  status?: string | null;
  joiningDate?: string | null;
  signOnDate?: string | null;
  signOffDate?: string | null;
  contractPeriod?: string | null;
  reliefDue?: string | null;
  reason?: string | null;
  availability?: string | null;
  
  // Contact Information
  email?: string | null;
  mobile?: string | null;
  contactLandline?: string | null;
  
  // Address Information
  countryOfResidence?: string | null;
  nearestAirport?: string | null;
  residentialAddressLine1?: string | null;
  residentialAddressLine2?: string | null;
  
  // Physical Information
  placeOfBirthCity?: string | null;
  placeOfBirthCountry?: string | null;
  heightCm?: string | null;
  weightKg?: string | null;
  bmi?: string | null;
  
  // Language and Personal Details
  nativeLanguage?: string | null;
  foreignLanguages?: string | null;
  englishProficiency?: string | null;
  maritalStatus?: string | null;
  numberOfDependentChildren?: string | null;
  
  // Family Information
  fatherName?: string | null;
  motherName?: string | null;
  spouseFirstName?: string | null;
  spouseMiddleName?: string | null;
  spouseFamilyName?: string | null;
  spouseDateOfBirth?: string | null;
  
  // Next of Kin Information
  nokFirstName?: string | null;
  nokMiddleName?: string | null;
  nokFamilyName?: string | null;
  nokTelephone?: string | null;
  nokEmail?: string | null;
  nokAddress?: string | null;
  nokRelationship?: string | null;
  
  // Additional Information
  manningAgent?: string | null;
  vesselTypes?: string[] | null; // Parsed from JSON
  
  // Complex Data (parsed from JSON)
  documents?: DocumentInfo[] | null;
  visas?: Visa[] | null;
  education?: Education[] | null;
  licenses?: License[] | null;
  trainingCourses?: TrainingCourse[] | null;
  currentCompanySeaService?: SeaService[] | null;
  externalSeaService?: SeaService[] | null;
  preJoiningMedicals?: PreJoiningMedical[] | null;
  doctorVisits?: DoctorVisit[] | null;
  children?: ChildInfo[] | null;
  
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Complex data interfaces (from form)
export interface DocumentInfo {
  documentType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
}

export interface Visa {
  issuingCountry: string;
  serialNumber: string;
  issueDate: string;
  expiryDate: string;
  visaType: string;
}

export interface Education {
  dateOfCompletion: string;
  institution: string;
  subjects: string;
  qualifications: string;
}

export interface License {
  certificateName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
}

export interface TrainingCourse {
  courseName: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
}

export interface SeaService {
  vesselName: string;
  vesselType: string;
  rank: string;
  signOnDate: string;
  signOffDate: string;
  duration: string;
}

export interface PreJoiningMedical {
  vessel: string;
  date: string;
  bp: string;
  weight: string;
  prescribedMedication: string;
  fitnessForDuty: string;
  expiry: string;
}

export interface DoctorVisit {
  vessel: string;
  port: string;
  date: string;
  complaint: string;
  doctorComments: string;
}

export interface ChildInfo {
  firstName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
}

// Field mapping configuration
const FIELD_MAPPINGS = {
  // Frontend field -> Database field
  dob: 'dateOfBirth',
  ageInYears: 'age',
  rank: 'presentRank',
  vessel: 'presentVessel',
  lastName: 'familyName', // For backward compatibility
} as const;

const REVERSE_FIELD_MAPPINGS = {
  // Database field -> Frontend field  
  dateOfBirth: 'dob',
  age: 'ageInYears',
  presentRank: 'rank',
  presentVessel: 'vessel',
  familyName: 'lastName', // For backward compatibility
} as const;

// JSON fields that need parsing/stringifying
const JSON_FIELDS = [
  'vesselTypes',
  'documents', 
  'visas',
  'education',
  'licenses', 
  'trainingCourses',
  'currentCompanySeaService',
  'externalSeaService', 
  'preJoiningMedicals',
  'doctorVisits',
  'children'
] as const;

/**
 * Helper function to calculate age from date of birth
 */
function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '';
  
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  // Check if valid date
  if (isNaN(birthDate.getTime())) return '';
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust if birthday hasn't occurred this year yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age.toString() : '';
}

/**
 * RANK-ROLE MAPPING UTILITIES
 * 
 * Purpose: Maintain link between vessel-specific positions (roles) and base ranks
 * 
 * - Position/Role: Specific vessel position like "AB_1", "AB_2", "3rd Officer_1"
 * - Base Rank: The actual rank without suffix like "AB", "3rd Officer"
 * 
 * Use cases:
 * - Display: Show specific positions (AB_1) for crew assignment clarity
 * - Reports: Extract base ranks (AB) for official crew lists and documents
 */

/**
 * Extract base rank from vessel position/role
 * 
 * Examples:
 *   "AB_1" → "AB"
 *   "AB_2" → "AB"
 *   "3rd Officer_1" → "3rd Officer"
 *   "Master" → "Master" (no suffix)
 * 
 * @param position - The vessel-specific position (e.g., "AB_1", "3rd Officer_2")
 * @returns The base rank without numeric suffix
 */
export function getBaseRank(position: string | null | undefined): string {
  if (!position) return '';
  
  // Split by underscore and take the base part
  // Handles: "AB_1" → "AB", "3rd Officer_1" → "3rd Officer", "Master" → "Master"
  const parts = position.split('_');
  
  // If there's a numeric suffix (e.g., _1, _2), remove it
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join('_');
  }
  
  // No suffix, return as-is
  return position;
}

/**
 * Check if a position has a numeric suffix
 * 
 * @param position - The vessel-specific position
 * @returns true if position has numeric suffix (e.g., "AB_1"), false otherwise
 */
export function hasPositionSuffix(position: string | null | undefined): boolean {
  if (!position) return false;
  
  const parts = position.split('_');
  return parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
}

/**
 * Convert database CrewMember to frontend DTO
 */
export function fromStorageCrew(dbCrew: CrewMember): CrewMemberDTO {
  const dto: any = { ...dbCrew };
  
  // Apply reverse field mappings (DB -> Frontend)
  Object.entries(REVERSE_FIELD_MAPPINGS).forEach(([dbField, frontendField]) => {
    if (dbField in dto) {
      dto[frontendField] = dto[dbField];
      // Keep both for compatibility unless specifically removing
    }
  });
  
  // Calculate age if missing but dateOfBirth exists
  if (!dto.age && !dto.ageInYears && dto.dateOfBirth) {
    const calculatedAge = calculateAge(dto.dateOfBirth);
    dto.age = calculatedAge;
    dto.ageInYears = calculatedAge;
  }
  
  // Handle vessel field mapping - prefer old 'vessel' field if 'presentVessel' is empty
  if (!dto.vessel && dto.presentVessel) {
    dto.vessel = dto.presentVessel;
  } else if (!dto.presentVessel && dto.vessel) {
    dto.presentVessel = dto.vessel;
  }
  
  // Handle rank field mapping - prefer 'presentRank' if available
  if (!dto.rank && dto.presentRank) {
    dto.rank = dto.presentRank;
  } else if (!dto.presentRank && dto.rank) {
    dto.presentRank = dto.rank;
  }
  
  // Parse JSON fields
  JSON_FIELDS.forEach(field => {
    if (dto[field] && typeof dto[field] === 'string') {
      try {
        dto[field] = JSON.parse(dto[field]);
      } catch (e) {
        console.warn(`Failed to parse JSON field ${field}:`, e);
        dto[field] = null;
      }
    }
  });
  
  return dto as CrewMemberDTO;
}

/**
 * Convert frontend DTO to database CrewMember format
 * Creates a clean object with only database field names to avoid validation issues
 */
export function toStorageCrew(dto: Partial<CrewMemberDTO>): Partial<CrewMember> {
  const dbData: any = {};
  
  // Copy all fields that don't need mapping first
  Object.keys(dto).forEach(key => {
    if (!Object.keys(FIELD_MAPPINGS).includes(key)) {
      // Special handling for vesselType array
      if (key === 'vesselType' && Array.isArray((dto as any)[key])) {
        dbData[key] = (dto as any)[key][0] || '';
      } else {
        dbData[key] = (dto as any)[key];
      }
    }
  });
  
  // Apply field mappings (Frontend -> DB) - replace frontend names with DB names
  Object.entries(FIELD_MAPPINGS).forEach(([frontendField, dbField]) => {
    if (frontendField in dto) {
      dbData[dbField] = (dto as any)[frontendField];
      // Remove the frontend field name to avoid duplicates
      delete dbData[frontendField];
    }
  });
  
  // Stringify JSON fields
  JSON_FIELDS.forEach(field => {
    if (dbData[field] && typeof dbData[field] === 'object') {
      try {
        dbData[field] = JSON.stringify(dbData[field]);
      } catch (e) {
        console.warn(`Failed to stringify JSON field ${field}:`, e);
        dbData[field] = null;
      }
    }
  });
  
  return dbData as Partial<CrewMember>;
}

/**
 * Normalize field names for frontend consumption
 * Handles cases where table expects specific field names
 */
export function normalizeCrewMemberForTable(crew: CrewMember): CrewMemberDTO {
  const normalized = fromStorageCrew(crew);
  
  // Ensure table-expected fields are available (match table column field names)
  normalized.dob = normalized.dob || normalized.dateOfBirth;
  normalized.age = normalized.age || normalized.ageInYears;  // Table expects 'age'
  
  // Handle rank fields - use original DB data directly if normalized fields are missing
  if (!normalized.presentRank) {
    normalized.presentRank = normalized.rank || (crew as any).rank || (crew as any).presentRank;
  }
  
  // Handle family name fields - use original DB data directly if normalized fields are missing
  if (!normalized.familyName) {
    normalized.familyName = normalized.lastName || (crew as any).lastName || (crew as any).familyName;
  }
  
  normalized.vessel = normalized.vessel || normalized.presentVessel;
  
  // Calculate sea service period from joining date
  (normalized as any).seaServicePeriod = calculateSeaServicePeriod(normalized.joiningDate);
  
  return normalized;
}

/**
 * Map form data to storage format
 * Handles the comprehensive form data from CrewInfoForm
 */
export function mapFormDataToStorage(formData: any): Partial<InsertCrewMember> {
  const mapped: any = {
    // Map form field names to database field names
    empNo: formData.employeeId || null,
    firstName: formData.firstName || '',
    middleName: formData.middleName || null,
    familyName: formData.familyName || null,
    dateOfBirth: formData.dateOfBirth || null,
    age: formData.ageInYears || null,
    nationality: formData.nationality || '',
    presentRank: formData.presentRank || undefined,
    rankAppliedFor: formData.rankAppliedFor || null,
    employeeId: formData.employeeId || null,
    presentVessel: formData.presentVessel || undefined,
    vesselType: Array.isArray(formData.vesselType) 
      ? formData.vesselType[0] || undefined 
      : formData.vesselType || undefined,
    lastVessel: formData.lastVessel || undefined,
    status: formData.status || 'Active',
    joiningDate: formData.joiningDate || undefined,
    signOnDate: formData.signOnDate || formData.joiningDate || undefined,
    signOffDate: formData.signOffDate || undefined,
    contractPeriod: formData.contractPeriod || undefined,
    reliefDue: formData.reliefDue || undefined,
    reason: formData.reason || undefined,
    availability: formData.availability || 'Available',
    email: formData.email || null,
    mobile: formData.mobile || null,
    contactLandline: formData.contactLandline || null,
    countryOfResidence: formData.countryOfResidence || null,
    nearestAirport: formData.nearestAirport || null,
    residentialAddressLine1: formData.residentialAddressLine1 || null,
    residentialAddressLine2: formData.residentialAddressLine2 || null,
    placeOfBirthCity: formData.placeOfBirthCity || null,
    placeOfBirthCountry: formData.placeOfBirthCountry || null,
    heightCm: formData.heightCm || null,
    weightKg: formData.weightKg || null,
    bmi: formData.bmi || null,
    nativeLanguage: formData.nativeLanguage || null,
    foreignLanguages: formData.foreignLanguages || null,
    englishProficiency: formData.englishProficiency || null,
    maritalStatus: formData.maritalStatus || null,
    numberOfDependentChildren: formData.numberOfDependentChildren || null,
    fatherName: formData.fatherName || null,
    motherName: formData.motherName || null,
    spouseFirstName: formData.spouseFirstName || null,
    spouseMiddleName: formData.spouseMiddleName || null,
    spouseFamilyName: formData.spouseFamilyName || null,
    spouseDateOfBirth: formData.spouseDateOfBirth || null,
    nokFirstName: formData.nokFirstName || null,
    nokMiddleName: formData.nokMiddleName || null,
    nokFamilyName: formData.nokFamilyName || null,
    nokTelephone: formData.nokTelephone || null,
    nokEmail: formData.nokEmail || null,
    nokAddress: formData.nokAddress || null,
    nokRelationship: formData.nokRelationship || null,
    manningAgent: formData.manningAgent || null,
    
    // JSON fields - stringify arrays and objects
    vesselTypes: formData.vesselType ? JSON.stringify(formData.vesselType) : null,
    documents: formData.documents ? JSON.stringify(formData.documents) : null,
    visas: formData.visas ? JSON.stringify(formData.visas) : null,
    education: formData.education ? JSON.stringify(formData.education) : null,
    licenses: formData.licenses ? JSON.stringify(formData.licenses) : null,
    trainingCourses: formData.trainingCourses ? JSON.stringify(formData.trainingCourses) : null,
    currentCompanySeaService: formData.currentCompanySeaService ? JSON.stringify(formData.currentCompanySeaService) : null,
    externalSeaService: formData.externalSeaService ? JSON.stringify(formData.externalSeaService) : null,
    preJoiningMedicals: formData.preJoiningMedicals ? JSON.stringify(formData.preJoiningMedicals) : null,
    doctorVisits: formData.doctorVisits ? JSON.stringify(formData.doctorVisits) : null,
    children: formData.children ? JSON.stringify(formData.children) : null,
  };
  
  return mapped;
}