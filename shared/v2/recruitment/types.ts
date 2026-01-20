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
  candDocuments,
  candDocumentsAttachments,
  candVisas,
  candVisasAttachments,
  candEducation,
  candEducationAttachments,
  candLicenses,
  candLicensesAttachments,
  candTrainingCourses,
  candTrainingAttachments,
  candSeaService,
  candSeaServiceAttachments,
  candAdditionalInfo,
  candAdditionalInfoAttachments,
  screeningB1Initial,
  screeningB1Comments,
  screeningB1Attachments,
  screeningB2References,
  screeningB2ReferenceItems,
  screeningB2Comments,
  screeningB2Attachments,
  screeningB3Security,
  screeningB3Authorities,
  screeningB3Comments,
  screeningB3Attachments,
  screeningB4Certificates,
  screeningB4CertItems,
  screeningB4Comments,
  screeningB4Attachments,
  screeningB5Tests,
  screeningB5TestItems,
  screeningB5Comments,
  screeningB5Attachments,
  screeningB6Interviews,
  screeningB6InterviewItems,
  screeningB6Comments,
  screeningB6Attachments,
  screeningB7Training,
  screeningB7TrainingItems,
  screeningB8Shortlisting,
  screeningB8SelectedApprovers,
  screeningB8Comments,
  screeningB8Attachments,
  candApprovals,
  candSuitability,
  candSuitabilityVesselTypes,
  candSuitabilityFleetGroups,
  candRecruitmentDecision,
  candAssignedGroups,
} from "./schema";

// ============================================================================
// CANDIDATE CORE - INSERT SCHEMAS
// ============================================================================

export const insertCandidateSchema = createInsertSchema(recruitmentCandidatesV2).omit({
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

// ============================================================================
// DOCUMENTS & ATTACHMENTS - INSERT SCHEMAS
// ============================================================================

export const insertDocumentSchema = createInsertSchema(candDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentAttachmentSchema = createInsertSchema(candDocumentsAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVisaSchema = createInsertSchema(candVisas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVisaAttachmentSchema = createInsertSchema(candVisasAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationSchema = createInsertSchema(candEducation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationAttachmentSchema = createInsertSchema(candEducationAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseSchema = createInsertSchema(candLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseAttachmentSchema = createInsertSchema(candLicensesAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingCourseSchema = createInsertSchema(candTrainingCourses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingAttachmentSchema = createInsertSchema(candTrainingAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeaServiceSchema = createInsertSchema(candSeaService).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSeaServiceAttachmentSchema = createInsertSchema(candSeaServiceAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdditionalInfoSchema = createInsertSchema(candAdditionalInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdditionalInfoAttachmentSchema = createInsertSchema(candAdditionalInfoAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B1 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB1InitialSchema = createInsertSchema(screeningB1Initial).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB1CommentSchema = createInsertSchema(screeningB1Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB1AttachmentSchema = createInsertSchema(screeningB1Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B2 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB2ReferencesSchema = createInsertSchema(screeningB2References).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB2ReferenceItemSchema = createInsertSchema(screeningB2ReferenceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB2CommentSchema = createInsertSchema(screeningB2Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB2AttachmentSchema = createInsertSchema(screeningB2Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B3 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB3SecuritySchema = createInsertSchema(screeningB3Security).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB3AuthoritySchema = createInsertSchema(screeningB3Authorities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB3CommentSchema = createInsertSchema(screeningB3Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB3AttachmentSchema = createInsertSchema(screeningB3Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B4 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB4CertificatesSchema = createInsertSchema(screeningB4Certificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB4CertItemSchema = createInsertSchema(screeningB4CertItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB4CommentSchema = createInsertSchema(screeningB4Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB4AttachmentSchema = createInsertSchema(screeningB4Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B5 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB5TestsSchema = createInsertSchema(screeningB5Tests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB5TestItemSchema = createInsertSchema(screeningB5TestItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB5CommentSchema = createInsertSchema(screeningB5Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB5AttachmentSchema = createInsertSchema(screeningB5Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B6 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB6InterviewsSchema = createInsertSchema(screeningB6Interviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB6InterviewItemSchema = createInsertSchema(screeningB6InterviewItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB6CommentSchema = createInsertSchema(screeningB6Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB6AttachmentSchema = createInsertSchema(screeningB6Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B7 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB7TrainingSchema = createInsertSchema(screeningB7Training).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB7TrainingItemSchema = createInsertSchema(screeningB7TrainingItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SCREENING B8 - INSERT SCHEMAS
// ============================================================================

export const insertScreeningB8ShortlistingSchema = createInsertSchema(screeningB8Shortlisting).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB8ApproverSchema = createInsertSchema(screeningB8SelectedApprovers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB8CommentSchema = createInsertSchema(screeningB8Comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScreeningB8AttachmentSchema = createInsertSchema(screeningB8Attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// APPROVALS & DECISION - INSERT SCHEMAS
// ============================================================================

export const insertApprovalSchema = createInsertSchema(candApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSuitabilitySchema = createInsertSchema(candSuitability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSuitabilityVesselTypeSchema = createInsertSchema(candSuitabilityVesselTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSuitabilityFleetGroupSchema = createInsertSchema(candSuitabilityFleetGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecruitmentDecisionSchema = createInsertSchema(candRecruitmentDecision).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssignedGroupSchema = createInsertSchema(candAssignedGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// SELECT TYPES
// ============================================================================

export type RecruitmentCandidate = typeof recruitmentCandidatesV2.$inferSelect;
export type CandVesselTypeApplied = typeof candVesselTypesApplied.$inferSelect;
export type CandPersonalDetails = typeof candPersonalDetails.$inferSelect;
export type CandAddress = typeof candAddresses.$inferSelect;
export type CandFamilyInfo = typeof candFamilyInfo.$inferSelect;
export type CandChild = typeof candChildren.$inferSelect;
export type CandNextOfKin = typeof candNextOfKin.$inferSelect;

export type CandDocument = typeof candDocuments.$inferSelect;
export type CandDocumentAttachment = typeof candDocumentsAttachments.$inferSelect;
export type CandVisa = typeof candVisas.$inferSelect;
export type CandVisaAttachment = typeof candVisasAttachments.$inferSelect;
export type CandEducation = typeof candEducation.$inferSelect;
export type CandEducationAttachment = typeof candEducationAttachments.$inferSelect;
export type CandLicense = typeof candLicenses.$inferSelect;
export type CandLicenseAttachment = typeof candLicensesAttachments.$inferSelect;
export type CandTrainingCourse = typeof candTrainingCourses.$inferSelect;
export type CandTrainingAttachment = typeof candTrainingAttachments.$inferSelect;
export type CandSeaService = typeof candSeaService.$inferSelect;
export type CandSeaServiceAttachment = typeof candSeaServiceAttachments.$inferSelect;
export type CandAdditionalInfo = typeof candAdditionalInfo.$inferSelect;
export type CandAdditionalInfoAttachment = typeof candAdditionalInfoAttachments.$inferSelect;

export type ScreeningB1Initial = typeof screeningB1Initial.$inferSelect;
export type ScreeningB1Comment = typeof screeningB1Comments.$inferSelect;
export type ScreeningB1Attachment = typeof screeningB1Attachments.$inferSelect;

export type ScreeningB2References = typeof screeningB2References.$inferSelect;
export type ScreeningB2ReferenceItem = typeof screeningB2ReferenceItems.$inferSelect;
export type ScreeningB2Comment = typeof screeningB2Comments.$inferSelect;
export type ScreeningB2Attachment = typeof screeningB2Attachments.$inferSelect;

export type ScreeningB3Security = typeof screeningB3Security.$inferSelect;
export type ScreeningB3Authority = typeof screeningB3Authorities.$inferSelect;
export type ScreeningB3Comment = typeof screeningB3Comments.$inferSelect;
export type ScreeningB3Attachment = typeof screeningB3Attachments.$inferSelect;

export type ScreeningB4Certificates = typeof screeningB4Certificates.$inferSelect;
export type ScreeningB4CertItem = typeof screeningB4CertItems.$inferSelect;
export type ScreeningB4Comment = typeof screeningB4Comments.$inferSelect;
export type ScreeningB4Attachment = typeof screeningB4Attachments.$inferSelect;

export type ScreeningB5Tests = typeof screeningB5Tests.$inferSelect;
export type ScreeningB5TestItem = typeof screeningB5TestItems.$inferSelect;
export type ScreeningB5Comment = typeof screeningB5Comments.$inferSelect;
export type ScreeningB5Attachment = typeof screeningB5Attachments.$inferSelect;

export type ScreeningB6Interviews = typeof screeningB6Interviews.$inferSelect;
export type ScreeningB6InterviewItem = typeof screeningB6InterviewItems.$inferSelect;
export type ScreeningB6Comment = typeof screeningB6Comments.$inferSelect;
export type ScreeningB6Attachment = typeof screeningB6Attachments.$inferSelect;

export type ScreeningB7Training = typeof screeningB7Training.$inferSelect;
export type ScreeningB7TrainingItem = typeof screeningB7TrainingItems.$inferSelect;

export type ScreeningB8Shortlisting = typeof screeningB8Shortlisting.$inferSelect;
export type ScreeningB8Approver = typeof screeningB8SelectedApprovers.$inferSelect;
export type ScreeningB8Comment = typeof screeningB8Comments.$inferSelect;
export type ScreeningB8Attachment = typeof screeningB8Attachments.$inferSelect;

export type CandApproval = typeof candApprovals.$inferSelect;
export type CandSuitability = typeof candSuitability.$inferSelect;
export type CandSuitabilityVesselType = typeof candSuitabilityVesselTypes.$inferSelect;
export type CandSuitabilityFleetGroup = typeof candSuitabilityFleetGroups.$inferSelect;
export type CandRecruitmentDecision = typeof candRecruitmentDecision.$inferSelect;
export type CandAssignedGroup = typeof candAssignedGroups.$inferSelect;

// ============================================================================
// INSERT TYPES
// ============================================================================

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type InsertVesselTypeApplied = z.infer<typeof insertVesselTypesAppliedSchema>;
export type InsertPersonalDetails = z.infer<typeof insertPersonalDetailsSchema>;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type InsertFamilyInfo = z.infer<typeof insertFamilyInfoSchema>;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type InsertNextOfKin = z.infer<typeof insertNextOfKinSchema>;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentAttachment = z.infer<typeof insertDocumentAttachmentSchema>;
export type InsertVisa = z.infer<typeof insertVisaSchema>;
export type InsertVisaAttachment = z.infer<typeof insertVisaAttachmentSchema>;
export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type InsertEducationAttachment = z.infer<typeof insertEducationAttachmentSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type InsertLicenseAttachment = z.infer<typeof insertLicenseAttachmentSchema>;
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;
export type InsertTrainingAttachment = z.infer<typeof insertTrainingAttachmentSchema>;
export type InsertSeaService = z.infer<typeof insertSeaServiceSchema>;
export type InsertSeaServiceAttachment = z.infer<typeof insertSeaServiceAttachmentSchema>;
export type InsertAdditionalInfo = z.infer<typeof insertAdditionalInfoSchema>;
export type InsertAdditionalInfoAttachment = z.infer<typeof insertAdditionalInfoAttachmentSchema>;

export type InsertScreeningB1Initial = z.infer<typeof insertScreeningB1InitialSchema>;
export type InsertScreeningB1Comment = z.infer<typeof insertScreeningB1CommentSchema>;
export type InsertScreeningB1Attachment = z.infer<typeof insertScreeningB1AttachmentSchema>;

export type InsertScreeningB2References = z.infer<typeof insertScreeningB2ReferencesSchema>;
export type InsertScreeningB2ReferenceItem = z.infer<typeof insertScreeningB2ReferenceItemSchema>;
export type InsertScreeningB2Comment = z.infer<typeof insertScreeningB2CommentSchema>;
export type InsertScreeningB2Attachment = z.infer<typeof insertScreeningB2AttachmentSchema>;

export type InsertScreeningB3Security = z.infer<typeof insertScreeningB3SecuritySchema>;
export type InsertScreeningB3Authority = z.infer<typeof insertScreeningB3AuthoritySchema>;
export type InsertScreeningB3Comment = z.infer<typeof insertScreeningB3CommentSchema>;
export type InsertScreeningB3Attachment = z.infer<typeof insertScreeningB3AttachmentSchema>;

export type InsertScreeningB4Certificates = z.infer<typeof insertScreeningB4CertificatesSchema>;
export type InsertScreeningB4CertItem = z.infer<typeof insertScreeningB4CertItemSchema>;
export type InsertScreeningB4Comment = z.infer<typeof insertScreeningB4CommentSchema>;
export type InsertScreeningB4Attachment = z.infer<typeof insertScreeningB4AttachmentSchema>;

export type InsertScreeningB5Tests = z.infer<typeof insertScreeningB5TestsSchema>;
export type InsertScreeningB5TestItem = z.infer<typeof insertScreeningB5TestItemSchema>;
export type InsertScreeningB5Comment = z.infer<typeof insertScreeningB5CommentSchema>;
export type InsertScreeningB5Attachment = z.infer<typeof insertScreeningB5AttachmentSchema>;

export type InsertScreeningB6Interviews = z.infer<typeof insertScreeningB6InterviewsSchema>;
export type InsertScreeningB6InterviewItem = z.infer<typeof insertScreeningB6InterviewItemSchema>;
export type InsertScreeningB6Comment = z.infer<typeof insertScreeningB6CommentSchema>;
export type InsertScreeningB6Attachment = z.infer<typeof insertScreeningB6AttachmentSchema>;

export type InsertScreeningB7Training = z.infer<typeof insertScreeningB7TrainingSchema>;
export type InsertScreeningB7TrainingItem = z.infer<typeof insertScreeningB7TrainingItemSchema>;

export type InsertScreeningB8Shortlisting = z.infer<typeof insertScreeningB8ShortlistingSchema>;
export type InsertScreeningB8Approver = z.infer<typeof insertScreeningB8ApproverSchema>;
export type InsertScreeningB8Comment = z.infer<typeof insertScreeningB8CommentSchema>;
export type InsertScreeningB8Attachment = z.infer<typeof insertScreeningB8AttachmentSchema>;

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertSuitability = z.infer<typeof insertSuitabilitySchema>;
export type InsertSuitabilityVesselType = z.infer<typeof insertSuitabilityVesselTypeSchema>;
export type InsertSuitabilityFleetGroup = z.infer<typeof insertSuitabilityFleetGroupSchema>;
export type InsertRecruitmentDecision = z.infer<typeof insertRecruitmentDecisionSchema>;
export type InsertAssignedGroup = z.infer<typeof insertAssignedGroupSchema>;

// ============================================================================
// REQUEST SCHEMAS (for API validation)
// ============================================================================

export const createCandidateRequestSchema = insertCandidateSchema.omit({
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createDocumentRequestSchema = insertDocumentSchema.omit({
  docUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createVisaRequestSchema = insertVisaSchema.omit({
  visaUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createEducationRequestSchema = insertEducationSchema.omit({
  eduUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createLicenseRequestSchema = insertLicenseSchema.omit({
  licUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createTrainingCourseRequestSchema = insertTrainingCourseSchema.omit({
  trainUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createSeaServiceRequestSchema = insertSeaServiceSchema.omit({
  seaUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createAdditionalInfoRequestSchema = insertAdditionalInfoSchema.omit({
  infoUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createApprovalRequestSchema = insertApprovalSchema.omit({
  approvalUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createSuitabilityRequestSchema = insertSuitabilitySchema.omit({
  suitUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export const createRecruitmentDecisionRequestSchema = insertRecruitmentDecisionSchema.omit({
  decisionUuid: true,
  recCanUuid: true,
  createdByUuid: true,
  updatedByUuid: true,
  isDeleted: true,
  isSync: true,
});

export type CreateCandidateRequest = z.infer<typeof createCandidateRequestSchema>;
export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>;
export type CreateVisaRequest = z.infer<typeof createVisaRequestSchema>;
export type CreateEducationRequest = z.infer<typeof createEducationRequestSchema>;
export type CreateLicenseRequest = z.infer<typeof createLicenseRequestSchema>;
export type CreateTrainingCourseRequest = z.infer<typeof createTrainingCourseRequestSchema>;
export type CreateSeaServiceRequest = z.infer<typeof createSeaServiceRequestSchema>;
export type CreateAdditionalInfoRequest = z.infer<typeof createAdditionalInfoRequestSchema>;
export type CreateApprovalRequest = z.infer<typeof createApprovalRequestSchema>;
export type CreateSuitabilityRequest = z.infer<typeof createSuitabilityRequestSchema>;
export type CreateRecruitmentDecisionRequest = z.infer<typeof createRecruitmentDecisionRequestSchema>;
