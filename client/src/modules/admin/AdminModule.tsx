import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditIcon, Plus, Eye, Grip, Check, ChevronsUpDown } from "lucide-react";
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
import { Form, RankGroup, AvailableRank } from "@shared/schema";
import { FormEditorFactory } from "@/components/FormEditorFactory";
import { formTemplates, createFormEditor } from "@/utils/formEditorGenerator";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SideBarComponent from '../../components/Navbar/SideBarComponent';
import MainLayout from "@/components/main/MainLayout";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { AgGridTable } from "@/components/AgGrid/AgGridTable";
import { ColDef, GridApi, GridReadyEvent, ICellEditorParams, ICellRendererParams } from "ag-grid-community";

const rankGroupSchema = z.object({
  name: z.string().min(1, "Rank group name is required"),
  ranks: z.array(z.string()).min(1, "At least one rank must be selected"),
});

// Interface for Rank Master data
interface RankMasterData {
  id: string;
  rank: string;
  rankId: string;
  applicableToCompany: boolean;
  label: string;
}

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

export const AdminModule = (): JSX.Element => {
  const [location] = useLocation();
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
  
  // Rank Master state
  const [rankMasterData, setRankMasterData] = useState<RankMasterData[]>([
    { id: "1", rank: "Master", rankId: "S1", applicableToCompany: true, label: "Master" },
    { id: "2", rank: "Chief Officer", rankId: "S2", applicableToCompany: true, label: "Chief Off" },
    { id: "3", rank: "Second Officer", rankId: "S3", applicableToCompany: true, label: "2nd Off" },
    { id: "4", rank: "Third Officer", rankId: "S4", applicableToCompany: true, label: "3rd Off" },
    { id: "5", rank: "Fourth Officer", rankId: "S5", applicableToCompany: false, label: "" },
    { id: "6", rank: "Deck Cadet", rankId: "S6", applicableToCompany: true, label: "Deck Cadet" },
    { id: "7", rank: "Chief Engineer", rankId: "S7", applicableToCompany: true, label: "Ch Eng" },
  ]);
  const [isRankMasterEditing, setIsRankMasterEditing] = useState(false);
  const [rankMasterGridApi, setRankMasterGridApi] = useState<GridApi | null>(null);
  
  // Company state
  const [companyRankData, setCompanyRankData] = useState<CompanyRankData[]>([]);
  const [isCompanyEditing, setIsCompanyEditing] = useState(false);
  const [companyGridApi, setCompanyGridApi] = useState<GridApi | null>(null);
  
  // Vessel state
  const [vesselRankDataMap, setVesselRankDataMap] = useState<Map<string, VesselRankData[]>>(new Map());
  const [isVesselEditing, setIsVesselEditing] = useState(false);
  const [vesselGridApi, setVesselGridApi] = useState<GridApi | null>(null);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRevision, setSelectedRevision] = useState("R1");
  const [flexDate, setFlexDate] = useState("");
  const [revisionMode, setRevisionMode] = useState(false);
  
  // Data Masters state
  const [isMasterEditing, setIsMasterEditing] = useState(false);
  const [searchDataMaster, setSearchDataMaster] = useState("");
  
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
  
  // Sample vessel data
  const vesselOptions = [
    { value: "vessel1", label: "MV Ocean Star" },
    { value: "vessel2", label: "MV Sea Eagle" },
    { value: "vessel3", label: "MV Blue Horizon" },
    { value: "group1", label: "Tanker Fleet" },
    { value: "group2", label: "Container Fleet" },
  ];
  
  const queryClient = useQueryClient();

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
      
      vesselOptions.forEach(vessel => {
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
  const handleRankMasterGridReady = (event: GridReadyEvent) => {
    setRankMasterGridApi(event.api);
  };

  const handleNewRank = () => {
    const newRank: RankMasterData = {
      id: Date.now().toString(),
      rank: "",
      rankId: "",
      applicableToCompany: false,
      label: ""
    };
    setRankMasterData(prev => {
      const newData = [...prev, newRank];
      // Start editing the first cell of the new row after the state updates
      setTimeout(() => {
        if (rankMasterGridApi) {
          const rowIndex = newData.length - 1;
          rankMasterGridApi.startEditingCell({
            rowIndex: rowIndex,
            colKey: 'rank'
          });
        }
      }, 100);
      return newData;
    });
    setIsRankMasterEditing(true);
  };

  const handleEditRank = () => {
    setIsRankMasterEditing(true);
  };

  const handleSaveRank = () => {
    setIsRankMasterEditing(false);
    rankMasterGridApi?.stopEditing();
  };

  // Data Masters handlers
  const handleEditMaster = () => {
    setIsMasterEditing(true);
  };

  const handleSaveMaster = () => {
    setIsMasterEditing(false);
  };

  const handleNewEntry = () => {
    console.log('New Entry clicked');
    // Placeholder for adding new master entry
  };

  // Company handlers
  const handleCompanyGridReady = (event: GridReadyEvent) => {
    setCompanyGridApi(event.api);
  };


  const handleEditCompany = () => {
    setIsCompanyEditing(true);
  };

  const handleSaveCompany = () => {
    setIsCompanyEditing(false);
    companyGridApi?.stopEditing();
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
  const handleVesselGridReady = (event: GridReadyEvent) => {
    setVesselGridApi(event.api);
  };

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

  // Helper function to create checkbox column for vessel
  const createVesselCheckboxColumn = (headerName: string, field: keyof VesselRankData): ColDef => ({
    headerName,
    field,
    flex: 1,
    minWidth: 100,
    cellRenderer: (params: ICellRendererParams) => {
      const isChecked = params.value || false;
      const shouldShowCheckbox = revisionMode || isChecked;
      
      if (!shouldShowCheckbox) {
        return <div className="flex items-center justify-center h-full"></div>;
      }
      
      return (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={!revisionMode}
            onChange={(e) => {
              if (revisionMode) {
                updateVesselRankData(prevData => {
                  const newData = [...prevData];
                  const rowIndex = newData.findIndex(row => row.id === params.data.id);
                  if (rowIndex !== -1) {
                    newData[rowIndex] = { ...newData[rowIndex], [field]: e.target.checked };
                  }
                  return newData;
                });
              }
            }}
            className="form-checkbox h-4 w-4 text-blue-600"
          />
        </div>
      );
    },
    cellStyle: { textAlign: 'center' },
    sortable: false,
    filter: false,
    resizable: true,
    headerClass: 'ag-header-cell-text-wrap-limited',
    autoHeaderHeight: true,
    suppressHeaderMenuButton: true
  });

  // Helper function to create checkbox column
  const createCheckboxColumn = (headerName: string, field: keyof CompanyRankData): ColDef => ({
    headerName,
    field,
    flex: 1,
    minWidth: 80,
    maxWidth: 120,
    cellRenderer: (params: ICellRendererParams) => {
      // In non-edit mode: only show checked checkboxes, hide unchecked ones
      // In edit mode: show all checkboxes (checked and unchecked)
      const isChecked = params.value || false;
      const shouldShowCheckbox = isCompanyEditing || isChecked;
      
      if (!shouldShowCheckbox) {
        return <div className="flex items-center justify-center h-full"></div>;
      }
      
      return (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={!isCompanyEditing}
            onChange={(e) => {
              if (isCompanyEditing) {
                const newData = [...companyRankData];
                const rowIndex = newData.findIndex(row => row.id === params.data.id);
                if (rowIndex !== -1) {
                  newData[rowIndex] = { ...newData[rowIndex], [field]: e.target.checked };
                  setCompanyRankData(newData);
                }
              }
            }}
            className="form-checkbox h-4 w-4 text-blue-600"
          />
        </div>
      );
    },
    cellStyle: { textAlign: 'center' },
    sortable: false,
    filter: false,
    resizable: true,
    headerClass: 'ag-header-cell-text-wrap-limited',
    autoHeaderHeight: true,
    suppressHeaderMenuButton: true
  });

  // Single source of truth for checkbox columns with tier hierarchy
  const checkboxDescriptors = [
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

  // Build responsive Company columns with exact count enforcement
  const buildCompanyCols = (breakpoint: string, hasRoles: boolean, isEditing: boolean): ColDef[] => {
    const allowedCounts = { mobile: 5, tablet: 7, laptop: 12, desktop: 15 };
    const targetCount = allowedCounts[breakpoint as keyof typeof allowedCounts] || 15;
    
    const baseColumns: ColDef[] = [
      // Drag handle (always visible)
      {
        headerName: "",
        width: breakpoint === 'mobile' ? 30 : 40,
        cellClass: 'text-center cursor-move',
        rowDrag: isEditing,
        sortable: false,
        filter: false,
        pinned: 'left',
        menuTabs: [],
      },
      // Rank column (always visible)
      {
        headerName: "Rank",
        field: "rank",
        width: breakpoint === 'mobile' ? 100 : 120,
        editable: false,
        singleClickEdit: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        headerClass: 'ag-header-cell-text-wrap',
        autoHeaderHeight: true
      }
    ];

    let visibleBaseCount = 2; // drag + rank

    // Add Role column if needed (not on mobile)
    if (hasRoles && breakpoint !== 'mobile') {
      baseColumns.push({
        headerName: "Role",
        field: "role",
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        headerClass: 'ag-header-cell-text-wrap',
        autoHeaderHeight: true,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data.isRoleRow && params.data.originalRankId) {
            const roleCount = companyRankData.filter(row => row.originalRankId === params.data.originalRankId).length;
            if (roleCount >= 2) {
              return params.data.role || '';
            }
          }
          return '';
        }
      });
      visibleBaseCount += 1;
    }

    // Add hidden Rank ID column (doesn't count toward limit)
    baseColumns.push({
      headerName: "Rank ID (Sail)",
      field: "rankId",
      width: 100,
      editable: false,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      headerClass: 'ag-header-cell-text-wrap',
      autoHeaderHeight: true,
      hide: true
    });

    // Calculate available slots for checkbox columns (reserve 1 for actions)
    const availableSlots = targetCount - visibleBaseCount - 1;
    
    // Select checkbox columns by tier order until slots are filled
    let selectedCheckboxes: typeof checkboxDescriptors = [];
    let remainingSlots = availableSlots;
    
    // Add essential columns first
    const essentialCols = checkboxDescriptors.filter(col => col.tier === "essential");
    selectedCheckboxes = [...selectedCheckboxes, ...essentialCols.slice(0, remainingSlots)];
    remainingSlots -= essentialCols.length;
    
    // Add standard columns if slots remain
    if (remainingSlots > 0) {
      const standardCols = checkboxDescriptors.filter(col => col.tier === "standard");
      selectedCheckboxes = [...selectedCheckboxes, ...standardCols.slice(0, remainingSlots)];
      remainingSlots -= standardCols.length;
    }
    
    // Add optional columns if slots remain
    if (remainingSlots > 0) {
      const optionalCols = checkboxDescriptors.filter(col => col.tier === "optional");
      selectedCheckboxes = [...selectedCheckboxes, ...optionalCols.slice(0, remainingSlots)];
    }

    // Create checkbox columns with responsive labels
    selectedCheckboxes.forEach(descriptor => {
      const headerName = descriptor.labelByBp[breakpoint as keyof typeof descriptor.labelByBp] || descriptor.labelByBp.desktop;
      baseColumns.push(createCheckboxColumn(headerName, descriptor.field));
    });

    // Add actions column with mobile optimization
    baseColumns.push({
      headerName: "",
      width: breakpoint === 'mobile' ? 50 : 80,
      cellRenderer: (params: ICellRendererParams) => {
        const isFirstRole = params.data.isRoleRow && params.data.role?.endsWith('_1');
        const isOtherRole = params.data.isRoleRow && !params.data.role?.endsWith('_1');
        
        return (
          <div className="flex items-center justify-center h-full gap-1">
            {(!params.data.isRoleRow || isFirstRole) && isEditing && (
              <button
                onClick={() => handleMultiple(params.data.originalRankId || params.data.id)}
                className={`${breakpoint === 'mobile' ? 'h-6 px-1 text-xs' : 'h-8 px-4 text-xs'} bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded font-medium ${breakpoint === 'mobile' ? 'min-w-[30px]' : 'min-w-[60px]'} shadow-sm`}
              >
                {breakpoint === 'mobile' ? '⊕' : '+Multi'}
              </button>
            )}
            {isOtherRole && isEditing && (
              <Button
                onClick={() => handleDeleteCompanyRank(params.data.id)}
                className={`${breakpoint === 'mobile' ? 'h-4 w-4' : 'h-6 w-6'} p-0 bg-red-100 hover:bg-red-200 text-red-600`}
                variant="outline"
              >
                🗑
              </Button>
            )}
          </div>
        );
      },
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    });

    return baseColumns;
  };

  const companyColumnDefs = useMemo(() => buildCompanyCols(currentBreakpoint, hasRoles, isCompanyEditing), [currentBreakpoint, hasRoles, isCompanyEditing]);

  // Responsive column definitions for Rank Master
  const getRankMasterColumnDefs = (): ColDef[] => {
    const baseColumns: ColDef[] = [
      {
        headerName: "",
        width: currentBreakpoint === 'mobile' ? 30 : 40,
        cellClass: 'text-center cursor-move',
        rowDrag: isRankMasterEditing,
        sortable: false,
        filter: false,
        pinned: 'left',
        menuTabs: [],
      },
      {
        headerName: "Rank",
        field: "rank",
        flex: currentBreakpoint === 'mobile' ? 2 : 1,
        minWidth: 120,
        editable: isRankMasterEditing,
        singleClickEdit: true,
      },
      {
        headerName: currentBreakpoint === 'mobile' ? "ID" : "Rank ID (Sail)",
        field: "rankId", 
        flex: currentBreakpoint === 'mobile' ? 1 : 1,
        minWidth: currentBreakpoint === 'mobile' ? 80 : 120,
        editable: isRankMasterEditing,
        singleClickEdit: true,
      },
      {
        headerName: currentBreakpoint === 'mobile' ? "Company" : "Applicable to Company",
        field: "applicableToCompany",
        flex: currentBreakpoint === 'mobile' ? 1 : 1,
        minWidth: currentBreakpoint === 'mobile' ? 80 : 120,
        cellRenderer: (params: ICellRendererParams) => {
          // In non-edit mode: only show checked checkboxes, hide unchecked ones
          // In edit mode: show all checkboxes (checked and unchecked)
          const isChecked = params.value || false;
          const shouldShowCheckbox = isRankMasterEditing || isChecked;
          
          if (!shouldShowCheckbox) {
            return <div className="flex items-center justify-center h-full"></div>;
          }
          
          return (
            <div className="flex items-center justify-center h-full">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={!isRankMasterEditing}
                onChange={(e) => {
                  if (isRankMasterEditing) {
                    const newData = [...rankMasterData];
                    const rowIndex = newData.findIndex(row => row.id === params.data.id);
                    if (rowIndex !== -1) {
                      newData[rowIndex].applicableToCompany = e.target.checked;
                      setRankMasterData(newData);
                    }
                  }
                }}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
            </div>
          );
        }
      }
    ];

    // Add Label column only for larger screens, hide on mobile to save space
    if (currentBreakpoint !== 'mobile') {
      baseColumns.push({
        headerName: "Label",
        field: "label",
        flex: 1,
        minWidth: 120,
        editable: isRankMasterEditing,
        singleClickEdit: true,
      });
    }

    return baseColumns;
  };

  const rankMasterColumnDefs = getRankMasterColumnDefs();

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

  // Build responsive Vessel columns with count enforcement
  const buildVesselCols = (breakpoint: string, hasRoles: boolean, isRevision: boolean): ColDef[] => {
    const allowedCounts = { mobile: 6, tablet: 8, laptop: 10, desktop: 12 };
    const targetCount = allowedCounts[breakpoint as keyof typeof allowedCounts] || 12;
    
    const baseColumns: ColDef[] = [
      // Drag handle (always visible)
      {
        headerName: "",
        width: breakpoint === 'mobile' ? 30 : 40,
        cellClass: 'text-center cursor-move',
        rowDrag: isRevision,
        sortable: false,
        filter: false,
        pinned: 'left',
        menuTabs: [],
      },
      // Rank column (always visible) 
      {
        headerName: "Rank",
        field: "rank",
        width: breakpoint === 'mobile' ? 100 : 120,
        editable: false,
        singleClickEdit: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        headerClass: 'ag-header-cell-text-wrap',
        autoHeaderHeight: true
      }
    ];

    let visibleBaseCount = 2; // drag + rank

    // Add Role column if needed (not on mobile)
    if (hasRoles && breakpoint !== 'mobile') {
      baseColumns.push({
        headerName: "Role",
        field: "role",
        width: 100,
        editable: false,
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        headerClass: 'ag-header-cell-text-wrap',
        autoHeaderHeight: true,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data.isRoleRow && params.data.originalRankId) {
            const roleCount = vesselRankData.filter(row => row.originalRankId === params.data.originalRankId).length;
            if (roleCount >= 2) {
              return params.data.role || '';
            }
          }
          return '';
        }
      });
      visibleBaseCount += 1;
    }

    // Calculate available slots for checkbox columns
    const availableSlots = targetCount - visibleBaseCount;
    
    // Select checkbox columns by tier order until slots are filled
    let selectedCheckboxes: typeof vesselCheckboxDescriptors = [];
    let remainingSlots = availableSlots;
    
    // Add essential columns first
    const essentialCols = vesselCheckboxDescriptors.filter(col => col.tier === "essential");
    selectedCheckboxes = [...selectedCheckboxes, ...essentialCols.slice(0, remainingSlots)];
    remainingSlots -= essentialCols.length;
    
    // Add standard columns if slots remain
    if (remainingSlots > 0) {
      const standardCols = vesselCheckboxDescriptors.filter(col => col.tier === "standard");
      selectedCheckboxes = [...selectedCheckboxes, ...standardCols.slice(0, remainingSlots)];
      remainingSlots -= standardCols.length;
    }
    
    // Add optional columns if slots remain
    if (remainingSlots > 0) {
      const optionalCols = vesselCheckboxDescriptors.filter(col => col.tier === "optional");
      selectedCheckboxes = [...selectedCheckboxes, ...optionalCols.slice(0, remainingSlots)];
    }

    // Create checkbox columns with responsive labels
    selectedCheckboxes.forEach(descriptor => {
      const headerName = descriptor.labelByBp[breakpoint as keyof typeof descriptor.labelByBp] || descriptor.labelByBp.desktop;
      const column = createVesselCheckboxColumn(headerName, descriptor.field as keyof VesselRankData);
      
      // Add special styling for Actual Manning column
      if (descriptor.hasSpecialStyle) {
        column.cellStyle = { textAlign: 'center', borderRight: '2px solid #16569e' };
      }
      
      baseColumns.push(column);
    });

    return baseColumns;
  };

  const vesselColumnDefs = useMemo(() => buildVesselCols(currentBreakpoint, vesselHasRoles, revisionMode), [currentBreakpoint, vesselHasRoles, revisionMode]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setIsAddRankGroupOpen(false);
      setSelectedFormForRankGroup(null);
    },
  });

  const createFormMutation = useMutation({
    mutationFn: async (data: { name: string; versionNo: string; versionDate: string }) => {
      return await apiRequest("POST", "/api/forms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setShowCreateFormDialog(false);
      setNewFormName("");
      setSelectedTemplate("");
    },
  });

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

  // Group forms by name for hierarchical display
  const groupedForms = formsData.reduce((acc, form) => {
    if (!acc[form.name]) {
      acc[form.name] = [];
    }
    acc[form.name].push(form);
    return acc;
  }, {} as Record<string, typeof formsData>);

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
                  onClick={() => setSelectedRankAdminTab(tab.id)}
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
                    onClick={() => setSelectedRankAdminTab(tab.id)}
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
              <div className={`${currentBreakpoint === 'mobile' ? 'h-[400px]' : currentBreakpoint === 'tablet' ? 'h-[500px]' : 'h-[600px]'}`}>
                <AgGridTable
                  rowData={rankMasterData}
                  columnDefs={rankMasterColumnDefs}
                  onGridReady={handleRankMasterGridReady}
                  enableExport={false}
                  enableSideBar={false}
                  enableStatusBar={false}
                  enableRowGrouping={false}
                  enablePivoting={false}
                  rowSelection={false}
                  animateRows={true}
                  theme="alpine"
                  gridOptions={{
                    rowDragManaged: true,
                    animateRows: true,
                    onRowDragEnd: (event) => {
                      const newData = [...rankMasterData];
                      const fromIndex = event.overIndex;
                      const toIndex = event.overIndex;
                      
                      if (fromIndex !== undefined && toIndex !== undefined && fromIndex !== toIndex) {
                        const [movedItem] = newData.splice(fromIndex, 1);
                        newData.splice(toIndex, 0, movedItem);
                        setRankMasterData(newData);
                      }
                    },
                    onCellValueChanged: (event) => {
                      const newData = [...rankMasterData];
                      const rowIndex = newData.findIndex(row => row.id === event.data.id);
                      if (rowIndex !== -1) {
                        newData[rowIndex] = { ...newData[rowIndex], [event.colDef.field!]: event.newValue };
                        setRankMasterData(newData);
                      }
                    }
                  }}
                />
              </div>
            )}
            
            {selectedRankAdminTab === "company" && (
              <div className={`${currentBreakpoint === 'mobile' ? 'h-[400px]' : currentBreakpoint === 'tablet' ? 'h-[500px]' : 'h-[600px]'}`}>
                <AgGridTable
                  rowData={companyRankData}
                  columnDefs={companyColumnDefs}
                  onGridReady={handleCompanyGridReady}
                  autoHeight={true}
                  maxHeight="500px"
                  minHeight="200px"
                  width="100%"
                  enableExport={true}
                  enableSideBar={true}
                  enableStatusBar={false}
                  enableRowGrouping={true}
                  enablePivoting={true}
                  enableAdvancedFilter={false}
                  rowSelection={false}
                  theme="alpine"
                  gridOptions={{
                    rowDragManaged: true,
                    animateRows: true,
                    onRowDragEnd: (event) => {
                      const newData = [...companyRankData];
                      const fromIndex = event.node?.rowIndex;
                      const toIndex = event.overIndex;
                      
                      if (fromIndex !== undefined && fromIndex !== null && toIndex !== undefined && toIndex !== null && fromIndex !== toIndex) {
                        const [movedItem] = newData.splice(fromIndex, 1);
                        newData.splice(toIndex, 0, movedItem);
                        setCompanyRankData(newData);
                      }
                    },
                    onCellValueChanged: (event) => {
                      const newData = [...companyRankData];
                      const rowIndex = newData.findIndex(row => row.id === event.data.id);
                      if (rowIndex !== -1) {
                        newData[rowIndex] = { ...newData[rowIndex], [event.colDef.field!]: event.newValue };
                        setCompanyRankData(newData);
                      }
                    }
                  }}
                />
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
                              ? vesselOptions.find(v => v.value === selectedVessels[0])?.label
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
                            {vesselOptions.map((vessel) => (
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
                              {vesselOptions.find(v => v.value === vesselId)?.label || vesselId}
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
                <div className={`${currentBreakpoint === 'mobile' ? 'h-[400px]' : currentBreakpoint === 'tablet' ? 'h-[450px]' : 'h-[500px]'}`}>
                  <AgGridTable
                    rowData={vesselRankData}
                    columnDefs={vesselColumnDefs}
                    onGridReady={handleVesselGridReady}
                    autoHeight={true}
                    maxHeight="450px"
                    minHeight="200px"
                    width="100%"
                    enableExport={true}
                    enableSideBar={true}
                    enableStatusBar={false}
                    enableRowGrouping={true}
                    enablePivoting={true}
                    enableAdvancedFilter={false}
                    rowSelection={false}
                    theme="alpine"
                    gridOptions={{
                      rowDragManaged: true,
                      animateRows: true,
                      onRowDragEnd: (event) => {
                        const newData = [...vesselRankData];
                        const fromIndex = event.node?.rowIndex;
                        const toIndex = event.overIndex;
                        
                        if (fromIndex !== undefined && fromIndex !== null && toIndex !== undefined && toIndex !== null && fromIndex !== toIndex) {
                          const [movedItem] = newData.splice(fromIndex, 1);
                          newData.splice(toIndex, 0, movedItem);
                          updateVesselRankData(() => newData);
                        }
                      },
                      onCellValueChanged: (event) => {
                        updateVesselRankData(prevData => {
                          const newData = [...prevData];
                          const rowIndex = newData.findIndex(row => row.id === event.data.id);
                          if (rowIndex !== -1) {
                            newData[rowIndex] = { ...newData[rowIndex], [event.colDef.field!]: event.newValue };
                          }
                          return newData;
                        });
                      }
                    }}
                  />
                </div>

              </div>
            )}
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
                {Object.entries(groupedForms).map(([formName, forms]) => (
                  <React.Fragment key={formName}>
                    {/* First level - Form name with rowspan */}
                    <TableRow className="border-b border-gray-200 bg-white hover:bg-gray-50">
                      <TableCell
                        className="text-[#4f5863] text-[13px] font-semibold py-3 border-r border-gray-200 bg-[#ffffff]"
                        rowSpan={forms.length}
                      >
                        <div className="flex items-center justify-between">
                          <span>{formName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={() => handleAddRankGroup(formName)}
                          >
                            <Plus className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                      {/* Second level - First rank group */}
                      <TableCell className="text-[#4f5863] text-[13px] font-normal pl-6">
                        <div className="flex items-center justify-between">
                          <span>{forms[0].rankGroup}</span>
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
                                <p>Ranks: {getRankGroupRanks(forms[0].rankGroup)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#4f5863] text-[13px] font-normal">
                        {forms[0].versionNo}
                      </TableCell>
                      <TableCell className="text-[#4f5863] text-[13px] font-normal">
                        {forms[0].versionDate}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditClick(forms[0])}
                          >
                            <EditIcon className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Remaining rank groups for this form */}
                    {forms.slice(1).map((form) => (
                      <TableRow key={form.id} className="border-b border-gray-200 bg-white hover:bg-gray-50">
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
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
    </>
  );
};