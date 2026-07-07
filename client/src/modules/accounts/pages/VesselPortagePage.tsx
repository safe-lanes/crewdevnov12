import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle,
  Lock,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import VesselPeriodBar, { currentPeriod, formatPeriod } from "./VesselPeriodBar";

const MENU = "Account Vessel Portage";

const VESSEL_EDITABLE_STATUSES = ["open", "vessel_draft", "returned"];
const RETURNABLE_STATUSES = ["submitted", "office_review"];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-slate-100 text-slate-700",
  vessel_draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-800",
  returned: "bg-amber-100 text-amber-800",
  office_review: "bg-violet-100 text-violet-800",
  approved: "bg-green-100 text-green-800",
  locked: "bg-gray-200 text-gray-700",
};

function StatusBadge({
  status,
  testId,
}: {
  status: string | null | undefined;
  testId?: string;
}) {
  const s = status ?? "open";
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_STYLES[s] ?? ""}`}
      data-testid={testId}
    >
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

const ENTRY_CHIP_STYLES: Record<string, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700",
  submitted: "border-blue-300 bg-blue-50 text-blue-800",
  accepted: "border-green-300 bg-green-50 text-green-800",
  rejected: "border-red-300 bg-red-50 text-red-800",
};

const CTM_LINE_TYPES = [
  { value: "cash_advance_to_crew", label: "Cash advance to crew" },
  { value: "receipt", label: "Receipt" },
  { value: "expense", label: "Expense" },
  { value: "adjustment", label: "Adjustment" },
];

interface EntryForm {
  payElementUuid: string;
  qty: string;
  rate: string;
  amount: string;
  currency: string;
  remarks: string;
}

const emptyEntryForm: EntryForm = {
  payElementUuid: "",
  qty: "",
  rate: "",
  amount: "",
  currency: "USD",
  remarks: "",
};

interface CtmLineForm {
  lineDate: string;
  lineType: string;
  crewUuid: string;
  amount: string;
  description: string;
}

const emptyLineForm: CtmLineForm = {
  lineDate: "",
  lineType: "expense",
  crewUuid: "",
  amount: "",
  description: "",
};

export default function VesselPortagePage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, userType, getVesselIds } =
    usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);
  const mayDelete = canDelete(MENU);

  const isVessel = userType === "Ship";
  const fixedVesselUuid = isVessel ? (getVesselIds()[0] ?? "") : "";

  const [vesselUuid, setVesselUuid] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  useEffect(() => {
    if (isVessel && fixedVesselUuid) setVesselUuid(fixedVesselUuid);
  }, [isVessel, fixedVesselUuid]);
  const hasFilter = !!vesselUuid && !!period;

  // ---- queries -----------------------------------------------------------
  const statusKey = [
    `${ACCOUNTS_BASE}/vessel-portage/${vesselUuid}/${period}/status`,
  ];
  const { data: pkg, isLoading: pkgLoading } = useQuery<any>({
    queryKey: statusKey,
    enabled: hasFilter,
  });
  const ctmKey = [`${ACCOUNTS_BASE}/ctm/${vesselUuid}/${period}`];
  const { data: ctmDetail } = useQuery<any>({
    queryKey: ctmKey,
    enabled: hasFilter,
  });
  const txnsKey = [
    `${ACCOUNTS_BASE}/monthly-transactions?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: txns = [] } = useQuery<any[]>({
    queryKey: txnsKey,
    enabled: hasFilter,
  });
  const { data: reviewRows = [] } = useQuery<any[]>({
    queryKey: [
      `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: hasFilter,
  });
  const workspaceKey = [
    `${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: workspace } = useQuery<any>({
    queryKey: workspaceKey,
    enabled: hasFilter,
  });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: statusKey });
    queryClient.invalidateQueries({ queryKey: ctmKey });
    queryClient.invalidateQueries({ queryKey: txnsKey });
    queryClient.invalidateQueries({ queryKey: workspaceKey });
  };

  // ---- derived -----------------------------------------------------------
  const portage = pkg?.portage ?? null;
  const portageStatus: string = portage?.status ?? "open";
  const isLocked = portageStatus === "locked" || !!portage?.isLocked;
  const counts: Record<string, number> = pkg?.counts ?? {};

  // Vessel edits are allowed only while the month is with the vessel and
  // unlocked; the backend enforces the same rules per actor.
  const packageEditable =
    hasFilter && !isLocked && VESSEL_EDITABLE_STATUSES.includes(portageStatus);
  const canSubmit = packageEditable && mayEdit;
  const canReturn =
    !isVessel &&
    mayEdit &&
    !isLocked &&
    !!portage &&
    RETURNABLE_STATUSES.includes(portageStatus);

  const engagedRows = useMemo(
    () => reviewRows.filter((r) => r.engagement),
    [reviewRows],
  );
  const crewByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of reviewRows) m.set(r.crewUuid, r);
    return m;
  }, [reviewRows]);
  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of payElements) m.set(e.payElementUuid, e);
    return m;
  }, [payElements]);
  const manualElements = useMemo(
    () =>
      payElements.filter(
        (e) =>
          e.status === "active" &&
          ["manual_entry", "rate_times_qty"].includes(e.calcMethod),
      ),
    [payElements],
  );
  const netByEngagement = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of workspace?.crewTotals ?? []) {
      m.set(t.engagementUuid, t.netOnBoard);
    }
    return m;
  }, [workspace]);

  const vesselTxns = useMemo(
    () => txns.filter((t) => t.origin === "vessel"),
    [txns],
  );
  const txnsByCrew = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of vesselTxns) {
      const list = m.get(t.crewUuid);
      if (list) list.push(t);
      else m.set(t.crewUuid, [t]);
    }
    return m;
  }, [vesselTxns]);
  const txnByCtmLine = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of txns) if (t.ctmLineUuid) m.set(t.ctmLineUuid, t);
    return m;
  }, [txns]);

  const ctm = ctmDetail?.ctm ?? null;
  const ctmLines: any[] = ctmDetail?.lines ?? [];
  const openingCarried = !!ctmDetail?.openingCarried;
  const imbalance = !!ctmDetail?.imbalance;

  // ---- entry dialog ------------------------------------------------------
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryCrewUuid, setEntryCrewUuid] = useState("");
  const [entryEditing, setEntryEditing] = useState<any | null>(null);
  const [entryReadOnly, setEntryReadOnly] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);
  const [entrySaving, setEntrySaving] = useState(false);

  const setEf = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
    setEntryForm((f) => ({ ...f, [key]: value }));

  // Rate defaults from the crew's wage-scale line for rate×qty elements and
  // is read-only when found (the vessel cannot override scale rates).
  const entryEngagement = crewByUuid.get(entryCrewUuid)?.engagement;
  const scaleUuid: string = entryEngagement?.wageScaleUuid ?? "";
  const { data: scaleDetail } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/wage-scales/${scaleUuid}`],
    enabled: entryOpen && !entryEditing && !!scaleUuid,
  });
  const entryElement = elementByUuid.get(entryForm.payElementUuid);
  const scaleRateLine = useMemo(() => {
    if (entryEditing || entryElement?.calcMethod !== "rate_times_qty") {
      return null;
    }
    const rankId = entryEngagement?.rankIdAtStart;
    return (
      (scaleDetail?.lines ?? []).find(
        (l: any) =>
          l.payElementUuid === entryForm.payElementUuid &&
          l.rankId === rankId &&
          !l.isDeleted &&
          l.rate != null,
      ) ?? null
    );
  }, [scaleDetail, entryForm.payElementUuid, entryEngagement, entryEditing, entryElement]);
  useEffect(() => {
    if (!scaleRateLine) return;
    setEntryForm((f) => {
      const q = parseFloat(f.qty);
      const r = parseFloat(scaleRateLine.rate);
      return {
        ...f,
        rate: scaleRateLine.rate,
        amount:
          !Number.isNaN(q) && !Number.isNaN(r) ? (q * r).toFixed(2) : f.amount,
      };
    });
  }, [scaleRateLine]);

  const setEntryQtyRate = (qty: string, rate: string) => {
    const q = parseFloat(qty);
    const r = parseFloat(rate);
    setEntryForm((f) => ({
      ...f,
      qty,
      rate,
      amount:
        !Number.isNaN(q) && !Number.isNaN(r) ? (q * r).toFixed(2) : f.amount,
    }));
  };

  const openEntryCreate = (crewUuid: string) => {
    setEntryCrewUuid(crewUuid);
    setEntryEditing(null);
    setEntryReadOnly(false);
    setEntryForm(emptyEntryForm);
    setEntryOpen(true);
  };

  const openEntryView = (txn: any) => {
    setEntryCrewUuid(txn.crewUuid);
    setEntryEditing(txn);
    setEntryReadOnly(!(txn.status === "draft" && packageEditable && mayEdit));
    setEntryForm({
      payElementUuid: txn.payElementUuid ?? "",
      qty: txn.qty ?? "",
      rate: txn.rate ?? "",
      amount: txn.amount ?? "",
      currency: txn.currency ?? "USD",
      remarks: txn.remarks ?? "",
    });
    setEntryOpen(true);
  };

  const saveEntry = async () => {
    if (!entryForm.payElementUuid || !entryForm.amount) {
      toast({
        title: "Missing fields",
        description: "Pay element and amount are required.",
        variant: "destructive",
      });
      return;
    }
    setEntrySaving(true);
    try {
      if (entryEditing) {
        await accountsApiV2.monthlyTransactions.update(entryEditing.txnUuid, {
          qty: entryForm.qty || null,
          rate: entryForm.rate || null,
          amount: entryForm.amount,
          currency: entryForm.currency,
          remarks: entryForm.remarks.trim() || null,
        });
      } else {
        const review = crewByUuid.get(entryCrewUuid);
        await accountsApiV2.monthlyTransactions.create({
          engagementUuid: review.engagement.engagementUuid,
          crewUuid: entryCrewUuid,
          vesselUuid,
          period,
          payElementUuid: entryForm.payElementUuid,
          qty: entryForm.qty || null,
          rate: entryForm.rate || null,
          amount: entryForm.amount,
          currency: entryForm.currency,
          origin: "vessel",
          status: "draft",
          sourceType: "manual",
          remarks: entryForm.remarks.trim() || null,
        });
      }
      invalidateAll();
      setEntryOpen(false);
      toast({ title: entryEditing ? "Entry updated" : "Entry added" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setEntrySaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!entryEditing) return;
    setEntrySaving(true);
    try {
      await accountsApiV2.monthlyTransactions.remove(entryEditing.txnUuid);
      invalidateAll();
      setEntryOpen(false);
      toast({ title: "Entry deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setEntrySaving(false);
    }
  };

  // ---- CTM header + line dialogs ----------------------------------------
  const [headerForm, setHeaderForm] = useState({ opening: "", received: "" });
  const [headerSaving, setHeaderSaving] = useState(false);
  useEffect(() => {
    setHeaderForm({
      opening: ctm?.openingBalance ?? "",
      received: ctm?.receivedAmount ?? "",
    });
  }, [ctm?.openingBalance, ctm?.receivedAmount]);

  const saveHeader = async () => {
    setHeaderSaving(true);
    try {
      const body: Record<string, unknown> = {
        receivedAmount: headerForm.received || "0",
      };
      if (!openingCarried) body.openingBalance = headerForm.opening || "0";
      await accountsApiV2.ctm.updateHeader(vesselUuid, period, body);
      invalidateAll();
      toast({ title: "CTM header updated" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setHeaderSaving(false);
    }
  };

  const [lineOpen, setLineOpen] = useState(false);
  const [lineEditing, setLineEditing] = useState<any | null>(null);
  const [lineForm, setLineForm] = useState<CtmLineForm>(emptyLineForm);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineDeleteTarget, setLineDeleteTarget] = useState<any | null>(null);

  const setLf = <K extends keyof CtmLineForm>(key: K, value: CtmLineForm[K]) =>
    setLineForm((f) => ({ ...f, [key]: value }));

  const openLineCreate = () => {
    setLineEditing(null);
    setLineForm(emptyLineForm);
    setLineOpen(true);
  };
  const openLineEdit = (line: any) => {
    setLineEditing(line);
    setLineForm({
      lineDate: line.lineDate ?? "",
      lineType: line.lineType ?? "expense",
      crewUuid: line.crewUuid ?? "",
      amount: line.amount ?? "",
      description: line.description ?? "",
    });
    setLineOpen(true);
  };

  const saveLine = async () => {
    if (!lineForm.amount) {
      toast({
        title: "Missing amount",
        description: "An amount is required.",
        variant: "destructive",
      });
      return;
    }
    setLineSaving(true);
    try {
      const body = {
        lineDate: lineForm.lineDate || null,
        lineType: lineForm.lineType,
        crewUuid: lineForm.crewUuid || null,
        amount: lineForm.amount,
        description: lineForm.description.trim() || null,
      };
      if (lineEditing) {
        await accountsApiV2.ctm.updateLine(lineEditing.ctmLineUuid, body);
      } else {
        await accountsApiV2.ctm.createLine(vesselUuid, period, body);
      }
      invalidateAll();
      setLineOpen(false);
      toast({ title: lineEditing ? "CTM line updated" : "CTM line added" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setLineSaving(false);
    }
  };

  const deleteLine = async () => {
    if (!lineDeleteTarget) return;
    setLineSaving(true);
    try {
      await accountsApiV2.ctm.removeLine(lineDeleteTarget.ctmLineUuid);
      invalidateAll();
      setLineDeleteTarget(null);
      toast({ title: "CTM line deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setLineSaving(false);
    }
  };

  // ---- submit / return ---------------------------------------------------
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitWarnings, setSubmitWarnings] = useState<string[] | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [returning, setReturning] = useState(false);

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await accountsApiV2.vesselPortage.submit(
        vesselUuid,
        period,
      );
      setSubmitWarnings(result?.warnings ?? []);
      invalidateAll();
      setSubmitOpen(false);
      toast({
        title: "Month submitted",
        description: `${result?.transactionsSubmitted ?? 0} entries sent to office review.`,
      });
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

  const doReturn = async () => {
    if (!returnComment.trim()) {
      toast({
        title: "Comment required",
        description: "A comment is required to return the month.",
        variant: "destructive",
      });
      return;
    }
    setReturning(true);
    try {
      await accountsApiV2.vesselPortage.returnToVessel(
        portage.portageUuid,
        returnComment.trim(),
      );
      invalidateAll();
      setReturnOpen(false);
      setReturnComment("");
      toast({ title: "Month returned to vessel" });
    } catch (err) {
      toast({
        title: "Return failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setReturning(false);
    }
  };

  // ---- render ------------------------------------------------------------
  const entryStatusCounts = ["draft", "submitted", "accepted", "rejected"].map(
    (s) => ({ status: s, count: counts[s] ?? 0 }),
  );

  return (
    <div className="p-4 space-y-4" data-testid="vessel-portage-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">
            Vessel Portage — Monthly Submission
          </h1>
          <p className="text-sm text-muted-foreground">
            Crew variables, CTM cash account and month-end submission to office
          </p>
        </div>
        {hasFilter && (
          <div className="flex items-center gap-2">
            <StatusBadge
              status={portageStatus}
              testId="badge-portage-status"
            />
            {isLocked && (
              <Badge variant="outline" className="gap-1" data-testid="badge-locked">
                <Lock size={12} /> Locked
              </Badge>
            )}
            {canReturn && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReturnOpen(true)}
                data-testid="button-return-to-vessel"
              >
                <Undo2 size={14} className="mr-1" /> Return to Vessel
              </Button>
            )}
            {canSubmit && (
              <Button
                size="sm"
                className="bg-[#16569e] hover:bg-[#1e5fa8]"
                onClick={() => setSubmitOpen(true)}
                data-testid="button-submit-month"
              >
                <Send size={14} className="mr-1" /> Submit Month
              </Button>
            )}
          </div>
        )}
      </div>

      <VesselPeriodBar
        vesselUuid={vesselUuid}
        period={period}
        onVesselChange={isVessel ? () => {} : setVesselUuid}
        onPeriodChange={(p) => {
          setPeriod(p);
          setSubmitWarnings(null);
        }}
      />

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          {isVessel && !fixedVesselUuid
            ? "No vessel assignment found for your account."
            : "Select a vessel and period to open the monthly submission package."}
        </div>
      )}

      {hasFilter && pkgLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading package…
        </div>
      )}

      {hasFilter && !pkgLoading && (
        <>
          {submitWarnings && submitWarnings.length > 0 && (
            <div
              className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 space-y-1"
              data-testid="banner-submit-warnings"
            >
              {submitWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <Tabs defaultValue="crew">
            <TabsList data-testid="tabs-vessel-portage">
              <TabsTrigger value="crew" data-testid="tab-crew-variables">
                Crew &amp; Variables
              </TabsTrigger>
              <TabsTrigger value="ctm" data-testid="tab-ctm">
                CTM Cash Account
              </TabsTrigger>
              <TabsTrigger value="submission" data-testid="tab-submission">
                Submission
              </TabsTrigger>
            </TabsList>

            {/* ------------------- Tab 1: Crew & Variables ------------------- */}
            <TabsContent value="crew">
              <div className="border rounded-md bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Crew</th>
                      <th className="px-3 py-2 font-medium">Rank</th>
                      <th className="px-3 py-2 font-medium">Sign On / Off</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Net On Board
                      </th>
                      <th className="px-3 py-2 font-medium">
                        Month Entries
                      </th>
                      <th className="px-3 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {engagedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                          data-testid="text-no-crew"
                        >
                          No engaged crew for this vessel-month.
                        </td>
                      </tr>
                    )}
                    {engagedRows.map((r) => {
                      const entries = txnsByCrew.get(r.crewUuid) ?? [];
                      const net = netByEngagement.get(
                        r.engagement.engagementUuid,
                      );
                      return (
                        <tr
                          key={r.crewUuid}
                          className="border-b last:border-0 align-top"
                          data-testid={`row-crew-${r.crewUuid}`}
                        >
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {r.crewName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.presentRank ?? "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(r.engagement.startDate)} →{" "}
                            {r.engagement.endDate
                              ? formatDate(r.engagement.endDate)
                              : "on board"}
                          </td>
                          <td
                            className="px-3 py-2 text-right whitespace-nowrap"
                            data-testid={`text-net-${r.crewUuid}`}
                          >
                            {net != null ? formatMoney(net) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {entries.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  No entries
                                </span>
                              )}
                              {entries.map((t) => {
                                const el = elementByUuid.get(t.payElementUuid);
                                return (
                                  <button
                                    key={t.txnUuid}
                                    type="button"
                                    onClick={() => openEntryView(t)}
                                    title={
                                      t.status === "rejected" && t.reviewComment
                                        ? `Rejected: ${t.reviewComment}`
                                        : `${t.status}`
                                    }
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                      ENTRY_CHIP_STYLES[t.status] ?? ""
                                    }`}
                                    data-testid={`chip-entry-${t.txnUuid}`}
                                  >
                                    <span className="font-medium">
                                      {el?.code ?? "?"}
                                    </span>
                                    <span>{formatMoney(t.amount)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {packageEditable && mayCreate && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => openEntryCreate(r.crewUuid)}
                                data-testid={`button-add-entry-${r.crewUuid}`}
                              >
                                <Plus size={13} className="mr-1" /> Entry
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ------------------- Tab 2: CTM Cash Account ------------------- */}
            <TabsContent value="ctm" className="space-y-3">
              {imbalance && (
                <div
                  className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 flex items-start gap-1"
                  data-testid="banner-ctm-imbalance"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    CTM does not reconcile: closing ≠ opening + received +
                    signed lines. Review the lines below.
                  </span>
                </div>
              )}
              <div className="border rounded-md bg-white p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Opening Balance{openingCarried ? " (carried)" : ""}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9 w-36"
                      value={headerForm.opening}
                      disabled={openingCarried || !packageEditable || !mayEdit}
                      onChange={(e) =>
                        setHeaderForm((f) => ({
                          ...f,
                          opening: e.target.value,
                        }))
                      }
                      data-testid="input-ctm-opening"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Received This Month
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9 w-36"
                      value={headerForm.received}
                      disabled={!packageEditable || !mayEdit}
                      onChange={(e) =>
                        setHeaderForm((f) => ({
                          ...f,
                          received: e.target.value,
                        }))
                      }
                      data-testid="input-ctm-received"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Closing Balance (computed)
                    </Label>
                    <div
                      className="h-9 w-36 flex items-center px-3 border rounded-md bg-slate-50 font-medium"
                      data-testid="text-ctm-closing"
                    >
                      {ctm ? formatMoney(ctm.closingBalance) : "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Status</Label>
                    <div className="h-9 flex items-center">
                      <StatusBadge
                        status={ctm?.status}
                        testId="badge-ctm-status"
                      />
                    </div>
                  </div>
                  {packageEditable && mayEdit && (
                    <Button
                      size="sm"
                      onClick={saveHeader}
                      disabled={headerSaving}
                      data-testid="button-save-ctm-header"
                    >
                      {headerSaving ? "Saving…" : "Save Header"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border rounded-md bg-white">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <h3 className="text-sm font-medium">CTM Lines</h3>
                  {packageEditable && mayCreate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openLineCreate}
                      data-testid="button-add-ctm-line"
                    >
                      <Plus size={13} className="mr-1" /> Add Line
                    </Button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Crew</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Amount
                      </th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {ctmLines.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                          data-testid="text-no-ctm-lines"
                        >
                          No CTM lines for this month.
                        </td>
                      </tr>
                    )}
                    {ctmLines.map((l) => {
                      const isAuto = txnByCtmLine.has(l.ctmLineUuid);
                      return (
                        <tr
                          key={l.ctmLineUuid}
                          className="border-b last:border-0"
                          data-testid={`row-ctm-line-${l.ctmLineUuid}`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {l.lineDate ? formatDate(l.lineDate) : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {CTM_LINE_TYPES.find(
                              (t) => t.value === l.lineType,
                            )?.label ?? l.lineType}
                            {isAuto && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px]"
                                data-testid={`badge-auto-${l.ctmLineUuid}`}
                              >
                                auto
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {l.crewUuid
                              ? (crewByUuid.get(l.crewUuid)?.crewName ??
                                l.crewUuid)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formatMoney(l.amount)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {l.description ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {packageEditable && !isAuto && (
                              <>
                                {mayEdit && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => openLineEdit(l)}
                                    data-testid={`button-edit-ctm-line-${l.ctmLineUuid}`}
                                  >
                                    <Pencil size={13} />
                                  </Button>
                                )}
                                {mayDelete && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-600"
                                    onClick={() => setLineDeleteTarget(l)}
                                    data-testid={`button-delete-ctm-line-${l.ctmLineUuid}`}
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ------------------- Tab 3: Submission ------------------- */}
            <TabsContent value="submission" className="space-y-3">
              <div className="border rounded-md bg-white p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Month Summary — {formatPeriod(period)}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {entryStatusCounts.map(({ status, count }) => (
                      <div
                        key={status}
                        className="border rounded-md px-4 py-2 text-center min-w-24"
                        data-testid={`count-${status}`}
                      >
                        <div className="text-lg font-semibold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {status}
                        </div>
                      </div>
                    ))}
                    <div
                      className="border rounded-md px-4 py-2 text-center min-w-32"
                      data-testid="summary-ctm-closing"
                    >
                      <div className="text-lg font-semibold">
                        {ctm ? formatMoney(ctm.closingBalance) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CTM Closing
                      </div>
                    </div>
                  </div>
                </div>

                {imbalance && (
                  <div
                    className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 flex items-start gap-1"
                    data-testid="warning-imbalance"
                  >
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      CTM does not reconcile — you can still submit, but the
                      office will see this warning.
                    </span>
                  </div>
                )}

                {!packageEditable && !isLocked && (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-submission-readonly"
                  >
                    This month is {portageStatus.replace(/_/g, " ")} — the
                    package is read-only for the vessel until it is returned or
                    locked.
                  </p>
                )}

                {canSubmit && (
                  <Button
                    className="bg-[#16569e] hover:bg-[#1e5fa8]"
                    onClick={() => setSubmitOpen(true)}
                    data-testid="button-submit-month-tab"
                  >
                    <Send size={14} className="mr-1" /> Submit Month to Office
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ---------------- Entry add/edit/view dialog ---------------- */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entryEditing
                ? entryReadOnly
                  ? "Entry Details"
                  : "Edit Entry"
                : "Add Entry"}{" "}
              — {crewByUuid.get(entryCrewUuid)?.crewName ?? ""}
            </DialogTitle>
          </DialogHeader>
          {entryEditing && (
            <div className="flex items-center gap-2 text-sm">
              <StatusBadge
                status={entryEditing.status}
                testId="badge-entry-status"
              />
              {entryEditing.status === "rejected" &&
                entryEditing.reviewComment && (
                  <span
                    className="text-red-700 text-xs"
                    data-testid="text-entry-reject-comment"
                  >
                    Office: {entryEditing.reviewComment}
                  </span>
                )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Pay Element</Label>
              <Select
                value={entryForm.payElementUuid}
                onValueChange={(v) => setEf("payElementUuid", v)}
                disabled={!!entryEditing}
              >
                <SelectTrigger data-testid="select-entry-element">
                  <SelectValue placeholder="Select pay element" />
                </SelectTrigger>
                <SelectContent>
                  {manualElements.map((e) => (
                    <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                      {e.code} — {e.name} ({e.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input
                type="number"
                step="0.01"
                value={entryForm.qty}
                disabled={entryReadOnly}
                onChange={(e) => setEntryQtyRate(e.target.value, entryForm.rate)}
                data-testid="input-entry-qty"
              />
            </div>
            <div className="space-y-1">
              <Label>Rate{scaleRateLine ? " (from scale)" : ""}</Label>
              <Input
                type="number"
                step="0.0001"
                value={entryForm.rate}
                disabled={entryReadOnly || !!scaleRateLine}
                onChange={(e) => setEntryQtyRate(entryForm.qty, e.target.value)}
                data-testid="input-entry-rate"
              />
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={entryForm.amount}
                disabled={entryReadOnly}
                onChange={(e) => setEf("amount", e.target.value)}
                data-testid="input-entry-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={entryForm.currency}
                maxLength={3}
                disabled={entryReadOnly}
                onChange={(e) => setEf("currency", e.target.value.toUpperCase())}
                data-testid="input-entry-currency"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Remarks</Label>
              <Textarea
                rows={2}
                value={entryForm.remarks}
                disabled={entryReadOnly}
                onChange={(e) => setEf("remarks", e.target.value)}
                data-testid="input-entry-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            {entryEditing &&
              !entryReadOnly &&
              mayDelete &&
              entryEditing.status === "draft" && (
                <Button
                  variant="outline"
                  className="mr-auto text-red-600"
                  onClick={deleteEntry}
                  disabled={entrySaving}
                  data-testid="button-delete-entry"
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              )}
            <Button variant="outline" onClick={() => setEntryOpen(false)}>
              {entryReadOnly ? "Close" : "Cancel"}
            </Button>
            {!entryReadOnly && (
              <Button
                onClick={saveEntry}
                disabled={entrySaving}
                data-testid="button-save-entry"
              >
                {entrySaving ? "Saving…" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- CTM line dialog ---------------- */}
      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lineEditing ? "Edit CTM Line" : "Add CTM Line"} —{" "}
              {formatPeriod(period)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={lineForm.lineDate}
                onChange={(e) => setLf("lineDate", e.target.value)}
                data-testid="input-line-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={lineForm.lineType}
                onValueChange={(v) => setLf("lineType", v)}
              >
                <SelectTrigger data-testid="select-line-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CTM_LINE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lineForm.lineType === "cash_advance_to_crew" && (
              <div className="space-y-1 col-span-2">
                <Label>Crew</Label>
                <Select
                  value={lineForm.crewUuid}
                  onValueChange={(v) => setLf("crewUuid", v)}
                >
                  <SelectTrigger data-testid="select-line-crew">
                    <SelectValue placeholder="Select crew member" />
                  </SelectTrigger>
                  <SelectContent>
                    {engagedRows.map((r) => (
                      <SelectItem key={r.crewUuid} value={r.crewUuid}>
                        {r.crewName} ({r.presentRank ?? "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={lineForm.amount}
                onChange={(e) => setLf("amount", e.target.value)}
                data-testid="input-line-amount"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={lineForm.description}
                onChange={(e) => setLf("description", e.target.value)}
                data-testid="input-line-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveLine}
              disabled={lineSaving}
              data-testid="button-save-ctm-line"
            >
              {lineSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- CTM line delete confirm ---------------- */}
      <Dialog
        open={!!lineDeleteTarget}
        onOpenChange={(o) => !o && setLineDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete CTM Line</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete this {lineDeleteTarget?.lineType?.replace(/_/g, " ")} line of{" "}
            {formatMoney(lineDeleteTarget?.amount)}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={deleteLine}
              disabled={lineSaving}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-ctm-line"
            >
              {lineSaving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Submit confirm dialog ---------------- */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Month — {formatPeriod(period)}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              Submitting sends all draft entries and the CTM cash account to the
              office for review. The package becomes read-only for the vessel
              until it is returned or locked.
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{counts.draft ?? 0} draft entries will be submitted</li>
              <li>
                CTM closing:{" "}
                {ctm ? `${formatMoney(ctm.closingBalance)} ${ctm.currency ?? ""}` : "—"}
              </li>
              {imbalance && (
                <li className="text-amber-700">
                  CTM does not reconcile — submitted with a warning
                </li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doSubmit}
              disabled={submitting}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-confirm-submit"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Return-to-vessel dialog ---------------- */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Month to Vessel</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Returning re-opens the month for the vessel: submitted entries
              revert to draft and the CTM re-opens. A comment is required.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for returning the month…"
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              data-testid="input-return-comment"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doReturn}
              disabled={returning || !returnComment.trim()}
              data-testid="button-confirm-return"
            >
              {returning ? "Returning…" : "Return to Vessel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
