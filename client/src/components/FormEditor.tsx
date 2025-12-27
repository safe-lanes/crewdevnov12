import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// Memoized Part components for performance optimization
import { PartA, PartB, PartC, PartD, PartE, PartF, PartG } from "./form-editor-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, Plus, MessageSquare, Edit2, Trash2, Settings, Calendar as CalendarIcon } from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Form, FormVersion, RankGroup } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RankGroupConfiguration {
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

// Training and Target schemas - matching AppraisalForm
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

// Recommendation schema
const recommendationSchema = z.object({
  id: z.string(),
  question: z.string().min(1, "Question is required"),
  answer: z.enum(["Yes", "No", "NA"]),
  comment: z.string().optional(),
  isCustom: z.boolean().optional().default(false),
});

// Training Followup schema
const trainingFollowupSchema = z.object({
  id: z.string(),
  training: z.string(),
  correspondingInDB: z.string(),
  category: z.string(),
  status: z.enum(["Proposed", "Approved", "Planned", "Declined", "Completed"]),
  targetDate: z.string().optional(),
  comment: z.string().optional(),
});

// Appraisal form schema - exact copy from AppraisalForm
const appraisalSchema = z.object({
  // Part A: Seafarer's Information
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

  // Part B: Information at Start of Appraisal Period
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),

  // Part C: Competence Assessment
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),

  // Part D: Behavioural Assessment
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),

  // Part E: Training Needs & Development
  trainingNeeds: z.array(trainingNeedsSchema).default([]),

  // Part F: Summary & Recommendations
  overallScore: z.string().optional(),
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.string().optional(),
  seafarerComments: z.string().optional(),

  // Part G: Office Review & Followup
  officeReviewComments: z.string().optional(),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

type AppraisalFormData = z.infer<typeof appraisalSchema>;

// Extended form type that includes originalFormId from AdminModule expanded forms
interface ExtendedForm extends Form {
  originalFormId?: number;
}

interface FormEditorProps {
  form: ExtendedForm;
  rankGroupName?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const FormEditor: React.FC<FormEditorProps> = ({ form, rankGroupName, onClose, onSave }) => {
  const { toast } = useToast();
  
  // Use originalFormId (real DB ID) when available, otherwise fall back to form.id
  const realFormId = form.originalFormId ?? form.id;
  const [activeSection, setActiveSection] = useState("A");
  const [formVersion] = useState(0); // Starting version 0
  const [trainingComments, setTrainingComments] = useState<{[key: string]: string}>({});
  const [targetComments, setTargetComments] = useState<{[key: string]: string}>({});
  const [competenceComments, setCompetenceComments] = useState<{[key: string]: string}>({});
  const [behaviouralComments, setBehaviouralComments] = useState<{[key: string]: string}>({});
  const [trainingNeedsComments, setTrainingNeedsComments] = useState<{[key: string]: string}>({});
  const [recommendationComments, setRecommendationComments] = useState<{[key: string]: string}>({});
  const [trainingFollowupComments, setTrainingFollowupComments] = useState<{[key: string]: string}>({});
  
  // Configuration state for tracking which fields are configurable
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [configurableFields, setConfigurableFields] = useState<Set<string>>(new Set());
  const [configurableSections, setConfigurableSections] = useState<Set<string>>(new Set());
  
  // Weight validation dialog state
  const [showWeightWarning, setShowWeightWarning] = useState(false);
  
  // Field visibility state
  const [fieldVisibility, setFieldVisibility] = useState({
    personalityIndexCategory: true,
  });
  
  // Section visibility state
  const [sectionVisibility, setSectionVisibility] = useState({
    partB: true,
    partB1: true,
    partB2: true,
    partD: true,
  });

  // Continuous scroll refs for all sections A-G
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const partCRef = useRef<HTMLDivElement>(null);
  const partDRef = useRef<HTMLDivElement>(null);
  const partERef = useRef<HTMLDivElement>(null);
  const partFRef = useRef<HTMLDivElement>(null);
  const partGRef = useRef<HTMLDivElement>(null);
  
  // Continuous scroll container ref
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Continuous scroll state - tracks which section is most visible during scroll
  const [activeContinuousSection, setActiveContinuousSection] = useState<string>("A");

  // Intersection Observer for continuous scroll tracking
  useEffect(() => {
    if (!continuousScrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        // Update the active continuous section if there's a significant intersection (lowered threshold for better detection)
        if (mostVisible && mostVisible.intersectionRatio > 0.3) {
          const sectionId = mostVisible.target.getAttribute('data-section-id');
          if (sectionId) {
            setActiveContinuousSection(sectionId);
            setActiveSection(sectionId); // Also update the main active section for stepper highlighting
          }
        }
      },
      {
        root: continuousScrollContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-100px 0px -100px 0px' // Increased for better detection on tall sections
      }
    );

    // Observe all section refs
    const refs = [partARef, partBRef, partCRef, partDRef, partERef, partFRef, partGRef];
    refs.forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []); // Removed activeContinuousSection dependency to avoid unnecessary observer recreation

  // Function to scroll to a specific section in continuous mode
  const scrollToSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section?.ref?.current && continuousScrollContainerRef.current) {
      section.ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSection(sectionId);
  };

  // Function to navigate to previous/next section
  const navigateToSection = (direction: 'prev' | 'next') => {
    const visibleSections = sections.filter(section => {
      if (isConfigMode) return true;
      if (section.id === "B" && !sectionVisibility.partB) return false;
      if (section.id === "D" && !sectionVisibility.partD) return false;
      return true;
    });
    
    const currentIndex = visibleSections.findIndex(s => s.id === activeSection);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= 0 && nextIndex < visibleSections.length) {
      const nextSectionId = visibleSections[nextIndex].id;
      scrollToSection(nextSectionId);
    }
  };
  
  // Function to toggle field visibility
  const toggleFieldVisibility = (fieldName: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName as keyof typeof prev]
    }));
  };
  
  // Function to toggle section visibility
  const toggleSectionVisibility = (sectionName: string) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName as keyof typeof prev]
    }));
  };

  // Function to get dynamic section letter based on visibility
  const getDynamicSectionLetter = (originalLetter: string) => {
    if (isConfigMode) return originalLetter; // In config mode, keep original letters
    
    const sectionOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const visibleSections = [];
    
    // Always include Part A as it's not configurable yet
    visibleSections.push('A');
    
    // Check which sections are visible
    if (sectionVisibility.partB) visibleSections.push('B');
    visibleSections.push('C'); // C is not configurable yet
    if (sectionVisibility.partD) visibleSections.push('D');
    visibleSections.push('E', 'F', 'G'); // These aren't configurable yet
    
    const originalIndex = sectionOrder.indexOf(originalLetter);
    const visibleIndex = visibleSections.indexOf(originalLetter);
    
    if (visibleIndex === -1) return originalLetter; // Section not found
    
    return String.fromCharCode(65 + visibleIndex); // Convert to letter (A=65)
  };
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  // Initialize version state from form props to ensure consistency with list display
  const [selectedVersionNo, setSelectedVersionNo] = useState<string>(form.versionNo || "");
  const [selectedVersionDate, setSelectedVersionDate] = useState<Date | undefined>(
    form.versionDate ? new Date(form.versionDate) : undefined
  );
  const [activeVersion, setActiveVersion] = useState<string>(form.versionNo || "00"); // Track which version is currently being viewed
  
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
  
  // Helper functions for confirmation dialog
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

  // Query to fetch rank groups for this form (must fetch first to get currentRankGroup for versions query)
  // Note: queryKey[0] is used as the URL by the default fetcher, so include full URL path
  const { data: rankGroupsData } = useQuery<RankGroup[]>({
    queryKey: [`/api/rank-groups/form/${realFormId}`],
    enabled: !!realFormId,
  });
  
  // Find the current rank group and parse its configuration
  const currentRankGroup = React.useMemo(() => {
    if (!rankGroupsData || !rankGroupName) return null;
    return rankGroupsData.find(rg => rg.name === rankGroupName) || null;
  }, [rankGroupsData, rankGroupName]);
  
  const rankGroupConfig = React.useMemo((): RankGroupConfiguration | null => {
    if (!currentRankGroup?.configuration) return null;
    try {
      return JSON.parse(currentRankGroup.configuration) as RankGroupConfiguration;
    } catch {
      return null;
    }
  }, [currentRankGroup]);
  
  // Query to fetch form versions from API - filtered by rank group for isolation
  // Each rank group has its own independent version history
  const versionsQueryKey = currentRankGroup?.id 
    ? `/api/forms/${realFormId}/versions?rankGroupId=${currentRankGroup.id}`
    : `/api/forms/${realFormId}/versions`;
  const { data: versionsData } = useQuery<FormVersion[]>({
    queryKey: [versionsQueryKey],
    enabled: !!realFormId,
  });
  
  // Derive hasSavedDraft from API data - check if a draft version exists
  const hasDraftVersion = React.useMemo(() => {
    return versionsData?.some(v => v.status === 'draft') ?? false;
  }, [versionsData]);
  
  // Compute next version number and available options dynamically
  const { nextVersionNo, availableVersionOptions } = React.useMemo(() => {
    const existingVersions = versionsData || [];
    const maxVersionNo = existingVersions.reduce((max, v) => {
      const vNo = parseInt(v.versionNo, 10);
      return isNaN(vNo) ? max : Math.max(max, vNo);
    }, 0);
    const next = String(maxVersionNo + 1).padStart(2, '0');
    
    // Generate options from 01 to at least maxVersionNo + 2 (for flexibility)
    const optionCount = Math.max(3, maxVersionNo + 2);
    const options = Array.from({ length: optionCount }, (_, i) => 
      String(i + 1).padStart(2, '0')
    );
    
    return { nextVersionNo: next, availableVersionOptions: options };
  }, [versionsData]);
  
  // Create draft version mutation
  const createDraftMutation = useMutation({
    mutationFn: async (versionData: { versionNo: string; versionDate: string; configuration?: string; sharedConfig?: string }) => {
      const response = await apiRequest('POST', `/api/forms/${realFormId}/versions`, {
        ...versionData,
        status: 'draft',
        rankGroupId: currentRankGroup?.id, // Link version to specific rank group
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [versionsQueryKey] });
      setHasSavedDraft(true);
      toast({ title: "Draft saved", description: "Your changes have been saved as a draft." });
    },
    onError: (error: Error) => {
      setHasSavedDraft(false); // Reset on error
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
  // Release version mutation
  const releaseVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const response = await apiRequest('POST', `/api/form-versions/${versionId}/release`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [versionsQueryKey] });
      setHasSavedDraft(false);
      setActiveVersion("00");
      toast({ title: "Version released", description: "The version has been released successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
  
  // Build versions array from API data plus local draft if exists
  const versions = React.useMemo(() => {
    const apiVersions = versionsData || [];
    const result: { versionNo: string; versionDate: string; status: string; id?: number }[] = [];
    
    // Add draft version from API (prioritize API data)
    const draftFromApi = apiVersions.find(v => v.status === 'draft');
    if (draftFromApi) {
      result.push({
        id: draftFromApi.id,
        versionNo: draftFromApi.versionNo,
        versionDate: draftFromApi.versionDate,
        status: 'Draft'
      });
    } else if (hasSavedDraft && !hasDraftVersion) {
      // Only show local draft if no API draft exists and we just saved one
      result.push({
        versionNo: selectedVersionNo || "01",
        versionDate: selectedVersionDate ? format(selectedVersionDate, "dd-MMM-yyyy") : format(new Date(), "dd-MMM-yyyy"),
        status: "Draft"
      });
    }
    
    // Add released versions from API
    const releasedVersions = apiVersions.filter(v => v.status === 'released');
    releasedVersions.forEach(v => {
      result.push({
        id: v.id,
        versionNo: v.versionNo,
        versionDate: v.versionDate,
        status: 'Released'
      });
    });
    
    // If no versions exist, show a default released version placeholder
    if (result.length === 0 || !result.some(v => v.status === 'Released')) {
      result.push({
        versionNo: "00",
        versionDate: form.versionDate || "01-Jan-2025",
        status: "Released"
      });
    }
    
    // Sort by version number descending (latest first)
    result.sort((a, b) => b.versionNo.localeCompare(a.versionNo));
    
    return result;
  }, [versionsData, hasSavedDraft, hasDraftVersion, selectedVersionNo, selectedVersionDate, form.versionDate]);
  
  // Handler to release the current draft version
  const handleReleaseVersion = () => {
    const draftVersion = versions.find(v => v.status === 'Draft' && v.id);
    if (draftVersion && draftVersion.id) {
      releaseVersionMutation.mutate(draftVersion.id);
    } else {
      toast({ title: "No draft to release", description: "Save a draft first before releasing.", variant: "destructive" });
    }
  };

  // Configuration helper functions
  const toggleFieldConfigurable = (fieldId: string) => {
    setConfigurableFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const toggleSectionConfigurable = (sectionId: string) => {
    setConfigurableSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };



  const formMethods = useForm<AppraisalFormData>({
    resolver: zodResolver(appraisalSchema),
    defaultValues: {
      seafarersName: "",
      seafarersRank: "",
      nationality: "",
      vessel: "",
      signOn: "",
      appraisalType: "",
      appraisalPeriodFrom: "",
      appraisalPeriodTo: "",
      personalityIndexCategory: "",
      primaryAppraiser: "",
      trainings: [],
      targets: [],
      competenceAssessments: [],
      behaviouralAssessments: [],
      trainingNeeds: [],
      recommendations: [
        { id: "1", question: "Recommended for continued service on board?", answer: "Yes", comment: "", isCustom: false },
        { id: "2", question: "Recommended for re-employment?", answer: "Yes", comment: "", isCustom: false },
        { id: "3", question: "Recommended for promotion?", answer: "Yes", comment: "", isCustom: false },
        { id: "4", question: "Career Development recommendations (If Any)?", answer: "Yes", comment: "", isCustom: false },
      ],
      // Part G: Office Review & Followup
      officeReviewComments: "",
      trainingFollowups: [],
    },
  });

  // useWatch hooks for stable array data - prevents re-renders from watch() in child components
  const trainings = useWatch({ control: formMethods.control, name: "trainings" });
  const targets = useWatch({ control: formMethods.control, name: "targets" });
  const competenceAssessments = useWatch({ control: formMethods.control, name: "competenceAssessments" });
  const behaviouralAssessments = useWatch({ control: formMethods.control, name: "behaviouralAssessments" });
  const trainingNeeds = useWatch({ control: formMethods.control, name: "trainingNeeds" });
  const recommendations = useWatch({ control: formMethods.control, name: "recommendations" });
  const trainingFollowups = useWatch({ control: formMethods.control, name: "trainingFollowups" });

  // Load rank group configuration when available
  useEffect(() => {
    if (rankGroupConfig) {
      console.log('[FormEditor] Loading rank group configuration:', rankGroupConfig);
      
      // Load competence assessments from rank group config
      if (rankGroupConfig.competenceAssessments && rankGroupConfig.competenceAssessments.length > 0) {
        formMethods.setValue('competenceAssessments', rankGroupConfig.competenceAssessments.map(ca => ({
          ...ca,
          effectiveness: ca.effectiveness || '',
          comment: ca.comment || '',
        })));
      }
      
      // Load behavioural assessments from rank group config
      if (rankGroupConfig.behaviouralAssessments && rankGroupConfig.behaviouralAssessments.length > 0) {
        formMethods.setValue('behaviouralAssessments', rankGroupConfig.behaviouralAssessments.map(ba => ({
          ...ba,
          effectiveness: ba.effectiveness || '',
          comment: ba.comment || '',
        })));
      }
      
      // Load recommendations from rank group config
      if (rankGroupConfig.recommendations && rankGroupConfig.recommendations.length > 0) {
        formMethods.setValue('recommendations', rankGroupConfig.recommendations.map(rec => ({
          id: rec.id,
          question: rec.recommendation,
          answer: (rec.yes ? 'Yes' : rec.no ? 'No' : rec.na ? 'NA' : 'Yes') as 'Yes' | 'No' | 'NA',
          comment: rec.comment || '',
          isCustom: true,
        })));
      }
      
      // Load hidden fields/sections
      if (rankGroupConfig.hiddenFields) {
        const newFieldVisibility = { ...fieldVisibility };
        rankGroupConfig.hiddenFields.forEach(field => {
          if (field in newFieldVisibility) {
            (newFieldVisibility as Record<string, boolean>)[field] = false;
          }
        });
        setFieldVisibility(newFieldVisibility);
      }
      
      if (rankGroupConfig.hiddenSections) {
        const newSectionVisibility = { ...sectionVisibility };
        rankGroupConfig.hiddenSections.forEach(section => {
          if (section in newSectionVisibility) {
            (newSectionVisibility as Record<string, boolean>)[section] = false;
          }
        });
        setSectionVisibility(newSectionVisibility);
      }
    }
  }, [rankGroupConfig]);

  const onSubmit = (data: AppraisalFormData) => {
    // Check if we're in config mode and need to validate weights
    if (isConfigMode) {
      if (data.competenceAssessments.length > 0) {
        const totalWeight = calculateTotalWeight();
        console.log("Weight validation - Competence total weight:", totalWeight, "Config mode:", isConfigMode);
        if (totalWeight !== 100) {
          setShowWeightWarning(true);
          return; // Stop submission until weights are validated
        }
      }
      
      if (data.behaviouralAssessments.length > 0) {
        const totalWeight = calculateBehaviouralTotalWeight();
        console.log("Weight validation - Behavioural total weight:", totalWeight, "Config mode:", isConfigMode);
        if (totalWeight !== 100) {
          setShowWeightWarning(true);
          return; // Stop submission until weights are validated
        }
      }
    }
    
    // Build shared config object for fields shared across all rank groups
    // Pass as object - let API/storage handle serialization
    const sharedConfig = {
      appraisalTypeOptions: appraisalTypeOptions,
    };
    
    // Build hidden fields/sections arrays from visibility state
    const hiddenFields = Object.entries(fieldVisibility)
      .filter(([, visible]) => !visible)
      .map(([field]) => field);
    
    const hiddenSections = Object.entries(sectionVisibility)
      .filter(([, visible]) => !visible)
      .map(([section]) => section);
    
    onSave({
      ...data,
      formId: realFormId,
      version: formVersion,
      sharedConfig: sharedConfig,
      hiddenFields,
      hiddenSections,
    });
    onClose();
  };

  // Training management functions
  const addTraining = () => {
    const newTraining = {
      id: Date.now().toString(),
      training: "",
      evaluation: "",
      comment: "",
    };
    const currentTrainings = formMethods.getValues("trainings");
    formMethods.setValue("trainings", [...currentTrainings, newTraining]);
  };

  const deleteTraining = (id: string) => {
    showConfirmDialog(
      "Delete Training",
      "Are you sure you want to delete this training?",
      () => {
        const currentTrainings = formMethods.getValues("trainings");
        formMethods.setValue("trainings", currentTrainings.filter(t => t.id !== id));
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
    const currentTrainings = formMethods.getValues("trainings");
    const updatedTrainings = currentTrainings.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    formMethods.setValue("trainings", updatedTrainings);
  };

  // Target management functions
  const addTarget = () => {
    const newTarget = {
      id: Date.now().toString(),
      targetSetting: "",
      evaluation: "",
      comment: "",
    };
    const currentTargets = formMethods.getValues("targets");
    formMethods.setValue("targets", [...currentTargets, newTarget]);
  };

  const deleteTarget = (id: string) => {
    showConfirmDialog(
      "Delete Target",
      "Are you sure you want to delete this target?",
      () => {
        const currentTargets = formMethods.getValues("targets");
        formMethods.setValue("targets", currentTargets.filter(t => t.id !== id));
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
    const currentTargets = formMethods.getValues("targets");
    const updatedTargets = currentTargets.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    formMethods.setValue("targets", updatedTargets);
  };

  // Competence Assessment management functions
  const updateCompetenceAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = formMethods.getValues("competenceAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    formMethods.setValue("competenceAssessments", updatedAssessments);
  };

  // Behavioural Assessment management functions
  const updateBehaviouralAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = formMethods.getValues("behaviouralAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    formMethods.setValue("behaviouralAssessments", updatedAssessments);
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

  // Calculate section score using memoized watched data
  const competenceSectionScore = useMemo(() => {
    let totalScore = 0;
    let totalWeight = 0;
    
    competenceAssessments.forEach(assessment => {
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
  }, [competenceAssessments]);

  // Calculate behavioural section score using memoized watched data
  const behaviouralSectionScore = useMemo(() => {
    let totalScore = 0;
    let totalWeight = 0;
    
    behaviouralAssessments.forEach(assessment => {
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
  }, [behaviouralAssessments]);

  // Keep legacy functions for backward compatibility with existing code
  const calculateSectionScore = useCallback(() => competenceSectionScore, [competenceSectionScore]);
  const calculateBehaviouralSectionScore = useCallback(() => behaviouralSectionScore, [behaviouralSectionScore]);

  // Training Needs management functions
  const addTrainingNeed = (type: 'database' | 'new') => {
    const newTrainingNeed = {
      id: Date.now().toString(),
      training: "",
      comment: "",
    };
    const currentTrainingNeeds = formMethods.getValues("trainingNeeds");
    formMethods.setValue("trainingNeeds", [...currentTrainingNeeds, newTrainingNeed]);
  };

  const deleteTrainingNeed = (id: string) => {
    showConfirmDialog(
      "Delete Training Need",
      "Are you sure you want to delete this training need?",
      () => {
        const currentTrainingNeeds = formMethods.getValues("trainingNeeds");
        formMethods.setValue("trainingNeeds", currentTrainingNeeds.filter(t => t.id !== id));
        setTrainingNeedsComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        closeConfirmDialog();
      }
    );
  };

  // Training Followup management functions
  const addTrainingFollowup = (type: 'database' | 'new') => {
    const currentFollowups = formMethods.getValues("trainingFollowups");
    const newFollowup = {
      id: Date.now().toString(),
      training: "",
      correspondingInDB: "Select Training from DB",
      category: "Select Rating",
      status: "Proposed" as const,
      targetDate: "",
      comment: "",
    };
    formMethods.setValue("trainingFollowups", [...currentFollowups, newFollowup]);
  };

  const updateTrainingFollowup = (id: string, field: string, value: string) => {
    const currentFollowups = formMethods.getValues("trainingFollowups");
    const updatedFollowups = currentFollowups.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    );
    formMethods.setValue("trainingFollowups", updatedFollowups);
  };

  const deleteTrainingFollowup = (id: string) => {
    showConfirmDialog(
      "Delete Training Followup",
      "Are you sure you want to delete this training followup?",
      () => {
        const currentFollowups = formMethods.getValues("trainingFollowups");
        formMethods.setValue("trainingFollowups", currentFollowups.filter(f => f.id !== id));
        setTrainingFollowupComments(prev => {
          const newComments = { ...prev };
          delete newComments[id];
          return newComments;
        });
        closeConfirmDialog();
      }
    );
  };

  // State for configuration mode dialog
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  
  // State for tracking which recommendation fields are in edit mode
  const [editingRecommendations, setEditingRecommendations] = useState<Set<string>>(new Set());

  // Shared configuration color (orange - applies to all rank groups)
  const SHARED_CONFIG_COLOR = '#f97316'; // tailwind orange-500
  
  // Appraisal Type configuration state (SHARED across all rank groups)
  const [appraisalTypeOptions, setAppraisalTypeOptions] = useState<string[]>([
    "End of Contract",
    "Mid Term", 
    "Special",
    "Probation",
    "Appraiser SCOT"
  ]);
  const [showAppraisalTypeDialog, setShowAppraisalTypeDialog] = useState(false);
  const [editingAppraisalType, setEditingAppraisalType] = useState<string>("");
  const [editingAppraisalTypeIndex, setEditingAppraisalTypeIndex] = useState<number>(-1);
  
  // Load shared config from form on mount
  useEffect(() => {
    if (form.sharedConfig) {
      try {
        // Handle both object and string formats (API may return either)
        const sharedConfig = typeof form.sharedConfig === 'string' 
          ? JSON.parse(form.sharedConfig) 
          : form.sharedConfig;
        if (sharedConfig.appraisalTypeOptions && Array.isArray(sharedConfig.appraisalTypeOptions)) {
          setAppraisalTypeOptions(sharedConfig.appraisalTypeOptions);
        }
      } catch (e) {
        console.error("Failed to parse form sharedConfig:", e);
      }
    }
  }, [form.sharedConfig]);

  // PI Category configuration state
  const [piCategoryOptions, setPiCategoryOptions] = useState<string[]>([
    "Analytical",
    "Driver",
    "Expressive",
    "Amiable"
  ]);
  const [showPiCategoryDialog, setShowPiCategoryDialog] = useState(false);
  const [editingPiCategory, setEditingPiCategory] = useState<string>("");
  const [editingPiCategoryIndex, setEditingPiCategoryIndex] = useState<number>(-1);

  // Effectiveness Rating configuration state (common to Parts B, C, D)
  const [effectivenessOptions, setEffectivenessOptions] = useState<string[]>([
    "5- Exceeded Expectations",
    "4- Meets Expectations", 
    "3- Somewhat Meets Expectations",
    "2- Below Expectations",
    "1- Significantly Below Expectations"
  ]);
  const [showEffectivenessDialog, setShowEffectivenessDialog] = useState(false);
  const [editingEffectiveness, setEditingEffectiveness] = useState<string>("");
  const [editingEffectivenessIndex, setEditingEffectivenessIndex] = useState<number>(-1);

  // G2 Training Category configuration state
  const [trainingCategoryOptions, setTrainingCategoryOptions] = useState<string[]>([
    "1. Competence",
    "2. Soft Skills",
    "3. Safety",
    "4. Technical",
    "5. Leadership"
  ]);
  const [showTrainingCategoryDialog, setShowTrainingCategoryDialog] = useState(false);
  const [editingTrainingCategory, setEditingTrainingCategory] = useState<string>("");
  const [editingTrainingCategoryIndex, setEditingTrainingCategoryIndex] = useState<number>(-1);

  // G2 Training Status configuration state
  const [trainingStatusOptions, setTrainingStatusOptions] = useState<string[]>([
    "Proposed",
    "Approved",
    "Planned",
    "Declined",
    "Completed"
  ]);
  const [showTrainingStatusDialog, setShowTrainingStatusDialog] = useState(false);
  const [editingTrainingStatus, setEditingTrainingStatus] = useState<string>("");
  const [editingTrainingStatusIndex, setEditingTrainingStatusIndex] = useState<number>(-1);

  // Appraisal Type management functions
  const addAppraisalTypeOption = () => {
    setEditingAppraisalType("");
    setEditingAppraisalTypeIndex(-1);
    setShowAppraisalTypeDialog(true);
  };

  const editAppraisalTypeOption = (index: number) => {
    setEditingAppraisalType(appraisalTypeOptions[index]);
    setEditingAppraisalTypeIndex(index);
    setShowAppraisalTypeDialog(true);
  };

  const deleteAppraisalTypeOption = (index: number) => {
    showConfirmDialog(
      "Delete Appraisal Type",
      "Are you sure you want to delete this appraisal type option?",
      () => {
        const newOptions = appraisalTypeOptions.filter((_, i) => i !== index);
        setAppraisalTypeOptions(newOptions);
        closeConfirmDialog();
      }
    );
  };

  const saveAppraisalTypeOption = () => {
    if (editingAppraisalType.trim() === "") return;
    
    if (editingAppraisalTypeIndex === -1) {
      // Adding new option
      setAppraisalTypeOptions([...appraisalTypeOptions, editingAppraisalType.trim()]);
    } else {
      // Editing existing option
      const newOptions = [...appraisalTypeOptions];
      newOptions[editingAppraisalTypeIndex] = editingAppraisalType.trim();
      setAppraisalTypeOptions(newOptions);
    }
    
    // Clear the input field for next entry
    setEditingAppraisalType("");
    setEditingAppraisalTypeIndex(-1);
  };

  // PI Category management functions
  const addPiCategoryOption = () => {
    setEditingPiCategory("");
    setEditingPiCategoryIndex(-1);
    setShowPiCategoryDialog(true);
  };

  const editPiCategoryOption = (index: number) => {
    setEditingPiCategory(piCategoryOptions[index]);
    setEditingPiCategoryIndex(index);
    setShowPiCategoryDialog(true);
  };

  const deletePiCategoryOption = (index: number) => {
    showConfirmDialog(
      "Delete PI Category",
      "Are you sure you want to delete this PI category option?",
      () => {
        const newOptions = piCategoryOptions.filter((_, i) => i !== index);
        setPiCategoryOptions(newOptions);
        closeConfirmDialog();
      }
    );
  };

  const savePiCategoryOption = () => {
    if (editingPiCategory.trim() === "") return;
    
    if (editingPiCategoryIndex === -1) {
      // Adding new option
      setPiCategoryOptions([...piCategoryOptions, editingPiCategory.trim()]);
    } else {
      // Editing existing option
      const newOptions = [...piCategoryOptions];
      newOptions[editingPiCategoryIndex] = editingPiCategory.trim();
      setPiCategoryOptions(newOptions);
    }
    
    // Clear the input field for next entry
    setEditingPiCategory("");
    setEditingPiCategoryIndex(-1);
  };

  // Effectiveness Rating management functions
  const addEffectivenessOption = () => {
    setEditingEffectiveness("");
    setEditingEffectivenessIndex(-1);
    setShowEffectivenessDialog(true);
  };

  const editEffectivenessOption = (index: number) => {
    setEditingEffectiveness(effectivenessOptions[index]);
    setEditingEffectivenessIndex(index);
    setShowEffectivenessDialog(true);
  };

  const deleteEffectivenessOption = (index: number) => {
    showConfirmDialog(
      "Delete Effectiveness Option",
      "Are you sure you want to delete this effectiveness option?",
      () => {
        const newOptions = effectivenessOptions.filter((_, i) => i !== index);
        setEffectivenessOptions(newOptions);
        closeConfirmDialog();
      }
    );
  };

  const saveEffectivenessOption = () => {
    if (editingEffectiveness.trim() === "") return;
    
    if (editingEffectivenessIndex === -1) {
      // Adding new option
      setEffectivenessOptions([...effectivenessOptions, editingEffectiveness.trim()]);
    } else {
      // Editing existing option
      const newOptions = [...effectivenessOptions];
      newOptions[editingEffectivenessIndex] = editingEffectiveness.trim();
      setEffectivenessOptions(newOptions);
    }
    
    // Clear the input field for next entry
    setEditingEffectiveness("");
    setEditingEffectivenessIndex(-1);
  };

  // Training Category management functions
  const addTrainingCategoryOption = () => {
    setEditingTrainingCategory("");
    setEditingTrainingCategoryIndex(-1);
    setShowTrainingCategoryDialog(true);
  };

  const editTrainingCategoryOption = (index: number) => {
    setEditingTrainingCategory(trainingCategoryOptions[index]);
    setEditingTrainingCategoryIndex(index);
    setShowTrainingCategoryDialog(true);
  };

  const deleteTrainingCategoryOption = (index: number) => {
    showConfirmDialog(
      "Delete Training Category",
      "Are you sure you want to delete this training category option?",
      () => {
        const newOptions = trainingCategoryOptions.filter((_, i) => i !== index);
        setTrainingCategoryOptions(newOptions);
        closeConfirmDialog();
      }
    );
  };

  const saveTrainingCategoryOption = () => {
    if (editingTrainingCategory.trim() === "") return;
    
    if (editingTrainingCategoryIndex === -1) {
      // Adding new option
      setTrainingCategoryOptions([...trainingCategoryOptions, editingTrainingCategory.trim()]);
    } else {
      // Editing existing option
      const newOptions = [...trainingCategoryOptions];
      newOptions[editingTrainingCategoryIndex] = editingTrainingCategory.trim();
      setTrainingCategoryOptions(newOptions);
    }
    
    // Clear the input field for next entry
    setEditingTrainingCategory("");
    setEditingTrainingCategoryIndex(-1);
  };

  // Training Status management functions
  const addTrainingStatusOption = () => {
    setEditingTrainingStatus("");
    setEditingTrainingStatusIndex(-1);
    setShowTrainingStatusDialog(true);
  };

  const editTrainingStatusOption = (index: number) => {
    setEditingTrainingStatus(trainingStatusOptions[index]);
    setEditingTrainingStatusIndex(index);
    setShowTrainingStatusDialog(true);
  };

  const deleteTrainingStatusOption = (index: number) => {
    showConfirmDialog(
      "Delete Training Status",
      "Are you sure you want to delete this training status option?",
      () => {
        const newOptions = trainingStatusOptions.filter((_, i) => i !== index);
        setTrainingStatusOptions(newOptions);
        closeConfirmDialog();
      }
    );
  };

  const saveTrainingStatusOption = () => {
    if (editingTrainingStatus.trim() === "") return;
    
    if (editingTrainingStatusIndex === -1) {
      // Adding new option
      setTrainingStatusOptions([...trainingStatusOptions, editingTrainingStatus.trim()]);
    } else {
      // Editing existing option
      const newOptions = [...trainingStatusOptions];
      newOptions[editingTrainingStatusIndex] = editingTrainingStatus.trim();
      setTrainingStatusOptions(newOptions);
    }
    
    // Clear the input field for next entry
    setEditingTrainingStatus("");
    setEditingTrainingStatusIndex(-1);
  };

  // Recommendation management functions
  const addRecommendation = () => {
    if (!isConfigMode) {
      setShowConfigDialog(true);
      return;
    }
    
    const currentRecommendations = formMethods.getValues("recommendations");
    const newRecommendationId = Date.now().toString();
    const newRecommendation = {
      id: newRecommendationId,
      question: "Add new recommendation",
      answer: "Yes" as const,
      comment: "",
      isCustom: true // Mark as custom/additional recommendation
    };
    formMethods.setValue("recommendations", [...currentRecommendations, newRecommendation]);
    
    // Automatically set new recommendation to edit mode
    startEditingRecommendation(newRecommendationId);
  };

  const handleEnterConfigMode = () => {
    setIsConfigMode(true);
    setShowConfigDialog(false);
  };

  // Functions to handle recommendation editing
  const startEditingRecommendation = (id: string) => {
    setEditingRecommendations(prev => new Set(prev).add(id));
  };

  const stopEditingRecommendation = (id: string) => {
    setEditingRecommendations(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleRecommendationBlur = (id: string) => {
    stopEditingRecommendation(id);
  };

  // Validation functions for assessment criteria
  const validateAssessmentCriteria = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check Part C competence assessments
    const competenceAssessments = formMethods.getValues("competenceAssessments");
    const blankCompetenceFields = competenceAssessments.filter(
      assessment => !assessment.assessmentCriteria?.trim()
    );
    
    if (blankCompetenceFields.length > 0) {
      errors.push(`Part C has ${blankCompetenceFields.length} blank assessment criteria field(s)`);
    }
    
    // Check Part D behavioural assessments
    const behaviouralAssessments = formMethods.getValues("behaviouralAssessments");
    const blankBehaviouralFields = behaviouralAssessments.filter(
      assessment => !assessment.assessmentCriteria?.trim()
    );
    
    if (blankBehaviouralFields.length > 0) {
      errors.push(`Part D has ${blankBehaviouralFields.length} blank assessment criteria field(s)`);
    }
    
    // Check custom recommendations
    const recommendations = formMethods.getValues("recommendations");
    const blankRecommendations = recommendations.filter(
      rec => rec.isCustom && (!rec.question?.trim() || rec.question === "Add new recommendation")
    );
    
    if (blankRecommendations.length > 0) {
      errors.push(`Part F has ${blankRecommendations.length} blank recommendation field(s)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // State for validation error dialog
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const updateRecommendation = (id: string, field: string, value: string) => {
    const currentRecommendations = formMethods.getValues("recommendations");
    const updatedRecommendations = currentRecommendations.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    formMethods.setValue("recommendations", updatedRecommendations);
  };

  const deleteRecommendation = (id: string) => {
    const currentRecommendations = formMethods.getValues("recommendations");
    const recommendationToDelete = currentRecommendations.find(r => r.id === id);
    
    // Only allow deletion of custom recommendations
    if (recommendationToDelete && recommendationToDelete.isCustom) {
      showConfirmDialog(
        "Delete Custom Recommendation",
        "Are you sure you want to delete this custom recommendation?",
        () => {
          const filteredRecommendations = currentRecommendations.filter(r => r.id !== id);
          formMethods.setValue("recommendations", filteredRecommendations);
          setRecommendationComments(prev => {
            const newComments = { ...prev };
            delete newComments[id];
            return newComments;
          });
          closeConfirmDialog();
        }
      );
    }
  };

  const updateTrainingNeed = (id: string, field: string, value: string) => {
    const currentTrainingNeeds = formMethods.getValues("trainingNeeds");
    const updatedTrainingNeeds = currentTrainingNeeds.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    formMethods.setValue("trainingNeeds", updatedTrainingNeeds);
  };

  // Competence Assessment functions
  const addCompetenceCriterion = () => {
    const currentAssessments = formMethods.getValues("competenceAssessments");
    const newAssessment = {
      id: Date.now().toString(),
      assessmentCriteria: "",
      weight: 0,
      effectiveness: "",
      comment: ""
    };
    formMethods.setValue("competenceAssessments", [...currentAssessments, newAssessment]);
  };

  const updateCompetenceCriterion = (id: string, field: string, value: string | number) => {
    const currentAssessments = formMethods.getValues("competenceAssessments");
    const updatedAssessments = currentAssessments.map(assessment => 
      assessment.id === id ? { ...assessment, [field]: value } : assessment
    );
    formMethods.setValue("competenceAssessments", updatedAssessments);
  };

  const deleteCompetenceCriterion = (id: string) => {
    showConfirmDialog(
      "Delete Competence Criterion",
      "Are you sure you want to delete this competence criterion?",
      () => {
        const currentAssessments = formMethods.getValues("competenceAssessments");
        const updatedAssessments = currentAssessments.filter(assessment => assessment.id !== id);
        formMethods.setValue("competenceAssessments", updatedAssessments);
        closeConfirmDialog();
      }
    );
  };

  // Function to calculate total weight
  const calculateTotalWeight = () => {
    const assessments = formMethods.getValues("competenceAssessments");
    return assessments.reduce((total, assessment) => total + (assessment.weight || 0), 0);
  };

  // Function to distribute weights equally
  const distributeWeightsEqually = () => {
    const assessments = formMethods.getValues("competenceAssessments");
    if (assessments.length === 0) return;
    
    const equalWeight = Math.floor(100 / assessments.length);
    const remainder = 100 % assessments.length;
    
    const updatedAssessments = assessments.map((assessment, index) => ({
      ...assessment,
      weight: index < remainder ? equalWeight + 1 : equalWeight
    }));
    
    formMethods.setValue("competenceAssessments", updatedAssessments);
  };

  // Behavioural Assessment functions
  const addBehaviouralAssessment = () => {
    const newAssessment = {
      id: Date.now().toString(),
      assessmentCriteria: "",
      weight: 0,
      effectiveness: "",
      comment: "",
    };
    const currentAssessments = formMethods.getValues("behaviouralAssessments");
    formMethods.setValue("behaviouralAssessments", [...currentAssessments, newAssessment]);
  };

  const deleteBehaviouralAssessment = (id: string) => {
    showConfirmDialog(
      "Delete Behavioural Assessment",
      "Are you sure you want to delete this behavioural assessment?",
      () => {
        const currentAssessments = formMethods.getValues("behaviouralAssessments");
        const updatedAssessments = currentAssessments.filter(assessment => assessment.id !== id);
        formMethods.setValue("behaviouralAssessments", updatedAssessments);
        closeConfirmDialog();
      }
    );
  };

  const calculateBehaviouralTotalWeight = () => {
    const assessments = formMethods.getValues("behaviouralAssessments");
    return assessments.reduce((total, assessment) => total + (assessment.weight || 0), 0);
  };

  const distributeBehaviouralWeightsEqually = () => {
    const assessments = formMethods.getValues("behaviouralAssessments");
    if (assessments.length === 0) return;
    
    const equalWeight = Math.floor(100 / assessments.length);
    const remainder = 100 % assessments.length;
    
    const updatedAssessments = assessments.map((assessment, index) => ({
      ...assessment,
      weight: index < remainder ? equalWeight + 1 : equalWeight
    }));
    
    formMethods.setValue("behaviouralAssessments", updatedAssessments);
  };

  // Calculate overall score (F1) using memoized values
  const overallScore = useMemo(() => {
    const competenceScore = parseFloat(competenceSectionScore);
    const behaviouralScore = parseFloat(behaviouralSectionScore);
    return ((competenceScore + behaviouralScore) / 2).toFixed(1);
  }, [competenceSectionScore, behaviouralSectionScore]);

  // Keep legacy function for backward compatibility
  const calculateOverallScore = useCallback(() => overallScore, [overallScore]);

  const sections = [
    { id: "A", title: "Seafarer's Information", active: true, ref: partARef },
    { id: "B", title: "Information at Start of Appraisal Period", active: false, ref: partBRef },
    { id: "C", title: "Competence Assessment (Professional Knowledge & Skills)", active: false, ref: partCRef },
    { id: "D", title: "Behavioural Assessment (Soft Skills)", active: false, ref: partDRef },
    { id: "E", title: "Training Needs & Development", active: false, ref: partERef },
    { id: "F", title: "Summary & Recommendations", active: false, ref: partFRef },
    { id: "G", title: "Office Review & Followup", active: false, ref: partGRef },
  ].filter(section => {
    // In config mode, show all sections
    if (isConfigMode) return true;
    // Outside config mode, filter out hidden sections
    if (section.id === "B" && !sectionVisibility.partB) return false;
    if (section.id === "D" && !sectionVisibility.partD) return false;
    return true;
  }).map((section, index) => ({
    ...section,
    // Update the display ID to use dynamic lettering
    displayId: isConfigMode ? section.id : String.fromCharCode(65 + index),
    displayTitle: isConfigMode ? section.title : section.title
  }));



  // Memoized Part A component - uses React.memo for performance optimization
  const renderPartA = () => (
    <PartA
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      fieldVisibility={fieldVisibility}
      toggleFieldVisibility={toggleFieldVisibility}
      appraisalTypeOptions={appraisalTypeOptions}
      piCategoryOptions={piCategoryOptions}
    />
  );

  // Memoized Part B component - uses React.memo for performance optimization
  const renderPartB = () => (
    <PartB
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      sectionVisibility={sectionVisibility}
      toggleSectionVisibility={toggleSectionVisibility}
      effectivenessOptions={effectivenessOptions}
      getDynamicSectionLetter={getDynamicSectionLetter}
      trainings={trainings}
      targets={targets}
      trainingComments={trainingComments}
      setTrainingComments={setTrainingComments}
      targetComments={targetComments}
      setTargetComments={setTargetComments}
      addTraining={addTraining}
      updateTraining={updateTraining}
      deleteTraining={deleteTraining}
      addTarget={addTarget}
      updateTarget={updateTarget}
      deleteTarget={deleteTarget}
      setShowEffectivenessDialog={setShowEffectivenessDialog}
    />
  );


  // Memoized Part C component - uses React.memo for performance optimization
  const renderPartC = () => (
    <PartC
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      getDynamicSectionLetter={getDynamicSectionLetter}
      effectivenessOptions={effectivenessOptions}
      competenceAssessments={competenceAssessments}
      competenceComments={competenceComments}
      setCompetenceComments={setCompetenceComments}
      addCompetenceCriterion={addCompetenceCriterion}
      updateCompetenceCriterion={updateCompetenceCriterion}
      deleteCompetenceCriterion={deleteCompetenceCriterion}
      sectionScore={competenceSectionScore}
      getScoreColors={getScoreColors}
      setShowEffectivenessDialog={setShowEffectivenessDialog}
    />
  );

  // Memoized Part D component - uses React.memo for performance optimization
  const renderPartD = () => (
    <PartD
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      sectionVisibility={sectionVisibility}
      toggleSectionVisibility={toggleSectionVisibility}
      getDynamicSectionLetter={getDynamicSectionLetter}
      effectivenessOptions={effectivenessOptions}
      behaviouralAssessments={behaviouralAssessments}
      behaviouralComments={behaviouralComments}
      setBehaviouralComments={setBehaviouralComments}
      addBehaviouralAssessment={addBehaviouralAssessment}
      updateBehaviouralAssessment={updateBehaviouralAssessment}
      deleteBehaviouralAssessment={deleteBehaviouralAssessment}
      sectionScore={behaviouralSectionScore}
      getScoreColors={getScoreColors}
      setShowEffectivenessDialog={setShowEffectivenessDialog}
    />
  );

  // Memoized Part E component - uses React.memo for performance optimization
  const renderPartE = () => (
    <PartE
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      getDynamicSectionLetter={getDynamicSectionLetter}
      trainingNeeds={trainingNeeds}
      trainingNeedsComments={trainingNeedsComments}
      setTrainingNeedsComments={setTrainingNeedsComments}
      addTrainingNeed={addTrainingNeed}
      updateTrainingNeed={updateTrainingNeed}
      deleteTrainingNeed={deleteTrainingNeed}
    />
  );

  // Memoized Part F component - uses React.memo for performance optimization
  const renderPartF = () => (
    <PartF
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      getDynamicSectionLetter={getDynamicSectionLetter}
      recommendations={recommendations}
      recommendationComments={recommendationComments}
      setRecommendationComments={setRecommendationComments}
      editingRecommendations={editingRecommendations}
      addRecommendation={addRecommendation}
      updateRecommendation={updateRecommendation}
      deleteRecommendation={deleteRecommendation}
      startEditingRecommendation={startEditingRecommendation}
      handleRecommendationBlur={handleRecommendationBlur}
      overallScore={overallScore}
      getScoreColors={getScoreColors}
    />
  );

  // Memoized Part G component - uses React.memo for performance optimization
  const renderPartG = () => (
    <PartG
      formMethods={formMethods as any}
      isConfigMode={isConfigMode}
      getDynamicSectionLetter={getDynamicSectionLetter}
      trainingFollowups={trainingFollowups}
      trainingFollowupComments={trainingFollowupComments}
      setTrainingFollowupComments={setTrainingFollowupComments}
      trainingCategoryOptions={trainingCategoryOptions}
      trainingStatusOptions={trainingStatusOptions}
      addTrainingFollowup={addTrainingFollowup}
      updateTrainingFollowup={updateTrainingFollowup}
      deleteTrainingFollowup={deleteTrainingFollowup}
    />
  );


  // Continuous scroll render function that combines all sections A-G
  const renderContinuousScroll = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Part A: Seafarer's Information */}
        <div ref={partARef} data-section-id="A">
          <Card className="bg-white">
            <CardContent className="p-6">
              {renderPartA()}
            </CardContent>
          </Card>
        </div>

        {/* Part B: Information at Start of Appraisal Period */}
        {(sectionVisibility.partB || isConfigMode) && (
          <div ref={partBRef} data-section-id="B">
            <Card className="bg-white">
              <CardContent className="p-6">
                {renderPartB()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Part C: Competence Assessment */}
        <div ref={partCRef} data-section-id="C">
          <Card className="bg-white">
            <CardContent className="p-6">
              {renderPartC()}
            </CardContent>
          </Card>
        </div>

        {/* Part D: Behavioural Assessment */}
        {(sectionVisibility.partD || isConfigMode) && (
          <div ref={partDRef} data-section-id="D">
            <Card className="bg-white">
              <CardContent className="p-6">
                {renderPartD()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Part E: Training Needs & Development */}
        <div ref={partERef} data-section-id="E">
          <Card className="bg-white">
            <CardContent className="p-6">
              {renderPartE()}
            </CardContent>
          </Card>
        </div>

        {/* Part F: Summary & Recommendations */}
        <div ref={partFRef} data-section-id="F">
          <Card className="bg-white">
            <CardContent className="p-6">
              {renderPartF()}
            </CardContent>
          </Card>
        </div>

        {/* Part G: Office Review & Followup */}
        <div ref={partGRef} data-section-id="G">
          <Card className="bg-white">
            <CardContent className="p-6">
              {renderPartG()}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "A": return renderPartA();
      case "B": return (sectionVisibility.partB || isConfigMode) ? renderPartB() : renderPartA();
      case "C": return renderPartC();
      case "D": return (sectionVisibility.partD || isConfigMode) ? renderPartD() : renderPartA();
      case "E": return renderPartE();
      case "F": return renderPartF();
      case "G": return renderPartG();
      default: return renderPartA();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[95vw] h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold truncate">
              Crew Appraisal Form - {rankGroupName || "Rank Group"}
            </h2>
            {isConfigMode && (
              <Badge variant="outline" className="ml-1 sm:ml-2 text-xs hidden sm:inline-flex">
                Configuration Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!isConfigMode ? (
              <Button
                variant={(hasSavedDraft || hasDraftVersion) ? "default" : "outline"}
                size="sm"
                className={`flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                  (hasSavedDraft || hasDraftVersion)
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!(hasSavedDraft || hasDraftVersion) || releaseVersionMutation.isPending}
                onClick={handleReleaseVersion}
                data-testid="button-release-version"
              >
                <span className="hidden sm:inline">{releaseVersionMutation.isPending ? 'Releasing...' : 'Release Ver'}</span>
                <span className="sm:hidden">{releaseVersionMutation.isPending ? '...' : 'Release'}</span>
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                onClick={() => {
                  setIsConfigMode(false);
                  setHasSavedDraft(false);
                  setSelectedVersionNo("");
                  setSelectedVersionDate(undefined);
                  setActiveVersion("00"); // Return to released version
                }}
              >
                <span className="hidden sm:inline">Discard Ver</span>
                <span className="sm:hidden">Discard</span>
              </Button>
            )}
            <Button
              variant={isConfigMode ? "default" : "outline"}
              onClick={() => {
                if (isConfigMode) {
                  // Validate assessment criteria fields before exiting config mode
                  const validationResult = validateAssessmentCriteria();
                  if (!validationResult.isValid) {
                    setValidationErrors(validationResult.errors);
                    setShowValidationDialog(true);
                    return;
                  }
                  setIsConfigMode(false);
                } else {
                  // Entering config mode - use pre-computed next version number
                  setSelectedVersionNo(nextVersionNo);
                  setSelectedVersionDate(new Date());
                  setActiveVersion(nextVersionNo);
                  setIsConfigMode(true);
                }
              }}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              size="sm"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{isConfigMode ? "Exit Config" : "Configure Fields"}</span>
              <span className="sm:hidden">{isConfigMode ? "Exit" : "Config"}</span>
            </Button>
            <Button 
              onClick={() => {
                // Validate assessment criteria fields
                const validationResult = validateAssessmentCriteria();
                if (!validationResult.isValid) {
                  setValidationErrors(validationResult.errors);
                  setShowValidationDialog(true);
                  return;
                }
                
                // Manual weight validation check before submitting
                if (isConfigMode) {
                  const competenceAssessments = formMethods.getValues("competenceAssessments");
                  const behaviouralAssessments = formMethods.getValues("behaviouralAssessments");
                  
                  if (competenceAssessments.length > 0) {
                    const totalWeight = calculateTotalWeight();
                    console.log("Manual validation - Competence total weight:", totalWeight, "Assessments:", competenceAssessments);
                    if (totalWeight !== 100) {
                      setShowWeightWarning(true);
                      return;
                    }
                  }
                  
                  if (behaviouralAssessments.length > 0) {
                    const totalWeight = calculateBehaviouralTotalWeight();
                    console.log("Manual validation - Behavioural total weight:", totalWeight, "Assessments:", behaviouralAssessments);
                    if (totalWeight !== 100) {
                      setShowWeightWarning(true);
                      return;
                    }
                  }
                }
                // Create draft version via API
                const versionNo = selectedVersionNo || "01";
                const versionDate = selectedVersionDate 
                  ? format(selectedVersionDate, "dd-MMM-yyyy") 
                  : format(new Date(), "dd-MMM-yyyy");
                
                // Get the current form data for the version
                const formData = formMethods.getValues();
                const sharedConfig = {
                  appraisalTypeOptions: appraisalTypeOptions,
                };
                
                createDraftMutation.mutate({
                  versionNo,
                  versionDate,
                  configuration: JSON.stringify(formData),
                  sharedConfig: JSON.stringify(sharedConfig),
                });
                
                setHasSavedDraft(true);
                setActiveVersion(versionNo);
                formMethods.handleSubmit(onSubmit)();
              }}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              size="sm"
              disabled={createDraftMutation.isPending || !currentRankGroup}
              title={!currentRankGroup ? "Please select a rank group first" : undefined}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{createDraftMutation.isPending ? 'Saving...' : 'Save Draft'}</span>
              <span className="sm:hidden">{createDraftMutation.isPending ? '...' : 'Save'}</span>
            </Button>
          </div>
        </div>

        {/* Version Display Bars */}
        <div className="border-b">
          {isConfigMode ? (
            // In configuration mode, show only draft version bar with interactive controls
            <div className="px-3 sm:px-4 py-3 bg-blue-50 border-l-4 border-blue-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Version No:</span>
                    <Select
                      value={selectedVersionNo || nextVersionNo}
                      onValueChange={setSelectedVersionNo}
                    >
                      <SelectTrigger className="w-20 sm:w-24 h-8 text-xs sm:text-sm">
                        <SelectValue placeholder={nextVersionNo} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVersionOptions.map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Version Date:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-32 sm:w-36 h-8 justify-start text-left font-normal text-xs sm:text-sm"
                        >
                          <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                          {selectedVersionDate ? format(selectedVersionDate, "dd-MMM-yyyy") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedVersionDate}
                          onSelect={setSelectedVersionDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                  <span className="text-xs sm:text-sm font-semibold text-blue-600">Draft</span>
                </div>
              </div>
            </div>
          ) : (
            // Outside configuration mode, show version history (both draft and released if draft exists)
            versions.map((version, index) => (
              <div
                key={version.id ?? `${version.versionNo}-${version.status}-${index}`}
                className={`px-3 sm:px-4 py-3 cursor-pointer transition-colors hover:bg-gray-100 ${
                  activeVersion === version.versionNo 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : 'bg-gray-50'
                } ${index < versions.length - 1 ? 'border-b border-gray-200' : ''}`}
                onClick={() => setActiveVersion(version.versionNo)}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Version No:</span>
                      <span className="text-xs sm:text-sm font-semibold">{version.versionNo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Version Date:</span>
                      <span className="text-xs sm:text-sm font-semibold">{version.versionDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                    <span className={`text-xs sm:text-sm font-semibold ${
                      version.status === "Released" ? "text-green-600" : "text-blue-600"
                    }`}>
                      {version.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id;
              
              return (
                <div key={section.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveSection(section.id)}
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
                      {section.displayId}
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

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Enhanced Stepper (Hidden on Mobile) */}
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-[#f8fafc] border-r overflow-y-auto">
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 min-h-[3rem] ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 text-blue-700" 
                            : "border-transparent hover:bg-gray-100 text-gray-700"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        data-testid={`button-step-${section.id}`}
                        title={section.title}
                      >
                        <span 
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                            isActive 
                              ? "bg-blue-600 text-white" 
                              : "bg-gray-600 text-white"
                          }`}
                        >
                          {section.displayId}
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
                          {section.title}
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

          {/* Main Content - Continuous Scroll Container */}
          <div className="flex-1 overflow-hidden bg-[#f8fafc]">
            <div className="p-3 sm:p-4 md:p-6 h-full">
              <div ref={continuousScrollContainerRef} className="h-full overflow-y-auto">
                {renderContinuousScroll()}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Weight Warning Dialog */}
      {showWeightWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Weight Validation</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              Total weight must be 100%. 
              {(() => {
                const competenceAssessments = formMethods.getValues("competenceAssessments");
                const behaviouralAssessments = formMethods.getValues("behaviouralAssessments");
                
                if (competenceAssessments.length > 0 && calculateTotalWeight() !== 100) {
                  return `Part C current total is ${calculateTotalWeight()}%.`;
                }
                if (behaviouralAssessments.length > 0 && calculateBehaviouralTotalWeight() !== 100) {
                  return `Part D current total is ${calculateBehaviouralTotalWeight()}%.`;
                }
                return "";
              })()}
              Do you want to equally distribute the weights?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWeightWarning(false)}
                className="text-sm sm:text-base"
                size="sm"
              >
                No
              </Button>
              <Button
                onClick={() => {
                  const competenceAssessments = formMethods.getValues("competenceAssessments");
                  const behaviouralAssessments = formMethods.getValues("behaviouralAssessments");
                  
                  if (competenceAssessments.length > 0 && calculateTotalWeight() !== 100) {
                    distributeWeightsEqually();
                  }
                  if (behaviouralAssessments.length > 0 && calculateBehaviouralTotalWeight() !== 100) {
                    distributeBehaviouralWeightsEqually();
                  }
                  setShowWeightWarning(false);
                }}
                className="text-sm sm:text-base"
                size="sm"
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Configuration Mode Dialog */}
      <AlertDialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enter Configuration Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              You need to be in configuration mode to add new recommendations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnterConfigMode}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Appraisal Type Configuration Dialog */}
      <Dialog open={showAppraisalTypeDialog} onOpenChange={setShowAppraisalTypeDialog}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full mx-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Configure Appraisal Type Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current options list */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">Current Options:</Label>
              <div className="border rounded-md p-2 max-h-32 sm:max-h-48 overflow-y-auto">
                {appraisalTypeOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-xs sm:text-sm truncate flex-1 mr-2">{option}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editAppraisalTypeOption(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAppraisalTypeOption(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add/Edit option input */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">
                {editingAppraisalTypeIndex === -1 ? "Add New Option:" : "Edit Option:"}
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={editingAppraisalType}
                  onChange={(e) => setEditingAppraisalType(e.target.value)}
                  placeholder="Enter option name"
                  className="flex-1 text-xs sm:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveAppraisalTypeOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={saveAppraisalTypeOption}
                  disabled={!editingAppraisalType.trim()}
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  {editingAppraisalTypeIndex === -1 ? "Add" : "Save"}
                </Button>
              </div>
            </div>


          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAppraisalTypeDialog(false)} className="text-xs sm:text-sm">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PI Category Configuration Dialog */}
      <Dialog open={showPiCategoryDialog} onOpenChange={setShowPiCategoryDialog}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full mx-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Configure PI Category Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current options list */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">Current Options:</Label>
              <div className="border rounded-md p-2 max-h-32 sm:max-h-48 overflow-y-auto">
                {piCategoryOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-xs sm:text-sm truncate flex-1 mr-2">{option}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editPiCategoryOption(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePiCategoryOption(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add/Edit option input */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">
                {editingPiCategoryIndex === -1 ? "Add New Option:" : "Edit Option:"}
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={editingPiCategory}
                  onChange={(e) => setEditingPiCategory(e.target.value)}
                  placeholder="Enter option name"
                  className="flex-1 text-xs sm:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      savePiCategoryOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={savePiCategoryOption}
                  disabled={!editingPiCategory.trim()}
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  {editingPiCategoryIndex === -1 ? "Add" : "Save"}
                </Button>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPiCategoryDialog(false)} className="text-xs sm:text-sm">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Effectiveness Rating Configuration Dialog */}
      <Dialog open={showEffectivenessDialog} onOpenChange={setShowEffectivenessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Effectiveness Rating Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current options list */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Options:</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                {effectivenessOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-sm">{option}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editEffectivenessOption(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEffectivenessOption(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add/Edit option input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {editingEffectivenessIndex === -1 ? "Add New Option:" : "Edit Option:"}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={editingEffectiveness}
                  onChange={(e) => setEditingEffectiveness(e.target.value)}
                  placeholder="Enter option name"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveEffectivenessOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={saveEffectivenessOption}
                  disabled={!editingEffectiveness.trim()}
                  size="sm"
                >
                  {editingEffectivenessIndex === -1 ? "Add" : "Save"}
                </Button>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEffectivenessDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Category Configuration Dialog */}
      <Dialog open={showTrainingCategoryDialog} onOpenChange={setShowTrainingCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Training Category Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current options list */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Options:</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                {trainingCategoryOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-sm">{option}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editTrainingCategoryOption(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTrainingCategoryOption(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add/Edit option input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {editingTrainingCategoryIndex === -1 ? "Add New Option:" : "Edit Option:"}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={editingTrainingCategory}
                  onChange={(e) => setEditingTrainingCategory(e.target.value)}
                  placeholder="Enter option name"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveTrainingCategoryOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={saveTrainingCategoryOption}
                  disabled={!editingTrainingCategory.trim()}
                  size="sm"
                >
                  {editingTrainingCategoryIndex === -1 ? "Add" : "Save"}
                </Button>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrainingCategoryDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Status Configuration Dialog */}
      <Dialog open={showTrainingStatusDialog} onOpenChange={setShowTrainingStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Training Status Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current options list */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Options:</Label>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                {trainingStatusOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-sm">{option}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => editTrainingStatusOption(index)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTrainingStatusOption(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add/Edit option input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {editingTrainingStatusIndex === -1 ? "Add New Option:" : "Edit Option:"}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={editingTrainingStatus}
                  onChange={(e) => setEditingTrainingStatus(e.target.value)}
                  placeholder="Enter option name"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveTrainingStatusOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={saveTrainingStatusOption}
                  disabled={!editingTrainingStatus.trim()}
                  size="sm"
                >
                  {editingTrainingStatusIndex === -1 ? "Add" : "Save"}
                </Button>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrainingStatusDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Validation Dialog */}
      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validation Errors</AlertDialogTitle>
            <AlertDialogDescription>
              Please fix the following errors before proceeding:
              <ul className="mt-2 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-red-600 font-medium">• {error}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowValidationDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogCancel onClick={closeConfirmDialog}>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};