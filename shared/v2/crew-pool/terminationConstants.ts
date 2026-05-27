import { z } from "zod";

// Canonical machine values stored in DB / sent over the wire.
export const TERMINATION_INITIATED_BY = ["company", "crew_member"] as const;

export const TERMINATION_REASONS = [
  "Resignation",
  "Poor Performance",
  "Disciplinary",
  "No suitable vessel",
  "Unresponsive",
  "Other",
] as const;

export const TERMINATION_CATEGORIES = ["general", "UT", "BT"] as const;

export type TerminationInitiatedBy = typeof TERMINATION_INITIATED_BY[number];
export type TerminationReason = typeof TERMINATION_REASONS[number];
export type TerminationCategory = typeof TERMINATION_CATEGORIES[number];

// Display labels (UI-only). Filters/grids should map machine → display
// using these maps, never store the display string.
export const TERMINATION_INITIATED_BY_LABELS: Record<TerminationInitiatedBy, string> = {
  company: "Company",
  crew_member: "Crew Member (resignation)",
};
export const TERMINATION_CATEGORY_LABELS: Record<TerminationCategory, string> = {
  general: "General",
  UT: "Unavoidable Termination (UT)",
  BT: "Beneficial Termination (BT)",
};

export const terminationInitiatedByEnum = z.enum(TERMINATION_INITIATED_BY);
export const terminationReasonEnum = z.enum(TERMINATION_REASONS);
export const terminationCategoryEnum = z.enum(TERMINATION_CATEGORIES);
