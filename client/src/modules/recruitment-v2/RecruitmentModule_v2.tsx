import { useState, useMemo, useCallback } from 'react';
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
import { useExternalNationalities } from '@/hooks/useExternalNationalities';
import { useExternalVesselTypes } from '@/hooks/useExternalVesselTypes';
import { useViewport, getViewportConfig } from '@/hooks/useViewport';
import { useV2Candidates, useV2DeleteCandidate } from './hooks/useRecruitmentV2';
import type { V2CandidateListItem } from './types/formTypes';

const STATUS_MAPPING = {
  "in-progress": ["Draft", "Applied", "Screening", "For Approval"],
  "recruited": ["Recruited"],
  "waitlist": ["Waitlisted"],
  "rejected": ["Rejected"]
};

export const RecruitmentModuleV2 = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");
  const [showFilters, setShowFilters] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<V2CandidateListItem | null>(null);
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

  const { data: externalVesselTypesData, isLoading: vesselTypesLoading } = useExternalVesselTypes();
  
  const vesselTypeMasterData = useMemo(() => {
    const vesselTypes = (externalVesselTypesData as any)?.vesseltypes || (externalVesselTypesData as any)?.vesselTypes || externalVesselTypesData || [];
    if (vesselTypes.length > 0) {
      return vesselTypes.map((vt: any) => vt.vesselType || vt.name).filter(Boolean);
    }
    return [];
  }, [externalVesselTypesData]);

  const { data: externalNationalitiesData, isLoading: nationalitiesLoading } = useExternalNationalities();

  const nationalityMasterData = useMemo(() => {
    const nationalities = (externalNationalitiesData as any)?.nationalities || externalNationalitiesData || [];
    if (nationalities.length > 0) {
      return nationalities.map((n: any) => n.nationality || n.countryName || n.name).filter(Boolean);
    }
    return [];
  }, [externalNationalitiesData]);

  const [filters, setFilters] = useState({
    searchName: "",
    rankAppliedFor: "",
    vesselType: "",
    nationality: "",
    status: ""
  });

  const { data: allCandidates = [], isLoading, error, refetch } = useV2Candidates();

  const deleteMutation = useV2DeleteCandidate();

  const allowedPages = ["in-progress", "recruited", "waitlist", "rejected"];

  const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
    const handleAttachmentClick = () => {
      setSelectedCandidate(params.data);
      setShowApplicationForm(true);
    };

    const handleEditClick = () => {
      setSelectedCandidate(params.data);
      setShowApplicationForm(true);
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

    return (
      <div className="flex items-center justify-center gap-1 h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleAttachmentClick}
          data-testid={`button-attachment-${params.data.id}`}
        >
          <PaperclipIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleEditClick}
          data-testid={`button-edit-${params.data.id}`}
        >
          <EditIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-red-100"
          onClick={handleDeleteClick}
          data-testid={`button-delete-${params.data.id}`}
        >
          <Trash2Icon className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }, [deleteMutation, toast]);

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
        resizable: true
      });
      
      baseColumns.splice(5, 0, {
        headerName: 'Nationality',
        field: 'nationalityUuid',
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
    }

    return baseColumns;
  }, [ActionsCellRenderer, isPhone, isTablet, isSmallScreen]);

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
      const matchesName = filters.searchName === "" || 
        `${candidate.firstName} ${candidate.middleName || ''} ${candidate.familyName}`
          .toLowerCase().includes(filters.searchName.toLowerCase());
      const matchesRank = filters.rankAppliedFor === "" || normalizeRank(candidate.rankAppliedFor || '') === filters.rankAppliedFor;
      const matchesNationality = filters.nationality === "" || candidate.nationalityUuid === filters.nationality;
      const matchesStatus = filters.status === "" || candidate.status === filters.status;
      
      return matchesName && matchesRank && matchesNationality && matchesStatus;
    });
    
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

  const handleCloseForm = () => {
    setShowApplicationForm(false);
    setSelectedCandidate(null);
  };

  const handleNewCandidate = () => {
    setSelectedCandidate(null);
    setShowApplicationForm(true);
  };

  if (showApplicationForm) {
    return (
      <RecruitmentApplicationFormV2
        candidate={selectedCandidate}
        onClose={handleCloseForm}
      />
    );
  }

  return (
    <MainLayout>
      <RecruitmentSideBarV2
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <SectionTitleComponents title={`Recruitment V2 - ${getTitle()}`}>
          <span className="text-sm text-gray-500">Showing {filteredData.length} candidates</span>
        </SectionTitleComponents>
        
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <FilterIcon className="h-4 w-4 mr-2" />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </Button>
              </div>
              
              <Button
                onClick={handleNewCandidate}
                className="bg-[#16569e] hover:bg-[#0d4a8f]"
                data-testid="button-new-candidate"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Candidate
              </Button>
            </div>

            {showFilters && (
              <div className="mb-4 p-4 bg-[#f7fafc] rounded-lg">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search Name..."
                    className="h-8 text-xs w-36"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    data-testid="input-search-name-v2"
                  />

                  <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                    <SelectTrigger className="h-8 text-xs w-[120px]" data-testid="select-rank-filter-v2">
                      <SelectValue placeholder="Rank Applied" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {ranksLoading ? (
                        <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                      ) : (
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 text-xs w-[110px]" data-testid="select-nationality-filter-v2">
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
                    <SelectTrigger className="h-8 text-xs w-[100px]" data-testid="select-status-filter-v2">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions()}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    className="h-8 text-xs"
                    onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
                    data-testid="button-clear-filters-v2"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 350px)', width: '100%' }}>
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
                  pagination={true}
                  paginationPageSize={20}
                  animateRows={true}
                  rowSelection="single"
                  suppressRowClickSelection={true}
                  gridOptions={{
                    defaultColDef: {
                      sortable: true,
                      filter: true,
                      resizable: true
                    },
                    getRowId: (params: any) => params.data.recCanUuid
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RecruitmentModuleV2;
