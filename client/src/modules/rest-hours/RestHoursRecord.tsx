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

export const RestHoursRecord = (): JSX.Element => {
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
  
  // Parse URL parameters whenever location changes
  useEffect(() => {
    const search = location.split('?')[1];
    if (!search) {
      hasSyncedFromUrl.current = true;
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
  }, [location]); // Re-run when location changes
  
  // Update vessel selection once vessels are loaded and we have vesselIds from URL
  useEffect(() => {
    if (vesselsLoading || vessels.length === 0) return;
    
    const search = location.split('?')[1];
    if (!search) {
      // No URL params, mark as synced
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
    
    // Mark as synced after processing URL params with vessel data
    hasSyncedFromUrl.current = true;
  }, [vessels, vesselsLoading, location]);
  
  // Sync filter state to URL whenever filters change
  useEffect(() => {
    // Skip until initial URL sync is complete (prevents race conditions during mount)
    if (!hasSyncedFromUrl.current) return;
    
    // Skip if vessels are still loading (we need vessel data to convert names to IDs)
    if (vesselsLoading) return;
    
    // Build filter object from current state
    const currentFilters: RestHoursFilters = {
      ...periodFilterToPart(periodValue),
      filterType,
      complianceMode,
      opaMode,
    };
    
    // Add vessel IDs (convert names to IDs)
    if (filterType === 'vessel' && selectedVessels.length > 0) {
      const vesselIds = selectedVessels
        .map(name => vessels.find((v: any) => v.name === name)?.entryId)
        .filter((id): id is string => id !== undefined);
      if (vesselIds.length > 0) {
        currentFilters.vesselIds = vesselIds;
      }
    } else if (filterType === 'fleet' && fleetValue) {
      currentFilters.fleetGroup = fleetValue;
    } else if (filterType === 'addGroup' && addGroupValue) {
      currentFilters.addGroup = addGroupValue;
    }
    
    // Serialize to URL
    const search = serializeRestHoursFilters(currentFilters);
    const targetPath = `/rest-hours/records${search ? `?${search}` : ''}`;
    const currentPath = window.location.pathname + window.location.search;
    
    // Only update URL if it's actually different (prevents infinite loops)
    if (currentPath !== targetPath) {
      setLocation(targetPath, { replace: true });
    }
  }, [periodValue, filterType, selectedVessels, fleetValue, addGroupValue, complianceMode, opaMode, vessels, vesselsLoading, setLocation]);

  // Convert PeriodFilterValue to string format for RHRecordsTable (YYYY-MM)
  const selectedMonthString = useMemo(() => {
    if (periodValue.mode === 'year-month' && periodValue.year && periodValue.month) {
      return `${periodValue.year}-${String(periodValue.month).padStart(2, '0')}`;
    }
    return '';
  }, [periodValue]);

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
    setPeriodValue({
      mode: 'year-month',
      year: currentYear,
      month: currentMonth,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="RH Records - Office Overview">
        <div className="flex gap-4 items-center">
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

      {showFilters && (
        <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
          {/* Period Filter */}
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

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
