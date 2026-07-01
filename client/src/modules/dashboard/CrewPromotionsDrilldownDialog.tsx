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
import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";
import { apiRequest } from "@/lib/queryClient";

interface PromotionReviewRow {
  reviewUuid?: string | null;
  crewMemberId?: string | null;
  promotionToRank?: string | null;
  promotionConfirmed?: string | null;
  promotionDate?: string | null;
  vesselAssigned?: string | null;
  status?: string | null;
}

interface CrewMemberRow {
  empNo?: string | null;
  employeeId?: string | null;
  id?: string | number | null;
  firstName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
}

interface CrewPoolLookupRow {
  crewUuid?: string | null;
  empNo?: string | null;
  crewPool?: string | null;
  manningAgentName?: string | null;
}

interface CrewPromotionsDrilldownDialogProps {
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

function buildName(c: CrewMemberRow): string {
  const parts = [c.firstName, c.middleName, c.familyName]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

export const CrewPromotionsDrilldownDialog = ({
  open,
  onOpenChange,
  rank,
  period,
  ranks = [],
  crewPools = [],
  manningAgents = [],
  nationalities: _nationalities = [],
}: CrewPromotionsDrilldownDialogProps) => {
  const [, setLocation] = useLocation();

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<PromotionReviewRow[]>({
    queryKey: ["/api/v2/promotions/reviews"],
    staleTime: 60 * 1000,
    enabled: open,
  });

  const { data: crewMembers = [], isLoading: crewLoading } = useQuery<CrewMemberRow[]>({
    queryKey: ["/api/v2/crew-pool/crew/enriched"],
    staleTime: 60 * 1000,
    enabled: open,
  });

  const { data: crew = [] } = useQuery<CrewPoolLookupRow[]>({
    queryKey: ["/api/v2/crew-pool/crew/details", "crew-promotions-pool"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: CrewPoolLookupRow[] = [];
      let offset = 0;
      for (let i = 0; i < 100; i++) {
        const res = await apiRequest(
          "GET",
          `/api/v2/crew-pool/crew/details?view=all&limit=${PAGE_SIZE}&offset=${offset}`,
        );
        const json = await res.json();
        const page = json.data ?? [];
        all.push(...page);
        const total = json.pagination?.total ?? all.length;
        offset += PAGE_SIZE;
        if (page.length < PAGE_SIZE || all.length >= total) break;
      }
      return all;
    },
    staleTime: 60 * 1000,
    enabled: open && (crewPools.length > 0 || manningAgents.length > 0),
  });

  const poolByCrewKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crew) {
      const pool = (c.crewPool || "").trim();
      if (!pool) continue;
      if (c.crewUuid) map.set(String(c.crewUuid), pool);
      if (c.empNo) map.set(String(c.empNo), pool);
    }
    return map;
  }, [crew]);

  const agentByCrewKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crew) {
      const agent = (c.manningAgentName || "").trim();
      if (!agent) continue;
      if (c.crewUuid) map.set(String(c.crewUuid), agent);
      if (c.empNo) map.set(String(c.empNo), agent);
    }
    return map;
  }, [crew]);

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/masters/vessels"],
    staleTime: 60 * 1000,
    enabled: open,
  });

  // Resolve the stored vessel reference to the vessel's CURRENT name. Promotions
  // store the vessel UUID (vessel_assigned); we key the map by UUID and also by
  // numeric id / name so legacy or not-yet-backfilled rows still resolve. The
  // name is read from master data, so a later vessel rename is reflected here.
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

  const crewNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crewMembers) {
      const id = c.empNo || c.employeeId || (c.id != null ? String(c.id) : "");
      if (!id) continue;
      const name = buildName(c);
      if (name) map.set(String(id), name);
    }
    return map;
  }, [crewMembers]);

  const range = useMemo(() => periodToRange(period), [period]);

  const matching = useMemo<PromotionReviewRow[]>(() => {
    if (!rank || !range) return [];
    return reviews.filter((r) => {
      const status = (r.status || "").toLowerCase();
      const confirmed = (r.promotionConfirmed || "").toLowerCase();
      if (status !== "completed") return false;
      if (confirmed !== "yes") return false;

      const date = parseDate(r.promotionDate);
      if (!date) return false;
      if (date < range.from || date > range.to) return false;

      if (crewPools.length > 0) {
        const pool = poolByCrewKey.get((r.crewMemberId || "").trim());
        if (!pool || !crewPools.includes(pool)) return false;
      }

      if (manningAgents.length > 0) {
        const agent = agentByCrewKey.get((r.crewMemberId || "").trim());
        if (!agent || !manningAgents.includes(agent)) return false;
      }

      const rowRank = (r.promotionToRank || "").trim();
      if (rowRank !== rank) return false;
      if (ranks.length > 0 && !ranks.includes(rowRank)) return false;
      return true;
    });
  }, [reviews, range, rank, ranks, crewPools, poolByCrewKey, manningAgents, agentByCrewKey]);

  const sorted = useMemo(
    () =>
      [...matching].sort((a, b) => {
        const da = parseDate(a.promotionDate)?.getTime() ?? 0;
        const db = parseDate(b.promotionDate)?.getTime() ?? 0;
        return db - da;
      }),
    [matching],
  );

  const periodLabel = useMemo(() => formatPeriod(period), [period]);
  const title = `Crew Promotions - ${rank ?? ""}${periodLabel ? ` - ${periodLabel}` : ""}`;

  const isLoading = reviewsLoading || crewLoading;

  const handleViewPromotion = (reviewUuid: string | null | undefined) => {
    // Do NOT call onOpenChange(false) here. The dashboard encodes the open
    // drill-down in the URL (?drilldown=crew-promotions&rank=…); pushing the
    // promotions URL leaves that history entry intact so the browser back
    // button returns the user to the dashboard with this popup re-opened.
    if (reviewUuid) {
      setLocation(`/promotions?review=${encodeURIComponent(reviewUuid)}`);
    } else {
      setLocation("/promotions");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="dialog-crew-promotions-drilldown">
        <DialogHeader>
          <DialogTitle data-testid="text-drilldown-promotions-title">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            View promotion reviews that make up the selected rank in the promotions chart
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div
              className="text-center py-8 text-gray-500"
              data-testid="state-drilldown-promotions-loading"
            >
              Loading...
            </div>
          ) : sorted.length === 0 ? (
            <div
              className="text-center py-8 text-gray-500"
              data-testid="state-drilldown-promotions-empty"
            >
              No promotions found
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full border-collapse table-fixed">
                <thead className="bg-blue-50 sticky top-0 z-10">
                  <tr>
                    <th className="w-[20%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Crew Name
                    </th>
                    <th className="w-[12%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Crew ID
                    </th>
                    <th className="w-[16%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Rank Promoted To
                    </th>
                    <th className="w-[16%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Vessel
                    </th>
                    <th className="w-[14%] px-4 py-2 text-left text-sm font-semibold bg-blue-50 border-b border-blue-200">
                      Promotion Date
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
                  {sorted.map((r, idx) => {
                    const key = r.reviewUuid || `${r.crewMemberId ?? "x"}-${idx}`;
                    const crewId = (r.crewMemberId || "").trim();
                    const name = crewId ? crewNameMap.get(crewId) || crewId : "";
                    return (
                      <tr
                        key={key}
                        className="hover:bg-gray-50 border-t border-gray-100"
                        data-testid={`row-drilldown-promotion-${key}`}
                      >
                        <td className="px-4 py-2 text-sm">{name}</td>
                        <td className="px-4 py-2 text-sm">{crewId}</td>
                        <td className="px-4 py-2 text-sm">{r.promotionToRank || ""}</td>
                        <td className="px-4 py-2 text-sm">{resolveVesselName(r.vesselAssigned)}</td>
                        <td className="px-4 py-2 text-sm">{formatDate(r.promotionDate)}</td>
                        <td className="px-4 py-2 text-sm">
                          {r.status ? (
                            <span
                              className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              data-testid={`text-status-${key}`}
                            >
                              {r.status}
                            </span>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPromotion(r.reviewUuid)}
                            data-testid={`button-view-promotion-${key}`}
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
