/**
 * Zod validation schemas for crew-related data
 */

import { z } from "zod";

/**
 * Schema for crew search/filter data
 */
export const crewSearchDataSchema = z.object({
  rank: z.string().optional(),
  nationality: z.string().optional(),
  status: z.string().optional(),
  vessel: z.string().optional(),
  searchQuery: z.string().optional(),
});

export type CrewSearchData = z.infer<typeof crewSearchDataSchema>;

/**
 * Schema for crew member form data
 */
export const crewMemberFormDataSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  familyName: z.string().min(1, "Family name is required"),
  nationality: z.string().min(1, "Nationality is required"),
  presentRank: z.string().min(1, "Rank is required"),
  dateOfBirth: z.string().optional(),
  age: z.string().optional(),
  presentVessel: z.string().min(1, "Vessel is required"),
  vesselType: z.string().min(1, "Vessel type is required"),
  status: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  mobile: z.string().optional(),
});

export type CrewMemberFormData = z.infer<typeof crewMemberFormDataSchema>;

/**
 * Schema for appraisal form data
 */
export const appraisalFormDataSchema = z.object({
  crewMemberId: z.string().min(1, "Crew member is required"),
  formId: z.number().min(1, "Form is required"),
  appraisalType: z.string().min(1, "Appraisal type is required"),
  appraisalDate: z.string().min(1, "Appraisal date is required"),
  appraisalData: z.record(z.any()).optional(),
  competenceRating: z.string().optional(),
  behavioralRating: z.string().optional(),
  overallRating: z.string().optional(),
  status: z.enum(["draft", "preliminary", "submitted", "reviewed"]).default("draft"),
});

export type AppraisalFormData = z.infer<typeof appraisalFormDataSchema>;
