/**
 * Validation schemas for crew-related forms using Zod
 */

import { z } from "zod";
import { insertCrewMemberSchema, insertAppraisalResultSchema } from "@shared/schema";

// Base crew member validation schema
export const crewMemberSchema = insertCrewMemberSchema.extend({
  id: z.string().min(1, "Crew ID is required"),
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  middleName: z.string().max(50, "Middle name too long").optional(),
  rank: z.string().min(1, "Rank is required"),
  nationality: z.string().min(1, "Nationality is required"),
  vessel: z.string().min(1, "Vessel name is required").max(100, "Vessel name too long"),
  vesselType: z.string().min(1, "Vessel type is required"),
  signOnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sign-on date must be in YYYY-MM-DD format"),
});

// Appraisal form validation schema
export const appraisalSchema = insertAppraisalResultSchema.extend({
  crewMemberId: z.string().min(1, "Crew member is required"),
  formId: z.number().positive("Form ID must be positive"),
  appraisalType: z.enum(["Interim Appraisal", "Final Appraisal", "Probationary Review", "Annual Review"]),
  appraisalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Appraisal date must be in YYYY-MM-DD format"),
  appraisalData: z.string().min(1, "Appraisal data is required"),
  competenceRating: z.string().optional(),
  behavioralRating: z.string().optional(),
  overallRating: z.string().optional(),
  submittedBy: z.string().min(1, "Submitted by is required"),
  status: z.enum(["draft", "submitted", "approved"]).default("draft"),
});

// Search and filter schemas
export const crewSearchSchema = z.object({
  search: z.string().optional(),
  rank: z.string().optional(),
  vessel: z.string().optional(),
  vesselType: z.string().optional(),
  nationality: z.string().optional(),
  appraisalType: z.string().optional(),
});

// Training record schema
export const trainingRecordSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

// Target setting schema
export const targetSettingSchema = z.object({
  id: z.string(),
  targetSetting: z.string().min(1, "Target setting is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

// Assessment criteria schemas
export const competenceAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number().min(0).max(100),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

export const behaviouralAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number().min(0).max(100),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

// Infer types from schemas
export type CrewMemberFormData = z.infer<typeof crewMemberSchema>;
export type AppraisalFormData = z.infer<typeof appraisalSchema>;
export type CrewSearchData = z.infer<typeof crewSearchSchema>;
export type TrainingRecordData = z.infer<typeof trainingRecordSchema>;
export type TargetSettingData = z.infer<typeof targetSettingSchema>;
export type CompetenceAssessmentData = z.infer<typeof competenceAssessmentSchema>;
export type BehaviouralAssessmentData = z.infer<typeof behaviouralAssessmentSchema>;