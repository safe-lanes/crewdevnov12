import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface RetentionResponse {
  S: number;
  UT: number;
  BT: number;
  AE: number;
  retentionRate: number | null;
}

interface CrewRetentionDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: "senior" | "officer" | "rating" | null;
  categoryLabel: string;
  period: PeriodFilterValue;
  range: { from: string; to: string } | null;
  rankIds: string[];
  poolIds: string[];
  agentIds: string[];
}

const FORMULA_ROWS: { criteria: keyof RetentionResponse; description: string }[] = [
  {
    criteria: "S",
    description:
      "Total Number of terminations from whatever cause (In effect this means the total number employees that have left the company for whatever reason)",
  },
  {
    criteria: "UT",
    description:
      "Unavoidable Terminations (i.e., retirements or long-term illness)",
  },
  {
    criteria: "BT",
    description:
      "Beneficial Terminations (i.e., sometimes those staff that do leave provide benefit to the company by virtue of leaving, for example under performers)",
  },
  {
    criteria: "AE",
    description:
      "The average number of employees working for the company during the Selection period",
  },
];

function formatPeriod(p: PeriodFilterValue): string {
  if (p.mode === "year" && p.year) return String(p.year);
  if (p.mode === "year-quarter" && p.year && p.quarter)
    return `Q${p.quarter} ${p.year}`;
  if (p.mode === "year-month" && p.year && p.month) {
    const date = new Date(p.year, p.month - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  }
  if (p.mode === "date-range" && p.dateFrom && p.dateTo) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    return `${fmt(p.dateFrom)} – ${fmt(p.dateTo)}`;
  }
  return "";
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

export const CrewRetentionDrilldownDialog = ({
  open,
  onOpenChange,
  category,
  categoryLabel,
  period,
  range,
  rankIds,
  poolIds,
  agentIds,
}: CrewRetentionDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  // Same query key shape as the CrewRetentionMetrics card so react-query
  // serves this from cache (no extra request) and the popup numbers always
  // equal the tile numbers.
  const enabled =
    open && !!category && !!range && rankIds.length > 0;

  const query = useQuery<RetentionResponse>({
    queryKey: [
      "/api/v2/training-retention/retention",
      "dashboard-crew-retention",
      category,
      range?.from ?? null,
      range?.to ?? null,
      rankIds,
      poolIds,
      agentIds,
    ],
    queryFn: () =>
      fetchRetention({
        from: range!.from,
        to: range!.to,
        rankIds,
        poolIds,
        agentIds,
      }),
    enabled,
    staleTime: 60 * 1000,
  });

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const title = `Crew Retention - ${categoryLabel}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const data = query.data;
  const isLoading = query.isLoading || query.isFetching;
  const isError = query.isError;
  const aeIsZero = !!data && data.AE === 0;

  const headlineValue: string = (() => {
    if (isLoading) return "…";
    if (!data) return "—";
    if (data.AE === 0 || data.retentionRate === null) return "—";
    return `${data.retentionRate.toFixed(1)}%`;
  })();

  const valueFor = (criteria: keyof RetentionResponse): string => {
    if (isLoading || !data) return "…";
    return String(data[criteria] ?? 0);
  };

  const handleViewOnRetentionPage = () => {
    if (!range) {
      setLocation("/training-retention/retention");
      return;
    }
    const qp = new URLSearchParams();
    qp.set("periodFrom", range.from);
    qp.set("periodTo", range.to);
    rankIds.forEach((r) => qp.append("rankIds", r));
    poolIds.forEach((p) => qp.append("poolIds", p));
    agentIds.forEach((a) => qp.append("agentIds", a));
    // Do NOT call onOpenChange(false). Drill-down state lives in the
    // dashboard URL, so navigating away leaves it intact and the browser
    // back button will restore the popup automatically.
    setLocation(`/training-retention/retention?${qp.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl"
        data-testid="dialog-crew-retention-drilldown"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Breakdown of the calculation behind the selected crew retention rate
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {/* Headline rate */}
          <div className="mb-4 flex items-baseline gap-3">
            <span
              className="text-base font-bold text-[#16569e]"
              data-testid="text-drilldown-rate-label"
            >
              Calculated Retention Rate:
            </span>
            {isLoading ? (
              <Skeleton
                className="h-7 w-20"
                data-testid="skeleton-drilldown-rate"
              />
            ) : (
              <span
                className="text-2xl font-bold text-[#16569e]"
                data-testid="text-drilldown-rate-value"
              >
                {headlineValue}
              </span>
            )}
          </div>

          {isError && !isLoading && (
            <div
              className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]"
              data-testid="error-drilldown-load"
            >
              Couldn't load retention metrics. Please try again.
            </div>
          )}

          {aeIsZero && !isLoading && !isError && (
            <div
              className="mb-4 rounded-md border border-dashed border-[#e1e8ed] bg-[#f8fafc] px-4 py-3 text-sm text-[#475569]"
              data-testid="empty-drilldown-no-cohort"
            >
              No data for this category and the selected filters.
            </div>
          )}

          {/* Criteria / formula table — mirrors the Retention page */}
          <div className="overflow-hidden rounded-md border border-[#e1e8ed] bg-white">
            <table
              className="w-full text-sm"
              data-testid="table-drilldown-formula"
            >
              <thead className="bg-[#f7fafc] text-left text-xs font-semibold text-[#475569]">
                <tr>
                  <th className="w-[120px] px-4 py-2">Criteria</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="w-[100px] px-4 py-2 text-right">Values</th>
                </tr>
              </thead>
              <tbody>
                {FORMULA_ROWS.map((row) => (
                  <tr
                    key={row.criteria}
                    className="border-t border-[#eef2f7]"
                    data-testid={`row-drilldown-${row.criteria}`}
                  >
                    <td className="px-4 py-3 text-center font-semibold text-[#0f172a]">
                      {row.criteria}
                    </td>
                    <td className="px-4 py-3 text-[#0f172a]">
                      {row.description}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-semibold text-[#0f172a] tabular-nums"
                      data-testid={`value-drilldown-${row.criteria}`}
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
                  data-testid="row-drilldown-formula"
                >
                  <td className="px-4 py-3 text-center font-semibold text-[#16569e]">
                    Formula
                  </td>
                  <td
                    className="px-4 py-3 text-[#16569e] font-medium"
                    colSpan={2}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span>
                        % Retention Rate (RR) = 100 - [(S – (UT + BT)) X 100]
                      </span>
                      <span className="ml-[19.5rem] border-t border-[#16569e] px-3">
                        AE
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewOnRetentionPage}
              disabled={!range || rankIds.length === 0}
              data-testid="button-view-retention-page"
            >
              View on Retention page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
