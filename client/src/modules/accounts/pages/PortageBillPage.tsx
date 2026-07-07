import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { usePermissions } from "@/contexts/PermissionsContext";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Lock } from "lucide-react";
import { ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import VesselPeriodBar, { currentPeriod, formatPeriod } from "./VesselPeriodBar";
import { useVesselLookup } from "@/hooks/useVesselLookup";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  vessel_draft: "Vessel Draft",
  submitted: "Submitted",
  office_review: "Office Review",
  returned: "Returned",
  approved: "Approved",
  locked: "Locked",
};

export default function PortageBillPage() {
  const { canView } = usePermissions();
  void canView; // page-level access handled by AccountsModule

  const [vesselUuid, setVesselUuid] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const hasFilter = !!vesselUuid && !!period;
  const { getVesselName } = useVesselLookup();

  const { data: workspace, isLoading: wsLoading } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`],
    enabled: hasFilter,
  });
  const { data: reviewRows = [] } = useQuery<any[]>({
    queryKey: [
      `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: hasFilter,
  });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });

  const portage = workspace?.portage ?? null;
  const crewTotals: any[] = workspace?.crewTotals ?? [];
  const status: string = portage?.status ?? "open";
  const isFinal = status === "approved" || status === "locked";

  const { data: ledgerLines = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/ledger?portageUuid=${portage?.portageUuid}`],
    enabled: !!portage?.portageUuid,
  });

  const crewByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of reviewRows) m.set(r.crewUuid, r);
    return m;
  }, [reviewRows]);

  // Elements that appear on the portage bill, in configured order.
  const portageElements = useMemo(
    () =>
      payElements
        .filter(
          (e) =>
            e.showsOnPortage !== false &&
            ledgerLines.some((l) => l.payElementUuid === e.payElementUuid),
        )
        .sort(
          (a, b) =>
            (a.type === b.type ? 0 : a.type === "earning" ? -1 : 1) ||
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.code).localeCompare(String(b.code)),
        ),
    [payElements, ledgerLines],
  );

  // crewUuid -> payElementUuid -> summed amount
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const l of ledgerLines) {
      if (l.isDeleted) continue;
      let inner = m.get(l.crewUuid);
      if (!inner) {
        inner = new Map();
        m.set(l.crewUuid, inner);
      }
      inner.set(
        l.payElementUuid,
        (inner.get(l.payElementUuid) ?? 0) + Number(l.amount || 0),
      );
    }
    return m;
  }, [ledgerLines]);

  const rows = useMemo(
    () =>
      crewTotals.map((t) => {
        const review = crewByUuid.get(t.crewUuid);
        const amounts = matrix.get(t.crewUuid) ?? new Map();
        const row: Record<string, any> = {
          crewUuid: t.crewUuid,
          crewName: review?.crewName ?? t.crewUuid,
          rank: t.rankId ?? review?.presentRank ?? "",
          signOn: review?.signOnDate ?? "",
          signOff: review?.signOffDate ?? "",
          earnedGross: Number(t.earnedGross || 0),
          deductions: Number(t.deductions || 0),
          netOnBoard: Number(t.netOnBoard || 0),
          balanceBf: Number(t.balanceBf || 0),
          balanceCf: Number(t.balanceCf || 0),
          leaveCf: Number(t.leaveCf || 0),
        };
        for (const e of portageElements) {
          row[`el_${e.payElementUuid}`] = amounts.get(e.payElementUuid) ?? null;
        }
        return row;
      }),
    [crewTotals, crewByUuid, matrix, portageElements],
  );

  const totals = useMemo(() => {
    const t: Record<string, number> = {
      earnedGross: 0,
      deductions: 0,
      netOnBoard: 0,
      balanceBf: 0,
      balanceCf: 0,
      leaveCf: 0,
    };
    for (const e of portageElements) t[`el_${e.payElementUuid}`] = 0;
    for (const r of rows) {
      for (const k of Object.keys(t)) t[k] += Number(r[k] ?? 0);
    }
    return t;
  }, [rows, portageElements]);

  const gridApiRef = useRef<GridApi | null>(null);

  const cols: ColDef[] = useMemo(() => {
    const money = (field: string, headerName: string, width = 110): ColDef => ({
      headerName,
      field,
      width,
      type: "rightAligned",
      valueFormatter: (p) =>
        p.value == null || p.value === 0 ? "" : formatMoney(p.value),
    });
    return [
      {
        headerName: "Crew",
        field: "crewName",
        pinned: "left",
        width: 170,
      },
      { headerName: "Rank", field: "rank", pinned: "left", width: 80 },
      {
        headerName: "Sign On",
        field: "signOn",
        width: 105,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Sign Off",
        field: "signOff",
        width: 105,
        valueFormatter: (p) => formatDate(p.value),
      },
      ...portageElements.map((e) =>
        money(`el_${e.payElementUuid}`, e.code || e.name, 105),
      ),
      money("earnedGross", "Gross", 115),
      money("deductions", "Deductions", 115),
      money("netOnBoard", "Net On Board", 125),
      money("balanceBf", "Balance B/F", 115),
      money("balanceCf", "Balance C/F", 115),
      money("leaveCf", "Leave C/F", 105),
    ];
  }, [portageElements]);

  const pinnedBottom = useMemo(
    () => [
      {
        crewName: "TOTAL",
        rank: "",
        signOn: null,
        signOff: null,
        ...totals,
      },
    ],
    [totals],
  );

  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportExcel = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const fileName = `portage-bill-${getVesselName(vesselUuid) ?? vesselUuid}-${period}`;
    if (typeof (api as any).exportDataAsExcel === "function") {
      (api as any).exportDataAsExcel({ fileName: `${fileName}.xlsx` });
    } else {
      api.exportDataAsCsv({ fileName: `${fileName}.csv` });
    }
  };

  return (
    <div className="p-4 space-y-4 relative" data-testid="portage-bill-page">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Portage Bill</h1>
          <p className="text-sm text-muted-foreground">
            Monthly wage statement per vessel
          </p>
        </div>
        {hasFilter && portage && (
          <div className="flex items-center gap-2">
            <Badge
              className={
                isFinal ? "bg-green-600 text-white" : "bg-blue-600 text-white"
              }
              data-testid="badge-portage-bill-status"
            >
              {STATUS_LABEL[status] ?? status}
            </Badge>
            {status === "locked" && (
              <Badge variant="outline" className="gap-1">
                <Lock size={12} />
                {portage.lockedDate ? formatDate(portage.lockedDate) : "Locked"}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="print:hidden">
        <VesselPeriodBar
          vesselUuid={vesselUuid}
          period={period}
          onVesselChange={setVesselUuid}
          onPeriodChange={setPeriod}
        >
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              disabled={rows.length === 0}
              data-testid="button-export-portage"
            >
              <Download size={14} className="mr-1" /> Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              disabled={rows.length === 0}
              data-testid="button-print-portage"
            >
              <Printer size={14} className="mr-1" /> Print
            </Button>
          </div>
        </VesselPeriodBar>
      </div>

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          Select a vessel and period to view the portage bill.
        </div>
      )}

      {hasFilter && wsLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading portage bill…
        </div>
      )}

      {hasFilter && !wsLoading && !portage && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-no-portage"
        >
          No portage bill exists for {formatPeriod(period)}. Run the
          calculation from the Payroll Run screen first.
        </div>
      )}

      {hasFilter && !wsLoading && portage && (
        <div className="relative border rounded-md bg-white">
          {!isFinal && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              data-testid="watermark-draft"
            >
              <span className="text-[90px] font-black text-red-200/60 rotate-[-20deg] select-none">
                DRAFT
              </span>
            </div>
          )}
          <div className="px-4 py-3 border-b text-center">
            <div className="font-semibold">
              PORTAGE BILL — {getVesselName(vesselUuid) ?? ""} —{" "}
              {formatPeriod(period)}
            </div>
            <div className="text-xs text-muted-foreground">
              Currency: {portage.currency ?? "USD"} · Crew: {rows.length} ·
              Status: {STATUS_LABEL[status] ?? status}
            </div>
          </div>
          <div className="p-2">
            <AgGridTable
              rowData={rows}
              columnDefs={cols}
              onGridReady={onGridReady}
              height="480px"
              gridOptions={{ pinnedBottomRowData: pinnedBottom }}
            />
          </div>
          <div className="grid grid-cols-3 gap-8 px-8 py-6 text-xs text-slate-600">
            <div className="border-t pt-2 text-center">
              Prepared By (Master)
            </div>
            <div className="border-t pt-2 text-center">Checked By</div>
            <div className="border-t pt-2 text-center">
              Approved By (Owners/Managers)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
