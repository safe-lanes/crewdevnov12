import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useV2Vessels, useV2FleetGroups, useV2AdditionalGroups, parseGroupVesselNames } from '../hooks/useRestHoursV2Data';
import { RHRecordsTable } from './RHRecordsTable';
import { PeriodFilter, type PeriodFilterValue } from '@/components/filters/PeriodFilter';
import { parseRestHoursFilters, serializeRestHoursFilters, periodFilterToPart, partToPeriodFilter, type RestHoursFilters } from '../utils/filterParams';
import { useViewport } from '@/hooks/useViewport';
import { useRestHoursFiltersStore } from '@/stores/restHoursFiltersStore';

export const RestHoursRecord = (): JSX.Element => {
  const viewport = useViewport();
  const isPhone = viewport === 'phone';
  const isTablet = viewport === 'tablet';

  const [location, setLocation] = useLocation();
  const hasSyncedFromUrl = useRef(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [showFilters, setShowFilters] = useState(true);
  
  const {
    periodValue,
    setPeriodValue,
    complianceMode,
    setComplianceMode,
    opaMode,
    setOpaMode,
    filterType,
    setFilterType,
    selectedVessels,
    setSelectedVessels,
    fleetValue,
    setFleetValue,
    addGroupValue,
    setAddGroupValue,
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

  const { userType, myVessels } = usePermissions();
  const isShipUser = userType === 'Ship';

  const { vessels: v2Vessels, isLoading: vesselsLoading } = useV2Vessels();
  const { fleetGroups } = useV2FleetGroups();
  const { additionalGroups } = useV2AdditionalGroups();
  
  const vessels = useMemo(() => v2Vessels.map(v => ({
    id: v.id,
    entryId: v.vesselUuid ?? '',
    name: v.vessel ?? '',
    vesselType: v.vesselType ?? '',
  })), [v2Vessels]);

  const shipVesselName = useMemo(() => {
    if (!isShipUser || myVessels.length === 0) return null;
    return myVessels[0].vessel;
  }, [isShipUser, myVessels]);

  useEffect(() => {
    if (isShipUser && myVessels.length > 0 && vessels.length > 0) {
      const myVesselName = myVessels[0].vessel;
      setFilterType("vessel");
      setSelectedVessels([myVesselName]);
      setDraftFilterType("vessel");
      setDraftSelectedVessels([myVesselName]);
    }
  }, [isShipUser, myVessels, vessels]);

  const selectedMonths = useMemo((): string[] => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let months: string[] = [];

    if (periodValue.mode === 'year' && periodValue.year) {
      months = Array.from({ length: 12 }, (_, i) =>
        `${periodValue.year}-${String(i + 1).padStart(2, '0')}`
      );
    } else if (periodValue.mode === 'year-month' && periodValue.year && periodValue.month) {
      months = [`${periodValue.year}-${String(periodValue.month).padStart(2, '0')}`];
    } else if (periodValue.mode === 'year-quarter' && periodValue.year && periodValue.quarter) {
      const startMonth = (periodValue.quarter - 1) * 3 + 1;
      months = [0, 1, 2].map(offset =>
        `${periodValue.year}-${String(startMonth + offset).padStart(2, '0')}`
      );
    } else if (periodValue.mode === 'date-range' && periodValue.dateFrom && periodValue.dateTo) {
      const from = new Date(periodValue.dateFrom);
      const to = new Date(periodValue.dateTo);
      let y = from.getFullYear();
      let m = from.getMonth();
      const endY = to.getFullYear();
      const endM = to.getMonth();
      while (y < endY || (y === endY && m <= endM)) {
        months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        m++;
        if (m > 11) { m = 0; y++; }
      }
    }

    return months.filter(mv => mv <= currentMonthStr);
  }, [periodValue]);

  // Parse URL parameters on mount (localStorage is handled by the store automatically)
  useEffect(() => {
    const search = window.location.search;
    if (!search) {
      hasSyncedFromUrl.current = true;
      return;
    }
    
    const filters = parseRestHoursFilters(search);
    
    const parsedPeriod = partToPeriodFilter(filters);
    if (parsedPeriod) {
      setPeriodValue(parsedPeriod);
    }
    
    if (filters.complianceMode) {
      setComplianceMode(filters.complianceMode);
    }
    
    if (filters.opaMode !== undefined) {
      setOpaMode(filters.opaMode);
    }
    
    if (!isShipUser && filters.filterType) {
      setFilterType(filters.filterType);
      setDraftFilterType(filters.filterType);
    }
    
    if (!isShipUser && filters.fleetGroup) {
      setFleetValue(filters.fleetGroup);
      setDraftFleetValue(filters.fleetGroup);
    }
    if (!isShipUser && filters.addGroup) {
      setAddGroupValue(filters.addGroup);
      setDraftAddGroupValue(filters.addGroup);
    }
    
    hasSyncedFromUrl.current = true;
  }, []);

  useEffect(() => { syncDraftFromApplied(); }, []);
  
  useEffect(() => {
    if (isShipUser) return;
    if (vesselsLoading || vessels.length === 0) return;
    
    const search = window.location.search;
    if (!search) return;
    
    const filters = parseRestHoursFilters(search);
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      const vesselNames = filters.vesselIds
        .map(id => vessels.find((v: any) => v.entryId === id)?.name)
        .filter((name): name is string => name !== undefined);
      
      if (vesselNames.length > 0) {
        setSelectedVessels(vesselNames);
        setDraftSelectedVessels(vesselNames);
      }
    }
  }, [isShipUser, vessels, vesselsLoading]);

  const effectiveVesselNames = useMemo(() => {
    let names: string[] = [];
    if (filterType === 'vessel') names = selectedVessels;
    else if (filterType === 'fleet') names = parseGroupVesselNames(fleetGroups.find(g => (g.fgUuid ?? String(g.id)) === fleetValue)?.vessels);
    else if (filterType === 'addGroup') names = parseGroupVesselNames(additionalGroups.find(g => (g.agUuid ?? String(g.id)) === addGroupValue)?.vessels);
    return names.filter(n => vessels.some((v: any) => v.name === n));
  }, [filterType, selectedVessels, fleetValue, addGroupValue, fleetGroups, additionalGroups, vessels]);

  const handleClearFilters = () => {
    setDraftFilterType("vessel");
    setDraftSelectedVessels([]);
    setDraftFleetValue("");
    setDraftAddGroupValue("");
    applyFilters();
    setPeriodValue({
      mode: 'year-month',
      year: currentYear,
      month: currentMonth,
    });
  };

  const renderVesselSelect = () => (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 text-xs text-[#0f172a] dark:text-white justify-between bg-transparent dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-40'}`}
          disabled={vesselsLoading || isShipUser}
          data-testid="select-vessel-multi"
        >
          <span className="truncate">
            {isShipUser && shipVesselName
              ? shipVesselName
              : draftSelectedVessels.length > 0 
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
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
              data-testid={`vessel-row-${vessel.entryId || vessel.id}`}
              onClick={() => toggleDraftVessel(vessel.name)}
            >
              <Checkbox 
                checked={draftSelectedVessels.includes(vessel.name)}
                onCheckedChange={() => toggleDraftVessel(vessel.name)}
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

  const renderFleetSelect = () => (
    <Select value={draftFleetValue} onValueChange={setDraftFleetValue} disabled={isShipUser}>
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
    <Select value={draftAddGroupValue} onValueChange={setDraftAddGroupValue} disabled={isShipUser}>
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

    if (isPhone) {
      return (
        <div className="flex flex-col gap-3 mb-4 p-3 bg-transparent rounded-lg" data-testid="filter-container">
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

          <RadioGroup 
            value={draftFilterType} 
            onValueChange={(value: "vessel" | "fleet" | "addGroup") => !isShipUser && setDraftFilterType(value)}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="vessel" 
                  id="filter-vessel"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-vessel"
                />
                {renderVesselSelect()}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="fleet" 
                  id="filter-fleet"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-fleet"
                />
                {renderFleetSelect()}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="addGroup" 
                  id="filter-addgroup"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-addgroup"
                />
                {renderAddGroupSelect()}
              </div>
            </div>
          </RadioGroup>

          <Button
            onClick={applyFilters}
            className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
            disabled={isShipUser}
            data-testid="button-apply"
          >
            Apply
          </Button>

          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]"
            disabled={isShipUser}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>
      );
    }

    if (isTablet) {
      return (
        <div className="flex flex-col gap-3 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
          <PeriodFilter value={periodValue} onChange={setPeriodValue} />

          <RadioGroup 
            value={draftFilterType} 
            onValueChange={(value: "vessel" | "fleet" | "addGroup") => !isShipUser && setDraftFilterType(value)}
            className="grid grid-cols-3 gap-4"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="vessel" 
                  id="filter-vessel"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-vessel"
                />
                {renderVesselSelect()}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="fleet" 
                  id="filter-fleet"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-fleet"
                />
                {renderFleetSelect()}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem 
                  value="addGroup" 
                  id="filter-addgroup"
                  className="h-4 w-4"
                  disabled={isShipUser}
                  data-testid="radio-addgroup"
                />
                {renderAddGroupSelect()}
              </div>
            </div>
          </RadioGroup>

          <Button
            onClick={applyFilters}
            className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
            disabled={isShipUser}
            data-testid="button-apply"
          >
            Apply
          </Button>

          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
            disabled={isShipUser}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
        <PeriodFilter value={periodValue} onChange={setPeriodValue} />

        <RadioGroup 
          value={draftFilterType} 
          onValueChange={(value: "vessel" | "fleet" | "addGroup") => !isShipUser && setDraftFilterType(value)}
          className="flex items-center gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem 
              value="vessel" 
              id="filter-vessel"
              className="h-4 w-4"
              disabled={isShipUser}
              data-testid="radio-vessel"
            />
            {renderVesselSelect()}
          </div>

          <div className="flex items-center gap-2">
            <RadioGroupItem 
              value="fleet" 
              id="filter-fleet"
              className="h-4 w-4"
              disabled={isShipUser}
              data-testid="radio-fleet"
            />
            {renderFleetSelect()}
          </div>

          <div className="flex items-center gap-2">
            <RadioGroupItem 
              value="addGroup" 
              id="filter-addgroup"
              className="h-4 w-4"
              disabled={isShipUser}
              data-testid="radio-addgroup"
            />
            {renderAddGroupSelect()}
          </div>
        </RadioGroup>

        <Button
          onClick={applyFilters}
          className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-white text-xs px-4"
          disabled={isShipUser}
          data-testid="button-apply"
        >
          Apply
        </Button>

        <Button
          variant="outline"
          onClick={handleClearFilters}
          className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
          disabled={isShipUser}
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="RH Records - Overview">
        <div className={`flex items-center ${isPhone ? 'flex-col gap-2' : 'flex-row gap-4'}`}>
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
        {selectedMonths.length > 0 ? (
          <RHRecordsTable 
            selectedVessels={effectiveVesselNames}
            selectedMonths={selectedMonths}
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
