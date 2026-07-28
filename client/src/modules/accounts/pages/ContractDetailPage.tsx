import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Lock, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";

const TIMING_LABEL: Record<string, string> = {
  paid_on_board: "Paid on board",
  payable_at_settlement: "Payable at settlement",
  remitted_to_fund: "Remitted to fund",
};

const MODE_LABEL: Record<string, string> = {
  add_element: "Add element",
  replace_scale_value: "Replace scale value",
  suppress_element: "Suppress element",
};

const MODE_EXPLANATION: Record<string, string> = {
  add_element:
    "Pays this element on top of the wage scale — use for contract-specific extras (e.g. a special allowance).",
  replace_scale_value:
    "Uses this amount instead of the wage-scale amount for the element — the scale value is ignored while the override is effective.",
  suppress_element:
    "Removes the element from this contract entirely — no amount is needed.",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-600 text-white",
  draft: "bg-slate-500 text-white",
  completed: "bg-blue-600 text-white",
  settled: "bg-slate-700 text-white",
  cancelled: "bg-red-600 text-white",
};

/** True when the row is a value/suppress override (Section D), not a
 * timing-only flag (Section C). */
function isPayItem(o: any): boolean {
  return !(
    o.amount == null &&
    o.rate == null &&
    o.paymentTimingOverride != null &&
    o.overrideMode === "replace_scale_value"
  );
}

/** YYYY-MM → first day of month. */
const monthStart = (ym: string) => `${ym}-01`;
/** YYYY-MM → last day of month. */
function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map((n) => parseInt(n, 10));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

interface PayItemForm {
  epeUuid: string | null;
  payElementUuid: string;
  overrideMode: string;
  amount: string;
  rate: string;
  fromMonth: string; // YYYY-MM ("" = from contract start)
  toMonth: string; // YYYY-MM ("" = open)
  remarks: string;
}

const EMPTY_FORM: PayItemForm = {
  epeUuid: null,
  payElementUuid: "",
  overrideMode: "add_element",
  amount: "",
  rate: "",
  fromMonth: "",
  toMonth: "",
  remarks: "",
};

export default function ContractDetailPage({
  engagementUuid,
}: {
  engagementUuid: string;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { canEdit } = usePermissions();
  const mayEdit = canEdit("Account Contracts");

  const detailKey = [`${ACCOUNTS_BASE}/engagements/${engagementUuid}/detail`];
  const { data: detail, isLoading } = useQuery<any>({ queryKey: detailKey });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });

  const engagement = detail?.engagement ?? null;
  const frozen = !!detail?.frozen;
  const readOnly = frozen || !mayEdit;
  const overrides: any[] = detail?.overrides ?? [];
  const payItems = overrides.filter(isPayItem);
  const timingRows = overrides.filter((o) => !isPayItem(o));

  const { data: allotments = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/allotments/crew/${engagement?.crewUuid}`],
    enabled: !!engagement?.crewUuid,
  });
  const activeAllotments = allotments.filter(
    (a: any) => a.status === "active" && !a.isDeleted,
  );

  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of payElements) m.set(e.payElementUuid, e);
    return m;
  }, [payElements]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: detailKey });
  };
  const fail = (title: string, err: unknown) =>
    toast({
      title,
      description: parseApiError(err).message,
      variant: "destructive",
    });

  // ---- A: sign-off editor ----
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [endDateValue, setEndDateValue] = useState("");
  const [savingEndDate, setSavingEndDate] = useState(false);
  const saveEndDate = async () => {
    if (!endDateValue) return;
    setSavingEndDate(true);
    try {
      await accountsApiV2.engagements.update(engagementUuid, {
        endDate: endDateValue,
      });
      invalidate();
      setEndDateOpen(false);
      toast({
        title: "Sign-off date updated",
        description:
          "Marked as manually set — the crewing sync will report (not overwrite) any difference.",
      });
    } catch (err) {
      fail("Update failed", err);
    } finally {
      setSavingEndDate(false);
    }
  };

  // ---- B: seniority anchor editor ----
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [anchorYear, setAnchorYear] = useState("");
  const [anchorNextStep, setAnchorNextStep] = useState("");
  const [savingAnchor, setSavingAnchor] = useState(false);
  const openAnchor = () => {
    setAnchorYear(String(engagement?.scaleYearAtStart ?? 1));
    setAnchorNextStep(engagement?.nextStepDate ?? "");
    setAnchorOpen(true);
  };
  const saveAnchor = async () => {
    setSavingAnchor(true);
    try {
      const payload: Record<string, unknown> = {};
      const yr = parseInt(anchorYear, 10);
      if (!Number.isNaN(yr)) payload.scaleYearAtStart = yr;
      if (anchorNextStep) payload.nextStepDate = anchorNextStep;
      await accountsApiV2.engagements.update(engagementUuid, payload);
      invalidate();
      setAnchorOpen(false);
      toast({ title: "Seniority anchor updated" });
    } catch (err) {
      fail("Update failed", err);
    } finally {
      setSavingAnchor(false);
    }
  };

  // ---- F: notes ----
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await accountsApiV2.engagements.update(engagementUuid, {
        notes: notesValue.trim() || null,
      });
      invalidate();
      setNotesEditing(false);
      toast({ title: "Notes saved" });
    } catch (err) {
      fail("Update failed", err);
    } finally {
      setSavingNotes(false);
    }
  };

  // ---- C: payment timing ----
  const [timingElementUuid, setTimingElementUuid] = useState("");
  const [timingValue, setTimingValue] = useState("paid_on_board");
  const [savingTiming, setSavingTiming] = useState(false);
  const setTiming = async (
    payElementUuid: string,
    value: string | null,
  ) => {
    setSavingTiming(true);
    try {
      await accountsApiV2.engagements.setTimingOverride(
        engagementUuid,
        payElementUuid,
        value,
      );
      invalidate();
      toast({ title: "Payment timing updated" });
    } catch (err) {
      fail("Timing override failed", err);
    } finally {
      setSavingTiming(false);
    }
  };

  // "Pay leave on board" convenience toggle: first leave-category element.
  const leaveElement = useMemo(
    () =>
      payElements.find(
        (e) =>
          e.category === "leave" &&
          e.status === "active" &&
          e.paymentTiming === "payable_at_settlement",
      ),
    [payElements],
  );
  const leaveTimingRow = leaveElement
    ? timingRows.find((o) => o.payElementUuid === leaveElement.payElementUuid)
    : undefined;
  const leaveOnBoard = leaveTimingRow?.paymentTimingOverride === "paid_on_board";

  // ---- D: pay items dialog ----
  const [itemForm, setItemForm] = useState<PayItemForm | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNewItem = () => setItemForm({ ...EMPTY_FORM });
  const openEditItem = (o: any) =>
    setItemForm({
      epeUuid: o.epeUuid,
      payElementUuid: o.payElementUuid,
      overrideMode: o.overrideMode,
      amount: o.amount ?? "",
      rate: o.rate ?? "",
      fromMonth: o.effectiveFrom ? o.effectiveFrom.slice(0, 7) : "",
      toMonth: o.effectiveTo ? o.effectiveTo.slice(0, 7) : "",
      remarks: o.remarks ?? "",
    });

  const saveItem = async () => {
    if (!itemForm || !itemForm.payElementUuid) return;
    setSavingItem(true);
    try {
      const payload: Record<string, unknown> = {
        payElementUuid: itemForm.payElementUuid,
        overrideMode: itemForm.overrideMode,
        amount:
          itemForm.overrideMode === "suppress_element" || !itemForm.amount
            ? null
            : itemForm.amount,
        rate:
          itemForm.overrideMode === "suppress_element" || !itemForm.rate
            ? null
            : itemForm.rate,
        effectiveFrom: itemForm.fromMonth ? monthStart(itemForm.fromMonth) : null,
        effectiveTo: itemForm.toMonth ? monthEnd(itemForm.toMonth) : null,
        remarks: itemForm.remarks || null,
      };
      if (itemForm.epeUuid) {
        await accountsApiV2.engagements.updatePayItem(itemForm.epeUuid, payload);
      } else {
        await accountsApiV2.engagements.createPayItem(engagementUuid, payload);
      }
      invalidate();
      setItemForm(null);
      toast({ title: "Contract pay item saved" });
    } catch (err) {
      fail("Save failed", err);
    } finally {
      setSavingItem(false);
    }
  };

  const doDeleteItem = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await accountsApiV2.engagements.deletePayItem(deleteTarget.epeUuid);
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Contract pay item removed" });
    } catch (err) {
      fail("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading contract…
      </div>
    );
  }
  if (!engagement) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Contract not found.{" "}
        <button
          className="underline"
          onClick={() => setLocation("/accounts/payroll/contracts")}
        >
          Back to Contracts
        </button>
      </div>
    );
  }

  const elName = (uuid: string) => {
    const el = elementByUuid.get(uuid);
    return el ? `${el.code} — ${el.name}` : uuid;
  };

  return (
    <div className="p-4 space-y-4" data-testid="contract-detail-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/accounts/payroll/contracts")}
            data-testid="button-back-to-contracts"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-[#0f172a]">
              Contract — {detail.crewName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.vesselName ?? "No vessel"} ·{" "}
              {formatDate(engagement.startDate)} →{" "}
              {engagement.endDate ? formatDate(engagement.endDate) : "open"}
            </p>
          </div>
        </div>
        <Badge
          className={STATUS_BADGE[engagement.status] ?? "bg-slate-500 text-white"}
          data-testid="badge-contract-status"
        >
          {engagement.status}
        </Badge>
      </div>

      {frozen && (
        <div
          className="flex items-center gap-2 border border-slate-300 bg-slate-50 rounded px-3 py-2 text-sm text-slate-800"
          data-testid="banner-contract-frozen"
        >
          <Lock size={14} />
          This contract has a settlement in submitted or later status — all
          contract edits are disabled until it is reverted to draft.
        </div>
      )}

      {/* A — Summary */}
      <section className="border rounded-md bg-white">
        <div className="px-4 py-3 border-b font-medium text-sm">
          A · Contract Summary
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Crew</div>
            <div data-testid="text-contract-crew">{detail.crewName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Rank at start</div>
            <div>{engagement.rankIdAtStart ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Vessel</div>
            <div>{detail.vesselName ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Currency</div>
            <div>{engagement.currency}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sign on</div>
            <div>{formatDate(engagement.startDate)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sign off</div>
            <div className="flex items-center gap-2">
              <span data-testid="text-contract-sign-off">
                {engagement.endDate ? formatDate(engagement.endDate) : "open"}
              </span>
              {engagement.endDateManual && (
                <Badge variant="outline" className="text-xs text-amber-700">
                  manually set
                </Badge>
              )}
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  title="Edit sign-off date"
                  onClick={() => {
                    setEndDateValue(engagement.endDate ?? "");
                    setEndDateOpen(true);
                  }}
                  data-testid="button-edit-sign-off"
                >
                  <Pencil size={12} />
                </Button>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Wage scale</div>
            <div>{detail.scaleName ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <div>{engagement.engagementType?.replace(/_/g, " ")}</div>
          </div>
        </div>
      </section>

      {/* B — Seniority anchor */}
      <section className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">B · Seniority Anchor</span>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={openAnchor}
              data-testid="button-edit-anchor"
            >
              <Pencil size={14} className="mr-1" /> Edit
            </Button>
          )}
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">
              Scale year at start
            </div>
            <div data-testid="text-scale-year">
              Year {engagement.scaleYearAtStart ?? 1}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Next step date</div>
            <div data-testid="text-next-step">
              {engagement.nextStepDate
                ? formatDate(engagement.nextStepDate)
                : "—"}
            </div>
          </div>
          <div className="col-span-2 text-xs text-muted-foreground self-end">
            On the next step date the crew member advances one seniority step
            on the wage scale; wages from that day use the next scale year's
            figures automatically.
          </div>
        </div>
      </section>

      {/* C — Payment timing */}
      <section className="border rounded-md bg-white">
        <div className="px-4 py-3 border-b font-medium text-sm">
          C · Payment Timing
        </div>
        <div className="p-4 space-y-3 text-sm">
          {leaveElement && (
            <div className="flex items-center gap-3">
              <span>
                Pay {leaveElement.name} on board (instead of at settlement)?
              </span>
              <Select
                value={leaveOnBoard ? "yes" : "no"}
                onValueChange={(v) =>
                  setTiming(
                    leaveElement.payElementUuid,
                    v === "yes" ? "paid_on_board" : null,
                  )
                }
                disabled={readOnly || savingTiming}
              >
                <SelectTrigger
                  className="w-[90px] h-8"
                  data-testid="select-leave-on-board"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {timingRows.length > 0 && (
            <div className="space-y-1">
              {timingRows.map((o) => (
                <div
                  key={o.epeUuid}
                  className="flex items-center gap-2"
                  data-testid={`row-timing-${o.payElementUuid}`}
                >
                  <span>
                    {elName(o.payElementUuid)} →{" "}
                    {TIMING_LABEL[o.paymentTimingOverride] ??
                      o.paymentTimingOverride}
                  </span>
                  {!readOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-600"
                      title="Remove timing override (element returns to its default timing)"
                      onClick={() => setTiming(o.payElementUuid, null)}
                      disabled={savingTiming}
                    >
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex items-end gap-2 pt-1 border-t">
              <div>
                <Label className="text-xs">Element</Label>
                <Select
                  value={timingElementUuid}
                  onValueChange={setTimingElementUuid}
                >
                  <SelectTrigger
                    className="w-[260px] h-8"
                    data-testid="select-timing-element"
                  >
                    <SelectValue placeholder="Choose element" />
                  </SelectTrigger>
                  <SelectContent>
                    {payElements
                      .filter((e) => e.status === "active")
                      .map((e) => (
                        <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                          {e.code} — {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Pay it</Label>
                <Select value={timingValue} onValueChange={setTimingValue}>
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIMING_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!timingElementUuid || savingTiming}
                onClick={() => {
                  setTiming(timingElementUuid, timingValue);
                  setTimingElementUuid("");
                }}
                data-testid="button-add-timing"
              >
                Set timing
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* D — Contract pay items */}
      <section className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">
            D · Contract Pay Items ({payItems.length})
          </span>
          {!readOnly && (
            <Button
              size="sm"
              onClick={openNewItem}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-add-pay-item"
            >
              <Plus size={14} className="mr-1" /> Add pay item
            </Button>
          )}
        </div>
        <div className="p-4">
          {payItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contract-specific pay items — the wage scale applies as-is.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-1.5 pr-2">Element</th>
                  <th className="py-1.5 pr-2">Mode</th>
                  <th className="py-1.5 pr-2 text-right">Amount</th>
                  <th className="py-1.5 pr-2 text-right">Rate</th>
                  <th className="py-1.5 pr-2">Effective from</th>
                  <th className="py-1.5 pr-2">Effective to</th>
                  <th className="py-1.5 pr-2">Remarks</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {payItems.map((o) => (
                  <tr
                    key={o.epeUuid}
                    className="border-b last:border-0"
                    data-testid={`row-pay-item-${o.epeUuid}`}
                  >
                    <td className="py-1.5 pr-2">{elName(o.payElementUuid)}</td>
                    <td className="py-1.5 pr-2">
                      <span title={MODE_EXPLANATION[o.overrideMode]}>
                        {MODE_LABEL[o.overrideMode] ?? o.overrideMode}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {o.amount != null ? formatMoney(o.amount) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{o.rate ?? "—"}</td>
                    <td className="py-1.5 pr-2">
                      {o.effectiveFrom
                        ? formatDate(o.effectiveFrom)
                        : "contract start"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {o.effectiveTo ? formatDate(o.effectiveTo) : "open"}
                    </td>
                    <td className="py-1.5 pr-2">{o.remarks ?? ""}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => openEditItem(o)}
                            data-testid={`button-edit-pay-item-${o.epeUuid}`}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-600"
                            onClick={() => setDeleteTarget(o)}
                            data-testid={`button-delete-pay-item-${o.epeUuid}`}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Changes apply to open (unlocked) months only and take effect on the
            next calculation run. Effective windows are whole months —
            mid-month changes are not yet supported.
          </p>
        </div>
      </section>

      {/* E — Active allotments (read-only) */}
      <section className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">
            E · Active Allotments ({activeAllotments.length})
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/accounts/crew-finance/allotments-cash")}
            data-testid="button-open-allotments"
          >
            Manage in Allotments &amp; Cash
          </Button>
        </div>
        <div className="p-4 text-sm">
          {activeAllotments.length === 0 ? (
            <p className="text-muted-foreground">
              No active allotments for this crew member.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-1.5 pr-2">Beneficiary</th>
                  <th className="py-1.5 pr-2 text-right">Amount</th>
                  <th className="py-1.5 pr-2">Currency</th>
                  <th className="py-1.5 pr-2">Valid from</th>
                  <th className="py-1.5 pr-2">Valid to</th>
                </tr>
              </thead>
              <tbody>
                {activeAllotments.map((a: any) => (
                  <tr key={a.allotmentUuid} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      {a.beneficiaryName ?? a.beneficiary ?? "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {formatMoney(a.amount)}
                    </td>
                    <td className="py-1.5 pr-2">{a.currency ?? ""}</td>
                    <td className="py-1.5 pr-2">
                      {a.validFrom ? formatDate(a.validFrom) : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {a.validTo ? formatDate(a.validTo) : "open"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* F — Notes */}
      <section className="border rounded-md bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">F · Notes</span>
          {!readOnly && !notesEditing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNotesValue(engagement.notes ?? "");
                setNotesEditing(true);
              }}
              data-testid="button-edit-notes"
            >
              <Pencil size={14} className="mr-1" /> Edit
            </Button>
          )}
        </div>
        <div className="p-4 text-sm">
          {notesEditing ? (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Optional free-text notes for this contract"
                data-testid="input-contract-notes"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveNotes}
                  disabled={savingNotes}
                  data-testid="button-save-notes"
                >
                  {savingNotes ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNotesEditing(false)}
                  data-testid="button-cancel-notes"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p
              className={
                engagement.notes?.trim()
                  ? "whitespace-pre-wrap"
                  : "text-muted-foreground"
              }
              data-testid="text-contract-notes"
            >
              {engagement.notes?.trim() ? engagement.notes : "No notes."}
            </p>
          )}
        </div>
      </section>

      {/* ---- dialogs ---- */}
      <Dialog open={endDateOpen} onOpenChange={(o) => !o && setEndDateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set sign-off date</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sign-off-date">Sign-off (end) date</Label>
            <Input
              id="sign-off-date"
              type="date"
              value={endDateValue}
              onChange={(e) => setEndDateValue(e.target.value)}
              data-testid="input-sign-off-date"
            />
            <p className="text-xs text-muted-foreground">
              A manually set sign-off is never overwritten by the crewing sync
              — differences are reported for review instead.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEndDate}
              disabled={!endDateValue || savingEndDate}
              data-testid="button-save-sign-off"
            >
              {savingEndDate ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={anchorOpen} onOpenChange={(o) => !o && setAnchorOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit seniority anchor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="anchor-year">Scale year at start</Label>
              <Input
                id="anchor-year"
                type="number"
                min={1}
                value={anchorYear}
                onChange={(e) => setAnchorYear(e.target.value)}
                data-testid="input-anchor-year"
              />
            </div>
            <div>
              <Label htmlFor="anchor-next">Next step date</Label>
              <Input
                id="anchor-next"
                type="date"
                value={anchorNextStep}
                onChange={(e) => setAnchorNextStep(e.target.value)}
                data-testid="input-anchor-next-step"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnchorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveAnchor}
              disabled={savingAnchor}
              data-testid="button-save-anchor"
            >
              {savingAnchor ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemForm} onOpenChange={(o) => !o && setItemForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {itemForm?.epeUuid ? "Edit pay item" : "Add pay item"}
            </DialogTitle>
          </DialogHeader>
          {itemForm && (
            <div className="space-y-3">
              <div>
                <Label>Pay element</Label>
                <Select
                  value={itemForm.payElementUuid}
                  onValueChange={(v) =>
                    setItemForm({ ...itemForm, payElementUuid: v })
                  }
                >
                  <SelectTrigger data-testid="select-pay-item-element">
                    <SelectValue placeholder="Choose element" />
                  </SelectTrigger>
                  <SelectContent>
                    {payElements
                      .filter((e) => e.status === "active")
                      .map((e) => (
                        <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                          {e.code} — {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode</Label>
                <Select
                  value={itemForm.overrideMode}
                  onValueChange={(v) =>
                    setItemForm({ ...itemForm, overrideMode: v })
                  }
                >
                  <SelectTrigger data-testid="select-pay-item-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {MODE_EXPLANATION[itemForm.overrideMode]}
                </p>
              </div>
              {itemForm.overrideMode !== "suppress_element" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="item-amount">Monthly amount</Label>
                    <Input
                      id="item-amount"
                      type="number"
                      step="0.01"
                      value={itemForm.amount}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, amount: e.target.value })
                      }
                      data-testid="input-pay-item-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-rate">Rate (per unit)</Label>
                    <Input
                      id="item-rate"
                      type="number"
                      step="0.0001"
                      value={itemForm.rate}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, rate: e.target.value })
                      }
                      data-testid="input-pay-item-rate"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="item-from">Effective from (month)</Label>
                  <Input
                    id="item-from"
                    type="month"
                    value={itemForm.fromMonth}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, fromMonth: e.target.value })
                    }
                    data-testid="input-pay-item-from"
                  />
                </div>
                <div>
                  <Label htmlFor="item-to">Effective to (month)</Label>
                  <Input
                    id="item-to"
                    type="month"
                    value={itemForm.toMonth}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, toMonth: e.target.value })
                    }
                    data-testid="input-pay-item-to"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank for the whole contract. Windows are whole months —
                mid-month changes are not yet supported.
              </p>
              <div>
                <Label htmlFor="item-remarks">Remarks</Label>
                <Input
                  id="item-remarks"
                  value={itemForm.remarks}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, remarks: e.target.value })
                  }
                  data-testid="input-pay-item-remarks"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemForm(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveItem}
              disabled={
                savingItem ||
                !itemForm?.payElementUuid ||
                (itemForm?.overrideMode !== "suppress_element" &&
                  !itemForm?.amount &&
                  !itemForm?.rate)
              }
              data-testid="button-save-pay-item"
            >
              {savingItem ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove pay item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Remove the {deleteTarget ? elName(deleteTarget.payElementUuid) : ""}{" "}
            override from this contract? Open months revert to the wage scale on
            the next calculation run.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doDeleteItem}
              disabled={deleting}
              data-testid="button-confirm-delete-pay-item"
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
