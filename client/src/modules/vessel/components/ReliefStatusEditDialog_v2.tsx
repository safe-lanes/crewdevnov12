import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdatePlanningV2, useCreatePlanningV2 } from '../hooks/useVesselV2';
import { vesselApiV2 } from '../api/vesselApiV2';
import { SearchablePortCombobox } from "@/components/ui/SearchablePortCombobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const reliefStatusFormSchema = z.object({
    relieverCrewName: z.string().optional(),
    relieverNationality: z.string().optional(),
    signOnStatus: z.string().optional(),
    relieverContractPeriodMonths: z.coerce.number().positive("Contract Period must be greater than 0").optional(),
    relieverContractEndRangeStartMonths: z.coerce.number().positive("Contract End - Range Start must be greater than 0").optional(),
    relieverContractEndRangeEndMonths: z.coerce.number().positive("Contract End - Range End must be greater than 0").optional(),
    relieverSignOnDate: z.string().optional(),
    relieverSignOnPort: z.string().optional(),
    deploymentChecklistCompleted: z.boolean().optional(),
    applicableDocsChecked: z.boolean().optional(),
});

type ReliefStatusFormData = z.infer<typeof reliefStatusFormSchema>;

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

const parseDateString = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    try {
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(dateStr);
        }
        const monthNames: { [key: string]: string } = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        const parts = dateStr.split('-');
        if (parts.length === 3 && monthNames[parts[1]]) {
            return new Date(`${parts[2]}-${monthNames[parts[1]]}-${parts[0]}`);
        }
        return new Date(dateStr);
    } catch {
        return undefined;
    }
};

interface ReliefStatusEditDialogV2Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rank: string;
    vesselUuid: string;
    rankId: string;
    planningData?: any;
}

export const ReliefStatusEditDialog_v2: React.FC<ReliefStatusEditDialogV2Props> = ({
    open,
    onOpenChange,
    rank,
    vesselUuid,
    rankId,
    planningData
}) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [joiningDateOpen, setJoiningDateOpen] = useState(false);
    const [unassignChecked, setUnassignChecked] = useState(false);
    const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
    const [showSignOnConflict, setShowSignOnConflict] = useState(false);
    const [conflictVesselName, setConflictVesselName] = useState('');
    const [isCheckingConflict, setIsCheckingConflict] = useState(false);
    
    const updatePlanningV2 = useUpdatePlanningV2();
    const createPlanningV2 = useCreatePlanningV2();
    
    const form = useForm<ReliefStatusFormData>({
        resolver: zodResolver(reliefStatusFormSchema),
        defaultValues: {
            relieverCrewName: '',
            relieverNationality: '',
            signOnStatus: '',
            relieverContractPeriodMonths: undefined,
            relieverContractEndRangeStartMonths: undefined,
            relieverContractEndRangeEndMonths: undefined,
            relieverSignOnDate: '',
            relieverSignOnPort: '',
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
        }
    });

    React.useEffect(() => {
        if (open && planningData) {
            form.reset({
                relieverCrewName: planningData.relieverCrewName || '',
                relieverNationality: planningData.relieverNationality || '',
                signOnStatus: planningData.joiningStatus || '',
                relieverContractPeriodMonths: planningData.relieverContractPeriodMonths ?? planningData.contractPeriodMonths,
                relieverContractEndRangeStartMonths: planningData.relieverContractEndRangeStartMonths ?? planningData.contractEndRangeStartMonths,
                relieverContractEndRangeEndMonths: planningData.relieverContractEndRangeEndMonths ?? planningData.contractEndRangeEndMonths,
                relieverSignOnDate: planningData.relieverSignOnDate || planningData.joiningDate || '',
                relieverSignOnPort: planningData.relieverSignOnPort || planningData.joiningPortUuid || '',
                deploymentChecklistCompleted: planningData.deploymentChecklistCompleted || false,
                applicableDocsChecked: planningData.applicableDocsChecked || false,
            });
            setUnassignChecked(false);
        } else if (open && !planningData) {
            form.reset({
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: '',
                relieverContractPeriodMonths: undefined,
                relieverContractEndRangeStartMonths: undefined,
                relieverContractEndRangeEndMonths: undefined,
                relieverSignOnDate: '',
                relieverSignOnPort: '',
                deploymentChecklistCompleted: false,
                applicableDocsChecked: false,
            });
            setUnassignChecked(false);
        }
    }, [open, planningData, form]);

    const normalizeToIsoDate = (dateStr: string | undefined): string | undefined => {
        if (!dateStr) return undefined;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
        const parsed = parseDateString(dateStr);
        if (parsed && !isNaN(parsed.getTime())) {
            return format(parsed, 'yyyy-MM-dd');
        }
        return dateStr;
    };

    const checkSignOnConflict = async (crewUuid: string): Promise<boolean> => {
        try {
            setIsCheckingConflict(true);
            const planUuid = planningData?.planUuid;
            const planUuidParam = planUuid ? `&planUuid=${encodeURIComponent(planUuid)}` : '';
            const response = await fetch(`/api/v2/vessel/planning/check-sign-on-conflict/${crewUuid}?vesselUuid=${encodeURIComponent(vesselUuid)}${planUuidParam}`);
            if (!response.ok) {
                toast({
                    title: "Validation Error",
                    description: "Unable to verify sign-on status. Please try again.",
                    variant: "destructive",
                });
                return true;
            }
            const result = await response.json();
            if (result.hasConflict) {
                setConflictVesselName(result.conflictVesselName || 'Unknown Vessel');
                setShowSignOnConflict(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking sign-on conflict:', error);
            toast({
                title: "Validation Error",
                description: "Unable to verify sign-on status. Please try again.",
                variant: "destructive",
            });
            return true;
        } finally {
            setIsCheckingConflict(false);
        }
    };

    const handleSaveV2 = async (data: ReliefStatusFormData) => {
        try {
            const isSigningOn = data.signOnStatus === "Signed On";
            
            if (isSigningOn && planningData?.relieverCrewId && planningData?.planUuid) {
                // Use the new sign-on API which properly updates crew_assignments.isCurrent
                // and moves reliever to on-board crew
                const signOnDate = data.relieverSignOnDate || planningData.relieverSignOnDate || planningData.joiningDate;
                const signOnPort = data.relieverSignOnPort || planningData.relieverSignOnPort || planningData.joiningPort;
                const contractPeriodMonths = data.relieverContractPeriodMonths ?? planningData.relieverContractPeriodMonths;
                
                await vesselApiV2.signOnReliever(planningData.planUuid, {
                    signOnDate,
                    signOnPort,
                    contractPeriodMonths,
                    contractEndRangeStartMonths: data.relieverContractEndRangeStartMonths ?? planningData.relieverContractEndRangeStartMonths,
                    contractEndRangeEndMonths: data.relieverContractEndRangeEndMonths ?? planningData.relieverContractEndRangeEndMonths,
                });
            } else {
                const payload = {
                    relieverContractPeriodMonths: data.relieverContractPeriodMonths,
                    relieverContractEndRangeStartMonths: data.relieverContractEndRangeStartMonths,
                    relieverContractEndRangeEndMonths: data.relieverContractEndRangeEndMonths,
                    deploymentChecklistCompleted: data.deploymentChecklistCompleted,
                    applicableDocsChecked: data.applicableDocsChecked,
                    joiningStatus: data.signOnStatus,
                    relieverSignOnDate: data.relieverSignOnDate,
                    joiningPortUuid: data.relieverSignOnPort,
                };
                
                if (planningData?.planUuid) {
                    await updatePlanningV2.mutateAsync({
                        planUuid: planningData.planUuid,
                        data: payload
                    });
                } else {
                    await createPlanningV2.mutateAsync({
                        vesselUuid,
                        rankId,
                        rank,
                        ...payload
                    });
                }
            }
            
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] });
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel/crew-counts'] });
            
            toast({
                title: "Success",
                description: "Relief status saved successfully",
            });
            onOpenChange(false);
        } catch (error: any) {
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
    };

    const handleUnassignV2 = async () => {
        try {
            if (!planningData?.planUuid) {
                throw new Error('No planning record ID');
            }
            
            await updatePlanningV2.mutateAsync({
                planUuid: planningData.planUuid,
                data: {
                    relieverCrewUuid: null,
                    joiningStatus: null,
                    relieverSignOnDate: null,
                    joiningPortUuid: null,
                    relieverContractPeriodMonths: null,
                    relieverContractEndRangeStartMonths: null,
                    relieverContractEndRangeEndMonths: null,
                    deploymentChecklistCompleted: null,
                    applicableDocsChecked: null,
                }
            });
            
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] });
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel/crew-counts'] });
            
            toast({
                title: "Reliever Unassigned",
                description: "The reliever has been removed from this vessel assignment.",
            });
            setUnassignChecked(false);
            setShowUnassignConfirm(false);
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to unassign reliever",
                variant: "destructive",
            });
        }
    };

    const handleSave = () => {
        const data = form.getValues();
        
        if (data.relieverSignOnDate) {
            data.relieverSignOnDate = normalizeToIsoDate(data.relieverSignOnDate);
        }
        
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            const hasOtherData = data.signOnStatus || data.relieverSignOnPort || data.relieverSignOnDate || 
                               data.relieverContractPeriodMonths || data.relieverContractEndRangeStartMonths || 
                               data.relieverContractEndRangeEndMonths;
            if (hasOtherData) {
                toast({
                    title: "Name Required",
                    description: "Please assign a crew member first before entering other reliever details.",
                    variant: "destructive",
                });
                return;
            }
            
            const clearedData: ReliefStatusFormData = {
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: undefined,
                relieverContractPeriodMonths: undefined,
                relieverContractEndRangeStartMonths: undefined,
                relieverContractEndRangeEndMonths: undefined,
                relieverSignOnDate: undefined,
                relieverSignOnPort: undefined,
                deploymentChecklistCompleted: undefined,
                applicableDocsChecked: undefined,
            };
            
            handleSaveV2(clearedData);
        } else {
            handleSaveV2(data);
        }
    };

    const handleSubmit = form.handleSubmit(async (data) => {
        if (unassignChecked) {
            setShowUnassignConfirm(true);
            return;
        }
        
        if (data.relieverSignOnDate) {
            data.relieverSignOnDate = normalizeToIsoDate(data.relieverSignOnDate);
        }
        
        if (!data.relieverCrewName || data.relieverCrewName.trim() === '') {
            const hasOtherData = data.signOnStatus || data.relieverSignOnPort || data.relieverSignOnDate || 
                               data.relieverContractPeriodMonths || data.relieverContractEndRangeStartMonths || 
                               data.relieverContractEndRangeEndMonths;
            if (hasOtherData) {
                toast({
                    title: "Name Required",
                    description: "Please assign a crew member first before entering other reliever details.",
                    variant: "destructive",
                });
                return;
            }
            
            const clearedData: ReliefStatusFormData = {
                relieverCrewName: '',
                relieverNationality: '',
                signOnStatus: undefined,
                relieverContractPeriodMonths: undefined,
                relieverContractEndRangeStartMonths: undefined,
                relieverContractEndRangeEndMonths: undefined,
                relieverSignOnDate: undefined,
                relieverSignOnPort: undefined,
                deploymentChecklistCompleted: undefined,
                applicableDocsChecked: undefined,
            };
            
            handleSaveV2(clearedData);
        } else {
            const requiresConflictCheck = data.signOnStatus === "In Transit" || data.signOnStatus === "Signed On";
            const relieverCrewUuid = planningData?.relieverCrewUuid || planningData?.relieverCrewId;
            
            if (requiresConflictCheck && relieverCrewUuid) {
                const hasConflict = await checkSignOnConflict(relieverCrewUuid);
                if (hasConflict) return;
            }
            
            handleSaveV2(data);
        }
    });
    
    const handleUnassignConfirm = () => {
        handleUnassignV2();
    };

    const relieverName = form.watch('relieverCrewName');
    const isRelieverAssigned = relieverName && relieverName.trim() !== '';

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-medium text-[#16569e] border-b border-[#16569e] pb-2">
                        Rank: {rank}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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

                        <FormField
                            control={form.control}
                            name="signOnStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
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
                                                            <SelectItem value="Planned">Planned</SelectItem>
                                                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                                                            <SelectItem value="In Transit">In Transit</SelectItem>
                                                            <SelectItem value="Signed On">Signed On</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormControl>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" align="start" className="max-w-xs">
                                            <ol className="list-decimal space-y-1 pl-4 text-xs">
                                                <li>Selecting 'Signed On' status will move the crew member from 'Reliever Status' section to 'On Board Status' section of the table.</li>
                                                <li>The reliever is added as a Secondary (S) and the one currently on board becomes Primary (P) e.g. You will see Chief Officer (P) and Chief Officer (S).</li>
                                            </ol>
                                        </TooltipContent>
                                    </Tooltip>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="relieverContractPeriodMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract Period (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                min={1}
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-reliever-contract-period"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="relieverContractEndRangeStartMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract End - Range Start (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                min={1}
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-reliever-contract-range-start"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="relieverContractEndRangeEndMonths"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Contract End - Range End (Months):</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                type="number" 
                                                min={1}
                                                className={`col-span-2 ${!isRelieverAssigned ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                data-testid="input-reliever-contract-range-end"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                disabled={!isRelieverAssigned}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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

                        <FormField
                            control={form.control}
                            name="relieverSignOnPort"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign On Port:</FormLabel>
                                        <FormControl>
                                            <SearchablePortCombobox
                                                value={field.value as string}
                                                onValueChange={field.onChange}
                                                placeholder="Search port..."
                                                disabled={!isRelieverAssigned}
                                                className="col-span-2"
                                                data-testid="select-joining-port"
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

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

                        {isRelieverAssigned && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                                <Checkbox
                                    id="unassign-reliever-checkbox"
                                    checked={unassignChecked}
                                    onCheckedChange={(checked) => setUnassignChecked(checked as boolean)}
                                    data-testid="checkbox-unassign-reliever"
                                />
                                <label
                                    htmlFor="unassign-reliever-checkbox"
                                    className="text-sm font-medium text-red-600 cursor-pointer"
                                >
                                    Unassign from vessel
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                type="submit"
                                className={unassignChecked ? "bg-red-600 hover:bg-red-700" : "bg-[#14b8a6] hover:bg-[#14b8a6]/90"}
                                disabled={!isRelieverAssigned || updatePlanningV2.isPending || createPlanningV2.isPending || isCheckingConflict}
                                data-testid="button-submit-relief"
                            >
                                {isCheckingConflict ? "Checking..." : unassignChecked ? "Unassign" : "Submit"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unassign Reliever from Vessel?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove {form.watch('relieverCrewName')} from the planned vessel assignment.
                        The crew member will be returned to the crew pool and their status will remain "On Leave".
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-unassign">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleUnassignConfirm}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="button-confirm-unassign"
                    >
                        Confirm Unassign
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showSignOnConflict} onOpenChange={setShowSignOnConflict}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sign-On Conflict Detected</AlertDialogTitle>
                    <AlertDialogDescription>
                        This crew member currently has an active sign-on record on vessel <strong>{conflictVesselName}</strong>. 
                        Please sign off the crew member from the previous vessel before proceeding with this assignment.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction 
                        onClick={() => setShowSignOnConflict(false)}
                        data-testid="button-close-conflict-alert"
                    >
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
    );
};
