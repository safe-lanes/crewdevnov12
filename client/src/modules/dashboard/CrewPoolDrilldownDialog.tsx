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
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";

interface CrewRow {
  id?: number | string;
  crewUuid?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  presentRank?: string | null;
  status?: string | null;
  notForHire?: boolean | null;
  lastTerminationDate?: string | null;
  createdAt?: string | Date | null;
  nationalityUuid?: string | null;
  manningAgentName?: string | null;
  crewPool?: string | null;
  presentVessel?: string | null;
  presentVesselName?: string | null;
}

interface CrewListResponse {
  data: CrewRow[];
  pagination?: { total: number; limit: number; offset: number; pages?: number };
}

interface CrewPoolDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rank: string | null;
  period: PeriodFilterValue;
  ranks?: string[];
  vessels?: string[];
  crewPools?: string[];
  manningAgents?: string[];
  nationalities?: string[];
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

function buildName(c: CrewRow): string {
  const parts = [c.firstName, c.middleName, c.familyName]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(" ") || "Unnamed Crew";
}

export const CrewPoolDrilldownDialog = ({
  open,
  onOpenChange,
  rank,
  period,
  ranks = [],
  vessels = [],
  crewPools = [],
  manningAgents = [],
  nationalities = [],
}: CrewPoolDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  // Same query key as CrewPoolRankChart so react-query shares cache.
  const { data: crew = [], isLoading } = useQuery<CrewRow[]>({
    queryKey: ["/api/v2/crew-pool/crew/details", { view: "all", all: true }],
    queryFn: async ({ signal }) => {
      const PAGE_SIZE = 1000;
      const all: CrewRow[] = [];
      let offset = 0;
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

  const snapshotDate = useMemo(() => periodToSnapshotDate(period), [period]);

  const matching = useMemo<CrewRow[]>(() => {
    if (!rank || !snapshotDate) return [];

    // If the selected period STARTS in the future, there is no pool data yet.
    const fromDate = periodToFromDate(period);
    if (fromDate && fromDate.getTime() > Date.now()) return [];

    return crew.filter((c) => {
      // Mirror chart: existed on snapshot date
      const created = parseDate(c.createdAt);
      if (!created) return false;
      if (created.getTime() > snapshotDate.getTime()) return false;

      // Mirror chart: always exclude not-for-rehire and terminated crew.
      if (c.notForHire === true) return false;
      const statusLower = (c.status || "").toLowerCase();
      if (statusLower === "terminated") return false;

      const rowRank = (c.presentRank || "").trim();
      if (!rowRank || rowRank !== rank) return false;

      if (ranks.length > 0 && !ranks.includes(rowRank)) return false;
      if (
        nationalities.length > 0 &&
        !nationalities.includes((c.nationalityUuid || "") as string)
      ) {
        return false;
      }
      if (manningAgents.length > 0) {
        const agent = (c.manningAgentName || "").trim();
        if (!agent || !manningAgents.includes(agent)) return false;
      }
      if (crewPools.length > 0) {
        const pool = (c.crewPool || "").trim();
        if (!pool || !crewPools.includes(pool)) return false;
      }
      if (vessels.length > 0) {
        const vessel = (c.presentVessel || "").trim();
        if (!vessel || !vessels.includes(vessel)) return false;
      }
      return true;
    });
  }, [crew, snapshotDate, period, rank, ranks, nationalities, manningAgents, crewPools, vessels]);

  const sorted = useMemo(
    () =>
      [...matching].sort((a, b) =>
        buildName(a).localeCompare(buildName(b), undefined, { sensitivity: "base" }),
      ),
    [matching],
  );

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const title = `Crew Pool - ${rank ?? ""}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const handleViewCrew = (row: CrewRow) => {
    // Do NOT call onOpenChange(false). The drill-down state lives in the
    // dashboard URL, and we want the back button to restore this popup.
    const uuid = row.crewUuid;
    if (uuid) {
      setLocation(`/crew-pool?crew=${encodeURIComponent(uuid)}`);
    } else {
      setLocation("/crew-pool");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="dialog-crew-pool-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View crew members that make up the selected rank in the crew pool chart
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
              No crew members found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-[24%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Name
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Rank
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Nationality
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Vessel
                    </th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Pool
                    </th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Manning Agent
                    </th>
                    <th className="w-[10%] px-4 py-2 text-center text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, idx) => {
                    const key = c.crewUuid || String(c.id ?? idx);
                    const nationalityName = c.nationalityUuid
                      ? nationalityNameMap.get(String(c.nationalityUuid)) ||
                        c.nationalityUuid
                      : "";
                    return (
                      <tr
                        key={key}
                        className="hover:bg-gray-50 border-t border-gray-100"
                        data-testid={`row-drilldown-crew-${key}`}
                      >
                        <td className="px-4 py-2 text-sm">{buildName(c)}</td>
                        <td className="px-4 py-2 text-sm">{c.presentRank || ""}</td>
                        <td className="px-4 py-2 text-sm">{nationalityName}</td>
                        <td className="px-4 py-2 text-sm">{c.presentVesselName || ""}</td>
                        <td className="px-4 py-2 text-sm">{c.crewPool || ""}</td>
                        <td className="px-4 py-2 text-sm">
                          {c.manningAgentName || ""}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewCrew(c)}
                            data-testid={`button-view-crew-${key}`}
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
