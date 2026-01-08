import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useViewport } from '@/hooks/useViewport';
import type { VesselFleetGroupFilterProps, FilterMode } from './types';

export function VesselFleetGroupFilter({
  mode,
  onModeChange,
  vessels,
  selectedVessels,
  onToggleVessel,
  vesselsLoading = false,
  vesselPlaceholder = 'Vessel',
  fleets,
  selectedFleet,
  onFleetChange,
  fleetPlaceholder = 'Fleet',
  groups,
  selectedGroup,
  onGroupChange,
  groupPlaceholder = 'Add Group',
  showFilters,
  onToggleFilters,
  onClear,
  showFilterToggle = true,
  showClearButton = true,
  className = '',
  testIdPrefix = '',
  additionalFilters,
}: VesselFleetGroupFilterProps) {
  const viewport = useViewport();
  const isDesktopOrLaptop = viewport === 'desktop' || viewport === 'laptop';
  const isTablet = viewport === 'tablet';
  const isPhone = viewport === 'phone';

  const prefix = testIdPrefix ? `${testIdPrefix}-` : '';

  const vesselMultiSelectContent = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 text-xs text-[#0f172a] dark:text-neutral-200 justify-between bg-transparent dark:bg-neutral-900 border-input ${
            isPhone ? 'flex-1' : isTablet ? 'w-44' : 'w-36 ml-1'
          }`}
          disabled={vesselsLoading}
          data-testid={`${prefix}select-vessel-multi`}
        >
          <span className="truncate">
            {selectedVessels.length > 0
              ? `${selectedVessels.length} selected`
              : vesselsLoading
              ? 'Loading...'
              : vesselPlaceholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="max-h-60 overflow-y-auto">
          {vessels.map((vessel) => (
            <div
              key={vessel.id}
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <Checkbox
                checked={selectedVessels.includes(vessel.vesselId)}
                onCheckedChange={() => onToggleVessel(vessel.vesselId)}
                data-testid={`${prefix}checkbox-vessel-${vessel.id}`}
              />
              <label
                className="text-sm cursor-pointer flex-1"
                onClick={() => onToggleVessel(vessel.vesselId)}
              >
                {vessel.name}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const fleetSelectContent = (
    <Select value={selectedFleet} onValueChange={onFleetChange}>
      <SelectTrigger
        className={`h-8 text-xs text-[#0f172a] dark:text-neutral-200 placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${
          isPhone ? 'flex-1' : isTablet ? 'w-44' : 'w-32 ml-1'
        }`}
        data-testid={`${prefix}select-fleet-value`}
      >
        <SelectValue placeholder={fleetPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {fleets.map((fleet) => (
          <SelectItem key={fleet.id} value={fleet.value}>
            {fleet.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const groupSelectContent = (
    <Select value={selectedGroup} onValueChange={onGroupChange}>
      <SelectTrigger
        className={`h-8 text-xs text-[#0f172a] dark:text-neutral-200 placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${
          isPhone ? 'flex-1' : isTablet ? 'w-44' : 'w-36 ml-1'
        }`}
        data-testid={`${prefix}select-addgroup-value`}
      >
        <SelectValue placeholder={groupPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.value}>
            {group.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const clearButton = showClearButton && (
    <Button
      variant="outline"
      onClick={onClear}
      className="h-8 px-3 text-[#8798ad] text-[11px] border-[#e1e8ed] shrink-0"
      data-testid={`${prefix}button-clear-filters`}
    >
      Clear
    </Button>
  );

  const filterToggleButton = showFilterToggle && (
    <Button
      variant="outline"
      onClick={onToggleFilters}
      className="h-8 text-[11px] gap-1 px-2 border-input text-[#0f172a] dark:text-neutral-200 bg-transparent dark:bg-neutral-900"
      data-testid={`${prefix}button-filter-toggle`}
    >
      <Filter className="h-3.5 w-3.5" />
      <span>Filters</span>
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
      />
    </Button>
  );

  const radioGroupContent = (idSuffix: string, layoutClass: string) => (
    <RadioGroup
      value={mode}
      onValueChange={(value: FilterMode) => onModeChange(value)}
      className={layoutClass}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem
          value="vessel"
          id={`filter-vessel${idSuffix}`}
          className="h-4 w-4"
          data-testid={`${prefix}radio-vessel`}
        />
        {vesselMultiSelectContent}
      </div>

      <div className="flex items-center gap-2">
        <RadioGroupItem
          value="fleet"
          id={`filter-fleet${idSuffix}`}
          className="h-4 w-4"
          data-testid={`${prefix}radio-fleet`}
        />
        {fleetSelectContent}
      </div>

      <div className="flex items-center gap-2">
        <RadioGroupItem
          value="addGroup"
          id={`filter-addgroup${idSuffix}`}
          className="h-4 w-4"
          data-testid={`${prefix}radio-addgroup`}
        />
        {groupSelectContent}
      </div>
    </RadioGroup>
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {showFilterToggle && (
        <div className="flex items-center gap-2">
          {filterToggleButton}
        </div>
      )}

      {showFilters && (
        <>
          {isDesktopOrLaptop && (
            <div className="flex flex-wrap items-center gap-3">
              {radioGroupContent('', 'flex items-center gap-4')}
              {additionalFilters}
              {clearButton}
            </div>
          )}

          {isTablet && (
            <div className="flex flex-wrap items-center gap-3">
              {radioGroupContent('-tablet', 'flex flex-wrap items-center gap-4')}
              {additionalFilters}
              {clearButton}
            </div>
          )}

          {isPhone && (
            <div className="space-y-3">
              {radioGroupContent('-phone', 'space-y-2')}
              {additionalFilters && (
                <div className="grid grid-cols-2 gap-2">{additionalFilters}</div>
              )}
              {clearButton}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VesselFleetGroupFilter;
