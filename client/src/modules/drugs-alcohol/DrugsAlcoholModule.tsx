import { useState, useEffect } from 'react';
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
import { AnnualTestTable } from './AnnualTestTable';
import { PeriodicTestTable } from './PeriodicTestTable';
import { MonthlyTestTable } from './MonthlyTestTable';
import { PostIncidentTestTable } from './PostIncidentTestTable';
import { OtherTestsTable } from './OtherTestsTable';
import { SummaryTable } from './SummaryTable';
import { DrugAlcoholTestForm } from './DrugAlcoholTestForm';

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

    // Filter state
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
    const [fleetValue, setFleetValue] = useState("");
    const [addGroupValue, setAddGroupValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    
    // Summary page state - single vessel selection
    const [summarySelectedVessel, setSummarySelectedVessel] = useState<string>("");
    
    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formTestType, setFormTestType] = useState<'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others'>();
    const [formVesselId, setFormVesselId] = useState<string>();

    // Fetch vessels
    const { data: vessels = [], isLoading: vesselsLoading } = useVessels();
    
    // Auto-select first vessel for summary page
    useEffect(() => {
        if (vessels.length > 0 && !summarySelectedVessel) {
            setSummarySelectedVessel(vessels[0].vesselId);
        }
    }, [vessels, summarySelectedVessel]);

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

    // Form handlers
    const handleOpenForm = (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', vesselId?: string) => {
        setFormTestType(testType);
        setFormVesselId(vesselId);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setFormTestType(undefined);
        setFormVesselId(undefined);
    };

    const handleSaveForm = (data: any) => {
        console.log('Save draft:', data);
        // TODO: Implement draft saving logic
    };

    const handleSubmitForm = (data: any) => {
        console.log('Submit form:', data);
        // TODO: Implement form submission logic
        handleCloseForm();
    };

    const handleDeleteForm = () => {
        console.log('Delete form');
        // TODO: Implement form deletion logic
        handleCloseForm();
    };

    // Reusable filter bar with radio buttons (for Annual, Periodic, Monthly, Post Incident, Others)
    const renderFullFilterBar = () => (
        showFilters && (
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
        )
    );

    // Vessel-only filter bar (for Summary)
    const renderVesselOnlyFilterBar = () => (
        showFilters && (
            <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                <div className="flex items-center gap-2">
                    <Label className="text-xs font-normal text-[#4f5863] dark:text-neutral-300">
                        Vessel
                    </Label>
                    <Select 
                        value={summarySelectedVessel} 
                        onValueChange={setSummarySelectedVessel}
                        disabled={vesselsLoading}
                    >
                        <SelectTrigger 
                            className="h-8 w-48 ml-2 text-xs bg-white dark:bg-neutral-900 border-input"
                            data-testid="select-vessel-summary"
                        >
                            <SelectValue placeholder={vesselsLoading ? "Loading..." : "Select Vessel"} />
                        </SelectTrigger>
                        <SelectContent>
                            {vessels.map((vessel: any) => (
                                <SelectItem 
                                    key={vessel.id} 
                                    value={vessel.vesselId}
                                    data-testid={`option-vessel-${vessel.id}`}
                                >
                                    {vessel.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Clear Button */}
                <Button
                    variant="outline"
                    onClick={() => {
                        if (vessels.length > 0) {
                            setSummarySelectedVessel(vessels[0].vesselId);
                        }
                    }}
                    className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                    data-testid="button-clear-filters"
                >
                    Clear
                </Button>
            </div>
        )
    );

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
                        {renderFullFilterBar()}
                        <AnnualTestTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={() => handleOpenForm('annual')}
                        />
                    </div>
                );
            case "periodic":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Periodic Alcohol Test">
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
                        {renderFullFilterBar()}
                        <PeriodicTestTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={() => handleOpenForm('periodic')}
                        />
                    </div>
                );
            case "monthly":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Monthly Alcohol test">
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
                        {renderFullFilterBar()}
                        <MonthlyTestTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={() => handleOpenForm('monthly')}
                        />
                    </div>
                );
            case "post-incident":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Post Incident Test">
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
                        {renderFullFilterBar()}
                        <PostIncidentTestTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={() => handleOpenForm('post-incident')}
                        />
                    </div>
                );
            case "others":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Other Tests">
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
                        {renderFullFilterBar()}
                        <OtherTestsTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={() => handleOpenForm('others')}
                        />
                    </div>
                );
            case "summary":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Summary">
                            <div />
                        </SectionTitleComponents>
                        {renderVesselOnlyFilterBar()}
                        {summarySelectedVessel && (
                            <SummaryTable 
                                selectedVessel={summarySelectedVessel}
                                onAdd={(testType) => handleOpenForm(testType, summarySelectedVessel)}
                            />
                        )}
                    </div>
                );
            default:
                return (
                    <div className="bg-white rounded-lg shadow p-6">
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
            <MainLayout hasSidebar={true}>
                {renderContent()}
            </MainLayout>
            
            {/* Drug & Alcohol Test Form */}
            {showForm && (
                <DrugAlcoholTestForm
                    testType={formTestType}
                    vesselId={formVesselId}
                    onClose={handleCloseForm}
                    onSave={handleSaveForm}
                    onSubmit={handleSubmitForm}
                    onDelete={handleDeleteForm}
                />
            )}
        </>
    );
}
