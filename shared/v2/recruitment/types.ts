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
