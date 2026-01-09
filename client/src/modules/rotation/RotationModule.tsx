import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api';
import { useViewport } from '@/hooks/useViewport';
import RotationSideBar from './RotationSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Filter, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { DueCrewTable } from './DueCrewTable';
import { RotationPlanTable } from './RotationPlanTable';
import { ApprovalTable } from './ApprovalTable';
import { VesselFleetGroupFilter, FilterMode } from '@/components/filters/vessel-fleet-group-filter';

// Hook to fetch vessels from external SAIL ERP API (same source as Vessel Database)
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
            }));
        }
    });
};

// Hook to fetch company ranks - filter to only parent ranks (not role variants)
const useCompanyRanks = () => {
    return useQuery({
        queryKey: ['/api/company-ranks'],
        select: (data: any[]) => {
            // Filter to only show parent ranks (isRoleRow === false or undefined)
            // Role variants have isRoleRow: true and should not appear in the dropdown
            // Handle both camelCase (isRoleRow) and snake_case (is_role_row) from API
            return data.filter((rank: any) => !rank.isRoleRow && !rank.is_role_row);
        }
    });
};

// Approval Screen Component
function ApprovalScreen() {
    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;
    
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [draftIdFilter, setDraftIdFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    
    // Date range state - default is Today - 2 months to Today + 5 months
    const today = useMemo(() => new Date(), []);
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
        start: addMonths(today, -2),
        end: addMonths(today, 5)
    });
    const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);

    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: companyRanks = [], isLoading: ranksLoading } = useCompanyRanks();

    const handleClearFilters = () => {
        setSelectedVessels([]);
        setSelectedRanks([]);
        setDraftIdFilter("");
        setDateRange({
            start: addMonths(today, -2),
            end: addMonths(today, 5)
        });
    };

    const toggleVessel = (vesselId: string) => {
        setSelectedVessels(prev => 
            prev.includes(vesselId) 
                ? prev.filter(v => v !== vesselId)
                : [...prev, vesselId]
        );
    };

    const toggleRank = (rankName: string) => {
        setSelectedRanks(prev => 
            prev.includes(rankName) 
                ? prev.filter(r => r !== rankName)
                : [...prev, rankName]
        );
    };

    return (
        <div className="flex flex-col h-full">
            <SectionTitleComponents title="Rotation Approval">
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
                <div className="mb-4 p-3 md:p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                    {/* Desktop/Laptop: Horizontal flex layout */}
                    {!isSmallScreen && (
                        <div className="flex flex-nowrap items-center gap-3">
                            <div className="shrink-0">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-[130px]"
                                            data-testid="filter-vessel"
                                        >
                                            {selectedVessels.length === 0 ? "Vessel" : `${selectedVessels.length} selected`}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {vessels.map((vessel: any) => (
                                                <div key={vessel.vesselId} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`vessel-${vessel.vesselId}`}
                                                        checked={selectedVessels.includes(vessel.vesselId)}
                                                        onCheckedChange={() => toggleVessel(vessel.vesselId)}
                                                        data-testid={`checkbox-vessel-${vessel.vesselId}`}
                                                    />
                                                    <label htmlFor={`vessel-${vessel.vesselId}`} className="text-sm font-normal cursor-pointer">
                                                        {vessel.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="shrink-0">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-[130px]"
                                            data-testid="filter-rank"
                                        >
                                            {selectedRanks.length === 0 ? "Rank" : `${selectedRanks.length} selected`}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {companyRanks.map((rank: any) => (
                                                <div key={rank.rank} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`rank-${rank.rank}`}
                                                        checked={selectedRanks.includes(rank.rank)}
                                                        onCheckedChange={() => toggleRank(rank.rank)}
                                                        data-testid={`checkbox-rank-${rank.rank}`}
                                                    />
                                                    <label htmlFor={`rank-${rank.rank}`} className="text-sm font-normal cursor-pointer">
                                                        {rank.rank}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="shrink-0 w-[100px]">
                                <input
                                    type="text"
                                    placeholder="Draft ID"
                                    value={draftIdFilter}
                                    onChange={(e) => setDraftIdFilter(e.target.value)}
                                    className="h-8 w-full px-3 text-[11px] border border-[#e1e8ed] rounded-md focus:outline-none focus:ring-2 focus:ring-[#16569e]"
                                    data-testid="input-draft-id"
                                />
                            </div>

                            <div className="shrink-0">
                                <Popover open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-56 text-[11px] border-[#e1e8ed] justify-between"
                                            data-testid="select-date-range"
                                        >
                                            <span className="truncate flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4" />
                                                {format(dateRange.start, 'dd-MMM-yy')} - {format(dateRange.end, 'dd-MMM-yy')}
                                            </span>
                                            <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-4" align="start">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">Start Date</label>
                                                <Calendar mode="single" selected={dateRange.start} onSelect={(date) => date && setDateRange({ ...dateRange, start: date })} disabled={(date) => date > dateRange.end} data-testid="calendar-start-date" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium mb-2 block">End Date</label>
                                                <Calendar mode="single" selected={dateRange.end} onSelect={(date) => date && setDateRange({ ...dateRange, end: date })} disabled={(date) => date < dateRange.start} data-testid="calendar-end-date" />
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t">
                                                <Button variant="outline" size="sm" onClick={() => { const resetToday = new Date(); setDateRange({ start: addMonths(resetToday, -2), end: addMonths(resetToday, 5) }); }} data-testid="button-reset-date-range">Reset</Button>
                                                <Button size="sm" onClick={() => setDateRangeDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-apply-date-range">Apply</Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Button variant="outline" onClick={handleClearFilters} className="h-8 px-3 text-[#8798ad] text-[11px] border-[#e1e8ed] shrink-0" data-testid="button-clear-filters">Clear</Button>
                        </div>
                    )}

                    {/* Tablet: Grid layout */}
                    {isTablet && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-vessel">
                                            {selectedVessels.length === 0 ? "Vessel" : `${selectedVessels.length} selected`}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {vessels.map((vessel: any) => (
                                                <div key={vessel.vesselId} className="flex items-center space-x-2">
                                                    <Checkbox id={`vessel-tablet-${vessel.vesselId}`} checked={selectedVessels.includes(vessel.vesselId)} onCheckedChange={() => toggleVessel(vessel.vesselId)} data-testid={`checkbox-vessel-${vessel.vesselId}`} />
                                                    <label htmlFor={`vessel-tablet-${vessel.vesselId}`} className="text-sm font-normal cursor-pointer">{vessel.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-rank">
                                            {selectedRanks.length === 0 ? "Rank" : `${selectedRanks.length} selected`}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {companyRanks.map((rank: any) => (
                                                <div key={rank.rank} className="flex items-center space-x-2">
                                                    <Checkbox id={`rank-tablet-${rank.rank}`} checked={selectedRanks.includes(rank.rank)} onCheckedChange={() => toggleRank(rank.rank)} data-testid={`checkbox-rank-${rank.rank}`} />
                                                    <label htmlFor={`rank-tablet-${rank.rank}`} className="text-sm font-normal cursor-pointer">{rank.rank}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <input type="text" placeholder="Draft ID" value={draftIdFilter} onChange={(e) => setDraftIdFilter(e.target.value)} className="h-8 w-full px-3 text-[11px] border border-[#e1e8ed] rounded-md focus:outline-none focus:ring-2 focus:ring-[#16569e]" data-testid="input-draft-id" />
                            </div>

                            <div className="flex gap-3">
                                <Popover open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 flex-1 text-[11px] border-[#e1e8ed] justify-between" data-testid="select-date-range">
                                            <span className="truncate flex items-center gap-2"><CalendarIcon className="h-4 w-4" />{format(dateRange.start, 'dd-MMM-yy')} - {format(dateRange.end, 'dd-MMM-yy')}</span>
                                            <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-4" align="start">
                                        <div className="space-y-4">
                                            <div><label className="text-sm font-medium mb-2 block">Start Date</label><Calendar mode="single" selected={dateRange.start} onSelect={(date) => date && setDateRange({ ...dateRange, start: date })} disabled={(date) => date > dateRange.end} data-testid="calendar-start-date" /></div>
                                            <div><label className="text-sm font-medium mb-2 block">End Date</label><Calendar mode="single" selected={dateRange.end} onSelect={(date) => date && setDateRange({ ...dateRange, end: date })} disabled={(date) => date < dateRange.start} data-testid="calendar-end-date" /></div>
                                            <div className="flex gap-2 pt-2 border-t"><Button variant="outline" size="sm" onClick={() => { const resetToday = new Date(); setDateRange({ start: addMonths(resetToday, -2), end: addMonths(resetToday, 5) }); }} data-testid="button-reset-date-range">Reset</Button><Button size="sm" onClick={() => setDateRangeDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-apply-date-range">Apply</Button></div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button variant="outline" onClick={handleClearFilters} className="h-8 w-20 text-[#8798ad] text-[11px] border-[#e1e8ed]" data-testid="button-clear-filters">Clear</Button>
                            </div>
                        </div>
                    )}

                    {/* Phone: Vertical layout */}
                    {isPhone && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-vessel">
                                            {selectedVessels.length === 0 ? "Vessel" : `${selectedVessels.length} sel`}
                                            <ChevronDown className="ml-1 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {vessels.map((vessel: any) => (
                                                <div key={vessel.vesselId} className="flex items-center space-x-2">
                                                    <Checkbox id={`vessel-phone-${vessel.vesselId}`} checked={selectedVessels.includes(vessel.vesselId)} onCheckedChange={() => toggleVessel(vessel.vesselId)} data-testid={`checkbox-vessel-${vessel.vesselId}`} />
                                                    <label htmlFor={`vessel-phone-${vessel.vesselId}`} className="text-sm font-normal cursor-pointer">{vessel.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-rank">
                                            {selectedRanks.length === 0 ? "Rank" : `${selectedRanks.length} sel`}
                                            <ChevronDown className="ml-1 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {companyRanks.map((rank: any) => (
                                                <div key={rank.rank} className="flex items-center space-x-2">
                                                    <Checkbox id={`rank-phone-${rank.rank}`} checked={selectedRanks.includes(rank.rank)} onCheckedChange={() => toggleRank(rank.rank)} data-testid={`checkbox-rank-${rank.rank}`} />
                                                    <label htmlFor={`rank-phone-${rank.rank}`} className="text-sm font-normal cursor-pointer">{rank.rank}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <input type="text" placeholder="Draft ID" value={draftIdFilter} onChange={(e) => setDraftIdFilter(e.target.value)} className="h-8 w-full px-3 text-[11px] border border-[#e1e8ed] rounded-md focus:outline-none focus:ring-2 focus:ring-[#16569e]" data-testid="input-draft-id" />

                            <Popover open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-8 w-full text-[11px] border-[#e1e8ed] justify-between" data-testid="select-date-range">
                                        <span className="truncate flex items-center gap-2"><CalendarIcon className="h-4 w-4" />{format(dateRange.start, 'dd-MMM-yy')} - {format(dateRange.end, 'dd-MMM-yy')}</span>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-4" align="start">
                                    <div className="space-y-4">
                                        <div><label className="text-sm font-medium mb-2 block">Start Date</label><Calendar mode="single" selected={dateRange.start} onSelect={(date) => date && setDateRange({ ...dateRange, start: date })} disabled={(date) => date > dateRange.end} data-testid="calendar-start-date" /></div>
                                        <div><label className="text-sm font-medium mb-2 block">End Date</label><Calendar mode="single" selected={dateRange.end} onSelect={(date) => date && setDateRange({ ...dateRange, end: date })} disabled={(date) => date < dateRange.start} data-testid="calendar-end-date" /></div>
                                        <div className="flex gap-2 pt-2 border-t"><Button variant="outline" size="sm" onClick={() => { const resetToday = new Date(); setDateRange({ start: addMonths(resetToday, -2), end: addMonths(resetToday, 5) }); }} data-testid="button-reset-date-range">Reset</Button><Button size="sm" onClick={() => setDateRangeDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-apply-date-range">Apply</Button></div>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Button variant="outline" onClick={handleClearFilters} className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]" data-testid="button-clear-filters">Clear</Button>
                        </div>
                    )}
                </div>
            )}

            {/* Approval Table */}
            <ApprovalTable
                selectedVessels={selectedVessels}
                selectedRanks={selectedRanks}
                draftIdFilter={draftIdFilter}
                dateFrom={format(dateRange.start, 'yyyy-MM-dd')}
                dateTo={format(dateRange.end, 'yyyy-MM-dd')}
            />
        </div>
    );
}

export function RotationModule() {
    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;
    
    const [selectedRotationPage, setSelectedRotationPage] = useState<string>("due");
    const allowedPages = ["due", "plan", "approval"];

    // Filter state for Due page
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [dueInValue, setDueInValue] = useState("1m");
    const [rankValue, setRankValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    // Fetch data
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: companyRanks = [], isLoading: ranksLoading } = useCompanyRanks();

    // Mock fleet and group data for VesselFleetGroupFilter
    const fleetOptions = [
        { id: 1, value: 'fleet1', label: 'Fleet Group 1' },
        { id: 2, value: 'fleet2', label: 'Fleet Group 2' },
        { id: 3, value: 'fleet3', label: 'Fleet Group 3' },
    ];

    const groupOptions = [
        { id: 1, value: 'group1', label: 'Additional Group 1' },
        { id: 2, value: 'group2', label: 'Additional Group 2' },
        { id: 3, value: 'group3', label: 'Additional Group 3' },
    ];

    const handleClearFilters = () => {
        setFilterType("vessel");
        setSelectedVessels([]);
        setFleetValue("");
        setAddGroupValue("");
        setDueInValue("1m");
        setRankValue("");
    };

    const toggleVessel = (vesselId: string) => {
        setSelectedVessels(prev => 
            prev.includes(vesselId) 
                ? prev.filter(v => v !== vesselId)
                : [...prev, vesselId]
        );
    };

    const renderDueContent = () => {
        return (
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Crew Due/ Overdue">
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

                <VesselFleetGroupFilter
                    mode={filterType}
                    onModeChange={(mode: FilterMode) => setFilterType(mode)}
                    vessels={vessels}
                    selectedVessels={selectedVessels}
                    onToggleVessel={toggleVessel}
                    vesselsLoading={vesselsLoading}
                    fleets={fleetOptions}
                    selectedFleet={fleetValue}
                    onFleetChange={setFleetValue}
                    groups={groupOptions}
                    selectedGroup={addGroupValue}
                    onGroupChange={setAddGroupValue}
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                    onClear={handleClearFilters}
                    showFilterToggle={false}
                    testIdPrefix="rotation"
                    additionalFilters={
                        <>
                            <Select value={dueInValue} onValueChange={setDueInValue}>
                                <SelectTrigger 
                                    className="h-8 w-[120px] text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                    data-testid="select-due-in"
                                >
                                    <SelectValue placeholder="Due in" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3m">Due in 3M</SelectItem>
                                    <SelectItem value="2m">Due in 2M</SelectItem>
                                    <SelectItem value="1m">Due in 1M</SelectItem>
                                    <SelectItem value="overdue1m">Overdue in 1M</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={rankValue} onValueChange={setRankValue}>
                                <SelectTrigger 
                                    className="h-8 w-[120px] text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                    data-testid="select-rank"
                                    disabled={ranksLoading}
                                >
                                    <SelectValue placeholder={ranksLoading ? "Loading..." : "Rank"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyRanks.map((rank: any) => (
                                        <SelectItem key={rank.id} value={rank.rank}>
                                            {rank.rank}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    }
                />

                {/* Due Crew Table */}
                <DueCrewTable
                    filterType={filterType}
                    selectedVessels={selectedVessels}
                    fleetValue={fleetValue}
                    addGroupValue={addGroupValue}
                    dueInValue={dueInValue}
                    rankValue={rankValue}
                />
            </div>
        );
    };

    const renderContent = () => {
        switch (selectedRotationPage) {
            case "due":
                return renderDueContent();
            case "plan":
                return <RotationPlanTable />;
            case "approval":
                return <ApprovalScreen />;
            default:
                return null;
        }
    };

    return (
        <div data-testid="rotation-container">
            <RotationSideBar 
                selectedRotationPage={selectedRotationPage}
                setSelectedRotationPage={setSelectedRotationPage}
                allowedPages={allowedPages}
            />
            <MainLayout hasSidebar={true}>
                {renderContent()}
            </MainLayout>
        </div>
    );
}
