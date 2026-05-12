import { z } from "zod";

export const TERMINATION_INITIATED_BY = [
  "Company",
  "Crew Member (resignation)",
] as const;

export const TERMINATION_REASONS = [
  "Resignation",
  "Poor Performance",
  "Disciplinary",
  "No suitable vessel",
  "Unresponsive",
  "Other",
] as const;

export const TERMINATION_CATEGORIES = [
  "general",
  "UT",
  "BT",
] as const;

export type TerminationInitiatedBy = typeof TERMINATION_INITIATED_BY[number];
export type TerminationReason = typeof TERMINATION_REASONS[number];
export type TerminationCategory = typeof TERMINATION_CATEGORIES[number];

export const terminationInitiatedByEnum = z.enum(TERMINATION_INITIATED_BY);
export const terminationReasonEnum = z.enum(TERMINATION_REASONS);
export const terminationCategoryEnum = z.enum(TERMINATION_CATEGORIES);
