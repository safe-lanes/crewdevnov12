import { useState, useMemo } from 'react';
import PromotionsSideBar_v2 from './components/PromotionsSideBar_v2';
import { PromotionsTable_v2 } from './components/PromotionsTable_v2';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search as SearchIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_DROPDOWN_VESSEL_TYPES } from '@/utils/data/vesselTypes';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { PromotionsVersionToggle } from './components/PromotionsVersionToggle';

export function PromotionsModule_v2() {
    const [selectedPromotionsPage, setSelectedPromotionsPage] = useState('all');
    const [showFilters, setShowFilters] = useState(true);
    
    const [searchName, setSearchName] = useState('');
    const [promotionToRank, setPromotionToRank] = useState('');
    const [vessel, setVessel] = useState('');
    const [vesselType, setVesselType] = useState('');
    const [nationality, setNationality] = useState('');
    const [criteria, setCriteria] = useState('');
    const [status, setStatus] = useState('');
    
    const { vessels: vesselOptions } = useVesselLookup();
    
    const { rankOptions, isLoading: ranksLoading } = useCompanyRanks();
    
    const { data: vesselTypeMasterDataRaw = [] } = useQuery<Array<{ entryId: string; name: string; level?: number }>>({
        queryKey: ["/api/v2/masters/vessel-types"],
    });
    
    const vesselTypeOptions = useMemo(() => {
        if (vesselTypeMasterDataRaw.length > 0) {
            const filteredTypes = vesselTypeMasterDataRaw.filter(vt => vt.level && vt.level >= 2);
            if (filteredTypes.length > 0) return filteredTypes.map(vt => vt.name);
        }
        return DEFAULT_DROPDOWN_VESSEL_TYPES;
    }, [vesselTypeMasterDataRaw]);

    const handleClearFilters = () => {
        setSearchName('');
        setPromotionToRank('');
        setVessel('');
        setVesselType('');
        setNationality('');
        setCriteria('');
        setStatus('');
    };

    return (
        <div data-testid="promotions-v2-container">
            <PromotionsSideBar_v2
                selectedPromotionsPage={selectedPromotionsPage}
                setSelectedPromotionsPage={setSelectedPromotionsPage}
                allowedPages={['all']}
            />
            <MainLayout hasSidebar={true}>
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Crew Promotion">
                    <div className="flex items-center gap-3">
                        <PromotionsVersionToggle />
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
                    <div className="flex flex-wrap gap-2 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
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

                        <Select value={promotionToRank} onValueChange={setPromotionToRank}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-promotion-rank">
                                <SelectValue placeholder="Promotion to Rank" />
                            </SelectTrigger>
                            <SelectContent>
                                {ranksLoading ? (
                                    <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
                                ) : (
                                    rankOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>

                        <Select value={vessel} onValueChange={setVessel}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-vessel">
                                <SelectValue placeholder="Vessel" />
                            </SelectTrigger>
                            <SelectContent>
                                {vesselOptions.map((v) => (
                                    <SelectItem key={v.entryId} value={v.entryId}>{v.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={vesselType} onValueChange={setVesselType}>
                            <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs" data-testid="select-vessel-type">
                                <SelectValue placeholder="Vessel Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {vesselTypeOptions.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

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

                <div className="flex-1 px-4">
                    <PromotionsTable_v2
                        searchName={searchName}
                        promotionToRank={promotionToRank}
                        vessel={vessel}
                        vesselType={vesselType}
                        nationality={nationality}
                        criteria={criteria}
                        status={status}
                    />
                </div>
            </div>
            </MainLayout>
        </div>
    );
}
