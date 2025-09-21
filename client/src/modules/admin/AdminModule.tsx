import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditIcon, Plus, Eye, Grip, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Form, RankGroup, AvailableRank, InsertMasterDataEntry } from "@shared/schema";
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
import { useRankMasterData, useCompanyRanks, useCreateRank, useUpdateRank, useDeleteRank, type RankMasterData } from "@/hooks/useCompanyRanks";
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

const rankGroupSchema = z.object({
  name: z.string().min(1, "Rank group name is required"),
  ranks: z.array(z.string()).min(1, "At least one rank must be selected"),
});

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
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [editingRankGroup, setEditingRankGroup] = useState<string | null>(null);
  const [isAddRankGroupOpen, setIsAddRankGroupOpen] = useState(false);
  const [selectedFormForRankGroup, setSelectedFormForRankGroup] = useState<string | null>(null);
  const [showCreateFormDialog, setShowCreateFormDialog] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [createFormType, setCreateFormType] = useState<"template" | "blank">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  
  // Rank Master data from shared hook (for initialization)
  const { data: sharedRankMasterData, isLoading: rankMasterLoading, error: rankMasterError } = useRankMasterData();
  
  // Mutation hooks for rank management
  const createRankMutation = useCreateRank();
  const updateRankMutation = useUpdateRank();
  const deleteRankMutation = useDeleteRank();
  
  // Local state for editing (initialized from shared data)
  const [rankMasterData, setRankMasterData] = useState<RankMasterData[]>([]);
  const [changedRanks, setChangedRanks] = useState<Set<string>>(new Set());
  const [newRanks, setNewRanks] = useState<Set<string>>(new Set());
  const [deletedRanks, setDeletedRanks] = useState<Set<string>>(new Set());
  
  // Sync local state with shared data on first load
  useEffect(() => {
    if (sharedRankMasterData) {
      setRankMasterData(sharedRankMasterData);
      // Clear change tracking when data refreshes
      setChangedRanks(new Set());
      setNewRanks(new Set());
      setDeletedRanks(new Set());
    }
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
  
  // Vessel state
  const [vesselRankDataMap, setVesselRankDataMap] = useState<Map<string, VesselRankData[]>>(new Map());
  const [isVesselEditing, setIsVesselEditing] = useState(false);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRevision, setSelectedRevision] = useState("R1");
  const [flexDate, setFlexDate] = useState("");
  const [revisionMode, setRevisionMode] = useState(false);
  
  // Data Masters state
  const [searchDataMaster, setSearchDataMaster] = useState("");
  const [selectedMaster, setSelectedMaster] = useState<string>("001");
  
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
      // Convert string ID to number for the API call
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
  const { data: mastersList = [], isLoading: mastersLoading, error: mastersError } = useDataMasters();
  
  // Debug logging for masters list
  useEffect(() => {
    console.log('🔍 [MASTERS DEBUG] mastersList:', mastersList);
    console.log('🔍 [MASTERS DEBUG] mastersList length:', mastersList.length);
    console.log('🔍 [MASTERS DEBUG] selectedMaster:', selectedMaster);
    console.log('🔍 [MASTERS DEBUG] mastersLoading:', mastersLoading);
    console.log('🔍 [MASTERS DEBUG] mastersError:', mastersError);
    
    // Check if Port Master (018) is in the list
    const portMaster = (mastersList as any[]).find((m: any) => m.id === '018');
    console.log('🔍 [MASTERS DEBUG] Port Master (018) found:', portMaster);
  }, [mastersList, selectedMaster, mastersLoading, mastersError]);
  
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
  const masterData = useMemo(() => {
    if (isVesselMaster(selectedMaster)) {
      return rawMasterData.map((item: any) => mapSafeFieldsToVesselData(item));
    }
    if (isPortMaster(selectedMaster)) {
      return rawMasterData.map((item: any) => mapSafeFieldsToPortData(item));
    }
    return rawMasterData;
  }, [rawMasterData, selectedMaster]);
  
  // Vessel Type Master Data (for vessel master dropdown)
  const { data: vesselTypeData = [], isLoading: vesselTypeLoading } = useMasterDataEntries('004');
  
  // Designation Master Data (for users master dropdown)
  const { data: designationData = [], isLoading: designationLoading } = useMasterDataEntries('012');
  
  // Vessels Master Data (for vessel selection dropdown - ID 014)
  const { data: vesselMasterData = [], isLoading: vesselMasterLoading } = useMasterDataEntries('014');
  
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

  // Helper function to update vessel rank data for selected vessels with robust error handling
  const updateVesselRankData = (updater: (current: VesselRankData[]) => VesselRankData[]) => {
    if (!updater || typeof updater !== 'function') {
      console.error('updateVesselRankData: Invalid updater function provided');
      return;
    }

    if (!selectedVessels || selectedVessels.length === 0) {
      console.warn('updateVesselRankData: No vessels selected for update');
      return;
    }

    setVesselRankDataMap(prev => {
      try {
        const newMap = new Map(prev);
        let hasUpdates = false;
        
        selectedVessels.forEach(vesselId => {
          if (!vesselId) {
            console.warn('updateVesselRankData: Invalid vessel ID encountered');
            return;
          }
          
          try {
            const currentData = newMap.get(vesselId) || [];
            const updatedData = updater(currentData);
            
            // Validate updated data structure
            if (!Array.isArray(updatedData)) {
              console.error(`updateVesselRankData: Updater returned non-array for vessel ${vesselId}`);
              return;
            }
            
            // Validate each rank in the updated data
            const isValidRankData = updatedData.every(rank => {
              return rank && 
                typeof rank.id === 'string' && 
                typeof rank.rank === 'string' &&
                typeof rank.rankId === 'string' &&
                Array.isArray(rank.actualManning) &&
                typeof rank.actualManningFlag === 'boolean' &&
                typeof rank.safeManning === 'boolean' &&
                typeof rank.optimumManning === 'boolean' &&
                typeof rank.highWorkloadManning === 'boolean';
            });
            
            if (!isValidRankData) {
              console.error(`updateVesselRankData: Invalid rank data structure for vessel ${vesselId}`);
              return;
            }
            
            newMap.set(vesselId, updatedData);
            hasUpdates = true;
          } catch (vesselError) {
            console.error(`updateVesselRankData: Error updating vessel ${vesselId}:`, vesselError);
          }
        });
        
        return hasUpdates ? newMap : prev;
      } catch (error) {
        console.error('updateVesselRankData: Critical error during update:', error);
        return prev; // Return original state to prevent data corruption
      }
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
  
  // Dynamic vessel data from Vessels Master (ID 014)
  const vesselOptions = useMemo((): VesselOption[] => {
    return vesselMasterData.map((vessel: any): VesselOption => {
      // Apply vessel field mapping if the data needs transformation
      const mappedVessel = mapSafeFieldsToVesselData(vessel);
      
      // Ensure we have a consistent value field for selection
      const vesselValue = vessel.id || vessel.entry_id || vessel.vuid || `vessel_${vessel.name || mappedVessel.vessel || 'unknown'}`;
      
      // Ensure we have a consistent label field for display
      const vesselLabel = mappedVessel.vessel || vessel.name || vessel.label || `Vessel ${vesselValue}`;
      
      return {
        value: String(vesselValue), // Ensure it's always a string
        label: String(vesselLabel)  // Ensure it's always a string
      };
    });
  }, [vesselMasterData]);
  
  const rq = useQueryClient();

  // Initialize company rank data from rank master
  React.useEffect(() => {
    const applicableRanks = rankMasterData.filter(rank => rank.applicableToCompany);
    const companyRanks: CompanyRankData[] = applicableRanks.map(rank => ({
      id: rank.id,
      rank: rank.label || rank.rank,
      rankId: rank.rankId,
      officer: rank.rank.toLowerCase().includes('officer') || rank.rank.toLowerCase().includes('master') || rank.rank.toLowerCase().includes('engineer'),
      rating: !rank.rank.toLowerCase().includes('officer') && !rank.rank.toLowerCase().includes('master') && !rank.rank.toLowerCase().includes('engineer'),
      seniorOfficer: rank.rank.toLowerCase().includes('master') || rank.rank.toLowerCase().includes('chief'),
      deckOfficer: rank.rank.toLowerCase().includes('officer') && !rank.rank.toLowerCase().includes('engineer'),
      engOfficer: rank.rank.toLowerCase().includes('engineer'),
      pettyOfficer: false,
      deckRating: rank.rank.toLowerCase().includes('cadet') || rank.rank.toLowerCase().includes('deck'),
      engineRating: false,
      generalRating: false,
      cateringRating: false,
      safetyOfficer: rank.rank.toLowerCase().includes('master') || rank.rank.toLowerCase().includes('chief'),
      sso: rank.rank.toLowerCase().includes('master'),
      medicalOfficer: false,
      navigatingOfficer: rank.rank.toLowerCase().includes('master') || rank.rank.toLowerCase().includes('officer'),
      emtOfficer: false,
      hasMultiple: false
    }));
    setCompanyRankData(companyRanks);
  }, [rankMasterData]);

  // Sync vessel rank data with company rank data changes for all vessels
  React.useEffect(() => {
    // Don't sync if companyRankData is empty (initial state)
    if (companyRankData.length === 0) return;

    setVesselRankDataMap(prev => {
      const newMap = new Map();
      
      vesselOptions.forEach((vessel: VesselOption) => {
        const existingVesselData = prev.get(vessel.value) || [];
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
            // Officer role overrides (default to Company tab values)
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
      
      return newMap;
    });
  }, [companyRankData]);

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
          const categoryFromApplicability = rankData.applicableToCompany ? 'Senior Officers' : 'Ratings';
          await createRankMutation.mutateAsync({
            name: rankData.rank,
            category: categoryFromApplicability,
            ...(rankData.rankId && { rankId: rankData.rankId }),
            ...(rankData.label && { label: rankData.label })
          });
        }
      }
      
      // Process updates to existing ranks
      for (const changedId of Array.from(changedRanks)) {
        if (!changedId.startsWith('new_') && !deletedRanks.has(changedId)) {
          const rankData = rankMasterData.find(r => r.id === changedId);
          if (rankData) {
            const categoryFromApplicability = rankData.applicableToCompany ? 'Senior Officers' : 'Ratings';
            await updateRankMutation.mutateAsync({
              id: parseInt(changedId),
              data: {
                name: rankData.rank,
                category: categoryFromApplicability,
                ...(rankData.rankId && { rankId: rankData.rankId }),
                ...(rankData.label && { label: rankData.label })
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

  const updateMasterField = (itemId: number, field: 'name' | 'description' | 'countryName' | 'country' | 'countryCode' | 'vesselType' | 'vtuid' | 'tanker' | 'oilTanker' | 'gasTanker' | 'chemicalTanker' | 'bulk' | 'vessel' | 'imoNumber' | 'cid' | 'firstname' | 'lastname' | 'designationId', value: string | boolean) => {
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
            await rq.refetchQueries({ 
              queryKey: ['/api/masters', selectedMaster, 'entries'],
              exact: true
            });
            
            // Get fresh data directly from the query cache
            const freshRawData = (rq.getQueryData(['/api/masters', selectedMaster, 'entries']) as any[]) || [];
            
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
    setCompanyRankData(prev => {
      const newData = [...prev];
      const rowIndex = newData.findIndex(row => row.id === id);
      if (rowIndex !== -1) {
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
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
      // TODO: Save company rank data changes to backend
      // For now, just update the editing state
      setIsCompanyEditing(false);
      
      toast({
        title: "Success",
        description: "Company changes saved successfully",
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
    // Find the rank to multiply - could be original rank or need to get from existing role
    let rankToMultiply = companyRankData.find(rank => rank.id === rankId);
    
    // If not found, this might be an originalRankId, so get data from existing role
    if (!rankToMultiply) {
      const existingRole = companyRankData.find(row => row.originalRankId === rankId);
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
    
    if (rankToMultiply) {
      setCompanyRankData(prev => {
        const currentData = [...prev];
        const rankIndex = currentData.findIndex(rank => rank.id === rankId);
        
        // Check if this rank already has role rows
        const existingRoles = currentData.filter(row => row.originalRankId === rankId);
        
        if (existingRoles.length === 0) {
          // First time creating roles - replace the parent row with 2 role rows
          const role1: CompanyRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_1_${Date.now()}`,
            role: `${rankToMultiply.rank}_1`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          const role2: CompanyRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_2_${Date.now()}`,
            role: `${rankToMultiply.rank}_2`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Replace the parent row with the 2 role rows
          currentData.splice(rankIndex, 1, role1, role2);
        } else {
          // Adding more roles - find the highest role number and add 1 more
          const roleNumbers = existingRoles
            .map(role => {
              const match = role.role?.match(/_(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => num > 0);
          
          const nextRoleNumber = Math.max(...roleNumbers, 0) + 1;
          
          const newRole: CompanyRankData = {
            ...rankToMultiply,
            id: `${rankToMultiply.id}_role_${nextRoleNumber}_${Date.now()}`,
            role: `${rankToMultiply.rank}_${nextRoleNumber}`,
            originalRankId: rankId,
            isRoleRow: true,
            hasMultiple: false
          };
          
          // Add the new role after the last existing role for this rank
          const lastRoleIndex = Math.max(...existingRoles.map(role => 
            currentData.findIndex(row => row.id === role.id)
          ));
          currentData.splice(lastRoleIndex + 1, 0, newRole);
        }
        
        return currentData;
      });
    }
  };

  const handleDeleteCompanyRank = (rankId: string) => {
    setCompanyRankData(prev => {
      const rankToDelete = prev.find(rank => rank.id === rankId);
      const filteredData = prev.filter(rank => rank.id !== rankId);
      
      // If deleting a role row, check if only 1 role remains for this rank
      if (rankToDelete?.isRoleRow && rankToDelete.originalRankId) {
        const remainingRoles = filteredData.filter(row => row.originalRankId === rankToDelete.originalRankId);
        
        // If only 1 role remains, convert it back to a regular rank
        if (remainingRoles.length === 1) {
          const lastRoleIndex = filteredData.findIndex(row => row.id === remainingRoles[0].id);
          if (lastRoleIndex !== -1) {
            filteredData[lastRoleIndex] = {
              ...filteredData[lastRoleIndex],
              role: undefined,
              originalRankId: undefined,
              isRoleRow: false,
              hasMultiple: false,
              id: rankToDelete.originalRankId // Restore original ID
            };
          }
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

  const handleRevision = () => {
    if (selectedVessels.length === 0) {
      console.warn('Cannot start revision mode: No vessels selected');
      return;
    }
    setRevisionMode(true);
    setIsVesselEditing(true);
  };

  const handleSaveDraft = () => {
    if (selectedVessels.length === 0) return;
    
    try {
      // Stop any ongoing editing in the grid
      vesselGridApi?.stopEditing();
      
      // Save draft for all selected vessels
      const draftData = new Map();
      selectedVessels.forEach(vesselId => {
        const vesselData = vesselRankDataMap.get(vesselId);
        if (vesselData) {
          draftData.set(vesselId, [...vesselData]);
        }
      });
      
      // TODO: Persist draft data to backend/localStorage
      console.log("Saving draft for vessels:", Array.from(draftData.keys()));
      console.log("Draft data:", Object.fromEntries(draftData));
      
      // Show success feedback (could add toast here)
      
    } catch (error) {
      console.error("Error saving draft:", error);
      // TODO: Show error feedback
    }
  };

  const handleCancel = () => {
    // Stop any ongoing editing
    vesselGridApi?.stopEditing();
    
    // Clear selected vessels and reset states
    setSelectedVessels([]);
    setRevisionMode(false);
    setIsVesselEditing(false);
    
    // TODO: Revert any unsaved changes by reloading original data
    // For now, we could reload from server or reset to original state
    console.log("Cancelled vessel revision mode");
  };

  const handleSubmit = () => {
    if (selectedVessels.length === 0) return;
    
    try {
      // Stop any ongoing editing
      vesselGridApi?.stopEditing();
      
      // Prepare submission data for all selected vessels
      const submissionData = new Map();
      selectedVessels.forEach(vesselId => {
        const vesselData = vesselRankDataMap.get(vesselId);
        if (vesselData) {
          // Filter out any invalid data and prepare for submission
          const validData = vesselData.filter(row => row.rank && row.rank.trim() !== '');
          submissionData.set(vesselId, validData);
        }
      });
      
      // TODO: Submit to backend API
      console.log("Submitting changes for vessels:", Array.from(submissionData.keys()));
      console.log("Submission data:", Object.fromEntries(submissionData));
      
      // Reset states after successful submission
      setSelectedVessels([]);
      setRevisionMode(false);
      setIsVesselEditing(false);
      
      // TODO: Show success feedback and potentially refresh data
      
    } catch (error) {
      console.error("Error submitting changes:", error);
      // TODO: Show error feedback, keep revision mode active
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
      setIsAddRankGroupOpen(false);
      setSelectedFormForRankGroup(null);
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: { name: string; versionNo: string; versionDate: string }) => {
      return await apiRequest("POST", "/api/forms", data);
    },
    onSuccess: () => {
      rq.invalidateQueries({ queryKey: ["/api/forms"] });
      setShowCreateFormDialog(false);
      setNewFormName("");
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
    setEditingRankGroup("Senior Officers"); // Default to Senior Officers for now
  };

  const handleAddRankGroup = (formName: string) => {
    setSelectedFormForRankGroup(formName);
    setIsAddRankGroupOpen(true);
  };

  const getRankGroupRanks = (rankGroupName: string) => {
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

  const handleCreateForm = () => {
    if (!newFormName.trim()) return;

    const formData = {
      name: newFormName.trim(),
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

  const handleFormSave = (formData: any) => {
    console.log("Saving form configuration:", formData);
    // TODO: Implement form configuration save logic
    setEditingForm(null);
  };

  const handleCloseEditor = () => {
    setEditingForm(null);
    setEditingRankGroup(null);
  };

  // Add Rank Group Dialog Component
  const AddRankGroupDialog = () => {
    const form = useForm({
      resolver: zodResolver(rankGroupSchema),
      defaultValues: {
        name: "",
        ranks: [],
      },
    });

    const onSubmit = (data: { name: string; ranks: string[] }) => {
      if (selectedFormForRankGroup) {
        // Find the form ID based on the form name
        const formId = 1; // For now, assume all rank groups belong to form ID 1
        createRankGroupMutation.mutate({
          formId,
          name: data.name,
          ranks: data.ranks,
        });
      }
    };

    return (
      <Dialog open={isAddRankGroupOpen} onOpenChange={setIsAddRankGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rank Group to {selectedFormForRankGroup}</DialogTitle>
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
                      <Input placeholder="Enter rank group name" {...field} />
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
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {availableRanks.map((rank) => (
                        <div key={rank.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`rank-${rank.id}`}
                            checked={(field.value as string[])?.includes(rank.name) || false}
                            onCheckedChange={(checked) => {
                              const currentValue = field.value || [];
                              if (checked) {
                                field.onChange([...currentValue, rank.name]);
                              } else {
                                field.onChange(currentValue.filter((r: string) => r !== rank.name));
                              }
                            }}
                          />
                          <label htmlFor={`rank-${rank.id}`} className="text-sm">
                            {rank.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddRankGroupOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createRankGroupMutation.isPending}>
                  {createRankGroupMutation.isPending ? "Adding..." : "Add Rank Group"}
                </Button>
              </div>
            </form>
          </FormComponent>
        </DialogContent>
      </Dialog>
    );
  };

  // Debug log the forms data to understand duplication issue
  if (import.meta.env.DEV) {
    console.log('📋 [FORMS DEBUG] Raw forms data from backend:', formsData);
    console.log('📋 [FORMS DEBUG] Forms count:', formsData.length);
  }

  const renderRankAdminModule = () => (
    <div>
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
                    className="h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
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
                </div>
              )}
              {selectedRankAdminTab === "company" && (
                <div className="flex gap-2">
                  <Button
                    variant={isCompanyEditing ? "default" : "outline"}
                    onClick={isCompanyEditing ? handleSaveCompany : handleEditCompany}
                    className={`h-8 text-xs ${
                      isCompanyEditing 
                        ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                        : "border-[#e1e8ed] text-[#16569e]"
                    }`}
                  >
                    {isCompanyEditing ? "Save" : "Edit Table"}
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
                  className="h-8 text-xs border-[#e1e8ed] text-[#16569e] hover:bg-[#f3f4f6]"
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
              </div>
            )}
            {selectedRankAdminTab === "company" && (
              <div className="flex gap-2">
                <Button
                  variant={isCompanyEditing ? "default" : "outline"}
                  onClick={isCompanyEditing ? handleSaveCompany : handleEditCompany}
                  className={`h-8 text-xs ${
                    isCompanyEditing 
                      ? "bg-[#16569e] hover:bg-[#0f4078] text-white" 
                      : "border-[#e1e8ed] text-[#16569e]"
                  }`}
                >
                  {isCompanyEditing ? "Save" : "Edit Table"}
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
      <div className="pt-4 pb-4 pl-0">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="pt-4 pb-4 pl-0">
            {selectedRankAdminTab === "rank-master" && (
              <div className={`${currentBreakpoint === 'mobile' ? 'h-[400px]' : currentBreakpoint === 'tablet' ? 'h-[500px]' : 'h-[600px]'} overflow-auto`}>
                <Table className="bg-white rounded-lg shadow-md overflow-hidden">
                  <TableHeader className="bg-[#52baf3]">
                    <TableRow>
                      <TableHead className="text-white text-xs font-normal w-10">
                        {/* Drag handle header */}
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-24">
                        Rank ID
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal">
                        Rank
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-32">
                        Applicable to Company
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-32">
                        Rank Label
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-16">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {rankMasterData.map((rank, index) => (
                      <TableRow
                        key={rank.id}
                        className="border-b border-gray-200 bg-white hover:bg-gray-50"
                      >
                        {/* Drag handle column */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3 text-center">
                          {isRankMasterEditing && (
                            <div className="cursor-move text-xs text-gray-400" data-testid={`drag-handle-${rank.id}`}>
                              ⋮⋮
                            </div>
                          )}
                        </TableCell>
                        
                        {/* Rank ID column */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          {isRankMasterEditing ? (
                            <Input
                              type="text"
                              value={rank.rankId}
                              onChange={(e) => handleRankDataChange(rank.id, 'rankId', e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Enter rank ID"
                              data-testid={`input-rank-id-${rank.id}`}
                            />
                          ) : (
                            <span data-testid={`text-rank-id-${rank.id}`}>
                              {rank.rankId}
                            </span>
                          )}
                        </TableCell>
                        
                        {/* Rank column */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          {isRankMasterEditing ? (
                            <Input
                              type="text"
                              value={rank.rank}
                              onChange={(e) => handleRankDataChange(rank.id, 'rank', e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Enter rank name"
                              data-testid={`input-rank-${rank.id}`}
                            />
                          ) : (
                            <span data-testid={`text-rank-${rank.id}`}>
                              {rank.rank}
                            </span>
                          )}
                        </TableCell>
                        
                        {/* Applicable to Company checkbox column */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={rank.applicableToCompany}
                              onCheckedChange={(checked) => handleRankDataChange(rank.id, 'applicableToCompany', checked)}
                              disabled={!isRankMasterEditing}
                              className="h-4 w-4"
                              data-testid={`checkbox-applicable-${rank.id}`}
                            />
                          </div>
                        </TableCell>
                        
                        {/* Rank Label column - only show input when Applicable to Company is checked */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          {rank.applicableToCompany ? (
                            isRankMasterEditing ? (
                              <Input
                                type="text"
                                value={rank.label}
                                onChange={(e) => handleRankDataChange(rank.id, 'label', e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Enter rank label"
                                data-testid={`input-rank-label-${rank.id}`}
                              />
                            ) : (
                              <span data-testid={`text-rank-label-${rank.id}`}>
                                {rank.label}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </TableCell>
                        
                        {/* Delete button column */}
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          <div className="flex gap-2 justify-center">
                            {isRankMasterEditing && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteRankFromGrid(rank.id, rank.rank)}
                                data-testid={`button-delete-rank-${rank.id}`}
                                title="Delete rank"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Empty state */}
                    {rankMasterData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="text-gray-500 text-sm">
                            No ranks available. Click "New Rank" to add one.
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {selectedRankAdminTab === "company" && (
              <div>
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
                
                {/* Company Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                      <TableHead className="text-white text-xs font-normal w-4">
                        
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal">
                        Rank
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20">
                        Rank ID
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-16 text-center">
                        Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-16 text-center">
                        Rating
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Senior Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Deck Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Eng Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Petty Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Deck Rating
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Engine Rating
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Gen Rating
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Catering Rating
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Safety Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-16 text-center">
                        SSO
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Medical Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Navigating Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-20 text-center">
                        Emt Officer
                      </TableHead>
                      <TableHead className="text-white text-xs font-normal w-16">
                        
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyRankData.map((rank, index) => (
                      <TableRow key={rank.id} className="hover:bg-gray-50">
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          <div className="w-3 h-3 bg-gray-300 cursor-move rounded-sm" data-testid={`drag-handle-company-${rank.id}`}></div>
                        </TableCell>
                        
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          {rank.rank}
                        </TableCell>
                        
                        <TableCell className="text-[#4f5863] text-[13px] font-normal py-3">
                          {rank.rankId}
                        </TableCell>
                        
                        {/* Checkbox columns */}
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.officer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'officer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.rating}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'rating', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-rating-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.seniorOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'seniorOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-senior-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.deckOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'deckOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-deck-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.engOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'engOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-eng-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.pettyOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'pettyOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-petty-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.deckRating}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'deckRating', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-deck-rating-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.engineRating}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'engineRating', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-engine-rating-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.generalRating}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'generalRating', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-general-rating-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.cateringRating}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'cateringRating', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-catering-rating-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.safetyOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'safetyOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-safety-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.sso}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'sso', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-sso-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.medicalOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'medicalOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-medical-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.navigatingOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'navigatingOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-navigating-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <Checkbox
                            checked={rank.emtOfficer}
                            onCheckedChange={(checked) => handleCompanyRankDataChange(rank.id, 'emtOfficer', checked)}
                            disabled={!isCompanyEditing}
                            className="h-4 w-4"
                            data-testid={`checkbox-emt-officer-${rank.id}`}
                          />
                        </TableCell>
                        
                        {/* Multiple button and delete action */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {!rank.isRoleRow && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs px-2 py-1 h-6"
                                onClick={() => handleAddMultipleCompanyRole(rank.id)}
                                disabled={!isCompanyEditing}
                                data-testid={`button-multiple-${rank.id}`}
                              >
                                Multiple
                              </Button>
                            )}
                            {rank.isRoleRow && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCompanyRank(rank.id)}
                                data-testid={`button-delete-company-${rank.id}`}
                                title="Delete role"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Empty state */}
                    {companyRankData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-8">
                          <div className="text-gray-500 text-sm">
                            No company ranks available. Mark ranks as "Applicable to Company" in Rank Master tab.
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              </div>
            )}
            
            {selectedRankAdminTab === "vessel" && (
              <div className="-mt-8">
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
                            ? "Vessel / Vessel Group" 
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
                                value={vessel.value}
                                onSelect={() => {
                                  const isSelected = selectedVessels.includes(vessel.value);
                                  if (isSelected) {
                                    setSelectedVessels(selectedVessels.filter(v => v !== vessel.value));
                                  } else {
                                    setSelectedVessels([...selectedVessels, vessel.value]);
                                  }
                                }}
                                className="text-xs"
                              >
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    checked={selectedVessels.includes(vessel.value)}
                                    className="h-4 w-4"
                                  />
                                  <span>{vessel.label}</span>
                                </div>
                                <Check
                                  className={`ml-auto h-4 w-4 ${
                                    selectedVessels.includes(vessel.value) ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Select value={selectedRevision} onValueChange={setSelectedRevision}>
                      <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="revision-select">
                        <SelectValue placeholder="Revision No." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R0">R0</SelectItem>
                        <SelectItem value="R1">R1</SelectItem>
                        <SelectItem value="R2">R2</SelectItem>
                        <SelectItem value="R3">R3</SelectItem>
                      </SelectContent>
                    </Select>

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
                <div className={`${currentBreakpoint === 'mobile' ? 'h-[400px]' : currentBreakpoint === 'tablet' ? 'h-[450px]' : 'h-[500px]'} flex items-center justify-center bg-gray-50 rounded-lg`}>
                  <div className="text-center text-gray-500">
                    <p className="text-lg font-medium">Vessel Ranks</p>
                    <p className="text-sm">Feature temporarily disabled</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
                  <div className={`${selectedMaster === "013" ? USERS_MASTER_GRID_CLASSES : `grid ${selectedMaster === "014" ? 'grid-cols-5' : 'grid-cols-4'} gap-0`} ${selectedMaster === "013" ? 'users-master-header-grid' : ''}`}>
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
                        <div className="p-3 border-r border-blue-400">Port Code / UN/LOCODE</div>
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
            <Table className="bg-white rounded-lg shadow-md overflow-hidden">
              <TableHeader className="bg-[#52baf3]">
                <TableRow>
                  <TableHead className="text-white text-xs font-normal">
                    Form
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Rank Group
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Version No
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal">
                    Version Date
                  </TableHead>
                  <TableHead className="text-white text-xs font-normal w-24">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {formsData.map((form) => (
                  <TableRow key={form.id} className="border-b border-gray-200 bg-white hover:bg-gray-50">
                    <TableCell className="text-[#4f5863] text-[13px] font-semibold py-3 border-r border-gray-200 bg-[#ffffff]">
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
                    <TableCell className="text-[#4f5863] text-[13px] font-normal pl-6">
                      <div className="flex items-center justify-between">
                        <span>{form.rankGroup}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 ml-2"
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ranks: {getRankGroupRanks(form.rankGroup)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#4f5863] text-[13px] font-normal">
                      {form.versionNo}
                    </TableCell>
                    <TableCell className="text-[#4f5863] text-[13px] font-normal">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleDeleteForm(form)}
                          data-testid={`button-delete-form-${form.id}`}
                        >
                          <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !error && (
        <div className="mt-4 text-xs font-normal font-['Mulish',Helvetica] text-black">
          {formsData.length > 0 ? `1 to ${formsData.length} of ${formsData.length}` : "0 to 0 of 0"}
        </div>
      )}
    </div>
  );

  return (
    <>
      <SideBarComponent selectedAdminPage={selectedAdminPage} setSelectedAdminPage={setSelectedAdminPage} allowedPages={["forms", "rank-admin", "masters", "training-matrix"]} />
      <MainLayout>
        {selectedAdminPage === "forms" && renderFormsTable()}
        {selectedAdminPage === "rank-admin" && renderRankAdminModule()}
        {selectedAdminPage === "masters" && renderDataMastersModule()}
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

      {/* Add Rank Group Dialog */}
      <AddRankGroupDialog />

      {/* Create Form Dialog */}
      <Dialog open={showCreateFormDialog} onOpenChange={setShowCreateFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Form Name</FormLabel>
              <Input
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Enter form name"
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Creation Type</FormLabel>
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
                <FormLabel>Select Template</FormLabel>
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
    </>
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