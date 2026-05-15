import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgCharts } from "@/lib/agCharts";
import type { AgChartOptions, AgChartInstance } from "@/lib/agCharts";
import { candidateApi } from "@/modules/recruitment/api/candidateApi";
import { RECRUITED_STATUSES } from "@/modules/recruitment/statusBuckets";
import { CrewRecruitmentDrilldownDialog } from "./CrewRecruitmentDrilldownDialog";
import { useDrilldownParam } from "./useDrilldownParam";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface CandidateRow {
  rankAppliedFor?: string | null;
  presentRank?: string | null;
  nationalityUuid?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RankCount {
  rank: string;
  count: number;
}

interface CrewRecruitmentRankChartProps {
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

export const CrewRecruitmentRankChart = ({
  period,
  ranks = [],
  crewPools: _crewPools = [],
  manningAgents = [],
  nationalities = [],
  chartRef,
}: CrewRecruitmentRankChartProps) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const drilldown = useDrilldownParam("crew-recruitment");
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

  const { data: candidates = [], isLoading, error } = useQuery<CandidateRow[]>({
    queryKey: ["v2", "recruitment", "candidates", "rank-chart"],
    queryFn: () => candidateApi.getAll() as unknown as Promise<CandidateRow[]>,
    staleTime: 60 * 1000,
  });

  const chartData = useMemo<RankCount[]>(() => {
    if (!range) return [];
    const counts = new Map<string, number>();
    for (const c of candidates) {
      // Only count candidates whose status is in the "Recruited" bucket.
      // Without this, Draft / Applied / Waitlist / Rejected candidates would
      // also be counted as recruits on the chart.
      if (!c.status || !RECRUITED_STATUSES.has(String(c.status))) continue;

      const recruited = parseDate(c.createdAt);
      if (!recruited) continue;
      if (recruited < range.from || recruited > range.to) continue;

      const rank = (c.rankAppliedFor || c.presentRank || "").trim();
      if (!rank) continue;

      if (ranks.length > 0 && !ranks.includes(rank)) continue;
      if (
        nationalities.length > 0 &&
        !nationalities.includes((c.nationalityUuid || "") as string)
      ) {
        continue;
      }
      // manningAgent / crewPool live in related tables; with empty arrays the
      // filter is a no-op. When Task #33 supplies values, candidates lacking
      // those fields on the row should not match.
      if (manningAgents.length > 0) continue;

      counts.set(rank, (counts.get(rank) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([rank, count]) => ({ rank, count }))
      .sort((a, b) => b.count - a.count);
  }, [candidates, range, ranks, nationalities, manningAgents]);

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
          yKey: "count",
          fill: "#52baf3",
          stroke: "#3a9fd9",
          strokeWidth: 1,
          cursor: "pointer",
          tooltip: {
            renderer: ({ datum }: any) => {
              const rank = escapeHtml(String(datum?.rank ?? ""));
              const count = Number(datum?.count) || 0;
              return `<div class="ag-chart-tooltip-title" style="background-color: #52baf3; padding: 4px 8px; color: white; font-weight: bold;">${rank}</div>
               <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">${count} recruit${count !== 1 ? "s" : ""}</div>`;
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
        className="w-full h-full flex flex-col justify-end gap-2 px-2 pb-6"
        data-testid="state-loading-crew-recruitment-rank"
      >
        <div className="flex items-end gap-3 h-full">
          {[60, 80, 45, 70, 35, 55].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-sm animate-pulse"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-error-crew-recruitment-rank"
      >
        <div className="text-sm text-red-500">Failed to load recruitment data</div>
      </div>
    );
  }

  if (!range) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-no-period-crew-recruitment-rank"
      >
        <div className="text-sm text-gray-500">Please select a period</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-empty-crew-recruitment-rank"
      >
        <div className="text-sm text-gray-500">No recruits in this period</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full h-full min-h-0"
        data-testid="chart-crew-recruitment-rank"
      >
        {isMounted && (
          <AgCharts
            ref={chartRef}
            options={chartOptions}
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
      <CrewRecruitmentDrilldownDialog
        open={showDrillDown}
        onOpenChange={handleDrillDownChange}
        rank={selectedRank}
        period={period}
        ranks={ranks}
        crewPools={_crewPools}
        manningAgents={manningAgents}
        nationalities={nationalities}
      />
    </>
  );
};
