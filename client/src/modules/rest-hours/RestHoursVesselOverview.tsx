import { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { RHCrewRecordsTable } from './RHCrewRecordsTable';
import RestHoursSideBar from './RestHoursSideBar';
import MainLayout from '@/components/main/MainLayout';

export const RestHoursVesselOverview = (): JSX.Element => {
  const params = useParams();
  const [, setLocation] = useLocation();
  
  // Extract vesselId and monthValue from URL params
  const urlVesselId = params.vesselId as string | undefined;
  const urlMonthValue = params.month as string | undefined;

  // Generate last 12 months for period dropdown
  const periodOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const monthYear = `${month}-${year}`;
      const value = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({ label: monthYear, value });
    }
    
    return options;
  }, []);

  const [periodValue, setPeriodValue] = useState(urlMonthValue || periodOptions[0]?.value || "");
  const [selectedVessel, setSelectedVessel] = useState(urlVesselId || "");
  const [selectedRank, setSelectedRank] = useState("");
  const [searchText, setSearchText] = useState("");

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  // Get vessel name for title
  const vesselName = useMemo(() => {
    const vessel = vessels.find(v => v.entryId === selectedVessel);
    return vessel?.name || 'Unknown Vessel';
  }, [vessels, selectedVessel]);

  // Format month for title
  const monthDisplay = useMemo(() => {
    const option = periodOptions.find(opt => opt.value === periodValue);
    return option?.label || '';
  }, [periodOptions, periodValue]);

  // Available ranks (would typically come from API)
  const ranks = useMemo(() => [
    'Master',
    'Chief Engineer',
    'Chief Officer',
    'Second Engineer',
    'Third Engineer',
    'Second Officer',
    'Third Officer',
    'Able Seaman',
    'Bosun',
    'Cook',
    'Electrician',
    'Steward',
  ], []);

  const handleBack = () => {
    setLocation('/rest-hours/record');
  };

  const handleClearFilters = () => {
    setPeriodValue(periodOptions[0]?.value || "");
    setSelectedVessel(urlVesselId || "");
    setSelectedRank("");
    setSearchText("");
  };

  // Pre-populate filters from URL params on mount
  useEffect(() => {
    if (urlVesselId) setSelectedVessel(urlVesselId);
    if (urlMonthValue) setPeriodValue(urlMonthValue);
  }, [urlVesselId, urlMonthValue]);

  // Handle sidebar navigation
  const setSelectedRestHoursPage = (page: string) => {
    switch (page) {
      case 'dashboard':
        setLocation('/rest-hours/dashboard');
        break;
      case 'record':
        setLocation('/rest-hours/record');
        break;
      case 'plan':
        setLocation('/rest-hours/plan');
        break;
    }
  };

  return (
    <>
      <RestHoursSideBar 
        selectedRestHoursPage="record"
        setSelectedRestHoursPage={setSelectedRestHoursPage}
        allowedPages={["dashboard", "record", "plan"]}
      />
      <MainLayout>
        <div className="flex flex-col h-full">
          <SectionTitleComponents title={`RH Records - ${vesselName} - ${monthDisplay}`}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </SectionTitleComponents>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
        {/* Period Dropdown */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[#4f5863] dark:text-neutral-300">Period</Label>
          <Select value={periodValue} onValueChange={setPeriodValue}>
            <SelectTrigger 
              className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
              data-testid="select-period"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="older">Older Periods...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vessel Single Select */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[#4f5863] dark:text-neutral-300">Vessel</Label>
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger 
              className="h-8 w-52 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
              disabled={vesselsLoading}
              data-testid="select-vessel"
            >
              <SelectValue placeholder={vesselsLoading ? "Loading..." : "Select Vessel"} />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel: any) => (
                <SelectItem key={vessel.entryId} value={vessel.entryId}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rank Dropdown */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[#4f5863] dark:text-neutral-300">Rank</Label>
          <Select value={selectedRank} onValueChange={setSelectedRank}>
            <SelectTrigger 
              className="h-8 w-48 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
              data-testid="select-rank"
            >
              <SelectValue placeholder="Rank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              {ranks.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Name or Crew ID */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[#4f5863] dark:text-neutral-300">Search Name or Crew ID</Label>
          <Input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search..."
            className="h-8 w-64 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
            data-testid="input-search"
          />
        </div>

        {/* Clear Button */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-transparent">Clear</Label>
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Crew Records Table */}
      <div className="pr-4 pb-4">
        <RHCrewRecordsTable 
          vesselId={selectedVessel}
          monthValue={periodValue}
          selectedRanks={selectedRank && selectedRank !== 'all' ? [selectedRank] : undefined}
          searchText={searchText}
        />
      </div>
        </div>
      </MainLayout>
    </>
  );
};
