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
import { Info, Plus, Pencil, Trash2 } from "lucide-react";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import {
  PAY_ELEMENT_CATEGORIES,
  CURRENCIES,
  labelOf,
} from "../accountsConstants";

const LIST_KEY = [`${ACCOUNTS_BASE}/cba-reference`];
const RANKS_KEY = ["/api/v2/admin/company-ranks"];
const ELEMENTS_KEY = [`${ACCOUNTS_BASE}/pay-elements`];
const NONE = "__none__";

interface CbaForm {
  cbaName: string;
  rankId: string;
  payElementUuid: string;
  category: string;
  minimumAmount: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string;
  sourceNote: string;
}

const emptyForm: CbaForm = {
  cbaName: "",
  rankId: NONE,
  payElementUuid: NONE,
  category: NONE,
  minimumAmount: "",
  currency: "USD",
  effectiveFrom: "",
  effectiveTo: "",
  sourceNote: "",
};

export default function CbaReferencePage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mayCreate = canCreate("Account CBA Reference");
  const mayEdit = canEdit("Account CBA Reference");
  const mayDelete = canDelete("Account CBA Reference");

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: LIST_KEY });
  const { data: ranks = [] } = useQuery<any[]>({ queryKey: RANKS_KEY });
  const { data: elements = [] } = useQuery<any[]>({ queryKey: ELEMENTS_KEY });

  const rankName = useMemo(() => {
    const m = new Map<string, string>();
    ranks.forEach((r: any) => m.set(r.rankId, r.rank));
    return m;
  }, [ranks]);
  const elementName = useMemo(() => {
    const m = new Map<string, string>();
    elements.forEach((e: any) => m.set(e.payElementUuid, `${e.code} — ${e.name}`));
    return m;
  }, [elements]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [form, setForm] = useState<CbaForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CbaForm>(key: K, value: CbaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditingUuid(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingUuid(row.cbaRefUuid);
    setForm({
      cbaName: row.cbaName ?? "",
      rankId: row.rankId ?? NONE,
      payElementUuid: row.payElementUuid ?? NONE,
      category: row.category ?? NONE,
      minimumAmount: row.minimumAmount ?? "",
      currency: row.currency ?? "USD",
      effectiveFrom: row.effectiveFrom ?? "",
      effectiveTo: row.effectiveTo ?? "",
      sourceNote: row.sourceNote ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.cbaName.trim()) {
      toast({
        title: "Missing field",
        description: "CBA name is required.",
        variant: "destructive",
      });
      return;
    }
    const payload: Record<string, unknown> = {
      cbaName: form.cbaName.trim(),
      rankId: form.rankId === NONE ? null : form.rankId,
      payElementUuid: form.payElementUuid === NONE ? null : form.payElementUuid,
      category: form.category === NONE ? null : form.category,
      minimumAmount: form.minimumAmount.trim() || null,
      currency: form.currency,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      sourceNote: form.sourceNote.trim() || null,
    };
    setSaving(true);
    try {
      if (editingUuid) {
        await accountsApiV2.cbaReference.update(editingUuid, payload);
      } else {
        await accountsApiV2.cbaReference.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: editingUuid ? "CBA row updated" : "CBA row created" });
      setDialogOpen(false);
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

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete CBA reference "${row.cbaName}"?`)) return;
    try {
      await accountsApiV2.cbaReference.remove(row.cbaRefUuid);
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: "CBA row deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    }
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "CBA name", field: "cbaName", minWidth: 180, flex: 1 },
      {
        headerName: "Rank",
        field: "rankId",
        width: 150,
        valueFormatter: (p) => (p.value ? rankName.get(p.value) ?? p.value : "Any"),
      },
      {
        headerName: "Element",
        field: "payElementUuid",
        width: 200,
        valueFormatter: (p) =>
          p.value ? elementName.get(p.value) ?? p.value : "",
      },
      {
        headerName: "Category",
        field: "category",
        width: 150,
        valueFormatter: (p) =>
          p.value ? labelOf(PAY_ELEMENT_CATEGORIES, p.value) : "",
      },
      {
        headerName: "Minimum",
        field: "minimumAmount",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => formatMoney(p.value),
      },
      { headerName: "Currency", field: "currency", width: 100 },
      {
        headerName: "Effective from",
        field: "effectiveFrom",
        width: 130,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        headerName: "Effective to",
        field: "effectiveTo",
        width: 130,
        valueFormatter: (p) => formatDate(p.value),
      },
      { headerName: "Source note", field: "sourceNote", minWidth: 160, flex: 1 },
      {
        headerName: "Actions",
        width: 110,
        pinned: "right",
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => (
          <div className="flex gap-1 items-center h-full">
            {mayEdit && (
              <button
                className="text-[#16569e] hover:text-[#12467f]"
                onClick={() => openEdit(p.data)}
                data-testid={`button-edit-cba-${p.data?.cbaRefUuid}`}
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {mayDelete && (
              <button
                className="text-red-500 hover:text-red-700"
                onClick={() => handleDelete(p.data)}
                data-testid={`button-delete-cba-${p.data?.cbaRefUuid}`}
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mayEdit, mayDelete, rankName, elementName],
  );

  return (
    <div className="p-4 flex flex-col h-full" data-testid="page-cba-reference">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#16569e]">CBA Reference</h1>
          <p className="text-sm text-muted-foreground">
            Collective bargaining agreement minimum rates used to floor-check
            wage scales.
          </p>
        </div>
        {mayCreate && (
          <Button
            onClick={openCreate}
            className="bg-[#16569e] hover:bg-[#12467f]"
            data-testid="button-new-cba"
          >
            <Plus size={15} className="mr-1" />
            New CBA row
          </Button>
        )}
      </div>

      <div
        className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        data-testid="banner-reference-only"
      >
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Reference only. These minimums are never paid directly — they are used
          to check that wage-scale amounts meet CBA floors when a scale is
          activated.
        </span>
      </div>

      <div className="flex-1 min-h-[400px]">
        <AgGridTable
          rowData={rows}
          columnDefs={columnDefs}
          loading={isLoading}
          height="100%"
          enableSideBar={false}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUuid ? "Edit CBA reference" : "New CBA reference"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>CBA name</Label>
              <Input
                value={form.cbaName}
                onChange={(e) => set("cbaName", e.target.value)}
                data-testid="input-cba-name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rank</Label>
              <Select value={form.rankId} onValueChange={(v) => set("rankId", v)}>
                <SelectTrigger className="h-9" data-testid="select-cba-rank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any rank</SelectItem>
                  {ranks
                    .filter((r: any) => !r.isRoleRow)
                    .map((r: any) => (
                      <SelectItem key={r.crUuid ?? r.rankId} value={r.rankId}>
                        {r.rank}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-cba-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Pay element (optional)</Label>
              <Select
                value={form.payElementUuid}
                onValueChange={(v) => set("payElementUuid", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-cba-element">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {elements.map((e: any) => (
                    <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                      {e.code} — {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category (optional)</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-cba-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {PAY_ELEMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Minimum amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.minimumAmount}
                onChange={(e) => set("minimumAmount", e.target.value)}
                data-testid="input-cba-minimum"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Effective from</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set("effectiveFrom", e.target.value)}
                data-testid="input-cba-effective-from"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Effective to</Label>
              <Input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => set("effectiveTo", e.target.value)}
                data-testid="input-cba-effective-to"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Source note</Label>
              <Textarea
                value={form.sourceNote}
                onChange={(e) => set("sourceNote", e.target.value)}
                rows={2}
                data-testid="input-cba-source-note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-cba"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-save-cba"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
