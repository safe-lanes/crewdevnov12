import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Send, Plus, MessageSquare, Edit2, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
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
import { useAppraisalTypesV2 } from "@/hooks/v2/useMasterDataV2";
import { DbTrainingCombobox } from "@/components/training/DbTrainingCombobox";
import { useCompanyTrainings } from "@/hooks/useCompanyTrainings";

// Import extracted Part components for code splitting
import { PartA, PartB, PartC, PartD, PartE, PartF, PartG, RequiredMark } from "@/components/appraisal-form-parts";

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
  addedFromDB: z.boolean().optional(),
  // Database course ID of the selected training (mirrors Part G's
  // `correspondingInDB`). Used to grey out already-added trainings in the
  // database selection dialog and prevent duplicate entries.
  correspondingInDB: z.string().optional(),
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
  status: z.union([
    z.enum(["Proposed", "Approved", "Planned", "Declined", "Completed"]),
    z.literal(""),
  ]),
  targetDate: z.string().optional(),
  comment: z.string().optional(),
  addedFromDB: z.boolean().optional(),
});

// Strict version for Stage 3 validation - requires a non-empty training name.
// Training Name is the primary identifier for G2 follow-up rows, so it must be
// provided before Stage 3 can be submitted. Draft saves keep using the lenient
// `trainingFollowupSchema` above.
const trainingFollowupStage3Schema = trainingFollowupSchema.extend({
  training: z.string().trim().min(1, "Training name is required in Part G2"),
});

// Part A schema
const partASchema = z.object({
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().nullish(),
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

// Part G schema for Stage 3 validation (requires non-empty G2 training names)
const partGStage3Schema = z.object({
  officeReviews: z.array(officeReviewSchema).default([]),
  trainingFollowups: z.array(trainingFollowupStage3Schema).default([]),
});

// Stage-specific schemas for validation
// Stage 1: Parts A & B (Target Setting) - evaluation optional, empty arrays allowed
const stage1Schema = partASchema.merge(partBStage1Schema);

// Stage 2: Parts C, D, E, F (Performance Assessment) - requires recommendation answers
const stage2Schema = partCSchema.merge(partDSchema).merge(partESchema).merge(partFStage2Schema);

// Stage 3: Part B (Evaluation required) + Part G (Office Review)
const stage3Schema = partBSchema.merge(partGStage3Schema);

// Full appraisal schema (for draft saves and full validation)
const appraisalSchema = z.object({
  // Part A: Seafarer's Information
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().nullish(),
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

// Task #500: status union widened with `stage2_submitted` / `stage3_submitted`
// synonyms recognized by the server; `isLockForm` is the snapshotted lock-form
// flag carried on the appraisal record after Stage 2 submit.
type AppraisalStatusValue =
  | 'draft'
  | 'preliminary'
  | 'submitted'
  | 'stage2_submitted'
  | 'reviewed'
  | 'stage3_submitted';
const APPRAISAL_STATUS_VALUES: AppraisalStatusValue[] = [
  'draft', 'preliminary', 'submitted', 'stage2_submitted', 'reviewed', 'stage3_submitted',
];
interface ExistingAppraisal {
  id: number;
  appraisalData: string | AppraisalFormData;
  status: AppraisalStatusValue;
  formVersionId?: number | null;
  formVersionUuid?: string | null;
  isLockForm?: boolean;
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
  const { permissions, canView } = usePermissions();

  const apSectionMenuMap: Record<string, string> = {
    A: 'AP Seafarer Info',
    B: 'AP Start Info',
    C: 'AP Competence',
    D: 'AP Behavioural',
    E: 'AP Training Needs',
    F: 'AP Summary',
    G: 'AP Office Review',
  };

  const canViewSection = useCallback((sectionId: string): boolean => {
    const menuName = apSectionMenuMap[sectionId];
    if (!menuName) return true;
    if (permissions.length === 0) return true;
    return canView(menuName);
  }, [permissions, canView]);

  const [activeSection, setActiveSection] = useState("A");
  const [activeContinuousSection1, setActiveContinuousSection1] = useState('A'); // For A&B continuous scroll
  const [activeContinuousSection2, setActiveContinuousSection2] = useState('C'); // For C-F continuous scroll
  const [editingTraining, setEditingTraining] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [trainingComments, setTrainingComments] = useState<{[key: string]: string | null}>({});
  // Task #540: mirror trainingComments in a ref so the B1 auto-merge effect can
  // read the latest comment state (including freshly-typed or deleted comments)
  // when it rebuilds auto rows, without adding trainingComments to its dep array
  // (which would re-run the merge on every keystroke).
  const trainingCommentsRef = useRef<{[key: string]: string | null}>({});
  useEffect(() => { trainingCommentsRef.current = trainingComments; }, [trainingComments]);
  const [targetComments, setTargetComments] = useState<{[key: string]: string | null}>({});
  const [competenceComments, setCompetenceComments] = useState<{[key: string]: string | null}>({});
  const [behaviouralComments, setBehaviouralComments] = useState<{[key: string]: string | null}>({});
  const [trainingNeedsComments, setTrainingNeedsComments] = useState<{[key: string]: string | null}>({});
  const [recommendationComments, setRecommendationComments] = useState<{[key: string]: string | null}>({});
  const [trainingFollowupComments, setTrainingFollowupComments] = useState<{[key: string]: string | null}>({});
  const [isTrainingNeedsDialogOpen, setIsTrainingNeedsDialogOpen] = useState(false);
  const [isTrainingFollowupDialogOpen, setIsTrainingFollowupDialogOpen] = useState(false);
  const [editingAppraiserComment, setEditingAppraiserComment] = useState<string | null>(null);
  const [editingSeafarerComment, setEditingSeafarerComment] = useState<string | null>(null);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [editingOfficeReview, setEditingOfficeReview] = useState<string | null>(null);
  const [appraisalId, setAppraisalId] = useState<number | null>(propAppraisalId || null);
  // Task #503: bumped by the hydration effect so the B1 auto-merge re-runs
  // after `form.reset` + `setValue('trainings', ...)` overwrites the auto
  // rows with the persisted (possibly empty) trainings array.
  const [hydrationToken, setHydrationToken] = useState(0);
  const [appraisalStatus, setAppraisalStatus] = useState<AppraisalStatusValue>(initialStatus as AppraisalStatusValue);

  // Task #500: stage-progression helpers. Synonyms `stage2_submitted` and
  // `stage3_submitted` count the same as `submitted` and `reviewed`.
  const isPostStage1 = appraisalStatus !== 'draft';
  const isPostStage2 = appraisalStatus === 'submitted' || appraisalStatus === 'stage2_submitted'
    || appraisalStatus === 'reviewed' || appraisalStatus === 'stage3_submitted';
  const isPostStage3 = appraisalStatus === 'reviewed' || appraisalStatus === 'stage3_submitted';

  // Derive whether to show evaluation column in Part B
  const showEvaluation = isPostStage2;
  
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

  // Stage 1 captures Part B data only. If Part B (or all of its sub-sections)
  // is hidden by admin config, hide every Stage 1 control (header Save Draft
  // and the floating Save Draft / Submit Stage 1 row).
  const isStage1Available = isSectionVisible('partB')
    && (isSectionVisible('partB1') || isSectionVisible('partB2'));

  // Fetch vessels and ranks from persistent storage
  const { vessels, getVesselId } = useVesselLookup();
  const { data: availableRanks = [] } = useQuery<Array<{ id: number; name: string; category: string }>>({
    queryKey: ['/api/v2/admin/available-ranks'],
  });
  
  // Company training catalogue used by the G2 "Corresponding in DB" combobox.
  const { options: dbTrainingOptions, isLoading: isLoadingDbTrainings, isError: isErrorDbTrainings } = useCompanyTrainings();

  // Fetch appraisal types from V2 Masters (Master 023)
  const { data: appraisalTypesRaw = [] } = useAppraisalTypesV2();
  const appraisalTypes = useMemo(() => {
    return appraisalTypesRaw.map((entry: any) => ({
      id: entry.uuid || entry.entryId || entry.entry_id,
      name: entry.name,
      value: entry.name.toLowerCase().replace(/\s+/g, '-')
    }));
  }, [appraisalTypesRaw]);

  // Fetch existing appraisal data when editing
  // Note: queryKey must include full URL since default fetcher uses queryKey[0] as the URL
  const { data: existingAppraisal } = useQuery<ExistingAppraisal | undefined>({
    queryKey: [`/api/v2/appraisals/${appraisalId}`],
    enabled: !!appraisalId,
  });

  // Form-config fetching strategy:
  // - New appraisal (no appraisalId): load the latest released version for the rank.
  // - Existing appraisal with a pinned formVersionId: load that exact version's
  //   configuration so layout matches the version it was saved against.
  // - Existing appraisal with NO pinned formVersionId (historical row): fall back
  //   to the latest released version for the rank.
  type FormForRankResponse = {
    rankGroupConfig?: any;
    noReleasedVersion?: boolean;
    noReleasedVersionReason?: string;
  };
  type FormVersionConfigResponse = {
    rankGroupName: string | null;
    rankGroupConfig: any | null;
    formVersionId: number;
    formVersionUuid: string;
  };

  const isEditing = !!appraisalId;
  const pinnedFormVersionId = existingAppraisal?.formVersionId ?? null;
  // Wait for existingAppraisal before deciding whether to fall back to latest.
  const useLatestForEditing = isEditing && existingAppraisal !== undefined && !pinnedFormVersionId;
  const useLatestForNew = !isEditing;
  const useLatest = useLatestForNew || useLatestForEditing;
  const usePinned = isEditing && !!pinnedFormVersionId;

  const { data: latestFormConfig, isLoading: isLoadingLatestConfig } = useQuery<FormForRankResponse>({
    queryKey: [`/api/v2/admin/forms/for-rank/${encodeURIComponent(crewMember?.rank || '')}?category=appraisal`],
    enabled: !!crewMember?.rank && useLatest,
  });

  const { data: pinnedFormConfig, isLoading: isLoadingPinnedConfig } = useQuery<FormVersionConfigResponse>({
    queryKey: [`/api/v2/admin/form-versions/${pinnedFormVersionId}/configuration`],
    enabled: usePinned,
  });

  const formConfig: FormForRankResponse | undefined = usePinned
    ? (pinnedFormConfig
        ? { rankGroupConfig: pinnedFormConfig.rankGroupConfig, noReleasedVersion: false }
        : undefined)
    : latestFormConfig;
  const isLoadingFormConfig = usePinned ? isLoadingPinnedConfig : isLoadingLatestConfig;

  // Task #500: lock-form flag — once Stage 2 is submitted we trust the
  // snapshot stored on the appraisal record; before that we read the live
  // setting from the form config (pinned for re-opened drafts, latest for
  // brand-new appraisals).
  const isLockForm: boolean = isPostStage2
    ? !!(existingAppraisal as { isLockForm?: boolean } | undefined)?.isLockForm
    : !!(formConfig as { isLockForm?: boolean } | undefined)?.isLockForm
      || !!(pinnedFormConfig as { isLockForm?: boolean } | undefined)?.isLockForm;

  // Log form configuration for debugging
  useEffect(() => {
    if (formConfig) {
      console.log('✅ Form configuration loaded for rank:', crewMember?.rank, {
        source: usePinned ? `pinned version ${pinnedFormVersionId}` : 'latest released',
        formConfig,
      });
    }
  }, [formConfig, crewMember?.rank, usePinned, pinnedFormVersionId]);

  // Task #500: auto-fetch B1 trainings from Crew Pool D3 (crew_training_courses)
  // and merge any course `issued` within 12 months of sign-on into Part B1 as
  // read-only / non-deletable rows. The fetch stops once Stage 2 has been
  // submitted — at that point the rows are frozen on the appraisal record.
  const { data: crewTrainingCourses = [] } = useQuery<Array<{
    trainUuid?: string;
    courseId?: string;
    courseName?: string | null;
    trainingCourse?: string | null;
    issued?: string | null;
    expiry?: string | null;
  }>>({
    queryKey: ['/api/v2/crew-pool/crew', crewMember?.id, 'training'],
    // The default query fetcher only sends `queryKey[0]`, so we must provide
    // an explicit fetcher to hit the per-crew training endpoint.
    queryFn: async () => {
      const res = await fetch(`/api/v2/crew-pool/crew/${crewMember!.id}/training`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load crew trainings (${res.status})`);
      return res.json();
    },
    enabled: !!crewMember?.id && !isPostStage2,
    // Task #512: always refetch when the appraisal form mounts so a D3
    // training added in CrewInfoForm right before clicking "Add" reliably
    // appears in Part B1 instead of being served from a stale cache.
    staleTime: 0,
    refetchOnMount: 'always',
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
      competenceAssessments: [],
      behaviouralAssessments: [],
      trainingNeeds: [],
      recommendations: [],
      appraiserComments: [
        { id: "primary", name: "", rank: "", comment: "" }
      ],
      seafarerComments: [
        { id: "seafarer", name: "", rank: "", comment: "" }
      ],
      officeReviews: [],
      trainingFollowups: [],
    },
  });

  // Task #500: keep B1 in sync with the auto-fetched courses while the form
  // is still in pre-Stage-2 state. We drop any previously-injected `auto` rows,
  // keep all manual rows verbatim, and re-inject one auto row per course whose
  // `issued` date falls within [signOn - 12 months, signOn]. Stable identity
  // comes from `trainUuid` / `courseId` (prefixed `auto:` so it can't collide
  // with manual UUIDs). After Stage 2 submit the appraisal record owns the
  // snapshot and this effect short-circuits.
  const watchedSignOn = form.watch('signOn');
  useEffect(() => {
    if (isPostStage2) return;
    const signOnStr = (watchedSignOn || crewMember?.signOn || '').toString().trim();
    if (!signOnStr) return;
    const signOnDate = new Date(signOnStr);
    if (isNaN(signOnDate.getTime())) return;
    const windowStart = new Date(signOnDate);
    windowStart.setMonth(windowStart.getMonth() - 12);

    const inWindow = (issued?: string | null) => {
      if (!issued) return false;
      const d = new Date(issued);
      if (isNaN(d.getTime())) return false;
      return d >= windowStart && d <= signOnDate;
    };

    const existingRows = (form.getValues('trainings') || []) as Array<{
      id: string; training: string; evaluation: string; comment?: string; source?: string;
    }>;
    const manualRowsRaw = existingRows.filter(r => r.source !== 'auto');
    const existingAutoRows = existingRows.filter(r => r.source === 'auto');

    // Names that will appear as auto rows on this render — used to dedupe
    // any manual rows that happen to share a training name, so the appraiser
    // never sees the same course twice (one auto + one manual).
    const autoNames = new Set(
      (crewTrainingCourses || [])
        .filter(c => inWindow(c.issued))
        .map(c => (c.trainingCourse || c.courseName || c.courseId || 'Training').toString().trim().toLowerCase()),
    );
    const manualRows = manualRowsRaw.filter(
      r => !autoNames.has((r.training || '').toString().trim().toLowerCase()),
    );

    const normalizeName = (s?: string) => (s || '').toString().trim().toLowerCase();
    // Latest comment state (including in-flight edits/deletions not yet folded
    // back into the RHF rows). Used to keep a just-typed comment from being
    // dropped when the auto rows are rebuilt.
    const currentComments = trainingCommentsRef.current;
    // Records how each rebuilt auto row inherits its comment-state key, so we
    // can re-key `trainingComments` after the merge even when the auto id
    // changes across a hydration round-trip.
    const autoCommentReassignments: Array<{ newId: string; priorId?: string }> = [];

    const autoRows = (crewTrainingCourses || [])
      .filter(c => inWindow(c.issued))
      .map(c => {
        const trainingName = (c.trainingCourse || c.courseName || c.courseId || 'Training').toString();
        const stableKey = c.trainUuid || c.courseId || trainingName;
        const id = `auto:${stableKey}`;
        // Preserve any existing evaluation/comment across re-renders, including
        // after a server hydration that renumbers IDs. We first try to match by
        // our prefixed `auto:` id, then fall back to training-name (normalized),
        // which is what survives a hydration round-trip.
        const prior = existingAutoRows.find(r => r.id === id)
          || existingAutoRows.find(r => normalizeName(r.training) === normalizeName(trainingName));
        const priorId = prior?.id;
        // Resolve the comment, preferring live comment-state so a freshly-typed
        // (or deleted) comment is never dropped — even when a `form.reset`
        // (e.g. rank-group config load) has already cleared the RHF auto rows
        // but left the comment state intact. Order:
        //   1. live state under the new stable id (survives a reset that wiped
        //      the RHF rows),
        //   2. live state under the prior row id (covers an id change across a
        //      hydration round-trip),
        //   3. the prior RHF row's comment.
        // A `null` value marks a deleted comment and resolves to an empty
        // string, also clearing any stale text still sitting on the RHF row.
        let comment: string;
        if (id in currentComments) {
          comment = currentComments[id] ?? '';
        } else if (priorId !== undefined && priorId in currentComments) {
          comment = currentComments[priorId] ?? '';
        } else {
          comment = prior?.comment || '';
        }
        autoCommentReassignments.push({ newId: id, priorId });
        return {
          id,
          training: trainingName,
          evaluation: prior?.evaluation || '',
          comment,
          source: 'auto' as const,
        };
      });

    const next = [...autoRows, ...manualRows];
    // Skip the write if nothing changed structurally (prevents an effect loop).
    const same = next.length === existingRows.length
      && next.every((r, i) => existingRows[i]
        && existingRows[i].id === r.id
        && existingRows[i].training === r.training
        && (existingRows[i].source || 'manual') === (r.source || 'manual'));
    if (!same) {
      form.setValue('trainings', next as any, { shouldDirty: false });
    }

    // Re-key `trainingComments` so each auto row's comment state follows its
    // (possibly rebuilt) id. Strip every stale `auto:` key and re-add the
    // inherited value under the new id — including `null` for a deleted comment
    // and `""` for a freshly-opened empty box. Manual-row keys are untouched.
    // Bail out when nothing actually changed to avoid an extra render.
    setTrainingComments(prev => {
      const merged: {[key: string]: string | null} = {};
      Object.keys(prev).forEach(k => {
        if (!k.startsWith('auto:')) merged[k] = prev[k];
      });
      autoCommentReassignments.forEach(({ newId, priorId }) => {
        // Keep comment state already stored under the new (stable) id — this is
        // what survives a `form.reset` that cleared the RHF auto rows. Only fall
        // back to the prior id when the auto id actually changed across a
        // rebuild.
        if (newId in prev) {
          merged[newId] = prev[newId];
        } else if (priorId !== undefined && priorId in prev) {
          merged[newId] = prev[priorId];
        }
      });
      const prevKeys = Object.keys(prev);
      const mergedKeys = Object.keys(merged);
      const unchanged = prevKeys.length === mergedKeys.length
        && mergedKeys.every(k => k in prev && prev[k] === merged[k]);
      return unchanged ? prev : merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(crewTrainingCourses), watchedSignOn, crewMember?.signOn, isPostStage2, hydrationToken]);

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
      const fullNameForComment = `${crewMember.name?.first || ''} ${crewMember.name?.middle || ''} ${crewMember.name?.last || ''}`.trim();
      if (currentValues.seafarerComments.length === 0) {
        updates.seafarerComments = [{
          id: `seafarer-${Date.now()}`,
          name: fullNameForComment || '',
          rank: crewMember.rank || '',
          comment: ''
        }];
      } else if (currentValues.seafarerComments.length > 0 && !currentValues.seafarerComments[0].name) {
        updates.seafarerComments = currentValues.seafarerComments.map((c, i) =>
          i === 0 ? { ...c, name: fullNameForComment || '', rank: crewMember.rank || '' } : c
        );
      }
      
      if (Object.keys(updates).length > 0) {
        console.log('📋 Pre-populating crew member fields:', Object.keys(updates));
        form.reset({ ...currentValues, ...updates }, { keepDefaultValues: false });
      }
    }
  }, [crewMember, appraisalId, form]);

  // Normalize the vessel field to its master-data UUID. The vessel form value
  // may be a NAME — seeded from a crew member (new appraisal) or loaded from a
  // legacy/un-backfilled appraisal via form.reset(). The PartA <Select> options
  // are keyed by UUID, so the (disabled) field would otherwise show nothing.
  // Converting name -> UUID keeps the current vessel name visible and ensures
  // the UUID is what gets persisted on save.
  //
  // Keyed off the watched vessel value (not effect declaration order) so it
  // re-runs whenever the field changes — including after the existing-appraisal
  // hydration effect's form.reset() runs — and whenever vessel master data
  // finishes loading (getVesselId identity changes). It converges in one pass:
  // once the value is a UUID, getVesselId() returns undefined and no further
  // setValue happens. Names with no master match are left untouched.
  const watchedVessel = form.watch('vessel');
  useEffect(() => {
    if (!watchedVessel) return;
    const asId = getVesselId(watchedVessel);
    if (asId && asId !== watchedVessel) {
      form.setValue('vessel', asId, { shouldDirty: false });
    }
  }, [watchedVessel, getVesselId, form]);

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
      
      // Load Part B trainings from rank group config (always set to guarantee
      // clear-on-empty semantics even if form state is reused across navigations)
      updates.trainings = Array.isArray(config.rankGroupConfig.trainings)
        ? config.rankGroupConfig.trainings.map((t: any) => ({
            id: t.id,
            training: t.training ?? '',
            evaluation: t.evaluation ?? '',
            comment: t.comment ?? '',
          }))
        : [];

      // Load Part B targets from rank group config
      updates.targets = Array.isArray(config.rankGroupConfig.targets)
        ? config.rankGroupConfig.targets.map((t: any) => ({
            id: t.id,
            targetSetting: t.targetSetting ?? '',
            evaluation: t.evaluation ?? '',
            comment: t.comment ?? '',
          }))
        : [];

      // Load Part E training needs from rank group config
      updates.trainingNeeds = Array.isArray(config.rankGroupConfig.trainingNeeds)
        ? config.rankGroupConfig.trainingNeeds.map((t: any) => ({
            id: t.id,
            training: t.training ?? '',
            comment: t.comment ?? '',
            addedFromDB: t.addedFromDB,
            correspondingInDB: t.correspondingInDB,
          }))
        : [];

      // Load competence assessments from rank group config
      updates.competenceAssessments = Array.isArray(config.rankGroupConfig.competenceAssessments)
        ? config.rankGroupConfig.competenceAssessments.map((ca: any) => ({
            id: ca.id,
            assessmentCriteria: ca.assessmentCriteria,
            weight: ca.weight,
            effectiveness: ca.effectiveness || '',
            comment: ca.comment || '',
          }))
        : [];
      console.log('📋 Will set competenceAssessments:', updates.competenceAssessments.length, 'items');

      // Load behavioural assessments from rank group config
      updates.behaviouralAssessments = Array.isArray(config.rankGroupConfig.behaviouralAssessments)
        ? config.rankGroupConfig.behaviouralAssessments.map((ba: any) => ({
            id: ba.id,
            assessmentCriteria: ba.assessmentCriteria,
            weight: ba.weight,
            effectiveness: ba.effectiveness || '',
            comment: ba.comment || '',
          }))
        : [];
      console.log('📋 Will set behaviouralAssessments:', updates.behaviouralAssessments.length, 'items');

      // Load recommendations from rank group config
      updates.recommendations = Array.isArray(config.rankGroupConfig.recommendations)
        ? config.rankGroupConfig.recommendations.map((rec: any) => ({
            id: rec.id,
            question: rec.recommendation || rec.question,
            answer: rec.answer ?? (rec.yes ? 'Yes' : rec.no ? 'No' : rec.na ? 'NA' : ''),
            comment: rec.comment || '',
            isCustom: rec.isCustom !== undefined ? rec.isCustom : true,
          }))
        : [];
      console.log('📋 Will set recommendations:', updates.recommendations.length, 'items');

      // Load training followups (G2) from rank group config
      updates.trainingFollowups = Array.isArray(config.rankGroupConfig.trainingFollowups)
        ? config.rankGroupConfig.trainingFollowups.map((f: any) => ({
            id: f.id,
            training: f.training ?? '',
            correspondingInDB: f.correspondingInDB ?? '',
            category: f.category ?? 'Select Rating',
            status: f.status ?? 'Proposed',
            targetDate: f.targetDate ?? '',
            comment: f.comment ?? '',
          }))
        : [];
      console.log('📋 Will set trainingFollowups:', updates.trainingFollowups.length, 'items');

      // Use form.reset() to apply all updates at once - this triggers proper re-renders
      if (Object.keys(updates).length > 0) {
        console.log('📋 Resetting form with config values');
        form.reset({ ...currentValues, ...updates }, { keepDefaultValues: false });
      }

      // Task #527: the reset above overwrites `trainings` with the rank-group
      // defaults (or an empty list), clobbering any D3 auto-rows the B1
      // auto-merge effect had already injected. Bump the hydration token so
      // that effect re-runs and re-injects the in-window trainings on top of
      // the (manual) rank-group rows. Without this, new appraisals show an
      // empty B1 even when in-window trainings exist.
      setHydrationToken(t => t + 1);
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
    mutationFn: async (payload: { data: AppraisalFormData; status: string; existingId?: number | null; closeAfter?: boolean; isDraftAction?: boolean; silent?: boolean }) => {
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
      const url = idToUse ? `/api/v2/appraisals/${idToUse}` : '/api/v2/appraisals';
      
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
        queryClient.setQueryData([`/api/v2/appraisals/${data.id}`], data);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] });
      if (!variables.silent) {
        const isDraftAction = variables.isDraftAction === true || variables.status === 'draft';
        toast({
          title: isDraftAction ? 'Draft Saved' : 'Appraisal Submitted',
          description: isDraftAction
            ? 'Your appraisal draft has been saved successfully. You can now submit stages.'
            : 'Your appraisal has been submitted successfully.',
        });
      }
      if (variables.closeAfter) {
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

  // Stage 1 mutation (Parts A & B) - accepts synced form data to ensure comment persistence
  const stage1Mutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: AppraisalFormData }) => {
      const stageData = {
        seafarersName: formData.seafarersName,
        seafarersRank: formData.seafarersRank,
        nationality: formData.nationality ?? "",
        vessel: formData.vessel,
        signOn: formData.signOn ?? "",
        appraisalType: formData.appraisalType,
        appraisalPeriodFrom: formData.appraisalPeriodFrom ?? "",
        appraisalPeriodTo: formData.appraisalPeriodTo ?? "",
        personalityIndexCategory: formData.personalityIndexCategory ?? "",
        primaryAppraiser: formData.primaryAppraiser ?? "",
        trainings: formData.trainings,
        targets: formData.targets,
      };
      
      const response = await apiRequest('POST', `/api/v2/appraisals/${id}/submit-stage1`, {
        data: stageData,
        submittedBy: 'Current User',
      });
      return response.json();
    },
    onSuccess: (responseData) => {
      if (appraisalStatus === 'draft') {
        setAppraisalStatus('preliminary');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] });
      if (appraisalId) queryClient.setQueryData([`/api/v2/appraisals/${appraisalId}`], responseData);
      toast({ title: 'Stage 1 Submitted', description: 'Appraisal information (Parts A-B) saved successfully.' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit Stage 1', variant: 'destructive' });
    },
  });

  // Stage 2 mutation (Parts C, D, E, F) - accepts synced form data to ensure comment persistence
  const stage2Mutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: AppraisalFormData }) => {
      // Calculate scores from current form data so the Crew Appraisals table
      // reflects the Overall score immediately on direct Stage 2 submit
      // (mirrors logic used by saveAppraisalMutation / Save Draft).
      const calcScore = (assessments: any[]) => {
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
      const competenceScore = calcScore(formData.competenceAssessments);
      const behavioralScore = calcScore(formData.behaviouralAssessments);
      const overallScore = (competenceScore && behavioralScore)
        ? ((parseFloat(competenceScore) + parseFloat(behavioralScore)) / 2).toFixed(1)
        : null;

      const stageData = {
        // Task #500: snapshot the current B1 trainings (auto + manual) and
        // Stage-1 targets at Stage 2 submission so the live D3 re-sync that
        // happens up to Stage 2 is frozen into the appraisal record.
        trainings: formData.trainings,
        targets: formData.targets,
        competenceAssessments: formData.competenceAssessments,
        behaviouralAssessments: formData.behaviouralAssessments,
        trainingNeeds: formData.trainingNeeds,
        recommendations: formData.recommendations,
        appraiserComments: formData.appraiserComments,
        seafarerComments: formData.seafarerComments,
      };
      
      const response = await apiRequest('POST', `/api/v2/appraisals/${id}/submit-stage2`, {
        data: stageData,
        submittedBy: 'Current User',
        competenceRating: competenceScore,
        behavioralRating: behavioralScore,
        overallRating: overallScore,
      });
      return response.json();
    },
    onSuccess: (responseData) => {
      if (appraisalStatus === 'draft' || appraisalStatus === 'preliminary') {
        setAppraisalStatus('submitted');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] });
      if (appraisalId) queryClient.setQueryData([`/api/v2/appraisals/${appraisalId}`], responseData);
      toast({ title: 'Stage 2 Submitted', description: 'Performance assessment (Parts C-F) saved successfully.' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit Stage 2', variant: 'destructive' });
    },
  });

  // Stage 3 mutation (Part G) - accepts synced form data to ensure comment persistence
  const stage3Mutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: AppraisalFormData }) => {
      const stageData = {
        // Task #500: B1 Evaluation stays editable through Stage 3, so we must
        // ship the latest `trainings` array along with Section G payloads so
        // server-side Stage 3 validation sees the updated evaluations and the
        // sync writes them in the same transaction.
        trainings: formData.trainings,
        officeReviews: formData.officeReviews,
        trainingFollowups: formData.trainingFollowups,
      };
      
      const response = await apiRequest('POST', `/api/v2/appraisals/${id}/submit-stage3`, {
        data: stageData,
        submittedBy: 'Current User',
      });
      return response.json();
    },
    onSuccess: (responseData) => {
      setAppraisalStatus('reviewed');
      queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] });
      if (appraisalId) queryClient.setQueryData([`/api/v2/appraisals/${appraisalId}`], responseData);
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
        
        // Explicitly set nested array fields after reset to ensure Select components bind correctly
        if (parsedData.competenceAssessments) {
          form.setValue('competenceAssessments', parsedData.competenceAssessments, { shouldDirty: false });
        }
        if (parsedData.behaviouralAssessments) {
          form.setValue('behaviouralAssessments', parsedData.behaviouralAssessments, { shouldDirty: false });
        }
        if (parsedData.recommendations) {
          form.setValue('recommendations', parsedData.recommendations, { shouldDirty: false });
        }
        if (parsedData.trainings) {
          form.setValue('trainings', parsedData.trainings, { shouldDirty: false });
        }
        if (parsedData.targets) {
          form.setValue('targets', parsedData.targets, { shouldDirty: false });
        }
        if (parsedData.trainingNeeds) {
          form.setValue('trainingNeeds', parsedData.trainingNeeds, { shouldDirty: false });
        }
        if (parsedData.trainingFollowups) {
          form.setValue('trainingFollowups', parsedData.trainingFollowups, { shouldDirty: false });
        }
        if (parsedData.appraiserComments) {
          form.setValue('appraiserComments', parsedData.appraiserComments, { shouldDirty: false });
        }
        if (parsedData.seafarerComments) {
          form.setValue('seafarerComments', parsedData.seafarerComments, { shouldDirty: false });
        }
        if (parsedData.officeReviews) {
          form.setValue('officeReviews', parsedData.officeReviews, { shouldDirty: false });
        }
        
        // Load comments from form data into useState hooks for persistence
        loadCommentsFromFormData(parsedData);
        
        // Update status from fetched data
        if (existingAppraisal.status && APPRAISAL_STATUS_VALUES.includes(existingAppraisal.status)) {
          setAppraisalStatus(existingAppraisal.status as AppraisalStatusValue);
        }

        // Task #503: signal the B1 auto-merge effect to re-run now that
        // hydration has overwritten `trainings` with the persisted value,
        // so the D3 auto rows get re-injected on top.
        setHydrationToken(t => t + 1);

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
  const handleStageSubmission = async (
    stage: 'stage1' | 'stage2' | 'stage3',
    options?: { skipLockConfirm?: boolean },
  ) => {
    // Show a confirmation modal before any stage submission. Stage 2 uses
    // the spec-mandated lock-warning copy; Stage 1 and Stage 3 use a generic
    // "are you sure" prompt. The handler re-enters with `skipLockConfirm:
    // true` once the user confirms.
    if (!options?.skipLockConfirm) {
      let title = '';
      let description = '';
      if (stage === 'stage1') {
        title = 'Submit Stage 1';
        description = 'Are you sure you want to submit Stage 1? You will still be able to save drafts and continue to Stage 2 afterwards.';
      } else if (stage === 'stage2') {
        title = 'Submit Stage 2';
        description = isLockForm
          ? 'Form will be locked upon submission. If you want to make changes before final submission, you can use the Draft Save option.'
          : 'Are you sure you want to submit Stage 2?';
      } else {
        title = 'Submit Stage 3';
        // Task #513: only warn about a full-form lock when the admin
        // lock-form flag is on; otherwise use a neutral confirmation.
        description = isLockForm
          ? 'Submitting Stage 3 will lock the entire form. This action cannot be undone from here.'
          : 'Are you sure you want to submit Stage 3? This action cannot be undone from here.';
      }
      showConfirmDialog(
        title,
        description,
        () => { void handleStageSubmission(stage, { skipLockConfirm: true }); },
      );
      return;
    }
    // Task #500/#542: Stage 3 requires every B1 training row AND every B2
    // target row to carry an Evaluation. Check both sections and, if anything
    // is missing in either, show one generic message naming both sections.
    if (stage === 'stage3') {
      // Only check sections that are actually visible: hidden sections have
      // their array payloads cleared during schema validation below, so stale
      // data in a hidden B1/B2 must not block submission.
      const trainings = isSectionVisible('partB1')
        ? (form.getValues('trainings') || []) as Array<{ evaluation?: string }>
        : [];
      const targets = isSectionVisible('partB2')
        ? (form.getValues('targets') || []) as Array<{ evaluation?: string }>
        : [];
      const missingB1 = trainings.findIndex(t => !((t.evaluation || '').toString().trim()));
      const missingB2 = targets.findIndex(t => !((t.evaluation || '').toString().trim()));
      if (missingB1 !== -1 || missingB2 !== -1) {
        toast({
          title: 'B1 and B2 Evaluations are required',
          description: 'B1 and B2 Evaluations are required. Please complete all pending evaluation ratings before submitting Stage 3.',
          variant: 'destructive',
        });
        // Jump the user back to Part B and focus the first offending Evaluation
        // input so they can act on the error without hunting for it. Prefer the
        // first missing B1 row; otherwise focus the first missing B2 row.
        try {
          partBRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            // Part B renders evaluation selects with testids keyed by the row's
            // stable id, e.g. `select-training-eval-${id}` / `select-target-eval-${id}`.
            let sel: string;
            if (missingB1 !== -1) {
              const missingId = (form.getValues('trainings')?.[missingB1] as any)?.id;
              sel = missingId
                ? `[data-testid="select-training-eval-${missingId}"]`
                : `[data-testid^="select-training-eval-"]`;
            } else {
              const missingId = (form.getValues('targets')?.[missingB2] as any)?.id;
              sel = missingId
                ? `[data-testid="select-target-eval-${missingId}"]`
                : `[data-testid^="select-target-eval-"]`;
            }
            const el = document.querySelector<HTMLElement>(sel);
            el?.focus();
          }, 300);
        } catch { /* non-fatal */ }
        return;
      }
    }
    // Get form data with synced comments from useState hooks
    const formData = getFormDataWithSyncedComments();

    // Build a sanitized copy for client-side validation that respects the
    // active form config: clear all array payloads belonging to hidden
    // sections so their per-row schemas don't block submission.
    type ArrayFieldKey =
      | 'trainings'
      | 'targets'
      | 'competenceAssessments'
      | 'behaviouralAssessments'
      | 'trainingNeeds'
      | 'recommendations'
      | 'appraiserComments'
      | 'seafarerComments'
      | 'officeReviews'
      | 'trainingFollowups';
    const hiddenSectionArrayKeys: Record<string, ArrayFieldKey[]> = {
      partB: ['trainings', 'targets'],
      partB1: ['trainings'],
      partB2: ['targets'],
      partC: ['competenceAssessments'],
      partD: ['behaviouralAssessments'],
      partE: ['trainingNeeds'],
      partF: ['recommendations', 'appraiserComments', 'seafarerComments'],
      partG: ['officeReviews', 'trainingFollowups'],
    };
    const dataForValidation: AppraisalFormData = { ...formData };
    for (const section of hiddenSections) {
      const keys = hiddenSectionArrayKeys[section];
      if (!keys) continue;
      for (const key of keys) {
        (dataForValidation[key] as unknown[]) = [];
      }
    }

    // Build a stage schema that omits any hidden Part A field (so required
    // fields in `hiddenFields` like appraisalType don't trip min(1) errors).
    const omitForStage = (baseSchema: z.AnyZodObject): z.AnyZodObject => {
      const shapeKeys = Object.keys(baseSchema.shape);
      const mask: { [key: string]: true } = {};
      for (const f of hiddenFields) {
        if (shapeKeys.includes(f)) mask[f] = true;
      }
      return Object.keys(mask).length ? baseSchema.omit(mask) : baseSchema;
    };

    // Validate stage-specific data
    try {
      if (stage === 'stage1') {
        omitForStage(stage1Schema).parse(dataForValidation);
      } else if (stage === 'stage2') {
        omitForStage(stage2Schema).parse(dataForValidation);
      } else if (stage === 'stage3') {
        omitForStage(stage3Schema).parse(dataForValidation);
      }
    } catch (error: unknown) {
      const err = error as { errors?: Array<{ message?: string }> };
      toast({ 
        title: 'Validation Error', 
        description: err.errors?.[0]?.message || 'Please complete all required fields for this stage.', 
        variant: 'destructive' 
      });
      return;
    }
    
    let idToUse = appraisalId;
    
    // If no appraisalId, save as draft first
    if (!idToUse) {
      try {
        const result = await saveAppraisalMutation.mutateAsync({ data: formData, status: 'draft', closeAfter: false, silent: true });
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
    
    // Trigger the appropriate stage mutation with guaranteed non-null ID and synced form data
    if (stage === 'stage1') {
      stage1Mutation.mutate({ id: idToUse, formData });
    } else if (stage === 'stage2') {
      stage2Mutation.mutate({ id: idToUse, formData });
    } else if (stage === 'stage3') {
      stage3Mutation.mutate({ id: idToUse, formData });
    }
  };

  const onSubmit = (data: AppraisalFormData) => {
    console.log('🔵 onSubmit called with data:', data);
    console.log('🔵 Mutation isPending:', saveAppraisalMutation.isPending);
    // Get form data with synced comments from useState hooks
    const syncedData = getFormDataWithSyncedComments();
    saveAppraisalMutation.mutate({ data: syncedData, status: 'draft', closeAfter: false });
  };

  const handleSaveDraft = () => {
    console.log('💾 handleSaveDraft called - bypassing validation');
    // Get form data with synced comments from useState hooks
    // (this also drops completely-blank G2 follow-up rows)
    const data = getFormDataWithSyncedComments();
    console.log('💾 Form values:', data);
    console.log('💾 Form errors (ignored for draft):', form.formState.errors);
    // Enforce mandatory G2 (Training Follow-up) name even on draft save:
    // any remaining (non-blank) row must have a training name.
    const hasMissingTrainingName = (data.trainingFollowups ?? []).some(
      f => !(f.training ?? '').trim()
    );
    if (hasMissingTrainingName) {
      toast({
        title: 'Validation Error',
        description: 'Training name is required in Part G2',
        variant: 'destructive',
      });
      return;
    }
    // Preserve current workflow status after Stage 1 or Stage 2 submission
    // Only use 'draft' status before Stage 1 has been submitted
    const statusToSave = appraisalStatus === 'draft' ? 'draft' : appraisalStatus;
    console.log('💾 Preserving status:', statusToSave);
    saveAppraisalMutation.mutate({ data, status: statusToSave, closeAfter: false, isDraftAction: true });
  };

  const onSubmitAppraisal = () => {
    console.log('🟢 onSubmitAppraisal called');
    console.log('🟢 Form errors:', form.formState.errors);
    form.handleSubmit(() => {
      // Get form data with synced comments from useState hooks
      const syncedData = getFormDataWithSyncedComments();
      console.log('🟢 Submit handler called with synced data:', syncedData);
      saveAppraisalMutation.mutate({ data: syncedData, status: 'submitted', closeAfter: true });
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
        setTrainingComments(prev => ({ ...prev, [id]: null }));
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
        setTargetComments(prev => ({ ...prev, [id]: null }));
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
        setCompetenceComments(prev => ({ ...prev, [id]: null }));
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
        setBehaviouralComments(prev => ({ ...prev, [id]: null }));
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
        setTrainingNeedsComments(prev => ({ ...prev, [id]: null }));
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
        setRecommendationComments(prev => ({ ...prev, [id]: null }));
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
        setTrainingFollowupComments(prev => ({ ...prev, [id]: null }));
        setEditingTrainingFollowupComment(null);
        closeConfirmDialog();
      }
    );
  };

  // Merge comments from useState hooks into a copy of form data
  // Returns merged data object ready for saving - avoids setValue/getValues timing issues
  // Uses nullish coalescing to handle sections that may be hidden/undefined via rank config
  const getFormDataWithSyncedComments = (): AppraisalFormData => {
    const data = form.getValues();
    
    const resolveComment = (map: {[key: string]: string | null}, id: string, fallback: string) => {
      if (id in map) {
        return map[id] ?? "";
      }
      return fallback || "";
    };

    const updatedTrainings = (data.trainings ?? []).map(t => ({
      ...t,
      comment: resolveComment(trainingComments, t.id, t.comment)
    }));

    const updatedTargets = (data.targets ?? []).map(t => ({
      ...t,
      comment: resolveComment(targetComments, t.id, t.comment)
    }));

    const updatedCompetenceAssessments = (data.competenceAssessments ?? []).map(c => ({
      ...c,
      comment: resolveComment(competenceComments, c.id, c.comment)
    }));

    const updatedBehaviouralAssessments = (data.behaviouralAssessments ?? []).map(b => ({
      ...b,
      comment: resolveComment(behaviouralComments, b.id, b.comment)
    }));

    const updatedTrainingNeeds = (data.trainingNeeds ?? []).map(t => ({
      ...t,
      comment: resolveComment(trainingNeedsComments, t.id, t.comment)
    }));

    const updatedRecommendations = (data.recommendations ?? []).map(r => ({
      ...r,
      comment: resolveComment(recommendationComments, r.id, r.comment)
    }));

    const updatedTrainingFollowups = (data.trainingFollowups ?? [])
      .map(f => ({
        ...f,
        comment: resolveComment(trainingFollowupComments, f.id, f.comment)
      }))
      .filter(f => {
        const isBlank =
          !(f.training ?? '').trim() &&
          !(f.correspondingInDB ?? '').trim() &&
          !(f.category ?? '').trim() &&
          !(f.status ?? '').trim() &&
          !(f.targetDate ?? '').trim() &&
          !(f.comment ?? '').trim();
        return !isBlank;
      });

    // Reflect blank-row removal in the UI immediately (no page refresh needed)
    if (updatedTrainingFollowups.length !== (data.trainingFollowups?.length ?? 0)) {
      form.setValue('trainingFollowups', updatedTrainingFollowups, { shouldDirty: false });
    }

    const appraiserLabels: Record<string, string> = {
      "master": "Master",
      "chief-officer": "Chief Officer",
      "chief-engineer": "Chief Engineer",
      "2nd-engineer": "2nd Engineer",
      "marine-superintendent": "Marine Superintendent",
      "technical-superintendent": "Technical Superintendent",
      "crew-manager": "Crew Manager"
    };
    const updatedAppraiserComments = (data.appraiserComments ?? []).map((c, index) => {
      if (index === 0) {
        const appraiserValue = data.primaryAppraiser;
        const resolvedRank = appraiserValue ? (appraiserLabels[appraiserValue] || appraiserValue) : c.rank;
        return { ...c, name: 'Primary Appraiser', rank: resolvedRank || c.rank };
      }
      return c;
    });

    const seafarerName = data.seafarersName || '';
    const seafarerRank = data.seafarersRank || '';
    const updatedSeafarerComments = (data.seafarerComments ?? []).map(c => ({
      ...c,
      name: seafarerName || c.name,
      rank: seafarerRank || c.rank,
    }));

    return {
      ...data,
      // Persist the vessel as its master-data UUID so the appraisal always
      // reflects the vessel's CURRENT name (resolved at display). If the form
      // value is already a UUID (or the name can't be resolved), keep it as-is.
      vessel: getVesselId(data.vessel) || data.vessel,
      signOn: data.signOn ?? "",
      appraisalPeriodFrom: data.appraisalPeriodFrom ?? "",
      appraisalPeriodTo: data.appraisalPeriodTo ?? "",
      personalityIndexCategory: data.personalityIndexCategory ?? "",
      primaryAppraiser: data.primaryAppraiser ?? "",
      trainings: updatedTrainings,
      targets: updatedTargets,
      competenceAssessments: updatedCompetenceAssessments,
      behaviouralAssessments: updatedBehaviouralAssessments,
      trainingNeeds: updatedTrainingNeeds,
      recommendations: updatedRecommendations,
      trainingFollowups: updatedTrainingFollowups,
      appraiserComments: updatedAppraiserComments,
      seafarerComments: updatedSeafarerComments,
    };
  };

  // Load comments from form data into useState hooks when form is populated
  const loadCommentsFromFormData = (formData: AppraisalFormData) => {
    // Load training comments
    const trainingsComments: {[key: string]: string} = {};
    formData.trainings?.forEach(t => {
      if (t.comment) trainingsComments[t.id] = t.comment;
    });
    setTrainingComments(trainingsComments);

    // Load target comments
    const targetsComments: {[key: string]: string} = {};
    formData.targets?.forEach(t => {
      if (t.comment) targetsComments[t.id] = t.comment;
    });
    setTargetComments(targetsComments);

    // Load competence assessment comments
    const compComments: {[key: string]: string} = {};
    formData.competenceAssessments?.forEach(c => {
      if (c.comment) compComments[c.id] = c.comment;
    });
    setCompetenceComments(compComments);

    // Load behavioural assessment comments
    const behComments: {[key: string]: string} = {};
    formData.behaviouralAssessments?.forEach(b => {
      if (b.comment) behComments[b.id] = b.comment;
    });
    setBehaviouralComments(behComments);

    // Load training needs comments
    const tnComments: {[key: string]: string} = {};
    formData.trainingNeeds?.forEach(t => {
      if (t.comment) tnComments[t.id] = t.comment;
    });
    setTrainingNeedsComments(tnComments);

    // Load recommendation comments
    const recComments: {[key: string]: string} = {};
    formData.recommendations?.forEach(r => {
      if (r.comment) recComments[r.id] = r.comment;
    });
    setRecommendationComments(recComments);

    // Load training followup comments
    const tfComments: {[key: string]: string} = {};
    formData.trainingFollowups?.forEach(f => {
      if (f.comment) tfComments[f.id] = f.comment;
    });
    setTrainingFollowupComments(tfComments);
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
      addedFromDB: true,
      correspondingInDB: template.id,
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
      correspondingInDB: "",
      category: "",
      status: "" as const,
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
      correspondingInDB: "",
      category: "",
      status: "" as const,
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
      category: "",
      status: "" as const,
      targetDate: "",
      comment: "",
      addedFromDB: true,
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
      if (!canViewSection(section.id)) return false;
      const hiddenKey = sectionIdToHiddenKey[section.id];
      if (hiddenKey) {
        if (!isSectionVisible(hiddenKey)) return false;
      }
      // Part B is also effectively hidden if both B1 and B2 sub-sections are hidden
      if (section.id === "B" && !isSectionVisible('partB1') && !isSectionVisible('partB2')) {
        return false;
      }
      return true;
    });
  }, [allSections, hiddenSections, permissions]);

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

  // Intersection Observer for continuous group 1 (A&B).
  // When Parts A-F render together in a single scroll container
  // (mergeContinuousAtoF in the JSX below — i.e. Part B2 hidden by
  // config or Stage 1 already submitted), this same observer also
  // tracks Parts C-F so the sidebar highlight follows real-time scroll
  // across the whole form.
  useEffect(() => {
    if (!continuous1ContainerRef.current) return;
    const mergedAF = !isSectionVisible('partB2') || isPostStage1;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        // Update the active continuous section if there's a significant intersection
        if (mostVisible && mostVisible.intersectionRatio > 0.4) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (!sectionId) return;
          const matched = sections.find(s => s.id === sectionId);
          if (matched?.type === 'continuous1') {
            if (sectionId !== activeContinuousSection1) setActiveContinuousSection1(sectionId);
            // In merged A-F mode, ensure only one section is highlighted at a time.
            if (mergedAF && activeContinuousSection2) setActiveContinuousSection2('');
          } else if (matched?.type === 'continuous2') {
            if (sectionId !== activeContinuousSection2) setActiveContinuousSection2(sectionId);
            if (mergedAF && activeContinuousSection1) setActiveContinuousSection1('');
          }
        }
      },
      {
        root: continuous1ContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-50px 0px -50px 0px'
      }
    );

    // Observe continuous1 sections (A&B). In merged A-F mode, also
    // observe C-F so the sidebar highlight updates as the user scrolls
    // past those sections inside the same scroll container.
    const observed = mergedAF
      ? sections.filter(s => s.type === 'continuous1' || s.type === 'continuous2')
      : sections.filter(s => s.type === 'continuous1');
    observed.forEach(section => {
      if (section.ref?.current) {
        observer.observe(section.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [activeContinuousSection1, activeContinuousSection2, sections, isPostStage1, isSectionVisible]);

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
      // Set the highlight immediately so the sidebar reflects the click
      // even before the scroll-based observer catches up.
      setActiveContinuousSection1(sectionId);
      setActiveContinuousSection2('');
      setTimeout(() => scrollToSection(sectionId), 100); // Small delay to ensure DOM is ready
    } else if (section.type === 'continuous2') {
      // For continuous2 sections (C-F), stay in the continuous view and scroll to section
      if (!['C', 'D', 'E', 'F'].includes(activeSection)) {
        setActiveSection('C'); // Switch to continuous2 view
      }
      setActiveContinuousSection2(sectionId);
      setActiveContinuousSection1('');
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
      <div className="flex flex-col gap-6 sm:gap-8">
        {/* Part A: Seafarer's Information - Extracted Component */}
        {canViewSection('A') && (
        <PartA
          form={form}
          partRef={partARef}
          vessels={vessels}
          availableRanks={availableRanks}
          appraisalTypes={appraisalTypes}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}

        {/* Part B: Information at Start of Appraisal Period - Extracted Component */}
        {canViewSection('B') && (
        <PartB
          form={form}
          partRef={partBRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
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
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}

        {/* Stage 1 Action Buttons - kept in parent for form-level control.
            Negative top margin pulls the row closer to the Part B card so
            it doesn't float in the middle of the section gap. */}
        <div className="flex justify-end gap-4 -mt-2 sm:-mt-4">
          <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
            Save
          </Button>
          <Button 
            type="button"
            className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8" 
            onClick={() => handleStageSubmission('stage1')}
            disabled={stage1Mutation.isPending || saveAppraisalMutation.isPending || isPostStage1}
            data-testid="button-submit-stage1"
          >
            {stage1Mutation.isPending ? 'Submitting...' : 'Submit Stage 1'}
          </Button>
        </div>
      </div>
    );
  };

  // Function to render continuous sections 2 (C-F) - using extracted Part components
  const renderContinuousSections2 = () => {
    const competenceSectionScore = calculateSectionScore();
    const behaviouralSectionScore = calculateBehaviouralSectionScore();
    const overallScore = calculateOverallScore();

    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        {canViewSection('C') && (
        <PartC
          form={form}
          partRef={partCRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
          competenceComments={competenceComments}
          setCompetenceComments={setCompetenceComments}
          editingCompetenceComment={editingCompetenceComment}
          setEditingCompetenceComment={setEditingCompetenceComment}
          updateCompetenceAssessment={updateCompetenceAssessment}
          competenceSectionScore={competenceSectionScore}
          getScoreColors={getScoreColors}
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}

        {canViewSection('D') && (
        <PartD
          form={form}
          partRef={partDRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
          behaviouralComments={behaviouralComments}
          setBehaviouralComments={setBehaviouralComments}
          editingBehaviouralComment={editingBehaviouralComment}
          setEditingBehaviouralComment={setEditingBehaviouralComment}
          updateBehaviouralAssessment={updateBehaviouralAssessment}
          behaviouralSectionScore={behaviouralSectionScore}
          getScoreColors={getScoreColors}
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}

        {canViewSection('E') && (
        <PartE
          form={form}
          partRef={partERef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
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
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}

        {canViewSection('F') && (
        <PartF
          form={form}
          partRef={partFRef}
          appraisalStatus={appraisalStatus}
          isFieldVisible={isFieldVisible}
          isSectionVisible={isSectionVisible}
          showConfirmDialog={showConfirmDialog}
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
          isLockForm={isLockForm}
          isPostStage1={isPostStage1}
          isPostStage2={isPostStage2}
          isPostStage3={isPostStage3}
        />
        )}
      </div>
    );
  };

  const noReleasedVersion = !!formConfig?.noReleasedVersion;
  if (noReleasedVersion && !appraisalId) {
    const reason = formConfig?.noReleasedVersionReason || 'No released form version is available for this rank.';
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-lg w-full max-w-md p-6 flex flex-col gap-4" data-testid="banner-no-released-version">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Form Not Available</h2>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-no-released">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-700">{reason}</p>
          <p className="text-xs text-gray-500">
            An administrator must release a form version for this rank group before appraisals can be started.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="button-dismiss-no-released">Close</Button>
          </div>
        </div>
      </div>
    );
  }

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
            {isStage1Available && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isPostStage3}
                  className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
                  data-testid="button-save-draft-header"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isPostStage3}
                  className="sm:hidden"
                  data-testid="button-save-draft-header-mobile"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              // For continuous sections, use their respective activeContinuousSection, for steppers use activeSection.
              // In merged A-F mode (Part B2 hidden OR Stage 1 submitted) Parts A-F all live in one scroll
              // container, so continuous2 highlights must be allowed even when activeSection is A/B.
              const mergedAFNav = !isSectionVisible('partB2') || isPostStage1;
              const isActive = section.type === 'continuous1' 
                ? ((mergedAFNav || ['A', 'B'].includes(activeSection)) && activeContinuousSection1 === section.id)
                : section.type === 'continuous2' 
                  ? ((mergedAFNav || ['C', 'D', 'E', 'F'].includes(activeSection)) && activeContinuousSection2 === section.id)
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
                  // See merged-mode comment in the mobile nav above.
                  const mergedAFSide = !isSectionVisible('partB2') || isPostStage1;
                  const isActive = section.type === 'continuous1' 
                    ? ((mergedAFSide || ['A', 'B'].includes(activeSection)) && activeContinuousSection1 === section.id)
                    : section.type === 'continuous2' 
                      ? ((mergedAFSide || ['C', 'D', 'E', 'F'].includes(activeSection)) && activeContinuousSection2 === section.id)
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
                
                {/* Render content based on section type.
                    Task #500: continuous A-F scroll. When Part B2 is hidden by
                    config, or once Stage 1 has been submitted, A-F is rendered
                    as a single continuous container. Otherwise the legacy
                    two-container split (Stage 1 = A/B, Stage 2 = C/D/E/F) is
                    preserved so the user must explicitly submit Stage 1
                    before scrolling into Stage 2. */}
                {(() => {
                  const mergeContinuousAtoF = !isSectionVisible('partB2') || isPostStage1;
                  if (mergeContinuousAtoF) {
                    if (!['A', 'B', 'C', 'D', 'E', 'F'].includes(activeSection)) return null;
                    return (
                      <div ref={continuous1ContainerRef} className="h-[calc(100vh-200px)] overflow-y-auto flex flex-col gap-6 sm:gap-8" data-testid="container-continuous-af">
                        {renderContinuousSections1()}
                        {renderContinuousSections2()}
                      </div>
                    );
                  }
                  return (
                    <>
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
                    </>
                  );
                })()}
                
                {/* Part G: Office Review & Followup - Traditional Stepper */}
                {activeSection === "G" && canViewSection('G') && (
                  <PartG
                    form={form}
                    partRef={partGRef}
                    appraisalStatus={appraisalStatus}
                    isFieldVisible={isFieldVisible}
                    isSectionVisible={isSectionVisible}
                    showConfirmDialog={showConfirmDialog}
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
                    isLockForm={isLockForm}
                    isPostStage1={isPostStage1}
                    isPostStage2={isPostStage2}
                    isPostStage3={isPostStage3}
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
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Name<RequiredMark /></FormLabel>
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
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Rank<RequiredMark /></FormLabel>
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
                                            (nationality) => nationality.toLowerCase() === field.value?.toLowerCase()
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
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel<RequiredMark /></FormLabel>
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
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Type<RequiredMark /></FormLabel>
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
                                <Input {...field} min={(watchedSignOn || crewMember?.signOn) || undefined} placeholder="dd.mm.yyyy" type="date" className="bg-[#ffffff]" />
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
                        <Button type="button" className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
                          Save
                        </Button>
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part B: Information at Start of Appraisal Period */}
                {activeSection === "information" && isSectionVisible('partB') && (isSectionVisible('partB1') || isSectionVisible('partB2')) && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B: Information at Start of Appraisal Period</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="space-y-8">
                      {/* B1. Trainings conducted prior joining vessel */}
                      {isSectionVisible('partB1') && (
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
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
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
                                          <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {training.id in trainingComments && trainingComments[training.id] !== null && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        {editingTrainingComment === training.id ? (
                                          <Textarea
                                            value={trainingComments[training.id] ?? ""}
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
                                                onClick={(e) => { e.stopPropagation(); deleteTrainingComment(training.id); }}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                      )}

                      {/* B2. Target Setting */}
                      {isSectionVisible('partB2') && (
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
                                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
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
                                          <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {target.id in targetComments && targetComments[target.id] !== null && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        {editingTargetComment === target.id ? (
                                          <Textarea
                                            value={targetComments[target.id] ?? ""}
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
                                                onClick={(e) => { e.stopPropagation(); deleteTargetComment(target.id); }}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                      )}

                      <div className="flex justify-end gap-4 mt-6">
                        <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
                          Save
                        </Button>
                        <Button 
                          type="button"
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
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness<RequiredMark /></th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
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
                                        <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                {assessment.id in competenceComments && competenceComments[assessment.id] !== null && (
                                  <tr>
                                    <td></td>
                                    <td colSpan={4} className="p-3">
                                      {editingCompetenceComment === assessment.id ? (
                                        <Textarea
                                          value={competenceComments[assessment.id] ?? ""}
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
                                              onClick={(e) => { e.stopPropagation(); deleteCompetenceComment(assessment.id); }}
                                            >
                                              <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                        <Button type="button" className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
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
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness<RequiredMark /></th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
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
                                      <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {assessment.id in behaviouralComments && behaviouralComments[assessment.id] !== null && (
                                <tr>
                                  <td></td>
                                  <td colSpan={4} className="p-3">
                                    {editingBehaviouralComment === assessment.id ? (
                                      <Textarea
                                        value={behaviouralComments[assessment.id] ?? ""}
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
                                            onClick={(e) => { e.stopPropagation(); deleteBehaviouralComment(assessment.id); }}
                                          >
                                            <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                        <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
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
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training<RequiredMark /></th>
                              <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                          {form.watch("trainingNeeds").map((trainingNeed, index) => (
                            <React.Fragment key={trainingNeed.id}>
                              <tr className="border-t">
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                  {trainingNeed.addedFromDB === true ? (
                                    <span data-testid={`text-training-need-${trainingNeed.id}`} className="text-[#4f5863] text-[13px] font-normal">
                                      {trainingNeed.training}
                                    </span>
                                  ) : (
                                    <Input
                                      value={trainingNeed.training}
                                      onChange={(e) => updateTrainingNeed(trainingNeed.id, "training", e.target.value)}
                                      placeholder={`Training ${index + 1}`}
                                      className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                    />
                                  )}
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
                                      <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {trainingNeed.id in trainingNeedsComments && trainingNeedsComments[trainingNeed.id] !== null && (
                                <tr>
                                  <td></td>
                                  <td colSpan={2} className="p-3">
                                    {editingTrainingNeedsComment === trainingNeed.id ? (
                                      <Textarea
                                        value={trainingNeedsComments[trainingNeed.id] ?? ""}
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
                                            onClick={(e) => { e.stopPropagation(); deleteTrainingNeedsComment(trainingNeed.id); }}
                                          >
                                            <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                        <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-8" onClick={handleSaveDraft} disabled={isPostStage3}>
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
                                  <th rowSpan={2} className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                                  <th rowSpan={2} className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Recommendations</th>
                                  <th colSpan={3} className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Recommendation Answer<RequiredMark /></th>
                                  <th rowSpan={2} className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Actions</th>
                                </tr>
                                <tr>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">Yes</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">No</th>
                                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-center">NA</th>
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
                                    {recommendation.id in recommendationComments && recommendationComments[recommendation.id] !== null && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={5} className="p-3">
                                          {editingRecommendationComment === recommendation.id ? (
                                            <Textarea
                                              value={recommendationComments[recommendation.id] ?? ""}
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
                                                  onClick={(e) => { e.stopPropagation(); deleteRecommendationComment(recommendation.id); }}
                                                >
                                                  <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                              disabled={appraisalStatus === 'submitted' || appraisalStatus === 'reviewed'}
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
                                        return appraiserValue ? `Primary Appraiser, ${appraiserLabels[appraiserValue] || appraiserValue}` : "Select Primary Appraiser";
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
                                    {index > 0 && appraisalStatus !== 'submitted' && appraisalStatus !== 'reviewed' && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); deleteAppraiserComment(appraiser.id); }}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
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
                            type="button"
                            className="bg-[#5fa5fa] hover:bg-[#4a94e8] text-white px-8" 
                            onClick={handleSaveDraft}
                            disabled={saveAppraisalMutation.isPending || isPostStage3}
                          >
                            {saveAppraisalMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button 
                            type="button"
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
                              disabled={appraisalStatus === 'reviewed'}
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
                                    {appraisalStatus !== 'reviewed' && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteOfficeReview(review.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                      </Button>
                                    )}
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
                                {form.watch("trainingFollowups").map((followup, index) => {
                                  const matchedDbOption = dbTrainingOptions.find(o => o.id === followup.correspondingInDB);
                                  const isFromDb = followup.addedFromDB === true || (!!followup.correspondingInDB && matchedDbOption?.name === followup.training);
                                  return (
                                  <React.Fragment key={followup.id}>
                                    <tr className="border-t">
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        {isFromDb ? (
                                          <span data-testid={`text-followup-training-${followup.id}`} className="text-[#4f5863] text-[13px] font-normal">
                                            {followup.training}
                                          </span>
                                        ) : (
                                          <Input
                                            value={followup.training}
                                            onChange={(e) => updateTrainingFollowup(followup.id, "training", e.target.value)}
                                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6"
                                          />
                                        )}
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        {isFromDb ? (
                                          <span data-testid={`text-followup-db-${followup.id}`} className="text-[#4f5863] text-[13px] font-normal">
                                            {matchedDbOption?.name || followup.training}
                                          </span>
                                        ) : (
                                          <DbTrainingCombobox
                                            value={followup.correspondingInDB || ""}
                                            options={dbTrainingOptions}
                                            onChange={(value) => updateTrainingFollowup(followup.id, "correspondingInDB", value)}
                                            isLoading={isLoadingDbTrainings}
                                            isError={isErrorDbTrainings}
                                            fallbackLabel={followup.training}
                                            testId={`select-followup-db-${followup.id}`}
                                          />
                                        )}
                                      </td>
                                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                                        <select
                                          value={followup.category}
                                          onChange={(e) => updateTrainingFollowup(followup.id, "category", e.target.value)}
                                          className="w-full p-1 border rounded text-[13px] h-6"
                                        >
                                          <option value="" disabled>Select Category</option>
                                          <option value="1. Competence">1. Competence</option>
                                          <option value="2- Soft Skills">2- Soft Skills</option>
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
                                          <option value="" disabled>Select Status</option>
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
                                            <Trash2 className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                    {followup.id in trainingFollowupComments && trainingFollowupComments[followup.id] !== null && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={6} className="p-3">
                                          {editingTrainingFollowupComment === followup.id ? (
                                            <Textarea
                                              value={trainingFollowupComments[followup.id] ?? ""}
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
                                                  onClick={(e) => { e.stopPropagation(); deleteTrainingFollowupComment(followup.id); }}
                                                >
                                                  <Trash2 className="h-4 w-4 text-red-600 hover:text-red-700" />
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                  );
                                })}
                                {form.watch("trainingFollowups").length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500 text-[13px]">
                                      No training followups added yet. Click "Add New Training" to get started.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Action buttons - Always visible like Section B */}
                        <div className="flex justify-end gap-4 mt-6">
                          <Button 
                            type="button"
                            className="bg-[#5fa5fa] hover:bg-[#4a94e8] text-white px-8" 
                            onClick={handleSaveDraft}
                            disabled={saveAppraisalMutation.isPending || isPostStage3}
                          >
                            {saveAppraisalMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button 
                            type="button"
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
        <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => { if (!open) closeConfirmDialog(); }}>
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
        existingCourseIds={(form.getValues("trainingNeeds") || []).map(t => t.correspondingInDB).filter(Boolean) as string[]}
      />

      {/* Training Followup Database Selection Dialog */}
      <TrainingCourseSelectionDialog
        open={isTrainingFollowupDialogOpen}
        onClose={() => setIsTrainingFollowupDialogOpen(false)}
        onConfirm={addTrainingFollowupsFromDatabase}
        existingCourseIds={(form.getValues("trainingFollowups") || []).map(f => f.correspondingInDB).filter(Boolean)}
      />
    </div>
  );
};