import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Form } from "@shared/schema";

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

interface FormEditorProps {
  form: Form;
  rankGroupName?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const FormEditor: React.FC<FormEditorProps> = ({ form, rankGroupName, onClose, onSave }) => {
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
  
  // Function to toggle field visibility
  const toggleFieldVisibility = (fieldName: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };
  
  // Function to toggle section visibility
  const toggleSectionVisibility = (sectionName: string) => {
    setSectionVisibility(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
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
  const [selectedVersionNo, setSelectedVersionNo] = useState<string>("");
  const [selectedVersionDate, setSelectedVersionDate] = useState<Date | undefined>();
  const [activeVersion, setActiveVersion] = useState<string>("00"); // Track which version is currently being viewed
  
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

  // Mock version data - in real implementation this would come from API
  const versions = [
    ...(hasSavedDraft ? [{
      versionNo: "01",
      versionDate: selectedVersionDate ? format(selectedVersionDate, "dd-MMM-yyyy") : "02-Jul-2025",
      status: "Draft"
    }] : []),
    {
      versionNo: "00",
      versionDate: "01-Jan-2025",
      status: "Released"
    }
  ];

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
    
    onSave({
      ...data,
      formId: form.id,
      version: formVersion,
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

  // Calculate section score based on weight and effectiveness
  const calculateSectionScore = () => {
    const assessments = formMethods.watch("competenceAssessments");
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
    const assessments = formMethods.watch("behaviouralAssessments");
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

  // Appraisal Type configuration state
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
      answer: "Yes",
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

  // Calculate overall score (F1)
  const calculateOverallScore = () => {
    const competenceScore = parseFloat(calculateSectionScore());
    const behaviouralScore = parseFloat(calculateBehaviouralSectionScore());
    return ((competenceScore + behaviouralScore) / 2).toFixed(1);
  };

  const sections = [
    { id: "A", title: "Seafarer's Information", active: true },
    { id: "B", title: "Information at Start of Appraisal Period", active: false },
    { id: "C", title: "Competence Assessment (Professional Knowledge & Skills)", active: false },
    { id: "D", title: "Behavioural Assessment (Soft Skills)", active: false },
    { id: "E", title: "Training Needs & Development", active: false },
    { id: "F", title: "Summary & Recommendations", active: false },
    { id: "G", title: "Office Review & Followup", active: false },
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



  const renderPartA = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A: Seafarer's Information</h3>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Enter details as applicable</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="seafarersName" className="text-sm">Seafarer's Name</Label>
          <Input
            id="seafarersName"
            placeholder="James Michael"
            {...formMethods.register("seafarersName")}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="seafarersRank" className="text-sm">Seafarer's Rank</Label>
          <Select
            value={formMethods.watch("seafarersRank") || ""}
            onValueChange={(value) => formMethods.setValue("seafarersRank", value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="master">Master</SelectItem>
              <SelectItem value="chief-officer">Chief Officer</SelectItem>
              <SelectItem value="second-officer">Second Officer</SelectItem>
              <SelectItem value="third-officer">Third Officer</SelectItem>
              <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
              <SelectItem value="second-engineer">Second Engineer</SelectItem>
              <SelectItem value="third-engineer">Third Engineer</SelectItem>
              <SelectItem value="able-seaman">Able Seaman</SelectItem>
              <SelectItem value="bosun">Bosun</SelectItem>
              <SelectItem value="cook">Cook</SelectItem>
              <SelectItem value="steward">Steward</SelectItem>
              <SelectItem value="electrician">Electrician</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nationality" className="text-sm">Nationality</Label>
          <Select
            value={formMethods.watch("nationality") || ""}
            onValueChange={(value) => formMethods.setValue("nationality", value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select nationality..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="british">British</SelectItem>
              <SelectItem value="indian">Indian</SelectItem>
              <SelectItem value="philippines">Philippines</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="norwegian">Norwegian</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vessel" className="text-sm">Vessel</Label>
          <Select
            value={formMethods.watch("vessel") || ""}
            onValueChange={(value) => formMethods.setValue("vessel", value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mt-sail-one">MT Sail One</SelectItem>
              <SelectItem value="mt-sail-two">MT Sail Two</SelectItem>
              <SelectItem value="mt-sail-three">MT Sail Three</SelectItem>
              <SelectItem value="mv-sail-seven">MV Sail Seven</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signOn" className="text-sm">Sign On Date</Label>
          <Input
            id="signOn"
            type="date"
            {...formMethods.register("signOn")}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label 
            htmlFor="appraisalType" 
            className={`text-sm ${isConfigMode ? "cursor-pointer" : ""}`}
            style={isConfigMode ? { color: '#52baf3' } : {}}
            onClick={isConfigMode ? () => setShowAppraisalTypeDialog(true) : undefined}
          >
            Appraisal Type
          </Label>
          <Select
            value={formMethods.watch("appraisalType") || ""}
            onValueChange={(value) => formMethods.setValue("appraisalType", value)}
            onOpenChange={(open) => {
              if (isConfigMode && open) {
                setShowAppraisalTypeDialog(true);
              }
            }}
          >
            <SelectTrigger 
              className={`text-sm ${isConfigMode ? "cursor-pointer" : ""}`}
              style={isConfigMode ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {appraisalTypeOptions.map((option, index) => (
                <SelectItem key={index} value={option.toLowerCase().replace(/\s+/g, '-')}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="appraisalPeriodFrom" className="text-sm">Appraisal Period From</Label>
          <Input
            id="appraisalPeriodFrom"
            type="date"
            {...formMethods.register("appraisalPeriodFrom")}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="appraisalPeriodTo" className="text-sm">Appraisal Period To</Label>
          <Input
            id="appraisalPeriodTo"
            type="date"
            {...formMethods.register("appraisalPeriodTo")}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="primaryAppraiser" className="text-sm">Primary Appraiser</Label>
          <Select
            value={formMethods.watch("primaryAppraiser") || ""}
            onValueChange={(value) => formMethods.setValue("primaryAppraiser", value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select appraiser" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="captain-smith">Captain Smith</SelectItem>
              <SelectItem value="chief-engineer-jones">Chief Engineer Jones</SelectItem>
              <SelectItem value="fleet-manager">Fleet Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {fieldVisibility.personalityIndexCategory && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <Label 
              htmlFor="personalityIndexCategory"
              className={`text-sm ${isConfigMode ? "cursor-pointer" : ""}`}
              style={isConfigMode ? { color: '#52baf3' } : {}}
              onClick={isConfigMode ? () => setShowPiCategoryDialog(true) : undefined}
            >
              Personality Index (PI) Category
            </Label>
            {isConfigMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleFieldVisibility('personalityIndexCategory')}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
                style={{ 
                  borderColor: '#52baf3',
                  color: '#52baf3'
                }}
              >
                Hide Field
              </Button>
            )}
          </div>
          <Select
            value={formMethods.watch("personalityIndexCategory") || ""}
            onValueChange={(value) => formMethods.setValue("personalityIndexCategory", value)}
            onOpenChange={(open) => {
              if (isConfigMode && open) {
                setShowPiCategoryDialog(true);
              }
            }}
          >
            <SelectTrigger 
              className={`w-full text-sm ${isConfigMode ? "cursor-pointer" : ""}`}
              style={isConfigMode ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {piCategoryOptions.map((option, index) => (
                <SelectItem key={index} value={option.toLowerCase().replace(/\s+/g, '-')}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {isConfigMode && !fieldVisibility.personalityIndexCategory && (
        <div className="space-y-2 opacity-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <Label htmlFor="personalityIndexCategory" className="text-gray-400 text-sm">Personality Index (PI) Category (Hidden)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFieldVisibility('personalityIndexCategory')}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
              style={{ 
                borderColor: '#52baf3',
                color: '#52baf3'
              }}
            >
              Show Field
            </Button>
          </div>
          <div className="p-3 bg-gray-100 rounded border-2 border-dashed border-gray-300">
            <div className="text-gray-400 text-xs sm:text-sm">Field is hidden</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPartB = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3 sm:gap-0">
          <h3 className="text-lg sm:text-xl font-semibold" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('B')}: Information at Start of Appraisal Period</h3>
          {isConfigMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partB')}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7 shrink-0"
              style={{ 
                borderColor: '#52baf3',
                color: '#52baf3'
              }}
            >
              {sectionVisibility.partB ? 'Hide Section' : 'Show Section'}
            </Button>
          )}
        </div>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {sectionVisibility.partB && (
        <>
          {/* B1. Trainings conducted prior joining vessel */}
          {sectionVisibility.partB1 && (
            <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)</h3>
          <div className="flex items-center gap-2 shrink-0">
            {isConfigMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleSectionVisibility('partB1')}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
                style={{ 
                  borderColor: '#52baf3',
                  color: '#52baf3'
                }}
              >
                {sectionVisibility.partB1 ? 'Hide Section' : 'Show Section'}
              </Button>
            )}
            <Button
              type="button"
              onClick={addTraining}
              variant="outline"
              size="sm"
              className="text-gray-600 border-gray-300 text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Add Training</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {formMethods.watch("trainings").map((training, index) => (
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
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <Select
                          value={training.evaluation}
                          onValueChange={(value) => updateTraining(training.id, "evaluation", value)}
                          onOpenChange={(open) => {
                            if (isConfigMode && open && index === 0) {
                              setShowEffectivenessDialog(true);
                            }
                          }}
                        >
                          <SelectTrigger 
                            className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                            style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                          >
                            <SelectValue placeholder="Select Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            {effectivenessOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <div className="flex gap-2 justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setTrainingComments(prev => ({
                              ...prev,
                              [training.id]: prev[training.id] || ""
                            }))}
                            className="h-6 w-6"
                          >
                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTraining(training.id)}
                            className="h-6 w-6"
                          >
                            <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {trainingComments[training.id] !== undefined && (
                      <tr>
                        <td></td>
                        <td colSpan={3} className="p-2 sm:p-3">
                          <Textarea
                            value={trainingComments[training.id]}
                            onChange={(e) => {
                              setTrainingComments(prev => ({
                                ...prev,
                                [training.id]: e.target.value
                              }));
                              updateTraining(training.id, "comment", e.target.value);
                            }}
                            placeholder="Comment: Add your observations here..."
                            className="text-blue-600 italic border-blue-200 text-xs sm:text-sm"
                            rows={2}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {formMethods.watch("trainings").length === 0 && (
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

          {/* Hidden B1 placeholder in config mode */}
          {isConfigMode && !sectionVisibility.partB1 && (
            <div className="opacity-50 bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-400">B1. Trainings conducted prior joining vessel (Hidden)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSectionVisibility('partB1')}
                  className="text-sm px-3 py-1 h-7"
                  style={{ 
                    borderColor: '#52baf3',
                    color: '#52baf3'
                  }}
                >
                  Show Section
                </Button>
              </div>
              <div className="text-gray-400 text-sm">Section is hidden</div>
            </div>
          )}

          {/* B2. Target Setting */}
          {sectionVisibility.partB2 && (
            <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>B2. Target Setting</h3>
          <div className="flex items-center gap-2">
            {isConfigMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleSectionVisibility('partB2')}
                className="text-sm px-3 py-1 h-7"
                style={{ 
                  borderColor: '#52baf3',
                  color: '#52baf3'
                }}
              >
                {sectionVisibility.partB2 ? 'Hide Section' : 'Show Section'}
              </Button>
            )}
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
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Setting</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Evaluation</th>
                <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {formMethods.watch("targets").map((target, index) => (
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
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select
                        value={target.evaluation}
                        onValueChange={(value) => updateTarget(target.id, "evaluation", value)}
                        onOpenChange={(open) => {
                          if (isConfigMode && open && index === 0) {
                            setShowEffectivenessDialog(true);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                          style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                        >
                          <SelectValue placeholder="Select Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {effectivenessOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex gap-2 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setTargetComments(prev => ({
                            ...prev,
                            [target.id]: prev[target.id] || ""
                          }))}
                          className="h-6 w-6"
                        >
                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTarget(target.id)}
                          className="h-6 w-6"
                        >
                          <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {targetComments[target.id] !== undefined && (
                    <tr key={`comment-${target.id}`}>
                      <td></td>
                      <td colSpan={3} className="p-3">
                        <Textarea
                          value={targetComments[target.id]}
                          onChange={(e) => {
                            setTargetComments(prev => ({
                              ...prev,
                              [target.id]: e.target.value
                            }));
                            updateTarget(target.id, "comment", e.target.value);
                          }}
                          placeholder="Comment: Add your observations here..."
                          className="text-blue-600 italic border-blue-200"
                          rows={2}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {formMethods.watch("targets").length === 0 && (
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

          {/* Hidden B2 placeholder in config mode */}
          {isConfigMode && !sectionVisibility.partB2 && (
            <div className="opacity-50 bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-400">B2. Target Setting (Hidden)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSectionVisibility('partB2')}
                  className="text-sm px-3 py-1 h-7"
                  style={{ 
                    borderColor: '#52baf3',
                    color: '#52baf3'
                  }}
                >
                  Show Section
                </Button>
              </div>
              <div className="text-gray-400 text-sm">Section is hidden</div>
            </div>
          )}
        </>
      )}

      {/* Hidden Part B placeholder in config mode */}
      {isConfigMode && !sectionVisibility.partB && (
        <div className="opacity-50 bg-gray-50 p-6 rounded border-2 border-dashed border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-400">Part B: Information at Start of Appraisal Period (Hidden)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partB')}
              className="text-sm px-3 py-1 h-7"
              style={{ 
                borderColor: '#52baf3',
                color: '#52baf3'
              }}
            >
              Show Section
            </Button>
          </div>
          <div className="text-gray-400 text-sm">Section is hidden</div>
        </div>
      )}
    </div>
  );

  const renderPartC = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="pb-3 sm:pb-4 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('C')}: Competence Assessment (Professional Knowledge & Skills)</h3>
        <div style={{ color: '#16569e' }} className="text-xs sm:text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {/* Add Criterion Button */}
      {isConfigMode && (
        <div className="flex justify-end items-center mb-4">
          <Button
            type="button"
            onClick={addCompetenceCriterion}
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm px-2 sm:px-3 py-1 h-6 sm:h-7"
            style={{ 
              borderColor: '#52baf3',
              color: '#52baf3'
            }}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Add Criterion</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      )}
      
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
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
              {formMethods.watch("competenceAssessments").map((assessment, index) => (
                <React.Fragment key={assessment.id}>
                  <tr className="border-t">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      {isConfigMode ? (
                        <Input
                          value={assessment.assessmentCriteria}
                          onChange={(e) => updateCompetenceCriterion(assessment.id, "assessmentCriteria", e.target.value)}
                          placeholder="Enter assessment criteria"
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                          style={{ color: '#52baf3' }}
                        />
                      ) : (
                        <span className="text-[13px]">{assessment.assessmentCriteria}</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      {isConfigMode ? (
                        <Input
                          type="number"
                          value={assessment.weight}
                          onChange={(e) => updateCompetenceCriterion(assessment.id, "weight", parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="border-0 bg-transparent p-0 focus-visible:ring-0 w-12 text-[13px] h-6"
                          style={{ color: '#52baf3' }}
                          min="0"
                          max="100"
                        />
                      ) : (
                        <span className="text-[13px]">{assessment.weight}%</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select
                        value={assessment.effectiveness}
                        onValueChange={(value) => updateCompetenceCriterion(assessment.id, "effectiveness", value)}
                        onOpenChange={(open) => {
                          if (isConfigMode && open && index === 0) {
                            setShowEffectivenessDialog(true);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                          style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                        >
                          <SelectValue placeholder="Select Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {effectivenessOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex gap-2 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setCompetenceComments(prev => ({
                            ...prev,
                            [assessment.id]: prev[assessment.id] || ""
                          }))}
                          className="h-6 w-6"
                        >
                          <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                        {isConfigMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCompetenceCriterion(assessment.id)}
                            className="h-6 w-6"
                          >
                            <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {competenceComments[assessment.id] !== undefined && (
                    <tr key={`comment-${assessment.id}`}>
                      <td></td>
                      <td colSpan={4} className="p-2 sm:p-3">
                        <Textarea
                          value={competenceComments[assessment.id]}
                          onChange={(e) => {
                            setCompetenceComments(prev => ({
                              ...prev,
                              [assessment.id]: e.target.value
                            }));
                            updateCompetenceCriterion(assessment.id, "comment", e.target.value);
                          }}
                          placeholder="Comment: Add your observations here..."
                          className="text-blue-600 italic border-blue-200 text-xs sm:text-sm"
                          rows={2}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {formMethods.watch("competenceAssessments").length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 sm:p-8 text-center text-gray-500 text-xs sm:text-sm">
                    {isConfigMode ? "No assessment criteria added yet. Click \"Add Criterion\" to get started." : "No assessment criteria configured."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section Score */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm font-medium text-gray-700">Section Score:</div>
        <div className={`px-3 sm:px-4 py-2 rounded text-base sm:text-lg font-semibold min-w-[48px] sm:min-w-[64px] text-center ${getScoreColors(parseFloat(calculateSectionScore())).bgColor} ${getScoreColors(parseFloat(calculateSectionScore())).textColor}`}>
          {calculateSectionScore()}
        </div>
      </div>
    </div>
  );

  const renderPartD = () => (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('D')}: Behavioural Assessment (Soft Skills)</h3>
          {isConfigMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partD')}
              className="text-sm px-3 py-1 h-7"
              style={{ 
                borderColor: '#52baf3',
                color: '#52baf3'
              }}
            >
              {sectionVisibility.partD ? 'Hide Section' : 'Show Section'}
            </Button>
          )}
        </div>
        <div style={{ color: '#16569e' }} className="text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {sectionVisibility.partD && (
        <>
          {/* Add Criterion Button */}
          {isConfigMode && (
            <div className="flex justify-end items-center mb-4">
              <Button
                type="button"
                onClick={addBehaviouralAssessment}
                variant="outline"
                size="sm"
                className="text-sm px-3 py-1 h-7"
                style={{ 
                  borderColor: '#52baf3',
                  color: '#52baf3'
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Criterion
              </Button>
            </div>
          )}
          
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
                {formMethods.watch("behaviouralAssessments").map((assessment, index) => (
                  <React.Fragment key={assessment.id}>
                    <tr className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        {isConfigMode ? (
                          <Input
                            value={assessment.assessmentCriteria}
                            onChange={(e) => updateBehaviouralAssessment(assessment.id, "assessmentCriteria", e.target.value)}
                            placeholder="Enter Assessment Criteria"
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                          />
                        ) : (
                          <span className="text-[13px]">{assessment.assessmentCriteria}</span>
                        )}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                        {isConfigMode ? (
                          <Input
                            type="number"
                            value={assessment.weight}
                            onChange={(e) => updateBehaviouralAssessment(assessment.id, "weight", parseInt(e.target.value) || 0)}
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-center w-16 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                          />
                        ) : (
                          <span className="text-[13px]">{assessment.weight}%</span>
                        )}
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <Select
                          value={assessment.effectiveness}
                          onValueChange={(value) => updateBehaviouralAssessment(assessment.id, "effectiveness", value)}
                          onOpenChange={(open) => {
                            if (isConfigMode && open && index === 0) {
                              setShowEffectivenessDialog(true);
                            }
                          }}
                        >
                          <SelectTrigger 
                            className={`border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6 ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                            style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                          >
                            <SelectValue placeholder="Select Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            {effectivenessOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setBehaviouralComments(prev => ({
                              ...prev,
                              [assessment.id]: prev[assessment.id] || ""
                            }))}
                            className="h-6 w-6"
                          >
                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                          {isConfigMode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteBehaviouralAssessment(assessment.id)}
                              className="text-red-600 hover:text-red-800 h-6 w-6"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {behaviouralComments[assessment.id] !== undefined && (
                      <tr key={`comment-${assessment.id}`}>
                        <td></td>
                        <td colSpan={4} className="p-3">
                          <Textarea
                            value={behaviouralComments[assessment.id]}
                            onChange={(e) => {
                              setBehaviouralComments(prev => ({
                                ...prev,
                                [assessment.id]: e.target.value
                              }));
                              updateBehaviouralAssessment(assessment.id, "comment", e.target.value);
                            }}
                            placeholder="Comment: Add your observations here..."
                            className="text-blue-600 italic border-blue-200"
                            rows={2}
                          />
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
        </>
      )}

      {/* Hidden Part D placeholder in config mode */}
      {isConfigMode && !sectionVisibility.partD && (
        <div className="opacity-50 bg-gray-50 p-6 rounded border-2 border-dashed border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-400">Part D: Behavioural Assessment (Soft Skills) (Hidden)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSectionVisibility('partD')}
              className="text-sm px-3 py-1 h-7"
              style={{ 
                borderColor: '#52baf3',
                color: '#52baf3'
              }}
            >
              Show Section
            </Button>
          </div>
          <div className="text-gray-400 text-sm">Section is hidden</div>
        </div>
      )}
    </div>
  );

  const renderPartE = () => (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('E')}: Training Needs & Development</h3>
        <div style={{ color: '#16569e' }} className="text-sm">Specify any training needs identified during the appraisals period</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      <div className="flex justify-end items-center">
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
            {formMethods.watch("trainingNeeds").map((trainingNeed, index) => (
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
                        onClick={() => setTrainingNeedsComments(prev => ({
                          ...prev,
                          [trainingNeed.id]: prev[trainingNeed.id] || ""
                        }))}
                        className="h-6 w-6"
                      >
                        <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrainingNeed(trainingNeed.id)}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {trainingNeedsComments[trainingNeed.id] !== undefined && (
                  <tr key={`comment-${trainingNeed.id}`}>
                    <td></td>
                    <td colSpan={2} className="p-3">
                      <Textarea
                        value={trainingNeedsComments[trainingNeed.id]}
                        onChange={(e) => {
                          setTrainingNeedsComments(prev => ({
                            ...prev,
                            [trainingNeed.id]: e.target.value
                          }));
                          updateTrainingNeed(trainingNeed.id, "comment", e.target.value);
                        }}
                        placeholder="Comment: Add your observations here..."
                        className="text-blue-600 italic border-blue-200"
                        rows={2}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {formMethods.watch("trainingNeeds").length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-gray-500">
                  No training needs added yet. Click "Add Training from Database" or "Add New Training" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPartF = () => (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('F')}: Summary & Recommendations</h3>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-sm px-3 py-1 h-7"
            style={{ 
              borderColor: isConfigMode ? '#52baf3' : '#d1d5db',
              color: isConfigMode ? '#52baf3' : '#6b7280'
            }}
            onClick={addRecommendation}
          >
            + Add Recommendation
          </Button>
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
              {formMethods.watch("recommendations").map((recommendation, index) => (
                <React.Fragment key={recommendation.id}>
                  <tr className="border-t">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4" style={{ 
                      color: recommendation.isCustom && isConfigMode ? '#52baf3' : 'inherit'
                    }}>
                      {recommendation.isCustom && isConfigMode ? (
                        editingRecommendations.has(recommendation.id) ? (
                          <Input
                            value={recommendation.question === "Add new recommendation" ? "" : recommendation.question}
                            onChange={(e) => updateRecommendation(recommendation.id, "question", e.target.value)}
                            onBlur={() => handleRecommendationBlur(recommendation.id)}
                            placeholder="Add new recommendation"
                            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[13px] h-6"
                            style={{ color: '#52baf3' }}
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer p-0 text-[13px]"
                            onClick={() => startEditingRecommendation(recommendation.id)}
                            style={{ color: '#52baf3' }}
                          >
                            {recommendation.question}
                          </div>
                        )
                      ) : (
                        <span className="text-[13px]">{recommendation.question}</span>
                      )}
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "Yes"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "Yes")}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "No"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "No")}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4 text-center">
                      <input
                        type="radio"
                        name={`recommendation-${recommendation.id}`}
                        checked={recommendation.answer === "NA"}
                        onChange={() => updateRecommendation(recommendation.id, "answer", "NA")}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex justify-center gap-2">
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
                        {recommendation.isCustom && isConfigMode && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              style={{ color: '#52baf3' }}
                              onClick={() => startEditingRecommendation(recommendation.id)}
                              className="h-6 w-6"
                            >
                              <Edit2 className="h-[18px] w-[18px]" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRecommendation(recommendation.id)}
                              style={{ color: '#52baf3' }}
                              className="h-6 w-6"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {recommendationComments[recommendation.id] !== undefined && (
                    <tr key={`comment-${recommendation.id}`}>
                      <td></td>
                      <td colSpan={5} className="p-3">
                        <Textarea
                          value={recommendationComments[recommendation.id]}
                          onChange={(e) => {
                            setRecommendationComments(prev => ({
                              ...prev,
                              [recommendation.id]: e.target.value
                            }));
                            updateRecommendation(recommendation.id, "comment", e.target.value);
                          }}
                          placeholder="Comment: Add your observations here..."
                          className="text-blue-600 italic border-blue-200"
                          rows={2}
                        />
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
      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F3. Appraiser Comments</h3>
        <div className="space-y-2">
          <Label htmlFor="appraiserComments">Appraiser Comments</Label>
          <Textarea
            id="appraiserComments"
            placeholder="Add appraiser comments..."
            {...formMethods.register("appraiserComments")}
            rows={4}
          />
        </div>
      </div>

      {/* F4: Seafarer Comments */}
      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>F4. Seafarer Comments</h3>
        <div className="space-y-2">
          <Label htmlFor="seafarerComments">Seafarer Comments</Label>
          <Textarea
            id="seafarerComments"
            placeholder="Add seafarer comments..."
            {...formMethods.register("seafarerComments")}
            rows={4}
          />
        </div>
      </div>
    </div>
  );

  const renderPartG = () => (
    <div className="space-y-6">
      <div className="pb-4 mb-6">
        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part {getDynamicSectionLetter('G')}: Office Review & Followup</h3>
        <div style={{ color: '#16569e' }} className="text-sm">This section is visible to office users only</div>
        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
      </div>
      
      {/* G1: Office Review */}
      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G1. Office Review</h3>
        <div className="space-y-2">
          <Label htmlFor="officeReviewComments">Office Review Comments</Label>
          <Textarea
            id="officeReviewComments"
            placeholder="Office review and additional comments..."
            {...formMethods.register("officeReviewComments")}
            rows={4}
          />
        </div>
      </div>

      {/* G2: Training Follow-up */}
      <div className="space-y-4">
        <h3 className="font-medium text-[16px] text-[#15569e]" style={{ color: '#16569e' }}>G2. Training Follow-up</h3>
        
        {/* Training Followup Table */}
        <div className="space-y-4">
          {!isConfigMode && (
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Training Follow-up Actions</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTrainingFollowup('database')}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add from Database
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTrainingFollowup('new')}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add New
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Training</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Corresponding in DB</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Category</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Status</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Target Date</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isConfigMode ? (
                  // Show only one configuration row in config mode
                  <tr className="border-b">
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Input
                        placeholder="Training name"
                        value=""
                        readOnly
                        className="w-full bg-gray-50 text-[13px] h-6"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select disabled>
                        <SelectTrigger className="w-full bg-gray-50 text-[13px] h-6">
                          <SelectValue placeholder="Select Training from DB" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Select Training from DB">Select Training from DB</SelectItem>
                          <SelectItem value="STCW Basic Safety Training">STCW Basic Safety Training</SelectItem>
                          <SelectItem value="Advanced Fire Fighting">Advanced Fire Fighting</SelectItem>
                          <SelectItem value="Medical First Aid">Medical First Aid</SelectItem>
                          <SelectItem value="Ship Security Officer">Ship Security Officer</SelectItem>
                          <SelectItem value="Bridge Resource Management">Bridge Resource Management</SelectItem>
                          <SelectItem value="Engine Resource Management">Engine Resource Management</SelectItem>
                          <SelectItem value="Leadership and Management">Leadership and Management</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select
                        onOpenChange={(open) => {
                          if (open) {
                            setShowTrainingCategoryDialog(true);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className="w-full cursor-pointer text-[13px] h-6"
                          style={{ borderColor: '#52baf3', color: '#52baf3' }}
                        >
                          <SelectValue placeholder="Select Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainingCategoryOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Select
                        onOpenChange={(open) => {
                          if (open) {
                            setShowTrainingStatusDialog(true);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className="w-full cursor-pointer text-[13px] h-6"
                          style={{ borderColor: '#52baf3', color: '#52baf3' }}
                        >
                          <SelectValue placeholder="Proposed" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainingStatusOptions.map((option, optionIndex) => (
                            <SelectItem key={optionIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <Input
                        type="date"
                        value=""
                        readOnly
                        className="w-full bg-gray-50 text-[13px] h-6"
                      />
                    </td>
                    <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <MessageSquare className="h-[18px] w-[18px]" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <Edit2 className="h-[18px] w-[18px]" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled
                          className="text-gray-400 h-6 w-6"
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Show actual data rows outside config mode
                  formMethods.watch("trainingFollowups").map((followup, index) => (
                    <tr key={followup.id} className="border-b">
                      <td className="p-3">
                        <div className="space-y-1">
                          <Input
                            placeholder="Training name"
                            value={followup.training}
                            onChange={(e) => updateTrainingFollowup(followup.id, 'training', e.target.value)}
                            className="w-full"
                          />
                          {trainingFollowupComments[followup.id] && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {trainingFollowupComments[followup.id]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.correspondingInDB}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'correspondingInDB', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Training from DB" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Select Training from DB">Select Training from DB</SelectItem>
                            <SelectItem value="STCW Basic Safety Training">STCW Basic Safety Training</SelectItem>
                            <SelectItem value="Advanced Fire Fighting">Advanced Fire Fighting</SelectItem>
                            <SelectItem value="Medical First Aid">Medical First Aid</SelectItem>
                            <SelectItem value="Ship Security Officer">Ship Security Officer</SelectItem>
                            <SelectItem value="Bridge Resource Management">Bridge Resource Management</SelectItem>
                            <SelectItem value="Engine Resource Management">Engine Resource Management</SelectItem>
                            <SelectItem value="Leadership and Management">Leadership and Management</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.category}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'category', value)}
                          onOpenChange={(open) => {
                            if (isConfigMode && open && index === 0) {
                              setShowTrainingCategoryDialog(true);
                            }
                          }}
                        >
                          <SelectTrigger 
                            className={`w-full ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                            style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                          >
                            <SelectValue placeholder="Select Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            {trainingCategoryOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Select
                          value={followup.status}
                          onValueChange={(value) => updateTrainingFollowup(followup.id, 'status', value)}
                          onOpenChange={(open) => {
                            if (isConfigMode && open && index === 0) {
                              setShowTrainingStatusDialog(true);
                            }
                          }}
                        >
                          <SelectTrigger 
                            className={`w-full ${isConfigMode && index === 0 ? "cursor-pointer" : ""}`}
                            style={isConfigMode && index === 0 ? { borderColor: '#52baf3', color: '#52baf3' } : {}}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {trainingStatusOptions.map((option, optionIndex) => (
                              <SelectItem key={optionIndex} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Input
                          type="date"
                          value={followup.targetDate}
                          onChange={(e) => updateTrainingFollowup(followup.id, 'targetDate', e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const currentComment = trainingFollowupComments[followup.id] || followup.comment || "";
                              const newComment = prompt("Enter comment:", currentComment);
                              if (newComment !== null) {
                                setTrainingFollowupComments(prev => ({
                                  ...prev,
                                  [followup.id]: newComment
                                }));
                                updateTrainingFollowup(followup.id, 'comment', newComment);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTrainingFollowup(followup.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                variant={hasSavedDraft ? "default" : "outline"}
                size="sm"
                className={`flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                  hasSavedDraft 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={!hasSavedDraft}
              >
                <span className="hidden sm:inline">Release Ver</span>
                <span className="sm:hidden">Release</span>
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
                }
                setIsConfigMode(!isConfigMode);
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
                setHasSavedDraft(true);
                setActiveVersion("01"); // Switch to draft version when saving
                formMethods.handleSubmit(onSubmit)();
              }}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              size="sm"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Save Draft</span>
              <span className="sm:hidden">Save</span>
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
                      value={selectedVersionNo || "01"}
                      onValueChange={setSelectedVersionNo}
                    >
                      <SelectTrigger className="w-20 sm:w-24 h-8 text-xs sm:text-sm">
                        <SelectValue placeholder="01" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="01">01</SelectItem>
                        <SelectItem value="02">02</SelectItem>
                        <SelectItem value="03">03</SelectItem>
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
                key={version.versionNo}
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

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Stepper Design */}
          <div className="w-16 sm:w-20 md:w-72 overflow-y-auto bg-[#f8fafc] border-r">
            <div className="p-2 sm:p-3 md:p-6">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center p-2 sm:p-3 rounded-lg text-left transition-colors hover:bg-gray-50 ${
                          isActive ? "bg-blue-50" : ""
                        }`}
                        title={section.title} // Add tooltip for mobile
                      >
                        <div 
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold mr-2 sm:mr-4 ${
                            isActive ? "bg-blue-600" : isCompleted ? "bg-green-500" : "bg-gray-400"
                          }`}
                        >
                          <span className="text-xs sm:text-sm">{section.displayId}</span>
                        </div>
                        <div className="flex-1 hidden md:block">
                          <div className={`font-medium text-sm ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                            {section.title}
                          </div>
                        </div>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-[1rem] sm:left-[1.25rem] md:left-[2rem] top-12 sm:top-16 w-0.5 h-3 sm:h-4 bg-gray-300 hidden md:block"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
            <div className="p-3 sm:p-4 md:p-6">
              <Card className="bg-white">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {renderSectionContent()}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      {/* Weight Warning Dialog */}
      {showWeightWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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