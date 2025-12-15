import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { RHRecordsTable } from './RHRecordsTable';
import { PeriodFilter, type PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { parseRestHoursFilters, serializeRestHoursFilters, periodFilterToPart, partToPeriodFilter, type RestHoursFilters } from './utils/filterParams';
import { useViewport } from '@/hooks/useViewport';

export const RestHoursRecord = (): JSX.Element => {
  const viewport = useViewport();
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';

  const [location, setLocation] = useLocation();
  const hasSyncedFromUrl = useRef(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [showFilters, setShowFilters] = useState(true);
  const [complianceMode, setComplianceMode] = useState<'Rest' | 'Work'>('Rest');
  const [opaMode, setOpaMode] = useState(false);
  const [filterType, setFilterType] = useState<"vessel" | "fleet" | "addGroup">("vessel");
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [fleetValue, setFleetValue] = useState("");
  const [addGroupValue, setAddGroupValue] = useState("");
  const [periodValue, setPeriodValue] = useState<PeriodFilterValue>({
    mode: 'year-month',
    year: currentYear,
    month: currentMonth,
  });

  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  // Convert PeriodFilterValue to string format for queries (YYYY-MM)
  const selectedMonthString = useMemo(() => {
    if (periodValue.mode === 'year-month' && periodValue.year && periodValue.month) {
      return `${periodValue.year}-${String(periodValue.month).padStart(2, '0')}`;
    }
    return '';
  }, [periodValue]);

  
  // Parse URL parameters or restore from localStorage on mount
  useEffect(() => {
    const search = window.location.search;
    if (!search) {
      // No URL params - try to restore from localStorage
      try {
        const stored = localStorage.getItem('rh-records-filters');
        if (stored) {
          const filters = JSON.parse(stored);
          if (filters.period) setPeriodValue(filters.period);
          if (filters.complianceMode) setComplianceMode(filters.complianceMode);
          if (filters.opaMode !== undefined) setOpaMode(filters.opaMode);
          if (filters.filterType) setFilterType(filters.filterType);
          if (filters.fleetValue) setFleetValue(filters.fleetValue);
          if (filters.addGroupValue) setAddGroupValue(filters.addGroupValue);
          if (filters.selectedVessels) setSelectedVessels(filters.selectedVessels);
        }
      } catch (e) {
        console.error('Failed to restore filters from localStorage:', e);
      }
      return;
    }
    
    const filters = parseRestHoursFilters(search);
    
    // Apply period filter (only if different from current state)
    const parsedPeriod = partToPeriodFilter(filters);
    if (parsedPeriod && JSON.stringify(parsedPeriod) !== JSON.stringify(periodValue)) {
      setPeriodValue(parsedPeriod);
    }
    
    // Apply compliance mode (only if different)
    if (filters.complianceMode && filters.complianceMode !== complianceMode) {
      setComplianceMode(filters.complianceMode);
    }
    
    // Apply OPA mode (only if different)
    if (filters.opaMode !== undefined && filters.opaMode !== opaMode) {
      setOpaMode(filters.opaMode);
    }
    
    // Apply filter type (only if different)
    if (filters.filterType && filters.filterType !== filterType) {
      setFilterType(filters.filterType);
    }
    
    // Apply fleet/group values (only if different)
    if (filters.fleetGroup && filters.fleetGroup !== fleetValue) {
      setFleetValue(filters.fleetGroup);
    }
    if (filters.addGroup && filters.addGroup !== addGroupValue) {
      setAddGroupValue(filters.addGroup);
    }
    // Note: vessel selection is handled in the next effect after vessels load
  }, []); // Run only on mount
  
  // Update vessel selection once vessels are loaded and mark as synced
  useEffect(() => {
    if (vesselsLoading || vessels.length === 0) return;
    
    const search = window.location.search;
    if (!search) {
      // No URL params, mark as synced now
      hasSyncedFromUrl.current = true;
      return;
    }
    
    const filters = parseRestHoursFilters(search);
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      // Convert vessel IDs to vessel names
      const vesselNames = filters.vesselIds
        .map(id => vessels.find((v: any) => v.entryId === id)?.name)
        .filter((name): name is string => name !== undefined);
      
      if (vesselNames.length > 0) {
        setSelectedVessels(vesselNames);
      }
    }
    
    // CRITICAL: Only mark as synced AFTER vessel data is loaded and applied
    hasSyncedFromUrl.current = true;
  }, [vessels, vesselsLoading]);
  
  // Save filter state to localStorage whenever filters change
  useEffect(() => {
    // Skip if still syncing from URL
    if (!hasSyncedFromUrl.current) return;
    
    try {
      const filters = {
        period: periodValue,
        complianceMode,
        opaMode,
        filterType,
        selectedVessels,
        fleetValue,
        addGroupValue,
      };
      localStorage.setItem('rh-records-filters', JSON.stringify(filters));
    } catch (e) {
      console.error('Failed to save filters to localStorage:', e);
    }
  }, [periodValue, complianceMode, opaMode, filterType, selectedVessels, fleetValue, addGroupValue]);

  const toggleVessel = (vesselName: string) => {
    console.log('[toggleVessel] Called with:', vesselName);
    setSelectedVessels(prev => {
      const newValue = prev.includes(vesselName) 
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName];
      console.log('[toggleVessel] Previous:', prev, '→ New:', newValue);
      return newValue;
    });
  };

  const handleClearFilters = () => {
    setFilterType("vessel");
    setSelectedVessels([]);
    setFleetValue("");
    setAddGroupValue("");
    setPeriodValue({
      mode: 'year-month',
      year: currentYear,
      month: currentMonth,
    });
  };

  // Vessel multi-select popover component (shared across layouts)
  const renderVesselSelect = () => (
    <Popover modal={false}>
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
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
              data-testid={`vessel-row-${vessel.entryId || vessel.id}`}
              onClick={() => toggleVessel(vessel.name)}
            >
              <Checkbox 
                checked={selectedVessels.includes(vessel.name)}
                onCheckedChange={() => toggleVessel(vessel.name)}
                data-testid={`checkbox-vessel-${vessel.entryId || vessel.id}`}
                onClick={(e) => e.stopPropagation()}
              />
              <span 
                className="text-sm flex-1"
                data-testid={`label-vessel-${vessel.entryId || vessel.id}`}
              >
                {vessel.name}
              </span>
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
        <SelectItem value="fleet3">Fleet Group 3</SelectItem>
      </SelectContent>
    </Select>
  );

  // Additional Group select component (shared across layouts)
  const renderAddGroupSelect = () => (
    <Select value={addGroupValue} onValueChange={setAddGroupValue}>
      <SelectTrigger 
        className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
        data-testid="select-addgroup-value"
      >
        <SelectValue placeholder="Select Group" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="group1">Additional Group 1</SelectItem>
        <SelectItem value="group2">Additional Group 2</SelectItem>
        <SelectItem value="group3">Additional Group 3</SelectItem>
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
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

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
                  Fleet Group
                </Label>
              </div>
              {filterType === 'fleet' && renderFleetSelect()}
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
                <Label 
                  htmlFor="filter-addgroup" 
                  className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                >
                  Additional Group
                </Label>
              </div>
              {filterType === 'addGroup' && renderAddGroupSelect()}
            </div>
          </RadioGroup>

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
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

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
                  Fleet Group
                </Label>
              </div>
              {filterType === 'fleet' && renderFleetSelect()}
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
                <Label 
                  htmlFor="filter-addgroup" 
                  className="text-xs font-normal text-[#4f5863] dark:text-neutral-300 cursor-pointer"
                >
                  Additional Group
                </Label>
              </div>
              {filterType === 'addGroup' && renderAddGroupSelect()}
            </div>
          </RadioGroup>

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
        <PeriodFilter value={periodValue} onChange={setPeriodValue} />

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
            {filterType === 'vessel' && renderVesselSelect()}
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
            {filterType === 'fleet' && renderFleetSelect()}
          </div>

          {/* Additional Group Radio + Select */}
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
            {filterType === 'addGroup' && renderAddGroupSelect()}
          </div>
        </RadioGroup>

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
      <SectionTitleComponents title="RH Records - Office Overview">
        <div className={`flex items-center ${isPhone ? 'flex-col gap-2' : 'flex-row gap-4'}`}>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#4f5863]">Rest</span>
            <button
              onClick={() => setComplianceMode(prev => prev === 'Rest' ? 'Work' : 'Rest')}
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

      {/* RH Records Table */}
      <div className="pr-4 pb-4">
        {selectedMonthString ? (
          <RHRecordsTable 
            selectedVessels={filterType === 'vessel' ? selectedVessels : []}
            selectedMonth={selectedMonthString}
            complianceMode={complianceMode}
            opaMode={opaMode}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Please select a year and month to view records
          </div>
        )}
      </div>
    </div>
  );
};
