import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Info, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodFilter, type PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import { useCrewPoolsV2, useManningAgentsWithActiveCrewV2 } from "@/hooks/v2/useMasterDataV2";
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
  criteria: "S" | "UT" | "BT" | "AE";
  description: string;
};

const FORMULA_ROWS: FormulaRow[] = [
  {
    criteria: "S",
    description:
      "Total Number of terminations from whatever cause (In effect this means the total number employees that have left the company for whatever reason)",
  },
  {
    criteria: "UT",
    description: "Unavoidable Terminations (i.e., retirements or long-term illness)",
  },
  {
    criteria: "BT",
    description:
      "Beneficial Terminations (i.e., sometimes those staff that do leave provide benefit to the company by virtue of leaving, for example under performers)",
  },
  {
    criteria: "AE",
    description: "The average number of employees working for the company during the Selection period",
  },
];

interface RetentionResponse {
  S: number;
  UT: number;
  BT: number;
  AE: number;
  retentionRate: number | null;
}

// Convert PeriodFilterValue → inclusive [from, to] ISO date strings.
function periodToRange(p: PeriodFilterValue | undefined): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  if (!p) {
    const y = today.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (p.mode === "year" && p.year) {
    return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  }
  if (p.mode === "year-quarter" && p.year && p.quarter) {
    const startMonth = (p.quarter - 1) * 3; // 0,3,6,9
    const start = new Date(p.year, startMonth, 1);
    const end = new Date(p.year, startMonth + 3, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (p.mode === "year-month" && p.year && p.month) {
    const start = new Date(p.year, p.month - 1, 1);
    const end = new Date(p.year, p.month, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (p.mode === "date-range" && p.dateFrom && p.dateTo) {
    return { from: fmt(p.dateFrom), to: fmt(p.dateTo) };
  }
  const y = today.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

// Read deep-link params from the URL search string, if present. Returns null
// when none of the consumable keys are present so the normal default flow runs.
function readDeepLinkParams(): {
  periodFrom?: string;
  periodTo?: string;
  rankIds: string[];
  poolIds: string[];
  agentIds: string[];
} | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const has =
    sp.has("periodFrom") ||
    sp.has("periodTo") ||
    sp.has("rankIds") ||
    sp.has("poolIds") ||
    sp.has("agentIds");
  if (!has) return null;
  return {
    periodFrom: sp.get("periodFrom") || undefined,
    periodTo: sp.get("periodTo") || undefined,
    rankIds: sp.getAll("rankIds"),
    poolIds: sp.getAll("poolIds"),
    agentIds: sp.getAll("agentIds"),
  };
}

function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export const Retention = (): JSX.Element => {
  // Capture deep-link params once on mount so reactively-set state below
  // can pre-populate the filters before the page first renders. We also
  // strip the URL params via `replaceState` so the page URL stays clean
  // and a manual refresh shows the user the normal page.
  const initialDeepLink = useMemo(() => readDeepLinkParams(), []);

  const [periodValue, setPeriodValue] = useState<PeriodFilterValue>(() => {
    const yearOnly: PeriodFilterValue = { mode: "year", year: new Date().getFullYear() };
    if (!initialDeepLink) return yearOnly;
    const from = parseIsoDate(initialDeepLink.periodFrom);
    const to = parseIsoDate(initialDeepLink.periodTo);
    if (from && to) {
      return { mode: "date-range", dateFrom: from, dateTo: to };
    }
    return yearOnly;
  });
  const [selectedRanks, setSelectedRanks] = useState<string[]>(
    () => initialDeepLink?.rankIds ?? [],
  );
  const [selectedPools, setSelectedPools] = useState<string[]>(
    () => initialDeepLink?.poolIds ?? [],
  );
  // Agents are seeded as raw values; the effect below upgrades them to the
  // "Name (Country)" display label once the manning agents list loads, so
  // the chip UI matches what the user would see if they picked manually.
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    () => initialDeepLink?.agentIds ?? [],
  );

  // Strip deep-link params from the URL after they've been consumed.
  useEffect(() => {
    if (!initialDeepLink || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    let changed = false;
    for (const key of ["periodFrom", "periodTo", "rankIds", "poolIds", "agentIds"]) {
      if (sp.has(key)) {
        sp.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const qs = sp.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [initialDeepLink]);

  const hasActiveFilters =
    periodValue !== undefined ||
    selectedRanks.length > 0 ||
    selectedPools.length > 0 ||
    selectedAgents.length > 0;

  const clearFilters = () => {
    setPeriodValue({ mode: "year", year: new Date().getFullYear() });
    setSelectedRanks([]);
    setSelectedPools([]);
    setSelectedAgents([]);
  };

  const { rankOptions } = useCompanyRanks();
  const { data: crewPoolsData } = useCrewPoolsV2();
  const { data: manningAgentsData } = useManningAgentsWithActiveCrewV2();

  const rankList = useMemo(() => rankOptions.map((r) => r.label), [rankOptions]);

  const poolList = useMemo(
    () =>
      ((crewPoolsData || []) as Array<{ name?: string; isDeleted?: boolean }>)
        .filter((p) => p.name && !p.isDeleted)
        .map((p) => p.name as string)
        .sort(),
    [crewPoolsData]
  );

  // Manning agents: keep `name` only as the matching key for snapshot lookup,
  // and a separate display label (with country) for the chip.
  const agentItems = useMemo(
    () =>
      ((manningAgentsData || []) as Array<{ name?: string; country?: string; isDeleted?: boolean }>)
        .filter((a) => a.name && !a.isDeleted)
        .map((a) => ({
          value: a.name as string,
          label: a.country ? `${a.name} (${a.country})` : (a.name as string),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [manningAgentsData]
  );
  const agentLabelList = useMemo(() => agentItems.map((a) => a.label), [agentItems]);
  const agentLabelToValue = useMemo(() => {
    const m = new Map<string, string>();
    agentItems.forEach((a) => m.set(a.label, a.value));
    return m;
  }, [agentItems]);
  const agentValueToLabel = useMemo(() => {
    const m = new Map<string, string>();
    agentItems.forEach((a) => m.set(a.value, a.label));
    return m;
  }, [agentItems]);

  // After the manning agents list loads, upgrade any deep-linked agent
  // values (raw names from the dashboard) to their "Name (Country)" display
  // labels so the chip UI matches what manual selection would produce.
  useEffect(() => {
    if (agentItems.length === 0) return;
    setSelectedAgents((prev) => {
      let changed = false;
      const next = prev.map((v) => {
        if (agentLabelToValue.has(v)) return v; // already a label
        const label = agentValueToLabel.get(v);
        if (label && label !== v) {
          changed = true;
          return label;
        }
        return v;
      });
      return changed ? next : prev;
    });
  }, [agentItems, agentLabelToValue, agentValueToLabel]);

  const { from: periodFrom, to: periodTo } = useMemo(() => periodToRange(periodValue), [periodValue]);

  const queryKey = useMemo(
    () => [
      "/api/v2/training-retention/retention",
      { periodFrom, periodTo, ranks: selectedRanks, pools: selectedPools, agents: selectedAgents },
    ],
    [periodFrom, periodTo, selectedRanks, selectedPools, selectedAgents]
  );

  const retentionQuery = useQuery<RetentionResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("periodFrom", periodFrom);
      params.set("periodTo", periodTo);
      selectedRanks.forEach((r) => params.append("rankIds", r));
      selectedPools.forEach((p) => params.append("poolIds", p));
      selectedAgents.forEach((labelOrValue) => {
        const v = agentLabelToValue.get(labelOrValue) ?? labelOrValue;
        params.append("agentIds", v);
      });
      const res = await fetch(`/api/v2/training-retention/retention?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load retention metrics");
      return res.json();
    },
  });

  const isLoading = retentionQuery.isLoading || retentionQuery.isFetching;
  const isError = retentionQuery.isError;
  const data = retentionQuery.data;
  const aeIsZero = !!data && data.AE === 0;

  const valueFor = (criteria: FormulaRow["criteria"]): string => {
    if (isLoading || !data) return "…";
    return String(data[criteria] ?? 0);
  };

  const headlineValue: string = (() => {
    if (isLoading) return "…";
    if (!data) return "—";
    if (data.AE === 0 || data.retentionRate === null) return "—";
    return `${data.retentionRate.toFixed(1)}%`;
  })();

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
          options={agentLabelList}
          selected={selectedAgents}
          onChange={setSelectedAgents}
          testId="filter-manning-agent"
        />
        <button
          type="button"
          disabled={false}
          onClick={clearFilters}
          className="min-h-8 rounded-md border border-input bg-background px-3 py-1 text-xs text-[#16569e] hover:bg-accent/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-[#8899ae] disabled:opacity-60"
          data-testid="button-clear-retention-filters"
        >
          Clear
        </button>
      </div>

      {/* Calculated rate headline */}
      <div className="mb-4 flex items-baseline gap-3">
        <span
          className="text-lg font-bold text-[#16569e]"
          data-testid="text-calculated-retention-label"
        >
          Calculated Retention Rate:
        </span>
        {isLoading ? (
          <Skeleton className="h-7 w-20" data-testid="skeleton-retention-headline" />
        ) : (
          <span
            className="text-2xl font-bold text-[#16569e]"
            data-testid="text-calculated-retention-value"
          >
            {headlineValue}
          </span>
        )}
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-[#16569e] hover:opacity-80"
                aria-label="About S"
                data-testid="tooltip-trigger-retention-info"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs" data-testid="tooltip-retention-info">
              S includes all terminations in the period — UT (Unavoidable) + BT
              (Beneficial) + General — for the filtered cohort.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isError && !isLoading && (
        <div
          className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]"
          data-testid="error-retention-load"
        >
          Couldn't load retention metrics. Please try again.
        </div>
      )}

      {aeIsZero && !isLoading && !isError && (
        <div
          className="mb-4 rounded-md border border-dashed border-[#e1e8ed] bg-[#f8fafc] px-4 py-3 text-sm text-[#475569]"
          data-testid="empty-retention-no-cohort"
        >
          No data for the selected filters.
        </div>
      )}

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
                  {isLoading ? (
                    <Skeleton className="ml-auto h-4 w-10" />
                  ) : (
                    valueFor(row.criteria)
                  )}
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
