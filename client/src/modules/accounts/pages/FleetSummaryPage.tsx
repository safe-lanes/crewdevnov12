import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatMoney } from "../accountsFormat";
import { currentPeriod, formatPeriod } from "./VesselPeriodBar";
import { useVesselLookup } from "@/hooks/useVesselLookup";

const ALL_VESSELS = "__all__";

interface FleetSummaryRow {
  vesselUuid: string;
  vesselName: string | null;
  crewCount: number;
  earnedGross: string;
  employerContributions: string;
  deductions: string;
  netPayable: string;
  settlementAccrual: string;
}

interface FleetSummary {
  period: string;
  rows: FleetSummaryRow[];
  totals: {
    crewCount: number;
    earnedGross: string;
    employerContributions: string;
    deductions: string;
    netPayable: string;
    settlementAccrual: string;
  };
}

export default function FleetSummaryPage() {
  const [vesselUuid, setVesselUuid] = useState(ALL_VESSELS);
  const [period, setPeriod] = useState(currentPeriod());
  const { vessels, isLoading: vesselsLoading } = useVesselLookup();

  const vesselParam = vesselUuid === ALL_VESSELS ? "" : vesselUuid;
  const { data, isLoading } = useQuery<FleetSummary>({
    queryKey: [
      `${ACCOUNTS_BASE}/reports/fleet-summary?period=${period}${
        vesselParam ? `&vesselUuid=${vesselParam}` : ""
      }`,
    ],
    enabled: !!period,
  });
  const rows = data?.rows ?? [];

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportExcel = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const fileName = `fleet-cost-summary-${period}`;
    if (typeof (api as any).exportDataAsExcel === "function") {
      (api as any).exportDataAsExcel({ fileName: `${fileName}.xlsx` });
    } else {
      api.exportDataAsCsv({ fileName: `${fileName}.csv` });
    }
  };

  const cols: ColDef[] = useMemo(() => {
    const money = (field: string, headerName: string, width = 150): ColDef => ({
      headerName,
      field,
      width,
      type: "rightAligned",
      valueFormatter: (p) =>
        p.value == null || Number(p.value) === 0 ? "" : formatMoney(p.value),
    });
    return [
      {
        headerName: "Vessel",
        field: "vesselName",
        pinned: "left",
        width: 220,
        valueFormatter: (p) => p.value ?? p.data?.vesselUuid ?? "",
      },
      {
        headerName: "Crew",
        field: "crewCount",
        width: 90,
        type: "rightAligned",
      },
      money("earnedGross", "Gross Earnings"),
      money("employerContributions", "Employer Contrib."),
      money("deductions", "Deductions"),
      money("netPayable", "Net Payable"),
      money("settlementAccrual", "Settlement Accruals", 160),
    ];
  }, []);

  const pinnedBottom = useMemo(
    () =>
      data && data.rows.length > 0
        ? [
            {
              vesselUuid: "",
              vesselName: "FLEET TOTAL",
              crewCount: data.totals.crewCount,
              earnedGross: data.totals.earnedGross,
              employerContributions: data.totals.employerContributions,
              deductions: data.totals.deductions,
              netPayable: data.totals.netPayable,
              settlementAccrual: data.totals.settlementAccrual,
            },
          ]
        : [],
    [data],
  );

  return (
    <div className="p-4 space-y-4" data-testid="fleet-summary-page">
      <div>
        <h1 className="text-xl font-semibold text-[#0f172a]">
          Fleet Cost Summary
        </h1>
        <p className="text-sm text-muted-foreground">
          Monthly crew cost per vessel across the fleet
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Vessel</Label>
          <Select value={vesselUuid} onValueChange={setVesselUuid}>
            <SelectTrigger
              className="h-9 w-64 bg-white"
              data-testid="select-fleet-vessel"
            >
              <SelectValue
                placeholder={vesselsLoading ? "Loading vessels…" : "All vessels"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VESSELS}>All vessels</SelectItem>
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
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="h-9 w-44 bg-white"
            data-testid="input-fleet-period"
          />
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={rows.length === 0}
            data-testid="button-export-fleet"
          >
            <Download size={14} className="mr-1" /> Export
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading fleet summary…
        </div>
      )}
      {!isLoading && rows.length === 0 && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-no-fleet-data"
        >
          No wage ledger lines for {formatPeriod(period)}.
        </div>
      )}
      {!isLoading && rows.length > 0 && (
        <div className="border rounded-md bg-white p-2">
          <AgGridTable
            rowData={rows}
            columnDefs={cols}
            onGridReady={onGridReady}
            height="440px"
            gridOptions={{ pinnedBottomRowData: pinnedBottom }}
          />
        </div>
      )}
    </div>
  );
}
