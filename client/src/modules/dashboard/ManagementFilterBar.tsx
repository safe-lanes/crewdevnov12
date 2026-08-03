import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PeriodFilter,
  type PeriodFilterValue,
} from "@/components/filters/PeriodFilter";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import {
  useNationalitiesV2,
  useCrewPoolsV2,
  useManningAgentsV2,
} from "@/hooks/v2/useMasterDataV2";

interface MultiSelectProps {
  label: string;
  testId: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

const MultiSelect = ({
  label,
  testId,
  options,
  selected,
  onChange,
}: MultiSelectProps) => {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-40 justify-between px-3 text-xs font-normal text-[#0f172a] dark:text-white bg-transparent dark:bg-neutral-900 hover:bg-transparent dark:hover:bg-neutral-900 hover:text-[#0f172a] dark:hover:text-white"
          data-testid={`select-${testId}`}
        >
          <span className="truncate">
            {selected.length > 0 ? `${selected.length} selected` : label}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        {options.length === 0 ? (
          <div
            className="text-xs text-gray-500 dark:text-gray-400 py-3 px-2 text-center"
            data-testid={`empty-${testId}`}
          >
            No options available
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <div
                key={option}
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggle(option)}
                  data-testid={`checkbox-${testId}-${option}`}
                />
                <label
                  className="text-sm cursor-pointer flex-1"
                  onClick={() => toggle(option)}
                >
                  {option}
                </label>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export interface ManagementFilters {
  ranks: string[];
  vessels: string[];
  crewPools: string[];
  manningAgents: string[];
  nationalities: string[];
}

export const EMPTY_MANAGEMENT_FILTERS: ManagementFilters = {
  ranks: [],
  vessels: [],
  crewPools: [],
  manningAgents: [],
  nationalities: [],
};

export interface ManagementFilterBarProps {
  period: PeriodFilterValue;
  onPeriodChange: (value: PeriodFilterValue) => void;
  filters: ManagementFilters;
  onFiltersChange: (next: ManagementFilters) => void;
  onClear: () => void;
}

export const ManagementFilterBar = ({
  period,
  onPeriodChange,
  filters,
  onFiltersChange,
  onClear,
}: ManagementFilterBarProps) => {
  const update = (key: keyof ManagementFilters) => (next: string[]) =>
    onFiltersChange({ ...filters, [key]: next });

  const { rankLabels } = useCompanyRanks();
  const { data: nationalitiesData = [] } = useNationalitiesV2();
  const { data: crewPoolsData = [] } = useCrewPoolsV2();
  const { data: manningAgentsData = [] } = useManningAgentsV2();

  const rankOptions = useMemo(
    () => Array.from(new Set(rankLabels.filter(Boolean))),
    [rankLabels],
  );

  const nationalityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (nationalitiesData as any[])
            .map((n) => n?.nationality || n?.name)
            .filter(Boolean),
        ),
      ).sort(),
    [nationalitiesData],
  );

  const crewPoolOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (crewPoolsData as any[])
            .filter((p) => !p?.isDeleted)
            .map((p) => p?.name || p?.poolName)
            .filter(Boolean),
        ),
      ).sort(),
    [crewPoolsData],
  );

  const manningAgentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (manningAgentsData as any[])
            .filter((a) => a?.name && !a?.isDeleted)
            .map((a) => a.name),
        ),
      ).sort(),
    [manningAgentsData],
  );

  return (
    <div
      className="flex flex-wrap items-center gap-3 mb-4 bg-transparent"
      data-testid="management-filter-bar"
    >
      <PeriodFilter value={period} onChange={onPeriodChange} />
      <MultiSelect
        label="Rank"
        testId="rank"
        options={rankOptions}
        selected={filters.ranks}
        onChange={update("ranks")}
      />
      <MultiSelect
        label="Crew Pool"
        testId="crew-pool"
        options={crewPoolOptions}
        selected={filters.crewPools}
        onChange={update("crewPools")}
      />
      <MultiSelect
        label="Manning Agent"
        testId="manning-agent"
        options={manningAgentOptions}
        selected={filters.manningAgents}
        onChange={update("manningAgents")}
      />
      <MultiSelect
        label="Nationality"
        testId="nationality"
        options={nationalityOptions}
        selected={filters.nationalities}
        onChange={update("nationalities")}
      />
      <div>
        <Button
          variant="outline"
          onClick={onClear}
          className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
