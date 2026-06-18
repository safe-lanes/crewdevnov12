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
import { useNationalitiesV2 } from "@/hooks/v2/useMasterDataV2";
import { candidateApi } from "@/modules/recruitment/api/candidateApi";
import { RECRUITED_STATUSES } from "@/modules/recruitment/statusBuckets";
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface CandidateRow {
  id?: number;
  recCanUuid?: string;
  fileNo?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  rankAppliedFor?: string | null;
  presentRank?: string | null;
  nationalityUuid?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

interface CrewRecruitmentDrilldownDialogProps {
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

function buildName(c: CandidateRow): string {
  const parts = [c.firstName, c.middleName, c.familyName]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(" ") || c.fileNo || "Unnamed Candidate";
}

export const CrewRecruitmentDrilldownDialog = ({
  open,
  onOpenChange,
  rank,
  period,
  ranks = [],
  crewPools: _crewPools = [],
  manningAgents = [],
  nationalities = [],
}: CrewRecruitmentDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  const { data: candidates = [], isLoading } = useQuery<CandidateRow[]>({
    queryKey: ["v2", "recruitment", "candidates", "rank-chart"],
    queryFn: () => candidateApi.getAll() as unknown as Promise<CandidateRow[]>,
    staleTime: 60 * 1000,
    enabled: open,
  });

  const { data: nationalityList = [] } = useNationalitiesV2({ enabled: open });

  const nationalityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    nationalityList.forEach((n: any) => {
      const uuid = n.nationalityUuid || n.uuid || n.id;
      const name = n.nationality || n.countryName || n.name;
      if (uuid && name) map.set(String(uuid), String(name));
    });
    return map;
  }, [nationalityList]);

  const range = useMemo(() => periodToRange(period), [period]);

  const matchingCandidates = useMemo<CandidateRow[]>(() => {
    if (!rank || !range) return [];
    return candidates.filter((c) => {
      // Match the chart: only candidates whose status is in the "Recruited"
      // bucket. Without this, Waitlist / Draft / etc. show up here too.
      if (!c.status || !RECRUITED_STATUSES.has(String(c.status))) return false;

      const recruited = parseDate(c.createdAt);
      if (!recruited) return false;
      if (recruited < range.from || recruited > range.to) return false;

      const candidateRank = (c.rankAppliedFor || c.presentRank || "").trim();
      if (!candidateRank || candidateRank !== rank) return false;

      if (ranks.length > 0 && !ranks.includes(candidateRank)) return false;
      if (nationalities.length > 0) {
        const nationalityName =
          nationalityNameMap.get(String(c.nationalityUuid || "")) || "";

        if (!nationalities.includes(nationalityName)) {
          return false;
        }
      }
      if (manningAgents.length > 0) return false;

      return true;
    });
  }, [candidates, range, rank, ranks, nationalities, manningAgents, nationalityNameMap]);

  const sorted = useMemo(
    () =>
      [...matchingCandidates].sort((a, b) => {
        const da = parseDate(a.createdAt)?.getTime() ?? 0;
        const db = parseDate(b.createdAt)?.getTime() ?? 0;
        return db - da;
      }),
    [matchingCandidates],
  );

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const title = `Crew Recruitment - ${rank ?? ""}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const handleViewCandidate = (candidate: CandidateRow) => {
    // Do NOT call onOpenChange(false). The drill-down state lives in the
    // dashboard URL, and we want the back button to restore this popup.
    const uuid = candidate.recCanUuid;
    if (uuid) {
      setLocation(`/recruitment?candidate=${encodeURIComponent(uuid)}`);
    } else {
      setLocation("/recruitment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="dialog-crew-recruitment-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View candidates that make up the selected rank in the recruitment chart
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
              No candidates found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-[20%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Name
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Rank Applied For
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Present Rank
                    </th>
                    <th className="w-[15%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Nationality
                    </th>
                    <th className="w-[13%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Date Applied
                    </th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Status
                    </th>
                    <th className="w-[10%] px-4 py-2 text-center text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, idx) => {
                    const key = c.recCanUuid || String(c.id ?? idx);
                    const nationalityName = c.nationalityUuid
                      ? nationalityNameMap.get(String(c.nationalityUuid)) ||
                        c.nationalityUuid
                      : "";
                    return (
                      <tr
                        key={key}
                        className="hover:bg-gray-50 border-t border-gray-100"
                        data-testid={`row-drilldown-candidate-${key}`}
                      >
                        <td className="px-4 py-2 text-sm">{buildName(c)}</td>
                        <td className="px-4 py-2 text-sm">
                          {c.rankAppliedFor || ""}
                        </td>
                        <td className="px-4 py-2 text-sm">{c.presentRank || ""}</td>
                        <td className="px-4 py-2 text-sm">{nationalityName}</td>
                        <td className="px-4 py-2 text-sm">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {c.status ? (
                            <span
                              className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              data-testid={`text-status-${c.recCanUuid ?? c.id ?? idx}`}
                            >
                              {c.status}
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewCandidate(c)}
                            data-testid={`button-view-candidate-${key}`}
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
