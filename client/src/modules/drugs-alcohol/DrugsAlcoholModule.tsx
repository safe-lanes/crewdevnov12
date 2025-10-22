import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/main/MainLayout';
import DrugsAlcoholSideBar from './DrugsAlcoholSideBar';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, ChevronDown } from 'lucide-react';

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

export function DrugsAlcoholModule() {
    const [selectedDrugsAlcoholPage, setSelectedDrugsAlcoholPage] = useState<string>("annual");
    const allowedPages = ["annual", "periodic", "monthly", "post-incident", "others", "summary"];

    // Filter state for Annual test page
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    // Fetch vessels
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();

    const handleClearFilters = () => {
        setFilterType("vessel");
        setSelectedVessels([]);
        setFleetValue("");
        setAddGroupValue("");
    };

    const toggleVessel = (vesselName: string) => {
        setSelectedVessels(prev => 
            prev.includes(vesselName) 
                ? prev.filter(v => v !== vesselName)
                : [...prev, vesselName]
        );
    };

    const renderContent = () => {
        switch (selectedDrugsAlcoholPage) {
            case "annual":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Annual D& A Test">
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
                            <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                                {/* Radio Group for Vessel/Fleet/Add Group */}
                                <RadioGroup 
                                    value={filterType} 
                                    onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                                    className="flex items-center gap-6"
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
                                                    className="h-8 w-40 ml-2 text-xs text-[#0f172a] justify-between bg-transparent dark:bg-neutral-900 border-input"
                                                    disabled={vesselsLoading}
                                                    data-testid="select-vessel-multi"
                                                >
                                                    <span className="truncate">
                                                        {selectedVessels.length > 0 
                                                            ? `${selectedVessels.length} selected` 
                                                            : vesselsLoading ? "Loading..." : "Vessel"
                                                        }
                                                    </span>
                                                    <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
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
                                                                checked={selectedVessels.includes(vessel.name)}
                                                                onCheckedChange={() => toggleVessel(vessel.name)}
                                                                data-testid={`checkbox-vessel-${vessel.id}`}
                                                            />
                                                            <label 
                                                                className="text-sm cursor-pointer flex-1"
                                                                onClick={() => toggleVessel(vessel.name)}
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
                                                className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-fleet-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                                                <SelectItem value="fleet2">Fleet Group 2</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Additional Group Radio + Select */}
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem 
                                            value="addGroup" 
                                            id="filter-addGroup"
                                            className="h-4 w-4"
                                            data-testid="radio-addGroup"
                                        />
                                        <Label 
                                            htmlFor="filter-addGroup" 
                                            className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                                        >
                                            Additional Group
                                        </Label>
                                        <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                                            <SelectTrigger 
                                                className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                                                data-testid="select-addGroup-value"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="group1">Group 1</SelectItem>
                                                <SelectItem value="group2">Group 2</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </RadioGroup>

                                {/* Clear Button */}
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

                        {/* Placeholder for test data table */}
                        <div className="p-6">
                            <p className="text-gray-600">
                                Annual drug and alcohol testing records will be displayed here.
                            </p>
                        </div>
                    </div>
                );
            case "periodic":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Periodic Tests
                        </h2>
                        <p className="text-gray-600">
                            Periodic (e.g., Quarterly) drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "monthly":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Monthly Tests
                        </h2>
                        <p className="text-gray-600">
                            Monthly drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "post-incident":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Post Incident Tests
                        </h2>
                        <p className="text-gray-600">
                            Post incident drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "others":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Other Tests
                        </h2>
                        <p className="text-gray-600">
                            Other drug and alcohol testing records will be displayed here.
                        </p>
                    </div>
                );
            case "summary":
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Summary
                        </h2>
                        <p className="text-gray-600">
                            Summary of all drug and alcohol tests for a particular vessel will be displayed here.
                        </p>
                    </div>
                );
            default:
                return (
                    <div className="p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Drugs & Alcohol Testing
                        </h2>
                        <p className="text-gray-600">
                            Select a test type from the left sidebar.
                        </p>
                    </div>
                );
        }
    };

    return (
        <>
            <DrugsAlcoholSideBar
                selectedDrugsAlcoholPage={selectedDrugsAlcoholPage}
                setSelectedDrugsAlcoholPage={setSelectedDrugsAlcoholPage}
                allowedPages={allowedPages}
            />
            <MainLayout>
                <div className="bg-white rounded-lg shadow">
                    {renderContent()}
                </div>
            </MainLayout>
        </>
    );
}
