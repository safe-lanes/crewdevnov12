import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    formatIsoDate,
    parseManualDate,
} from "@/components/ui/formatted-date-input";
import { VesselDateInput } from "./VesselDateInput";
import { VesselFutureDateMessage } from "./VesselFutureDateMessage";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdatePlanningV2, useCreatePlanningV2 } from '../hooks/useVesselV2';
import { vesselApiV2 } from '../api/vesselApiV2';
import { SearchablePortCombobox } from "@/components/ui/SearchablePortCombobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { RequiredFormDetails } from "@/components/configured-form/RequiredFormDetails";
import { JoiningCompanyForms } from "./JoiningCompanyForms";
import { TrainingMatrixCompliance } from "./TrainingMatrixCompliance";
import { AcceptedChecklistHistory } from "./AcceptedChecklistHistory";

const reliefStatusFormSchema = z.object({
    relieverCrewName: z.string().optional(),
    relieverNationality: z.string().optional(),
    signOnStatus: z.string().optional(),
    relieverContractPeriodMonths: z.preprocess(value => value === "" || value === null ? undefined : value, z.coerce.number().positive("Contract Period must be greater than 0").optional()),
    relieverContractEndRangeStartMonths: z.preprocess(value => value === "" || value === null ? undefined : value, z.coerce.number().positive("Contract End - Range Start must be greater than 0").optional()),
    relieverContractEndRangeEndMonths: z.preprocess(value => value === "" || value === null ? undefined : value, z.coerce.number().positive("Contract End - Range End must be greater than 0").optional()),
    plannedConfirmedDate: z.string().optional(),
    travelStartDate: z.string().optional(),
    relieverSignOnDate: z.string().optional(),
    relieverSignOnPort: z.string().optional(),
    deploymentChecklistCompleted: z.boolean().optional(),
    applicableDocsChecked: z.boolean().optional(),
});

type ReliefStatusFormData = z.infer<typeof reliefStatusFormSchema>;
type ChecklistBlocker = { kind: "requirement" | "check" | "training"; status: string; formName?: string; courseName?: string; reason?: string; requirementUuid?: string; eventUuid?: string };
type ChecklistConflict = { message: string; blockers: ChecklistBlocker[]; canOverride: boolean; canOverrideTraining: boolean };

function parseChecklistConflict(error: unknown): ChecklistConflict | null {
    if (!(error instanceof Error)) return null;
    const body = error.message.replace(/^\d{3}:\s*/, "");
    try {
        const value = JSON.parse(body);
        if (value?.error !== "company_forms_checklist_blocked" || typeof value.message !== "string" || !Array.isArray(value.blockers) || typeof value.canOverride !== "boolean") return null;
        const blockers = value.blockers.filter((item: any) =>
            item && (item.kind === "requirement" || item.kind === "check" || item.kind === "training") && typeof item.status === "string"
        ) as ChecklistBlocker[];
        if (blockers.length !== value.blockers.length) return null;
        return { message: value.message, blockers, canOverride: value.canOverride, canOverrideTraining: value.canOverrideTraining === true };
    } catch { return null; }
}

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
    const [joiningFormsOpen, setJoiningFormsOpen] = useState(false);
    const [blockerForm, setBlockerForm] = useState<{ subjectRef: string; requirementUuid: string; name: string } | null>(null);
    const { permissions, roleName, userType, canCompanyFormAction } = usePermissions();
    const canOverrideChecklist = canCompanyFormAction("override_checklist");
    const [checklistConflict, setChecklistConflict] = useState<ChecklistConflict | null>(null);
    const [overrideReason, setOverrideReason] = useState("");
    const [trainingOverrideReason, setTrainingOverrideReason] = useState("");
    const [requestChecklistOverride, setRequestChecklistOverride] = useState(false);
    const [requestTrainingOverride, setRequestTrainingOverride] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const trainingPermissionQuery = useQuery<{ allowed: boolean }>({
        queryKey: ["/api/v2/admin/training-compliance/my-permission"],
        queryFn: async () => (await apiRequest("GET", "/api/v2/admin/training-compliance/my-permission")).json(),
        retry: false,
        enabled: open,
        staleTime: 0,
        refetchOnMount: "always",
    });
    const [pendingChecklistPayload, setPendingChecklistPayload] = useState<Record<string, unknown> | null>(null);
    const canClearUnlinked = roleName?.trim().toLowerCase() === 'admin'
        && userType?.trim().toLowerCase() !== 'ship'
        && permissions.some(p => p.menuName.toLowerCase() === 'vessel' && p.candelete);
    const isUnlinkedReliever = !!planningData?.relieverCrewUuid && !planningData?.relieverAssignUuid;
    const [joiningDateOpen, setJoiningDateOpen] = useState(false);
    const [plannedConfirmedDateOpen, setPlannedConfirmedDateOpen] = useState(false);
    const [travelStartDateOpen, setTravelStartDateOpen] = useState(false);
    const [futureDateDraft, setFutureDateDraft] = React.useState({ future: false, blocked: false });
    React.useEffect(() => {
        setFutureDateDraft({ future: false, blocked: false });
    }, [open, planningData]);
    const [unassignChecked, setUnassignChecked] = useState(false);
    const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
    const [clearReason, setClearReason] = useState('');
    const [isClearingUnlinked, setIsClearingUnlinked] = useState(false);
    const [clearUnlinkedSelected, setClearUnlinkedSelected] = useState(false);
    const [showSignOnConflict, setShowSignOnConflict] = useState(false);
    const [conflictVesselName, setConflictVesselName] = useState('');
    const [isCheckingConflict, setIsCheckingConflict] = useState(false);
    const [assignmentDetails, setAssignmentDetails] = useState<{
        assignUuid: string;
        assignmentType: string | null;
        signOnDate: string | null;
        contractPeriod: string | null;
        contractRankUuid: string | null;
        contractRankLabel: string;
        plannedJoiningDate: string | null;
        contractRangeEndMonths: number | null;
    } | null>(null);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    const formSubjectRef = React.useRef<string | null>(null);
    
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
            plannedConfirmedDate: '',
            travelStartDate: '',
            relieverSignOnDate: '',
            relieverSignOnPort: '',
            deploymentChecklistCompleted: false,
            applicableDocsChecked: false,
        }
    });
    const formIsDirty = form.formState.isDirty;

    React.useEffect(() => {
        const subjectKey = `${planningData?.planUuid ?? "new"}:${vesselUuid}:${rankId}`;
        if (!open) formSubjectRef.current = null;
        else {
            if (formSubjectRef.current === subjectKey) return;
            formSubjectRef.current = subjectKey;
        }
        setAssignmentDetails(null);
        setAssignmentError(null);
        setClearReason('');
        setClearUnlinkedSelected(false);
        if (open && planningData) {
            form.reset({
                relieverCrewName: planningData.relieverCrewName || '',
                relieverNationality: planningData.relieverNationality || '',
                signOnStatus: planningData.joiningStatus || '',
                relieverContractPeriodMonths: planningData.relieverContractPeriodMonths ?? undefined,
                relieverContractEndRangeStartMonths: planningData.relieverContractEndRangeStartMonths ?? undefined,
                relieverContractEndRangeEndMonths: planningData.relieverContractEndRangeEndMonths ?? undefined,
                plannedConfirmedDate: planningData.plannedConfirmedDate || '',
                travelStartDate: planningData.travelStartDate || '',
                relieverSignOnDate: planningData.relieverSignOnDate || '',
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
                plannedConfirmedDate: '',
                travelStartDate: '',
                relieverSignOnDate: '',
                relieverSignOnPort: '',
                deploymentChecklistCompleted: false,
                applicableDocsChecked: false,
            });
            setUnassignChecked(false);
        }
    }, [open, planningData, form, rankId, vesselUuid]);

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && formIsDirty && !window.confirm("Discard unsaved changes?")) return;
        onOpenChange(nextOpen);
    };

    const resetAfterSave = (submitted: ReliefStatusFormData, persisted: any) => {
        const currentValues = form.getValues();
        const field = (key: keyof ReliefStatusFormData, serverKey: string = key) =>
            persisted && Object.prototype.hasOwnProperty.call(persisted, serverKey)
                ? persisted[serverKey]
                : submitted[key] !== undefined ? submitted[key] : currentValues[key] ?? null;
        form.reset({
            ...form.getValues(),
            relieverCrewName: (field("relieverCrewName") ?? "") as string,
            relieverNationality: (field("relieverNationality") ?? "") as string,
            relieverContractPeriodMonths: field("relieverContractPeriodMonths") as number | undefined,
            relieverContractEndRangeStartMonths: field("relieverContractEndRangeStartMonths") as number | undefined,
            relieverContractEndRangeEndMonths: field("relieverContractEndRangeEndMonths") as number | undefined,
            relieverSignOnDate: (field("relieverSignOnDate") ?? "") as string,
            plannedConfirmedDate: (field("plannedConfirmedDate") ?? "") as string,
            travelStartDate: (field("travelStartDate") ?? "") as string,
            relieverSignOnPort: (field("relieverSignOnPort", "joiningPortUuid") ?? "") as string,
            signOnStatus: (field("signOnStatus", "joiningStatus") ?? "") as string,
            deploymentChecklistCompleted: field("deploymentChecklistCompleted") as boolean | undefined,
            applicableDocsChecked: field("applicableDocsChecked") as boolean | undefined,
        });
    };

    const refreshAfterSave = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] }),
            queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel/crew-counts'] }),
            queryClient.invalidateQueries({
                queryKey: ["training-matrix-compliance", planningData?.planUuid ?? null, planningData?.relieverAssignUuid ?? null],
            }),
        ]);
    };

    const openLinkedAssignment = async () => {
        if (!planningData?.planUuid || !planningData?.relieverAssignUuid) return;
        setAssignmentLoading(true);
        setAssignmentError(null);
        try {
            const response = await apiRequest(
                "GET",
                `/api/v2/vessel/planning/${encodeURIComponent(planningData.planUuid)}/reliever-assignment/${encodeURIComponent(planningData.relieverAssignUuid)}`
            );
            setAssignmentDetails(await response.json());
        } catch {
            setAssignmentError("The linked assignment could not be opened. Check your access or ask the office to review its link, then try again.");
        } finally {
            setAssignmentLoading(false);
        }
    };

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
        if (data.signOnStatus === "Signed On" && futureDateDraft.blocked) return;
        try {
            const isSigningOn = data.signOnStatus === "Signed On";
            let saveResult: any;
            
            if (isSigningOn && planningData?.relieverCrewId && planningData?.planUuid) {
                // Use the new sign-on API which properly updates crew_assignments.isCurrent
                // and moves reliever to on-board crew
                const signOnDate = data.relieverSignOnDate || null;
                const signOnPort = data.relieverSignOnPort || null;
                const contractPeriodMonths = data.relieverContractPeriodMonths ?? null;
                
                saveResult = await vesselApiV2.signOnReliever(planningData.planUuid, {
                    signOnDate,
                    signOnPort,
                    contractPeriodMonths,
                    contractEndRangeStartMonths: data.relieverContractEndRangeStartMonths ?? null,
                    contractEndRangeEndMonths: data.relieverContractEndRangeEndMonths ?? null,
                    plannedConfirmedDate: data.plannedConfirmedDate || null,
                    travelStartDate: data.travelStartDate || null,
                });
            } else {
                const payload = {
                    relieverContractPeriodMonths: data.relieverContractPeriodMonths ?? null,
                    relieverContractEndRangeStartMonths: data.relieverContractEndRangeStartMonths ?? null,
                    relieverContractEndRangeEndMonths: data.relieverContractEndRangeEndMonths ?? null,
                    deploymentChecklistCompleted: data.deploymentChecklistCompleted,
                    applicableDocsChecked: data.applicableDocsChecked,
                    joiningStatus: data.signOnStatus,
                    relieverSignOnDate: data.relieverSignOnDate || null,
                    joiningPortUuid: data.relieverSignOnPort || null,
                    plannedConfirmedDate: data.plannedConfirmedDate || null,
                    travelStartDate: data.travelStartDate || null,
                };
                
                if (planningData?.planUuid) {
                    saveResult = await updatePlanningV2.mutateAsync({
                        planUuid: planningData.planUuid,
                        data: payload
                    });
                } else {
                    saveResult = await createPlanningV2.mutateAsync({
                        vesselUuid,
                        rankId,
                        rank,
                        ...payload
                    });
                }
            }
            
            await refreshAfterSave();
            resetAfterSave(data, saveResult);
            
            toast({
                title: "Success",
                description: `Relief status saved successfully${Array.isArray(saveResult?.checklistAcceptance?.warnings) && saveResult.checklistAcceptance.warnings.length ? ` Checklist notes: ${saveResult.checklistAcceptance.warnings.join(" ")}` : ""}`,
            });
        } catch (error: any) {
            console.error('Relief status save error:', error);
            const conflict = parseChecklistConflict(error);
            if (conflict && data.deploymentChecklistCompleted === true && planningData?.planUuid) {
                setChecklistConflict(conflict);
                setOverrideReason("");
                setTrainingOverrideReason("");
                setRequestChecklistOverride(false);
                setRequestTrainingOverride(false);
                setPendingChecklistPayload({
                    relieverContractPeriodMonths: data.relieverContractPeriodMonths ?? null,
                    relieverContractEndRangeStartMonths: data.relieverContractEndRangeStartMonths ?? null,
                    relieverContractEndRangeEndMonths: data.relieverContractEndRangeEndMonths ?? null,
                    deploymentChecklistCompleted: data.deploymentChecklistCompleted,
                    applicableDocsChecked: data.applicableDocsChecked,
                    joiningStatus: data.signOnStatus,
                    relieverSignOnDate: data.relieverSignOnDate || null,
                    joiningPortUuid: data.relieverSignOnPort || null,
                    plannedConfirmedDate: data.plannedConfirmedDate || null,
                    travelStartDate: data.travelStartDate || null,
                });
                return;
            }
            toast({
                title: "Error",
                description: "Unable to save relief status. Please review the information and try again.",
                variant: "destructive",
                duration: 5000,
            });
        }
    };

    const confirmChecklistOverride = async () => {
        if (!planningData?.planUuid || !pendingChecklistPayload || !checklistConflict) return;
        const hasFormBlockers = checklistConflict.blockers.some(blocker => blocker.kind !== "training");
        const hasTrainingBlockers = checklistConflict.blockers.some(blocker => blocker.kind === "training");
        const hasUnsafeMandatoryBlocker = checklistConflict.blockers.some(blocker =>
            (blocker.kind === "requirement" && ["OUTSTANDING", "STARTED"].includes(blocker.status.toUpperCase())) ||
            (blocker.kind === "check" && blocker.status.toUpperCase() === "NOT_CHECKED")
        );
        const formsEligible = hasFormBlockers && checklistConflict.canOverride && canOverrideChecklist &&
            checklistConflict.blockers.filter(blocker => blocker.kind !== "training").every(blocker =>
                (blocker.kind === "requirement" && blocker.status.toUpperCase() === "UNRESOLVED") ||
                (blocker.kind === "check" && ["PENDING", "FAILED"].includes(blocker.status.toUpperCase()))
            );
        const trainingEligible = hasTrainingBlockers && checklistConflict.canOverrideTraining &&
            trainingPermissionQuery.data?.allowed === true;
        if (hasUnsafeMandatoryBlocker || (!requestChecklistOverride && !requestTrainingOverride) ||
            (requestChecklistOverride && (!formsEligible || !overrideReason.trim())) ||
            (requestTrainingOverride && (!trainingEligible || !trainingOverrideReason.trim()))) return;
        try {
            const overrides: Record<string, { reason: string }> = {};
            if (requestChecklistOverride) overrides.checklistOverride = { reason: overrideReason.trim() };
            if (requestTrainingOverride) overrides.trainingOverride = { reason: trainingOverrideReason.trim() };
            const result: any = await updatePlanningV2.mutateAsync({
                planUuid: planningData.planUuid,
                data: { ...pendingChecklistPayload, ...overrides } as any,
            });
            await refreshAfterSave();
            resetAfterSave(pendingChecklistPayload as ReliefStatusFormData, result);
            setChecklistConflict(null);
            setPendingChecklistPayload(null);
            setOverrideReason("");
            setTrainingOverrideReason("");
            setRequestChecklistOverride(false);
            setRequestTrainingOverride(false);
            const warnings = result?.checklistAcceptance?.warnings;
            toast({ title: "Success", description: `Relief status saved.${Array.isArray(warnings) && warnings.length ? ` Checklist notes: ${warnings.join(" ")}` : " Checklist acceptance was recorded."}` });
        } catch (error) {
            const conflict = parseChecklistConflict(error);
            toast({ title: "Unable to override checklist", description: conflict?.message ?? "The checklist override was not accepted. Review the forms and try again.", variant: "destructive" });
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
                    plannedConfirmedDate: null,
                    travelStartDate: null,
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

    const handleClearUnlinked = async () => {
        if (!canClearUnlinked || !planningData?.planUuid || !planningData?.relieverCrewUuid || !clearReason.trim()) return;
        setIsClearingUnlinked(true);
        try {
            await apiRequest("POST",
                `/api/v2/vessel/planning/${encodeURIComponent(planningData.planUuid)}/clear-unlinked-reliever`,
                { expectedCrewUuid: planningData.relieverCrewUuid, reason: clearReason.trim() });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel/crew-counts'] }),
            ]);
            toast({ title: "Unlinked reliever cleared", description: "The reason was recorded in the planning audit." });
            setShowUnassignConfirm(false);
            setClearUnlinkedSelected(false);
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Unable to clear reliever", description: error.message || "Reload and try again", variant: "destructive" });
        } finally {
            setIsClearingUnlinked(false);
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
        
        if (data.signOnStatus === "Signed On" && futureDateDraft.blocked) return;

        if (data.relieverSignOnDate) {
            data.relieverSignOnDate = normalizeToIsoDate(data.relieverSignOnDate);
        }
        if (data.plannedConfirmedDate) {
            data.plannedConfirmedDate = normalizeToIsoDate(data.plannedConfirmedDate);
        }
        if (data.travelStartDate) {
            data.travelStartDate = normalizeToIsoDate(data.travelStartDate);
        }

        if (data.signOnStatus === "Signed On" && !data.relieverSignOnDate) {
            toast({ title: "Validation Error", description: "Sign On Date is required.", variant: "destructive" });
            return;
        }

        if (data.signOnStatus === "In Transit" && !data.travelStartDate) {
            toast({ title: "Validation Error", description: "Travel Start Date is required when Sign On Status is In Transit.", variant: "destructive" });
            return;
        }

        if (data.signOnStatus === "Signed On") {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            if (data.relieverSignOnDate && data.relieverSignOnDate > todayStr) {
                toast({ title: "Validation Error", description: "Sign On Date cannot be a future date when Sign On Status is Signed On.", variant: "destructive" });
                return;
            }
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
        if (clearUnlinkedSelected) void handleClearUnlinked();
        else void handleUnassignV2();
    };

    const relieverName = form.watch('relieverCrewName');
    const isRelieverAssigned = relieverName && relieverName.trim() !== '';

    const watchedSignOnStatus = form.watch('signOnStatus');

    // Auto-clear stale future Sign On Date when status switches to "In Transit" or "Signed On"
    React.useEffect(() => {
        if (watchedSignOnStatus === "Signed On") {
            const currentSignOn = form.getValues('relieverSignOnDate');
            if (currentSignOn) {
                const isoDate = normalizeToIsoDate(currentSignOn);
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                if (isoDate && isoDate.match(/^\d{4}-\d{2}-\d{2}$/) && isoDate > todayStr) {
                    form.setValue('relieverSignOnDate', '', { shouldValidate: true });
                }
            }
        }
    }, [watchedSignOnStatus]);

    const datePickerFormOwner = React.useId();
    const getPickerDay = (date: Date | undefined): string | undefined => {
        if (!date || Number.isNaN(date.getTime())) return undefined;
        return format(date, "yyyy-MM-dd");
    };
    const getInputDate = (value?: string): string => {
        if (!value) return "";
        if (formatIsoDate(value)) return value;
        return getPickerDay(parseDateString(value)) || "";
    };
    const renderDateSelector = (
        field: {
            name: string;
            value?: string;
            onChange: (value: string) => void;
        },
        min?: string,
        max?: string,
    ) => (
        <FormControl>
            <div
                className="col-span-2 min-w-0"
                ref={(node) => {
                    const calendarInput =
                        node?.querySelector<HTMLInputElement>('input[type="date"]');
                    if (calendarInput) {
                        calendarInput.setAttribute("form", datePickerFormOwner);
                    }
                }}
                onKeyDown={(event) => {
                    if (
                        event.key === "Enter" &&
                        event.target instanceof HTMLInputElement &&
                        event.target.type === "text"
                    ) {
                        event.preventDefault();
                    }
                }}
            >
                <VesselDateInput
                    value={getInputDate(field.value)}
                    disabled={!isRelieverAssigned}
                    min={min}
                    max={max}
                    className={
                        !isRelieverAssigned
                            ? "bg-gray-100 cursor-not-allowed"
                            : undefined
                    }
                    retainInvalidDraftOnBlur={field.name === "relieverSignOnDate" && futureDateDraft.future}
                    onDraftChange={field.name === "relieverSignOnDate" ? (draft) => {
                            const date = parseManualDate(draft);
                            const future = Boolean(max && date && date > max);
                            const valid = Boolean(date && (!min || date >= min) && (!max || date <= max));
                            const blocked = Boolean(max) && (future || (futureDateDraft.blocked && !valid));
                            if (futureDateDraft.future !== future || futureDateDraft.blocked !== blocked) {
                                setFutureDateDraft({ future, blocked });
                            }
                        } : undefined}
                    data-testid={`input-${field.name}`}
                    onChange={(event) => {
                        const value = event.target.value;
                        if (!value || !formatIsoDate(value)) return;
                        if (min && value < min) return;
                        if (max && value > max) return;
                        field.onChange(value);
                    }}
                />
            </div>
        </FormControl>
    );

    return (
        <>
            <AlertDialog open={Boolean(checklistConflict)} onOpenChange={(next) => {
                if (!next) { setChecklistConflict(null); setPendingChecklistPayload(null); setOverrideReason(""); setTrainingOverrideReason(""); setRequestChecklistOverride(false); setRequestTrainingOverride(false); }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Checklist needs attention</AlertDialogTitle>
                        <AlertDialogDescription>{checklistConflict?.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {checklistConflict?.blockers.map((blocker, index) => (
                        <div key={`${blocker.kind}-${blocker.requirementUuid ?? blocker.eventUuid ?? index}`}
                          data-testid={`checklist-blocker-${blocker.requirementUuid ?? blocker.eventUuid ?? index}`}
                          className="text-sm text-amber-900">
                            <span className="font-medium">{blocker.kind === "training" ? blocker.courseName || "Training course" : blocker.formName || (blocker.kind === "check" ? "Stage check" : "Required form")}</span>
                            {" · "}{blocker.status.toLowerCase().replace(/_/g, " ")}
                            {blocker.reason ? ` — ${blocker.reason}` : ""}
                            {blocker.requirementUuid && planningData?.relieverAssignUuid && canCompanyFormAction("view") &&
                              <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => {
                                setBlockerForm({ subjectRef: planningData.relieverAssignUuid!, requirementUuid: blocker.requirementUuid!, name: blocker.formName || "Required form" });
                                setChecklistConflict(null);
                              }}>Open form</Button>}
                        </div>
                    ))}
                    {checklistConflict && (() => {
                        const formBlockers = checklistConflict.blockers.filter(blocker => blocker.kind !== "training");
                        const trainingBlockers = checklistConflict.blockers.filter(blocker => blocker.kind === "training");
                        const forbidden = checklistConflict.blockers.some(blocker =>
                            (blocker.kind === "requirement" && ["OUTSTANDING", "STARTED"].includes(blocker.status.toUpperCase())) ||
                            (blocker.kind === "check" && blocker.status.toUpperCase() === "NOT_CHECKED"));
                        const formsEligible = formBlockers.length > 0 && checklistConflict.canOverride && canOverrideChecklist && !forbidden &&
                            formBlockers.every(blocker =>
                                (blocker.kind === "requirement" && blocker.status.toUpperCase() === "UNRESOLVED") ||
                                (blocker.kind === "check" && ["PENDING", "FAILED"].includes(blocker.status.toUpperCase())));
                        const trainingEligible = trainingBlockers.length > 0 && checklistConflict.canOverrideTraining && trainingPermissionQuery.data?.allowed === true && !forbidden &&
                            trainingBlockers.length > 0;
                        return <div className="space-y-4 border-t pt-3">
                            {forbidden && <p className="text-sm text-rose-800" role="status">An outstanding or started mandatory form, or an unchecked stage, must be completed first. An override is not available.</p>}
                            {formBlockers.length > 0 && !forbidden && (!checklistConflict.canOverride || !canOverrideChecklist) && <p className="text-sm text-slate-600" role="status">A Company Forms override is not available for this checklist or your role.</p>}
                            {trainingBlockers.length > 0 && checklistConflict.canOverrideTraining && trainingPermissionQuery.isLoading && <p className="text-sm text-slate-600" role="status">Checking your training override permission…</p>}
                            {trainingBlockers.length > 0 && checklistConflict.canOverrideTraining && !trainingPermissionQuery.isLoading && trainingPermissionQuery.data?.allowed !== true && <p className="text-sm text-slate-600" role="status">Your role does not have permission to override training compliance.</p>}
                            {trainingBlockers.length > 0 && !checklistConflict.canOverrideTraining && !forbidden && <p className="text-sm text-slate-600" role="status">Training compliance cannot be overridden for these results.</p>}
                            {formsEligible && <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={requestChecklistOverride} onCheckedChange={checked => setRequestChecklistOverride(checked === true)} />Request a Company Forms checklist override</label>
                                {requestChecklistOverride && <><Label htmlFor="checklist-override-reason">Reason for Company Forms override</Label><Textarea id="checklist-override-reason" value={overrideReason} onChange={event => setOverrideReason(event.target.value)} placeholder="Explain why deployment is proceeding before the forms are clear." /><p className="text-xs text-slate-600">This reason is recorded with the planning change. It does not complete any form.</p></>}
                            </div>}
                            {trainingEligible && <div className="space-y-2 rounded-md border border-slate-200 p-3">
                                <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={requestTrainingOverride} onCheckedChange={checked => setRequestTrainingOverride(checked === true)} />Request a training compliance override</label>
                                {requestTrainingOverride && <><Label htmlFor="training-override-reason">Reason for training override</Label><Textarea id="training-override-reason" value={trainingOverrideReason} onChange={event => setTrainingOverrideReason(event.target.value)} placeholder="Explain why deployment is proceeding with these training results." /><p className="text-xs text-slate-600">This reason is recorded separately from any Company Forms override.</p></>}
                            </div>}
                        </div>;
                    })()}
                    <AlertDialogFooter>
                        <AlertDialogCancel>{checklistConflict?.blockers.some(blocker => blocker.kind === "requirement" && blocker.requirementUuid) ? "Return to forms" : "Close"}</AlertDialogCancel>
                        {(requestChecklistOverride || requestTrainingOverride) && (
                            <AlertDialogAction disabled={(!requestChecklistOverride || !overrideReason.trim()) && (!requestTrainingOverride || !trainingOverrideReason.trim()) || updatePlanningV2.isPending}
                                onClick={(event) => { event.preventDefault(); void confirmChecklistOverride(); }}>
                                {updatePlanningV2.isPending ? "Saving…" : "Save planning change"}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={open && !joiningFormsOpen && !blockerForm} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-medium text-[#16569e] border-b border-[#16569e] pb-2">
                        Rank: {rank}
                    </DialogTitle>
                </DialogHeader>
                <Button type="button" variant="outline" data-testid="button-open-joining-forms"
                    onClick={() => setJoiningFormsOpen(true)}>
                    Joining forms
                </Button>

                {planningData?.relieverAssigned && (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm" data-testid="reliever-assignment-link">
                        {planningData.relieverAssignUuid ? (
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <span>Linked assignment</span>
                                    <Button type="button" variant="outline" size="sm" onClick={openLinkedAssignment} disabled={assignmentLoading}>
                                        {assignmentLoading ? "Opening…" : "Open assignment"}
                                    </Button>
                                </div>
                                {assignmentDetails && (
                                    <div className="mt-2 space-y-1" data-testid="reliever-assignment-details">
                                        <div className="font-mono text-xs break-all">{assignmentDetails.assignUuid}</div>
                                        <div>Status: {assignmentDetails.assignmentType ?? "Unknown"}</div>
                                        <div>Contract rank: {assignmentDetails.contractRankLabel || "Not recorded"}</div>
                                        <div>Planned joining date: {formatDateOnly(assignmentDetails.plannedJoiningDate) || "Absent — reliever date not set"}</div>
                                        <div>Contract range end: {assignmentDetails.contractRangeEndMonths != null ? `${assignmentDetails.contractRangeEndMonths} months` : "Absent — reliever range end not set"}</div>
                                    </div>
                                )}
                                {assignmentError && <p className="mt-2 text-red-700" role="alert">{assignmentError}</p>}
                            </>
                        ) : (
                            <p className="text-amber-800" role="status">
                                Assignment unavailable: this legacy reliever has no verified assignment link.
                                Normal unassign is unavailable without a verified assignment link.
                                {canClearUnlinked ? " Administrators may clear the planning reliever with a written reason; no assignment will be changed." : " Ask an administrator to review this legacy reliever."}
                            </p>
                        )}
                    </div>
                )}

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

                        {planningData?.relieverHasPriorJoiningPromotion && (
                            <div className="grid grid-cols-3 items-center gap-4">
                                <span className="text-sm text-gray-700">Target Rank:</span>
                                <span
                                    className="col-span-2 text-sm font-medium text-[#52baf3]"
                                    title="This crew member has an approved prior-joining promotion that takes effect on sign-on."
                                    data-testid="text-reliever-target-rank-pr"
                                >
                                    {(planningData?.relieverPromotionToRank || planningData?.rankName || planningData?.rank)} (PR)
                                </span>
                            </div>
                        )}

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
                            name="plannedConfirmedDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Planned / Confirmed Date:</FormLabel>
                                        {renderDateSelector(field)}
                                    </div>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="travelStartDate"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <FormLabel className="text-sm text-gray-700">Travel Start Date:</FormLabel>
                                        {renderDateSelector(field)}
                                    </div>
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
                                        <VesselFutureDateMessage
                                            value={field.value}
                                            message="Sign On date should not be a future date"
                                        >
                                            {renderDateSelector(
                                                field,
                                                undefined,
                                                watchedSignOnStatus === "Signed On"
                                                    ? format(new Date(), "yyyy-MM-dd")
                                                    : undefined,
                                            )}
                                        </VesselFutureDateMessage>
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
                                                <Button type="button" variant="outline" size="sm" data-testid="button-see-checklist" disabled={!isRelieverAssigned || !planningData?.planUuid} onClick={() => setHistoryOpen(true)}>
                                                    Accepted checklist history
                                                </Button>
                                            </div>
                                        </FormControl>
                                    </div>
                                </FormItem>
                            )}
                        />

                        {planningData?.relieverCrewUuid && (
                            <TrainingMatrixCompliance
                                planUuid={planningData?.planUuid}
                                assignmentUuid={planningData?.relieverAssignUuid}
                                open={open}
                            />
                        )}
                        <AcceptedChecklistHistory planUuid={planningData?.planUuid} open={historyOpen} onOpenChange={setHistoryOpen} />

                        {isRelieverAssigned && !isUnlinkedReliever && (
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

                        {isUnlinkedReliever && canClearUnlinked && (
                            <div className="space-y-2 border-t pt-3">
                                <Label htmlFor="unlinked-clear-reason">Reason for clearing this unlinked reliever</Label>
                                <Textarea id="unlinked-clear-reason" value={clearReason}
                                    onChange={event => setClearReason(event.target.value)}
                                    maxLength={2000} placeholder="Explain why this planning reliever should be cleared"
                                    data-testid="unlinked-clear-reason" />
                                <Button type="button" variant="destructive"
                                    disabled={!clearReason.trim() || isClearingUnlinked}
                                    onClick={() => { setClearUnlinkedSelected(true); setShowUnassignConfirm(true); }}
                                    data-testid="button-clear-unlinked-reliever">
                                    Clear unlinked reliever
                                </Button>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                type="submit"
                                className={unassignChecked ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                                disabled={!isRelieverAssigned || updatePlanningV2.isPending || createPlanningV2.isPending || isCheckingConflict || (!unassignChecked && watchedSignOnStatus === "Signed On" && futureDateDraft.blocked)}
                                data-testid="button-submit-relief"
                            >
                                {isCheckingConflict ? "Checking..." : unassignChecked ? "Unassign" : "Save"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={showUnassignConfirm} onOpenChange={setShowUnassignConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{clearUnlinkedSelected ? "Clear unlinked planning reliever?" : "Unassign Reliever from Vessel?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {clearUnlinkedSelected
                            ? `This will clear ${form.watch('relieverCrewName')} from this planning row and record your reason. No crew assignment will be changed.`
                            : `This will remove ${form.watch('relieverCrewName')} from the planned vessel assignment. The crew member will be returned to the crew pool and their status will remain "On Leave". This action cannot be undone.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-unassign">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleUnassignConfirm}
                        disabled={isClearingUnlinked || (clearUnlinkedSelected && !clearReason.trim())}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="button-confirm-unassign"
                    >
                        Confirm Unassign
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={Boolean(blockerForm)} onOpenChange={value => { if (!value) setBlockerForm(null); }}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>{blockerForm?.name}</DialogTitle></DialogHeader>
            {blockerForm && <RequiredFormDetails subjectRef={blockerForm.subjectRef}
              requirementUuid={blockerForm.requirementUuid} onBack={() => setBlockerForm(null)} />}
          </DialogContent>
        </Dialog>
        <Dialog open={open && joiningFormsOpen} onOpenChange={(value) => {
            if (!value) setJoiningFormsOpen(false);
        }}>
            <DialogContent className="w-[1200px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Before-joining Company Forms</DialogTitle></DialogHeader>
                {joiningFormsOpen && open && <JoiningCompanyForms
                    planUuid={planningData?.planUuid || ""}
                    assignmentUuid={planningData?.relieverAssignUuid || ""}
                    crewUuid={planningData?.relieverCrewUuid || planningData?.relieverCrewId || ""}
                    vesselUuid={vesselUuid}
                />}
                <Button type="button" variant="outline" onClick={() => setJoiningFormsOpen(false)}>Back to reliever</Button>
            </DialogContent>
        </Dialog>
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
