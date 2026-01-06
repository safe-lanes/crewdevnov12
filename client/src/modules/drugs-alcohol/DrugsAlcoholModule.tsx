import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/main/MainLayout';
import DrugsAlcoholSideBar from './DrugsAlcoholSideBar';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, ChevronDown, Plus } from 'lucide-react';
import { AnnualTestTable } from './AnnualTestTable';
import { PeriodicTestTable } from './PeriodicTestTable';
import { MonthlyTestTable } from './MonthlyTestTable';
import { PostIncidentTestTable } from './PostIncidentTestTable';
import { OtherTestsTable } from './OtherTestsTable';
import { SummaryTable } from './SummaryTable';
import { DrugAlcoholTestForm } from './DrugAlcoholTestForm';
import { useViewport } from '@/hooks/useViewport';
import { useExternalVessels } from '@/hooks/useExternalVessels';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function DrugsAlcoholModule() {
    const [selectedDrugsAlcoholPage, setSelectedDrugsAlcoholPage] = useState<string>("annual");
    const allowedPages = ["annual", "periodic", "monthly", "post-incident", "others", "summary"];
    const { toast } = useToast();

    // Viewport detection for responsive layout
    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;

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
    const [editingRecordId, setEditingRecordId] = useState<number | undefined>();

    // Fetch vessels from external SAIL ERP API (all 11 vessels)
    const { data: externalVessels = [], isLoading: vesselsLoading } = useExternalVessels();
    
    // Normalize external vessels data to expected format
    const vessels = useMemo(() => {
        return externalVessels.map((v: any, index: number) => ({
            id: index + 1,
            vesselId: v.vuid || v.entryId || `VSL-${String(index + 1).padStart(3, '0')}`,
            name: v.vessel || v.name || 'Unknown Vessel',
        }));
    }, [externalVessels]);
    
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
    const handleOpenForm = (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', vesselId?: string, recordId?: number) => {
        setFormTestType(testType);
        setFormVesselId(vesselId);
        setEditingRecordId(recordId);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setFormTestType(undefined);
        setFormVesselId(undefined);
        setEditingRecordId(undefined);
    };

    // Helper function to transform form data to API format
    const transformFormDataForAPI = (data: any, status: 'draft' | 'submitted') => {
        // Only derive frequencyMonths if not provided by the form
        const getFrequencyMonths = () => {
            if (data.frequencyMonths !== undefined && data.frequencyMonths !== null) {
                return data.frequencyMonths;
            }
            // Default mapping based on test type
            const frequencyMap: Record<string, number> = {
                'annual': 12,
                'periodic': 3,
                'monthly': 1,
                'post-incident': 0,
                'others': 0
            };
            return frequencyMap[data.testType] ?? 12;
        };

        // Helper to stringify only if value is an array/object, otherwise pass through
        const toJsonString = (value: any): string | null => {
            if (value === undefined || value === null) return null;
            if (typeof value === 'string') return value; // Already a string
            return JSON.stringify(value);
        };

        return {
            vesselId: data.vesselId,
            testType: data.testType,
            alcoholDrugType: toJsonString(data.alcoholDrugType),
            placeLocation: data.placeLocation || null,
            dateTimeTestCompleted: data.dateTimeTestCompleted || null,
            externalTestResultsDate: data.externalTestResultsDate || null,
            incidentId: data.incidentId || null,
            testingEquipment: toJsonString(data.testingEquipment),
            equipmentNotApplicable: data.equipmentNotApplicable || false,
            frequencyMonths: getFrequencyMonths(),
            incidentTitle: data.incidentTitle || null,
            incidentDateTime: data.incidentDateTime || null,
            alcoholTestDateTime: data.alcoholTestDateTime || null,
            drugTestDateTime: data.drugTestDateTime || null,
            reasonForTesting: data.reasonForTesting || null,
            description: data.description || null,
            initiatedBy: data.initiatedBy || null,
            personnelTested: toJsonString(data.personnelTested),
            comments: data.comments || null,
            masterDeputySignature: toJsonString(data.masterDeputySignature),
            attachmentFile: data.attachmentFile || null,
            status: status,
        };
    };

    // Mutation for saving (create or update)
    const saveMutation = useMutation({
        mutationFn: async ({ data, status }: { data: any; status: 'draft' | 'submitted' }) => {
            const payload = transformFormDataForAPI(data, status);
            
            let response: Response;
            if (editingRecordId) {
                response = await apiRequest('PUT', `/api/drug-alcohol-tests/${editingRecordId}`, payload);
            } else {
                response = await apiRequest('POST', '/api/drug-alcohol-tests', payload);
            }
            return await response.json();
        },
        onSuccess: (record: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ['/api/drug-alcohol-tests'] });
            toast({
                title: variables.status === 'submitted' ? "Form Submitted" : "Draft Saved",
                description: variables.status === 'submitted' 
                    ? "The Drug & Alcohol test record has been submitted successfully."
                    : "Your draft has been saved. You can continue editing later.",
            });
            if (variables.status === 'submitted') {
                handleCloseForm();
            } else if (record?.id && !editingRecordId) {
                setEditingRecordId(record.id);
            }
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save the record. Please try again.",
                variant: "destructive",
            });
        },
    });

    // Mutation for deleting
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return await apiRequest('DELETE', `/api/drug-alcohol-tests/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/drug-alcohol-tests'] });
            toast({
                title: "Record Deleted",
                description: "The Drug & Alcohol test record has been deleted.",
            });
            handleCloseForm();
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete the record. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleSaveForm = (data: any) => {
        if (!data.vesselId || !data.testType) {
            toast({
                title: "Missing Required Fields",
                description: "Please select a vessel and test type before saving.",
                variant: "destructive",
            });
            return;
        }
        saveMutation.mutate({ data, status: 'draft' });
    };

    const handleSubmitForm = (data: any) => {
        if (!data.vesselId || !data.testType) {
            toast({
                title: "Missing Required Fields",
                description: "Please select a vessel and test type before submitting.",
                variant: "destructive",
            });
            return;
        }
        saveMutation.mutate({ data, status: 'submitted' });
    };

    const handleDeleteForm = () => {
        if (editingRecordId) {
            deleteMutation.mutate(editingRecordId);
        } else {
            handleCloseForm();
        }
    };

    // Vessel multi-select popover component (shared across layouts)
    const renderVesselSelect = () => (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`h-8 text-xs text-[#0f172a] dark:text-white justify-between bg-transparent dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-40'}`}
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
    );

    // Fleet select component (shared across layouts)
    const renderFleetSelect = () => (
        <Select value={fleetValue} onValueChange={setFleetValue}>
            <SelectTrigger 
                className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
                data-testid="select-fleet-value"
            >
                <SelectValue placeholder="Select Fleet" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="fleet1">Fleet Group 1</SelectItem>
                <SelectItem value="fleet2">Fleet Group 2</SelectItem>
            </SelectContent>
        </Select>
    );

    // Additional Group select component (shared across layouts)
    const renderAddGroupSelect = () => (
        <Select value={addGroupValue} onValueChange={setAddGroupValue}>
            <SelectTrigger 
                className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
                data-testid="select-addGroup-value"
            >
                <SelectValue placeholder="Select Group" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="group1">Group 1</SelectItem>
                <SelectItem value="group2">Group 2</SelectItem>
            </SelectContent>
        </Select>
    );

    // Reusable filter bar with radio buttons (for Annual, Periodic, Monthly, Post Incident, Others)
    const renderFullFilterBar = () => {
        if (!showFilters) return null;

        // Phone layout: vertical stack with full-width controls
        if (isPhone) {
            return (
                <div className="flex flex-col gap-3 mb-4 p-3 bg-transparent rounded-lg" data-testid="filter-container">
                    <RadioGroup 
                        value={filterType} 
                        onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                        className="flex flex-col gap-3"
                    >
                        {/* Vessel option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {filterType === 'vessel' && renderVesselSelect()}
                        </div>

                        {/* Fleet option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {filterType === 'fleet' && renderFleetSelect()}
                        </div>

                        {/* Additional Group option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {filterType === 'addGroup' && renderAddGroupSelect()}
                        </div>
                    </RadioGroup>

                    {/* Clear Button */}
                    <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]"
                        data-testid="button-clear-filters"
                    >
                        Clear
                    </Button>
                </div>
            );
        }

        // Tablet layout: 3-column grid with stacked radio + select pairs
        if (isTablet) {
            return (
                <div className="flex flex-col gap-3 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                    <RadioGroup 
                        value={filterType} 
                        onValueChange={(value: "vessel" | "fleet" | "addGroup") => setFilterType(value)}
                        className="grid grid-cols-3 gap-4"
                    >
                        {/* Vessel option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {renderVesselSelect()}
                        </div>

                        {/* Fleet option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {renderFleetSelect()}
                        </div>

                        {/* Additional Group option */}
                        <div className="flex flex-col gap-2">
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
                            </div>
                            {renderAddGroupSelect()}
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
            );
        }

        // Desktop/Laptop layout: horizontal flex (original layout)
        return (
            <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
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
                        {renderVesselSelect()}
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
                        {renderFleetSelect()}
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
                        {renderAddGroupSelect()}
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
        );
    };

    // Vessel-only filter bar (for Summary) - responsive
    const renderVesselOnlyFilterBar = () => {
        if (!showFilters) return null;

        return (
            <div className={`flex mb-4 bg-transparent rounded-lg ${isPhone ? 'flex-col gap-3 p-3' : 'flex-wrap gap-4 p-4 pl-0'}`} data-testid="filter-container">
                <div className={`flex gap-2 ${isPhone ? 'flex-col' : 'items-center'}`}>
                    <Label className="text-xs font-normal text-[#4f5863] dark:text-neutral-300">
                        Vessel
                    </Label>
                    <Select 
                        value={summarySelectedVessel} 
                        onValueChange={setSummarySelectedVessel}
                        disabled={vesselsLoading}
                    >
                        <SelectTrigger 
                            className={`h-8 text-xs bg-white dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-48'}`}
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
                    className={`h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] ${isPhone ? 'w-full' : 'w-16'}`}
                    data-testid="button-clear-filters"
                >
                    Clear
                </Button>
            </div>
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
                        {renderFullFilterBar()}
                        <AnnualTestTable
                            filterType={filterType}
                            selectedVessels={selectedVessels}
                            fleetValue={fleetValue}
                            addGroupValue={addGroupValue}
                            onAdd={(vesselId) => handleOpenForm('annual', vesselId)}
                            onEdit={(recordId) => handleOpenForm('annual', undefined, recordId)}
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
                            onAdd={(vesselId) => handleOpenForm('periodic', vesselId)}
                            onEdit={(recordId) => handleOpenForm('periodic', undefined, recordId)}
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
                            onAdd={(vesselId) => handleOpenForm('monthly', vesselId)}
                            onEdit={(recordId) => handleOpenForm('monthly', undefined, recordId)}
                        />
                    </div>
                );
            case "post-incident":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Post Incident Test">
                            <div className="flex gap-2">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenForm('post-incident')}
                                    className="h-8 gap-2"
                                    data-testid="button-add-new-post-incident"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add New
                                </Button>
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
                            onAdd={(vesselId) => handleOpenForm('post-incident', vesselId)}
                        />
                    </div>
                );
            case "others":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Other Tests">
                            <div className="flex gap-2">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenForm('others')}
                                    className="h-8 gap-2"
                                    data-testid="button-add-new-others"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add New
                                </Button>
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
                            onAdd={(vesselId) => handleOpenForm('others', vesselId)}
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
                    recordId={editingRecordId}
                    onClose={handleCloseForm}
                    onSave={handleSaveForm}
                    onSubmit={handleSubmitForm}
                    onDelete={handleDeleteForm}
                />
            )}
        </>
    );
}
