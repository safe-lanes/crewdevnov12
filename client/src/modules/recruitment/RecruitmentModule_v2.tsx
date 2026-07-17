import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { parseISO, format, isValid } from 'date-fns';
import { usePermissions } from '@/contexts/PermissionsContext';
import { NoAccessPage } from '@/components/ProtectedRoute';
import { FilterIcon, PlusIcon, PaperclipIcon, EditIcon, Trash2Icon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { useQueryClient } from '@tanstack/react-query';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBarV2 from './RecruitmentSideBar_v2';
import { RecruitmentApplicationFormV2 } from './RecruitmentApplicationForm_v2';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useNationalitiesV2, useVesselTypesV2, useManningAgentsV2 } from '@/hooks/v2/useMasterDataV2';
import { useViewport, getViewportConfig } from '@/hooks/useViewport';
import { useV2Candidates, useV2DeleteCandidate, useV2ScreeningStagesSummary } from './hooks/useRecruitmentV2';
import type { V2CandidateListItem } from './types/formTypes';
import { STATUS_MAPPING } from './statusBuckets';

export { STATUS_MAPPING, RECRUITED_STATUSES } from './statusBuckets';

function ScreeningStatusCellRenderer(params: ICellRendererParams) {
  const recCanUuid: string | null = params.data?.recCanUuid ?? null;
  const isScreening = params.value === 'Screening';
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: stages, isLoading } = useV2ScreeningStagesSummary(
    requested && isScreening ? recCanUuid : null
  );

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!requested) setRequested(true);
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const popupW = 228;
      const popupH = 240; // header + 8 rows × ~26px + borders + buffer
      const left = r.left - popupW >= 4 ? r.left - popupW : r.right + 4;
      const rawTop = r.top;
      const vh = document.documentElement.clientHeight;
      const top = rawTop + popupH > vh - 8
        ? Math.max(8, vh - popupH - 8)
        : rawTop;
      setPos({ top, left });
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (!isScreening) {
    return <span style={{ fontSize: 'inherit', color: 'inherit' }}>{params.value || ''}</span>;
  }

  const popup = open ? (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999, width: 224 }}
      className="rounded-md border bg-white shadow-lg overflow-hidden"
      onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
      onMouseLeave={handleMouseLeave}
    >
      <div className="px-2 py-[4px] border-b bg-[#f0f4f8]">
        <p className="text-[9px] font-bold text-[#16569e] uppercase tracking-widest leading-none">Screening Stages</p>
      </div>
      <div>
        {isLoading ? (
          <div className="px-2 py-[2px] text-[10px] text-gray-400">Loading…</div>
        ) : (stages ?? []).map((s) => (
          <div
            key={s.stage}
            className="flex items-center justify-between px-2 py-[5px] border-b last:border-b-0"
            data-testid={`screening-stage-row-${recCanUuid}-${s.stage}`}
          >
            <span className="text-[10px] text-gray-600 leading-none">
              <span className="font-semibold text-gray-700">{s.stage}</span>
              <span className="text-gray-400 mx-0.5">—</span>
              {s.label}
            </span>
            <span
              className={`text-[8px] font-bold px-1 py-[1px] rounded ml-1 shrink-0 uppercase tracking-wide ${
                s.done
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {s.done ? 'Done' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        data-testid={`screening-status-trigger-${recCanUuid}`}
        className="cursor-default underline decoration-dotted"
        style={{ fontSize: 'inherit', color: 'inherit' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        Screening
      </span>
      {open && createPortal(popup, document.body)}
    </>
  );
}

export const RecruitmentModuleV2 = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");
  const [showFilters, setShowFilters] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<V2CandidateListItem | null>(null);
  // When true, the open form is reflected in the URL as /recruitment/<recCanUuid>
  // (opened via Edit/Attachment click or a path deep-link). Query-param deep-links
  // from the dashboard drill-down and the New Crew form do NOT sync the URL.
  const [urlSynced, setUrlSynced] = useState(false);
  const [location, navigate] = useLocation();
  const pathCandidateUuid = useMemo(() => {
    const m = location.match(/^\/recruitment\/([^/?#]+)/);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }, [location]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rankOptions, isLoading: ranksLoading } = useCompanyRanks();
  const { normalizeRank } = useRankNormalization();
  const viewport = useViewport();
  const viewportConfig = getViewportConfig(viewport);
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';
  const isSmallScreen = isPhone || isTablet;

  const { data: externalVesselTypesData, isLoading: vesselTypesLoading } = useVesselTypesV2();
  
  const vesselTypeMasterData = useMemo(() => {
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    if (vesselTypes.length > 0) {
      return vesselTypes.map((vt: any) => vt.vesselType || vt.name).filter(Boolean);
    }
    return [];
  }, [externalVesselTypesData]);

  const vesselTypeLookup = useMemo(() => {
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    const lookup: Record<string, string> = {};
    if (Array.isArray(vesselTypes)) {
      vesselTypes.forEach((vt: any) => {
        const uuid = vt.vesselTypeUuid || vt.uuid || vt.id;
        const name = vt.vesselType || vt.name;
        if (uuid && name) {
          lookup[uuid] = name;
          lookup[name] = name;
        }
      });
    }
    return lookup;
  }, [externalVesselTypesData]);

  const { data: externalNationalitiesData, isLoading: nationalitiesLoading } = useNationalitiesV2();

  const { data: manningAgentsData } = useManningAgentsV2();

  const nationalityMasterData = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    if (nationalities.length > 0) {
      return nationalities.map((n: any) => n.nationality || n.countryName || n.name).filter(Boolean);
    }
    return [];
  }, [externalNationalitiesData]);

  const nationalityLookup = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    const lookup: Record<string, string> = {};
    if (Array.isArray(nationalities)) {
      nationalities.forEach((n: any) => {
        const uuid = n.nationalityUuid || n.uuid || n.id;
        const name = n.nationality || n.countryName || n.name;
        if (uuid && name) {
          lookup[uuid] = name;
          lookup[name] = name;
        }
      });
    }
    return lookup;
  }, [externalNationalitiesData]);

  const { canView, canCreate, canEdit, canDelete, permissions, roleName, manningAgent: userManningAgent, isLoading: permissionsLoading } = usePermissions();
  const isManningAgentUser = roleName === 'Manning Agent' && !!userManningAgent;

  const [filters, setFilters] = useState({
    searchName: "",
    rankAppliedFor: "",
    vesselType: "",
    nationality: "",
    status: "",
    manningAgent: ""
  });

  useEffect(() => {
    if (isManningAgentUser) {
      setFilters(prev => ({ ...prev, manningAgent: userManningAgent }));
    }
  }, [isManningAgentUser, userManningAgent]);

  const { data: allCandidates = [], isLoading, error, refetch } = useV2Candidates();

  // Deep-link entry: dashboard's Crew Recruitment drill-down popup links to
  // /recruitment?candidate=<recCanUuid>. Open the matching candidate's form
  // and tag it so the form's Back arrow can history.back() to the popup.
  const [pendingCandidateUuid, setPendingCandidateUuid] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('candidate');
  });

  useEffect(() => {
    if (!pendingCandidateUuid) return;
    if (isLoading) return;
    if (permissionsLoading) return;
    const list = (allCandidates as V2CandidateListItem[]) || [];
    const found = list.find((c) => c.recCanUuid === pendingCandidateUuid);
    if (found) {
      const candidatePage = (Object.keys(STATUS_MAPPING) as (keyof typeof STATUS_MAPPING)[])
        .find((page) => STATUS_MAPPING[page].includes(found.status));
      const isAllowed = permissions.length === 0 || (!!candidatePage && allowedPages.includes(candidatePage));
      if (isAllowed) {
        setSelectedCandidate({
          ...found,
          middleName: found.middleName || '',
          _openedFromDeepLink: true,
        } as V2CandidateListItem & { _openedFromDeepLink: boolean });
        setShowApplicationForm(true);
      }
    }
    setPendingCandidateUuid(null);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('candidate')) {
        params.delete('candidate');
        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [pendingCandidateUuid, isLoading, permissionsLoading, allCandidates]);

  const deleteMutation = useV2DeleteCandidate();
  const allowedPages = useMemo(() => {
    const all = ["in-progress", "recruited", "waitlist", "rejected"];
    if (permissions.length === 0) return all;
    const pageToMenu: Record<string, string> = { "in-progress": "In Progress", "recruited": "Recruited", "waitlist": "Waitlist", "rejected": "Rejected" };
    return all.filter(p => canView(pageToMenu[p] || p));
  }, [permissions, canView]);

  // Path deep-link entry: /recruitment/<recCanUuid>. Open the matching
  // candidate's form once the list + permissions are loaded. Unknown or
  // not-permitted uuids fall back to the plain list view.
  useEffect(() => {
    if (!pathCandidateUuid) return;
    if (showApplicationForm) return;
    if (isLoading || permissionsLoading) return;
    const list = (allCandidates as V2CandidateListItem[]) || [];
    const found = list.find((c) => c.recCanUuid === pathCandidateUuid);
    if (found) {
      const candidatePage = (Object.keys(STATUS_MAPPING) as (keyof typeof STATUS_MAPPING)[])
        .find((page) => STATUS_MAPPING[page].includes(found.status));
      const isAllowed = permissions.length === 0 || (!!candidatePage && allowedPages.includes(candidatePage));
      if (isAllowed) {
        setSelectedCandidate({ ...found, middleName: found.middleName || '' });
        setUrlSynced(true);
        setShowApplicationForm(true);
        return;
      }
    }
    navigate('/recruitment', { replace: true });
  }, [pathCandidateUuid, showApplicationForm, isLoading, permissionsLoading, allCandidates, permissions, allowedPages, navigate]);

  // Browser Back (or any navigation that removes the uuid segment) closes a
  // URL-synced form.
  useEffect(() => {
    if (urlSynced && showApplicationForm && !pathCandidateUuid) {
      setShowApplicationForm(false);
      setSelectedCandidate(null);
      setUrlSynced(false);
    }
  }, [urlSynced, showApplicationForm, pathCandidateUuid]);

  const recruitmentPageToMenu: Record<string, string> = useMemo(() => ({
    "in-progress": "In Progress", "recruited": "Recruited", "waitlist": "Waitlist", "rejected": "Rejected"
  }), []);

  const currentMenuName = recruitmentPageToMenu[selectedRecruitmentPage] || "In Progress";

  const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
    const handleAttachmentClick = () => {
      setSelectedCandidate({
        ...params.data,
        middleName: params.data.middleName || ''
      });
      setUrlSynced(true);
      setShowApplicationForm(true);
      if (params.data?.recCanUuid) {
        navigate(`/recruitment/${encodeURIComponent(params.data.recCanUuid)}`);
      }
      
      setTimeout(() => {
        const a2Section = document.querySelector('[data-section="A2"]');
        if (a2Section) {
          a2Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    };

    const handleEditClick = () => {
      setSelectedCandidate({
        ...params.data,
        middleName: params.data.middleName || ''
      });
      setUrlSynced(true);
      setShowApplicationForm(true);
      if (params.data?.recCanUuid) {
        navigate(`/recruitment/${encodeURIComponent(params.data.recCanUuid)}`);
      }
    };

    const handleDeleteClick = () => {
      const candidateId = params.data.recCanUuid;
      const candidateName = `${params.data.firstName} ${params.data.familyName}` || params.data.fileNo;
      
      const confirmed = window.confirm(
        `Are you sure you want to delete "${candidateName}"?\n\n` +
        `This will remove the candidate from the list.\n` +
        `File No: ${params.data.fileNo}`
      );
      
      if (!confirmed) {
        return;
      }
      
      deleteMutation.mutate(candidateId, {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Candidate deleted successfully",
          });
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: `Failed to delete candidate: ${error.message}`,
            variant: "destructive",
          });
        }
      });
    };

    const hasEditPerm = permissions.length === 0 || canEdit(currentMenuName);
    const hasDeletePerm = permissions.length === 0 || canDelete(currentMenuName);

    return (
      <div className="flex items-center justify-center gap-1 h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleAttachmentClick}
          data-testid={`button-attachment-${params.data.recCanUuid}`}
        >
          <PaperclipIcon className="h-4 w-4 text-gray-600" />
        </Button>
        {hasEditPerm && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleEditClick}
          data-testid={`button-edit-${params.data.recCanUuid}`}
        >
          <EditIcon className="h-4 w-4 text-gray-600" />
        </Button>
        )}
        {hasDeletePerm && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-red-100"
          onClick={handleDeleteClick}
          data-testid={`button-delete-${params.data.recCanUuid}`}
        >
          <Trash2Icon className="h-4 w-4 text-red-600" />
        </Button>
        )}
      </div>
    );
  }, [deleteMutation, toast, permissions, canEdit, canDelete, currentMenuName, navigate]);

  const columnDefs: ColDef[] = useMemo(() => {
    const baseColumns: ColDef[] = [
      {
        headerName: 'File No',
        field: 'fileNo',
        flex: 0.8,
        minWidth: 80,
        cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true
      },
      {
        headerName: 'First Name',
        field: 'firstName',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true
      },
      {
        headerName: 'Family Name',
        field: 'familyName',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true
      },
      {
        headerName: 'Rank Applied',
        field: 'rankAppliedFor',
        flex: 1.2,
        minWidth: 110,
        cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
        filter: 'agSetColumnFilter',
        sortable: true,
        resizable: true,
        enableRowGroup: false
      },
      ...(["recruited", "waitlist", "rejected"].includes(selectedRecruitmentPage)
        ? [{
            headerName: selectedRecruitmentPage === 'waitlist'
              ? 'Date of Waitlisting'
              : selectedRecruitmentPage === 'rejected'
              ? 'Date of Rejection'
              : 'Date of Recruitment',
            field: 'recruitmentDate',
            flex: 1,
            minWidth: 130,
            cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
            filter: 'agTextColumnFilter',
            sortable: true,
            resizable: true,
            enableRowGroup: false,
            valueFormatter: (params: any) => {
              if (!params.value) return '';
              const parsed = parseISO(params.value);
              return isValid(parsed) ? format(parsed, 'dd-MMM-yyyy') : params.value;
            }
          } as ColDef]
        : [{
            headerName: 'Status',
            field: 'status',
            flex: 0.8,
            minWidth: 80,
            cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
            filter: 'agSetColumnFilter',
            sortable: true,
            resizable: true,
            enableRowGroup: false,
            cellRenderer: ScreeningStatusCellRenderer,
          } as ColDef]),
      {
        headerName: 'Actions',
        field: 'actions',
        flex: 0.6,
        minWidth: 90,
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
        cellClass: 'flex items-center justify-center'
      }
    ];

    if (!isPhone) {
      baseColumns.splice(3, 0, {
        headerName: 'Middle Name',
        field: 'middleName',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        hide: isTablet
      });
    }

    if (!isSmallScreen) {
      baseColumns.splice(4, 0, {
        headerName: 'DOB',
        field: 'dob',
        flex: 0.9,
        minWidth: 90,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agDateColumnFilter',
        sortable: true,
        resizable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          try {
            const date = typeof params.value === 'string' ? parseISO(params.value) : new Date(params.value);
            if (!isValid(date)) return params.value;
            return format(date, 'dd-MMM-yyyy');
          } catch {
            return params.value;
          }
        }
      });
      
      baseColumns.splice(5, 0, {
        headerName: 'Nationality',
        field: 'nationality',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agSetColumnFilter',
        sortable: true,
        resizable: true,
        enableRowGroup: false
      });
      
      const rankAppliedIndex = baseColumns.findIndex(col => col.field === 'rankAppliedFor');
      baseColumns.splice(rankAppliedIndex + 1, 0, {
        headerName: 'Present Rank',
        field: 'presentRank',
        flex: 1.1,
        minWidth: 100,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agSetColumnFilter',
        sortable: true,
        resizable: true,
        enableRowGroup: false
      });
      
      const statusIndex = baseColumns.findIndex(col => col.field === 'status');
      baseColumns.splice(statusIndex, 0, {
        headerName: 'Vessel Type',
        field: 'vesselType',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agSetColumnFilter',
        sortable: true,
        resizable: true,
        enableRowGroup: false
      });
    }

    return baseColumns;
  }, [ActionsCellRenderer, normalizeRank, isPhone, isTablet, isSmallScreen, selectedRecruitmentPage]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
    
    const handleResize = () => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const filteredData = useMemo(() => {
    let filtered = allCandidates as V2CandidateListItem[];
    
    const pageStatuses = STATUS_MAPPING[selectedRecruitmentPage as keyof typeof STATUS_MAPPING] || [];
    if (pageStatuses.length > 0) {
      filtered = filtered.filter(candidate => 
        pageStatuses.includes(candidate.status)
      );
    }
    
    filtered = filtered.filter(candidate => {
      const nationalityDisplay = nationalityLookup[candidate.nationality] || candidate.nationality || '';
      const vesselTypeDisplay = vesselTypeLookup[candidate.vesselType] || candidate.vesselType || '';
      
      const matchesName = filters.searchName === "" || 
        `${candidate.firstName} ${candidate.middleName || ''} ${candidate.familyName}`
          .toLowerCase().includes(filters.searchName.toLowerCase());
      const matchesRank = filters.rankAppliedFor === "" || normalizeRank(candidate.rankAppliedFor || '') === filters.rankAppliedFor;
      const matchesVesselType = filters.vesselType === "" || vesselTypeDisplay === filters.vesselType;
      const matchesNationality = filters.nationality === "" || nationalityDisplay === filters.nationality;
      const matchesStatus = filters.status === "" || candidate.status === filters.status;
      const matchesManningAgent = filters.manningAgent === "" || candidate.manningAgent === filters.manningAgent;
      
      return matchesName && matchesRank && matchesVesselType && matchesNationality && matchesStatus && matchesManningAgent;
    });
    
    return filtered.map(candidate => ({
      ...candidate,
      nationality: nationalityLookup[candidate.nationality] || candidate.nationality || '',
      vesselType: vesselTypeLookup[candidate.vesselType] || candidate.vesselType || '',
      rankAppliedFor: normalizeRank(candidate.rankAppliedFor || '') || candidate.rankAppliedFor,
      presentRank: normalizeRank(candidate.presentRank || '') || candidate.presentRank
    }));
  }, [allCandidates, selectedRecruitmentPage, filters, normalizeRank, nationalityLookup, vesselTypeLookup]);

  const manningAgentOptions = useMemo(() => {
    if (!manningAgentsData || (manningAgentsData as any[]).length === 0) return [];
    return (manningAgentsData as any[])
        .filter((a: any) => a.name && !a.isDeleted)
        .map((a: any) => a.name)
        .sort() as string[];
  }, [manningAgentsData]);

  const getTitle = () => {
    switch (selectedRecruitmentPage) {
      case "in-progress":
        return "In Progress";
      case "recruited":
        return "Recruited";
      case "waitlist":
        return "Waitlist";
      case "rejected":
        return "Rejected";
      default:
        return "In Progress";
    }
  };

  const renderFiltersAndTable = () => {
    const getStatusOptions = () => {
      switch (selectedRecruitmentPage) {
        case "in-progress":
          return [
            <SelectItem key="applied" value="Applied">Applied</SelectItem>,
            <SelectItem key="screening" value="Screening">Screening</SelectItem>,
            <SelectItem key="for-approval" value="For Approval">For Approval</SelectItem>
          ];
        case "recruited":
          return [<SelectItem key="recruited" value="Recruited">Recruited</SelectItem>];
        case "waitlist":
          return [<SelectItem key="waitlisted" value="Waitlisted">Waitlisted</SelectItem>];
        case "rejected":
          return [<SelectItem key="rejected" value="Rejected">Rejected</SelectItem>];
        default:
          return [];
      }
    };

    return (
      <>
        {showFilters && (
          <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg">
            {!isSmallScreen && (
              <div className="flex flex-nowrap items-center gap-2">
                <div className="shrink-0 w-36">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name-v2"
                  />
                </div>

                <div className="shrink-0 w-[120px]">
                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter-v2">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[110px]">
                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-vessel-type-filter-v2">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {vesselTypesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        vesselTypeMasterData.map((vesselType: string) => (
                          <SelectItem key={vesselType} value={vesselType}>{vesselType}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[110px]">
                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-nationality-filter-v2">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {nationalitiesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        nationalityMasterData.map((nationality: string) => (
                          <SelectItem key={nationality} value={nationality}>{nationality}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[100px]">
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter-v2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[120px]">
                  <Select value={filters.manningAgent} onValueChange={(value) => setFilters(prev => ({ ...prev, manningAgent: value }))} disabled={isManningAgentUser}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-manning-agent-filter-v2">
                      <SelectValue placeholder="Manning Agent" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {manningAgentOptions.map((agent: string) => (
                        <SelectItem key={agent} value={agent} data-testid={`manning-agent-option-${agent}`}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 shrink-0" data-testid="button-apply-filters-v2">
                  Apply
                </Button>

                <Button 
                  variant="outline" 
                  className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
                  onClick={() => setFilters(prev => ({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "", manningAgent: isManningAgentUser ? prev.manningAgent : "" }))}
                  data-testid="button-clear-filters-v2"
                >
                  Clear
                </Button>
              </div>
            )}

            {isTablet && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name-v2"
                  />

                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter-v2">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-vessel-type-filter-v2">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {vesselTypesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        vesselTypeMasterData.map((vesselType: string) => (
                          <SelectItem key={vesselType} value={vesselType}>{vesselType}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-nationality-filter-v2">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {nationalitiesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        nationalityMasterData.map((nationality: string) => (
                          <SelectItem key={nationality} value={nationality}>{nationality}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter-v2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>

                  <Select value={filters.manningAgent} onValueChange={(value) => setFilters(prev => ({ ...prev, manningAgent: value }))} disabled={isManningAgentUser}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-manning-agent-filter-v2">
                      <SelectValue placeholder="Manning Agent" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {manningAgentOptions.map((agent: string) => (
                        <SelectItem key={agent} value={agent} data-testid={`manning-agent-option-${agent}`}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4" data-testid="button-apply-filters-v2">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3"
                    onClick={() => setFilters(prev => ({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "", manningAgent: isManningAgentUser ? prev.manningAgent : "" }))}
                    data-testid="button-clear-filters-v2"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {isPhone && (
              <div className="space-y-2">
                <Input
                  placeholder="Search Name..."
                  className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                  value={filters.searchName}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                  data-testid="input-search-name-v2"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter-v2">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        rankOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter-v2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>

                  <Select value={filters.manningAgent} onValueChange={(value) => setFilters(prev => ({ ...prev, manningAgent: value }))} disabled={isManningAgentUser}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-manning-agent-filter-v2">
                      <SelectValue placeholder="Manning Agent" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {manningAgentOptions.map((agent: string) => (
                        <SelectItem key={agent} value={agent} data-testid={`manning-agent-option-${agent}`}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 flex-1" data-testid="button-apply-filters-v2">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3"
                    onClick={() => setFilters(prev => ({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "", manningAgent: isManningAgentUser ? prev.manningAgent : "" }))}
                    data-testid="button-clear-filters-v2"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex flex-col flex-1">
          <CardContent className={`bg-[#f7fafc] flex flex-col flex-1 ${isPhone ? 'p-2 pl-0' : 'p-4 pl-0'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading candidates...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-500">Error loading candidates</div>
              </div>
            ) : (
              <AgGridTable
                rowData={filteredData}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                fillAvailableHeight={true}
                bottomPadding={isPhone ? 10 : 20}
                width="100%"
                enableExport={!isPhone}
                enableSideBar={!isSmallScreen}
                enableStatusBar={false}
                enableRowGrouping={!isSmallScreen}
                enablePivoting={!isSmallScreen}
                enableAdvancedFilter={false}
                rowSelection={false}
              />
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  const renderContent = () => {
    if (permissions.length > 0 && !allowedPages.includes(selectedRecruitmentPage)) {
      return <NoAccessPage menuName={currentMenuName} />;
    }
    if (["in-progress", "recruited", "waitlist", "rejected"].includes(selectedRecruitmentPage)) {
      return renderFiltersAndTable();
    }
    
    return (
      <div className="p-6 text-center text-gray-600">
        Content for {getTitle()} will be implemented in future iterations.
      </div>
    );
  };

  return (
    <div data-testid="recruitment-v2-container">
      <RecruitmentSideBarV2 
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      <MainLayout hasSidebar={true}>
        <SectionTitleComponents title={getTitle()}>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={`h-8 text-[#8798ad] text-xs border-[#e1e8ed] ${isPhone ? 'w-auto px-3' : 'w-32'}`}
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters-v2"
            >
              <FilterIcon className={`h-3 w-3 ${isPhone ? '' : 'mr-1'}`} />
              {!isPhone && 'Filters'}
            </Button>
            {(permissions.length === 0 || canCreate(currentMenuName)) && (
            <Button
              className={`h-8 bg-[#5dc86f] hover:bg-[#218838] text-xs text-white ${isPhone ? 'w-auto px-3' : 'w-32'}`}
              onClick={() => {
                setSelectedCandidate(null);
                setShowApplicationForm(true);
              }}
              data-testid="button-new-crew-v2"
            >
              <PlusIcon className={`h-3 w-3 ${isPhone ? '' : 'mr-1'}`} />
              {!isPhone && 'New Crew'}
            </Button>
            )}
          </div>
        </SectionTitleComponents>
        {renderContent()}
      </MainLayout>

      {showApplicationForm && (
        <RecruitmentApplicationFormV2
          candidate={selectedCandidate}
          onClose={() => {
            const wasDeepLinked =
              (selectedCandidate as (V2CandidateListItem & { _openedFromDeepLink?: boolean }) | null)
                ?._openedFromDeepLink === true;
            setShowApplicationForm(false);
            setSelectedCandidate(null);
            if (urlSynced) {
              // URL-synced form: drop the uuid segment from the URL.
              setUrlSynced(false);
              navigate('/recruitment');
            } else if (wasDeepLinked && typeof window !== 'undefined') {
              // If we were opened via the dashboard drill-down deep link, walk
              // one step back so the popup is restored on the dashboard.
              window.history.back();
            }
          }}
        />
      )}
    </div>
  );
};

export default RecruitmentModuleV2;
