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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
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

// Helper function to format dates (date only, no time)
const formatDateOnly = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return format(date, 'yyyy-MM-dd');
    } catch {
        return dateString;
    }
};

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
                joiningDate: planningData.joiningDate || '',
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
            const payload = {
                vesselId,
                rankId,
                rank,
                ...planningData,
                ...data,
            };
            
            if (planningData?.id) {
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, payload);
            } else {
                return apiRequest('POST', '/api/vessel-planning', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
            toast({
                title: "Success",
                description: "Relief status saved successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to save relief status",
                variant: "destructive",
            });
        }
    });

    const handleSave = () => {
        const data = form.getValues();
        updatePlanningMutation.mutate(data);
    };

    const handleSubmit = form.handleSubmit((data) => {
        updatePlanningMutation.mutate(data);
        onOpenChange(false);
    });

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
                                            >
                                                <SelectTrigger className="col-span-2">
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
                                                className="col-span-2" 
                                                data-testid="input-contract-period"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                                className="col-span-2" 
                                                data-testid="input-contract-range-start"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                                className="col-span-2" 
                                                data-testid="input-contract-range-end"
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                                                placeholder="dd-mm-yyyy" 
                                                className="col-span-2" 
                                                data-testid="input-joining-date"
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
                                            >
                                                <SelectTrigger className="col-span-2">
                                                    <SelectValue placeholder="Select Port" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Singapore">Singapore</SelectItem>
                                                    <SelectItem value="Rotterdam">Rotterdam</SelectItem>
                                                    <SelectItem value="Dubai">Dubai</SelectItem>
                                                    <SelectItem value="Hong Kong">Hong Kong</SelectItem>
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
                                                className="col-span-2"
                                                data-testid="radio-deployment-checklist"
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="true" id="deployment-yes" />
                                                        <Label htmlFor="deployment-yes">Yes</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="false" id="deployment-no" />
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
                                                    className="flex items-center space-x-4"
                                                    data-testid="radio-applicable-docs"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="true" id="docs-yes" />
                                                        <Label htmlFor="docs-yes">Yes</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="false" id="docs-no" />
                                                        <Label htmlFor="docs-no">No</Label>
                                                    </div>
                                                </RadioGroup>
                                                <Button type="button" variant="outline" size="sm" data-testid="button-see-checklist">
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
    reliefDue: z.string().optional(),
    signOffDate: z.string().optional(),
    signOffPort: z.string().optional(),
    reliefStatus: z.string().optional(),
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
    const [signOffDateOpen, setSignOffDateOpen] = useState(false);
    
    const form = useForm<OnBoardStatusFormData>({
        resolver: zodResolver(onBoardStatusFormSchema),
        defaultValues: {
            onBoardCrewName: '',
            onBoardCrewNationality: '',
            reliefDue: '',
            signOffDate: '',
            signOffPort: '',
            reliefStatus: '',
        }
    });

    // Reset form when dialog opens or planningData changes
    React.useEffect(() => {
        if (open && planningData) {
            form.reset({
                onBoardCrewName: planningData.onBoardCrewName || '',
                onBoardCrewNationality: planningData.onBoardCrewNationality || '',
                reliefDue: planningData.reliefDue || '',
                signOffDate: planningData.signOffDate || '',
                signOffPort: planningData.signOffPort || '',
                reliefStatus: planningData.reliefStatus || '',
            });
        } else if (open && !planningData) {
            // Reset to empty form for new entry
            form.reset({
                onBoardCrewName: '',
                onBoardCrewNationality: '',
                reliefDue: '',
                signOffDate: '',
                signOffPort: '',
                reliefStatus: '',
            });
        }
    }, [open, planningData, form]);

    const updatePlanningMutation = useMutation({
        mutationFn: async (data: OnBoardStatusFormData) => {
            const payload = {
                vesselId,
                rankId,
                rank,
                ...planningData,
                ...data,
            };
            
            if (planningData?.id) {
                return apiRequest('PATCH', `/api/vessel-planning/${planningData.id}`, payload);
            } else {
                return apiRequest('POST', '/api/vessel-planning', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
            toast({
                title: "Success",
                description: "On board status saved successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to save on board status",
                variant: "destructive",
            });
        }
    });

    const handleSave = () => {
        const data = form.getValues();
        updatePlanningMutation.mutate(data);
    };

    const handleSubmit = form.handleSubmit((data) => {
        updatePlanningMutation.mutate(data);
        onOpenChange(false);
    });

    // Helper to format date from YYYY-MM-DD to dd-mmm-yyyy
    const formatDisplayDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return format(date, 'dd-MMM-yyyy');
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
                        {/* Name - Display only */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Name:</span>
                            <span className="text-sm text-gray-900">{planningData?.crewName || planningData?.onBoardCrewName || 'James Wilson'}</span>
                        </div>

                        {/* Nationality - Display only */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Nationality:</span>
                            <span className="text-sm text-gray-900">{planningData?.nationality || planningData?.onBoardCrewNationality || 'British'}</span>
                        </div>

                        {/* Relief Due - Display only */}
                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                            <span className="text-sm text-gray-700">Relief Due:</span>
                            <span className="text-sm text-gray-900">{planningData?.reliefDue ? formatDisplayDate(planningData.reliefDue) : '14-Nov-2025'}</span>
                        </div>

                        {/* Sign Off Date - Date Picker */}
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

                        {/* Sign Off Port */}
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
                                                    <SelectItem value="Singapore">Singapore</SelectItem>
                                                    <SelectItem value="Rotterdam">Rotterdam</SelectItem>
                                                    <SelectItem value="Dubai">Dubai</SelectItem>
                                                    <SelectItem value="Hong Kong">Hong Kong</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Relief Status */}
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
                                {/* Download buttons aligned to the right */}
                                <div className="flex justify-end gap-2">
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
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {planningLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            Loading crew members...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (() => {
                                                    // Use vessel planning data and sort by rank order
                                                    const vesselCrew = vesselPlanning
                                                        .filter((planning: any) => planning.crewMemberId)
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
                                                                <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                                    No crew members assigned to this vessel.
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                    
                                                    return vesselCrew.map((planning: any, index: number) => {
                                                        // Use embedded crew member data from planning (already enriched by API)
                                                        const crewData = planning.crewMemberData;
                                                        
                                                        return (
                                                        <TableRow key={planning.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-sno-${index + 1}`}>
                                                                {index + 1}.
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-rank-${index + 1}`}>
                                                                {planning.rank || ''}
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
                                                                    // Reconstruct crew object for appraisal handler using embedded data
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
                                                            No positions configured for this vessel. Please configure positions in Admin &gt; Rank Admin &gt; Vessel.
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
                                                            No positions configured for this vessel. Please configure positions in Admin &gt; Rank Admin &gt; Vessel.
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
                                                            // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
                                                            const rankName = (rank.role || rank.rank)?.split('_')[0];
                                                            const rankPlanningData = vesselPlanning.find((p: any) => 
                                                                p.rankId === rank.id || p.rankId === rank.rankId || p.rank === rankName
                                                            );
                                                            
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
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3]">Reliever Status</TableHead>
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
                                                        <TableCell colSpan={14} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={14} className="text-center text-xs text-gray-500 py-8">
                                                            No positions configured for this vessel. Please configure positions in Admin &gt; Rank Admin &gt; Vessel.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    vesselRanks.map((rank: any, index: number) => {
                                                        // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
                                                        const rankName = (rank.role || rank.rank)?.split('_')[0];
                                                        // Find all matching planning records for this rank
                                                        const matchingRecords = vesselPlanning.filter((p: any) => 
                                                            p.rankId === rank.id || p.rankId === rank.rankId || p.rank === rankName
                                                        );
                                                        // Prioritize records with reliever data, fallback to first match
                                                        const rankPlanningData = matchingRecords.find((p: any) => p.relieverCrewId) || matchingRecords[0];
                                                        
                                                        return (
                                                            <TableRow key={rank.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                                <TableCell className="text-xs text-gray-700 border-r border-gray-100" data-testid={`cell-planning-sno-${index + 1}`}>
                                                                    {index + 1}.
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r border-gray-100" data-testid={`cell-planning-rank-${index + 1}`}>
                                                                    {rank.role || rank.rank}
                                                                </TableCell>
                                                                
                                                                {/* On Board Status cells */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-onboard-name-${index + 1}`}>
                                                                    {rankPlanningData?.crewName || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-relief-due-${index + 1}`}>
                                                                    {rankPlanningData?.reliefDue || rankPlanningData?.reliefDate || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-soff-date-${index + 1}`}>
                                                                    {rankPlanningData?.signOffDate || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-soff-port-${index + 1}`}>
                                                                    {rankPlanningData?.signOffPort || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-relief-status-${index + 1}`}>
                                                                    {rankPlanningData?.reliefStatus || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs border-r-2 border-gray-200" data-testid={`cell-planning-onboard-edit-${index + 1}`}>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        data-testid={`button-edit-onboard-${index + 1}`}
                                                                        onClick={() => {
                                                                            setSelectedRankForOnBoard({
                                                                                rank: rank.rank,
                                                                                rankId: rank.rankId || rank.id,
                                                                                planningData: rankPlanningData
                                                                            });
                                                                            setOnBoardDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-4 w-4 text-gray-500" />
                                                                    </Button>
                                                                </TableCell>
                                                                
                                                                {/* Reliever Status cells */}
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-reliever-name-${index + 1}`}>
                                                                    {rankPlanningData?.relieverCrewName || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-date-${index + 1}`}>
                                                                    {formatDateOnly(rankPlanningData?.joiningDate)}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-port-${index + 1}`}>
                                                                    {rankPlanningData?.joiningPort || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-planning-joining-status-${index + 1}`}>
                                                                    {rankPlanningData?.joiningStatus || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs" data-testid={`cell-planning-reliever-edit-${index + 1}`}>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-8 w-8 p-0" 
                                                                        data-testid={`button-edit-reliever-${index + 1}`}
                                                                        onClick={() => {
                                                                            setSelectedRankForRelief({
                                                                                rank: rank.role || rank.rank,
                                                                                rankId: rank.rankId,
                                                                                planningData: rankPlanningData
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
                                                )}
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
