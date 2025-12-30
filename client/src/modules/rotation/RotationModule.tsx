import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useViewport } from '@/hooks/useViewport';
import RotationSideBar from './RotationSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Filter, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { DueCrewTable } from './DueCrewTable';
import { RotationPlanTable } from './RotationPlanTable';
import { ApprovalTable } from './ApprovalTable';

// Hook to fetch vessels from external SAIL ERP API (same source as Vessel Database)
const useVessels = () => {
    return useQuery({
        queryKey: ['/api/external/vessels'],
        queryFn: async () => {
            const domain = localStorage.getItem('domain') || 'rsms';
            const response = await fetch(
                `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels?domain=${domain}`,
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

// Hook to fetch company ranks
const useCompanyRanks = () => {
    return useQuery({
        queryKey: ['/api/company-ranks'],
        select: (data: any[]) => data
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

                {showFilters && (
                    <div className="mb-4 p-3 md:p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                        {/* Desktop/Laptop: Horizontal flex layout */}
                        {!isSmallScreen && (
                            <div className="flex flex-nowrap items-center gap-3">
                                {/* Radio Group for Vessel/Fleet/Add Group */}
                                <RadioGroup 
                                    value={filterType} 
                                    onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                                    className="flex items-center gap-4 shrink-0"
                                >
                                    {/* Vessel Radio + Multi-Select */}
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
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="h-8 w-36 ml-1 text-xs text-[#0f172a] justify-between bg-transparent dark:bg-neutral-900 border-input"
                                                    disabled={vesselsLoading}
                                                    data-testid="select-vessel-multi"
                                                >
                                                    <span className="truncate">
                                                        {selectedVessels.length > 0 
                                                            ? `${selectedVessels.length} selected` 
                                                            : vesselsLoading ? "Loading..." : "Vessel"
                                                        }
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-2" align="start">
                                                <div className="max-h-60 overflow-y-auto">
                                                    {vessels.map((vessel: any) => (
                                                        <div 
                                                            key={vessel.id} 
                                                            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                                        >
                                                            <Checkbox 
                                                                checked={selectedVessels.includes(vessel.vesselId)}
                                                                onCheckedChange={() => toggleVessel(vessel.vesselId)}
                                                                data-testid={`checkbox-vessel-${vessel.id}`}
                                                            />
                                                            <label 
                                                                className="text-sm cursor-pointer flex-1"
                                                                onClick={() => toggleVessel(vessel.vesselId)}
                                                            >
                                                                {vessel.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Fleet Radio + Select */}
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
                                                className="h-8 w-32 ml-1 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-fleet-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                                <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                                <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Add Group Radio + Select */}
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
                                                className="h-8 w-36 ml-1 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-addgroup-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="group1">Additional Group 1</SelectItem>
                                                <SelectItem value="group2">Additional Group 2</SelectItem>
                                                <SelectItem value="group3">Additional Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </RadioGroup>

                                {/* Independent Due In Filter */}
                                <div className="shrink-0 w-[120px]">
                                    <Select value={dueInValue} onValueChange={setDueInValue}>
                                        <SelectTrigger 
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                </div>

                                {/* Independent Rank Filter */}
                                <div className="shrink-0 w-[120px]">
                                    <Select value={rankValue} onValueChange={setRankValue}>
                                        <SelectTrigger 
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                </div>

                                {/* Clear Button */}
                                <Button
                                    variant="outline"
                                    onClick={handleClearFilters}
                                    className="h-8 px-3 text-[#8798ad] text-[11px] border-[#e1e8ed] shrink-0"
                                    data-testid="button-clear-filters"
                                >
                                    Clear
                                </Button>
                            </div>
                        )}

                        {/* Tablet: Horizontal layout similar to desktop */}
                        {isTablet && (
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Radio Group - horizontal layout */}
                                <RadioGroup 
                                    value={filterType} 
                                    onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                                    className="flex flex-wrap items-center gap-4"
                                >
                                    {/* Vessel Radio + Multi-Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="vessel" 
                                            id="filter-vessel-tablet"
                                            className="h-4 w-4"
                                            data-testid="radio-vessel"
                                        />
                                        <Label 
                                            htmlFor="filter-vessel-tablet" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-20"
                                        >
                                            Vessel
                                        </Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="h-8 w-44 text-xs text-[#0f172a] justify-between bg-transparent dark:bg-neutral-900 border-input"
                                                    disabled={vesselsLoading}
                                                    data-testid="select-vessel-multi"
                                                >
                                                    <span className="truncate">
                                                        {selectedVessels.length > 0 
                                                            ? `${selectedVessels.length} selected` 
                                                            : vesselsLoading ? "Loading..." : "Vessel"
                                                        }
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-2" align="start">
                                                <div className="max-h-60 overflow-y-auto">
                                                    {vessels.map((vessel: any) => (
                                                        <div 
                                                            key={vessel.id} 
                                                            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                                        >
                                                            <Checkbox 
                                                                checked={selectedVessels.includes(vessel.vesselId)}
                                                                onCheckedChange={() => toggleVessel(vessel.vesselId)}
                                                                data-testid={`checkbox-vessel-${vessel.id}`}
                                                            />
                                                            <label 
                                                                className="text-sm cursor-pointer flex-1"
                                                                onClick={() => toggleVessel(vessel.vesselId)}
                                                            >
                                                                {vessel.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Fleet Radio + Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="fleet" 
                                            id="filter-fleet-tablet"
                                            className="h-4 w-4"
                                            data-testid="radio-fleet"
                                        />
                                        <Label 
                                            htmlFor="filter-fleet-tablet" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-20"
                                        >
                                            Fleet
                                        </Label>
                                        <Select value={fleetValue} onValueChange={setFleetValue}>
                                            <SelectTrigger 
                                                className="h-8 w-44 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-fleet-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                                <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                                <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Add Group Radio + Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="addGroup" 
                                            id="filter-addgroup-tablet"
                                            className="h-4 w-4"
                                            data-testid="radio-addgroup"
                                        />
                                        <Label 
                                            htmlFor="filter-addgroup-tablet" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-20"
                                        >
                                            Add Group
                                        </Label>
                                        <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                                            <SelectTrigger 
                                                className="h-8 w-44 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-addgroup-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="group1">Additional Group 1</SelectItem>
                                                <SelectItem value="group2">Additional Group 2</SelectItem>
                                                <SelectItem value="group3">Additional Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </RadioGroup>

                                {/* Due In Filter */}
                                <div className="shrink-0 w-[120px]">
                                    <Select value={dueInValue} onValueChange={setDueInValue}>
                                        <SelectTrigger 
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                </div>

                                {/* Rank Filter */}
                                <div className="shrink-0 w-[160px]">
                                    <Select value={rankValue} onValueChange={setRankValue}>
                                        <SelectTrigger 
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                </div>

                                {/* Clear Button */}
                                <Button
                                    variant="outline"
                                    onClick={handleClearFilters}
                                    className="h-8 px-3 text-[#8798ad] text-[11px] border-[#e1e8ed] shrink-0"
                                    data-testid="button-clear-filters"
                                >
                                    Clear
                                </Button>
                            </div>
                        )}

                        {/* Phone: Fully vertical layout */}
                        {isPhone && (
                            <div className="space-y-3">
                                {/* Radio Group - fully stacked */}
                                <RadioGroup 
                                    value={filterType} 
                                    onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                                    className="space-y-2"
                                >
                                    {/* Vessel Radio + Multi-Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="vessel" 
                                            id="filter-vessel-phone"
                                            className="h-4 w-4"
                                            data-testid="radio-vessel"
                                        />
                                        <Label 
                                            htmlFor="filter-vessel-phone" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-16"
                                        >
                                            Vessel
                                        </Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="h-8 flex-1 text-xs text-[#0f172a] justify-between bg-transparent dark:bg-neutral-900 border-input"
                                                    disabled={vesselsLoading}
                                                    data-testid="select-vessel-multi"
                                                >
                                                    <span className="truncate">
                                                        {selectedVessels.length > 0 
                                                            ? `${selectedVessels.length} selected` 
                                                            : vesselsLoading ? "Loading..." : "Vessel"
                                                        }
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-60 p-2" align="start">
                                                <div className="max-h-60 overflow-y-auto">
                                                    {vessels.map((vessel: any) => (
                                                        <div 
                                                            key={vessel.id} 
                                                            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                                                        >
                                                            <Checkbox 
                                                                checked={selectedVessels.includes(vessel.vesselId)}
                                                                onCheckedChange={() => toggleVessel(vessel.vesselId)}
                                                                data-testid={`checkbox-vessel-${vessel.id}`}
                                                            />
                                                            <label 
                                                                className="text-sm cursor-pointer flex-1"
                                                                onClick={() => toggleVessel(vessel.vesselId)}
                                                            >
                                                                {vessel.name}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Fleet Radio + Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="fleet" 
                                            id="filter-fleet-phone"
                                            className="h-4 w-4"
                                            data-testid="radio-fleet"
                                        />
                                        <Label 
                                            htmlFor="filter-fleet-phone" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-16"
                                        >
                                            Fleet
                                        </Label>
                                        <Select value={fleetValue} onValueChange={setFleetValue}>
                                            <SelectTrigger 
                                                className="h-8 flex-1 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-fleet-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                                <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                                <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Add Group Radio + Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="addGroup" 
                                            id="filter-addgroup-phone"
                                            className="h-4 w-4"
                                            data-testid="radio-addgroup"
                                        />
                                        <Label 
                                            htmlFor="filter-addgroup-phone" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer w-16"
                                        >
                                            Add Group
                                        </Label>
                                        <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                                            <SelectTrigger 
                                                className="h-8 flex-1 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-addgroup-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="group1">Additional Group 1</SelectItem>
                                                <SelectItem value="group2">Additional Group 2</SelectItem>
                                                <SelectItem value="group3">Additional Group 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </RadioGroup>

                                {/* Additional filters - 2 column grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={dueInValue} onValueChange={setDueInValue}>
                                        <SelectTrigger 
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                            className="h-8 w-full text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
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
                                </div>

                                {/* Clear button full width */}
                                <Button
                                    variant="outline"
                                    onClick={handleClearFilters}
                                    className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]"
                                    data-testid="button-clear-filters"
                                >
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>
                )}

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
        <>
            <RotationSideBar 
                selectedRotationPage={selectedRotationPage}
                setSelectedRotationPage={setSelectedRotationPage}
                allowedPages={allowedPages}
            />
            <MainLayout hasSidebar={true}>
                {renderContent()}
            </MainLayout>
        </>
    );
}
