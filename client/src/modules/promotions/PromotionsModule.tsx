import React, { useState } from 'react';
import PromotionsSideBar from './PromotionsSideBar';
import { PromotionsTable } from './PromotionsTable';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search as SearchIcon } from 'lucide-react';
import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes';

export function PromotionsModule() {
    const [selectedPromotionsPage, setSelectedPromotionsPage] = useState('all');
    const [showFilters, setShowFilters] = useState(true);
    
    // Filter states
    const [searchName, setSearchName] = useState('');
    const [promotionToRank, setPromotionToRank] = useState('');
    const [vesselType, setVesselType] = useState('');
    const [nationality, setNationality] = useState('');
    const [criteria, setCriteria] = useState('');
    const [status, setStatus] = useState('');

    const handleClearFilters = () => {
        setSearchName('');
        setPromotionToRank('');
        setVesselType('');
        setNationality('');
        setCriteria('');
        setStatus('');
    };

    return (
        <>
            <PromotionsSideBar
                selectedPromotionsPage={selectedPromotionsPage}
                setSelectedPromotionsPage={setSelectedPromotionsPage}
                allowedPages={['all']}
            />
            <MainLayout>
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Crew Promotion">
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
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                            data-testid="button-back"
                        >
                            Back
                        </Button>
                    </div>
                </SectionTitleComponents>

                {showFilters && (
                    <div className="flex flex-wrap gap-2 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                        {/* Search Name */}
                        <div className="relative w-[180px]">
                            <Input
                                className="h-8 pl-10 text-[#8798ad] text-xs"
                                placeholder="Search Name"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                data-testid="input-search-name"
                            />
                            <SearchIcon className="w-4 h-4 absolute left-3 top-2 text-[#8798ad]" />
                        </div>

                        {/* Promotion to Rank */}
                        <Select value={promotionToRank} onValueChange={setPromotionToRank}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-promotion-rank">
                                <SelectValue placeholder="Promotion to Rank" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Master">Master</SelectItem>
                                <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                                <SelectItem value="Chief Mate">Chief Mate</SelectItem>
                                <SelectItem value="Second Officer">Second Officer</SelectItem>
                                <SelectItem value="Third Engineer">Third Engineer</SelectItem>
                                <SelectItem value="Able Seaman">Able Seaman</SelectItem>
                                <SelectItem value="Bosun">Bosun</SelectItem>
                                <SelectItem value="Electrician">Electrician</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Vessel Type */}
                        <Select value={vesselType} onValueChange={setVesselType}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-vessel-type">
                                <SelectValue placeholder="Vessel Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {DEFAULT_DROPDOWN_VESSEL_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Nationality */}
                        <Select value={nationality} onValueChange={setNationality}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-nationality">
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

                        {/* Criteria */}
                        <Select value={criteria} onValueChange={setCriteria}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-criteria">
                                <SelectValue placeholder="Criteria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="met">All Criteria Met</SelectItem>
                                <SelectItem value="pending">Pending Criteria</SelectItem>
                                <SelectItem value="not-met">Criteria Not Met</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Status */}
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="For Approval">For Approval</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Clear Button */}
                        <Button
                            variant="outline"
                            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
                            onClick={handleClearFilters}
                            data-testid="button-clear"
                        >
                            Clear
                        </Button>
                    </div>
                )}

                {/* Promotions Table */}
                <div className="flex-1 px-4">
                    <PromotionsTable
                        searchName={searchName}
                        promotionToRank={promotionToRank}
                        vesselType={vesselType}
                        nationality={nationality}
                        criteria={criteria}
                        status={status}
                    />
                </div>
            </div>
            </MainLayout>
        </>
    );
}
