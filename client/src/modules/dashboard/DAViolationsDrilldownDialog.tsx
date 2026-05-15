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
import { Skeleton } from "@/components/ui/skeleton";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

export type DAViolationType = "alcohol" | "drug";

interface ViolationFormSummary {
  daUuid: string;
  testType: string | null;
  otherTestType: string | null;
  testDate: string;
  vesselId: string | null;
  vesselName: string | null;
  alcoholViolations: number;
  drugViolations: number;
}

interface DAViolationsDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DAViolationType | null;
  period: PeriodFilterValue;
  range: { from: string; to: string } | null;
  vessels: string[];
  ranks: string[];
  crewPools: string[];
  manningAgents: string[];
}

const TEST_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  periodic: "Periodic",
  monthly: "Monthly",
  "post-incident": "Post-Incident",
  others: "Others",
};

const TEST_TYPE_TO_PAGE: Record<string, string> = {
  annual: "annual",
  periodic: "periodic",
  monthly: "monthly",
  "post-incident": "post-incident",
  others: "others",
};

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

function formatDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function fetchViolationForms(params: {
  from: string;
  to: string;
  type: DAViolationType;
  vessels: string[];
  ranks: string[];
  pools: string[];
  agents: string[];
}): Promise<ViolationFormSummary[]> {
  const qp = new URLSearchParams();
  qp.set("periodFrom", params.from);
  qp.set("periodTo", params.to);
  qp.set("type", params.type);
  params.vessels.forEach((v) => qp.append("vesselIds", v));
  params.ranks.forEach((r) => qp.append("rankIds", r));
  params.pools.forEach((p) => qp.append("poolIds", p));
  params.agents.forEach((a) => qp.append("agentIds", a));
  const res = await fetch(
    `/api/v2/drugs-alcohol/test-records/violations?${qp.toString()}`
  );
  if (!res.ok) throw new Error("Failed to load D&A violation forms");
  return res.json();
}

export const DAViolationsDrilldownDialog = ({
  open,
  onOpenChange,
  type,
  period,
  range,
  vessels,
  ranks,
  crewPools,
  manningAgents,
}: DAViolationsDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  const enabled = open && !!type && !!range;

  const query = useQuery<ViolationFormSummary[]>({
    queryKey: [
      "/api/v2/drugs-alcohol/test-records/violations",
      "dashboard-da-violations",
      type,
      range?.from ?? null,
      range?.to ?? null,
      vessels,
      ranks,
      crewPools,
      manningAgents,
    ],
    queryFn: () =>
      fetchViolationForms({
        from: range!.from,
        to: range!.to,
        type: type!,
        vessels,
        ranks,
        pools: crewPools,
        agents: manningAgents,
      }),
    enabled,
    staleTime: 60 * 1000,
  });

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const typeLabel = type === "alcohol" ? "Alcohol Violations" : "Drug Violations";
  const title = `D&A - ${typeLabel}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const data = query.data ?? [];
  const isLoading = query.isLoading || query.isFetching;
  const isError = query.isError;

  const headlineTotal = useMemo(() => {
    if (!type) return 0;
    return data.reduce(
      (sum, r) =>
        sum + (type === "alcohol" ? r.alcoholViolations : r.drugViolations),
      0,
    );
  }, [data, type]);

  const formatTestType = (row: ViolationFormSummary): string => {
    const tt = row.testType ?? "";
    const base = TEST_TYPE_LABELS[tt] ?? (tt || "—");
    if (tt === "others" && row.otherTestType) {
      return `${base} – ${row.otherTestType}`;
    }
    return base;
  };

  const handleRowClick = (row: ViolationFormSummary) => {
    const page =
      (row.testType && TEST_TYPE_TO_PAGE[row.testType]) || "annual";
    const qp = new URLSearchParams();
    qp.set("recordUuid", row.daUuid);
    qp.set("page", page);
    // Do NOT call onOpenChange(false). Drill-down state lives in the
    // dashboard URL, so navigating away leaves it intact and the browser
    // back button will restore the popup automatically.
    setLocation(`/drugs-alcohol?${qp.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        data-testid="dialog-da-violations-drilldown"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-da-drilldown-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            List of test forms with {typeLabel.toLowerCase()} for the selected
            period and filters
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <div className="mb-4 flex items-baseline gap-3">
            <span
              className="text-base font-bold text-[#16569e]"
              data-testid="text-da-drilldown-total-label"
            >
              Total {typeLabel}:
            </span>
            {isLoading ? (
              <Skeleton
                className="h-7 w-12"
                data-testid="skeleton-da-drilldown-total"
              />
            ) : (
              <span
                className="text-2xl font-bold text-[#16569e] tabular-nums"
                data-testid="text-da-drilldown-total-value"
              >
                {isError ? "—" : headlineTotal}
              </span>
            )}
          </div>

          {isError && !isLoading && (
            <div
              className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]"
              data-testid="error-da-drilldown-load"
            >
              Couldn't load violation forms. Please try again.
            </div>
          )}

          {!isLoading && !isError && data.length === 0 && (
            <div
              className="mb-2 rounded-md border border-dashed border-[#e1e8ed] bg-[#f8fafc] px-4 py-6 text-center text-sm text-[#475569]"
              data-testid="empty-da-drilldown"
            >
              No forms with {typeLabel.toLowerCase()} for this period and the
              selected filters.
            </div>
          )}

          {(isLoading || data.length > 0) && (
            <div className="overflow-hidden rounded-md border border-[#e1e8ed] bg-white">
              <table
                className="w-full text-sm"
                data-testid="table-da-drilldown-forms"
              >
                <thead className="bg-[#f7fafc] text-left text-xs font-semibold text-[#475569]">
                  <tr>
                    <th className="px-4 py-2">Test Type</th>
                    <th className="px-4 py-2">Test Date</th>
                    <th className="px-4 py-2">Vessel</th>
                    <th className="px-4 py-2 text-right">Alcohol Violations</th>
                    <th className="px-4 py-2 text-right">Drug Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <tr
                          key={`skel-${i}`}
                          className="border-t border-[#eef2f7]"
                          data-testid={`row-da-drilldown-skeleton-${i}`}
                        >
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Skeleton className="ml-auto h-4 w-8" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Skeleton className="ml-auto h-4 w-8" />
                          </td>
                        </tr>
                      ))
                    : data.map((row) => (
                        <tr
                          key={row.daUuid}
                          className="border-t border-[#eef2f7] cursor-pointer hover:bg-[#f7fafc] focus:outline-none focus:bg-[#f7fafc]"
                          tabIndex={0}
                          onClick={() => handleRowClick(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleRowClick(row);
                            }
                          }}
                          data-testid={`row-da-drilldown-${row.daUuid}`}
                        >
                          <td
                            className="px-4 py-3 text-[#0f172a]"
                            data-testid={`cell-da-test-type-${row.daUuid}`}
                          >
                            {formatTestType(row)}
                          </td>
                          <td
                            className="px-4 py-3 text-[#0f172a] tabular-nums"
                            data-testid={`cell-da-test-date-${row.daUuid}`}
                          >
                            {formatDate(row.testDate)}
                          </td>
                          <td
                            className="px-4 py-3 text-[#0f172a]"
                            data-testid={`cell-da-vessel-${row.daUuid}`}
                          >
                            {row.vesselName || "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold text-[#0f172a] tabular-nums"
                            data-testid={`cell-da-alcohol-${row.daUuid}`}
                          >
                            {row.alcoholViolations}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold text-[#0f172a] tabular-nums"
                            data-testid={`cell-da-drug-${row.daUuid}`}
                          >
                            {row.drugViolations}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
