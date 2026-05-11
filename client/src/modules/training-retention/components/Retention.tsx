import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PeriodFilter, type PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import { useCrewPoolsV2, useManningAgentsV2 } from "@/hooks/v2/useMasterDataV2";
import { cn } from "@/lib/utils";

interface ChipMultiSelectProps {
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  testId: string;
  className?: string;
}

const ChipMultiSelect = ({
  placeholder,
  options,
  selected,
  onChange,
  testId,
  className,
}: ChipMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-8 w-[200px] rounded-md border border-input bg-background px-2 py-1 text-left text-xs",
            "flex flex-wrap items-center gap-1",
            "hover:bg-accent/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
          data-testid={testId}
        >
          {selected.length === 0 ? (
            <span className="flex-1 text-[#8899ae]">{placeholder}</span>
          ) : (
            selected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-sm bg-[#e6f0fb] px-1.5 py-0.5 text-[11px] text-[#16569e]"
                data-testid={`chip-${testId}-${s}`}
              >
                <span className="max-w-[120px] truncate">{s}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => remove(s, e)}
                  className="rounded-sm hover:bg-[#16569e]/10"
                  data-testid={`chip-remove-${testId}-${s}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#8899ae]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => toggle(opt)}
                    className="text-xs"
                    data-testid={`option-${testId}-${opt}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        isSelected ? "opacity-100 text-[#16569e]" : "opacity-0"
                      )}
                    />
                    {opt}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

type FormulaRow = {
  criteria: string;
  description: string;
  value: string;
  formula?: boolean;
};

const FORMULA_ROWS: FormulaRow[] = [
  {
    criteria: "S",
    description:
      "Total Number of terminations from whatever cause (In effect this means the total number employees that have left the company for whatever reason)",
    value: "100",
  },
  {
    criteria: "UT",
    description: "Unavoidable Terminations (i.e., retirements or long-term illness)",
    value: "20",
  },
  {
    criteria: "BT",
    description:
      "Beneficial Terminations (i.e., sometimes those staff that do leave provide benefit to the company by virtue of leaving, for example under performers)",
    value: "10",
  },
  {
    criteria: "AE",
    description: "The average number of employees working for the company during the Selection period",
    value: "2000",
  },
];

export const Retention = (): JSX.Element => {
  const [periodValue, setPeriodValue] = useState<PeriodFilterValue | undefined>(undefined);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedPools, setSelectedPools] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const { rankOptions } = useCompanyRanks();
  const { data: crewPoolsData } = useCrewPoolsV2();
  const { data: manningAgentsData } = useManningAgentsV2();

  const rankList = useMemo(() => rankOptions.map((r) => r.label), [rankOptions]);

  const poolList = useMemo(
    () =>
      ((crewPoolsData || []) as Array<{ name?: string; isDeleted?: boolean }>)
        .filter((p) => p.name && !p.isDeleted)
        .map((p) => p.name as string)
        .sort(),
    [crewPoolsData]
  );

  const agentList = useMemo(
    () =>
      ((manningAgentsData || []) as Array<{ name?: string; country?: string; isDeleted?: boolean }>)
        .filter((a) => a.name && !a.isDeleted)
        .map((a) => (a.country ? `${a.name} (${a.country})` : (a.name as string)))
        .sort(),
    [manningAgentsData]
  );

  return (
    <div className="flex flex-col h-full" data-testid="page-retention">
      <SectionTitleComponents title="Crew Retention">
        <div />
      </SectionTitleComponents>

      {/* Filter row */}
      <div
        className="mb-6 flex flex-wrap items-center gap-3"
        data-testid="retention-filter-bar"
      >
        <PeriodFilter value={periodValue} onChange={setPeriodValue} />
        <ChipMultiSelect
          placeholder="Ranks"
          options={rankList}
          selected={selectedRanks}
          onChange={setSelectedRanks}
          testId="filter-ranks"
        />
        <ChipMultiSelect
          placeholder="Crew Pool"
          options={poolList}
          selected={selectedPools}
          onChange={setSelectedPools}
          testId="filter-crew-pool"
        />
        <ChipMultiSelect
          placeholder="Manning Agent"
          options={agentList}
          selected={selectedAgents}
          onChange={setSelectedAgents}
          testId="filter-manning-agent"
        />
      </div>

      {/* Calculated rate headline */}
      <div className="mb-4 flex items-baseline gap-3">
        <span
          className="text-lg font-bold text-[#16569e]"
          data-testid="text-calculated-retention-label"
        >
          Calculated Retention Rate:
        </span>
        <span
          className="text-2xl font-bold text-[#16569e]"
          data-testid="text-calculated-retention-value"
        >
          96%
        </span>
      </div>

      {/* Definitions / formula table */}
      <div className="overflow-hidden rounded-md border border-[#e1e8ed] bg-white">
        <table className="w-full text-sm" data-testid="table-retention-formula">
          <thead className="bg-[#f7fafc] text-left text-xs font-semibold text-[#475569]">
            <tr>
              <th className="w-[140px] px-4 py-2">Criteria</th>
              <th className="px-4 py-2">Description</th>
              <th className="w-[120px] px-4 py-2 text-right">Values</th>
            </tr>
          </thead>
          <tbody>
            {FORMULA_ROWS.map((row) => (
              <tr
                key={row.criteria}
                className="border-t border-[#eef2f7]"
                data-testid={`row-retention-${row.criteria}`}
              >
                <td className="px-4 py-3 text-center font-semibold text-[#0f172a]">
                  {row.criteria}
                </td>
                <td className="px-4 py-3 text-[#0f172a]">{row.description}</td>
                <td
                  className="px-4 py-3 text-right font-semibold text-[#0f172a]"
                  data-testid={`value-retention-${row.criteria}`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
            <tr
              className="border-t border-[#eef2f7]"
              data-testid="row-retention-formula"
            >
              <td className="px-4 py-3 text-center font-semibold text-[#16569e]">
                Formula
              </td>
              <td className="px-4 py-3 text-[#16569e] font-medium" colSpan={2}>
                <div className="flex flex-col items-start leading-tight">
                  <span>% Retention Rate (RR) = 100 - [(S – (UT + BT)) X 100]</span>
                  <span className="ml-[19.5rem] border-t border-[#16569e] px-3">AE</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
