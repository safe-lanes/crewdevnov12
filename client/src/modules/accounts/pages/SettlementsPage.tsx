import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { usePermissions } from "@/contexts/PermissionsContext";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Check,
  Download,
  Lock,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { ACCOUNTS_BASE, accountsApiV2 } from "../api/accountsApiV2";
import { formatDate, formatMoney, unknownVesselLabel } from "../accountsFormat";
import { formatPeriod } from "./VesselPeriodBar";
import { useVesselLookup } from "@/hooks/useVesselLookup";

const MENU = "Account Settlements";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  paid: "Paid",
  locked: "Locked",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paid: "bg-blue-100 text-blue-800 border-blue-200",
  locked: "bg-slate-800 text-white border-slate-800",
};

function statusBadge(status: string) {
  return (
    <Badge
      variant="outline"
      className={STATUS_CLASS[status] ?? ""}
      data-testid={`badge-status-${status}`}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

const EMPTY_ADJ = {
  adjustmentUuid: "",
  payElementUuid: "",
  type: "earning",
  amount: "",
  remarks: "",
};

export default function SettlementsPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, userId, userType } = usePermissions();
  const isOfficeUser = (userType ?? "").toLowerCase() !== "ship";
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);
  const mayDelete = canDelete(MENU);
  const { getVesselName } = useVesselLookup();

  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [filterVessel, setFilterVessel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approverNames, setApproverNames] = useState("");
  const [paidOpen, setPaidOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ ...EMPTY_ADJ });
  const [decisionComments, setDecisionComments] = useState<
    Record<string, string>
  >({});

  const listKey = [`${ACCOUNTS_BASE}/settlements`];
  const detailKey = [`${ACCOUNTS_BASE}/settlements/${selectedUuid}`];

  const { data: companyRanks = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/company-ranks"],
  });
  const rankNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of companyRanks) m.set(r.rankId, r.rank);
    return m;
  }, [companyRanks]);
  const rankLabel = (rankId: string | null | undefined) =>
    rankId ? (rankNameById.get(rankId) ?? rankId) : "";

  const { data: listData, isLoading: listLoading } = useQuery<any>({
    queryKey: listKey,
  });
  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: detailKey,
    enabled: !!selectedUuid,
  });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });

  const manualElements = useMemo(
    () =>
      payElements.filter((e: any) => e.calcMethod === "manual_entry"),
    [payElements],
  );
  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of payElements) m.set(e.payElementUuid, e);
    return m;
  }, [payElements]);

  const settlements: any[] = listData?.settlements ?? [];
  const eligibleEngagements: any[] = listData?.eligibleEngagements ?? [];

  const vesselOptions = useMemo(() => {
    const uuids = Array.from(
      new Set(settlements.map((s) => s.vesselUuid).filter(Boolean)),
    ) as string[];
    const nameByUuid = new Map<string, string>();
    for (const s of settlements) {
      if (s.vesselUuid && !nameByUuid.has(s.vesselUuid)) {
        const name = s.vesselName ?? getVesselName(s.vesselUuid);
        if (name) nameByUuid.set(s.vesselUuid, name);
      }
    }
    // Only offer vessels that resolve to a real name.
    return uuids
      .filter((u) => nameByUuid.has(u))
      .map((u) => ({ uuid: u, name: nameByUuid.get(u)! }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [settlements, getVesselName]);

  const filteredRows = useMemo(
    () =>
      settlements.filter(
        (s) =>
          (filterVessel === "all" || s.vesselUuid === filterVessel) &&
          (filterStatus === "all" || s.status === filterStatus),
      ),
    [settlements, filterVessel, filterStatus],
  );

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };
  const exportExcel = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const fileName = `final-settlements-${new Date().toISOString().slice(0, 10)}`;
    if (typeof (api as any).exportDataAsExcel === "function") {
      (api as any).exportDataAsExcel({ fileName: `${fileName}.xlsx` });
    } else {
      api.exportDataAsCsv({ fileName: `${fileName}.csv` });
    }
  };

  const columns: ColDef[] = useMemo(
    () => [
      { headerName: "Crew", field: "crewName", flex: 1.4, minWidth: 150 },
      {
        headerName: "Rank",
        field: "rankIdAtStart",
        width: 110,
        valueFormatter: (p) =>
          p.value ? (rankNameById.get(p.value) ?? p.value) : "",
        tooltipValueGetter: (p) => p.data?.rankIdAtStart ?? "",
      },
      {
        headerName: "Vessel",
        field: "vesselUuid",
        flex: 1,
        minWidth: 120,
        valueFormatter: (p) =>
          p.value
            ? p.data?.vesselName ??
              getVesselName(p.value) ??
              unknownVesselLabel(p.value)
            : "",
      },
      {
        headerName: "Sign On",
        field: "engagementStartDate",
        width: 110,
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ""),
      },
      {
        headerName: "Sign Off",
        field: "engagementEndDate",
        width: 110,
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ""),
      },
      {
        headerName: "Final Period",
        field: "period",
        width: 110,
        valueFormatter: (p) => (p.value ? formatPeriod(p.value) : ""),
      },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: any) => STATUS_LABEL[p.value] ?? p.value,
      },
      {
        headerName: "Balance Paid",
        field: "balancePaid",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Accruals",
        field: "accrualsPaid",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Adj (+)",
        field: "adjustmentsEarnings",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Adj (−)",
        field: "adjustmentsDeductions",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Net Payable",
        field: "netPayable",
        width: 120,
        type: "rightAligned",
        cellClass: "font-semibold",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Paid Date",
        field: "paidDate",
        width: 110,
        valueFormatter: (p) => (p.value ? formatDate(p.value) : ""),
      },
    ],
    [getVesselName, rankNameById],
  );

  const refresh = (uuid?: string | null) => {
    queryClient.invalidateQueries({ queryKey: listKey });
    if (uuid ?? selectedUuid) {
      queryClient.invalidateQueries({
        queryKey: [`${ACCOUNTS_BASE}/settlements/${uuid ?? selectedUuid}`],
      });
    }
  };

  const onError = (e: any) =>
    toast({
      title: "Error",
      description: e?.message ?? "Request failed",
      variant: "destructive",
    });

  const computeMut = useMutation({
    mutationFn: (engagementUuid: string) =>
      accountsApiV2.settlements.compute(engagementUuid),
    onSuccess: (res: any) => {
      const newUuid = res?.settlement?.settlementUuid ?? null;
      refresh(newUuid);
      setNewOpen(false);
      if (newUuid) setSelectedUuid(newUuid);
      toast({ title: "Settlement computed" });
    },
    onError,
  });

  const recomputeMut = useMutation({
    mutationFn: () => accountsApiV2.settlements.recompute(selectedUuid!),
    onSuccess: () => {
      refresh();
      toast({ title: "Settlement recomputed" });
    },
    onError,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      accountsApiV2.settlements.submit(
        selectedUuid!,
        approverNames
          .split("\n")
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ approver: n })),
      ),
    onSuccess: () => {
      refresh();
      setSubmitOpen(false);
      setApproverNames("");
      toast({ title: "Submitted for approval" });
    },
    onError,
  });

  const decideMut = useMutation({
    mutationFn: (args: {
      approvalUuid: string;
      decision: "Approved" | "Rejected";
    }) =>
      accountsApiV2.settlements.decide(
        args.approvalUuid,
        args.decision,
        decisionComments[args.approvalUuid] || null,
      ),
    onSuccess: () => {
      refresh();
      toast({ title: "Decision recorded" });
    },
    onError,
  });

  const markPaidMut = useMutation({
    mutationFn: () =>
      accountsApiV2.settlements.markPaid(
        selectedUuid!,
        paidDate,
        paymentReference.trim() || null,
      ),
    onSuccess: () => {
      refresh();
      setPaidOpen(false);
      toast({ title: "Settlement marked paid" });
    },
    onError,
  });

  const lockMut = useMutation({
    mutationFn: () => accountsApiV2.settlements.lock(selectedUuid!),
    onSuccess: () => {
      refresh();
      toast({ title: "Settlement locked" });
    },
    onError,
  });

  const revertMut = useMutation({
    mutationFn: () => accountsApiV2.settlements.revertToDraft(selectedUuid!),
    onSuccess: () => {
      refresh();
      toast({ title: "Reverted to draft" });
    },
    onError,
  });

  const adjSaveMut = useMutation({
    mutationFn: () => {
      const data = {
        payElementUuid: adjForm.payElementUuid,
        type: adjForm.type,
        amount: adjForm.amount,
        remarks: adjForm.remarks.trim() || null,
      };
      return adjForm.adjustmentUuid
        ? accountsApiV2.settlements.updateAdjustment(adjForm.adjustmentUuid, data)
        : accountsApiV2.settlements.addAdjustment(selectedUuid!, data);
    },
    onSuccess: () => {
      refresh();
      setAdjOpen(false);
      setAdjForm({ ...EMPTY_ADJ });
      toast({ title: "Adjustment saved" });
    },
    onError,
  });

  const adjDeleteMut = useMutation({
    mutationFn: (adjustmentUuid: string) =>
      accountsApiV2.settlements.deleteAdjustment(adjustmentUuid),
    onSuccess: () => {
      refresh();
      toast({ title: "Adjustment removed" });
    },
    onError,
  });

  /* ---------------------------------------------------------------- */
  /* List view                                                        */
  /* ---------------------------------------------------------------- */
  if (!selectedUuid) {
    return (
      <div className="p-4 space-y-4" data-testid="settlements-page">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Final Settlements</h1>
            <p className="text-sm text-muted-foreground">
              Final wage settlements for signed-off crew engagements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              data-testid="button-export-settlements"
            >
              <Download size={14} className="mr-1" /> Export
            </Button>
            {mayCreate && (
              <Button
                size="sm"
                className="bg-[#16569e] hover:bg-[#1e5fa8]"
                onClick={() => setNewOpen(true)}
                data-testid="button-new-settlement"
              >
                <Plus size={14} className="mr-1" /> New Settlement
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterVessel} onValueChange={setFilterVessel}>
            <SelectTrigger
              className="w-[200px] h-9"
              data-testid="select-filter-vessel"
            >
              <SelectValue placeholder="All vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vessels</SelectItem>
              {vesselOptions.map((v) => (
                <SelectItem key={v.uuid} value={v.uuid}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger
              className="w-[160px] h-9"
              data-testid="select-filter-status"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {listLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading settlements…
          </div>
        ) : (
          <AgGridTable
            rowData={filteredRows}
            columnDefs={columns}
            height="520px"
            onGridReady={onGridReady}
            gridOptions={{
              onRowClicked: (e: any) =>
                setSelectedUuid(e.data.settlementUuid),
            }}
          />
        )}

        {/* New settlement picker */}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Final Settlement</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-2">
              Ended engagements without a settlement. Computing builds the
              final statement from approved payroll runs and accrued
              entitlements.
            </p>
            <div className="max-h-80 overflow-y-auto divide-y border rounded-md">
              {eligibleEngagements.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No ended engagements awaiting settlement.
                </div>
              )}
              {eligibleEngagements.map((e) => (
                <div
                  key={e.engagementUuid}
                  className="flex items-center justify-between gap-3 p-3"
                  data-testid={`row-eligible-${e.engagementUuid}`}
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {e.crewName ?? e.crewUuid}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {rankLabel(e.rankIdAtStart)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.vesselName ??
                        getVesselName(e.vesselUuid) ??
                        unknownVesselLabel(e.vesselUuid)}{" "}
                      ·{" "}
                      {formatDate(e.startDate)} → {formatDate(e.endDate)} ·
                      calculated through{" "}
                      {e.calculatedThrough
                        ? formatPeriod(e.calculatedThrough)
                        : "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={computeMut.isPending}
                    onClick={() => computeMut.mutate(e.engagementUuid)}
                    data-testid={`button-compute-${e.engagementUuid}`}
                  >
                    {computeMut.isPending ? "Computing…" : "Compute"}
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Detail view                                                      */
  /* ---------------------------------------------------------------- */
  const s = detail?.settlement;
  const snapshot = (s?.statementSnapshot ?? {}) as any;
  const engagement = detail?.engagement;
  const adjustments: any[] = detail?.adjustments ?? [];
  const approvals: any[] = detail?.approvals ?? [];
  const status: string = s?.status ?? "";
  const isDraft = status === "draft";
  const showWatermark = status === "draft" || status === "submitted";

  const byPeriod: any[] = snapshot?.balance?.byPeriod ?? [];
  const accrualItems: any[] = snapshot?.accruals?.items ?? [];
  const leaveTotal = snapshot?.accruals?.leaveTotal ?? "0.00";

  return (
    <div className="p-4 space-y-4 relative" data-testid="settlement-detail">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedUuid(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft size={14} className="mr-1" /> All settlements
          </Button>
          {s && statusBadge(status)}
          {s?.paidDate && (
            <span className="text-xs text-muted-foreground">
              Paid {formatDate(s.paidDate)}
              {s.paymentReference ? ` · Ref ${s.paymentReference}` : ""}
            </span>
          )}
        </div>
        {s && mayEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recomputeMut.isPending}
                  onClick={() => recomputeMut.mutate()}
                  data-testid="button-recompute"
                >
                  <RefreshCw
                    size={14}
                    className={`mr-1 ${recomputeMut.isPending ? "animate-spin" : ""}`}
                  />
                  Recompute
                </Button>
                <Button
                  size="sm"
                  className="bg-[#16569e] hover:bg-[#1e5fa8]"
                  onClick={() => setSubmitOpen(true)}
                  data-testid="button-submit-settlement"
                >
                  Submit for Approval
                </Button>
              </>
            )}
            {status === "submitted" && (
              <Button
                size="sm"
                variant="outline"
                disabled={revertMut.isPending}
                onClick={() => revertMut.mutate()}
                data-testid="button-revert-draft"
              >
                <Undo2 size={14} className="mr-1" /> Revert to Draft
              </Button>
            )}
            {status === "approved" && (
              <Button
                size="sm"
                className="bg-[#16569e] hover:bg-[#1e5fa8]"
                onClick={() => setPaidOpen(true)}
                data-testid="button-mark-paid"
              >
                Mark Paid
              </Button>
            )}
            {status === "paid" && (
              <Button
                size="sm"
                variant="outline"
                disabled={lockMut.isPending}
                onClick={() => lockMut.mutate()}
                data-testid="button-lock-settlement"
              >
                <Lock size={14} className="mr-1" />
                {lockMut.isPending ? "Locking…" : "Lock"}
              </Button>
            )}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.print()}
          data-testid="button-print-settlement"
        >
          <Printer size={14} className="mr-1" /> Print Statement
        </Button>
      </div>

      {detailLoading || !s ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading settlement…
        </div>
      ) : (
        <div className="relative border rounded-md bg-white p-6 space-y-6 print:border-0">
          {showWatermark && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              data-testid="watermark-draft"
            >
              <span className="text-[90px] font-bold text-slate-200/60 rotate-[-30deg] select-none">
                DRAFT
              </span>
            </div>
          )}

          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-base font-semibold">
              Final Wage Settlement Statement
            </h2>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {detail?.crewName ?? s.crewUuid}
              </span>{" "}
              · {rankLabel(engagement?.rankIdAtStart)} ·{" "}
              {engagement?.vesselUuid
                ? detail?.vesselName ??
                  getVesselName(engagement.vesselUuid) ??
                  unknownVesselLabel(engagement.vesselUuid)
                : ""}{" "}
              · {engagement ? formatDate(engagement.startDate) : ""} →{" "}
              {engagement ? formatDate(engagement.endDate) : ""} · Currency{" "}
              {s.currency}
            </div>
          </div>

          {/* A. Wage balance */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              A · Unpaid Wage Balance (approved payroll runs)
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1">Period</th>
                  <th className="py-1 text-right">Net Earned On Board</th>
                </tr>
              </thead>
              <tbody>
                {byPeriod.map((p) => (
                  <tr
                    key={p.period}
                    className="border-b last:border-0"
                    data-testid={`row-balance-${p.period}`}
                  >
                    <td className="py-1">{formatPeriod(p.period)}</td>
                    <td className="py-1 text-right">
                      {formatMoney(p.netOnBoard)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1">Balance paid now</td>
                  <td className="py-1 text-right" data-testid="text-balance-total">
                    {formatMoney(snapshot?.balance?.total ?? s.balancePaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* B. Accruals */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              B · Accrued Entitlements Paid at Settlement
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1">Code</th>
                  <th className="py-1">Element</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {accrualItems.map((a) => (
                  <tr
                    key={a.payElementUuid ?? a.code}
                    className="border-b last:border-0"
                    data-testid={`row-accrual-${a.code}`}
                  >
                    <td className="py-1">{a.code}</td>
                    <td className="py-1">{a.name}</td>
                    <td className="py-1 text-right">{formatMoney(a.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1" colSpan={2}>
                    Accruals paid now
                  </td>
                  <td className="py-1 text-right" data-testid="text-accruals-total">
                    {formatMoney(snapshot?.accruals?.total ?? s.accrualsPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 border rounded-md p-2 text-xs bg-slate-50 w-full sm:w-80">
              <div className="font-medium mb-1">Leave ledger</div>
              <div className="flex justify-between">
                <span>B/F + earned this engagement</span>
                <span data-testid="text-leave-earned">
                  {formatMoney(leaveTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid at settlement</span>
                <span data-testid="text-leave-paid">
                  {formatMoney(leaveTotal)}
                </span>
              </div>
              <div className="flex justify-between font-medium border-t mt-1 pt-1">
                <span>Carried forward</span>
                <span data-testid="text-leave-cf">0.00</span>
              </div>
            </div>
          </section>

          {/* C. Adjustments */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                C · Settlement Adjustments
              </h3>
              {isDraft && mayEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="print:hidden"
                  onClick={() => {
                    setAdjForm({ ...EMPTY_ADJ });
                    setAdjOpen(true);
                  }}
                  data-testid="button-add-adjustment"
                >
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              )}
            </div>
            {adjustments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No adjustments.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-1">Element</th>
                    <th className="py-1">Type</th>
                    <th className="py-1">Remarks</th>
                    <th className="py-1 text-right">Amount</th>
                    {isDraft && mayEdit && (
                      <th className="py-1 w-20 print:hidden" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => {
                    const el = elementByUuid.get(a.payElementUuid);
                    return (
                      <tr
                        key={a.adjustmentUuid}
                        className="border-b last:border-0"
                        data-testid={`row-adjustment-${a.adjustmentUuid}`}
                      >
                        <td className="py-1">
                          {el ? `${el.code} — ${el.name}` : a.payElementUuid}
                        </td>
                        <td className="py-1 capitalize">{a.type}</td>
                        <td className="py-1 text-muted-foreground">
                          {a.remarks ?? ""}
                        </td>
                        <td className="py-1 text-right">
                          {a.type === "deduction" ? "−" : ""}
                          {formatMoney(a.amount)}
                        </td>
                        {isDraft && mayEdit && (
                          <td className="py-1 text-right print:hidden">
                            <button
                              className="text-slate-500 hover:text-slate-800 mr-2"
                              onClick={() => {
                                setAdjForm({
                                  adjustmentUuid: a.adjustmentUuid,
                                  payElementUuid: a.payElementUuid,
                                  type: a.type,
                                  amount: a.amount,
                                  remarks: a.remarks ?? "",
                                });
                                setAdjOpen(true);
                              }}
                              data-testid={`button-edit-adjustment-${a.adjustmentUuid}`}
                            >
                              <Pencil size={14} />
                            </button>
                            {mayDelete && (
                              <button
                                className="text-red-500 hover:text-red-700"
                                onClick={() =>
                                  adjDeleteMut.mutate(a.adjustmentUuid)
                                }
                                data-testid={`button-delete-adjustment-${a.adjustmentUuid}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-1" colSpan={3}>
                      Adjustments (earnings − deductions)
                    </td>
                    <td
                      className="py-1 text-right"
                      data-testid="text-adjustments-total"
                    >
                      {formatMoney(s.adjustmentsEarnings)} −{" "}
                      {formatMoney(s.adjustmentsDeductions)}
                    </td>
                    {isDraft && mayEdit && <td className="print:hidden" />}
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          {/* D. Fund + net payable */}
          <section className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>D · Provident / pension fund remittance (employer)</span>
              <span data-testid="text-fund-remittance">
                {formatMoney(snapshot?.fundRemittance ?? "0.00")}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2">
              <span>Net payable to seafarer</span>
              <span data-testid="text-net-payable">
                {s.currency} {formatMoney(s.netPayable)}
              </span>
            </div>
          </section>

          {/* Approvals */}
          {approvals.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Approvals</h3>
              <div className="space-y-2">
                {approvals.map((ap) => (
                  <div
                    key={ap.stApprovalUuid}
                    className="flex flex-wrap items-center gap-2 text-sm border rounded-md p-2"
                    data-testid={`row-approval-${ap.stApprovalUuid}`}
                  >
                    <span className="font-medium">{ap.approver}</span>
                    <Badge
                      variant="outline"
                      className={
                        ap.status === "Approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : ap.status === "Rejected"
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                      }
                    >
                      {ap.status}
                    </Badge>
                    {ap.date && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(ap.date)}
                      </span>
                    )}
                    {ap.comments && (
                      <span className="text-xs text-muted-foreground">
                        “{ap.comments}”
                      </span>
                    )}
                    {status === "submitted" &&
                      ap.status === "Pending" &&
                      mayEdit &&
                      isOfficeUser &&
                      (ap.approverId
                        ? ap.approverId === userId
                        : !approvals.some(
                            (o) =>
                              o.stApprovalUuid !== ap.stApprovalUuid &&
                              !!userId &&
                              o.approverId === userId,
                          )) && (
                        <span className="flex items-center gap-1 ml-auto print:hidden">
                          <Input
                            className="h-8 w-44 text-xs"
                            placeholder="Comments"
                            value={decisionComments[ap.stApprovalUuid] ?? ""}
                            onChange={(e) =>
                              setDecisionComments((prev) => ({
                                ...prev,
                                [ap.stApprovalUuid]: e.target.value,
                              }))
                            }
                            data-testid={`input-decision-comments-${ap.stApprovalUuid}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-700"
                            disabled={decideMut.isPending}
                            onClick={() =>
                              decideMut.mutate({
                                approvalUuid: ap.stApprovalUuid,
                                decision: "Approved",
                              })
                            }
                            data-testid={`button-approve-${ap.stApprovalUuid}`}
                          >
                            <Check size={14} className="mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700"
                            disabled={decideMut.isPending}
                            onClick={() =>
                              decideMut.mutate({
                                approvalUuid: ap.stApprovalUuid,
                                decision: "Rejected",
                              })
                            }
                            data-testid={`button-reject-${ap.stApprovalUuid}`}
                          >
                            <X size={14} className="mr-1" /> Reject
                          </Button>
                        </span>
                      )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Signatures (print) */}
          <section className="grid grid-cols-3 gap-6 pt-10">
            {["Prepared By", "Approved By", "Received by Seafarer"].map(
              (label) => (
                <div key={label} className="text-center text-xs">
                  <div className="border-t pt-2">{label}</div>
                </div>
              ),
            )}
          </section>
        </div>
      )}

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Settlement for Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Approvers (one name per line)</Label>
            <Textarea
              rows={4}
              value={approverNames}
              onChange={(e) => setApproverNames(e.target.value)}
              placeholder={"Fleet Accountant\nCrewing Manager"}
              data-testid="input-settlement-approvers"
            />
            <p className="text-xs text-muted-foreground">
              Submitting freezes the engagement ledger. All listed approvers
              must approve before the settlement can be marked paid.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending || !approverNames.trim()}
              data-testid="button-confirm-submit-settlement"
            >
              {submitMut.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Settlement Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Paid date</Label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                data-testid="input-paid-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Payment reference (optional)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Bank ref / voucher no."
                data-testid="input-payment-reference"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => markPaidMut.mutate()}
              disabled={markPaidMut.isPending || !paidDate}
              data-testid="button-confirm-mark-paid"
            >
              {markPaidMut.isPending ? "Saving…" : "Mark Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjForm.adjustmentUuid ? "Edit Adjustment" : "Add Adjustment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Pay element (manual entry)</Label>
              <Select
                value={adjForm.payElementUuid}
                onValueChange={(v) =>
                  setAdjForm((f) => ({ ...f, payElementUuid: v }))
                }
              >
                <SelectTrigger data-testid="select-adjustment-element">
                  <SelectValue placeholder="Select element" />
                </SelectTrigger>
                <SelectContent>
                  {manualElements.map((e: any) => (
                    <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                      {e.code} — {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={adjForm.type}
                onValueChange={(v) => setAdjForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger data-testid="select-adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={adjForm.amount}
                onChange={(e) =>
                  setAdjForm((f) => ({ ...f, amount: e.target.value }))
                }
                data-testid="input-adjustment-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Input
                value={adjForm.remarks}
                onChange={(e) =>
                  setAdjForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="e.g. Repatriation travel wages"
                data-testid="input-adjustment-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => adjSaveMut.mutate()}
              disabled={
                adjSaveMut.isPending ||
                !adjForm.payElementUuid ||
                !adjForm.amount ||
                Number(adjForm.amount) <= 0
              }
              data-testid="button-save-adjustment"
            >
              {adjSaveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
