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
