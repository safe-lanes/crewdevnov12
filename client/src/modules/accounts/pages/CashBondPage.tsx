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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Eye, Ban, Lock, Info } from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatMoney } from "../accountsFormat";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import VesselPeriodBar, { formatPeriod } from "./VesselPeriodBar";
import { useVesselPeriod } from "../vesselPeriodStore";

// Advances & Bond are governed by the combined "Allotments & Cash" screen's
// menu row (Account Allotments) since the Cash & Bond menu row was retired.
const MENU = "Account Allotments";

/* ------------------------------------------------------------------ */
/* Advances tab                                                        */
/* ------------------------------------------------------------------ */

interface AdvanceForm {
  crewUuid: string;
  amount: string;
  currency: string;
  requestDate: string;
  recoveryAmount: string;
  reason: string;
}

const emptyAdvanceForm: AdvanceForm = {
  crewUuid: "",
  amount: "",
  currency: "USD",
  requestDate: "",
  recoveryAmount: "",
  reason: "",
};

/** Client-side schedule preview: recovery/month with clamped final month. */
function previewSchedule(amount: string, recovery: string): string[] {
  const total = Math.round(parseFloat(amount) * 100);
  const per = Math.round(parseFloat(recovery) * 100);
  if (!Number.isFinite(total) || !Number.isFinite(per) || total <= 0 || per <= 0)
    return [];
  const months: string[] = [];
  let outstanding = total;
  while (outstanding > 0 && months.length < 240) {
    const post = Math.min(per, outstanding);
    months.push((post / 100).toFixed(2));
    outstanding -= post;
  }
  return months;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "border-blue-300 bg-blue-50 text-blue-800";
    case "fully-recovered":
      return "border-green-300 bg-green-50 text-green-800";
    case "cancelled":
      return "border-gray-300 bg-gray-50 text-gray-600";
    case "closed":
      return "border-amber-300 bg-amber-50 text-amber-800";
    default:
      return "";
  }
}

export function AdvancesTab({
  vesselUuid,
  period,
}: {
  vesselUuid: string;
  period: string;
}) {
  const { toast } = useToast();
  const { canCreate, canEdit } = usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);

  const listKey = [`${ACCOUNTS_BASE}/advances`];
  const { data: advances = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
  });

  const { data: reviewRows = [] } = useQuery<any[]>({
    queryKey: [
      `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: !!vesselUuid && !!period,
  });
  const engagedRows = useMemo(
    () => reviewRows.filter((r) => r.engagement),
    [reviewRows],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AdvanceForm>(emptyAdvanceForm);
  const [saving, setSaving] = useState(false);
  const [detailUuid, setDetailUuid] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [closeTarget, setCloseTarget] = useState<any | null>(null);
  const [closeRemark, setCloseRemark] = useState("");
  const [acting, setActing] = useState(false);

  const set = <K extends keyof AdvanceForm>(key: K, value: AdvanceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: detail } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/advances/${detailUuid}/detail`],
    enabled: !!detailUuid,
  });

  const schedule = previewSchedule(form.amount, form.recoveryAmount);

  const save = async () => {
    const crew = engagedRows.find((r) => r.crewUuid === form.crewUuid);
    if (!crew) {
      toast({
        title: "Missing crew",
        description: "Select a vessel/period above, then a crew member.",
        variant: "destructive",
      });
      return;
    }
    if (!form.amount || !form.recoveryAmount) {
      toast({
        title: "Missing fields",
        description: "Amount and monthly recovery are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await accountsApiV2.advances.create({
        crewUuid: form.crewUuid,
        crewName: crew.crewName ?? null,
        rank: crew.presentRank ?? null,
        engagementUuid: crew.engagement?.engagementUuid ?? null,
        amount: form.amount,
        currency: form.currency,
        requestDate: form.requestDate || null,
        recoveryAmount: form.recoveryAmount,
        reason: form.reason.trim() || null,
        period,
      });
      queryClient.invalidateQueries({ queryKey: listKey });
      setDialogOpen(false);
      toast({ title: "Advance created" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setActing(true);
    try {
      await accountsApiV2.advances.cancel(cancelTarget.advanceUuid);
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: "Advance cancelled" });
    } catch (err) {
      toast({
        title: "Cancel failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setActing(false);
      setCancelTarget(null);
    }
  };

  const doClose = async () => {
    if (!closeTarget || !closeRemark.trim()) return;
    setActing(true);
    try {
      await accountsApiV2.advances.close(
        closeTarget.advanceUuid,
        closeRemark.trim(),
      );
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({ title: "Advance closed (remainder written off)" });
    } catch (err) {
      toast({
        title: "Close failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setActing(false);
      setCloseTarget(null);
      setCloseRemark("");
    }
  };

  const cols: ColDef[] = useMemo(
    () => [
      { headerName: "Crew", field: "crewName", flex: 2, minWidth: 150 },
      { headerName: "Rank", field: "rank", width: 90 },
      { headerName: "Vessel", field: "vesselName", flex: 1, minWidth: 110 },
      { headerName: "Date", field: "requestDate", width: 110 },
      {
        headerName: "Amount",
        field: "amount",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      { headerName: "Ccy", field: "currency", width: 70 },
      {
        headerName: "Recovery / Month",
        field: "recoveryAmount",
        width: 140,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Recovered",
        field: "recoveredToDate",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Outstanding",
        field: "outstanding",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      {
        headerName: "Status",
        field: "displayStatus",
        width: 130,
        cellRenderer: (p: any) => (
          <Badge
            variant="outline"
            className={`text-xs ${statusBadgeClass(p.value)}`}
          >
            {p.value}
          </Badge>
        ),
      },
      { headerName: "Remarks", field: "reason", flex: 2, minWidth: 140 },
      {
        headerName: "Actions",
        width: 130,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const row = p.data;
          return (
            <div className="flex items-center gap-1 h-full">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="View recovery detail"
                onClick={() => setDetailUuid(row.advanceUuid)}
                data-testid={`button-detail-advance-${row.advanceUuid}`}
              >
                <Eye size={14} />
              </Button>
              {mayEdit && row.displayStatus === "open" && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600"
                    title="Cancel (no recoveries posted)"
                    disabled={acting}
                    onClick={() => setCancelTarget(row)}
                    data-testid={`button-cancel-advance-${row.advanceUuid}`}
                  >
                    <Ban size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-amber-600"
                    title="Close (write off remainder)"
                    disabled={acting}
                    onClick={() => {
                      setCloseRemark("");
                      setCloseTarget(row);
                    }}
                    data-testid={`button-close-advance-${row.advanceUuid}`}
                  >
                    <Lock size={14} />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [mayEdit, acting],
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {mayCreate && (
          <Button
            size="sm"
            onClick={() => {
              setForm({
                ...emptyAdvanceForm,
                requestDate: new Date().toISOString().slice(0, 10),
              });
              setDialogOpen(true);
            }}
            className="bg-[#16569e] hover:bg-[#1e5fa8]"
            data-testid="button-add-advance"
          >
            <Plus size={14} className="mr-1" /> New Advance
          </Button>
        )}
      </div>

      <div className="border rounded-md bg-white p-2">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading advances…
          </div>
        ) : (
          <AgGridTable rowData={advances} columnDefs={cols} height="440px" />
        )}
      </div>

      {/* Create dialog with live schedule preview */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Cash Advance</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Crew</Label>
              <Select
                value={form.crewUuid}
                onValueChange={(v) => set("crewUuid", v)}
              >
                <SelectTrigger data-testid="select-advance-crew">
                  <SelectValue
                    placeholder={
                      vesselUuid
                        ? "Select crew member"
                        : "Select vessel & period above first"
                    }
                  />
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
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                data-testid="input-advance-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                data-testid="input-advance-currency"
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.requestDate}
                onChange={(e) => set("requestDate", e.target.value)}
                data-testid="input-advance-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Recovery per Month</Label>
              <Input
                type="number"
                step="0.01"
                value={form.recoveryAmount}
                onChange={(e) => set("recoveryAmount", e.target.value)}
                data-testid="input-advance-recovery"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Remarks</Label>
              <Textarea
                rows={2}
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                data-testid="input-advance-remarks"
              />
            </div>
            {schedule.length > 0 && (
              <div
                className="col-span-2 border rounded-md bg-slate-50 p-3 text-sm"
                data-testid="preview-recovery-schedule"
              >
                <div className="font-medium mb-1">
                  Recovery schedule preview — {schedule.length} month
                  {schedule.length > 1 ? "s" : ""}
                </div>
                <div className="flex flex-wrap gap-1">
                  {schedule.map((amt, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={
                        i === schedule.length - 1 &&
                        amt !== schedule[0]
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : ""
                      }
                    >
                      M{i + 1}: {formatMoney(amt)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-new-advance"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-save-advance"
            >
              {saving ? "Saving…" : "Create Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail drawer: schedule projection vs actual recoveries */}
      <Sheet
        open={!!detailUuid}
        onOpenChange={(open) => !open && setDetailUuid(null)}
      >
        <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Advance Recovery Detail</SheetTitle>
          </SheetHeader>
          {detail ? (
            <div className="mt-4 space-y-4 text-sm" data-testid="advance-detail">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Crew</div>
                <div>{detail.advance?.crewName ?? detail.advance?.crewUuid}</div>
                <div className="text-muted-foreground">Amount</div>
                <div>
                  {formatMoney(detail.advance?.amount)}{" "}
                  {detail.advance?.currency}
                </div>
                <div className="text-muted-foreground">Recovered to date</div>
                <div>{formatMoney(detail.recoveredToDate)}</div>
                <div className="text-muted-foreground">Outstanding</div>
                <div>{formatMoney(detail.outstanding)}</div>
                <div className="text-muted-foreground">Status</div>
                <div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${statusBadgeClass(detail.displayStatus)}`}
                  >
                    {detail.displayStatus}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="font-medium mb-1">
                  Schedule projection vs actuals
                </div>
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="p-1.5 border">Month</th>
                      <th className="p-1.5 border text-right">Projected</th>
                      <th className="p-1.5 border text-right">Actual</th>
                      <th className="p-1.5 border">Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const actualByPeriod = new Map<string, any>(
                        (detail.actuals ?? []).map((a: any) => [a.period, a]),
                      );
                      const periods = Array.from(
                        new Set([
                          ...(detail.schedule ?? []).map((s: any) => s.period),
                          ...(detail.actuals ?? []).map((a: any) => a.period),
                        ]),
                      ).sort();
                      return periods.map((p) => {
                        const proj = (detail.schedule ?? []).find(
                          (s: any) => s.period === p,
                        );
                        const act = actualByPeriod.get(p);
                        return (
                          <tr key={p} data-testid={`row-recovery-${p}`}>
                            <td className="p-1.5 border">{p}</td>
                            <td className="p-1.5 border text-right">
                              {proj ? formatMoney(proj.amount) : "—"}
                            </td>
                            <td className="p-1.5 border text-right">
                              {act ? formatMoney(act.amount) : "—"}
                            </td>
                            <td className="p-1.5 border">
                              {act
                                ? act.portagePosted
                                  ? "posted"
                                  : "pending"
                                : ""}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel advance?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancels the advance for {cancelTarget?.crewName}. Only possible
              while no recoveries have been posted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-advance">
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={acting}
              onClick={doCancel}
              data-testid="button-confirm-cancel-advance"
            >
              Cancel Advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close (write-off) dialog */}
      <Dialog
        open={!!closeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCloseTarget(null);
            setCloseRemark("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close advance (write off remainder)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Writes off the outstanding balance of{" "}
            {formatMoney(closeTarget?.outstanding)} for{" "}
            {closeTarget?.crewName}. Nothing further is posted. A remark is
            required.
          </p>
          <Textarea
            rows={3}
            placeholder="Write-off reason…"
            value={closeRemark}
            onChange={(e) => setCloseRemark(e.target.value)}
            data-testid="input-close-remark"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseTarget(null)}
              data-testid="button-cancel-close"
            >
              Cancel
            </Button>
            <Button
              onClick={doClose}
              disabled={acting || !closeRemark.trim()}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-close"
            >
              Close Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bond / Slop Chest tab                                               */
/* ------------------------------------------------------------------ */

interface BondForm {
  crewUuid: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  deductionAmount: string;
  currency: string;
  saleDate: string;
}

const emptyBondForm: BondForm = {
  crewUuid: "",
  itemName: "",
  quantity: "",
  unitPrice: "",
  totalPrice: "",
  deductionAmount: "",
  currency: "USD",
  saleDate: "",
};

export function BondTab({
  vesselUuid,
  period,
}: {
  vesselUuid: string;
  period: string;
}) {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);
  const mayDelete = canDelete(MENU);
  const hasFilter = !!vesselUuid && !!period;

  const listKey = [
    `${ACCOUNTS_BASE}/bond-items?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
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
  const { data: workspace } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`],
    enabled: hasFilter,
  });
  const isLocked =
    workspace?.portage?.status === "locked" || !!workspace?.portage?.isLocked;

  const engagedRows = useMemo(
    () => reviewRows.filter((r) => r.engagement),
    [reviewRows],
  );
  const crewByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of reviewRows) m.set(r.crewUuid, r);
    return m;
  }, [reviewRows]);

  const rollupByCrew = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of txns) {
      if (t.sourceType === "bond") m.set(t.crewUuid, t);
    }
    return m;
  }, [txns]);

  // Per-crew subtotals of live auto-deduct items.
  const crewGroups = useMemo(() => {
    const groups = new Map<
      string,
      { crewName: string; subtotal: number; count: number }
    >();
    for (const it of items) {
      if (it.status === "cancelled") continue;
      const key = it.crewUuid;
      const g = groups.get(key) ?? {
        crewName:
          it.crewName ?? crewByUuid.get(key)?.crewName ?? key,
        subtotal: 0,
        count: 0,
      };
      const amt = Number(it.deductionAmount ?? it.totalPrice ?? 0);
      if (it.autoDeduct && Number.isFinite(amt)) g.subtotal += amt;
      g.count += 1;
      groups.set(key, g);
    }
    return Array.from(groups.entries()).map(([crewUuid, g]) => ({
      crewUuid,
      ...g,
    }));
  }, [items, crewByUuid]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<BondForm>(emptyBondForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof BondForm>(key: K, value: BondForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setQtyPrice = (quantity: string, unitPrice: string) => {
    const q = parseFloat(quantity);
    const u = parseFloat(unitPrice);
    setForm((f) => {
      const total =
        !Number.isNaN(q) && !Number.isNaN(u) ? (q * u).toFixed(2) : f.totalPrice;
      return {
        ...f,
        quantity,
        unitPrice,
        totalPrice: total,
        deductionAmount:
          f.deductionAmount === f.totalPrice || !f.deductionAmount
            ? total
            : f.deductionAmount,
      };
    });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({ queryKey: txnsKey });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyBondForm,
      saleDate: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      crewUuid: row.crewUuid ?? "",
      itemName: row.itemName ?? "",
      quantity: row.quantity ?? "",
      unitPrice: row.unitPrice ?? "",
      totalPrice: row.totalPrice ?? "",
      deductionAmount: row.deductionAmount ?? "",
      currency: row.currency ?? "USD",
      saleDate: row.saleDate ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!editing && !form.crewUuid) {
      toast({
        title: "Missing crew",
        description: "Select a crew member.",
        variant: "destructive",
      });
      return;
    }
    if (!form.itemName.trim()) {
      toast({
        title: "Missing item",
        description: "Item name is required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        itemName: form.itemName.trim(),
        quantity: form.quantity || null,
        unitPrice: form.unitPrice || null,
        totalPrice: form.totalPrice || null,
        deductionAmount: form.deductionAmount || null,
        currency: form.currency,
        saleDate: form.saleDate || null,
      };
      if (editing) {
        await accountsApiV2.bondItems.update(editing.bondItemUuid, payload);
      } else {
        const crew = crewByUuid.get(form.crewUuid);
        await accountsApiV2.bondItems.create({
          ...payload,
          crewUuid: form.crewUuid,
          crewName: crew?.crewName ?? null,
          engagementUuid: crew?.engagement?.engagementUuid ?? null,
          period,
        });
      }
      invalidate();
      setDialogOpen(false);
      toast({ title: editing ? "Bond item updated" : "Bond item added" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await accountsApiV2.bondItems.remove(deleteTarget.bondItemUuid);
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Bond item deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const cols: ColDef[] = useMemo(
    () => [
      {
        headerName: "Crew",
        flex: 2,
        minWidth: 150,
        valueGetter: (p) =>
          p.data.crewName ??
          crewByUuid.get(p.data.crewUuid)?.crewName ??
          p.data.crewUuid,
        sort: "asc",
      },
      { headerName: "Item", field: "itemName", flex: 2, minWidth: 140 },
      {
        headerName: "Qty",
        field: "quantity",
        width: 80,
        type: "rightAligned",
      },
      {
        headerName: "Unit Price",
        field: "unitPrice",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => (p.value ? formatMoney(p.value) : ""),
      },
      {
        headerName: "Total",
        field: "totalPrice",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => (p.value ? formatMoney(p.value) : ""),
      },
      {
        headerName: "Deduction",
        field: "deductionAmount",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) =>
          formatMoney(p.value ?? p.data.totalPrice ?? "0"),
      },
      { headerName: "Sale Date", field: "saleDate", width: 110 },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: any) => (
          <Badge
            variant="outline"
            className={`text-xs ${
              p.value === "cancelled"
                ? "border-gray-300 bg-gray-50 text-gray-600"
                : p.value === "deducted"
                  ? "border-green-300 bg-green-50 text-green-800"
                  : ""
            }`}
          >
            {p.value}
          </Badge>
        ),
      },
      {
        headerName: "Actions",
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          if (isLocked) return null;
          const row = p.data;
          return (
            <div className="flex items-center gap-1 h-full">
              {mayEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(row)}
                  data-testid={`button-edit-bond-${row.bondItemUuid}`}
                >
                  <Pencil size={14} />
                </Button>
              )}
              {mayDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-600"
                  onClick={() => setDeleteTarget(row)}
                  data-testid={`button-delete-bond-${row.bondItemUuid}`}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [crewByUuid, isLocked, mayEdit, mayDelete],
  );

  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-2 border rounded-md bg-blue-50 border-blue-200 p-3 text-sm text-blue-900"
        data-testid="banner-bond-rollup"
      >
        <Info size={16} className="mt-0.5 shrink-0" />
        Itemized entries roll up into a single monthly deduction per crew.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasFilter && isLocked && (
          <Badge variant="outline" className="gap-1" data-testid="badge-bond-locked">
            <Lock size={12} /> Period locked — read only
          </Badge>
        )}
        <div className="ml-auto">
          {mayCreate && hasFilter && !isLocked && (
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-add-bond"
            >
              <Plus size={14} className="mr-1" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-bond-select-prompt"
        >
          Select a vessel and period to view bond / slop chest items.
        </div>
      )}

      {hasFilter && crewGroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {crewGroups.map((g) => {
            const rollup = rollupByCrew.get(g.crewUuid);
            return (
              <div
                key={g.crewUuid}
                className="border rounded-md bg-white px-3 py-2 text-sm flex items-center gap-3"
                data-testid={`card-bond-crew-${g.crewUuid}`}
              >
                <div>
                  <div className="font-medium">{g.crewName}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.count} item{g.count > 1 ? "s" : ""} — subtotal{" "}
                    {formatMoney(g.subtotal.toFixed(2))}
                  </div>
                </div>
                {rollup ? (
                  <Badge
                    variant="outline"
                    className="border-green-300 bg-green-50 text-green-800 text-xs"
                    title="Rolled-up monthly deduction transaction"
                    data-testid={`badge-rollup-${g.crewUuid}`}
                  >
                    Rollup {formatMoney(rollup.amount)} · {rollup.status}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No rollup yet
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasFilter && (
        <div className="border rounded-md bg-white p-2">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading bond items…
            </div>
          ) : (
            <AgGridTable rowData={items} columnDefs={cols} height="400px" />
          )}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Bond Item" : "Add Bond Item"} —{" "}
              {formatPeriod(period)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Crew</Label>
              <Select
                value={form.crewUuid}
                onValueChange={(v) => set("crewUuid", v)}
                disabled={!!editing}
              >
                <SelectTrigger data-testid="select-bond-crew">
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
            <div className="space-y-1 col-span-2">
              <Label>Item</Label>
              <Input
                value={form.itemName}
                onChange={(e) => set("itemName", e.target.value)}
                placeholder="Cigarettes, toiletries…"
                data-testid="input-bond-item"
              />
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setQtyPrice(e.target.value, form.unitPrice)}
                data-testid="input-bond-qty"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setQtyPrice(form.quantity, e.target.value)}
                data-testid="input-bond-unit-price"
              />
            </div>
            <div className="space-y-1">
              <Label>Total</Label>
              <Input
                type="number"
                step="0.01"
                value={form.totalPrice}
                onChange={(e) => set("totalPrice", e.target.value)}
                data-testid="input-bond-total"
              />
            </div>
            <div className="space-y-1">
              <Label>Deduction Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.deductionAmount}
                onChange={(e) => set("deductionAmount", e.target.value)}
                data-testid="input-bond-deduction"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                data-testid="input-bond-currency"
              />
            </div>
            <div className="space-y-1">
              <Label>Sale Date</Label>
              <Input
                type="date"
                value={form.saleDate}
                onChange={(e) => set("saleDate", e.target.value)}
                data-testid="input-bond-sale-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-bond"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-save-bond"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bond item?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes “{deleteTarget?.itemName}” and updates the crew's
              rolled-up monthly deduction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-bond">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={doDelete}
              data-testid="button-confirm-delete-bond"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CashBondPage() {
  useVesselLookup(); // warm the vessel cache for the period bar
  const { vesselUuid, setVesselUuid, period, setPeriod } = useVesselPeriod();

  return (
    <div className="p-4 space-y-4" data-testid="cash-bond-page">
      <div>
        <h1 className="text-xl font-semibold text-[#0f172a]">Cash &amp; Bond</h1>
        <p className="text-sm text-muted-foreground">
          Office-arranged advances with recovery schedules; itemized bond /
          slop-chest deductions
        </p>
      </div>

      <VesselPeriodBar
        vesselUuid={vesselUuid}
        period={period}
        onVesselChange={setVesselUuid}
        onPeriodChange={setPeriod}
      />

      <Tabs defaultValue="advances">
        <TabsList>
          <TabsTrigger value="advances" data-testid="tab-advances">
            Advances
          </TabsTrigger>
          <TabsTrigger value="bond" data-testid="tab-bond">
            Bond / Slop Chest
          </TabsTrigger>
        </TabsList>
        <TabsContent value="advances" className="mt-3">
          <AdvancesTab vesselUuid={vesselUuid} period={period} />
        </TabsContent>
        <TabsContent value="bond" className="mt-3">
          <BondTab vesselUuid={vesselUuid} period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
