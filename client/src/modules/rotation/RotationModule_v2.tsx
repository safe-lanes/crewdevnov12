import { useState, useMemo } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { NoAccessPage } from '@/components/ProtectedRoute';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api';
import { useViewport } from '@/hooks/useViewport';
import { RotationSideBar_v2 } from './RotationSideBar_v2';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, ChevronDown, Calendar as CalendarIcon, Search as SearchIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DueCrewTable_v2 } from './DueCrewTable_v2';
import { RotationPlanTable_v2 } from './RotationPlanTable_v2';
import { ApprovalTable_v2 } from './ApprovalTable_v2';
import { VesselFleetGroupFilter, FilterMode } from '@/components/filters/vessel-fleet-group-filter';


const useVessels = () => {
    return useQuery({
        queryKey: ['/api/v2/vessel/list'],
        staleTime: 0,
        retry: 2,
        select: (data: any[]) => {
            return data.map((vessel: any) => ({
                id: vessel.id,
                vesselId: vessel.vesselUuid,
                name: vessel.vessel || 'Unknown Vessel',
            }));
        }
    });
};

const useCompanyRanks = () => {
    return useQuery({
        queryKey: ['/api/v2/admin/company-ranks'],
        select: (data: any[]) => {
            return data.filter((rank: any) => !rank.isRoleRow && !rank.is_role_row);
        }
    });
};

function ApprovalScreenV2() {
    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;
    type ApprovalDateRange = { start: Date | undefined; end: Date | undefined };
    
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
    const [draftIdFilter, setDraftIdFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    
    const today = useMemo(() => new Date(), []);
    const [dateRange, setDateRange] = useState<ApprovalDateRange>({
        start: undefined,
        end: undefined
    });
    const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);

    const [draftRange, setDraftRange] = useState<ApprovalDateRange>({ start: undefined, end: undefined });

    // 'yyyy-MM-dd' from a native date input -> local Date (no timezone shift; same as Dashboard)
    const parseDateInput = (value: string): Date | undefined => {
        if (!value) return undefined;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return undefined;
        return new Date(year, month - 1, day);
    };

    const openDateRangeDialog = (open: boolean) => {
        if (open) setDraftRange(dateRange);   // pre-fill draft with what's applied
        setDateRangeDialogOpen(open);
    };

    const isDraftValid = !!draftRange.start && !!draftRange.end && draftRange.start <= draftRange.end;

    const handleApplyDateRange = () => {
        setDateRange(draftRange);             // commit — table filters NOW
        setDateRangeDialogOpen(false);
    };

    const { data: vessels = [] } = useVessels();
    const { data: companyRanks = [] } = useCompanyRanks();

    const handleClearFilters = () => {
        setSelectedVessels([]);
        setSelectedRanks([]);
        setDraftIdFilter("");
        setDateRange({
            start: undefined,
            end: undefined
        });
        setDraftRange({ start: undefined, end: undefined });
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

    const dateRangeLabel = dateRange.start && dateRange.end
        ? `${format(dateRange.start, 'dd-MMM-yy')} - ${format(dateRange.end, 'dd-MMM-yy')}`
        : "Select a Date Range";

    const dateRangePopoverContent = (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Date From</Label>
                    <Input type="date"
                        value={draftRange.start ? format(draftRange.start, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setDraftRange(prev => ({ ...prev, start: parseDateInput(e.target.value) }))}
                        className="w-fit text-xs h-9 bg-white dark:bg-neutral-900"
                        data-testid="date-from-approval-v2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Date To</Label>
                    <Input type="date"
                        value={draftRange.end ? format(draftRange.end, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setDraftRange(prev => ({ ...prev, end: parseDateInput(e.target.value) }))}
                        className="w-fit text-xs h-9 bg-white dark:bg-neutral-900"
                        data-testid="date-to-approval-v2" />
                </div>
            </div>
            <div className="flex justify-end pt-2">
                <Button onClick={handleApplyDateRange} disabled={!isDraftValid}
                    className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-8"
                    data-testid="button-apply-date-range-v2">
                    Apply
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <SectionTitleComponents title="Rotation Approval">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                        data-testid="button-toggle-filters-v2"
                    >
                        <Filter className="h-4 w-4" />
                        Filters
                    </Button>
                </div>
            </SectionTitleComponents>

            {showFilters && (
                <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg" data-testid="filter-container-v2">
                    {!isSmallScreen && (
                        <div className="flex flex-nowrap items-center gap-3">
                            <div className="shrink-0">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 text-[#0f172a] text-xs font-normal bg-transparent hover:bg-transparent hover:text-[#0f172a] border-input justify-between w-[130px]"
                                            data-testid="filter-vessel-v2"
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
                                                        id={`vessel-v2-${vessel.vesselId}`}
                                                        checked={selectedVessels.includes(vessel.vesselId)}
                                                        onCheckedChange={() => toggleVessel(vessel.vesselId)}
                                                        data-testid={`checkbox-vessel-v2-${vessel.vesselId}`}
                                                    />
                                                    <label htmlFor={`vessel-v2-${vessel.vesselId}`} className="text-sm font-normal cursor-pointer">
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
                                            className="h-8 text-[#0f172a] text-xs font-normal bg-transparent hover:bg-transparent hover:text-[#0f172a] border-input justify-between w-[130px]"
                                            data-testid="filter-rank-v2"
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
                                                        id={`rank-v2-${rank.rank}`}
                                                        checked={selectedRanks.includes(rank.rank)}
                                                        onCheckedChange={() => toggleRank(rank.rank)}
                                                        data-testid={`checkbox-rank-v2-${rank.rank}`}
                                                    />
                                                    <label htmlFor={`rank-v2-${rank.rank}`} className="text-sm font-normal cursor-pointer">
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
                                    className="h-8 w-full px-3 text-[11px] text-[#0f172a] border border-[#e1e8ed] rounded-md focus:outline-none focus:ring-2 focus:ring-[#16569e]"
                                    data-testid="input-draft-id-v2"
                                />
                            </div>

                            <div className="shrink-0">
                                <Popover open={dateRangeDialogOpen} onOpenChange={openDateRangeDialog}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-56 text-[11px] text-[#0f172a] border-[#e1e8ed] justify-between"
                                            data-testid="select-date-range-v2"
                                        >
                                            <span className="truncate flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4" />
                                                {dateRangeLabel}
                                            </span>
                                            <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-4" align="start">
                                        {dateRangePopoverContent}
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Button variant="outline" onClick={handleClearFilters} className="h-8 px-3 text-[#8798ad] text-[11px] border-[#e1e8ed] shrink-0" data-testid="button-clear-filters-v2">Clear</Button>
                        </div>
                    )}

                    {isSmallScreen && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#0f172a] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-vessel-v2">
                                            {selectedVessels.length === 0 ? "Vessel" : `${selectedVessels.length} sel`}
                                            <ChevronDown className="ml-1 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {vessels.map((vessel: any) => (
                                                <div key={vessel.vesselId} className="flex items-center space-x-2">
                                                    <Checkbox id={`vessel-phone-v2-${vessel.vesselId}`} checked={selectedVessels.includes(vessel.vesselId)} onCheckedChange={() => toggleVessel(vessel.vesselId)} data-testid={`checkbox-vessel-v2-${vessel.vesselId}`} />
                                                    <label htmlFor={`vessel-phone-v2-${vessel.vesselId}`} className="text-sm font-normal cursor-pointer">{vessel.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 text-[#0f172a] text-[11px] border-[#e1e8ed] justify-between w-full" data-testid="filter-rank-v2">
                                            {selectedRanks.length === 0 ? "Rank" : `${selectedRanks.length} sel`}
                                            <ChevronDown className="ml-1 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {companyRanks.map((rank: any) => (
                                                <div key={rank.rank} className="flex items-center space-x-2">
                                                    <Checkbox id={`rank-phone-v2-${rank.rank}`} checked={selectedRanks.includes(rank.rank)} onCheckedChange={() => toggleRank(rank.rank)} data-testid={`checkbox-rank-v2-${rank.rank}`} />
                                                    <label htmlFor={`rank-phone-v2-${rank.rank}`} className="text-sm font-normal cursor-pointer">{rank.rank}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="relative w-full">
                                <Input
                                    placeholder="Draft ID"
                                    value={draftIdFilter}
                                    onChange={(e) => setDraftIdFilter(e.target.value)}
                                    className="h-8 w-full pl-10 text-[#0f172a] text-xs placeholder:text-[#8899ae]"
                                    data-testid="input-draft-id-v2"
                                />
                                <SearchIcon className="w-4 h-4 absolute left-3 top-2 text-[#8798ad]" />
                            </div>

                            <Popover open={dateRangeDialogOpen} onOpenChange={openDateRangeDialog}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-8 w-full text-[11px] text-[#0f172a] border-[#e1e8ed] justify-between" data-testid="select-date-range-v2">
                                        <span className="truncate flex items-center gap-2"><CalendarIcon className="h-4 w-4" />{dateRangeLabel}</span>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-4" align="start">
                                    {dateRangePopoverContent}
                                </PopoverContent>
                            </Popover>

                            <Button variant="outline" onClick={handleClearFilters} className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]" data-testid="button-clear-filters-v2">Clear</Button>
                        </div>
                    )}
                </div>
            )}

            <ApprovalTable_v2
                selectedVessels={selectedVessels}
                selectedRanks={selectedRanks}
                draftIdFilter={draftIdFilter}
                dateFrom={dateRange.start && dateRange.end ? format(dateRange.start, 'yyyy-MM-dd') : ""}
                dateTo={dateRange.start && dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : ""}
            />
        </div>
    );
}

export function RotationModule_v2() {
    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;
    
    const [selectedRotationPage, setSelectedRotationPage] = useState<string>("due");
    const { canView, permissions } = usePermissions();
    const allowedPages = useMemo(() => {
        const all = ["due", "plan", "approval"];
        if (permissions.length === 0) return all;
        const pageToMenu: Record<string, string> = { "due": "Due", "plan": "Plan", "approval": "Approval" };
        return all.filter(p => canView(pageToMenu[p] || p));
    }, [permissions, canView]);

    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [dueInValue, setDueInValue] = useState("all");
    const [rankValue, setRankValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: companyRanks = [], isLoading: ranksLoading } = useCompanyRanks();

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
        setDueInValue("all");
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
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                            data-testid="button-toggle-filters-v2"
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                        </Button>
                    </div>
                </SectionTitleComponents>

                <div className="mb-4">
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
                        testIdPrefix="rotation-v2"
                        additionalFilters={
                        <>
                            <Select value={dueInValue} onValueChange={setDueInValue}>
                                <SelectTrigger 
                                    className="h-8 w-[120px] text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                    data-testid="select-due-in-v2"
                                >
                                    <SelectValue placeholder="Due in" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="3m">Due in 3M</SelectItem>
                                    <SelectItem value="2m">Due in 2M</SelectItem>
                                    <SelectItem value="1m">Due in 1M</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={rankValue} onValueChange={setRankValue}>
                                <SelectTrigger 
                                    className="h-8 w-[120px] text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                    data-testid="select-rank-v2"
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
                </div>

                <DueCrewTable_v2
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

    const rotationPageToMenu: Record<string, string> = { "due": "Due", "plan": "Plan", "approval": "Approval" };

    const renderContent = () => {
        if (permissions.length > 0 && !allowedPages.includes(selectedRotationPage)) {
            return <NoAccessPage menuName={rotationPageToMenu[selectedRotationPage] || "Rotation"} />;
        }
        switch (selectedRotationPage) {
            case "due":
                return renderDueContent();
            case "plan":
                return <RotationPlanTable_v2 />;
            case "approval":
                return <ApprovalScreenV2 />;
            default:
                return null;
        }
    };

    return (
        <div data-testid="rotation-container-v2">
            <RotationSideBar_v2 
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

export default RotationModule_v2;
