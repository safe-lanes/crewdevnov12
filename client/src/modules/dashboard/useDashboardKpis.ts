import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardKpis } from "@shared/v2/admin/dashboardKpis";

export const dashboardKpisQueryKey = (year: number) => [
  "/api/v2/admin/dashboard-kpis",
  year,
] as const;

async function fetchDashboardKpis(year: number): Promise<DashboardKpis> {
  const response = await fetch(`/api/v2/admin/dashboard-kpis/${year}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to load dashboard KPIs");
  return response.json();
}

export function useDashboardKpis(year: number | null) {
  return useQuery<DashboardKpis>({
    queryKey: dashboardKpisQueryKey(year ?? 0),
    queryFn: () => fetchDashboardKpis(year!),
    enabled: year !== null && Number.isInteger(year) && year >= 1900 && year <= 9999,
    staleTime: 5 * 60 * 1000,
  });
}

/** A card-local clock: refreshing at local midnight keeps rolling dates/current-year rules honest. */
export function useDashboardToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setToday(new Date());
        scheduleNextMidnight();
      }, Math.max(1000, next.getTime() - now.getTime() + 50));
    };
    scheduleNextMidnight();
    return () => clearTimeout(timer);
  }, []);

  return today;
}
