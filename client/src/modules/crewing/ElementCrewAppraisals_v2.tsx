import {
  EditIcon,
  EyeIcon,
  FilterIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { appraisalsApiV2 } from "./api/appraisalsApiV2";
import { AppraisalView } from "./AppraisalView_v2";
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
import { useViewport } from "@/hooks/useViewport";
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import { AppraisalForm } from "./AppraisalForm_v2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppraisalResult } from "@shared/schema";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import SideBarComponent from "@/components/Navbar/SideBarComponent";
import MainLayout from "@/components/main/MainLayout";
import { usePermissions } from '@/contexts/PermissionsContext';
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { useVesselsV2, useVesselTypesV2, useNationalitiesV2, useAppraisalTypesV2 } from "@/hooks/v2/useMasterDataV2";
import { useCompanyRanksV2 } from "@/modules/admin/hooks/useAdminV2";
import { useRankScope } from "@/hooks/useRankScope";
import { getBaseRank } from "@shared/crew-mapping";


// Interface for combined crew member and appraisal data
interface CrewAppraisalData {
  id: string;
  employeeId: string;
  name: { first: string; middle: string; last: string };
  rank: string;
  nationality: string;
  age: string;
  vessel: string;
  vesselType: string;
  signOn: string;
  appraisalType: string;
  appraisalDate: string;
  status: string;
  isTerminated?: boolean;
  competenceRating: { value: string; color: string };
  behavioralRating: { value: string; color: string };
  overallRating: { value: string; color: string };
  appraisalId?: number;
  appraisalUuid?: string;
  _openedFromDeepLink?: boolean;
}

// Status badge component - moved outside component to avoid hooks issues
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = '';
  let textColor = '';
  let displayText = '';

  if (status === 'preliminary') {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-700';
    displayText = 'Preliminary';
  } else if (status === 'submitted') {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
    displayText = 'Submitted';
  } else if (status === 'reviewed') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-700';
    displayText = 'Reviewed';
  } else {
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-700';
    displayText = status || 'N/A';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-semibold ${bgColor} ${textColor} min-w-[90px] text-center`}>
      {displayText}
    </Badge>
  );
};

// Rating badge component - moved outside component to avoid hooks issues
const RatingBadge = ({ value, color }: { value: string; color: string }) => {
  const numValue = parseFloat(value);
  const formattedValue = numValue.toFixed(1);
  let bgColor = '';
  let textColor = '';

  if (numValue >= 4.0) {
    bgColor = 'bg-[#c3f2cb]';
    textColor = 'text-[#286e34]';
  } else if (numValue >= 3.0) {
    bgColor = 'bg-[#ffeaa7]';
    textColor = 'text-[#814c02]';
  } else if (numValue >= 2.0) {
    bgColor = 'bg-[#f9ecef]';
    textColor = 'text-[#811f1a]';
  } else {
    bgColor = 'bg-red-600';
    textColor = 'text-white';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-bold ${bgColor} ${textColor} min-w-[48px] text-center`}>
      {formattedValue}
    </Badge>
  );
};

// Cell renderers moved outside component to avoid hooks issues
const StatusCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  return <StatusBadge status={params.value || 'N/A'} />;
};

const RatingCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  if (params.value === "N/A") {
    return <Badge className="rounded-md px-2.5 py-1 font-bold bg-gray-400 text-white min-w-[48px] text-center">N/A</Badge>;
  }
  return <RatingBadge value={params.value} color={params.data.competenceRating.color} />;
};

const ActionsCellRenderer = (params: ICellRendererParams & { context: { handleEditClick: (data: CrewAppraisalData) => void; handleViewClick: (data: CrewAppraisalData) => void; handleDeleteClick: (data: CrewAppraisalData) => void; canEditPerm: boolean; canDeletePerm: boolean; canActOnRank: (rank: string | null | undefined) => boolean } }) => {
  if (!params.colDef || !params.data) return null;
  const appraisalId = params.data.appraisalId;
  const canAct = params.context.canActOnRank(params.data.rank);

  return (
    <div className="flex gap-2 justify-center">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => { if (canAct) params.context.handleViewClick(params.data); }}
        disabled={!canAct}
        data-testid={`button-view-appraisal-${appraisalId}`}
      >
        <EyeIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      {params.context.canEditPerm && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => { if (canAct) params.context.handleEditClick(params.data); }}
        disabled={!canAct}
        data-testid={`button-edit-appraisal-${appraisalId}`}
      >
        <EditIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      )}
      {params.context.canDeletePerm && (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => { if (canAct) params.context.handleDeleteClick(params.data); }}
        disabled={!canAct}
        data-testid={`button-delete-appraisal-${appraisalId}`}
      >
        <Trash2Icon className="h-[18px] w-[18px] text-red-600 hover:text-red-700" />
      </Button>
      )}
    </div>
  );
};

export const ElementCrewAppraisals_v2 = (): JSX.Element => {
  const { canEdit, canDelete, permissions, userType, myVessels } = usePermissions();
  const isShipUser = userType === 'Ship';

  const { allowedRanks, shouldRestrictForShipUser } = useRankScope();
  const canActOnRank = useCallback((rank: string | null | undefined) => {
    if (!shouldRestrictForShipUser) return true;
    if (!rank) return false;
    return allowedRanks.includes(rank) || allowedRanks.includes(getBaseRank(rank));
  }, [allowedRanks, shouldRestrictForShipUser]);
  const viewport = useViewport();
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';
  const isSmallScreen = isPhone || isTablet;

  const { toast } = useToast();
  const [selectedAdminPage, setSelectedAdminPage] = useState("all");
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewAppraisalData | null>(null);
  const [showAppraisalForm, setShowAppraisalForm] = useState(false);
  const [viewingAppraisal, setViewingAppraisal] = useState<CrewAppraisalData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrewAppraisalData | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    searchName: "",
    rank: "",
    vessel: "",
    vesselType: "",
    nationality: "",
    appraisalType: "",
    rating: ""
  });

  // Vessel lookup for ID to name translation
  const { getVesselName } = useVesselLookup();

  // Appraisal Types for filter dropdown (sourced from same master as the form)
  const { data: appraisalTypesRaw = [], isLoading: isLoadingAppraisalTypes } = useAppraisalTypesV2();
  const appraisalTypeOptions = useMemo<{ value: string; label: string }[]>(() => {
    const entries = appraisalTypesRaw as Array<{ name?: unknown }>;
    const names = entries
      .map((entry) => entry?.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0);
    if (names.length > 0) {
      return names.map((name) => ({ value: name, label: name }));
    }
    // Fallback mirrors the appraisal form (PartA.tsx) when master is empty
    return [
      { value: "End of Contract", label: "End of Contract" },
      { value: "Mid Term", label: "Mid Term" },
      { value: "Special", label: "Special" },
      { value: "Probation", label: "Probation" },
    ];
  }, [appraisalTypesRaw]);

  const renderAppraisalTypeOptions = () => {
    if (isLoadingAppraisalTypes) {
      return <SelectItem value="loading" disabled>Loading...</SelectItem>;
    }
    return appraisalTypeOptions.map((option) => (
      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
    ));
  };

  const { data: appraisalResults = [], isLoading: isLoadingAppraisals } = useQuery<AppraisalResult[]>({
    queryKey: ["/api/v2/appraisals"],
    queryFn: async () => {
      const response = await fetch("/api/v2/appraisals");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const { data: crewPoolData = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/crew-pool/crew"],
  });

  // Fetch company ranks for filters from V2 admin endpoint
  const { data: companyRanksV2Data = [] } = useCompanyRanksV2();
  const availableRankOptions = useMemo(() => {
    const seen = new Set<string>();
    return (companyRanksV2Data as any[])
      .map((r: any) => r.rank || r.label || r.name)
      .filter((name: string) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map((name: string) => ({ value: name, label: name }));
  }, [companyRanksV2Data]);

  // Use V2 Masters for vessels
  const { data: vesselsV2Data = [] } = useVesselsV2();

  const vesselMasterData = useMemo(() => {
    if (vesselsV2Data && vesselsV2Data.length > 0) {
      return (vesselsV2Data as any[]).map((v: any, index: number) => ({
        entryId: v.uuid || v.vuid || v.id || `vessel-${index}`,
        name: v.name || v.vessel || 'Unknown Vessel'
      }));
    }
    return [];
  }, [vesselsV2Data]);

  const shipUserVesselName = useMemo(() => {
    if (!isShipUser || myVessels.length === 0) return null;
    return myVessels[0].vessel;
  }, [isShipUser, myVessels]);

  useEffect(() => {
    if (isShipUser && myVessels.length > 0 && !filters.vessel) {
      const myVesselName = myVessels[0].vessel;
      const matched = vesselMasterData.find((v) => v.name === myVesselName);
      if (matched) {
        setFilters(prev => ({ ...prev, vessel: matched.name }));
      }
    }
  }, [isShipUser, myVessels, vesselMasterData, filters.vessel]);

  // Use V2 Masters for vessel types
  const { data: vesselTypesV2Data = [] } = useVesselTypesV2();

  const { data: nationalitiesV2Data = [] } = useNationalitiesV2();

  const uniqueNationalities = useMemo(() => {
    if ((nationalitiesV2Data as any[]).length > 0) {
      return (nationalitiesV2Data as any[]).map((entry: any) => ({
        entryId: entry.uuid || entry.natUuid || entry.id,
        name: entry.name,
        countryName: entry.name
      }));
    }
    return [];
  }, [nationalitiesV2Data]);

  const uniqueVesselTypes = useMemo(() => {
    if ((vesselTypesV2Data as any[]).length > 0) {
      return (vesselTypesV2Data as any[]).map((vt: any) => ({
        entryId: vt.uuid || vt.entryId || vt.id,
        name: vt.name
      }));
    }
    return [];
  }, [vesselTypesV2Data]);

  const handleEditClick = useCallback((crewMember: CrewAppraisalData) => {
    setSelectedCrewMember(crewMember);
    setShowAppraisalForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowAppraisalForm(false);
    setSelectedCrewMember(null);
  }, []);

  const handleViewClick = useCallback((crewMember: CrewAppraisalData) => {
    setViewingAppraisal(crewMember);
  }, []);

  const handleCloseView = useCallback(() => {
    const wasDeepLink = viewingAppraisal?._openedFromDeepLink === true;
    setViewingAppraisal(null);
    if (wasDeepLink && typeof window !== "undefined") {
      // Pop back to the dashboard URL with ?drilldown=crew-appraisals&rank=...
      // so the popup re-opens itself from those params.
      window.history.back();
    }
  }, [viewingAppraisal]);

  const handleDeleteClick = useCallback((crewMember: CrewAppraisalData) => {
    setDeleteTarget(crewMember);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (vars: { id: number; name: string }) => {
      await appraisalsApiV2.delete(vars.id);
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/appraisals'] });
      toast({
        title: 'Appraisal deleted',
        description: vars.name ? `Removed appraisal for ${vars.name}.` : 'The appraisal was removed.',
      });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({
        title: 'Failed to delete appraisal',
        description: message,
        variant: 'destructive',
      });
      setDeleteTarget(null);
    },
  });

  const confirmDelete = useCallback(() => {
    if (deleteTarget?.appraisalId == null) return;
    const name = `${deleteTarget.name.first} ${deleteTarget.name.middle} ${deleteTarget.name.last}`
      .replace(/\s+/g, ' ').trim();
    deleteMutation.mutate({ id: deleteTarget.appraisalId, name });
  }, [deleteTarget, deleteMutation]);


  // Helper function to get rating color based on value
  const getRatingColor = useCallback((rating: string): string => {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return "bg-[#c3f2cb] text-[#286e34]"; // Green
    if (numRating >= 3.0) return "bg-[#ffeaa7] text-[#814c02]"; // Yellow
    if (numRating >= 2.0) return "bg-[#f9ecef] text-[#811f1a]"; // Light Pink
    return "bg-red-600 text-white"; // Dark Red
  }, []);

  const crewByUuid = useMemo(() => {
    const map = new Map<string, any>();
    crewPoolData.forEach((c: any) => { if (c.crewUuid) map.set(c.crewUuid, c); });
    return map;
  }, [crewPoolData]);

  const vesselTypeByName = useMemo(() => {
    const map = new Map<string, string>();
    (vesselsV2Data as any[]).forEach((v: any) => {
      if (v.name && v.vesselType) map.set(v.name, v.vesselType);
    });
    return map;
  }, [vesselsV2Data]);

  const calculateAge = useCallback((dob: string): string => {
    if (!dob) return "";
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age > 0 ? String(age) : "";
  }, []);

  const allCrewData: CrewAppraisalData[] = useMemo(() =>
    appraisalResults.map((appraisal) => {
      let appraisalData: any = {};
      try {
        appraisalData = typeof appraisal.appraisalData === 'string'
          ? JSON.parse(appraisal.appraisalData || '{}')
          : (appraisal.appraisalData || {});
      } catch { appraisalData = {}; }

      const seafarerName = appraisalData.seafarersName || "";
      const nameParts = seafarerName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

      const vesselName = appraisalData.vessel ? getVesselName(appraisalData.vessel) || appraisalData.vessel : "";

      const crew = crewByUuid.get(appraisal.crewMemberId || "");
      const age = crew?.dob ? calculateAge(crew.dob) : "";
      const vesselType = vesselTypeByName.get(vesselName) || "";

      // Overall score must only appear on the outside table AFTER Stage 2 is
      // submitted — not from Save and not from Save Draft. In 'draft' and
      // 'preliminary' (Stage 1) it must stay N/A. Saving still stores the
      // value as before; this only controls when the table displays it.
      const isPreStage2 =
        !appraisal.status ||
        appraisal.status === 'draft' ||
        appraisal.status === 'preliminary';

      const showOverall = !isPreStage2 && !!appraisal.overallRating;

      return {
        id: appraisal.crewMemberId || String(appraisal.id),
        employeeId: appraisal.crewMemberId || "",
        name: {
          first: firstName,
          middle: middleName,
          last: lastName,
        },
        rank: appraisalData.seafarersRank || "",
        nationality: appraisalData.nationality || "",
        age,
        vessel: vesselName,
        vesselType,
        signOn: appraisalData.signOn || "",
        appraisalType: appraisal.appraisalType || appraisalData.appraisalType || "",
        appraisalDate: appraisal.appraisalDate || "",
        status: appraisal.status || "draft",
        isTerminated: ((crew?.status as string) || '').startsWith('Terminated'),
        competenceRating: {
          value: appraisal.competenceRating || "N/A",
          color: appraisal.competenceRating ? getRatingColor(appraisal.competenceRating) : "bg-gray-400 text-white",
        },
        behavioralRating: {
          value: appraisal.behavioralRating || "N/A",
          color: appraisal.behavioralRating ? getRatingColor(appraisal.behavioralRating) : "bg-gray-400 text-white",
        },
        overallRating: {
          value: showOverall ? appraisal.overallRating : "N/A",
          color: showOverall ? getRatingColor(appraisal.overallRating) : "bg-gray-400 text-white",
        },
        appraisalId: appraisal.id,
        appraisalUuid: appraisal.appraisalUuid,
      };
    }), [appraisalResults, getRatingColor, getVesselName, crewByUuid, vesselTypeByName, calculateAge]);

  // Deep-link entry: dashboard's Crew Appraisals drill-down popup links to
  // /?appraisal=<appraisalUuid>. Find the matching row and open the read-only
  // AppraisalView, tagged so the close handler can history.back() to the popup.
  const [pendingAppraisalUuid, setPendingAppraisalUuid] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("appraisal");
  });

  useEffect(() => {
    if (!pendingAppraisalUuid) return;
    if (isLoadingAppraisals) return;
    const found = allCrewData.find((c) => c.appraisalUuid === pendingAppraisalUuid);
    if (found && found.appraisalId != null) {
      setViewingAppraisal({ ...found, _openedFromDeepLink: true });
    }
    setPendingAppraisalUuid(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("appraisal")) {
        params.delete("appraisal");
        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [pendingAppraisalUuid, isLoadingAppraisals, allCrewData]);

  // Filter crew data based on filter state
  const crewData = useMemo(() =>
    allCrewData.filter((crew) => {
      // Only show crew members who have at least Stage 1 submitted (status: Preliminary, Submitted, or Reviewed)
      const status = crew.status.toLowerCase();
      if (!['preliminary', 'submitted', 'reviewed'].includes(status)) {
        return false;
      }

      // Terminated crew: only fully completed appraisals (Part G submitted,
      // status 'reviewed') remain visible for history.
      if (crew.isTerminated && status !== 'reviewed') {
        return false;
      }
      
      const fullName = `${crew.name.first} ${crew.name.middle} ${crew.name.last}`.toLowerCase();

      // Name search filter
      if (filters.searchName && !fullName.includes(filters.searchName.toLowerCase())) {
        return false;
      }

      // Rank filter
      if (filters.rank && crew.rank.toLowerCase() !== filters.rank.toLowerCase()) {
        return false;
      }

      // Vessel filter
      if (filters.vessel && crew.vessel.toLowerCase() !== filters.vessel.toLowerCase()) {
        return false;
      }

      // Vessel type filter
      if (filters.vesselType && crew.vesselType.toLowerCase() !== filters.vesselType.toLowerCase()) {
        return false;
      }

      // Nationality filter
      if (filters.nationality && crew.nationality.toLowerCase() !== filters.nationality.toLowerCase()) {
        return false;
      }

      // Appraisal type filter
      if (filters.appraisalType && crew.appraisalType.toLowerCase() !== filters.appraisalType.toLowerCase()) {
        return false;
      }

      // Rating filter
      if (filters.rating) {
        const rating = parseFloat(crew.overallRating.value);
        if (crew.overallRating.value === "N/A" || Number.isNaN(rating)) return false;
        if (filters.rating === "high" && rating < 4.0) return false;
        if (filters.rating === "medium" && (rating < 3.0 || rating >= 4.0)) return false;
        if (filters.rating === "low" && rating >= 3.0) return false;
      }

      return true;
    }), [allCrewData, filters]);

  // Column definitions for AG Grid with Enterprise features
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'employeeId',
      flex: 0.7,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      hide: true
    },
    {
      headerName: 'Name',
      field: 'fullName',
      flex: 1.2,
      valueGetter: (params) => `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Rank',
      field: 'rank',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Age',
      field: 'age',
      flex: 0.5,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: true
    },
    {
      headerName: 'Vessel',
      field: 'vessel',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Type',
      field: 'vesselType',
      flex: 0.7,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Sign-On',
      field: 'signOn',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'App. Type',
      field: 'appraisalType',
      flex: 0.9,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'App. Date',
      field: 'appraisalDate',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.9,
      cellRenderer: StatusCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Comp. Rating',
      field: 'competenceRating.value',
      flex: 0.9,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg',
      hide: true
    },
    {
      headerName: 'Behav. Rating',
      field: 'behavioralRating.value',
      flex: 0.9,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg',
      hide: true
    },
    {
      headerName: 'Overall',
      field: 'overallRating.value',
      flex: 0.7,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg'
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.6,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center'
    }
  ], []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    // Auto-size columns to fit the available space
    params.api.sizeColumnsToFit();
    
    // Add window resize listener for responsive behavior
    const handleResize = () => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Early return after all hooks
  if (isLoadingAppraisals) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading crew appraisals...</div>
      </div>
    );
  }

  return (
    <div data-testid="appraisals-container">
      <SideBarComponent 
        selectedAdminPage={selectedAdminPage} 
        setSelectedAdminPage={setSelectedAdminPage} 
        allowedPages={["all"]}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />
      <MainLayout hasSidebar={true}>
        <div className="lg:hidden flex items-center gap-2 mb-4">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#16569e] bg-white border border-[#16569e] rounded hover:bg-[#16569e] hover:text-white transition-colors"
            data-testid="mobile-sidebar-toggle"
          >
            <span>☰</span>
            <span>Menu</span>
          </button>
        </div>
        <SectionTitleComponents title="Crew Appraisals">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-toggle-filters"
            >
              <FilterIcon className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </SectionTitleComponents>
        {/* Filters Section */}
        {showFilters && (
          <div className="mb-4 p-3 md:p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
            {/* Desktop/Laptop: Horizontal flex layout */}
            {!isSmallScreen && (
              <div className="flex flex-nowrap items-center gap-3">
                <Input
                  placeholder="Search by name..."
                  className="h-8 w-48 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] shrink-0"
                  value={filters.searchName}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                  data-testid="input-search-name"
                />

                <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                  <SelectTrigger className="h-8 w-28 text-xs text-[#0f172a] shrink-0" data-testid="select-rank">
                    <SelectValue placeholder="Rank" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRankOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isShipUser ? (
                  <div className="h-8 w-28 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 shrink-0" data-testid="vessel-name-ship-user">
                    {shipUserVesselName || 'No vessel'}
                  </div>
                ) : (
                  <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                    <SelectTrigger className="h-8 w-28 text-xs text-[#0f172a] shrink-0" data-testid="select-vessel">
                      <SelectValue placeholder="Vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      {vesselMasterData.map((vessel) => (
                        <SelectItem key={vessel.entryId} value={vessel.name}>{vessel.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                  <SelectTrigger className="h-8 w-28 text-xs text-[#0f172a] shrink-0" data-testid="select-vessel-type">
                    <SelectValue placeholder="Vessel Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueVesselTypes.map((vesselType) => (
                      <SelectItem key={vesselType.entryId} value={vesselType.name}>{vesselType.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                  <SelectTrigger className="h-8 w-28 text-xs text-[#0f172a] shrink-0" data-testid="select-nationality">
                    <SelectValue placeholder="Nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueNationalities.map((nationality) => (
                      <SelectItem key={nationality.entryId} value={nationality.countryName || nationality.name}>{nationality.countryName || nationality.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                  <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] shrink-0" data-testid="select-appraisal-type">
                    <SelectValue placeholder="Appraisal Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {renderAppraisalTypeOptions()}
                  </SelectContent>
                </Select>

                <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                  <SelectTrigger className="h-8 w-28 text-xs text-[#0f172a] shrink-0" data-testid="select-rating">
                    <SelectValue placeholder="Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High (4-5)</SelectItem>
                    <SelectItem value="medium">Medium (3-4)</SelectItem>
                    <SelectItem value="low">Low (1-3)</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] shrink-0" data-testid="button-apply">Apply</Button>

                <Button
                  variant="outline"
                  className="h-8 w-20 text-[#8798ad] text-xs border-[#e1e8ed] shrink-0"
                  onClick={() => setFilters(prev => ({ searchName: "", rank: "", vessel: isShipUser ? prev.vessel : "", vesselType: "", nationality: "", appraisalType: "", rating: "" }))}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Tablet: 3-column grid layout */}
            {isTablet && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Search by name..."
                    className="h-8 w-full text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae]"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name"
                  />

                  <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-rank">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRankOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isShipUser ? (
                    <div className="h-8 w-full flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700" data-testid="vessel-name-ship-user">
                      {shipUserVesselName || 'No vessel'}
                    </div>
                  ) : (
                    <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                      <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-vessel">
                        <SelectValue placeholder="Vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vesselMasterData.map((vessel) => (
                          <SelectItem key={vessel.entryId} value={vessel.name}>{vessel.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-vessel-type">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueVesselTypes.map((vesselType) => (
                        <SelectItem key={vesselType.entryId} value={vesselType.name}>{vesselType.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-nationality">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueNationalities.map((nationality) => (
                        <SelectItem key={nationality.entryId} value={nationality.countryName || nationality.name}>{nationality.countryName || nationality.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-appraisal-type">
                      <SelectValue placeholder="Appraisal Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {renderAppraisalTypeOptions()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-rating">
                      <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (4-5)</SelectItem>
                      <SelectItem value="medium">Medium (3-4)</SelectItem>
                      <SelectItem value="low">Low (1-3)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button className="h-8 w-full bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]" data-testid="button-apply">Apply</Button>

                  <Button
                    variant="outline"
                    className="h-8 w-full text-[#8798ad] text-xs border-[#e1e8ed]"
                    onClick={() => setFilters(prev => ({ searchName: "", rank: "", vessel: isShipUser ? prev.vessel : "", vesselType: "", nationality: "", appraisalType: "", rating: "" }))}
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Phone: 2-column grid layout */}
            {isPhone && (
              <div className="space-y-2">
                <Input
                  placeholder="Search by name..."
                  className="h-8 w-full text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae]"
                  value={filters.searchName}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                  data-testid="input-search-name"
                />

                <div className="grid grid-cols-2 gap-2">
                  <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-rank">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRankOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isShipUser ? (
                    <div className="h-8 w-full flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700" data-testid="vessel-name-ship-user">
                      {shipUserVesselName || 'No vessel'}
                    </div>
                  ) : (
                    <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                      <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-vessel">
                        <SelectValue placeholder="Vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vesselMasterData.map((vessel) => (
                          <SelectItem key={vessel.entryId} value={vessel.name}>{vessel.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-vessel-type">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueVesselTypes.map((vesselType) => (
                        <SelectItem key={vesselType.entryId} value={vesselType.name}>{vesselType.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-nationality">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueNationalities.map((nationality) => (
                        <SelectItem key={nationality.entryId} value={nationality.countryName || nationality.name}>{nationality.countryName || nationality.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-appraisal-type">
                      <SelectValue placeholder="App. Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {renderAppraisalTypeOptions()}
                    </SelectContent>
                  </Select>

                  <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                    <SelectTrigger className="h-8 w-full text-xs text-[#0f172a]" data-testid="select-rating">
                      <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (4-5)</SelectItem>
                      <SelectItem value="medium">Medium (3-4)</SelectItem>
                      <SelectItem value="low">Low (1-3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button className="h-8 flex-1 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]" data-testid="button-apply">Apply</Button>
                  <Button
                    variant="outline"
                    className="h-8 flex-1 text-[#8798ad] text-xs border-[#e1e8ed]"
                    onClick={() => setFilters(prev => ({ searchName: "", rank: "", vessel: isShipUser ? prev.vessel : "", vesselType: "", nationality: "", appraisalType: "", rating: "" }))}
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AG Grid Enterprise Table with Actions */}
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex flex-col flex-1">
          <CardContent className="p-4 pl-0 bg-[#f7fafc] flex flex-col flex-1">
            <AgGridTable
              rowData={crewData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              context={{ handleEditClick, handleViewClick, handleDeleteClick, canEditPerm: permissions.length === 0 || canEdit("Crewing"), canDeletePerm: permissions.length === 0 || canDelete("Crewing"), canActOnRank }}
              fillAvailableHeight={true}
              bottomPadding={80}
              width="100%"
              enableExport={true}
              enableSideBar={true}
              enableStatusBar={false}
              enableRowGrouping={true}
              enablePivoting={true}
              enableAdvancedFilter={false}
              rowSelection={false}
              theme="alpine"
            />

            {/* Custom footer within the table area */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                Rows: {crewData.length > 0 ? crewData.length : 0}
              </div>
              <div>
                <AgGridTableActions
                  gridApi={gridApi}
                  exportFilename="crew-appraisals"
                  showExportButtons={true}
                  showFilterButtons={true}
                  showGroupButtons={true}
                  showSelectionButtons={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Appraisal Form Modal */}
        {showAppraisalForm && selectedCrewMember && (
          <AppraisalForm
            crewMember={selectedCrewMember}
            appraisalId={selectedCrewMember.appraisalId}
            initialStatus={selectedCrewMember.status as 'draft' | 'preliminary' | 'submitted' | 'reviewed'}
            onClose={handleCloseForm}
          />
        )}

        {/* Read-only View Modal */}
        {viewingAppraisal && viewingAppraisal.appraisalId != null && (
          <AppraisalView
            appraisalId={viewingAppraisal.appraisalId}
            rank={viewingAppraisal.rank}
            seafarerNameFallback={`${viewingAppraisal.name.first} ${viewingAppraisal.name.middle} ${viewingAppraisal.name.last}`.replace(/\s+/g, ' ').trim()}
            onClose={handleCloseView}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteTarget || deleteMutation.isPending}
          onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleteTarget(null); }}
        >
          <AlertDialogContent data-testid="dialog-delete-appraisal">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete appraisal</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `Delete the ${deleteTarget.appraisalType || 'appraisal'} for ${`${deleteTarget.name.first} ${deleteTarget.name.middle} ${deleteTarget.name.last}`.replace(/\s+/g, ' ').trim() || 'this seafarer'}? This action cannot be undone.`
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmDelete(); }}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </div>
  );
};