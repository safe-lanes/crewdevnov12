import { z } from "zod";
import { UseFormReturn } from "react-hook-form";
import { RefObject } from "react";

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
  question: z.string(),
  answer: z.union([z.enum(["Yes", "No", "NA"]), z.literal("")]),
  comment: z.string().optional(),
});

export const appraiserCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

export const seafarerCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

export const officeReviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  feedback: z.string(),
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

export const appraisalFormDataSchema = z.object({
  seafarersName: z.string(),
  seafarersRank: z.string(),
  nationality: z.string(),
  vessel: z.string(),
  signOn: z.string().optional(),
  appraisalType: z.string(),
  appraisalPeriodFrom: z.string().optional(),
  appraisalPeriodTo: z.string().optional(),
  personalityIndexCategory: z.string().optional(),
  primaryAppraiser: z.string().optional(),
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),
  trainingNeeds: z.array(trainingNeedsSchema).default([]),
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.array(appraiserCommentSchema).default([]),
  seafarerComments: z.array(seafarerCommentSchema).default([]),
  officeReviews: z.array(officeReviewSchema).default([]),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

export type AppraisalFormData = z.infer<typeof appraisalFormDataSchema>;
export type Training = z.infer<typeof trainingSchema>;
export type Target = z.infer<typeof targetSchema>;
export type CompetenceAssessment = z.infer<typeof competenceAssessmentSchema>;
export type BehaviouralAssessment = z.infer<typeof behaviouralAssessmentSchema>;
export type TrainingNeed = z.infer<typeof trainingNeedsSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type AppraiserComment = z.infer<typeof appraiserCommentSchema>;
export type SeafarerComment = z.infer<typeof seafarerCommentSchema>;
export type OfficeReview = z.infer<typeof officeReviewSchema>;
export type TrainingFollowup = z.infer<typeof trainingFollowupSchema>;

export type AppraisalStatus = 'draft' | 'preliminary' | 'submitted' | 'reviewed';

export interface VesselLookupItem {
  entryId: string;
  name: string;
}

export interface RankItem {
  id: number;
  name: string;
  category: string;
}

export interface AppraisalTypeItem {
  id: string;
  name: string;
  value: string;
}

export interface AppraisalFormSectionBaseProps {
  form: UseFormReturn<AppraisalFormData>;
  appraisalStatus: AppraisalStatus;
  isFieldVisible: (fieldName: string) => boolean;
  isSectionVisible: (sectionName: string) => boolean;
}

export interface PartAProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  vessels: VesselLookupItem[];
  availableRanks: RankItem[];
  appraisalTypes: AppraisalTypeItem[];
}

export interface PartBProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  showEvaluation: boolean;
  editingTraining: string | null;
  setEditingTraining: (id: string | null) => void;
  editingTarget: string | null;
  setEditingTarget: (id: string | null) => void;
  trainingComments: Record<string, string>;
  setTrainingComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  targetComments: Record<string, string>;
  setTargetComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingTrainingComment: string | null;
  setEditingTrainingComment: (id: string | null) => void;
  editingTargetComment: string | null;
  setEditingTargetComment: (id: string | null) => void;
  addTraining: () => void;
  updateTraining: (id: string, field: string, value: string) => void;
  deleteTraining: (id: string) => void;
  addTarget: () => void;
  updateTarget: (id: string, field: string, value: string) => void;
  deleteTarget: (id: string) => void;
}

export interface PartCProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  competenceComments: Record<string, string>;
  setCompetenceComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCompetenceComment: string | null;
  setEditingCompetenceComment: (id: string | null) => void;
  updateCompetenceAssessment: (id: string, field: string, value: string | number) => void;
  competenceSectionScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
}

export interface PartDProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  behaviouralComments: Record<string, string>;
  setBehaviouralComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingBehaviouralComment: string | null;
  setEditingBehaviouralComment: (id: string | null) => void;
  updateBehaviouralAssessment: (id: string, field: string, value: string | number) => void;
  behaviouralSectionScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
}

export interface PartEProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  trainingNeedsComments: Record<string, string>;
  setTrainingNeedsComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingTrainingNeedsComment: string | null;
  setEditingTrainingNeedsComment: (id: string | null) => void;
  isTrainingNeedsDialogOpen: boolean;
  setIsTrainingNeedsDialogOpen: (open: boolean) => void;
  addTrainingNeed: () => void;
  updateTrainingNeed: (id: string, field: string, value: string) => void;
  deleteTrainingNeed: (id: string) => void;
  handleTrainingNeedsSelect: (templates: any[]) => void;
}

export interface PartFProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  recommendationComments: Record<string, string>;
  setRecommendationComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingRecommendationComment: string | null;
  setEditingRecommendationComment: (id: string | null) => void;
  editingAppraiserComment: string | null;
  setEditingAppraiserComment: (id: string | null) => void;
  editingSeafarerComment: string | null;
  setEditingSeafarerComment: (id: string | null) => void;
  updateRecommendation: (id: string, field: string, value: string) => void;
  addAppraiserComment: () => void;
  updateAppraiserComment: (id: string, field: string, value: string) => void;
  deleteAppraiserComment: (id: string) => void;
  updateSeafarerComment: (id: string, field: string, value: string) => void;
  competenceSectionScore: string;
  behaviouralSectionScore: string;
  overallScore: string;
  getScoreColors: (score: number) => { bgColor: string; textColor: string };
  availableRanks: RankItem[];
  handleStageSubmission: (stage: 'stage1' | 'stage2' | 'stage3') => void;
  handleSaveDraft: () => void;
  stage1Mutation: { isPending: boolean };
  stage2Mutation: { isPending: boolean };
  saveAppraisalMutation: { isPending: boolean };
}

export interface PartGProps extends AppraisalFormSectionBaseProps {
  partRef: RefObject<HTMLDivElement>;
  trainingFollowupComments: Record<string, string>;
  setTrainingFollowupComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingTrainingFollowupComment: string | null;
  setEditingTrainingFollowupComment: (id: string | null) => void;
  editingOfficeReview: string | null;
  setEditingOfficeReview: (id: string | null) => void;
  addOfficeReview: () => void;
  updateOfficeReview: (id: string, field: string, value: string) => void;
  deleteOfficeReview: (id: string) => void;
  addTrainingFollowup: () => void;
  updateTrainingFollowup: (id: string, field: string, value: string) => void;
  deleteTrainingFollowup: (id: string) => void;
  handleStageSubmission: (stage: 'stage1' | 'stage2' | 'stage3') => void;
  handleSaveDraft: () => void;
  stage3Mutation: { isPending: boolean };
  saveAppraisalMutation: { isPending: boolean };
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

export const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguan", "Argentine", "Armenian", "Australian",
  "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese",
  "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran",
  "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti", "Dominican", "Dutch",
  "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino",
  "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan",
  "Guinea-Bissauan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "I-Kiribati", "Icelander", "Indian",
  "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian",
  "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan",
  "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese",
  "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Moroccan", "Mosotho",
  "Motswana", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian", "Nigerien", "North Korean",
  "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish",
  "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean",
  "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander",
  "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian", "Tunisian", "Turkish",
  "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh", "Yemenite", "Zambian", "Zimbabwean"
];
