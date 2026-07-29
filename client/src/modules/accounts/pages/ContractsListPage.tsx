import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { useToast } from "@/hooks/use-toast";
import { ACCOUNTS_BASE, accountsApiV2, parseApiError } from "../api/accountsApiV2";
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
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams();
  if (vesselFilter !== "__all__") params.set("vesselUuid", vesselFilter);
  if (statusFilter !== "__all__") params.set("status", statusFilter);
  const qs = params.toString();
  const listKey = [`${ACCOUNTS_BASE}/engagements${qs ? `?${qs}` : ""}`];

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: listKey });

  // Only unconfirmed rows among the selection are actionable.
  const selectedUnconfirmed = useMemo(
    () =>
      selectedUuids.filter((uuid) => {
        const row = (rows as any[]).find((r) => r.engagementUuid === uuid);
        return row && !row.seniorityAnchorConfirmed;
      }),
    [selectedUuids, rows],
  );

  const onSelectionChanged = useCallback((e: SelectionChangedEvent) => {
    const selected = e.api.getSelectedRows();
    setSelectedUuids(selected.map((r: any) => r.engagementUuid));
  }, []);

  const confirmSelected = async () => {
    if (selectedUnconfirmed.length === 0) return;
    setConfirming(true);
    try {
      const result = await accountsApiV2.engagements.confirmSeniorityAnchors(
        selectedUnconfirmed,
      );
      toast({
        title: "Seniority anchors confirmed",
        description: `${result.confirmed} contract(s) updated.`,
      });
      await queryClient.invalidateQueries({ queryKey: listKey });
      setSelectedUuids([]);
    } catch (err) {
      toast({
        title: "Confirm failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const cols: ColDef[] = useMemo(
    () => [
      {
        headerCheckboxSelection: true,
        checkboxSelection: true,
        width: 44,
        minWidth: 44,
        maxWidth: 44,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        pinned: "left" as const,
        headerName: "",
      },
      { headerName: "Crew", field: "crewName", flex: 2, minWidth: 180 },
      { headerName: "Rank", field: "rankIdAtStart", width: 100 },
      {
        headerName: "Vessel",
        flex: 2,
        minWidth: 150,
        valueGetter: (p: any) => p.data.vesselName ?? "—",
      },
      {
        headerName: "Sign On",
        field: "startDate",
        width: 115,
        valueFormatter: (p: any) => formatDate(p.value),
      },
      {
        headerName: "Sign Off",
        field: "endDate",
        width: 125,
        valueFormatter: (p: any) => (p.value ? formatDate(p.value) : "open"),
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
        valueGetter: (p: any) => p.data.scaleName ?? "—",
      },
      {
        headerName: "Seniority",
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) =>
          p.data.seniorityAnchorConfirmed ? (
            <span
              className="flex items-center gap-1 text-xs text-green-700"
              title="Seniority anchor confirmed"
            >
              <CheckCircle2 size={13} />
              Confirmed
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-xs text-amber-700 cursor-help"
              title="Seniority anchor not confirmed — engine ran on year 1 default."
            >
              <AlertTriangle size={13} />
              Unconfirmed
            </span>
          ),
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

      {/* Bulk action bar — visible when unconfirmed rows are selected */}
      {selectedUnconfirmed.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
          data-testid="bulk-confirm-bar"
        >
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            {selectedUnconfirmed.length} unconfirmed seniority anchor
            {selectedUnconfirmed.length !== 1 ? "s" : ""} selected.
          </span>
          <Button
            size="sm"
            className="ml-auto bg-amber-700 hover:bg-amber-800 text-white"
            onClick={confirmSelected}
            disabled={confirming}
            data-testid="button-confirm-seniority-anchors"
          >
            {confirming ? "Confirming…" : "Confirm seniority anchor"}
          </Button>
        </div>
      )}

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
              rowSelection: "multiple",
              suppressRowClickSelection: true,
              onSelectionChanged,
              onRowClicked: (e: any) => {
                // Don't navigate when checkbox cell is clicked
                const col = e.column?.getColId?.();
                if (col === "0") return;
                setLocation(
                  `/accounts/payroll/contracts/${e.data.engagementUuid}`,
                );
              },
              rowStyle: { cursor: "pointer" },
            }}
          />
        )}
      </div>
    </div>
  );
}
