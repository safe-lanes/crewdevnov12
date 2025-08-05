/**
 * Type definitions for the crewing module
 */

import { z } from "zod";
import { CrewMember, AppraisalResult } from "@shared/schema";

export type { CrewMember, AppraisalResult };

// Extended crew member interface with computed fields
export interface CrewAppraisalData extends CrewMember {
  // Computed display fields
  fullName: string;
  timeOnBoard: string;
  
  // Latest appraisal data
  latestAppraisal?: AppraisalResult;
  competenceRating?: { value: string; color: string };
  behavioralRating?: { value: string; color: string };
  overallRating?: { value: string; color: string };
}

// Filters and search interfaces
export interface CrewFilters {
  search?: string;
  rank?: string;
  vessel?: string;
  vesselType?: string;
  nationality?: string;
  appraisalType?: string;
}

export interface CrewTableAction {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  onClick: (crew: CrewMember) => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

// Form state interfaces
export interface CrewFormData {
  firstName: string;
  middleName?: string;
  lastName?: string;
  rank: string;
  nationality: string;
  vessel: string;
  vesselType: string;
  signOnDate: string;
}

export interface AppraisalFormData {
  crewMemberId: string;
  formId: number;
  appraisalType: string;
  appraisalDate: string;
  appraisalData: any;
  competenceRating?: string;
  behavioralRating?: string;
  overallRating?: string;
  submittedBy: string;
  status: "draft" | "submitted" | "approved";
}