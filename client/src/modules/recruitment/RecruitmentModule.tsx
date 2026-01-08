import React, { useState, useMemo, useCallback } from 'react';
import { FilterIcon, PlusIcon, PaperclipIcon, EditIcon, Trash2Icon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBar from './RecruitmentSideBar';
import { RecruitmentApplicationForm } from './RecruitmentApplicationForm';
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
import { apiRequest } from '@/lib/queryClient';
import { type RecruitmentCandidate } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useExternalNationalities } from '@/hooks/useExternalNationalities';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { useViewport, getViewportConfig } from '@/hooks/useViewport';

// Status mapping for filtering
const STATUS_MAPPING = {
  "in-progress": ["Draft", "Applied", "Screening", "For Approval"],
  "recruited": ["Recruited"],
  "waitlist": ["Waitlisted"],
  "rejected": ["Rejected"]
};


export const RecruitmentModule = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");
  const [showFilters, setShowFilters] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitmentCandidate | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rankNames, isLoading: ranksLoading } = useCompanyRanks();
  const { normalizeRank } = useRankNormalization();
  const viewport = useViewport();
  const viewportConfig = getViewportConfig(viewport);
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';
  const isSmallScreen = isPhone || isTablet;

  // Fetch vessel types from external API (Master 004)
  const { data: externalVesselTypesData, isLoading: vesselTypesLoading } = useExternalVesselTypes();
  
  // Extract vessel type names from external API response
  const vesselTypeMasterData = useMemo(() => {
    // API returns 'vesseltypes' (lowercase) with vesselType field
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    if (vesselTypes.length > 0) {
      return vesselTypes.map((vt: any) => vt.vesselType || vt.name).filter(Boolean);
    }
    return [];
  }, [externalVesselTypesData]);

  // Fetch nationalities from external API (Master 001)
  const { data: externalNationalitiesData, isLoading: nationalitiesLoading } = useExternalNationalities();

  // Extract nationality names from external API response
  const nationalityMasterData = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    if (nationalities.length > 0) {
      return nationalities.map((n: any) => n.nationality || n.countryName || n.name).filter(Boolean);
    }
    return [];
  }, [externalNationalitiesData]);

  // Filter state (moved up to fix order)
  const [filters, setFilters] = useState({
    searchName: "",
    rankAppliedFor: "",
    vesselType: "",
    nationality: "",
    status: ""
  });

  // Fetch recruitment candidates with custom query function
  const { data: allCandidates = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/recruitment-candidates'],
    queryFn: async () => {
      const response = await fetch('/api/recruitment-candidates');
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      return await response.json();
    },
    enabled: true,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });

  // Soft delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return fetch(`/api/recruitment-candidates/${id}/soft-delete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => {
        if (!res.ok) throw new Error('Failed to delete candidate');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Candidate deleted successfully",
      });
      // Invalidate all recruitment-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/recruitment-candidates'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete candidate: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Define allowed pages for the recruitment module
  const allowedPages = ["in-progress", "recruited", "waitlist", "rejected"];

  // Actions cell renderer
  const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
    const handleAttachmentClick = () => {
      // Open the form in view mode and navigate to documents section
      setSelectedCandidate({
        ...params.data,
        middleName: params.data.middleName || ''
      });
      setShowApplicationForm(true);
      
      // Scroll to A2 (Travel Documents) section after form opens
      setTimeout(() => {
        const a2Section = document.querySelector('[data-section="A2"]');
        if (a2Section) {
          a2Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    };

    const handleEditClick = () => {
      console.log('Edit clicked for:', params.data.id);
      setSelectedCandidate({
        ...params.data,
        middleName: params.data.middleName || ''
      });
      setShowApplicationForm(true);
    };

    const handleDeleteClick = () => {
      const candidateId = params.data.id;
      const candidateName = `${params.data.firstName} ${params.data.familyName}` || params.data.fileNo;
      
      const confirmed = window.confirm(
        `Are you sure you want to delete "${candidateName}"?\n\n` +
        `This will remove the candidate from the list.\n` +
        `File No: ${params.data.fileNo}`
      );
      
      if (!confirmed) {
        return;
      }
      
      deleteMutation.mutate(candidateId);
    };

    return (
      <div className="flex items-center justify-center gap-1 h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleAttachmentClick}
        >
          <PaperclipIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleEditClick}
        >
          <EditIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-red-100"
          onClick={handleDeleteClick}
        >
          <Trash2Icon className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }, []);

  // Column definitions for AG Grid - responsive based on viewport
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
      {
        headerName: 'Status',
        field: 'status',
        flex: 0.8,
        minWidth: 80,
        cellStyle: { fontSize: isPhone ? '11px' : '13px', color: '#4f5863' },
        filter: 'agSetColumnFilter',
        sortable: true,
        resizable: true,
        enableRowGroup: false
      },
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

    // Add additional columns for tablet and desktop
    if (!isPhone) {
      // Insert after Family Name (index 2)
      baseColumns.splice(3, 0, {
        headerName: 'Middle Name',
        field: 'middleName',
        flex: 1,
        minWidth: 100,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agTextColumnFilter',
        sortable: true,
        resizable: true,
        hide: isTablet // Hide on tablet, show on desktop
      });
    }

    // Add more columns for desktop only
    if (!isSmallScreen) {
      // Insert DOB after names
      baseColumns.splice(4, 0, {
        headerName: 'DOB',
        field: 'dob',
        flex: 0.9,
        minWidth: 90,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        filter: 'agDateColumnFilter',
        sortable: true,
        resizable: true
      });
      
      // Insert Nationality
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
      
      // Insert Present Rank before Rank Applied
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
      
      // Insert Vessel Type before Status
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
  }, [ActionsCellRenderer, normalizeRank, isPhone, isTablet, isSmallScreen]);

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

  // Filter and normalize the recruitment data based on selected page and filters
  // Normalizes rank fields so AG Grid filtering and display work correctly
  const filteredData = useMemo(() => {
    let filtered = allCandidates as RecruitmentCandidate[];
    
    // Filter by status based on current page
    const pageStatuses = STATUS_MAPPING[selectedRecruitmentPage as keyof typeof STATUS_MAPPING] || [];
    if (pageStatuses.length > 0) {
      filtered = filtered.filter(candidate => 
        pageStatuses.includes(candidate.status)
      );
    }
    
    // Apply additional filters
    filtered = filtered.filter(candidate => {
      const matchesName = filters.searchName === "" || 
        `${candidate.firstName} ${candidate.middleName || ''} ${candidate.familyName}`
          .toLowerCase().includes(filters.searchName.toLowerCase());
      const matchesRank = filters.rankAppliedFor === "" || normalizeRank(candidate.rankAppliedFor || '') === filters.rankAppliedFor;
      const matchesVesselType = filters.vesselType === "" || candidate.vesselType === filters.vesselType;
      const matchesNationality = filters.nationality === "" || candidate.nationality === filters.nationality;
      const matchesStatus = filters.status === "" || candidate.status === filters.status;
      
      return matchesName && matchesRank && matchesVesselType && matchesNationality && matchesStatus;
    });
    
    // Normalize rank fields in the data for AG Grid display and filtering
    return filtered.map(candidate => ({
      ...candidate,
      rankAppliedFor: normalizeRank(candidate.rankAppliedFor || '') || candidate.rankAppliedFor,
      presentRank: normalizeRank(candidate.presentRank || '') || candidate.presentRank
    }));
  }, [allCandidates, selectedRecruitmentPage, filters, normalizeRank]);

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
        {/* Filters Section - Responsive */}
        {showFilters && (
          <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg">
            {/* Desktop/Laptop: Single row flex layout with all filters and buttons inline */}
            {!isSmallScreen && (
              <div className="flex flex-nowrap items-center gap-2">
                <div className="shrink-0 w-36">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name"
                  />
                </div>

                <div className="shrink-0 w-[120px]">
                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank} data-testid={`rank-option-${rank}`}>{rank}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[110px]">
                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-vessel-type-filter">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {vesselTypesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        vesselTypeMasterData.map((vesselType: string) => (
                          <SelectItem key={vesselType} value={vesselType} data-testid={`vessel-type-option-${vesselType}`}>{vesselType}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[110px]">
                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-nationality-filter">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {nationalitiesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        nationalityMasterData.map((nationality: string) => (
                          <SelectItem key={nationality} value={nationality} data-testid={`nationality-option-${nationality}`}>{nationality}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="shrink-0 w-[100px]">
                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 shrink-0" data-testid="button-apply-filters">
                  Apply
                </Button>

                <Button 
                  variant="outline" 
                  className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
                  onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Tablet: Grid layout with 3-4 columns */}
            {isTablet && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] w-full"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name"
                  />

                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank} data-testid={`rank-option-${rank}`}>{rank}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-vessel-type-filter">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {vesselTypesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        vesselTypeMasterData.map((vesselType: string) => (
                          <SelectItem key={vesselType} value={vesselType} data-testid={`vessel-type-option-${vesselType}`}>{vesselType}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-nationality-filter">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {nationalitiesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        nationalityMasterData.map((nationality: string) => (
                          <SelectItem key={nationality} value={nationality} data-testid={`nationality-option-${nationality}`}>{nationality}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] w-20" data-testid="button-apply-filters">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] w-16"
                    onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Phone: 2-column grid layout */}
            {isPhone && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] col-span-2"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name"
                  />

                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank} data-testid={`rank-option-${rank}`}>{rank}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-vessel-type-filter">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {vesselTypesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        vesselTypeMasterData.map((vesselType: string) => (
                          <SelectItem key={vesselType} value={vesselType} data-testid={`vessel-type-option-${vesselType}`}>{vesselType}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-nationality-filter">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {nationalitiesLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        nationalityMasterData.map((nationality: string) => (
                          <SelectItem key={nationality} value={nationality} data-testid={`nationality-option-${nationality}`}>{nationality}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] flex-1" data-testid="button-apply-filters">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] flex-1"
                    onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
                    data-testid="button-clear-filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AG Grid Table - Responsive */}
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex flex-col flex-1">
          <CardContent className={`bg-[#f7fafc] flex flex-col flex-1 ${isPhone ? 'p-2 pl-0' : 'p-4 pl-0'}`}>
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
          </CardContent>
        </Card>
      </>
    );
  };

  const renderContent = () => {
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
    <div data-testid="recruitment-container">
      <RecruitmentSideBar 
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
              data-testid="button-toggle-filters"
            >
              <FilterIcon className={`h-3 w-3 ${isPhone ? '' : 'mr-1'}`} />
              {!isPhone && 'Filters'}
            </Button>
            <Button
              className={`h-8 bg-[#5dc86f] hover:bg-[#218838] text-xs text-white ${isPhone ? 'w-auto px-3' : 'w-32'}`}
              onClick={() => {
                setSelectedCandidate(null);
                setShowApplicationForm(true);
              }}
              data-testid="button-new-crew"
            >
              <PlusIcon className={`h-3 w-3 ${isPhone ? '' : 'mr-1'}`} />
              {!isPhone && 'New Crew'}
            </Button>
          </div>
        </SectionTitleComponents>
        {renderContent()}
      </MainLayout>

      {/* Recruitment Application Form Popup */}
      {showApplicationForm && (
        <RecruitmentApplicationForm
          candidate={selectedCandidate}
          onClose={() => {
            setShowApplicationForm(false);
            setSelectedCandidate(null);
          }}
        />
      )}
    </div>
  );
};