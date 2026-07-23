import { useState, useMemo, useEffect } from 'react';
import PromotionsSideBar from './PromotionsSideBar';
import { PromotionsTable } from './PromotionsTable';
import MainLayout from '@/components/main/MainLayout';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search as SearchIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getVesselTypesForDropdown } from '@/utils/data/vesselTypes';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useNationalitiesV2 } from '@/hooks/v2/useMasterDataV2';

export function PromotionsModule() {
    const [selectedPromotionsPage, setSelectedPromotionsPage] = useState('all');
    const [showFilters, setShowFilters] = useState(true);

    const [initialReviewUuid, setInitialReviewUuid] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        const params = new URLSearchParams(window.location.search);
        return params.get('review');
    });

    const handleInitialReviewConsumed = () => {
        setInitialReviewUuid(null);
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.has('review')) {
            params.delete('review');
            const qs = params.toString();
            const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', newUrl);
        }
    };
    
    const [searchName, setSearchName] = useState('');
    const [promotionToRank, setPromotionToRank] = useState('');
    const [vessel, setVessel] = useState('');
    const [vesselType, setVesselType] = useState('');
    const [nationality, setNationality] = useState('');
    const [criteria, setCriteria] = useState('');
    const [status, setStatus] = useState('');

    type PromotionFilters = {
        searchName: string;
        promotionToRank: string;
        vessel: string;
        vesselType: string;
        nationality: string;
        criteria: string;
        status: string;
    };

    const [appliedFilters, setAppliedFilters] = useState<PromotionFilters>({
        searchName: '',
        promotionToRank: '',
        vessel: '',
        vesselType: '',
        nationality: '',
        criteria: '',
        status: '',
    });
    
    const { userType, myVessels } = usePermissions();
    const isShipUser = userType === 'Ship';

    const { vessels: vesselOptions } = useVesselLookup();

    const { data: externalNationalitiesData, isLoading: nationalitiesLoading } = useNationalitiesV2();

    type NationalityEntry = { nationality?: string; countryName?: string; name?: string };
    const nationalityOptions = useMemo<string[]>(() => {
        const raw: unknown = externalNationalitiesData;
        let list: unknown = raw;
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'nationalities' in raw) {
            list = (raw as { nationalities: unknown }).nationalities;
        }
        if (!Array.isArray(list)) return [];
        const names = (list as NationalityEntry[])
            .map((n) => n?.nationality ?? n?.countryName ?? n?.name)
            .filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [externalNationalitiesData]);
    
    const { rankOptions, isLoading: ranksLoading } = useCompanyRanks();
    
    const { data: vesselTypeMasterDataRaw } = useQuery<unknown>({
        queryKey: ["/api/v2/masters/vessel-types"],
    });

    const vesselTypeOptions = useMemo(() => {
        // Mirror B2.1's extraction in PromotionReviewForm so the two lists
        // stay in lockstep across any API-shape changes.
        const raw =
            (vesselTypeMasterDataRaw as any)?.vesseltypes
            || (vesselTypeMasterDataRaw as any)?.vesselTypes
            || vesselTypeMasterDataRaw
            || [];
        const list = Array.isArray(raw) ? raw : [];
        const names: string[] = list.length > 0
            ? list
                .map((vt: any) => vt?.vesselType || vt?.name || (typeof vt === 'string' ? vt : ''))
                .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
            : getVesselTypesForDropdown();
        // Dedupe + case-insensitive locale sort.
        return Array.from(new Set(names)).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [vesselTypeMasterDataRaw]);

    useEffect(() => {
        if (isShipUser && myVessels.length > 0 && vesselOptions.length > 0 && !vessel) {
            const myVesselName = myVessels[0].vessel;
            const matchedVessel = vesselOptions.find((v) => v.name === myVesselName);
            if (matchedVessel) {
                setVessel(matchedVessel.entryId);
                setAppliedFilters(prev => ({ ...prev, vessel: matchedVessel.entryId }));
            }
        }
    }, [isShipUser, myVessels, vesselOptions, vessel]);

    const shipUserVesselName = useMemo(() => {
        if (!isShipUser || myVessels.length === 0) return null;
        return myVessels[0].vessel;
    }, [isShipUser, myVessels]);

    const handleApplyFilters = () => {
        setAppliedFilters({
            searchName,
            promotionToRank,
            vessel,
            vesselType,
            nationality,
            criteria,
            status,
        });
    };

    const handleClearFilters = () => {
        const clearedVessel = isShipUser ? vessel : '';
        setSearchName('');
        setPromotionToRank('');
        if (!isShipUser) {
            setVessel('');
        }
        setVesselType('');
        setNationality('');
        setCriteria('');
        setStatus('');
        setAppliedFilters({
            searchName: '',
            promotionToRank: '',
            vessel: clearedVessel,
            vesselType: '',
            nationality: '',
            criteria: '',
            status: '',
        });
    };

    return (
        <div data-testid="promotions-container">
            <PromotionsSideBar
                selectedPromotionsPage={selectedPromotionsPage}
                setSelectedPromotionsPage={setSelectedPromotionsPage}
                allowedPages={['all']}
            />
            <MainLayout hasSidebar={true}>
            <div className="flex flex-col h-full">
                <SectionTitleComponents title="Crew Promotion">
                    <div className="flex items-center gap-3">
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
                    <div className="flex flex-wrap gap-2 mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg" data-testid="filter-container">
                        <div className="relative w-[180px]">
                            <Input
                                className="h-8 pl-10 text-[#0f172a] text-xs placeholder:text-[#8899ae]"
                                placeholder="Search Name"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                data-testid="input-search-name"
                            />
                            <SearchIcon className="w-4 h-4 absolute left-3 top-2 text-[#8798ad]" />
                        </div>

                        <Select value={promotionToRank} onValueChange={setPromotionToRank}>
                            <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-promotion-rank">
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

                        {isShipUser ? (
                            <div className="w-[150px] h-8 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700" data-testid="vessel-name-ship-user">
                                {shipUserVesselName || 'No vessel'}
                            </div>
                        ) : (
                            <Select value={vessel} onValueChange={setVessel}>
                                <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-vessel">
                                    <SelectValue placeholder="Vessel" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vesselOptions.map((v) => (
                                        <SelectItem key={v.entryId} value={v.entryId}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select value={vesselType} onValueChange={setVesselType}>
                            <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-vessel-type">
                                <SelectValue placeholder="Vessel Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {vesselTypeOptions.map((type) => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={nationality} onValueChange={setNationality}>
                            <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-nationality">
                                <SelectValue placeholder="Nationality" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {nationalitiesLoading ? (
                                    <SelectItem value="loading" disabled>Loading…</SelectItem>
                                ) : (
                                    nationalityOptions.map((n) => (
                                        <SelectItem key={n} value={n} data-testid={`nationality-option-${n}`}>{n}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>

                        <Select value={criteria} onValueChange={setCriteria}>
                            <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-criteria">
                                <SelectValue placeholder="Criteria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="met">All Criteria Met</SelectItem>
                                <SelectItem value="pending">Pending Criteria</SelectItem>
                                <SelectItem value="not-met">Criteria Not Met</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-[150px] h-8 text-[#0f172a] text-xs placeholder:text-[#8899ae]" data-testid="select-status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Submitted">Submitted</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
                            onClick={handleApplyFilters}
                            data-testid="button-apply"
                        >
                            Apply
                        </Button>

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
                    <PromotionsTable
                        searchName={appliedFilters.searchName}
                        promotionToRank={appliedFilters.promotionToRank}
                        vessel={appliedFilters.vessel}
                        vesselType={appliedFilters.vesselType}
                        nationality={appliedFilters.nationality}
                        criteria={appliedFilters.criteria}
                        status={appliedFilters.status}
                        initialReviewUuid={initialReviewUuid}
                        onInitialReviewConsumed={handleInitialReviewConsumed}
                    />
                </div>
            </div>
            </MainLayout>
        </div>
    );
}
