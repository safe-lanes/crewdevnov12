import { useState, useMemo, useCallback } from 'react';
import { FilterIcon, PlusIcon, PaperclipIcon, EditIcon, Trash2Icon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { useQueryClient } from '@tanstack/react-query';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBar from '../recruitment/RecruitmentSideBar';
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
      setSelectedCandidate({
        ...params.data,
        middleName: params.data.middleName || ''
      });
      setShowApplicationForm(true);
      
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
          data-testid={`button-attachment-${params.data.recCanUuid}`}
        >
          <PaperclipIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleEditClick}
          data-testid={`button-edit-${params.data.recCanUuid}`}
        >
          <EditIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-red-100"
          onClick={handleDeleteClick}
          data-testid={`button-delete-${params.data.recCanUuid}`}
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
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
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

                <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 shrink-0" data-testid="button-apply-filters-v2">
                  Apply
                </Button>

                <Button 
                  variant="outline" 
                  className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
                  onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
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
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
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
                </div>
                
                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4" data-testid="button-apply-filters-v2">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3"
                    onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
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
                        rankNames.map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
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
                </div>
                
                <div className="flex gap-2">
                  <Button className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 flex-1" data-testid="button-apply-filters-v2">
                    Apply
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3"
                    onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
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
              data-testid="button-toggle-filters-v2"
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
              data-testid="button-new-crew-v2"
            >
              <PlusIcon className={`h-3 w-3 ${isPhone ? '' : 'mr-1'}`} />
              {!isPhone && 'New Crew'}
            </Button>
          </div>
        </SectionTitleComponents>
        {renderContent()}
      </MainLayout>

      {showApplicationForm && (
        <RecruitmentApplicationFormV2
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

export default RecruitmentModuleV2;
