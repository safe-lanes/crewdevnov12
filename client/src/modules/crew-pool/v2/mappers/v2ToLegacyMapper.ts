export interface LegacyCrewMember {
  id?: string;
  crewUuid?: string;
  empNo: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dob: string;
  age: string;
  nationality: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  reason: string;
  isActive: boolean;
  uploadedPhoto: string;
  presentVessel: string;
  signOnDate: string;
  reliefDue: string;
  nextAvailability: string;
  contractPeriodMonths: string;
}

function calculateAge(dob: string): string {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
}

export function mapV2CrewToLegacy(v2Crew: any): LegacyCrewMember {
  const dob = v2Crew.dob || '';
  return {
    id: v2Crew.id?.toString() || v2Crew.crewUuid,
    crewUuid: v2Crew.crewUuid,
    empNo: v2Crew.empNo || '',
    employeeId: v2Crew.employeeId || '',
    firstName: v2Crew.firstName || '',
    middleName: v2Crew.middleName || '',
    familyName: v2Crew.familyName || '',
    gender: v2Crew.gender || '',
    dob,
    age: calculateAge(dob),
    nationality: v2Crew.nationalityUuid || v2Crew.nationality || '',
    presentRank: v2Crew.presentRank || '',
    rankAppliedFor: v2Crew.rankAppliedFor || '',
    status: v2Crew.status || 'active',
    reason: v2Crew.reason || '',
    isActive: v2Crew.isActive ?? true,
    uploadedPhoto: v2Crew.uploadedPhoto || '',
    presentVessel: v2Crew.presentVessel || '',
    signOnDate: v2Crew.signOnDate || '',
    reliefDue: v2Crew.reliefDue || '',
    nextAvailability: v2Crew.nextAvailability || '',
    contractPeriodMonths: v2Crew.contractPeriodMonths || '',
  };
}

export function mapLegacyCrewToV2(legacy: Partial<LegacyCrewMember> & { dateOfBirth?: string }): any {
  // V2 schema only accepts these core crew fields
  // Vessel assignment fields (presentVessel, signOnDate, reliefDue, etc.) 
  // are managed via crew_assignments table, not on the crew record
  const empNo = legacy.empNo || legacy.employeeId || undefined;
  
  return {
    empNo,
    employeeId: legacy.employeeId || undefined,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    gender: legacy.gender || undefined,
    dob: legacy.dob || legacy.dateOfBirth || undefined,
    nationalityUuid: legacy.nationality || undefined,
    presentRank: legacy.presentRank || undefined,
    rankAppliedFor: legacy.rankAppliedFor || undefined,
    status: legacy.status || 'active',
    reason: legacy.reason || undefined,
    isActive: legacy.isActive ?? true,
    uploadedPhoto: legacy.uploadedPhoto || undefined,
  };
}

export interface LegacyPersonalDetails {
  height: string;
  weight: string;
  bmi: string;
  ageInYears: string;
  placeOfBirthCity: string;
  placeOfBirthCountry: string;
  nativeLanguage: string;
  foreignLanguages: string;
  englishProficiency: string;
  manningAgent: string;
  crewPool: string;
  availability: string;
  nextAvailability: string;
}

export function mapV2PersonalDetailsToLegacy(v2: any): LegacyPersonalDetails {
  return {
    height: v2?.heightCm || '',
    weight: v2?.weightKg || '',
    bmi: v2?.bmi || '',
    ageInYears: v2?.ageInYears || '',
    placeOfBirthCity: v2?.placeOfBirthCity || '',
    placeOfBirthCountry: v2?.placeOfBirthCountryUuid || v2?.placeOfBirthCountry || '',
    nativeLanguage: v2?.nativeLanguageUuid || v2?.nativeLanguage || '',
    foreignLanguages: v2?.foreignLanguages || '',
    englishProficiency: v2?.englishProficiency || '',
    manningAgent: v2?.manningAgent || v2?.manningAgentUuid || '',
    crewPool: v2?.crewPool || v2?.crewPoolUuid || '',
    availability: v2?.availability || '',
    nextAvailability: v2?.nextAvailability || '',
  };
}

export function mapLegacyPersonalDetailsToV2(legacy: Partial<LegacyPersonalDetails>): any {
  return {
    heightCm: legacy.height || undefined,
    weightKg: legacy.weight || undefined,
    bmi: legacy.bmi || undefined,
    ageInYears: legacy.ageInYears || undefined,
    placeOfBirthCity: legacy.placeOfBirthCity || undefined,
    placeOfBirthCountryUuid: legacy.placeOfBirthCountry || undefined,
    nativeLanguageUuid: legacy.nativeLanguage || undefined,
    foreignLanguages: legacy.foreignLanguages || undefined,
    englishProficiency: legacy.englishProficiency || undefined,
    manningAgent: legacy.manningAgent || undefined,
    crewPool: legacy.crewPool || undefined,
    availability: legacy.availability || undefined,
    nextAvailability: legacy.nextAvailability || undefined,
  };
}

export interface LegacyAddress {
  countryOfResidence: string;
  nearestAirport: string;
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  contactLandline: string;
  mobile: string;
  email: string;
}

export function mapV2AddressToLegacy(v2: any): LegacyAddress {
  return {
    countryOfResidence: v2?.countryOfResidenceUuid || '',
    nearestAirport: v2?.nearestAirport || '',
    residentialAddressLine1: v2?.addressLine1 || '',
    residentialAddressLine2: v2?.addressLine2 || '',
    contactLandline: v2?.contactLandline || '',
    mobile: v2?.mobile || '',
    email: v2?.email || '',
  };
}

export function mapLegacyAddressToV2(legacy: Partial<LegacyAddress>): any {
  return {
    countryOfResidenceUuid: legacy.countryOfResidence || undefined,
    nearestAirport: legacy.nearestAirport || undefined,
    addressLine1: legacy.residentialAddressLine1 || undefined,
    addressLine2: legacy.residentialAddressLine2 || undefined,
    contactLandline: legacy.contactLandline || undefined,
    mobile: legacy.mobile || undefined,
    email: legacy.email || undefined,
  };
}

export interface LegacyFamilyInfo {
  maritalStatus: string;
  numberOfDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDateOfBirth: string;
}

export function mapV2FamilyInfoToLegacy(v2: any): LegacyFamilyInfo {
  return {
    maritalStatus: v2?.maritalStatus || '',
    numberOfDependentChildren: v2?.numDependentChildren?.toString() || '',
    fatherName: v2?.fatherName || '',
    motherName: v2?.motherName || '',
    spouseFirstName: v2?.spouseFirstName || '',
    spouseMiddleName: v2?.spouseMiddleName || '',
    spouseFamilyName: v2?.spouseFamilyName || '',
    spouseDateOfBirth: v2?.spouseDob || '',
  };
}

export function mapLegacyFamilyInfoToV2(legacy: Partial<LegacyFamilyInfo>): any {
  return {
    maritalStatus: legacy.maritalStatus || undefined,
    numDependentChildren: legacy.numberOfDependentChildren || undefined,
    fatherName: legacy.fatherName || undefined,
    motherName: legacy.motherName || undefined,
    spouseFirstName: legacy.spouseFirstName || undefined,
    spouseMiddleName: legacy.spouseMiddleName || undefined,
    spouseFamilyName: legacy.spouseFamilyName || undefined,
    spouseDob: legacy.spouseDateOfBirth || undefined,
  };
}

export interface LegacyChild {
  childUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dateOfBirth: string;
  gender: string;
}

export function mapV2ChildToLegacy(v2: any): LegacyChild {
  return {
    childUuid: v2?.childUuid,
    firstName: v2?.firstName || '',
    middleName: v2?.middleName || '',
    familyName: v2?.familyName || '',
    dateOfBirth: v2?.dob || '',
    gender: v2?.gender || '',
  };
}

export function mapLegacyChildToV2(legacy: LegacyChild): any {
  return {
    childUuid: legacy.childUuid,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    dob: legacy.dateOfBirth || undefined,
    gender: legacy.gender || undefined,
  };
}

export interface LegacyNextOfKin {
  nokUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  telephone: string;
  email: string;
  address: string;
  relationship: string;
}

export function mapV2NextOfKinToLegacy(v2: any): LegacyNextOfKin {
  return {
    nokUuid: v2?.nokUuid,
    firstName: v2?.firstName || '',
    middleName: v2?.middleName || '',
    familyName: v2?.familyName || '',
    telephone: v2?.telephone || '',
    email: v2?.email || '',
    address: v2?.address || '',
    relationship: v2?.relationship || '',
  };
}

export function mapLegacyNextOfKinToV2(legacy: LegacyNextOfKin): any {
  return {
    nokUuid: legacy.nokUuid,
    firstName: legacy.firstName || undefined,
    middleName: legacy.middleName || undefined,
    familyName: legacy.familyName || undefined,
    telephone: legacy.telephone || undefined,
    email: legacy.email || undefined,
    address: legacy.address || undefined,
    relationship: legacy.relationship || undefined,
  };
}

export interface LegacyAttachment {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  fileData?: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface LegacyDocument {
  docUuid?: string;
  documentId: string;
  documentName: string;
  documentNumber: string;
  issuedDate: string;
  expiryDate: string;
  issuingAuthority: string;
  issuingCountry: string;
  attachments: LegacyAttachment[];
}

export function mapV2DocumentToLegacy(v2: any): any {
  return {
    docUuid: v2?.docUuid,
    id: v2?.docUuid || `DOC-${Date.now()}`,
    documentId: v2?.documentId || '',
    document: v2?.documentName || v2?.documentId || '',
    number: v2?.number || v2?.documentNumber || '',
    issued: v2?.issued || v2?.issuedDate || '',
    expiry: v2?.expiry || v2?.expiryDate || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyDocumentToV2(legacy: any): any {
  return {
    docUuid: legacy.docUuid,
    documentId: legacy.documentId || undefined,
    documentName: legacy.documentName || legacy.document || undefined,
    number: legacy.documentNumber || legacy.number || undefined,
    issued: legacy.issuedDate || legacy.issued || undefined,
    expiry: legacy.expiryDate || legacy.expiry || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    attachments: (legacy.attachments || [])
      .filter((att: any) => att.isNew || att.isDeleted)
      .map((att: any) => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyVisa {
  visaUuid?: string;
  country: string;
  serialNo: string;
  issuedDate: string;
  expiryDate: string;
  visaType: string;
  attachments: LegacyAttachment[];
}

export function mapV2VisaToLegacy(v2: any): any {
  return {
    visaUuid: v2?.visaUuid,
    id: v2?.visaUuid || `VIS-${Date.now()}`,
    countryId: v2?.countryUuid || '',
    issuingCountry: v2?.countryUuid || '',
    serialNo: v2?.serialNo || '',
    serialNumber: v2?.serialNo || '',
    issued: v2?.issued || v2?.issuedDate || '',
    expiry: v2?.expiry || v2?.expiryDate || '',
    visaType: v2?.visaType || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyVisaToV2(legacy: any): any {
  return {
    visaUuid: legacy.visaUuid,
    countryUuid: legacy.country || legacy.countryId || undefined,
    serialNo: legacy.serialNo || legacy.serialNumber || undefined,
    issued: legacy.issuedDate || legacy.issued || undefined,
    expiry: legacy.expiryDate || legacy.expiry || undefined,
    visaType: legacy.visaType || undefined,
    attachments: (legacy.attachments || [])
      .filter((att: any) => att.isNew || att.isDeleted)
      .map((att: any) => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyEducation {
  id: string;
  eduUuid?: string;
  dateOfCompletion: string;
  schoolCollegeUniversity: string;
  subjectsField: string;
  qualifications: string;
  attachments: LegacyAttachment[];
}

export function mapV2EducationToLegacy(v2: any): LegacyEducation {
  return {
    id: v2?.eduUuid || `EDU-${Date.now()}`,
    eduUuid: v2?.eduUuid,
    dateOfCompletion: v2?.dateOfCompletion || '',
    schoolCollegeUniversity: v2?.institution || '',
    subjectsField: v2?.subjectsField || '',
    qualifications: v2?.qualifications || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyEducationToV2(legacy: LegacyEducation): any {
  return {
    eduUuid: legacy.eduUuid,
    dateOfCompletion: legacy.dateOfCompletion || undefined,
    institution: legacy.schoolCollegeUniversity || undefined,
    subjectsField: legacy.subjectsField || undefined,
    qualifications: legacy.qualifications || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyLicense {
  id: string;
  licUuid?: string;
  licenseId: string;
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountry?: string;
  issued: string;
  expiry: string;
  archivedAt?: string;
  attachments: LegacyAttachment[];
}

export function mapV2LicenseToLegacy(v2: any): LegacyLicense {
  return {
    id: v2?.licUuid || `LIC-${Date.now()}`,
    licUuid: v2?.licUuid,
    licenseId: v2?.licenseId || '',
    certificateDocument: v2?.certificateDocument || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    issued: v2?.issued || '',
    expiry: v2?.expiry || '',
    archivedAt: v2?.archivedAt || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyLicenseToV2(legacy: LegacyLicense): any {
  return {
    licUuid: legacy.licUuid,
    licenseId: legacy.licenseId || undefined,
    certificateDocument: legacy.certificateDocument || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    issued: legacy.issued || undefined,
    expiry: legacy.expiry || undefined,
    archivedAt: legacy.archivedAt || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyTrainingCourse {
  id: string;
  trainUuid?: string;
  courseId?: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountry?: string;
  issued: string;
  expiry: string;
  attachments: LegacyAttachment[];
}

export function mapV2TrainingCourseToLegacy(v2: any): LegacyTrainingCourse {
  return {
    id: v2?.trainUuid || `TRN-${Date.now()}`,
    trainUuid: v2?.trainUuid,
    courseId: v2?.courseId || '',
    trainingCourse: v2?.trainingCourse || '',
    abbr: v2?.abbr || '',
    requirement: v2?.requirement || '',
    certificateNo: v2?.certificateNo || '',
    issuingAuthority: v2?.issuingAuthority || '',
    issuingCountry: v2?.issuingCountryUuid || '',
    issued: v2?.issued || '',
    expiry: v2?.expiry || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyTrainingCourseToV2(legacy: LegacyTrainingCourse): any {
  return {
    trainUuid: legacy.trainUuid,
    courseId: legacy.courseId || undefined,
    trainingCourse: legacy.trainingCourse || undefined,
    abbr: legacy.abbr || undefined,
    requirement: legacy.requirement || undefined,
    certificateNo: legacy.certificateNo || undefined,
    issuingAuthority: legacy.issuingAuthority || undefined,
    issuingCountryUuid: legacy.issuingCountry || undefined,
    issued: legacy.issued || undefined,
    expiry: legacy.expiry || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacySeaService {
  seaUuid?: string;
  isCompanyService: boolean;
  vesselName: string;
  vesselCode: string;
  vesselType: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  periodMonths: string;
  experienceCategories: string[];
  attachments: LegacyAttachment[];
}

export function mapV2SeaServiceToLegacy(v2: any): LegacySeaService {
  return {
    seaUuid: v2?.seaUuid,
    isCompanyService: v2?.serviceType === 'company',
    vesselName: v2?.vesselName || '',
    vesselCode: v2?.vesselUuid || '',
    vesselType: v2?.vesselTypeUuid || '',
    deadweight: v2?.deadweight || '',
    engineTypePower: v2?.engineTypePower || '',
    ownerOperator: v2?.ownerOperator || '',
    rank: v2?.rank || '',
    from: v2?.fromDate || '',
    to: v2?.toDate || '',
    fromDate: v2?.fromDate || '',
    toDate: v2?.toDate || '',
    periodMonths: v2?.periodMonths?.toString() || '',
    experienceCategories: v2?.experienceCategories || [],
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacySeaServiceToV2(legacy: LegacySeaService): any {
  return {
    seaUuid: legacy.seaUuid,
    serviceType: legacy.isCompanyService ? 'company' : 'external',
    vesselName: legacy.vesselName || undefined,
    vesselUuid: legacy.vesselCode || undefined,
    vesselTypeUuid: legacy.vesselType || undefined,
    deadweight: legacy.deadweight || undefined,
    engineTypePower: legacy.engineTypePower || undefined,
    ownerOperator: legacy.ownerOperator || undefined,
    rank: legacy.rank || undefined,
    fromDate: legacy.fromDate || undefined,
    toDate: legacy.toDate || undefined,
    periodMonths: legacy.periodMonths ? parseInt(legacy.periodMonths) : undefined,
    experienceCategories: legacy.experienceCategories?.length ? legacy.experienceCategories : undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyPreJoiningMedical {
  medUuid?: string;
  vesselCode: string;
  vesselName: string;
  dateOfMedical: string;
  clinicHospital: string;
  fitnessForDuty: string;
  expiryDate: string;
  attachments: LegacyAttachment[];
}

export function mapV2PreJoiningMedicalToLegacy(v2: any): LegacyPreJoiningMedical {
  return {
    medUuid: v2?.medUuid,
    vesselCode: v2?.vesselUuid || '',
    vesselName: '',
    dateOfMedical: v2?.examinationDate || '',
    clinicHospital: v2?.clinicHospital || '',
    fitnessForDuty: v2?.fitForDuty || '',
    expiryDate: v2?.expiryDate || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyPreJoiningMedicalToV2(legacy: LegacyPreJoiningMedical): any {
  return {
    medUuid: legacy.medUuid,
    vesselUuid: legacy.vesselCode || undefined,
    examinationDate: legacy.dateOfMedical || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    fitForDuty: legacy.fitnessForDuty || undefined,
    expiryDate: legacy.expiryDate || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export interface LegacyDoctorVisit {
  visitUuid?: string;
  visitDate: string;
  doctorName: string;
  clinicHospital: string;
  complaint: string;
  diagnosis: string;
  treatment: string;
  followUpDate: string;
  attachments: LegacyAttachment[];
}

export function mapV2DoctorVisitToLegacy(v2: any): LegacyDoctorVisit {
  return {
    visitUuid: v2?.visitUuid,
    visitDate: v2?.visitDate || '',
    doctorName: v2?.doctorName || '',
    clinicHospital: v2?.clinicHospital || '',
    complaint: v2?.reason || '',
    diagnosis: v2?.diagnosis || '',
    treatment: v2?.treatment || '',
    followUpDate: v2?.followUpDate || '',
    attachments: (v2?.attachments || []).map((att: any) => ({
      attUuid: att.attUuid,
      fileName: att.fileName || '',
      fileType: att.fileType || '',
      fileSize: att.fileSize || '',
      filePath: att.filePath || '',
      fileData: att.fileData,
    })),
  };
}

export function mapLegacyDoctorVisitToV2(legacy: LegacyDoctorVisit): any {
  return {
    visitUuid: legacy.visitUuid,
    visitDate: legacy.visitDate || undefined,
    doctorName: legacy.doctorName || undefined,
    clinicHospital: legacy.clinicHospital || undefined,
    reason: legacy.complaint || undefined,
    diagnosis: legacy.diagnosis || undefined,
    treatment: legacy.treatment || undefined,
    followUpDate: legacy.followUpDate || undefined,
    attachments: legacy.attachments
      .filter(att => att.isNew || att.isDeleted)
      .map(att => ({
        attUuid: att.attUuid,
        fileName: att.fileName,
        fileData: att.fileData,
        isNew: att.isNew,
        isDeleted: att.isDeleted,
      })),
  };
}

export function mapV2FullProfileToLegacy(v2Profile: any): any {
  const crew = v2Profile.crew || v2Profile;
  const nok = v2Profile.nextOfKin ? mapV2NextOfKinToLegacy(v2Profile.nextOfKin) : null;
  return {
    ...mapV2CrewToLegacy(crew),
    ...mapV2PersonalDetailsToLegacy(v2Profile.personalDetails),
    ...mapV2AddressToLegacy(v2Profile.address),
    ...mapV2FamilyInfoToLegacy(v2Profile.familyInfo),
    children: (v2Profile.children || []).map(mapV2ChildToLegacy),
    nextOfKin: nok,
    nokFirstName: nok?.firstName || '',
    nokMiddleName: nok?.middleName || '',
    nokFamilyName: nok?.familyName || '',
    nokTelephone: nok?.telephone || '',
    nokEmail: nok?.email || '',
    nokAddress: nok?.address || '',
    nokRelationship: nok?.relationship || '',
    documents: (v2Profile.documents || []).map(mapV2DocumentToLegacy),
    visas: (v2Profile.visas || []).map(mapV2VisaToLegacy),
    education: (v2Profile.education || []).map(mapV2EducationToLegacy),
    licenses: (v2Profile.licenses || []).map(mapV2LicenseToLegacy),
    trainingCourses: (v2Profile.trainingCourses || []).map(mapV2TrainingCourseToLegacy),
    currentCompanySeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'company')
      .map(mapV2SeaServiceToLegacy),
    externalSeaService: (v2Profile.seaService || [])
      .filter((s: any) => s.serviceType === 'external')
      .map(mapV2SeaServiceToLegacy),
    preJoiningMedicals: (v2Profile.medicals || []).map(mapV2PreJoiningMedicalToLegacy),
    doctorVisits: (v2Profile.doctorVisits || []).map(mapV2DoctorVisitToLegacy),
    vesselTypesApplied: (v2Profile.vesselTypes || []).map((vt: any) => vt.vesselTypeUuid),
  };
}
