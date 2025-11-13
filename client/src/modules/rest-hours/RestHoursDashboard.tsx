import { useState, useMemo, useCallback } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { AgCharts, type AgChartOptions } from '@/lib/agCharts';
import { PeriodFilter, type PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { RankWiseViolationsChart } from './RankWiseViolationsChart';
import { RankWiseNCsChart } from './RankWiseNCsChart';
import { PlaceholderChart } from './PlaceholderChart';
import { PeriodicAnalysisChart } from './PeriodicAnalysisChart';
import { PerformanceOverviewCard } from './PerformanceOverviewCard';
import { VesselAnalysisChart } from './VesselAnalysisChart';
import { VesselStatusChart } from './VesselStatusChart';

export const RestHoursDashboard = (): JSX.Element => {
  const [showFilters, setShowFilters] = useState(true);
  const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [fleetValue, setFleetValue] = useState("");
  const [addGroupValue, setAddGroupValue] = useState("");
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
  
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>({
    mode: 'year-month',
    year: currentYear,
    month: currentMonth,
  });

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  const toggleVessel = (vesselName: string) => {
    setSelectedVessels(prev => 
      prev.includes(vesselName) 
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName]
    );
  };

  const handleClearFilters = () => {
    setFilterType("vessel");
    setSelectedVessels([]);
    setFleetValue("");
    setAddGroupValue("");
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

  // Get vessel IDs from vessel names (for filtering)
  const vesselIds = useMemo(() => {
    if (filterType !== 'vessel' || selectedVessels.length === 0) return undefined;
    
    // Map vessel names to IDs
    const ids: string[] = [];
    selectedVessels.forEach(vesselName => {
      const vessel = vessels.find((v: any) => v.name === vesselName);
      if (vessel) {
        ids.push(vessel.entryId);
      }
    });
    return ids.length > 0 ? ids : undefined;
  }, [filterType, selectedVessels, vessels]);

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="RH Dashboard - Office">
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
        <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
          {/* Period Filter */}
          <PeriodFilter 
            value={periodFilter}
            onChange={setPeriodFilter}
          />

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
                Fleet Group
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
                  <SelectItem value="fleet3">Fleet Group 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add Group Radio + Select */}
            <div className="flex items-center gap-2">
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
                Additional Group
              </Label>
              <Select value={addGroupValue} onValueChange={setAddGroupValue}>
                <SelectTrigger 
                  className="h-8 w-40 ml-2 text-xs text-[#0f172a] placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900"
                  data-testid="select-addgroup-value"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group1">Additional Group 1</SelectItem>
                  <SelectItem value="group2">Additional Group 2</SelectItem>
                  <SelectItem value="group3">Additional Group 3</SelectItem>
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
      )}

      {/* Dashboard Grid - 3x2 layout with wider middle column */}
      <div className="flex-1 px-4 pb-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr] gap-6 h-full" style={{ gridAutoRows: 'minmax(300px, 1fr)' }}>
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
