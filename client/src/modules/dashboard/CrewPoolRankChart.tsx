import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgCharts } from "@/lib/agCharts";
import type { AgChartOptions, AgChartInstance } from "@/lib/agCharts";
import { CrewPoolDrilldownDialog } from "./CrewPoolDrilldownDialog";
import { useDrilldownParam } from "./useDrilldownParam";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface CrewRow {
  crewUuid?: string | null;
  presentRank?: string | null;
  status?: string | null;
  notForHire?: boolean | null;
  lastTerminationDate?: string | null;
  createdAt?: string | Date | null;
  nationalityUuid?: string | null;
  manningAgentName?: string | null;
  crewPool?: string | null;
  presentVessel?: string | null;
}

interface CrewListResponse {
  data: CrewRow[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    pages?: number;
  };
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

interface CrewPoolRankChartProps {
  period: PeriodFilterValue;
  ranks?: string[];
  vessels?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
  chartRef: React.MutableRefObject<AgChartInstance | null>;
}

function periodToSnapshotDate(period: PeriodFilterValue): Date | null {
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (period.mode === "year" && period.year) {
    return new Date(period.year, 11, 31, 23, 59, 59, 999);
  }
  if (period.mode === "year-quarter" && period.year && period.quarter) {
    const startMonth = (period.quarter - 1) * 3;
    return new Date(period.year, startMonth + 3, 0, 23, 59, 59, 999);
  }
  if (period.mode === "year-month" && period.year && period.month) {
    return new Date(period.year, period.month, 0, 23, 59, 59, 999);
  }
  if (period.mode === "date-range" && period.dateTo) {
    return endOfDay(period.dateTo);
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

export const CrewPoolRankChart = ({
  period,
  ranks = [],
  vessels = [],
  crewPools = [],
  manningAgents = [],
  nationalities = [],
  chartRef,
}: CrewPoolRankChartProps) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const drilldown = useDrilldownParam("crew-pool");
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

  const snapshotDate = useMemo(() => periodToSnapshotDate(period), [period]);

  const { data: crew = [], isLoading, error } = useQuery<CrewRow[]>({
    queryKey: ["/api/v2/crew-pool/crew/details", { view: "all", all: true }],
    queryFn: async ({ signal }) => {
      const PAGE_SIZE = 1000;
      const all: CrewRow[] = [];
      let offset = 0;
      // Fetch all pages so the snapshot is correct for tenants > 1000 crew.
      // The endpoint caps limit at 1000 server-side.
      // Hard ceiling on total iterations to avoid runaway loops.
      for (let i = 0; i < 100; i++) {
        const response = await fetch(
          `/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}`,
          { signal },
        );
        if (!response.ok) throw new Error("Failed to fetch crew list");
        const json: CrewListResponse = await response.json();
        const page = json.data ?? [];
        all.push(...page);
        const total = json.pagination?.total ?? all.length;
        offset += PAGE_SIZE;
        if (page.length < PAGE_SIZE || all.length >= total) break;
      }
      return all;
    },
    staleTime: 60 * 1000,
  });

  const chartData = useMemo<RankCount[]>(() => {
    if (!snapshotDate) return [];
    const counts = new Map<string, number>();
    for (const c of crew) {
      // Existed on snapshot date
      const created = parseDate(c.createdAt);
      if (!created) continue;
      if (created.getTime() > snapshotDate.getTime()) continue;

      // Not terminated / not‑for‑rehire as of snapshot date.
      // First pass: apply current status retroactively (per task #38 scope).
      if (c.notForHire === true) continue;
      const statusLower = (c.status || "").toLowerCase();
      if (statusLower === "terminated") {
        // If we have a termination date and it's after the snapshot, the
        // crew was still in the pool on that date.
        const termDate = parseDate(c.lastTerminationDate);
        if (!termDate || termDate.getTime() <= snapshotDate.getTime()) continue;
      }

      const rank = (c.presentRank || "").trim();
      if (!rank) continue;

      if (ranks.length > 0 && !ranks.includes(rank)) continue;
      if (
        nationalities.length > 0 &&
        !nationalities.includes((c.nationalityUuid || "") as string)
      ) {
        continue;
      }
      if (manningAgents.length > 0) {
        const agent = (c.manningAgentName || "").trim();
        if (!agent || !manningAgents.includes(agent)) continue;
      }
      if (crewPools.length > 0) {
        const pool = (c.crewPool || "").trim();
        if (!pool || !crewPools.includes(pool)) continue;
      }
      if (vessels.length > 0) {
        const vessel = (c.presentVessel || "").trim();
        if (!vessel || !vessels.includes(vessel)) continue;
      }

      counts.set(rank, (counts.get(rank) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([rank, count]) => ({ rank, count }))
      .sort((a, b) => b.count - a.count);
  }, [crew, snapshotDate, ranks, nationalities, manningAgents, crewPools, vessels]);

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
               <div class="ag-chart-tooltip-content" style="padding: 4px 8px;">${count} crew member${count !== 1 ? "s" : ""}</div>`;
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
        data-testid="state-loading-crew-pool-rank"
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
        data-testid="state-error-crew-pool-rank"
      >
        <div className="text-sm text-red-500">Failed to load crew pool data</div>
      </div>
    );
  }

  if (!snapshotDate) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-no-period-crew-pool-rank"
      >
        <div className="text-sm text-gray-500">Please select a period</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-empty-crew-pool-rank"
      >
        <div className="text-sm text-gray-500">No crew in pool on this date</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full h-full min-h-0"
        data-testid="chart-crew-pool-rank"
      >
        {isMounted && (
          <AgCharts
            ref={chartRef}
            options={chartOptions}
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
      <CrewPoolDrilldownDialog
        open={showDrillDown}
        onOpenChange={handleDrillDownChange}
        rank={selectedRank}
        period={period}
        ranks={ranks}
        vessels={vessels}
        crewPools={crewPools}
        manningAgents={manningAgents}
        nationalities={nationalities}
      />
    </>
  );
};
