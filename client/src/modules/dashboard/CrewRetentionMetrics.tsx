import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApiV2 } from "@/modules/admin/api/adminApiV2";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { useDrilldownParam } from "./useDrilldownParam";
import { CrewRetentionDrilldownDialog } from "./CrewRetentionDrilldownDialog";

interface CrewRetentionMetricsProps {
  period: PeriodFilterValue;
  ranks?: string[];
  crewPools?: string[];
  manningAgents?: string[];
}

type Category = "senior" | "officer" | "rating";

interface CompanyRankRow {
  rank?: string | null;
  officer?: boolean | null;
  rating?: boolean | null;
  seniorOfficer?: boolean | null;
}

interface RetentionResponse {
  S: number;
  UT: number;
  BT: number;
  AE: number;
  retentionRate: number | null;
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "senior", label: "Senior Officers" },
  { key: "officer", label: "Officers" },
  { key: "rating", label: "Ratings" },
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

async function fetchRetention(params: {
  from: string;
  to: string;
  rankIds: string[];
  poolIds: string[];
  agentIds: string[];
}): Promise<RetentionResponse> {
  const qp = new URLSearchParams();
  qp.set("periodFrom", params.from);
  qp.set("periodTo", params.to);
  params.rankIds.forEach((r) => qp.append("rankIds", r));
  params.poolIds.forEach((p) => qp.append("poolIds", p));
  params.agentIds.forEach((a) => qp.append("agentIds", a));
  const res = await fetch(`/api/v2/training-retention/retention?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to load retention metrics");
  return res.json();
}

export const CrewRetentionMetrics = ({
  period,
  ranks = [],
  crewPools = [],
  manningAgents = [],
}: CrewRetentionMetricsProps) => {
  const range = useMemo(() => periodToRange(period), [period]);

  // URL-driven drill-down. The category key (senior/officer/rating) is
  // stored in the existing `rank` slot of the drill-down state — semantically
  // it's just an opaque discriminator so we don't need to widen the hook.
  const drilldown = useDrilldownParam("crew-retention");
  const selectedCategory = (drilldown.state.rank as Category | null) ?? null;
  const showDrillDown =
    drilldown.isOpen &&
    !!selectedCategory &&
    CATEGORIES.some((c) => c.key === selectedCategory);

  const { data: companyRanks = [], isLoading: ranksLoading, error: ranksError } =
    useQuery<CompanyRankRow[]>({
      queryKey: ["/api/v2/admin", "company-ranks"],
      queryFn: () => adminApiV2.getCompanyRanks(),
      staleTime: 5 * 60 * 1000,
    });

  const buckets = useMemo(() => {
    const senior = new Set<string>();
    const officer = new Set<string>();
    const rating = new Set<string>();
    for (const r of companyRanks) {
      const name = (r.rank || "").trim();
      if (!name) continue;
      if (r.seniorOfficer) senior.add(name);
      if (r.officer) officer.add(name);
      if (r.rating) rating.add(name);
    }
    const apply = (set: Set<string>): string[] => {
      const all = Array.from(set);
      if (ranks.length === 0) return all;
      return all.filter((n) => ranks.includes(n));
    };
    return {
      senior: apply(senior),
      officer: apply(officer),
      rating: apply(rating),
    } as Record<Category, string[]>;
  }, [companyRanks, ranks]);

  const queries = useQueries({
    queries: CATEGORIES.map(({ key }) => {
      const rankIds = buckets[key];
      const enabled = !!range && rankIds.length > 0;
      return {
        queryKey: [
          "/api/v2/training-retention/retention",
          "dashboard-crew-retention",
          key,
          range?.from ?? null,
          range?.to ?? null,
          rankIds,
          crewPools,
          manningAgents,
        ],
        queryFn: () =>
          fetchRetention({
            from: range!.from,
            to: range!.to,
            rankIds,
            poolIds: crewPools,
            agentIds: manningAgents,
          }),
        enabled,
        staleTime: 60 * 1000,
      };
    }),
  });

  const tileIsInteractive = (idx: number): boolean => {
    const { key } = CATEGORIES[idx];
    if (!range) return false;
    if (ranksLoading) return false;
    if (buckets[key].length === 0) return false;
    const q = queries[idx];
    if (q.isLoading || q.isFetching) return false;
    if (q.isError || !q.data) return false;
    if (q.data.AE === 0 || q.data.retentionRate === null) return false;
    return true;
  };

  const handleTileClick = (idx: number) => {
    if (!tileIsInteractive(idx)) return;
    drilldown.open({ rank: CATEGORIES[idx].key });
  };

  const handleDrillDownChange = (open: boolean) => {
    if (!open) drilldown.close();
  };

  const renderValue = (idx: number): JSX.Element => {
    const { key } = CATEGORIES[idx];
    const testId = `text-retention-${key}`;
    const naClass =
      "text-2xl sm:text-3xl font-bold text-gray-400 tabular-nums";
    const valueClass =
      "text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums";
    if (!range) {
      return (
        <span className={naClass} data-testid={testId}>
          N/A
        </span>
      );
    }
    if (ranksLoading) {
      return <Skeleton className="h-8 w-20" data-testid={`skeleton-retention-${key}`} />;
    }
    if (buckets[key].length === 0) {
      return (
        <span className={naClass} data-testid={testId}>
          N/A
        </span>
      );
    }
    const q = queries[idx];
    if (q.isLoading || q.isFetching) {
      return <Skeleton className="h-8 w-20" data-testid={`skeleton-retention-${key}`} />;
    }
    if (q.isError || !q.data || q.data.AE === 0 || q.data.retentionRate === null) {
      return (
        <span className={naClass} data-testid={testId}>
          N/A
        </span>
      );
    }
    return (
      <span className={valueClass} data-testid={testId}>
        {q.data.retentionRate.toFixed(1)}%
      </span>
    );
  };

  if (ranksError) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        data-testid="state-error-crew-retention"
      >
        <div className="text-sm text-red-500">Failed to load company ranks</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full h-full flex flex-col gap-6 px-6 py-6"
        data-testid="metrics-crew-retention"
      >
        <div className="flex items-start justify-between gap-4">
          {CATEGORIES.filter((c) => c.key !== "rating").map((cat) => {
            const i = CATEGORIES.findIndex((c) => c.key === cat.key);
            const interactive = tileIsInteractive(i);
            return (
              <button
                type="button"
                key={cat.key}
                onClick={() => handleTileClick(i)}
                disabled={!interactive}
                className={`flex flex-col items-center gap-2 rounded-md p-2 text-center transition-colors ${
                  interactive
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#52baf3]"
                    : "cursor-default"
                }`}
                data-testid={`tile-retention-${cat.key}`}
              >
                <div
                  className="text-sm text-gray-500 dark:text-gray-400"
                  data-testid={`label-retention-${cat.key}`}
                >
                  {cat.label}
                </div>
                {renderValue(i)}
              </button>
            );
          })}
        </div>
        <div className="flex items-start justify-center">
          {(() => {
            const i = CATEGORIES.findIndex((c) => c.key === "rating");
            const cat = CATEGORIES[i];
            const interactive = tileIsInteractive(i);
            return (
              <button
                type="button"
                key={cat.key}
                onClick={() => handleTileClick(i)}
                disabled={!interactive}
                className={`flex flex-col items-center gap-2 rounded-md p-2 text-center transition-colors ${
                  interactive
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#52baf3]"
                    : "cursor-default"
                }`}
                data-testid={`tile-retention-${cat.key}`}
              >
                <div
                  className="text-sm text-gray-500 dark:text-gray-400"
                  data-testid={`label-retention-${cat.key}`}
                >
                  {cat.label}
                </div>
                {renderValue(i)}
              </button>
            );
          })()}
        </div>
      </div>
      <CrewRetentionDrilldownDialog
        open={showDrillDown}
        onOpenChange={handleDrillDownChange}
        category={selectedCategory}
        categoryLabel={
          CATEGORIES.find((c) => c.key === selectedCategory)?.label ?? ""
        }
        period={period}
        range={range}
        rankIds={selectedCategory ? buckets[selectedCategory] : []}
        poolIds={crewPools}
        agentIds={manningAgents}
      />
    </>
  );
};
