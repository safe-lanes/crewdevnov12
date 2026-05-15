import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgCharts } from "@/lib/agCharts";
import type { AgChartOptions, AgChartInstance } from "@/lib/agCharts";
import { appraisalsApiV2 } from "@/modules/crewing/api/appraisalsApiV2";
import { CrewAppraisalsDrilldownDialog } from "./CrewAppraisalsDrilldownDialog";
import { useDrilldownParam } from "./useDrilldownParam";
import { extractRank } from "./appraisalRank";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface AppraisalRow {
  id?: number;
  appraisalUuid?: string | null;
  seafarersName?: string | null;
  seafarersRank?: string | null;
  vessel?: string | null;
  appraisalType?: string | null;
  overallRating?: string | number | null;
  appraisalDate?: string | null;
  appraisalData?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RankAvg {
  rank: string;
  avgRating: number;
  count: number;
}

interface CrewAppraisalsRankChartProps {
  period: PeriodFilterValue;
  ranks?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
  chartRef: React.MutableRefObject<AgChartInstance | null>;
}

function periodToRange(period: PeriodFilterValue): { from: Date; to: Date } | null {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (period.mode === "year" && period.year) {
    return {
      from: new Date(period.year, 0, 1, 0, 0, 0, 0),
      to: new Date(period.year, 11, 31, 23, 59, 59, 999),
    };
  }
  if (period.mode === "year-quarter" && period.year && period.quarter) {
    const startMonth = (period.quarter - 1) * 3;
    return {
      from: new Date(period.year, startMonth, 1, 0, 0, 0, 0),
      to: new Date(period.year, startMonth + 3, 0, 23, 59, 59, 999),
    };
  }
  if (period.mode === "year-month" && period.year && period.month) {
    return {
      from: new Date(period.year, period.month - 1, 1, 0, 0, 0, 0),
      to: new Date(period.year, period.month, 0, 23, 59, 59, 999),
    };
  }
  if (period.mode === "date-range" && period.dateFrom && period.dateTo) {
    return { from: startOfDay(period.dateFrom), to: endOfDay(period.dateTo) };
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
}

function parseRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}

export const CrewAppraisalsRankChart = ({
  period,
  ranks: _ranks = [],
  crewPools: _crewPools = [],
  manningAgents: _manningAgents = [],
  nationalities: _nationalities = [],
  chartRef,
}: CrewAppraisalsRankChartProps) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const drilldown = useDrilldownParam("crew-appraisals");
  const showDrillDown = drilldown.isOpen;
  const selectedRank = drilldown.state.rank;

  const handleBarClick = useCallback(
    (rank: string) => {
      drilldown.open({ rank });
    },
    [drilldown],
  );

  const handleDrillDownChange = useCallback(
    (open: boolean) => {
      if (!open) drilldown.close();
    },
    [drilldown],
  );

  const range = useMemo(() => periodToRange(period), [period]);

  const { data: appraisals = [], isLoading, error } = useQuery<AppraisalRow[]>({
    queryKey: ["v2", "appraisals", "rank-chart"],
    queryFn: () => appraisalsApiV2.getAll() as unknown as Promise<AppraisalRow[]>,
    staleTime: 60 * 1000,
  });

  const chartData = useMemo<RankAvg[]>(() => {
    if (!range) return [];
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const a of appraisals) {
      const date = parseDate(a.appraisalDate);
      if (!date) continue;
      if (date < range.from || date > range.to) continue;

      const rank = extractRank(a);
      if (!rank) continue;

      const rating = parseRating(a.overallRating);
      if (rating === null) continue;

      const cur = buckets.get(rank) || { sum: 0, count: 0 };
      cur.sum += rating;
      cur.count += 1;
      buckets.set(rank, cur);
    }
    return Array.from(buckets.entries())
      .map(([rank, { sum, count }]) => ({
        rank,
        avgRating: Math.round((sum / count) * 100) / 100,
        count,
      }))
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [appraisals, range]);

  const chartOptions = useMemo<AgChartOptions>(
    () => ({
      data: chartData,
      background: { fill: "#ffffff" },
      padding: { top: 10, right: 10, bottom: 30, left: 40 },
      listeners: {
        seriesNodeClick: (event: any) => {
          try {
            if (event?.datum?.rank) {
              handleBarClick(String(event.datum.rank));
            }
          } catch (err) {
            console.error("Error handling chart click:", err);
          }
        },
      } as any,
      series: [
        {
          type: "bar" as any,
          xKey: "rank",
          yKey: "avgRating",
          fill: "#52baf3",
          stroke: "#3a9fd9",
          strokeWidth: 1,
          cursor: "pointer",
          tooltip: {
            renderer: ({ datum }: any) => {
              const rank = escapeHtml(String(datum?.rank ?? ""));
              const avg = Number(datum?.avgRating) || 0;
              const count = Number(datum?.count) || 0;
              return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">${rank}</div>
               <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">Avg rating: ${avg.toFixed(2)}<br/>${count} appraisal${count !== 1 ? "s" : ""}</div>`;
            },
          },
        } as any,
      ],
      axes: [
        {
          type: "category" as any,
          position: "bottom",
          label: { fontSize: 11, color: "#4b5563", rotation: 0 },
          paddingInner: 0.2,
          paddingOuter: 0.3,
        },
        {
          type: "number" as any,
          position: "left",
          label: { fontSize: 11, color: "#4b5563" },
          min: 0,
        },
      ],
    }),
    [chartData, handleBarClick],
  );

  if (isLoading) {
    return (
      <div
        className="w-full h-full flex items-end justify-around px-6 pb-8 pt-6 gap-3"
        data-testid="state-loading-crew-appraisals-rank"
      >
        {[60, 80, 45, 70, 35, 55].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t animate-pulse"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-error-crew-appraisals-rank"
      >
        <div className="text-sm text-red-500">Failed to load appraisal data</div>
      </div>
    );
  }

  if (!range) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-no-period-crew-appraisals-rank"
      >
        <div className="text-sm text-gray-500">Please select a period</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-empty-crew-appraisals-rank"
      >
        <div className="text-sm text-gray-500">No appraisals in this period</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full h-full min-h-0"
        data-testid="chart-crew-appraisals-rank"
      >
        {isMounted && (
          <AgCharts
            ref={chartRef}
            options={chartOptions}
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
      <CrewAppraisalsDrilldownDialog
        open={showDrillDown}
        onOpenChange={handleDrillDownChange}
        rank={selectedRank}
        period={period}
        ranks={_ranks}
        crewPools={_crewPools}
        manningAgents={_manningAgents}
        nationalities={_nationalities}
      />
    </>
  );
};
