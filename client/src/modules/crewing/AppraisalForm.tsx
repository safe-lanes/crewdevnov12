import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Send, Plus, MessageSquare, Edit2, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { TrainingCourseSelectionDialog } from '@/modules/crew-pool/TrainingCourseSelectionDialog';
import type { TrainingCourseTemplate } from '@/utils/data/trainingCourseTemplates';
import { useMasterDataEntries } from "@/hooks/useDataMasters";

// Import extracted Part components for code splitting
import { PartA, PartB, PartC, PartD, PartE, PartF, PartG } from "@/components/appraisal-form-parts";

// Comprehensive list of world nationalities
const NATIONALITIES = [
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

// Training and Target schemas
// Full schemas with evaluation required (for Stage 2+)
const trainingSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

const targetSchema = z.object({
  id: z.string(),
  targetSetting: z.string().min(1, "Target setting is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

// Stage 1 schemas with evaluation optional and training/target optional (blank Part B allowed)
const trainingStage1Schema = z.object({
  id: z.string(),
  training: z.string().optional(),
  evaluation: z.string().optional(),
  comment: z.string().optional(),
});

const targetStage1Schema = z.object({
  id: z.string(),
  targetSetting: z.string().optional(),
  evaluation: z.string().optional(),
  comment: z.string().optional(),
});

// Competence Assessment schema
const competenceAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

// Behavioural Assessment schema
const behaviouralAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

// Training Needs schema
const trainingNeedsSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  comment: z.string().optional(),
});

// Part F schemas
// For draft saves, answer can be empty; for stage2 validation, a valid answer is required
const recommendationSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.union([z.enum(["Yes", "No", "NA"]), z.literal("")]),
  comment: z.string().optional(),
});

// Strict version for Stage 2 validation - requires Yes/No/NA answer
const recommendationStage2Schema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.enum(["Yes", "No", "NA"], { errorMap: () => ({ message: "Please select Yes, No, or NA" }) }),
  comment: z.string().optional(),
});

const appraiserCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

const seafarerCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

// Part G schemas
const officeReviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  feedback: z.string(),
});

const trainingFollowupSchema = z.object({
  id: z.string(),
  training: z.string(),
  correspondingInDB: z.string(),
  category: z.string(),
  status: z.enum(["Proposed", "Approved", "Planned", "Declined", "Completed"]),
  targetDate: z.string().optional(),
  comment: z.string().optional(),
});

// Part A schema
const partASchema = z.object({
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().min(1, "Nationality is required"),
  vessel: z.string().min(1, "Vessel is required"),
  signOn: z.string().optional(),
  appraisalType: z.string().min(1, "Appraisal type is required"),
  appraisalPeriodFrom: z.string().optional(),
  appraisalPeriodTo: z.string().optional(),
  personalityIndexCategory: z.string().optional(),
  primaryAppraiser: z.string().optional(),
});

// Part B schema (for full form validation)
const partBSchema = z.object({
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),
});

// Part B schema for Stage 1 (evaluation optional, empty arrays allowed)
const partBStage1Schema = z.object({
  trainings: z.array(trainingStage1Schema).default([]),
  targets: z.array(targetStage1Schema).default([]),
});

// Part C schema
const partCSchema = z.object({
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),
});

// Part D schema
const partDSchema = z.object({
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),
});

// Part E schema
const partESchema = z.object({
  trainingNeeds: z.array(trainingNeedsSchema).default([]),
});

// Part F schema (for draft saves - allows empty answers)
const partFSchema = z.object({
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.array(appraiserCommentSchema).default([]),
  seafarerComments: z.array(seafarerCommentSchema).default([]),
});

// Part F schema for Stage 2 validation (requires Yes/No/NA answers)
const partFStage2Schema = z.object({
  recommendations: z.array(recommendationStage2Schema).default([]),
  appraiserComments: z.array(appraiserCommentSchema).default([]),
  seafarerComments: z.array(seafarerCommentSchema).default([]),
});

// Part G schema
const partGSchema = z.object({
  officeReviews: z.array(officeReviewSchema).default([]),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

// Stage-specific schemas for validation
// Stage 1: Parts A & B (Target Setting) - evaluation optional, empty arrays allowed
const stage1Schema = partASchema.merge(partBStage1Schema);

// Stage 2: Parts C, D, E, F (Performance Assessment) - requires recommendation answers
const stage2Schema = partCSchema.merge(partDSchema).merge(partESchema).merge(partFStage2Schema);

// Stage 3: Part G (Office Review)
const stage3Schema = partGSchema;

// Full appraisal schema (for draft saves and full validation)
const appraisalSchema = z.object({
  // Part A: Seafarer's Information
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().min(1, "Nationality is required"),
  vessel: z.string().min(1, "Vessel is required"),
  signOn: z.string().optional(),
  appraisalType: z.string().min(1, "Appraisal type is required"),
  appraisalPeriodFrom: z.string().optional(),
  appraisalPeriodTo: z.string().optional(),
  personalityIndexCategory: z.string().optional(),
  primaryAppraiser: z.string().optional(),
  
  // Part B: Information at Start of Appraisal Period
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),
  
  // Part C: Competence Assessment
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),
  
  // Part D: Behavioural Assessment
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),
  
  // Part E: Training Needs & Development
  trainingNeeds: z.array(trainingNeedsSchema).default([]),
  
  // Part F: Comments & Recommendations
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.array(appraiserCommentSchema).default([]),
  seafarerComments: z.array(seafarerCommentSchema).default([]),
  
  // Part G: Office Review & Followup
  officeReviews: z.array(officeReviewSchema).default([]),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

type AppraisalFormData = z.infer<typeof appraisalSchema>;

interface ExistingAppraisal {
  id: number;
  appraisalData: string | AppraisalFormData;
  status: 'draft' | 'preliminary' | 'submitted' | 'reviewed';
}

interface AppraisalFormProps {
  crewMember?: {
    id: string;
    name: { first: string; middle: string; last: string };
    rank: string;
    vessel: string;
    nationality?: string;
    signOn?: string;
    vesselType?: string;
  };
  appraisalId?: number;
  initialStatus?: 'draft' | 'preliminary' | 'submitted' | 'reviewed';
  onClose: () => void;
}

export const AppraisalForm: React.FC<AppraisalFormProps> = ({ crewMember, appraisalId: propAppraisalId, initialStatus = 'draft', onClose }) => {
  const [activeSection, setActiveSection] = useState("A");
  const [activeContinuousSection1, setActiveContinuousSection1] = useState('A'); // For A&B continuous scroll
  const [activeContinuousSection2, setActiveContinuousSection2] = useState('C'); // For C-F continuous scroll
  const [editingTraining, setEditingTraining] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [trainingComments, setTrainingComments] = useState<{[key: string]: string}>({});
  const [targetComments, setTargetComments] = useState<{[key: string]: string}>({});
  const [competenceComments, setCompetenceComments] = useState<{[key: string]: string}>({});
  const [behaviouralComments, setBehaviouralComments] = useState<{[key: string]: string}>({});
  const [trainingNeedsComments, setTrainingNeedsComments] = useState<{[key: string]: string}>({});
  const [recommendationComments, setRecommendationComments] = useState<{[key: string]: string}>({});
  const [trainingFollowupComments, setTrainingFollowupComments] = useState<{[key: string]: string}>({});
  const [isTrainingNeedsDialogOpen, setIsTrainingNeedsDialogOpen] = useState(false);
  const [isTrainingFollowupDialogOpen, setIsTrainingFollowupDialogOpen] = useState(false);
  const [editingAppraiserComment, setEditingAppraiserComment] = useState<string | null>(null);
  const [editingSeafarerComment, setEditingSeafarerComment] = useState<string | null>(null);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [editingOfficeReview, setEditingOfficeReview] = useState<string | null>(null);
  const [appraisalId, setAppraisalId] = useState<number | null>(propAppraisalId || null);
  const [appraisalStatus, setAppraisalStatus] = useState<'draft' | 'preliminary' | 'submitted' | 'reviewed'>(initialStatus);
  
  // Derive whether to show evaluation column in Part B
  const showEvaluation = ['submitted', 'reviewed'].includes(appraisalStatus);
  
  // Section references using canonical Part IDs
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const partCRef = useRef<HTMLDivElement>(null);
  const partDRef = useRef<HTMLDivElement>(null);
  const partERef = useRef<HTMLDivElement>(null);
  const partFRef = useRef<HTMLDivElement>(null);
  const partGRef = useRef<HTMLDivElement>(null);

  // Scroll container references for continuous groups
  const continuous1ContainerRef = useRef<HTMLDivElement>(null);
  const continuous2ContainerRef = useRef<HTMLDivElement>(null);
  
  // States for tracking which comments are being edited
  const [editingTrainingComment, setEditingTrainingComment] = useState<string | null>(null);
  const [editingTargetComment, setEditingTargetComment] = useState<string | null>(null);
  const [editingCompetenceComment, setEditingCompetenceComment] = useState<string | null>(null);
  const [editingBehaviouralComment, setEditingBehaviouralComment] = useState<string | null>(null);
  const [editingTrainingNeedsComment, setEditingTrainingNeedsComment] = useState<string | null>(null);
  const [editingRecommendationComment, setEditingRecommendationComment] = useState<string | null>(null);
  const [editingTrainingFollowupComment, setEditingTrainingFollowupComment] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {}
  });

  // Hidden fields/sections from rank group configuration
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);

  // Helper functions to check visibility based on rank group config
  const isFieldVisible = useCallback((fieldName: string) => {
    return !hiddenFields.includes(fieldName);
  }, [hiddenFields]);
  
  const isSectionVisible = useCallback((sectionName: string) => {
    return !hiddenSections.includes(sectionName);
  }, [hiddenSections]);

  // Fetch vessels and ranks from persistent storage
  const { vessels } = useVesselLookup();
  const { data: availableRanks = [] } = useQuery<Array<{ id: number; name: string; category: string }>>({
    queryKey: ['/api/available-ranks'],
  });
  
  // Fetch appraisal types from Master 023
  const { data: appraisalTypesRaw = [] } = useMasterDataEntries('023');
  const appraisalTypes = useMemo(() => {
    return appraisalTypesRaw.map((entry: any) => ({
      id: entry.entryId || entry.entry_id,
      name: entry.name,
      value: entry.name.toLowerCase().replace(/\s+/g, '-')
    }));
  }, [appraisalTypesRaw]);

  // Fetch form configuration based on crew member's rank
  // Note: queryKey[0] is used as the URL by the default fetcher, so include full URL path
  const { data: formConfig, isLoading: isLoadingFormConfig } = useQuery({
    queryKey: [`/api/forms/for-rank/${encodeURIComponent(crewMember?.rank || '')}`],
    enabled: !!crewMember?.rank,
  });

  // Log form configuration for debugging
  useEffect(() => {
    if (formConfig) {
      console.log('✅ Form configuration loaded for rank:', crewMember?.rank, formConfig);
    }
  }, [formConfig, crewMember?.rank]);

  // Fetch existing appraisal data when editing
  // Note: queryKey must include full URL since default fetcher uses queryKey[0] as the URL
  const { data: existingAppraisal } = useQuery<ExistingAppraisal | undefined>({
    queryKey: [`/api/appraisals/${appraisalId}`],
    enabled: !!appraisalId,
  });

  const { toast } = useToast();

  const form = useForm<AppraisalFormData>({
    resolver: zodResolver(appraisalSchema),
    defaultValues: {
      seafarersName: crewMember ? `${crewMember.name.first} ${crewMember.name.middle} ${crewMember.name.last}`.trim() : "",
      seafarersRank: crewMember?.rank || "",
      nationality: crewMember?.nationality || "",
      vessel: crewMember?.vessel || "",
      signOn: crewMember?.signOn || "",
      appraisalType: "",
      appraisalPeriodFrom: crewMember?.signOn || "",
      appraisalPeriodTo: "",
      personalityIndexCategory: "",
      primaryAppraiser: "",
      trainings: [],
      targets: [],
      competenceAssessments: [
        { id: "1", assessmentCriteria: "Safety Performance and Open Reporting", weight: 10, effectiveness: "", comment: "" },
        { id: "2", assessmentCriteria: "Shipboard operational performance & technical skills - Navigation", weight: 10, effectiveness: "", comment: "" },
        { id: "3", assessmentCriteria: "Assessment Criteria 3", weight: 10, effectiveness: "", comment: "" },
        { id: "4", assessmentCriteria: "Assessment Criteria 4", weight: 10, effectiveness: "", comment: "" },
        { id: "5", assessmentCriteria: "Assessment Criteria 5", weight: 10, effectiveness: "", comment: "" },
        { id: "6", assessmentCriteria: "Assessment Criteria 6", weight: 10, effectiveness: "", comment: "" },
        { id: "7", assessmentCriteria: "Assessment Criteria 7", weight: 10, effectiveness: "", comment: "" },
        { id: "8", assessmentCriteria: "Assessment Criteria 8", weight: 10, effectiveness: "", comment: "" },
        { id: "9", assessmentCriteria: "Assessment Criteria 9", weight: 10, effectiveness: "", comment: "" },
        { id: "10", assessmentCriteria: "Assessment Criteria 10", weight: 10, effectiveness: "", comment: "" }
      ],

      behaviouralAssessments: [
        { id: "1", assessmentCriteria: "Leadership", weight: 10, effectiveness: "", comment: "" },
        { id: "2", assessmentCriteria: "Attitude", weight: 10, effectiveness: "", comment: "" },
        { id: "3", assessmentCriteria: "Emotional Intelligence", weight: 10, effectiveness: "", comment: "" },
        { id: "4", assessmentCriteria: "Work Ethics", weight: 10, effectiveness: "", comment: "" },
        { id: "5", assessmentCriteria: "Situational Awareness", weight: 10, effectiveness: "", comment: "" },
        { id: "6", assessmentCriteria: "Decision Making", weight: 10, effectiveness: "", comment: "" },
        { id: "7", assessmentCriteria: "Teamwork", weight: 10, effectiveness: "", comment: "" },
        { id: "8", assessmentCriteria: "Assessment Criteria 8", weight: 10, effectiveness: "", comment: "" },
        { id: "9", assessmentCriteria: "Assessment Criteria 9", weight: 10, effectiveness: "", comment: "" },
        { id: "10", assessmentCriteria: "Assessment Criteria 10", weight: 10, effectiveness: "", comment: "" }
      ],

      trainingNeeds: [],
      
      // Part F: Comments & Recommendations
      recommendations: [
        { id: "1", question: "Recommended for continued service on board?", answer: "", comment: "" },
        { id: "2", question: "Recommended for re-employment?", answer: "", comment: "" },
        { id: "3", question: "Recommended for promotion?", answer: "", comment: "" },
        { id: "4", question: "Career Development recommendations (If Any)?", answer: "", comment: "" },
      ],
      appraiserComments: [
        { id: "primary", name: "", rank: "", comment: "" }
      ],
      seafarerComments: [
        { id: "seafarer", name: "", rank: "", comment: "" }
      ],
      
      // Part G: Office Review & Followup - Start with empty reviews (use Add Reviewer to add)
      officeReviews: [],
      trainingFollowups: [
        { id: "1", training: "Training 1", correspondingInDB: "Select Training from DB", category: "Select Rating", status: "Proposed", targetDate: "", comment: "" },
        { id: "2", training: "Training 2", correspondingInDB: "Select Training from DB", category: "1. Competence", status: "Approved", targetDate: "", comment: "" },
        { id: "3", training: "Training 3", correspondingInDB: "Select Training from DB", category: "2- Soft Skills", status: "Planned", targetDate: "", comment: "" },
        { id: "4", training: "Training 4", correspondingInDB: "Select Training from DB", category: "1. Competence", status: "Declined", targetDate: "", comment: "The officer will no longer be sent on this type of vessel, so this training is not required." },
        { id: "5", training: "Training 5", correspondingInDB: "Select Training from DB", category: "2- Soft Skills", status: "Completed", targetDate: "", comment: "" }
      ],
    },
  });

  // Pre-populate crew member fields when data loads (only for new appraisals)
  useEffect(() => {
    // Only for new appraisals - existing appraisals will be populated from existingAppraisal data
    if (!appraisalId && crewMember) {
      const currentValues = form.getValues();
      const updates: Partial<AppraisalFormData> = {};
      
      // Pre-populate seafarer's rank if not already set
      if (!currentValues.seafarersRank && crewMember.rank) {
        updates.seafarersRank = crewMember.rank;
      }
      
      // Pre-populate sign on date if not already set
      if (!currentValues.signOn && crewMember.signOn) {
        updates.signOn = crewMember.signOn;
      }
      
      // Pre-populate seafarer's name if not already set
      if (!currentValues.seafarersName && crewMember.name) {
        const fullName = `${crewMember.name.first || ''} ${crewMember.name.middle || ''} ${crewMember.name.last || ''}`.trim();
        if (fullName) {
          updates.seafarersName = fullName;
        }
      }
      
      // Pre-populate nationality if not already set
      if (!currentValues.nationality && crewMember.nationality) {
        updates.nationality = crewMember.nationality;
      }
      
      // Pre-populate vessel if not already set
      if (!currentValues.vessel && crewMember.vessel) {
        updates.vessel = crewMember.vessel;
      }
      
      // Pre-populate appraisal period from (same as sign on date)
      if (!currentValues.appraisalPeriodFrom && crewMember.signOn) {
        updates.appraisalPeriodFrom = crewMember.signOn;
      }
      
      // Pre-populate seafarer comment entry with crew member's name and rank
      if (currentValues.seafarerComments.length === 0) {
        const fullName = `${crewMember.name?.first || ''} ${crewMember.name?.middle || ''} ${crewMember.name?.last || ''}`.trim();
        updates.seafarerComments = [{
          id: `seafarer-${Date.now()}`,
          name: fullName || '',
          rank: crewMember.rank || '',
          comment: ''
        }];
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('📋 Pre-populating crew member fields:', Object.keys(updates));
        form.reset({ ...currentValues, ...updates }, { keepDefaultValues: false });
      }
    }
  }, [crewMember, appraisalId, form]);

  // Load rank-group-specific configuration when available (only for new appraisals)
  useEffect(() => {
    const config = formConfig as any;
    console.log('🔄 Config loading effect triggered:', { 
      hasConfig: !!config, 
      hasRankGroupConfig: !!config?.rankGroupConfig,
      appraisalId,
      competenceCount: config?.rankGroupConfig?.competenceAssessments?.length 
    });
    
    // Skip loading rank group defaults if we have existing appraisal data
    // existingAppraisal is loaded via useQuery and will populate the form separately
    if (config?.rankGroupConfig && !appraisalId) {
      console.log('📋 Loading rank group configuration (new appraisal):', config.rankGroupName);
      
      // Get current form values and merge with config values
      const currentValues = form.getValues();
      const updates: Partial<AppraisalFormData> = {};
      
      // Load competence assessments from rank group config
      if (config.rankGroupConfig.competenceAssessments && config.rankGroupConfig.competenceAssessments.length > 0) {
        updates.competenceAssessments = config.rankGroupConfig.competenceAssessments.map((ca: any) => ({
          id: ca.id,
          assessmentCriteria: ca.assessmentCriteria,
          weight: ca.weight,
          effectiveness: ca.effectiveness || '',
          comment: ca.comment || '',
        }));
        console.log('📋 Will set competenceAssessments:', updates.competenceAssessments.length, 'items');
      }
      
      // Load behavioural assessments from rank group config
      if (config.rankGroupConfig.behaviouralAssessments && config.rankGroupConfig.behaviouralAssessments.length > 0) {
        updates.behaviouralAssessments = config.rankGroupConfig.behaviouralAssessments.map((ba: any) => ({
          id: ba.id,
          assessmentCriteria: ba.assessmentCriteria,
          weight: ba.weight,
          effectiveness: ba.effectiveness || '',
          comment: ba.comment || '',
        }));
        console.log('📋 Will set behaviouralAssessments:', updates.behaviouralAssessments.length, 'items');
      }
      
      // Load recommendations from rank group config
      if (config.rankGroupConfig.recommendations && config.rankGroupConfig.recommendations.length > 0) {
        updates.recommendations = config.rankGroupConfig.recommendations.map((rec: any) => ({
          id: rec.id,
          question: rec.recommendation || rec.question,
          answer: rec.yes ? 'Yes' : rec.no ? 'No' : rec.na ? 'NA' : '',
          comment: rec.comment || '',
        }));
        console.log('📋 Will set recommendations:', updates.recommendations.length, 'items');
      }
      
      // Use form.reset() to apply all updates at once - this triggers proper re-renders
      if (Object.keys(updates).length > 0) {
        console.log('📋 Resetting form with config values');
        form.reset({ ...currentValues, ...updates }, { keepDefaultValues: false });
      }
    }
    
    // Always load hidden fields/sections from rank group config
    if (config?.rankGroupConfig) {
      if (config.rankGroupConfig.hiddenFields && Array.isArray(config.rankGroupConfig.hiddenFields)) {
        setHiddenFields(config.rankGroupConfig.hiddenFields);
        console.log('📋 Hidden fields loaded:', config.rankGroupConfig.hiddenFields);
      }
      
      if (config.rankGroupConfig.hiddenSections && Array.isArray(config.rankGroupConfig.hiddenSections)) {
        setHiddenSections(config.rankGroupConfig.hiddenSections);
        console.log('📋 Hidden sections loaded:', config.rankGroupConfig.hiddenSections);
      }
    }
  }, [formConfig, form, appraisalId]);

  // Mutation for saving appraisal (uses PUT for existing, POST for new)
  const saveAppraisalMutation = useMutation({
    mutationFn: async (payload: { data: AppraisalFormData; status: string; existingId?: number | null }) => {
      if (!crewMember?.id) {
        throw new Error('Crew member ID is required to save appraisal');
      }

      // Helper function to calculate competence score from assessments
      const calcCompetenceScore = (assessments: any[]) => {
        let totalScore = 0;
        let totalWeight = 0;
        assessments?.forEach(assessment => {
          if (assessment.effectiveness && assessment.weight) {
            let rating = 0;
            switch (assessment.effectiveness) {
              case "5-exceeds-expectations": rating = 5; break;
              case "4-meets-expectations": rating = 4; break;
              case "3-somewhat-meets-expectations": rating = 3; break;
              case "2-below-expectations": rating = 2; break;
              case "1-significantly-below-expectations": rating = 1; break;
            }
            totalScore += (rating * assessment.weight) / 100;
            totalWeight += assessment.weight;
          }
        });
        return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : null;
      };

      // Helper function to calculate behavioral score from assessments
      const calcBehavioralScore = (assessments: any[]) => {
        let totalScore = 0;
        let totalWeight = 0;
        assessments?.forEach(assessment => {
          if (assessment.effectiveness && assessment.weight) {
            let rating = 0;
            switch (assessment.effectiveness) {
              case "5-exceeds-expectations": rating = 5; break;
              case "4-meets-expectations": rating = 4; break;
              case "3-somewhat-meets-expectations": rating = 3; break;
              case "2-below-expectations": rating = 2; break;
              case "1-significantly-below-expectations": rating = 1; break;
            }
            totalScore += (rating * assessment.weight) / 100;
            totalWeight += assessment.weight;
          }
        });
        return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : null;
      };

      // Calculate ratings from form data
      const competenceScore = calcCompetenceScore(payload.data.competenceAssessments);
      const behavioralScore = calcBehavioralScore(payload.data.behaviouralAssessments);
      const overallScore = (competenceScore && behavioralScore) 
        ? ((parseFloat(competenceScore) + parseFloat(behavioralScore)) / 2).toFixed(1) 
        : null;

      // Transform form data to backend schema
      const appraisalPayload = {
        crewMemberId: crewMember.id,
        formId: 1, // Default form ID
        appraisalType: payload.data.appraisalType,
        appraisalDate: new Date().toISOString().split('T')[0],
        appraisalData: payload.data, // Send as object - backend handles JSON.stringify
        competenceRating: competenceScore,
        behavioralRating: behavioralScore,
        overallRating: overallScore,
        submittedBy: "Current User", // TODO: Replace with actual user
        status: payload.status,
      };

      // Use PUT for existing appraisals, POST for new ones
      const idToUse = payload.existingId || appraisalId;
      const method = idToUse ? 'PUT' : 'POST';
      const url = idToUse ? `/api/appraisals/${idToUse}` : '/api/appraisals';
      
      console.log(`📤 ${method} ${url}:`, appraisalPayload);
      const response = await apiRequest(method, url, appraisalPayload);
      const result = await response.json();
      console.log('✅ Appraisal saved successfully:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('🎉 Mutation onSuccess called', data);
      if (data && data.id) {
        setAppraisalId(data.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] });
      toast({
        title: variables.status === 'draft' ? 'Draft Saved' : 'Appraisal Submitted',
        description: variables.status === 'draft' 
          ? 'Your appraisal draft has been saved successfully. You can now submit stages.' 
          : 'Your appraisal has been submitted successfully.',
      });
      // Don't close on draft save, allow stage submissions
      if (variables.status !== 'draft') {
        onClose();
      }
    },
    onError: (error: any) => {
      console.error('❌ Mutation onError called:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save appraisal. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Stage 1 mutation (Parts A & B)
  const stage1Mutation = useMutation({
    mutationFn: async (appraisalId: number) => {
      const formData = form.getValues();
      const stageData = {
        seafarersName: formData.seafarersName,
        seafarersRank: formData.seafarersRank,
        nationality: formData.nationality,
        vessel: formData.vessel,
        signOn: formData.signOn,
        appraisalType: formData.appraisalType,
        appraisalPeriodFrom: formData.appraisalPeriodFrom,
        appraisalPeriodTo: formData.appraisalPeriodTo,
        personalityIndexCategory: formData.personalityIndexCategory,
        primaryAppraiser: formData.primaryAppraiser,
        trainings: formData.trainings,
        targets: formData.targets,
      };
      
      const response = await apiRequest('POST', `/api/appraisals/${appraisalId}/submit-stage1`, {
        data: stageData,
        submittedBy: 'Current User',
      });
      return response.json();
    },
    onSuccess: () => {
      setAppraisalStatus('preliminary');
      queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
      toast({ title: 'Stage 1 submitted' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit Stage 1', variant: 'destructive' });
    },
  });

  // Stage 2 mutation (Parts C, D, E, F)
  const stage2Mutation = useMutation({
    mutationFn: async (appraisalId: number) => {
      const formData = form.getValues();
      const stageData = {
        competenceAssessments: formData.competenceAssessments,
        behaviouralAssessments: formData.behaviouralAssessments,
        trainingNeeds: formData.trainingNeeds,
        recommendations: formData.recommendations,
        appraiserComments: formData.appraiserComments,
        seafarerComments: formData.seafarerComments,
      };
      
      const response = await apiRequest('POST', `/api/appraisals/${appraisalId}/submit-stage2`, {
        data: stageData,
        submittedBy: 'Current User',
      });
      return response.json();
    },
    onSuccess: () => {
      setAppraisalStatus('submitted');
      queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
      toast({ title: 'Stage 2 Submitted', description: 'Performance assessment (Parts C-F) submitted successfully.' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit Stage 2', variant: 'destructive' });
    },
  });

  // Stage 3 mutation (Part G)
  const stage3Mutation = useMutation({
    mutationFn: async (appraisalId: number) => {
      const formData = form.getValues();
      const stageData = {
        officeReviews: formData.officeReviews,
        trainingFollowups: formData.trainingFollowups,
      };
      
      const response = await apiRequest('POST', `/api/appraisals/${appraisalId}/submit-stage3`, {
        data: stageData,
        submittedBy: 'Current User',
      });
      return response.json();
    },
    onSuccess: () => {
      setAppraisalStatus('reviewed');
      queryClient.invalidateQueries({ queryKey: ['/api/appraisals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${appraisalId}`] });
      toast({ title: 'Stage 3 Submitted', description: 'Office review (Part G) submitted successfully. Form is now locked.' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit Stage 3', variant: 'destructive' });
    },
  });

  // Hydrate form and status when editing existing appraisal
  useEffect(() => {
    if (existingAppraisal && existingAppraisal.appraisalData) {
      try {
        const parsedData = typeof existingAppraisal.appraisalData === 'string' 
          ? JSON.parse(existingAppraisal.appraisalData) 
          : existingAppraisal.appraisalData;
        
        // Reset form with existing data
        form.reset(parsedData);
        
        // Update status from fetched data
        if (existingAppraisal.status && ['draft', 'preliminary', 'submitted', 'reviewed'].includes(existingAppraisal.status)) {
          setAppraisalStatus(existingAppraisal.status as 'draft' | 'preliminary' | 'submitted' | 'reviewed');
        }
        
        console.log('✅ Hydrated form with existing appraisal data:', existingAppraisal);
      } catch (error) {
        console.error('❌ Failed to parse appraisal data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load appraisal data. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [existingAppraisal, form, toast]);

  // Shared handler for stage submissions (auto-saves draft if needed)
  const handleStageSubmission = async (stage: 'stage1' | 'stage2' | 'stage3') => {
    const formData = form.getValues();
    
    // Validate stage-specific data
    try {
      if (stage === 'stage1') {
        stage1Schema.parse(formData);
      } else if (stage === 'stage2') {
        stage2Schema.parse(formData);
      } else if (stage === 'stage3') {
        stage3Schema.parse(formData);
      }
    } catch (error: any) {
      toast({ 
        title: 'Validation Error', 
        description: error.errors?.[0]?.message || 'Please complete all required fields for this stage.', 
        variant: 'destructive' 
      });
      return;
    }
    
    let idToUse = appraisalId;
    
    // If no appraisalId, save as draft first
    if (!idToUse) {
      try {
        const result = await saveAppraisalMutation.mutateAsync({ data: formData, status: 'draft' });
        if (result && result.id) {
          idToUse = result.id;
          setAppraisalId(result.id);
        } else {
          toast({ title: 'Error', description: 'Failed to save draft. Please try again.', variant: 'destructive' });
          return;
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to save draft. Please try again.', variant: 'destructive' });
        return;
      }
    }
    
    // Ensure idToUse is non-null before calling mutations
    if (idToUse === null) {
      toast({ title: 'Error', description: 'Appraisal ID is required to submit stage.', variant: 'destructive' });
      return;
    }
    
    // Trigger the appropriate stage mutation with guaranteed non-null ID
    if (stage === 'stage1') {
      stage1Mutation.mutate(idToUse);
    } else if (stage === 'stage2') {
      stage2Mutation.mutate(idToUse);
    } else if (stage === 'stage3') {
      stage3Mutation.mutate(idToUse);
    }
  };

  const onSubmit = (data: AppraisalFormData) => {
    console.log('🔵 onSubmit called with data:', data);
    console.log('🔵 Mutation isPending:', saveAppraisalMutation.isPending);
    saveAppraisalMutation.mutate({ data, status: 'draft' });
  };

  const handleSaveDraft = () => {
    console.log('💾 handleSaveDraft called - bypassing validation');
    const data = form.getValues();
    console.log('💾 Form values:', data);
    console.log('💾 Form errors (ignored for draft):', form.formState.errors);
    // Preserve current workflow status after Stage 1 or Stage 2 submission
    // Only use 'draft' status before Stage 1 has been submitted
    const statusToSave = appraisalStatus === 'draft' ? 'draft' : appraisalStatus;
    console.log('💾 Preserving status:', statusToSave);
    saveAppraisalMutation.mutate({ data, status: statusToSave });
  };

  const onSubmitAppraisal = () => {
    console.log('🟢 onSubmitAppraisal called');
    console.log('🟢 Form errors:', form.formState.errors);
    form.handleSubmit((data) => {
      console.log('🟢 Submit handler called with data:', data);
      saveAppraisalMutation.mutate({ data, status: 'submitted' });
    })();
  };

  // Helper function to show confirmation dialog
  const showConfirmDialog = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      onConfirm
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: "",
      description: "",
      onConfirm: () => {}
    });
  };

  // Training management functions
  const addTraining = () => {
    const newTraining = {
      id: Date.now().toString(),
      training: "",
      evaluation: "",
      comment: "",
    };
    const currentTrainings = form.getValues("trainings");
    form.setValue("trainings", [...currentTrainings, newTraining]);
  };

  const deleteTraining = (id: string) => {
    showConfirmDialog(
      "Delete Training",
      "Are you sure you want to delete this training record?",
      () => {
        const currentTrainings = form.getValues("trainings");
        form.setValue("trainings", currentTrainings.filter(t => t.id !== id));
        setTrainingComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        closeConfirmDialog();
      }
    );
  };

  const updateTraining = (id: string, field: string, value: string) => {
    const currentTrainings = form.getValues("trainings");
    const updatedTrainings = currentTrainings.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("trainings", updatedTrainings);
  };

  // Target management functions
  const addTarget = () => {
    const newTarget = {
      id: Date.now().toString(),
      targetSetting: "",
      evaluation: "",
      comment: "",
    };
    const currentTargets = form.getValues("targets");
    form.setValue("targets", [...currentTargets, newTarget]);
  };

  const deleteTarget = (id: string) => {
    showConfirmDialog(
      "Delete Target",
      "Are you sure you want to delete this target?",
      () => {
        const currentTargets = form.getValues("targets");
        form.setValue("targets", currentTargets.filter(t => t.id !== id));
        setTargetComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        closeConfirmDialog();
      }
    );
  };

  const updateTarget = (id: string, field: string, value: string) => {
    const currentTargets = form.getValues("targets");
    const updatedTargets = currentTargets.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("targets", updatedTargets);
  };

  // Competence Assessment management functions
  const updateCompetenceAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = form.getValues("competenceAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    form.setValue("competenceAssessments", updatedAssessments);
  };

  // Behavioural Assessment management functions
  const updateBehaviouralAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = form.getValues("behaviouralAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    form.setValue("behaviouralAssessments", updatedAssessments);
  };

  // Helper function to get score colors based on rating value
  const getScoreColors = (score: number) => {
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

  // Calculate section score based on weight and effectiveness
  const calculateSectionScore = () => {
    const assessments = form.watch("competenceAssessments");
    let totalScore = 0;
    let totalWeight = 0;
    
    assessments.forEach(assessment => {
      if (assessment.effectiveness && assessment.weight) {
        let rating = 0;
        switch (assessment.effectiveness) {
          case "5-exceeds-expectations": rating = 5; break;
          case "4-meets-expectations": rating = 4; break;
          case "3-somewhat-meets-expectations": rating = 3; break;
          case "2-below-expectations": rating = 2; break;
          case "1-significantly-below-expectations": rating = 1; break;
        }
        totalScore += (rating * assessment.weight) / 100;
        totalWeight += assessment.weight;
      }
    });
    
    return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : "0.0";
  };

  // Calculate behavioural section score
  const calculateBehaviouralSectionScore = () => {
    const assessments = form.watch("behaviouralAssessments");
    let totalScore = 0;
    let totalWeight = 0;
    
    assessments.forEach(assessment => {
      if (assessment.effectiveness && assessment.weight) {
        let rating = 0;
        switch (assessment.effectiveness) {
          case "5-exceeds-expectations": rating = 5; break;
          case "4-meets-expectations": rating = 4; break;
          case "3-somewhat-meets-expectations": rating = 3; break;
          case "2-below-expectations": rating = 2; break;
          case "1-significantly-below-expectations": rating = 1; break;
        }
        totalScore += (rating * assessment.weight) / 100;
        totalWeight += assessment.weight;
      }
    });
    
    return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : "0.0";
  };

  // Comment management helper functions
  const deleteTrainingComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTrainingComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingTrainingComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteTargetComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTargetComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingTargetComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteCompetenceComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setCompetenceComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingCompetenceComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteBehaviouralComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setBehaviouralComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingBehaviouralComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteTrainingNeedsComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTrainingNeedsComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingTrainingNeedsComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteRecommendationComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setRecommendationComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingRecommendationComment(null);
        closeConfirmDialog();
      }
    );
  };
  
  const deleteTrainingFollowupComment = (id: string) => {
    showConfirmDialog(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      () => {
        setTrainingFollowupComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        setEditingTrainingFollowupComment(null);
        closeConfirmDialog();
      }
    );
  };

  // Training Needs management functions
  const addTrainingNeed = (type: 'database' | 'new') => {
    if (type === 'database') {
      setIsTrainingNeedsDialogOpen(true);
      return;
    }
    const newTrainingNeed = {
      id: Date.now().toString(),
      training: "",
      comment: "",
    };
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    form.setValue("trainingNeeds", [...currentTrainingNeeds, newTrainingNeed]);
  };

  const addTrainingNeedsFromDatabase = (selectedTemplates: TrainingCourseTemplate[]) => {
    const newTrainingNeeds = selectedTemplates.map((template) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      training: template.name,
      comment: "",
    }));
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    form.setValue("trainingNeeds", [...currentTrainingNeeds, ...newTrainingNeeds]);
    setIsTrainingNeedsDialogOpen(false);
  };

  const handleTrainingNeedsSelect = (templates: any[]) => {
    addTrainingNeedsFromDatabase(templates);
  };

  const deleteTrainingNeed = (id: string) => {
    showConfirmDialog(
      "Delete Training Need",
      "Are you sure you want to delete this training need?",
      () => {
        const currentTrainingNeeds = form.getValues("trainingNeeds");
        form.setValue("trainingNeeds", currentTrainingNeeds.filter(t => t.id !== id));
        setTrainingNeedsComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        closeConfirmDialog();
      }
    );
  };

  const updateTrainingNeed = (id: string, field: string, value: string) => {
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    const updatedTrainingNeeds = currentTrainingNeeds.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("trainingNeeds", updatedTrainingNeeds);
  };

  // Calculate overall score (F1)
  const calculateOverallScore = () => {
    const competenceScore = parseFloat(calculateSectionScore());
    const behaviouralScore = parseFloat(calculateBehaviouralSectionScore());
    return ((competenceScore + behaviouralScore) / 2).toFixed(1);
  };

  // Recommendation management functions
  const updateRecommendation = (id: string, field: string, value: string) => {
    const currentRecommendations = form.getValues("recommendations");
    const updatedRecommendations = currentRecommendations.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    form.setValue("recommendations", updatedRecommendations);
  };

  // Appraiser Comments management
  const addAppraiserComment = (name: string, rank: string) => {
    const newComment = {
      id: Date.now().toString(),
      name,
      rank,
      comment: "",
    };
    const currentComments = form.getValues("appraiserComments");
    form.setValue("appraiserComments", [...currentComments, newComment]);
    setEditingAppraiserComment(newComment.id);
  };

  const updateAppraiserComment = (id: string, field: string, value: string) => {
    const currentComments = form.getValues("appraiserComments");
    const updatedComments = currentComments.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
    form.setValue("appraiserComments", updatedComments);
  };

  const deleteAppraiserComment = (id: string) => {
    showConfirmDialog(
      "Delete Appraiser Comment",
      "Are you sure you want to delete this appraiser comment?",
      () => {
        const currentComments = form.getValues("appraiserComments");
        form.setValue("appraiserComments", currentComments.filter(c => c.id !== id));
        closeConfirmDialog();
      }
    );
  };

  // Seafarer Comments management
  const updateSeafarerComment = (id: string, field: string, value: string) => {
    const currentComments = form.getValues("seafarerComments");
    const updatedComments = currentComments.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
    form.setValue("seafarerComments", updatedComments);
  };

  // Parameter-less wrappers for Part component props
  const addAppraiserCommentNoArgs = () => addAppraiserComment("", "");
  const addTrainingFollowupNoArgs = () => {
    const newFollowup = {
      id: Date.now().toString(),
      training: "",
      correspondingInDB: "Select Training from DB",
      category: "Select Rating",
      status: "Proposed" as const,
      targetDate: "",
      comment: "",
    };
    const currentFollowups = form.getValues("trainingFollowups");
    form.setValue("trainingFollowups", [...currentFollowups, newFollowup]);
    setEditingTrainingFollowupComment(newFollowup.id);
  };

  // Office Review management
  const addOfficeReview = () => {
    // Get current user info from sessionStorage with fallbacks (guard for SSR/test environments)
    let currentUserName = 'Current User';
    let currentUserPosition = 'Office Staff';
    
    if (typeof window !== 'undefined' && window.sessionStorage) {
      currentUserName = sessionStorage.getItem('crewUserName') || 'Current User';
      currentUserPosition = sessionStorage.getItem('crewDesignation') || 'Office Staff';
    }
    
    const newReview = {
      id: Date.now().toString(),
      name: currentUserName,
      position: currentUserPosition,
      feedback: "",
    };
    const currentReviews = form.getValues("officeReviews");
    form.setValue("officeReviews", [...currentReviews, newReview]);
    setEditingOfficeReview(newReview.id);
  };

  const updateOfficeReview = (id: string, field: string, value: string) => {
    const currentReviews = form.getValues("officeReviews");
    const updatedReviews = currentReviews.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    form.setValue("officeReviews", updatedReviews);
  };

  const deleteOfficeReview = (id: string) => {
    showConfirmDialog(
      "Delete Office Review",
      "Are you sure you want to delete this office review?",
      () => {
        const currentReviews = form.getValues("officeReviews");
        form.setValue("officeReviews", currentReviews.filter(r => r.id !== id));
        closeConfirmDialog();
      }
    );
  };

  // Training Followup management
  const addTrainingFollowup = (type: 'database' | 'new') => {
    if (type === 'database') {
      setIsTrainingFollowupDialogOpen(true);
      return;
    }
    const newFollowup = {
      id: Date.now().toString(),
      training: "",
      correspondingInDB: "Select Training from DB",
      category: "Select Rating",
      status: "Proposed" as const,
      targetDate: "",
      comment: "",
    };
    const currentFollowups = form.getValues("trainingFollowups");
    form.setValue("trainingFollowups", [...currentFollowups, newFollowup]);
  };

  const addTrainingFollowupsFromDatabase = (selectedTemplates: TrainingCourseTemplate[]) => {
    const newFollowups = selectedTemplates.map((template) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      training: template.name,
      correspondingInDB: template.id,
      category: "Select Rating",
      status: "Proposed" as const,
      targetDate: "",
      comment: "",
    }));
    const currentFollowups = form.getValues("trainingFollowups");
    form.setValue("trainingFollowups", [...currentFollowups, ...newFollowups]);
    setIsTrainingFollowupDialogOpen(false);
  };

  const updateTrainingFollowup = (id: string, field: string, value: string) => {
    const currentFollowups = form.getValues("trainingFollowups");
    const updatedFollowups = currentFollowups.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    );
    form.setValue("trainingFollowups", updatedFollowups);
  };

  const deleteTrainingFollowup = (id: string) => {
    showConfirmDialog(
      "Delete Training Followup",
      "Are you sure you want to delete this training followup?",
      () => {
        const currentFollowups = form.getValues("trainingFollowups");
        form.setValue("trainingFollowups", currentFollowups.filter(f => f.id !== id));
        closeConfirmDialog();
      }
    );
  };

  const RatingRadioGroup = ({ name, label }: { name: string; label: string }) => (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between space-y-0 py-2">
          <FormLabel className="text-sm font-normal w-1/2">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="flex flex-row space-x-4"
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <div key={rating} className="flex items-center space-x-2">
                  <RadioGroupItem value={rating.toString()} id={`${name}-${rating}`} />
                  <Label htmlFor={`${name}-${rating}`} className="text-xs">{rating}</Label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Canonical sections array with proper Part IDs and refs
  // Mapping section IDs to hiddenSections keys
  const sectionIdToHiddenKey: Record<string, string> = {
    "B": "partB",
    "D": "partD",
  };
  
  const allSections = useMemo(() => [
    { id: "A", title: "Part A: Seafarer's Information", type: "continuous1", number: "A", ref: partARef },
    { id: "B", title: "Part B: Information at Start of Appraisal Period", type: "continuous1", number: "B", ref: partBRef },
    { id: "C", title: "Part C: Competence Assessment (Professional Knowledge & Skills)", type: "continuous2", number: "C", ref: partCRef },
    { id: "D", title: "Part D: Behavioural Assessment (Soft Skills)", type: "continuous2", number: "D", ref: partDRef },
    { id: "E", title: "Part E: Training Needs & Development", type: "continuous2", number: "E", ref: partERef },
    { id: "F", title: "Part F: Summary & Recommendations", type: "continuous2", number: "F", ref: partFRef },
    { id: "G", title: "Part G: Office Review & Followup", type: "stepper", number: "G", ref: partGRef },
  ], []); // Empty deps since refs are stable

  // Filter sections based on visibility configuration
  const sections = useMemo(() => {
    return allSections.filter(section => {
      const hiddenKey = sectionIdToHiddenKey[section.id];
      if (hiddenKey) {
        return isSectionVisible(hiddenKey);
      }
      return true; // Sections without a hiddenKey are always visible
    });
  }, [allSections, hiddenSections]);

  // Synchronize activeSection state when sections are hidden
  // If current active section is hidden, navigate to the first visible section
  useEffect(() => {
    if (sections.length === 0) return;
    
    const currentSectionVisible = sections.some(s => s.id === activeSection);
    if (!currentSectionVisible) {
      // Navigate to the first visible section
      const firstVisibleSection = sections[0];
      if (firstVisibleSection) {
        setActiveSection(firstVisibleSection.id);
      }
    }
    
    // Also synchronize continuous section states
    const continuous1Visible = sections.filter(s => s.type === 'continuous1');
    if (activeContinuousSection1 && !continuous1Visible.some(s => s.id === activeContinuousSection1)) {
      setActiveContinuousSection1(continuous1Visible[0]?.id || '');
    }
    
    const continuous2Visible = sections.filter(s => s.type === 'continuous2');
    if (activeContinuousSection2 && !continuous2Visible.some(s => s.id === activeContinuousSection2)) {
      setActiveContinuousSection2(continuous2Visible[0]?.id || '');
    }
  }, [sections, activeSection, activeContinuousSection1, activeContinuousSection2]);

  // Intersection Observer for continuous group 1 (A&B)
  useEffect(() => {
    if (!continuous1ContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        // Update the active continuous section if there's a significant intersection
        if (mostVisible && mostVisible.intersectionRatio > 0.6) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (sectionId && sectionId !== activeContinuousSection1) {
            setActiveContinuousSection1(sectionId);
          }
        }
      },
      {
        root: continuous1ContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-50px 0px -50px 0px'
      }
    );

    // Observe continuous1 sections (A&B)
    const continuous1Sections = sections.filter(s => s.type === 'continuous1');
    continuous1Sections.forEach(section => {
      if (section.ref?.current) {
        observer.observe(section.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [activeContinuousSection1, sections]);

  // Intersection Observer for continuous group 2 (C-F)
  useEffect(() => {
    if (!continuous2ContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        // Update the active continuous section if there's a significant intersection
        if (mostVisible && mostVisible.intersectionRatio > 0.6) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (sectionId && sectionId !== activeContinuousSection2) {
            setActiveContinuousSection2(sectionId);
          }
        }
      },
      {
        root: continuous2ContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-50px 0px -50px 0px'
      }
    );

    // Observe continuous2 sections (C-F)
    const continuous2Sections = sections.filter(s => s.type === 'continuous2');
    continuous2Sections.forEach(section => {
      if (section.ref?.current) {
        observer.observe(section.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [activeContinuousSection2, sections]);

  // Function to scroll to a specific section
  const scrollToSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section && section.ref?.current) {
      section.ref.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Function to handle section navigation with canonical IDs
  const handleSectionNavigation = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    if (section.type === 'continuous1') {
      // For continuous1 sections (A&B), stay in the continuous view and scroll to section
      if (!['A', 'B'].includes(activeSection)) {
        setActiveSection('A'); // Switch to continuous1 view
      }
      setTimeout(() => scrollToSection(sectionId), 100); // Small delay to ensure DOM is ready
    } else if (section.type === 'continuous2') {
      // For continuous2 sections (C-F), stay in the continuous view and scroll to section
      if (!['C', 'D', 'E', 'F'].includes(activeSection)) {
        setActiveSection('C'); // Switch to continuous2 view
      }
      setTimeout(() => scrollToSection(sectionId), 100); // Small delay to ensure DOM is ready
    } else {
      // For stepper sections (G), use traditional navigation and clear continuous section highlighting
      setActiveSection(sectionId);
      setActiveContinuousSection1(''); // Clear continuous section highlighting
      setActiveContinuousSection2(''); // Clear continuous section highlighting
    }
  };

  // Function to render continuous sections 1 (A&B) - Using extracted components
  const renderContinuousSections1 = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Part A: Seafarer's Information - Extracted Component */}
        <PartA
          form={form}
          partRef={partARef}
          vessels={vessels}
          availableRanks={availableRanks}
          appraisalTypes={appraisalTypes}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
        />

        {/* Part B: Information at Start of Appraisal Period - Extracted Component */}
        <PartB
          form={form}
          partRef={partBRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showEvaluation={showEvaluation}
          editingTraining={editingTraining}
          setEditingTraining={setEditingTraining}
          editingTarget={editingTarget}
          setEditingTarget={setEditingTarget}
          trainingComments={trainingComments}
          setTrainingComments={setTrainingComments}
          targetComments={targetComments}
          setTargetComments={setTargetComments}
          editingTrainingComment={editingTrainingComment}
          setEditingTrainingComment={setEditingTrainingComment}
          editingTargetComment={editingTargetComment}
          setEditingTargetComment={setEditingTargetComment}
          addTraining={addTraining}
          updateTraining={updateTraining}
          deleteTraining={deleteTraining}
          addTarget={addTarget}
          updateTarget={updateTarget}
          deleteTarget={deleteTarget}
        />

        {/* Stage 1 Action Buttons - kept in parent for form-level control */}
        {isSectionVisible('partB') && (
          <div className="flex justify-end gap-4">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button 
              className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" 
              onClick={() => handleStageSubmission('stage1')}
              disabled={stage1Mutation.isPending || saveAppraisalMutation.isPending}
            >
              {stage1Mutation.isPending ? 'Submitting...' : 'Submit Stage 1'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Function to render continuous sections 2 (C-F) - using extracted Part components
  const renderContinuousSections2 = () => {
    const competenceSectionScore = calculateSectionScore();
    const behaviouralSectionScore = calculateBehaviouralSectionScore();
    const overallScore = calculateOverallScore();

    return (
      <div className="space-y-4 sm:space-y-6">
        <PartC
          form={form}
          partRef={partCRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          competenceComments={competenceComments}
          setCompetenceComments={setCompetenceComments}
          editingCompetenceComment={editingCompetenceComment}
          setEditingCompetenceComment={setEditingCompetenceComment}
          updateCompetenceAssessment={updateCompetenceAssessment}
          competenceSectionScore={competenceSectionScore}
          getScoreColors={getScoreColors}
        />

        <PartD
          form={form}
          partRef={partDRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          behaviouralComments={behaviouralComments}
          setBehaviouralComments={setBehaviouralComments}
          editingBehaviouralComment={editingBehaviouralComment}
          setEditingBehaviouralComment={setEditingBehaviouralComment}
          updateBehaviouralAssessment={updateBehaviouralAssessment}
          behaviouralSectionScore={behaviouralSectionScore}
          getScoreColors={getScoreColors}
        />

        <PartE
          form={form}
          partRef={partERef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          trainingNeedsComments={trainingNeedsComments}
          setTrainingNeedsComments={setTrainingNeedsComments}
          editingTrainingNeedsComment={editingTrainingNeedsComment}
          setEditingTrainingNeedsComment={setEditingTrainingNeedsComment}
          isTrainingNeedsDialogOpen={isTrainingNeedsDialogOpen}
          setIsTrainingNeedsDialogOpen={setIsTrainingNeedsDialogOpen}
          addTrainingNeed={addTrainingNeed}
          updateTrainingNeed={updateTrainingNeed}
          deleteTrainingNeed={deleteTrainingNeed}
          handleTrainingNeedsSelect={handleTrainingNeedsSelect}
        />

        <PartF
          form={form}
          partRef={partFRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          recommendationComments={recommendationComments}
          setRecommendationComments={setRecommendationComments}
          editingRecommendationComment={editingRecommendationComment}
          setEditingRecommendationComment={setEditingRecommendationComment}
          editingAppraiserComment={editingAppraiserComment}
          setEditingAppraiserComment={setEditingAppraiserComment}
          editingSeafarerComment={editingSeafarerComment}
          setEditingSeafarerComment={setEditingSeafarerComment}
          updateRecommendation={updateRecommendation}
          addAppraiserComment={addAppraiserCommentNoArgs}
          updateAppraiserComment={updateAppraiserComment}
          deleteAppraiserComment={deleteAppraiserComment}
          updateSeafarerComment={updateSeafarerComment}
          competenceSectionScore={competenceSectionScore}
          behaviouralSectionScore={behaviouralSectionScore}
          overallScore={overallScore}
          getScoreColors={getScoreColors}
          availableRanks={availableRanks}
          handleStageSubmission={handleStageSubmission}
          handleSaveDraft={handleSaveDraft}
          stage1Mutation={stage1Mutation}
          stage2Mutation={stage2Mutation}
          saveAppraisalMutation={saveAppraisalMutation}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">Crew Appraisal Form</h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSaveDraft}
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSaveDraft}
              className="sm:hidden"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              // For continuous sections, use their respective activeContinuousSection, for steppers use activeSection
              // Also ensure the section type is currently being rendered
              const isActive = section.type === 'continuous1' 
                ? (['A', 'B'].includes(activeSection) && activeContinuousSection1 === section.id)
                : section.type === 'continuous2' 
                  ? (['C', 'D', 'E', 'F'].includes(activeSection) && activeContinuousSection2 === section.id)
                  : activeSection === section.id;
              
              return (
                <div key={section.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation(section.id)}
                    className="flex items-center justify-center"
                    data-testid={`button-step-mobile-${section.id}`}
                  >
                    <span 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                        isActive 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {section.number}
                    </span>
                  </button>
                  {index < sections.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-1 overflow-hidden bg-[#f8fafc]">
          {/* Left Sidebar - Enhanced Stepper (Hidden on Mobile) */
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-[#f8fafc] border-r overflow-y-auto">
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  // For continuous sections, use their respective activeContinuousSection, for steppers use activeSection
                  // Also ensure the section type is currently being rendered
                  const isActive = section.type === 'continuous1' 
                    ? (['A', 'B'].includes(activeSection) && activeContinuousSection1 === section.id)
                    : section.type === 'continuous2' 
                      ? (['C', 'D', 'E', 'F'].includes(activeSection) && activeContinuousSection2 === section.id)
                      : activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSectionNavigation(section.id)}
                        className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 min-h-[3rem] ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 text-blue-700" 
                            : "border-transparent hover:bg-gray-100 text-gray-700"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        data-testid={`button-step-${section.id}`}
                      >
                        <span 
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                            isActive 
                              ? "bg-blue-600 text-white" 
                              : "bg-gray-600 text-white"
                          }`}
                        >
                          {section.number}
                        </span>
                        <span 
                          className="hidden xl:block ml-3 text-left text-sm leading-tight flex-1"
                          data-testid={`text-step-title-${section.id}`}
                          title={section.title}
                          style={{ 
                            wordBreak: 'break-word',
                            lineHeight: '1.2',
                            maxWidth: '8rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {section.title.replace("Part A: ", "").replace("Part B: ", "").replace("Part C: ", "").replace("Part D: ", "").replace("Part E: ", "").replace("Part F: ", "").replace("Part G: ", "")}
                        </span>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-7 top-12 w-0.5 h-3 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>
          }

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-[#f8fafc]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                
                {/* Render content based on section type */}
                {(['A', 'B'].includes(activeSection)) && (
                  <div ref={continuous1ContainerRef} className="h-[calc(100vh-200px)] overflow-y-auto">
                    {renderContinuousSections1()}
                  </div>
                )}
                {(['C', 'D', 'E', 'F'].includes(activeSection)) && (
                  <div ref={continuous2ContainerRef} className="h-[calc(100vh-200px)] overflow-y-auto">
                    {renderContinuousSections2()}
                  </div>
                )}
                
                {/* Part G: Office Review & Followup - Traditional Stepper */}
                {activeSection === "G" && (
                  <PartG
                    form={form}
                    partRef={partGRef}
                    appraisalStatus={appraisalStatus}
                    isFieldVisible={isFieldVisible}
                    isSectionVisible={isSectionVisible}
                    trainingFollowupComments={trainingFollowupComments}
                    setTrainingFollowupComments={setTrainingFollowupComments}
                    editingTrainingFollowupComment={editingTrainingFollowupComment}
                    setEditingTrainingFollowupComment={setEditingTrainingFollowupComment}
                    editingOfficeReview={editingOfficeReview}
                    setEditingOfficeReview={setEditingOfficeReview}
                    isTrainingFollowupDialogOpen={isTrainingFollowupDialogOpen}
                    setIsTrainingFollowupDialogOpen={setIsTrainingFollowupDialogOpen}
                    addOfficeReview={addOfficeReview}
                    updateOfficeReview={updateOfficeReview}
                    deleteOfficeReview={deleteOfficeReview}
                    addTrainingFollowup={addTrainingFollowupNoArgs}
                    updateTrainingFollowup={updateTrainingFollowup}
                    deleteTrainingFollowup={deleteTrainingFollowup}
                    handleStageSubmission={handleStageSubmission}
                    handleSaveDraft={handleSaveDraft}
                    stage3Mutation={stage3Mutation}
                    saveAppraisalMutation={saveAppraisalMutation}
                  />
                )}
                
                {/* Part A: Seafarer's Information - moved to continuous function */}
                {false && activeSection === "reference" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A: Seafarer's Information</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="seafarersName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter seafarer's name" className="bg-[#ffffff]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="seafarersRank"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Rank</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]">
                                    <SelectValue placeholder="Select rank" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="master">Master</SelectItem>
                                  <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                                  <SelectItem value="chief-mate">Chief Mate</SelectItem>
                                  <SelectItem value="second-officer">Second Officer</SelectItem>
                                  <SelectItem value="third-engineer">Third Engineer</SelectItem>
                                  <SelectItem value="able-seaman">Able Bodied Seaman</SelectItem>
                                  <SelectItem value="electrician">Electrician</SelectItem>
                                  <SelectItem value="bosun">Bosun</SelectItem>
                                  <SelectItem value="cook">Cook</SelectItem>
                                  <SelectItem value="steward">Steward</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nationality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Nationality</FormLabel>
                              <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={nationalityOpen}
                                      className={cn(
                                        "w-full justify-between bg-[#ffffff] border-gray-200 hover:bg-gray-100",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value
                                        ? NATIONALITIES.find(
                                            (nationality) => nationality.toLowerCase() === field.value.toLowerCase()
                                          )
                                        : "Select nationality..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search nationality..." />
                                    <CommandList>
                                      <CommandEmpty>No nationality found.</CommandEmpty>
                                      <CommandGroup>
                                        {NATIONALITIES.map((nationality) => (
                                          <CommandItem
                                            key={nationality}
                                            value={nationality}
                                            onSelect={(currentValue) => {
                                              field.onChange(currentValue === field.value ? "" : currentValue);
                                              setNationalityOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value?.toLowerCase() === nationality.toLowerCase()
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {nationality}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="vessel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]">
                                    <SelectValue placeholder="Select vessel" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="mt-sail-one">MT Sail One</SelectItem>
                                  <SelectItem value="mt-sail-two">MT Sail Two</SelectItem>
                                  <SelectItem value="mt-sail-three">MT Sail Three</SelectItem>
                                  <SelectItem value="mt-sail-four">MT Sail Four</SelectItem>
                                  <SelectItem value="mt-sail-five">MT Sail Five</SelectItem>
                                  <SelectItem value="mt-sail-ten">MT Sail Ten</SelectItem>
                                  <SelectItem value="mt-sail-eight">MT Sail Eight</SelectItem>
                                  <SelectItem value="mt-sail-eleven">MT Sail Eleven</SelectItem>
                                  <SelectItem value="mt-sail-thirteen">MT Sail Thirteen</SelectItem>
                                  <SelectItem value="mv-sail-seven">MV Sail Seven</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="signOn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Sign On Date</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd/mm/yyyy" type="date" className="bg-[#ffffff]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="appraisalType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {appraisalTypes.length > 0 ? (
                                    appraisalTypes.map((type: { id: string; name: string; value: string }) => (
                                      <SelectItem key={type.id} value={type.value}>
                                        {type.name}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <>
                                      <SelectItem value="end-of-contract">End of Contract</SelectItem>
                                      <SelectItem value="mid-term">Mid Term</SelectItem>
                                      <SelectItem value="special">Special</SelectItem>
                                      <SelectItem value="probation">Probation</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="appraisalPeriodFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period From</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-[#ffffff]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="appraisalPeriodTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period To</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-[#ffffff]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="primaryAppraiser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Primary Appraiser</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]">
                                    <SelectValue placeholder="Select appraiser" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="master">Master</SelectItem>
                                  <SelectItem value="chief-officer">Chief Officer</SelectItem>
                                  <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                                  <SelectItem value="2nd-engineer">2nd Engineer</SelectItem>
                                  <SelectItem value="marine-superintendent">Marine Superintendent</SelectItem>
                                  <SelectItem value="technical-superintendent">Technical Superintendent</SelectItem>
                                  <SelectItem value="crew-manager">Crew Manager</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {isFieldVisible('personalityIndexCategory') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="personalityIndexCategory"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Personality Index (PI) Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-[#ffffff]">
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="dominance">Dominance</SelectItem>
                                    <SelectItem value="influence">Influence</SelectItem>
                                    <SelectItem value="steadiness">Steadiness</SelectItem>
                                    <SelectItem value="compliance">Compliance</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <div className="flex justify-end mt-6">
                        <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8">
                          Save
                        </Button>
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part B: Information at Start of Appraisal Period */}
                {activeSection === "information" && isSectionVisible('partB') && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B: Information at Start of Appraisal Period</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="space-y-8">
                      {/* B1. Trainings conducted prior joining vessel */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)</h3>
                          <Button
                            type="button"
                            onClick={addTraining}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Training
                          </Button>
                        </div>
                        
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                                  {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>}
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                              {form.watch("trainings").map((training, index) => (
                                <React.Fragment key={training.id}>
                                  <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                      <Input
                                        value={training.training}
                                        onChange={(e) => updateTraining(training.id, "training", e.target.value)}
                                        placeholder={`Training ${index + 1}`}
                                        className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                      />
                                    </td>
                                    {showEvaluation && (
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <Select
                                          value={training.evaluation}
                                          onValueChange={(value) => updateTraining(training.id, "evaluation", value)}
                                        >
                                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                            <SelectValue placeholder="Select Rating" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="5-exceeded-expectations">5- Exceeded Expectations</SelectItem>
                                            <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                            <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                            <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                            <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </td>
                                    )}
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => setTrainingComments(prev => ({
                                            ...prev,
                                            [training.id]: prev[training.id] || ""
                                          }))}
                                        >
                                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                        </Button>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => deleteTraining(training.id)}
                                        >
                                          <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {trainingComments[training.id] !== undefined && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        {editingTrainingComment === training.id ? (
                                          <Textarea
                                            value={trainingComments[training.id]}
                                            onChange={(e) => {
                                              setTrainingComments(prev => ({
                                                ...prev,
                                                [training.id]: e.target.value
                                              }));
                                              updateTraining(training.id, "comment", e.target.value);
                                            }}
                                            onBlur={() => setEditingTrainingComment(null)}
                                            placeholder="Comment: Add your observations here..."
                                            className="text-blue-600 italic border-blue-200"
                                            rows={2}
                                            autoFocus
                                          />
                                        ) : (
                                          <div className="flex justify-between items-start">
                                            <div 
                                              className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                              onClick={() => setEditingTrainingComment(training.id)}
                                            >
                                              {trainingComments[training.id] || "Click to add comment..."}
                                            </div>
                                            <div className="ml-2">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteTrainingComment(training.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                              {form.watch("trainings").length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-500">
                                    No trainings added yet. Click "Add Training" to get started.
                                  </td>
                                </tr>
                              )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* B2. Target Setting */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B2. Target Setting</h3>
                          <Button
                            type="button"
                            onClick={addTarget}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Target
                          </Button>
                        </div>
                        
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Setting</th>
                                {showEvaluation && <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>}
                                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {form.watch("targets").map((target, index) => (
                                <React.Fragment key={target.id}>
                                  <tr className="border-b border-gray-200 bg-white hover:bg-gray-50">
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                      <Input
                                        value={target.targetSetting}
                                        onChange={(e) => updateTarget(target.id, "targetSetting", e.target.value)}
                                        placeholder={`Target ${index + 1}`}
                                        className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                      />
                                    </td>
                                    {showEvaluation && (
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <Select
                                          value={target.evaluation}
                                          onValueChange={(value) => updateTarget(target.id, "evaluation", value)}
                                        >
                                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                            <SelectValue placeholder="Select Rating" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="5-exceeded-set-target">5- Exceeded Set Target</SelectItem>
                                            <SelectItem value="4-fully-met-target">4- Fully Met Target</SelectItem>
                                            <SelectItem value="3-missed-target-small-margin">3- Missed Target by a Small Margin</SelectItem>
                                            <SelectItem value="2-missed-target-significant-margin">2- Missed Target by a Significant Margin</SelectItem>
                                            <SelectItem value="1-failed-to-achieve-target">1- Failed to Achieve Target</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </td>
                                    )}
                                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                      <div className="flex gap-2 justify-center">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => setTargetComments(prev => ({
                                            ...prev,
                                            [target.id]: prev[target.id] || ""
                                          }))}
                                        >
                                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                        </Button>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => deleteTarget(target.id)}
                                        >
                                          <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {targetComments[target.id] !== undefined && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        {editingTargetComment === target.id ? (
                                          <Textarea
                                            value={targetComments[target.id]}
                                            onChange={(e) => {
                                              setTargetComments(prev => ({
                                                ...prev,
                                                [target.id]: e.target.value
                                              }));
                                              updateTarget(target.id, "comment", e.target.value);
                                            }}
                                            onBlur={() => setEditingTargetComment(null)}
                                            placeholder="Comment: Add your observations here..."
                                            className="text-blue-600 italic border-blue-200"
                                            rows={2}
                                            autoFocus
                                          />
                                        ) : (
                                          <div className="flex justify-between items-start">
                                            <div 
                                              className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                              onClick={() => setEditingTargetComment(target.id)}
                                            >
                                              {targetComments[target.id] || "Click to add comment..."}
                                            </div>
                                            <div className="ml-2">
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteTargetComment(target.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                              {form.watch("targets").length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-500">
                                    No targets added yet. Click "Add Target" to get started.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-end gap-4 mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft}>
                          Save Draft
                        </Button>
                        <Button 
                          className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" 
                          onClick={() => handleStageSubmission('stage1')}
                          disabled={stage1Mutation.isPending || saveAppraisalMutation.isPending}
                        >
                          {stage1Mutation.isPending ? 'Submitting...' : 'Submit Stage 1'}
                        </Button>
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part C: Competence Assessment */}
                {activeSection === "competenceAssessment" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part C: Competence Assessment (Professional Knowledge & Skills)</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Assessment Criteria</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Weight %</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.watch("competenceAssessments").map((assessment, index) => (
                              <React.Fragment key={assessment.id}>
                                <tr className="border-t">
                                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{assessment.assessmentCriteria}</td>
                                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{assessment.weight}%</td>
                                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                    <Select
                                      value={assessment.effectiveness}
                                      onValueChange={(value) => updateCompetenceAssessment(assessment.id, "effectiveness", value)}
                                    >
                                      <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                        <SelectValue placeholder="Select Rating" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="5-exceeds-expectations">5- Exceeds Expectations</SelectItem>
                                        <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                        <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                        <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                        <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                    <div className="flex gap-2 justify-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setCompetenceComments(prev => ({
                                          ...prev,
                                          [assessment.id]: prev[assessment.id] || ""
                                        }))}
                                      >
                                        <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                      </Button>

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                {competenceComments[assessment.id] !== undefined && (
                                  <tr>
                                    <td></td>
                                    <td colSpan={4} className="p-3">
                                      {editingCompetenceComment === assessment.id ? (
                                        <Textarea
                                          value={competenceComments[assessment.id]}
                                          onChange={(e) => {
                                            setCompetenceComments(prev => ({
                                              ...prev,
                                              [assessment.id]: e.target.value
                                            }));
                                            updateCompetenceAssessment(assessment.id, "comment", e.target.value);
                                          }}
                                          onBlur={() => setEditingCompetenceComment(null)}
                                          placeholder="Comment: Add your observations here..."
                                          className="text-blue-600 italic border-blue-200"
                                          rows={2}
                                          autoFocus
                                        />
                                      ) : (
                                        <div className="flex justify-between items-start">
                                          <div 
                                            className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                            onClick={() => setEditingCompetenceComment(assessment.id)}
                                          >
                                            {competenceComments[assessment.id] || "Click to add comment..."}
                                          </div>
                                          <div className="ml-2">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => deleteCompetenceComment(assessment.id)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Section Score */}
                      <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700">Section Score:</div>
                        <div className={`px-4 py-2 rounded text-lg font-semibold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateSectionScore())).bgColor} ${getScoreColors(parseFloat(calculateSectionScore())).textColor}`}>
                          {calculateSectionScore()}
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8">
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part D: Behavioural Assessment */}
                {activeSection === "behaviouralAssessment" && isSectionVisible('partD') && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part D: Behavioural Assessment (Soft Skills)</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Assessment Criteria</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Weight %</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                          {form.watch("behaviouralAssessments").map((assessment, index) => (
                            <React.Fragment key={assessment.id}>
                              <tr className="border-t">
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{assessment.assessmentCriteria}</td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">{assessment.weight}%</td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                  <Select
                                    value={assessment.effectiveness}
                                    onValueChange={(value) => updateBehaviouralAssessment(assessment.id, "effectiveness", value)}
                                  >
                                    <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                                      <SelectValue placeholder="Select Rating" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="5-exceeds-expectations">5- Exceeds Expectations</SelectItem>
                                      <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                      <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                      <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                      <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                  <div className="flex gap-2 justify-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setBehaviouralComments(prev => ({
                                        ...prev,
                                        [assessment.id]: prev[assessment.id] || ""
                                      }))}
                                    >
                                      <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                    >
                                      <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {behaviouralComments[assessment.id] !== undefined && (
                                <tr>
                                  <td></td>
                                  <td colSpan={4} className="p-3">
                                    {editingBehaviouralComment === assessment.id ? (
                                      <Textarea
                                        value={behaviouralComments[assessment.id]}
                                        onChange={(e) => {
                                          setBehaviouralComments(prev => ({
                                            ...prev,
                                            [assessment.id]: e.target.value
                                          }));
                                          updateBehaviouralAssessment(assessment.id, "comment", e.target.value);
                                        }}
                                        onBlur={() => setEditingBehaviouralComment(null)}
                                        placeholder="Comment: Add your observations here..."
                                        className="text-blue-600 italic border-blue-200"
                                        rows={2}
                                        autoFocus
                                      />
                                    ) : (
                                      <div className="flex justify-between items-start">
                                        <div 
                                          className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                          onClick={() => setEditingBehaviouralComment(assessment.id)}
                                        >
                                          {behaviouralComments[assessment.id] || "Click to add comment..."}
                                        </div>
                                        <div className="ml-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteBehaviouralComment(assessment.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">Section Score:</span>
                        <div className={`px-4 py-2 rounded text-lg font-semibold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateBehaviouralSectionScore())).bgColor} ${getScoreColors(parseFloat(calculateBehaviouralSectionScore())).textColor}`}>
                          {calculateBehaviouralSectionScore()}
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft}>
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part E: Training Needs & Development */}
                {activeSection === "trainingNeeds" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part E Training Needs & Development</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Specify any training needs identified during the appraisals period</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingNeed('database')}
                            >
                              + Add Training from Database
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingNeed('new')}
                            >
                              + Add New Training
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                          {form.watch("trainingNeeds").map((trainingNeed, index) => (
                            <React.Fragment key={trainingNeed.id}>
                              <tr className="border-t">
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                  <Input
                                    value={trainingNeed.training}
                                    onChange={(e) => updateTrainingNeed(trainingNeed.id, "training", e.target.value)}
                                    placeholder={`Training ${index + 1}`}
                                    className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                  />
                                </td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                  <div className="flex gap-2 justify-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setTrainingNeedsComments(prev => ({
                                        ...prev,
                                        [trainingNeed.id]: prev[trainingNeed.id] || ""
                                      }))}
                                    >
                                      <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => deleteTrainingNeed(trainingNeed.id)}
                                    >
                                      <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {trainingNeedsComments[trainingNeed.id] !== undefined && (
                                <tr>
                                  <td></td>
                                  <td colSpan={2} className="p-3">
                                    {editingTrainingNeedsComment === trainingNeed.id ? (
                                      <Textarea
                                        value={trainingNeedsComments[trainingNeed.id]}
                                        onChange={(e) => {
                                          setTrainingNeedsComments(prev => ({
                                            ...prev,
                                            [trainingNeed.id]: e.target.value
                                          }));
                                          updateTrainingNeed(trainingNeed.id, "comment", e.target.value);
                                        }}
                                        onBlur={() => setEditingTrainingNeedsComment(null)}
                                        placeholder="Comment: Add your observations here..."
                                        className="text-blue-600 italic border-blue-200"
                                        rows={2}
                                        autoFocus
                                      />
                                    ) : (
                                      <div className="flex justify-between items-start">
                                        <div 
                                          className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                          onClick={() => setEditingTrainingNeedsComment(trainingNeed.id)}
                                        >
                                          {trainingNeedsComments[trainingNeed.id] || "Click to add comment..."}
                                        </div>
                                        <div className="ml-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteTrainingNeedsComment(trainingNeed.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          {form.watch("trainingNeeds").length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-500">
                                No training needs added yet. Click "Add Training from Database" or "Add New Training" to get started.
                              </td>
                            </tr>
                          )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft}>
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part F: Comments & Recommendations */}
                {activeSection === "summary" && (
                  <div className="space-y-6">
                    <Card className="bg-white">
                      <CardContent className="p-6">
                        <div className="pb-4 mb-6">
                          <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part F Comments & Recommendations</h3>
                          <div style={{ color: '#16569e' }} className="text-sm">Add any recommendations related to following</div>
                          <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                        </div>

                        {/* F1: Overall Score */}
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F1. Overall Score</h3>
                          <div className={`px-4 py-2 rounded text-lg font-bold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateOverallScore())).bgColor} ${getScoreColors(parseFloat(calculateOverallScore())).textColor}`}>
                            {calculateOverallScore()}
                          </div>
                        </div>

                        {/* F2: Appraiser's Recommendations */}
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F2. Appraiser's Recommendations</h3>
                          </div>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Recommendations</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Yes</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">No</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">NA</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.watch("recommendations").map((recommendation, index) => (
                                  <React.Fragment key={recommendation.id}>
                                    <tr className="border-t">
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{recommendation.question}</td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "Yes"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "Yes")}
                                          onClick={() => {
                                            if (recommendation.answer === "Yes") {
                                              updateRecommendation(recommendation.id, "answer", "");
                                            }
                                          }}
                                          className="w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "No"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "No")}
                                          onClick={() => {
                                            if (recommendation.answer === "No") {
                                              updateRecommendation(recommendation.id, "answer", "");
                                            }
                                          }}
                                          className="w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "NA"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "NA")}
                                          onClick={() => {
                                            if (recommendation.answer === "NA") {
                                              updateRecommendation(recommendation.id, "answer", "");
                                            }
                                          }}
                                          className="w-4 h-4 cursor-pointer"
                                        />
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <div className="flex justify-center">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setRecommendationComments(prev => ({
                                              ...prev,
                                              [recommendation.id]: prev[recommendation.id] || ""
                                            }))}
                                            className="h-6 w-6"
                                          >
                                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                    {recommendationComments[recommendation.id] !== undefined && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={5} className="p-3">
                                          {editingRecommendationComment === recommendation.id ? (
                                            <Textarea
                                              value={recommendationComments[recommendation.id]}
                                              onChange={(e) => {
                                                setRecommendationComments(prev => ({
                                                  ...prev,
                                                  [recommendation.id]: e.target.value
                                                }));
                                                updateRecommendation(recommendation.id, "comment", e.target.value);
                                              }}
                                              onBlur={() => setEditingRecommendationComment(null)}
                                              placeholder="Comment: Add your observations here..."
                                              className="text-blue-600 italic border-blue-200"
                                              rows={2}
                                              autoFocus
                                            />
                                          ) : (
                                            <div className="flex justify-between items-start">
                                              <div 
                                                className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]"
                                                onClick={() => setEditingRecommendationComment(recommendation.id)}
                                              >
                                                {recommendationComments[recommendation.id] || "Click to add comment..."}
                                              </div>
                                              <div className="ml-2">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => deleteRecommendationComment(recommendation.id)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* F3: Appraiser Comments */}
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F3. Appraiser Comments</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => {
                                addAppraiserComment("Ashok Kumar", "Chief Officer");
                              }}
                            >
                              + Add Appraiser
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {form.watch("appraiserComments").map((appraiser, index) => (
                              <div key={appraiser.id} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-[14px] text-[#3164f4]">
                                      {index === 0 ? (() => {
                                        const appraiserValue = form.watch("primaryAppraiser");
                                        const appraiserLabels: Record<string, string> = {
                                          "master": "Master",
                                          "chief-officer": "Chief Officer",
                                          "chief-engineer": "Chief Engineer",
                                          "2nd-engineer": "2nd Engineer",
                                          "marine-superintendent": "Marine Superintendent",
                                          "technical-superintendent": "Technical Superintendent",
                                          "crew-manager": "Crew Manager"
                                        };
                                        return appraiserValue ? `${appraiserLabels[appraiserValue] || appraiserValue} (Primary Appraiser)` : "Select Primary Appraiser";
                                      })() : `${appraiser.name}, ${appraiser.rank}`}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingAppraiserComment(appraiser.id)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    {index > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteAppraiserComment(appraiser.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {editingAppraiserComment === appraiser.id ? (
                                  <Textarea
                                    value={appraiser.comment}
                                    onChange={(e) => updateAppraiserComment(appraiser.id, "comment", e.target.value)}
                                    onBlur={() => setEditingAppraiserComment(null)}
                                    placeholder="Add your comment here..."
                                    className="text-blue-600 italic"
                                    rows={3}
                                    autoFocus
                                  />
                                ) : (
                                  appraiser.comment && (
                                    <p className="text-blue-600 italic text-sm pl-4">
                                      {appraiser.comment || (index === 0 ? "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections." : "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections.")}
                                    </p>
                                  )
                                )}
                                {editingAppraiserComment !== appraiser.id && !appraiser.comment && (
                                  <div 
                                    className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                    onClick={() => setEditingAppraiserComment(appraiser.id)}
                                  >
                                    <p className="text-gray-500 text-[13px]">Click to add comment...</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* F4: Seafarer Comments */}
                        <div className="space-y-4">
                          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F4. Seafarer Comments</h3>
                          <div className="space-y-4">
                            {form.watch("seafarerComments").map((seafarer, index) => (
                              <div key={seafarer.id} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-[14px] text-[#3164f4]">
                                      {`${form.watch("seafarersName") || "Derek Cole"}, ${form.watch("seafarersRank") || "3rd Officer"}`}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingSeafarerComment(seafarer.id)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {editingSeafarerComment === seafarer.id ? (
                                  <Textarea
                                    value={seafarer.comment}
                                    onChange={(e) => updateSeafarerComment(seafarer.id, "comment", e.target.value)}
                                    onBlur={() => setEditingSeafarerComment(null)}
                                    placeholder="Add your comment here..."
                                    className="text-blue-600 italic"
                                    rows={3}
                                    autoFocus
                                  />
                                ) : (
                                  seafarer.comment && (
                                    <p className="text-blue-600 italic text-sm pl-4">
                                      {seafarer.comment || "I have received a very good opportunity to learn effectively during my tenure on board. I was able to practically apply the skills I had gained to enhance the operational performance. I would like to return on this vessel."}
                                    </p>
                                  )
                                )}
                                {editingSeafarerComment !== seafarer.id && !seafarer.comment && (
                                  <div 
                                    className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                    onClick={() => setEditingSeafarerComment(seafarer.id)}
                                  >
                                    <p className="text-gray-500 text-[13px]">Click to add comment...</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons - Always visible like Section B */}
                        <div className="flex justify-end gap-4 mt-6">
                          <Button 
                            className="bg-[#5fa5fa] hover:bg-[#4a94e8] text-white px-8" 
                            onClick={handleSaveDraft}
                            disabled={saveAppraisalMutation.isPending}
                          >
                            {saveAppraisalMutation.isPending ? 'Saving...' : 'Save Draft'}
                          </Button>
                          <Button 
                            className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" 
                            onClick={() => handleStageSubmission('stage2')}
                            disabled={stage2Mutation.isPending || saveAppraisalMutation.isPending || appraisalStatus === 'submitted' || appraisalStatus === 'reviewed'}
                          >
                            {stage2Mutation.isPending ? 'Submitting...' : 'Submit Stage 2'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Part G: Office Review & Followup */}
                {activeSection === "officeReview" && (
                  <div className="space-y-6">
                    <Card className="bg-white">
                      <CardContent className="p-6">
                        <div className="pb-4 mb-6">
                          <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part G Office Review & Followup</h3>
                          <div style={{ color: '#16569e' }} className="text-sm">This section is visible to office users only</div>
                          <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                        </div>

                        {/* G1: Office Review */}
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G1. Office Review</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={addOfficeReview}
                            >
                              + Add Reviewer
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {form.watch("officeReviews").map((review, index) => (
                              <div key={review.id} className="space-y-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    {/* Display current user's name and position (auto-populated from sessionStorage) */}
                                    <p className="font-medium text-[14px]" style={{ color: '#3164f4' }}>
                                      {review.name}{review.position && <>, <span className="font-normal italic">{review.position}</span></>}:
                                    </p>
                                    {editingOfficeReview === review.id ? (
                                      <Textarea
                                        value={review.feedback}
                                        onChange={(e) => updateOfficeReview(review.id, "feedback", e.target.value)}
                                        onBlur={() => setEditingOfficeReview(null)}
                                        placeholder="Add office review feedback..."
                                        className="text-blue-600 italic border-blue-200 mt-1"
                                        rows={2}
                                        autoFocus
                                      />
                                    ) : (
                                      <p 
                                        className="text-blue-600 italic text-sm mt-1 cursor-pointer p-2 rounded hover:bg-gray-50"
                                        onClick={() => setEditingOfficeReview(review.id)}
                                      >
                                        {review.feedback || "Click to add feedback..."}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex space-x-2 ml-4">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteOfficeReview(review.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* G2: Training Followup */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G2. Training Followup</h3>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-gray-600 border-gray-300"
                                onClick={() => addTrainingFollowup('database')}
                              >
                                + Add Training from Database
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-gray-600 border-gray-300"
                                onClick={() => addTrainingFollowup('new')}
                              >
                                + Add New Training
                              </Button>
                            </div>
                          </div>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Corresponding in DB</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Category</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Status</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target or Compl. Date</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.watch("trainingFollowups").map((followup, index) => (
                                  <React.Fragment key={followup.id}>
                                    <tr className="border-t">
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <Input
                                          value={followup.training}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "training", e.target.value)}
                                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                        />
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <select
                                          value={followup.correspondingInDB}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "correspondingInDB", e.target.value)}
                                          className="w-full p-1 border rounded text-[13px] h-6"
                                        >
                                          <option>Select Training from DB</option>
                                          <option>Training Option 1</option>
                                          <option>Training Option 2</option>
                                        </select>
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <select
                                          value={followup.category}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "category", e.target.value)}
                                          className="w-full p-1 border rounded text-[13px] h-6"
                                        >
                                          <option>Select Rating</option>
                                          <option>1. Competence</option>
                                          <option>2- Soft Skills</option>
                                        </select>
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <select
                                          value={followup.status}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "status", e.target.value)}
                                          className={`w-full p-1 border rounded text-[13px] h-6 ${
                                            followup.status === "Proposed" ? "bg-gray-200" :
                                            followup.status === "Approved" ? "bg-blue-200" :
                                            followup.status === "Planned" ? "bg-yellow-200" :
                                            followup.status === "Declined" ? "bg-red-200" :
                                            followup.status === "Completed" ? "bg-green-200" : ""
                                          }`}
                                        >
                                          <option value="Proposed">Proposed</option>
                                          <option value="Approved">Approved</option>
                                          <option value="Planned">Planned</option>
                                          <option value="Declined">Declined</option>
                                          <option value="Completed">Completed</option>
                                        </select>
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <Input
                                          type="date"
                                          value={followup.targetDate}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "targetDate", e.target.value)}
                                          className="w-full text-[13px] h-6"
                                        />
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <div className="flex justify-center gap-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => setTrainingFollowupComments(prev => ({
                                              ...prev,
                                              [followup.id]: prev[followup.id] || ""
                                            }))}
                                          >
                                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => deleteTrainingFollowup(followup.id)}
                                          >
                                            <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                    {trainingFollowupComments[followup.id] !== undefined && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={6} className="p-3">
                                          {editingTrainingFollowupComment === followup.id ? (
                                            <Textarea
                                              value={trainingFollowupComments[followup.id]}
                                              onChange={(e) => {
                                                setTrainingFollowupComments(prev => ({
                                                  ...prev,
                                                  [followup.id]: e.target.value
                                                }));
                                                updateTrainingFollowup(followup.id, "comment", e.target.value);
                                              }}
                                              onBlur={() => setEditingTrainingFollowupComment(null)}
                                              placeholder="Comment: Add your observations here..."
                                              className="text-blue-600 italic border-blue-200"
                                              rows={2}
                                              autoFocus
                                            />
                                          ) : (
                                            <div className="flex justify-between items-start">
                                              <div 
                                                className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[14px]"
                                                onClick={() => setEditingTrainingFollowupComment(followup.id)}
                                              >
                                                {trainingFollowupComments[followup.id] || "Click to add comment..."}
                                              </div>
                                              <div className="ml-2">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => deleteTrainingFollowupComment(followup.id)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Action buttons - Always visible like Section B */}
                        <div className="flex justify-end gap-4 mt-6">
                          <Button 
                            className="bg-[#5fa5fa] hover:bg-[#4a94e8] text-white px-8" 
                            onClick={handleSaveDraft}
                            disabled={saveAppraisalMutation.isPending}
                          >
                            {saveAppraisalMutation.isPending ? 'Saving...' : 'Save Draft'}
                          </Button>
                          <Button 
                            className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" 
                            onClick={() => handleStageSubmission('stage3')}
                            disabled={stage3Mutation.isPending || saveAppraisalMutation.isPending || appraisalStatus === 'reviewed'}
                          >
                            {stage3Mutation.isPending ? 'Submitting...' : 'Submit Stage 3'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              </form>
            </Form>
          </div>
        </div>
        </div>
        
        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialog.isOpen} onOpenChange={closeConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirmDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Training Needs Database Selection Dialog */}
      <TrainingCourseSelectionDialog
        open={isTrainingNeedsDialogOpen}
        onClose={() => setIsTrainingNeedsDialogOpen(false)}
        onConfirm={addTrainingNeedsFromDatabase}
        existingCourseIds={form.getValues("trainingNeeds").map(t => t.training).filter(Boolean)}
      />

      {/* Training Followup Database Selection Dialog */}
      <TrainingCourseSelectionDialog
        open={isTrainingFollowupDialogOpen}
        onClose={() => setIsTrainingFollowupDialogOpen(false)}
        onConfirm={addTrainingFollowupsFromDatabase}
        existingCourseIds={form.getValues("trainingFollowups").map(f => f.correspondingInDB).filter(Boolean)}
      />
    </div>
  );
};