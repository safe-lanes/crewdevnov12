import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useNationalitiesV2 } from "@/hooks/v2/useMasterDataV2";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate } from "../accountsFormat";
import {
  PAY_ELEMENT_TYPES,
  PAY_ELEMENT_CATEGORIES,
  CALC_METHODS,
  PAYMENT_TIMINGS,
  ROUNDING_RULES,
  PAY_ELEMENT_STATUSES,
  labelOf,
  type Option,
} from "../accountsConstants";

const LIST_KEY = [`${ACCOUNTS_BASE}/pay-elements`];

interface ElementForm {
  code: string;
  name: string;
  description: string;
  type: string;
  category: string;
  calcMethod: string;
  percentageBaseElementUuid: string;
  prorate: boolean;
  roundingRule: string;
  nationalityConditional: boolean;
  applicableNationalityUuids: string[];
  showsOnPayslip: boolean;
  showsOnPortage: boolean;
  paymentTiming: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string;
  glCode: string;
}

const emptyForm: ElementForm = {
  code: "",
  name: "",
  description: "",
  type: "earning",
  category: "basic",
  calcMethod: "fixed_amount",
  percentageBaseElementUuid: "",
  prorate: false,
  roundingRule: "nearest",
  nationalityConditional: false,
  applicableNationalityUuids: [],
  showsOnPayslip: true,
  showsOnPortage: true,
  paymentTiming: "paid_on_board",
  status: "active",
  effectiveFrom: "",
  effectiveTo: "",
  glCode: "",
};

function natLabel(n: any): string {
  return n?.nationality || n?.countryName || n?.natUuid || "";
}

export default function PayElementsPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mayCreate = canCreate("Account Pay Elements");
  const mayEdit = canEdit("Account Pay Elements");
  const mayDelete = canDelete("Account Pay Elements");

  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: allElements = [], isLoading } = useQuery<any[]>({
    queryKey: LIST_KEY,
  });
  const { data: nationalities = [] } = useNationalitiesV2();

  const rows = useMemo(
    () =>
      allElements.filter((e) => {
        if (typeFilter !== "all" && e.type !== typeFilter) return false;
        if (categoryFilter !== "all" && e.category !== categoryFilter)
          return false;
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        return true;
      }),
    [allElements, typeFilter, categoryFilter, statusFilter],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [form, setForm] = useState<ElementForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ElementForm>(key: K, value: ElementForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditingUuid(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingUuid(row.payElementUuid);
    setForm({
      code: row.code ?? "",
      name: row.name ?? "",
      description: row.description ?? "",
      type: row.type ?? "earning",
      category: row.category ?? "basic",
      calcMethod: row.calcMethod ?? "fixed_amount",
      percentageBaseElementUuid: row.percentageBaseElementUuid ?? "",
      prorate: row.prorate ?? false,
      roundingRule: row.roundingRule ?? "nearest",
      nationalityConditional: row.nationalityConditional ?? false,
      applicableNationalityUuids: row.applicableNationalityUuids ?? [],
      showsOnPayslip: row.showsOnPayslip ?? true,
      showsOnPortage: row.showsOnPortage ?? true,
      paymentTiming: row.paymentTiming ?? "paid_on_board",
      status: row.status ?? "active",
      effectiveFrom: row.effectiveFrom ?? "",
      effectiveTo: row.effectiveTo ?? "",
      glCode: row.glCode ?? "",
    });
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      category: form.category,
      calcMethod: form.calcMethod,
      prorate: form.prorate,
      roundingRule: form.roundingRule,
      nationalityConditional: form.nationalityConditional,
      showsOnPayslip: form.showsOnPayslip,
      showsOnPortage: form.showsOnPortage,
      paymentTiming: form.paymentTiming,
      status: form.status,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      glCode: form.glCode.trim() || null,
      percentageBaseElementUuid:
        form.calcMethod === "percentage_of_base"
          ? form.percentageBaseElementUuid || null
          : null,
      applicableNationalityUuids: form.nationalityConditional
        ? form.applicableNationalityUuids
        : null,
    };
    return payload;
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({
        title: "Missing fields",
        description: "Code and name are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingUuid) {
        await accountsApiV2.payElements.update(editingUuid, buildPayload());
      } else {
        await accountsApiV2.payElements.create(buildPayload());
      }
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: editingUuid ? "Element updated" : "Element created" });
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
    if (
      !window.confirm(
        `Delete pay element "${row.name}"? This performs a soft-delete.`,
      )
    )
      return;
    try {
      await accountsApiV2.payElements.remove(row.payElementUuid);
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: "Element deleted" });
    } catch (err) {
      const info = parseApiError(err);
      toast({
        title: "Cannot delete element",
        description: info.message,
        variant: "destructive",
      });
    }
  };

  const handleSeed = async () => {
    setSaving(true);
    try {
      await accountsApiV2.payElements.seedStandard();
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: "Standard maritime elements loaded" });
    } catch (err) {
      toast({
        title: "Seed failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Code", field: "code", width: 110, pinned: "left" },
      { headerName: "Name", field: "name", minWidth: 180, flex: 1 },
      {
        headerName: "Type",
        field: "type",
        width: 150,
        valueFormatter: (p) => labelOf(PAY_ELEMENT_TYPES, p.value),
      },
      {
        headerName: "Category",
        field: "category",
        width: 150,
        valueFormatter: (p) => labelOf(PAY_ELEMENT_CATEGORIES, p.value),
      },
      {
        headerName: "Calc method",
        field: "calcMethod",
        width: 150,
        valueFormatter: (p) => labelOf(CALC_METHODS, p.value),
      },
      {
        headerName: "Payment timing",
        field: "paymentTiming",
        width: 160,
        valueFormatter: (p) => labelOf(PAYMENT_TIMINGS, p.value),
      },
      {
        headerName: "Prorate",
        field: "prorate",
        width: 100,
        valueFormatter: (p) => (p.value ? "Yes" : "No"),
      },
      {
        headerName: "Nat. conditional",
        field: "nationalityConditional",
        width: 130,
        valueFormatter: (p) => (p.value ? "Yes" : "No"),
      },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: any) => (
          <Badge
            variant={p.value === "active" ? "default" : "secondary"}
            data-testid={`status-element-${p.data?.code}`}
          >
            {labelOf(PAY_ELEMENT_STATUSES, p.value)}
          </Badge>
        ),
      },
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
                data-testid={`button-edit-element-${p.data?.code}`}
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {mayDelete && (
              <button
                className="text-red-500 hover:text-red-700"
                onClick={() => handleDelete(p.data)}
                data-testid={`button-delete-element-${p.data?.code}`}
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
    [mayEdit, mayDelete],
  );

  const baseCandidates = allElements.filter(
    (e) => e.payElementUuid !== editingUuid,
  );

  return (
    <div className="p-4 flex flex-col h-full" data-testid="page-pay-elements">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#16569e]">
            Pay Elements Library
          </h1>
          <p className="text-sm text-muted-foreground">
            The master list of earnings, deductions and contributions used
            across wage scales and contracts.
          </p>
        </div>
        <div className="flex gap-2">
          {mayCreate && allElements.length === 0 && (
            <Button
              variant="outline"
              onClick={handleSeed}
              disabled={saving}
              data-testid="button-seed-standard"
            >
              <Download size={15} className="mr-1" />
              Load standard maritime elements
            </Button>
          )}
          {mayCreate && (
            <Button
              onClick={openCreate}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-new-element"
            >
              <Plus size={15} className="mr-1" />
              New element
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={PAY_ELEMENT_TYPES}
          allLabel="All types"
          testId="filter-type"
        />
        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={PAY_ELEMENT_CATEGORIES}
          allLabel="All categories"
          testId="filter-category"
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={PAY_ELEMENT_STATUSES}
          allLabel="All statuses"
          testId="filter-status"
        />
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUuid ? "Edit pay element" : "New pay element"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                disabled={!!editingUuid}
                data-testid="input-element-code"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                data-testid="input-element-name"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                data-testid="input-element-description"
              />
            </div>

            <DialogSelect
              label="Type"
              value={form.type}
              options={PAY_ELEMENT_TYPES}
              onChange={(v) => set("type", v)}
              testId="select-element-type"
            />
            <DialogSelect
              label="Category"
              value={form.category}
              options={PAY_ELEMENT_CATEGORIES}
              onChange={(v) => set("category", v)}
              testId="select-element-category"
            />
            <div className="flex flex-col gap-1.5">
              <Label>GL code (accounting)</Label>
              <Input
                value={form.glCode}
                onChange={(e) => set("glCode", e.target.value)}
                placeholder="e.g. 5100-WAGES (optional)"
                data-testid="input-element-gl-code"
              />
            </div>
            <DialogSelect
              label="Calc method"
              value={form.calcMethod}
              options={CALC_METHODS}
              onChange={(v) => set("calcMethod", v)}
              testId="select-element-calc-method"
            />
            <DialogSelect
              label="Payment timing"
              value={form.paymentTiming}
              options={PAYMENT_TIMINGS}
              onChange={(v) => set("paymentTiming", v)}
              testId="select-element-payment-timing"
            />

            {form.calcMethod === "percentage_of_base" && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Percentage base element</Label>
                <Select
                  value={form.percentageBaseElementUuid}
                  onValueChange={(v) => set("percentageBaseElementUuid", v)}
                >
                  <SelectTrigger
                    className="h-9"
                    data-testid="select-percentage-base"
                  >
                    <SelectValue placeholder="Select base element" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseCandidates.map((e) => (
                      <SelectItem key={e.payElementUuid} value={e.payElementUuid}>
                        {e.code} — {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Required: the element this percentage is calculated from.
                </p>
              </div>
            )}

            <DialogSelect
              label="Rounding rule"
              value={form.roundingRule}
              options={ROUNDING_RULES}
              onChange={(v) => set("roundingRule", v)}
              testId="select-element-rounding"
            />
            <DialogSelect
              label="Status"
              value={form.status}
              options={PAY_ELEMENT_STATUSES}
              onChange={(v) => set("status", v)}
              testId="select-element-status"
            />

            <div className="flex flex-col gap-1.5">
              <Label>Effective from</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set("effectiveFrom", e.target.value)}
                data-testid="input-element-effective-from"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Effective to</Label>
              <Input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => set("effectiveTo", e.target.value)}
                data-testid="input-element-effective-to"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.prorate}
                onCheckedChange={(c) => set("prorate", c)}
                data-testid="switch-element-prorate"
              />
              <Label>Prorate for partial months</Label>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.nationalityConditional}
                  onCheckedChange={(c) => set("nationalityConditional", c)}
                  data-testid="switch-element-nationality-conditional"
                />
                <Label>Nationality conditional</Label>
              </div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="text-nationality-conditional-help"
              >
                Use only for elements that legally apply to certain
                nationalities (e.g. provident funds, SSS). Do NOT use this to
                vary wage amounts by nationality — use nationality variants on
                the wage scale for that.
              </p>
              {form.nationalityConditional &&
                ["basic", "overtime_fixed", "overtime_variable"].includes(
                  form.category,
                ) && (
                  <p
                    className="text-xs text-amber-600"
                    data-testid="text-nationality-conditional-caution"
                  >
                    Core wage elements are rarely nationality-conditional —
                    most crew will earn nothing for this element.
                  </p>
                )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.showsOnPayslip}
                onCheckedChange={(c) => set("showsOnPayslip", c)}
                data-testid="switch-element-payslip"
              />
              <Label>Show on payslip</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.showsOnPortage}
                onCheckedChange={(c) => set("showsOnPortage", c)}
                data-testid="switch-element-portage"
              />
              <Label>Show on portage bill</Label>
            </div>

            {form.nationalityConditional && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Applicable nationalities</Label>
                <div className="max-h-40 overflow-y-auto rounded border p-2 grid grid-cols-2 gap-1">
                  {nationalities.map((n: any) => {
                    const id = n.natUuid;
                    const checked = form.applicableNationalityUuids.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            set(
                              "applicableNationalityUuids",
                              e.target.checked
                                ? [...form.applicableNationalityUuids, id]
                                : form.applicableNationalityUuids.filter(
                                    (x) => x !== id,
                                  ),
                            )
                          }
                          data-testid={`checkbox-nationality-${id}`}
                        />
                        {natLabel(n)}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  At least one nationality is required for a
                  nationality-conditional element.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-element"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-save-element"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel: string;
  testId: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[180px] text-xs" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DialogSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
