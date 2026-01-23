import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  crewMembersV2,
  crewAssignments,
  crewVesselTypesApplied,
  crewPersonalDetails,
  crewAddresses,
  crewFamilyInfo,
  crewChildren,
  crewNextOfKin,
  crewDocuments,
  crewDocumentsAttachments,
  crewVisas,
  crewVisasAttachments,
  crewEducation,
  crewEducationAttachments,
  crewLicenses,
  crewLicensesAttachments,
  crewTrainingCourses,
  crewTrainingAttachments,
  crewSeaService,
  crewSeaServiceAttachments,
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
} from "./schema";

// ============================================================================
// CREW CORE - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewMemberV2Schema = createInsertSchema(crewMembersV2).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewMemberV2 = z.infer<typeof insertCrewMemberV2Schema>;
export type CrewMemberV2 = typeof crewMembersV2.$inferSelect;

// ============================================================================
// CREW ASSIGNMENTS - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewAssignmentSchema = createInsertSchema(crewAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewAssignment = z.infer<typeof insertCrewAssignmentSchema>;
export type CrewAssignment = typeof crewAssignments.$inferSelect;

// ============================================================================
// CREW PROFILE - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewVesselTypesAppliedSchema = createInsertSchema(crewVesselTypesApplied).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewVesselTypesApplied = z.infer<typeof insertCrewVesselTypesAppliedSchema>;
export type CrewVesselTypesApplied = typeof crewVesselTypesApplied.$inferSelect;

export const insertCrewPersonalDetailsSchema = createInsertSchema(crewPersonalDetails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewPersonalDetails = z.infer<typeof insertCrewPersonalDetailsSchema>;
export type CrewPersonalDetails = typeof crewPersonalDetails.$inferSelect;

export const insertCrewAddressSchema = createInsertSchema(crewAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewAddress = z.infer<typeof insertCrewAddressSchema>;
export type CrewAddress = typeof crewAddresses.$inferSelect;

export const insertCrewFamilyInfoSchema = createInsertSchema(crewFamilyInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewFamilyInfo = z.infer<typeof insertCrewFamilyInfoSchema>;
export type CrewFamilyInfo = typeof crewFamilyInfo.$inferSelect;

export const insertCrewChildSchema = createInsertSchema(crewChildren).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewChild = z.infer<typeof insertCrewChildSchema>;
export type CrewChild = typeof crewChildren.$inferSelect;

export const insertCrewNextOfKinSchema = createInsertSchema(crewNextOfKin).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewNextOfKin = z.infer<typeof insertCrewNextOfKinSchema>;
export type CrewNextOfKin = typeof crewNextOfKin.$inferSelect;

// ============================================================================
// DOCUMENTS & CERTIFICATES - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewDocumentSchema = createInsertSchema(crewDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewDocument = z.infer<typeof insertCrewDocumentSchema>;
export type CrewDocument = typeof crewDocuments.$inferSelect;

export const insertCrewDocumentAttachmentSchema = createInsertSchema(crewDocumentsAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewDocumentAttachment = z.infer<typeof insertCrewDocumentAttachmentSchema>;
export type CrewDocumentAttachment = typeof crewDocumentsAttachments.$inferSelect;

export const insertCrewVisaSchema = createInsertSchema(crewVisas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewVisa = z.infer<typeof insertCrewVisaSchema>;
export type CrewVisa = typeof crewVisas.$inferSelect;

export const insertCrewVisaAttachmentSchema = createInsertSchema(crewVisasAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewVisaAttachment = z.infer<typeof insertCrewVisaAttachmentSchema>;
export type CrewVisaAttachment = typeof crewVisasAttachments.$inferSelect;

export const insertCrewEducationSchema = createInsertSchema(crewEducation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewEducation = z.infer<typeof insertCrewEducationSchema>;
export type CrewEducation = typeof crewEducation.$inferSelect;

export const insertCrewEducationAttachmentSchema = createInsertSchema(crewEducationAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewEducationAttachment = z.infer<typeof insertCrewEducationAttachmentSchema>;
export type CrewEducationAttachment = typeof crewEducationAttachments.$inferSelect;

export const insertCrewLicenseSchema = createInsertSchema(crewLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewLicense = z.infer<typeof insertCrewLicenseSchema>;
export type CrewLicense = typeof crewLicenses.$inferSelect;

export const insertCrewLicenseAttachmentSchema = createInsertSchema(crewLicensesAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewLicenseAttachment = z.infer<typeof insertCrewLicenseAttachmentSchema>;
export type CrewLicenseAttachment = typeof crewLicensesAttachments.$inferSelect;

export const insertCrewTrainingCourseSchema = createInsertSchema(crewTrainingCourses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewTrainingCourse = z.infer<typeof insertCrewTrainingCourseSchema>;
export type CrewTrainingCourse = typeof crewTrainingCourses.$inferSelect;

export const insertCrewTrainingAttachmentSchema = createInsertSchema(crewTrainingAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewTrainingAttachment = z.infer<typeof insertCrewTrainingAttachmentSchema>;
export type CrewTrainingAttachment = typeof crewTrainingAttachments.$inferSelect;

// ============================================================================
// SEA SERVICE - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewSeaServiceSchema = createInsertSchema(crewSeaService).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewSeaService = z.infer<typeof insertCrewSeaServiceSchema>;
export type CrewSeaService = typeof crewSeaService.$inferSelect;

export const insertCrewSeaServiceAttachmentSchema = createInsertSchema(crewSeaServiceAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewSeaServiceAttachment = z.infer<typeof insertCrewSeaServiceAttachmentSchema>;
export type CrewSeaServiceAttachment = typeof crewSeaServiceAttachments.$inferSelect;

// ============================================================================
// MEDICAL - INSERT SCHEMAS & TYPES
// ============================================================================

export const insertCrewPreJoiningMedicalSchema = createInsertSchema(crewPreJoiningMedicals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewPreJoiningMedical = z.infer<typeof insertCrewPreJoiningMedicalSchema>;
export type CrewPreJoiningMedical = typeof crewPreJoiningMedicals.$inferSelect;

export const insertCrewMedicalAttachmentSchema = createInsertSchema(crewMedicalAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewMedicalAttachment = z.infer<typeof insertCrewMedicalAttachmentSchema>;
export type CrewMedicalAttachment = typeof crewMedicalAttachments.$inferSelect;

export const insertCrewDoctorVisitSchema = createInsertSchema(crewDoctorVisits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewDoctorVisit = z.infer<typeof insertCrewDoctorVisitSchema>;
export type CrewDoctorVisit = typeof crewDoctorVisits.$inferSelect;

export const insertCrewDoctorVisitAttachmentSchema = createInsertSchema(crewDoctorVisitsAttachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCrewDoctorVisitAttachment = z.infer<typeof insertCrewDoctorVisitAttachmentSchema>;
export type CrewDoctorVisitAttachment = typeof crewDoctorVisitsAttachments.$inferSelect;
