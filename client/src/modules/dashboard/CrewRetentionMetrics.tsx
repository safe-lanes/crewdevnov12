import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApiV2 } from "@/modules/admin/api/adminApiV2";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { useDrilldownParam } from "./useDrilldownParam";
import { CrewRetentionDrilldownDialog } from "./CrewRetentionDrilldownDialog";
import { useNationalitiesV2 } from "@/hooks/v2/useMasterDataV2";
import { COMPANY_KPI_REFERENCE, dashboardRange, kpiStatus, kpiYearForRange, rangeLabel, retentionComparisonPeriod, rollingRetentionRange } from "./kpiComparison";
import { KpiDisplay } from "./KpiDisplay";
import { useDashboardKpis, useDashboardToday } from "./useDashboardKpis";

interface CrewRetentionMetricsProps {
  period: PeriodFilterValue;
  ranks?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
  periodExplicitlySelected: boolean;
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

async function fetchRetention(params: {
  from: string;
  to: string;
  rankIds: string[];
  poolIds: string[];
  agentIds: string[];
  nationalityIds: string[];
}): Promise<RetentionResponse> {
  const qp = new URLSearchParams();
  qp.set("periodFrom", params.from);
  qp.set("periodTo", params.to);
  params.rankIds.forEach((r) => qp.append("rankIds", r));
  params.poolIds.forEach((p) => qp.append("poolIds", p));
  params.agentIds.forEach((a) => qp.append("agentIds", a));
  params.nationalityIds.forEach((nat) => qp.append("nationalityIds", nat));
  const res = await fetch(`/api/v2/training-retention/retention?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to load retention metrics");
  return res.json();
}

export const CrewRetentionMetrics = ({
  period,
  ranks = [],
  crewPools = [],
  manningAgents = [],
  nationalities = [],
  periodExplicitlySelected,
}: CrewRetentionMetricsProps) => {
  const today = useDashboardToday();
  const range = useMemo(
    () => periodExplicitlySelected ? dashboardRange(period) : rollingRetentionRange(today),
    [period, periodExplicitlySelected, today],
  );
  const kpiYear = kpiYearForRange(range);
  const kpisQuery = useDashboardKpis(kpiYear);
  const retentionKpi = kpisQuery.isError ? undefined : kpisQuery.data?.kpis.find((kpi) => kpi.code === "retention");
  const comparisonPeriod = retentionComparisonPeriod(range, periodExplicitlySelected);
  const filtered = ranks.length > 0 || crewPools.length > 0 || manningAgents.length > 0 || nationalities.length > 0;
  const effectivePeriod: PeriodFilterValue = range
    ? { mode: "date-range", dateFrom: new Date(`${range.from}T00:00:00`), dateTo: new Date(`${range.to}T00:00:00`) }
    : period;
  const periodDescription = range
    ? `${!periodExplicitlySelected ? "Rolling 2 years: " : ""}${rangeLabel(range)}`
    : "Period not available";
  const hasAnyTarget = retentionKpi?.components.some((component) => component.value != null) ?? false;

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

  const { data: nationalityList = [] } = useNationalitiesV2();
  const nationalityIds = useMemo(() => {
    if (nationalities.length === 0) return [] as string[];
    const nameToUuid = new Map<string, string>();
    (nationalityList as any[]).forEach((n) => {
      const uuid = n.nationalityUuid || n.uuid || n.id;
      const name = n?.nationality || n?.name;
      if (uuid && name) nameToUuid.set(String(name), String(uuid));
    });
    return nationalities
      .map((name) => nameToUuid.get(name))
      .filter((v): v is string => !!v);
  }, [nationalities, nationalityList]);

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
          nationalityIds,
        ],
        queryFn: () =>
          fetchRetention({
            from: range!.from,
            to: range!.to,
            rankIds,
            poolIds: crewPools,
            agentIds: manningAgents,
            nationalityIds,
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
    const componentCode = key === "senior" ? "senior_officers" : key === "officer" ? "officers" : "ratings";
    const target = retentionKpi?.components.find(c => c.code === componentCode)?.value;
    const status = kpiStatus(q.data.retentionRate, target, retentionKpi?.direction, comparisonPeriod, filtered);
    const tone = status.tone === "met" ? "text-emerald-600" : status.tone === "missed" ? "text-red-600" : "text-gray-900 dark:text-white";
    return (
      <div className="flex flex-col items-center">
        <div>
          <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${tone}`} data-testid={testId}>{q.data.retentionRate.toFixed(1)}%</span>
        </div>
      </div>
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

  const tiles = CATEGORIES.map((cat, i) => {
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
        title={cat.key === "officer" ? "Measures all officers, including senior officers, following TMSA 3.4." : undefined}
        aria-describedby={cat.key === "officer" ? "retention-officers-explanation" : undefined}
        data-testid={`tile-retention-${cat.key}`}
      >
        <div
          className="text-sm text-gray-500 dark:text-gray-400"
          data-testid={`label-retention-${cat.key}`}
        >
          {cat.label}
        </div>
        {renderValue(i)}
        <KpiDisplay
          kpi={retentionKpi}
          componentCode={cat.key === "senior" ? "senior_officers" : cat.key === "officer" ? "officers" : "ratings"}
          actual={tileIsInteractive(i) ? queries[i].data!.retentionRate : null}
          comparisonPeriod={comparisonPeriod}
          forecastYear={!periodExplicitlySelected ? kpiYear ?? undefined : undefined}
          filtered={filtered}
          testId={`retention-${cat.key}`}
        />
      </button>
    );
  });
  const topTiles = CATEGORIES
    .map((c, i) => (c.key !== "rating" ? tiles[i] : null))
    .filter(Boolean);
  const bottomTiles = CATEGORIES
    .map((c, i) => (c.key === "rating" ? tiles[i] : null))
    .filter(Boolean);

  return (
    <>
      <div
        className="w-full h-full flex flex-col gap-2 px-4 py-3"
        data-testid="metrics-crew-retention"
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 pb-2 text-xs">
          <span className="font-medium text-slate-600">{periodDescription}</span>
          {hasAnyTarget && (
            <span className="text-slate-500">
              {comparisonPeriod === "reference" ? `Annual KPI reference (${kpiYear})` : `KPI (${kpiYear})`}
            </span>
          )}
        </div>
        {filtered && <div className="text-[11px] leading-4 text-slate-500">{COMPANY_KPI_REFERENCE}</div>}
        {kpisQuery.isError && (
          <div className="flex items-center gap-2 text-xs text-red-700" role="alert" data-testid="error-dashboard-kpis-retention">
            <span>Failed to load KPI comparison.</span>
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => kpisQuery.refetch()}>
              Retry
            </button>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">{topTiles}</div>
        <div className="flex items-start justify-center">{bottomTiles}</div>
      </div>
      <span id="retention-officers-explanation" className="sr-only">
        Measures all officers, including senior officers, following TMSA 3.4.
      </span>
      <CrewRetentionDrilldownDialog
        open={showDrillDown}
        onOpenChange={handleDrillDownChange}
        category={selectedCategory}
        categoryLabel={
          CATEGORIES.find((c) => c.key === selectedCategory)?.label ?? ""
        }
        period={effectivePeriod}
        range={range}
        rankIds={selectedCategory ? buckets[selectedCategory] : []}
        poolIds={crewPools}
        agentIds={manningAgents}
        nationalityIds={nationalityIds}
      />
    </>
  );
};
