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

// Consistent message for when vessel has no rank configuration
const NO_RANKS_CONFIGURED_MESSAGE = "No positions configured for this vessel. Please configure positions in Admin > Rank Admin > Vessel.";

// Form schema for Relief Status
const reliefStatusFormSchema = z.object({
    relieverCrewName: z.string().optional(),
    relieverNationality: z.string().optional(),
    joiningStatus: z.string().optional(),
    contractPeriodMonths: z.coerce.number().optional(),
    contractEndRangeStartMonths: z.coerce.number().optional(),
    contractEndRangeEndMonths: z.coerce.number().optional(),
    joiningDate: z.string().optional(),
    joiningPort: z.string().optional(),
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
    
    const form = useForm<ReliefStatusFormData>({
        resolver: zodResolver(reliefStatusFormSchema),
        defaultValues: {
            relieverCrewName: '',
            relieverNationality: '',
            joiningStatus: '',
            contractPeriodMonths: undefined,
            contractEndRangeStartMonths: undefined,
            contractEndRangeEndMonths: undefined,
            joiningDate: '',
            joiningPort: '',
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
                joiningStatus: planningData.joiningStatus || '',
                contractPeriodMonths: planningData.contractPeriodMonths,
                contractEndRangeStartMonths: planningData.contractEndRangeStartMonths,
                contractEndRangeEndMonths: planningData.contractEndRangeEndMonths,
                joiningDate: formatDateOnly(planningData.joiningDate) || '',
                joiningPort: planningData.joiningPort || '',
                deploymentChecklistCompleted: planningData.deploymentChecklistCompleted || false,
                applicableDocsChecked: planningData.applicableDocsChecked || false,
            });
        } else if (open && !planningData) {
            // Reset to empty form for new entry
            form.reset({
                relieverCrewName: '',
                relieverNationality: '',
                joiningStatus: '',
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                joiningDate: '',
                joiningPort: '',
                deploymentChecklistCompleted: false,
                applicableDocsChecked: false,
            });
        }
    }, [open, planningData, form]);

    const updatePlanningMutation = useMutation({
        mutationFn: async (data: ReliefStatusFormData) => {
            // Check if reliever is signing on (joiningStatus = "Signed On")
            const isSigningOn = data.joiningStatus === "Signed On";
            
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
                    const promoteToPrimaryPayload = {
                        ...cleanDataForPromote,
                        crewMemberId: planningData.relieverCrewId,
                        crewStatus: "primary",
                        signOnDate: data.joiningDate || planningData.joiningDate,
                        joiningPort: data.joiningPort || planningData.joiningPort,
                        contractPeriodMonths: data.contractPeriodMonths || planningData.contractPeriodMonths,
                        contractEndRangeStartMonths: data.contractEndRangeStartMonths || planningData.contractEndRangeStartMonths,
                        contractEndRangeEndMonths: data.contractEndRangeEndMonths || planningData.contractEndRangeEndMonths,
                        // Clear reliever fields
                        relieverCrewId: null,
                        relieverCrewName: null,
                        relieverNationality: null,
                        joiningDate: null,
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
                const secondaryCrewPayload = {
                    vesselId,
                    rankId,
                    rank,
                    crewMemberId: planningData.relieverCrewId,
                    crewStatus: "secondary",
                    signOnDate: data.joiningDate || planningData.joiningDate,
                    joiningPort: data.joiningPort || planningData.joiningPort,
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
                    joiningDate: null,
                    joiningPort: null,
                    joiningStatus: null,
                    contractPeriodMonths: null,
                    contractEndRangeStartMonths: null,
                    contractEndRangeEndMonths: null,
                    deploymentChecklistCompleted: false,
                    applicableDocsChecked: false,
                };
                
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, clearRelieverPayload);
            } else {
                // Normal update flow
                // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                const { createdAt, updatedAt, ...cleanPlanningData } = planningData || {};
                const payload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningData,
                    ...data,
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

    const handleSave = () => {
        const data = form.getValues();
        
        // Validate: If no reliever crew name is assigned, clear all reliever fields before saving
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            // If user tried to save other fields without a crew member, show warning
            const hasOtherData = data.joiningStatus || data.joiningPort || data.joiningDate || 
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
                joiningStatus: undefined,
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                joiningDate: undefined,
                joiningPort: undefined,
                deploymentChecklistCompleted: undefined,
                applicableDocsChecked: undefined,
            };
            
            updatePlanningMutation.mutate(clearedData);
        } else {
            updatePlanningMutation.mutate(data);
        }
    };

    const handleSubmit = form.handleSubmit((data) => {
        // Same validation as handleSave - prevent saving reliever fields without crew member
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            const hasOtherData = data.joiningStatus || data.joiningPort || data.joiningDate || 
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
                joiningStatus: undefined,
                contractPeriodMonths: undefined,
                contractEndRangeStartMonths: undefined,
                contractEndRangeEndMonths: undefined,
                joiningDate: undefined,
                joiningPort: undefined,
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

                        {/* Joining Status */}
                        <FormField
                            control={form.control}
                            name="joiningStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Joining Status:</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value || undefined} 
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

                        {/* Joining Date */}
                        <FormField
                            control={form.control}
                            name="joiningDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Joining Date:</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field} 
                                                type="text" 
                                                placeholder="DD-MMM-YYYY" 
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-joining-date"
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Joining Port */}
                        <FormField
                            control={form.control}
                            name="joiningPort"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Joining Port:</FormLabel>
                                        <FormControl>
                                            <Select 
                                                onValueChange={field.onChange} 
                                                value={field.value || undefined} 
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
                                type="button" 
                                onClick={handleSave}
                                className="bg-[#1e40af] hover:bg-[#1e40af]/90"
                                disabled={updatePlanningMutation.isPending}
                                data-testid="button-save-relief"
                            >
                                Save
                            </Button>
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

// Form schema for On Board Status
const onBoardStatusFormSchema = z.object({
    onBoardCrewName: z.string().optional(),
    onBoardCrewNationality: z.string().optional(),
    signOnDate: z.string().optional(),
    joiningPort: z.string().optional(),
    reliefDue: z.string().optional(),
    signOffDate: z.string().optional(),
    signOffPort: z.string().optional(),
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

    const updatePlanningMutation = useMutation({
        mutationFn: async (data: OnBoardStatusFormData) => {
            // Check if this is a takeover (takeOverConfirmation checked AND takeOverDate set)
            const isTakeover = data.takeOverConfirmation && data.takeOverDate;
            
            // Check if this is a sign-off (Relief Status = "Signed Off" AND Sign Off Date is set)
            const isSignOff = data.reliefStatus === "Signed Off" && data.signOffDate;
            
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
                const primaryCrew = allPlanning.find((p: any) => 
                    p.rankId === rankId && p.crewStatus === "primary"
                );
                
                // Step 2: If primary exists, demote them to secondary and set handover date
                if (primaryCrew) {
                    await apiRequest('PATCH', `/api/vessel-planning/${primaryCrew.id}`, {
                        crewStatus: "secondary",
                        handOverDate: data.takeOverDate, // Auto-fill handover date
                    });
                }
                
                // Step 3: Promote current secondary to primary
                // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                const { createdAt: _1, updatedAt: _2, ...cleanPlanningDataForTakeover } = planningData || {};
                const promotePayload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningDataForTakeover,
                    ...dataWithReliefDue,
                    crewStatus: "primary", // Change from secondary to primary
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
                
                // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                const { createdAt: _1, updatedAt: _2, ...cleanPlanningData } = planningData || {};
                const archivePayload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningData,
                    ...dataWithReliefDue,
                    isArchived: true,
                    archivedDate: data.signOffDate, // Use sign-off date as archive date
                };
                
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, archivePayload);
            } else {
                // Normal update flow
                // Exclude timestamp fields (createdAt, updatedAt) to avoid Date object errors
                const { createdAt, updatedAt, ...cleanPlanningData } = planningData || {};
                const payload = {
                    vesselId,
                    rankId,
                    rank,
                    ...cleanPlanningData,
                    ...dataWithReliefDue,
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

                        {/* 3. Joining Date (S/On) - Display only (read-only) */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Joining Date (S/On):</span>
                            <div className="flex items-center border rounded-md px-3 py-2 bg-gray-50">
                                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{planningData?.signOnDate ? formatDisplayDate(planningData.signOnDate) : '-'}</span>
                            </div>
                        </div>

                        {/* 3.5 Joining Port - Display only (read-only) */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Joining Port:</span>
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
                                type="button" 
                                onClick={handleSave}
                                className="bg-[#1e40af] hover:bg-[#1e40af]/90"
                                disabled={updatePlanningMutation.isPending}
                                data-testid="button-save-onboard"
                            >
                                Save
                            </Button>
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

    const gridApiRef = useRef<GridApi | null>(null);

    // Fetch vessels and crew members
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: crewMembers = [], isLoading: crewLoading } = useCrewMembers();
    
    // Fetch available ranks to get sortOrder
    const { data: availableRanks = [] } = useQuery<any[]>({
        queryKey: ['/api/available-ranks'],
    });

    // Create a map of rank name to sortOrder for sorting
    const rankOrderMap = useMemo(() => {
        const map = new Map<string, number>();
        availableRanks.forEach((rank: any) => {
            map.set(rank.name, rank.sortOrder || 0);
        });
        return map;
    }, [availableRanks]);
    
    // Fetch vessel ranks for selected vessel (use vessel ID, e.g., VSL-003)
    const { data: vesselRanksRaw = [], isLoading: ranksLoading } = useVesselRanks(selectedVessel?.vesselId || null);
    
    // Sort vessel ranks according to Rank Admin order
    const vesselRanks = useMemo(() => {
        if (!vesselRanksRaw || !Array.isArray(vesselRanksRaw)) return [];
        return [...vesselRanksRaw].sort((a: any, b: any) => {
            const orderA = rankOrderMap.get(a.rank) ?? 999999;
            const orderB = rankOrderMap.get(b.rank) ?? 999999;
            return orderA - orderB;
        });
    }, [vesselRanksRaw, rankOrderMap]);
    
    // Fetch vessel planning for selected vessel (use vessel ID, e.g., VSL-003)
    const { data: vesselPlanning = [], isLoading: planningLoading } = useVesselPlanning(selectedVessel?.vesselId || null);
    
    // Fetch all appraisals to determine button state
    const { data: allAppraisals = [] } = useAppraisals();

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
            cellClass: 'flex items-center justify-center',
            pinned: 'right',
            lockPosition: true
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
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3]">Joined</TableHead>
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
                                                            <TableHead className="text-white text-xs font-normal w-40 sticky top-0 z-30 bg-[#52baf3]">Vacc. Expiring (2m)/Expired</TableHead>
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
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : planningLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            Loading crew members...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (() => {
                                                    // Use vessel planning data and sort by rank order
                                                    // Filter based on showArchived: when false, exclude archived; when true, show only archived
                                                    const vesselCrew = vesselPlanning
                                                        .filter((planning: any) => {
                                                            if (!planning.crewMemberId) return false;
                                                            const isArchived = planning.isArchived === true;
                                                            return showArchived ? isArchived : !isArchived;
                                                        })
                                                        .sort((a: any, b: any) => {
                                                            // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
                                                            const aRankBase = a.rank?.split('_')[0] || a.rank;
                                                            const bRankBase = b.rank?.split('_')[0] || b.rank;
                                                            const aOrder = rankOrderMap.get(aRankBase) ?? 999999;
                                                            const bOrder = rankOrderMap.get(bRankBase) ?? 999999;
                                                            return aOrder - bOrder;
                                                        });
                                                    
                                                    if (vesselCrew.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={showArchived ? 8 : 15} className="text-center text-xs text-gray-500 py-8">
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
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-docexp-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-medical-${index + 1}`}>
                                                                        
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700" data-testid={`cell-vaccexp-${index + 1}`}>
                                                                        
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
                                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                                        <div className="w-20 h-5 bg-gray-100 border border-gray-300 flex items-center justify-center">
                                            Mandatory
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-5 bg-blue-50 border border-gray-300 flex items-center justify-center">
                                            Recommended
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-green-500"></div>
                                        <span>Valid</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                                        <span>Expiring in 2 months</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-red-500"></div>
                                        <span>Expired</span>
                                    </div>
                                </div>

                                {/* Training Matrix Table */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="overflow-auto h-[calc(100vh-300px)] w-full relative">
                                        <Table className="min-w-max relative">
                                                <TableHeader>
                                                    <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                        <TableHead className="text-white text-xs font-normal w-16 sticky left-0 z-40 bg-[#52baf3] border-r border-white/20">
                                                            S.No.
                                                        </TableHead>
                                                        <TableHead className="text-white text-xs font-normal w-96 sticky left-16 z-40 bg-[#52baf3] border-r border-white/20">
                                                            List of courses/ Certificate
                                                        </TableHead>
                                                    {vesselRanks.length > 0 ? (
                                                        vesselRanks.map((rank: any, index: number) => (
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
                                                        <TableCell colSpan={2 + vesselRanks.length} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    <>
                                                        {/* Category A: LICENSES & DOC */}
                                                        <TableRow className="bg-blue-100 hover:bg-blue-100">
                                                            <TableCell colSpan={2 + vesselRanks.length} className="text-xs font-semibold text-gray-900 sticky left-0 z-20 bg-blue-100">
                                                                A - LICENSES & DOC
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow className="hover:bg-gray-50">
                                                            <TableCell className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200" data-testid="cell-row-01">01</TableCell>
                                                            <TableCell className="text-xs text-gray-700 sticky left-16 z-20 bg-white border-r border-gray-200" data-testid="cell-license-national">National License</TableCell>
                                                            {vesselRanks.map((rank: any, index: number) => (
                                                                <TableCell 
                                                                    key={rank.id || index}
                                                                    className={`text-xs text-center ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                                    data-testid={`cell-national-license-${index}`}
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                                    </div>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                        <TableRow className="hover:bg-gray-50">
                                                            <TableCell className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200" data-testid="cell-row-02">02</TableCell>
                                                            <TableCell className="text-xs text-gray-700 sticky left-16 z-20 bg-white border-r border-gray-200" data-testid="cell-license-gmdss">GMDSS GOC Licence</TableCell>
                                                            {vesselRanks.map((rank: any, index: number) => (
                                                                <TableCell 
                                                                    key={rank.id || index}
                                                                    className={`text-xs text-center ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                                    data-testid={`cell-gmdss-license-${index}`}
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        {index < 2 ? (
                                                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                                        ) : index < 4 ? (
                                                                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                                                        ) : (
                                                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>

                                                        {/* Category B: STATUTORY COURSES */}
                                                        <TableRow className="bg-blue-100 hover:bg-blue-100">
                                                            <TableCell colSpan={2 + vesselRanks.length} className="text-xs font-semibold text-gray-900 sticky left-0 z-20 bg-blue-100">
                                                                B - STATUTORY COURSES
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow className="hover:bg-gray-50">
                                                            <TableCell className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200" data-testid="cell-row-01-b">01</TableCell>
                                                            <TableCell className="text-xs text-gray-700 sticky left-16 z-20 bg-white border-r border-gray-200" data-testid="cell-course-fire">Basic Fire Fighting</TableCell>
                                                            {vesselRanks.map((rank: any, index: number) => (
                                                                <TableCell 
                                                                    key={rank.id || index}
                                                                    className={`text-xs text-center ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                                    data-testid={`cell-fire-fighting-${index}`}
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                                    </div>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                        <TableRow className="hover:bg-gray-50">
                                                            <TableCell className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200" data-testid="cell-row-02-b">02</TableCell>
                                                            <TableCell className="text-xs text-gray-700 sticky left-16 z-20 bg-white border-r border-gray-200" data-testid="cell-course-survival">Personal Survival Technique</TableCell>
                                                            {vesselRanks.map((rank: any, index: number) => (
                                                                <TableCell 
                                                                    key={rank.id || index}
                                                                    className={`text-xs text-center ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                                                    data-testid={`cell-survival-${index}`}
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                                    </div>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>

                                                        {/* Category C: VALUE ADD COURSE */}
                                                        <TableRow className="bg-blue-100 hover:bg-blue-100">
                                                            <TableCell colSpan={2 + vesselRanks.length} className="text-xs font-semibold text-gray-900 sticky left-0 z-20 bg-blue-100">
                                                                C - VALUE ADD COURSE
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow className="hover:bg-gray-50">
                                                            <TableCell className="text-xs text-gray-700 sticky left-0 z-20 bg-white border-r border-gray-200" data-testid="cell-row-01-c">01</TableCell>
                                                            <TableCell className="text-xs text-gray-700 sticky left-16 z-20 bg-white border-r border-gray-200" data-testid="cell-course-risk">Risk Assessment</TableCell>
                                                            {vesselRanks.map((rank: any, index: number) => (
                                                                <TableCell 
                                                                    key={rank.id || index}
                                                                    className={`text-xs text-center ${index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}`}
                                                                    data-testid={`cell-risk-assessment-${index}`}
                                                                >
                                                                    <div className="flex items-center justify-center">
                                                                        {index < 3 ? (
                                                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                                        ) : (
                                                                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    </>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
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
                                                    <TableHead colSpan={5} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Years in Service (Today's Date)</TableHead>
                                                    
                                                    {/* Language Section */}
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal text-center w-24 sticky top-0 z-30 bg-[#52baf3]">Language</TableHead>
                                                    
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
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Spl. Tanker (T, I, P, Z)</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Radio Qual.</TableHead>
                                                    
                                                    {/* Years in Service columns */}
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">Rank</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker Type</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">All Types</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">DOW</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Time o/a</TableHead>
                                                    
                                                    {/* Language column is rowSpan from first row */}
                                                    {/* Actions column is rowSpan from first row */}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={16} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={16} className="text-center text-xs text-gray-500 py-8">
                                                            {NO_RANKS_CONFIGURED_MESSAGE}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.filter((r: any) => r.officer === true).length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={16} className="text-center text-xs text-gray-500 py-8">
                                                            No officer ranks configured for this vessel.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    vesselRanks
                                                        .filter((rank: any) => rank.officer === true)
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
                                                                    {/* Will be populated with qualification data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-issuing-country-${index + 1}`}>
                                                                    {/* Will be populated with qualification data */}
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
                                                                    {/* Will be populated with qualification data */}
                                                                </TableCell>
                                                                
                                                                {/* Years in Service */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-rank-${index + 1}`}>
                                                                    {/* Will be populated with experience data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-tanker-${index + 1}`}>
                                                                    {/* Will be populated with experience data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-years-all-${index + 1}`}>
                                                                    {/* Will be populated with experience data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-dow-${index + 1}`}>
                                                                    {/* Will be populated with experience data */}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-time-${index + 1}`}>
                                                                    {/* Will be populated with experience data */}
                                                                </TableCell>
                                                                
                                                                {/* Language */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-language-${index + 1}`}>
                                                                    {/* Will be populated with language proficiency */}
                                                                </TableCell>
                                                                
                                                                {/* Actions */}
                                                                <TableCell className="text-xs" data-testid={`cell-officer-actions-${index + 1}`}>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Joining Date</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-[41px] z-30 bg-[#52baf3]">Joining Port</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Joining Status</TableHead>
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
                                                    
                                                    vesselRanks.forEach((rank: any, rankIndex: number) => {
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
            <MainLayout>
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
            />

            {showAppraisalForm && selectedCrewForAppraisal && (
                <AppraisalForm
                    crewMember={selectedCrewForAppraisal}
                    appraisalId={selectedCrewForAppraisal._appraisalId}
                    initialStatus={selectedCrewForAppraisal._initialStatus as 'draft' | 'preliminary' | 'submitted' | 'reviewed' | undefined}
                    onClose={handleCloseAppraisalForm}
                />
            )}
        </>
    );
};
