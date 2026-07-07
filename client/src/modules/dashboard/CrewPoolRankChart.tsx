import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgCharts } from "@/lib/agCharts";
import type { AgChartOptions, AgChartInstance } from "@/lib/agCharts";
import { CrewPoolDrilldownDialog } from "./CrewPoolDrilldownDialog";
import { useDrilldownParam } from "./useDrilldownParam";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface CrewRow {
  crewUuid?: string | null;
  empNo?: string | null;
  recruitmentDate?: string | null;
  presentRank?: string | null;
  status?: string | null;
  notForHire?: boolean | null;
  lastTerminationDate?: string | null;
  createdAt?: string | Date | null;
  nationalityUuid?: string | null;
  nationality?: string | null;
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

function periodToFromDate(period: PeriodFilterValue): Date | null {
  if (period.mode === "year" && period.year) {
    return new Date(period.year, 0, 1);
  }
  if (period.mode === "year-quarter" && period.year && period.quarter) {
    return new Date(period.year, (period.quarter - 1) * 3, 1);
  }
  if (period.mode === "year-month" && period.year && period.month) {
    return new Date(period.year, period.month - 1, 1);
  }
  if (period.mode === "date-range" && period.dateFrom) {
    return period.dateFrom;
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

  const empNos = useMemo(
    () =>
      Array.from(
        new Set(crew.map((c) => c.empNo).filter((x): x is string => !!x)),
      ),
    [crew],
  );

  const snapshotIso = useMemo(() => {
    if (!snapshotDate) return null;
    const y = snapshotDate.getFullYear();
    const m = String(snapshotDate.getMonth() + 1).padStart(2, "0");
    const d = String(snapshotDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [snapshotDate]);

  const { data: rankAsOf = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/v2/crew-pool/dashboard/ranks-as-of", snapshotIso, empNos],
    queryFn: async ({ signal }) => {
      if (!snapshotIso || empNos.length === 0) return {};
      const response = await fetch("/api/v2/crew-pool/dashboard/ranks-as-of", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: snapshotIso, empNos }),
        signal,
      });
      if (!response.ok) throw new Error("Failed to resolve ranks as of date");
      const json = await response.json();
      return (json?.data ?? {}) as Record<string, string>;
    },
    enabled: !!snapshotIso && empNos.length > 0,
    staleTime: 60 * 1000,
  });

  const chartData = useMemo<RankCount[]>(() => {
    if (!snapshotDate) return [];

    // If the selected period STARTS in the future, there is no pool data yet.
    const fromDate = periodToFromDate(period);
    if (fromDate && fromDate.getTime() > Date.now()) return [];

    const counts = new Map<string, number>();
    for (const c of crew) {
      // Strict: must have a recruitment date on/before the snapshot.
      const recruited = parseDate(c.recruitmentDate);
      if (!recruited) continue;
      if (recruited.getTime() > snapshotDate.getTime()) continue;

      // Excluded only if terminated on/before the snapshot.
      const terminated = parseDate(c.lastTerminationDate);
      if (terminated && terminated.getTime() <= snapshotDate.getTime()) continue;

      // Rank held as of the snapshot (promotion-ledger aware), else present rank.
      const rank = (
        (c.empNo ? rankAsOf[c.empNo] : undefined) ?? c.presentRank ?? ""
      ).trim();
      if (!rank) continue;

      if (ranks.length > 0 && !ranks.includes(rank)) continue;
      if (
        nationalities.length > 0 &&
        !nationalities.includes((c.nationality || "") as string)
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
  }, [crew, snapshotDate, period, rankAsOf, ranks, nationalities, manningAgents, crewPools, vessels]);

  const chartOptions = useMemo<AgChartOptions>(
    () => ({
      data: chartData,
      background: { fill: "#ffffff" },
      padding: { top: 10, right: 10, bottom: 50, left: 40 },
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
          label: { fontSize: 11, color: "#4b5563", rotation: -30, autoRotate: false, avoidCollisions: false },
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
