import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import RotationSideBar from './RotationSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from 'lucide-react';

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

export function RotationModule() {
    const [selectedRotationPage, setSelectedRotationPage] = useState<string>("due");
    const allowedPages = ["due", "plan", "approval"];

    // Filter state for Due page
    const [dueInPeriod, setDueInPeriod] = useState("");
    const [vesselFilter, setVesselFilter] = useState("");
    const [fleetFilter, setFleetFilter] = useState("");
    const [addGroupFilter, setAddGroupFilter] = useState("");
    const [rankFilter, setRankFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    // Fetch data
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    const { data: companyRanks = [], isLoading: ranksLoading } = useCompanyRanks();

    const handleClearFilters = () => {
        setDueInPeriod("");
        setVesselFilter("");
        setFleetFilter("");
        setAddGroupFilter("");
        setRankFilter("");
    };

    const renderDueContent = () => {
        return (
            <div className="flex flex-col h-full">
                {/* Title with Filters Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-black">Crew Due/ Overdue</h1>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="h-8 gap-2 border-[#e1e8ed]"
                        data-testid="button-toggle-filters"
                    >
                        <Filter className="h-4 w-4" />
                        <span className="text-xs">Filters</span>
                    </Button>
                </div>

                {/* Filter Bar */}
                {showFilters && (
                    <div className="mb-4 p-4 border-2 border-[#00bfa5] rounded-lg bg-white">
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Due in 3M Filter */}
                            <Select value={dueInPeriod} onValueChange={setDueInPeriod}>
                                <SelectTrigger 
                                    className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
                                    data-testid="select-due-period"
                                >
                                    <SelectValue placeholder="Due in 3M" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1m">Due in 1 Month</SelectItem>
                                    <SelectItem value="2m">Due in 2 Months</SelectItem>
                                    <SelectItem value="3m">Due in 3 Months</SelectItem>
                                    <SelectItem value="6m">Due in 6 Months</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Circular Separator */}
                            <div className="w-2 h-2 rounded-full bg-gray-300"></div>

                            {/* Vessel Filter */}
                            <Select value={vesselFilter} onValueChange={setVesselFilter}>
                                <SelectTrigger 
                                    className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
                                    data-testid="select-vessel"
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

                            {/* Circular Separator */}
                            <div className="w-2 h-2 rounded-full bg-gray-300"></div>

                            {/* Fleet Filter */}
                            <Select value={fleetFilter} onValueChange={setFleetFilter}>
                                <SelectTrigger 
                                    className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
                                    data-testid="select-fleet"
                                >
                                    <SelectValue placeholder="Fleet" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                    <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                    <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Circular Separator */}
                            <div className="w-2 h-2 rounded-full bg-gray-300"></div>

                            {/* Add Group Filter */}
                            <Select value={addGroupFilter} onValueChange={setAddGroupFilter}>
                                <SelectTrigger 
                                    className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
                                    data-testid="select-add-group"
                                >
                                    <SelectValue placeholder="Add Group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="group1">Additional Group 1</SelectItem>
                                    <SelectItem value="group2">Additional Group 2</SelectItem>
                                    <SelectItem value="group3">Additional Group 3</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Circular Separator */}
                            <div className="w-2 h-2 rounded-full bg-gray-300"></div>

                            {/* Rank Filter */}
                            <Select value={rankFilter} onValueChange={setRankFilter}>
                                <SelectTrigger 
                                    className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent"
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

                            {/* Clear Button */}
                            <Button
                                variant="outline"
                                onClick={handleClearFilters}
                                className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed] ml-auto"
                                data-testid="button-clear-filters"
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                )}

                {/* Placeholder for table content */}
                <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-gray-500 text-sm">Crew due/overdue table will be displayed here.</p>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (selectedRotationPage) {
            case "due":
                return renderDueContent();
            case "plan":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold text-[#16569e] mb-4">Rotation Planning</h2>
                        <p className="text-gray-600">Rotation planning functionality will be displayed here.</p>
                    </div>
                );
            case "approval":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold text-[#16569e] mb-4">Rotation Approval</h2>
                        <p className="text-gray-600">Rotation approval workflow will be displayed here.</p>
                    </div>
                );
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
            <MainLayout>
                {renderContent()}
            </MainLayout>
        </>
    );
}
