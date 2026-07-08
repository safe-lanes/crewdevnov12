import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, Scale } from "lucide-react";
import { ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatMoney } from "../accountsFormat";
import VesselPeriodBar, { currentPeriod, formatPeriod } from "./VesselPeriodBar";
import { useVesselLookup } from "@/hooks/useVesselLookup";

interface GlExportRow {
  glCode: string;
  label: string;
  elementCodes: string[];
  dr: string;
  cr: string;
}

interface GlExport {
  vesselUuid: string;
  vesselName: string | null;
  period: string;
  currency: string;
  rows: GlExportRow[];
  totals: { dr: string; cr: string; balanced: boolean };
  memo: { settlementAccrual: string; fundRemittance: string };
  warnings: string[];
  meta: {
    portageUuid: string | null;
    portageStatus: string | null;
    finalized: boolean;
  };
}

export default function GlExportPage() {
  const [, setLocation] = useLocation();
  const [vesselUuid, setVesselUuid] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const hasFilter = !!vesselUuid && !!period;
  const { getVesselName } = useVesselLookup();

  const { data, isLoading } = useQuery<GlExport>({
    queryKey: [
      `${ACCOUNTS_BASE}/reports/gl-export?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: hasFilter,
  });
  const rows = data?.rows ?? [];
  const hasLines = rows.length > 0 && Number(data?.totals.dr ?? 0) !== 0;

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportExcel = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const fileName = `gl-export-${getVesselName(vesselUuid) ?? vesselUuid}-${period}`;
    if (typeof (api as any).exportDataAsExcel === "function") {
      (api as any).exportDataAsExcel({ fileName: `${fileName}.xlsx` });
    } else {
      api.exportDataAsCsv({ fileName: `${fileName}.csv` });
    }
  };

  const cols: ColDef[] = useMemo(
    () => [
      {
        headerName: "GL Code",
        field: "glCode",
        width: 140,
        cellRenderer: (p: any) =>
          p.value === "UNMAPPED" ? (
            <span className="text-amber-600 font-semibold">{p.value}</span>
          ) : (
            p.value
          ),
      },
      { headerName: "Account", field: "label", flex: 1, minWidth: 220 },
      {
        headerName: "Elements",
        field: "elementCodes",
        width: 180,
        valueFormatter: (p) =>
          Array.isArray(p.value) ? p.value.join(", ") : "",
      },
      {
        headerName: "DR",
        field: "dr",
        width: 140,
        type: "rightAligned",
        valueFormatter: (p) =>
          p.value == null || Number(p.value) === 0 ? "" : formatMoney(p.value),
      },
      {
        headerName: "CR",
        field: "cr",
        width: 140,
        type: "rightAligned",
        valueFormatter: (p) =>
          p.value == null || Number(p.value) === 0 ? "" : formatMoney(p.value),
      },
    ],
    [],
  );

  const pinnedBottom = useMemo(
    () =>
      data
        ? [
            {
              glCode: "TOTAL",
              label: "",
              elementCodes: [],
              dr: data.totals.dr,
              cr: data.totals.cr,
            },
          ]
        : [],
    [data],
  );

  return (
    <div className="p-4 space-y-4" data-testid="gl-export-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">GL Export</h1>
          <p className="text-sm text-muted-foreground">
            DR/CR journal of the month's portage bill — for accounts use only
          </p>
        </div>
        {hasFilter && data && hasLines && (
          <div className="flex items-center gap-2">
            <Badge
              className={
                data.meta.finalized
                  ? "bg-green-600 text-white"
                  : "bg-amber-500 text-white"
              }
              data-testid="badge-gl-status"
            >
              {data.meta.finalized
                ? `Finalized (${data.meta.portageStatus})`
                : "DRAFT — portage bill not approved"}
            </Badge>
            <Badge
              variant="outline"
              className={
                data.totals.balanced
                  ? "border-green-600 text-green-700 gap-1"
                  : "border-red-600 text-red-700 gap-1"
              }
              data-testid="badge-gl-balance"
            >
              <Scale size={12} />
              {data.totals.balanced
                ? `Balanced: DR ${formatMoney(data.totals.dr)} = CR ${formatMoney(data.totals.cr)}`
                : `OUT OF BALANCE: DR ${formatMoney(data.totals.dr)} ≠ CR ${formatMoney(data.totals.cr)}`}
            </Badge>
          </div>
        )}
      </div>

      <VesselPeriodBar
        vesselUuid={vesselUuid}
        period={period}
        onVesselChange={setVesselUuid}
        onPeriodChange={setPeriod}
      >
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={!hasLines}
            data-testid="button-export-gl"
          >
            <Download size={14} className="mr-1" /> Export
          </Button>
        </div>
      </VesselPeriodBar>

      {hasFilter && data && data.warnings.length > 0 && hasLines && (
        <div
          className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm text-amber-800 space-y-1"
          data-testid="banner-gl-warnings"
        >
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                {w}{" "}
                {w.includes("Pay Elements Library") && (
                  <button
                    className="underline font-medium"
                    onClick={() =>
                      setLocation("/accounts/master-tables/pay-elements")
                    }
                    data-testid="link-pay-elements"
                  >
                    Open Pay Elements Library
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          Select a vessel and period to generate the GL journal.
        </div>
      )}
      {hasFilter && isLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Building GL journal…
        </div>
      )}
      {hasFilter && !isLoading && data && !hasLines && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-no-gl-lines"
        >
          No wage ledger lines for {formatPeriod(period)}. Run the calculation
          from the Payroll Run screen first.
        </div>
      )}
      {hasFilter && !isLoading && data && hasLines && (
        <div className="border rounded-md bg-white">
          <div className="px-4 py-3 border-b text-center">
            <div className="font-semibold">
              GL JOURNAL — {data.vesselName ?? getVesselName(vesselUuid) ?? ""} —{" "}
              {formatPeriod(period)}
            </div>
            <div className="text-xs text-muted-foreground">
              Currency: {data.currency} · Memo: settlement accruals{" "}
              {formatMoney(data.memo.settlementAccrual)} · fund remittances{" "}
              {formatMoney(data.memo.fundRemittance)} (not journaled)
            </div>
          </div>
          <div className="p-2">
            <AgGridTable
              rowData={rows}
              columnDefs={cols}
              onGridReady={onGridReady}
              height="440px"
              gridOptions={{ pinnedBottomRowData: pinnedBottom }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
