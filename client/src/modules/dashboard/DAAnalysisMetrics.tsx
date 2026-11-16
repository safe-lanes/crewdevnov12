import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useNationalitiesV2 } from "@/hooks/v2/useMasterDataV2";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { useDrilldownParam } from "./useDrilldownParam";
import { COMPANY_KPI_REFERENCE, daComparisonPeriod, dashboardRange, kpiStatus, kpiYearForRange, rangeLabel } from "./kpiComparison";
import { KpiDisplay } from "./KpiDisplay";
import { useDashboardKpis, useDashboardToday } from "./useDashboardKpis";
import {
  DAViolationsDrilldownDialog,
  type DAViolationType,
} from "./DAViolationsDrilldownDialog";

interface DAAnalysisMetricsProps {
  period: PeriodFilterValue;
  ranks?: string[];
  vessels?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
}

interface ViolationCounts {
  alcoholViolations: number;
  drugViolations: number;
}

const TILES: { key: DAViolationType; label: string; field: keyof ViolationCounts }[] = [
  { key: "alcohol", label: "Alcohol Violations", field: "alcoholViolations" },
  { key: "drug", label: "Drug Violations", field: "drugViolations" },
];

async function fetchViolationCounts(params: {
  from: string;
  to: string;
  vessels: string[];
  ranks: string[];
  pools: string[];
  agents: string[];
  nationalityIds: string[];
}): Promise<ViolationCounts> {
  const qp = new URLSearchParams();
  qp.set("periodFrom", params.from);
  qp.set("periodTo", params.to);
  params.vessels.forEach((v) => qp.append("vesselIds", v));
  params.ranks.forEach((r) => qp.append("rankIds", r));
  params.pools.forEach((p) => qp.append("poolIds", p));
  params.agents.forEach((a) => qp.append("agentIds", a));
  params.nationalityIds.forEach((n) => qp.append("nationalityIds", n));
  const res = await fetch(`/api/v2/drugs-alcohol/stats/violations?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to load D&A violation counts");
  return res.json();
}

export const DAAnalysisMetrics = ({
  period,
  ranks = [],
  vessels = [],
  crewPools = [],
  manningAgents = [],
  nationalities = [],
}: DAAnalysisMetricsProps) => {
  const today = useDashboardToday();
  const range = useMemo(() => dashboardRange(period), [period]);
  const kpiYear = kpiYearForRange(range);
  const kpisQuery = useDashboardKpis(kpiYear);
  const alcoholKpi = kpisQuery.isError ? undefined : kpisQuery.data?.kpis.find((kpi) => kpi.code === "alcohol_violations");
  const drugKpi = kpisQuery.isError ? undefined : kpisQuery.data?.kpis.find((kpi) => kpi.code === "drug_violations");
  const comparisonPeriod = daComparisonPeriod(range, today);
  const filtered = ranks.length > 0 || crewPools.length > 0 || manningAgents.length > 0 || nationalities.length > 0;
  const hasAnyTarget = [alcoholKpi, drugKpi].some((kpi) => kpi?.components.some((component) => component.value != null));

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

  // URL-driven drill-down. The violation type (alcohol/drug) is stored in the
  // existing `rank` slot of the drill-down state — semantically it's just an
  // opaque discriminator so we don't need to widen the hook.
  const drilldown = useDrilldownParam("da-violations");
  const selectedType = (drilldown.state.rank as DAViolationType | null) ?? null;
  const showDrilldown =
    drilldown.isOpen &&
    !!selectedType &&
    TILES.some((t) => t.key === selectedType);

  const query = useQuery<ViolationCounts>({
    queryKey: [
      "/api/v2/drugs-alcohol/stats/violations",
      range?.from ?? null,
      range?.to ?? null,
      vessels,
      ranks,
      crewPools,
      manningAgents,
      nationalityIds,
    ],
    queryFn: () =>
      fetchViolationCounts({
        from: range!.from,
        to: range!.to,
        vessels,
        ranks,
        pools: crewPools,
        agents: manningAgents,
        nationalityIds,
      }),
    enabled: !!range,
    staleTime: 60 * 1000,
  });

  const tileIsInteractive = (field: keyof ViolationCounts): boolean => {
    if (!range) return false;
    if (query.isLoading || query.isFetching) return false;
    if (query.isError || !query.data) return false;
    return query.data[field] > 0;
  };

  const handleTileClick = (key: DAViolationType, field: keyof ViolationCounts) => {
    if (!tileIsInteractive(field)) return;
    drilldown.open({ rank: key });
  };

  const handleDrilldownChange = (open: boolean) => {
    if (!open) drilldown.close();
  };

  const labelClass = "text-sm text-gray-500 dark:text-gray-400";
  const valueClass =
    "text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tabular-nums";
  const naClass =
    "text-4xl sm:text-5xl font-bold text-gray-400 tabular-nums";

  const renderValue = (field: keyof ViolationCounts, key: DAViolationType) => {
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
    const kpi = key === "alcohol" ? alcoholKpi : drugKpi;
    const target = kpi?.components.find(c => c.code === "overall")?.value;
    const status = kpiStatus(query.data[field], target, kpi?.direction, comparisonPeriod, filtered);
    const tone = status.tone === "met" ? "text-emerald-600" : status.tone === "missed" ? "text-red-600" : "text-gray-900 dark:text-white";
    return (
      <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${tone}`} data-testid={testId}>
        {query.data[field]}
      </span>
    );
  };

  return (
    <>
      <div
        className="w-full h-full flex flex-col gap-2 px-4 pt-3"
        data-testid="metrics-da-analysis"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 pb-2 text-xs">
          <span className="font-medium text-slate-600">{rangeLabel(range)}</span>
          {hasAnyTarget && (
            <span className="text-slate-500">
              {comparisonPeriod === "reference" ? `Annual KPI reference (${kpiYear})` : `KPI (${kpiYear})`}
            </span>
          )}
        </div>
        {filtered && <div className="text-[11px] leading-4 text-slate-500">{COMPANY_KPI_REFERENCE}</div>}
        {kpisQuery.isError && (
          <div className="flex items-center gap-2 text-xs text-red-700" role="alert" data-testid="error-dashboard-kpis-da">
            <span>Failed to load KPI comparison.</span>
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => kpisQuery.refetch()}>
              Retry
            </button>
          </div>
        )}
        <div className="grid flex-1 grid-cols-2 gap-4">
          {TILES.map(({ key, label, field }) => {
            const interactive = tileIsInteractive(field);
            const actual = range && !query.isLoading && !query.isFetching && !query.isError && query.data
              ? query.data[field]
              : null;
            return (
              <button
                type="button"
                key={key}
                onClick={() => handleTileClick(key, field)}
                disabled={!interactive}
                className={`flex flex-col items-center justify-center gap-2 rounded-md p-2 text-center transition-colors ${
                  interactive
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#52baf3]"
                    : "cursor-default"
                }`}
                data-testid={`tile-da-${key}-violations`}
              >
                <div className={labelClass} data-testid={`label-da-${key}-violations`}>
                  {label}
                </div>
                {renderValue(field, key)}
                <KpiDisplay
                  kpi={key === "alcohol" ? alcoholKpi : drugKpi}
                  componentCode="overall"
                  actual={actual}
                  comparisonPeriod={comparisonPeriod}
                  filtered={filtered}
                  unavailable={!range || query.isLoading || query.isFetching || query.isError}
                  testId={`da-${key}`}
                />
              </button>
            );
          })}
        </div>
      </div>
      <DAViolationsDrilldownDialog
        open={showDrilldown}
        onOpenChange={handleDrilldownChange}
        type={selectedType}
        period={period}
        range={range}
        vessels={vessels}
        ranks={ranks}
        crewPools={crewPools}
        manningAgents={manningAgents}
        nationalityIds={nationalityIds}
      />
    </>
  );
};
