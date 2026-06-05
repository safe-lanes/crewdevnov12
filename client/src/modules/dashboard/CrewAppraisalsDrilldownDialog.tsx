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
import { appraisalsApiV2 } from "@/modules/crewing/api/appraisalsApiV2";
import { extractRank } from "./appraisalRank";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface AppraisalRow {
  id?: number;
  appraisalUuid?: string | null;
  seafarersName?: string | null;
  seafarersRank?: string | null;
  vessel?: string | null;
  appraisalType?: string | null;
  appraisalDate?: string | null;
  overallRating?: string | number | null;
  appraisalData?: string | null;
}

interface CrewAppraisalsDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rank: string | null;
  period: PeriodFilterValue;
  ranks?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
}

function periodToRange(period: PeriodFilterValue): { from: Date; to: Date } | null {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

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

function formatPeriod(period: PeriodFilterValue): string {
  if (period.mode === "year" && period.year) return String(period.year);
  if (period.mode === "year-quarter" && period.year && period.quarter)
    return `Q${period.quarter} ${period.year}`;
  if (period.mode === "year-month" && period.year && period.month) {
    const date = new Date(period.year, period.month - 1, 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  }
  if (period.mode === "date-range" && period.dateFrom && period.dateTo) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    return `${fmt(period.dateFrom)} – ${fmt(period.dateTo)}`;
  }
  return "";
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

function formatDate(value: unknown): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}

interface ParsedAppraisalData {
  seafarersName?: string;
  seafarersRank?: string;
  vessel?: string;
  appraisalType?: string;
}

function parseAppraisalData(raw?: string | null): ParsedAppraisalData {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const CrewAppraisalsDrilldownDialog = ({
  open,
  onOpenChange,
  rank,
  period,
}: CrewAppraisalsDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  const { data: appraisals = [], isLoading } = useQuery<AppraisalRow[]>({
    queryKey: ["v2", "appraisals", "rank-chart"],
    queryFn: () => appraisalsApiV2.getAll() as unknown as Promise<AppraisalRow[]>,
    staleTime: 60 * 1000,
    enabled: open,
  });

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/masters/vessels"],
    staleTime: 60 * 1000,
    enabled: open,
  });

  // Resolve the stored vessel reference to the vessel's CURRENT name. Appraisals
  // store the vessel UUID; we key the map by UUID and also by numeric id / name
  // so legacy rows still resolve. The name is read from master data, so a later
  // vessel rename is reflected here.
  const vesselNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vessels) {
      const name = v.vessel || v.name || v.vesselName;
      if (!name) continue;
      for (const k of [v.vesselUuid, v.uuid, v.entryId, v.id, v.vesselId]) {
        if (k != null && String(k).trim() !== "") map.set(String(k), name);
      }
    }
    return map;
  }, [vessels]);

  const resolveVesselName = (value: string | null | undefined): string => {
    const raw = (value || "").trim();
    if (!raw) return "";
    return vesselNameByKey.get(raw) || raw;
  };

  const range = useMemo(() => periodToRange(period), [period]);

  const matching = useMemo<AppraisalRow[]>(() => {
    if (!rank || !range) return [];
    return appraisals.filter((a) => {
      const date = parseDate(a.appraisalDate);
      if (!date) return false;
      if (date < range.from || date > range.to) return false;

      const rowRank = extractRank(a);
      if (!rowRank || rowRank !== rank) return false;

      // Mirror the chart: rows without a numeric overall rating are excluded
      // from the bar's average and so should not appear here either.
      if (parseRating(a.overallRating) === null) return false;

      return true;
    });
  }, [appraisals, range, rank]);

  const sorted = useMemo(
    () =>
      [...matching].sort((a, b) => {
        const da = parseDate(a.appraisalDate)?.getTime() ?? 0;
        const db = parseDate(b.appraisalDate)?.getTime() ?? 0;
        return db - da;
      }),
    [matching],
  );

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const title = `Crew Appraisals - ${rank ?? ""}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const handleViewAppraisal = (row: AppraisalRow) => {
    // Do NOT call onOpenChange(false). The drill-down state lives in the
    // dashboard URL, and we want the back button to restore this popup.
    const uuid = row.appraisalUuid;
    if (uuid) {
      setLocation(`/?appraisal=${encodeURIComponent(uuid)}`);
    } else {
      setLocation("/");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="dialog-crew-appraisals-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View appraisals that make up the selected rank in the appraisals chart
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div
              className="text-center py-8 text-gray-500"
              data-testid="state-drilldown-loading"
            >
              Loading...
            </div>
          ) : sorted.length === 0 ? (
            <div
              className="text-center py-8 text-gray-500"
              data-testid="state-drilldown-empty"
            >
              No appraisals found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-[22%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Seafarer Name
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Rank
                    </th>
                    <th className="w-[18%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Vessel
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Appraisal Type
                    </th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Appraisal Date
                    </th>
                    <th className="w-[10%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Overall Rating
                    </th>
                    <th className="w-[10%] px-4 py-2 text-center text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a, idx) => {
                    const key = a.appraisalUuid || String(a.id ?? idx);
                    const parsed = parseAppraisalData(a.appraisalData);
                    const seafarerName =
                      (a.seafarersName && a.seafarersName.trim()) ||
                      (parsed.seafarersName || "").trim() ||
                      "Unnamed Seafarer";
                    const vesselName = resolveVesselName(
                      (a.vessel && a.vessel.trim()) ||
                        (parsed.vessel || "").trim() ||
                        "",
                    );
                    const appraisalType =
                      (a.appraisalType && String(a.appraisalType).trim()) ||
                      (parsed.appraisalType || "").trim() ||
                      "";
                    const ratingNum = parseRating(a.overallRating);
                    const ratingLabel =
                      ratingNum === null ? "" : ratingNum.toFixed(2);
                    return (
                      <tr
                        key={key}
                        className="hover:bg-gray-50 border-t border-gray-100"
                        data-testid={`row-drilldown-appraisal-${key}`}
                      >
                        <td className="px-4 py-2 text-sm">{seafarerName}</td>
                        <td className="px-4 py-2 text-sm">
                          {extractRank(a) || ""}
                        </td>
                        <td className="px-4 py-2 text-sm">{vesselName}</td>
                        <td className="px-4 py-2 text-sm">{appraisalType}</td>
                        <td className="px-4 py-2 text-sm">
                          {formatDate(a.appraisalDate)}
                        </td>
                        <td className="px-4 py-2 text-sm">{ratingLabel}</td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewAppraisal(a)}
                            data-testid={`button-view-appraisal-${key}`}
                            className="text-xs"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
