import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  RefreshCw,
  Play,
  Send,
  Pencil,
  Clock,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  CalendarX,
  Ban,
} from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatDate, formatMoney, unknownVesselLabel } from "../accountsFormat";
import VesselPeriodBar, { formatPeriod } from "./VesselPeriodBar";
import { useVesselPeriod } from "../vesselPeriodStore";

const MENU = "Account Payroll Run";

const PORTAGE_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  vessel_draft: "Vessel Draft",
  submitted: "Submitted",
  office_review: "Office Review",
  returned: "Returned",
  approved: "Approved",
  locked: "Locked",
};

const TIMING_LABEL: Record<string, string> = {
  paid_on_board: "Paid on board",
  payable_at_settlement: "Payable at settlement",
  remitted_to_fund: "Remitted to fund",
};

const ENGAGEMENT_STATUSES = [
  "draft",
  "active",
  "completed",
  "settled",
  "cancelled",
];

function statusBadge(status: string | null | undefined) {
  const s = status ?? "open";
  const cls =
    s === "locked"
      ? "bg-slate-700 text-white"
      : s === "approved"
        ? "bg-green-600 text-white"
        : s === "office_review"
          ? "bg-amber-500 text-white"
          : s === "returned"
            ? "bg-red-600 text-white"
            : "bg-blue-600 text-white";
  return (
    <Badge className={cls} data-testid={`badge-portage-status`}>
      {PORTAGE_STATUS_LABEL[s] ?? s}
    </Badge>
  );
}

/** Human-readable derivation of a ledger line from its calc_snapshot. */
function describeCalc(line: any): string {
  const s = line?.calcSnapshot;
  if (!s || typeof s !== "object") return "";
  const parts: string[] = [];
  if (s.monthlyAmount != null) {
    if (s.prorated) {
      parts.push(
        `Monthly ${formatMoney(s.monthlyAmount)} × ${s.daysServed}/${s.daysBasis} days = ${formatMoney(s.rawAmount)}`,
      );
    } else {
      parts.push(`Monthly ${formatMoney(s.monthlyAmount)} (not prorated)`);
    }
    if (s.scaleYear != null) parts.push(`scale year ${s.scaleYear}`);
  } else if (s.percentage != null) {
    parts.push(
      s.baseAmount != null
        ? `${s.percentage}% of ${formatMoney(s.baseAmount)}`
        : `${s.percentage}% of base element`,
    );
  } else if (s.qty != null && s.rate != null) {
    parts.push(`${s.qty} × ${formatMoney(s.rate)} = ${formatMoney(s.rawAmount)}`);
  } else if (s.txnAmount != null) {
    parts.push(`Manual entry ${formatMoney(s.txnAmount)}`);
  } else if (s.value != null) {
    parts.push(`Fixed amount ${formatMoney(s.value)}`);
  } else if (s.adjustsLedgerUuid) {
    parts.push(
      `Adjustment of ${s.sourcePeriod ?? "prior period"}${s.remarks ? ` — ${s.remarks}` : ""}`,
    );
  }
  if (s.paymentTimingOverriddenBy) parts.push("timing overridden");
  if (s.fxNote) parts.push(String(s.fxNote));
  return parts.join(" · ");
}

/** Drill-down groups: earnings / deductions on board, accruals, fund. */
const DRILL_GROUPS: {
  key: string;
  title: string;
  match: (l: any) => boolean;
}[] = [
  {
    key: "earnings",
    title: "Earnings (paid on board)",
    match: (l) =>
      l.elementType === "earning" && l.paymentTiming === "paid_on_board",
  },
  {
    key: "deductions",
    title: "Deductions (paid on board)",
    match: (l) =>
      l.elementType !== "earning" && l.paymentTiming === "paid_on_board",
  },
  {
    key: "accruals",
    title: "Settlement Accruals (payable at settlement)",
    match: (l) => l.paymentTiming === "payable_at_settlement",
  },
  {
    key: "fund",
    title: "Fund Remittances",
    match: (l) => l.paymentTiming === "remitted_to_fund",
  },
];

interface AnchorForm {
  scaleYearAtStart: string;
  nextStepDate: string;
  wageScaleUuid: string;
  status: string;
}

export default function PayrollRunPage() {
  const { toast } = useToast();
  const { canEdit, userId, userType } = usePermissions();
  const mayEdit = canEdit(MENU);
  const isOfficeUser = (userType ?? "").toLowerCase() !== "ship";

  const { vesselUuid, setVesselUuid, period, setPeriod } = useVesselPeriod();
  const hasFilter = !!vesselUuid && !!period;

  const reviewKey = [
    `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const wsKey = [
    `${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`,
  ];

  const { data: reviewRows = [], isLoading: reviewLoading } = useQuery<any[]>({
    queryKey: reviewKey,
    enabled: hasFilter,
  });
  const { data: workspace, isLoading: wsLoading } = useQuery<any>({
    queryKey: wsKey,
    enabled: hasFilter,
  });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });
  const { data: wageScales = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/wage-scales`],
  });
  const { data: companyRanks = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/company-ranks"],
  });
  const auditKey = [`${ACCOUNTS_BASE}/engagements/audit`];
  const { data: auditGroups = [] } = useQuery<any[]>({
    queryKey: auditKey,
    enabled: hasFilter,
  });
  // Vessel submission package status (portage + CTM + entry counts).
  const { data: vesselPkg } = useQuery<any>({
    queryKey: [
      `${ACCOUNTS_BASE}/vessel-portage/${vesselUuid}/${period}/status`,
    ],
    enabled: hasFilter,
  });

  const portage = workspace?.portage ?? null;
  const approvals: any[] = workspace?.approvals ?? [];
  const crewTotals: any[] = workspace?.crewTotals ?? [];
  const latestRun = workspace?.latestRun ?? null;
  const portageStatus: string = portage?.status ?? "open";
  const isLocked = portageStatus === "locked" || !!portage?.isLocked;
  // 'approved' (auto-lock OFF terminal state) intentionally stays editable:
  // backend guards only refuse when the month is locked.
  const readOnly = isLocked || !mayEdit;
  const submittable = ["open", "vessel_draft", "submitted", "returned"].includes(
    portageStatus,
  );

  const ledgerKey = [`${ACCOUNTS_BASE}/ledger?portageUuid=${portage?.portageUuid}`];
  const { data: ledgerLines = [] } = useQuery<any[]>({
    queryKey: ledgerKey,
    enabled: !!portage?.portageUuid,
  });

  const crewByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of reviewRows) m.set(r.crewUuid, r);
    return m;
  }, [reviewRows]);

  // ---- overlapping-engagement guard (Step 1 banner) ----
  const [overlapOpen, setOverlapOpen] = useState(false);
  const overlapGroups = useMemo(
    () =>
      (auditGroups ?? []).filter((g: any) => crewByUuid.has(g.crewUuid)),
    [auditGroups, crewByUuid],
  );

  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of payElements) m.set(e.payElementUuid, e);
    return m;
  }, [payElements]);

  const rankNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of companyRanks) m.set(r.rankId, r.rank);
    return m;
  }, [companyRanks]);

  // ---- last run warnings (session result, else persisted on the run row) ----
  // Session warnings are strings ("<engagementUuid>: <message>"); persisted
  // run-row warnings (0159) are objects {crewUuid, engagementUuid, code,
  // message}. Normalize both to the string shape the renderer expects.
  const [runWarnings, setRunWarnings] = useState<string[] | null>(null);
  const [runSkippedSettled, setRunSkippedSettled] = useState<any[]>([]);
  const warnings: string[] = (
    (runWarnings ?? (latestRun?.warnings as any[] | null) ?? []) as any[]
  ).map((w) =>
    typeof w === "string"
      ? w
      : `${w?.engagementUuid ?? ""}: ${w?.message ?? w?.code ?? ""}`,
  );

  // ---- sync ----
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const doSync = async () => {
    setSyncing(true);
    try {
      const result = await accountsApiV2.engagements.sync(vesselUuid, period);
      setSyncResult(result);
      queryClient.invalidateQueries({ queryKey: reviewKey });
      toast({
        title: "Sync complete",
        description: `${result.created?.length ?? 0} created, ${result.updated?.length ?? 0} updated, ${result.cancelled?.length ?? 0} cancelled, ${result.attention?.length ?? 0} need attention, ${result.errors?.length ?? 0} errors`,
      });
    } catch (err) {
      toast({
        title: "Sync failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // ---- run calculation ----
  const [running, setRunning] = useState(false);

  const doRun = async () => {
    setRunning(true);
    try {
      const result = await accountsApiV2.calc.run(vesselUuid, period);
      setRunWarnings(result.warnings ?? []);
      setRunSkippedSettled(result.skippedSettled ?? []);
      queryClient.invalidateQueries({ queryKey: wsKey });
      queryClient.invalidateQueries({
        queryKey: [`${ACCOUNTS_BASE}/ledger?portageUuid=${result.portage?.portageUuid}`],
      });
      const skipped = result.skippedSettled?.length ?? 0;
      toast({
        title: "Calculation complete",
        description: `${result.lineCount} ledger lines for ${result.crewTotals?.length ?? 0} crew (${result.warnings?.length ?? 0} warnings)${skipped > 0 ? `; ${skipped} crew excluded: already settled` : ""}`,
      });
    } catch (err) {
      toast({
        title: "Calculation failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  // ---- anchor edit dialog ----
  const [anchorRow, setAnchorRow] = useState<any | null>(null);
  const [anchorForm, setAnchorForm] = useState<AnchorForm>({
    scaleYearAtStart: "",
    nextStepDate: "",
    wageScaleUuid: "",
    status: "active",
  });
  const [savingAnchor, setSavingAnchor] = useState(false);

  const openAnchor = (row: any) => {
    setAnchorRow(row);
    setAnchorForm({
      scaleYearAtStart: String(row.engagement?.scaleYearAtStart ?? 1),
      nextStepDate: row.engagement?.nextStepDate ?? "",
      wageScaleUuid: row.engagement?.wageScaleUuid ?? "",
      status: row.engagement?.status ?? "active",
    });
  };

  const saveAnchor = async () => {
    if (!anchorRow?.engagement) return;
    setSavingAnchor(true);
    try {
      const payload: Record<string, unknown> = {};
      const yr = parseInt(anchorForm.scaleYearAtStart, 10);
      if (!Number.isNaN(yr)) payload.scaleYearAtStart = yr;
      if (anchorForm.nextStepDate) payload.nextStepDate = anchorForm.nextStepDate;
      if (anchorForm.wageScaleUuid) payload.wageScaleUuid = anchorForm.wageScaleUuid;
      if (anchorForm.status) payload.status = anchorForm.status;
      await accountsApiV2.engagements.update(
        anchorRow.engagement.engagementUuid,
        payload,
      );
      queryClient.invalidateQueries({ queryKey: reviewKey });
      setAnchorRow(null);
      toast({ title: "Engagement updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSavingAnchor(false);
    }
  };

  // ---- set end date / cancel engagement actions (RBAC: edit permission) ----
  const [endDateRow, setEndDateRow] = useState<any | null>(null);
  const [endDateValue, setEndDateValue] = useState("");
  const [savingEndDate, setSavingEndDate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const openEndDate = (engagement: any, crewName?: string) => {
    setEndDateRow({ engagement, crewName });
    setEndDateValue(engagement?.endDate ?? "");
  };

  const saveEndDate = async () => {
    if (!endDateRow?.engagement || !endDateValue) return;
    setSavingEndDate(true);
    try {
      await accountsApiV2.engagements.update(
        endDateRow.engagement.engagementUuid,
        { endDate: endDateValue },
      );
      queryClient.invalidateQueries({ queryKey: reviewKey });
      queryClient.invalidateQueries({ queryKey: auditKey });
      setEndDateRow(null);
      toast({ title: "End date updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSavingEndDate(false);
    }
  };

  const doCancelEngagement = async () => {
    if (!cancelTarget?.engagement) return;
    setCancelling(true);
    try {
      await accountsApiV2.engagements.update(
        cancelTarget.engagement.engagementUuid,
        { status: "cancelled" },
      );
      queryClient.invalidateQueries({ queryKey: reviewKey });
      queryClient.invalidateQueries({ queryKey: auditKey });
      setCancelTarget(null);
      toast({ title: "Engagement cancelled" });
    } catch (err) {
      toast({
        title: "Cancel failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  // ---- timing override dialog ----
  const [timingRow, setTimingRow] = useState<any | null>(null);
  const [timingElementUuid, setTimingElementUuid] = useState("");
  const [timingValue, setTimingValue] = useState("__none__");
  const [savingTiming, setSavingTiming] = useState(false);

  const openTiming = (row: any) => {
    setTimingRow(row);
    setTimingElementUuid("");
    setTimingValue("__none__");
  };

  const saveTiming = async () => {
    if (!timingRow?.engagement || !timingElementUuid) return;
    setSavingTiming(true);
    try {
      await accountsApiV2.engagements.setTimingOverride(
        timingRow.engagement.engagementUuid,
        timingElementUuid,
        timingValue === "__none__" ? null : timingValue,
      );
      queryClient.invalidateQueries({ queryKey: reviewKey });
      setTimingRow(null);
      toast({ title: "Payment timing updated" });
    } catch (err) {
      toast({
        title: "Timing override failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSavingTiming(false);
    }
  };

  // ---- submit dialog ----
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approverNames, setApproverNames] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const doSubmit = async () => {
    const names = approverNames
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!portage || names.length === 0) return;
    setSubmitting(true);
    try {
      await accountsApiV2.portage.submit(
        portage.portageUuid,
        names.map((approver) => ({ approver })),
      );
      queryClient.invalidateQueries({ queryKey: wsKey });
      setSubmitOpen(false);
      setApproverNames("");
      toast({ title: "Portage bill submitted for office review" });
    } catch (err) {
      toast({
        title: "Submit failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- approval decision dialog ----
  const [decisionTarget, setDecisionTarget] = useState<{
    approval: any;
    decision: "Approved" | "Rejected";
  } | null>(null);
  const [decisionComments, setDecisionComments] = useState("");
  const [deciding, setDeciding] = useState(false);

  const doDecide = async () => {
    if (!decisionTarget) return;
    setDeciding(true);
    try {
      await accountsApiV2.portage.decide(
        decisionTarget.approval.pbApprovalUuid,
        decisionTarget.decision,
        decisionComments.trim() || null,
      );
      queryClient.invalidateQueries({ queryKey: wsKey });
      setDecisionTarget(null);
      setDecisionComments("");
      toast({ title: `Decision recorded: ${decisionTarget.decision}` });
    } catch (err) {
      toast({
        title: "Decision failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setDeciding(false);
    }
  };

  // ---- drill-down ----
  const [drillCrewUuid, setDrillCrewUuid] = useState<string | null>(null);
  const drillLines = useMemo(
    () => ledgerLines.filter((l) => l.crewUuid === drillCrewUuid),
    [ledgerLines, drillCrewUuid],
  );

  // ---- grids ----
  const reviewCols: ColDef[] = useMemo(
    () => [
      { headerName: "Crew", field: "crewName", flex: 2, minWidth: 160 },
      { headerName: "Rank", field: "presentRank", width: 90 },
      {
        headerName: "Sign On",
        field: "signOnDate",
        width: 110,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Sign Off",
        field: "signOffDate",
        width: 110,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Engagement",
        width: 120,
        valueGetter: (p) => p.data.engagement?.status ?? "— not synced —",
        cellRenderer: (p: any) =>
          p.data.engagement ? (
            p.value
          ) : (
            <span className="text-amber-600 font-medium">not synced</span>
          ),
      },
      {
        headerName: "Wage Scale",
        flex: 2,
        minWidth: 150,
        valueGetter: (p) => p.data.scaleName ?? "—",
      },
      {
        headerName: "Scale Yr",
        width: 90,
        valueGetter: (p) => p.data.engagement?.scaleYearAtStart ?? "",
      },
      {
        headerName: "Next Step",
        width: 110,
        valueGetter: (p) => p.data.engagement?.nextStepDate ?? "",
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Timing Overrides",
        flex: 2,
        minWidth: 160,
        valueGetter: (p) =>
          (p.data.timingOverrides ?? [])
            .map((o: any) => {
              const el = elementByUuid.get(o.payElementUuid);
              return `${el?.code ?? o.payElementUuid}→${TIMING_LABEL[o.paymentTimingOverride] ?? o.paymentTimingOverride}`;
            })
            .join(", "),
      },
      {
        headerName: "Actions",
        width: 170,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) =>
          p.data.engagement && !readOnly ? (
            <div className="flex items-center gap-1 h-full">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Edit engagement / wage scale"
                onClick={() => openAnchor(p.data)}
                data-testid={`button-edit-engagement-${p.data.crewUuid}`}
              >
                <Pencil size={14} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Payment timing overrides"
                onClick={() => openTiming(p.data)}
                data-testid={`button-timing-${p.data.crewUuid}`}
              >
                <Clock size={14} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Set end date"
                onClick={() =>
                  openEndDate(p.data.engagement, p.data.crewName)
                }
                data-testid={`button-end-date-${p.data.crewUuid}`}
              >
                <CalendarX size={14} />
              </Button>
              {(p.data.ledgerLineCount ?? 0) === 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-600 hover:text-red-700"
                  title="Cancel engagement"
                  onClick={() =>
                    setCancelTarget({
                      engagement: p.data.engagement,
                      crewName: p.data.crewName,
                    })
                  }
                  data-testid={`button-cancel-engagement-${p.data.crewUuid}`}
                >
                  <Ban size={14} />
                </Button>
              )}
            </div>
          ) : null,
      },
    ],
    [elementByUuid, readOnly],
  );

  const totalsCols: ColDef[] = useMemo(
    () => [
      {
        headerName: "Crew",
        flex: 2,
        minWidth: 160,
        valueGetter: (p) =>
          crewByUuid.get(p.data.crewUuid)?.crewName ?? p.data.crewUuid,
      },
      {
        headerName: "Rank",
        field: "rankId",
        width: 110,
        valueFormatter: (p) =>
          p.value ? (rankNameById.get(p.value) ?? p.value) : "",
        tooltipValueGetter: (p) => p.data?.rankId ?? "",
      },
      {
        headerName: "Balance B/F",
        field: "balanceBf",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Earned Gross",
        field: "earnedGross",
        width: 130,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Deductions",
        field: "deductions",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Net On Board",
        field: "netOnBoard",
        width: 130,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Settlement Accrual",
        field: "settlementAccrual",
        width: 150,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Fund Remit",
        field: "fundRemittance",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Balance C/F",
        field: "balanceCf",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Leave B/F",
        field: "leaveBf",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Leave This Mo",
        field: "leaveThisMonth",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Leave C/F",
        field: "leaveCf",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "",
        width: 60,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="View wage breakdown"
            onClick={() => setDrillCrewUuid(p.data.crewUuid)}
            data-testid={`button-drilldown-${p.data.crewUuid}`}
          >
            <ChevronRight size={16} />
          </Button>
        ),
      },
    ],
    [crewByUuid, rankNameById],
  );

  const visibleApprovals = approvals.filter((a) => !a.isDeleted);
  const pendingApprovals = visibleApprovals.filter(
    (a) => a.status === "Pending",
  );

  return (
    <div className="p-4 space-y-4" data-testid="payroll-run-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Payroll Run</h1>
          <p className="text-sm text-muted-foreground">
            Monthly wage workspace — review, calculate, submit and approve
          </p>
        </div>
        {hasFilter && (
          <div className="flex items-center gap-2">
            {statusBadge(portageStatus)}
            {isLocked && (
              <Badge variant="outline" className="gap-1">
                <Lock size={12} /> Locked{" "}
                {portage?.lockedDate ? formatDate(portage.lockedDate) : ""}
              </Badge>
            )}
          </div>
        )}
      </div>

      <VesselPeriodBar
        vesselUuid={vesselUuid}
        period={period}
        onVesselChange={setVesselUuid}
        onPeriodChange={(p) => {
          setPeriod(p);
          setRunWarnings(null);
          setSyncResult(null);
        }}
      />

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          Select a vessel and period to open the payroll workspace.
        </div>
      )}

      {hasFilter && (reviewLoading || wsLoading) && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading workspace…
        </div>
      )}

      {hasFilter && !reviewLoading && !wsLoading && (
        <>
          {/* Step 1 — Crew & engagement review */}
          <section className="border rounded-md bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
              <h2 className="font-medium text-sm">
                Step 1 · Crew &amp; Engagement Review ({reviewRows.length})
              </h2>
              {vesselPkg && (
                <div
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  data-testid="text-vessel-package-status"
                >
                  <span>Vessel package:</span>
                  <Badge variant="outline" className="text-xs">
                    {(vesselPkg.portage?.status ?? "open").replace(/_/g, " ")}
                  </Badge>
                  {vesselPkg.ctm && (
                    <Badge variant="outline" className="text-xs">
                      CTM {vesselPkg.ctm.status}
                    </Badge>
                  )}
                  {vesselPkg.counts && (
                    <span>
                      {vesselPkg.counts.submitted ?? 0} submitted ·{" "}
                      {vesselPkg.counts.accepted ?? 0} accepted ·{" "}
                      {vesselPkg.counts.rejected ?? 0} rejected
                    </span>
                  )}
                </div>
              )}
              {!readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={doSync}
                  disabled={syncing}
                  data-testid="button-sync-engagements"
                >
                  <RefreshCw
                    size={14}
                    className={`mr-1 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing…" : "Sync from Crewing"}
                </Button>
              )}
            </div>
            {syncResult && (
              <div className="px-4 py-2 border-b text-xs space-y-1 bg-slate-50">
                <div data-testid="text-sync-summary">
                  Sync: {syncResult.created?.length ?? 0} created ·{" "}
                  {syncResult.updated?.length ?? 0} updated ·{" "}
                  {syncResult.cancelled?.length ?? 0} cancelled ·{" "}
                  {syncResult.attention?.length ?? 0} need attention ·{" "}
                  {syncResult.skippedExisting ?? 0} already engaged ·{" "}
                  {syncResult.skippedNoOverlap ?? 0} outside period ·{" "}
                  {syncResult.errors?.length ?? 0} errors
                </div>
                {(
                  [
                    {
                      key: "created",
                      label: "Created",
                      items: syncResult.created ?? [],
                      render: (it: any) =>
                        `${crewByUuid.get(it.crewUuid)?.crewName ?? it.crewName ?? it.crewUuid} — engagement created${it.startDate ? ` (${formatDate(it.startDate)} → ${it.endDate ? formatDate(it.endDate) : "open"})` : ""}`,
                    },
                    {
                      key: "updated",
                      label: "Updated",
                      items: syncResult.updated ?? [],
                      render: (it: any) =>
                        `${crewByUuid.get(it.crewUuid)?.crewName ?? it.crewName ?? it.crewUuid} — ${it.changes ?? it.reason ?? "dates aligned with crewing assignment"}`,
                    },
                    {
                      key: "cancelled",
                      label: "Cancelled",
                      items: syncResult.cancelled ?? [],
                      render: (it: any) =>
                        `${crewByUuid.get(it.crewUuid)?.crewName ?? it.crewName ?? it.crewUuid} — ${it.reason ?? "assignment removed or no longer in period"}`,
                    },
                    {
                      key: "attention",
                      label: "Needs attention",
                      items: syncResult.attention ?? [],
                      render: (it: any) =>
                        `${crewByUuid.get(it.crewUuid)?.crewName ?? it.crewName ?? it.crewUuid} — ${it.reason ?? "manual review required"}${it.ledgerLineCount != null ? ` (${it.ledgerLineCount} ledger lines)` : ""}`,
                    },
                  ] as const
                ).map(
                  (section) =>
                    section.items.length > 0 && (
                      <details
                        key={section.key}
                        className="rounded border bg-white"
                        data-testid={`sync-section-${section.key}`}
                      >
                        <summary className="cursor-pointer px-2 py-1 font-medium select-none">
                          {section.label} ({section.items.length})
                        </summary>
                        <ul className="px-4 py-1 space-y-0.5 list-disc list-inside">
                          {section.items.map((it: any, i: number) => (
                            <li
                              key={i}
                              className={
                                section.key === "attention"
                                  ? "text-amber-700"
                                  : ""
                              }
                              data-testid={`sync-${section.key}-${i}`}
                            >
                              {section.render(it)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ),
                )}
                {(syncResult.warnings ?? []).map((w: string, i: number) => (
                  <div
                    key={`w-${i}`}
                    className="flex items-start gap-1 text-amber-700"
                    data-testid={`text-sync-warning-${i}`}
                  >
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
                {(syncResult.errors ?? []).map((e: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-1 text-red-700"
                    data-testid={`text-sync-error-${i}`}
                  >
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {e.crewName || e.crewUuid || e.assignUuid}: {e.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {overlapGroups.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-amber-50 text-xs text-amber-800"
                data-testid="banner-overlap-warning"
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span className="font-medium">
                  {overlapGroups.length} crew member
                  {overlapGroups.length === 1 ? " has" : "s have"} overlapping
                  open engagements.
                </span>
                <span>
                  Payroll runs are blocked for these crew until the overlap is
                  resolved.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                  onClick={() => setOverlapOpen(true)}
                  data-testid="button-view-overlaps"
                >
                  View details
                </Button>
              </div>
            )}
            <div className="p-2">
              <AgGridTable
                rowData={reviewRows}
                columnDefs={reviewCols}
                height="300px"
              />
            </div>
          </section>

          {/* Step 2 — Calculation */}
          <section className="border rounded-md bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
              <div>
                <h2 className="font-medium text-sm">
                  Step 2 · Calculation — {formatPeriod(period)}
                </h2>
                {latestRun && (
                  <p className="text-xs text-muted-foreground">
                    Last run {formatDate(latestRun.createdAt)}{" "}
                    {latestRun.runByUuid ? `by ${latestRun.runByUuid}` : ""}
                  </p>
                )}
              </div>
              {!readOnly && (
                <Button
                  size="sm"
                  onClick={doRun}
                  disabled={running}
                  className="bg-[#16569e] hover:bg-[#1e5fa8]"
                  data-testid="button-run-calculation"
                >
                  <Play size={14} className="mr-1" />
                  {running ? "Running…" : "Run Calculation"}
                </Button>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="px-4 py-2 border-b bg-amber-50 text-xs space-y-0.5 max-h-36 overflow-y-auto">
                <div className="font-medium text-amber-800">
                  {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                </div>
                {warnings.map((w, i) => {
                  const [engUuid, ...rest] = w.split(": ");
                  const crewRow = reviewRows.find(
                    (r) => r.engagement?.engagementUuid === engUuid,
                  );
                  return (
                    <div
                      key={i}
                      className="text-amber-800"
                      data-testid={`text-warning-${i}`}
                    >
                      {crewRow ? `${crewRow.crewName}: ${rest.join(": ")}` : w}
                    </div>
                  );
                })}
              </div>
            )}
            {runSkippedSettled.length > 0 && (
              <div className="px-4 py-2 border-b bg-blue-50 text-xs space-y-0.5 max-h-36 overflow-y-auto">
                <div className="font-medium text-blue-800">
                  {runSkippedSettled.length} crew excluded from recalculation
                  (already settled — existing ledger lines preserved)
                </div>
                {runSkippedSettled.map((s: any, i: number) => (
                  <div
                    key={i}
                    className="text-blue-800"
                    data-testid={`text-skipped-settled-${i}`}
                  >
                    {s.crewName ?? s.crewUuid} — settlement {s.status}
                  </div>
                ))}
              </div>
            )}
            <div className="p-2">
              <AgGridTable
                rowData={crewTotals}
                columnDefs={totalsCols}
                height="300px"
              />
            </div>
          </section>

          {/* Step 3 — Submit & approvals */}
          <section className="border rounded-md bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
              <h2 className="font-medium text-sm">
                Step 3 · Submission &amp; Approvals
              </h2>
              {mayEdit && !isLocked && submittable && portage && (
                <Button
                  size="sm"
                  onClick={() => setSubmitOpen(true)}
                  disabled={crewTotals.length === 0}
                  className="bg-[#16569e] hover:bg-[#1e5fa8]"
                  data-testid="button-submit-portage"
                >
                  <Send size={14} className="mr-1" /> Submit for Approval
                </Button>
              )}
            </div>
            <div className="p-4 space-y-2">
              {!portage && (
                <p className="text-sm text-muted-foreground">
                  Run the calculation to create the portage bill for this
                  period.
                </p>
              )}
              {portage && visibleApprovals.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Not yet submitted for approval.
                </p>
              )}
              {portageStatus === "office_review" &&
                pendingApprovals.length > 0 && (
                  <div
                    className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2"
                    data-testid="banner-pending-approvals"
                  >
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold">
                        Month NOT approved yet — {pendingApprovals.length} of{" "}
                        {visibleApprovals.length} approval
                        {visibleApprovals.length === 1 ? "" : "s"} pending:{" "}
                        {pendingApprovals.map((a) => a.approver).join(", ")}.
                      </span>{" "}
                      Each approver must record their decision below before the
                      month is approved. Settlement approvals are separate and
                      do not approve the month.
                    </div>
                  </div>
                )}
              {portageStatus === "approved" && !isLocked && (
                <div
                  className="flex items-center gap-2 text-sm text-blue-900 bg-blue-50 border border-blue-300 rounded px-3 py-2"
                  data-testid="banner-approved-unlocked"
                >
                  <CheckCircle2 size={14} />
                  Portage bill approved. Auto-lock on approval is off, so the
                  month remains unlocked until locked explicitly.
                </div>
              )}
              {visibleApprovals.map((a) => (
                <div
                  key={a.pbApprovalUuid}
                  className="flex flex-wrap items-center gap-3 border rounded px-3 py-2"
                  data-testid={`row-approval-${a.pbApprovalUuid}`}
                >
                  <span className="font-medium text-sm">{a.approver}</span>
                  {a.status === "Approved" && (
                    <Badge className="bg-green-600 text-white gap-1">
                      <CheckCircle2 size={12} /> Approved
                    </Badge>
                  )}
                  {a.status === "Rejected" && (
                    <Badge className="bg-red-600 text-white gap-1">
                      <XCircle size={12} /> Rejected
                    </Badge>
                  )}
                  {a.status === "Pending" && (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  {a.date && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(a.date)}
                    </span>
                  )}
                  {a.comments && (
                    <span className="text-xs text-muted-foreground italic">
                      “{a.comments}”
                    </span>
                  )}
                  {a.status === "Pending" &&
                    mayEdit &&
                    isOfficeUser &&
                    (a.approverId
                      ? a.approverId === userId
                      : !visibleApprovals.some(
                          (o: any) =>
                            o.pbApprovalUuid !== a.pbApprovalUuid &&
                            !!userId &&
                            o.approverId === userId,
                        )) &&
                    portageStatus === "office_review" && (
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-green-700 border-green-300"
                          onClick={() =>
                            setDecisionTarget({
                              approval: a,
                              decision: "Approved",
                            })
                          }
                          data-testid={`button-approve-${a.pbApprovalUuid}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-red-700 border-red-300"
                          onClick={() =>
                            setDecisionTarget({
                              approval: a,
                              decision: "Rejected",
                            })
                          }
                          data-testid={`button-reject-${a.pbApprovalUuid}`}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                </div>
              ))}
              {isLocked && (
                <div
                  className="flex items-center gap-2 text-sm text-slate-700 bg-slate-100 border rounded px-3 py-2"
                  data-testid="text-locked-banner"
                >
                  <Lock size={14} />
                  Portage bill approved and locked
                  {portage?.lockedDate
                    ? ` on ${formatDate(portage.lockedDate)}`
                    : ""}
                  . All figures are read-only.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ---- Drill-down dialog ---- */}
      <Dialog
        open={!!drillCrewUuid}
        onOpenChange={(o) => !o && setDrillCrewUuid(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Wage Detail —{" "}
              {crewByUuid.get(drillCrewUuid ?? "")?.crewName ?? drillCrewUuid}
            </DialogTitle>
          </DialogHeader>
          {DRILL_GROUPS.map((group) => {
            const lines = drillLines.filter(group.match);
            if (lines.length === 0) return null;
            const subtotal = lines.reduce(
              (s, l) => s + (parseFloat(l.amount) || 0),
              0,
            );
            return (
              <div key={group.key} className="space-y-1">
                <h3 className="text-sm font-medium">{group.title}</h3>
                <table className="w-full text-xs border">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-2 py-1">Element</th>
                      <th className="text-left px-2 py-1">Derivation</th>
                      <th className="text-right px-2 py-1">Days/Qty</th>
                      <th className="text-right px-2 py-1">Rate</th>
                      <th className="text-right px-2 py-1">Amount</th>
                      <th className="text-left px-2 py-1">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const derivation = describeCalc(l);
                      const snapWarning = l.calcSnapshot?.warning;
                      return (
                        <tr
                          key={l.ledgerUuid}
                          className="border-t"
                          data-testid={`row-ledger-${l.ledgerUuid}`}
                        >
                          <td className="px-2 py-1">
                            <div>
                              {elementByUuid.get(l.payElementUuid)?.name ??
                                l.elementCode}
                            </div>
                            {l.elementType !== "earning" && (
                              <div className="text-[10px] text-muted-foreground">
                                {l.elementType === "employer_contribution"
                                  ? "employer contribution"
                                  : l.elementType}
                              </div>
                            )}
                          </td>
                          <td
                            className="px-2 py-1 text-muted-foreground"
                            data-testid={`text-derivation-${l.ledgerUuid}`}
                          >
                            {derivation}
                            {snapWarning && (
                              <div className="flex items-start gap-1 text-amber-700">
                                <AlertTriangle
                                  size={11}
                                  className="mt-0.5 shrink-0"
                                />
                                <span>{String(snapWarning)}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {l.daysServed ?? l.qty ?? ""}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {l.rate ? formatMoney(l.rate) : ""}
                          </td>
                          <td className="px-2 py-1 text-right font-medium">
                            {formatMoney(l.amount, l.currency)}
                          </td>
                          <td className="px-2 py-1">{l.sourceType}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t bg-slate-50 font-medium">
                      <td className="px-2 py-1" colSpan={4}>
                        Subtotal
                      </td>
                      <td
                        className="px-2 py-1 text-right"
                        data-testid={`text-subtotal-${group.key}`}
                      >
                        {formatMoney(subtotal.toFixed(2))}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
          {drillLines.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No ledger lines for this crew member.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Anchor edit dialog ---- */}
      <Dialog open={!!anchorRow} onOpenChange={(o) => !o && setAnchorRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Engagement — {anchorRow?.crewName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Scale Year at Start</Label>
              <Input
                type="number"
                min={1}
                value={anchorForm.scaleYearAtStart}
                onChange={(e) =>
                  setAnchorForm((f) => ({
                    ...f,
                    scaleYearAtStart: e.target.value,
                  }))
                }
                data-testid="input-scale-year"
              />
            </div>
            <div className="space-y-1">
              <Label>Next Step Date</Label>
              <Input
                type="date"
                value={anchorForm.nextStepDate}
                onChange={(e) =>
                  setAnchorForm((f) => ({ ...f, nextStepDate: e.target.value }))
                }
                data-testid="input-next-step-date"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Wage Scale</Label>
              <Select
                value={anchorForm.wageScaleUuid}
                onValueChange={(v) =>
                  setAnchorForm((f) => ({ ...f, wageScaleUuid: v }))
                }
              >
                <SelectTrigger data-testid="select-wage-scale">
                  <SelectValue placeholder="Select wage scale" />
                </SelectTrigger>
                <SelectContent>
                  {wageScales
                    .filter(
                      (s) =>
                        s.status === "active" ||
                        s.scaleUuid === anchorForm.wageScaleUuid,
                    )
                    .map((s) => (
                      <SelectItem key={s.scaleUuid} value={s.scaleUuid}>
                        {s.scaleName} ({s.status})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={anchorForm.status}
                onValueChange={(v) =>
                  setAnchorForm((f) => ({ ...f, status: v }))
                }
              >
                <SelectTrigger data-testid="select-engagement-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnchorRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveAnchor}
              disabled={savingAnchor}
              data-testid="button-save-engagement"
            >
              {savingAnchor ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Timing override dialog ---- */}
      <Dialog open={!!timingRow} onOpenChange={(o) => !o && setTimingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Payment Timing Override — {timingRow?.crewName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Pay Element</Label>
              <Select
                value={timingElementUuid}
                onValueChange={(v) => {
                  setTimingElementUuid(v);
                  const existing = (timingRow?.timingOverrides ?? []).find(
                    (o: any) => o.payElementUuid === v,
                  );
                  setTimingValue(
                    existing?.paymentTimingOverride ?? "__none__",
                  );
                }}
              >
                <SelectTrigger data-testid="select-timing-element">
                  <SelectValue placeholder="Select element" />
                </SelectTrigger>
                <SelectContent>
                  {payElements
                    .filter((e) => e.status === "active")
                    .map((e) => (
                      <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                        {e.code} — {e.name} (
                        {TIMING_LABEL[e.paymentTiming] ?? e.paymentTiming})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Override Timing</Label>
              <Select value={timingValue} onValueChange={setTimingValue}>
                <SelectTrigger data-testid="select-timing-value">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    No override (use element default)
                  </SelectItem>
                  {Object.entries(TIMING_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimingRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveTiming}
              disabled={savingTiming || !timingElementUuid}
              data-testid="button-save-timing"
            >
              {savingTiming ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Overlapping engagements dialog ---- */}
      <Dialog open={overlapOpen} onOpenChange={setOverlapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Overlapping Open Engagements</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            These crew members have more than one open engagement covering the
            same dates. Payroll calculation is blocked for them until the
            conflicting engagement is ended or corrected.
          </p>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {overlapGroups.map((g: any) => (
              <div
                key={g.crewUuid}
                className="border rounded-md p-3 text-sm"
                data-testid={`overlap-group-${g.crewUuid}`}
              >
                <div className="font-medium mb-1">
                  {g.crewName ??
                    crewByUuid.get(g.crewUuid)?.crewName ??
                    g.crewUuid}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(g.engagements ?? []).map((e: any) => (
                    <div
                      key={e.engagementUuid}
                      className="border rounded p-2 text-xs space-y-1"
                      data-testid={`overlap-engagement-${e.engagementUuid}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {e.vesselName ?? unknownVesselLabel(e.vesselUuid)}
                        </span>
                        {e.status && (
                          <Badge variant="outline" className="text-[10px]">
                            {e.status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {formatDate(e.startDate)} →{" "}
                        {e.endDate ? formatDate(e.endDate) : "open"}
                      </div>
                      <div className="text-muted-foreground">
                        Source:{" "}
                        {e.assignmentUuid
                          ? `crewing assignment ${e.assignmentUuid.slice(0, 8)}…`
                          : "manual engagement"}
                      </div>
                      <div
                        className="text-muted-foreground"
                        data-testid={`text-ledger-count-${e.engagementUuid}`}
                      >
                        {e.ledgerLineCount ?? 0} ledger line
                        {(e.ledgerLineCount ?? 0) === 1 ? "" : "s"}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            onClick={() =>
                              openEndDate(
                                e,
                                g.crewName ??
                                  crewByUuid.get(g.crewUuid)?.crewName,
                              )
                            }
                            data-testid={`button-overlap-end-date-${e.engagementUuid}`}
                          >
                            <CalendarX size={12} className="mr-1" />
                            Set end date
                          </Button>
                          {(e.ledgerLineCount ?? 0) === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() =>
                                setCancelTarget({
                                  engagement: e,
                                  crewName:
                                    g.crewName ??
                                    crewByUuid.get(g.crewUuid)?.crewName,
                                })
                              }
                              data-testid={`button-overlap-cancel-${e.engagementUuid}`}
                            >
                              <Ban size={12} className="mr-1" />
                              Cancel engagement
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOverlapOpen(false)}
              data-testid="button-close-overlaps"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Set end date dialog ---- */}
      <Dialog
        open={!!endDateRow}
        onOpenChange={(o) => !o && setEndDateRow(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Set End Date{endDateRow?.crewName ? ` — ${endDateRow.crewName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              type="date"
              value={endDateValue}
              onChange={(e) => setEndDateValue(e.target.value)}
              data-testid="input-end-date"
            />
            <p className="text-xs text-muted-foreground">
              Ends the engagement on this date. Existing ledger lines are kept;
              future periods will no longer include this engagement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDateRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveEndDate}
              disabled={savingEndDate || !endDateValue}
              data-testid="button-save-end-date"
            >
              {savingEndDate ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Cancel engagement dialog ---- */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Cancel Engagement
              {cancelTarget?.crewName ? ` — ${cancelTarget.crewName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This marks the engagement as cancelled so it is excluded from
            payroll. Only engagements with no ledger lines can be cancelled.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep engagement
            </Button>
            <Button
              onClick={doCancelEngagement}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-cancel-engagement"
            >
              {cancelling ? "Cancelling…" : "Cancel engagement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Submit dialog ---- */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Portage Bill for Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Approvers (one name per line)</Label>
            <Textarea
              rows={4}
              value={approverNames}
              onChange={(e) => setApproverNames(e.target.value)}
              placeholder={"Master\nFleet Accountant"}
              data-testid="input-approvers"
            />
            <p className="text-xs text-muted-foreground">
              Submitting moves the {formatPeriod(period)} portage bill to
              office review. All listed approvers must approve before the bill
              locks.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doSubmit}
              disabled={submitting || !approverNames.trim()}
              data-testid="button-confirm-submit"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Decision dialog ---- */}
      <Dialog
        open={!!decisionTarget}
        onOpenChange={(o) => !o && setDecisionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.decision === "Approved" ? "Approve" : "Reject"}{" "}
              — {decisionTarget?.approval?.approver}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comments {decisionTarget?.decision === "Rejected" ? "" : "(optional)"}</Label>
            <Textarea
              rows={3}
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              data-testid="input-decision-comments"
            />
            {decisionTarget?.decision === "Rejected" && (
              <p className="text-xs text-muted-foreground">
                Rejecting returns the portage bill to the vessel for
                correction.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={doDecide}
              disabled={deciding}
              className={
                decisionTarget?.decision === "Rejected"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
              data-testid="button-confirm-decision"
            >
              {deciding ? "Saving…" : (decisionTarget?.decision ?? "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
