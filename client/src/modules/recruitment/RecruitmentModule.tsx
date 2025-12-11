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
import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes';
import { NATIONALITIES } from '@/utils/data/nationalities';

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

  // Fetch vessel types from Master 004 API
  const { data: vesselTypeMasterDataRaw = [], isLoading: vesselTypesLoading } = useQuery<Array<{ entryId: string; name: string; level?: number }>>({
    queryKey: ["/api/masters/004/data"],
  });
  
  // Filter to Level 2 and Level 3 types for dropdown (not Level 1 categories)
  // Default level to 2 when undefined to ensure all vessel types are included
  const vesselTypeMasterData = useMemo(() => {
    if (vesselTypeMasterDataRaw.length > 0) {
      const filteredTypes = vesselTypeMasterDataRaw.filter(vt => {
        const level = vt.level ?? 2; // Default to level 2 if undefined
        return level >= 2;
      });
      if (filteredTypes.length > 0) return filteredTypes.map(vt => vt.name);
    }
    // Fallback to static data
    return DEFAULT_DROPDOWN_VESSEL_TYPES;
  }, [vesselTypeMasterDataRaw]);

  // Fetch nationalities from Master Data 001
  const { data: nationalityMasterDataRaw = [], isLoading: nationalitiesLoading } = useQuery<Array<{ entryId: string; name: string }>>({
    queryKey: ["/api/masters/001/data"],
  });

  // Extract nationality names with fallback to static data
  // Use static list if master data has fewer than 20 entries (incomplete data)
  const nationalityMasterData = useMemo(() => {
    if (nationalityMasterDataRaw.length >= 20) {
      return nationalityMasterDataRaw.map(n => n.name);
    }
    // Fallback to comprehensive static NATIONALITIES list
    return [...NATIONALITIES];
  }, [nationalityMasterDataRaw]);

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

  // Column definitions for AG Grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'File No',
      field: 'fileNo',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'First Name',
      field: 'firstName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Middle Name',
      field: 'middleName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Family Name',
      field: 'familyName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'DOB',
      field: 'dob',
      flex: 0.9,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Rank Applied for',
      field: 'rankAppliedFor',
      flex: 1.2,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Present Rank',
      field: 'presentRank',
      flex: 1.1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Vessel Type',
      field: 'vesselType',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.8,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center',
      pinned: 'right',
      lockPosition: true
    }
  ], [ActionsCellRenderer, normalizeRank]);

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
        {/* Filters Section */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg">
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search Name..."
                className="h-8 w-48 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae]"
                value={filters.searchName}
                onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
              />

              <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                <SelectTrigger className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-rank-filter">
                  <SelectValue placeholder="Rank Applied for" />
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
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-vessel-type-filter">
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {vesselTypesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    vesselTypeMasterData.map(vesselType => (
                      <SelectItem key={vesselType} value={vesselType} data-testid={`vessel-type-option-${vesselType}`}>{vesselType}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-nationality-filter">
                  <SelectValue placeholder="Nationality" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {nationalitiesLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    nationalityMasterData.map(nationality => (
                      <SelectItem key={nationality} value={nationality} data-testid={`nationality-option-${nationality}`}>{nationality}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions()}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]">
                Apply
              </Button>

              <Button 
                variant="outline" 
                className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* AG Grid Table */}
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex flex-col flex-1">
          <CardContent className="p-4 pl-0 bg-[#f7fafc] flex flex-col flex-1">
            <AgGridTable
              rowData={filteredData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              fillAvailableHeight={true}
              bottomPadding={20}
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
    <>
      <RecruitmentSideBar 
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      <MainLayout>
        <SectionTitleComponents title={getTitle()}>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-3 w-3 mr-1" />
              Filters
            </Button>
            <Button
              className="h-8 w-32 bg-[#5dc86f] hover:bg-[#218838] text-xs text-white"
              onClick={() => {
                setSelectedCandidate(null);
                setShowApplicationForm(true);
              }}
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              New Crew
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
    </>
  );
};