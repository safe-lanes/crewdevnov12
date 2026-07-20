import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import VesselPeriodBar, { formatPeriod } from "./VesselPeriodBar";
import { useVesselPeriod } from "../vesselPeriodStore";
import { useVesselLookup } from "@/hooks/useVesselLookup";

interface PayslipLine {
  ledgerUuid: string;
  elementCode: string;
  elementName: string;
  rankId: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  daysServed: string | null;
  qty: string | null;
  rate: string | null;
  amount: string;
  currency: string;
  isAdjustment: boolean;
  isLeave: boolean;
}

interface Payslip {
  crewUuid: string;
  crewName: string;
  rankId: string | null;
  engagementUuid: string;
  engagementStart: string | null;
  engagementEnd: string | null;
  vesselUuid: string | null;
  vesselName: string | null;
  period: string;
  wagePeriodFrom: string | null;
  wagePeriodTo: string | null;
  daysServed: string;
  currency: string;
  sections: {
    earnings: PayslipLine[];
    deductions: PayslipLine[];
    settlementAccruals: PayslipLine[];
    fundRemittances: PayslipLine[];
  };
  totals: {
    earnedGross: string;
    deductions: string;
    netOnBoard: string;
    settlementAccrual: string;
    fundRemittance: string;
    balanceBf: string;
    balanceCf: string;
    leaveBf: string;
    leaveThisMonth: string;
    leaveCf: string;
  };
  meta: {
    portageUuid: string | null;
    portageStatus: string | null;
    isDraft: boolean;
  };
}

interface PayslipBatch {
  vesselUuid: string;
  vesselName: string | null;
  period: string;
  portageStatus: string | null;
  isDraft: boolean;
  payslips: Payslip[];
}

function SectionTable({
  title,
  note,
  lines,
  testId,
  rankLabel,
}: {
  title: string;
  note?: string;
  lines: PayslipLine[];
  testId: string;
  rankLabel: (rankId: string | null) => string | null;
}) {
  if (lines.length === 0) return null;
  const subtotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between border-b border-slate-300 pb-1 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </span>
        {note && <span className="text-[10px] italic text-slate-500">{note}</span>}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase text-slate-400">
            <th className="text-left font-medium py-0.5">Element</th>
            <th className="text-left font-medium w-40">Period</th>
            <th className="text-right font-medium w-12">Days</th>
            <th className="text-right font-medium w-12">Qty</th>
            <th className="text-right font-medium w-16">Rate</th>
            <th className="text-right font-medium w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.ledgerUuid} className="border-b border-slate-100">
              <td className={`py-0.5 ${l.isLeave ? "font-semibold" : ""}`}>
                {l.elementName}
                {l.elementCode && l.elementCode !== l.elementName
                  ? ` (${l.elementCode})`
                  : ""}
                {l.isAdjustment ? " — adjustment" : ""}
                {l.rankId ? (
                  <span className="text-slate-400" title={l.rankId}>
                    {" "}
                    · {rankLabel(l.rankId)}
                  </span>
                ) : null}
              </td>
              <td>
                {l.periodFrom || l.periodTo
                  ? `${formatDate(l.periodFrom)} – ${formatDate(l.periodTo)}`
                  : ""}
              </td>
              <td className="text-right">{l.daysServed ?? ""}</td>
              <td className="text-right">
                {l.qty != null && Number(l.qty) !== 1 ? l.qty : ""}
              </td>
              <td className="text-right">{l.rate != null ? formatMoney(l.rate) : ""}</td>
              <td className="text-right tabular-nums">{formatMoney(l.amount)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} className="py-0.5 text-right text-[10px] uppercase text-slate-500">
              Subtotal
            </td>
            <td className="text-right font-semibold tabular-nums">
              {formatMoney(subtotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PayslipStatement({
  p,
  pageBreak,
  rankLabel,
}: {
  p: Payslip;
  pageBreak: boolean;
  rankLabel: (rankId: string | null) => string | null;
}) {
  return (
    <div
      className={`payslip-statement relative bg-white border rounded-md mb-6 ${
        pageBreak ? "payslip-break" : ""
      }`}
      data-testid={`payslip-statement-${p.crewUuid}`}
    >
      {p.meta.isDraft && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            className="text-[90px] font-black text-red-200/60 rotate-[-20deg] select-none"
            data-testid={`watermark-draft-${p.crewUuid}`}
          >
            DRAFT
          </span>
        </div>
      )}
      <table className="payslip-table w-full">
        <thead>
          <tr>
            <td>
              <div className="px-6 pt-4 pb-2 border-b">
                <div className="flex justify-between text-sm font-semibold text-[#0f172a]">
                  <span data-testid={`text-payslip-crew-${p.crewUuid}`}>
                    {p.crewName}
                    {p.rankId ? (
                      <span title={p.rankId}> · {rankLabel(p.rankId)}</span>
                    ) : null}
                  </span>
                  <span>Monthly Wage Account — {formatPeriod(p.period)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                  <span>{p.vesselName ?? ""}</span>
                  <span>MLC 2006 Standard A2.2 · Currency: {p.currency}</span>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="px-6 py-1.5 border-t text-[10px] text-slate-400 flex justify-between">
                <span>
                  {p.crewName} — {formatPeriod(p.period)}
                </span>
                <span>{p.vesselName ?? ""}</span>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <div className="px-6 py-3 space-y-4">
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Engagement</div>
                    <div data-testid={`text-engagement-dates-${p.crewUuid}`}>
                      {formatDate(p.engagementStart)} –{" "}
                      {p.engagementEnd ? formatDate(p.engagementEnd) : "onboard"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Wage period</div>
                    <div>
                      {formatDate(p.wagePeriodFrom)} – {formatDate(p.wagePeriodTo)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Days served</div>
                    <div data-testid={`text-days-served-${p.crewUuid}`}>{p.daysServed}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Status</div>
                    <div>
                      {p.meta.isDraft
                        ? "Draft — not approved"
                        : `Final (${p.meta.portageStatus})`}
                    </div>
                  </div>
                </div>

                <SectionTable
                  title="Earnings (paid on board)"
                  lines={p.sections.earnings}
                  testId={`section-earnings-${p.crewUuid}`}
                  rankLabel={rankLabel}
                />
                <SectionTable
                  title="Deductions"
                  lines={p.sections.deductions}
                  testId={`section-deductions-${p.crewUuid}`}
                  rankLabel={rankLabel}
                />
                <SectionTable
                  title="Settlement accruals"
                  note="Accrued for final settlement — not payable on board this month"
                  lines={p.sections.settlementAccruals}
                  testId={`section-accruals-${p.crewUuid}`}
                  rankLabel={rankLabel}
                />
                <SectionTable
                  title="Fund remittances"
                  note="Remitted by the employer — not payable to seafarer"
                  lines={p.sections.fundRemittances}
                  testId={`section-fund-${p.crewUuid}`}
                  rankLabel={rankLabel}
                />

                <div className="grid grid-cols-3 gap-6 border-t pt-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Gross earned</span>
                      <span className="tabular-nums" data-testid={`text-gross-${p.crewUuid}`}>
                        {formatMoney(p.totals.earnedGross)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total deductions</span>
                      <span className="tabular-nums" data-testid={`text-deductions-${p.crewUuid}`}>
                        {formatMoney(p.totals.deductions)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Net payable on board</span>
                      <span className="tabular-nums" data-testid={`text-net-${p.crewUuid}`}>
                        {formatMoney(p.totals.netOnBoard)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Balance B/F</span>
                      <span className="tabular-nums">{formatMoney(p.totals.balanceBf)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Balance C/F</span>
                      <span className="tabular-nums" data-testid={`text-balance-cf-${p.crewUuid}`}>
                        {formatMoney(p.totals.balanceCf)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Settlement accrual</span>
                      <span className="tabular-nums">
                        {formatMoney(p.totals.settlementAccrual)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Fund remittances</span>
                      <span className="tabular-nums">
                        {formatMoney(p.totals.fundRemittance)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase text-slate-400">Leave ledger</div>
                    <div className="flex justify-between">
                      <span>Leave B/F</span>
                      <span className="tabular-nums">{formatMoney(p.totals.leaveBf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accrued this month</span>
                      <span className="tabular-nums">
                        {formatMoney(p.totals.leaveThisMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Leave C/F</span>
                      <span className="tabular-nums" data-testid={`text-leave-cf-${p.crewUuid}`}>
                        {formatMoney(p.totals.leaveCf)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-16 pt-8 pb-2 text-xs text-slate-600">
                  <div
                    className="border-t pt-2 text-center"
                    data-testid={`signature-seafarer-${p.crewUuid}`}
                  >
                    Received by Seafarer
                  </div>
                  <div className="border-t pt-2 text-center">
                    For the Master / Company
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function PayslipsPage() {
  const { vesselUuid, setVesselUuid, period, setPeriod } = useVesselPeriod();
  const [view, setView] = useState<
    { mode: "list" } | { mode: "single"; engagementUuid: string } | { mode: "all" }
  >({ mode: "list" });
  const hasFilter = !!vesselUuid && !!period;
  const { getVesselName } = useVesselLookup();

  const { data, isLoading } = useQuery<PayslipBatch>({
    queryKey: [
      `${ACCOUNTS_BASE}/reports/payslips?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: hasFilter,
  });
  const payslips = data?.payslips ?? [];

  const { data: companyRanks = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/company-ranks"],
  });
  const rankNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of companyRanks) m.set(r.rankId, r.rank);
    return m;
  }, [companyRanks]);
  const rankLabel = (rankId: string | null) =>
    rankId ? (rankNameById.get(rankId) ?? rankId) : null;

  // Isolate the statement area when the browser prints.
  useEffect(() => {
    if (view.mode === "list") return;
    document.body.classList.add("payslip-printing");
    return () => document.body.classList.remove("payslip-printing");
  }, [view.mode]);

  useEffect(() => {
    setView({ mode: "list" });
  }, [vesselUuid, period]);

  const shown = useMemo(() => {
    if (view.mode === "single") {
      return payslips.filter((p) => p.engagementUuid === view.engagementUuid);
    }
    if (view.mode === "all") return payslips;
    return [];
  }, [view, payslips]);

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const exportExcel = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const fileName = `payslips-${getVesselName(vesselUuid) ?? vesselUuid}-${period}`;
    if (typeof (api as any).exportDataAsExcel === "function") {
      (api as any).exportDataAsExcel({ fileName: `${fileName}.xlsx` });
    } else {
      api.exportDataAsCsv({ fileName: `${fileName}.csv` });
    }
  };

  const cols: ColDef[] = useMemo(() => {
    const money = (field: string, headerName: string, width = 120): ColDef => ({
      headerName,
      field,
      width,
      type: "rightAligned",
      valueFormatter: (p) => (p.value == null ? "" : formatMoney(p.value)),
    });
    return [
      { headerName: "Crew", field: "crewName", pinned: "left", width: 180 },
      {
        headerName: "Rank",
        field: "rankId",
        width: 110,
        valueFormatter: (p) =>
          p.value ? (rankNameById.get(p.value) ?? p.value) : "",
        tooltipValueGetter: (p) => p.data?.rankId ?? "",
      },
      {
        headerName: "Days",
        field: "daysServed",
        width: 80,
        type: "rightAligned",
      },
      money("earnedGross", "Gross"),
      money("deductions", "Deductions"),
      money("netOnBoard", "Net On Board", 130),
      money("balanceCf", "Balance C/F"),
      {
        headerName: "Status",
        field: "isDraft",
        width: 90,
        cellRenderer: (p: any) =>
          p.value ? (
            <span className="text-amber-600 font-medium">Draft</span>
          ) : (
            <span className="text-green-700 font-medium">Final</span>
          ),
      },
      {
        headerName: "",
        field: "engagementUuid",
        width: 130,
        sortable: false,
        cellRenderer: (p: any) => (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() =>
              setView({ mode: "single", engagementUuid: p.value })
            }
            data-testid={`button-view-payslip-${p.data.crewUuid}`}
          >
            View payslip
          </Button>
        ),
      },
    ];
  }, [rankNameById]);

  const rows = useMemo(
    () =>
      payslips.map((p) => ({
        crewUuid: p.crewUuid,
        crewName: p.crewName,
        rankId: p.rankId,
        daysServed: p.daysServed,
        earnedGross: p.totals.earnedGross,
        deductions: p.totals.deductions,
        netOnBoard: p.totals.netOnBoard,
        balanceCf: p.totals.balanceCf,
        isDraft: p.meta.isDraft,
        engagementUuid: p.engagementUuid,
      })),
    [payslips],
  );

  const pinnedBottom = useMemo(
    () => [
      {
        crewName: "TOTAL",
        rankId: "",
        daysServed: null,
        earnedGross: rows.reduce((s, r) => s + Number(r.earnedGross || 0), 0),
        deductions: rows.reduce((s, r) => s + Number(r.deductions || 0), 0),
        netOnBoard: rows.reduce((s, r) => s + Number(r.netOnBoard || 0), 0),
        balanceCf: rows.reduce((s, r) => s + Number(r.balanceCf || 0), 0),
        isDraft: null,
        engagementUuid: null,
      },
    ],
    [rows],
  );

  return (
    <div className="p-4 space-y-4" data-testid="payslips-page">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Payslips</h1>
          <p className="text-sm text-muted-foreground">
            Monthly wage account per seafarer (MLC A2.2)
          </p>
        </div>
        {hasFilter && data && (
          <Badge
            className={
              data.isDraft ? "bg-amber-500 text-white" : "bg-green-600 text-white"
            }
            data-testid="badge-payslips-status"
          >
            {data.isDraft ? "DRAFT — portage bill not approved" : "Final"}
          </Badge>
        )}
      </div>

      {view.mode === "list" && (
        <>
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
                data-testid="button-export-payslips"
              >
                <Download size={14} className="mr-1" /> Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setView({ mode: "all" });
                  setTimeout(() => window.print(), 400);
                }}
                disabled={payslips.length === 0}
                data-testid="button-print-all-payslips"
              >
                <Printer size={14} className="mr-1" /> Print all
              </Button>
            </div>
          </VesselPeriodBar>

          {!hasFilter && (
            <div
              className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
              data-testid="text-select-prompt"
            >
              Select a vessel and period to view payslips.
            </div>
          )}
          {hasFilter && isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading payslips…
            </div>
          )}
          {hasFilter && !isLoading && payslips.length === 0 && (
            <div
              className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
              data-testid="text-no-payslips"
            >
              No wage ledger lines for {formatPeriod(period)}. Run the
              calculation from the Payroll Run screen first.
            </div>
          )}
          {hasFilter && !isLoading && payslips.length > 0 && (
            <div className="border rounded-md bg-white p-2">
              <AgGridTable
                rowData={rows}
                columnDefs={cols}
                onGridReady={onGridReady}
                height="480px"
                gridOptions={{ pinnedBottomRowData: pinnedBottom }}
              />
            </div>
          )}
        </>
      )}

      {view.mode !== "list" && (
        <>
          <div className="flex gap-2 print:hidden">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView({ mode: "list" })}
              data-testid="button-back-to-list"
            >
              <ArrowLeft size={14} className="mr-1" /> Back to list
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              data-testid="button-print-payslip"
            >
              <Printer size={14} className="mr-1" /> Print
            </Button>
          </div>
          <div className="payslip-print-area max-w-4xl">
            {shown.map((p, i) => (
              <PayslipStatement
                key={p.engagementUuid}
                p={p}
                pageBreak={i > 0}
                rankLabel={rankLabel}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
