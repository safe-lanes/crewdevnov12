import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilterIcon, PlusIcon, EditIcon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import { useViewport, getViewportConfig } from '@/hooks/useViewport';
import { format, parseISO, isValid } from 'date-fns';
import CrewPoolSideBar from './CrewPoolSideBar';
import MainLayout from '../../components/main/MainLayout';
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
import CrewInfoForm from './CrewInfoForm';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { NATIONALITIES } from '@/utils/data/nationalities';

const formatCompactDate = (value: any): string => {
    if (!value) return '';
    try {
        const date = typeof value === 'string' ? parseISO(value) : new Date(value);
        if (!isValid(date)) return value;
        return format(date, 'dd-MMM-yy');
    } catch {
        return value;
    }
};

const formatContractPeriod = (value: any): string => {
    if (!value) return '';
    const str = String(value).toLowerCase().trim();
    const monthMatch = str.match(/^(\d+)\s*(?:months?|mo?\.?)$/i);
    if (monthMatch) {
        return `${monthMatch[1]}M`;
    }
    const weekMatch = str.match(/^(\d+)\s*(?:weeks?|wk?\.?)$/i);
    if (weekMatch) {
        return `${weekMatch[1]}W`;
    }
    return value;
};

export const CrewPoolModule = (): JSX.Element => {
    const [selectedCrewPoolPage, setSelectedCrewPoolPage] = useState("crew-database");
    const [showFilters, setShowFilters] = useState(true);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);
    const [isCrewInfoFormOpen, setIsCrewInfoFormOpen] = useState(false);
    const [selectedCrewMember, setSelectedCrewMember] = useState<any | null>(null);
    const viewport = useViewport();
    const viewportConfig = getViewportConfig(viewport);
    
    // Vessel lookup hook for ID to name translation
    const { getVesselName } = useVesselLookup();
    
    // Company ranks hook for dynamic rank dropdown
    const { rankNames, isLoading: ranksLoading } = useCompanyRanks();
    
    // Rank normalization hook to convert positions (e.g., "OS_1") to actual ranks (e.g., "OS")
    const { normalizeRank } = useRankNormalization();
    
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
    
    // Fetch vessel master data (Master 014) for vessel filter dropdown
    const { data: vesselMasterDataRaw = [], isLoading: vesselsLoading } = useQuery<Array<{ entryId: string; name: string }>>({
        queryKey: ["/api/masters/014/data"],
    });
    
    // Extract vessel entries (id and name) for dropdown - sorted by name
    const vesselMasterData = useMemo(() => {
        return vesselMasterDataRaw
            .filter(v => v.name && v.entryId)
            .map(v => ({ id: v.entryId, name: v.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [vesselMasterDataRaw]);
    
    // Define allowed pages for the crew pool module
    const allowedPages = ["crew-database"];

    // Filter state
    const [filters, setFilters] = useState({
        searchName: "",
        vessel: "",
        rank: "",
        nationality: "",
        status: "",
        reliefDue: ""
    });

    // Fetch crew members from API
    const { data: rawCrewData = [], isLoading: isCrewLoading, error: crewError } = useQuery({
        queryKey: ['/api/crew-members'],
        queryFn: async () => {
            const response = await fetch('/api/crew-members');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },
    });

    // Normalize and filter crew data for AG Grid
    // - Converts positions (e.g., "OS_1") to actual ranks (e.g., "OS")
    // - Applies external filter state from dropdown controls
    const crewData = useMemo(() => {
        if (!rawCrewData || rawCrewData.length === 0) return [];
        
        // First normalize the rank data
        let data = rawCrewData.map((crew: any) => ({
            ...crew,
            presentRank: normalizeRank(crew.presentRank || '') || crew.presentRank
        }));
        
        // Apply external filters
        return data.filter((crew: any) => {
            const fullName = `${crew.firstName || ''} ${crew.middleName || ''} ${crew.familyName || ''}`.toLowerCase();
            const matchesName = filters.searchName === "" || fullName.includes(filters.searchName.toLowerCase());
            const matchesVessel = filters.vessel === "" || crew.presentVessel === filters.vessel;
            const matchesRank = filters.rank === "" || crew.presentRank === filters.rank;
            const matchesNationality = filters.nationality === "" || crew.nationality === filters.nationality;
            const matchesStatus = filters.status === "" || crew.status === filters.status;
            
            // Relief due filter logic
            let matchesReliefDue = true;
            if (filters.reliefDue !== "") {
                const today = new Date();
                const reliefDate = crew.reliefDue ? new Date(crew.reliefDue) : null;
                
                if (filters.reliefDue === "overdue" && reliefDate) {
                    matchesReliefDue = reliefDate < today;
                } else if (filters.reliefDue === "this-month" && reliefDate) {
                    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    matchesReliefDue = reliefDate >= thisMonthStart && reliefDate <= thisMonthEnd;
                } else if (filters.reliefDue === "next-month" && reliefDate) {
                    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                    matchesReliefDue = reliefDate >= nextMonthStart && reliefDate <= nextMonthEnd;
                }
            }
            
            return matchesName && matchesVessel && matchesRank && matchesNationality && matchesStatus && matchesReliefDue;
        });
    }, [rawCrewData, normalizeRank, filters]);

    // Actions cell renderer for edit button
    const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
        const handleEditClick = () => {
            console.log('Edit clicked for:', params.data.id);
            setSelectedCrewMember(params.data);
            setIsCrewInfoFormOpen(true);
        };

        return (
            <div className="flex items-center justify-center gap-1 h-full">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-gray-100"
                    onClick={handleEditClick}
                    data-testid={`button-edit-${params.data.id}`}
                >
                    <EditIcon className="h-4 w-4 text-gray-600" />
                </Button>
            </div>
        );
    }, []);

    // Column definitions with groups - responsive widths
    const columnDefs: ColDef[] = useMemo(() => [
        // Hidden updatedAt column for primary sorting (latest edited first)
        {
            field: 'updatedAt',
            hide: true,
            sortable: true,
            sort: 'desc',
            sortIndex: 0
        },
        // Standalone Crew ID column (pinned) - secondary sort by ascending
        {
            headerName: 'ID',
            field: 'employeeId',
            width: viewportConfig.isDesktopOrLaptop ? undefined : 80,
            minWidth: 80,
            cellStyle: { fontSize: '13px', color: '#4f5863' },
            filter: 'agTextColumnFilter',
            floatingFilter: viewportConfig.showFloatingFilters,
            sortable: true,
            sort: 'asc',
            sortIndex: 1,
            resizable: true,
            pinned: 'left',
            headerClass: 'ag-header-cell-text-wrap'
        },
        // General Particulars group (for remaining columns)
        {
            headerName: 'General Particulars of Seafarer',
            headerClass: 'center-group-header',
            children: [
                {
                    headerName: 'First\nName',
                    field: 'firstName',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Middle\nName',
                    field: 'middleName',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    hide: true
                },
                {
                    headerName: 'Family\nName',
                    field: 'familyName',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 95,
                    minWidth: 95,
                    cellStyle: { fontSize: '13px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'DOB',
                    field: 'dob',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    valueFormatter: (params: any) => formatCompactDate(params.value)
                },
                {
                    headerName: 'Age',
                    field: 'age',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 50,
                    minWidth: 50,
                    cellStyle: { fontSize: '13px', color: '#4f5863' },
                    filter: 'agNumberColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true
                },
                {
                    headerName: 'Rank',
                    field: 'presentRank',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 100,
                    minWidth: 100,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agSetColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Nation',
                    field: 'nationality',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 85,
                    minWidth: 85,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agSetColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Status',
                    field: 'status',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    wrapText: true,
                    autoHeight: true,
                    cellRenderer: (params: any) => {
                        const status = params.value || 'Unknown';
                        let bgColor = '#e5e7eb';
                        let textColor = '#374151';
                        
                        if (status === 'On Board') {
                            bgColor = '#fed7aa';
                            textColor = '#9a3412';
                        } else if (status === 'On Leave') {
                            bgColor = '#bbf7d0';
                            textColor = '#166534';
                        } else if (status === 'Inactive') {
                            bgColor = '#e5e7eb';
                            textColor = '#4b5563';
                        }
                        
                        return (
                            <span 
                                style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    backgroundColor: bgColor,
                                    color: textColor,
                                    lineHeight: '1.2',
                                    whiteSpace: 'normal'
                                }}
                            >
                                {status}
                            </span>
                        );
                    },
                    filter: 'agSetColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                }
            ]
        },
        {
            headerName: 'Current Assignment',
            children: [
                {
                    headerName: 'Present\nVessel',
                    field: 'presentVessel',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 100,
                    minWidth: 100,
                    cellStyle: { fontSize: '13px', color: '#4f5863', whiteSpace: 'normal', lineHeight: '1.2' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => {
                        if (!params.value) return '';
                        return getVesselName(params.value) || params.value;
                    }
                },
                {
                    headerName: 'Signed On',
                    field: 'signOnDate',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => formatCompactDate(params.value)
                },
                {
                    headerName: 'Cont.',
                    field: 'contractPeriod',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 55,
                    minWidth: 55,
                    cellStyle: { fontSize: '13px', color: '#4f5863', textAlign: 'center', lineHeight: '1.2' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => formatContractPeriod(params.value)
                },
                {
                    headerName: 'Relief\nDue',
                    field: 'reliefDue',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => formatCompactDate(params.value)
                },
                {
                    headerName: 'Next\nAvailable',
                    field: 'nextAvailability',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => formatCompactDate(params.value)
                }
            ]
        },
        {
            headerName: 'Previous Assignment',
            children: [
                {
                    headerName: 'Last\nVessel',
                    field: 'lastVessel',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 100,
                    minWidth: 100,
                    cellStyle: { fontSize: '13px', color: '#4f5863', whiteSpace: 'normal', lineHeight: '1.2' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'S/O',
                    field: 'signOffDate',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 90,
                    minWidth: 90,
                    cellStyle: { fontSize: '13px', color: '#4f5863', lineHeight: '1.2' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true,
                    headerClass: 'ag-header-cell-text-wrap',
                    valueFormatter: (params: any) => formatCompactDate(params.value)
                },
                {
                    headerName: 'Reason',
                    field: 'reason',
                    width: viewportConfig.isDesktopOrLaptop ? undefined : 130,
                    minWidth: 130,
                    cellStyle: { fontSize: '13px', color: '#4f5863', whiteSpace: 'normal', lineHeight: '1.2' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: viewportConfig.showFloatingFilters,
                    sortable: true,
                    resizable: true,
                    wrapText: true,
                    autoHeight: true
                }
            ]
        },
        {
            headerName: '',
            field: 'actions',
            width: 45,
            minWidth: 45,
            maxWidth: 50,
            cellRenderer: ActionsCellRenderer,
            sortable: false,
            filter: false,
            cellClass: 'flex items-center justify-center',
            pinned: 'right',
            lockPosition: true,
            suppressHeaderMenuButton: true,
            suppressColumnsToolPanel: true
        }
    ], [ActionsCellRenderer, viewportConfig, getVesselName, normalizeRank]);

    // Grid ready handler - responsive logic is handled by AgGridTable component
    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridApi(params.api);
        // Note: responsive behavior is handled by AgGridTable component
    }, []);

    // Handle closing crew info form
    const handleCloseCrewInfoForm = () => {
        setIsCrewInfoFormOpen(false);
        setSelectedCrewMember(null);
    };

    const getTitle = () => {
        switch (selectedCrewPoolPage) {
            case "crew-database":
                return "Crew Database";
            default:
                return "Crew Database";
        }
    };

    const renderFiltersAndTable = () => {
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
                                data-testid="input-search-name"
                            />

                            <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-vessel">
                                    <SelectValue placeholder="Vessel" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {vesselsLoading ? (
                                        <SelectItem value="loading" disabled>Loading vessels...</SelectItem>
                                    ) : (
                                        vesselMasterData.map(vessel => (
                                            <SelectItem key={vessel.id} value={vessel.id} data-testid={`vessel-option-${vessel.id}`}>{vessel.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>

                            <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-rank">
                                    <SelectValue placeholder="Rank" />
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

                            <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-nationality">
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
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-status">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="On Board">On Board</SelectItem>
                                    <SelectItem value="On Leave">On Leave</SelectItem>
                                    <SelectItem value="Available">Available</SelectItem>
                                    <SelectItem value="Medical">Medical</SelectItem>
                                    <SelectItem value="Training">Training</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.reliefDue} onValueChange={(value) => setFilters(prev => ({ ...prev, reliefDue: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-relief-due">
                                    <SelectValue placeholder="Relief Due" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="This Week">This Week</SelectItem>
                                    <SelectItem value="This Month">This Month</SelectItem>
                                    <SelectItem value="Next Month">Next Month</SelectItem>
                                    <SelectItem value="Next 3 Months">Next 3 Months</SelectItem>
                                    <SelectItem value="Overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex gap-2">
                            <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]" data-testid="button-apply">
                                Apply
                            </Button>

                            <Button 
                                variant="outline" 
                                className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                                onClick={() => setFilters({ searchName: "", vessel: "", rank: "", nationality: "", status: "", reliefDue: "" })}
                                data-testid="button-clear"
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

                {/* AG Grid Table */}
                <div className="flex flex-col flex-1">
                    {isCrewLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-gray-500">Loading crew members...</div>
                        </div>
                    ) : crewError ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-red-500">Error loading crew members: {crewError.message}</div>
                        </div>
                    ) : (
                        <AgGridTable
                            rowData={crewData}
                            columnDefs={columnDefs}
                            onGridReady={onGridReady}
                            width="100%"
                            enableExport={true}
                            enableSideBar={true}
                            enableStatusBar={false}
                            enableRowGrouping={true}
                            enablePivoting={true}
                            enableAdvancedFilter={false}
                            rowSelection={false}
                            fillAvailableHeight={true}
                            bottomPadding={20}
                        />
                    )}
                </div>
            </>
        );
    };

    const renderContent = () => {
        if (selectedCrewPoolPage === "crew-database") {
            return renderFiltersAndTable();
        }
        
        return (
            <div className="p-6 text-center text-gray-600" data-testid="default-content">
                <div className="mt-20">
                    <p>Select a page from the sidebar</p>
                </div>
            </div>
        );
    };

    return (
        <>
            <CrewPoolSideBar 
                selectedCrewPoolPage={selectedCrewPoolPage}
                setSelectedCrewPoolPage={setSelectedCrewPoolPage}
                allowedPages={allowedPages}
            />
            <MainLayout hasSidebar={true}>
                <SectionTitleComponents title={getTitle()}>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
                            onClick={() => setShowFilters(!showFilters)}
                            data-testid="button-filters"
                        >
                            <FilterIcon className="h-3 w-3 mr-1" />
                            Filters
                        </Button>
                        <Button
                            className="h-8 w-32 bg-[#5dc86f] hover:bg-[#218838] text-xs text-white"
                            onClick={() => {
                                console.log('New crew clicked');
                                setSelectedCrewMember(null); // No selected crew member for new crew
                                setIsCrewInfoFormOpen(true);
                            }}
                            data-testid="button-new-crew"
                        >
                            <PlusIcon className="h-3 w-3 mr-1" />
                            New Crew
                        </Button>
                    </div>
                </SectionTitleComponents>
                {renderContent()}
            </MainLayout>
            
            {/* Crew Info Form Dialog */}
            <CrewInfoForm
                isOpen={isCrewInfoFormOpen}
                onClose={handleCloseCrewInfoForm}
                crewMember={selectedCrewMember}
                onCrewMemberChange={(newCrewMember) => setSelectedCrewMember(newCrewMember)}
            />
        </>
    );
};