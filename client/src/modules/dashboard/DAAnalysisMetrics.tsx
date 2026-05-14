import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface DAAnalysisMetricsProps {
  period: PeriodFilterValue;
}

interface ViolationCounts {
  alcoholViolations: number;
  drugViolations: number;
}

const TILES: { key: "alcohol" | "drug"; label: string; field: keyof ViolationCounts }[] = [
  { key: "alcohol", label: "Alcohol Violations", field: "alcoholViolations" },
  { key: "drug", label: "Drug Violations", field: "drugViolations" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function periodToRange(p: PeriodFilterValue): { from: string; to: string } | null {
  if (p.mode === "year" && p.year) {
    return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  }
  if (p.mode === "year-quarter" && p.year && p.quarter) {
    const startMonth = (p.quarter - 1) * 3;
    return {
      from: fmt(new Date(p.year, startMonth, 1)),
      to: fmt(new Date(p.year, startMonth + 3, 0)),
    };
  }
  if (p.mode === "year-month" && p.year && p.month) {
    return {
      from: fmt(new Date(p.year, p.month - 1, 1)),
      to: fmt(new Date(p.year, p.month, 0)),
    };
  }
  if (p.mode === "date-range" && p.dateFrom && p.dateTo) {
    return { from: fmt(p.dateFrom), to: fmt(p.dateTo) };
  }
  return null;
}

async function fetchViolationCounts(from: string, to: string): Promise<ViolationCounts> {
  const qp = new URLSearchParams({ periodFrom: from, periodTo: to });
  const res = await fetch(`/api/v2/drugs-alcohol/stats/violations?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to load D&A violation counts");
  return res.json();
}

export const DAAnalysisMetrics = ({ period }: DAAnalysisMetricsProps) => {
  const range = useMemo(() => periodToRange(period), [period]);

  const query = useQuery<ViolationCounts>({
    queryKey: [
      "/api/v2/drugs-alcohol/stats/violations",
      range?.from ?? null,
      range?.to ?? null,
    ],
    queryFn: () => fetchViolationCounts(range!.from, range!.to),
    enabled: !!range,
    staleTime: 60 * 1000,
  });

  const labelClass = "text-sm text-gray-500 dark:text-gray-400";
  const valueClass =
    "text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tabular-nums";
  const naClass =
    "text-4xl sm:text-5xl font-bold text-gray-400 tabular-nums";

  const renderValue = (field: keyof ViolationCounts, key: "alcohol" | "drug") => {
    const testId = `text-da-${key}-violations`;
    if (!range) {
      return (
        <span className={naClass} data-testid={testId}>
          N/A
        </span>
      );
    }
    if (query.isLoading || query.isFetching) {
      return (
        <Skeleton className="h-12 w-20" data-testid={`skeleton-da-${key}-violations`} />
      );
    }
    if (query.isError || !query.data) {
      return (
        <span
          className="text-sm text-red-500"
          data-testid={`error-da-${key}-violations`}
        >
          Failed to load
        </span>
      );
    }
    return (
      <span className={valueClass} data-testid={testId}>
        {query.data[field]}
      </span>
    );
  };

  return (
    <div
      className="w-full h-full grid grid-cols-2 gap-4 px-4 pt-6"
      data-testid="metrics-da-analysis"
    >
      {TILES.map(({ key, label, field }) => (
        <div
          key={key}
          className="flex flex-col items-center gap-2"
          data-testid={`tile-da-${key}-violations`}
        >
          <div className={labelClass} data-testid={`label-da-${key}-violations`}>
            {label}
          </div>
          {renderValue(field, key)}
        </div>
      ))}
    </div>
  );
};
