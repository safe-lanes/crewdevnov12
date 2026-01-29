import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VesselSideBar_v2 } from './VesselSideBar_v2';
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
                        columnDefs={vesselColumns}
                        rowData={vesselData}
                        onGridReady={(params) => {
                            gridApiRef.current = params.api;
                        }}
                        autoHeight={true}
                        maxHeight="500px"
                        minHeight="200px"
                        width="100%"
                        enableExport={true}
                        enableSideBar={true}
                    />
                </CardContent>
            </Card>
        </div>
    );

    const renderVesselDetail = () => {
        if (!selectedVessel) return null;

        const crewListData = filteredVesselPlanning.filter((p: any) => 
            showArchived ? true : !p.isArchived
        );

        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center gap-4 mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedVessel(null)}
                        data-testid="button-back-to-list"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to List
                    </Button>
                    <h2 className="text-xl font-semibold text-[#16569e]" data-testid="text-vessel-name">
                        {selectedVessel.name}
                    </h2>
                    <span className="text-sm text-gray-500">({selectedVessel.vesselType})</span>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="crew-list" data-testid="tab-crew-list">Crew List</TabsTrigger>
                        <TabsTrigger value="officer-matrix" data-testid="tab-officer-matrix">Officer Matrix</TabsTrigger>
                        <TabsTrigger value="training-matrix" data-testid="tab-training-matrix">Training Matrix</TabsTrigger>
                    </TabsList>

                    <TabsContent value="crew-list">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-4">
                                        <Checkbox
                                            id="show-archived"
                                            checked={showArchived}
                                            onCheckedChange={(checked) => setShowArchived(checked as boolean)}
                                            data-testid="checkbox-show-archived"
                                        />
                                        <Label htmlFor="show-archived">Show Archived</Label>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setComplianceDialogOpen(true)}
                                        data-testid="button-compliance-matrix"
                                    >
                                        Compliance Matrix
                                    </Button>
                                </div>

                                {ranksLoading || planningLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#16569e]"></div>
                                    </div>
                                ) : vesselRanks.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {NO_RANKS_CONFIGURED_MESSAGE}
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[500px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[150px]">Rank</TableHead>
                                                    <TableHead>Crew Name</TableHead>
                                                    <TableHead>Sign On Date</TableHead>
                                                    <TableHead>Relief Due</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {crewListData.map((planning: any, index: number) => {
                                                    const displayRank = normalizeRank(planning.rank || '');
                                                    return (
                                                        <TableRow 
                                                            key={planning.planUuid || index}
                                                            className={planning.isArchived ? 'opacity-50' : ''}
                                                            data-testid={`row-crew-${planning.planUuid || index}`}
                                                        >
                                                            <TableCell className="font-medium">{displayRank}</TableCell>
                                                            <TableCell>
                                                                {planning.crewName ? (
                                                                    <span 
                                                                        className="text-blue-600 hover:underline cursor-pointer"
                                                                        onClick={() => {
                                                                            const crew = crewMemberLookup.get(planning.crewMemberId);
                                                                            if (crew) {
                                                                                setSelectedCrewMember(crew);
                                                                                setIsCrewInfoFormOpen(true);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {planning.crewName}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400">Vacant</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{formatDateOnly(planning.signOnDate)}</TableCell>
                                                            <TableCell>{formatDateOnly(planning.reliefDue)}</TableCell>
                                                            <TableCell>
                                                                <span className={`px-2 py-1 rounded text-xs ${
                                                                    planning.isArchived 
                                                                        ? 'bg-gray-100 text-gray-600' 
                                                                        : planning.crewName 
                                                                            ? 'bg-green-100 text-green-700' 
                                                                            : 'bg-orange-100 text-orange-700'
                                                                }`}>
                                                                    {planning.isArchived ? 'Archived' : planning.crewName ? 'Active' : 'Vacant'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex gap-2">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setSelectedRankForOnBoard(planning);
                                                                                    setOnBoardDialogOpen(true);
                                                                                }}
                                                                                disabled={planning.isArchived}
                                                                                data-testid={`button-edit-onboard-${planning.planUuid}`}
                                                                            >
                                                                                <Edit className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Edit On Board Status</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="officer-matrix">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center text-gray-500 py-8">
                                    Officer Matrix - V2 Implementation
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="training-matrix">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center text-gray-500 py-8">
                                    Training Matrix - V2 Implementation
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen">
            <VesselSideBar_v2
                selectedVesselPage={selectedVesselPage}
                setSelectedVesselPage={setSelectedVesselPage}
                allowedPages={allowedPages}
            />
            
            <MainLayout>
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
                        <Button variant="outline" size="sm" className="h-8" data-testid="button-export">
                            <Download className="h-4 w-4 mr-1" />
                            Export
                        </Button>
                    </div>
                </SectionTitleComponents>
                
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
        </div>
    );
}
