import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addMonths, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useUpdatePlanningV2, useCreatePlanningV2, useVesselPlanningV2 } from '../hooks/useVesselV2';
import { vesselApiV2 } from '../api/vesselApiV2';
import { apiRequest } from '@/lib/queryClient';
import { API_BASE_URL } from '@/config/api';
import { SearchablePortCombobox } from "@/components/ui/SearchablePortCombobox";

const SIGN_OFF_REASONS = [
    "Contract Completed",
    "Terminated",
    "Medical Reasons",
    "Others"
] as const;

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

interface OnBoardStatusEditDialogV2Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rank: string;
    vesselUuid: string;
    rankId: string;
    planningData?: any;
}

export const OnBoardStatusEditDialog_v2: React.FC<OnBoardStatusEditDialogV2Props> = ({
    open,
    onOpenChange,
    rank,
    vesselUuid,
    rankId,
    planningData
}) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { getVesselName } = useVesselLookup();
    const [signOffDateOpen, setSignOffDateOpen] = useState(false);
    const [takeOverDateOpen, setTakeOverDateOpen] = useState(false);
    
    const updatePlanningV2 = useUpdatePlanningV2();
    const createPlanningV2 = useCreatePlanningV2();
    
    // Look up port name for signOnPort display - only use UUID field, not name field
    const signOnPortUuid = planningData?.joiningPortUuid;
    const { data: signOnPortData } = useQuery<{ portUuid: string; name: string; country: string | null } | null>({
        queryKey: ['/api/v2/ports', signOnPortUuid],
        queryFn: async () => {
            if (!signOnPortUuid) return null;
            const response = await fetch(`/api/v2/ports/${signOnPortUuid}`);
            if (!response.ok) return null;
            return response.json();
        },
        enabled: !!signOnPortUuid && open,
        staleTime: 300000,
    });
    
    // Use fetched port name first, then fall back to pre-joined name from planningData
    const signOnPortDisplayName = signOnPortData?.name 
        ? `${signOnPortData.name}${signOnPortData.country ? ` (${signOnPortData.country})` : ''}`
        : planningData?.joiningPortName || planningData?.joiningPort || '-';
    
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

    React.useEffect(() => {
        if (open && planningData) {
            form.reset({
                onBoardCrewName: planningData.onBoardCrewName || '',
                onBoardCrewNationality: planningData.onBoardCrewNationality || '',
                signOnDate: planningData.signOnDate || '',
                joiningPort: planningData.joiningPortUuid || '',
                reliefDue: planningData.reliefDue || '',
                signOffDate: planningData.signOffDate || '',
                signOffPort: planningData.signOffPortUuid || '',
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

    const watchedReliefStatus = form.watch('reliefStatus');
    const watchedContractPeriod = form.watch('contractPeriodMonths');
    
    const calculatedReliefDue = React.useMemo(() => {
        const signOnDate = planningData?.signOnDate || planningData?.joiningDate;
        if (!signOnDate || !watchedContractPeriod) return null;
        
        try {
            let baseDate: Date;
            if (signOnDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                baseDate = parseISO(signOnDate);
            } else {
                const parsed = new Date(signOnDate);
                if (isNaN(parsed.getTime())) return null;
                baseDate = parsed;
            }
            
            const reliefDate = addMonths(baseDate, watchedContractPeriod);
            return format(reliefDate, 'yyyy-MM-dd');
        } catch {
            return null;
        }
    }, [planningData?.signOnDate, planningData?.joiningDate, watchedContractPeriod]);

    const RELIEVER_FIELDS_TO_EXCLUDE = [
        'relieverCrewId', 'relieverCrewName', 'relieverJoiningDate', 
        'relieverJoiningPort', 'relieverStatus', 'relieverNationality',
        'relieverContractPeriodMonths', 'relieverContractEndRangeStartMonths', 'relieverContractEndRangeEndMonths',
        'joiningStatus', 'deploymentChecklistCompleted', 'applicableDocsChecked',
        'joiningDate', 'joiningPort',
        'createdAt', 'updatedAt'
    ];
    
    const filterOutRelieverFields = (data: Record<string, any>): Record<string, any> => {
        return Object.fromEntries(
            Object.entries(data).filter(([key]) => {
                if (key.startsWith('reliever')) return false;
                if (RELIEVER_FIELDS_TO_EXCLUDE.includes(key)) return false;
                return true;
            })
        );
    };

    const handleSaveV2 = async (data: OnBoardStatusFormData) => {
        try {
            const isTakeover = data.takeOverConfirmation && data.takeOverDate;
            const isSignOff = data.reliefStatus === "Signed Off" && data.signOffDate;
            
            if (isSignOff && !data.signOffReason) {
                throw new Error("Please select a reason for sign-off");
            }
            
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
                }
            }
            
            const dataWithReliefDue = computedReliefDue ? { ...data, reliefDue: computedReliefDue } : data;
            
            const allPlanningResponse = await vesselApiV2.getVesselPlanning(vesselUuid);
            const allPlanning = allPlanningResponse || [];
            
            if (isSignOff && planningData?.planUuid) {
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                
                await apiRequest('POST', `/api/v2/vessel/planning/${planningData.planUuid}/sign-off`, {
                    signOffDate: data.signOffDate,
                    signOffReason: data.signOffReason,
                    signOffPortUuid: cleanFormData.signOffPort,
                });
            } else if (isTakeover && planningData?.crewStatus === "secondary") {
                let primaryCrew = allPlanning.find((p: any) => 
                    p.rankId === rankId && 
                    p.crewStatus === "primary" && 
                    !p.isArchived &&
                    p.planUuid !== planningData?.planUuid
                );
                
                if (!primaryCrew) {
                    primaryCrew = allPlanning.find((p: any) => 
                        p.vesselUuid === vesselUuid && 
                        p.rank === rank && 
                        p.crewStatus === "primary" && 
                        !p.isArchived &&
                        p.planUuid !== planningData?.planUuid
                    );
                }
                
                if (primaryCrew) {
                    if (primaryCrew.signOffDate || primaryCrew.reliefStatus === "Signed Off") {
                        await apiRequest('POST', `/api/v2/vessel/planning/${primaryCrew.planUuid}/sign-off`, {
                            signOffDate: primaryCrew.signOffDate || new Date().toISOString().split('T')[0],
                            signOffReason: primaryCrew.signOffReason || 'Take Over',
                            signOffPortUuid: primaryCrew.signOffPortUuid,
                        });
                    } else {
                        await vesselApiV2.updatePlanning(primaryCrew.planUuid, {
                            crewStatus: "secondary",
                            handOverDate: data.takeOverDate,
                        });
                    }
                }
                
                const cleanPlanningDataForTakeover = filterOutRelieverFields(planningData || {});
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                
                const signOnDateForPromotion = cleanFormData.signOnDate || cleanPlanningDataForTakeover.signOnDate;
                
                await updatePlanningV2.mutateAsync({
                    planUuid: planningData.planUuid,
                    data: {
                        ...cleanFormData,
                        crewStatus: "primary",
                        signOnDate: signOnDateForPromotion,
                        contractPeriodMonths: cleanFormData.contractPeriodMonths,
                        contractEndRangeStartMonths: cleanFormData.contractEndRangeStartMonths,
                        contractEndRangeEndMonths: cleanFormData.contractEndRangeEndMonths,
                    }
                });
            } else if (isTakeover && planningData?.crewStatus === "primary") {
                let secondaryCrew = allPlanning.find((p: any) => 
                    p.rankId === rankId && 
                    p.crewStatus === "secondary" && 
                    !p.isArchived &&
                    p.planUuid !== planningData?.planUuid
                );
                
                if (!secondaryCrew) {
                    secondaryCrew = allPlanning.find((p: any) => 
                        p.vesselUuid === vesselUuid && 
                        p.rank === rank && 
                        p.crewStatus === "secondary" && 
                        !p.isArchived &&
                        p.planUuid !== planningData?.planUuid
                    );
                }
                
                if (!secondaryCrew) {
                    throw new Error("No secondary crew (reliever) found for this rank. Take over requires a secondary crew member.");
                }
                
                const secondarySignOnDate = secondaryCrew.signOnDate || secondaryCrew.relieverSignOnDate;
                
                await vesselApiV2.updatePlanning(secondaryCrew.planUuid, {
                    crewStatus: "primary",
                    signOnDate: secondarySignOnDate,
                    takeOverDate: null,
                    takeOverConfirmation: false,
                    contractPeriodMonths: secondaryCrew.contractPeriodMonths || secondaryCrew.relieverContractPeriodMonths,
                    contractEndRangeStartMonths: secondaryCrew.contractEndRangeStartMonths || secondaryCrew.relieverContractEndRangeStartMonths,
                    contractEndRangeEndMonths: secondaryCrew.contractEndRangeEndMonths || secondaryCrew.relieverContractEndRangeEndMonths,
                });
                
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                await updatePlanningV2.mutateAsync({
                    planUuid: planningData.planUuid,
                    data: {
                        ...cleanFormData,
                        crewStatus: "secondary",
                        handOverDate: data.takeOverDate,
                    }
                });
            } else {
                const cleanFormData = filterOutRelieverFields(dataWithReliefDue as Record<string, any>);
                
                if (planningData?.planUuid) {
                    await updatePlanningV2.mutateAsync({
                        planUuid: planningData.planUuid,
                        data: {
                            reliefDue: cleanFormData.reliefDue,
                            signOffDate: cleanFormData.signOffDate,
                            signOffPortUuid: cleanFormData.signOffPort,
                            signOffReason: cleanFormData.signOffReason,
                            reliefStatus: cleanFormData.reliefStatus,
                            takeOverDate: cleanFormData.takeOverDate,
                            takeOverConfirmation: cleanFormData.takeOverConfirmation,
                            contractPeriodMonths: cleanFormData.contractPeriodMonths,
                            contractEndRangeStartMonths: cleanFormData.contractEndRangeStartMonths,
                            contractEndRangeEndMonths: cleanFormData.contractEndRangeEndMonths,
                        }
                    });
                } else {
                    await createPlanningV2.mutateAsync({
                        vesselUuid,
                        rankId,
                        rank,
                        signOnDate: cleanFormData.signOnDate,
                        reliefDue: cleanFormData.reliefDue,
                        signOffDate: cleanFormData.signOffDate,
                        signOffPortUuid: cleanFormData.signOffPort,
                        signOffReason: cleanFormData.signOffReason,
                        reliefStatus: cleanFormData.reliefStatus,
                        contractPeriodMonths: cleanFormData.contractPeriodMonths,
                        contractEndRangeStartMonths: cleanFormData.contractEndRangeStartMonths,
                        contractEndRangeEndMonths: cleanFormData.contractEndRangeEndMonths,
                    });
                }
            }
            
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] });
            queryClient.invalidateQueries({ queryKey: ['/api/crew-members'] });
            queryClient.invalidateQueries({ queryKey: ['v2-crew-pool'] });
            // Invalidate dashboard query so crew status updates immediately after sign-off
            if (planningData?.crewUuid) {
                queryClient.invalidateQueries({ queryKey: ['/api/v2/crew-pool/crew', planningData.crewUuid, 'dashboard'] });
            }
            
            toast({
                title: "Success",
                description: "On board status saved successfully",
            });
            onOpenChange(false);
        } catch (error: any) {
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
    };

    const handleSubmit = form.handleSubmit((data) => {
        handleSaveV2(data);
    });

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

    const parseDate = (dateStr: string): Date | undefined => {
        if (!dateStr) return undefined;
        try {
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return new Date(dateStr);
            }
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
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Name:</span>
                            <span className="text-sm text-gray-900">{planningData?.crewName || planningData?.onBoardCrewName || '-'}</span>
                        </div>

                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Nationality:</span>
                            <span className="text-sm text-gray-900">{planningData?.nationality || planningData?.onBoardCrewNationality || '-'}</span>
                        </div>

                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Sign On Date:</span>
                            <div className="flex items-center border rounded-md px-3 py-2 bg-gray-50">
                                <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{planningData?.signOnDate ? formatDisplayDate(planningData.signOnDate) : '-'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Sign On Port:</span>
                            <div className="flex items-center border rounded-md px-3 py-2 bg-gray-50">
                                <span className="text-sm text-gray-900">{signOnPortDisplayName}</span>
                            </div>
                        </div>

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

                        <div className="border border-[#16569e] rounded-md p-4 space-y-4">
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

                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Relief Due:</span>
                            <span className="text-sm text-gray-900">
                                {calculatedReliefDue 
                                    ? formatDisplayDate(calculatedReliefDue) 
                                    : (planningData?.reliefDue ? formatDisplayDate(planningData.reliefDue) : '-')}
                            </span>
                        </div>

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

                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Hand Over Date:</span>
                            <span className="text-sm text-gray-900">{planningData?.handOverDate ? formatDisplayDate(planningData.handOverDate) : '-'}</span>
                        </div>

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

                        <FormField
                            control={form.control}
                            name="signOffPort"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Sign Off Port</FormLabel>
                                        <FormControl>
                                            <SearchablePortCombobox
                                                value={field.value as string}
                                                onValueChange={field.onChange}
                                                placeholder="Search port..."
                                                data-testid="select-sign-off-port"
                                            />
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                type="submit"
                                className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                disabled={updatePlanningV2.isPending || createPlanningV2.isPending}
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
