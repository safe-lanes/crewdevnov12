import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
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
import { Plus, Pencil, Trash2, Download, Lock } from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatMoney } from "../accountsFormat";
import VesselPeriodBar, { currentPeriod, formatPeriod } from "./VesselPeriodBar";

const MENU = "Account Monthly Transactions";

interface TxnForm {
  crewUuid: string;
  payElementUuid: string;
  qty: string;
  rate: string;
  amount: string;
  currency: string;
  remarks: string;
}

const emptyForm: TxnForm = {
  crewUuid: "",
  payElementUuid: "",
  qty: "",
  rate: "",
  amount: "",
  currency: "USD",
  remarks: "",
};

export default function MonthlyTransactionsPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);
  const mayDelete = canDelete(MENU);

  const [vesselUuid, setVesselUuid] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const hasFilter = !!vesselUuid && !!period;

  const listKey = [
    `${ACCOUNTS_BASE}/monthly-transactions?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: txns = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
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
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });

  const portageStatus: string = workspace?.portage?.status ?? "open";
  const isLocked =
    portageStatus === "locked" || !!workspace?.portage?.isLocked;

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

  // Monthly transactions cover manual-entry and rate×qty elements only;
  // scale/fixed/percentage elements are posted by the calculation engine.
  const manualElements = useMemo(
    () =>
      payElements.filter(
        (e) =>
          e.status === "active" &&
          ["manual_entry", "rate_times_qty"].includes(e.calcMethod),
      ),
    [payElements],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [form, setForm] = useState<TxnForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof TxnForm>(key: K, value: TxnForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Default the rate from the crew's wage-scale line (rank + element match)
  // for rate_times_qty elements when adding a transaction.
  const selectedEngagement = crewByUuid.get(form.crewUuid)?.engagement;
  const scaleUuid: string = selectedEngagement?.wageScaleUuid ?? "";
  const { data: scaleDetail } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/wage-scales/${scaleUuid}`],
    enabled: dialogOpen && !editingUuid && !!scaleUuid,
  });
  const selectedElement = elementByUuid.get(form.payElementUuid);
  useEffect(() => {
    if (editingUuid || !dialogOpen) return;
    if (!form.crewUuid || !form.payElementUuid) return;
    if (selectedElement?.calcMethod !== "rate_times_qty") return;
    const rankId = selectedEngagement?.rankIdAtStart;
    const line = (scaleDetail?.lines ?? []).find(
      (l: any) =>
        l.payElementUuid === form.payElementUuid &&
        l.rankId === rankId &&
        !l.isDeleted &&
        l.rate != null,
    );
    if (!line) return;
    setForm((f) => {
      const q = parseFloat(f.qty);
      const r = parseFloat(line.rate);
      return {
        ...f,
        rate: line.rate,
        amount:
          !Number.isNaN(q) && !Number.isNaN(r)
            ? (q * r).toFixed(2)
            : f.amount,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.crewUuid, form.payElementUuid, scaleDetail, dialogOpen, editingUuid]);

  // qty × rate auto-amount
  const setQtyRate = (qty: string, rate: string) => {
    const q = parseFloat(qty);
    const r = parseFloat(rate);
    setForm((f) => ({
      ...f,
      qty,
      rate,
      amount:
        !Number.isNaN(q) && !Number.isNaN(r)
          ? (q * r).toFixed(2)
          : f.amount,
    }));
  };

  const openCreate = () => {
    setEditingUuid(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingUuid(row.txnUuid);
    setForm({
      crewUuid: row.crewUuid ?? "",
      payElementUuid: row.payElementUuid ?? "",
      qty: row.qty ?? "",
      rate: row.rate ?? "",
      amount: row.amount ?? "",
      currency: row.currency ?? "USD",
      remarks: row.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const review = crewByUuid.get(form.crewUuid);
    if (!editingUuid && !review?.engagement) {
      toast({
        title: "No engagement",
        description: "Selected crew has no engagement for this period.",
        variant: "destructive",
      });
      return;
    }
    if (!form.payElementUuid || !form.amount) {
      toast({
        title: "Missing fields",
        description: "Pay element and amount are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingUuid) {
        await accountsApiV2.monthlyTransactions.update(editingUuid, {
          qty: form.qty || null,
          rate: form.rate || null,
          amount: form.amount,
          currency: form.currency,
          remarks: form.remarks.trim() || null,
        });
      } else {
        await accountsApiV2.monthlyTransactions.create({
          engagementUuid: review.engagement.engagementUuid,
          crewUuid: form.crewUuid,
          vesselUuid,
          period,
          payElementUuid: form.payElementUuid,
          qty: form.qty || null,
          rate: form.rate || null,
          amount: form.amount,
          currency: form.currency,
          origin: "office",
          status: "accepted",
          sourceType: "manual",
          remarks: form.remarks.trim() || null,
        });
      }
      queryClient.invalidateQueries({ queryKey: listKey });
      setDialogOpen(false);
      toast({ title: editingUuid ? "Transaction updated" : "Transaction added" });
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
      await accountsApiV2.monthlyTransactions.remove(deleteTarget.txnUuid);
      queryClient.invalidateQueries({ queryKey: listKey });
      setDeleteTarget(null);
      toast({ title: "Transaction deleted" });
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

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };
  const exportCsv = () => {
    gridApiRef.current?.exportDataAsCsv({
      fileName: `monthly-transactions-${period}.csv`,
    });
  };

  const cols: ColDef[] = useMemo(
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
        width: 90,
        valueGetter: (p) => crewByUuid.get(p.data.crewUuid)?.presentRank ?? "",
      },
      {
        headerName: "Element",
        flex: 2,
        minWidth: 160,
        valueGetter: (p) => {
          const el = elementByUuid.get(p.data.payElementUuid);
          return el ? `${el.code} — ${el.name}` : p.data.payElementUuid;
        },
      },
      {
        headerName: "Type",
        width: 100,
        valueGetter: (p) =>
          elementByUuid.get(p.data.payElementUuid)?.type ?? "",
      },
      {
        headerName: "Qty",
        field: "qty",
        width: 80,
        type: "rightAligned",
      },
      {
        headerName: "Rate",
        field: "rate",
        width: 100,
        type: "rightAligned",
        valueFormatter: (p) => (p.value ? formatMoney(p.value) : ""),
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      { headerName: "Ccy", field: "currency", width: 70 },
      { headerName: "Origin", field: "origin", width: 90 },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: any) => (
          <Badge variant="outline" className="text-xs">
            {p.value}
          </Badge>
        ),
      },
      { headerName: "Remarks", field: "remarks", flex: 2, minWidth: 140 },
      {
        headerName: "Actions",
        width: 100,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) =>
          isLocked ? null : (
            <div className="flex items-center gap-1 h-full">
              {mayEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(p.data)}
                  data-testid={`button-edit-txn-${p.data.txnUuid}`}
                >
                  <Pencil size={14} />
                </Button>
              )}
              {mayDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-600"
                  onClick={() => setDeleteTarget(p.data)}
                  data-testid={`button-delete-txn-${p.data.txnUuid}`}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ),
      },
    ],
    [crewByUuid, elementByUuid, isLocked, mayEdit, mayDelete],
  );

  return (
    <div className="p-4 space-y-4" data-testid="monthly-transactions-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">
            Monthly Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            Variable items for the month — overtime, bonuses, deductions and
            adjustments
          </p>
        </div>
        {hasFilter && isLocked && (
          <Badge variant="outline" className="gap-1" data-testid="badge-locked">
            <Lock size={12} /> Period locked — read only
          </Badge>
        )}
      </div>

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
            onClick={exportCsv}
            disabled={txns.length === 0}
            data-testid="button-export-txns"
          >
            <Download size={14} className="mr-1" /> Export
          </Button>
          {mayCreate && hasFilter && !isLocked && (
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-add-txn"
            >
              <Plus size={14} className="mr-1" /> Add Transaction
            </Button>
          )}
        </div>
      </VesselPeriodBar>

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          Select a vessel and period to view monthly transactions.
        </div>
      )}

      {hasFilter && (
        <div className="border rounded-md bg-white p-2">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading transactions…
            </div>
          ) : (
            <AgGridTable
              rowData={txns}
              columnDefs={cols}
              onGridReady={onGridReady}
              height="480px"
            />
          )}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUuid ? "Edit Transaction" : "Add Transaction"} —{" "}
              {formatPeriod(period)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Crew</Label>
              <Select
                value={form.crewUuid}
                onValueChange={(v) => set("crewUuid", v)}
                disabled={!!editingUuid}
              >
                <SelectTrigger data-testid="select-txn-crew">
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
              <Label>Pay Element</Label>
              <Select
                value={form.payElementUuid}
                onValueChange={(v) => set("payElementUuid", v)}
                disabled={!!editingUuid}
              >
                <SelectTrigger data-testid="select-txn-element">
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
                value={form.qty}
                onChange={(e) => setQtyRate(e.target.value, form.rate)}
                data-testid="input-txn-qty"
              />
            </div>
            <div className="space-y-1">
              <Label>Rate</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.rate}
                onChange={(e) => setQtyRate(form.qty, e.target.value)}
                data-testid="input-txn-rate"
              />
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                data-testid="input-txn-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                maxLength={3}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                data-testid="input-txn-currency"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Remarks</Label>
              <Textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                data-testid="input-txn-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              data-testid="button-save-txn"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete this{" "}
            {elementByUuid.get(deleteTarget?.payElementUuid)?.name ?? ""}{" "}
            transaction of {formatMoney(deleteTarget?.amount)}{" "}
            {deleteTarget?.currency} for{" "}
            {crewByUuid.get(deleteTarget?.crewUuid)?.crewName ??
              deleteTarget?.crewUuid}
            ?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={doDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-txn"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
