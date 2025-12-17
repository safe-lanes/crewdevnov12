import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import VesselSideBar from './VesselSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Edit, ArrowLeft, Download } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from 'lucide-react';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColDef, GridApi } from 'ag-grid-community';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import { format, addMonths, parseISO } from "date-fns";
import { ComplianceMatrixDialog } from './ComplianceMatrixDialog';
import { AppraisalForm } from '@/modules/crewing/AppraisalForm';
import { CrewInfoForm } from '@/modules/crew-pool/CrewInfoForm';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { findHighestActiveCoc, inferDepartmentFromRank, LicenseRecord } from '@/utils/data/licenseDceTemplates';
import { useRankNormalization, addRankAliasesToMap } from '@/hooks/useRankNormalization';

// Helper function to check if crew member has valid GMDSS certificate
const hasValidGmdss = (licenses: LicenseRecord[]): boolean => {
    if (!licenses || licenses.length === 0) return false;
    
    // Find GMDSS certificate (LIC021)
    const gmdss = licenses.find(license => license.licenseId === 'LIC021');
    if (!gmdss) return false;
    
    // Check if expiry date exists and is valid (not expired)
    if (!gmdss.expiry) return false;
    
    try {
        const expiryDate = new Date(gmdss.expiry);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
        
        // Return true if certificate has not expired yet
        return expiryDate >= today;
    } catch {
        return false;
    }
};

// Hook to fetch vessels from Master Data (ID 014)
const useVessels = () => {
    return useQuery({
        queryKey: ['/api/masters/014/data'],
        select: (data: any[]) => {
            return data
                .filter((vessel: any) => !vessel.isDeleted)
                .map((vessel: any) => ({
                    id: vessel.id,
                    vesselId: vessel.entryId,
                    name: vessel.name || vessel.vessel || 'Unknown Vessel',
                    vesselType: vessel.vesselType || 'Unknown Type',
                }));
        }
    });
};

// Hook to fetch crew members
const useCrewMembers = () => {
    return useQuery({
        queryKey: ['/api/crew-members'],
        select: (data: any[]) => data
    });
};

// Hook to fetch vessel ranks from latest revision
const useVesselRanks = (vesselId: string | null) => {
    return useQuery({
        queryKey: ['/api/vessel-revisions/ranks', vesselId],
        queryFn: vesselId ? () => fetch(`/api/vessel-revisions/ranks/${vesselId}`).then(res => res.json()) : undefined,
        enabled: !!vesselId,
        select: (data: any[]) => data
    });
};

// Hook to fetch vessel planning data
const useVesselPlanning = (vesselId: string | null) => {
    return useQuery({
        queryKey: ['/api/vessel-planning/vessel', vesselId],
        queryFn: vesselId ? () => fetch(`/api/vessel-planning/vessel/${vesselId}`).then(res => res.json()) : undefined,
        enabled: !!vesselId,
        select: (data: any[]) => data
    });
};

// Hook to fetch appraisals
const useAppraisals = () => {
    return useQuery({
        queryKey: ['/api/appraisals'],
        select: (data: any[]) => data
    });
};

// Hook to fetch company trainings (for Training Matrix)
const useCompanyTrainings = () => {
    return useQuery<any[]>({
        queryKey: ['/api/company-trainings'],
        queryFn: async () => {
            const response = await fetch('/api/company-trainings');
            if (!response.ok) throw new Error('Failed to fetch company trainings');
            return response.json();
        },
    });
};

// Hook to fetch company training groups (A-J labels)
const useCompanyTrainingGroups = () => {
    return useQuery<any[]>({
        queryKey: ['/api/company-training-groups'],
        queryFn: async () => {
            const response = await fetch('/api/company-training-groups');
            if (!response.ok) throw new Error('Failed to fetch company training groups');
            return response.json();
        },
    });
};

// Hook to fetch company training requirements (M/R status per rank)
const useCompanyTrainingRequirements = () => {
    return useQuery<any[]>({
        queryKey: ['/api/company-training-requirements'],
        queryFn: async () => {
            const response = await fetch('/api/company-training-requirements');
            if (!response.ok) throw new Error('Failed to fetch company training requirements');
            return response.json();
        },
    });
};

// Hook to fetch training matrix vessel revisions (for App to Vessel data)
const useTrainingMatrixVesselRevisions = (vesselId: string | null) => {
    return useQuery<any[]>({
        queryKey: ['/api/training-matrix-vessel-revisions/by-vessel', vesselId],
        queryFn: async () => {
            if (!vesselId) return [];
            const response = await fetch(`/api/training-matrix-vessel-revisions/by-vessel/${vesselId}`);
            if (!response.ok) throw new Error('Failed to fetch training matrix vessel revisions');
            return response.json();
        },
        enabled: !!vesselId,
    });
};

// Hook to fetch training matrix vessel draft (for App to Vessel data - draft state)
const useTrainingMatrixVesselDraft = (vesselId: string | null) => {
    return useQuery<any[]>({
        queryKey: ['/api/training-matrix-vessel-drafts/by-vessel', vesselId],
        queryFn: async () => {
            if (!vesselId) return [];
            const response = await fetch(`/api/training-matrix-vessel-drafts/by-vessel/${vesselId}`);
            if (!response.ok) throw new Error('Failed to fetch training matrix vessel draft');
            return response.json();
        },
        enabled: !!vesselId,
    });
};

// Hook to fetch available ranks (for rank ID lookup)
const useAvailableRanks = () => {
    return useQuery<any[]>({
        queryKey: ['/api/available-ranks'],
    });
};

// Hook to fetch ports from Port Master (ID 005)
const usePorts = () => {
    return useQuery({
        queryKey: ['/api/masters/005/data'],
        select: (data: any[]) => {
            return data
                .filter((port: any) => !port.isDeleted)
                .map((port: any) => ({
                    id: port.id,
                    name: port.name || port.portName || '',
                    code: port.portcode || port.cid || port.entryId || '',
                }))
                .filter((port: any) => port.name) // Only include ports with names
                .sort((a: any, b: any) => a.name.localeCompare(b.name)); // Sort alphabetically
        }
    });
};

// Helper function to format dates to DD-MMM-YYYY (e.g., 15-Dec-2025)
const formatDateOnly = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return dateString;
    }
};

// Helper to parse date from various formats to Date object
const parseDateString = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    try {
        // Try to parse YYYY-MM-DD format first
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(dateStr);
        }
        // Try to parse dd-MMM-yyyy format (e.g., 15-May-2025)
        const monthNames: { [key: string]: string } = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const parts = dateStr.split('-');
        if (parts.length === 3 && monthNames[parts[1]]) {
            return new Date(`${parts[2]}-${monthNames[parts[1]]}-${parts[0]}`);
        }
        // Fallback: try direct parsing
        return new Date(dateStr);
    } catch {
        return undefined;
    }
};

// Consistent message for when vessel has no rank configuration
const NO_RANKS_CONFIGURED_MESSAGE = "No positions configured for this vessel. Please configure positions in Admin > Rank Admin > Vessel.";

// Form schema for Relief Status - using sign-on terminology
const reliefStatusFormSchema = z.object({
    relieverCrewName: z.string().optional(),
    relieverNationality: z.string().optional(),
    signOnStatus: z.string().optional(),
    contractPeriodMonths: z.coerce.number().optional(),
    contractEndRangeStartMonths: z.coerce.number().optional(),
    contractEndRangeEndMonths: z.coerce.number().optional(),
    relieverSignOnDate: z.string().optional(),
    relieverSignOnPort: z.string().optional(),
    deploymentChecklistCompleted: z.boolean().optional(),
    applicableDocsChecked: z.boolean().optional(),
});

type ReliefStatusFormData = z.infer<typeof reliefStatusFormSchema>;

interface ReliefStatusEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rank: string;
    vesselId: string;
    rankId: string;
    planningData?: any;
}

const ReliefStatusEditDialog: React.FC<ReliefStatusEditDialogProps> = ({
    open,
    onOpenChange,
    rank,
    vesselId,
    rankId,
    planningData
}) => {
    const { toast } = useToast();
    const { data: ports = [] } = usePorts();
    const [joiningDateOpen, setJoiningDateOpen] = React.useState(false);
    
    const form = useForm<ReliefStatusFormData>({
        resolver: zodResolver(reliefStatusFormSchema),
        defaultValues: {
            relieverCrewName: '',
            relieverNationality: '',
            signOnStatus: '',
            contractPeriodMonths: undefined,
            contractEndRangeStartMonths: undefined,
            contractEndRangeEndMonths: undefined,
            relieverSignOnDate: '',
            relieverSignOnPort: '',
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
        }
    });

    // Reset form when dialog opens or planningData changes
    React.useEffect(() => {
        if (open && planningData) {
            form.reset({
                relieverCrewName: planningData.relieverCrewName || '',
                relieverNationality: planningData.relieverNationality || '',
                signOnStatus: planningData.joiningStatus || '', // Map legacy joiningStatus to signOnStatus
                contractPeriodMonths: planningData.contractPeriodMonths,
                contractEndRangeStartMonths: planningData.contractEndRangeStartMonths,
                contractEndRangeEndMonths: planningData.contractEndRangeEndMonths,
                relieverSignOnDate: planningData.relieverSignOnDate || planningData.joiningDate || '', // Prefer new field, fallback to legacy
                relieverSignOnPort: planningData.relieverSignOnPort || planningData.joiningPort || '', // Prefer new field, fallback to legacy
                deploymentChecklistCompleted: planningData.deploymentChecklistCompleted || false,
                applicableDocsChecked: planningData.applicableDocsChecked || false,
            });
        } else if (open && !planningData) {
            // Reset to empty form for new entry
            form.reset({
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: '',
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                relieverSignOnDate: '',
                relieverSignOnPort: '',
                deploymentChecklistCompleted: false,
                applicableDocsChecked: false,
            });
        }
    }, [open, planningData, form]);

    const updatePlanningMutation = useMutation({
        mutationFn: async (data: ReliefStatusFormData) => {
            // Check if reliever is signing on (signOnStatus = "Signed On")
            const isSigningOn = data.signOnStatus === "Signed On";
            
            if (isSigningOn && planningData?.relieverCrewId) {
                // Special handling for "Signed On" - check if position is vacant
                
                // Fetch all planning records for this vessel to check for existing crew
                const existingRecordsResponse = await fetch(`/api/vessel-planning/vessel/${vesselId}`).then(r => r.json());
                
                // Check if PRIMARY crew exists for this rank
                const existingPrimary = existingRecordsResponse.find((p: any) => 
                    (p.rankId === rankId || p.rank === rank) && 
                    (p.crewStatus === 'primary' || !p.crewStatus) && // Treat NULL as primary for backward compatibility
                    p.crewMemberId // Has an actual crew member assigned
                );
                
                // Check if SECONDARY already exists (prevent duplicates)
                const existingSecondary = existingRecordsResponse.find((p: any) => 
                    (p.rankId === rankId || p.rank === rank) && p.crewStatus === 'secondary'
                );
                
                // VACANT POSITION LOGIC: If no primary crew exists, promote reliever to primary directly
                // NOTE: We allow this even if a secondary exists (reliever becomes new primary, secondary remains)
                if (!existingPrimary) {
                    // Update existing planning record to convert reliever to primary crew
                    // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                    const { createdAt: _c1, updatedAt: _u1, ...cleanDataForPromote } = planningData || {};
                    // Calculate the sign-on date for the new primary
                    const newPrimarySignOnDate = data.relieverSignOnDate || planningData.relieverSignOnDate || planningData.joiningDate;
                    const newPrimarySignOnPort = data.relieverSignOnPort || planningData.relieverSignOnPort || planningData.joiningPort;
                    const promoteToPrimaryPayload = {
                        ...cleanDataForPromote,
                        crewMemberId: planningData.relieverCrewId,
                        crewStatus: "primary",
                        signOnDate: newPrimarySignOnDate,
                        // CRITICAL: Keep joiningDate in sync with signOnDate for timeline calculations
                        joiningDate: newPrimarySignOnDate,
                        joiningPort: newPrimarySignOnPort,
                        contractPeriodMonths: data.contractPeriodMonths || planningData.contractPeriodMonths,
                        contractEndRangeStartMonths: data.contractEndRangeStartMonths || planningData.contractEndRangeStartMonths,
                        contractEndRangeEndMonths: data.contractEndRangeEndMonths || planningData.contractEndRangeEndMonths,
                        // Clear reliever fields
                        relieverCrewId: null,
                        relieverCrewName: null,
                        relieverNationality: null,
                        joiningStatus: null,
                        deploymentChecklistCompleted: false,
                        applicableDocsChecked: false,
                    };
                    
                    return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, promoteToPrimaryPayload);
                }
                
                // HANDOVER WORKFLOW: Primary crew exists, create secondary record
                // Validation: Prevent duplicate secondary crew
                if (existingSecondary) {
                    throw new Error(`A secondary crew member is already assigned to ${rank}. Only one secondary crew is allowed per rank.`);
                }
                
                // Step 1: Create NEW planning record for secondary crew
                // Calculate the sign-on date for the secondary crew
                const secondarySignOnDate = data.relieverSignOnDate || planningData.relieverSignOnDate || planningData.joiningDate;
                const secondarySignOnPort = data.relieverSignOnPort || planningData.relieverSignOnPort || planningData.joiningPort;
                
                // CRITICAL FIX: Use the PRIMARY crew's rankId to ensure Take Over lookup works
                // The rankId prop might be a company rank ID (e.g., "S3") while the primary
                // uses a vessel planning rank ID (e.g., "4"). Mismatched rankIds break Take Over.
                const canonicalRankId = existingPrimary.rankId || rankId;
                
                const secondaryCrewPayload = {
                    vesselId,
                    rankId: canonicalRankId,
                    rank,
                    crewMemberId: planningData.relieverCrewId,
                    crewStatus: "secondary",
                    signOnDate: secondarySignOnDate,
                    // CRITICAL: Keep joiningDate in sync with signOnDate for timeline calculations
                    joiningDate: secondarySignOnDate,
                    joiningPort: secondarySignOnPort,
                    contractPeriodMonths: data.contractPeriodMonths || planningData.contractPeriodMonths,
                    contractEndRangeStartMonths: data.contractEndRangeStartMonths || planningData.contractEndRangeStartMonths,
                    contractEndRangeEndMonths: data.contractEndRangeEndMonths || planningData.contractEndRangeEndMonths,
                };
                
                await apiRequest('POST', '/api/vessel-planning', secondaryCrewPayload);
                
                // Step 2: Update existing planning record to clear reliever fields
                // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                const { createdAt: _c2, updatedAt: _u2, ...cleanDataForClear } = planningData || {};
                const clearRelieverPayload = {
                    ...cleanDataForClear,
                    relieverCrewId: null,
                    relieverCrewName: null,
                    relieverNationality: null,
                    // CRITICAL: Reset joiningDate to match primary's signOnDate (not the reliever's planned date)
                    // This ensures timeline calculations use the primary's actual join date
                    joiningDate: planningData.signOnDate || null,
                    joiningPort: null,
                    joiningStatus: null,
                    deploymentChecklistCompleted: false,
                    applicableDocsChecked: false,
                };
                
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, clearRelieverPayload);
            } else {
                // Normal update flow - saving RELIEVER PLANNING data onto the PRIMARY crew record
                // Dual-write strategy: Send BOTH new and legacy field names for complete transition coverage
                
                const payload = {
                    vesselId,
                    rankId,
                    rank,
                    // Reliever identification (read-only, preserve from planning data)
                    crewId: planningData?.crewId,
                    relieverCrewName: data.relieverCrewName,
                    relieverNationality: data.relieverNationality,
                    // Contract fields
                    contractPeriodMonths: data.contractPeriodMonths,
                    contractEndRangeStartMonths: data.contractEndRangeStartMonths,
                    contractEndRangeEndMonths: data.contractEndRangeEndMonths,
                    deploymentChecklistCompleted: data.deploymentChecklistCompleted,
                    applicableDocsChecked: data.applicableDocsChecked,
                    // DUAL-WRITE: New field names (for schema migration)
                    signOnStatus: data.signOnStatus,
                    relieverSignOnDate: data.relieverSignOnDate,
                    relieverSignOnPort: data.relieverSignOnPort,
                    // DUAL-WRITE: Legacy field names (for backend compatibility)
                    joiningStatus: data.signOnStatus,
                    joiningDate: data.relieverSignOnDate,
                    joiningPort: data.relieverSignOnPort,
                };
                
                if (planningData?.id) {
                    return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, payload);
                } else {
                    return apiRequest('POST', '/api/vessel-planning', payload);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
            toast({
                title: "Success",
                description: "Relief status saved successfully",
            });
            onOpenChange(false);
        },
        onError: (error: any) => {
            console.error('Relief status save error:', error);
            const errorMessage = error instanceof Error ? error.message : 
                                 typeof error === 'string' ? error :
                                 error?.message || "Failed to save relief status";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
                duration: 5000,
            });
        }
    });

    // Helper to normalize date to ISO format (YYYY-MM-DD)
    const normalizeToIsoDate = (dateStr: string | undefined): string | undefined => {
        if (!dateStr) return undefined;
        // Already in ISO format
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
        // Convert from DD-MMM-YYYY or other formats
        const parsed = parseDateString(dateStr);
        if (parsed && !isNaN(parsed.getTime())) {
            return format(parsed, 'yyyy-MM-dd');
        }
        return dateStr; // Return as-is if parsing fails
    };

    const handleSave = () => {
        const data = form.getValues();
        
        // Normalize relieverSignOnDate to ISO format before submitting
        if (data.relieverSignOnDate) {
            data.relieverSignOnDate = normalizeToIsoDate(data.relieverSignOnDate);
        }
        
        // Validate: If no reliever crew name is assigned, clear all reliever fields before saving
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            // If user tried to save other fields without a crew member, show warning
            const hasOtherData = data.signOnStatus || data.relieverSignOnPort || data.relieverSignOnDate || 
                               data.contractPeriodMonths || data.contractEndRangeStartMonths || 
                               data.contractEndRangeEndMonths;
            if (hasOtherData) {
                toast({
                    title: "Name Required",
                    description: "Please assign a crew member first before entering other reliever details.",
                    variant: "destructive",
                });
                return;
            }
            
            // Clear all reliever-related fields since no crew is assigned
            const clearedData: ReliefStatusFormData = {
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: undefined,
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                relieverSignOnDate: undefined,
                relieverSignOnPort: undefined,
                deploymentChecklistCompleted: undefined,
                applicableDocsChecked: undefined,
            };
            
            updatePlanningMutation.mutate(clearedData);
        } else {
            updatePlanningMutation.mutate(data);
        }
    };

    const handleSubmit = form.handleSubmit((data) => {
        // Normalize relieverSignOnDate to ISO format before submitting
        if (data.relieverSignOnDate) {
            data.relieverSignOnDate = normalizeToIsoDate(data.relieverSignOnDate);
        }
        
        // Same validation as handleSave - prevent saving reliever fields without crew member
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            const hasOtherData = data.signOnStatus || data.relieverSignOnPort || data.relieverSignOnDate || 
                               data.contractPeriodMonths || data.contractEndRangeStartMonths || 
                               data.contractEndRangeEndMonths;
            if (hasOtherData) {
                toast({
                    title: "Name Required",
                    description: "Please assign a crew member first before entering other reliever details.",
                    variant: "destructive",
                });
                return;
            }
            
            // Clear all reliever-related fields since no crew is assigned
            const clearedData: ReliefStatusFormData = {
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: undefined,
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                relieverSignOnDate: undefined,
                relieverSignOnPort: undefined,
                deploymentChecklistCompleted: undefined,
                applicableDocsChecked: undefined,
            };
            
            updatePlanningMutation.mutate(clearedData);
        } else {
            updatePlanningMutation.mutate(data);
        }
    });

    // Track if a reliever crew member is assigned - disable fields if not
    const relieverName = form.watch('relieverCrewName');
    const isRelieverAssigned = relieverName && relieverName.trim() !== '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-medium text-[#16569e] border-b border-[#16569e] pb-2">
                        Rank: {rank}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        {/* Name - Read Only */}
                        <FormField
                            control={form.control}
                            name="relieverCrewName"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Name:</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly className="col-span-2 bg-gray-50" data-testid="input-reliever-name" />
                                        </FormControl>
                                    </div>
                                    {!isRelieverAssigned && (
                                        <p className="text-xs text-amber-600 mt-1 col-span-3">Assign a crew member in the Rotation module first to enable reliever fields.</p>
                                    )}
                                </FormItem>
                            )}
                        />

                        {/* Nationality - Read Only */}
                        <FormField
                            control={form.control}
                            name="relieverNationality"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Nationality:</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly className="col-span-2 bg-gray-50" data-testid="input-reliever-nationality" />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Sign On Status */}
                        <FormField
                            control={form.control}
                            name="signOnStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign On Status:</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value} 
                                                data-testid="select-joining-status"
                                                disabled={!isRelieverAssigned}
                                            >
                                                <SelectTrigger className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                                                    <SelectValue placeholder="Select Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Proposed">Proposed</SelectItem>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                                                    <SelectItem value="In Transit">In Transit</SelectItem>
                                                    <SelectItem value="Signed On">Signed On</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Contract Period */}
                        <FormField
                            control={form.control}
                            name="contractPeriodMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract Period (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-contract-period"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Contract End - Range Start */}
                        <FormField
                            control={form.control}
                            name="contractEndRangeStartMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract End - Range Start (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-contract-range-start"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Contract End - Range End */}
                        <FormField
                            control={form.control}
                            name="contractEndRangeEndMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract End - Range End (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-contract-range-end"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Sign On Date */}
                        <FormField
                            control={form.control}
                            name="relieverSignOnDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign On Date:</FormLabel>
                                        <Popover open={joiningDateOpen} onOpenChange={setJoiningDateOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={`col-span-2 justify-start text-left font-normal ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''} ${!field.value && 'text-muted-foreground'}`}
                                                        data-testid="button-joining-date"
                                                        disabled={!isRelieverAssigned}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? formatDateOnly(field.value as string) : <span className="text-gray-400">Select date</span>}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? parseDateString(field.value as string) : undefined}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            field.onChange(format(date, 'yyyy-MM-dd'));
                                                            setJoiningDateOpen(false);
                                                        }
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Sign On Port */}
                        <FormField
                            control={form.control}
                            name="relieverSignOnPort"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign On Port:</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value as string} 
                                                data-testid="select-joining-port"
                                                disabled={!isRelieverAssigned}
                                            >
                                                <SelectTrigger className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                                                    <SelectValue placeholder="Select Port" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ports.length > 0 ? (
                                                        ports.map((port: any) => (
                                                            <SelectItem key={port.id || port.name} value={port.name}>
                                                                {port.name}
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <SelectItem value="Singapore">Singapore</SelectItem>
                                                            <SelectItem value="Rotterdam">Rotterdam</SelectItem>
                                                            <SelectItem value="Dubai">Dubai</SelectItem>
                                                            <SelectItem value="Hong Kong">Hong Kong</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Deployment Checklist Completed */}
                        <FormField
                            control={form.control}
                            name="deploymentChecklistCompleted"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Deployment Checklist Completed ?</FormLabel>
                                        <FormControl>
                                            <RadioGroup 
                                                onValueChange={(value) => field.onChange(value === 'true')} 
                                                value={field.value ? 'true' : 'false'}
                                                className={`col-span-2 ${!isRelieverAssigned ? 'opacity-50' : ''}`}
                                                data-testid="radio-deployment-checklist"
                                                disabled={!isRelieverAssigned}
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="true" id="deployment-yes" disabled={!isRelieverAssigned} />
                                                        <Label htmlFor="deployment-yes">Yes</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="false" id="deployment-no" disabled={!isRelieverAssigned} />
                                                        <Label htmlFor="deployment-no">No</Label>
                                                    </div>
                                                </div>
                                            </RadioGroup>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Applicable Docs Checked */}
                        <FormField
                            control={form.control}
                            name="applicableDocsChecked"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Applicable Docs checked:</FormLabel>
                                        <FormControl>
                                            <div className="col-span-2 flex items-center gap-4">
                                                <RadioGroup 
                                                    onValueChange={(value) => field.onChange(value === 'true')} 
                                                    value={field.value ? 'true' : 'false'}
                                                    className={`flex items-center space-x-4 ${!isRelieverAssigned ? 'opacity-50' : ''}`}
                                                    data-testid="radio-applicable-docs"
                                                    disabled={!isRelieverAssigned}
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="true" id="docs-yes" disabled={!isRelieverAssigned} />
                                                        <Label htmlFor="docs-yes">Yes</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="false" id="docs-no" disabled={!isRelieverAssigned} />
                                                        <Label htmlFor="docs-no">No</Label>
                                                    </div>
                                                </RadioGroup>
                                                <Button type="button" variant="outline" size="sm" data-testid="button-see-checklist" disabled={!isRelieverAssigned}>
                                                    See Checklist
                                                </Button>
                                            </div>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                type="submit"
                                className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                disabled={updatePlanningMutation.isPending}
                                data-testid="button-submit-relief"
                            >
                                Submit
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

// Sign-off reason options
const SIGN_OFF_REASONS = [
    "Contract Completed",
    "Terminated",
    "Medical Reasons",
    "Others"
] as const;

// Form schema for On Board Status
const onBoardStatusFormSchema = z.object({
    onBoardCrewName: z.string().optional(),
    onBoardCrewNationality: z.string().optional(),
    signOnDate: z.string().optional(),
    joiningPort: z.string().optional(),
    reliefDue: z.string().optional(),
    signOffDate: z.string().optional(),
    signOffPort: z.string().optional(),
    signOffReason: z.string().optional(),
    reliefStatus: z.string().optional(),
    takeOverDate: z.string().optional(),
    takeOverConfirmation: z.boolean().optional(),
    handOverDate: z.string().optional(),
    contractPeriodMonths: z.coerce.number().optional(),
    contractEndRangeStartMonths: z.coerce.number().optional(),
    contractEndRangeEndMonths: z.coerce.number().optional(),
});

type OnBoardStatusFormData = z.infer<typeof onBoardStatusFormSchema>;

interface OnBoardStatusEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rank: string;
    vesselId: string;
    rankId: string;
    planningData?: any;
}

const OnBoardStatusEditDialog: React.FC<OnBoardStatusEditDialogProps> = ({
    open,
    onOpenChange,
    rank,
    vesselId,
    rankId,
    planningData
}) => {
    const { toast } = useToast();
    const { data: ports = [] } = usePorts();
    const { getVesselName } = useVesselLookup();
    const [signOffDateOpen, setSignOffDateOpen] = useState(false);
    const [takeOverDateOpen, setTakeOverDateOpen] = useState(false);
    
    const form = useForm<OnBoardStatusFormData>({
        resolver: zodResolver(onBoardStatusFormSchema),
        defaultValues: {
            onBoardCrewName: '',
            onBoardCrewNationality: '',
            signOnDate: '',
            joiningPort: '',
            reliefDue: '',
            signOffDate: '',
            signOffPort: '',
            signOffReason: '',
            reliefStatus: '',
            takeOverDate: '',
            takeOverConfirmation: false,
            handOverDate: '',
            contractPeriodMonths: undefined,
            contractEndRangeStartMonths: undefined,
            contractEndRangeEndMonths: undefined,
        }
    });

    // Reset form when dialog opens or planningData changes
    React.useEffect(() => {
        if (open && planningData) {
            form.reset({
                onBoardCrewName: planningData.onBoardCrewName || '',
                onBoardCrewNationality: planningData.onBoardCrewNationality || '',
                signOnDate: planningData.signOnDate || '',
                joiningPort: planningData.joiningPort || '',
                reliefDue: planningData.reliefDue || '',
                signOffDate: planningData.signOffDate || '',
                signOffPort: planningData.signOffPort || '',
                signOffReason: planningData.signOffReason || '',
                reliefStatus: planningData.reliefStatus || '',
                takeOverDate: planningData.takeOverDate || '',
                takeOverConfirmation: planningData.takeOverConfirmation || false,
                handOverDate: planningData.handOverDate || '',
                contractPeriodMonths: planningData.contractPeriodMonths || undefined,
                contractEndRangeStartMonths: planningData.contractEndRangeStartMonths || undefined,
                contractEndRangeEndMonths: planningData.contractEndRangeEndMonths || undefined,
            });
        } else if (open && !planningData) {
            // Reset to empty form for new entry
            form.reset({
                onBoardCrewName: '',
                onBoardCrewNationality: '',
                signOnDate: '',
                joiningPort: '',
                reliefDue: '',
                signOffDate: '',
                signOffPort: '',
                signOffReason: '',
                reliefStatus: '',
                takeOverDate: '',
                takeOverConfirmation: false,
                handOverDate: '',
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
            });
        }
    }, [open, planningData, form]);

    // Watch reliefStatus to conditionally show sign-off reason dropdown
    const watchedReliefStatus = form.watch('reliefStatus');

    // Watch contractPeriodMonths to calculate Relief Due in real-time
    const watchedContractPeriod = form.watch('contractPeriodMonths');
    
    // Calculate Relief Due = Joining Date (signOnDate) + Contract Period
    const calculatedReliefDue = React.useMemo(() => {
        const signOnDate = planningData?.signOnDate || planningData?.joiningDate;
        if (!signOnDate || !watchedContractPeriod) return null;
        
        try {
            // Parse the date (handle various formats)
            let baseDate: Date;
            if (signOnDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                // YYYY-MM-DD format
                baseDate = parseISO(signOnDate);
            } else {
                // Try parsing dd-MMM-yyyy or other formats
                const parsed = new Date(signOnDate);
                if (isNaN(parsed.getTime())) return null;
                baseDate = parsed;
            }
            
            // Add contract period months
            const reliefDate = addMonths(baseDate, watchedContractPeriod);
            return format(reliefDate, 'yyyy-MM-dd');
        } catch {
            return null;
        }
    }, [planningData?.signOnDate, planningData?.joiningDate, watchedContractPeriod]);

    // Denylist of fields that On Board Status popup should NOT update
    // These belong to the Reliever Status section and should not be overwritten
    // when saving On Board Status (prevents stale reliever data from being saved)
    // NOTE: joiningDate/joiningPort are dual-purpose fields used for reliever planning,
    // so they must be excluded to prevent On Board Status from overwriting reliever's planned dates
    const RELIEVER_FIELDS_TO_EXCLUDE = [
        'relieverCrewId', 'relieverCrewName', 'relieverJoiningDate', 
        'relieverJoiningPort', 'relieverStatus', 'relieverNationality',
        'joiningStatus', 'deploymentChecklistCompleted', 'applicableDocsChecked',
        'joiningDate', 'joiningPort', // Dual-purpose fields - exclude to protect reliever planning data
        'contractPeriodMonths', 'contractEndRangeStartMonths', 'contractEndRangeEndMonths', // Reliever contract fields
        'createdAt', 'updatedAt' // Also exclude timestamps to avoid Date object errors
    ];
    
    const filterOutRelieverFields = (data: Record<string, any>): Record<string, any> => {
        return Object.fromEntries(
            Object.entries(data).filter(([key]) => {
                // Exclude any field that starts with 'reliever' (catches all reliever-* fields)
                if (key.startsWith('reliever')) return false;
                // Exclude specific fields from the denylist
                if (RELIEVER_FIELDS_TO_EXCLUDE.includes(key)) return false;
                return true;
            })
        );
    };

    const updatePlanningMutation = useMutation({
        mutationFn: async (data: OnBoardStatusFormData) => {
            // Check if this is a takeover (takeOverConfirmation checked AND takeOverDate set)
            const isTakeover = data.takeOverConfirmation && data.takeOverDate;
            
            // Check if this is a sign-off (Relief Status = "Signed Off" AND Sign Off Date is set)
            const isSignOff = data.reliefStatus === "Signed Off" && data.signOffDate;
            
            // Validate: Sign-off reason is required when signing off
            if (isSignOff && !data.signOffReason) {
                throw new Error("Please select a reason for sign-off");
            }
            
            // Calculate Relief Due = Joining Date + Contract Period (if both are available)
            let computedReliefDue: string | null = null;
            const signOnDate = planningData?.signOnDate || planningData?.joiningDate;
            if (signOnDate && data.contractPeriodMonths) {
                try {
                    let baseDate: Date;
                    if (signOnDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                        baseDate = parseISO(signOnDate);
                    } else {
                        baseDate = new Date(signOnDate);
                    }
                    if (!isNaN(baseDate.getTime())) {
                        const reliefDate = addMonths(baseDate, data.contractPeriodMonths);
                        computedReliefDue = format(reliefDate, 'yyyy-MM-dd');
                    }
                } catch {
                    // Ignore calculation errors
                }
            }
            
            // Add computed reliefDue to the data if calculated
            const dataWithReliefDue = computedReliefDue ? { ...data, reliefDue: computedReliefDue } : data;
            
            // Fetch all planning records for this vessel for validation
            const response = await apiRequest('GET', `/api/vessel-planning/vessel/${vesselId}`);
            const allPlanning = await response.json() as any[];
            
            if (isTakeover && planningData?.crewStatus === "secondary") {
                // TAKEOVER LOGIC: Secondary crew is taking over as Primary
                
                // Find primary crew member for this rank
                // First try exact rankId match, then fall back to (vesselId, rank) match
                // This handles cases where rankId mismatches due to company vs vessel rank IDs
                let primaryCrew = allPlanning.find((p: any) => 
                    p.rankId === rankId && 
                    p.crewStatus === "primary" && 
                    !p.isArchived &&
                    p.id !== planningData?.id
                );
                
                // Fallback: Search by rank name if rankId doesn't find a match
                if (!primaryCrew) {
                    primaryCrew = allPlanning.find((p: any) => 
                        p.vesselId === vesselId && 
                        p.rank === rank && 
                        p.crewStatus === "primary" && 
                        !p.isArchived &&
                        p.id !== planningData?.id
                    );
                    
                    if (primaryCrew) {
                        console.warn(`[Takeover] Primary crew found by rank name fallback (rankId mismatch): expected ${rankId}, found ${primaryCrew.rankId}`);
                    }
                }
                
                // Step 2: If primary exists, demote them to secondary and set handover date
                if (primaryCrew) {
                    await apiRequest('PATCH', `/api/vessel-planning/${primaryCrew.id}`, {
                        crewStatus: "secondary",
                        handOverDate: data.takeOverDate, // Auto-fill handover date
                    });
                } else {
                    console.warn(`[Takeover] No primary crew found to demote for rank: ${rank}`);
                }
                
                // Step 3: Promote current secondary to primary
                // Filter out reliever fields from BOTH planningData AND form data to prevent stale data
                const cleanPlanningDataForTakeover = filterOutRelieverFields(planningData || {});
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                
                // CRITICAL: Sync joiningDate with signOnDate for timeline calculations
                const signOnDateForPromotion = cleanFormData.signOnDate || cleanPlanningDataForTakeover.signOnDate;
                
                const promotePayload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningDataForTakeover,
                    ...cleanFormData,
                    crewStatus: "primary", // Change from secondary to primary
                    // Sync joiningDate to match signOnDate for consistent timeline calculations
                    joiningDate: signOnDateForPromotion || cleanPlanningDataForTakeover.joiningDate,
                };
                
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, promotePayload);
            } else if (isSignOff && planningData?.id) {
                // SIGN-OFF LOGIC: Crew is signing off from the vessel
                
                // Validate: Primary cannot sign off if secondary crew exists
                if (planningData?.crewStatus === "primary") {
                    const secondaryCrew = allPlanning.find((p: any) => 
                        p.rankId === rankId && 
                        p.crewStatus === "secondary" && 
                        p.id !== planningData.id &&
                        !p.isArchived
                    );
                    
                    if (secondaryCrew) {
                        throw new Error("Cannot sign off primary crew when a secondary (reliever) exists. The reliever must take over first.");
                    }
                }
                
                // Filter out reliever fields from BOTH planningData AND form data to prevent stale data
                const cleanPlanningData = filterOutRelieverFields(planningData || {});
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                const archivePayload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningData,
                    ...cleanFormData,
                    isArchived: true,
                    archivedDate: data.signOffDate, // Use sign-off date as archive date
                };
                
                // CREW MEMBER UPDATE: Populate Previous Assignment and clear Current Assignment
                const crewMemberId = planningData?.crewMemberId;
                if (crewMemberId) {
                    // Get the vessel name for lastVessel (Previous Assignment)
                    const vesselName = getVesselName(vesselId) || vesselId;
                    
                    // Use dedicated sign-off endpoint that bypasses vessel assignment field protection
                    const signOffPayload = {
                        lastVessel: vesselName,
                        signOffDate: data.signOffDate,
                        reason: data.signOffReason,
                    };
                    
                    // Call the sign-off endpoint to update crew member record
                    await apiRequest('POST', `/api/crew-members/${crewMemberId}/sign-off`, signOffPayload);
                }
                
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, archivePayload);
            } else {
                // Normal update flow
                // Filter out reliever fields from BOTH planningData AND form data to prevent stale data
                const cleanPlanningData = filterOutRelieverFields(planningData || {});
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                
                // CRITICAL FIX: Do NOT include joiningDate in payload for On Board Status updates
                // joiningDate is a dual-purpose field that stores the RELIEVER's planned joining date
                // when a reliever is assigned. Setting it here would overwrite the reliever's date.
                // The server will preserve the existing joiningDate if it's not in the request.
                const payload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningData,
                    ...cleanFormData,
                    // Removed: ...(signOnDateToSync ? { joiningDate: signOnDateToSync } : {}),
                    // joiningDate is filtered out by filterOutRelieverFields - do not re-add it
                };
                
                if (planningData?.id) {
                    return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, payload);
                } else {
                    return apiRequest('POST', '/api/vessel-planning', payload);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
            // Also invalidate crew members cache to reflect sign-off changes in Crew Pool
            queryClient.invalidateQueries({ queryKey: ['/api/crew-members'] });
            toast({
                title: "Success",
                description: "On board status saved successfully",
            });
            onOpenChange(false);
        },
        onError: (error: any) => {
            console.error('On board status save error:', error);
            const errorMessage = error instanceof Error ? error.message : 
                                 typeof error === 'string' ? error :
                                 error?.message || "Failed to save on board status";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
                duration: 5000,
            });
        }
    });

    const handleSave = () => {
        const data = form.getValues();
        updatePlanningMutation.mutate(data);
    };

    const handleSubmit = form.handleSubmit((data) => {
        updatePlanningMutation.mutate(data);
    });

    // Helper to format date to DD-MMM-YYYY (e.g., 15-Dec-2025)
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = date.getDate().toString().padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Helper to parse date from dd-mm-yyyy or dd-mmm-yyyy to Date object
    const parseDate = (dateStr: string): Date | undefined => {
        if (!dateStr) return undefined;
        try {
            // Try to parse YYYY-MM-DD format first
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return new Date(dateStr);
            }
            // Try to parse dd-mm-yyyy format
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            return undefined;
        } catch {
            return undefined;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-medium text-[#16569e] border-b border-[#16569e] pb-2">
                        Rank: {rank}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        {/* 1. Name - Display only */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Name:</span>
                            <span className="text-sm text-gray-900">{planningData?.crewName || planningData?.onBoardCrewName || '-'}</span>
                        </div>

                        {/* 2. Nationality - Display only */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Nationality:</span>
                            <span className="text-sm text-gray-900">{planningData?.nationality || planningData?.onBoardCrewNationality || '-'}</span>
                        </div>

                        {/* 3. Sign On Date - Display only (read-only) */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Sign On Date:</span>
                            <div className="flex items-center border rounded-md px-3 py-2 bg-gray-50">
                                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{planningData?.signOnDate ? formatDisplayDate(planningData.signOnDate) : '-'}</span>
                            </div>
                        </div>

                        {/* 3.5 Sign On Port - Display only (read-only) */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Sign On Port:</span>
                            <div className="flex items-center border rounded-md px-3 py-2 bg-gray-50">
                                <span className="text-sm text-gray-900">{planningData?.joiningPort || '-'}</span>
                            </div>
                        </div>

                        {/* 4. Take Over Date - Date Picker */}
                        <FormField
                            control={form.control}
                            name="takeOverDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Take Over Date</FormLabel>
                                        <Popover open={takeOverDateOpen} onOpenChange={setTakeOverDateOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start text-left font-normal"
                                                        data-testid="button-take-over-date"
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? formatDisplayDate(field.value) : <span className="text-gray-400">dd-mm-yyyy</span>}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? parseDate(field.value) : undefined}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            field.onChange(format(date, 'yyyy-MM-dd'));
                                                            setTakeOverDateOpen(false);
                                                        }
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* 5. Take Over Confirmation - Checkbox */}
                        <FormField
                            control={form.control}
                            name="takeOverConfirmation"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Take Over Confirmation</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center">
                                                <Checkbox 
                                                    checked={field.value || false}
                                                    onCheckedChange={field.onChange}
                                                    data-testid="checkbox-take-over-confirmation"
                                                />
                                            </div>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* 6-8. Contract Fields Section (From Relief Status) - Bordered */}
                        <div className="border border-[#16569e] rounded-md p-4 space-y-4">
                            {/* 6. Contract Period (Months) */}
                            <FormField
                                control={form.control}
                                name="contractPeriodMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                                            <FormLabel className="text-sm text-gray-700">Contract Period (Months):</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    type="number" 
                                                    className="bg-white"
                                                    data-testid="input-contract-period-onboard"
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                />
                                            </FormControl>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* 7. Contract End - Range Start (Months) */}
                            <FormField
                                control={form.control}
                                name="contractEndRangeStartMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                                            <FormLabel className="text-sm text-gray-700">Contract End - Range Start (Months):</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    type="number" 
                                                    className="bg-white"
                                                    data-testid="input-contract-range-start-onboard"
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                />
                                            </FormControl>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* 8. Contract End - Range End (Months) */}
                            <FormField
                                control={form.control}
                                name="contractEndRangeEndMonths"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                                            <FormLabel className="text-sm text-gray-700">Contract End - Range End (Months):</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    type="number" 
                                                    className="bg-white"
                                                    data-testid="input-contract-range-end-onboard"
                                                    value={field.value ?? ''}
                                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                />
                                            </FormControl>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* 9. Relief Due - Auto-calculated from Joining Date + Contract Period */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Relief Due:</span>
                            <span className="text-sm text-gray-900">
                                {calculatedReliefDue 
                                    ? formatDisplayDate(calculatedReliefDue) 
                                    : (planningData?.reliefDue ? formatDisplayDate(planningData.reliefDue) : '-')}
                            </span>
                        </div>

                        {/* 10. Relief Status */}
                        <FormField
                            control={form.control}
                            name="reliefStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Relief Status</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value || undefined} 
                                                data-testid="select-relief-status"
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Proposed">Proposed</SelectItem>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                                                    <SelectItem value="Signed Off">Signed Off</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* 10.1 Sign Off Reason - Conditional, shows only when Relief Status = "Signed Off" */}
                        {watchedReliefStatus === "Signed Off" && (
                            <FormField
                                control={form.control}
                                name="signOffReason"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <FormLabel className="text-sm text-gray-700">Reason</FormLabel>
                                            <FormControl>
                                                <Select 
                                                    onValueChange={field.onChange} 
                                                    value={field.value || undefined} 
                                                    data-testid="select-sign-off-reason"
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Reason" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SIGN_OFF_REASONS.map((reason) => (
                                                            <SelectItem key={reason} value={reason}>
                                                                {reason}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* 11. Hand Over Date - Display Only (Auto-filled) */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Hand Over Date:</span>
                            <span className="text-sm text-gray-900">{planningData?.handOverDate ? formatDisplayDate(planningData.handOverDate) : '-'}</span>
                        </div>

                        {/* 12. Sign Off Date - Date Picker */}
                        <FormField
                            control={form.control}
                            name="signOffDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign Off Date</FormLabel>
                                        <Popover open={signOffDateOpen} onOpenChange={setSignOffDateOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start text-left font-normal"
                                                        data-testid="button-sign-off-date"
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? formatDisplayDate(field.value) : <span className="text-gray-400">dd-mm-yyyy</span>}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? parseDate(field.value) : undefined}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            field.onChange(format(date, 'yyyy-MM-dd'));
                                                            setSignOffDateOpen(false);
                                                        }
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* 13. Sign Off Port */}
                        <FormField
                            control={form.control}
                            name="signOffPort"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign Off Port</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value || undefined} 
                                                data-testid="select-sign-off-port"
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Port" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ports.length > 0 ? (
                                                        ports.map((port: any) => (
                                                            <SelectItem key={port.id || port.name} value={port.name}>
                                                                {port.name}
                                                            </SelectItem>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <SelectItem value="Singapore">Singapore</SelectItem>
                                                            <SelectItem value="Rotterdam">Rotterdam</SelectItem>
                                                            <SelectItem value="Dubai">Dubai</SelectItem>
                                                            <SelectItem value="Hong Kong">Hong Kong</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                type="submit"
                                className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                disabled={updatePlanningMutation.isPending}
                                data-testid="button-submit-onboard"
                            >
                                Submit
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export const VesselModule = (): JSX.Element => {
    const [selectedVesselPage, setSelectedVesselPage] = useState("vessel-database");
    
    // Define allowed pages for the vessel module
    const allowedPages = ["vessel-database"];

    // Filter state
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [vesselValue, setVesselValue] = useState("");
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    // Vessel detail view state
    const [selectedVessel, setSelectedVessel] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("crew-list");

    // Relief Status dialog state
    const [reliefDialogOpen, setReliefDialogOpen] = useState(false);
    const [selectedRankForRelief, setSelectedRankForRelief] = useState<any>(null);

    // On Board Status dialog state
    const [onBoardDialogOpen, setOnBoardDialogOpen] = useState(false);
    const [selectedRankForOnBoard, setSelectedRankForOnBoard] = useState<any>(null);
    
    // Show Archived state for Crew List
    const [showArchived, setShowArchived] = useState(false);
    
    // Compliance Matrix dialog state
    const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);

    // Appraisal Form dialog state
    const [showAppraisalForm, setShowAppraisalForm] = useState(false);
    const [selectedCrewForAppraisal, setSelectedCrewForAppraisal] = useState<any>(null);

    // Crew Info Form state
    const [isCrewInfoFormOpen, setIsCrewInfoFormOpen] = useState(false);
    const [selectedCrewMember, setSelectedCrewMember] = useState<any>(null);

    const gridApiRef = useRef<GridApi | null>(null);

    // Fetch vessels and crew members
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: crewMembers = [], isLoading: crewLoading } = useCrewMembers();
    
    // Get rank normalization utilities for filtering variants
    const { filterCrewWithVariants, isVariantRank, getCanonicalRankName } = useRankNormalization();
    
    // Fetch available ranks to get sortOrder
    const { data: availableRanks = [] } = useQuery<any[]>({
        queryKey: ['/api/available-ranks'],
    });

    // Create a map of rank name to sortOrder for sorting (from available ranks)
    const baseRankOrderMap = useMemo(() => {
        const map = new Map<string, number>();
        availableRanks.forEach((rank: any) => {
            map.set(rank.name, rank.sortOrder || 0);
        });
        return map;
    }, [availableRanks]);

    // Create a lookup map from crewMemberId to crew member data (with licenses)
    const crewMemberLookup = useMemo(() => {
        const map = new Map<string, any>();
        crewMembers.forEach((crew: any) => {
            if (crew.id) {
                map.set(crew.id, crew);
            }
        });
        return map;
    }, [crewMembers]);
    
    // Fetch vessel ranks for selected vessel (use vessel ID, e.g., VSL-003)
    const { data: vesselRanksRaw = [], isLoading: ranksLoading } = useVesselRanks(selectedVessel?.vesselId || null);
    
    // Sort vessel ranks according to Rank Admin order (backend provides sortOrder, use it directly)
    const vesselRanks = useMemo(() => {
        if (!vesselRanksRaw || !Array.isArray(vesselRanksRaw)) return [];
        return [...vesselRanksRaw].sort((a: any, b: any) => {
            // Use sortOrder from backend (already includes parent's sortOrder for variants)
            const orderA = a.sortOrder ?? baseRankOrderMap.get(a.rank) ?? 999999;
            const orderB = b.sortOrder ?? baseRankOrderMap.get(b.rank) ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            // Secondary sort: if same sortOrder, sort by suffix number (e.g., _1 before _2)
            const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
            const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
            return aSuffix - bSuffix;
        });
    }, [vesselRanksRaw, baseRankOrderMap]);
    
    // Create a comprehensive rank order map from vesselRanks (includes variants with correct sortOrder and aliases)
    const rankOrderMap = useMemo(() => {
        const map = new Map<string, number>();
        // First add base ranks from available ranks (with aliases like "2nd Officer" -> "Second Officer")
        availableRanks.forEach((rank: any) => {
            addRankAliasesToMap(map, rank.name, rank.sortOrder || 0);
        });
        // Then add all vessel ranks (including variants) - these have accurate sortOrder from backend
        vesselRanks.forEach((rank: any) => {
            const sortOrder = rank.sortOrder;
            if (sortOrder === undefined) return;
            
            // Add mapping for 'rank' field (e.g., "Second Officer")
            if (rank.rank) {
                addRankAliasesToMap(map, rank.rank, sortOrder);
            }
            // Add mapping for 'role' field (e.g., "2nd Officer" or "Oiler_1")
            if (rank.role && rank.role !== rank.rank) {
                map.set(rank.role, sortOrder);
            }
            // Add mapping for base rank extracted from role (e.g., "Oiler" from "Oiler_1")
            if (rank.role && rank.role.includes('_')) {
                const baseRank = rank.role.split('_')[0];
                if (!map.has(baseRank)) {
                    map.set(baseRank, sortOrder);
                }
            }
        });
        return map;
    }, [availableRanks, vesselRanks]);
    
    // Fetch vessel planning for selected vessel (use vessel ID, e.g., VSL-003)
    const { data: vesselPlanning = [], isLoading: planningLoading } = useVesselPlanning(selectedVessel?.vesselId || null);
    
    // Filter vesselRanks for Officer Matrix - exclude base ranks when variants exist
    const officerMatrixRanks = useMemo(() => {
        const officerRanks = vesselRanks.filter((rank: any) => rank.officer === true);
        const variantBaseRanks = new Set<string>();
        officerRanks.forEach((rank: any) => {
            const rankName = rank.role || rank.rank;
            if (isVariantRank(rankName)) {
                const baseRank = rankName.split('_')[0];
                variantBaseRanks.add(baseRank);
            }
        });
        return officerRanks.filter((rank: any) => {
            const rankName = rank.role || rank.rank;
            if (isVariantRank(rankName)) return true;
            return !variantBaseRanks.has(rankName);
        });
    }, [vesselRanks, isVariantRank]);
    
    // Filter vesselPlanning for Crew List - exclude base ranks when variants exist
    const filteredVesselPlanning = useMemo(() => {
        return filterCrewWithVariants(vesselPlanning, (p: any) => p.rank || '');
    }, [vesselPlanning, filterCrewWithVariants]);
    
    // Fetch all appraisals to determine button state
    const { data: allAppraisals = [] } = useAppraisals();
    
    // Training Matrix data hooks
    const { data: companyTrainings = [] } = useCompanyTrainings();
    const { data: companyTrainingGroups = [] } = useCompanyTrainingGroups();
    const { data: companyTrainingRequirements = [] } = useCompanyTrainingRequirements();
    const { data: trainingMatrixRevisions = [] } = useTrainingMatrixVesselRevisions(selectedVessel?.vesselId || null);
    const { data: trainingMatrixDrafts = [] } = useTrainingMatrixVesselDraft(selectedVessel?.vesselId || null);
    
    // Get applicable training IDs for the selected vessel (from draft or latest revision)
    const applicableTrainingIds = useMemo(() => {
        // Priority: draft data first (if draft has valid data), then latest revision
        let sourceData: any = null;
        
        // Check if draft has valid data with applicableTrainingIds
        if (trainingMatrixDrafts.length > 0) {
            const draft = trainingMatrixDrafts[0];
            try {
                const parsedDraft = typeof draft.draftData === 'string' ? JSON.parse(draft.draftData) : draft.draftData;
                // Only use draft if it has applicableTrainingIds array with items
                if (parsedDraft?.applicableTrainingIds && Array.isArray(parsedDraft.applicableTrainingIds) && parsedDraft.applicableTrainingIds.length > 0) {
                    sourceData = parsedDraft;
                }
            } catch (e) {
                console.error('Failed to parse training matrix draft data:', e);
            }
        }
        
        // Fall back to latest revision if no valid draft data
        if (!sourceData && trainingMatrixRevisions.length > 0) {
            // Get the latest revision
            const sortedRevisions = [...trainingMatrixRevisions].sort((a: any, b: any) => {
                const aNum = parseInt((a.revision || '').replace('R', '') || '0');
                const bNum = parseInt((b.revision || '').replace('R', '') || '0');
                return bNum - aNum;
            });
            const latestRevision = sortedRevisions[0];
            try {
                sourceData = typeof latestRevision.revisionData === 'string' 
                    ? JSON.parse(latestRevision.revisionData) 
                    : latestRevision.revisionData;
            } catch (e) {
                console.error('Failed to parse training matrix revision data:', e);
            }
        }
        
        if (sourceData?.applicableTrainingIds) {
            return new Set<number>(sourceData.applicableTrainingIds);
        }
        return new Set<number>();
    }, [trainingMatrixDrafts, trainingMatrixRevisions]);
    
    // Filter and group company trainings for the Training Matrix tab
    const groupedTrainingsForMatrix = useMemo(() => {
        // Filter trainings that are applicable to this vessel
        const applicableTrainings = companyTrainings.filter((training: any) => 
            applicableTrainingIds.has(training.id)
        );
        
        // Create a map of group code to group label
        const groupLabelMap = new Map<string, string>();
        companyTrainingGroups.forEach((group: any) => {
            if (group.code && group.label) {
                groupLabelMap.set(group.code, group.label);
            }
        });
        
        // Group trainings by groupCode and sort
        const grouped: { groupCode: string; groupLabel: string; trainings: any[] }[] = [];
        const groupMap = new Map<string, any[]>();
        const noGroupTrainings: any[] = [];
        
        applicableTrainings.forEach((training: any) => {
            if (training.groupCode) {
                if (!groupMap.has(training.groupCode)) {
                    groupMap.set(training.groupCode, []);
                }
                groupMap.get(training.groupCode)!.push(training);
            } else {
                noGroupTrainings.push(training);
            }
        });
        
        // Sort groups alphabetically by code (A, B, C, etc.)
        const sortedGroupCodes = Array.from(groupMap.keys()).sort();
        
        sortedGroupCodes.forEach(code => {
            const trainings = groupMap.get(code) || [];
            // Sort trainings within group by sortOrder
            trainings.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
            grouped.push({
                groupCode: code,
                groupLabel: groupLabelMap.get(code) || code,
                trainings
            });
        });
        
        // Add trainings without a group at the end
        if (noGroupTrainings.length > 0) {
            noGroupTrainings.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
            grouped.push({
                groupCode: '',
                groupLabel: 'Unassigned',
                trainings: noGroupTrainings
            });
        }
        
        return grouped;
    }, [companyTrainings, companyTrainingGroups, applicableTrainingIds]);
    
    // Create a lookup for training requirements by companyTrainingId and rankId
    const trainingRequirementsLookup = useMemo(() => {
        const lookup = new Map<string, string>(); // key: "trainingId-rankId", value: "M" or "R"
        companyTrainingRequirements.forEach((req: any) => {
            if (req.companyTrainingId && req.rankId && req.status) {
                lookup.set(`${req.companyTrainingId}-${req.rankId}`, req.status);
            }
        });
        return lookup;
    }, [companyTrainingRequirements]);
    
    // Helper function to get requirement status for a training and vessel position
    // Uses the numeric availableRanks.id from the vessel position data
    const getTrainingRequirementStatus = (trainingId: number, vesselPosition: any): string | null => {
        // For variant rows (like "3rd Officer_1"), use originalRankId to get the parent rank's requirements
        // For regular positions, use the position's id (which is the availableRanks.id as string)
        let lookupRankId: number | null = null;
        
        if (vesselPosition.isRoleRow && vesselPosition.originalRankId) {
            // Variant row - use the original rank ID (which is the availableRanks.id)
            lookupRankId = parseInt(vesselPosition.originalRankId, 10);
        } else if (vesselPosition.id) {
            // Regular position - the id field contains the availableRanks.id as a string
            // For compound IDs like "4_role_1_...", extract just the numeric prefix
            const idStr = String(vesselPosition.id);
            const numericPart = idStr.split('_')[0]; // Get first part before any underscore
            lookupRankId = parseInt(numericPart, 10);
        }
        
        if (!lookupRankId || isNaN(lookupRankId)) return null;
        
        // Look up the requirement using trainingId and the rank's availableRanks.id
        return trainingRequirementsLookup.get(`${trainingId}-${lookupRankId}`) || null;
    };

    // Helper function to determine training expiry status (dot color)
    // Returns: 'green' (valid), 'yellow' (expiring in 2 months), 'red' (expired), or null (no training)
    const getTrainingExpiryStatus = (expiryDateStr: string | null | undefined): 'green' | 'yellow' | 'red' | null => {
        if (!expiryDateStr) return null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Parse the expiry date (handle various formats)
        let expiryDate: Date;
        if (expiryDateStr.includes('/')) {
            // dd/mm/yyyy format
            const parts = expiryDateStr.split('/');
            expiryDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
            // ISO or other standard format
            expiryDate = new Date(expiryDateStr);
        }
        
        if (isNaN(expiryDate.getTime())) return null;
        
        // Calculate 2 months from now
        const twoMonthsFromNow = new Date(today);
        twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
        
        if (expiryDate < today) {
            return 'red'; // Expired
        } else if (expiryDate <= twoMonthsFromNow) {
            return 'yellow'; // Expiring within 2 months
        } else {
            return 'green'; // Valid
        }
    };

    // Create a lookup from rank position to crew member's training courses
    // Key: vessel position role (e.g., "Master", "Chief Officer", "3rd Officer_1")
    // Value: Map of companyId to training expiry date
    // Uses role as primary key - prioritizes primary crew over secondary
    const crewTrainingLookupByRole = useMemo(() => {
        const lookup = new Map<string, Map<string, string>>();
        const primaryKeys = new Set<string>(); // Track which keys have primary crew
        
        // First pass: process primary crew only
        vesselPlanning.forEach((planning: any) => {
            const crewMemberId = planning.crewMemberId;
            if (!crewMemberId) return;
            
            // Only process primary crew in first pass
            const crewStatus = planning.crewStatus || '';
            if (crewStatus !== 'primary' && crewStatus !== '') return;
            
            const crewMember = crewMemberLookup.get(crewMemberId);
            if (!crewMember) return;
            
            const roleKey = planning.role || planning.rank || '';
            if (!roleKey) return;
            
            // Parse training courses from crew member data
            let trainingCourses: any[] = [];
            if (crewMember.trainingCourses) {
                if (typeof crewMember.trainingCourses === 'string') {
                    try {
                        trainingCourses = JSON.parse(crewMember.trainingCourses);
                    } catch (e) {
                        trainingCourses = [];
                    }
                } else if (Array.isArray(crewMember.trainingCourses)) {
                    trainingCourses = crewMember.trainingCourses;
                }
            }
            
            const trainingMap = new Map<string, string>();
            trainingCourses.forEach((training: any) => {
                if (training.companyId && training.expiry) {
                    trainingMap.set(training.companyId, training.expiry);
                }
            });
            
            lookup.set(roleKey, trainingMap);
            primaryKeys.add(roleKey);
        });
        
        // Second pass: add secondary crew only if no primary exists for that role
        vesselPlanning.forEach((planning: any) => {
            const crewMemberId = planning.crewMemberId;
            if (!crewMemberId) return;
            
            const crewStatus = planning.crewStatus || '';
            if (crewStatus === 'primary' || crewStatus === '') return; // Skip primary (already processed)
            
            const roleKey = planning.role || planning.rank || '';
            if (!roleKey || primaryKeys.has(roleKey)) return; // Skip if primary already exists
            
            const crewMember = crewMemberLookup.get(crewMemberId);
            if (!crewMember) return;
            
            let trainingCourses: any[] = [];
            if (crewMember.trainingCourses) {
                if (typeof crewMember.trainingCourses === 'string') {
                    try {
                        trainingCourses = JSON.parse(crewMember.trainingCourses);
                    } catch (e) {
                        trainingCourses = [];
                    }
                } else if (Array.isArray(crewMember.trainingCourses)) {
                    trainingCourses = crewMember.trainingCourses;
                }
            }
            
            const trainingMap = new Map<string, string>();
            trainingCourses.forEach((training: any) => {
                if (training.companyId && training.expiry) {
                    trainingMap.set(training.companyId, training.expiry);
                }
            });
            
            lookup.set(roleKey, trainingMap);
        });
        
        return lookup;
    }, [vesselPlanning, crewMemberLookup]);

    // Helper function to get crew training compliance status for a cell
    // Returns the dot color or null if no training/no requirement
    const getCrewTrainingComplianceStatus = (trainingCompanyId: string, vesselPosition: any): 'green' | 'yellow' | 'red' | null => {
        // Use role as primary key (matches how we store in crewTrainingLookupByRole)
        const roleKey = vesselPosition.role || vesselPosition.rank || '';
        if (!roleKey) return null;
        
        const crewTrainings = crewTrainingLookupByRole.get(roleKey);
        if (!crewTrainings) return null;
        
        const expiryDate = crewTrainings.get(trainingCompanyId);
        if (!expiryDate) return null;
        
        return getTrainingExpiryStatus(expiryDate);
    };

    // Helper function to get the latest appraisal for a crew member
    const getLatestAppraisal = (crewId: string) => {
        const crewAppraisals = allAppraisals
            .filter((a: any) => a.crewMemberId === crewId)
            .sort((a: any, b: any) => {
                const dateA = a.appraisalDate ? new Date(a.appraisalDate).getTime() : 0;
                const dateB = b.appraisalDate ? new Date(b.appraisalDate).getTime() : 0;
                return dateB - dateA;
            });
        return crewAppraisals[0] || null;
    };

    // Helper function to determine button text and action
    const getAppraisalButtonConfig = (crewId: string) => {
        const latestAppraisal = getLatestAppraisal(crewId);
        
        if (!latestAppraisal) {
            return { text: 'Add', appraisalId: undefined, status: undefined };
        }
        
        const status = latestAppraisal.status?.toLowerCase();
        
        // Show "Edit" for Draft or Preliminary (vessel is still working on it)
        if (status === 'draft' || status === 'preliminary') {
            return { text: 'Edit', appraisalId: latestAppraisal.id, status: latestAppraisal.status };
        }
        
        // Show "Add" for Submitted or Reviewed (vessel completed, new appraisal can be created)
        return { text: 'Add', appraisalId: undefined, status: undefined };
    };

    const handleClearFilters = () => {
        setVesselValue("");
        setFleetValue("");
        setAddGroupValue("");
        setFilterType("vessel");
    };

    const handleEditVessel = (vesselData: any) => {
        const vessel = vessels.find((v: any) => v.id === vesselData.id);
        if (vessel) {
            setSelectedVessel(vessel);
            setActiveTab("crew-list");
        }
    };

    const handleBackToList = () => {
        setSelectedVessel(null);
        setActiveTab("crew-list");
    };

    const handleVesselChange = (vesselName: string) => {
        const vessel = vessels.find((v: any) => v.name === vesselName);
        if (vessel) {
            setSelectedVessel(vessel);
        }
    };

    const handleAppraisalClick = (crew: any, buttonConfig: { text: string; appraisalId?: number; status?: string }) => {
        // Transform crew data to match AppraisalForm expected structure
        const crewForAppraisal = {
            id: crew.id,
            employeeId: crew.employeeId,
            name: {
                first: crew.firstName || '',
                middle: crew.middleName || '',
                last: crew.familyName || crew.lastName || ''
            },
            rank: crew.presentRank || crew.rank || '',
            nationality: crew.nationality || '',
            vessel: selectedVessel?.name || crew.presentVessel || '',
            vesselType: selectedVessel?.vesselType || '',
            signOn: crew.joiningDate || '',
            // Store button config separately for prop passing
            _appraisalId: buttonConfig.appraisalId,
            _initialStatus: buttonConfig.status,
        };
        setSelectedCrewForAppraisal(crewForAppraisal);
        setShowAppraisalForm(true);
    };

    const handleCloseAppraisalForm = () => {
        setShowAppraisalForm(false);
        setSelectedCrewForAppraisal(null);
    };

    // Calculate crew on board for each vessel
    const vesselData = useMemo(() => {
        return vessels.map((vessel: any) => {
            const crewCount = crewMembers.filter((crew: any) => 
                crew.presentVessel === vessel.name || 
                crew.presentVessel === vessel.vesselId
            ).length;

            return {
                id: vessel.id,
                vessel: vessel.name,
                type: vessel.vesselType,
                crewOnBoard: crewCount
            };
        });
    }, [vessels, crewMembers]);

    const ActionsCellRenderer = (props: any) => {
        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (props.context && props.context.handleEditVessel) {
                props.context.handleEditVessel(props.data);
            }
        };

        return (
            <div className="flex items-center justify-center h-full">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={handleClick}
                    data-testid={`button-edit-${props.data.id}`}
                >
                    <Edit className="h-4 w-4 text-gray-500" />
                </Button>
            </div>
        );
    };

    const columnDefs: ColDef[] = useMemo(() => [
        {
            headerName: 'Vessel',
            field: 'vessel',
            flex: 1,
            cellStyle: { fontSize: '13px', color: '#4f5863' },
            filter: 'agTextColumnFilter',
            sortable: true,
            resizable: true
        },
        {
            headerName: 'Type',
            field: 'type',
            flex: 1,
            cellStyle: { fontSize: '13px', color: '#4f5863' },
            filter: 'agSetColumnFilter',
            sortable: true,
            resizable: true,
            enableRowGroup: false
        },
        {
            headerName: 'Crew o/b',
            field: 'crewOnBoard',
            flex: 1,
            cellStyle: { fontSize: '13px', color: '#4f5863' },
            filter: 'agNumberColumnFilter',
            sortable: true,
            resizable: true
        },
        {
            headerName: '',
            field: 'actions',
            flex: 0.5,
            cellRenderer: ActionsCellRenderer,
            sortable: false,
            filter: false,
            cellClass: 'flex items-center justify-center'
        }
    ], []);

    const onGridReady = (params: { api: GridApi }) => {
        gridApiRef.current = params.api;
    };

    const renderVesselDetail = () => {
        if (!selectedVessel) return null;

        return (
            <div className="flex flex-col h-full">
                {/* Header with vessel dropdown, tabs, and back button */}
                <div className="flex items-center justify-between mb-6 pb-4">
                    {/* Left: Vessel Dropdown */}
                    <div className="flex-shrink-0">
                        <Select value={selectedVessel.name} onValueChange={handleVesselChange}>
                            <SelectTrigger 
                                className="h-10 border-none shadow-none text-xl font-semibold text-[#0f172a] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                                data-testid="select-vessel-detail"
                            >
                                <SelectValue>{selectedVessel.name}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {vessels.map((vessel: any) => (
                                    <SelectItem key={vessel.id} value={vessel.name}>
                                        {vessel.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Center: Tabs */}
                    <div className="flex-1 flex justify-center">
                        <div className="flex items-center bg-transparent rounded-full p-1 border border-gray-300 h-8">
                            {[
                                { id: "crew-list", label: "Crew List" },
                                { id: "training-matrix", label: "Training Matrix" },
                                { id: "officer-matrix", label: "Officer Matrix" },
                                { id: "planning", label: "Planning" }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 text-xs rounded-full transition-all duration-200 h-6 flex items-center ${
                                        activeTab === tab.id
                                            ? "text-[#16569e] font-bold underline"
                                            : "text-gray-600 hover:text-gray-800 font-medium"
                                    }`}
                                    data-testid={`tab-${tab.id}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Back Button */}
                    <div className="flex-shrink-0">
                        <Button
                            variant="outline"
                            onClick={handleBackToList}
                            className="h-8 border-[#e1e8ed] text-[#16569e] flex items-center gap-2"
                            data-testid="button-back-to-list"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-xs">Back</span>
                        </Button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto">
                    <Tabs value={activeTab} className="w-full h-full">
                        <TabsContent value="crew-list" className="mt-0">
                            <div className="space-y-4">
                                {/* Controls: Show Archived and Download buttons */}
                                <div className="flex items-center justify-between">
                                    {/* Show Archived Checkbox */}
                                    <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-white">
                                        <Checkbox
                                            id="show-archived-crew"
                                            checked={showArchived}
                                            onCheckedChange={(checked) => setShowArchived(checked === true)}
                                            data-testid="checkbox-show-archived-crew"
                                        />
                                        <label 
                                            htmlFor="show-archived-crew" 
                                            className="text-sm text-gray-700 cursor-pointer select-none"
                                        >
                                            Show Archived
                                        </label>
                                    </div>
                                    
                                    {/* Download buttons */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-2"
                                            data-testid="button-download-imo"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="text-xs">IMO Crew List</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-2"
                                            data-testid="button-download-us"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="text-xs">US Crew List</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Table Container */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <ScrollArea className="h-[calc(100vh-330px)] w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    <TableHead className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3]">S. No.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Rank</TableHead>
                                                    <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3]">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Nationality</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3]">Signed On</TableHead>
                                                    {showArchived ? (
                                                        <>
                                                            <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3]">Actual Sign Off Date</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Appraisal</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Handover</TableHead>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Doc Check</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-20 sticky top-0 z-30 bg-[#52baf3]">Famil.</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Relief Date</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3]">Planned S/Off</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-40 sticky top-0 z-30 bg-[#52baf3]">Doc. Expiring (2m)/Expired</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3]">Medical Expiring</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Appraisal</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3]">Handover</TableHead>
                                                            <TableHead className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3]"></TableHead>
                                                        </>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={14} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={14} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : planningLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={14} className="text-center text-xs text-gray-500 py-8">
                                                            Loading crew members...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (() => {
                                                    // Helper to get sortOrder with fallback for unknown ranks
                                                    const getRankSortOrder = (rankName: string | null | undefined): number => {
                                                        if (!rankName) return 999999;
                                                        // First try exact match
                                                        const exact = rankOrderMap.get(rankName);
                                                        if (exact !== undefined) return exact;
                                                        // Try base rank (strip suffix like _1, _2)
                                                        const baseRank = rankName.split('_')[0];
                                                        const base = rankOrderMap.get(baseRank);
                                                        if (base !== undefined) return base;
                                                        // Try canonical name (e.g., "2nd Officer" -> "Second Officer")
                                                        const canonical = getCanonicalRankName(rankName);
                                                        const canonicalOrder = rankOrderMap.get(canonical);
                                                        if (canonicalOrder !== undefined) return canonicalOrder;
                                                        // Fallback: unknown rank goes to end
                                                        return 999999;
                                                    };
                                                    
                                                    // Use filtered vessel planning data (excludes base ranks when variants exist) and sort by rank order
                                                    // Filter based on showArchived: when false, exclude archived; when true, show only archived
                                                    const vesselCrew = filteredVesselPlanning
                                                        .filter((planning: any) => {
                                                            if (!planning.crewMemberId) return false;
                                                            const isArchived = planning.isArchived === true;
                                                            return showArchived ? isArchived : !isArchived;
                                                        })
                                                        .sort((a: any, b: any) => {
                                                            const aOrder = getRankSortOrder(a.rank);
                                                            const bOrder = getRankSortOrder(b.rank);
                                                            if (aOrder !== bOrder) return aOrder - bOrder;
                                                            // Secondary sort: if same sortOrder, sort by suffix number (e.g., _1 before _2)
                                                            const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
                                                            const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
                                                            return aSuffix - bSuffix;
                                                        });
                                                    
                                                    if (vesselCrew.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={showArchived ? 8 : 14} className="text-center text-xs text-gray-500 py-8">
                                                                    {showArchived 
                                                                        ? "No archived crew members for this vessel."
                                                                        : "No crew members assigned to this vessel."
                                                                    }
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                    
                                                    // Build a map to determine which ranks have both primary and secondary crew
                                                    const rankCrewMap = new Map<string, { primary: boolean; secondary: boolean }>();
                                                    vesselCrew.forEach((planning: any) => {
                                                        const rankBase = planning.rank?.split('_')[0] || planning.rank;
                                                        if (!rankCrewMap.has(rankBase)) {
                                                            rankCrewMap.set(rankBase, { primary: false, secondary: false });
                                                        }
                                                        const entry = rankCrewMap.get(rankBase)!;
                                                        if (planning.crewStatus === 'primary') entry.primary = true;
                                                        if (planning.crewStatus === 'secondary') entry.secondary = true;
                                                    });
                                                    
                                                    return vesselCrew.map((planning: any, index: number) => {
                                                        // Use embedded crew member data from planning (already enriched by API)
                                                        const crewData = planning.crewMemberData;
                                                        
                                                        // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
                                                        const rankBase = planning.rank?.split('_')[0] || planning.rank;
                                                        
                                                        // Check if both primary and secondary exist for this rank
                                                        const rankEntry = rankCrewMap.get(rankBase);
                                                        const hasBothCrewTypes = !!(rankEntry?.primary && rankEntry?.secondary);
                                                        
                                                        // Only show (P)/(S) badge in Rank column when BOTH crew types exist
                                                        const statusBadge = hasBothCrewTypes ? (planning.crewStatus === 'secondary' ? ' (S)' : ' (P)') : '';
                                                        const displayRank = rankBase + statusBadge;
                                                        
                                                        return (
                                                        <TableRow key={planning.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-sno-${index + 1}`}>
                                                                {index + 1}.
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-rank-${index + 1}`}>
                                                                {displayRank}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-name-${index + 1}`}>
                                                                {planning.crewName || ''}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-nationality-${index + 1}`}>
                                                                {planning.nationality || ''}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-joined-${index + 1}`}>
                                                                {formatDateOnly(planning.signOnDate)}
                                                            </TableCell>
                                                            {showArchived ? (
                                                                <>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-signoff-date-${index + 1}`}>
                                                                        {formatDateOnly(planning.signOffDate || planning.archivedDate)}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-appraisal-${index + 1}`}>
                                                                        {crewData && (() => {
                                                                            const buttonConfig = getAppraisalButtonConfig(planning.crewMemberId);
                                                                            const crewForAppraisal = {
                                                                                id: crewData.id,
                                                                                employeeId: crewData.employeeId,
                                                                                firstName: crewData.firstName,
                                                                                lastName: crewData.lastName,
                                                                                nationality: crewData.nationality,
                                                                                presentRank: crewData.presentRank || planning.rank
                                                                            };
                                                                            return (
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="sm" 
                                                                                    className="h-7 text-xs px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                                    onClick={() => handleAppraisalClick(crewForAppraisal, buttonConfig)}
                                                                                    data-testid={`button-appraisal-${buttonConfig.text.toLowerCase()}-${index + 1}`}
                                                                                >
                                                                                    {buttonConfig.text}
                                                                                </Button>
                                                                            );
                                                                        })()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-handover-${index + 1}`}>
                                                                        {formatDateOnly(planning.handOverDate)}
                                                                    </TableCell>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-doccheck-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-famil-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-relief-${index + 1}`}>
                                                                        {formatDateOnly(planning.reliefDue || planning.signOffDate)}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-planned-${index + 1}`}>
                                                                        {formatDateOnly(planning.signOffDate)}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-docexp-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-medical-${index + 1}`}>
                                                                        {(() => {
                                                                            const medicalExpiry = crewData?.latestMedicalExpiry;
                                                                            if (!medicalExpiry) return null;
                                                                            
                                                                            const expiryDate = new Date(medicalExpiry);
                                                                            const today = new Date();
                                                                            const twoMonthsFromNow = new Date();
                                                                            twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
                                                                            
                                                                            let textColor = 'text-gray-700';
                                                                            if (expiryDate < today) {
                                                                                textColor = 'text-red-600 font-medium';
                                                                            } else if (expiryDate <= twoMonthsFromNow) {
                                                                                textColor = 'text-orange-500 font-medium';
                                                                            }
                                                                            
                                                                            return (
                                                                                <span className={textColor}>
                                                                                    {formatDateOnly(medicalExpiry)}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-appraisal-${index + 1}`}>
                                                                        {crewData && (() => {
                                                                            const buttonConfig = getAppraisalButtonConfig(planning.crewMemberId);
                                                                            const crewForAppraisal = {
                                                                                id: crewData.id,
                                                                                employeeId: crewData.employeeId,
                                                                                firstName: crewData.firstName,
                                                                                lastName: crewData.lastName,
                                                                                nationality: crewData.nationality,
                                                                                presentRank: crewData.presentRank || planning.rank
                                                                            };
                                                                            return (
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="sm" 
                                                                                    className="h-7 text-xs px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                                    onClick={() => handleAppraisalClick(crewForAppraisal, buttonConfig)}
                                                                                    data-testid={`button-appraisal-${buttonConfig.text.toLowerCase()}-${index + 1}`}
                                                                                >
                                                                                    {buttonConfig.text}
                                                                                </Button>
                                                                            );
                                                                        })()}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-handover-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs" data-testid={`cell-actions-${index + 1}`}>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="sm" 
                                                                            className="h-8 w-8 p-0"
                                                                            onClick={() => {
                                                                                if (crewData) {
                                                                                    setSelectedCrewMember(crewData);
                                                                                    setIsCrewInfoFormOpen(true);
                                                                                }
                                                                            }}
                                                                            data-testid={`button-view-crew-${index + 1}`}
                                                                        >
                                                                            <Eye className="h-4 w-4 text-gray-500" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </>
                                                            )}
                                                        </TableRow>
                                                    )});
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="training-matrix" className="mt-0">
                            <div className="space-y-4">
                                {/* Legend */}
                                <div className="flex items-center gap-6 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 h-5 bg-[#F0FDF4] border border-gray-300 flex items-center justify-center">
                                            Mandatory
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-5 bg-blue-100 border border-gray-300 flex items-center justify-center">
                                            Recommended
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span>Valid</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <span>Expiring in 2 months</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <span>Expired</span>
                                    </div>
                                </div>

                                {/* Training Matrix Table */}
                                {(() => {
                                    // Filter out base ranks when variant positions exist for the same rankId
                                    const filteredRanks = vesselRanks.filter((rank: any) => {
                                        const fullRankName = rank.role || rank.rank;
                                        const hasVariantSuffix = fullRankName?.includes('_');
                                        if (hasVariantSuffix) return true;
                                        const hasVariants = vesselRanks.some((other: any) => {
                                            const otherName = other.role || other.rank;
                                            return other.rankId === rank.rankId && otherName?.includes('_');
                                        });
                                        return !hasVariants;
                                    });
                                    
                                    // Check if there are any applicable trainings
                                    const hasApplicableTrainings = groupedTrainingsForMatrix.length > 0 && 
                                        groupedTrainingsForMatrix.some(group => group.trainings.length > 0);
                                    
                                    return (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="overflow-auto h-[calc(100vh-300px)] w-full relative">
                                        <Table className="min-w-max relative">
                                                <TableHeader>
                                                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                        <TableHead className="text-white text-xs font-normal w-24 sticky left-0 z-40 bg-[#52baf3] border-r border-white/20">
                                                            Company ID
                                                        </TableHead>
                                                        <TableHead className="text-white text-xs font-normal w-96 sticky left-24 z-40 bg-[#52baf3] border-r border-white/20">
                                                            Training Label
                                                        </TableHead>
                                                    {filteredRanks.length > 0 ? (
                                                        filteredRanks.map((rank: any, index: number) => (
                                                            <TableHead 
                                                                key={rank.id || index} 
                                                                className="text-white text-xs font-normal text-center w-24 sticky top-0 z-30 bg-[#52baf3]"
                                                                data-testid={`header-rank-${index}`}
                                                            >
                                                                {rank.role || rank.rank}
                                                            </TableHead>
                                                        ))
                                                    ) : (
                                                        <TableHead className="text-white text-xs font-normal text-center">
                                                            No Ranks
                                                        </TableHead>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={2 + filteredRanks.length} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : filteredRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : !hasApplicableTrainings ? (
                                                    <TableRow>
                                                        <TableCell colSpan={2 + filteredRanks.length} className="text-center text-xs text-gray-500 py-8">
                                                            No trainings configured for this vessel. Configure trainings in Admin &gt; Training Matrix &gt; Vessel.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    <>
                                                        {groupedTrainingsForMatrix.map((group, groupIndex) => (
                                                            <React.Fragment key={group.groupCode || `unassigned-${groupIndex}`}>
                                                                {/* Group Header Row */}
                                                                <TableRow className="bg-blue-100 hover:bg-blue-100">
                                                                    <TableCell 
                                                                        colSpan={2 + filteredRanks.length} 
                                                                        className="text-xs font-semibold text-gray-900 sticky left-0 z-20 bg-blue-100"
                                                                    >
                                                                        {group.groupCode ? `${group.groupCode}. ${group.groupLabel}` : group.groupLabel}
                                                                    </TableCell>
                                                                </TableRow>
                                                                
                                                                {/* Training Rows within Group */}
                                                                {group.trainings.map((training: any, trainingIndex: number) => (
                                                                    <TableRow key={training.id} className="hover:bg-gray-50 border-b border-gray-200">
                                                                        <TableCell 
                                                                            className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200 border-b border-gray-200" 
                                                                            data-testid={`cell-company-id-${training.id}`}
                                                                        >
                                                                            {training.companyId}
                                                                        </TableCell>
                                                                        <TableCell 
                                                                            className="text-xs text-gray-700 sticky left-24 z-20 bg-white border-r border-gray-200 border-b border-gray-200" 
                                                                            data-testid={`cell-training-label-${training.id}`}
                                                                        >
                                                                            {training.trainingLabel}
                                                                        </TableCell>
                                                                        {filteredRanks.map((rank: any, rankIndex: number) => {
                                                                            // Pass the entire rank object to get proper rankId lookup
                                                                            const status = getTrainingRequirementStatus(training.id, rank);
                                                                            
                                                                            // Get crew training compliance status
                                                                            const complianceStatus = getCrewTrainingComplianceStatus(training.companyId, rank);
                                                                            
                                                                            // Determine background color based on M/R status
                                                                            let bgColor = 'bg-white';
                                                                            if (status === 'M') {
                                                                                bgColor = 'bg-[#F0FDF4]'; // Light green for Mandatory
                                                                            } else if (status === 'R') {
                                                                                bgColor = 'bg-blue-100'; // Light blue for Recommended
                                                                            }
                                                                            
                                                                            // Determine dot color based on compliance status
                                                                            let dotColor = '';
                                                                            if (complianceStatus === 'green') {
                                                                                dotColor = 'bg-green-500';
                                                                            } else if (complianceStatus === 'yellow') {
                                                                                dotColor = 'bg-yellow-500';
                                                                            } else if (complianceStatus === 'red') {
                                                                                dotColor = 'bg-red-500';
                                                                            }
                                                                            
                                                                            return (
                                                                                <TableCell 
                                                                                    key={rank.id || rankIndex}
                                                                                    className={`text-xs text-center border-b border-gray-200 ${bgColor}`}
                                                                                    data-testid={`cell-training-${training.id}-rank-${rankIndex}`}
                                                                                >
                                                                                    {/* Show compliance dot if crew has this training */}
                                                                                    {complianceStatus && (
                                                                                        <div className="flex items-center justify-center">
                                                                                            <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                                                                                        </div>
                                                                                    )}
                                                                                </TableCell>
                                                                            );
                                                                        })}
                                                                    </TableRow>
                                                                ))}
                                                            </React.Fragment>
                                                        ))}
                                                    </>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                    );
                                })()}
                            </div>
                        </TabsContent>

                        <TabsContent value="officer-matrix" className="mt-0">
                            <div className="space-y-4">
                                {/* Check Compliance button aligned to the right */}
                                <div className="flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-[#16569e] text-[#16569e] hover:bg-[#16569e] hover:text-white"
                                        onClick={() => setComplianceDialogOpen(true)}
                                        data-testid="button-check-compliance"
                                    >
                                        Check Compliance
                                    </Button>
                                </div>

                                {/* Table Container */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <ScrollArea className="h-[calc(100vh-280px)] w-full">
                                        <Table>
                                            <TableHeader>
                                                {/* First Header Row - Section Headers */}
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    {/* Rank column */}
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] border-r border-white/20">Rank</TableHead>
                                                    
                                                    {/* Rank, Name & Nationality Section */}
                                                    <TableHead colSpan={2} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Rank, Name & Nationality</TableHead>
                                                    
                                                    {/* Certification & Qualification Section */}
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Certification & Qualification</TableHead>
                                                    
                                                    {/* Years in Service (Today's Date) Section */}
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Years in Service (Today's Date)</TableHead>
                                                    
                                                    {/* Language Section */}
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal text-center w-24 sticky top-0 z-30 bg-[#52baf3]">
                                                        <div className="flex flex-col items-center">
                                                            <span>Language</span>
                                                            <span className="text-[10px] font-light mt-0.5">English</span>
                                                        </div>
                                                    </TableHead>
                                                    
                                                    {/* Actions column */}
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3]"></TableHead>
                                                </TableRow>
                                                
                                                {/* Second Header Row - Column Headers */}
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    {/* Rank, Name & Nationality columns */}
                                                    <TableHead className="text-white text-xs font-normal sticky top-[41px] z-30 bg-[#52baf3]">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Nationality</TableHead>
                                                    
                                                    {/* Certification & Qualification columns */}
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Cert. Comp.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Issuing Country</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Admin Accept</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker Cert.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Spl. tanker Training</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Radio Qual.</TableHead>
                                                    
                                                    {/* Years in Service columns */}
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">Company</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">Rank</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker Type</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">All Types</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">OOW</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Time o/b (months)</TableHead>
                                                    
                                                    {/* Language column is rowSpan from first row */}
                                                    {/* Actions column is rowSpan from first row */}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={17} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={17} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : officerMatrixRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={17} className="text-center text-xs text-gray-500 py-8">
                                                            No officer ranks configured for this vessel.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    officerMatrixRanks
                                                        .map((rank: any, index: number) => {
                                                            // Get full rank name (with suffix like _1, _2 for variant positions)
                                                            const fullRankName = rank.role || rank.rank;
                                                            // Strip suffix for fallback matching (e.g., "3rd Officer_1" -> "3rd Officer")
                                                            const baseRankName = fullRankName?.split('_')[0];
                                                            // Check if this is a variant position (has suffix like _1, _2)
                                                            const rankHasSuffix = fullRankName?.includes('_');
                                                            
                                                            // OFFICER MATRIX: Show only PRIMARY crew (filter out secondary)
                                                            // For variant positions, use EXACT rank name matching only
                                                            const rankPlanningData = vesselPlanning.find((p: any) => {
                                                                if (p.crewStatus !== 'primary') return false;
                                                                
                                                                // For variant positions (with suffix), ONLY match by exact full rank name
                                                                if (rankHasSuffix) {
                                                                    return p.rank === fullRankName;
                                                                }
                                                                
                                                                // For non-variant positions, try exact name first
                                                                if (p.rank === fullRankName) return true;
                                                                // Then try rankId match
                                                                if (p.rankId === rank.id || p.rankId === rank.rankId) return true;
                                                                // Fallback to base name only if planning record has no suffix
                                                                const planningBaseRank = p.rank?.split('_')[0];
                                                                const planningHasSuffix = p.rank?.includes('_');
                                                                if (!planningHasSuffix && planningBaseRank === baseRankName) return true;
                                                                return false;
                                                            });
                                                            
                                                            // Get crew member's license data for COC display
                                                            const crewMemberId = rankPlanningData?.crewMemberId;
                                                            const crewMemberData = crewMemberId ? crewMemberLookup.get(crewMemberId) : null;
                                                            // Parse licenses - it may be stored as JSON string
                                                            let licenses: LicenseRecord[] = [];
                                                            if (crewMemberData?.licenses) {
                                                                try {
                                                                    licenses = typeof crewMemberData.licenses === 'string' 
                                                                        ? JSON.parse(crewMemberData.licenses) 
                                                                        : crewMemberData.licenses;
                                                                } catch (e) {
                                                                    licenses = [];
                                                                }
                                                            }
                                                            // Infer department from the rank to prioritize matching COC
                                                            const rankDepartment = inferDepartmentFromRank(fullRankName);
                                                            const highestCoc = findHighestActiveCoc(licenses, rankDepartment);
                                                            
                                                            // Calculate company years from currentCompanySeaService
                                                            let companyYears = 0;
                                                            if (crewMemberData?.currentCompanySeaService) {
                                                                try {
                                                                    const companySeaService = typeof crewMemberData.currentCompanySeaService === 'string' 
                                                                        ? JSON.parse(crewMemberData.currentCompanySeaService) 
                                                                        : crewMemberData.currentCompanySeaService;
                                                                    
                                                                    if (Array.isArray(companySeaService) && companySeaService.length > 0) {
                                                                        // Extract start dates - handle multiple key formats (from, fromDate, signOnDate)
                                                                        const fromDates = companySeaService
                                                                            .map((s: any) => s.fromDate || s.signOnDate || s.from)
                                                                            .filter((d: any) => d && typeof d === 'string' && d.trim() !== '')
                                                                            .map((d: any) => new Date(d))
                                                                            .filter((d: any) => !isNaN(d.getTime()));
                                                                        
                                                                        if (fromDates.length > 0) {
                                                                            const earliestDate = new Date(Math.min(...fromDates.map((d: any) => d.getTime())));
                                                                            const today = new Date();
                                                                            const diffMs = today.getTime() - earliestDate.getTime();
                                                                            const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
                                                                            // Ensure any positive company tenure shows at least 0.1 years
                                                                            const roundedYears = Math.round(diffYears * 10) / 10;
                                                                            companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    companyYears = 0;
                                                                }
                                                            }
                                                            
                                                            return (
                                                            <TableRow key={rank.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                                <TableCell className="text-xs text-gray-700 border-r border-gray-100" data-testid={`cell-officer-rank-${index + 1}`}>
                                                                    {rank.role || rank.rank}
                                                                </TableCell>
                                                                
                                                                {/* Rank, Name & Nationality */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-name-${index + 1}`}>
                                                                    {rankPlanningData?.crewName || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-nationality-${index + 1}`}>
                                                                    {rankPlanningData?.nationality || ''}
                                                                </TableCell>
                                                                
                                                                {/* Certification & Qualification */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-cert-comp-${index + 1}`}>
                                                                    {highestCoc?.officerMatrixLabel || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-issuing-country-${index + 1}`}>
                                                                    {highestCoc?.issuingCountry || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-admin-accept-${index + 1}`}>
                                                                    {/* Will be populated with qualification data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-tanker-${index + 1}`}>
                                                                    {/* Will be populated with qualification data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-spl-tanker-${index + 1}`}>
                                                                    {/* Will be populated with qualification data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-radio-${index + 1}`}>
                                                                    {rankDepartment === 'deck' && hasValidGmdss(licenses) ? 'Yes' : ''}
                                                                </TableCell>
                                                                
                                                                {/* Years in Service */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-company-${index + 1}`}>
                                                                    {companyYears > 0 ? companyYears : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-rank-${index + 1}`}>
                                                                    {crewMemberData?.experienceMetrics?.rank > 0 ? crewMemberData.experienceMetrics.rank : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-tanker-${index + 1}`}>
                                                                    {crewMemberData?.experienceMetrics?.vesselType?.name && crewMemberData?.experienceMetrics?.vesselType?.years > 0 ? (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <span className="cursor-help">{crewMemberData.experienceMetrics.vesselType.years.toFixed(1)}</span>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{crewMemberData.experienceMetrics.vesselType.name}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    ) : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-all-${index + 1}`}>
                                                                    {crewMemberData?.experienceMetrics?.tankers > 0 ? crewMemberData.experienceMetrics.tankers : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-dow-${index + 1}`}>
                                                                    {crewMemberData?.experienceMetrics?.oow > 0 ? crewMemberData.experienceMetrics.oow : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-time-${index + 1}`}>
                                                                    {crewMemberData?.experienceMetrics?.timeOnBoard > 0 ? crewMemberData.experienceMetrics.timeOnBoard : ''}
                                                                </TableCell>
                                                                
                                                                {/* Language */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-language-${index + 1}`}>
                                                                    {crewMemberData?.englishProficiency || ''}
                                                                </TableCell>
                                                                
                                                                {/* Actions */}
                                                                <TableCell className="text-xs" data-testid={`cell-officer-actions-${index + 1}`}>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0"
                                                                        onClick={() => {
                                                                            if (crewMemberData) {
                                                                                setSelectedCrewMember(crewMemberData);
                                                                                setIsCrewInfoFormOpen(true);
                                                                            }
                                                                        }}
                                                                        data-testid={`button-view-officer-${index + 1}`}
                                                                    >
                                                                        <Eye className="h-4 w-4 text-gray-500" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                            );
                                                        })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="planning" className="mt-0">
                            <div className="space-y-4">
                                {/* Table Container */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <ScrollArea className="h-[calc(100vh-280px)] w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    {/* Common columns */}
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3] border-r border-white/20">S.N</TableHead>
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] border-r border-white/20">Rank</TableHead>
                                                    
                                                    {/* On Board Status Section */}
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">On Board Status</TableHead>
                                                    
                                                    {/* Reliever Status Section */}
                                                    <TableHead colSpan={5} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3]">Reliever Status</TableHead>
                                                </TableRow>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    {/* On Board Status columns */}
                                                    <TableHead className="text-white text-xs font-normal sticky top-[41px] z-30 bg-[#52baf3]">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Relief Due</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">S/Off Date</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-[41px] z-30 bg-[#52baf3]">S/Off Port</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Relief Status</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-16 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40"></TableHead>
                                                    
                                                    {/* Reliever Status columns */}
                                                    <TableHead className="text-white text-xs font-normal sticky top-[41px] z-30 bg-[#52baf3]">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Sign On Date</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-[41px] z-30 bg-[#52baf3]">Sign On Port</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Sign On Status</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-16 sticky top-[41px] z-30 bg-[#52baf3]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={13} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={13} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (() => {
                                                    // Transform vessel planning data into separate rows for Primary and Secondary crew
                                                    const normalizedRows: any[] = [];
                                                    
                                                    // Filter out base ranks when variant positions exist for the same rankId
                                                    // This prevents showing duplicate rows (e.g., "3rd Officer" + "3rd Officer_1" + "3rd Officer_2")
                                                    const filteredVesselRanks = vesselRanks.filter((rank: any) => {
                                                        const fullRankName = rank.role || rank.rank;
                                                        const hasVariantSuffix = fullRankName?.includes('_');
                                                        
                                                        // Keep variant positions (they have suffix like _1, _2)
                                                        if (hasVariantSuffix) return true;
                                                        
                                                        // For base ranks, check if any variant positions exist with the same rankId
                                                        const hasVariants = vesselRanks.some((other: any) => {
                                                            const otherName = other.role || other.rank;
                                                            return other.rankId === rank.rankId && otherName?.includes('_');
                                                        });
                                                        
                                                        // Exclude base rank if variants exist
                                                        return !hasVariants;
                                                    });
                                                    
                                                    filteredVesselRanks.forEach((rank: any, rankIndex: number) => {
                                                        // Get full rank name (with suffix like _1, _2 for variant positions)
                                                        const fullRankName = rank.role || rank.rank;
                                                        // Strip suffix for fallback matching (e.g., "3rd Officer_1" -> "3rd Officer")
                                                        const baseRankName = fullRankName?.split('_')[0];
                                                        
                                                        // Find all matching planning records for this rank (exclude archived)
                                                        // For variant positions (with suffix like _1, _2), use EXACT rank name matching only
                                                        // This prevents cross-contamination where both 3rd Officer_1 and 3rd Officer_2 share rankId S4
                                                        const rankHasSuffix = fullRankName?.includes('_');
                                                        
                                                        const matchingRecords = vesselPlanning.filter((p: any) => {
                                                            if (p.isArchived) return false;
                                                            
                                                            // For variant positions (with suffix), ONLY match by exact full rank name
                                                            // This is critical because variant positions share the same rankId
                                                            if (rankHasSuffix) {
                                                                return p.rank === fullRankName;
                                                            }
                                                            
                                                            // For non-variant positions, use the original matching logic
                                                            // First try exact full rank name match
                                                            if (p.rank === fullRankName) return true;
                                                            
                                                            // Then try rankId match (for non-variant positions this is safe)
                                                            if (p.rankId === rank.id || p.rankId === rank.rankId) return true;
                                                            
                                                            // Fallback: match by base name only if planning record also has no suffix
                                                            const planningBaseRank = p.rank?.split('_')[0];
                                                            const planningHasSuffix = p.rank?.includes('_');
                                                            if (!planningHasSuffix && planningBaseRank === baseRankName) return true;
                                                            
                                                            return false;
                                                        });
                                                        
                                                        // Separate primary and secondary crew by crew_status
                                                        const primaryCrew = matchingRecords.find((p: any) => p.crewStatus === 'primary');
                                                        const secondaryCrew = matchingRecords.find((p: any) => p.crewStatus === 'secondary');
                                                        
                                                        // Flag to indicate both crew types exist (for showing P/S badges)
                                                        const hasBothCrewTypes = !!(primaryCrew && secondaryCrew);
                                                        
                                                        // If both primary and secondary exist, create two separate rows
                                                        if (primaryCrew && secondaryCrew) {
                                                            normalizedRows.push({
                                                                serialNumber: rankIndex + 1,
                                                                rank,
                                                                rankName: baseRankName,
                                                                crewStatus: 'primary',
                                                                planningData: primaryCrew,
                                                                hasBothCrewTypes
                                                            });
                                                            normalizedRows.push({
                                                                serialNumber: rankIndex + 1,
                                                                rank,
                                                                rankName: baseRankName,
                                                                crewStatus: 'secondary',
                                                                planningData: secondaryCrew,
                                                                hasBothCrewTypes
                                                            });
                                                        } else if (primaryCrew) {
                                                            // Only primary crew exists - no badge needed
                                                            normalizedRows.push({
                                                                serialNumber: rankIndex + 1,
                                                                rank,
                                                                rankName: baseRankName,
                                                                crewStatus: 'primary',
                                                                planningData: primaryCrew,
                                                                hasBothCrewTypes: false
                                                            });
                                                        } else if (secondaryCrew) {
                                                            // Only secondary crew exists (edge case) - no badge needed
                                                            normalizedRows.push({
                                                                serialNumber: rankIndex + 1,
                                                                rank,
                                                                rankName: baseRankName,
                                                                crewStatus: 'secondary',
                                                                planningData: secondaryCrew,
                                                                hasBothCrewTypes: false
                                                            });
                                                        } else {
                                                            // No crew assigned to this rank - create empty primary row, no badge
                                                            normalizedRows.push({
                                                                serialNumber: rankIndex + 1,
                                                                rank,
                                                                rankName: baseRankName,
                                                                crewStatus: 'primary',
                                                                planningData: matchingRecords[0] || null,
                                                                hasBothCrewTypes: false
                                                            });
                                                        }
                                                    });
                                                    
                                                    return normalizedRows.map((row, rowIndex) => {
                                                        const { serialNumber, rank, rankName, crewStatus, planningData, hasBothCrewTypes } = row;
                                                        // Only show (P)/(S) badges when BOTH primary and secondary exist for the same rank
                                                        const statusBadge = hasBothCrewTypes ? (crewStatus === 'primary' ? ' (P)' : ' (S)') : '';
                                                        const displayRank = (rank.role || rank.rank) + statusBadge;
                                                        
                                                        // Show blank instead of "undefined" for vacant positions
                                                        const crewName = planningData?.crewMemberId ? (planningData.crewName || '') : '';
                                                        
                                                        return (
                                                            <TableRow key={`${rank.id}-${crewStatus}-${rowIndex}`} className="hover:bg-gray-50 border-b border-gray-100">
                                                                <TableCell className="text-xs text-gray-700 border-r border-gray-100" data-testid={`cell-planning-sno-${rowIndex + 1}`}>
                                                                    {serialNumber}.
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r border-gray-100" data-testid={`cell-planning-rank-${rowIndex + 1}`}>
                                                                    {displayRank}
                                                                </TableCell>
                                                                
                                                                {/* On Board Status cells */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-onboard-name-${rowIndex + 1}`}>
                                                                    {crewName}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-relief-due-${rowIndex + 1}`}>
                                                                    {formatDateOnly(planningData?.reliefDue || planningData?.reliefDate)}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-soff-date-${rowIndex + 1}`}>
                                                                    {formatDateOnly(planningData?.signOffDate)}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-soff-port-${rowIndex + 1}`}>
                                                                    {planningData?.signOffPort || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-relief-status-${rowIndex + 1}`}>
                                                                    {planningData?.reliefStatus || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs border-r-2 border-gray-200" data-testid={`cell-planning-onboard-edit-${rowIndex + 1}`}>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        data-testid={`button-edit-onboard-${rowIndex + 1}`}
                                                                        onClick={() => {
                                                                            setSelectedRankForOnBoard({
                                                                                rank: rank.rank || rank.role,
                                                                                rankId: rank.rankId || rank.id,
                                                                                planningData: planningData
                                                                            });
                                                                            setOnBoardDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-4 w-4 text-gray-500" />
                                                                    </Button>
                                                                </TableCell>
                                                                
                                                                {/* Reliever Status cells - only show if there's a reliever */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-reliever-name-${rowIndex + 1}`}>
                                                                    {planningData?.relieverCrewId ? (planningData?.relieverCrewName || '') : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-date-${rowIndex + 1}`}>
                                                                    {planningData?.relieverCrewId ? formatDateOnly(planningData?.joiningDate) : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-port-${rowIndex + 1}`}>
                                                                    {planningData?.relieverCrewId ? (planningData?.joiningPort || '') : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-status-${rowIndex + 1}`}>
                                                                    {planningData?.relieverCrewId ? (planningData?.joiningStatus || '') : ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs" data-testid={`cell-planning-reliever-edit-${rowIndex + 1}`}>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        data-testid={`button-edit-reliever-${rowIndex + 1}`}
                                                                        onClick={() => {
                                                                            setSelectedRankForRelief({
                                                                                rank: rank.role || rank.rank,
                                                                                rankId: rank.rankId || rank.id,
                                                                                planningData: planningData
                                                                            });
                                                                            setReliefDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-4 w-4 text-gray-500" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Relief Status Edit Dialog */}
                {selectedRankForRelief && (
                    <ReliefStatusEditDialog
                        open={reliefDialogOpen}
                        onOpenChange={setReliefDialogOpen}
                        rank={selectedRankForRelief.rank}
                        vesselId={selectedVessel?.vesselId || ''}
                        rankId={selectedRankForRelief.rankId}
                        planningData={selectedRankForRelief.planningData}
                    />
                )}

                {/* On Board Status Edit Dialog */}
                {selectedRankForOnBoard && (
                    <OnBoardStatusEditDialog
                        open={onBoardDialogOpen}
                        onOpenChange={setOnBoardDialogOpen}
                        rank={selectedRankForOnBoard.rank}
                        vesselId={selectedVessel?.vesselId || ''}
                        rankId={selectedRankForOnBoard.rankId}
                        planningData={selectedRankForOnBoard.planningData}
                    />
                )}
            </div>
        );
    };

    const renderVesselDatabase = () => {
        return (
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Vessel Database">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                            data-testid="button-toggle-filters"
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                        </Button>
                    </div>
                </SectionTitleComponents>

                {showFilters && (
                    <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg">
                        <RadioGroup 
                            value={filterType} 
                            onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                            className="flex items-center gap-6"
                        >
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="vessel" 
                                    id="filter-vessel"
                                    className="h-4 w-4"
                                    data-testid="radio-vessel"
                                />
                                <Label 
                                    htmlFor="filter-vessel" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Vessel
                                </Label>
                                <Select value={vesselValue} onValueChange={setVesselValue}>
                                    <SelectTrigger 
                                        className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                        data-testid="select-vessel-value"
                                        disabled={vesselsLoading}
                                    >
                                        <SelectValue placeholder={vesselsLoading ? "Loading..." : "Vessel"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vessels.map((vessel: any) => (
                                            <SelectItem key={vessel.id} value={vessel.name}>
                                                {vessel.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="fleet" 
                                    id="filter-fleet"
                                    className="h-4 w-4"
                                    data-testid="radio-fleet"
                                />
                                <Label 
                                    htmlFor="filter-fleet" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Fleet
                                </Label>
                                <Select value={fleetValue} onValueChange={setFleetValue}>
                                    <SelectTrigger 
                                        className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                        data-testid="select-fleet-value"
                                    >
                                        <SelectValue placeholder="Fleet" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                        <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                        <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="addGroup" 
                                    id="filter-addgroup"
                                    className="h-4 w-4"
                                    data-testid="radio-addgroup"
                                />
                                <Label 
                                    htmlFor="filter-addgroup" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Add Group
                                </Label>
                                <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                                    <SelectTrigger 
                                        className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                        data-testid="select-addgroup-value"
                                    >
                                        <SelectValue placeholder="Add Group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="group1">Additional Group 1</SelectItem>
                                        <SelectItem value="group2">Additional Group 2</SelectItem>
                                        <SelectItem value="group3">Additional Group 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </RadioGroup>

                        <Button
                            variant="outline"
                            onClick={handleClearFilters}
                            className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                            data-testid="button-clear-filters"
                        >
                            Clear
                        </Button>
                    </div>
                )}

                <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
                    <CardContent className="p-4 pl-0 bg-[#f7fafc]">
                        <AgGridTable
                            rowData={vesselData}
                            columnDefs={columnDefs}
                            onGridReady={onGridReady}
                            context={{ handleEditVessel }}
                            loading={vesselsLoading || crewLoading}
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
                        />
                    </CardContent>
                </Card>
            </div>
        );
    };

    return (
        <>
            <VesselSideBar 
                selectedVesselPage={selectedVesselPage} 
                setSelectedVesselPage={setSelectedVesselPage} 
                allowedPages={allowedPages} 
            />
            <MainLayout hasSidebar={true}>
                {selectedVessel ? (
                    renderVesselDetail()
                ) : (
                    selectedVesselPage === "vessel-database" && renderVesselDatabase()
                )}
            </MainLayout>
            
            {/* Compliance Matrix Dialog */}
            <ComplianceMatrixDialog
                open={complianceDialogOpen}
                onOpenChange={setComplianceDialogOpen}
                vesselId={selectedVessel?.vesselId}
            />

            {showAppraisalForm && selectedCrewForAppraisal && (
                <AppraisalForm
                    crewMember={selectedCrewForAppraisal}
                    appraisalId={selectedCrewForAppraisal._appraisalId}
                    initialStatus={selectedCrewForAppraisal._initialStatus as 'draft' | 'preliminary' | 'submitted' | 'reviewed' | undefined}
                    onClose={handleCloseAppraisalForm}
                />
            )}

            {/* Crew Info Form */}
            <CrewInfoForm
                isOpen={isCrewInfoFormOpen}
                onClose={() => {
                    setIsCrewInfoFormOpen(false);
                    setSelectedCrewMember(null);
                }}
                crewMember={selectedCrewMember}
            />
        </>
    );
};
