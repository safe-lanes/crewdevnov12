import { useVesselLookup } from "@/hooks/useVesselLookup";
import { Input } from "@/components/ui/input";
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
  onPeriodChange: (period: string) => void;
  children?: React.ReactNode;
}

/** Vessel + accounting-period selector shared by the payroll screens. */
export default function VesselPeriodBar({
  vesselUuid,
  period,
  onVesselChange,
  onPeriodChange,
  children,
}: VesselPeriodBarProps) {
  const { vessels, isLoading } = useVesselLookup();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Vessel</Label>
        <Select value={vesselUuid} onValueChange={onVesselChange}>
          <SelectTrigger
            className="h-9 w-64 bg-white"
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
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Period</Label>
        <Input
          type="month"
          value={period}
          onChange={(e) => e.target.value && onPeriodChange(e.target.value)}
          className="h-9 w-44 bg-white"
          data-testid="input-period"
        />
      </div>
      {children}
    </div>
  );
}
