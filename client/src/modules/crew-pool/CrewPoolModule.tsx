import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FilterIcon, PlusIcon, EditIcon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
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

export const CrewPoolModule = (): JSX.Element => {
    const [selectedCrewPoolPage, setSelectedCrewPoolPage] = useState("crew-database");
    const [showFilters, setShowFilters] = useState(true);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);
    
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

    // Dummy data for crew members
    const crewData = useMemo(() => [
        {
            id: "A001",
            empNo: "A001",
            firstName: "Aadersh",
            middleName: "Alok",
            familyName: "Sinha",
            dob: "14 Mar 1992",
            age: "29.0",
            presentRank: "Chief Officer",
            nationality: "Indian",
            status: "On Board",
            presentVessel: "Jasper",
            joiningDate: "12 Feb 2021",
            contractPeriod: "4 M",
            reliefDue: "12 Jun 2021",
            lastVessel: "Amethyst",
            signOffDate: "12 Feb 2021",
            reason: "Contract Completion",
            availability: "12 Feb 2021"
        },
        {
            id: "B002",
            empNo: "B002",
            firstName: "Marcus",
            middleName: "James",
            familyName: "Thompson",
            dob: "22 Aug 1985",
            age: "37.5",
            presentRank: "Master",
            nationality: "British",
            status: "On Leave",
            presentVessel: "Ocean Pioneer",
            joiningDate: "15 Jan 2021",
            contractPeriod: "6 M",
            reliefDue: "15 Jul 2021",
            lastVessel: "Sea Eagle",
            signOffDate: "10 Jan 2021",
            reason: "Relief",
            availability: "15 Aug 2021"
        },
        {
            id: "C003",
            empNo: "C003",
            firstName: "Carlos",
            middleName: "Roberto",
            familyName: "Mendez",
            dob: "05 Dec 1988",
            age: "33.2",
            presentRank: "Chief Engineer",
            nationality: "Philippines",
            status: "Available",
            presentVessel: "Atlantic Star",
            joiningDate: "20 Mar 2021",
            contractPeriod: "5 M",
            reliefDue: "20 Aug 2021",
            lastVessel: "Pacific Dawn",
            signOffDate: "15 Mar 2021",
            reason: "Contract Completion",
            availability: "Available"
        },
        {
            id: "D004",
            empNo: "D004",
            firstName: "Dmitri",
            middleName: "Sergei",
            familyName: "Volkov",
            dob: "18 Jun 1990",
            age: "31.8",
            presentRank: "Second Officer",
            nationality: "Ukrainian",
            status: "On Board",
            presentVessel: "Global Trader",
            joiningDate: "10 Apr 2021",
            contractPeriod: "4 M",
            reliefDue: "10 Aug 2021",
            lastVessel: "Nordic Wind",
            signOffDate: "05 Apr 2021",
            reason: "Relief",
            availability: "10 Aug 2021"
        },
        {
            id: "E005",
            empNo: "E005",
            firstName: "Ahmed",
            middleName: "Hassan",
            familyName: "Al-Rashid",
            dob: "30 Nov 1987",
            age: "34.1",
            presentRank: "Electrician",
            nationality: "Egyptian",
            status: "Medical",
            presentVessel: "Desert Rose",
            joiningDate: "25 Feb 2021",
            contractPeriod: "6 M",
            reliefDue: "25 Aug 2021",
            lastVessel: "Sand Dune",
            signOffDate: "20 Feb 2021",
            reason: "Contract Completion",
            availability: "TBD"
        }
    ], []);

    // Actions cell renderer for edit button
    const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
        const handleEditClick = () => {
            console.log('Edit clicked for:', params.data.id);
            // Crew database form will be implemented in next step
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

    // Column definitions with groups
    const columnDefs: ColDef[] = useMemo(() => [
        {
            headerName: '',
            children: [
                {
                    headerName: 'Emp\nNo',
                    field: 'empNo',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    pinned: 'left',
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'First\nName',
                    field: 'firstName',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Middle\nName',
                    field: 'middleName',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Family\nName',
                    field: 'familyName',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'DOB',
                    field: 'dob',
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true
                },
                {
                    headerName: 'Age',
                    field: 'age',
                    width: 50,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agNumberColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true
                },
                {
                    headerName: 'Present\nRank',
                    field: 'presentRank',
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agSetColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Nationality',
                    field: 'nationality',
                    width: 90,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agSetColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Status',
                    field: 'status',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agSetColumnFilter',
                    floatingFilter: true,
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
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Joining\nDate',
                    field: 'joiningDate',
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Cont.\nPeriod',
                    field: 'contractPeriod',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Relief\nDue',
                    field: 'reliefDue',
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                }
            ]
        },
        {
            headerName: 'Previous Assignment',
            children: [
                {
                    headerName: 'Last\nVessel',
                    field: 'lastVessel',
                    width: 80,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'S/O\nDate',
                    field: 'signOffDate',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agDateColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true,
                    headerClass: 'ag-header-cell-text-wrap'
                },
                {
                    headerName: 'Reason',
                    field: 'reason',
                    width: 100,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true
                },
                {
                    headerName: 'Avail',
                    field: 'availability',
                    width: 70,
                    cellStyle: { fontSize: '12px', color: '#4f5863' },
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    sortable: true,
                    resizable: true
                }
            ]
        },
        {
            headerName: 'Actions',
            field: 'actions',
            width: 80,
            cellRenderer: ActionsCellRenderer,
            sortable: false,
            filter: false,
            cellClass: 'flex items-center justify-center',
            pinned: 'right',
            lockPosition: true
        }
    ], [ActionsCellRenderer]);

    // Grid ready handler
    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    }, []);

    // Handle window resize with proper cleanup
    useEffect(() => {
        const handleResize = () => {
            if (gridApi && !gridApi.isDestroyed()) {
                setTimeout(() => {
                    gridApi.sizeColumnsToFit();
                }, 100);
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [gridApi]);

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
                                <SelectContent>
                                    <SelectItem value="MV Ocean Explorer">MV Ocean Explorer</SelectItem>
                                    <SelectItem value="MV Sea Pioneer">MV Sea Pioneer</SelectItem>
                                    <SelectItem value="MV Atlantic Star">MV Atlantic Star</SelectItem>
                                    <SelectItem value="MV Pacific Dawn">MV Pacific Dawn</SelectItem>
                                    <SelectItem value="MV Global Trader">MV Global Trader</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-rank">
                                    <SelectValue placeholder="Rank" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Master">Master</SelectItem>
                                    <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                                    <SelectItem value="Chief Mate">Chief Mate</SelectItem>
                                    <SelectItem value="First Officer">First Officer</SelectItem>
                                    <SelectItem value="Second Officer">Second Officer</SelectItem>
                                    <SelectItem value="Second Engineer">Second Engineer</SelectItem>
                                    <SelectItem value="Third Engineer">Third Engineer</SelectItem>
                                    <SelectItem value="Able Seaman">Able Seaman</SelectItem>
                                    <SelectItem value="Electrician">Electrician</SelectItem>
                                    <SelectItem value="Bosun">Bosun</SelectItem>
                                    <SelectItem value="Cook">Cook</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]" data-testid="select-nationality">
                                    <SelectValue placeholder="Nationality" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="British">British</SelectItem>
                                    <SelectItem value="Indian">Indian</SelectItem>
                                    <SelectItem value="Philippines">Philippines</SelectItem>
                                    <SelectItem value="Ukrainian">Ukrainian</SelectItem>
                                    <SelectItem value="Romanian">Romanian</SelectItem>
                                    <SelectItem value="Polish">Polish</SelectItem>
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
                <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
                    <CardContent className="p-4 pl-0 bg-[#f7fafc]">
                        <AgGridTable
                            rowData={crewData}
                            columnDefs={columnDefs}
                            onGridReady={onGridReady}
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
            <MainLayout>
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
                                // New crew functionality will be implemented later
                                console.log('New crew clicked');
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
        </>
    );
};