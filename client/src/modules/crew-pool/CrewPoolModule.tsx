import React, { useState } from 'react';
import { FilterIcon, PlusIcon } from 'lucide-react';
import CrewPoolSideBar from './CrewPoolSideBar';
import MainLayout from '../../components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

                {/* Table placeholder - will be implemented in next step */}
                <div className="p-6 text-center text-gray-600" data-testid="crew-database-content">
                    <div className="mt-20">
                        <h2 className="text-2xl mb-4">Crew Database Table</h2>
                        <p>Table will be implemented in the next step.</p>
                    </div>
                </div>
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