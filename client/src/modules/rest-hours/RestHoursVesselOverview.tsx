import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useCompanyRanks } from '@/hooks/useCompanyRanks';
import { RHCrewRecordsTable } from './RHCrewRecordsTable';
import RestHoursSideBar from './RestHoursSideBar';
import MainLayout from '@/components/main/MainLayout';
import { DateLineAdjustmentsDialog } from './DateLineAdjustmentsDialog';
import type { VesselDateLineAdjustment } from '@shared/schema';
import { useRestHoursFiltersStore } from '@/stores/restHoursFiltersStore';

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

  const [selectedRank, setSelectedRank] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateLineDialogOpen, setDateLineDialogOpen] = useState(false);
  
  const { 
    periodValue: storePeriodValue,
    setPeriodValue: setStorePeriodValue,
    planVesselId,
    setPlanVesselId,
    complianceMode, 
    setComplianceMode,
    opaMode,
    setOpaMode,
  } = useRestHoursFiltersStore();

  // Convert store's PeriodFilterValue to string format for dropdown
  const periodValueString = useMemo(() => {
    if (storePeriodValue.mode === 'year-month' && storePeriodValue.year && storePeriodValue.month) {
      return `${storePeriodValue.year}-${String(storePeriodValue.month).padStart(2, '0')}`;
    }
    return periodOptions[0]?.value || "";
  }, [storePeriodValue, periodOptions]);

  // Store is the source of truth - dropdown changes update store
  const periodValue = periodValueString;
  
  // Store is the source of truth for vessel selection
  const selectedVessel = planVesselId || "";

  // Update store when period changes via dropdown
  const handlePeriodChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setStorePeriodValue({
      mode: 'year-month',
      year,
      month,
    });
  };

  // Update store when vessel changes via dropdown
  const handleVesselChange = (value: string) => {
    setPlanVesselId(value);
  };

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();
  
  // Fetch company ranks for dynamic rank dropdown
  const { rankOptions, isLoading: ranksLoading } = useCompanyRanks();

  // Fetch date line adjustments for badge count
  const { data: dateLineAdjustment } = useQuery<VesselDateLineAdjustment | null>({
    queryKey: ['/api/vessel-dateline-adjustments', selectedVessel, periodValue],
    queryFn: async () => {
      if (!selectedVessel || !periodValue) return null;
      const response = await fetch(`/api/vessel-dateline-adjustments/${selectedVessel}/${periodValue}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch vessel date line adjustments');
      }
      return response.json();
    },
    enabled: !!selectedVessel && !!periodValue,
  });

  const adjustmentCount = useMemo(() => {
    if (!dateLineAdjustment) return 0;
    try {
      const adjustments = JSON.parse(dateLineAdjustment.adjustments);
      return Array.isArray(adjustments) ? adjustments.length : 0;
    } catch (e) {
      return 0;
    }
  }, [dateLineAdjustment]);

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


  const handleBack = () => {
    setLocation('/rest-hours/record');
  };

  const handleClearFilters = () => {
    // Reset period to current month in store
    const defaultOption = periodOptions[0]?.value || "";
    if (defaultOption) {
      const [year, month] = defaultOption.split('-').map(Number);
      setStorePeriodValue({ mode: 'year-month', year, month });
    }
    // Reset vessel to URL param or clear
    setPlanVesselId(urlVesselId || "");
    setSelectedRank("");
    setSearchText("");
  };

  // Track the last synced URL params to detect when URL actually changes
  // This prevents dropdown changes from being overwritten by stale URL params
  const prevUrlParams = useRef<{ vesselId?: string; monthValue?: string }>({
    vesselId: undefined,
    monthValue: undefined,
  });

  // Sync URL params to store only when URL actually changes (not when store changes)
  useEffect(() => {
    const prevVessel = prevUrlParams.current.vesselId;
    const prevMonth = prevUrlParams.current.monthValue;
    
    // Only sync if URL param has actually changed (new deep link)
    if (urlVesselId !== prevVessel) {
      prevUrlParams.current.vesselId = urlVesselId;
      if (urlVesselId) {
        setPlanVesselId(urlVesselId);
      }
    }
    
    if (urlMonthValue !== prevMonth) {
      prevUrlParams.current.monthValue = urlMonthValue;
      if (urlMonthValue) {
        const [year, month] = urlMonthValue.split('-').map(Number);
        if (year && month) {
          setStorePeriodValue({ mode: 'year-month', year, month });
        }
      }
    }
  }, [urlVesselId, urlMonthValue, setPlanVesselId, setStorePeriodValue]);

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
      <MainLayout hasSidebar={true}>
        <div className="flex flex-col h-full">
          <SectionTitleComponents title={`RH Records - ${vesselName} - ${monthDisplay}`}>
        <div className="flex gap-4 items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
            data-testid="button-export-rh-vessel"
          >
            <FileText className="h-4 w-4" />
            Export All
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#4f5863]">Rest</span>
            <button
              onClick={() => setComplianceMode(complianceMode === 'Rest' ? 'Work' : 'Rest')}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                complianceMode === 'Work' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              data-testid="toggle-compliance-mode"
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  complianceMode === 'Work' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-[#4f5863]">Work</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateLineDialogOpen(true)}
            className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600 relative"
            data-testid="button-date-line-adjustments"
          >
            <Globe className="h-4 w-4" />
            Date Line
            {adjustmentCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-medium flex items-center justify-center">
                {adjustmentCount}
              </span>
            )}
          </Button>
          
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

      <DateLineAdjustmentsDialog
        open={dateLineDialogOpen}
        onOpenChange={setDateLineDialogOpen}
        vesselId={selectedVessel}
        vesselName={vesselName}
        monthValue={periodValue}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
        {/* Period Dropdown */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-[#4f5863] dark:text-neutral-300">Period</Label>
          <Select value={periodValue} onValueChange={handlePeriodChange}>
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
          <Select value={selectedVessel} onValueChange={handleVesselChange}>
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
              {ranksLoading ? (
                <SelectItem value="loading" disabled>Loading ranks...</SelectItem>
              ) : (
                rankOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))
              )}
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
          complianceMode={complianceMode}
          opaMode={opaMode}
        />
      </div>
        </div>
      </MainLayout>
    </>
  );
};
