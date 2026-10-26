import { useLayoutEffect, useRef, useState } from "react";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { Button } from "@/components/ui/button";
import { useVesselPeriod } from "../vesselPeriodStore";
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Current month as YYYY-MM (local time). */
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Display a YYYY-MM period as MMM-YYYY (e.g. Jun-2026). */
export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]}-${y}`;
}

interface VesselPeriodBarProps {
  vesselUuid: string;
  period: string; // YYYY-MM
  onVesselChange: (uuid: string) => void;
  onPeriodChange: (period: string) => void | Promise<void>;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onClear?: () => void | Promise<void>;
}

/** Vessel + accounting-period selector shared by the payroll screens. */
export default function VesselPeriodBar({
  vesselUuid,
  period,
  onVesselChange,
  onPeriodChange,
  children,
  actions,
  onClear = () => useVesselPeriod.getState().resetFilters(),
}: VesselPeriodBarProps) {
  const { vessels, isLoading } = useVesselLookup();
  const [periodInputKey, setPeriodInputKey] = useState(0);
  const periodInputRef = useRef<HTMLDivElement | null>(null);
  const editRevision = useRef(0);
  const lastInputEvent = useRef<Event | null>(null);
  const restoreFocus = useRef<{
    type: string;
    start: number | null;
    end: number | null;
  } | null>(null);
  const [settled, setSettled] = useState<{
    revision: number;
    requestedPeriod?: string;
  } | null>(null);

  const trackInput = (event: { nativeEvent: Event }) => {
    if (lastInputEvent.current === event.nativeEvent) return;
    lastInputEvent.current = event.nativeEvent;
    editRevision.current += 1;
  };

  const resetPeriodInput = () => {
    const active = document.activeElement;
    restoreFocus.current =
      active instanceof HTMLInputElement &&
      periodInputRef.current?.contains(active)
        ? {
            type: active.type,
            start: active.selectionStart,
            end: active.selectionEnd,
          }
        : null;
    editRevision.current += 1;
    setPeriodInputKey((key) => key + 1);
  };

  useLayoutEffect(() => {
    if (!settled || settled.revision !== editRevision.current) return;
    if (settled.requestedPeriod === period) return;
    resetPeriodInput();
  }, [settled, period]);

  const changePeriod = async (next: string) => {
    const revision = editRevision.current;
    try {
      await onPeriodChange(next);
    } finally {
      setSettled({ revision, requestedPeriod: next });
    }
  };

  const clearFilters = async () => {
    const revision = ++editRevision.current;
    try {
      await onClear();
    } finally {
      setSettled({ revision });
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Vessel</Label>
        <Select value={vesselUuid} onValueChange={onVesselChange}>
          <SelectTrigger
            className="h-8 w-64 text-xs"
            data-testid="select-vessel"
          >
            <SelectValue
              placeholder={isLoading ? "Loading vessels…" : "Select vessel"}
            />
          </SelectTrigger>
          <SelectContent>
            {vessels.map((v) => (
              <SelectItem key={v.entryId} value={v.entryId}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        className="space-y-1"
        onInputCapture={trackInput}
        onChangeCapture={trackInput}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          const input =
            event.currentTarget.querySelector<HTMLInputElement>(
              'input[type="text"]',
            );
          if (
            input &&
            (!input.value.trim() || input.dataset.monthValid === "false")
          ) {
            resetPeriodInput();
          }
        }}
      >
        <Label className="text-xs text-gray-600">Period</Label>
        <FormattedDateInput
          key={periodInputKey}
          mode="month"
          ref={(node) => {
            periodInputRef.current = node;
            const focus = restoreFocus.current;
            if (!node || !focus) return;
            restoreFocus.current = null;
            const input = node.querySelector<HTMLInputElement>(
              focus.type === "month"
                ? 'input[type="month"]'
                : 'input[type="text"]',
            );
            input?.focus({ preventScroll: true });
            if (input?.type === "text" && focus.start !== null) {
              input.setSelectionRange(focus.start, focus.end ?? focus.start);
            }
          }}
          value={period}
          onChange={(event) => {
            const next = event.target.value;
            if (next) void changePeriod(next);
          }}
          className="h-8 w-44 bg-transparent text-xs md:text-xs"
          data-testid="input-period"
        />
      </div>
      {children}
      <Button
        type="button"
        variant="outline"
        className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
        onClick={() => { void clearFilters(); }}
        data-testid="button-clear-filters"
      >
        Clear
      </Button>
      {actions}
    </div>
  );
}
