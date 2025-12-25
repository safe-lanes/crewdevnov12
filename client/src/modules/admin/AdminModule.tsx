import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditIcon, Plus, Eye, Grip, Check, ChevronsUpDown, Trash2, ChevronUp, ChevronDown, Settings, Filter, Archive, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { PromotionHierarchyDialog } from "@/components/dialogs/PromotionHierarchyDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form as FormComponent,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Form, RankGroup, AvailableRank, InsertMasterDataEntry, insertVesselGroupSchema } from "@shared/schema";
import { FormEditorFactory } from "@/components/FormEditorFactory";
import { formTemplates, createFormEditor } from "@/utils/formEditorGenerator";
import { apiRequest } from "@/lib/queryClient";
import { 
  useDataMasters, 
  useMasterDataEntries,
  useCreateDataMaster,
  useUpdateDataMaster,
  useDeleteDataMaster,
  useCreateMasterDataEntry,
  useUpdateMasterDataEntry,
  useDeleteMasterDataEntry 
} from "@/hooks/useDataMasters";
import { useRankMasterData, useCompanyRanks, useFetchCompanyRanks, useCreateRank, useUpdateRank, useDeleteRank, useClearAllRanks, useSaveCompanyRanks, useCreateVesselDraft, useUpdateVesselDraft, type RankMasterData } from "@/hooks/useCompanyRanks";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SideBarComponent from '../../components/Navbar/SideBarComponent';
import MainLayout from "@/components/main/MainLayout";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { 
  mapVesselDataToSafeFields, 
  mapSafeFieldsToVesselData, 
  isVesselMaster,
  getVesselMasterErrorMessage,
  filterToSafeFields,
  type VesselMasterEntry
} from "@/utils/vesselMasterMapping";
// Vessel option interface for dropdown
interface VesselOption {
  value: string;
  label: string;
  type?: 'vessel' | 'group';
  vesselIds?: string[];
}

import {
  mapPortDataToSafeFields,
  mapSafeFieldsToPortData,
  isPortMaster,
  getPortMasterErrorMessage,
  filterToPortSafeFields,
  type PortMasterEntry
} from "@/utils/portMasterMapping";
import { EditSessionProvider, useEditSession } from "@/contexts/EditSessionContext";
import { 
  useTrainingMasters, 
  useCreateTrainingMaster, 
  useUpdateTrainingMaster, 
  useDeleteTrainingMaster, 
  useReorderTrainingMasters,
  useReorderCompanyTrainings,
  useCompanyTrainingRequirements,
  useUpsertCompanyTrainingRequirements,
  getCategoryLabel,
  getGroupLabel,
  generateTrainingId,
  TRAINING_CATEGORIES,
  TRAINING_GROUPS
} from "@/hooks/useTrainingMaster";
import type { TrainingMaster, InsertTrainingMaster, UpdateTrainingMaster, CompanyTraining, CompanyTrainingRequirement } from "@shared/schema";
import { useExternalVesselTypes } from "@/hooks/useExternalVesselTypes";
import { useExternalVessels } from "@/hooks/useExternalVessels";
import { useExternalNationalities } from "@/hooks/useExternalNationalities";
import { useExternalFleetGroups } from "@/hooks/useExternalFleetGroups";
import { useExternalAdditionalGroups } from "@/hooks/useExternalAdditionalGroups";
import { useExternalPorts } from "@/hooks/useExternalPorts";
import { useExternalLanguages } from "@/hooks/useExternalLanguages";
import { useExternalCountries } from "@/hooks/useExternalCountries";

// StableInput component - uses local state to prevent value loss during re-renders
// This solves the issue where external API hook re-renders cause controlled inputs to lose their value
interface StableInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  "data-testid"?: string;
}

function StableInput({ value, onChange, className, placeholder, autoFocus, "data-testid": dataTestId }: StableInputProps) {
  // Use local state for immediate responsiveness
  const [localValue, setLocalValue] = useState(value);
  const isInternalChange = useRef(false);
  
  // Sync local state with external value changes (e.g., when switching entries or on mount)
  // But only if the change came from outside (not from typing)
  useEffect(() => {
    if (!isInternalChange.current) {
      setLocalValue(value);
    }
    isInternalChange.current = false;
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isInternalChange.current = true;
    setLocalValue(newValue);
    onChange(newValue);
  };
  
  return (
    <Input
      value={localValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      autoFocus={autoFocus}
      data-testid={dataTestId}
    />
  );
}

const rankGroupSchema = z.object({
  name: z.string().min(1, "Rank group name is required"),
  ranks: z.array(z.string()).min(1, "At least one rank must be selected"),
});

// New Training Dialog Component
interface NewTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertTrainingMaster) => Promise<void>;
  existingIds: string[];
  isLoading: boolean;
}

const newTrainingSchema = z.object({
  trainingName: z.string().min(1, "Training name is required"),
  category: z.string().min(1, "Category is required"),
  trainingGroup: z.string().min(1, "Group is required"),
  requirementReference: z.string().optional(),
  trainingLabel: z.string().optional(),
  applicableToCompany: z.boolean(),
});

function NewTrainingDialog({ open, onOpenChange, onSubmit, existingIds, isLoading }: NewTrainingDialogProps) {
  const form = useForm({
    resolver: zodResolver(newTrainingSchema),
    defaultValues: {
      trainingName: '',
      category: 'S',
      trainingGroup: 'A',
      requirementReference: '',
      trainingLabel: '',
      applicableToCompany: true,
    },
  });

  const watchCategory = form.watch('category');
  const watchGroup = form.watch('trainingGroup');
  
  const generatedId = useMemo(() => {
    return generateTrainingId(watchCategory, watchGroup, existingIds);
  }, [watchCategory, watchGroup, existingIds]);

  const handleSubmit = async (values: z.infer<typeof newTrainingSchema>) => {
    const data: InsertTrainingMaster = {
      trainingId: generatedId,
      trainingName: values.trainingName,
      category: values.category,
      trainingGroup: values.trainingGroup,
      requirementReference: values.requirementReference || null,
      trainingLabel: values.trainingLabel || null,
      applicableToCompany: values.applicableToCompany,
      sortOrder: 0,
      isDefault: false,
    };
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Training</DialogTitle>
          <DialogDescription>
            Create a new training record. ID will be auto-generated.
          </DialogDescription>
        </DialogHeader>
        <FormComponent {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Training ID</label>
                <Input 
                  value={generatedId} 
                  disabled 
                  className="h-8 text-xs font-mono bg-gray-100" 
                  data-testid="input-new-training-id"
                />
              </div>
              <FormField
                control={form.control}
                name="applicableToCompany"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end">
                    <div className="flex items-center gap-2 h-8">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-new-applicable-company"
                      />
                      <FormLabel className="text-xs">Applicable to Company</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="trainingName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Training Name *</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" data-testid="input-new-training-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-new-category">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRAINING_CATEGORIES.map(cat => (
                          <SelectItem key={cat.code} value={cat.code}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trainingGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Group *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-new-group">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRAINING_GROUPS.map(grp => (
                          <SelectItem key={grp.code} value={grp.code}>{grp.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requirementReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Requirement/Reference</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="e.g., STCW III/1" data-testid="input-new-requirement" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trainingLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Training Label</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-8 text-xs" placeholder="Short label for display" data-testid="input-new-label" />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                data-testid="button-cancel-new-training"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#5dc86f] hover:bg-[#22c55e] text-white"
                data-testid="button-submit-new-training"
              >
                {isLoading ? "Creating..." : "Create Training"}
              </Button>
            </DialogFooter>
          </form>
        </FormComponent>
      </DialogContent>
    </Dialog>
  );
}

// Configure Group Labels Dialog Component
interface ConfigureGroupLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyTrainingGroups: {code: string; label: string | null; displayOrder: number}[];
  onSave: (updates: {code: string; label: string | null}[]) => Promise<void>;
}

function ConfigureGroupLabelsDialog({ open, onOpenChange, companyTrainingGroups, onSave }: ConfigureGroupLabelsDialogProps) {
  const [localLabels, setLocalLabels] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const GROUP_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      GROUP_CODES.forEach(code => {
        const group = companyTrainingGroups.find(g => g.code === code);
        initial[code] = group?.label || '';
      });
      setLocalLabels(initial);
    }
  }, [open, companyTrainingGroups]);
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = GROUP_CODES.map(code => ({
        code,
        label: localLabels[code]?.trim() || null
      }));
      await onSave(updates);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Group Labels</DialogTitle>
          <DialogDescription>
            Define custom labels for each company group. Leave blank to show just the letter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
          {GROUP_CODES.map(code => (
            <div key={code} className="flex items-center gap-3">
              <span className="text-sm font-medium w-6">{code}.</span>
              <Input
                value={localLabels[code] || ''}
                onChange={(e) => setLocalLabels(prev => ({ ...prev, [code]: e.target.value }))}
                className="h-8 text-xs flex-1"
                placeholder={`Label for group ${code}`}
                data-testid={`input-group-label-${code}`}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-group-labels"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#16569e] hover:bg-[#0f4078] text-white"
            data-testid="button-save-group-labels"
          >
            {isSaving ? "Saving..." : "Save Labels"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Removed AG Grid CheckboxRenderer - using standard HTML checkbox components instead

// Removed AG Grid DeleteButtonRenderer - using standard HTML button components instead

// Note: RankMasterData interface moved to shared hook useCompanyRanks.ts

// Interface for Company Rank data
interface CompanyRankData {
  id: string;
  rank: string;
  rankId: string;
  role?: string; // Role name like "3rd Off_1", "3rd Off_2"
  parentId?: string; // ID of parent rank for role rows (deprecated)
  originalRankId?: string; // ID of original rank for role rows (replaces parentId)
  isRoleRow?: boolean; // True for role rows, false/undefined for regular rows
  applicableToCompany?: boolean; // Added to track Company applicability status
  officer: boolean;
  rating: boolean;
  seniorOfficer: boolean;
  deckOfficer: boolean;
  engOfficer: boolean;
  pettyOfficer: boolean;
  deckRating: boolean;
  engineRating: boolean;
  generalRating: boolean;
  cateringRating: boolean;
  safetyOfficer: boolean;
  sso: boolean;
  medicalOfficer: boolean;
  navigatingOfficer: boolean;
  emtOfficer: boolean;
  hasMultiple: boolean;
}

// Interface for Vessel Rank data (vessel-specific fields and overrides)
interface VesselRankData {
  id: string;
  rank: string;
  rankId: string;
  role?: string; // Role name like "3rd Off_1", "3rd Off_2"
  originalRankId?: string; // ID of original rank for role rows
  isRoleRow?: boolean; // True for role rows, false/undefined for regular rows
  // Vessel-specific manning fields
  actualManning: string[]; // Array of selected seafarer IDs
  actualManningFlag: boolean; // Checkbox indicator for actual manning
  safeManning: boolean; // Required as per vessel's Minimum Safe Manning Certificate
  optimumManning: boolean; // Company assessment beyond minimum safe manning
  highWorkloadManning: boolean; // Additional manning for special operations
  // Officer role overrides (default to Company tab but vessel can override)
  safetyOfficer: boolean;
  sso: boolean;
  medicalOfficer: boolean;
  navigatingOfficer: boolean;
  emtOfficer: boolean;
  hasMultiple: boolean;
}

// Interface for Seafarer data
interface SeafarerData {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  rank: string;
  nationality: string;
  status: 'Available' | 'Assigned' | 'On Leave';
}

// Inner AdminModule component (uses EditSessionContext)
const AdminModuleInner = (): JSX.Element => {
  const [location, navigate] = useLocation();
  const [selectedAdminPage, setSelectedAdminPage] = useState("forms");
  const [selectedRankAdminTab, setSelectedRankAdminTab] = useState("rank-master");
  const [selectedTrainingMatrixTab, setSelectedTrainingMatrixTab] = useState("training-master");
  const [isTrainingMasterEditing, setIsTrainingMasterEditing] = useState(false);
  const [showTrainingFilters, setShowTrainingFilters] = useState(true);
  const [trainingSearchFilter, setTrainingSearchFilter] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [editingRankGroup, setEditingRankGroup] = useState<string | null>(null);
  const [isAddRankGroupOpen, setIsAddRankGroupOpen] = useState(false);
  const [selectedFormForRankGroup, setSelectedFormForRankGroup] = useState<string | null>(null);
  const [editingRankGroupData, setEditingRankGroupData] = useState<RankGroup | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [pendingArchiveRankGroup, setPendingArchiveRankGroup] = useState<{id: number; name: string} | null>(null);
  const [showCreateFormDialog, setShowCreateFormDialog] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormCategory, setNewFormCategory] = useState<"appraisal" | "promotion">("appraisal");
  const [createFormType, setCreateFormType] = useState<"template" | "blank">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  
  // Rank Master data from shared hook (for initialization)
  // PERFORMANCE: Only fetch when on rank-admin tab
  const { data: sharedRankMasterData, isLoading: rankMasterLoading, error: rankMasterError } = useRankMasterData({ 
    enabled: selectedAdminPage === "rank-admin" 
  });
  // Fetch saved company rank data (including role variants)
  // STRATEGIC FIX: Use controlled refetch to prevent overwrites during editing
  // PERFORMANCE: Only fetch when on rank-admin tab
  const { data: savedCompanyRanks = [], isLoading: isCompanyRanksLoading, refetch: refetchCompanyRanks } = useFetchCompanyRanks({ 
    enabled: selectedAdminPage === "rank-admin" 
  });
  
  // Mutation hooks for rank management
  const createRankMutation = useCreateRank();
  const updateRankMutation = useUpdateRank();
  const deleteRankMutation = useDeleteRank();
  const saveCompanyRanksMutation = useSaveCompanyRanks();
  const clearAllRanksMutation = useClearAllRanks();
  const createVesselDraftMutation = useCreateVesselDraft();
  const updateVesselDraftMutation = useUpdateVesselDraft();
  
  // Rank reorder mutation
  const reorderRanksMutation = useMutation({
    mutationFn: async (rankOrders: Array<{ id: number; sortOrder: number }>) => {
      return apiRequest('POST', '/api/available-ranks/reorder', rankOrders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/available-ranks'] });
      toast({
        title: "Ranks reordered successfully",
        description: "The rank order has been updated.",
        duration: 3000,
      });
    },
    onError: (error) => {
      console.error('Failed to reorder ranks:', error);
      toast({
        title: "Failed to reorder ranks",
        description: "An error occurred while updating rank order.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });
  
  // Training Master data hooks
  const { data: trainingMasterData = [], isLoading: trainingMasterLoading } = useTrainingMasters({ 
    enabled: selectedAdminPage === "training-matrix" 
  });
  const createTrainingMutation = useCreateTrainingMaster();
  const updateTrainingMutation = useUpdateTrainingMaster();
  const deleteTrainingMutation = useDeleteTrainingMaster();
  const reorderTrainingMutation = useReorderTrainingMasters();
  
  // Training Master local state
  const [localTrainingData, setLocalTrainingData] = useState<TrainingMaster[]>([]);
  const [changedTrainings, setChangedTrainings] = useState<Set<number>>(new Set());
  const [showNewTrainingDialog, setShowNewTrainingDialog] = useState(false);
  const [showDeleteTrainingDialog, setShowDeleteTrainingDialog] = useState(false);
  const [trainingToDelete, setTrainingToDelete] = useState<TrainingMaster | null>(null);
  const [trainingCategoryFilter, setTrainingCategoryFilter] = useState<string>("all");
  const [trainingGroupFilter, setTrainingGroupFilter] = useState<string>("all");
  
  // Company Training tab state
  const [isCompanyTrainingEditing, setIsCompanyTrainingEditing] = useState(false);
  const [showCompanyTrainingFilters, setShowCompanyTrainingFilters] = useState(true);
  const [companyTrainingSearchFilter, setCompanyTrainingSearchFilter] = useState("");
  const [showNewCompanyTrainingDialog, setShowNewCompanyTrainingDialog] = useState(false);
  const [localCompanyTrainingData, setLocalCompanyTrainingData] = useState<CompanyTraining[]>([]);
  const [changedCompanyTrainings, setChangedCompanyTrainings] = useState<Set<number>>(new Set());
  const [showConfigureGroupLabelsDialog, setShowConfigureGroupLabelsDialog] = useState(false);
  
  // Company Training data hooks
  const { data: companyTrainingData = [], isLoading: companyTrainingLoading, refetch: refetchCompanyTrainings } = useQuery<CompanyTraining[]>({
    queryKey: ['/api/company-trainings'],
    enabled: selectedAdminPage === "training-matrix"
  });
  
  const { data: companyTrainingGroups = [], refetch: refetchCompanyTrainingGroups } = useQuery<{code: string; label: string | null; displayOrder: number}[]>({
    queryKey: ['/api/company-training-groups'],
    enabled: selectedAdminPage === "training-matrix"
  });
  
  const updateCompanyTrainingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CompanyTraining> }) => {
      return apiRequest('PATCH', `/api/company-trainings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-trainings'] });
    },
    onError: (error) => {
      console.error('Failed to update company training:', error);
      toast({
        title: "Update failed",
        description: "An error occurred while updating the training.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });
  
  const reorderCompanyTrainingMutation = useReorderCompanyTrainings();
  
  // Company Training Requirements (M/R matrix by rank)
  const { data: trainingRequirements = [], isLoading: requirementsLoading } = useCompanyTrainingRequirements();
  const upsertRequirementsMutation = useUpsertCompanyTrainingRequirements();
  const [localTrainingRequirements, setLocalTrainingRequirements] = useState<Map<string, 'M' | 'R' | null>>(new Map());
  const [changedRequirements, setChangedRequirements] = useState<Set<string>>(new Set());
  // Select All state: tracks whether "Select All M" or "Select All R" is checked per training
  const [selectAllState, setSelectAllState] = useState<Map<number, { M: boolean; R: boolean }>>(new Map());
  
  // Sync training requirements with local state
  useEffect(() => {
    if (trainingRequirements.length > 0 && !isCompanyTrainingEditing) {
      const reqMap = new Map<string, 'M' | 'R' | null>();
      trainingRequirements.forEach(req => {
        reqMap.set(`${req.companyTrainingId}-${req.rankId}`, req.status as 'M' | 'R' | null);
      });
      setLocalTrainingRequirements(reqMap);
      setChangedRequirements(new Set());
      setSelectAllState(new Map()); // Reset select all state when exiting edit mode
    }
  }, [trainingRequirements, isCompanyTrainingEditing]);
  
  // Sync company training data with local state
  useEffect(() => {
    if (companyTrainingData.length > 0 && !isCompanyTrainingEditing) {
      setLocalCompanyTrainingData(companyTrainingData);
      setChangedCompanyTrainings(new Set());
    }
  }, [companyTrainingData, isCompanyTrainingEditing]);
  
  // Sync training master data with local state
  useEffect(() => {
    if (trainingMasterData.length > 0 && !isTrainingMasterEditing) {
      setLocalTrainingData(trainingMasterData);
      setChangedTrainings(new Set());
    }
  }, [trainingMasterData, isTrainingMasterEditing]);
  
  // Local state for editing (initialized from shared data)
  const [rankMasterData, setRankMasterData] = useState<RankMasterData[]>([]);
  const [changedRanks, setChangedRanks] = useState<Set<string>>(new Set());
  const [newRanks, setNewRanks] = useState<Set<string>>(new Set());
  const [deletedRanks, setDeletedRanks] = useState<Set<string>>(new Set());
  
  // Use ref to track previous server data to prevent unnecessary re-syncs (stable ID-based)
  const prevServerDataKeyRef = useRef<string>('');
  
  // Sync local state with shared data while preserving unsaved changes
  useEffect(() => {
    if (!sharedRankMasterData || sharedRankMasterData.length === 0) return;
    
    // Don't sync if we're currently editing to avoid losing unsaved changes
    if (isRankMasterEditing || isCompanyEditing) {
      return;
    }
    
    // Skip if data hasn't actually changed (use stable IDs to prevent infinite loop from new object references)
    const currentDataKey = sharedRankMasterData.map(r => `${r.id}:${r.applicableToCompany}`).sort().join(',');
    if (prevServerDataKeyRef.current === currentDataKey) {
      return;
    }
    
    prevServerDataKeyRef.current = currentDataKey;
    const serverRankIds = new Set(sharedRankMasterData.map(rank => rank.id));
    
    setRankMasterData(prev => {
      // Preserve any new ranks that haven't been saved yet
      const currentNewRanks = Array.from(newRanks);
      const newUnsavedRanks = prev.filter(rank => 
        rank.id.startsWith('new_') && currentNewRanks.includes(rank.id)
      );
      
      // Merge server data with unsaved new ranks
      return [...sharedRankMasterData, ...newUnsavedRanks];
    });
    
    // Only clear tracking for ranks that now exist on server
    setChangedRanks(prev => {
      const filtered = Array.from(prev).filter(rankId => !serverRankIds.has(rankId));
      return filtered.length === prev.size ? prev : new Set(filtered);
    });
    
    // Keep new ranks that haven't been saved to server
    setNewRanks(prev => {
      const filtered = Array.from(prev).filter(rankId => !serverRankIds.has(rankId));
      return filtered.length === prev.size ? prev : new Set(filtered);
    });
  }, [sharedRankMasterData]);
  
  // Context callback functions for cell renderers
  const handleRankDataChange = (id: string, field: string, value: any) => {
    setRankMasterData(prev => {
      const newData = [...prev];
      const rowIndex = newData.findIndex(row => row.id === id);
      if (rowIndex !== -1) {
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        
        // Track changes for save functionality
        if (!id.startsWith('new_')) {
          setChangedRanks(prev => new Set(prev).add(id));
        }
      }
      return newData;
    });
  };

  const handleDeleteRankFromGrid = (id: string, rank: string) => {
    setRankToDelete({ id, name: rank });
    setShowDeleteConfirmDialog(true);
  };

  const [isRankMasterEditing, setIsRankMasterEditing] = useState(false);
  
  // Company state
  const [companyRankData, setCompanyRankData] = useState<CompanyRankData[]>([]);
  const [isCompanyEditing, setIsCompanyEditing] = useState(false);
  const [changedCompanyRanks, setChangedCompanyRanks] = useState<Set<string>>(new Set());
  
  // Company Ranks Form (React Hook Form integration)
  const companyForm = useForm<{ ranks: CompanyRankData[] }>({
    defaultValues: { ranks: [] },
    mode: 'onChange'
  });
  const { watch: watchCompany, setValue: setCompanyValue, reset: resetCompany } = companyForm;
  
  // Vessel state
  const [vesselRankDataMap, setVesselRankDataMap] = useState<Map<string, VesselRankData[]>>(new Map());
  const [isVesselEditing, setIsVesselEditing] = useState(false);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [nextRevision, setNextRevision] = useState<string>("R0"); // Auto-assigned next revision
  const [flexDate, setFlexDate] = useState("");
  const [revisionMode, setRevisionMode] = useState(false);
  
  // Training Matrix Vessel state (separate from Rank Admin Vessel)
  const [tmSelectedVessels, setTmSelectedVessels] = useState<string[]>([]);
  const [tmNextRevision, setTmNextRevision] = useState<string>("R0");
  const [tmFlexDate, setTmFlexDate] = useState("");
  const [tmRevisionMode, setTmRevisionMode] = useState(false);
  const [tmApplicableTrainings, setTmApplicableTrainings] = useState<Map<string, Set<number>>>(new Map()); // vesselId -> Set of applicable training IDs
  
  // Training Matrix Vessel revision queries - use queryFn with explicit URL
  const tmCurrentVesselId = tmSelectedVessels[0];
  const tmQueryEnabled = selectedAdminPage === "training-matrix" && selectedTrainingMatrixTab === "vessel" && !!tmCurrentVesselId;
  
  const { data: tmVesselRevisions = [] } = useQuery<any[]>({
    queryKey: ['tm-vessel-revisions', tmCurrentVesselId],
    queryFn: async ({ queryKey }) => {
      const vesselId = queryKey[1];
      if (!vesselId) return [];
      const res = await fetch(`/api/training-matrix-vessel-revisions/by-vessel/${vesselId}`);
      if (!res.ok) throw new Error('Failed to fetch revisions');
      return res.json();
    },
    enabled: tmQueryEnabled,
    staleTime: 0,
    refetchOnMount: 'always'
  });
  
  const { data: tmNextRevisionData } = useQuery<{ nextRevision: string; currentRevisionCount: number }>({
    queryKey: ['tm-next-revision', tmCurrentVesselId],
    queryFn: async ({ queryKey }) => {
      const vesselId = queryKey[1];
      if (!vesselId) return { nextRevision: 'R0', currentRevisionCount: 0 };
      const res = await fetch(`/api/training-matrix-vessel-revisions/next-revision/${vesselId}`);
      if (!res.ok) throw new Error('Failed to fetch next revision');
      return res.json();
    },
    enabled: tmQueryEnabled,
    staleTime: 0,
    refetchOnMount: 'always'
  });
  
  // Training Matrix Vessel draft query - use queryFn with explicit URL
  // API returns an array of drafts, we take the first one (should be only one per vessel)
  const { data: tmVesselDraft } = useQuery<{ id: number; vesselId: string; draftData: any; updatedAt: string } | null>({
    queryKey: ['tm-vessel-draft', tmCurrentVesselId],
    queryFn: async ({ queryKey }) => {
      const vesselId = queryKey[1];
      if (!vesselId) return null;
      const res = await fetch(`/api/training-matrix-vessel-drafts/by-vessel/${vesselId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch draft');
      }
      const drafts = await res.json();
      // API returns array, take first draft if exists
      if (Array.isArray(drafts) && drafts.length > 0) {
        const draft = drafts[0];
        // Parse draftData if it's a string
        if (typeof draft.draftData === 'string') {
          try {
            draft.draftData = JSON.parse(draft.draftData);
          } catch (e) {
            console.error('Failed to parse draftData:', e);
          }
        }
        return draft;
      }
      return null;
    },
    enabled: tmQueryEnabled,
    staleTime: 0,
    refetchOnMount: 'always'
  });
  
  // Update tmNextRevision when query data changes
  useEffect(() => {
    if (tmNextRevisionData?.nextRevision) {
      setTmNextRevision(tmNextRevisionData.nextRevision);
    }
  }, [tmNextRevisionData]);
  
  // Hydrate tmApplicableTrainings from draft or latest revision when vessel changes or data loads
  useEffect(() => {
    if (!tmCurrentVesselId) {
      return;
    }
    
    const vesselId = tmCurrentVesselId;
    const applicableSet = new Set<number>();
    
    // Priority: draft data first, then latest revision
    let sourceData: any = null;
    if (tmVesselDraft?.draftData) {
      sourceData = tmVesselDraft.draftData;
    } else if (tmVesselRevisions.length > 0) {
      // Get the latest revision - copy array to avoid mutating cache
      const sortedRevisions = [...tmVesselRevisions].sort((a: any, b: any) => {
        // Use 'revision' field (e.g., "R0", "R1") not 'revisionNumber'
        const aNum = parseInt((a.revision || '').replace('R', '') || '0');
        const bNum = parseInt((b.revision || '').replace('R', '') || '0');
        return bNum - aNum;
      });
      // Parse revisionData if it's a JSON string
      let revData = sortedRevisions[0]?.revisionData;
      if (typeof revData === 'string') {
        try {
          revData = JSON.parse(revData);
        } catch (e) {
          console.error('Failed to parse revisionData:', e);
        }
      }
      sourceData = revData;
    }
    
    // Parse the source data - supports multiple formats for compatibility
    if (sourceData) {
      if (Array.isArray(sourceData)) {
        // Direct array of training IDs (new format)
        sourceData.forEach((id: number) => {
          if (typeof id === 'number') {
            applicableSet.add(id);
          }
        });
      } else if (sourceData.applicableTrainingIds && Array.isArray(sourceData.applicableTrainingIds)) {
        // Object format with applicableTrainingIds (new format)
        sourceData.applicableTrainingIds.forEach((id: number) => {
          if (typeof id === 'number') {
            applicableSet.add(id);
          }
        });
      } else if (typeof sourceData === 'object' && !Array.isArray(sourceData)) {
        // Legacy format: object with trainingId keys and M/R values
        // Any training with an M or R value is considered "applicable"
        Object.entries(sourceData).forEach(([key, value]) => {
          const trainingId = parseInt(key);
          if (!isNaN(trainingId) && (value === 'M' || value === 'R' || value === true)) {
            applicableSet.add(trainingId);
          }
        });
      }
    }
    
    // Always update state for this vessel (even if empty - clears stale data)
    setTmApplicableTrainings(prev => {
      const newMap = new Map(prev);
      newMap.set(vesselId, applicableSet);
      return newMap;
    });
  }, [tmCurrentVesselId, tmVesselDraft, tmVesselRevisions]);
  
  // Training Matrix Vessel Draft mutations
  const tmSaveDraftMutation = useMutation({
    mutationFn: async ({ vesselId, draftData }: { vesselId: string; draftData: any }) => {
      return apiRequest('POST', '/api/training-matrix-vessel-drafts/upsert', { vesselId, draftData });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Draft saved",
        description: "Training matrix draft saved successfully.",
        duration: 3000,
      });
      // Invalidate draft query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['tm-vessel-draft', variables.vesselId] });
    },
    onError: (error: any) => {
      console.error('Failed to save training matrix draft:', error);
      toast({
        title: "Save failed",
        description: "Failed to save training matrix draft.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });
  
  const tmSubmitRevisionMutation = useMutation({
    mutationFn: async ({ vesselId, revisionDate, revisionData }: { vesselId: string; revisionDate: string; revisionData: any }) => {
      return apiRequest('POST', '/api/training-matrix-vessel-revisions/submit', { vesselId, revisionDate, revisionData });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Revision submitted",
        description: "Training matrix revision submitted successfully.",
        duration: 3000,
      });
      setTmRevisionMode(false);
      // Invalidate all training matrix queries for this vessel using predicate for robust matching
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key) || key.length < 2) return false;
          const prefix = key[0] as string;
          const vesselId = key[1];
          return (
            (prefix === 'tm-vessel-revisions' || prefix === 'tm-next-revision' || prefix === 'tm-vessel-draft') &&
            vesselId === variables.vesselId
          );
        }
      });
    },
    onError: (error: any) => {
      console.error('Failed to submit training matrix revision:', error);
      toast({
        title: "Submit failed",
        description: "Failed to submit training matrix revision.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });
  
  // Track which vessels have been loaded to prevent duplicate fetches
  const loadedVesselsRef = React.useRef<Set<string>>(new Set());
  
  // PERFORMANCE FIX: Track previous data to prevent infinite loops
  // Only sync when data actually changes (not just reference)
  const prevVesselOptionsRef = React.useRef<string>('');
  const prevCompanyRankSyncRef = React.useRef<string>('');
  
  // FIX: Gate initial sync to prevent render loop during first mount
  const isInitialSyncCompleted = React.useRef(false);
  
  // PERFORMANCE OPTIMIZATION: Only build lookup for the CURRENT vessel being displayed
  // This avoids rebuilding Maps for all vessels on every checkbox click
  const currentVesselRankLookup = useMemo(() => {
    const currentVesselData = selectedVessels.length > 0 
      ? vesselRankDataMap.get(selectedVessels[0]) || []
      : [];
    
    return new Map(currentVesselData.map(rank => [rank.id, rank]));
  }, [vesselRankDataMap, selectedVessels]);
  
  // Data Masters state
  const [searchDataMaster, setSearchDataMaster] = useState("");
  const [selectedMaster, setSelectedMaster] = useState<string>("001");
  
  // Vessel Group Modal state
  const [isVesselGroupModalOpen, setIsVesselGroupModalOpen] = useState(false);
  
  // Promotion Hierarchy Dialog state
  const [isPromotionHierarchyOpen, setIsPromotionHierarchyOpen] = useState(false);
  
  // Vessel Group Form setup
  const vesselGroupForm = useForm({
    resolver: zodResolver(insertVesselGroupSchema.extend({
      vesselIds: z.array(z.string()).min(1, "Please select at least one vessel")
    })),
    defaultValues: {
      name: "",
      vesselIds: [] as string[]
    }
  });

  // Vessel Group Mutation
  const createVesselGroupMutation = useMutation({
    mutationFn: async (data: { name: string; vesselIds: string[] }) => {
      return await apiRequest('POST', '/api/vessel-groups', data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vessel group created successfully",
      });
      setIsVesselGroupModalOpen(false);
      vesselGroupForm.reset();
      // Invalidate vessel group queries if needed
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-groups'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create vessel group",
        variant: "destructive",
      });
    }
  });
  
  // Unsaved changes dialog state
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  
  // Delete confirmation dialog state
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [rankToDelete, setRankToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Dialog handler functions
  const handleSaveChanges = async () => {
    try {
      // Store pendingTarget before resolving navigation
      const currentPendingTarget = pendingTarget;
      await resolvePendingNavigation('save');
      setShowUnsavedChangesDialog(false);
      
      // Handle rank admin tab switching after save
      if (currentPendingTarget && currentPendingTarget.startsWith('rank-admin-tab-')) {
        const tabId = currentPendingTarget.replace('rank-admin-tab-', '');
        setSelectedRankAdminTab(tabId);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [UNSAVED_CHANGES] Failed to save changes:', error);
      }
      // Keep dialog open on error
    }
  };
  
  const handleDiscardChanges = async () => {
    try {
      // Store pendingTarget before resolving navigation
      const currentPendingTarget = pendingTarget;
      await resolvePendingNavigation('discard');
      setShowUnsavedChangesDialog(false);
      
      // Handle rank admin tab switching after discard
      if (currentPendingTarget && currentPendingTarget.startsWith('rank-admin-tab-')) {
        const tabId = currentPendingTarget.replace('rank-admin-tab-', '');
        setSelectedRankAdminTab(tabId);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [UNSAVED_CHANGES] Failed to discard changes:', error);
      }
    }
  };
  
  const handleCancelNavigation = () => {
    resolvePendingNavigation('cancel');
    setShowUnsavedChangesDialog(false);
  };
  
  // Delete rank handlers
  const handleDeleteRankClick = (rankId: string, rankName: string) => {
    setRankToDelete({ id: rankId, name: rankName });
    setShowDeleteConfirmDialog(true);
  };
  
  const handleConfirmDeleteRank = async () => {
    if (!rankToDelete) return;
    
    try {
      // Check if this is a new rank that hasn't been saved to server yet
      if (rankToDelete.id.startsWith('new_')) {
        // Handle new rank deletion locally - no server call needed
        setRankMasterData(prev => prev.filter(rank => rank.id !== rankToDelete.id));
        setNewRanks(prev => {
          const newSet = new Set(prev);
          newSet.delete(rankToDelete.id);
          return newSet;
        });
        
        toast({
          title: "Rank deleted successfully",
          description: `${rankToDelete.name} has been removed.`,
          duration: 3000,
        });
        
        setShowDeleteConfirmDialog(false);
        setRankToDelete(null);
        return;
      }
      
      // Convert string ID to number for the API call (existing ranks only)
      const numericId = parseInt(rankToDelete.id, 10);
      if (isNaN(numericId)) {
        throw new Error('Invalid rank ID');
      }
      
      await deleteRankMutation.mutateAsync(numericId);
      
      toast({
        title: "Rank deleted successfully",
        description: `${rankToDelete.name} has been removed from the system.`,
        duration: 3000,
      });
      
      setShowDeleteConfirmDialog(false);
      setRankToDelete(null);
    } catch (error) {
      console.error('Failed to delete rank:', error);
      
      // Handle specific error types
      let errorMessage = "An unexpected error occurred. Please try again.";
      let additionalAction = "";
      
      if (error instanceof Error) {
        // Check if it's a 404 error (rank not found)
        if (error.message.includes('404') || error.message.includes('not found') || error.message.includes('Rank not found')) {
          errorMessage = `Rank "${rankToDelete.name}" no longer exists in the database. This may be due to stale cache data.`;
          additionalAction = "The rank list will be refreshed to show current data.";
          
          // Force refresh the rank data to clear stale cache
          rq.invalidateQueries({ queryKey: ["/api/available-ranks"] });
          
          // Also clear the local state to remove stale entries
          setRankMasterData(prev => prev.filter(rank => rank.id !== rankToDelete.id));
          setDeletedRanks(prev => {
            const newSet = new Set(prev);
            newSet.delete(rankToDelete.id);
            return newSet;
          });
          
          // Close the dialog since the rank doesn't exist anyway
          setShowDeleteConfirmDialog(false);
          setRankToDelete(null);
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Failed to delete rank",
        description: `${errorMessage}${additionalAction ? ` ${additionalAction}` : ''}`,
        variant: "destructive",
        duration: 6000,
      });
    }
  };
  
  const handleCancelDeleteRank = () => {
    setShowDeleteConfirmDialog(false);
    setRankToDelete(null);
  };
  
  // CSS Constants for consistent grid layouts
  const USERS_MASTER_GRID_CLASSES = "grid grid-cols-5 gap-0";

  

  // Data Masters API hooks
  // PERFORMANCE: Only fetch when on masters tab
  const { data: mastersList = [], isLoading: mastersLoading, error: mastersError } = useDataMasters({ 
    enabled: selectedAdminPage === "masters" 
  });
  
  // PERFORMANCE: Removed debug logging to avoid re-renders on every masters change
  
  // Function to force refresh masters data
  const refreshMastersData = () => {
    if (import.meta.env.DEV) {
      console.log('🔄 [REFRESH] Clearing masters cache and refetching...');
    }
    rq.invalidateQueries({ queryKey: ['/api/masters'] });
  };
  
  // Function to navigate directly to Port Master
  const navigateToPortMaster = () => {
    if (import.meta.env.DEV) {
      console.log('🚢 [NAVIGATION] Navigating to Port Master (018)...');
    }
    setSelectedAdminPage('masters');
    setSelectedMaster('018');
    // Use wouter's navigate for proper routing
    navigate('/admin/masters/018');
  };
  const { data: rawMasterData = [], isLoading: masterDataLoading, error: masterDataError } = useMasterDataEntries(selectedMaster);
  
  // Apply vessel/port master field mapping if needed
  // PERFORMANCE: Only transform when on masters tab to avoid expensive map operations on every render
  const masterData = useMemo(() => {
    if (selectedAdminPage !== "masters") return [];
    if (isVesselMaster(selectedMaster)) {
      return rawMasterData.map((item: any) => mapSafeFieldsToVesselData(item));
    }
    if (isPortMaster(selectedMaster)) {
      return rawMasterData.map((item: any) => mapSafeFieldsToPortData(item));
    }
    return rawMasterData;
  }, [rawMasterData, selectedMaster, selectedAdminPage]);
  
  // Vessel Type Master Data (for vessel master dropdown)
  // COMMENTED OUT: Using external API instead
  // const { data: vesselTypeData = [], isLoading: vesselTypeLoading } = useMasterDataEntries('004', { 
  //   enabled: selectedAdminPage === "masters" 
  // });
  
  // NEW: External vessel type data from API
  const { 
    data: externalVesselTypeData, 
    isLoading: vesselTypeLoading,
    error: vesselTypeError 
  } = useExternalVesselTypes();
  
  // Process external API response structure - hooks now return arrays directly
  // Also handle legacy wrapper format for backwards compatibility
  const vesselTypeData = Array.isArray(externalVesselTypeData) 
    ? externalVesselTypeData 
    : (externalVesselTypeData as any)?.vesseltypes || [];
  
  // Add debug logging
  if (import.meta.env.DEV) {
    console.log('🔧 [External Vessel Types] Processed Data:', vesselTypeData);
  }
  
  // Designation Master Data (for users master dropdown)
  // PERFORMANCE: Only fetch when on masters tab
  const { data: designationData = [], isLoading: designationLoading } = useMasterDataEntries('012', { 
    enabled: selectedAdminPage === "masters" 
  });
  
  // Vessels Master Data (for vessel selection dropdown - ID 014)
  // COMMENTED OUT: Using external API instead
  // const { data: vesselMasterData = [], isLoading: vesselMasterLoading } = useMasterDataEntries('014', { 
  //   enabled: selectedAdminPage === "masters" || selectedAdminPage === "rank-admin"
  // });
  
  // NEW: External vessel master data from API
  const { 
    data: externalVesselMasterData, 
    isLoading: vesselMasterLoading,
    error: vesselMasterError 
  } = useExternalVessels();
  
  // Process external API response structure - hooks now return arrays directly
  // Also handle legacy wrapper format for backwards compatibility
  const vesselMasterData = Array.isArray(externalVesselMasterData) 
    ? externalVesselMasterData 
    : (externalVesselMasterData as any)?.vessels || [];
  
  // Add debug logging
  if (import.meta.env.DEV) {
    console.log('🚢 [External Vessels] Processed Data:', vesselMasterData);
  }
  
  // NEW: External nationality data from API
  const { 
    data: externalNationalityData, 
    isLoading: nationalityLoading,
    error: nationalityError 
  } = useExternalNationalities();
  
  // Process external API response structure - hooks now return arrays directly
  // Also handle legacy wrapper format for backwards compatibility
  const nationalityData = Array.isArray(externalNationalityData) 
    ? externalNationalityData 
    : (externalNationalityData as any)?.nationalities || [];
  
  // Add debug logging
  if (import.meta.env.DEV) {
    console.log('🌍 [External Nationalities] Processed Data:', nationalityData);
  }
  
  // NEW: External fleet groups data from API
  const { 
    data: externalFleetGroupsData, 
    isLoading: fleetGroupsLoading, 
    error: fleetGroupsError 
  } = useExternalFleetGroups();
  
  // Process external API response structure (cast to any to handle dynamic API response)
  const fleetGroupsData = (externalFleetGroupsData as any)?.fleetGroups || [];
  
  // Add debug logging
  if (import.meta.env.DEV) {
    console.log('🚢 [External Fleet Groups] Processed Data:', fleetGroupsData);
  }
  
  // NEW: External additional groups data from API (Master 017)
  const {
    data: externalAdditionalGroupsData,
    isLoading: additionalGroupsLoading,
    error: additionalGroupsError,
  } = useExternalAdditionalGroups();
  
  // Process response - some APIs return an object with `additionalGroups`, others return array directly
  const additionalGroupsData = (externalAdditionalGroupsData as any)?.additionalGroups || externalAdditionalGroupsData || [];
  
  // Add debug logging (development only)
  if (import.meta.env.DEV) {
    console.log('🧩 [External Additional Groups] Processed Data:', additionalGroupsData);
  }
  
  // NEW: External ports data from API (Master 018)
  const {
    data: externalPortsData,
    isLoading: portsLoading,
    error: portsError,
  } = useExternalPorts();
  
  // Process response - some APIs return an object with `ports`, others return array directly
  const portsData = (externalPortsData as any)?.ports || externalPortsData || [];
  
  // Add debug logging (development only)
  if (import.meta.env.DEV) {
    console.log('⚓ [External Ports] Processed Data:', portsData);
  }
  
  // NEW: External languages data from API (Master 019)
  const {
    data: externalLanguagesData,
    isLoading: languagesLoading,
    error: languagesError,
  } = useExternalLanguages();
  
  // Process external API response structure - hooks now return arrays directly
  // Also handle legacy wrapper format for backwards compatibility
  const languagesData = Array.isArray(externalLanguagesData) 
    ? externalLanguagesData 
    : (externalLanguagesData as any)?.languages || [];
  
  // Add debug logging (development only)
  if (import.meta.env.DEV) {
    console.log('🗣️ [External Languages] Processed Data:', languagesData);
  }
  
  // NEW: External countries data from API (Master 020)
  const {
    data: externalCountriesData,
    isLoading: countriesLoading,
    error: countriesError,
  } = useExternalCountries();
  
  // Process external API response structure - hooks now return arrays directly
  // Also handle legacy wrapper format for backwards compatibility
  const countriesData = Array.isArray(externalCountriesData) 
    ? externalCountriesData 
    : (externalCountriesData as any)?.countries || [];
  
  // Add debug logging (development only)
  if (import.meta.env.DEV) {
    console.log('🌍 [External Countries] Processed Data:', countriesData);
  }
  
  // Vessel Groups Data (for vessel group selection)
  // PERFORMANCE: Only fetch when on masters or rank-admin tab (Rank Admin needs vessel dropdown)
  const { data: vesselGroupsData = [], isLoading: vesselGroupsLoading } = useQuery({
    queryKey: ['/api/vessel-groups'],
    enabled: selectedAdminPage === "masters" || selectedAdminPage === "rank-admin"
  });
  
  // Mutations for Data Masters
  const createMasterMutation = useCreateDataMaster();
  const updateMasterMutation = useUpdateDataMaster(selectedMaster);
  const deleteMasterMutation = useDeleteDataMaster();
  
  // Toast for notifications
  const { toast } = useToast();

  // Mutations for Master Data Entries
  const createEntryMutation = useCreateMasterDataEntry(selectedMaster);
  const updateEntryMutation = useUpdateMasterDataEntry();
  const deleteEntryMutation = useDeleteMasterDataEntry(selectedMaster);
  
  // Responsive breakpoint detection
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  // Breakpoint thresholds
  const breakpoints = {
    mobile: 768,
    tablet: 1024,
    laptop: 1200
  };
  
  // Current breakpoint detection
  const currentBreakpoint = useMemo(() => {
    if (windowWidth >= breakpoints.laptop) return 'desktop';
    if (windowWidth >= breakpoints.tablet) return 'laptop';  
    if (windowWidth >= breakpoints.mobile) return 'tablet';
    return 'mobile';
  }, [windowWidth]);
  
  // Window resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // URL parsing and routing handler
  useEffect(() => {
    console.log('🔗 [ROUTING] Location changed:', location);
    
    // Parse the URL path to extract admin page and parameters
    const path = location.replace(/^\//, ''); // Remove leading slash
    const pathParts = path.split('/');
    
    console.log('🔗 [ROUTING] Path parts:', pathParts);
    
    if (pathParts[0] === 'admin') {
      if (pathParts.length === 1) {
        // /admin - show default page (forms)
        console.log('🔗 [ROUTING] Default admin page - showing forms');
        setSelectedAdminPage('forms');
      } else if (pathParts[1] === 'masters' && pathParts[2]) {
        // /admin/masters/018 - show masters page with specific master
        const masterId = pathParts[2];
        console.log('🔗 [ROUTING] Masters page with master ID:', masterId);
        setSelectedAdminPage('masters');
        setSelectedMaster(masterId);
      } else if (pathParts[1] === 'masters') {
        // /admin/masters - show masters page with default master
        console.log('🔗 [ROUTING] Masters page with default master');
        setSelectedAdminPage('masters');
        setSelectedMaster('001'); // Default to first master
      } else if (pathParts[1] === 'forms') {
        // /admin/forms - show forms page
        console.log('🔗 [ROUTING] Forms page');
        setSelectedAdminPage('forms');
      } else if (pathParts[1] === 'rank-admin') {
        // /admin/rank-admin - show rank admin page
        console.log('🔗 [ROUTING] Rank admin page');
        setSelectedAdminPage('rank-admin');
      } else {
        // Unknown admin path - default to forms
        console.log('🔗 [ROUTING] Unknown admin path, defaulting to forms');
        setSelectedAdminPage('forms');
      }
    }
  }, [location]);
  
  // Responsive configuration
  const responsiveConfig = useMemo(() => ({
    mobile: {
      gridHeight: '300px',
      maxGridHeight: '300px',
      showSidebar: false,
      showExport: false,
      compactMode: true,
      stackButtons: true,
      headerColumns: 1,
      maxVisibleColumns: 3
    },
    tablet: {
      gridHeight: '400px', 
      maxGridHeight: '400px',
      showSidebar: false,
      showExport: false,
      compactMode: true,
      stackButtons: false,
      headerColumns: 2,
      maxVisibleColumns: 6
    },
    laptop: {
      gridHeight: '500px',
      maxGridHeight: '500px',
      showSidebar: true,
      showExport: true,
      compactMode: false,
      stackButtons: false,
      headerColumns: 3,
      maxVisibleColumns: 8
    },
    desktop: {
      gridHeight: '600px',
      maxGridHeight: '600px', 
      showSidebar: true,
      showExport: true,
      compactMode: false,
      stackButtons: false,
      headerColumns: 3,
      maxVisibleColumns: 12
    }
  }), []);
  
  // Current responsive settings
  const responsive = responsiveConfig[currentBreakpoint];
  
  // Current vessel rank data (derived from selected vessels)
  const vesselRankData = selectedVessels.length > 0 
    ? vesselRankDataMap.get(selectedVessels[0]) || []
    : [];

  // Helper function to update vessel rank data for selected vessels
  // PERFORMANCE: Removed expensive validation from hot path to prevent browser freezing
  const updateVesselRankData = (updater: (current: VesselRankData[]) => VesselRankData[]) => {
    if (!selectedVessels || selectedVessels.length === 0) {
      return;
    }

    setVesselRankDataMap(prev => {
      const newMap = new Map(prev);
      
      selectedVessels.forEach(vesselId => {
        const currentData = newMap.get(vesselId) || [];
        const updatedData = updater(currentData);
        newMap.set(vesselId, updatedData);
      });
      
      return newMap;
    });
  };
  
  // Sample seafarer data
  const [seafarerData] = useState<SeafarerData[]>([
    { id: "SF001", firstName: "John", lastName: "Smith", rank: "Master", nationality: "Philippines", status: "Available" },
    { id: "SF002", firstName: "Maria", lastName: "Garcia", rank: "Chief Officer", nationality: "Philippines", status: "Available" },
    { id: "SF003", firstName: "Ahmed", lastName: "Hassan", rank: "Chief Officer", nationality: "Egypt", status: "Available" },
    { id: "SF004", firstName: "Carlos", lastName: "Rodriguez", rank: "2nd Officer", nationality: "Mexico", status: "Available" },
    { id: "SF005", firstName: "Raj", lastName: "Patel", rank: "2nd Officer", nationality: "India", status: "Available" },
    { id: "SF006", firstName: "Kim", lastName: "Lee", rank: "3rd Officer", nationality: "South Korea", status: "Available" },
    { id: "SF007", firstName: "Michael", lastName: "Johnson", rank: "3rd Officer", nationality: "USA", status: "Available" },
    { id: "SF008", firstName: "Ali", lastName: "Mohammad", rank: "3rd Officer", nationality: "Pakistan", status: "Available" },
    { id: "SF009", firstName: "Jose", lastName: "Santos", rank: "Deck Cadet", nationality: "Philippines", status: "Available" },
    { id: "SF010", firstName: "Robert", lastName: "Chen", rank: "Chief Engineer", nationality: "China", status: "Available" },
  ]);
  
  // Dynamic vessel data from Vessels Master (ID 014) and Vessel Groups
  const vesselOptions = useMemo((): VesselOption[] => {
    // Individual vessels from master data
    const individualVessels = vesselMasterData.map((vessel: any): VesselOption => {
      // Detect data source: external API has 'vessel' field, local DB has 'name' field
      // Only apply mapSafeFieldsToVesselData for local DB data
      const isExternalData = !!vessel.vessel || !!vessel.vuid;
      const mappedVessel = isExternalData ? vessel : mapSafeFieldsToVesselData(vessel);
      
      // CRITICAL FIX: Use canonical vessel ID (entryId/VSL-XXX format) for value
      // This ensures Rank Admin saves data with the correct vessel identifier
      const vesselValue = vessel.entryId || vessel.vuid || `VSL-${String(vessel.id).padStart(3, '0')}`;
      
      // Ensure we have a consistent label field for display
      // External API uses 'vessel', local DB uses 'name' (mapped to 'vessel' by mapSafeFieldsToVesselData)
      const vesselLabel = vessel.vessel || mappedVessel.vessel || vessel.name || `Vessel ${vesselValue}`;
      
      return {
        value: String(vesselValue), // Use canonical vessel ID (VSL-XXX)
        label: `🚢 ${String(vesselLabel)}`, // Individual vessel with ship icon
        type: 'vessel'
      };
    });
    
    // Vessel groups from API
    const vesselGroups = (vesselGroupsData as any[]).map((group: any): VesselOption => ({
      value: `group_${group.id}`,
      label: `📁 ${group.name}`, // Vessel group with folder icon  
      type: 'group',
      vesselIds: group.vesselIds
    }));
    
    // Combine groups first (at top), then individual vessels
    return [...vesselGroups, ...individualVessels];
  }, [vesselMasterData, vesselGroupsData]);
  
  const rq = useQueryClient();


  // Sync company rank data with rank master data (only show ranks where applicableToCompany is true)
  React.useEffect(() => {
    // Don't update if we're currently editing to avoid losing unsaved changes
    if (isCompanyEditing || isRankMasterEditing) {
      return;
    }
    
    // Don't run until queries have fully resolved (prevents initial render loop)
    if (isCompanyRanksLoading || rankMasterLoading) {
      return;
    }
    
    // Only show ranks that have applicableToCompany checked in Rank Master
    const allRanks = rankMasterData.filter(rank => rank.applicableToCompany === true);
    
    // Don't run if no applicable ranks
    if (allRanks.length === 0) {
      return;
    }
    
    // PERFORMANCE FIX: Only sync if data actually changed (prevent infinite loops)
    // Use stable IDs instead of full objects to prevent new array references from triggering re-syncs
    const allRankIds = allRanks.map(r => r.id).sort().join(',');
    const savedRankIds = savedCompanyRanks.map(r => r.id).sort().join(',');
    const syncKey = `${allRankIds}:${savedRankIds}`;
    if (prevCompanyRankSyncRef.current === syncKey && isInitialSyncCompleted.current) {
      return; // No change and initial sync done, skip sync
    }
    prevCompanyRankSyncRef.current = syncKey;
    
    console.log('🔍 [DEBUG] Syncing company rank data with rank master', {
      allRanksCount: allRanks.length,
      savedCompanyRanksCount: savedCompanyRanks.length
    });
    
    // Create a map of existing company data from saved backend data
    const existingCompanyData = new Map<string, CompanyRankData>();
    savedCompanyRanks.forEach(item => {
      existingCompanyData.set(item.id, item);
    });
    
    // Preserve existing role variants from saved data (only if their parent rank is applicable)
    // Build a set of applicable rank IDs to filter variants
    const applicableRankIds = new Set(allRanks.map(r => r.id));
    const existingRoleVariants = savedCompanyRanks.filter(item => {
      if (!item.isRoleRow) return false;
      // Only keep role variants whose parent is in the applicable ranks list
      const parentId = item.originalRankId || item.parentId || item.id;
      return applicableRankIds.has(parentId);
    });
    
    // Build the new company rank data from ALL ranks
    const newCompanyRanks: CompanyRankData[] = allRanks.map(rank => {
      const existing = existingCompanyData.get(rank.id);
      
      // If we have existing data, preserve company-specific fields
      if (existing) {
        return {
          ...existing,
          // Update core rank fields from rank master
          rank: rank.label || rank.rank,
          rankId: rank.rankId,
          // Fix hasMultiple for existing Master rows - all ranks should have Multiple button
          hasMultiple: existing.isRoleRow ? false : true,
        };
      }
      
      // For new ranks, create default company data with NO auto-detection
      // User must manually select officer/rating checkboxes
      // (Starter pack ranks have flags pre-set via database migration)
      return {
        id: rank.id,
        rank: rank.label || rank.rank,
        rankId: rank.rankId,
        officer: false,
        rating: false,
        seniorOfficer: false,
        deckOfficer: false,
        engOfficer: false,
        pettyOfficer: false,
        deckRating: false,
        engineRating: false,
        generalRating: false,
        cateringRating: false,
        safetyOfficer: false,
        sso: false,
        medicalOfficer: false,
        navigatingOfficer: false,
        emtOfficer: false,
        hasMultiple: true // All ranks can have role variants including Master
      };
    });
    
    // Properly insert role variants after their parent ranks to maintain hierarchy
    const finalCompanyRanks: CompanyRankData[] = [];
    
    // Group role variants by their original rank ID (with fallbacks for legacy data)
    const roleVariantsByOriginal = new Map<string, CompanyRankData[]>();
    const unmatchedVariants: CompanyRankData[] = [];
    
    existingRoleVariants.forEach(variant => {
      // Use originalRankId, then legacy parentId, then variant's own id as fallback
      const originalId = variant.originalRankId || variant.parentId || variant.id;
      
      // Check if we have a matching parent rank in newCompanyRanks
      const hasMatchingParent = newCompanyRanks.some(rank => rank.id === originalId);
      
      if (hasMatchingParent) {
        if (!roleVariantsByOriginal.has(originalId)) {
          roleVariantsByOriginal.set(originalId, []);
        }
        roleVariantsByOriginal.get(originalId)!.push(variant);
      } else {
        // Variant with no matching parent - collect for safety append
        console.warn('🚨 [RANK_ORDER] Found role variant without matching parent:', {
          variantId: variant.id,
          variantRole: variant.role,
          expectedParentId: originalId,
          availableParentIds: newCompanyRanks.map(r => r.id)
        });
        unmatchedVariants.push(variant);
      }
    });
    
    // Sort role variants within each group by their numeric suffix
    roleVariantsByOriginal.forEach((variants) => {
      variants.sort((a, b) => {
        const aNum = parseInt(a.role?.match(/_(\d+)$/)?.[1] || '0', 10);
        const bNum = parseInt(b.role?.match(/_(\d+)$/)?.[1] || '0', 10);
        return aNum - bNum;
      });
    });
    
    // Insert each rank followed by its role variants (if any) to maintain hierarchy
    newCompanyRanks.forEach(rank => {
      finalCompanyRanks.push(rank);
      
      // Add role variants for this rank immediately after it
      const variants = roleVariantsByOriginal.get(rank.id);
      if (variants) {
        finalCompanyRanks.push(...variants);
      }
    });
    
    // Append any unmatched variants at the end to prevent data loss
    if (unmatchedVariants.length > 0) {
      console.warn('🚨 [RANK_ORDER] Appending unmatched role variants at end to prevent data loss:', unmatchedVariants.length);
      finalCompanyRanks.push(...unmatchedVariants);
    }
    
    // Only update if there's a meaningful change
    if (JSON.stringify(companyRankData) !== JSON.stringify(finalCompanyRanks)) {
      console.log('🔍 [DEBUG] Updating company rank data with role variants preserved');
      setCompanyRankData(finalCompanyRanks);
    }
    
    // Mark initial sync as complete to prevent re-running on same data
    isInitialSyncCompleted.current = true;
  }, [rankMasterData, savedCompanyRanks, isCompanyEditing, isCompanyRanksLoading, rankMasterLoading, isRankMasterEditing]);

  // Sync vessel rank data with company rank data changes for all vessels
  React.useEffect(() => {
    // Don't sync if companyRankData is empty (initial state)
    if (companyRankData.length === 0 || vesselOptions.length === 0) return;

    // PERFORMANCE FIX: Only sync if vesselOptions actually changed (prevent infinite loops)
    const vesselOptionsKey = JSON.stringify(vesselOptions);
    if (prevVesselOptionsRef.current === vesselOptionsKey) {
      return; // No change, skip sync
    }
    prevVesselOptionsRef.current = vesselOptionsKey;

    setVesselRankDataMap(prev => {
      const newMap = new Map();
      
      vesselOptions.forEach((vessel: VesselOption) => {
        const existingVesselData = prev.get(vessel.value) || [];
        
        // CRITICAL FIX: Check loadedVesselsRef.current INSIDE the setter to use current state
        // This prevents stale closures from overwriting freshly loaded API data
        const isLoadedFromAPI = loadedVesselsRef.current.has(vessel.value);
        
        // If vessel has been loaded from API, preserve it completely - never overwrite
        if (isLoadedFromAPI && existingVesselData.length > 0) {
          newMap.set(vessel.value, existingVesselData);
          return;
        }
        
        // Also preserve vessels with client-side edits (any checkbox is true)
        const hasLoadedData = existingVesselData.some(rank => 
          rank.actualManningFlag || 
          rank.safeManning || 
          rank.optimumManning || 
          rank.highWorkloadManning ||
          rank.actualManning.length > 0
        );
        
        if (hasLoadedData && existingVesselData.length > 0) {
          newMap.set(vessel.value, existingVesselData);
          return;
        }
        
        // Otherwise, create fresh structure from company data (for new vessels or unloaded vessels)
        const preservedManningData = new Map<string, {
          actualManning: string[];
          actualManningFlag: boolean;
          safeManning: boolean;
          optimumManning: boolean;
          highWorkloadManning: boolean;
        }>();
        
        // Preserve existing vessel-specific manning data by rank/role ID
        existingVesselData.forEach(existingRank => {
          const key = existingRank.originalRankId || existingRank.id;
          const roleKey = existingRank.role ? `${key}_${existingRank.role}` : key;
          preservedManningData.set(roleKey, {
            actualManning: [...existingRank.actualManning], // Deep copy array
            actualManningFlag: existingRank.actualManningFlag,
            safeManning: existingRank.safeManning,
            optimumManning: existingRank.optimumManning,
            highWorkloadManning: existingRank.highWorkloadManning
          });
        });
        
        // Create fresh vessel data structure based on current company structure
        const vesselRanks: VesselRankData[] = companyRankData.map(companyRank => {
          const key = companyRank.originalRankId || companyRank.id;
          const roleKey = companyRank.role ? `${key}_${companyRank.role}` : key;
          const preservedData = preservedManningData.get(roleKey);
          
          return {
            id: companyRank.id,
            rank: companyRank.rank,
            rankId: companyRank.rankId,
            role: companyRank.role,
            originalRankId: companyRank.originalRankId,
            isRoleRow: companyRank.isRoleRow,
            // Restore preserved manning data or initialize as empty
            actualManning: preservedData?.actualManning || [],
            actualManningFlag: preservedData?.actualManningFlag || false,
            safeManning: preservedData?.safeManning || false,
            optimumManning: preservedData?.optimumManning || false,
            highWorkloadManning: preservedData?.highWorkloadManning || false,
            // Company-only designation fields (flow down automatically, not editable in vessel)
            officer: companyRank.officer,
            rating: companyRank.rating,
            seniorOfficer: companyRank.seniorOfficer,
            deckOfficer: companyRank.deckOfficer,
            engOfficer: companyRank.engOfficer,
            pettyOfficer: companyRank.pettyOfficer,
            deckRating: companyRank.deckRating,
            engineRating: companyRank.engineRating,
            generalRating: companyRank.generalRating,
            cateringRating: companyRank.cateringRating,
            // Vessel-specific override fields (default to Company tab values, but vessel can override)
            safetyOfficer: companyRank.safetyOfficer,
            sso: companyRank.sso,
            medicalOfficer: companyRank.medicalOfficer,
            navigatingOfficer: companyRank.navigatingOfficer,
            emtOfficer: companyRank.emtOfficer,
            hasMultiple: companyRank.hasMultiple
          };
        });
        
        // Each vessel gets its own deep copy
        newMap.set(vessel.value, vesselRanks);
      });
      
      // Only update if there's a meaningful change to prevent infinite loops
      const hasChanged = Array.from(newMap.entries()).some(([key, value]) => {
        const prevValue = prev.get(key);
        return !prevValue || JSON.stringify(value) !== JSON.stringify(prevValue);
      });
      
      return hasChanged ? newMap : prev;
    });
  }, [companyRankData, vesselOptions]);

  // Track previous company rank data to prevent infinite form sync loops
  const prevCompanyFormSyncRef = React.useRef<string>('');
  
  // CRITICAL: Sync React Hook Form with companyRankData changes (Fix dual source of truth)
  React.useEffect(() => {
    // STRATEGIC FIX: Prevent overwrite during editing - critical guard condition
    if (isCompanyEditing || companyRankData.length === 0) return;
    
    // PERFORMANCE FIX: Only sync if data actually changed (prevent infinite loops)
    const syncKey = JSON.stringify(companyRankData);
    if (prevCompanyFormSyncRef.current === syncKey) {
      return; // No change, skip sync
    }
    prevCompanyFormSyncRef.current = syncKey;
    
    if (companyRankData.length > 0) {
      const displayRows = companyRankData.filter(rank => {
        if (rank.isRoleRow) return true;
        const hasRoleRows = companyRankData.some(r => r.originalRankId === rank.id && r.isRoleRow);
        return !hasRoleRows;
      });
      
      // Sync form data with display rows, ensuring boolean values
      resetCompany({ 
        ranks: displayRows.map(rank => ({
          ...rank,
          // Ensure all boolean fields are properly typed to prevent form issues
          officer: !!rank.officer,
          rating: !!rank.rating,
          seniorOfficer: !!rank.seniorOfficer,
          deckOfficer: !!rank.deckOfficer,
          engOfficer: !!rank.engOfficer,
          pettyOfficer: !!rank.pettyOfficer,
          deckRating: !!rank.deckRating,
          engineRating: !!rank.engineRating,
          generalRating: !!rank.generalRating,
          cateringRating: !!rank.cateringRating,
          applicableToCompany: !!rank.applicableToCompany
        }))
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyRankData, isCompanyEditing]);

  // Load saved vessel data when vessels are selected
  React.useEffect(() => {
    console.log('🔍 [VESSEL LOAD CHECK]', {
      selectedVesselsLength: selectedVessels.length,
      companyRankDataLength: companyRankData.length,
      selectedVessels,
      loadedVessels: Array.from(loadedVesselsRef.current)
    });
    
    if (selectedVessels.length === 0 || companyRankData.length === 0) {
      console.log('🔍 [VESSEL LOAD SKIP] Early return - no vessels selected or no company data');
      return;
    }

    const loadVesselData = async () => {
      // Determine which vessels need to be loaded (haven't been loaded yet)
      const vesselsToLoad = selectedVessels.filter(vesselId => !loadedVesselsRef.current.has(vesselId));
      
      console.log('🔍 [VESSEL LOAD] Vessels to load:', vesselsToLoad);
      
      if (vesselsToLoad.length === 0) {
        console.info('📥 All selected vessels already loaded, skipping fetch');
        // Show what data we have for the current vessel
        const currentVesselId = selectedVessels[0];
        const currentData = vesselRankDataMap.get(currentVesselId);
        console.log(`🔍 [CURRENT DATA] Vessel ${currentVesselId} has ${currentData?.length || 0} ranks`);
        if (currentData && currentData.length > 0) {
          const sample = currentData[0];
          console.log('🔍 [SAMPLE RANK]', {
            id: sample.id,
            rank: sample.rank,
            actualManningFlag: sample.actualManningFlag,
            safeManning: sample.safeManning,
            optimumManning: sample.optimumManning
          });
        }
        return;
      }

      console.info(`📥 Loading data for ${vesselsToLoad.length} vessel(s) in ${revisionMode ? 'REVISION' : 'NON-REVISION'} mode`);

      try {
        // Load all vessels in parallel using Promise.all for better performance
        await Promise.all(vesselsToLoad.map(async (vesselId) => {
          try {
            if (revisionMode) {
              // IN REVISION MODE: Load draft data for editing
              const draftResponse = await fetch(`/api/vessel-drafts/by-vessel/${vesselId}`);
              if (draftResponse.ok) {
                const drafts = await draftResponse.json();
                if (drafts.length > 0) {
                  const latestDraft = drafts[0];
                  const loadedData: VesselRankData[] = JSON.parse(latestDraft.draftData);
                  
                  // Create a lookup map for loaded vessel data by ID and role
                  const loadedDataMap = new Map<string, VesselRankData>();
                  loadedData.forEach(vesselRank => {
                    const key = vesselRank.isRoleRow && vesselRank.role 
                      ? `${vesselRank.id}_${vesselRank.role}`
                      : vesselRank.id;
                    loadedDataMap.set(key, vesselRank);
                  });
                  
                  // Merge: Start with company ranks and overlay vessel-specific data from loaded draft
                  const mergedData = companyRankData.map(companyRank => {
                    const key = companyRank.isRoleRow && companyRank.role 
                      ? `${companyRank.id}_${companyRank.role}`
                      : companyRank.id;
                    const vesselRank = loadedDataMap.get(key);
                    
                    if (vesselRank) {
                      // Vessel data exists - merge it with company data
                      return {
                        ...companyRank,
                        // Preserve vessel-specific manning data from loaded draft
                        actualManning: vesselRank.actualManning || [],
                        actualManningFlag: vesselRank.actualManningFlag || false,
                        safeManning: vesselRank.safeManning || false,
                        optimumManning: vesselRank.optimumManning || false,
                        highWorkloadManning: vesselRank.highWorkloadManning || false,
                        // Preserve vessel-specific overrides if they exist, otherwise use company defaults
                        safetyOfficer: vesselRank.safetyOfficer ?? companyRank.safetyOfficer,
                        sso: vesselRank.sso ?? companyRank.sso,
                        medicalOfficer: vesselRank.medicalOfficer ?? companyRank.medicalOfficer,
                        navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank.navigatingOfficer,
                        emtOfficer: vesselRank.emtOfficer ?? companyRank.emtOfficer,
                      };
                    } else {
                      // No vessel data for this company rank - create fresh vessel rank
                      return {
                        ...companyRank,
                        // Initialize vessel-specific manning fields as empty
                        actualManning: [],
                        actualManningFlag: false,
                        safeManning: false,
                        optimumManning: false,
                        highWorkloadManning: false
                      };
                    }
                  });
                  
                  setVesselRankDataMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(vesselId, mergedData);
                    return newMap;
                  });
                  
                  loadedVesselsRef.current.add(vesselId);
                  console.log(`📥 ✓ Loaded and merged draft for vessel ${vesselId} (${mergedData.length} ranks)`);
                } else {
                  console.info(`📥 No draft found for vessel ${vesselId} - initializing from company structure`);
                  // CRITICAL FIX: Initialize vessel data from company structure when no draft exists
                  const freshData = companyRankData.map(companyRank => ({
                    ...companyRank,
                    actualManning: [],
                    actualManningFlag: false,
                    safeManning: false,
                    optimumManning: false,
                    highWorkloadManning: false
                  }));
                  
                  setVesselRankDataMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(vesselId, freshData);
                    return newMap;
                  });
                  
                  loadedVesselsRef.current.add(vesselId);
                  console.log(`📥 ✓ Initialized vessel ${vesselId} from company structure (${freshData.length} ranks)`);
                }
              }
            } else {
              // NON-REVISION MODE: Load latest revision for display
              const revisionResponse = await fetch(`/api/vessel-revisions/by-vessel/${vesselId}`);
              if (revisionResponse.ok) {
                const revisions = await revisionResponse.json();
                if (revisions.length > 0) {
                  // Sort by revision number to get the latest
                  const sortedRevisions = [...revisions].sort((a, b) => {
                    const aNum = parseInt(a.revision.replace('R', ''));
                    const bNum = parseInt(b.revision.replace('R', ''));
                    return bNum - aNum;
                  });
                  
                  const latestRevision = sortedRevisions[0];
                  const loadedData: VesselRankData[] = JSON.parse(latestRevision.revisionData);
                  
                  // Create a lookup map for loaded vessel data by ID and role
                  const loadedDataMap = new Map<string, VesselRankData>();
                  loadedData.forEach(vesselRank => {
                    const key = vesselRank.isRoleRow && vesselRank.role 
                      ? `${vesselRank.id}_${vesselRank.role}`
                      : vesselRank.id;
                    loadedDataMap.set(key, vesselRank);
                  });
                  
                  // Merge: Start with company ranks and overlay vessel-specific data from loaded revision
                  const mergedData = companyRankData.map(companyRank => {
                    const key = companyRank.isRoleRow && companyRank.role 
                      ? `${companyRank.id}_${companyRank.role}`
                      : companyRank.id;
                    const vesselRank = loadedDataMap.get(key);
                    
                    if (vesselRank) {
                      // Vessel data exists - merge it with company data
                      return {
                        ...companyRank,
                        // Preserve vessel-specific manning data from loaded revision
                        actualManning: vesselRank.actualManning || [],
                        actualManningFlag: vesselRank.actualManningFlag || false,
                        safeManning: vesselRank.safeManning || false,
                        optimumManning: vesselRank.optimumManning || false,
                        highWorkloadManning: vesselRank.highWorkloadManning || false,
                        // Preserve vessel-specific overrides if they exist, otherwise use company defaults
                        safetyOfficer: vesselRank.safetyOfficer ?? companyRank.safetyOfficer,
                        sso: vesselRank.sso ?? companyRank.sso,
                        medicalOfficer: vesselRank.medicalOfficer ?? companyRank.medicalOfficer,
                        navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank.navigatingOfficer,
                        emtOfficer: vesselRank.emtOfficer ?? companyRank.emtOfficer,
                      };
                    } else {
                      // No vessel data for this company rank - create fresh vessel rank
                      return {
                        ...companyRank,
                        // Initialize vessel-specific manning fields as empty
                        actualManning: [],
                        actualManningFlag: false,
                        safeManning: false,
                        optimumManning: false,
                        highWorkloadManning: false
                      };
                    }
                  });
                  
                  setVesselRankDataMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(vesselId, mergedData);
                    return newMap;
                  });
                  
                  // Convert date from dd/mm/yyyy (storage) to yyyy-mm-dd (HTML date input format)
                  const dateParts = latestRevision.revisionDate.split('/');
                  if (dateParts.length === 3) {
                    const [day, month, year] = dateParts;
                    const htmlDateFormat = `${year}-${month}-${day}`;
                    setFlexDate(htmlDateFormat);
                  } else {
                    setFlexDate(latestRevision.revisionDate); // Fallback to original if format unexpected
                  }
                  
                  loadedVesselsRef.current.add(vesselId);
                  console.log(`📥 ✓ Loaded and merged revision ${latestRevision.revision} for vessel ${vesselId} (${mergedData.length} ranks, date: ${latestRevision.revisionDate})`);
                } else {
                  console.info(`📥 No revisions found for vessel ${vesselId} - initializing from company structure`);
                  setFlexDate(''); // Clear date when no revisions exist
                  
                  // CRITICAL FIX: Initialize vessel data from company structure when no revisions exist
                  const freshData = companyRankData.map(companyRank => ({
                    ...companyRank,
                    actualManning: [],
                    actualManningFlag: false,
                    safeManning: false,
                    optimumManning: false,
                    highWorkloadManning: false
                  }));
                  
                  setVesselRankDataMap(prev => {
                    const newMap = new Map(prev);
                    newMap.set(vesselId, freshData);
                    return newMap;
                  });
                  
                  loadedVesselsRef.current.add(vesselId);
                  console.log(`📥 ✓ Initialized vessel ${vesselId} from company structure (${freshData.length} ranks)`);
                }
              }
            }
          } catch (vesselError) {
            console.error(`📥 ✗ Error loading data for vessel ${vesselId}:`, vesselError);
            // Continue loading other vessels even if one fails
          }
        }));
      } catch (error) {
        console.error('📥 ✗ Error loading vessel data:', error);
      }
    };

    loadVesselData();
  }, [selectedVessels, revisionMode, companyRankData.length]);

  // Rank Master handlers

  const handleNewRank = () => {
    const newRank: RankMasterData = {
      id: `new_${Date.now()}`, // Prefix with 'new_' to identify new ranks
      rank: "",
      rankId: "",
      applicableToCompany: false,
      label: ""
    };
    setRankMasterData(prev => {
      const newData = [...prev, newRank];
      return newData;
    });
    // Track this as a new rank
    setNewRanks(prev => new Set([...Array.from(prev), newRank.id]));
    setIsRankMasterEditing(true);
  };

  const handleEditRank = () => {
    setIsRankMasterEditing(true);
  };

  const handleDeleteRank = (rankId: string) => {
    setRankMasterData(prev => prev.filter(rank => rank.id !== rankId));
    setDeletedRanks(prev => new Set([...Array.from(prev), rankId]));
    // Also remove from other tracking sets if present
    setChangedRanks(prev => {
      const newSet = new Set(prev);
      newSet.delete(rankId);
      return newSet;
    });
    setNewRanks(prev => {
      const newSet = new Set(prev);
      newSet.delete(rankId);
      return newSet;
    });
  };

  // Rank reordering handlers
  const handleMoveRankUp = (currentIndex: number) => {
    if (currentIndex === 0) return; // Can't move up if already at top
    
    const newData = [...rankMasterData];
    // Swap current item with the one above it
    [newData[currentIndex - 1], newData[currentIndex]] = [newData[currentIndex], newData[currentIndex - 1]];
    
    setRankMasterData(newData);
    
    // Create rank order updates
    const rankOrderUpdates = newData.map((rank, index) => ({
      id: parseInt(rank.id),
      sortOrder: index + 1
    }));

    // Send update to server
    reorderRanksMutation.mutate(rankOrderUpdates);
  };

  const handleMoveRankDown = (currentIndex: number) => {
    if (currentIndex === rankMasterData.length - 1) return; // Can't move down if already at bottom
    
    const newData = [...rankMasterData];
    // Swap current item with the one below it
    [newData[currentIndex], newData[currentIndex + 1]] = [newData[currentIndex + 1], newData[currentIndex]];
    
    setRankMasterData(newData);
    
    // Create rank order updates
    const rankOrderUpdates = newData.map((rank, index) => ({
      id: parseInt(rank.id),
      sortOrder: index + 1
    }));

    // Send update to server
    reorderRanksMutation.mutate(rankOrderUpdates);
  };

  // Database cleanup function - clears all ranks and resets state
  const handleCleanupAllRanks = async () => {
    try {
      // Clear all ranks from database
      await clearAllRanksMutation.mutateAsync();
      
      // Reset all local state
      setRankMasterData([]);
      setChangedRanks(new Set());
      setNewRanks(new Set());
      setDeletedRanks(new Set());
      setIsRankMasterEditing(false);
      
      toast({
        title: "Database Cleanup Complete",
        description: "All rank data has been cleared from the database and cache has been reset.",
        duration: 5000,
      });
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast({
        title: "Cleanup Failed",
        description: "Failed to clear all rank data. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleSaveRank = async () => {
    try {
      
      // Process deletions first
      for (const deletedId of Array.from(deletedRanks)) {
        if (!deletedId.startsWith('new_')) { // Don't try to delete new ranks that haven't been saved yet
          await deleteRankMutation.mutateAsync(parseInt(deletedId));
        }
      }
      
      // Process new ranks
      for (const newId of Array.from(newRanks)) {
        const rankData = rankMasterData.find(r => r.id === newId);
        if (rankData && rankData.rank.trim()) { // Only save if rank name is provided
          // Default category for new ranks - can be customized later
          const defaultCategory = 'Senior Officers';
          await createRankMutation.mutateAsync({
            name: rankData.rank,
            category: defaultCategory,
            rankId: rankData.rankId || null,
            label: rankData.label || null,
            applicableToCompany: rankData.applicableToCompany
          });
        }
      }
      
      // Process updates to existing ranks
      for (const changedId of Array.from(changedRanks)) {
        if (!changedId.startsWith('new_') && !deletedRanks.has(changedId)) {
          const rankData = rankMasterData.find(r => r.id === changedId);
          if (rankData) {
            // Find original rank from backend data to preserve its category
            const originalRank = sharedRankMasterData?.find(r => r.id.toString() === changedId);
            // Default to 'Senior Officers' since we can't easily access the original category
            // This is acceptable since category is not user-editable in the current UI
            const preservedCategory = 'Senior Officers';
            await updateRankMutation.mutateAsync({
              id: parseInt(changedId),
              data: {
                name: rankData.rank,
                category: preservedCategory, // Preserve original category
                rankId: rankData.rankId || null,
                label: rankData.label || null,
                applicableToCompany: rankData.applicableToCompany
              }
            });
          }
        }
      }
      
      // Clear change tracking
      setChangedRanks(new Set());
      setNewRanks(new Set());
      setDeletedRanks(new Set());
      setIsRankMasterEditing(false);
      
      toast({
        title: "Success",
        description: "Rank changes saved successfully",
      });
      
    } catch (error) {
      console.error('Error saving ranks:', error);
      toast({
        title: "Error",
        description: "Failed to save rank changes",
        variant: "destructive",
      });
    }
  };

  // EditSession integration - use hook directly at top level
  const {
    isEditing,
    isEditingMaster,
    startEdit,
    stopEdit,
    commitSave,
    discardChanges,
    markDirty,
    saving,
    isDirty,
    pendingChanges,
    pendingTarget,
    setPendingTarget,
    resolvePendingNavigation,
    hasUnsavedChanges
  } = useEditSession();

  // Check if this master is currently being edited (replacing isMasterInEditMode)
  const isMasterInEditMode = isEditingMaster(selectedMaster);

  // Helper function to get current effective value for input display
  // Returns pending change value if exists, otherwise original value
  const getEffectiveValue = (itemId: number, fieldName: string, originalValue: any): string => {
    const entryChanges = pendingChanges.get(itemId);
    if (entryChanges && entryChanges.hasOwnProperty(fieldName)) {
      return entryChanges[fieldName] || '';
    }
    return originalValue || '';
  };

  // Edit handlers with baseline capture
  const handleEditMaster = () => {
    if (import.meta.env.DEV) {
      console.log(`🔧 [EDIT_SESSION] Starting edit for master ${selectedMaster} with baseline data`);
      console.log('📊 [BASELINE] Capturing masterData:', masterData);
      console.log('📊 [BASELINE] masterData length:', masterData.length);
      console.log('📊 [BASELINE] Current edit state before starting:', { isEditing, activeMasterId: isEditingMaster(selectedMaster) });
    }
    
    // Capture baseline data when entering edit mode
    startEdit(selectedMaster, masterData);
    
    if (import.meta.env.DEV) {
      console.log('🔧 [EDIT_SESSION] startEdit() called - edit mode should now be active');
    }
  };

  const handleCancelEditMaster = () => {
    if (import.meta.env.DEV) {
      console.log(`❌ [EDIT_SESSION] Discarding changes for master ${selectedMaster}`);
    }
    discardChanges();
    stopEdit();
  };

  const handleSaveMaster = async () => {
    if (import.meta.env.DEV) {
      console.log('💾 [SAVE] Starting EditSession commit save operation');
      console.log('💾 [SAVE] Current edit state:', { 
        isEditing, 
        isDirty, 
        saving, 
        activeMaster: isEditingMaster(selectedMaster),
        pendingChangesCount: pendingChanges.size
      });
    }
    
    try {
      // Use EditSession's commitSave which will:
      // 1. Call handleEditSessionSave with pending changes
      // 2. Update baseline with saved changes  
      // 3. Reset dirty state
      // 4. Keep edit mode active until successful
      await commitSave();
      
      // After successful save, show toast
      const isVesselMasterSave = isVesselMaster(selectedMaster);
      const isPortMasterSave = isPortMaster(selectedMaster);
      const successMessage = isVesselMasterSave 
        ? `Vessel data saved successfully (safe mode)`
        : isPortMasterSave
        ? `Port data saved successfully (safe mode)`
        : `Changes saved successfully`;
        
      toast({
        title: "Success",
        description: successMessage,
      });
      
      // Stop edit mode after successful save
      stopEdit();
      
      if (import.meta.env.DEV) {
        console.log('✅ [SAVE] EditSession commit save completed successfully');
      }
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [SAVE] EditSession commit save failed:', error);
      }
      
      toast({
        title: "Error",
        description: `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const updateMasterField = (itemId: number, field: 'name' | 'description' | 'countryName' | 'country' | 'countryCode' | 'vesselType' | 'vtuid' | 'tanker' | 'oilTanker' | 'gasTanker' | 'chemicalTanker' | 'bulk' | 'vessel' | 'imoNumber' | 'cid' | 'firstname' | 'lastname' | 'designationId' | 'email', value: string | boolean) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [INPUT_HANDLER] updateMasterField called - Entry ${itemId}, Field: ${field}, Value: ${JSON.stringify(value)}`);
      console.log(`🎯 [INPUT_HANDLER] Current edit state - isEditing: ${isEditing}, activemaster: ${isEditingMaster(selectedMaster)}`);
    }
    
    // Only track the change locally - no immediate API calls
    markDirty(itemId, field, value);
    
    if (import.meta.env.DEV) {
      console.log(`✅ [INPUT_HANDLER] Called markDirty for ${itemId}.${field} - changes tracked locally`);
    }
  };

  const deleteMasterEntry = (itemId: number) => {
    // Only allow deletion when in edit mode
    if (!isMasterInEditMode) {
      toast({
        title: "Edit Mode Required",
        description: "Please click 'Edit Master' before deleting entries.",
        variant: "destructive",
      });
      return;
    }
    
    deleteEntryMutation.mutate(itemId);
  };

  const handleNewEntry = () => {
    // Only allow new entries when in edit mode
    if (!isMasterInEditMode) {
      toast({
        title: "Edit Mode Required",
        description: "Please click 'Edit Master' before adding new entries.",
        variant: "destructive",
      });
      return;
    }
    
    const newEntryId = Date.now().toString(); // Generate unique entry ID
    
    const newEntryData: Omit<InsertMasterDataEntry, 'masterId'> = (() => {
      if (selectedMaster === "001") {
        // Nationality master - create entry with nationality-specific fields
        return {
          entryId: newEntryId,
          name: '', // Still required for compatibility
          description: '', // Still required for compatibility
          countryName: '',
          country: '',
          isActive: true,
          isDeleted: false
        };
      } else if (selectedMaster === "002") {
        // Country master - create entry with country-specific fields
        return {
          entryId: newEntryId,
          name: '', // Country name
          description: '', // Still required for compatibility
          countryCode: '', // Country UN/LOCODE
          isActive: true,
          isDeleted: false
        };
      } else if (selectedMaster === "003") {
        // Language master - create entry with language-specific fields
        return {
          entryId: newEntryId,
          name: '', // Language name (e.g., "English")
          description: '', // ISO language code (e.g., "EN")
          isActive: true,
          isDeleted: false
        };
      } else if (selectedMaster === "004") {
        // Vessel type master - create entry with vessel type-specific fields
        return {
          entryId: newEntryId,
          name: '', // Still required for compatibility
          description: '', // Still required for compatibility
          vesselType: '', // Vessel type name
          vtuid: '', // Vessel type unique identifier
          tanker: false,
          oilTanker: false,
          gasTanker: false,
          chemicalTanker: false,
          bulk: false,
          isActive: true,
          isDeleted: false
        };
      } else if (selectedMaster === "014") {
        // Vessel master - create entry with safe field mapping
        console.log('🚢 [NEW ENTRY] Creating new vessel master entry with safe field mapping');
        const vesselData: Partial<VesselMasterEntry> = {
          entryId: newEntryId,
          vessel: 'New Vessel', // Vessel name - will map to 'name' field
          imoNumber: '', // IMO number - will map to 'description' field
          isActive: true,
          isDeleted: false
        };
        
        // Apply safe field mapping before creating entry
        const safeData = mapVesselDataToSafeFields(vesselData, selectedMaster);
        console.log('🚢 [NEW ENTRY] Safe vessel data:', safeData);
        
        // Ensure name field is set (required for vessel master)
        if (!safeData.name) {
          safeData.name = 'New Vessel';
        }
        
        return safeData as Omit<InsertMasterDataEntry, 'masterId'>;
      } else if (selectedMaster === "021") {
        // Manning Agents master - create entry with name, country, email fields
        return {
          entryId: newEntryId,
          name: '',
          country: '',
          email: '',
          isActive: true,
          isDeleted: false
        };
      } else if (selectedMaster === "022") {
        // Crew Pool master - create entry with just name field
        return {
          entryId: newEntryId,
          name: '',
          isActive: true,
          isDeleted: false
        };
      } else {
        // Other masters - create entry with standard fields
        return {
          entryId: newEntryId,
          name: '',
          description: ''
        };
      }
    })();

    createEntryMutation.mutate(newEntryData, {
      onSuccess: (data) => {
        console.log('✅ [UI] New entry created successfully:', data);
        toast({
          title: "Success",
          description: "New entry created successfully",
        });
        
        // Wait for query to refetch with new entry, then auto-start edit mode
        // This ensures fresh baseline data when entering edit mode
        (async () => {
          try {
            if (import.meta.env.DEV) {
              console.log('🔄 [AUTO_EDIT] Waiting for fresh data before auto-starting edit mode...');
            }
            
            // Refetch the query and get fresh data
            // Use correct queryKey format matching useMasterDataEntries hook
            await rq.refetchQueries({ 
              queryKey: [`/api/masters/${selectedMaster}/data`],
              exact: true
            });
            
            // Get fresh data directly from the query cache
            const freshRawData = (rq.getQueryData([`/api/masters/${selectedMaster}/data`]) as any[]) || [];
            
            // Apply field mapping if needed (same logic as masterData useMemo)
            const freshMasterData = (() => {
              if (isVesselMaster(selectedMaster)) {
                return freshRawData.map((item: any) => mapSafeFieldsToVesselData(item));
              }
              if (isPortMaster(selectedMaster)) {
                return freshRawData.map((item: any) => mapSafeFieldsToPortData(item));
              }
              return freshRawData;
            })();
            
            if (import.meta.env.DEV) {
              console.log('🎯 [AUTO_EDIT] Fresh data loaded - auto-starting edit mode with proper baseline');
              console.log('📊 [AUTO_EDIT] Fresh master data entries:', freshMasterData.length);
            }
            
            // Start edit with fresh data directly (not using handleEditMaster)
            startEdit(selectedMaster, freshMasterData);
          } catch (error) {
            console.error('❌ [AUTO_EDIT] Failed to refetch data for auto-edit:', error);
            // Fallback: still try to enter edit mode even if refetch failed
            handleEditMaster();
          }
        })();
      },
      onError: (error) => {
        console.error('❌ [UI] Failed to create new entry:', error);
        toast({
          title: "Error",
          description: `Failed to create new entry: ${error.message}`,
          variant: "destructive",
        });
      }
    });
  };

  // Company handlers
  
  const handleCompanyRankDataChange = (id: string, field: keyof CompanyRankData, value: any) => {
    console.log('🎯 [CHECKBOX] Handler called:', { id, field, value });
    setCompanyRankData(prev => {
      const newData = [...prev];
      const rowIndex = newData.findIndex(row => row.id === id);
      if (rowIndex !== -1) {
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        console.log('🎯 [CHECKBOX] Updated row:', newData[rowIndex]);
        
        // Track changes that affect the main rank database
        if (field === 'rank' || field === 'rankId') {
          setChangedCompanyRanks(prev => new Set(prev).add(id));
        }
      } else {
        console.log('🎯 [CHECKBOX] Row not found for id:', id);
      }
      return newData;
    });
  };
  
  const handleAddMultipleCompanyRole = (rankId: string) => {
    handleMultiple(rankId);
  };

  const handleEditCompany = () => {
    setIsCompanyEditing(true);
  };

  const handleSaveCompany = async () => {
    try {
      console.log('🔄 [COMPANY_SAVE] Starting save process', {
        changedCompanyRanks: Array.from(changedCompanyRanks),
        companyRankDataCount: companyRankData.length
      });

      // First, save role variants as new ranks in the database
      const roleVariants = companyRankData.filter(rank => rank.isRoleRow);
      console.log('🔄 [COMPANY_SAVE] Found role variants to save:', roleVariants.length);
      
      for (const roleVariant of roleVariants) {
        // Check if this role variant doesn't have a numeric ID (needs to be created)
        const numericId = parseInt(roleVariant.id, 10);
        if (isNaN(numericId)) {
          console.log('🔄 [COMPANY_SAVE] Creating new role variant:', roleVariant.role);
          
          // Find the original rank to get category and other info
          const originalRank = sharedRankMasterData?.find(rank => rank.id.toString() === roleVariant.originalRankId);
          
          if (originalRank) {
            await createRankMutation.mutateAsync({
              name: roleVariant.role || roleVariant.rank,
              category: 'Senior Officers', // Default category for role variants
              rankId: roleVariant.rankId,
              label: roleVariant.role || roleVariant.rank,
              applicableToCompany: true // Role variants are always applicable to company
            });
          }
        }
      }

      // Update each changed rank in the main rank database
      for (const changedId of Array.from(changedCompanyRanks)) {
        // Skip new ranks that haven't been saved yet (they have 'new_' prefix)
        if (changedId.startsWith('new_')) {
          console.log('🔄 [COMPANY_SAVE] Skipping new unsaved rank:', changedId);
          continue;
        }
        
        // Guard against invalid IDs
        const numericId = parseInt(changedId, 10);
        if (isNaN(numericId)) {
          console.error('🔄 [COMPANY_SAVE] Invalid rank ID:', changedId);
          continue;
        }
        
        const companyRank = companyRankData.find(rank => rank.id === changedId);
        if (companyRank) {
          // Find the original rank data to preserve its structure
          const originalRank = sharedRankMasterData?.find(rank => rank.id.toString() === changedId);
          
          if (originalRank) {
            // Get the updated applicableToCompany value from rank master data
            const updatedRankMasterData = rankMasterData.find(r => r.id.toString() === changedId);
            const updatedApplicableToCompany = updatedRankMasterData?.applicableToCompany ?? originalRank.applicableToCompany;
            
            console.log('🔄 [COMPANY_SAVE] Updating rank:', {
              id: changedId,
              name: originalRank.rank,
              updatedLabel: companyRank.rank,
              applicableToCompany: updatedApplicableToCompany
            });

            await updateRankMutation.mutateAsync({
              id: numericId,
              data: {
                // Preserve original rank data structure
                name: originalRank.rank,
                category: 'Senior Officers', // Default category
                rankId: companyRank.rankId || originalRank.rankId,
                label: companyRank.rank || originalRank.label,
                // Update the applicableToCompany value from company tab changes
                applicableToCompany: updatedApplicableToCompany
              }
            });
          }
        }
      }

      // CRITICAL: Bulk save ALL company rank data with checkbox settings
      console.log('🔄 [COMPANY_SAVE] Bulk saving all company rank data to persistent storage');
      const companyRankDataForSave = companyRankData.map(rank => ({
        id: rank.id,
        rank: rank.rank,
        rankId: rank.rankId,
        officer: rank.officer || false,
        rating: rank.rating || false,
        seniorOfficer: rank.seniorOfficer || false,
        deckOfficer: rank.deckOfficer || false,
        engOfficer: rank.engOfficer || false,
        pettyOfficer: rank.pettyOfficer || false,
        deckRating: rank.deckRating || false,
        engineRating: rank.engineRating || false,
        generalRating: rank.generalRating || false,
        cateringRating: rank.cateringRating || false,
        safetyOfficer: rank.safetyOfficer || false,
        sso: rank.sso || false,
        medicalOfficer: rank.medicalOfficer || false,
        navigatingOfficer: rank.navigatingOfficer || false,
        emtOfficer: rank.emtOfficer || false,
        hasMultiple: rank.hasMultiple || false,
        // Include role variant data
        ...(rank.isRoleRow && {
          isRoleRow: true,
          role: rank.role,
          originalRankId: rank.originalRankId
        })
      }));

      await saveCompanyRanksMutation.mutateAsync(companyRankDataForSave);
      console.log('✅ [COMPANY_SAVE] Successfully bulk saved all company rank data');

      // Clear change tracking for both company and rank master
      setChangedCompanyRanks(new Set());
      // Also clear rank master changes for the IDs we just saved
      setChangedRanks(prev => {
        const newSet = new Set(prev);
        changedCompanyRanks.forEach(id => newSet.delete(id));
        return newSet;
      });
      setIsCompanyEditing(false);
      
      // Refresh rank data to pick up newly created role variants
      rq.invalidateQueries({ queryKey: ["/api/available-ranks"] });
      
      toast({
        title: "Success",
        description: "Company rank data and settings saved to persistent storage successfully",
      });
      
    } catch (error) {
      console.error('Error saving company changes:', error);
      toast({
        title: "Error",
        description: "Failed to save company changes",
        variant: "destructive",
      });
    }
  };

  const handleMultiple = (rankId: string) => {
    console.log('🔄 [MULTIPLE DEBUG] Multiple button clicked for rankId:', rankId);
    console.log('🔄 [MULTIPLE DEBUG] Current companyRankData count:', companyRankData.length);
    
    // Find the rank to multiply - could be original rank or originalRankId from role
    let originalRankId = rankId;
    let rankToMultiply = companyRankData.find(rank => rank.id === rankId);
    
    console.log('🔄 [MULTIPLE DEBUG] Found rankToMultiply:', rankToMultiply);
    
    // If this is a role row, get the original rank ID
    if (rankToMultiply?.isRoleRow && rankToMultiply.originalRankId) {
      originalRankId = rankToMultiply.originalRankId;
      // Get the parent rank data for creating new roles
      rankToMultiply = companyRankData.find(rank => rank.id === originalRankId);
      console.log('🔄 [MULTIPLE DEBUG] This is a role row, using originalRankId:', originalRankId);
    }
    
    if (rankToMultiply) {
      setCompanyRankData(prev => {
        const currentData = [...prev];
        
        // Check if this rank already has role rows
        const existingRoles = currentData.filter(row => row.originalRankId === originalRankId);
        
        if (existingRoles.length === 0) {
          // First time creating roles - keep parent but add 2 role rows
          const parentIndex = currentData.findIndex(rank => rank.id === originalRankId);
          
          const role1: CompanyRankData = {
            ...rankToMultiply,
            id: `${originalRankId}_role_1_${Date.now()}`,
            role: `${rankToMultiply.rank}_1`,
            originalRankId: originalRankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          const role2: CompanyRankData = {
            ...rankToMultiply,
            id: `${originalRankId}_role_2_${Date.now()}`,
            role: `${rankToMultiply.rank}_2`,
            originalRankId: originalRankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Insert role rows after parent (parent will be filtered from display)
          currentData.splice(parentIndex + 1, 0, role1, role2);
        } else {
          // Adding more roles - use gap-filling logic
          const roleNumbers = existingRoles
            .map(role => {
              const match = role.role?.match(/_(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => num > 0)
            .sort((a, b) => a - b);
          
          // Find the next sequential number (gap-filling)
          let nextRoleNumber = 1;
          for (const num of roleNumbers) {
            if (num === nextRoleNumber) {
              nextRoleNumber++;
            } else {
              break;
            }
          }
          
          const newRole: CompanyRankData = {
            ...rankToMultiply,
            id: `${originalRankId}_role_${nextRoleNumber}_${Date.now()}`,
            role: `${rankToMultiply.rank}_${nextRoleNumber}`,
            originalRankId: originalRankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Add the new role after the last existing role for this rank
          const lastRoleIndex = Math.max(...existingRoles.map(role => 
            currentData.findIndex(row => row.id === role.id)
          ));
          currentData.splice(lastRoleIndex + 1, 0, newRole);
        }
        
        console.log('🔄 [MULTIPLE DEBUG] Updated companyRankData count:', currentData.length);
        console.log('🔄 [MULTIPLE DEBUG] Role rows created for originalRankId:', originalRankId);
        const roleRows = currentData.filter(r => r.originalRankId === originalRankId);
        console.log('🔄 [MULTIPLE DEBUG] Total role rows for this rank:', roleRows.length);
        console.log('🔄 [MULTIPLE DEBUG] Role rows:', roleRows.map(r => ({ id: r.id, role: r.role, isRoleRow: r.isRoleRow })));
        
        return currentData;
      });
    } else {
      console.error('🔄 [MULTIPLE DEBUG] rankToMultiply not found for rankId:', rankId);
    }
  };

  const handleDeleteCompanyRank = (rankId: string) => {
    setCompanyRankData(prev => {
      const rankToDelete = prev.find(rank => rank.id === rankId);
      let filteredData = prev.filter(rank => rank.id !== rankId);
      
      // If deleting a role row, implement gap-filling logic
      if (rankToDelete?.isRoleRow && rankToDelete.originalRankId) {
        const remainingRoles = filteredData.filter(row => row.originalRankId === rankToDelete.originalRankId);
        
        // If only 1 role remains, remove it and show parent again
        if (remainingRoles.length === 1) {
          filteredData = filteredData.filter(row => row.id !== remainingRoles[0].id);
        } else if (remainingRoles.length > 1) {
          // Renumber remaining roles to fill gaps (1, 2, 3...)
          const sortedRoles = remainingRoles
            .sort((a, b) => {
              const aNum = parseInt(a.role?.match(/_(\d+)$/)?.[1] || '0', 10);
              const bNum = parseInt(b.role?.match(/_(\d+)$/)?.[1] || '0', 10);
              return aNum - bNum;
            });
          
          // Update role numbers sequentially
          sortedRoles.forEach((role, index) => {
            const roleIndex = filteredData.findIndex(row => row.id === role.id);
            if (roleIndex !== -1) {
              const newRoleNumber = index + 1;
              filteredData[roleIndex] = {
                ...filteredData[roleIndex],
                role: `${rankToDelete.rank}_${newRoleNumber}`
              };
            }
          });
        }
      }
      
      return filteredData;
    });
  };

  // Vessel handlers

  const handleVesselMultiple = (rankId: string) => {
    // Find the rank to multiply from vessel data
    let rankToMultiply = vesselRankData.find(rank => rank.id === rankId);
    
    // If not found directly, look for it by originalRankId (could be a role's parent)
    if (!rankToMultiply) {
      const existingRole = vesselRankData.find(row => row.originalRankId === rankId);
      if (existingRole) {
        rankToMultiply = {
          ...existingRole,
          id: rankId,
          role: undefined,
          originalRankId: undefined,
          isRoleRow: false,
          hasMultiple: false
        };
      }
    }
    
    if (!rankToMultiply) {
      console.warn(`No rank found for id: ${rankId}`);
      return;
    }
    
    updateVesselRankData(prev => {
      try {
        const currentData = [...prev];
        const existingRoles = currentData.filter(row => row.originalRankId === rankId);
        
        if (existingRoles.length === 0) {
          // First time creating roles - find the parent rank to replace
          const rankIndex = currentData.findIndex(rank => rank.id === rankId);
          
          if (rankIndex === -1) {
            console.warn(`Parent rank with id ${rankId} not found in current data`);
            return prev; // Return unchanged data
          }
          
          const role1: VesselRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_1_${Date.now()}`,
            role: `${rankToMultiply.rank}_1`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          const role2: VesselRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_2_${Date.now()}`,
            role: `${rankToMultiply.rank}_2`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Safe splice: replace the parent rank with 2 role rows
          currentData.splice(rankIndex, 1, role1, role2);
        } else {
          // Adding more roles - find highest role number and increment
          const roleNumbers = existingRoles
            .map(role => {
              const match = role.role?.match(/_(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => num > 0);
          
          const nextRoleNumber = Math.max(...roleNumbers, 0) + 1;
          
          const newRole: VesselRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_${nextRoleNumber}_${Date.now()}`,
            role: `${rankToMultiply.rank}_${nextRoleNumber}`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Find the position to insert the new role (after the last existing role)
          const roleIndexes = existingRoles
            .map(role => currentData.findIndex(row => row.id === role.id))
            .filter(idx => idx !== -1);
          
          if (roleIndexes.length === 0) {
            console.warn(`No valid role indexes found for originalRankId: ${rankId}`);
            return prev;
          }
          
          const insertIndex = Math.max(...roleIndexes) + 1;
          currentData.splice(insertIndex, 0, newRole);
        }
        
        return currentData;
      } catch (error) {
        console.error('Error in handleVesselMultiple:', error);
        return prev; // Return unchanged data on error
      }
    });
  };

  const handleDeleteVesselRank = (rankId: string) => {
    updateVesselRankData(prev => {
      const rankToDelete = prev.find(rank => rank.id === rankId);
      const filteredData = prev.filter(rank => rank.id !== rankId);
      
      if (rankToDelete?.isRoleRow && rankToDelete.originalRankId) {
        const remainingRoles = filteredData.filter(row => row.originalRankId === rankToDelete.originalRankId);
        
        if (remainingRoles.length === 1) {
          const lastRoleIndex = filteredData.findIndex(row => row.id === remainingRoles[0].id);
          if (lastRoleIndex !== -1) {
            filteredData[lastRoleIndex] = {
              ...filteredData[lastRoleIndex],
              role: undefined,
              originalRankId: undefined,
              isRoleRow: false,
              hasMultiple: false,
              id: rankToDelete.originalRankId
            };
          }
        }
      }
      
      return filteredData;
    });
  };

  const handleRevision = async () => {
    if (selectedVessels.length === 0) {
      console.warn('Cannot start revision mode: No vessels selected');
      return;
    }
    setRevisionMode(true);
    setIsVesselEditing(true);
    
    // Fetch next revision number for the first selected vessel
    // (If multiple vessels, each will get their own next revision on submit)
    if (selectedVessels.length === 1) {
      try {
        const response = await fetch(`/api/vessel-revisions/next-revision/${selectedVessels[0]}`);
        if (response.ok) {
          const data = await response.json();
          setNextRevision(data.nextRevision);
        }
      } catch (error) {
        console.error('Error fetching next revision:', error);
        setNextRevision('R0'); // Default to R0 if fetch fails
      }
    } else {
      // For multiple vessels, show that each will get auto-assigned
      setNextRevision('Auto');
    }
  };

  const handleSaveDraft = async () => {
    if (selectedVessels.length === 0) {
      return;
    }
    
    try {
      // Save draft for all selected vessels using upsert endpoint
      const savedVessels: string[] = [];
      const failedVessels: string[] = [];
      const revision = "R1"; // Use R1 for draft revision
      
      for (const vesselId of selectedVessels) {
        const vesselData = vesselRankDataMap.get(vesselId);
        if (vesselData) {
          // Convert vessel data to JSON string for storage
          const draftData = JSON.stringify([...vesselData]);
          
          try {
            // Use upsert endpoint (updates if exists, creates if not)
            const response = await fetch('/api/vessel-drafts/upsert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vesselId,
                revision,
                draftData
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log(`💾 ${result.action === 'created' ? 'Created' : 'Updated'} draft for vessel ${vesselId}`);
              savedVessels.push(vesselId);
            } else {
              const error = await response.json();
              console.error(`Failed to save draft for vessel ${vesselId}:`, error);
              failedVessels.push(vesselId);
            }
          } catch (vesselError) {
            console.error(`Error saving draft for vessel ${vesselId}:`, vesselError);
            failedVessels.push(vesselId);
          }
        }
      }

      if (savedVessels.length > 0) {
        toast({
          title: "Draft saved successfully", 
          description: `Saved draft for ${savedVessels.length} vessel(s)`,
        });
      }
      
      if (failedVessels.length > 0) {
        toast({
          title: failedVessels.length === selectedVessels.length ? "Failed to save drafts" : "Some drafts failed to save",
          description: `Failed to save draft for ${failedVessels.length} vessel(s). Please try again.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error saving draft",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    // Stop any ongoing editing
    // vesselGridApi?.stopEditing(); // Commented out - vesselGridApi not defined
    
    // Clear selected vessels and reset states
    setSelectedVessels([]);
    setRevisionMode(false);
    setIsVesselEditing(false);
    
    // Clear loaded vessels tracking to allow fresh load next time
    loadedVesselsRef.current.clear();
    
    console.log("Cancelled vessel revision mode");
  };

  const handleSubmit = async () => {
    if (selectedVessels.length === 0) return;
    
    // Validate that flexDate is provided
    if (!flexDate) {
      toast({
        title: "Date required",
        description: "Please provide a date before submitting",
        variant: "destructive"
      });
      return;
    }
    
    // Convert date from yyyy-mm-dd to dd/mm/yyyy format
    const dateObj = new Date(flexDate);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    
    try {
      // Submit revisions for all selected vessels
      const submittedVessels: string[] = [];
      const failedVessels: string[] = [];
      
      for (const vesselId of selectedVessels) {
        const vesselData = vesselRankDataMap.get(vesselId);
        if (vesselData) {
          // Filter out invalid data and convert to JSON string
          const validData = vesselData.filter(row => row.rank && row.rank.trim() !== '');
          const revisionData = JSON.stringify(validData);
          
          try {
            const response = await fetch('/api/vessel-revisions/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vesselId,
                revisionDate: formattedDate,
                revisionData
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log(`✅ Submitted revision ${result.metadata.autoAssignedRevision} for vessel ${vesselId}`);
              submittedVessels.push(vesselId);
            } else {
              const error = await response.json();
              console.error(`Failed to submit for vessel ${vesselId}:`, error);
              failedVessels.push(vesselId);
            }
          } catch (vesselError) {
            console.error(`Error submitting for vessel ${vesselId}:`, vesselError);
            failedVessels.push(vesselId);
          }
        }
      }
      
      // Show feedback
      if (submittedVessels.length > 0) {
        toast({
          title: "Revisions submitted successfully",
          description: `Submitted revisions for ${submittedVessels.length} vessel(s). Drafts have been cleaned up.`
        });
        
        // Reset states after successful submission
        setSelectedVessels([]);
        setRevisionMode(false);
        setIsVesselEditing(false);
        setFlexDate("");
        
        // Clear loaded vessels tracking to allow fresh load next time
        loadedVesselsRef.current.clear();
      }
      
      if (failedVessels.length > 0) {
        toast({
          title: "Some submissions failed",
          description: `Failed to submit for ${failedVessels.length} vessel(s). Please try again.`,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error("Error submitting changes:", error);
      toast({
        title: "Error submitting revisions",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Check if any rank has multiple roles (2 or more) to show Role column
  const hasRoles = companyRankData.some(row => {
    if (row.isRoleRow && row.originalRankId) {
      const roleCount = companyRankData.filter(r => r.originalRankId === row.originalRankId).length;
      return roleCount >= 2;
    }
    return false;
  });

  // Check if vessel data has roles
  const vesselHasRoles = vesselRankData.some(row => {
    if (row.isRoleRow && row.originalRankId) {
      const roleCount = vesselRankData.filter(r => r.originalRankId === row.originalRankId).length;
      return roleCount >= 2;
    }
    return false;
  });

  // Vessel checkbox handling removed - using HTML tables now

  // Company checkbox handling removed - using HTML tables now

  // Single source of truth for checkbox columns with tier hierarchy
  const checkboxDescriptors: Array<{
    field: keyof CompanyRankData;
    labelByBp: { mobile: string; tablet: string; desktop: string };
    tier: "essential" | "standard" | "optional";
  }> = [
    { field: "officer", labelByBp: { mobile: "Off", tablet: "Officer", desktop: "Officer" }, tier: "essential" },
    { field: "rating", labelByBp: { mobile: "Rating", tablet: "Rating", desktop: "Rating" }, tier: "essential" },
    { field: "seniorOfficer", labelByBp: { mobile: "Sr Off", tablet: "Senior Officer", desktop: "Senior Officer" }, tier: "essential" },
    { field: "deckOfficer", labelByBp: { mobile: "Deck", tablet: "Deck Officer", desktop: "Deck Officer" }, tier: "standard" },
    { field: "engOfficer", labelByBp: { mobile: "Eng", tablet: "Eng Officer", desktop: "Eng Officer" }, tier: "standard" },
    { field: "pettyOfficer", labelByBp: { mobile: "Petty", tablet: "Petty Officer", desktop: "Petty Officer" }, tier: "optional" },
    { field: "deckRating", labelByBp: { mobile: "D.Rtg", tablet: "Deck Rating", desktop: "Deck Rating" }, tier: "optional" },
    { field: "engineRating", labelByBp: { mobile: "E.Rtg", tablet: "Engine Rating", desktop: "Engine Rating" }, tier: "optional" },
    { field: "generalRating", labelByBp: { mobile: "G.Rtg", tablet: "Gen Rating", desktop: "Gen Rating" }, tier: "optional" },
    { field: "cateringRating", labelByBp: { mobile: "C.Rtg", tablet: "Catering Rating", desktop: "Catering Rating" }, tier: "optional" },
    { field: "safetyOfficer", labelByBp: { mobile: "Safety", tablet: "Safety Officer", desktop: "Safety Officer" }, tier: "optional" },
    { field: "sso", labelByBp: { mobile: "SSO", tablet: "SSO", desktop: "SSO" }, tier: "optional" },
    { field: "medicalOfficer", labelByBp: { mobile: "Med", tablet: "Medical Officer", desktop: "Medical Officer" }, tier: "optional" },
    { field: "navigatingOfficer", labelByBp: { mobile: "Nav", tablet: "Nav. Officer", desktop: "Nav. Officer" }, tier: "optional" },
    { field: "emtOfficer", labelByBp: { mobile: "Envt", tablet: "Envt. Officer", desktop: "Envt. Officer" }, tier: "optional" }
  ];

  // Removed AG Grid buildCompanyCols - using HTML table instead
  const buildCompanyCols = (breakpoint: string, hasRoles: boolean, isEditing: boolean) => {
    // Function removed - using HTML tables now
    return [];
  };

  // Company column definitions removed - using placeholder for now

  // Removed AG Grid getRankMasterColumnDefs - using HTML table instead

  // Rank Master column definitions removed - using HTML table now

  // Vessel column definitions - exact structure as per user specification
  // Vessel checkbox column descriptors with responsive labels and priority
  const vesselCheckboxDescriptors = [
    { field: "actualManningFlag", labelByBp: { mobile: "Actual", tablet: "Actual Manning", desktop: "Actual Manning" }, tier: "essential", hasSpecialStyle: true },
    { field: "safeManning", labelByBp: { mobile: "Safe", tablet: "Safe Manning", desktop: "Safe Manning" }, tier: "essential" },
    { field: "optimumManning", labelByBp: { mobile: "Optimum", tablet: "Optimum Manning", desktop: "Optimum Manning" }, tier: "standard" },
    { field: "highWorkloadManning", labelByBp: { mobile: "High", tablet: "High Workload", desktop: "High Workload Manning" }, tier: "standard" },
    { field: "safetyOfficer", labelByBp: { mobile: "Safety", tablet: "Safety Officer", desktop: "Safety Officer" }, tier: "optional" },
    { field: "sso", labelByBp: { mobile: "SSO", tablet: "SSO", desktop: "SSO" }, tier: "optional" },
    { field: "medicalOfficer", labelByBp: { mobile: "Medical", tablet: "Medical Officer", desktop: "Medical Officer" }, tier: "optional" },
    { field: "navigatingOfficer", labelByBp: { mobile: "Nav", tablet: "Nav. Officer", desktop: "Nav. Officer" }, tier: "optional" },
    { field: "emtOfficer", labelByBp: { mobile: "Envt", tablet: "Envt. Officer", desktop: "Envt. Officer" }, tier: "optional" }
  ];

  // Removed AG Grid buildVesselCols - using HTML table instead
  const buildVesselCols = (breakpoint: string, hasRoles: boolean, isRevision: boolean) => {
    // Function removed - using HTML tables now
    return [];
  };

  // Vessel column definitions removed - using placeholder for now

  // Fetch forms data from API
  const { data: formsData = [], isLoading, error } = useQuery<Form[]>({
    queryKey: ["/api/forms"],
    enabled: selectedAdminPage === "forms",
    queryFn: async () => {
      const response = await fetch("/api/forms");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch all rank groups for forms tab (must be before expandedFormsData useMemo)
  const { data: allRankGroups = [] } = useQuery<RankGroup[]>({
    queryKey: ["/api/rank-groups", { includeArchived: true }],
    queryFn: async () => {
      const response = await fetch("/api/rank-groups?includeArchived=true");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: selectedAdminPage === "forms",
  });

  // Transform forms data to create separate rows for each rank group with category grouping
  // Filters out archived rank groups but keeps form rows visible even when all rank groups are archived
  const expandedFormsData = useMemo(() => {
    if (!formsData) return [];
    
    // Helper to check if a rank group is archived
    const isRankGroupArchivedByName = (rankGroupName: string, formId: number) => {
      const rankGroup = allRankGroups.find(rg => rg.name === rankGroupName && rg.formId === formId);
      return rankGroup?.archivedAt != null;
    };
    
    // Group forms by category first
    const formsByCategory = formsData.reduce((acc, form) => {
      const category = form.category || 'appraisal';
      if (!acc[category]) acc[category] = [];
      acc[category].push(form);
      return acc;
    }, {} as Record<string, Form[]>);
    
    const expanded: Array<Form & { 
      expandedRankGroup: string; 
      originalFormId: number; 
      isFirstInGroup: boolean; 
      groupSize: number;
      category: string;
      isCategoryHeader?: boolean;
      categoryRowSpan?: number;
      isFirstInCategory?: boolean;
      isPlaceholderRow?: boolean;
    }> = [];
    
    // Process each category in order (appraisal first, then promotion)
    const categoryOrder = ['appraisal', 'promotion'];
    categoryOrder.forEach(category => {
      const categoryForms = formsByCategory[category] || [];
      
      // Calculate total row count for this category (excluding archived rank groups)
      let totalCategoryRows = 0;
      categoryForms.forEach(form => {
        if (form.rankGroup && form.rankGroup.trim()) {
          const rankGroups = form.rankGroup.split(',').map(rg => rg.trim()).filter(rg => rg.length > 0);
          // Filter out archived rank groups
          const activeRankGroups = rankGroups.filter(rg => !isRankGroupArchivedByName(rg, form.id));
          // At least 1 row per form (placeholder if all archived)
          totalCategoryRows += Math.max(activeRankGroups.length, 1);
        } else {
          totalCategoryRows += 1;
        }
      });
      
      // Track if this is the first row in the category
      let isFirstRowInCategory = true;
      
      categoryForms.forEach((form) => {
        if (form.rankGroup && form.rankGroup.trim()) {
          // Split the concatenated rank groups and create separate rows
          const rankGroups = form.rankGroup.split(',').map(rg => rg.trim()).filter(rg => rg.length > 0);
          // Filter out archived rank groups
          const activeRankGroups = rankGroups.filter(rg => !isRankGroupArchivedByName(rg, form.id));
          
          if (activeRankGroups.length > 0) {
            // Add rows for active (non-archived) rank groups only
            activeRankGroups.forEach((rankGroup, index) => {
              expanded.push({
                ...form,
                id: form.id * 1000 + index, // Create unique numeric ID for each expanded row
                originalFormId: form.id, // Keep reference to original form ID
                expandedRankGroup: rankGroup,
                rankGroup: rankGroup, // Override the concatenated rankGroup with individual group
                isFirstInGroup: index === 0, // Mark first row for this form
                groupSize: activeRankGroups.length, // Track how many rows this form spans
                category: form.category || 'appraisal',
                isFirstInCategory: isFirstRowInCategory,
                categoryRowSpan: totalCategoryRows,
                isPlaceholderRow: false
              });
              isFirstRowInCategory = false;
            });
          } else {
            // All rank groups are archived - show a placeholder row so form remains visible
            expanded.push({
              ...form,
              id: form.id * 1000, // Unique ID for placeholder row
              originalFormId: form.id,
              expandedRankGroup: '',
              rankGroup: '',
              isFirstInGroup: true,
              groupSize: 1,
              category: form.category || 'appraisal',
              isFirstInCategory: isFirstRowInCategory,
              categoryRowSpan: totalCategoryRows,
              isPlaceholderRow: true
            });
            isFirstRowInCategory = false;
          }
        } else {
          // Form has no rank groups at all - show placeholder row
          expanded.push({
            ...form,
            id: form.id * 1000,
            originalFormId: form.id,
            expandedRankGroup: '',
            rankGroup: '',
            isFirstInGroup: true,
            groupSize: 1,
            category: form.category || 'appraisal',
            isFirstInCategory: isFirstRowInCategory,
            categoryRowSpan: totalCategoryRows,
            isPlaceholderRow: true
          });
          isFirstRowInCategory = false;
        }
      });
    });
    
    return expanded;
  }, [formsData, allRankGroups]);

  const { data: availableRanks = [] } = useQuery<AvailableRank[]>({
    queryKey: ["/api/available-ranks"],
    queryFn: async () => {
      const response = await fetch("/api/available-ranks");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const createRankGroupMutation = useMutation({
    mutationFn: async (data: { formId: number; name: string; ranks: string[] }) => {
      return await apiRequest("POST", "/api/rank-groups", data);
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      rq.invalidateQueries({ queryKey: ["/api/rank-groups"] });
      setIsAddRankGroupOpen(false);
      setSelectedFormForRankGroup(null);
      setEditingRankGroupData(null);
    },
  });

  const updateRankGroupMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; ranks: string[] }) => {
      return await apiRequest("PUT", `/api/rank-groups/${data.id}`, { name: data.name, ranks: data.ranks });
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      rq.invalidateQueries({ queryKey: ["/api/rank-groups"] });
      setIsAddRankGroupOpen(false);
      setSelectedFormForRankGroup(null);
      setEditingRankGroupData(null);
      toast({
        title: "Success",
        description: "Rank group updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update rank group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const archiveRankGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/rank-groups/${id}/archive`, {});
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      // Invalidate all rank-groups queries (including those with includeArchived param)
      rq.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/rank-groups";
        }
      });
      toast({
        title: "Success",
        description: "Rank group archived successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to archive rank group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const unarchiveRankGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/rank-groups/${id}/unarchive`, {});
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      rq.invalidateQueries({ queryKey: ["/api/rank-groups"] });
      toast({
        title: "Success",
        description: "Rank group restored successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to restore rank group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; rankGroup: string; versionNo: string; versionDate: string }) => {
      return await apiRequest("POST", "/api/forms", data);
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      setShowCreateFormDialog(false);
      setNewFormName("");
      setNewFormCategory("appraisal");
      setSelectedTemplate("");
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: async (formId: number) => {
      if (import.meta.env.DEV) {
        console.log('🗑️ [DELETE DEBUG] Making DELETE request for form ID:', formId);
      }
      return await apiRequest("DELETE", `/api/forms/${formId}`);
    },
    onSuccess: () => {
      // Invalidate cache on success
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({
        title: "Success",
        description: "Form deleted successfully",
      });
      if (import.meta.env.DEV) {
        console.log('✅ [DELETE DEBUG] Form deleted successfully');
      }
    },
    onError: (error: any) => {
      // Also invalidate cache on error to refresh state
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      
      // Extract specific error message from server response
      let errorMessage = "Failed to delete form";
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      if (import.meta.env.DEV) {
        console.error('❌ [DELETE DEBUG] Form deletion failed:', error);
        console.error('❌ [DELETE DEBUG] Error details:', {
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message
        });
      }
    },
  });


  const handleDeleteForm = (form: Form) => {
    // Debug logging for ID mismatch prevention
    if (import.meta.env.DEV) {
      console.log('🗑️ [DELETE DEBUG] Attempting to delete form:', form);
      console.log('🗑️ [DELETE DEBUG] Form ID:', form.id);
      console.log('🗑️ [DELETE DEBUG] Form name:', form.name);
    }
    
    if (window.confirm(`Are you sure you want to delete the form "${form.name}"?`)) {
      deleteFormMutation.mutate(form.id);
    }
  };

  const handleEditClick = (form: Form) => {
    setEditingForm(form);
    setEditingRankGroup(form.rankGroup || ""); // Use the actual rank group from the form
  };

  const handleAddRankGroup = (formName: string) => {
    setSelectedFormForRankGroup(formName);
    setEditingRankGroupData(null); // Clear edit mode
    setIsAddRankGroupOpen(true);
  };

  const handleEditRankGroup = (rankGroupName: string, formId: number) => {
    // Find the rank group by name and formId from fetched data
    const rankGroup = allRankGroups.find(rg => rg.name === rankGroupName && rg.formId === formId);
    if (rankGroup) {
      setEditingRankGroupData(rankGroup);
      setSelectedFormForRankGroup(null); // Not adding to a specific form
      setIsAddRankGroupOpen(true);
    }
  };

  const handleArchiveRankGroup = (rankGroupName: string, formId: number) => {
    const rankGroup = allRankGroups.find(rg => rg.name === rankGroupName && rg.formId === formId);
    if (rankGroup) {
      setPendingArchiveRankGroup({ id: rankGroup.id, name: rankGroupName });
      setArchiveConfirmOpen(true);
    }
  };

  const confirmArchiveRankGroup = () => {
    if (pendingArchiveRankGroup) {
      archiveRankGroupMutation.mutate(pendingArchiveRankGroup.id);
    }
    setArchiveConfirmOpen(false);
    setPendingArchiveRankGroup(null);
  };

  const handleUnarchiveRankGroup = (rankGroupName: string, formId: number) => {
    const rankGroup = allRankGroups.find(rg => rg.name === rankGroupName && rg.formId === formId);
    if (rankGroup) {
      unarchiveRankGroupMutation.mutate(rankGroup.id);
    }
  };

  const getRankGroupRanks = (rankGroupName: string, formId?: number) => {
    // Try to find in fetched rank groups first
    const rankGroup = allRankGroups.find(rg => 
      rg.name === rankGroupName && (!formId || rg.formId === formId)
    );
    
    if (rankGroup) {
      try {
        const ranks = typeof rankGroup.ranks === 'string' 
          ? JSON.parse(rankGroup.ranks) 
          : rankGroup.ranks;
        if (Array.isArray(ranks) && ranks.length > 0) {
          return ranks.join(", ");
        }
      } catch (e) {
        console.error('Error parsing ranks:', e);
      }
    }
    
    // Fallback for legacy hardcoded values
    switch (rankGroupName) {
      case "Senior Officers":
        return "Master, Chief Officer, Chief Engineer";
      case "Junior Officers":
        return "2nd Officer, 3rd Officer, 2nd Engineer, 3rd Engineer";
      case "Ratings":
        return "Bosun, AB, OS, Oiler, Wiper";
      default:
        return "No ranks assigned";
    }
  };

  const isRankGroupArchived = (rankGroupName: string, formId: number) => {
    const rankGroup = allRankGroups.find(rg => rg.name === rankGroupName && rg.formId === formId);
    return rankGroup?.archivedAt ? true : false;
  };

  const handleCreateForm = () => {
    if (!newFormName.trim()) return;

    const formData = {
      name: newFormName.trim(),
      category: newFormCategory,
      rankGroup: "", // Empty string for forms without rank groups
      versionNo: "00",
      versionDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(/ /g, '-')
    };

    createFormMutation.mutate(formData);

    // If using a template, generate the form editor
    if (createFormType === "template" && selectedTemplate) {
      try {
        createFormEditor(selectedTemplate);
        console.log(`Form Editor created for: ${selectedTemplate}`);
      } catch (error) {
        console.error("Error creating form editor:", error);
      }
    }
  };

  const updateFormMutation = useMutation({
    mutationFn: async ({formId, configuration, sharedConfig}: {formId: number; configuration?: string; sharedConfig?: Record<string, unknown>}) => {
      const updateData: Record<string, unknown> = {};
      if (configuration) updateData.configuration = configuration;
      // Serialize sharedConfig to JSON string for storage
      if (sharedConfig) updateData.sharedConfig = JSON.stringify(sharedConfig);
      return apiRequest('PUT', `/api/forms/${formId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({
        title: "Success",
        description: "Form configuration saved successfully",
      });
      setEditingForm(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to save form configuration: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFormSave = (formData: any) => {
    console.log("Saving form configuration:", formData);
    if (formData.formId) {
      updateFormMutation.mutate({
        formId: formData.formId,
        configuration: formData.configuration,
        sharedConfig: formData.sharedConfig,
      });
    }
  };

  const handleCloseEditor = () => {
    setEditingForm(null);
    setEditingRankGroup(null);
  };

  // Render functions for each tab to isolate JSX structure
  const renderRankMasterTab = () => (
    <>
      {/* Rank Master tab content will be moved here */}
    </>
  );

  const renderCompanyTab = () => (
    <div className="h-full flex flex-col">
      {/* Company Header with Edit/Save buttons */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-gray-900">Company Ranks</h3>
          <span className="text-sm text-gray-500">
            ({companyRankData.length} ranks)
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isCompanyEditing ? "default" : "outline"}
            onClick={isCompanyEditing ? handleSaveCompany : handleEditCompany}
            className={`h-8 text-xs ${
              isCompanyEditing 
                ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                : "border-[#e1e8ed] text-[#16569e]"
            }`}
            data-testid={isCompanyEditing ? "button-save-company" : "button-edit-company"}
          >
            {isCompanyEditing ? "Save" : "Edit Table"}
          </Button>
        </div>
      </div>
      
      {/* Company Table with Vertical Scroll */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <ScrollArea className="flex-1 w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                <TableHead className="text-white text-xs font-normal w-4 sticky top-0 z-30 bg-[#52baf3] shadow-sm"></TableHead>
                <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">Rank</TableHead>
                {companyRankData.some(rank => rank.isRoleRow) && (
                  <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Position</TableHead>
                )}
                <TableHead className="text-white text-xs font-normal w-20 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Rank ID (Sail)</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Rating</TableHead>
                <TableHead className="text-white text-xs font-normal w-20 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Senior Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Deck Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Eng Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Petty Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Deck Rating</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Engine Rating</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Gen Catering Rating</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Safety Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">SSO</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Medical Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Navigating Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-16 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Envt. Officer</TableHead>
                <TableHead className="text-white text-xs font-normal w-20 text-center sticky top-0 z-30 bg-[#52baf3] shadow-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // Filter ranks to hide parent ranks when role variants exist
                const displayRows = companyRankData.filter(rank => {
                  if (rank.isRoleRow) return true; // Always show role rows
                  // Hide parent rows if they have role rows
                  const hasRoleRows = companyRankData.some(r => r.originalRankId === rank.id && r.isRoleRow);
                  return !hasRoleRows;
                });
                return displayRows;
              })().map((rank) => (
                <TableRow key={rank.id} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
                  <TableCell className="w-4"></TableCell>
                  <TableCell className="font-medium">{rank.rank}</TableCell>
                  {companyRankData.some(rank => rank.isRoleRow) && (
                    <TableCell className="text-gray-600">
                      {rank.isRoleRow ? (rank.role || rank.rank) : ""}
                    </TableCell>
                  )}
                  <TableCell className="text-gray-600">{rank.rankId}</TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.officer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, officer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.rating || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, rating: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-rating-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.seniorOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, seniorOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-senior-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.deckOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, deckOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-deck-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.engOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, engOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-eng-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.pettyOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, pettyOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-petty-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.deckRating || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, deckRating: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-deck-rating-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.engineRating || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, engineRating: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-engine-rating-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.cateringRating || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, cateringRating: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-catering-rating-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.safetyOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, safetyOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-safety-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.sso || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, sso: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-sso-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.medicalOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, medicalOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-medical-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.navigatingOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, navigatingOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-navigating-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={rank.emtOfficer || false}
                      onChange={(e) => {
                        setCompanyRankData(prev => 
                          prev.map(r => r.id === rank.id ? { ...r, emtOfficer: e.target.checked } : r)
                        );
                      }}
                      disabled={!isCompanyEditing}
                      className="h-4 w-4"
                      data-testid={`company-emt-officer-${rank.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {rank.isRoleRow ? (
                      // Check if this is the first role variant (should show Multiple button)
                      (() => {
                        const roleVariants = companyRankData.filter(r => 
                          r.isRoleRow && r.originalRankId === rank.originalRankId
                        );
                        const sortedVariants = roleVariants.sort((a, b) => {
                          const aNum = parseInt(a.role?.match(/_(\d+)$/)?.[1] || '0', 10);
                          const bNum = parseInt(b.role?.match(/_(\d+)$/)?.[1] || '0', 10);
                          return aNum - bNum;
                        });
                        const isFirstVariant = sortedVariants[0]?.id === rank.id;
                        
                        return isFirstVariant ? (
                          // First role variant shows Multiple button to create more variants
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-2 py-1 h-6"
                            onClick={() => handleMultiple(rank.originalRankId || rank.id)}
                            disabled={!isCompanyEditing}
                            data-testid={`button-multiple-${rank.originalRankId || rank.id}`}
                          >
                            Multiple
                          </Button>
                        ) : (
                          // Subsequent role variants show delete button
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteCompanyRank(rank.id)}
                            disabled={!isCompanyEditing}
                            data-testid={`button-delete-company-${rank.id}`}
                            title="Delete role variant"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        );
                      })()
                    ) : rank.hasMultiple ? (
                      // Regular ranks with hasMultiple show Multiple button
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 py-1 h-6"
                        onClick={() => handleMultiple(rank.id)}
                        disabled={!isCompanyEditing}
                        data-testid={`button-multiple-${rank.id}`}
                      >
                        Multiple
                      </Button>
                    ) : (
                      // Only Master rank shows delete button (hasMultiple: false)
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteCompanyRank(rank.id)}
                        disabled={!isCompanyEditing}
                        data-testid={`button-delete-company-${rank.id}`}
                        title="Delete rank"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {companyRankData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={companyRankData.some(r => r.isRoleRow) ? 19 : 18} className="text-center py-8">
                    <div className="text-gray-500 text-sm">
                      No company ranks available. Mark ranks as "Applicable to Company" in Rank Master tab.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );

  const renderVesselTab = () => (
    <>
      {/* Vessel tab content will be moved here */}
    </>
  );

  // PERFORMANCE: Removed debug logging to avoid re-render console noise

  const renderRankAdminModule = () => (
    <div className="h-full flex flex-col">
      {/* Responsive Header Layout */}
      <div className={`mb-4 ${currentBreakpoint === 'mobile' ? 'space-y-3' : currentBreakpoint === 'tablet' ? 'space-y-3' : 'grid grid-cols-3 items-center'}`}>
        {/* Title */}
        <div className={`${currentBreakpoint === 'mobile' || currentBreakpoint === 'tablet' ? 'text-center' : ''}`}>
          <h1 className={`font-bold text-black ${currentBreakpoint === 'mobile' ? 'text-xl' : currentBreakpoint === 'tablet' ? 'text-xl' : 'text-2xl'}`}>
            Rank Administration
          </h1>
        </div>
        
        {/* Desktop/Laptop Tab Switcher */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div className="flex justify-center">
            <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
              {[
                { id: "rank-master", label: "Rank Master" },
                { id: "company", label: "Company" },
                { id: "vessel", label: "Vessel" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    // Check for unsaved changes before switching tabs
                    if (hasUnsavedChanges()) {
                      // For tab switching, we'll store the tab change action
                      setPendingTarget(`rank-admin-tab-${tab.id}`);
                      setShowUnsavedChangesDialog(true);
                      return;
                    }
                    setSelectedRankAdminTab(tab.id);
                  }}
                  className={`px-4 text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                    selectedRankAdminTab === tab.id
                      ? "text-[#16569e] font-bold underline"
                      : "text-gray-600 hover:text-gray-800 font-medium"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Tablet/Mobile Tab Switcher and Action Buttons Row */}
        {(currentBreakpoint === 'tablet' || currentBreakpoint === 'mobile') && (
          <div className={`${currentBreakpoint === 'mobile' ? 'space-y-2' : 'flex items-center justify-between'}`}>
            {/* Tab Switcher */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'justify-center' : 'justify-start'}`}>
              <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
                {[
                  { id: "rank-master", label: currentBreakpoint === 'mobile' ? "R.Master" : "Rank Master" },
                  { id: "company", label: "Company" },
                  { id: "vessel", label: "Vessel" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      // Check for unsaved changes before switching tabs
                      if (hasUnsavedChanges()) {
                        // For tab switching, we'll store the tab change action
                        setPendingTarget(`rank-admin-tab-${tab.id}`);
                        setShowUnsavedChangesDialog(true);
                        return;
                      }
                      setSelectedRankAdminTab(tab.id);
                    }}
                    className={`${currentBreakpoint === 'mobile' ? 'px-2' : 'px-3'} text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                      selectedRankAdminTab === tab.id
                        ? "text-[#16569e] font-bold underline"
                        : "text-gray-600 hover:text-gray-800 font-medium"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Action Buttons for Tablet/Mobile */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'justify-center' : 'justify-end'}`}>
              {selectedRankAdminTab === "rank-master" && (
                <div className={`flex ${responsive.stackButtons ? 'flex-col space-y-1' : 'gap-2'}`}>
                  <Button
                    variant={isRankMasterEditing ? "default" : "outline"}
                    onClick={isRankMasterEditing ? handleSaveRank : handleEditRank}
                    className={`h-8 text-xs ${
                      isRankMasterEditing 
                        ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                        : "border-[#e1e8ed] text-[#16569e]"
                    }`}
                  >
                    {isRankMasterEditing ? "Save" : "Edit Rank"}
                  </Button>
                  <Button
                    onClick={() => {
                      // Force refresh rank data to clear any stale cache
                      rq.invalidateQueries({ queryKey: ["/api/available-ranks"] });
                      toast({
                        title: "Data refreshed",
                        description: "Rank data has been refreshed from the database.",
                        duration: 2000,
                      });
                    }}
                    variant="outline"
                    className="hidden h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
                    data-testid="button-refresh-ranks-mobile"
                  >
                    🔄 Refresh
                  </Button>
                  <Button
                    onClick={handleNewRank}
                    className="h-8 bg-[#5dc86f] hover:bg-[#22c55e] text-white text-xs"
                  >
                    + New Rank
                  </Button>
                  <Button
                    onClick={handleCleanupAllRanks}
                    disabled={clearAllRanksMutation.isPending}
                    className="hidden h-8 bg-red-600 hover:bg-red-700 text-white text-xs"
                    data-testid="button-clear-all-ranks-mobile"
                  >
                    {clearAllRanksMutation.isPending ? "Clearing..." : "🗑️ Clear All"}
                  </Button>
                  <Button
                    onClick={() => setIsPromotionHierarchyOpen(true)}
                    variant="outline"
                    className="h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
                    data-testid="button-promotion-hierarchy-mobile"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Promotion Hierarchy
                  </Button>
                </div>
              )}
              {selectedRankAdminTab === "vessel" && (
                <div className={`flex ${responsive.stackButtons ? 'flex-col space-y-1' : 'gap-2'}`}>
                  {!revisionMode ? (
                    <Button
                      onClick={handleRevision}
                      disabled={selectedVessels.length === 0}
                      className={`h-8 text-xs ${
                        selectedVessels.length === 0 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-[#5dc86f] hover:bg-[#22c55e] text-white'
                      }`}
                      data-testid="revision-button"
                    >
                      + Revision
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleCancel}
                        className="h-8 bg-[#ff6961] hover:bg-[#ff5449] text-[#fdfcfc] text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          console.log('🔴 [CLICK DEBUG] Save Draft button clicked!');
                          console.log('🔴 [CLICK DEBUG] selectedVessels length:', selectedVessels.length);
                          console.log('🔴 [CLICK DEBUG] selectedVessels:', selectedVessels);
                          console.log('🔴 [CLICK DEBUG] revisionMode:', revisionMode);
                          handleSaveDraft();
                        }}
                        className="h-8 bg-[#15569e] hover:bg-[#0f4078] text-white text-xs"
                      >
                        Save Draft
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow px-4 py-2 h-8 hover:bg-[#0f4078] text-white text-xs bg-[#00AF7B]"
                      >
                        Submit
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Desktop/Laptop Action Buttons */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div className="flex justify-end">
            {selectedRankAdminTab === "rank-master" && (
              <div className="flex gap-2">
                <Button
                  variant={isRankMasterEditing ? "default" : "outline"}
                  onClick={isRankMasterEditing ? handleSaveRank : handleEditRank}
                  className={`h-8 text-xs ${
                    isRankMasterEditing 
                      ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                      : "border-[#e1e8ed] text-[#16569e]"
                  }`}
                >
                  {isRankMasterEditing ? "Save" : "Edit Rank"}
                </Button>
                <Button
                  onClick={() => {
                    // Force refresh rank data to clear any stale cache
                    rq.invalidateQueries({ queryKey: ["/api/available-ranks"] });
                    toast({
                      title: "Data refreshed",
                      description: "Rank data has been refreshed from the database.",
                      duration: 2000,
                    });
                  }}
                  variant="outline"
                  className="hidden h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
                  data-testid="button-refresh-ranks"
                >
                  🔄 Refresh
                </Button>
                <Button
                  onClick={handleNewRank}
                  className="h-8 bg-[#5dc86f] hover:bg-[#22c55e] text-white text-xs"
                >
                  + New Rank
                </Button>
                <Button
                  onClick={handleCleanupAllRanks}
                  disabled={clearAllRanksMutation.isPending}
                  className="hidden h-8 bg-red-600 hover:bg-red-700 text-white text-xs"
                  data-testid="button-clear-all-ranks"
                >
                  {clearAllRanksMutation.isPending ? "Clearing..." : "🗑️ Clear All"}
                </Button>
                <Button
                  onClick={() => setIsPromotionHierarchyOpen(true)}
                  variant="outline"
                  className="h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
                  data-testid="button-promotion-hierarchy"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Promotion Hierarchy
                </Button>
              </div>
            )}
            {selectedRankAdminTab === "vessel" && (
              <div className="flex gap-2">
                {!revisionMode ? (
                  <Button
                    onClick={handleRevision}
                    disabled={selectedVessels.length === 0}
                    className={`h-8 text-xs ${
                      selectedVessels.length === 0 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#5dc86f] hover:bg-[#22c55e] text-white'
                    }`}
                    data-testid="revision-button"
                  >
                    + Revision
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCancel}
                      className="h-8 bg-[#ff6961] hover:bg-[#ff5449] text-[#fdfcfc] text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveDraft}
                      className="h-8 bg-[#15569e] hover:bg-[#0f4078] text-white text-xs"
                    >
                      Save Draft
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow px-4 py-2 h-8 hover:bg-[#0f4078] text-white text-xs bg-[#00AF7B]"
                    >
                      Submit
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden pt-4 pb-4 pl-0">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex-1 flex flex-col overflow-hidden">
          <CardContent className="pt-4 pb-4 pl-0 flex-1 flex flex-col overflow-hidden">
            {selectedRankAdminTab === "rank-master" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto relative">
                  <Table className="relative">
                  <TableHeader className="sticky top-0 z-40">
                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                      <TableHead className="text-white text-xs font-normal text-center py-2 border-r border-white/20 bg-[#52baf3]">Rank ID</TableHead>
                      <TableHead className="text-white text-xs font-normal text-center py-2 border-r border-white/20 bg-[#52baf3]">Rank</TableHead>
                      <TableHead className="text-white text-xs font-normal text-center py-2 border-r border-white/20 bg-[#52baf3]">Applicable to Company</TableHead>
                      <TableHead className="text-white text-xs font-normal text-center py-2 border-r border-white/20 bg-[#52baf3]">Rank Label</TableHead>
                      <TableHead className="text-white text-xs font-normal text-center py-2 bg-[#52baf3]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankMasterData.map((rank, index) => (
                      <TableRow key={rank.id} className="bg-white" data-testid={`row-rank-master-${rank.id}`}>
                        <TableCell className="py-3 text-center border-r">
                          <span 
                            className={`text-sm ${rank.id.startsWith('new_') ? 'text-gray-400 italic' : ''}`} 
                            data-testid={`text-rank-id-${rank.id}`}
                            title={rank.id.startsWith('new_') ? 'Rank ID will be auto-generated when saved' : ''}
                          >
                            {rank.id.startsWith('new_') ? 'Auto' : (rank.rankId || '')}
                          </span>
                        </TableCell>
                        
                        <TableCell className="py-3 text-center border-r">
                          {isRankMasterEditing && !rank.isSystemRank ? (
                            <input
                              type="text"
                              value={rank.rank || ''}
                              onChange={(e) => handleRankDataChange(rank.id, 'rank', e.target.value)}
                              placeholder="Enter rank name"
                              className="w-full h-8 px-2 text-sm border rounded"
                              data-testid={`input-rank-${rank.id}`}
                            />
                          ) : (
                            <span className={`text-sm ${rank.isSystemRank ? 'text-gray-700' : ''}`} data-testid={`text-rank-${rank.id}`} title={rank.isSystemRank ? 'System rank - cannot be edited' : ''}>{rank.rank || ''}</span>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-center py-3 border-r">
                          <Checkbox
                            checked={rank.applicableToCompany}
                            onCheckedChange={(checked) => handleRankDataChange(rank.id, 'applicableToCompany', checked)}
                            disabled={!isRankMasterEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-applicable-company-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="py-3 text-center border-r">
                          {!rank.applicableToCompany ? (
                            <span className="text-gray-400 text-xs" data-testid={`text-rank-label-na-${rank.id}`}>N/A</span>
                          ) : isRankMasterEditing ? (
                            <input
                              type="text"
                              value={rank.label || ''}
                              onChange={(e) => handleRankDataChange(rank.id, 'label', e.target.value)}
                              placeholder="Enter rank label"
                              className="w-full h-8 px-2 text-sm border rounded"
                              data-testid={`input-rank-label-${rank.id}`}
                            />
                          ) : (
                            <span className="text-sm" data-testid={`text-rank-label-${rank.id}`}>{rank.label || ''}</span>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isRankMasterEditing && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMoveRankUp(index)}
                                  disabled={index === 0}
                                  className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed"
                                  data-testid={`button-move-up-${rank.id}`}
                                  title="Move rank up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMoveRankDown(index)}
                                  disabled={index === rankMasterData.length - 1}
                                  className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed"
                                  data-testid={`button-move-down-${rank.id}`}
                                  title="Move rank down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                                {!rank.isSystemRank && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteRank(rank.id)}
                                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                                    data-testid={`button-delete-rank-${rank.id}`}
                                    title="Delete rank"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {selectedRankAdminTab === "company" && renderCompanyTab()}
            {selectedRankAdminTab === "vessel" && (
              <div className="h-full flex flex-col">
                {/* Vessel Filters */}
                <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'flex-wrap gap-4'} mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg`}>
                  <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'gap-4 flex-wrap'}`}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={`h-8 ${currentBreakpoint === 'mobile' ? 'w-full' : 'w-48'} justify-between text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] bg-transparent hover:bg-transparent`}
                          data-testid="vessel-select"
                        >
                          {selectedVessels.length === 0 
                            ? "Select Vessel or Group to Edit" 
                            : selectedVessels.length === 1 
                              ? vesselOptions.find((v: VesselOption) => v.value === selectedVessels[0])?.label
                              : `${selectedVessels.length} vessels selected`
                          }
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className={`${currentBreakpoint === 'mobile' ? 'w-[280px]' : 'w-[200px]'} p-0`}>
                        <Command>
                          <CommandInput placeholder="Search vessels..." className="h-9" />
                          <CommandEmpty>No vessel found.</CommandEmpty>
                          <CommandGroup>
                            {vesselOptions.map((vessel: VesselOption) => (
                              <CommandItem
                                key={vessel.value}
                                value={`${vessel.label} ${vessel.value}`}
                                onSelect={() => {
                                  // Handle vessel group selection
                                  if (vessel.type === 'group' && vessel.vesselIds) {
                                    // Parse vesselIds if it's a JSON string
                                    const groupVesselIds = Array.isArray(vessel.vesselIds) 
                                      ? vessel.vesselIds 
                                      : JSON.parse(vessel.vesselIds || '[]');
                                    const allGroupVesselsSelected = groupVesselIds.every((id: string) => selectedVessels.includes(id));
                                    
                                    if (allGroupVesselsSelected) {
                                      // Deselect all vessels in the group
                                      setSelectedVessels(selectedVessels.filter(v => !groupVesselIds.includes(v)));
                                    } else {
                                      // Select all vessels in the group (add only missing ones)
                                      const newVessels = groupVesselIds.filter((id: string) => !selectedVessels.includes(id));
                                      setSelectedVessels([...selectedVessels, ...newVessels]);
                                    }
                                  } else {
                                    // Handle individual vessel selection
                                    const isSelected = selectedVessels.includes(vessel.value);
                                    if (isSelected) {
                                      setSelectedVessels(selectedVessels.filter(v => v !== vessel.value));
                                    } else {
                                      setSelectedVessels([...selectedVessels, vessel.value]);
                                    }
                                  }
                                }}
                                className="text-xs"
                              >
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    checked={(() => {
                                      if (vessel.type === 'group' && vessel.vesselIds) {
                                        // Parse vesselIds if it's a JSON string
                                        const vesselIdArray = Array.isArray(vessel.vesselIds) 
                                          ? vessel.vesselIds 
                                          : JSON.parse(vessel.vesselIds || '[]');
                                        return vesselIdArray.every((id: string) => selectedVessels.includes(id));
                                      }
                                      return selectedVessels.includes(vessel.value);
                                    })()}
                                    className="h-4 w-4"
                                  />
                                  <span>{vessel.label}</span>
                                </div>
                                <Check
                                  className={`ml-auto h-4 w-4 ${
                                    (() => {
                                      if (vessel.type === 'group' && vessel.vesselIds) {
                                        // Parse vesselIds if it's a JSON string
                                        const vesselIdArray = Array.isArray(vessel.vesselIds) 
                                          ? vessel.vesselIds 
                                          : JSON.parse(vessel.vesselIds || '[]');
                                        return vesselIdArray.every((id: string) => selectedVessels.includes(id)) ? "opacity-100" : "opacity-0";
                                      }
                                      return selectedVessels.includes(vessel.value) ? "opacity-100" : "opacity-0";
                                    })()
                                  }`}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Settings icon for Vessel Group management */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-[#0f172a] hover:bg-gray-50"
                      onClick={() => setIsVesselGroupModalOpen(true)}
                      data-testid="vessel-group-settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>

                    {/* Display auto-assigned next revision */}
                    <div className="h-8 w-32 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-xs text-[#0f172a]" data-testid="next-revision-display">
                      <span className="font-medium">Next: {nextRevision}</span>
                    </div>

                    <Input
                      type="date"
                      placeholder="dd/mm/yyyy"
                      value={flexDate}
                      onChange={(e) => setFlexDate(e.target.value)}
                      className="h-8 w-36 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] pr-8"
                      disabled={!revisionMode}
                      data-testid="flex-date-input"
                    />
                  </div>
                </div>

                {/* Selected Vessels Revision Indicator */}
                {revisionMode && selectedVessels.length > 0 && (
                  <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 ${currentBreakpoint === 'mobile' ? 'text-sm' : ''}`} data-testid="selected-vessels-indicator">
                    <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-2' : 'items-center justify-between'}`}>
                      <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-1' : 'items-center space-x-2'}`}>
                        <div className={`${currentBreakpoint === 'mobile' ? 'text-xs' : 'text-sm'} font-medium text-blue-800`}>
                          Revision Mode - Editing {selectedVessels.length} vessel{selectedVessels.length > 1 ? 's' : ''}:
                        </div>
                        <div className="flex space-x-1">
                          {selectedVessels.map((vesselId) => (
                            <span
                              key={vesselId}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {vesselOptions.find((v: VesselOption) => v.value === vesselId)?.label || vesselId}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-blue-600">
                        Changes apply to all selected vessels
                      </div>
                    </div>
                  </div>
                )}

                {/* Vessel Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-auto flex-1">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                          <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Rank
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 border-r border-white/30 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Actual Manning
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Safe Manning
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Optimum Manning
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-20 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            High Workload Manning
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Safety Officer
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-12 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            SSO
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Medical Officer
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Nav Officer
                          </TableHead>
                          <TableHead className="text-white text-xs font-normal text-center w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                            Envt Officer
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedVessels.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                              Please select one or more vessels to view rank data
                            </TableCell>
                          </TableRow>
                        ) : (
                          (() => {
                            // Use company rank data as canonical source, not individual vessel data
                            const displayRows = companyRankData.filter(rank => {
                              if (rank.isRoleRow) return true; // Always show role rows
                              // Hide parent rows if they have role rows
                              const hasRoleRows = companyRankData.some(r => r.originalRankId === rank.id && r.isRoleRow);
                              return !hasRoleRows;
                            });

                            return displayRows.map((rank, index) => (
                              <TableRow key={rank.id} className="hover:bg-gray-50">
                                {/* Rank column */}
                                <TableCell className="text-xs">
                                  <div className="font-medium">
                                    {rank.isRoleRow ? rank.role : rank.rank}
                                  </div>
                                </TableCell>

                                {/* Actual Manning checkbox */}
                                <TableCell 
                                  className={`text-center border-r border-gray-200 p-2 ${
                                    revisionMode && selectedVessels.length > 0 
                                      ? 'cursor-pointer hover:bg-gray-50' 
                                      : 'cursor-not-allowed opacity-50'
                                  }`}
                                  title={!revisionMode 
                                    ? "Enter Revision Mode to edit" 
                                    : selectedVessels.length === 0 
                                      ? "Select a vessel first to edit" 
                                      : "Click to toggle Actual Manning"}
                                  onClick={() => {
                                    if (!revisionMode || selectedVessels.length === 0) return;
                                    console.log('🔧 [CELL CLICKED] Toggling actual manning for rank:', rank.id);
                                    const firstVesselId = selectedVessels[0];
                                    if (firstVesselId) {
                                      const vesselRank = currentVesselRankLookup.get(rank.id);
                                      const newValue = !(vesselRank?.actualManningFlag || false);
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, actualManningFlag: newValue } : r)
                                      );
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.actualManningFlag || false}
                                    onChange={() => {}} // Handled by cell onClick
                                    disabled={!revisionMode}
                                    className="h-4 w-4 pointer-events-none"
                                    data-testid={`vessel-actual-manning-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Safe Manning checkbox */}
                                <TableCell 
                                  className={`text-center p-2 ${
                                    revisionMode && selectedVessels.length > 0 
                                      ? 'cursor-pointer hover:bg-gray-50' 
                                      : 'cursor-not-allowed opacity-50'
                                  }`}
                                  title={!revisionMode 
                                    ? "Enter Revision Mode to edit" 
                                    : selectedVessels.length === 0 
                                      ? "Select a vessel first to edit" 
                                      : "Click to toggle Safe Manning"}
                                  onClick={() => {
                                    if (!revisionMode || selectedVessels.length === 0) return;
                                    const firstVesselId = selectedVessels[0];
                                    if (firstVesselId) {
                                      const vesselRank = currentVesselRankLookup.get(rank.id);
                                      const newValue = !(vesselRank?.safeManning || false);
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, safeManning: newValue } : r)
                                      );
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.safeManning || false}
                                    onChange={() => {}} // Handled by cell onClick
                                    disabled={!revisionMode}
                                    className="h-4 w-4 pointer-events-none"
                                    data-testid={`vessel-safe-manning-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Optimum Manning checkbox */}
                                <TableCell 
                                  className={`text-center p-2 ${
                                    revisionMode && selectedVessels.length > 0 
                                      ? 'cursor-pointer hover:bg-gray-50' 
                                      : 'cursor-not-allowed opacity-50'
                                  }`}
                                  title={!revisionMode 
                                    ? "Enter Revision Mode to edit" 
                                    : selectedVessels.length === 0 
                                      ? "Select a vessel first to edit" 
                                      : "Click to toggle Optimum Manning"}
                                  onClick={() => {
                                    if (!revisionMode || selectedVessels.length === 0) return;
                                    const firstVesselId = selectedVessels[0];
                                    if (firstVesselId) {
                                      const vesselRank = currentVesselRankLookup.get(rank.id);
                                      const newValue = !(vesselRank?.optimumManning || false);
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, optimumManning: newValue } : r)
                                      );
                                    }
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.optimumManning || false}
                                    onChange={() => {}} // Handled by cell onClick
                                    disabled={!revisionMode}
                                    className="h-4 w-4 pointer-events-none"
                                    data-testid={`vessel-optimum-manning-${rank.id}`}
                                  />
                                </TableCell>

                                {/* High Workload Manning checkbox */}
                                <TableCell 
                                  className={`text-center p-2 ${
                                    revisionMode && selectedVessels.length > 0 
                                      ? 'cursor-pointer hover:bg-gray-50' 
                                      : 'cursor-not-allowed opacity-50'
                                  }`}
                                  title={!revisionMode 
                                    ? "Enter Revision Mode to edit" 
                                    : selectedVessels.length === 0 
                                      ? "Select a vessel first to edit" 
                                      : "Click to toggle High Workload Manning"}
                                >
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.highWorkloadManning || false}
                                    onChange={(e) => {
                                      if (!revisionMode || selectedVessels.length === 0) return;
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, highWorkloadManning: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode || selectedVessels.length === 0}
                                    className="h-4 w-4 cursor-pointer"
                                    data-testid={`vessel-high-workload-manning-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Safety Officer checkbox */}
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.safetyOfficer || false}
                                    onChange={(e) => {
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, safetyOfficer: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode}
                                    className="h-4 w-4"
                                    data-testid={`vessel-safety-officer-${rank.id}`}
                                  />
                                </TableCell>

                                {/* SO checkbox */}
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.sso || false}
                                    onChange={(e) => {
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, sso: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode}
                                    className="h-4 w-4"
                                    data-testid={`vessel-sso-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Medical Officer checkbox */}
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.medicalOfficer || false}
                                    onChange={(e) => {
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, medicalOfficer: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode}
                                    className="h-4 w-4"
                                    data-testid={`vessel-medical-officer-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Nav Officer checkbox */}
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.navigatingOfficer || false}
                                    onChange={(e) => {
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, navigatingOfficer: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode}
                                    className="h-4 w-4"
                                    data-testid={`vessel-navigating-officer-${rank.id}`}
                                  />
                                </TableCell>

                                {/* Envt Officer checkbox */}
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={currentVesselRankLookup.get(rank.id)?.emtOfficer || false}
                                    onChange={(e) => {
                                      updateVesselRankData(prev => 
                                        prev.map(r => r.id === rank.id ? { ...r, emtOfficer: e.target.checked } : r)
                                      );
                                    }}
                                    disabled={!revisionMode}
                                    className="h-4 w-4"
                                    data-testid={`vessel-emt-officer-${rank.id}`}
                                  />
                                </TableCell>
                              </TableRow>
                            ));
                          })()
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Training Matrix Module - handles Training Master, Company, and Vessel tabs
  const handleEditTraining = () => {
    setIsTrainingMasterEditing(true);
  };

  const handleSaveTraining = async () => {
    try {
      const changedIds = Array.from(changedTrainings);
      const updates = changedIds.map(id => {
        const training = localTrainingData.find(t => t.id === id);
        if (!training) return null;
        return {
          id: training.id,
          data: {
            requirementReference: training.requirementReference,
            applicableToCompany: training.applicableToCompany,
            trainingLabel: training.trainingLabel,
            ...(training.isDefault ? {} : {
              trainingName: training.trainingName,
              category: training.category,
              trainingGroup: training.trainingGroup,
            }),
          },
        };
      }).filter(Boolean);

      if (updates.length > 0) {
        await apiRequest('PATCH', '/api/training-master/batch', updates);
        queryClient.invalidateQueries({ queryKey: ['/api/training-master'] });
      }

      setIsTrainingMasterEditing(false);
      setChangedTrainings(new Set());
      toast({
        title: "Changes saved",
        description: "Training data has been saved successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to save training changes:', error);
      toast({
        title: "Save failed",
        description: "Failed to save training data. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleNewTraining = () => {
    setShowNewTrainingDialog(true);
  };

  const handleCreateTraining = async (data: InsertTrainingMaster) => {
    try {
      await createTrainingMutation.mutateAsync(data);
      setShowNewTrainingDialog(false);
      toast({
        title: "Training created",
        description: "New training has been added successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to create training:', error);
      toast({
        title: "Creation failed",
        description: "Failed to create training. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleDeleteTraining = async (training: TrainingMaster) => {
    if (training.isDefault) {
      toast({
        title: "Cannot delete",
        description: "Default trainings cannot be deleted.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    setTrainingToDelete(training);
    setShowDeleteTrainingDialog(true);
  };

  const confirmDeleteTraining = async () => {
    if (!trainingToDelete) return;
    try {
      await deleteTrainingMutation.mutateAsync(trainingToDelete.id);
      setShowDeleteTrainingDialog(false);
      setTrainingToDelete(null);
      toast({
        title: "Training deleted",
        description: "Training has been removed successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to delete training:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete training. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleMoveTraining = async (training: TrainingMaster, direction: 'up' | 'down') => {
    const sameGroupTrainings = localTrainingData
      .filter(t => t.category === training.category && t.trainingGroup === training.trainingGroup)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    const currentIndex = sameGroupTrainings.findIndex(t => t.id === training.id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sameGroupTrainings.length) return;
    
    const swapTraining = sameGroupTrainings[targetIndex];
    
    try {
      await reorderTrainingMutation.mutateAsync([
        { id: training.id, sortOrder: swapTraining.sortOrder },
        { id: swapTraining.id, sortOrder: training.sortOrder },
      ]);
    } catch (error) {
      console.error('Failed to reorder training:', error);
      toast({
        title: "Reorder failed",
        description: "Failed to reorder training. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleTrainingFieldChange = (id: number, field: keyof TrainingMaster, value: any) => {
    const protectedFields: (keyof TrainingMaster)[] = ['trainingName', 'category', 'trainingGroup'];
    
    setLocalTrainingData(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.isDefault && protectedFields.includes(field)) {
        return t;
      }
      return { ...t, [field]: value };
    }));
    
    const training = localTrainingData.find(t => t.id === id);
    if (training?.isDefault && protectedFields.includes(field)) {
      return;
    }
    setChangedTrainings(prev => new Set(prev).add(id));
  };

  const filteredTrainingData = useMemo(() => {
    const categoryPriority: Record<string, number> = { 'S': 1, 'I': 2, 'O': 3 };
    return localTrainingData.filter(training => {
      const matchesSearch = trainingSearchFilter === '' || 
        training.trainingName.toLowerCase().includes(trainingSearchFilter.toLowerCase()) ||
        training.trainingId.toLowerCase().includes(trainingSearchFilter.toLowerCase());
      const matchesCategory = trainingCategoryFilter === 'all' || training.category === trainingCategoryFilter;
      const matchesGroup = trainingGroupFilter === 'all' || training.trainingGroup === trainingGroupFilter;
      return matchesSearch && matchesCategory && matchesGroup;
    }).sort((a, b) => {
      const aPriority = categoryPriority[a.category] ?? 99;
      const bPriority = categoryPriority[b.category] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.trainingGroup !== b.trainingGroup) return a.trainingGroup.localeCompare(b.trainingGroup);
      return a.sortOrder - b.sortOrder;
    });
  }, [localTrainingData, trainingSearchFilter, trainingCategoryFilter, trainingGroupFilter]);

  const filteredCompanyTrainingData = useMemo(() => {
    // Create a map of group code to display order for sorting
    const groupDisplayOrder: Record<string, number> = {};
    companyTrainingGroups.forEach(g => {
      groupDisplayOrder[g.code] = g.displayOrder;
    });
    
    return localCompanyTrainingData.filter(training => {
      const matchesSearch = companyTrainingSearchFilter === '' || 
        (training.trainingLabel || '').toLowerCase().includes(companyTrainingSearchFilter.toLowerCase()) ||
        (training.companyId || '').toLowerCase().includes(companyTrainingSearchFilter.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => {
      // Sort by: 1) Group (A-J first by displayOrder, NULL/unassigned last), 2) sortOrder within group
      const aGroup = a.groupCode;
      const bGroup = b.groupCode;
      
      // If one has group and other doesn't, group comes first
      if (aGroup && !bGroup) return -1;
      if (!aGroup && bGroup) return 1;
      
      // If both have groups, sort by displayOrder
      if (aGroup && bGroup) {
        const aOrder = groupDisplayOrder[aGroup] ?? 99;
        const bOrder = groupDisplayOrder[bGroup] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      
      // Within same group (or both unassigned), sort by sortOrder
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [localCompanyTrainingData, companyTrainingSearchFilter, companyTrainingGroups]);
  
  // Handler for company training field changes
  const handleCompanyTrainingFieldChange = (id: number, field: keyof CompanyTraining, value: any) => {
    setLocalCompanyTrainingData(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, [field]: value };
    }));
    setChangedCompanyTrainings(prev => new Set(prev).add(id));
  };
  
  // Handler for M/R requirement changes
  const handleRequirementChange = (trainingId: number, rankId: number, newStatus: 'M' | 'R' | null) => {
    const key = `${trainingId}-${rankId}`;
    const currentStatus = localTrainingRequirements.get(key);
    
    // Toggle logic: clicking same status = unchecked
    const finalStatus = currentStatus === newStatus ? null : newStatus;
    
    setLocalTrainingRequirements(prev => {
      const newMap = new Map(prev);
      if (finalStatus === null) {
        newMap.delete(key);
      } else {
        newMap.set(key, finalStatus);
      }
      return newMap;
    });
    setChangedRequirements(prev => new Set(prev).add(key));
  };
  
  // Get applicable ranks for the training requirements matrix
  const applicableRanksForTraining = useMemo(() => {
    return rankMasterData.filter(rank => rank.applicableToCompany === true);
  }, [rankMasterData]);
  
  // Handler for "Select All" M/R - applies to all ranks for a training
  const handleSelectAll = (trainingId: number, type: 'M' | 'R') => {
    const currentState = selectAllState.get(trainingId) || { M: false, R: false };
    const isCurrentlyChecked = currentState[type];
    
    // Toggle the select all state
    setSelectAllState(prev => {
      const newMap = new Map(prev);
      newMap.set(trainingId, {
        ...currentState,
        [type]: !isCurrentlyChecked,
        // If selecting one type, uncheck the other (mutually exclusive)
        ...(type === 'M' && !isCurrentlyChecked ? { R: false } : {}),
        ...(type === 'R' && !isCurrentlyChecked ? { M: false } : {}),
      });
      return newMap;
    });
    
    // Update all rank requirements for this training
    setLocalTrainingRequirements(prev => {
      const newMap = new Map(prev);
      applicableRanksForTraining.forEach(rank => {
        const rankId = parseInt(rank.id);
        const key = `${trainingId}-${rankId}`;
        
        if (!isCurrentlyChecked) {
          // Checking "Select All" - set all ranks to this type
          newMap.set(key, type);
        } else {
          // Unchecking "Select All" - clear all ranks that have this type
          const currentStatus = newMap.get(key);
          if (currentStatus === type) {
            newMap.delete(key);
          }
        }
      });
      return newMap;
    });
    
    // Mark all as changed
    setChangedRequirements(prev => {
      const newSet = new Set(prev);
      applicableRanksForTraining.forEach(rank => {
        const rankId = parseInt(rank.id);
        newSet.add(`${trainingId}-${rankId}`);
      });
      return newSet;
    });
  };
  
  // Handler for saving company training changes
  const handleSaveCompanyTraining = async () => {
    const hasTrainingChanges = changedCompanyTrainings.size > 0;
    const hasRequirementChanges = changedRequirements.size > 0;
    
    if (!hasTrainingChanges && !hasRequirementChanges) {
      setIsCompanyTrainingEditing(false);
      return;
    }
    
    try {
      // Save company training changes
      if (hasTrainingChanges) {
        const updatePromises = Array.from(changedCompanyTrainings).map(id => {
          const training = localCompanyTrainingData.find(t => t.id === id);
          if (!training) return Promise.resolve();
          return updateCompanyTrainingMutation.mutateAsync({
            id,
            data: {
              companyId: training.companyId,
              abr: training.abr,
              requirement: training.requirement,
              groupCode: training.groupCode,
            }
          });
        });
        await Promise.all(updatePromises);
      }
      
      // Save M/R requirements changes
      if (hasRequirementChanges) {
        const requirementsToUpsert = Array.from(changedRequirements).map(key => {
          const [trainingIdStr, rankIdStr] = key.split('-');
          const status = localTrainingRequirements.get(key) || null;
          return {
            companyTrainingId: parseInt(trainingIdStr),
            rankId: parseInt(rankIdStr),
            status,
          };
        });
        await upsertRequirementsMutation.mutateAsync(requirementsToUpsert);
      }
      
      setChangedCompanyTrainings(new Set());
      setChangedRequirements(new Set());
      setIsCompanyTrainingEditing(false);
      toast({
        title: "Changes saved",
        description: "Company training updates saved successfully.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to save company training changes:', error);
    }
  };
  
  // Handler for moving company training up/down within its group
  const handleMoveCompanyTraining = async (training: CompanyTraining, direction: 'up' | 'down') => {
    // Get trainings in the same group (including null for unassigned)
    const sameGroupTrainings = localCompanyTrainingData
      .filter(t => t.groupCode === training.groupCode)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    
    const currentIndex = sameGroupTrainings.findIndex(t => t.id === training.id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sameGroupTrainings.length) return;
    
    // Reindex the entire group with new sort orders to ensure unique values
    const reorderedList = [...sameGroupTrainings];
    const [movedItem] = reorderedList.splice(currentIndex, 1);
    reorderedList.splice(targetIndex, 0, movedItem);
    
    // Create update array with new sequential sort orders
    const updates = reorderedList.map((t, idx) => ({
      id: t.id,
      sortOrder: idx
    }));
    
    // Create a map of new sortOrder values for quick lookup
    const sortOrderMap = new Map(updates.map(u => [u.id, u.sortOrder]));
    
    try {
      await reorderCompanyTrainingMutation.mutateAsync(updates);
      
      // Update local state with new sortOrder values so UI reflects changes immediately
      setLocalCompanyTrainingData(prev => prev.map(t => {
        const newSortOrder = sortOrderMap.get(t.id);
        if (newSortOrder !== undefined) {
          return { ...t, sortOrder: newSortOrder };
        }
        return t;
      }));
    } catch (error) {
      console.error('Failed to reorder company training:', error);
      toast({
        title: "Reorder failed",
        description: "Failed to reorder training. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };
  
  const renderTrainingMatrixModule = () => (
    <div className="h-full flex flex-col">
      {/* Responsive Header Layout */}
      <div className={`mb-4 ${currentBreakpoint === 'mobile' ? 'space-y-3' : currentBreakpoint === 'tablet' ? 'space-y-3' : 'grid grid-cols-3 items-center'}`}>
        {/* Title */}
        <div className={`${currentBreakpoint === 'mobile' || currentBreakpoint === 'tablet' ? 'text-center' : ''}`}>
          <h1 className={`font-bold text-black ${currentBreakpoint === 'mobile' ? 'text-xl' : currentBreakpoint === 'tablet' ? 'text-xl' : 'text-2xl'}`} data-testid="title-training-matrix">
            Training Matrix
          </h1>
        </div>
        
        {/* Desktop/Laptop Tab Switcher */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div className="flex justify-center">
            <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
              {[
                { id: "training-master", label: "TrainingMaster" },
                { id: "company", label: "Company" },
                { id: "vessel", label: "Vessel" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTrainingMatrixTab(tab.id)}
                  className={`px-4 text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                    selectedTrainingMatrixTab === tab.id
                      ? "text-[#16569e] font-bold underline"
                      : "text-gray-600 hover:text-gray-800 font-medium"
                  }`}
                  data-testid={`tab-training-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Desktop/Laptop Action Buttons */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div className="flex justify-end">
            {selectedTrainingMatrixTab === "training-master" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrainingFilters(!showTrainingFilters)}
                  className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                  data-testid="button-toggle-training-filters"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button
                  variant={isTrainingMasterEditing ? "default" : "outline"}
                  onClick={isTrainingMasterEditing ? handleSaveTraining : handleEditTraining}
                  className={`h-8 text-xs ${
                    isTrainingMasterEditing 
                      ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                      : "border-[#e1e8ed] text-[#16569e]"
                  }`}
                  data-testid="button-edit-training"
                >
                  {isTrainingMasterEditing ? "Save" : "Edit"}
                </Button>
                <Button
                  onClick={handleNewTraining}
                  className="h-8 bg-[#5dc86f] hover:bg-[#22c55e] text-white text-xs"
                  data-testid="button-new-training"
                >
                  + New
                </Button>
              </div>
            )}
            {selectedTrainingMatrixTab === "company" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompanyTrainingFilters(!showCompanyTrainingFilters)}
                  className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                  data-testid="button-toggle-company-training-filters"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button
                  variant={isCompanyTrainingEditing ? "default" : "outline"}
                  onClick={isCompanyTrainingEditing ? handleSaveCompanyTraining : () => setIsCompanyTrainingEditing(true)}
                  disabled={companyTrainingData.length === 0}
                  className={`h-8 text-xs ${
                    isCompanyTrainingEditing 
                      ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                      : "border-[#e1e8ed] text-[#16569e]"
                  }`}
                  data-testid="button-edit-company-training"
                >
                  {isCompanyTrainingEditing ? "Save" : "Edit"}
                </Button>
                {isCompanyTrainingEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigureGroupLabelsDialog(true)}
                    className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                    data-testid="button-configure-group-labels-desktop"
                  >
                    <Settings className="h-4 w-4" />
                    Configure Labels
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Tablet/Mobile Tab Switcher and Action Buttons Row */}
        {(currentBreakpoint === 'tablet' || currentBreakpoint === 'mobile') && (
          <div className={`${currentBreakpoint === 'mobile' ? 'space-y-2' : 'flex items-center justify-between'}`}>
            {/* Tab Switcher */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'justify-center' : 'justify-start'}`}>
              <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
                {[
                  { id: "training-master", label: currentBreakpoint === 'mobile' ? "T.Master" : "TrainingMaster" },
                  { id: "company", label: "Company" },
                  { id: "vessel", label: "Vessel" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTrainingMatrixTab(tab.id)}
                    className={`${currentBreakpoint === 'mobile' ? 'px-2' : 'px-3'} text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                      selectedTrainingMatrixTab === tab.id
                        ? "text-[#16569e] font-bold underline"
                        : "text-gray-600 hover:text-gray-800 font-medium"
                    }`}
                    data-testid={`tab-training-${tab.id}-mobile`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Action Buttons for Tablet/Mobile */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'justify-center' : 'justify-end'}`}>
              {selectedTrainingMatrixTab === "training-master" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTrainingFilters(!showTrainingFilters)}
                    className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                    data-testid="button-toggle-training-filters-mobile"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                  <Button
                    variant={isTrainingMasterEditing ? "default" : "outline"}
                    onClick={isTrainingMasterEditing ? handleSaveTraining : handleEditTraining}
                    className={`h-8 text-xs ${
                      isTrainingMasterEditing 
                        ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                        : "border-[#e1e8ed] text-[#16569e]"
                    }`}
                    data-testid="button-edit-training-mobile"
                  >
                    {isTrainingMasterEditing ? "Save" : "Edit"}
                  </Button>
                  <Button
                    onClick={handleNewTraining}
                    className="h-8 bg-[#5dc86f] hover:bg-[#22c55e] text-white text-xs"
                    data-testid="button-new-training-mobile"
                  >
                    + New
                  </Button>
                </div>
              )}
              {selectedTrainingMatrixTab === "company" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompanyTrainingFilters(!showCompanyTrainingFilters)}
                    className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                    data-testid="button-toggle-company-training-filters-mobile"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                  <Button
                    variant={isCompanyTrainingEditing ? "default" : "outline"}
                    onClick={isCompanyTrainingEditing ? handleSaveCompanyTraining : () => setIsCompanyTrainingEditing(true)}
                    disabled={companyTrainingData.length === 0}
                    className={`h-8 text-xs ${
                      isCompanyTrainingEditing 
                        ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                        : "border-[#e1e8ed] text-[#16569e]"
                    }`}
                    data-testid="button-edit-company-training-mobile"
                  >
                    {isCompanyTrainingEditing ? "Save" : "Edit"}
                  </Button>
                  {isCompanyTrainingEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfigureGroupLabelsDialog(true)}
                      className="h-8 gap-2 bg-white text-[#0f172a] border-gray-300"
                      data-testid="button-configure-group-labels"
                    >
                      <Settings className="h-4 w-4" />
                      Configure Labels
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar - Search Training (Training Master) */}
      {showTrainingFilters && selectedTrainingMatrixTab === "training-master" && (
        <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            <div className="shrink-0 w-48">
              <Input
                placeholder="Search Training"
                className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                value={trainingSearchFilter}
                onChange={(e) => setTrainingSearchFilter(e.target.value)}
                data-testid="input-search-training"
              />
            </div>
            <div className="shrink-0 w-36">
              <Select value={trainingCategoryFilter} onValueChange={setTrainingCategoryFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-training-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {TRAINING_CATEGORIES.map(cat => (
                    <SelectItem key={cat.code} value={cat.code}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0 w-36">
              <Select value={trainingGroupFilter} onValueChange={setTrainingGroupFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-training-group">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {TRAINING_GROUPS.map(grp => (
                    <SelectItem key={grp.code} value={grp.code}>{grp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content Area */}
      <div className="flex-1 overflow-hidden">
        {selectedTrainingMatrixTab === "training-master" && (
          <div data-testid="content-training-master" className="h-full">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="flex-1 overflow-auto relative">
                <Table className="relative">
                  <TableHeader className="sticky top-0 z-50">
                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                      <TableHead className="w-12 text-center text-xs font-normal text-white bg-[#52baf3]">#</TableHead>
                      <TableHead className="w-20 text-xs font-normal text-white bg-[#52baf3]">ID</TableHead>
                      <TableHead className="min-w-[200px] text-xs font-normal text-white bg-[#52baf3]">Training Name</TableHead>
                      <TableHead className="w-24 text-xs font-normal text-white bg-[#52baf3]">Category</TableHead>
                      <TableHead className="w-24 text-xs font-normal text-white bg-[#52baf3]">Group</TableHead>
                      <TableHead className="w-32 text-xs font-normal text-white bg-[#52baf3]">Requirement/Ref</TableHead>
                      <TableHead className="w-32 text-center text-xs font-normal text-white bg-[#52baf3]">
                        <div className="flex items-center justify-center gap-2">
                          <span>Applicable to Company</span>
                          {isTrainingMasterEditing && (
                            <input
                              type="checkbox"
                              checked={localTrainingData.length > 0 && localTrainingData.every(t => t.applicableToCompany)}
                              ref={(el) => {
                                if (el) {
                                  const allChecked = localTrainingData.every(t => t.applicableToCompany);
                                  const noneChecked = localTrainingData.every(t => !t.applicableToCompany);
                                  el.indeterminate = !allChecked && !noneChecked;
                                }
                              }}
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setLocalTrainingData(prev => prev.map(t => ({ ...t, applicableToCompany: newValue })));
                                setChangedTrainings(prev => {
                                  const updated = new Set(prev);
                                  localTrainingData.forEach(t => updated.add(t.id));
                                  return updated;
                                });
                              }}
                              className="h-4 w-4 cursor-pointer"
                              title="Select All"
                              data-testid="checkbox-select-all-company"
                            />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="w-[180px] text-xs font-normal text-white bg-[#52baf3]">Training Label</TableHead>
                      {isTrainingMasterEditing && (
                        <TableHead className="w-20 text-center text-xs font-normal text-white bg-[#52baf3]">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Loading State - Show skeleton rows */}
                    {trainingMasterLoading && (
                      <>
                        {Array.from({ length: 10 }).map((_, index) => (
                          <TableRow key={`skeleton-${index}`} className="border-b border-gray-100">
                            <TableCell className="text-center"><div className="h-4 w-6 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                            <TableCell><div className="h-4 w-14 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell className="text-center"><div className="h-4 w-4 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                    {/* Empty State - No data found */}
                    {!trainingMasterLoading && filteredTrainingData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No training data found
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Data Rows */}
                    {!trainingMasterLoading && filteredTrainingData.map((training, index) => {
                          const sameGroupTrainings = filteredTrainingData.filter(
                            t => t.category === training.category && t.trainingGroup === training.trainingGroup
                          );
                          const groupIndex = sameGroupTrainings.findIndex(t => t.id === training.id);
                          const isFirstInGroup = groupIndex === 0;
                          const isLastInGroup = groupIndex === sameGroupTrainings.length - 1;
                          
                          return (
                            <TableRow 
                              key={training.id} 
                              className={`border-b border-gray-100 hover:bg-gray-50 text-xs ${changedTrainings.has(training.id) ? "bg-yellow-50" : ""}`}
                              data-testid={`row-training-${training.id}`}
                            >
                              <TableCell className="text-center text-gray-600">{index + 1}</TableCell>
                              <TableCell className="text-gray-600">{training.trainingId}</TableCell>
                              <TableCell className="text-gray-600">
                                {isTrainingMasterEditing && !training.isDefault ? (
                                  <Input
                                    value={training.trainingName}
                                    onChange={(e) => handleTrainingFieldChange(training.id, 'trainingName', e.target.value)}
                                    className="h-7 text-xs"
                                    data-testid={`input-training-name-${training.id}`}
                                  />
                                ) : (
                                  <span>{training.trainingName}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {isTrainingMasterEditing && !training.isDefault ? (
                                  <Select
                                    value={training.category}
                                    onValueChange={(value) => handleTrainingFieldChange(training.id, 'category', value)}
                                  >
                                    <SelectTrigger className="h-7 text-xs" data-testid={`select-category-${training.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TRAINING_CATEGORIES.map(cat => (
                                        <SelectItem key={cat.code} value={cat.code}>{cat.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  getCategoryLabel(training.category)
                                )}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {isTrainingMasterEditing && !training.isDefault ? (
                                  <Select
                                    value={training.trainingGroup}
                                    onValueChange={(value) => handleTrainingFieldChange(training.id, 'trainingGroup', value)}
                                  >
                                    <SelectTrigger className="h-7 text-xs" data-testid={`select-group-${training.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TRAINING_GROUPS.map(grp => (
                                        <SelectItem key={grp.code} value={grp.code}>{grp.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  getGroupLabel(training.trainingGroup)
                                )}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {isTrainingMasterEditing ? (
                                  <Input
                                    value={training.requirementReference || ''}
                                    onChange={(e) => handleTrainingFieldChange(training.id, 'requirementReference', e.target.value || null)}
                                    className="h-7 text-xs"
                                    placeholder="Reference"
                                    data-testid={`input-requirement-${training.id}`}
                                  />
                                ) : (
                                  training.requirementReference || '-'
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <input
                                  type="checkbox"
                                  checked={training.applicableToCompany}
                                  onChange={(e) => handleTrainingFieldChange(training.id, 'applicableToCompany', e.target.checked)}
                                  disabled={!isTrainingMasterEditing}
                                  className="h-4 w-4"
                                  data-testid={`checkbox-company-${training.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {training.applicableToCompany ? (
                                  isTrainingMasterEditing ? (
                                    <Input
                                      value={training.trainingLabel || ''}
                                      onChange={(e) => handleTrainingFieldChange(training.id, 'trainingLabel', e.target.value || null)}
                                      className="h-7 text-xs"
                                      placeholder="Label"
                                      data-testid={`input-label-${training.id}`}
                                    />
                                  ) : (
                                    training.trainingLabel || '-'
                                  )
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              {isTrainingMasterEditing && (
                                <TableCell className="text-center">
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMoveTraining(training, 'up')}
                                      disabled={isFirstInGroup}
                                      className="h-6 w-6 p-0"
                                      data-testid={`button-move-up-${training.id}`}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleMoveTraining(training, 'down')}
                                      disabled={isLastInGroup}
                                      className="h-6 w-6 p-0"
                                      data-testid={`button-move-down-${training.id}`}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTraining(training)}
                                      disabled={training.isDefault}
                                      className={`h-6 w-6 p-0 ${training.isDefault ? 'opacity-30' : 'text-red-500 hover:text-red-700'}`}
                                      data-testid={`button-delete-${training.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
              </div>
            </div>
          </div>
        )}
        {selectedTrainingMatrixTab === "company" && (
          <div data-testid="content-training-company" className="h-full">
            {/* Company Filter Bar */}
            {showCompanyTrainingFilters && (
              <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="shrink-0 w-48">
                    <Input
                      placeholder="Search Training"
                      className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                      value={companyTrainingSearchFilter}
                      onChange={(e) => setCompanyTrainingSearchFilter(e.target.value)}
                      data-testid="input-search-company-training"
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Company Training Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="flex-1 overflow-auto relative">
                  <Table className="relative" style={{ minWidth: `${700 + applicableRanksForTraining.length * 85}px` }}>
                    <TableHeader className="sticky top-0 z-50">
                      <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                        <TableHead className="w-12 text-center text-xs font-normal text-white sticky left-0 z-40 bg-[#52baf3]">#</TableHead>
                        <TableHead className="w-28 text-xs font-normal text-white sticky left-12 z-40 bg-[#52baf3]">Company ID</TableHead>
                        <TableHead className="min-w-[200px] text-xs font-normal text-white sticky left-40 z-40 bg-[#52baf3]">Training Label</TableHead>
                        <TableHead className="w-24 text-xs font-normal text-white bg-[#52baf3]">Abr</TableHead>
                        <TableHead className="min-w-[150px] text-xs font-normal text-white bg-[#52baf3]">Requirement</TableHead>
                        <TableHead className="w-28 text-xs font-normal text-white bg-[#52baf3]">Company Group</TableHead>
                        {isCompanyTrainingEditing && (
                          <TableHead className="w-20 text-center text-xs font-normal text-white bg-[#52baf3]">Reorder</TableHead>
                        )}
                        {isCompanyTrainingEditing && (
                          <TableHead className="w-16 text-center text-xs font-normal text-white bg-[#52baf3]">
                            <div className="leading-tight">Select<br/>All</div>
                          </TableHead>
                        )}
                        {/* Rank columns for M/R matrix */}
                        {applicableRanksForTraining.map(rank => (
                          <TableHead 
                            key={rank.id} 
                            className="w-20 min-w-[80px] text-center text-[10px] font-normal text-white bg-[#52baf3] px-1"
                            title={rank.rank}
                          >
                            <div className="leading-tight whitespace-normal break-words h-8 flex items-center justify-center">
                              {rank.label || rank.rank}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {companyTrainingLoading && (
                      <>
                        {Array.from({ length: 10 }).map((_, index) => (
                          <TableRow key={`skeleton-company-${index}`} className="border-b border-gray-100">
                            <TableCell className="text-center sticky left-0 bg-white"><div className="h-4 w-6 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                            <TableCell className="sticky left-12 bg-white"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell className="sticky left-40 bg-white"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                            {isCompanyTrainingEditing && <TableCell />}
                            {isCompanyTrainingEditing && <TableCell />}
                            {applicableRanksForTraining.map(rank => (
                              <TableCell key={rank.id} className="text-center min-w-[80px]">
                                <div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </>
                    )}
                    {!companyTrainingLoading && filteredCompanyTrainingData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6 + (isCompanyTrainingEditing ? 2 : 0) + applicableRanksForTraining.length} className="text-center text-gray-500 py-8">
                          {companyTrainingData.length === 0 
                            ? "No company trainings found. Mark trainings as 'Applicable to Company' in Training Master to add them here."
                            : "No trainings match your search."}
                        </TableCell>
                      </TableRow>
                    )}
                    {!companyTrainingLoading && filteredCompanyTrainingData.map((training, index) => (
                      <TableRow 
                        key={training.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${changedCompanyTrainings.has(training.id) ? 'bg-yellow-50' : ''}`}
                        data-company-training-id={training.id}
                        data-testid={`row-company-training-${training.id}`}
                      >
                        <TableCell className="text-center text-xs text-gray-600 sticky left-0 z-10 bg-white">{index + 1}</TableCell>
                        <TableCell className="text-xs sticky left-12 z-10 bg-white" data-testid={`cell-company-id-${training.id}`}>
                          {isCompanyTrainingEditing ? (
                            <Input
                              value={training.companyId || ''}
                              onChange={(e) => handleCompanyTrainingFieldChange(training.id, 'companyId', e.target.value)}
                              className="h-7 text-xs w-full"
                              data-testid={`input-company-id-${training.id}`}
                            />
                          ) : (
                            <span className="text-gray-600">{training.companyId || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sticky left-40 z-10 bg-white" data-testid={`text-company-training-label-${training.id}`}>
                          {training.trainingLabel || '-'}
                        </TableCell>
                        <TableCell className="text-xs" data-testid={`cell-company-abr-${training.id}`}>
                          {isCompanyTrainingEditing ? (
                            <Input
                              value={training.abr || ''}
                              onChange={(e) => handleCompanyTrainingFieldChange(training.id, 'abr', e.target.value)}
                              className="h-7 text-xs w-full"
                              placeholder="Enter abbreviation"
                              data-testid={`input-company-abr-${training.id}`}
                            />
                          ) : (
                            <span className="text-gray-600">{training.abr || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs" data-testid={`cell-company-requirement-${training.id}`}>
                          {isCompanyTrainingEditing ? (
                            <Input
                              value={training.requirement || ''}
                              onChange={(e) => handleCompanyTrainingFieldChange(training.id, 'requirement', e.target.value)}
                              className="h-7 text-xs w-full"
                              data-testid={`input-company-requirement-${training.id}`}
                            />
                          ) : (
                            <span className="text-gray-600">{training.requirement || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs" data-testid={`cell-company-group-${training.id}`}>
                          {isCompanyTrainingEditing ? (
                            <Select 
                              value={training.groupCode || '__none__'} 
                              onValueChange={(value) => handleCompanyTrainingFieldChange(training.id, 'groupCode', value === '__none__' ? null : value)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full" data-testid={`select-company-group-${training.id}`}>
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">-</SelectItem>
                                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(code => {
                                  const group = companyTrainingGroups.find(g => g.code === code);
                                  const displayLabel = group?.label ? `${code}. ${group.label}` : code;
                                  return (
                                    <SelectItem key={code} value={code}>{displayLabel}</SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-gray-600">
                              {training.groupCode 
                                ? (() => {
                                    const group = companyTrainingGroups.find(g => g.code === training.groupCode);
                                    return group?.label ? `${training.groupCode}. ${group.label}` : training.groupCode;
                                  })()
                                : '-'}
                            </span>
                          )}
                        </TableCell>
                        {isCompanyTrainingEditing && (() => {
                          // Get trainings in the same group for determining first/last
                          const sameGroupTrainings = filteredCompanyTrainingData.filter(t => t.groupCode === training.groupCode);
                          const indexInGroup = sameGroupTrainings.findIndex(t => t.id === training.id);
                          const isFirstInGroup = indexInGroup === 0;
                          const isLastInGroup = indexInGroup === sameGroupTrainings.length - 1;
                          const isReordering = reorderCompanyTrainingMutation.isPending;
                          
                          return (
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMoveCompanyTraining(training, 'up')}
                                  disabled={isFirstInGroup || isReordering}
                                  className="h-6 w-6 p-0"
                                  data-testid={`button-company-move-up-${training.id}`}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMoveCompanyTraining(training, 'down')}
                                  disabled={isLastInGroup || isReordering}
                                  className="h-6 w-6 p-0"
                                  data-testid={`button-company-move-down-${training.id}`}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          );
                        })()}
                        {/* Select All cell - only shown in edit mode */}
                        {isCompanyTrainingEditing && (() => {
                          const selectState = selectAllState.get(training.id) || { M: false, R: false };
                          return (
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <label className="flex items-center gap-0.5 cursor-pointer text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={selectState.M}
                                    onChange={() => handleSelectAll(training.id, 'M')}
                                    className="h-3 w-3 rounded border-gray-300"
                                    data-testid={`checkbox-select-all-m-${training.id}`}
                                  />
                                  <span className="text-gray-600">M</span>
                                </label>
                                <label className="flex items-center gap-0.5 cursor-pointer text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={selectState.R}
                                    onChange={() => handleSelectAll(training.id, 'R')}
                                    className="h-3 w-3 rounded border-gray-300"
                                    data-testid={`checkbox-select-all-r-${training.id}`}
                                  />
                                  <span className="text-gray-600">R</span>
                                </label>
                              </div>
                            </TableCell>
                          );
                        })()}
                        {/* M/R requirement cells for each rank */}
                        {applicableRanksForTraining.map(rank => {
                          const rankIdNum = parseInt(rank.id);
                          const key = `${training.id}-${rankIdNum}`;
                          const status = localTrainingRequirements.get(key);
                          const isChanged = changedRequirements.has(key);
                          
                          return (
                            <TableCell 
                              key={rank.id} 
                              className={`text-center px-1 min-w-[80px] ${isChanged ? 'bg-yellow-50' : ''}`}
                              data-testid={`cell-requirement-${training.id}-${rankIdNum}`}
                            >
                              {isCompanyTrainingEditing ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <label className="flex items-center gap-0.5 cursor-pointer text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={status === 'M'}
                                      onChange={() => handleRequirementChange(training.id, rankIdNum, 'M')}
                                      className="h-3 w-3 rounded border-gray-300"
                                      data-testid={`checkbox-m-${training.id}-${rankIdNum}`}
                                    />
                                    <span className="text-gray-600">M</span>
                                  </label>
                                  <label className="flex items-center gap-0.5 cursor-pointer text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={status === 'R'}
                                      onChange={() => handleRequirementChange(training.id, rankIdNum, 'R')}
                                      className="h-3 w-3 rounded border-gray-300"
                                      data-testid={`checkbox-r-${training.id}-${rankIdNum}`}
                                    />
                                    <span className="text-gray-600">R</span>
                                  </label>
                                </div>
                              ) : (
                                <span className={`text-xs font-medium ${status === 'M' ? 'text-red-600' : status === 'R' ? 'text-blue-600' : 'text-gray-300'}`}>
                                  {status || '-'}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
              </div>
            </div>
          </div>
        )}
        {selectedTrainingMatrixTab === "vessel" && (
          <div className="h-full flex flex-col" data-testid="content-training-vessel">
            {/* Vessel Filters */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'flex-wrap gap-4'} mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg`}>
              <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'gap-4 flex-wrap'}`}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`h-8 ${currentBreakpoint === 'mobile' ? 'w-full' : 'w-48'} justify-between text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] bg-transparent hover:bg-transparent`}
                      data-testid="tm-vessel-select"
                    >
                      {tmSelectedVessels.length === 0 
                        ? "Select Vessel or Group" 
                        : tmSelectedVessels.length === 1 
                          ? vesselOptions.find((v: VesselOption) => v.value === tmSelectedVessels[0])?.label
                          : `${tmSelectedVessels.length} vessels selected`
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className={`${currentBreakpoint === 'mobile' ? 'w-[280px]' : 'w-[200px]'} p-0`}>
                    <Command>
                      <CommandInput placeholder="Search vessels..." className="h-9" />
                      <CommandEmpty>No vessel found.</CommandEmpty>
                      <CommandGroup>
                        {vesselOptions.map((vessel: VesselOption) => (
                          <CommandItem
                            key={vessel.value}
                            value={`${vessel.label} ${vessel.value}`}
                            onSelect={() => {
                              if (vessel.type === 'group' && vessel.vesselIds) {
                                const groupVesselIds = Array.isArray(vessel.vesselIds) 
                                  ? vessel.vesselIds 
                                  : JSON.parse(vessel.vesselIds || '[]');
                                const allGroupVesselsSelected = groupVesselIds.every((id: string) => tmSelectedVessels.includes(id));
                                
                                if (allGroupVesselsSelected) {
                                  setTmSelectedVessels(tmSelectedVessels.filter(v => !groupVesselIds.includes(v)));
                                } else {
                                  const newVessels = groupVesselIds.filter((id: string) => !tmSelectedVessels.includes(id));
                                  setTmSelectedVessels([...tmSelectedVessels, ...newVessels]);
                                }
                              } else {
                                const isSelected = tmSelectedVessels.includes(vessel.value);
                                if (isSelected) {
                                  setTmSelectedVessels(tmSelectedVessels.filter(v => v !== vessel.value));
                                } else {
                                  setTmSelectedVessels([...tmSelectedVessels, vessel.value]);
                                }
                              }
                            }}
                            className="text-xs"
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                checked={(() => {
                                  if (vessel.type === 'group' && vessel.vesselIds) {
                                    const vesselIdArray = Array.isArray(vessel.vesselIds) 
                                      ? vessel.vesselIds 
                                      : JSON.parse(vessel.vesselIds || '[]');
                                    return vesselIdArray.every((id: string) => tmSelectedVessels.includes(id));
                                  }
                                  return tmSelectedVessels.includes(vessel.value);
                                })()}
                                className="h-4 w-4"
                              />
                              <span>{vessel.label}</span>
                            </div>
                            <Check
                              className={`ml-auto h-4 w-4 ${
                                (() => {
                                  if (vessel.type === 'group' && vessel.vesselIds) {
                                    const vesselIdArray = Array.isArray(vessel.vesselIds) 
                                      ? vessel.vesselIds 
                                      : JSON.parse(vessel.vesselIds || '[]');
                                    return vesselIdArray.every((id: string) => tmSelectedVessels.includes(id)) ? "opacity-100" : "opacity-0";
                                  }
                                  return tmSelectedVessels.includes(vessel.value) ? "opacity-100" : "opacity-0";
                                })()
                              }`}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Settings icon for Vessel Group management */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#0f172a] hover:bg-gray-50"
                  onClick={() => setIsVesselGroupModalOpen(true)}
                  data-testid="tm-vessel-group-settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>

                {/* Display auto-assigned next revision */}
                <div className="h-8 w-32 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-xs text-[#0f172a]" data-testid="tm-next-revision-display">
                  <span className="font-medium">Next: {tmNextRevision}</span>
                </div>

                <Input
                  type="date"
                  placeholder="dd/mm/yyyy"
                  value={tmFlexDate}
                  onChange={(e) => setTmFlexDate(e.target.value)}
                  className="h-8 w-36 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] pr-8"
                  disabled={!tmRevisionMode}
                  data-testid="tm-flex-date-input"
                />
                
                {/* Revision control buttons */}
                <div className="flex gap-2 ml-auto">
                  {!tmRevisionMode ? (
                    <Button
                      onClick={() => {
                        if (tmSelectedVessels.length === 0) {
                          toast({
                            title: "No vessel selected",
                            description: "Please select a vessel to start revision.",
                            variant: "destructive",
                            duration: 3000,
                          });
                          return;
                        }
                        setTmRevisionMode(true);
                        setTmFlexDate(new Date().toISOString().split('T')[0]);
                      }}
                      disabled={tmSelectedVessels.length === 0}
                      className={`h-8 text-xs ${
                        tmSelectedVessels.length === 0 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-[#5dc86f] hover:bg-[#22c55e] text-white'
                      }`}
                      data-testid="tm-revision-button"
                    >
                      + Revision
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          setTmRevisionMode(false);
                          setTmApplicableTrainings(new Map());
                        }}
                        className="h-8 bg-[#ff6961] hover:bg-[#ff5449] text-[#fdfcfc] text-xs"
                        data-testid="tm-cancel-button"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (tmSelectedVessels.length === 0) return;
                          const vesselId = tmSelectedVessels[0];
                          const applicableIds = Array.from(tmApplicableTrainings.get(vesselId) || new Set());
                          const draftData = { applicableTrainingIds: applicableIds };
                          tmSaveDraftMutation.mutate({ vesselId, draftData });
                        }}
                        className="h-8 bg-[#15569e] hover:bg-[#0f4078] text-white text-xs"
                        data-testid="tm-save-draft-button"
                      >
                        Save Draft
                      </Button>
                      <Button
                        onClick={() => {
                          if (tmSelectedVessels.length === 0) return;
                          if (!tmFlexDate) {
                            toast({
                              title: "Date required",
                              description: "Please select a revision date.",
                              variant: "destructive",
                              duration: 3000,
                            });
                            return;
                          }
                          const vesselId = tmSelectedVessels[0];
                          const applicableIds = Array.from(tmApplicableTrainings.get(vesselId) || new Set());
                          const revisionData = { applicableTrainingIds: applicableIds };
                          tmSubmitRevisionMutation.mutate({ 
                            vesselId, 
                            revisionDate: tmFlexDate, 
                            revisionData 
                          });
                        }}
                        className="h-8 bg-[#00AF7B] hover:bg-[#0f4078] text-white text-xs"
                        data-testid="tm-submit-button"
                      >
                        Submit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Vessels Revision Indicator */}
            {tmRevisionMode && tmSelectedVessels.length > 0 && (
              <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 ${currentBreakpoint === 'mobile' ? 'text-sm' : ''}`} data-testid="tm-selected-vessels-indicator">
                <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-2' : 'items-center justify-between'}`}>
                  <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-1' : 'items-center space-x-2'}`}>
                    <div className={`${currentBreakpoint === 'mobile' ? 'text-xs' : 'text-sm'} font-medium text-blue-800`}>
                      Revision Mode - Editing {tmSelectedVessels.length} vessel{tmSelectedVessels.length > 1 ? 's' : ''}:
                    </div>
                    <div className="flex space-x-1">
                      {tmSelectedVessels.map((vesselId) => (
                        <span
                          key={vesselId}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {vesselOptions.find((v: VesselOption) => v.value === vesselId)?.label || vesselId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-blue-600">
                    Changes apply to all selected vessels
                  </div>
                </div>
              </div>
            )}

            {/* Training Matrix Vessel Table - Replicates Company Table with App to Vessel column */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <div className="flex-1 overflow-auto relative">
                <Table className="relative" style={{ minWidth: `${750 + applicableRanksForTraining.length * 85}px` }}>
                  <TableHeader className="sticky top-0 z-50">
                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                      {/* App to Vessel column - first column */}
                      <TableHead className="w-20 text-center text-xs font-normal text-white sticky left-0 z-40 bg-[#52baf3]">
                        <div className="leading-tight">App. To<br/>Vessel</div>
                      </TableHead>
                      <TableHead className="w-12 text-center text-xs font-normal text-white sticky left-20 z-40 bg-[#52baf3]">#</TableHead>
                      <TableHead className="w-28 text-xs font-normal text-white sticky left-32 z-40 bg-[#52baf3]">Company ID</TableHead>
                      <TableHead className="min-w-[200px] text-xs font-normal text-white sticky left-60 z-40 bg-[#52baf3]">Training Label</TableHead>
                      <TableHead className="min-w-[150px] text-xs font-normal text-white bg-[#52baf3]">Requirement</TableHead>
                      <TableHead className="w-28 text-xs font-normal text-white bg-[#52baf3]">Company Group</TableHead>
                      {tmRevisionMode && (
                        <TableHead className="w-20 text-center text-xs font-normal text-white bg-[#52baf3]">Reorder</TableHead>
                      )}
                      {/* Rank columns for M/R matrix - read-only from Company */}
                      {applicableRanksForTraining.map(rank => (
                        <TableHead 
                          key={rank.id} 
                          className="w-20 min-w-[80px] text-center text-[10px] font-normal text-white bg-[#52baf3] px-1"
                          title={rank.rank}
                        >
                          <div className="leading-tight whitespace-normal break-words h-8 flex items-center justify-center">
                            {rank.label || rank.rank}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {tmSelectedVessels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6 + (tmRevisionMode ? 1 : 0) + applicableRanksForTraining.length} className="text-center py-8 text-gray-500">
                        Please select a vessel to view and configure training applicability
                      </TableCell>
                    </TableRow>
                  ) : companyTrainingLoading ? (
                    <>
                      {Array.from({ length: 10 }).map((_, index) => (
                        <TableRow key={`skeleton-vessel-${index}`} className="border-b border-gray-100">
                          <TableCell className="text-center sticky left-0 bg-white"><div className="h-4 w-6 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                          <TableCell className="text-center sticky left-20 bg-white"><div className="h-4 w-6 bg-gray-200 rounded animate-pulse mx-auto" /></TableCell>
                          <TableCell className="sticky left-32 bg-white"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell className="sticky left-60 bg-white"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></TableCell>
                          <TableCell><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></TableCell>
                          {tmRevisionMode && <TableCell />}
                          {applicableRanksForTraining.map(rank => (
                            <TableCell key={rank.id} className="text-center min-w-[80px]">
                              <div className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </>
                  ) : filteredCompanyTrainingData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6 + (tmRevisionMode ? 1 : 0) + applicableRanksForTraining.length} className="text-center text-gray-500 py-8">
                        {companyTrainingData.length === 0 
                          ? "No company trainings found. Add trainings in the Company tab first."
                          : "No trainings match your search."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanyTrainingData.map((training, index) => {
                      const vesselId = tmSelectedVessels[0];
                      const applicableSet = tmApplicableTrainings.get(vesselId) || new Set<number>();
                      const isApplicable = applicableSet.has(training.id);
                      
                      return (
                        <TableRow 
                          key={training.id} 
                          className={`border-b border-gray-100 hover:bg-gray-50 ${isApplicable ? 'bg-green-50' : ''}`}
                          data-testid={`row-vessel-training-${training.id}`}
                        >
                          {/* App to Vessel checkbox - only editable column */}
                          <TableCell className="text-center sticky left-0 z-10 bg-white">
                            {tmRevisionMode ? (
                              <input
                                type="checkbox"
                                checked={isApplicable}
                                onChange={() => {
                                  setTmApplicableTrainings(prev => {
                                    const newMap = new Map(prev);
                                    const vesselSet = new Set(newMap.get(vesselId) || []);
                                    if (isApplicable) {
                                      vesselSet.delete(training.id);
                                    } else {
                                      vesselSet.add(training.id);
                                    }
                                    newMap.set(vesselId, vesselSet);
                                    return newMap;
                                  });
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                data-testid={`checkbox-app-to-vessel-${training.id}`}
                              />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isApplicable}
                                disabled
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 opacity-60"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-gray-600 sticky left-20 z-10 bg-white">{index + 1}</TableCell>
                          <TableCell className="text-xs sticky left-32 z-10 bg-white">
                            <span className="text-gray-600">{training.companyId || '-'}</span>
                          </TableCell>
                          <TableCell className="text-xs sticky left-60 z-10 bg-white" data-testid={`text-vessel-training-label-${training.id}`}>
                            {training.trainingLabel || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-gray-600">{training.requirement || '-'}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-gray-600">
                              {training.groupCode 
                                ? (() => {
                                    const group = companyTrainingGroups.find(g => g.code === training.groupCode);
                                    return group?.label ? `${training.groupCode}. ${group.label}` : training.groupCode;
                                  })()
                                : '-'}
                            </span>
                          </TableCell>
                          {tmRevisionMode && (
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <ChevronUp className="h-4 w-4 text-gray-300" />
                                <ChevronDown className="h-4 w-4 text-gray-300" />
                              </div>
                            </TableCell>
                          )}
                          {/* M/R requirement cells for each rank - read-only from Company level */}
                          {applicableRanksForTraining.map(rank => {
                            const rankIdNum = parseInt(rank.id);
                            const key = `${training.id}-${rankIdNum}`;
                            const status = localTrainingRequirements.get(key);
                            
                            return (
                              <TableCell 
                                key={rank.id} 
                                className="text-center px-1 min-w-[80px]"
                                data-testid={`cell-vessel-requirement-${training.id}-${rankIdNum}`}
                              >
                                {/* Read-only display of Company-level M/R requirements - text only */}
                                <span className={`text-xs font-medium ${status === 'M' ? 'text-red-600' : status === 'R' ? 'text-blue-600' : 'text-gray-300'}`}>
                                  {status || '-'}
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
                  )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Training Dialog */}
      <NewTrainingDialog
        open={showNewTrainingDialog}
        onOpenChange={setShowNewTrainingDialog}
        onSubmit={handleCreateTraining}
        existingIds={trainingMasterData.map(t => t.trainingId)}
        isLoading={createTrainingMutation.isPending}
      />

      {/* New Company Training Dialog */}
      <Dialog open={showNewCompanyTrainingDialog} onOpenChange={setShowNewCompanyTrainingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Company Training</DialogTitle>
            <DialogDescription>
              Add a company-specific training that is not yet in Training Master.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              This feature allows you to add trainings specific to your company that are not part of the standard Training Master list.
            </p>
            <p className="text-xs text-gray-500">
              Company-specific trainings will be tracked separately and can be assigned to crew members as needed.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCompanyTrainingDialog(false)}
              data-testid="button-cancel-company-training"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Company-specific training creation will be available in a future update.",
                  duration: 3000,
                });
                setShowNewCompanyTrainingDialog(false);
              }}
              className="bg-[#5dc86f] hover:bg-[#22c55e] text-white"
              data-testid="button-save-company-training"
            >
              Save Training
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Group Labels Dialog */}
      <ConfigureGroupLabelsDialog
        open={showConfigureGroupLabelsDialog}
        onOpenChange={setShowConfigureGroupLabelsDialog}
        companyTrainingGroups={companyTrainingGroups}
        onSave={async (updates) => {
          try {
            for (const update of updates) {
              await apiRequest('PATCH', `/api/company-training-groups/${update.code}`, { label: update.label });
            }
            queryClient.invalidateQueries({ queryKey: ['/api/company-training-groups'] });
            toast({
              title: "Labels saved",
              description: "Group labels updated successfully.",
              duration: 3000,
            });
          } catch (error) {
            console.error('Failed to save group labels:', error);
            toast({
              title: "Save failed",
              description: "An error occurred while saving group labels.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }}
      />

      {/* Delete Training Confirmation Dialog */}
      <Dialog open={showDeleteTrainingDialog} onOpenChange={setShowDeleteTrainingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Training</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{trainingToDelete?.trainingName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTrainingDialog(false);
                setTrainingToDelete(null);
              }}
              data-testid="button-cancel-delete-training"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteTraining}
              disabled={deleteTrainingMutation.isPending}
              data-testid="button-confirm-delete-training"
            >
              {deleteTrainingMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderDataMastersModule = () => (
    <div>
      {/* Responsive Header Layout */}
      <div className={`mb-4 ${currentBreakpoint === 'mobile' ? 'space-y-3' : currentBreakpoint === 'tablet' ? 'space-y-3' : 'grid grid-cols-3 items-center'}`}>
        {/* Title */}
        <div className={`${currentBreakpoint === 'mobile' || currentBreakpoint === 'tablet' ? 'text-center' : ''}`}>
          <h1 className={`font-bold text-black ${currentBreakpoint === 'mobile' ? 'text-xl' : currentBreakpoint === 'tablet' ? 'text-xl' : 'text-2xl'}`}>
            Data Masters
          </h1>
        </div>
        
        {/* Desktop/Laptop - Middle Grid Cell (Empty) */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div></div>
        )}
        
        {/* Desktop/Laptop - Right Grid Cell (Action Buttons) */}
        {(currentBreakpoint === 'desktop' || currentBreakpoint === 'laptop') && (
          <div className="flex justify-end">
            <div className="flex gap-2">
              <Button
                variant={isMasterInEditMode ? "default" : "outline"}
                onClick={isMasterInEditMode ? handleSaveMaster : handleEditMaster}
                className={`h-8 text-xs ${
                  isMasterInEditMode 
                    ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                    : "border-[#e1e8ed] text-[#16569e]"
                }`}
                data-testid="button-edit-master"
              >
                {isMasterInEditMode ? "Save" : "Edit Master"}
              </Button>
              <Button
                onClick={handleNewEntry}
                disabled={!isMasterInEditMode}
                className={`h-8 text-xs ${
                  isMasterInEditMode 
                    ? "bg-[#5dc86f] hover:bg-[#22c55e] text-white" 
                    : "bg-gray-400 text-gray-600 cursor-not-allowed"
                }`}
                data-testid="button-new-entry"
              >
                + New Entry
              </Button>
            </div>
          </div>
        )}
        
        {/* Tablet/Mobile Action Buttons */}
        {(currentBreakpoint === 'tablet' || currentBreakpoint === 'mobile') && (
          <div className={`flex ${currentBreakpoint === 'mobile' ? 'justify-center' : 'justify-center'}`}>
            <div className={`flex ${responsive.stackButtons ? 'flex-col space-y-1' : 'gap-2'}`}>
              <Button
                variant={isMasterInEditMode ? "default" : "outline"}
                onClick={isMasterInEditMode ? handleSaveMaster : handleEditMaster}
                className={`h-8 text-xs ${
                  isMasterInEditMode 
                    ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                    : "border-[#e1e8ed] text-[#16569e]"
                }`}
                data-testid="button-edit-master"
              >
                {isMasterInEditMode ? "Save" : "Edit Master"}
              </Button>
              <Button
                onClick={handleNewEntry}
                disabled={!isMasterInEditMode}
                className={`h-8 text-xs ${
                  isMasterInEditMode 
                    ? "bg-[#5dc86f] hover:bg-[#22c55e] text-white" 
                    : "bg-gray-400 text-gray-600 cursor-not-allowed"
                }`}
                data-testid="button-new-entry"
              >
                + New Entry
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area - Uses -mt-8 to match Rank Admin vessel tab spacing */}
      <div className="pb-4 pl-0 -mt-8">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="pt-4 pb-4 pl-0">
            
            {/* Filters Bar */}
            <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'flex-wrap gap-4'} mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg`}>
              <div className={`flex ${currentBreakpoint === 'mobile' ? 'flex-col space-y-3' : 'gap-4 flex-wrap'}`}>
                <Input
                  placeholder="Search in selected Data Master"
                  value={searchDataMaster}
                  onChange={(e) => setSearchDataMaster(e.target.value)}
                  className="h-8 w-80 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
                  data-testid="input-search-data-master"
                />
              </div>
            </div>

            {/* Dual Table Layout */}
            <div className={`${currentBreakpoint === 'mobile' ? 'flex flex-col gap-4' : 'flex gap-4'} bg-white rounded-lg border border-gray-200 overflow-hidden`}>
              {/* Left Table - Data Master Names */}
              <div className={`${currentBreakpoint === 'mobile' ? 'w-full' : 'w-1/3'} border-r border-gray-200 ${currentBreakpoint === 'mobile' ? 'border-r-0 border-b' : ''}`}>
                <div className="bg-[#52baf3] text-white text-xs font-medium p-3">
                  Data Master Name
                </div>
                <div className={`${currentBreakpoint === 'mobile' ? 'max-h-64' : 'h-[500px]'} overflow-y-auto`}>
                  {mastersLoading ? (
                    <div className="p-3 text-xs text-gray-500">Loading masters...</div>
                  ) : mastersError ? (
                    <div className="p-3 text-xs text-red-500">Error loading masters</div>
                  ) : (
                    (mastersList as any[]).map((master: any) => (
                      <div
                        key={master.id}
                        onClick={() => {
                          if (import.meta.env.DEV) {
                            console.log(`🔍 [CLICK] Selected master: ${master.id} - ${master.name}`);
                          }
                          
                          // Check for unsaved changes before navigating
                          if (hasUnsavedChanges()) {
                            setPendingTarget(`/admin/masters/${master.id}`);
                            setShowUnsavedChangesDialog(true);
                            return;
                          }
                          
                          setSelectedMaster(master.id);
                          setSelectedAdminPage('masters');
                          // Use wouter's navigate for proper routing
                          navigate(`/admin/masters/${master.id}`);
                        }}
                        className={`p-3 text-xs cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          selectedMaster === master.id 
                            ? 'bg-blue-50 border-l-4 border-l-blue-500 text-blue-700 font-medium' 
                            : 'text-gray-700'
                        }`}
                        data-testid={`master-item-${master.id}`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{master.name}</span>
                          <span className="text-[10px] text-gray-400">ID: {master.id}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-xs text-gray-500 bg-gray-50 border-t">
                  {(mastersList as any[]).length} to {(mastersList as any[]).length} of {(mastersList as any[]).length}
                </div>
              </div>

              {/* Right Table - Selected Master Data */}
              <div className={`${currentBreakpoint === 'mobile' ? 'w-full' : 'flex-1'}`}>
                <div className="bg-[#52baf3] text-white text-xs font-medium p-0">
                  <div className={`${selectedMaster === "013" ? USERS_MASTER_GRID_CLASSES : `grid ${selectedMaster === "014" || selectedMaster === "018" || selectedMaster === "019" || selectedMaster === "021" ? 'grid-cols-5' : selectedMaster === "020" || selectedMaster === "022" ? 'grid-cols-3' : 'grid-cols-4'} gap-0`} ${selectedMaster === "013" ? 'users-master-header-grid' : ''}`}>
                    <div className="p-3 border-r border-blue-400">Entry ID</div>
                    {selectedMaster === "001" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Nationality</div>
                        <div className="p-3 border-r border-blue-400">Country</div>
                      </>
                    ) : selectedMaster === "002" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Country</div>
                        <div className="p-3 border-r border-blue-400">Country UN/LOCODE</div>
                      </>
                    ) : selectedMaster === "003" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Language</div>
                        <div className="p-3 border-r border-blue-400">Language Code</div>
                      </>
                    ) : selectedMaster === "004" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Vessel Type</div>
                        <div className="p-3 border-r border-blue-400">Classification</div>
                      </>
                    ) : selectedMaster === "014" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Vessel</div>
                        <div className="p-3 border-r border-blue-400">IMO Number</div>
                        <div className="p-3 border-r border-blue-400">Vessel Type</div>
                      </>
                    ) : selectedMaster === "018" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Port Name</div>
                        <div className="p-3 border-r border-blue-400">Country</div>
                        <div className="p-3 border-r border-blue-400">Port Code / UN/LOCODE</div>
                      </>
                    ) : selectedMaster === "019" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Language Name</div>
                        <div className="p-3 border-r border-blue-400">Native Name</div>
                        <div className="p-3 border-r border-blue-400">ISO Code</div>
                      </>
                    ) : selectedMaster === "020" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Country Name</div>
                      </>
                    ) : selectedMaster === "021" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Name</div>
                        <div className="p-3 border-r border-blue-400">Country</div>
                        <div className="p-3 border-r border-blue-400">Email</div>
                      </>
                    ) : selectedMaster === "022" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Name</div>
                      </>
                    ) : selectedMaster === "012" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">Designation</div>
                        <div className="p-3 border-r border-blue-400">Department</div>
                      </>
                    ) : selectedMaster === "013" ? (
                      <>
                        <div className="p-3 border-r border-blue-400">First Name</div>
                        <div className="p-3 border-r border-blue-400">Last Name</div>
                        <div className="p-3 border-r border-blue-400">Designation</div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 border-r border-blue-400">Name</div>
                        <div className="p-3 border-r border-blue-400">Description</div>
                      </>
                    )}
                    <div className="p-3 text-center">Actions</div>
                  </div>
                </div>
                <div className={`${currentBreakpoint === 'mobile' ? 'max-h-64' : 'h-[500px]'} overflow-y-auto ${selectedMaster === "013" ? 'users-master-grid-container' : ''}`}>
                  {masterDataLoading ? (
                    <div className="p-3 text-xs text-gray-500">Loading master data...</div>
                  ) : masterDataError ? (
                    <div className="p-3 text-xs text-red-500">Error loading master data</div>
                  ) : selectedMaster === "001" ? (
                    // Special handling for Nationality Master (001) - Use external API data
                    nationalityLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading nationalities...</div>
                    ) : nationalityError ? (
                      <div className="p-3 text-xs text-red-500">Error loading nationalities: {(nationalityError as Error).message}</div>
                    ) : nationalityData && nationalityData.length > 0 ? (
                      nationalityData.map((item: any, index: number) => (
                        <div
                          key={item.id || item.country || `nationality-${index}`}
                          className="grid grid-cols-4 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.cid || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Nationality Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.nationality || <em className="text-gray-400">No nationality</em>}
                            </span>
                          </div>

                          {/* Column 3: Country Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.countryName || <em className="text-gray-400">No country name</em>}
                            </span>
                          </div>

                          {/* Column 4: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No nationalities found</div>
                    )
                  ) : selectedMaster === "004" ? (
                    // Special handling for Vessel Type Master (004) - Use external API data
                    vesselTypeLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading vessel types...</div>
                    ) : vesselTypeError ? (
                      <div className="p-3 text-xs text-red-500">Error loading vessel types: {(vesselTypeError as Error).message}</div>
                    ) : vesselTypeData && vesselTypeData.length > 0 ? (
                      vesselTypeData.map((item: any, index: number) => (
                        <div
                          key={item.vtuid || item.id || `vessel-type-${index}`}
                          className="grid grid-cols-4 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vtuid || item.entryId || item.id || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Vessel Type Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vesselType || item.name || <em className="text-gray-400">No vessel type</em>}
                            </span>
                          </div>

                          {/* Column 3: Classification */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {(() => {
                                const classifications = [];
                                if (item.tanker === 1) classifications.push('Tanker');
                                if (item.oilTanker === 1) classifications.push('Oil');
                                if (item.gasTanker === 1) classifications.push('Gas');
                                if (item.chemicalTanker === 1) classifications.push('Chemical');
                                if (item.dry === 1) classifications.push('Dry');
                                if (item.container === 1) classifications.push('Container');

                                return classifications.length > 0 ? classifications.join(', ') : <em className="text-gray-400">No classification</em>;
                              })()}
                            </span>
                          </div>

                          {/* Column 4: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No vessel types found</div>
                    )
                  ) : selectedMaster === "014" ? (
                    // Vessel Master (014) - Use external vessel master data
                    vesselMasterLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading vessels...</div>
                    ) : vesselMasterError ? (
                      <div className="p-3 text-xs text-red-500">Error loading vessels: {(vesselMasterError as Error).message}</div>
                    ) : vesselMasterData && vesselMasterData.length > 0 ? (
                      vesselMasterData.map((item: any, index: number) => (
                        <div
                          key={item.vesselId || item.id || `vessel-${index}`}
                          className="grid grid-cols-5 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vuid || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Vessel Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vessel || <em className="text-gray-400">No vessel name</em>}
                            </span>
                          </div>

                          {/* Column 3: IMO Number */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.imoNumber || <em className="text-gray-400">No IMO number</em>}
                            </span>
                          </div>

                          {/* Column 4: Vessel Type */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vesselType || item.vesselTypeId || <em className="text-gray-400">No vessel type</em>}
                            </span>
                          </div>

                          {/* Column 5: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No vessels found</div>
                    )
                  ) : selectedMaster === "015" ? (
                    // Special handling for Fleet Groups Master (015) - Use external API data
                    fleetGroupsLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading fleet groups...</div>
                    ) : fleetGroupsError ? (
                      <div className="p-3 text-xs text-red-500">Error loading fleet groups: {(fleetGroupsError as Error).message}</div>
                    ) : fleetGroupsData && fleetGroupsData.length > 0 ? (
                      fleetGroupsData.map((item: any, index: number) => (
                        <div
                          key={item.id || `fleet-group-${index}`}
                          className="grid grid-cols-4 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.id || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Fleet Group Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.name || <em className="text-gray-400">No name</em>}
                            </span>
                          </div>

                          {/* Column 3: Vessels */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vessels || <em className="text-gray-400">No vessels</em>}
                            </span>
                          </div>

                          {/* Column 4: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No fleet groups found</div>
                    )
                  ) : selectedMaster === "017" ? (
                    // Special handling for Additional Groups Master (017) - Use external API data
                    additionalGroupsLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading additional groups...</div>
                    ) : additionalGroupsError ? (
                      <div className="p-3 text-xs text-red-500">Error loading additional groups: {(additionalGroupsError as Error).message}</div>
                    ) : additionalGroupsData && additionalGroupsData.length > 0 ? (
                      additionalGroupsData.map((item: any, index: number) => (
                        <div
                          key={item.id || `additional-group-${index}`}
                          className="grid grid-cols-4 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.id || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Group Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.name || <em className="text-gray-400">No group name</em>}
                            </span>
                          </div>

                          {/* Column 3: Vessels */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.vessels || <em className="text-gray-400">No vessels</em>}
                            </span>
                          </div>

                          {/* Column 4: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No additional groups found</div>
                    )
                  ) : selectedMaster === "018" ? (
                    // Special handling for Ports Master (018) - Use external API data
                    portsLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading ports...</div>
                    ) : portsError ? (
                      <div className="p-3 text-xs text-red-500">Error loading ports: {(portsError as Error).message}</div>
                    ) : portsData && portsData.length > 0 ? (
                      portsData.map((item: any, index: number) => (
                        <div
                          key={item.pid || item.id || `port-${index}`}
                          className="grid grid-cols-5 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.puid || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Port Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.name || <em className="text-gray-400">No port name</em>}
                            </span>
                          </div>

                          {/* Column 3: Country */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.country || <em className="text-gray-400">No country</em>}
                            </span>
                          </div>

                          {/* Column 4: Port Code/UNLOCODE */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.portcode || <em className="text-gray-400">No port code</em>}
                            </span>
                          </div>

                          {/* Column 5: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No ports found</div>
                    )
                  ) : selectedMaster === "019" ? (
                    // Special handling for Languages Master (019) - Use external API data
                    languagesLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading languages...</div>
                    ) : languagesError ? (
                      <div className="p-3 text-xs text-red-500">Error loading languages: {(languagesError as Error).message}</div>
                    ) : languagesData && languagesData.length > 0 ? (
                      languagesData.map((item: any, index: number) => (
                        <div
                          key={item.luid || item.id || `language-${index}`}
                          className="grid grid-cols-5 gap-0 border-b border-gray-100 hover:bg-gray-50"
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.luid || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Language Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.languageName || <em className="text-gray-400">No language name</em>}
                            </span>
                          </div>

                          {/* Column 3: Native Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.nativeName || <em className="text-gray-400">No native name</em>}
                            </span>
                          </div>

                          {/* Column 4: ISO Code */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">
                              {item.isoCode || <em className="text-gray-400">No ISO code</em>}
                            </span>
                          </div>

                          {/* Column 5: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400">External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No languages found</div>
                    )
                  ) : selectedMaster === "020" ? (
                    // Special handling for Country Master (020) - Use external API data
                    countriesLoading ? (
                      <div className="p-3 text-xs text-gray-500">Loading countries...</div>
                    ) : countriesError ? (
                      <div className="p-3 text-xs text-red-500">Error loading countries: {(countriesError as Error).message}</div>
                    ) : countriesData && countriesData.length > 0 ? (
                      countriesData.map((item: any, index: number) => (
                        <div
                          key={item.cuid || item.id || `country-${index}`}
                          className="grid grid-cols-3 gap-0 border-b border-gray-100 hover:bg-gray-50"
                          data-testid={`country-row-${item.cuid || index}`}
                        >
                          {/* Column 1: Entry ID */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700" data-testid={`country-entry-id-${item.nuid || index}`}>
                              {item.nuid || <em className="text-gray-400">No entry ID</em>}
                            </span>
                          </div>

                          {/* Column 2: Country Name */}
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700" data-testid={`country-name-${item.cuid || index}`}>
                              {item.countryName || item.name || <em className="text-gray-400">No country name</em>}
                            </span>
                          </div>

                          {/* Column 3: Actions - External data (read-only) */}
                          <div className="p-3 flex justify-center">
                            <span className="text-xs text-gray-400" data-testid={`country-action-${item.cuid || index}`}>External</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-gray-500">No countries found</div>
                    )
                  ) : (
                    (masterData as any[]).map((item: any) => {
                      // Different logic for identifying new entries based on master type
                      const isNewEntry = selectedMaster === "001" 
                        ? !item.countryName && !item.country  // For nationality master
                        : selectedMaster === "002"
                        ? !item.name && !item.countryCode     // For country master
                        : selectedMaster === "003"
                        ? !item.name && !item.description     // For language master
                        : selectedMaster === "004"
                        ? !item.vesselType && !item.vtuid     // For vessel type master
                        : selectedMaster === "014"
                        ? !item.vessel && !item.imoNumber && !item.vesselType    // For vessel master
                        : selectedMaster === "018"
                        ? !item.portName && !item.portcode     // For port master (port name and port code)
                        : selectedMaster === "021"
                        ? !item.name && !item.country && !item.email    // For manning agents master
                        : selectedMaster === "022"
                        ? !item.name    // For crew pool master (only name field)
                        : !item.name && !item.description;   // For other masters
                      
                      // Special handling for Users Master (013) - Always render exactly 5 columns
                      if (selectedMaster === "013") {
                        return (
                          <div key={item.id} className={`${USERS_MASTER_GRID_CLASSES} border-b border-gray-100 hover:bg-gray-50 ${
                            isNewEntry && isMasterInEditMode ? 'bg-blue-50 border-blue-200' : ''
                          } users-master-grid-row`}>
                            {/* Column 1: Entry ID (always rendered) */}
                            <div className="p-3 border-r border-gray-200">
                              <span className="text-xs text-gray-700">{item.entryId || item.entry_id || <em className="text-gray-400">No entry ID</em>}</span>
                            </div>
                            
                            {/* Column 2: First Name (firstname field) */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'firstname', item.firstname)}
                                  onChange={(e) => updateMasterField(item.id, 'firstname', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter first name..." : ""}
                                  data-testid={`input-firstname-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.firstname || <em className="text-gray-400">No first name</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 3: Last Name (lastname field) */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'lastname', item.lastname)}
                                  onChange={(e) => updateMasterField(item.id, 'lastname', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter last name..." : ""}
                                  data-testid={`input-lastname-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.lastname || <em className="text-gray-400">No last name</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 4: Designation (designation dropdown) */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <Select 
                                  value={getEffectiveValue(item.id, 'designationId', item.designationId)} 
                                  onValueChange={(value) => updateMasterField(item.id, 'designationId', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300">
                                    <SelectValue placeholder={isNewEntry ? "Select designation..." : "Select designation"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {designationLoading ? (
                                      <SelectItem value="loading" disabled>Loading designations...</SelectItem>
                                    ) : (
                                      (designationData as any[])
                                        .filter((designation: any) => {
                                          const value = designation.name || '';
                                          return value.trim().length > 0;
                                        })
                                        .map((designation: any) => (
                                          <SelectItem 
                                            key={designation.id} 
                                            value={designation.entryId || designation.id}
                                            data-testid={`select-designation-option-${designation.id}`}
                                          >
                                            {designation.name || `Designation ${designation.id}`}
                                          </SelectItem>
                                        ))
                                    )}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-gray-700">
                                  {(() => {
                                    const designation = (designationData as any[])?.find((d: any) => d.entryId === item.designationId || d.id === item.designationId);
                                    return designation?.name || <em className="text-gray-400">No designation</em>;
                                  })()}
                                </span>
                              )}
                            </div>
                            
                            {/* Column 5: Actions (delete button) */}
                            <div className="p-3 flex justify-center">
                              <button
                                className={`transition-colors ${
                                  isMasterInEditMode 
                                    ? "text-gray-500 hover:text-red-500" 
                                    : "text-gray-300 cursor-not-allowed"
                                }`}
                                onClick={() => deleteMasterEntry(item.id)}
                                disabled={!isMasterInEditMode}
                                data-testid={`delete-button-${item.id}`}
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Special handling for Manning Agents Master (021) - 5 columns: Entry ID, Name, Country, Email, Actions
                      if (selectedMaster === "021") {
                        return (
                          <div key={item.id} className={`grid grid-cols-5 gap-0 border-b border-gray-100 hover:bg-gray-50 ${
                            isNewEntry && isMasterInEditMode ? 'bg-blue-50 border-blue-200' : ''
                          }`}>
                            {/* Column 1: Entry ID */}
                            <div className="p-3 border-r border-gray-200">
                              <span className="text-xs text-gray-700">{item.entryId || item.entry_id || <em className="text-gray-400">No entry ID</em>}</span>
                            </div>
                            
                            {/* Column 2: Name - Using StableInput to prevent value loss during re-renders */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <StableInput
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(value) => updateMasterField(item.id, 'name', value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter agent name..." : ""}
                                  data-testid={`input-manning-agent-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No name</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 3: Country - Using StableInput to prevent value loss during re-renders */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <StableInput
                                  value={getEffectiveValue(item.id, 'country', item.country)}
                                  onChange={(value) => updateMasterField(item.id, 'country', value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter country..." : ""}
                                  data-testid={`input-manning-agent-country-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.country || <em className="text-gray-400">No country</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 4: Email - Using StableInput to prevent value loss during re-renders */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <StableInput
                                  value={getEffectiveValue(item.id, 'email', item.email)}
                                  onChange={(value) => updateMasterField(item.id, 'email', value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter email..." : ""}
                                  data-testid={`input-manning-agent-email-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.email || <em className="text-gray-400">No email</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 5: Actions */}
                            <div className="p-3 flex justify-center">
                              <button
                                className={`transition-colors ${
                                  isMasterInEditMode 
                                    ? "text-gray-500 hover:text-red-500" 
                                    : "text-gray-300 cursor-not-allowed"
                                }`}
                                onClick={() => deleteMasterEntry(item.id)}
                                disabled={!isMasterInEditMode}
                                data-testid={`delete-manning-agent-${item.id}`}
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Special handling for Crew Pool Master (022) - 3 columns: Entry ID, Name, Actions
                      if (selectedMaster === "022") {
                        return (
                          <div key={item.id} className={`grid grid-cols-3 gap-0 border-b border-gray-100 hover:bg-gray-50 ${
                            isNewEntry && isMasterInEditMode ? 'bg-blue-50 border-blue-200' : ''
                          }`}>
                            {/* Column 1: Entry ID */}
                            <div className="p-3 border-r border-gray-200">
                              <span className="text-xs text-gray-700">{item.entryId || item.entry_id || <em className="text-gray-400">No entry ID</em>}</span>
                            </div>
                            
                            {/* Column 2: Name - Using StableInput to prevent value loss during re-renders */}
                            <div className="p-3 border-r border-gray-200">
                              {isMasterInEditMode ? (
                                <StableInput
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(value) => updateMasterField(item.id, 'name', value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter pool name..." : ""}
                                  data-testid={`input-crew-pool-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No name</em>}</span>
                              )}
                            </div>
                            
                            {/* Column 3: Actions */}
                            <div className="p-3 flex justify-center">
                              <button
                                className={`transition-colors ${
                                  isMasterInEditMode 
                                    ? "text-gray-500 hover:text-red-500" 
                                    : "text-gray-300 cursor-not-allowed"
                                }`}
                                onClick={() => deleteMasterEntry(item.id)}
                                disabled={!isMasterInEditMode}
                                data-testid={`delete-crew-pool-${item.id}`}
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Original logic for all other master types
                      return (
                        <div key={item.id} className={`grid ${selectedMaster === "014" ? 'grid-cols-5' : 'grid-cols-4'} gap-0 border-b border-gray-100 hover:bg-gray-50 ${
                          isNewEntry && isMasterInEditMode ? 'bg-blue-50 border-blue-200' : ''
                        }`}>
                          <div className="p-3 border-r border-gray-200">
                            <span className="text-xs text-gray-700">{item.entryId || item.entry_id || <em className="text-gray-400">No entry ID</em>}</span>
                          </div>
                          
                          {/* Second column - conditional based on master type */}
                          <div className="p-3 border-r border-gray-200">
                            {selectedMaster === "001" ? (
                              // Nationality master - show countryName field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'countryName', item.countryName)}
                                  onChange={(e) => updateMasterField(item.id, 'countryName', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter nationality..." : ""}
                                  data-testid={`input-countryName-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.countryName || <em className="text-gray-400">No nationality</em>}</span>
                              )
                            ) : selectedMaster === "002" ? (
                              // Country master - show name field (country name)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(e) => updateMasterField(item.id, 'name', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter country..." : ""}
                                  data-testid={`input-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No country</em>}</span>
                              )
                            ) : selectedMaster === "003" ? (
                              // Language master - show name field (language name)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(e) => updateMasterField(item.id, 'name', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter language..." : ""}
                                  data-testid={`input-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No language</em>}</span>
                              )
                            ) : selectedMaster === "004" ? (
                              // Vessel type master - show vesselType field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'vesselType', item.vesselType)}
                                  onChange={(e) => updateMasterField(item.id, 'vesselType', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter vessel type..." : ""}
                                  data-testid={`input-vesselType-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.vesselType || <em className="text-gray-400">No vessel type</em>}</span>
                              )
                            ) : selectedMaster === "014" ? (
                              // Vessel master - show vessel field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'vessel', item.vessel)}
                                  onChange={(e) => updateMasterField(item.id, 'vessel', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter vessel name..." : ""}
                                  data-testid={`input-vessel-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.vessel || <em className="text-gray-400">No vessel</em>}</span>
                              )
                            ) : selectedMaster === "018" ? (
                              // Port master - show portName field (port name) but save to 'name' (safe field)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'name', item.portName)}
                                  onChange={(e) => updateMasterField(item.id, 'name', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter port name..." : ""}
                                  data-testid={`input-portName-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.portName || <em className="text-gray-400">No port name</em>}</span>
                              )
                            ) : selectedMaster === "012" ? (
                              // Designation master - show name field (designation name)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(e) => updateMasterField(item.id, 'name', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter designation..." : ""}
                                  data-testid={`input-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No designation</em>}</span>
                              )
                            ) : (
                              // Other masters - show name field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'name', item.name)}
                                  onChange={(e) => updateMasterField(item.id, 'name', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter name..." : ""}
                                  data-testid={`input-name-${item.id}`}
                                  autoFocus={isNewEntry}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.name || <em className="text-gray-400">No name</em>}</span>
                              )
                            )}
                          </div>
                          
                          {/* Third column - conditional based on master type */}
                          <div className="p-3 border-r border-gray-200">
                            {selectedMaster === "001" ? (
                              // Nationality master - show country field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'country', item.country)}
                                  onChange={(e) => updateMasterField(item.id, 'country', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter country..." : ""}
                                  data-testid={`input-country-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.country || <em className="text-gray-400">No country</em>}</span>
                              )
                            ) : selectedMaster === "002" ? (
                              // Country master - show countryCode field (Country UN/LOCODE)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'countryCode', item.countryCode)}
                                  onChange={(e) => updateMasterField(item.id, 'countryCode', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter country code..." : ""}
                                  data-testid={`input-countryCode-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.countryCode || <em className="text-gray-400">No country code</em>}</span>
                              )
                            ) : selectedMaster === "003" ? (
                              // Language master - show description field (ISO language code)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'description', item.description)}
                                  onChange={(e) => updateMasterField(item.id, 'description', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter ISO code..." : ""}
                                  data-testid={`input-description-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.description || <em className="text-gray-400">No language code</em>}</span>
                              )
                            ) : selectedMaster === "004" ? (
                              // Vessel type master - show classification based on boolean flags
                              isMasterInEditMode ? (
                                <div className="grid grid-cols-3 gap-1 text-xs">
                                  <label className="flex items-center space-x-1">
                                    <Checkbox
                                      checked={Boolean(getEffectiveValue(item.id, 'tanker', item.tanker))}
                                      onCheckedChange={(checked) => updateMasterField(item.id, 'tanker', Boolean(checked))}
                                      data-testid={`checkbox-tanker-${item.id}`}
                                    />
                                    <span>Tanker</span>
                                  </label>
                                  <label className="flex items-center space-x-1">
                                    <Checkbox
                                      checked={Boolean(getEffectiveValue(item.id, 'oilTanker', item.oilTanker))}
                                      onCheckedChange={(checked) => updateMasterField(item.id, 'oilTanker', Boolean(checked))}
                                      data-testid={`checkbox-oilTanker-${item.id}`}
                                    />
                                    <span>Oil Tanker</span>
                                  </label>
                                  <label className="flex items-center space-x-1">
                                    <Checkbox
                                      checked={Boolean(getEffectiveValue(item.id, 'gasTanker', item.gasTanker))}
                                      onCheckedChange={(checked) => updateMasterField(item.id, 'gasTanker', Boolean(checked))}
                                      data-testid={`checkbox-gasTanker-${item.id}`}
                                    />
                                    <span>Gas Tanker</span>
                                  </label>
                                  <label className="flex items-center space-x-1">
                                    <Checkbox
                                      checked={Boolean(getEffectiveValue(item.id, 'chemicalTanker', item.chemicalTanker))}
                                      onCheckedChange={(checked) => updateMasterField(item.id, 'chemicalTanker', Boolean(checked))}
                                      data-testid={`checkbox-chemicalTanker-${item.id}`}
                                    />
                                    <span>Chemical Tanker</span>
                                  </label>
                                  <label className="flex items-center space-x-1">
                                    <Checkbox
                                      checked={Boolean(getEffectiveValue(item.id, 'bulk', item.bulk))}
                                      onCheckedChange={(checked) => updateMasterField(item.id, 'bulk', Boolean(checked))}
                                      data-testid={`checkbox-bulk-${item.id}`}
                                    />
                                    <span>Dry</span>
                                  </label>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-700">
                                  {(() => {
                                    const classifications = [];
                                    if (item.tanker) classifications.push('Tanker');
                                    if (item.oilTanker) classifications.push('Oil');
                                    if (item.gasTanker) classifications.push('Gas');
                                    if (item.chemicalTanker) classifications.push('Chemical');
                                    if (item.bulk) classifications.push('Bulk');
                                    return classifications.length > 0 ? classifications.join(', ') : <em className="text-gray-400">No classification</em>;
                                  })()}
                                </span>
                              )
                            ) : selectedMaster === "014" ? (
                              // Vessel master - show imoNumber field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'imoNumber', item.imoNumber)}
                                  onChange={(e) => updateMasterField(item.id, 'imoNumber', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter IMO number..." : ""}
                                  data-testid={`input-imoNumber-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.imoNumber || <em className="text-gray-400">No IMO number</em>}</span>
                              )
                            ) : selectedMaster === "018" ? (
                              // Port master - show portcode field (port code/UN LOCODE) but save to 'cid' (safe field)
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'cid', item.portcode)}
                                  onChange={(e) => updateMasterField(item.id, 'cid', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter port code..." : ""}
                                  data-testid={`input-portcode-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.portcode || <em className="text-gray-400">No port code</em>}</span>
                              )
                            ) : (
                              // Other masters - show description field
                              isMasterInEditMode ? (
                                <Input
                                  value={getEffectiveValue(item.id, 'description', item.description)}
                                  onChange={(e) => updateMasterField(item.id, 'description', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300"
                                  placeholder={isNewEntry ? "Enter description..." : ""}
                                  data-testid={`input-description-${item.id}`}
                                />
                              ) : (
                                <span className="text-xs text-gray-700">{item.description || <em className="text-gray-400">No description</em>}</span>
                              )
                            )}
                          </div>
                          
                          {/* Fourth column - only for Vessel Master (014) */}
                          {selectedMaster === "014" && (
                            <div className="p-3 border-r border-gray-200">
                              <Select 
                                value={getEffectiveValue(item.id, 'vesselType', item.vesselType)} 
                                onValueChange={(value) => updateMasterField(item.id, 'vesselType', value)}
                              >
                                <SelectTrigger className="h-6 text-xs border-0 p-0 bg-transparent focus:bg-white focus:border focus:border-blue-300">
                                  <SelectValue placeholder={isNewEntry ? "Select vessel type..." : "Select type"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {vesselTypeLoading ? (
                                    <SelectItem value="loading" disabled>Loading vessel types...</SelectItem>
                                  ) : (
                                    (vesselTypeData as any[])
                                      .filter((vesselType: any) => {
                                        const value = vesselType.vesselType || vesselType.name || '';
                                        return value.trim().length > 0;
                                      })
                                      .map((vesselType: any) => (
                                        <SelectItem 
                                          key={vesselType.id} 
                                          value={vesselType.vesselType || vesselType.name || `fallback-${vesselType.id}`}
                                          data-testid={`select-vesselType-option-${vesselType.id}`}
                                        >
                                          {vesselType.vesselType || vesselType.name || `Vessel Type ${vesselType.id}`}
                                        </SelectItem>
                                      ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div className="p-3 flex justify-center">
                            <button
                              className={`transition-colors ${
                                isMasterInEditMode 
                                  ? "text-gray-500 hover:text-red-500" 
                                  : "text-gray-300 cursor-not-allowed"
                              }`}
                              onClick={() => deleteMasterEntry(item.id)}
                              disabled={!isMasterInEditMode}
                              data-testid={`delete-button-${item.id}`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-3 text-xs text-gray-500 bg-gray-50 border-t">
                  Page {(masterData as any[]).length ? '1' : '0'} of {(masterData as any[]).length ? '1' : '0'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderFormsTable = () => (
    <div>
      <SectionTitleComponents title={"Forms Configuration"}>
        <div className="flex items-center gap-2 ml-[19px] mr-[19px]">
          <Button
            variant="outline"
            onClick={() => setShowCreateFormDialog(true)}
            className="h-8 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Create Form</span>
          </Button>
          <Button
            variant="outline"
            className="h-8 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
          >
            <span className="text-xs">Back</span>
          </Button>
        </div>
      </SectionTitleComponents>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <div className="text-[#4f5863] text-sm">Loading forms...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex justify-center items-center p-8">
          <div className="text-red-500 text-sm">Error loading forms. Please try again.</div>
          <div className="text-red-500 text-xs mt-2">
            {error instanceof Error ? error.message : String(error)}
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 pl-0 bg-[#f7fafc]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <ScrollArea className="h-[500px] w-full">
                <Table className="bg-white rounded-lg shadow-md overflow-hidden">
              <TableHeader>
                <TableRow className="bg-[#52baf3]">
                  <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                    Form
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                    Rank Group
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                    Version No
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                    Version Date
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {expandedFormsData.map((form) => (
                  <TableRow key={form.id} className="border-b border-gray-200 bg-white hover:bg-gray-50">
                    {form.isFirstInGroup && (
                      <TableCell 
                        rowSpan={form.groupSize}
                        className="text-[#4f5863] text-xs font-semibold py-3 border-r border-gray-200 bg-[#ffffff]"
                      >
                        <div className="flex items-center justify-between">
                          <span>{form.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={() => handleAddRankGroup(form.name)}
                          >
                            <Plus className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-[#4f5863] text-xs font-normal pl-6">
                      <div className="flex items-center justify-between gap-2">
                        {form.isPlaceholderRow ? (
                          <span className="text-gray-400 text-xs italic">No active rank groups</span>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span>{form.rankGroup}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleEditRankGroup(form.rankGroup, form.originalFormId)}
                                      data-testid={`button-view-rankgroup-${form.id}`}
                                    >
                                      <Eye className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View/Edit: {getRankGroupRanks(form.rankGroup, form.originalFormId)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleArchiveRankGroup(form.rankGroup, form.originalFormId)}
                                      data-testid={`button-archive-rankgroup-${form.id}`}
                                    >
                                      <Archive className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Archive Rank Group</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#4f5863] text-xs font-normal">
                      {form.versionNo}
                    </TableCell>
                    <TableCell className="text-[#4f5863] text-xs font-normal">
                      {form.versionDate}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleEditClick(form)}
                        >
                          <EditIcon className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !error && (
        <div className="mt-4 text-xs font-normal font-['Mulish',Helvetica] text-black">
          {expandedFormsData.length > 0 ? `1 to ${expandedFormsData.length} of ${expandedFormsData.length}` : "0 to 0 of 0"}
        </div>
      )}
    </div>
  );

  return (
    <>
      <SideBarComponent 
        selectedAdminPage={selectedAdminPage} 
        setSelectedAdminPage={setSelectedAdminPage} 
        allowedPages={["forms", "rank-admin", "masters", "training-matrix"]}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />
      <MainLayout hasSidebar={true}>
        <div className="lg:hidden flex items-center gap-2 mb-4">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#16569e] bg-white border border-[#16569e] rounded hover:bg-[#16569e] hover:text-white transition-colors"
            data-testid="mobile-sidebar-toggle"
          >
            <span>☰</span>
            <span>Menu</span>
          </button>
        </div>
        {selectedAdminPage === "forms" && renderFormsTable()}
        {selectedAdminPage === "rank-admin" && renderRankAdminModule()}
        {selectedAdminPage === "masters" && renderDataMastersModule()}
        {selectedAdminPage === "training-matrix" && renderTrainingMatrixModule()}
      </MainLayout>

      {/* Main content */}
      {/* <main className="absolute top-[67px] left-[67px] w-[calc(100%-67px)] h-[calc(100%-67px)]">
       
        </main> */}

      {/* Form Editor Modal */}
      {editingForm && (
        <FormEditorFactory
          formName={editingForm.name}
          form={editingForm}
          rankGroupName={editingRankGroup || undefined}
          onClose={handleCloseEditor}
          onSave={handleFormSave}
        />
      )}

      {/* Add/Edit Rank Group Dialog */}
      <AddRankGroupDialog 
        isOpen={isAddRankGroupOpen}
        onOpenChange={(open) => {
          setIsAddRankGroupOpen(open);
          if (!open) {
            setEditingRankGroupData(null);
            setSelectedFormForRankGroup(null);
          }
        }}
        selectedFormForRankGroup={selectedFormForRankGroup}
        availableRanks={availableRanks}
        createRankGroupMutation={createRankGroupMutation}
        updateRankGroupMutation={updateRankGroupMutation}
        editingRankGroup={editingRankGroupData}
        forms={formsData || []}
      />

      {/* Archive Rank Group Confirmation Dialog */}
      <AlertDialog 
        open={archiveConfirmOpen} 
        onOpenChange={(open) => {
          setArchiveConfirmOpen(open);
          if (!open) {
            setPendingArchiveRankGroup(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Rank Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive the rank group "{pendingArchiveRankGroup?.name}"? 
              This will preserve historical data for older forms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmArchiveRankGroup}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vessel Group Modal */}
      <Dialog open={isVesselGroupModalOpen} onOpenChange={(open) => {
        setIsVesselGroupModalOpen(open);
        if (!open) {
          vesselGroupForm.reset();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Vessel Group</DialogTitle>
            <DialogDescription>
              Create a new vessel group to manage multiple vessels together.
            </DialogDescription>
          </DialogHeader>
          <FormComponent {...vesselGroupForm}>
            <form className="space-y-4" onSubmit={vesselGroupForm.handleSubmit((data) => {
              createVesselGroupMutation.mutate(data);
            })}>
              <FormField
                control={vesselGroupForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">
                      Group Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter vessel group name"
                        className="h-8 text-xs"
                        data-testid="input-vessel-group-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={vesselGroupForm.control}
                name="vesselIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">
                      Select Vessels
                    </FormLabel>
                    <FormControl>
                      <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                        {vesselOptions.filter((vessel: VesselOption) => vessel.type === 'vessel').map((vessel: VesselOption) => (
                          <div key={vessel.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value.includes(vessel.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, vessel.value]);
                                } else {
                                  field.onChange(field.value.filter((id: string) => id !== vessel.value));
                                }
                              }}
                              className="h-4 w-4"
                              data-testid={`checkbox-vessel-${vessel.value}`}
                            />
                            <label className="text-xs">{vessel.label}</label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </FormComponent>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsVesselGroupModalOpen(false);
                vesselGroupForm.reset();
              }}
              className="h-8 text-xs"
              data-testid="button-cancel-vessel-group"
            >
              Cancel
            </Button>
            <Button
              onClick={vesselGroupForm.handleSubmit((data) => {
                createVesselGroupMutation.mutate(data);
              })}
              disabled={!vesselGroupForm.formState.isValid || createVesselGroupMutation.isPending}
              className="h-8 text-xs"
              data-testid="button-create-vessel-group"
            >
              {createVesselGroupMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Form Dialog */}
      <Dialog open={showCreateFormDialog} onOpenChange={setShowCreateFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Name</label>
              <Input
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Enter form name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Form Category</label>
              <Select value={newFormCategory} onValueChange={(value: "appraisal" | "promotion") => setNewFormCategory(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appraisal">Appraisal Form</SelectItem>
                  <SelectItem value="promotion">Promotion Form</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Creation Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="template"
                    checked={createFormType === "template"}
                    onChange={(e) => setCreateFormType(e.target.value as "template" | "blank")}
                  />
                  <span>Use Template</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="blank"
                    checked={createFormType === "blank"}
                    onChange={(e) => setCreateFormType(e.target.value as "template" | "blank")}
                  />
                  <span>Blank Form</span>
                </label>
              </div>
            </div>

            {createFormType === "template" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(formTemplates).map((templateName) => (
                      <SelectItem key={templateName} value={templateName}>
                        {templateName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateFormDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateForm}
              disabled={
                !newFormName.trim() ||
                (createFormType === "template" && !selectedTemplate) ||
                createFormMutation.isPending
              }
            >
              {createFormMutation.isPending ? "Creating..." : "Create Form"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onSave={handleSaveChanges}
        onDiscard={handleDiscardChanges}
        onCancel={handleCancelNavigation}
        title="Unsaved Changes"
        description="You have unsaved changes that will be lost if you continue. What would you like to do?"
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-delete-rank-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Rank
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the rank <strong>{rankToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone. The rank will be permanently removed from the system and any associated data will be lost.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancelDeleteRank}
              data-testid="button-cancel-delete-rank"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteRank}
              disabled={deleteRankMutation.isPending}
              data-testid="button-confirm-delete-rank"
            >
              {deleteRankMutation.isPending ? "Deleting..." : "Delete Rank"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Promotion Hierarchy Dialog */}
      <PromotionHierarchyDialog
        open={isPromotionHierarchyOpen}
        onOpenChange={setIsPromotionHierarchyOpen}
      />
    </>
  );
};

// Add/Edit Rank Group Dialog Component (moved outside to prevent re-creation on every render)
const AddRankGroupDialog = ({ 
  isOpen, 
  onOpenChange, 
  selectedFormForRankGroup, 
  availableRanks, 
  createRankGroupMutation,
  updateRankGroupMutation,
  editingRankGroup,
  forms
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFormForRankGroup: string | null;
  availableRanks: AvailableRank[];
  createRankGroupMutation: any;
  updateRankGroupMutation: any;
  editingRankGroup: RankGroup | null;
  forms: Form[];
}) => {
  const isEditMode = !!editingRankGroup;
  
  // Parse ranks from editing rank group
  const getInitialRanks = (): string[] => {
    if (!editingRankGroup) return [];
    try {
      const parsed = typeof editingRankGroup.ranks === 'string' 
        ? JSON.parse(editingRankGroup.ranks) 
        : editingRankGroup.ranks;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const form = useForm({
    resolver: zodResolver(rankGroupSchema),
    defaultValues: {
      name: editingRankGroup?.name || "",
      ranks: getInitialRanks(),
    },
  });

  // Determine the form ID for fetching conflicts
  const getFormId = (): number | null => {
    if (isEditMode && editingRankGroup) {
      return editingRankGroup.formId;
    }
    if (selectedFormForRankGroup) {
      const selectedForm = forms.find(f => f.name === selectedFormForRankGroup);
      return selectedForm?.id || null;
    }
    return null;
  };

  const formId = getFormId();

  // Fetch rank conflicts for this form
  const { data: rankConflicts = {} } = useQuery<Record<string, string>>({
    queryKey: ['/api/rank-groups/form', formId, 'rank-conflicts', editingRankGroup?.id],
    queryFn: async () => {
      if (!formId) return {};
      const url = editingRankGroup?.id 
        ? `/api/rank-groups/form/${formId}/rank-conflicts?excludeGroupId=${editingRankGroup.id}`
        : `/api/rank-groups/form/${formId}/rank-conflicts`;
      const response = await fetch(url);
      if (!response.ok) return {};
      return response.json();
    },
    enabled: isOpen && !!formId,
  });

  // Reset form when editingRankGroup changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: editingRankGroup?.name || "",
        ranks: getInitialRanks(),
      });
    }
  }, [isOpen, editingRankGroup]);

  // Filter to only show ranks applicable to company, using company labels
  const companyApplicableRanks = availableRanks.filter(rank => rank.applicableToCompany);

  const onSubmit = (data: { name: string; ranks: string[] }) => {
    if (isEditMode && editingRankGroup) {
      // Update existing rank group
      updateRankGroupMutation.mutate({
        id: editingRankGroup.id,
        name: data.name,
        ranks: JSON.stringify(data.ranks),
      });
    } else if (selectedFormForRankGroup) {
      // Create new rank group
      const selectedForm = forms.find(f => f.name === selectedFormForRankGroup);
      if (!selectedForm) {
        form.setError("root", {
          type: "manual",
          message: `Unable to find form "${selectedFormForRankGroup}". Please refresh and try again.`
        });
        return;
      }
      createRankGroupMutation.mutate({
        formId: selectedForm.id,
        name: data.name,
        ranks: JSON.stringify(data.ranks),
      });
    }
  };

  // Get form name for display in edit mode
  const getFormNameForDisplay = () => {
    if (isEditMode && editingRankGroup) {
      const formForEdit = forms.find(f => f.id === editingRankGroup.formId);
      return formForEdit?.name || "Unknown Form";
    }
    return selectedFormForRankGroup;
  };

  // Check if a rank is already assigned to another group
  const isRankConflicting = (rankLabel: string): string | null => {
    return rankConflicts[rankLabel] || null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? `Edit Rank Group: ${editingRankGroup?.name}` : `Add Rank Group to ${selectedFormForRankGroup}`}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? `Modify the rank group configuration for ${getFormNameForDisplay()}.`
              : "Create a new rank group configuration for different appraisal requirements."
            }
          </DialogDescription>
        </DialogHeader>
        <FormComponent {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rank Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter rank group name" {...field} data-testid="input-rankgroup-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ranks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Ranks</FormLabel>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {companyApplicableRanks.map((rank) => {
                      const rankLabel = rank.label || rank.name;
                      const conflictingGroup = isRankConflicting(rankLabel);
                      const isDisabled = !!conflictingGroup;
                      
                      return (
                        <div key={rank.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`rank-${rank.id}`}
                            checked={(field.value as string[])?.includes(rankLabel) || false}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => {
                              const currentValue = field.value || [];
                              if (checked) {
                                field.onChange([...currentValue, rankLabel]);
                              } else {
                                field.onChange(currentValue.filter((r: string) => r !== rankLabel));
                              }
                            }}
                            data-testid={`checkbox-rank-${rank.id}`}
                          />
                          <label 
                            htmlFor={`rank-${rank.id}`} 
                            className={`text-sm flex-1 ${isDisabled ? 'text-muted-foreground' : ''}`}
                          >
                            {rankLabel}
                            {conflictingGroup && (
                              <span className="text-xs text-amber-600 ml-2">
                                (assigned to "{conflictingGroup}")
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm text-red-500 mt-2">
                {form.formState.errors.root.message}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-rank-group"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isEditMode ? updateRankGroupMutation.isPending : createRankGroupMutation.isPending} 
                data-testid="button-save-rank-group"
              >
                {isEditMode 
                  ? (updateRankGroupMutation.isPending ? "Saving..." : "Save Changes")
                  : (createRankGroupMutation.isPending ? "Adding..." : "Add Rank Group")
                }
              </Button>
            </div>
          </form>
        </FormComponent>
      </DialogContent>
    </Dialog>
  );
};

// Wrapper component with EditSessionProvider
export const AdminModule = (): JSX.Element => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const updateEntryMutation = useUpdateMasterDataEntry();

  // Define handlers here that will be passed to the provider
  const handleEditSessionSave = async (masterId: string, changes: Map<string | number, Record<string, any>>) => {
    if (import.meta.env.DEV) {
      console.log(`💾 [EDIT_SESSION] Saving ${changes.size} changes for master ${masterId}`);
    }

    // Check if this is vessel or port master for special handling
    const isVesselMasterSave = isVesselMaster(masterId);
    const isPortMasterSave = isPortMaster(masterId);

    const promises: Promise<any>[] = [];
    
    changes.forEach((entryChanges, entryId) => {
      let processedChanges = entryChanges;
      
      // Apply safe field mapping for vessel master
      if (isVesselMasterSave) {
        // Ensure name field is populated if vessel field exists
        if (entryChanges.vessel && !entryChanges.name) {
          entryChanges.name = entryChanges.vessel;
        }
        
        // Map imoNumber to description temporarily
        if (entryChanges.imoNumber && !entryChanges.description) {
          entryChanges.description = entryChanges.imoNumber;
        }
        
        // Filter to only include safe fields for database
        processedChanges = filterToSafeFields(entryChanges);
        
        // Validate that name field is populated
        if (!processedChanges.name && entryChanges.vessel) {
          processedChanges.name = entryChanges.vessel;
        }
      }
      
      // Apply safe field mapping for port master
      if (isPortMasterSave) {
        // Ensure name field is populated if portName field exists
        if (entryChanges.portName && !entryChanges.name) {
          entryChanges.name = entryChanges.portName;
        }
        
        // Map coordinates to description temporarily
        if ((entryChanges.latitude || entryChanges.longitude) && !entryChanges.description) {
          const coords = { lat: entryChanges.latitude || '', lng: entryChanges.longitude || '' };
          entryChanges.description = JSON.stringify(coords);
        }
        
        // Filter to only include safe fields for database
        processedChanges = filterToPortSafeFields(entryChanges);
        
        // Validate that name field is populated
        if (!processedChanges.name && entryChanges.portName) {
          processedChanges.name = entryChanges.portName;
        }
      }
      
      // Create save promise
      const promise = updateEntryMutation.mutateAsync({ 
        id: entryId as number, 
        data: processedChanges, 
        masterId 
      });
      
      promises.push(promise);
    });

    // Wait for all saves to complete
    await Promise.all(promises);

    const successMessage = isVesselMasterSave 
      ? `Saved vessel data for ${changes.size} entries (safe mode)`
      : isPortMasterSave
      ? `Saved port data for ${changes.size} entries (safe mode)`
      : `Saved changes for ${changes.size} entries`;
      
    toast({
      title: "Success",
      description: successMessage,
    });
  };

  const handleEditSessionNavigate = (target: string) => {
    if (import.meta.env.DEV) {
      console.log(`🔗 [EDIT_SESSION] Navigating to: ${target}`);
    }
    navigate(target);
  };

  return (
    <EditSessionProvider
      onSave={handleEditSessionSave}
      onNavigate={handleEditSessionNavigate}
    >
      <AdminModuleInner />
    </EditSessionProvider>
  );
};