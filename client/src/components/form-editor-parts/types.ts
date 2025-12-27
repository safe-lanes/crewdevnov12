import { z } from "zod";
import { UseFormReturn } from "react-hook-form";

export interface RankGroupConfiguration {
  competenceAssessments?: Array<{
    id: string;
    assessmentCriteria: string;
    weight: number;
    effectiveness: string;
    comment?: string;
  }>;
  behaviouralAssessments?: Array<{
    id: string;
    assessmentCriteria: string;
    weight: number;
    effectiveness: string;
    comment?: string;
  }>;
  recommendations?: Array<{
    id: string;
    recommendation: string;
    yes?: boolean;
    no?: boolean;
    na?: boolean;
    comment?: string;
  }>;
  hiddenFields?: string[];
  hiddenSections?: string[];
}

export const trainingSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

export const targetSchema = z.object({
  id: z.string(),
  targetSetting: z.string().min(1, "Target setting is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

export const competenceAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

export const behaviouralAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

export const trainingNeedsSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  comment: z.string().optional(),
});

export const recommendationSchema = z.object({
  id: z.string(),
  question: z.string().min(1, "Question is required"),
  answer: z.enum(["Yes", "No", "NA"]),
  comment: z.string().optional(),
  isCustom: z.boolean().optional().default(false),
});

export const trainingFollowupSchema = z.object({
  id: z.string(),
  training: z.string(),
  correspondingInDB: z.string(),
  category: z.string(),
  status: z.enum(["Proposed", "Approved", "Planned", "Declined", "Completed"]),
  targetDate: z.string().optional(),
  comment: z.string().optional(),
});

export const appraisalSchema = z.object({
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().min(1, "Nationality is required"),
  vessel: z.string().min(1, "Vessel is required"),
  signOn: z.string().min(1, "Sign On date is required"),
  appraisalType: z.string().min(1, "Appraisal type is required"),
  appraisalPeriodFrom: z.string().min(1, "Appraisal period from is required"),
  appraisalPeriodTo: z.string().min(1, "Appraisal period to is required"),
  personalityIndexCategory: z.string().min(1, "Personality Index category is required"),
  primaryAppraiser: z.string().min(1, "Primary appraiser is required"),
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),
  trainingNeeds: z.array(trainingNeedsSchema).default([]),
  overallScore: z.string().optional(),
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.string().optional(),
  seafarerComments: z.string().optional(),
  officeReviewComments: z.string().optional(),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

export type AppraisalFormData = z.infer<typeof appraisalSchema>;
export type Training = z.infer<typeof trainingSchema>;
export type Target = z.infer<typeof targetSchema>;
export type CompetenceAssessment = z.infer<typeof competenceAssessmentSchema>;
export type BehaviouralAssessment = z.infer<typeof behaviouralAssessmentSchema>;
export type TrainingNeed = z.infer<typeof trainingNeedsSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type TrainingFollowup = z.infer<typeof trainingFollowupSchema>;

export interface SectionVisibility {
  partB: boolean;
  partB1: boolean;
  partB2: boolean;
  partD: boolean;
}

export interface FieldVisibility {
  personalityIndexCategory: boolean;
}

export interface FormSectionBaseProps {
  formMethods: UseFormReturn<AppraisalFormData>;
  isConfigMode: boolean;
}

export interface PartAProps extends FormSectionBaseProps {
  fieldVisibility: FieldVisibility;
  toggleFieldVisibility: (field: keyof FieldVisibility) => void;
  appraisalTypeOptions: string[];
  piCategoryOptions: string[];
}

export interface PartBProps extends FormSectionBaseProps {
  sectionVisibility: SectionVisibility;
  toggleSectionVisibility: (section: keyof SectionVisibility) => void;
  effectivenessOptions: string[];
  getDynamicSectionLetter: (originalId: string) => string;
  trainings: Training[];
  targets: Target[];
  trainingComments: Record<string, string>;
  setTrainingComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  targetComments: Record<string, string>;
  setTargetComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addTraining: () => void;
  updateTraining: (id: string, field: string, value: string) => void;
  deleteTraining: (id: string) => void;
  addTarget: () => void;
  updateTarget: (id: string, field: string, value: string) => void;
  deleteTarget: (id: string) => void;
  setShowEffectivenessDialog: (show: boolean) => void;
}

export interface PartCProps extends FormSectionBaseProps {
  effectivenessOptions: string[];
  getDynamicSectionLetter: (originalId: string) => string;
  competenceAssessments: CompetenceAssessment[];
  competenceComments: Record<string, string>;
  setCompetenceComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addCompetenceCriterion: () => void;
  updateCompetenceCriterion: (id: string, field: string, value: string | number) => void;
  deleteCompetenceCriterion: (id: string) => void;
  sectionScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
  setShowEffectivenessDialog: (show: boolean) => void;
}

export interface PartDProps extends FormSectionBaseProps {
  sectionVisibility: SectionVisibility;
  toggleSectionVisibility: (section: keyof SectionVisibility) => void;
  effectivenessOptions: string[];
  getDynamicSectionLetter: (originalId: string) => string;
  behaviouralAssessments: BehaviouralAssessment[];
  behaviouralComments: Record<string, string>;
  setBehaviouralComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addBehaviouralAssessment: () => void;
  updateBehaviouralAssessment: (id: string, field: string, value: string | number) => void;
  deleteBehaviouralAssessment: (id: string) => void;
  sectionScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
  setShowEffectivenessDialog: (show: boolean) => void;
}

export interface PartEProps extends FormSectionBaseProps {
  getDynamicSectionLetter: (originalId: string) => string;
  trainingNeeds: TrainingNeed[];
  trainingNeedsComments: Record<string, string>;
  setTrainingNeedsComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addTrainingNeed: (type: 'database' | 'new') => void;
  updateTrainingNeed: (id: string, field: string, value: string) => void;
  deleteTrainingNeed: (id: string) => void;
}

export interface PartFProps extends FormSectionBaseProps {
  getDynamicSectionLetter: (originalId: string) => string;
  recommendations: Recommendation[];
  recommendationComments: Record<string, string>;
  setRecommendationComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingRecommendations: Set<string>;
  addRecommendation: () => void;
  updateRecommendation: (id: string, field: string, value: string) => void;
  deleteRecommendation: (id: string) => void;
  startEditingRecommendation: (id: string) => void;
  handleRecommendationBlur: (id: string) => void;
  overallScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
}

export interface PartGProps extends FormSectionBaseProps {
  getDynamicSectionLetter: (originalId: string) => string;
  trainingFollowups: TrainingFollowup[];
  trainingFollowupComments: Record<string, string>;
  setTrainingFollowupComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trainingCategoryOptions: string[];
  trainingStatusOptions: string[];
  addTrainingFollowup: (type: 'database' | 'new') => void;
  updateTrainingFollowup: (id: string, field: string, value: string) => void;
  deleteTrainingFollowup: (id: string) => void;
}

export const getScoreColors = (score: number) => {
  if (score >= 4.0) {
    return { bgColor: 'bg-[#c3f2cb]', textColor: 'text-[#286e34]' };
  } else if (score >= 3.0) {
    return { bgColor: 'bg-[#ffeaa7]', textColor: 'text-[#814c02]' };
  } else if (score >= 2.0) {
    return { bgColor: 'bg-[#f9ecef]', textColor: 'text-[#811f1a]' };
  } else {
    return { bgColor: 'bg-red-600', textColor: 'text-white' };
  }
};
