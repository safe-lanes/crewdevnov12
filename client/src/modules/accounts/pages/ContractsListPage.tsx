import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { ColDef } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate } from "../accountsFormat";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "__all__", label: "All statuses" },
];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-600 text-white",
  draft: "bg-slate-500 text-white",
  completed: "bg-blue-600 text-white",
  settled: "bg-slate-700 text-white",
  cancelled: "bg-red-600 text-white",
};

/**
 * Contracts list — read-and-drill-in only. Contracts are created by the
 * Payroll Run "Sync from Crewing" step, never by hand, so there is no
 * create button here.
 */
export default function ContractsListPage() {
  const [, setLocation] = useLocation();
  const { vessels, isLoading: vesselsLoading } = useVesselLookup();
  const [vesselFilter, setVesselFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("active");

  const params = new URLSearchParams();
  if (vesselFilter !== "__all__") params.set("vesselUuid", vesselFilter);
  if (statusFilter !== "__all__") params.set("status", statusFilter);
  const qs = params.toString();
  const listKey = [`${ACCOUNTS_BASE}/engagements${qs ? `?${qs}` : ""}`];

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: listKey });

  const cols: ColDef[] = useMemo(
    () => [
      { headerName: "Crew", field: "crewName", flex: 2, minWidth: 180 },
      { headerName: "Rank", field: "rankIdAtStart", width: 100 },
      {
        headerName: "Vessel",
        flex: 2,
        minWidth: 150,
        valueGetter: (p) => p.data.vesselName ?? "—",
      },
      {
        headerName: "Sign On",
        field: "startDate",
        width: 115,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Sign Off",
        field: "endDate",
        width: 125,
        valueFormatter: (p) => (p.value ? formatDate(p.value) : "open"),
        cellRenderer: (p: any) => (
          <span>
            {p.data.endDate ? formatDate(p.data.endDate) : "open"}
            {p.data.endDateManual && (
              <span
                className="ml-1 text-xs text-amber-700"
                title="Sign-off date set manually — not overwritten by sync"
              >
                (manual)
              </span>
            )}
          </span>
        ),
      },
      {
        headerName: "Wage Scale",
        flex: 2,
        minWidth: 150,
        valueGetter: (p) => p.data.scaleName ?? "—",
      },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: (p: any) => (
          <Badge className={STATUS_BADGE[p.value] ?? "bg-slate-500 text-white"}>
            {p.value}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-4 space-y-4" data-testid="contracts-list-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Crew engagements — click a row to open the contract detail.
            Contracts are created by the Payroll Run sync, not here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={vesselFilter} onValueChange={setVesselFilter}>
            <SelectTrigger
              className="w-[220px]"
              data-testid="select-contracts-vessel"
            >
              <SelectValue
                placeholder={vesselsLoading ? "Loading vessels…" : "Vessel"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All vessels</SelectItem>
              {vessels.map((v: any) => (
                <SelectItem key={v.entryId} value={v.entryId}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-[160px]"
              data-testid="select-contracts-status"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-white p-2">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading contracts…
          </div>
        ) : (
          <AgGridTable
            rowData={rows}
            columnDefs={cols}
            height="560px"
            gridOptions={{
              onRowClicked: (e: any) =>
                setLocation(
                  `/accounts/payroll/contracts/${e.data.engagementUuid}`,
                ),
              rowStyle: { cursor: "pointer" },
            }}
          />
        )}
      </div>
    </div>
  );
}
