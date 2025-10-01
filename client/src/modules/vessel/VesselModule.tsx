import React, { useState } from 'react';
import VesselSideBar from './VesselSideBar';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from 'lucide-react';

export const VesselModule = (): JSX.Element => {
    const [selectedVesselPage, setSelectedVesselPage] = useState("vessel-database");
    
    // Define allowed pages for the vessel module
    const allowedPages = ["vessel-database"];

    // Filter state
    const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
    const [selectedValue, setSelectedValue] = useState("");
    const [showFilters, setShowFilters] = useState(true);

    const handleClearFilters = () => {
        setSelectedValue("");
        setFilterType("vessel");
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
                    <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-[#f7fafc] dark:bg-neutral-900 rounded-lg">
                        <RadioGroup 
                            value={filterType} 
                            onValueChange={(value: "vessel" | "fleet" | "addGroup") => {
                                setFilterType(value);
                                setSelectedValue("");
                            }}
                            className="flex items-center gap-6"
                        >
                            <div className="flex items-center gap-2 min-w-[14rem]">
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
                                {filterType === "vessel" && (
                                    <Select value={selectedValue} onValueChange={setSelectedValue}>
                                        <SelectTrigger 
                                            className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-white dark:bg-neutral-900"
                                            data-testid="select-vessel-value"
                                        >
                                            <SelectValue placeholder="Vessel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="vessel1">Vessel 1</SelectItem>
                                            <SelectItem value="vessel2">Vessel 2</SelectItem>
                                            <SelectItem value="vessel3">Vessel 3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <div className="flex items-center gap-2 min-w-[14rem]">
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
                                {filterType === "fleet" && (
                                    <Select value={selectedValue} onValueChange={setSelectedValue}>
                                        <SelectTrigger 
                                            className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-white dark:bg-neutral-900"
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
                                )}
                            </div>

                            <div className="flex items-center gap-2 min-w-[14rem]">
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
                                {filterType === "addGroup" && (
                                    <Select value={selectedValue} onValueChange={setSelectedValue}>
                                        <SelectTrigger 
                                            className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-white dark:bg-neutral-900"
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
                                )}
                            </div>
                        </RadioGroup>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearFilters}
                            className="ml-auto h-8 text-xs text-[#4f5863] dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            data-testid="button-clear-filters"
                        >
                            Clear
                        </Button>
                    </div>
                )}

                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400">Vessel Database content will be displayed here</p>
                </div>
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
                {selectedVesselPage === "vessel-database" && renderVesselDatabase()}
            </MainLayout>
        </>
    );
};
