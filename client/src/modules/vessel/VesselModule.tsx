import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import VesselSideBar from './VesselSideBar';
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
import { Eye } from 'lucide-react';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { ColDef, GridApi } from 'ag-grid-community';

// Hook to fetch vessels from Master Data (ID 014)
const useVessels = () => {
    return useQuery({
        queryKey: ['/api/masters/014/data'],
        select: (data: any[]) => {
            return data
                .filter((vessel: any) => !vessel.isDeleted)
                .map((vessel: any) => ({
                    id: vessel.id,
                    vesselId: vessel.entryId,
                    name: vessel.name || vessel.vessel || 'Unknown Vessel',
                    vesselType: vessel.vesselType || 'Unknown Type',
                }));
        }
    });
};

// Hook to fetch crew members
const useCrewMembers = () => {
    return useQuery({
        queryKey: ['/api/crew-members'],
        select: (data: any[]) => data
    });
};

// Hook to fetch vessel ranks from latest revision
const useVesselRanks = (vesselId: string | null) => {
    return useQuery({
        queryKey: ['/api/vessel-revisions/ranks', vesselId],
        enabled: !!vesselId,
        select: (data: any[]) => data
    });
};

export const VesselModule = (): JSX.Element => {
    const [selectedVesselPage, setSelectedVesselPage] = useState("vessel-database");
    
    // Define allowed pages for the vessel module
    const allowedPages = ["vessel-database"];

    // Filter state
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [vesselValue, setVesselValue] = useState("");
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    // Vessel detail view state
    const [selectedVessel, setSelectedVessel] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("crew-list");

    const gridApiRef = useRef<GridApi | null>(null);

    // Fetch vessels and crew members
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: crewMembers = [], isLoading: crewLoading } = useCrewMembers();
    
    // Fetch vessel ranks for selected vessel
    const { data: vesselRanks = [], isLoading: ranksLoading } = useVesselRanks(selectedVessel?.vesselId || null);

    const handleClearFilters = () => {
        setVesselValue("");
        setFleetValue("");
        setAddGroupValue("");
        setFilterType("vessel");
    };

    const handleEditVessel = (vesselData: any) => {
        const vessel = vessels.find((v: any) => v.id === vesselData.id);
        if (vessel) {
            setSelectedVessel(vessel);
            setActiveTab("crew-list");
        }
    };

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

    // Calculate crew on board for each vessel
    const vesselData = useMemo(() => {
        return vessels.map((vessel: any) => {
            const crewCount = crewMembers.filter((crew: any) => 
                crew.presentVessel === vessel.name || 
                crew.presentVessel === vessel.vesselId
            ).length;

            return {
                id: vessel.id,
                vessel: vessel.name,
                type: vessel.vesselType,
                crewOnBoard: crewCount
            };
        });
    }, [vessels, crewMembers]);

    const ActionsCellRenderer = (props: any) => {
        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (props.context && props.context.handleEditVessel) {
                props.context.handleEditVessel(props.data);
            }
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

    const columnDefs: ColDef[] = useMemo(() => [
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
            cellClass: 'flex items-center justify-center',
            pinned: 'right',
            lockPosition: true
        }
    ], []);

    const onGridReady = (params: { api: GridApi }) => {
        gridApiRef.current = params.api;
    };

    const renderVesselDetail = () => {
        if (!selectedVessel) return null;

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
                                {/* Download buttons aligned to the right */}
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2"
                                        data-testid="button-download-imo"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="text-xs">IMO Crew List</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2"
                                        data-testid="button-download-us"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="text-xs">US Crew List</span>
                                    </Button>
                                </div>

                                {/* Table Container */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <ScrollArea className="h-[500px] w-full">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                                                    <TableHead className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm">S. No.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Rank</TableHead>
                                                    <TableHead className="text-white text-xs font-normal sticky top-0 z-30 bg-[#52baf3] shadow-sm">Surname, Given Name</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Nationality</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Joined</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Doc Check</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-20 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Famil.</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Relief Date</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Planned S/Off</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-40 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Doc. Expiring (2m)/Expired</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-32 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Medical Expiring</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-40 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Vacc. Expiring (2m)/Expired</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Appraisal</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-24 sticky top-0 z-30 bg-[#52baf3] shadow-sm">Handover</TableHead>
                                                    <TableHead className="text-white text-xs font-normal w-16 sticky top-0 z-30 bg-[#52baf3] shadow-sm"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ranksLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            Loading vessel positions...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : vesselRanks.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={15} className="text-center text-xs text-gray-500 py-8">
                                                            No positions configured for this vessel. Please configure positions in Admin &gt; Rank Admin &gt; Vessel.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    vesselRanks.map((rank: any, index: number) => (
                                                        <TableRow key={rank.id || index} className="hover:bg-gray-50 border-b border-gray-100">
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-sno-${index + 1}`}>
                                                                {index + 1}.
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-rank-${index + 1}`}>
                                                                {rank.role || rank.rank}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-name-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-nationality-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-joined-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-doccheck-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-famil-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-relief-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-planned-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-docexp-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-medical-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-vaccexp-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-appraisal-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-gray-700" data-testid={`cell-handover-${index + 1}`}>
                                                                {/* Empty - will be filled when crew assigned */}
                                                            </TableCell>
                                                            <TableCell className="text-xs" data-testid={`cell-actions-${index + 1}`}>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="training-matrix" className="mt-0">
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                    Training Matrix - {selectedVessel.name}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Training matrix content will be displayed here.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="officer-matrix" className="mt-0">
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                    Officer Matrix - {selectedVessel.name}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Officer matrix content will be displayed here.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="planning" className="mt-0">
                            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                    Planning - {selectedVessel.name}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Planning content will be displayed here.
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        );
    };

    const renderVesselDatabase = () => {
        return (
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Vessel Database">
                    <div className="flex gap-2">
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
                                <Label 
                                    htmlFor="filter-vessel" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Vessel
                                </Label>
                                <Select value={vesselValue} onValueChange={setVesselValue}>
                                    <SelectTrigger 
                                        className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                        data-testid="select-vessel-value"
                                        disabled={vesselsLoading}
                                    >
                                        <SelectValue placeholder={vesselsLoading ? "Loading..." : "Vessel"} />
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

                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="fleet" 
                                    id="filter-fleet"
                                    className="h-4 w-4"
                                    data-testid="radio-fleet"
                                />
                                <Label 
                                    htmlFor="filter-fleet" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Fleet
                                </Label>
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
                                <Label 
                                    htmlFor="filter-addgroup" 
                                    className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                >
                                    Add Group
                                </Label>
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
                            columnDefs={columnDefs}
                            onGridReady={onGridReady}
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
    };

    return (
        <>
            <VesselSideBar 
                selectedVesselPage={selectedVesselPage} 
                setSelectedVesselPage={setSelectedVesselPage} 
                allowedPages={allowedPages} 
            />
            <MainLayout>
                {selectedVessel ? (
                    renderVesselDetail()
                ) : (
                    selectedVesselPage === "vessel-database" && renderVesselDatabase()
                )}
            </MainLayout>
        </>
    );
};
