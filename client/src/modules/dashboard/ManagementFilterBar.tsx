import { useState, useMemo } from "react";
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
          className="h-8 w-40 justify-between text-xs text-[#0f172a] dark:text-white bg-white dark:bg-neutral-900 border-gray-300 dark:border-gray-600"
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

export const ManagementFilterBar = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const defaultPeriod = useMemo<PeriodFilterValue>(
    () => ({ mode: "year-month", year: currentYear, month: currentMonth }),
    [currentYear, currentMonth],
  );

  const [period, setPeriod] = useState<PeriodFilterValue>(defaultPeriod);
  const [ranks, setRanks] = useState<string[]>([]);
  const [crewPools, setCrewPools] = useState<string[]>([]);
  const [manningAgents, setManningAgents] = useState<string[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);

  const handleClear = () => {
    setPeriod(defaultPeriod);
    setRanks([]);
    setCrewPools([]);
    setManningAgents([]);
    setNationalities([]);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 mb-4 bg-transparent"
      data-testid="management-filter-bar"
    >
      <PeriodFilter value={period} onChange={setPeriod} />
      <MultiSelect
        label="Rank"
        testId="rank"
        options={[]}
        selected={ranks}
        onChange={setRanks}
      />
      <MultiSelect
        label="Crew Pool"
        testId="crew-pool"
        options={[]}
        selected={crewPools}
        onChange={setCrewPools}
      />
      <MultiSelect
        label="Manning Agent"
        testId="manning-agent"
        options={[]}
        selected={manningAgents}
        onChange={setManningAgents}
      />
      <MultiSelect
        label="Nationality"
        testId="nationality"
        options={[]}
        selected={nationalities}
        onChange={setNationalities}
      />
      <div className="ml-auto">
        <Button
          variant="outline"
          onClick={handleClear}
          className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
