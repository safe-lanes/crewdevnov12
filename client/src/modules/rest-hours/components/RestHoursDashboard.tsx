import { useState, useMemo, useCallback, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useV2Vessels, useV2FleetGroups, useV2AdditionalGroups, parseGroupVesselNames } from '../hooks/useRestHoursV2Data';
import { AgCharts, type AgChartOptions } from '@/lib/agCharts';
import { PeriodFilter, type PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { RankWiseViolationsChart } from './RankWiseViolationsChart';
import { RankWiseNCsChart } from './RankWiseNCsChart';
import { PlaceholderChart } from './PlaceholderChart';
import { PeriodicAnalysisChart } from './PeriodicAnalysisChart';
import { PerformanceOverviewCard } from './PerformanceOverviewCard';
import { VesselAnalysisChart } from './VesselAnalysisChart';
import { VesselStatusChart } from './VesselStatusChart';
import { useViewport } from '@/hooks/useViewport';
import { useRestHoursFiltersStore } from '@/stores/restHoursFiltersStore';

export const RestHoursDashboard = (): JSX.Element => {
  const viewport = useViewport();
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';

  const [showFilters, setShowFilters] = useState(true);
  const [chart1Toolbar, setChart1Toolbar] = useState<JSX.Element | null>(null);
  const [chart2Toolbar, setChart2Toolbar] = useState<JSX.Element | null>(null);
  const [rankViolationsToolbar, setRankViolationsToolbar] = useState<JSX.Element | null>(null);
  const [chart4Toolbar, setChart4Toolbar] = useState<JSX.Element | null>(null);
  const [chart5Toolbar, setChart5Toolbar] = useState<JSX.Element | null>(null);
  const [chart6Toolbar, setChart6Toolbar] = useState<JSX.Element | null>(null);
  
  // Wrap toolbar setters in useCallback to prevent infinite re-render loops
  const handleSetChart2Toolbar = useCallback((toolbar: JSX.Element | null) => setChart2Toolbar(toolbar), []);
  const handleSetRankViolationsToolbar = useCallback((toolbar: JSX.Element | null) => setRankViolationsToolbar(toolbar), []);
  const handleSetChart4Toolbar = useCallback((toolbar: JSX.Element | null) => setChart4Toolbar(toolbar), []);
  const handleSetChart5Toolbar = useCallback((toolbar: JSX.Element | null) => setChart5Toolbar(toolbar), []);
  const handleSetChart6Toolbar = useCallback((toolbar: JSX.Element | null) => setChart6Toolbar(toolbar), []);
  
  // Default to current year and current month
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Use shared store for filter state persistence across pages
  const {
    periodValue: periodFilter,
    setPeriodValue: setPeriodFilter,
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
    draftFilterType,
    setDraftFilterType,
    draftSelectedVessels,
    setDraftSelectedVessels,
    toggleDraftVessel,
    draftFleetValue,
    setDraftFleetValue,
    draftAddGroupValue,
    setDraftAddGroupValue,
    applyFilters,
    syncDraftFromApplied,
  } = useRestHoursFiltersStore();

  const { vessels: v2Vessels, isLoading: vesselsLoading } = useV2Vessels();
  const { fleetGroups } = useV2FleetGroups();
  const { additionalGroups } = useV2AdditionalGroups();

  useEffect(() => { syncDraftFromApplied(); }, []);

  const vessels = useMemo(() => v2Vessels.map(v => ({
    id: v.id,
    entryId: v.vesselUuid ?? '',
    name: v.vessel ?? '',
    vesselType: v.vesselType ?? '',
  })), [v2Vessels]);

  const handleClearFilters = () => {
    setDraftFilterType("vessel");
    setDraftSelectedVessels([]);
    setDraftFleetValue("");
    setDraftAddGroupValue("");
    applyFilters();
    setPeriodFilter({
      mode: 'year-month',
      year: currentYear,
      month: currentMonth,
    });
  };

  // Convert PeriodFilterValue to monthValue string (YYYY-MM)
  const monthValue = useMemo(() => {
    if (periodFilter.mode === 'year-month' && periodFilter.year && periodFilter.month) {
      return `${periodFilter.year}-${String(periodFilter.month).padStart(2, '0')}`;
    }
    return undefined;
  }, [periodFilter]);

  // Get vessel IDs from vessel/fleet/group selection (for filtering)
  const vesselIds = useMemo(() => {
    let names: string[] = [];
    if (filterType === 'vessel') names = selectedVessels;
    else if (filterType === 'fleet') names = parseGroupVesselNames(fleetGroups.find(g => (g.fgUuid ?? String(g.id)) === fleetValue)?.vessels);
    else if (filterType === 'addGroup') names = parseGroupVesselNames(additionalGroups.find(g => (g.agUuid ?? String(g.id)) === addGroupValue)?.vessels);
    if (names.length === 0) return undefined;
    const ids = names.map(n => vessels.find((v: any) => v.name === n)?.entryId).filter(Boolean) as string[];
    const unique = Array.from(new Set(ids));
    return unique.length > 0 ? unique : undefined;
  }, [filterType, selectedVessels, fleetValue, addGroupValue, fleetGroups, additionalGroups, vessels]);

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
            {draftSelectedVessels.length > 0 
              ? `${draftSelectedVessels.length} selected` 
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
                checked={draftSelectedVessels.includes(vessel.name)}
                onCheckedChange={() => toggleDraftVessel(vessel.name)}
                data-testid={`checkbox-vessel-${vessel.id}`}
              />
              <label 
                className="text-sm cursor-pointer flex-1"
                onClick={() => toggleDraftVessel(vessel.name)}
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
    <Select value={draftFleetValue} onValueChange={setDraftFleetValue}>
      <SelectTrigger 
        className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
        data-testid="select-fleet-value"
      >
        <SelectValue placeholder="Select Fleet" />
      </SelectTrigger>
      <SelectContent>
        {fleetGroups.map((g) => (
          <SelectItem key={g.fgUuid ?? String(g.id)} value={g.fgUuid ?? String(g.id)}>{g.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Additional Group select component (shared across layouts)
  const renderAddGroupSelect = () => (
    <Select value={draftAddGroupValue} onValueChange={setDraftAddGroupValue}>
      <SelectTrigger 
        className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
        data-testid="select-addgroup-value"
      >
        <SelectValue placeholder="Select Group" />
      </SelectTrigger>
      <SelectContent>
        {additionalGroups.map((g) => (
          <SelectItem key={g.agUuid ?? String(g.id)} value={g.agUuid ?? String(g.id)}>{g.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Responsive filter bar render function
  const renderFilterBar = () => {
    if (!showFilters) return null;

    // Phone layout: vertical stack with full-width controls, show only active filter select
    if (isPhone) {
      return (
        <div className="flex flex-col gap-3 mb-4 p-3 bg-transparent rounded-lg" data-testid="filter-container">
          <PeriodFilter 
            value={periodFilter}
            onChange={setPeriodFilter}
          />

          <RadioGroup 
            value={draftFilterType} 
            onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
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
                {renderVesselSelect()}
              </div>
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
                {renderFleetSelect()}
              </div>
            </div>

            {/* Additional Group option */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="addGroup" 
                  id="filter-addgroup"
                  className="h-4 w-4"
                  data-testid="radio-addgroup"
                />
                {renderAddGroupSelect()}
              </div>
            </div>
          </RadioGroup>

          <Button
            onClick={applyFilters}
            className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
            data-testid="button-apply"
          >
            Apply
          </Button>

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
          <PeriodFilter 
            value={periodFilter}
            onChange={setPeriodFilter}
          />

          <RadioGroup 
            value={draftFilterType} 
            onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
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
                {renderVesselSelect()}
              </div>
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
                {renderFleetSelect()}
              </div>
            </div>

            {/* Additional Group option */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="addGroup" 
                  id="filter-addgroup"
                  className="h-4 w-4"
                  data-testid="radio-addgroup"
                />
                {renderAddGroupSelect()}
              </div>
            </div>
          </RadioGroup>

          <Button
            onClick={applyFilters}
            className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
            data-testid="button-apply"
          >
            Apply
          </Button>

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
        <PeriodFilter 
          value={periodFilter}
          onChange={setPeriodFilter}
        />

        <RadioGroup 
          value={draftFilterType} 
          onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
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
            {renderFleetSelect()}
          </div>

          {/* Additional Group Radio + Select */}
          <div className="flex items-center gap-2">
            <RadioGroupItem 
              value="addGroup" 
              id="filter-addgroup"
              className="h-4 w-4"
              data-testid="radio-addgroup"
            />
            {renderAddGroupSelect()}
          </div>
        </RadioGroup>

        <Button
          onClick={applyFilters}
          className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
          data-testid="button-apply"
        >
          Apply
        </Button>

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

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="RH Dashboard - Office">
        <div className="flex items-center gap-4">
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

      {renderFilterBar()}

      {/* Dashboard Grid - responsive: 1 column on phone, 2 on tablet, 3 on desktop/laptop */}
      <div className={`flex-1 pb-6 overflow-auto ${isPhone ? 'px-3' : 'px-4'}`}>
        <div 
          className={`grid gap-6 h-full ${
            isPhone 
              ? 'grid-cols-1' 
              : isTablet 
                ? 'grid-cols-2' 
                : 'grid-cols-[1fr_1.3fr_1fr]'
          }`} 
          style={{ gridAutoRows: 'minmax(300px, 1fr)' }}
        >
          {/* Card 1 - Performance Overview */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Performance Overview
              </h3>
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-1">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <PerformanceOverviewCard 
                    vesselIds={vesselIds} 
                    monthValue={monthValue}
                    periodFilter={periodFilter}
                    complianceMode="Rest"
                    opaMode={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 2 - Periodic Analysis */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Periodic Analysis
              </h3>
              {chart2Toolbar}
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-2">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <PeriodicAnalysisChart 
                    vesselIds={vesselIds} 
                    monthValue={monthValue}
                    periodFilter={periodFilter}
                    onRenderToolbar={handleSetChart2Toolbar}
                    complianceMode="Rest"
                    opaMode={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 3 - Rank Wise Violations */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Rank Wise Violations
              </h3>
              {rankViolationsToolbar}
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-3">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <RankWiseViolationsChart 
                    vesselIds={vesselIds} 
                    monthValue={monthValue}
                    onRenderToolbar={handleSetRankViolationsToolbar}
                    complianceMode="Rest"
                    opaMode={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 4 - Vessel Status Overview */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Vessel Status Overview
              </h3>
              {chart4Toolbar}
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-4">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <VesselStatusChart 
                    vesselIds={vesselIds}
                    periodFilter={periodFilter}
                    complianceMode="Rest"
                    opaMode={false}
                    onRenderToolbar={handleSetChart4Toolbar}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 5 */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Vessel Analysis
              </h3>
              {chart5Toolbar}
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-5">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <VesselAnalysisChart 
                    vesselIds={vesselIds}
                    periodFilter={periodFilter}
                    complianceMode="Rest"
                    opaMode={false}
                    onRenderToolbar={handleSetChart5Toolbar}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 6 */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#4a7ba7] dark:text-blue-400 uppercase tracking-wide">
                Rank Wise NCs
              </h3>
              {chart6Toolbar}
            </div>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-1 min-h-0" data-testid="dashboard-card-6">
              <CardContent className="p-3 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <RankWiseNCsChart 
                    vesselIds={vesselIds} 
                    monthValue={monthValue} 
                    onRenderToolbar={handleSetChart6Toolbar}
                    complianceMode="Rest"
                    opaMode={false}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
