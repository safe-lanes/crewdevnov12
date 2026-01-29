import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VesselSideBar_v2 } from './VesselSideBar_v2';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Edit, ArrowLeft, Download, Eye } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColDef, GridApi } from 'ag-grid-community';
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
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { z } from "zod";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import { format, addMonths, parseISO } from "date-fns";
import { ComplianceMatrixDialog_v2 } from './ComplianceMatrixDialog_v2';
import { AppraisalForm } from '@/modules/crewing/AppraisalForm';
import { CrewInfoForm } from '@/modules/crew-pool/CrewInfoForm';
import { HandoverAttachmentsDialog, getHandoverAttachmentCount } from '@/components/HandoverAttachmentsDialog';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { findHighestActiveCoc, inferDepartmentFromRank, LicenseRecord } from '@/utils/data/licenseDceTemplates';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useRankOrdering } from '@/hooks/useRankOrdering';
import { API_BASE_URL } from '@/config/api';
import { generateFALForm5Document } from '@/lib/generateFALForm5';
import { generateUSCrewListDocument } from '@/lib/generateUSCrewList';
import { VesselVersionToggle } from '../components/VersionToggle';
import { 
    useVesselPlanningV2, 
    useUpdatePlanningV2, 
    useArchivePlanningV2,
    useCreatePlanningV2 
} from './hooks/useVesselV2';
import type { VesselPlanningV2, UpdatePlanningInput } from './api/vesselApiV2';

const hasValidGmdss = (licenses: LicenseRecord[]): boolean => {
    if (!licenses || licenses.length === 0) return false;
    const gmdss = licenses.find(license => license.licenseId === 'LIC021');
    if (!gmdss) return false;
    if (!gmdss.expiry) return false;
    try {
        const expiryDate = new Date(gmdss.expiry);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return expiryDate >= today;
    } catch {
        return false;
    }
};

const TANKER_TRAINING_IDS = {
    OIL_BASIC: 'SC001',
    GAS_BASIC: 'SC002',
    OIL_ADVANCED: 'SC003',
    CHEMICAL_ADVANCED: 'SC004',
    GAS_ADVANCED: 'SC005',
    CHEMICAL_BASIC: 'SC008',
};

interface TrainingCourse {
    id?: string;
    courseId?: string;
    companyId?: string;
    trainingCourse?: string;
    expiry?: string;
}

interface TankerCertResult {
    tankerCert: string;
    splTankerTraining: string;
}

const calculateTankerCertifications = (trainingCourses: TrainingCourse[]): TankerCertResult => {
    if (!trainingCourses || !Array.isArray(trainingCourses) || trainingCourses.length === 0) {
        return { tankerCert: '', splTankerTraining: '' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validTrainings = {
        oil: { basic: false, advanced: false },
        gas: { basic: false, advanced: false },
        chemical: { basic: false, advanced: false }
    };
    trainingCourses.forEach(course => {
        const trainingId = course.companyId;
        if (!trainingId) return;
        let isValid = true;
        if (course.expiry) {
            try {
                const expiryDate = new Date(course.expiry);
                isValid = expiryDate >= today;
            } catch {
                isValid = true;
            }
        }
        if (!isValid) return;
        switch (trainingId) {
            case TANKER_TRAINING_IDS.OIL_BASIC:
                validTrainings.oil.basic = true;
                break;
            case TANKER_TRAINING_IDS.OIL_ADVANCED:
                validTrainings.oil.advanced = true;
                break;
            case TANKER_TRAINING_IDS.GAS_BASIC:
                validTrainings.gas.basic = true;
                break;
            case TANKER_TRAINING_IDS.GAS_ADVANCED:
                validTrainings.gas.advanced = true;
                break;
            case TANKER_TRAINING_IDS.CHEMICAL_BASIC:
                validTrainings.chemical.basic = true;
                break;
            case TANKER_TRAINING_IDS.CHEMICAL_ADVANCED:
                validTrainings.chemical.advanced = true;
                break;
        }
    });
    const tankerCertParts: string[] = [];
    const splTrainingParts: string[] = [];
    if (validTrainings.oil.advanced || validTrainings.oil.basic) {
        tankerCertParts.push('O');
        if (validTrainings.oil.advanced) {
            splTrainingParts.push('O(A)');
        } else {
            splTrainingParts.push('O(B)');
        }
    }
    if (validTrainings.chemical.advanced || validTrainings.chemical.basic) {
        tankerCertParts.push('C');
        if (validTrainings.chemical.advanced) {
            splTrainingParts.push('C(A)');
        } else {
            splTrainingParts.push('C(B)');
        }
    }
    if (validTrainings.gas.advanced || validTrainings.gas.basic) {
        tankerCertParts.push('G');
        if (validTrainings.gas.advanced) {
            splTrainingParts.push('G(A)');
        } else {
            splTrainingParts.push('G(B)');
        }
    }
    return {
        tankerCert: tankerCertParts.join(', '),
        splTankerTraining: splTrainingParts.join(', ')
    };
};

interface DocExpiryIssue {
    category: 'Travel Docs' | 'Visas' | 'License & DCE' | 'Training';
    name: string;
    expiry: string;
    status: 'expired' | 'expiring';
}

interface DocExpiryAnalysis {
    expiringCount: number;
    expiredCount: number;
    issues: DocExpiryIssue[];
}

const analyzeDocumentExpiry = (crewData: any): DocExpiryAnalysis => {
    const result: DocExpiryAnalysis = {
        expiringCount: 0,
        expiredCount: 0,
        issues: []
    };
    if (!crewData) return result;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoMonthsFromNow = new Date(today);
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    const analyzeItems = (
        items: any[], 
        category: DocExpiryIssue['category'], 
        nameField: string
    ) => {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
            if (!item.expiry) return;
            const expiryDate = new Date(item.expiry);
            if (isNaN(expiryDate.getTime())) return;
            if (expiryDate < today) {
                result.expiredCount++;
                result.issues.push({
                    category,
                    name: item[nameField] || 'Unknown',
                    expiry: item.expiry,
                    status: 'expired'
                });
            } else if (expiryDate <= twoMonthsFromNow) {
                result.expiringCount++;
                result.issues.push({
                    category,
                    name: item[nameField] || 'Unknown',
                    expiry: item.expiry,
                    status: 'expiring'
                });
            }
        });
    };
    analyzeItems(crewData.documents, 'Travel Docs', 'document');
    analyzeItems(crewData.visas, 'Visas', 'issuingCountry');
    analyzeItems(crewData.licenses, 'License & DCE', 'certificateDocument');
    analyzeItems(crewData.trainingCourses, 'Training', 'trainingCourse');
    return result;
};

const useVessels = () => {
    return useQuery({
        queryKey: ['/api/external/vessels'],
        queryFn: async () => {
            const domain = localStorage.getItem('domain') || 'rsms';
            const response = await fetch(
                `${API_BASE_URL}/crewmasterdata/getallmasterdata/vessels?domain=${domain}`,
                {
                    method: 'GET',
                    headers: { 'accept': '*/*' }
                }
            );
            if (!response.ok) {
                throw new Error(`Failed to fetch vessels: ${response.status}`);
            }
            const data = await response.json();
            return data.vessels || [];
        },
        staleTime: 5 * 60 * 1000,
        retry: 2,
        select: (data: any[]) => {
            return data.map((vessel: any) => ({
                id: vessel.id,
                vesselId: vessel.vuid,
                name: vessel.vessel || 'Unknown Vessel',
                vesselType: vessel.vesselType || 'Unknown Type',
            }));
        }
    });
};

const useCrewMembers = () => {
    return useQuery({
        queryKey: ['/api/crew-members'],
        select: (data: any[]) => data
    });
};

const useVesselRanks = (vesselId: string | null) => {
    return useQuery({
        queryKey: ['/api/vessel-revisions/ranks', vesselId],
        queryFn: vesselId ? () => fetch(`/api/vessel-revisions/ranks/${vesselId}`).then(res => res.json()) : undefined,
        enabled: !!vesselId,
        select: (data: any[]) => data
    });
};

const useAppraisals = () => {
    return useQuery({
        queryKey: ['/api/appraisals'],
        select: (data: any[]) => data
    });
};

const usePorts = () => {
    return useQuery({
        queryKey: ['/api/external/ports'],
        queryFn: async () => {
            const domain = localStorage.getItem('domain') || 'rsms';
            const response = await fetch(
                `${API_BASE_URL}/crewmasterdata/getallmasterdata/ports?domain=${domain}`,
                {
                    method: 'GET',
                    headers: { 'accept': '*/*' }
                }
            );
            if (!response.ok) {
                throw new Error(`Failed to fetch ports: ${response.status}`);
            }
            const data = await response.json();
            return data.ports || [];
        },
        staleTime: 5 * 60 * 1000,
        retry: 2,
        select: (data: any[]) => {
            return data
                .filter((port: any) => !port.isDeleted && port.isActive)
                .map((port: any) => ({
                    id: port.id,
                    puid: port.puid || '',
                    name: port.name || '',
                    country: port.country || '',
                    code: port.portcode || '',
                }))
                .filter((port: any) => port.name && port.puid)
                .sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
    });
};

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

const NO_RANKS_CONFIGURED_MESSAGE = "No positions configured for this vessel. Please configure positions in Admin > Rank Admin > Vessel.";

const V2_QUERY_KEY = '/api/v2/vessel';

const mapV2PlanningToLegacy = (planning: VesselPlanningV2): any => {
    return {
        id: planning.planUuid,
        planUuid: planning.planUuid,
        vesselId: planning.vesselUuid,
        vesselName: planning.vesselName,
        rankId: planning.rankId,
        rank: planning.rank,
        role: planning.rank,
        crewMemberId: planning.crewUuid,
        crewName: planning.crewName,
        onBoardCrewName: planning.crewName,
        crewStatus: planning.crewStatus,
        signOnDate: planning.signOnDate,
        joiningDate: planning.signOnDate,
        reliefDue: planning.reliefDue,
        signOffDate: planning.signOffDate,
        signOffPort: planning.signOffPortUuid,
        signOffPortName: planning.signOffPortName,
        signOffReason: planning.signOffReason,
        reliefStatus: planning.reliefStatus,
        takeOverDate: planning.takeOverDate,
        takeOverConfirmation: planning.takeOverConfirmation,
        handOverDate: planning.handOverDate,
        relieverCrewId: planning.relieverCrewUuid,
        relieverCrewName: planning.relieverCrewName,
        relieverSignOnDate: planning.relieverSignOnDate,
        joiningPort: planning.joiningPortUuid,
        joiningPortName: planning.joiningPortName,
        joiningStatus: planning.joiningStatus,
        contractPeriodMonths: planning.contractPeriodMonths,
        contractEndRangeStartMonths: planning.contractEndRangeStartMonths,
        contractEndRangeEndMonths: planning.contractEndRangeEndMonths,
        relieverContractPeriodMonths: planning.relieverContractPeriodMonths,
        relieverContractEndRangeStartMonths: planning.relieverContractEndRangeStartMonths,
        relieverContractEndRangeEndMonths: planning.relieverContractEndRangeEndMonths,
        deploymentChecklistCompleted: planning.deploymentChecklistCompleted,
        applicableDocsChecked: planning.applicableDocsChecked,
        isArchived: planning.isArchived,
        archivedDate: planning.archivedDate,
        createdAt: planning.createdAt,
        updatedAt: planning.updatedAt,
    };
};

export function VesselModule_v2(): JSX.Element {
    const queryClient = useQueryClient();
    const [selectedVesselPage, setSelectedVesselPage] = useState("vessel-database");
    const allowedPages = ["vessel-database"];
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [vesselValue, setVesselValue] = useState("");
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    const [selectedVessel, setSelectedVessel] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("crew-list");
    const [reliefDialogOpen, setReliefDialogOpen] = useState(false);
    const [selectedRankForRelief, setSelectedRankForRelief] = useState<any>(null);
    const [onBoardDialogOpen, setOnBoardDialogOpen] = useState(false);
    const [selectedRankForOnBoard, setSelectedRankForOnBoard] = useState<any>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
    const [showAppraisalForm, setShowAppraisalForm] = useState(false);
    const [selectedCrewForAppraisal, setSelectedCrewForAppraisal] = useState<any>(null);
    const [isCrewInfoFormOpen, setIsCrewInfoFormOpen] = useState(false);
    const [selectedCrewMember, setSelectedCrewMember] = useState<any>(null);
    const [docExpiryDialogOpen, setDocExpiryDialogOpen] = useState(false);
    const [docExpiryDialogData, setDocExpiryDialogData] = useState<{
        crewName: string;
        issues: DocExpiryIssue[];
    }>({ crewName: '', issues: [] });
    const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
    const [handoverDialogData, setHandoverDialogData] = useState<{
        planningId: string;
        vesselId: string;
        crewName: string;
        rank: string;
    }>({ planningId: '', vesselId: '', crewName: '', rank: '' });
    const [planningEditDialogOpen, setPlanningEditDialogOpen] = useState(false);
    const [planningEditData, setPlanningEditData] = useState<{
        planUuid: string;
        crewName: string;
        rank: string;
        type: 'onboard' | 'reliever';
        reliefDue?: string;
        plannedSignOff?: string;
        signOffPort?: string;
        reliefStatus?: string;
        relieverSignOnDate?: string;
        signOnPort?: string;
        signOnStatus?: string;
    } | null>(null);

    const { toast } = useToast();
    const gridApiRef = useRef<GridApi | null>(null);
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: crewMembers = [], isLoading: crewLoading } = useCrewMembers();
    const { data: ports = [] } = usePorts();
    
    const portLookup = useMemo(() => {
        const map = new Map<string, string>();
        ports.forEach((port: any) => {
            if (port.puid && port.name) {
                map.set(port.puid, port.name);
            }
        });
        return map;
    }, [ports]);
    
    const { filterCrewWithVariants, isVariantRank, getCanonicalRankName, normalizeRank } = useRankNormalization();
    const { getSortOrder, sortCrewByRank } = useRankOrdering(selectedVessel?.vesselId || null);
    
    const { data: availableRanks = [] } = useQuery<any[]>({
        queryKey: ['/api/available-ranks'],
    });

    const baseRankOrderMap = useMemo(() => {
        const map = new Map<string, number>();
        availableRanks.forEach((rank: any) => {
            map.set(rank.name, rank.sortOrder || 0);
        });
        return map;
    }, [availableRanks]);

    const crewMemberLookup = useMemo(() => {
        const map = new Map<string, any>();
        crewMembers.forEach((crew: any) => {
            if (crew.id) {
                map.set(crew.id, crew);
            }
        });
        return map;
    }, [crewMembers]);
    
    const { data: vesselRanksRaw = [], isLoading: ranksLoading } = useVesselRanks(selectedVessel?.vesselId || null);
    
    const vesselRanks = useMemo(() => {
        if (!vesselRanksRaw || !Array.isArray(vesselRanksRaw)) return [];
        return [...vesselRanksRaw].sort((a: any, b: any) => {
            const orderA = a.sortOrder ?? baseRankOrderMap.get(a.rank) ?? 999999;
            const orderB = b.sortOrder ?? baseRankOrderMap.get(b.rank) ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
            const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
            return aSuffix - bSuffix;
        });
    }, [vesselRanksRaw, baseRankOrderMap]);
    
    const { data: vesselPlanningV2Raw = [], isLoading: planningLoading } = useVesselPlanningV2(selectedVessel?.vesselId || null);
    
    const vesselPlanning = useMemo(() => {
        return vesselPlanningV2Raw.map(mapV2PlanningToLegacy);
    }, [vesselPlanningV2Raw]);
    
    const officerMatrixRanks = useMemo(() => {
        const officerRanks = vesselRanks.filter((rank: any) => rank.officer === true);
        const variantBaseRanks = new Set<string>();
        officerRanks.forEach((rank: any) => {
            const rankName = rank.displayRole || rank.role || rank.rank;
            if (isVariantRank(rankName)) {
                const baseRank = rankName.split('_')[0];
                variantBaseRanks.add(baseRank);
            }
        });
        return officerRanks.filter((rank: any) => {
            const rankName = rank.displayRole || rank.role || rank.rank;
            if (isVariantRank(rankName)) return true;
            return !variantBaseRanks.has(rankName);
        });
    }, [vesselRanks, isVariantRank]);
    
    const filteredVesselPlanning = useMemo(() => {
        return filterCrewWithVariants(vesselPlanning, (p: any) => p.rank || '');
    }, [vesselPlanning, filterCrewWithVariants]);
    
    const { data: allAppraisals = [] } = useAppraisals();
    
    const { data: companyTrainings = [] } = useCompanyTrainings();
    const { data: companyTrainingGroups = [] } = useCompanyTrainingGroups();
    const { data: companyTrainingRequirements = [] } = useCompanyTrainingRequirements();
    const { data: trainingMatrixRevisions = [] } = useTrainingMatrixVesselRevisions(selectedVessel?.vesselId || null);
    const { data: trainingMatrixDrafts = [] } = useTrainingMatrixVesselDraft(selectedVessel?.vesselId || null);
    
    const applicableTrainingIds = useMemo(() => {
        const ids = new Set<number>();
        [...trainingMatrixRevisions, ...trainingMatrixDrafts].forEach((entry: any) => {
            if (entry.trainingIds && Array.isArray(entry.trainingIds)) {
                entry.trainingIds.forEach((id: number) => ids.add(id));
            }
        });
        return ids;
    }, [trainingMatrixRevisions, trainingMatrixDrafts]);
    
    const groupedTrainingsForMatrix = useMemo(() => {
        const applicableTrainings = companyTrainings.filter((training: any) => 
            applicableTrainingIds.has(training.id)
        );
        const groupLabelMap = new Map<string, string>();
        companyTrainingGroups.forEach((group: any) => {
            if (group.code && group.label) {
                groupLabelMap.set(group.code, group.label);
            }
        });
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
        const sortedGroupCodes = Array.from(groupMap.keys()).sort();
        sortedGroupCodes.forEach(code => {
            const trainings = groupMap.get(code) || [];
            trainings.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
            grouped.push({
                groupCode: code,
                groupLabel: groupLabelMap.get(code) || code,
                trainings
            });
        });
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
    
    const trainingRequirementsLookup = useMemo(() => {
        const lookup = new Map<string, string>();
        companyTrainingRequirements.forEach((req: any) => {
            if (req.companyTrainingId && req.rankId && req.status) {
                lookup.set(`${req.companyTrainingId}-${req.rankId}`, req.status);
            }
        });
        return lookup;
    }, [companyTrainingRequirements]);
    
    const getTrainingRequirementStatus = (trainingId: number, vesselPosition: any): string | null => {
        let lookupRankId: number | null = null;
        if (vesselPosition.isRoleRow && vesselPosition.originalRankId) {
            lookupRankId = parseInt(vesselPosition.originalRankId, 10);
        } else if (vesselPosition.id) {
            lookupRankId = parseInt(vesselPosition.id, 10);
        } else if (vesselPosition.rankId) {
            lookupRankId = typeof vesselPosition.rankId === 'number' ? vesselPosition.rankId : parseInt(vesselPosition.rankId, 10);
        }
        if (!lookupRankId || isNaN(lookupRankId)) return null;
        return trainingRequirementsLookup.get(`${trainingId}-${lookupRankId}`) || null;
    };
    
    const getCrewTrainingComplianceStatus = (trainingCompanyId: string, vesselPosition: any): string | null => {
        const fullRankName = vesselPosition.displayRole || vesselPosition.role || vesselPosition.rank;
        const baseRankName = fullRankName?.split('_')[0];
        const rankHasSuffix = fullRankName?.includes('_');
        const rankPlanningData = vesselPlanning.find((p: any) => {
            if (p.crewStatus !== 'primary') return false;
            if (rankHasSuffix) {
                return p.rank === fullRankName;
            }
            if (p.rank === fullRankName) return true;
            if (p.rankId === vesselPosition.id || p.rankId === vesselPosition.rankId) return true;
            const planningBaseRank = p.rank?.split('_')[0];
            const planningHasSuffix = p.rank?.includes('_');
            if (!planningHasSuffix && planningBaseRank === baseRankName) return true;
            return false;
        });
        if (!rankPlanningData?.crewMemberId) return null;
        const crewData = crewMemberLookup.get(rankPlanningData.crewMemberId);
        if (!crewData) return null;
        let trainingCourses: TrainingCourse[] = [];
        if (crewData.trainingCourses) {
            try {
                trainingCourses = typeof crewData.trainingCourses === 'string' 
                    ? JSON.parse(crewData.trainingCourses) 
                    : crewData.trainingCourses;
            } catch (e) {
                trainingCourses = [];
            }
        }
        const matchingCourse = trainingCourses.find((course: TrainingCourse) => 
            course.companyId === trainingCompanyId || course.id === trainingCompanyId
        );
        if (!matchingCourse) return null;
        if (!matchingCourse.expiry) return 'green';
        try {
            const expiryDate = new Date(matchingCourse.expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const twoMonthsFromNow = new Date();
            twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
            twoMonthsFromNow.setHours(0, 0, 0, 0);
            if (expiryDate < today) return 'red';
            if (expiryDate <= twoMonthsFromNow) return 'yellow';
            return 'green';
        } catch {
            return 'green';
        }
    };
    
    const updatePlanningMutation = useUpdatePlanningV2();
    const archivePlanningMutation = useArchivePlanningV2();
    
    const handleUpdatePlanning = async (planUuid: string, data: UpdatePlanningInput) => {
        try {
            await updatePlanningMutation.mutateAsync({ planUuid, data });
            toast({
                title: "Success",
                description: "Planning updated successfully",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update planning",
                variant: "destructive",
            });
        }
    };
    
    const handleArchivePlanning = async (planUuid: string) => {
        try {
            await archivePlanningMutation.mutateAsync(planUuid);
            toast({
                title: "Success",
                description: "Planning archived successfully",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to archive planning",
                variant: "destructive",
            });
        }
    };
    
    const handleOpenPlanningEdit = (crew: any, type: 'onboard' | 'reliever', rankName: string) => {
        if (!crew) {
            toast({
                title: "No crew assigned",
                description: `No ${type === 'onboard' ? 'on-board' : 'reliever'} crew assigned to this position.`,
            });
            return;
        }
        setPlanningEditData({
            planUuid: crew.planUuid || crew.id,
            crewName: crew.crewName || '',
            rank: rankName,
            type,
            reliefDue: crew.reliefDue || '',
            plannedSignOff: crew.plannedSignOff || '',
            signOffPort: crew.signOffPort || '',
            reliefStatus: crew.reliefStatus || '',
            relieverSignOnDate: crew.relieverSignOnDate || '',
            signOnPort: crew.signOnPort || '',
            signOnStatus: crew.signOnStatus || '',
        });
        setPlanningEditDialogOpen(true);
    };
    
    const handleSavePlanningEdit = async () => {
        if (!planningEditData) return;
        
        const updateData: UpdatePlanningInput = {};
        if (planningEditData.type === 'onboard') {
            if (planningEditData.reliefDue) updateData.reliefDue = planningEditData.reliefDue;
            if (planningEditData.plannedSignOff) updateData.signOffDate = planningEditData.plannedSignOff;
            if (planningEditData.signOffPort) updateData.signOffPortUuid = planningEditData.signOffPort;
            if (planningEditData.reliefStatus) updateData.reliefStatus = planningEditData.reliefStatus;
        } else {
            if (planningEditData.relieverSignOnDate) updateData.relieverSignOnDate = planningEditData.relieverSignOnDate;
            if (planningEditData.signOnPort) updateData.joiningPortUuid = planningEditData.signOnPort;
            if (planningEditData.signOnStatus) updateData.joiningStatus = planningEditData.signOnStatus;
        }
        
        await handleUpdatePlanning(planningEditData.planUuid, updateData);
        setPlanningEditDialogOpen(false);
        setPlanningEditData(null);
    };

    // Transform vessel data to match V1 format with crew count
    const vesselData = useMemo(() => {
        // First filter vessels based on selected filter type and value
        let filteredVessels = vessels;
        
        if (filterType === "vessel" && vesselValue && vesselValue !== "_all") {
            filteredVessels = vessels.filter((vessel: any) => vessel.name === vesselValue);
        } else if (filterType === "fleet" && fleetValue) {
            filteredVessels = vessels.filter((vessel: any) => vessel.fleet === fleetValue || vessel.fleetGroup === fleetValue);
        } else if (filterType === "addGroup" && addGroupValue) {
            filteredVessels = vessels.filter((vessel: any) => vessel.addGroup === addGroupValue || vessel.additionalGroup === addGroupValue);
        }
        
        return filteredVessels.map((vessel: any) => {
            const crewCount = crewMembers.filter((crew: any) => 
                crew.presentVessel === vessel.name || 
                crew.presentVessel === vessel.vesselId
            ).length;

            return {
                id: vessel.id,
                vessel: vessel.name,
                type: vessel.vesselType,
                crewOnBoard: crewCount,
                // Keep original data for selection
                _originalVessel: vessel
            };
        });
    }, [vessels, crewMembers, filterType, vesselValue, fleetValue, addGroupValue]);

    const handleEditVessel = (data: any) => {
        // Find original vessel from transformed data
        const originalVessel = data._originalVessel || vessels.find((v: any) => v.id === data.id);
        if (originalVessel) {
            setSelectedVessel(originalVessel);
        }
    };

    const ActionsCellRenderer = (props: any) => {
        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            handleEditVessel(props.data);
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

    const vesselColumns: ColDef[] = useMemo(() => [
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

    const handleClearFilters = () => {
        setVesselValue("");
        setFleetValue("");
        setAddGroupValue("");
    };

    const renderVesselDatabase = () => (
        <div className="flex flex-col h-full">
            <SectionTitleComponents title="Vessel Database">
                <div className="flex gap-2 items-center">
                    <VesselVersionToggle />
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
                            <Select value={vesselValue} onValueChange={setVesselValue}>
                                <SelectTrigger 
                                    className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                    data-testid="select-vessel-value"
                                >
                                    <SelectValue placeholder="Vessel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_all">All Vessels</SelectItem>
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
                        columnDefs={vesselColumns}
                        onGridReady={(params) => {
                            gridApiRef.current = params.api;
                        }}
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

    const handleDownloadIMOCrewList = async () => {
        if (!selectedVessel) return;
        
        const vesselCrew = filteredVesselPlanning
            .filter((planning: any) => {
                if (!planning.crewMemberId) return false;
                return !planning.isArchived;
            })
            .sort((a: any, b: any) => {
                const aOrder = getSortOrder(a.rank);
                const bOrder = getSortOrder(b.rank);
                if (aOrder !== bOrder) return aOrder - bOrder;
                const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
                const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
                return aSuffix - bSuffix;
            });
        
        const headers = ['S.No', 'Rank', 'Surname, Given Name', 'Nationality', 'Certificate of Competency'];
        const rows = vesselCrew.map((planning: any, index: number) => {
            return [
                (index + 1).toString(),
                planning.rank?.split('_')[0] || '',
                planning.crewName || '',
                planning.nationality || '',
                ''
            ];
        });
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedVessel.name}_IMO_Crew_List.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadUSCrewList = async () => {
        if (!selectedVessel) return;
        
        const vesselCrew = filteredVesselPlanning
            .filter((planning: any) => {
                if (!planning.crewMemberId) return false;
                return !planning.isArchived;
            })
            .sort((a: any, b: any) => {
                const aOrder = getSortOrder(a.rank);
                const bOrder = getSortOrder(b.rank);
                if (aOrder !== bOrder) return aOrder - bOrder;
                const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
                const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
                return aSuffix - bSuffix;
            });
        
        const headers = ['S.No', 'Rank', 'Surname, Given Name', 'Nationality', 'Date of Birth', 'Place of Birth'];
        const rows = vesselCrew.map((planning: any, index: number) => {
            return [
                (index + 1).toString(),
                planning.rank?.split('_')[0] || '',
                planning.crewName || '',
                planning.nationality || '',
                '',
                ''
            ];
        });
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedVessel.name}_US_Crew_List.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const renderVesselDetail = () => {
        if (!selectedVessel) return null;

        const vesselCrew = filteredVesselPlanning
            .filter((planning: any) => {
                if (!planning.crewMemberId) return false;
                const isArchived = planning.isArchived === true;
                return showArchived ? isArchived : !isArchived;
            })
            .sort((a: any, b: any) => {
                const aOrder = getSortOrder(a.rank);
                const bOrder = getSortOrder(b.rank);
                if (aOrder !== bOrder) return aOrder - bOrder;
                const aSuffix = a.rank?.includes('_') ? parseInt(a.rank.split('_')[1]) || 0 : 0;
                const bSuffix = b.rank?.includes('_') ? parseInt(b.rank.split('_')[1]) || 0 : 0;
                if (aSuffix !== bSuffix) return aSuffix - bSuffix;
                const aIsPrimary = a.crewStatus === 'primary' ? 0 : 1;
                const bIsPrimary = b.crewStatus === 'primary' ? 0 : 1;
                return aIsPrimary - bIsPrimary;
            });
        
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
                                            onClick={handleDownloadIMOCrewList}
                                            data-testid="button-download-imo"
                                        >
                                            <Download className="h-4 w-4" />
                                            <span className="text-xs">IMO Crew List</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-2"
                                            onClick={handleDownloadUSCrewList}
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
                                                ) : vesselCrew.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={showArchived ? 8 : 14} className="text-center text-xs text-gray-500 py-8">
                                                            {showArchived 
                                                                ? "No archived crew members for this vessel."
                                                                : "No crew members assigned to this vessel."
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselCrew.map((planning: any, index: number) => {
                                                    const rankBase = planning.rank?.split('_')[0] || planning.rank;
                                                    const rankEntry = rankCrewMap.get(rankBase);
                                                    const hasBothCrewTypes = !!(rankEntry?.primary && rankEntry?.secondary);
                                                    const statusBadge = hasBothCrewTypes ? (planning.crewStatus === 'secondary' ? ' (S)' : ' (P)') : '';
                                                    const displayRank = rankBase + statusBadge;
                                                    
                                                    return (
                                                        <TableRow key={planning.id || planning.planUuid || index} className="hover:bg-gray-50 border-b border-gray-100">
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
                                                                    <TableCell className="text-xs text-gray-700">{formatDateOnly(planning.actualSignOffDate)}</TableCell>
                                                                    <TableCell className="text-xs text-gray-700">
                                                                        <span className="text-blue-600 hover:underline cursor-pointer">Edit</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700">
                                                                        <Eye className="h-4 w-4 text-gray-400" />
                                                                    </TableCell>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TableCell className="text-xs text-gray-700">{formatDateOnly(planning.reliefDue)}</TableCell>
                                                                    <TableCell className="text-xs text-gray-700">{formatDateOnly(planning.plannedSignOff)}</TableCell>
                                                                    <TableCell className="text-xs text-gray-700">
                                                                        {planning.docExpiringCount ? (
                                                                            <span className="text-red-600 font-medium">{planning.docExpiringCount}</span>
                                                                        ) : (
                                                                            <span className="text-gray-400">0/0</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700">
                                                                        {planning.medicalExpiring ? (
                                                                            <span className="text-red-600 font-medium">{planning.medicalExpiring}</span>
                                                                        ) : (
                                                                            <span className="text-gray-400">-</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-blue-600 hover:underline cursor-pointer">
                                                                        {planning.appraisalStatus || 'Add'}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-blue-600 hover:underline cursor-pointer">
                                                                        Add
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-gray-700">
                                                                        <Eye className="h-4 w-4 text-gray-400 cursor-pointer" />
                                                                    </TableCell>
                                                                </>
                                                            )}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="training-matrix" className="mt-0">
                            <div className="space-y-4">
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
                                {(() => {
                                    const filteredRanks = vesselRanks.filter((rank: any) => {
                                        const fullRankName = rank.displayRole || rank.role || rank.rank;
                                        const hasVariantSuffix = fullRankName?.includes('_');
                                        if (hasVariantSuffix) return true;
                                        const hasVariants = vesselRanks.some((other: any) => {
                                            const otherName = other.displayRole || other.role || other.rank;
                                            return other.rankId === rank.rankId && otherName?.includes('_');
                                        });
                                        return !hasVariants;
                                    });
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
                                                                {rank.displayRole || rank.role || rank.rank}
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
                                                                <TableRow className="bg-blue-100 hover:bg-blue-100">
                                                                    <TableCell 
                                                                        colSpan={2 + filteredRanks.length} 
                                                                        className="text-xs font-semibold text-gray-900 sticky left-0 z-20 bg-blue-100"
                                                                    >
                                                                        {group.groupCode ? `${group.groupCode}. ${group.groupLabel}` : group.groupLabel}
                                                                    </TableCell>
                                                                </TableRow>
                                                                {group.trainings.map((training: any) => (
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
                                                                            const status = getTrainingRequirementStatus(training.id, rank);
                                                                            const complianceStatus = getCrewTrainingComplianceStatus(training.companyId, rank);
                                                                            let bgColor = 'bg-white';
                                                                            if (status === 'M') {
                                                                                bgColor = 'bg-[#F0FDF4]';
                                                                            } else if (status === 'R') {
                                                                                bgColor = 'bg-blue-100';
                                                                            }
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
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <ScrollArea className="h-[calc(100vh-280px)] w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] border-r border-white/20">Rank</TableHead>
                                                    <TableHead colSpan={2} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Rank, Name & Nationality</TableHead>
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Certification & Qualification</TableHead>
                                                    <TableHead colSpan={6} className="text-white text-xs font-normal text-center sticky top-0 z-30 bg-[#52baf3] border-r-2 border-white/40">Years in Service (Today's Date)</TableHead>
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal text-center w-24 sticky top-0 z-30 bg-[#52baf3]">
                                                        <div className="flex flex-col items-center">
                                                            <span>Language</span>
                                                            <span className="text-[10px] font-light mt-0.5">English</span>
                                                        </div>
                                                    </TableHead>
                                                    <TableHead rowSpan={2} className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3]"></TableHead>
                                                </TableRow>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    <TableHead className="text-white text-xs font-normal sticky top-[41px] z-30 bg-[#52baf3]">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Nationality</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Cert. Comp.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Issuing Country</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Admin Accept</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker Cert.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-28 sticky top-[41px] z-30 bg-[#52baf3]">Spl. tanker Training</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Radio Qual.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">Company</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">Rank</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-[41px] z-30 bg-[#52baf3]">Tanker Type</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">All Types</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3]">OOW</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-[41px] z-30 bg-[#52baf3] border-r-2 border-white/40">Time o/b (months)</TableHead>
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
                                                    officerMatrixRanks.map((rank: any, index: number) => {
                                                        const fullRankName = rank.displayRole || rank.role || rank.rank;
                                                        const baseRankName = fullRankName?.split('_')[0];
                                                        const rankHasSuffix = fullRankName?.includes('_');
                                                        const rankPlanningData = vesselPlanning.find((p: any) => {
                                                            if (p.crewStatus !== 'primary') return false;
                                                            if (rankHasSuffix) {
                                                                return p.rank === fullRankName;
                                                            }
                                                            if (p.rank === fullRankName) return true;
                                                            if (p.rankId === rank.id || p.rankId === rank.rankId) return true;
                                                            const planningBaseRank = p.rank?.split('_')[0];
                                                            const planningHasSuffix = p.rank?.includes('_');
                                                            if (!planningHasSuffix && planningBaseRank === baseRankName) return true;
                                                            return false;
                                                        });
                                                        const crewMemberId = rankPlanningData?.crewMemberId;
                                                        const crewMemberData = crewMemberId ? crewMemberLookup.get(crewMemberId) : null;
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
                                                        const rankDepartment = inferDepartmentFromRank(fullRankName);
                                                        const highestCoc = findHighestActiveCoc(licenses, rankDepartment);
                                                        let trainingCourses: TrainingCourse[] = [];
                                                        if (crewMemberData?.trainingCourses) {
                                                            try {
                                                                trainingCourses = typeof crewMemberData.trainingCourses === 'string' 
                                                                    ? JSON.parse(crewMemberData.trainingCourses) 
                                                                    : crewMemberData.trainingCourses;
                                                            } catch (e) {
                                                                trainingCourses = [];
                                                            }
                                                        }
                                                        const tankerCerts = calculateTankerCertifications(trainingCourses);
                                                        let companyYears = 0;
                                                        if (crewMemberData?.currentCompanySeaService) {
                                                            try {
                                                                const companySeaService = typeof crewMemberData.currentCompanySeaService === 'string' 
                                                                    ? JSON.parse(crewMemberData.currentCompanySeaService) 
                                                                    : crewMemberData.currentCompanySeaService;
                                                                if (Array.isArray(companySeaService) && companySeaService.length > 0) {
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
                                                                    {rank.displayRole || rank.role || rank.rank}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-name-${index + 1}`}>
                                                                    {rankPlanningData?.crewName || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-nationality-${index + 1}`}>
                                                                    {rankPlanningData?.nationality || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-cert-comp-${index + 1}`}>
                                                                    {highestCoc?.officerMatrixLabel || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-issuing-country-${index + 1}`}>
                                                                    {highestCoc?.issuingCountry || ''}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-admin-accept-${index + 1}`}>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-tanker-${index + 1}`}>
                                                                    {tankerCerts.tankerCert}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-spl-tanker-${index + 1}`}>
                                                                    {tankerCerts.splTankerTraining}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-gray-700 border-r-2 border-gray-200" data-testid={`cell-officer-radio-${index + 1}`}>
                                                                    {rankDepartment === 'deck' && hasValidGmdss(licenses) ? 'Yes' : ''}
                                                                </TableCell>
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
                                                                <TableCell className="text-xs text-gray-700" data-testid={`cell-officer-language-${index + 1}`}>
                                                                    {crewMemberData?.englishProficiency || ''}
                                                                </TableCell>
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
                                                    const normalizedRows: any[] = [];
                                                    
                                                    const filteredVesselRanks = vesselRanks.filter((rank: any) => {
                                                        const fullRankName = rank.displayRole || rank.role || rank.rank;
                                                        const hasVariantSuffix = fullRankName?.includes('_');
                                                        
                                                        if (hasVariantSuffix) return true;
                                                        
                                                        const hasVariants = vesselRanks.some((other: any) => {
                                                            const otherName = other.displayRole || other.role || other.rank;
                                                            return other.rankId === rank.rankId && otherName?.includes('_');
                                                        });
                                                        
                                                        return !hasVariants;
                                                    });
                                                    
                                                    filteredVesselRanks.forEach((rank: any, rankIndex: number) => {
                                                        const fullRankName = rank.displayRole || rank.role || rank.rank;
                                                        const baseRankName = fullRankName?.split('_')[0];
                                                        
                                                        const rankHasSuffix = fullRankName?.includes('_');
                                                        
                                                        const matchingRecords = vesselPlanning.filter((p: any) => {
                                                            if (p.isArchived) return false;
                                                            
                                                            if (rankHasSuffix) {
                                                                return p.rank === fullRankName;
                                                            }
                                                            
                                                            if (p.rank === fullRankName) return true;
                                                            if (p.rankId === rank.id || p.rankId === rank.rankId) return true;
                                                            
                                                            const planningBaseRank = p.rank?.split('_')[0];
                                                            const planningHasSuffix = p.rank?.includes('_');
                                                            if (!planningHasSuffix && planningBaseRank === baseRankName) return true;
                                                            
                                                            return false;
                                                        });
                                                        
                                                        const primaryCrew = matchingRecords.find((p: any) => p.crewStatus === 'primary');
                                                        const secondaryCrew = matchingRecords.find((p: any) => p.crewStatus === 'secondary');
                                                        
                                                        normalizedRows.push({
                                                            serialNumber: rankIndex + 1,
                                                            rank,
                                                            rankName: baseRankName,
                                                            primaryCrew,
                                                            secondaryCrew
                                                        });
                                                    });
                                                    
                                                    if (normalizedRows.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={13} className="text-center text-xs text-gray-500 py-8">
                                                                    No ranks configured for this vessel.
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }
                                                    
                                                    return normalizedRows.map((row: any, index: number) => (
                                                        <TableRow key={row.rank.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                            <TableCell className="text-xs text-gray-700">{row.serialNumber}.</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{row.rankName}</TableCell>
                                                            
                                                            {/* On Board Status */}
                                                            <TableCell className="text-xs text-gray-700">{row.primaryCrew?.crewName || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{formatDateOnly(row.primaryCrew?.reliefDue)}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{formatDateOnly(row.primaryCrew?.plannedSignOff)}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{row.primaryCrew?.signOffPort || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{row.primaryCrew?.reliefStatus || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handleOpenPlanningEdit(row.primaryCrew, 'onboard', row.rankName)}
                                                                    data-testid={`button-edit-onboard-${index}`}
                                                                >
                                                                    <Edit className="h-4 w-4 text-gray-400 cursor-pointer hover:text-blue-600" />
                                                                </Button>
                                                            </TableCell>
                                                            
                                                            {/* Reliever Status */}
                                                            <TableCell className="text-xs text-gray-700">{row.secondaryCrew?.crewName || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{formatDateOnly(row.secondaryCrew?.relieverSignOnDate)}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{row.secondaryCrew?.signOnPort || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">{row.secondaryCrew?.signOnStatus || ''}</TableCell>
                                                            <TableCell className="text-xs text-gray-700">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handleOpenPlanningEdit(row.secondaryCrew, 'reliever', row.rankName)}
                                                                    data-testid={`button-edit-reliever-${index}`}
                                                                >
                                                                    <Edit className="h-4 w-4 text-gray-400 cursor-pointer hover:text-blue-600" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        );
    };

    return (
        <div data-testid="vessel-container">
            <VesselSideBar_v2
                selectedVesselPage={selectedVesselPage}
                setSelectedVesselPage={setSelectedVesselPage}
                allowedPages={allowedPages}
            />
            
            <MainLayout hasSidebar={true}>
                {selectedVessel ? renderVesselDetail() : renderVesselDatabase()}
            </MainLayout>

            <ComplianceMatrixDialog_v2
                open={complianceDialogOpen}
                onOpenChange={setComplianceDialogOpen}
                vesselId={selectedVessel?.vesselId}
            />

            {showAppraisalForm && selectedCrewForAppraisal && (
                <AppraisalForm
                    crewMember={selectedCrewForAppraisal}
                    appraisalId={selectedCrewForAppraisal._appraisalId}
                    initialStatus={selectedCrewForAppraisal._initialStatus as 'draft' | 'preliminary' | 'submitted' | 'reviewed' | undefined}
                    onClose={() => {
                        setShowAppraisalForm(false);
                        setSelectedCrewForAppraisal(null);
                    }}
                />
            )}

            <CrewInfoForm
                isOpen={isCrewInfoFormOpen}
                onClose={() => {
                    setIsCrewInfoFormOpen(false);
                    setSelectedCrewMember(null);
                }}
                crewMember={selectedCrewMember}
            />

            <Dialog open={docExpiryDialogOpen} onOpenChange={setDocExpiryDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-[#16569e]" data-testid="dialog-title-doc-expiry">
                            Document Expiry Issues - {docExpiryDialogData.crewName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        {docExpiryDialogData.issues.length > 0 ? (
                            <div className="space-y-2">
                                {docExpiryDialogData.issues.map((issue, idx) => (
                                    <div 
                                        key={idx} 
                                        className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                                        data-testid={`doc-expiry-issue-${idx}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{issue.name}</span>
                                            <span className="text-xs text-muted-foreground">{issue.category}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">
                                                {format(new Date(issue.expiry), 'dd-MMM-yyyy')}
                                            </span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                                issue.status === 'expired' 
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' 
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                            }`}>
                                                {issue.status === 'expired' ? 'Expired' : 'Expiring'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No document expiry issues found.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <HandoverAttachmentsDialog
                open={handoverDialogOpen}
                onOpenChange={setHandoverDialogOpen}
                planningId={handoverDialogData.planningId as any}
                vesselId={handoverDialogData.vesselId}
                crewName={handoverDialogData.crewName}
                rank={handoverDialogData.rank}
                onAttachmentsChanged={() => {
                    queryClient.invalidateQueries({ queryKey: [V2_QUERY_KEY, handoverDialogData.vesselId, 'planning'] });
                }}
            />
            
            <Dialog open={planningEditDialogOpen} onOpenChange={setPlanningEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-[#16569e]" data-testid="dialog-title-planning-edit">
                            Edit {planningEditData?.type === 'onboard' ? 'On Board Status' : 'Reliever Status'} - {planningEditData?.rank}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                        <div className="text-sm font-medium text-gray-600">
                            Crew: {planningEditData?.crewName}
                        </div>
                        {planningEditData?.type === 'onboard' ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Relief Due</Label>
                                    <Input 
                                        type="date" 
                                        value={planningEditData?.reliefDue?.split('T')[0] || ''} 
                                        onChange={(e) => setPlanningEditData(prev => prev ? {...prev, reliefDue: e.target.value} : null)}
                                        data-testid="input-relief-due"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Planned Sign Off</Label>
                                    <Input 
                                        type="date" 
                                        value={planningEditData?.plannedSignOff?.split('T')[0] || ''} 
                                        onChange={(e) => setPlanningEditData(prev => prev ? {...prev, plannedSignOff: e.target.value} : null)}
                                        data-testid="input-planned-signoff"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sign Off Port</Label>
                                    <Select 
                                        value={planningEditData?.signOffPort || ''} 
                                        onValueChange={(val) => setPlanningEditData(prev => prev ? {...prev, signOffPort: val} : null)}
                                    >
                                        <SelectTrigger data-testid="select-signoff-port">
                                            <SelectValue placeholder="Select port" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ports.map((port: any) => (
                                                <SelectItem key={port.puid} value={port.puid}>
                                                    {port.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Relief Status</Label>
                                    <Select 
                                        value={planningEditData?.reliefStatus || ''} 
                                        onValueChange={(val) => setPlanningEditData(prev => prev ? {...prev, reliefStatus: val} : null)}
                                    >
                                        <SelectTrigger data-testid="select-relief-status">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Sign On Date</Label>
                                    <Input 
                                        type="date" 
                                        value={planningEditData?.relieverSignOnDate?.split('T')[0] || ''} 
                                        onChange={(e) => setPlanningEditData(prev => prev ? {...prev, relieverSignOnDate: e.target.value} : null)}
                                        data-testid="input-reliever-signon-date"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sign On Port</Label>
                                    <Select 
                                        value={planningEditData?.signOnPort || ''} 
                                        onValueChange={(val) => setPlanningEditData(prev => prev ? {...prev, signOnPort: val} : null)}
                                    >
                                        <SelectTrigger data-testid="select-signon-port">
                                            <SelectValue placeholder="Select port" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ports.map((port: any) => (
                                                <SelectItem key={port.puid} value={port.puid}>
                                                    {port.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Sign On Status</Label>
                                    <Select 
                                        value={planningEditData?.signOnStatus || ''} 
                                        onValueChange={(val) => setPlanningEditData(prev => prev ? {...prev, signOnStatus: val} : null)}
                                    >
                                        <SelectTrigger data-testid="select-signon-status">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Confirmed">Confirmed</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setPlanningEditDialogOpen(false);
                                    setPlanningEditData(null);
                                }}
                                data-testid="button-cancel-planning-edit"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSavePlanningEdit}
                                data-testid="button-save-planning-edit"
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
