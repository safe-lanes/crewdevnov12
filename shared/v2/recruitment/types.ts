import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  recruitmentCandidatesV2,
  candVesselTypesApplied,
  candPersonalDetails,
  candAddresses,
  candFamilyInfo,
  candChildren,
  candNextOfKin,
  candTravelDocuments,
  candVisas,
  candCoc,
  candCop,
  candStcwCertificates,
  candFlagEndorsements,
  candMedicalCertificates,
  candVaccinations,
  candTrainingCertificates,
  candEducation,
  candSeaServiceInternal,
  candSeaServiceExternal,
  candLicenses,
  candDocumentAttachments,
} from "./schema";

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertCandidateV2Schema = createInsertSchema(recruitmentCandidatesV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVesselTypesAppliedSchema = createInsertSchema(candVesselTypesApplied).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonalDetailsSchema = createInsertSchema(candPersonalDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressSchema = createInsertSchema(candAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyInfoSchema = createInsertSchema(candFamilyInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChildSchema = createInsertSchema(candChildren).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNextOfKinSchema = createInsertSchema(candNextOfKin).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Phase 2: Documents & Certificates Insert Schemas
export const insertTravelDocumentSchema = createInsertSchema(candTravelDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVisaSchema = createInsertSchema(candVisas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCocSchema = createInsertSchema(candCoc).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCopSchema = createInsertSchema(candCop).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStcwCertificateSchema = createInsertSchema(candStcwCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFlagEndorsementSchema = createInsertSchema(candFlagEndorsements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMedicalCertificateSchema = createInsertSchema(candMedicalCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVaccinationSchema = createInsertSchema(candVaccinations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingCertificateSchema = createInsertSchema(candTrainingCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationSchema = createInsertSchema(candEducation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeaServiceInternalSchema = createInsertSchema(candSeaServiceInternal).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeaServiceExternalSchema = createInsertSchema(candSeaServiceExternal).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseSchema = createInsertSchema(candLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentAttachmentSchema = createInsertSchema(candDocumentAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// INSERT TYPES
// ============================================================================

export type InsertCandidateV2 = z.infer<typeof insertCandidateV2Schema>;
export type InsertVesselTypesApplied = z.infer<typeof insertVesselTypesAppliedSchema>;
export type InsertPersonalDetails = z.infer<typeof insertPersonalDetailsSchema>;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type InsertFamilyInfo = z.infer<typeof insertFamilyInfoSchema>;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type InsertNextOfKin = z.infer<typeof insertNextOfKinSchema>;

// Phase 2: Documents & Certificates Insert Types
export type InsertTravelDocument = z.infer<typeof insertTravelDocumentSchema>;
export type InsertVisa = z.infer<typeof insertVisaSchema>;
export type InsertCoc = z.infer<typeof insertCocSchema>;
export type InsertCop = z.infer<typeof insertCopSchema>;
export type InsertStcwCertificate = z.infer<typeof insertStcwCertificateSchema>;
export type InsertFlagEndorsement = z.infer<typeof insertFlagEndorsementSchema>;
export type InsertMedicalCertificate = z.infer<typeof insertMedicalCertificateSchema>;
export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;
export type InsertTrainingCertificate = z.infer<typeof insertTrainingCertificateSchema>;
export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type InsertSeaServiceInternal = z.infer<typeof insertSeaServiceInternalSchema>;
export type InsertSeaServiceExternal = z.infer<typeof insertSeaServiceExternalSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type InsertDocumentAttachment = z.infer<typeof insertDocumentAttachmentSchema>;

// ============================================================================
// SELECT TYPES
// ============================================================================

export type CandidateV2 = typeof recruitmentCandidatesV2.$inferSelect;
export type VesselTypesApplied = typeof candVesselTypesApplied.$inferSelect;
export type PersonalDetails = typeof candPersonalDetails.$inferSelect;
export type Address = typeof candAddresses.$inferSelect;
export type FamilyInfo = typeof candFamilyInfo.$inferSelect;
export type Child = typeof candChildren.$inferSelect;
export type NextOfKin = typeof candNextOfKin.$inferSelect;

// Phase 2: Documents & Certificates Select Types
export type TravelDocument = typeof candTravelDocuments.$inferSelect;
export type Visa = typeof candVisas.$inferSelect;
export type Coc = typeof candCoc.$inferSelect;
export type Cop = typeof candCop.$inferSelect;
export type StcwCertificate = typeof candStcwCertificates.$inferSelect;
export type FlagEndorsement = typeof candFlagEndorsements.$inferSelect;
export type MedicalCertificate = typeof candMedicalCertificates.$inferSelect;
export type Vaccination = typeof candVaccinations.$inferSelect;
export type TrainingCertificate = typeof candTrainingCertificates.$inferSelect;
export type Education = typeof candEducation.$inferSelect;
export type SeaServiceInternal = typeof candSeaServiceInternal.$inferSelect;
export type SeaServiceExternal = typeof candSeaServiceExternal.$inferSelect;
export type License = typeof candLicenses.$inferSelect;
export type DocumentAttachment = typeof candDocumentAttachments.$inferSelect;

// ============================================================================
// API REQUEST/RESPONSE DTOs
// ============================================================================

export const createCandidateRequestSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
  nationalityUuid: z.string().optional(),
  presentRank: z.string().optional(),
  rankAppliedFor: z.string().optional(),
  status: z.string().optional(),
});

export const updateCandidateRequestSchema = createCandidateRequestSchema.partial();

export const upsertPersonalDetailsRequestSchema = z.object({
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  placeOfBirthCity: z.string().optional(),
  placeOfBirthCountryUuid: z.string().optional(),
  ageInYears: z.string().optional(),
  nativeLanguageUuid: z.string().optional(),
  foreignLanguages: z.string().optional(),
  englishProficiency: z.string().optional(),
  manningAgent: z.string().optional(),
});

export const upsertAddressRequestSchema = z.object({
  countryOfResidenceUuid: z.string().optional(),
  nearestAirport: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  contactLandline: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
});

export const upsertFamilyInfoRequestSchema = z.object({
  maritalStatus: z.string().optional(),
  numDependentChildren: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseFirstName: z.string().optional(),
  spouseMiddleName: z.string().optional(),
  spouseFamilyName: z.string().optional(),
  spouseDob: z.string().optional(),
});

export const createChildRequestSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const updateChildRequestSchema = createChildRequestSchema.partial();

export const createNextOfKinRequestSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  familyName: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  relationship: z.string().optional(),
});

export const updateNextOfKinRequestSchema = createNextOfKinRequestSchema.partial();

export const addVesselTypeAppliedRequestSchema = z.object({
  vesselTypeUuid: z.string(),
  sortOrder: z.number().optional(),
});

// ============================================================================
// PHASE 2: DOCUMENTS & CERTIFICATES REQUEST SCHEMAS
// ============================================================================

export const createTravelDocumentRequestSchema = z.object({
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  placeOfIssue: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createVisaRequestSchema = z.object({
  visaType: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  serialNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  multipleEntry: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const createCocRequestSchema = z.object({
  certificateType: z.string().optional(),
  grade: z.string().optional(),
  limitation: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createCopRequestSchema = z.object({
  certificateName: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createStcwCertificateRequestSchema = z.object({
  stcwCode: z.string().optional(),
  certificateName: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createFlagEndorsementRequestSchema = z.object({
  flagStateUuid: z.string().optional(),
  endorsementType: z.string().optional(),
  certificateNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createMedicalCertificateRequestSchema = z.object({
  certificateType: z.string().optional(),
  certificateNumber: z.string().optional(),
  clinicName: z.string().optional(),
  clinicLocation: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  fitnessStatus: z.string().optional(),
  restrictions: z.string().optional(),
  bloodType: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createVaccinationRequestSchema = z.object({
  vaccineName: z.string().optional(),
  vaccineType: z.string().optional(),
  dateAdministered: z.string().optional(),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  administeredBy: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createTrainingCertificateRequestSchema = z.object({
  courseName: z.string().optional(),
  courseCode: z.string().optional(),
  certificateNumber: z.string().optional(),
  trainingCenter: z.string().optional(),
  trainingLocation: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createEducationRequestSchema = z.object({
  institutionName: z.string().optional(),
  qualification: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  completionDate: z.string().optional(),
  grade: z.string().optional(),
  countryUuid: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createSeaServiceInternalRequestSchema = z.object({
  vesselName: z.string().optional(),
  vesselTypeUuid: z.string().optional(),
  imoNumber: z.string().optional(),
  grossTonnage: z.string().optional(),
  enginePower: z.string().optional(),
  rank: z.string().optional(),
  signOnDate: z.string().optional(),
  signOffDate: z.string().optional(),
  durationMonths: z.string().optional(),
  flagStateUuid: z.string().optional(),
  tradingArea: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createSeaServiceExternalRequestSchema = z.object({
  companyName: z.string().optional(),
  vesselName: z.string().optional(),
  vesselTypeUuid: z.string().optional(),
  imoNumber: z.string().optional(),
  grossTonnage: z.string().optional(),
  enginePower: z.string().optional(),
  rank: z.string().optional(),
  signOnDate: z.string().optional(),
  signOffDate: z.string().optional(),
  durationMonths: z.string().optional(),
  flagStateUuid: z.string().optional(),
  tradingArea: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createLicenseRequestSchema = z.object({
  licenseType: z.string().optional(),
  licenseName: z.string().optional(),
  licenseNumber: z.string().optional(),
  issuingCountryUuid: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createDocumentAttachmentRequestSchema = z.object({
  parentTableName: z.string().optional(),
  parentRecordUuid: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
  filePath: z.string().optional(),
  sortOrder: z.number().optional(),
});

// ============================================================================
// PHASE 3: SCREENING B1-B8 SCHEMAS (29 tables)
// ============================================================================

// B1: GENERAL SCREENING
export const createScreeningGeneralInfoRequestSchema = z.object({
  availabilityDate: z.string().optional(),
  noticePeriodDays: z.number().optional(),
  expectedSalaryUsd: z.string().optional(),
  contractDurationPreference: z.string().optional(),
  willingToRelocate: z.boolean().optional(),
  preferredVesselTypes: z.string().optional(),
  preferredTradingAreas: z.string().optional(),
  reasonForLeaving: z.string().optional(),
  careerObjectives: z.string().optional(),
});

export const createScreeningAvailabilityRequestSchema = z.object({
  availableFromDate: z.string().optional(),
  availableToDate: z.string().optional(),
  availabilityType: z.string().optional(),
  remarks: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningSalaryHistoryRequestSchema = z.object({
  employerName: z.string().optional(),
  position: z.string().optional(),
  salaryAmountUsd: z.string().optional(),
  currency: z.string().optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningDocumentsChecklistRequestSchema = z.object({
  passportVerified: z.boolean().optional(),
  seamanBookVerified: z.boolean().optional(),
  cocVerified: z.boolean().optional(),
  stcwVerified: z.boolean().optional(),
  medicalVerified: z.boolean().optional(),
  flagEndorsementVerified: z.boolean().optional(),
  visaVerified: z.boolean().optional(),
  remarks: z.string().optional(),
});

// B2: SKILLS ASSESSMENT
export const createScreeningTechnicalSkillsRequestSchema = z.object({
  skillCategory: z.string().optional(),
  skillName: z.string().optional(),
  proficiencyLevel: z.string().optional(),
  yearsExperience: z.number().optional(),
  lastUsedDate: z.string().optional(),
  certificationUuid: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningCompetencyRatingsRequestSchema = z.object({
  competencyArea: z.string().optional(),
  competencyName: z.string().optional(),
  rating: z.number().optional(),
  ratingDescription: z.string().optional(),
  evidenceNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningEquipmentExperienceRequestSchema = z.object({
  equipmentCategory: z.string().optional(),
  equipmentType: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  experienceLevel: z.string().optional(),
  yearsExperience: z.number().optional(),
  lastUsedDate: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningLanguageProficiencyRequestSchema = z.object({
  languageUuid: z.string().optional(),
  languageName: z.string().optional(),
  speakingLevel: z.string().optional(),
  readingLevel: z.string().optional(),
  writingLevel: z.string().optional(),
  listeningLevel: z.string().optional(),
  testName: z.string().optional(),
  testScore: z.string().optional(),
  testDate: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningPracticalTestsRequestSchema = z.object({
  testCategory: z.string().optional(),
  testName: z.string().optional(),
  testDescription: z.string().optional(),
  testDate: z.string().optional(),
  testLocation: z.string().optional(),
  maxScore: z.number().optional(),
  achievedScore: z.number().optional(),
  passScore: z.number().optional(),
  result: z.string().optional(),
  assessorUuid: z.string().optional(),
  assessorNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B3: INTERVIEW ASSESSMENT
export const createScreeningInterviewsRequestSchema = z.object({
  interviewType: z.string().optional(),
  interviewStage: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  duration: z.number().optional(),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  status: z.string().optional(),
  overallRating: z.number().optional(),
  recommendation: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningInterviewPanelistsRequestSchema = z.object({
  interviewUuid: z.string().optional(),
  panelistUserUuid: z.string().optional(),
  panelistName: z.string().optional(),
  panelistRole: z.string().optional(),
  individualRating: z.number().optional(),
  feedback: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningInterviewQuestionsRequestSchema = z.object({
  interviewUuid: z.string().optional(),
  questionCategory: z.string().optional(),
  questionText: z.string().optional(),
  expectedAnswer: z.string().optional(),
  candidateResponse: z.string().optional(),
  rating: z.number().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningInterviewNotesRequestSchema = z.object({
  interviewUuid: z.string().optional(),
  noteType: z.string().optional(),
  noteContent: z.string().optional(),
  authorUuid: z.string().optional(),
  authorName: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B4: REFERENCE CHECKS
export const createScreeningEmployerReferencesRequestSchema = z.object({
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  contactPosition: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  relationshipToCandidate: z.string().optional(),
  employmentPeriodFrom: z.string().optional(),
  employmentPeriodTo: z.string().optional(),
  positionHeld: z.string().optional(),
  referenceStatus: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningReferenceResponsesRequestSchema = z.object({
  empRefUuid: z.string().optional(),
  questionText: z.string().optional(),
  responseText: z.string().optional(),
  rating: z.number().optional(),
  contactedDate: z.string().optional(),
  contactedByUuid: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningPersonalReferencesRequestSchema = z.object({
  referenceName: z.string().optional(),
  relationship: z.string().optional(),
  occupation: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  yearsKnown: z.number().optional(),
  referenceStatus: z.string().optional(),
  referenceNotes: z.string().optional(),
  contactedDate: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningSeaServiceVerificationRequestSchema = z.object({
  seaServiceUuid: z.string().optional(),
  seaServiceType: z.string().optional(),
  verificationStatus: z.string().optional(),
  companyContactName: z.string().optional(),
  companyContactEmail: z.string().optional(),
  discrepancyNotes: z.string().optional(),
  verificationNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B5: BACKGROUND VERIFICATION
export const createScreeningBackgroundChecksRequestSchema = z.object({
  overallStatus: z.string().optional(),
  initiatedDate: z.string().optional(),
  completedDate: z.string().optional(),
  vendorName: z.string().optional(),
  vendorReferenceNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  remarks: z.string().optional(),
});

export const createScreeningCriminalRecordsRequestSchema = z.object({
  countryUuid: z.string().optional(),
  countryName: z.string().optional(),
  checkType: z.string().optional(),
  checkDate: z.string().optional(),
  result: z.string().optional(),
  recordDetails: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  expiryDate: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningEmploymentVerificationRequestSchema = z.object({
  employerName: z.string().optional(),
  positionClaimed: z.string().optional(),
  positionVerified: z.string().optional(),
  periodClaimedFrom: z.string().optional(),
  periodClaimedTo: z.string().optional(),
  periodVerifiedFrom: z.string().optional(),
  periodVerifiedTo: z.string().optional(),
  salaryVerified: z.boolean().optional(),
  verificationStatus: z.string().optional(),
  discrepancyNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningEducationVerificationRequestSchema = z.object({
  educationUuid: z.string().optional(),
  institutionName: z.string().optional(),
  degreeClaimed: z.string().optional(),
  degreeVerified: z.string().optional(),
  yearClaimedFrom: z.string().optional(),
  yearClaimedTo: z.string().optional(),
  yearVerifiedFrom: z.string().optional(),
  yearVerifiedTo: z.string().optional(),
  verificationStatus: z.string().optional(),
  discrepancyNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B6: PSYCHOLOGICAL ASSESSMENT
export const createScreeningPsychometricTestsRequestSchema = z.object({
  testName: z.string().optional(),
  testType: z.string().optional(),
  testProvider: z.string().optional(),
  testDate: z.string().optional(),
  expiryDate: z.string().optional(),
  overallScore: z.string().optional(),
  percentile: z.number().optional(),
  result: z.string().optional(),
  remarks: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningPsychometricDimensionsRequestSchema = z.object({
  psychTestUuid: z.string().optional(),
  dimensionName: z.string().optional(),
  dimensionScore: z.string().optional(),
  percentile: z.number().optional(),
  normalRange: z.string().optional(),
  interpretation: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningBehavioralAssessmentsRequestSchema = z.object({
  assessmentType: z.string().optional(),
  assessmentDate: z.string().optional(),
  assessorUuid: z.string().optional(),
  assessorName: z.string().optional(),
  primaryStyle: z.string().optional(),
  secondaryStyle: z.string().optional(),
  strengthsIdentified: z.string().optional(),
  areasOfDevelopment: z.string().optional(),
  teamFitScore: z.number().optional(),
  leadershipPotential: z.string().optional(),
  overallNotes: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B7: MEDICAL SCREENING
export const createScreeningPemeRequestSchema = z.object({
  examDate: z.string().optional(),
  clinicName: z.string().optional(),
  clinicLocation: z.string().optional(),
  examType: z.string().optional(),
  overallResult: z.string().optional(),
  restrictions: z.string().optional(),
  validUntil: z.string().optional(),
  examinerName: z.string().optional(),
  examinerLicense: z.string().optional(),
  certificateNumber: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningPemeResultsRequestSchema = z.object({
  pemeUuid: z.string().optional(),
  testCategory: z.string().optional(),
  testName: z.string().optional(),
  testResult: z.string().optional(),
  normalRange: z.string().optional(),
  status: z.string().optional(),
  remarks: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const createScreeningDrugAlcoholTestsRequestSchema = z.object({
  testType: z.string().optional(),
  testDate: z.string().optional(),
  testLocation: z.string().optional(),
  collectorName: z.string().optional(),
  specimenType: z.string().optional(),
  chainOfCustodyNumber: z.string().optional(),
  laboratoryName: z.string().optional(),
  result: z.string().optional(),
  substancesTestedFor: z.string().optional(),
  substancesDetected: z.string().optional(),
  confirmedByMro: z.boolean().optional(),
  mroName: z.string().optional(),
  sortOrder: z.number().optional(),
});

// B8: FINAL EVALUATION
export const createScreeningFinalEvaluationRequestSchema = z.object({
  evaluationDate: z.string().optional(),
  evaluatorUuid: z.string().optional(),
  evaluatorName: z.string().optional(),
  technicalScore: z.number().optional(),
  interviewScore: z.number().optional(),
  referenceScore: z.number().optional(),
  backgroundScore: z.number().optional(),
  medicalScore: z.number().optional(),
  overallScore: z.number().optional(),
  overallRating: z.string().optional(),
  hiringRecommendation: z.string().optional(),
  recommendedRank: z.string().optional(),
  recommendedVesselType: z.string().optional(),
  startDateRecommended: z.string().optional(),
  salaryRecommended: z.string().optional(),
  conditionsForHire: z.string().optional(),
  evaluationNotes: z.string().optional(),
});

export const createScreeningEvaluationApprovalsRequestSchema = z.object({
  finalEvalUuid: z.string().optional(),
  approvalLevel: z.number().optional(),
  approverUuid: z.string().optional(),
  approverName: z.string().optional(),
  approverRole: z.string().optional(),
  approvalStatus: z.string().optional(),
  approvalDate: z.string().optional(),
  comments: z.string().optional(),
  sortOrder: z.number().optional(),
});

// ============================================================================
// REQUEST TYPES
// ============================================================================

export type CreateCandidateRequest = z.infer<typeof createCandidateRequestSchema>;
export type UpdateCandidateRequest = z.infer<typeof updateCandidateRequestSchema>;
export type UpsertPersonalDetailsRequest = z.infer<typeof upsertPersonalDetailsRequestSchema>;
export type UpsertAddressRequest = z.infer<typeof upsertAddressRequestSchema>;
export type UpsertFamilyInfoRequest = z.infer<typeof upsertFamilyInfoRequestSchema>;
export type CreateChildRequest = z.infer<typeof createChildRequestSchema>;
export type UpdateChildRequest = z.infer<typeof updateChildRequestSchema>;
export type CreateNextOfKinRequest = z.infer<typeof createNextOfKinRequestSchema>;
export type UpdateNextOfKinRequest = z.infer<typeof updateNextOfKinRequestSchema>;
export type AddVesselTypeAppliedRequest = z.infer<typeof addVesselTypeAppliedRequestSchema>;

// Phase 2: Documents & Certificates Request Types
export type CreateTravelDocumentRequest = z.infer<typeof createTravelDocumentRequestSchema>;
export type CreateVisaRequest = z.infer<typeof createVisaRequestSchema>;
export type CreateCocRequest = z.infer<typeof createCocRequestSchema>;
export type CreateCopRequest = z.infer<typeof createCopRequestSchema>;
export type CreateStcwCertificateRequest = z.infer<typeof createStcwCertificateRequestSchema>;
export type CreateFlagEndorsementRequest = z.infer<typeof createFlagEndorsementRequestSchema>;
export type CreateMedicalCertificateRequest = z.infer<typeof createMedicalCertificateRequestSchema>;
export type CreateVaccinationRequest = z.infer<typeof createVaccinationRequestSchema>;
export type CreateTrainingCertificateRequest = z.infer<typeof createTrainingCertificateRequestSchema>;
export type CreateEducationRequest = z.infer<typeof createEducationRequestSchema>;
export type CreateSeaServiceInternalRequest = z.infer<typeof createSeaServiceInternalRequestSchema>;
export type CreateSeaServiceExternalRequest = z.infer<typeof createSeaServiceExternalRequestSchema>;
export type CreateLicenseRequest = z.infer<typeof createLicenseRequestSchema>;
export type CreateDocumentAttachmentRequest = z.infer<typeof createDocumentAttachmentRequestSchema>;

// Phase 3: Screening B1-B8 Request Types
export type CreateScreeningGeneralInfoRequest = z.infer<typeof createScreeningGeneralInfoRequestSchema>;
export type CreateScreeningAvailabilityRequest = z.infer<typeof createScreeningAvailabilityRequestSchema>;
export type CreateScreeningSalaryHistoryRequest = z.infer<typeof createScreeningSalaryHistoryRequestSchema>;
export type CreateScreeningDocumentsChecklistRequest = z.infer<typeof createScreeningDocumentsChecklistRequestSchema>;
export type CreateScreeningTechnicalSkillsRequest = z.infer<typeof createScreeningTechnicalSkillsRequestSchema>;
export type CreateScreeningCompetencyRatingsRequest = z.infer<typeof createScreeningCompetencyRatingsRequestSchema>;
export type CreateScreeningEquipmentExperienceRequest = z.infer<typeof createScreeningEquipmentExperienceRequestSchema>;
export type CreateScreeningLanguageProficiencyRequest = z.infer<typeof createScreeningLanguageProficiencyRequestSchema>;
export type CreateScreeningPracticalTestsRequest = z.infer<typeof createScreeningPracticalTestsRequestSchema>;
export type CreateScreeningInterviewsRequest = z.infer<typeof createScreeningInterviewsRequestSchema>;
export type CreateScreeningInterviewPanelistsRequest = z.infer<typeof createScreeningInterviewPanelistsRequestSchema>;
export type CreateScreeningInterviewQuestionsRequest = z.infer<typeof createScreeningInterviewQuestionsRequestSchema>;
export type CreateScreeningInterviewNotesRequest = z.infer<typeof createScreeningInterviewNotesRequestSchema>;
export type CreateScreeningEmployerReferencesRequest = z.infer<typeof createScreeningEmployerReferencesRequestSchema>;
export type CreateScreeningReferenceResponsesRequest = z.infer<typeof createScreeningReferenceResponsesRequestSchema>;
export type CreateScreeningPersonalReferencesRequest = z.infer<typeof createScreeningPersonalReferencesRequestSchema>;
export type CreateScreeningSeaServiceVerificationRequest = z.infer<typeof createScreeningSeaServiceVerificationRequestSchema>;
export type CreateScreeningBackgroundChecksRequest = z.infer<typeof createScreeningBackgroundChecksRequestSchema>;
export type CreateScreeningCriminalRecordsRequest = z.infer<typeof createScreeningCriminalRecordsRequestSchema>;
export type CreateScreeningEmploymentVerificationRequest = z.infer<typeof createScreeningEmploymentVerificationRequestSchema>;
export type CreateScreeningEducationVerificationRequest = z.infer<typeof createScreeningEducationVerificationRequestSchema>;
export type CreateScreeningPsychometricTestsRequest = z.infer<typeof createScreeningPsychometricTestsRequestSchema>;
export type CreateScreeningPsychometricDimensionsRequest = z.infer<typeof createScreeningPsychometricDimensionsRequestSchema>;
export type CreateScreeningBehavioralAssessmentsRequest = z.infer<typeof createScreeningBehavioralAssessmentsRequestSchema>;
export type CreateScreeningPemeRequest = z.infer<typeof createScreeningPemeRequestSchema>;
export type CreateScreeningPemeResultsRequest = z.infer<typeof createScreeningPemeResultsRequestSchema>;
export type CreateScreeningDrugAlcoholTestsRequest = z.infer<typeof createScreeningDrugAlcoholTestsRequestSchema>;
export type CreateScreeningFinalEvaluationRequest = z.infer<typeof createScreeningFinalEvaluationRequestSchema>;
export type CreateScreeningEvaluationApprovalsRequest = z.infer<typeof createScreeningEvaluationApprovalsRequestSchema>;
