import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";

export interface DrilldownState {
  rank: string | null;
}

export interface UseDrilldownParamResult {
  isOpen: boolean;
  state: DrilldownState;
  open: (state: DrilldownState) => void;
  close: () => void;
  setOpen: (open: boolean, state?: DrilldownState) => void;
}

function buildSearch(
  current: string,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams(current.startsWith("?") ? current.slice(1) : current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

/**
 * URL-driven state for a dashboard drill-down popup.
 *
 * Encodes a single open drill-down in the page URL using `?drilldown=<id>&rank=<rank>`
 * (and any extra params passed to `open`). This makes the popup survive a browser
 * back navigation: leaving the dashboard pushes a new history entry, so the back
 * button restores the dashboard URL with the drill-down params intact and the
 * popup reopens itself from those params.
 *
 * Designed to be the default pattern for every drill-down on the Crewing
 * Dashboard.
 */
export function useDrilldownParam(drilldownId: string): UseDrilldownParamResult {
  const search = useSearch();
  const [pathname, setLocation] = useLocation();

  const params = new URLSearchParams(search);
  const isOpen = params.get("drilldown") === drilldownId;
  const rank = isOpen ? params.get("rank") : null;

  const open = useCallback(
    (next: DrilldownState) => {
      const nextSearch = buildSearch(search, {
        drilldown: drilldownId,
        rank: next.rank ?? null,
      });
      setLocation(`${pathname}${nextSearch}`);
    },
    [search, pathname, setLocation, drilldownId],
  );

  const close = useCallback(() => {
    const nextSearch = buildSearch(search, {
      drilldown: null,
      rank: null,
    });
    setLocation(`${pathname}${nextSearch}`, { replace: true });
  }, [search, pathname, setLocation]);

  const setOpen = useCallback(
    (next: boolean, state?: DrilldownState) => {
      if (next) open(state ?? { rank: null });
      else close();
    },
    [open, close],
  );

  return { isOpen, state: { rank }, open, close, setOpen };
}
