import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  useVesselTypesV2,
  useAdditionalGroupsV2,
} from "@/hooks/v2/useMasterDataV2";
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
import { Plus, Pencil, Copy, Trash2 } from "lucide-react";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate } from "../accountsFormat";
import { CURRENCIES } from "../accountsConstants";
import WageScaleEditor from "./WageScaleEditor";

const LIST_KEY = [`${ACCOUNTS_BASE}/wage-scales`];
const NONE = "__none__";

interface ScaleForm {
  scaleName: string;
  description: string;
  currency: string;
  vesselTypeUuid: string;
  vesselGroupUuid: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyForm: ScaleForm = {
  scaleName: "",
  description: "",
  currency: "USD",
  vesselTypeUuid: NONE,
  vesselGroupUuid: NONE,
  effectiveFrom: "",
  effectiveTo: "",
};

function StatusCell({ value }: { value: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-200 text-slate-700",
    active: "bg-green-100 text-green-700",
    superseded: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${map[value] ?? "bg-slate-200"}`}
    >
      {value}
    </span>
  );
}

export default function WageScalesPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const mayCreate = canCreate("Account Wage Scales");
  const mayEdit = canEdit("Account Wage Scales");
  const mayDelete = canDelete("Account Wage Scales");

  const [openUuid, setOpenUuid] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: LIST_KEY });
  const { data: vesselTypes = [] } = useVesselTypesV2();
  const { data: vesselGroups = [] } = useAdditionalGroupsV2();

  const vtName = useMemo(() => {
    const m = new Map<string, string>();
    vesselTypes.forEach((v: any) =>
      m.set(v.vtUuid ?? v.uuid, v.vesselType ?? v.name),
    );
    return m;
  }, [vesselTypes]);
  const vgName = useMemo(() => {
    const m = new Map<string, string>();
    vesselGroups.forEach((v: any) =>
      m.set(v.agUuid ?? v.uuid, v.name),
    );
    return m;
  }, [vesselGroups]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ScaleForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ScaleForm>(key: K, value: ScaleForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.scaleName.trim()) {
      toast({
        title: "Missing field",
        description: "Scale name is required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const created = await accountsApiV2.wageScales.create({
        scaleName: form.scaleName.trim(),
        description: form.description.trim() || null,
        currency: form.currency,
        vesselTypeUuid: form.vesselTypeUuid === NONE ? null : form.vesselTypeUuid,
        vesselGroupUuid:
          form.vesselGroupUuid === NONE ? null : form.vesselGroupUuid,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
      });
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      setDialogOpen(false);
      toast({ title: "Wage scale created" });
      const uuid = created?.scaleUuid ?? created?.scale?.scaleUuid;
      if (uuid) setOpenUuid(uuid);
    } catch (err) {
      toast({
        title: "Create failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSupersede = async (row: any) => {
    if (
      !window.confirm(
        `Supersede "${row.scaleName}"? This creates a new draft copy you can edit.`,
      )
    )
      return;
    try {
      const created = await accountsApiV2.wageScales.supersede(row.scaleUuid);
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: "New draft version created" });
      const uuid = created?.scaleUuid ?? created?.scale?.scaleUuid;
      if (uuid) setOpenUuid(uuid);
    } catch (err) {
      toast({
        title: "Supersede failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Delete draft "${row.scaleName}"?`)) return;
    try {
      await accountsApiV2.wageScales.remove(row.scaleUuid);
      await queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast({ title: "Wage scale deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    }
  };

  const scopeLabel = (row: any) => {
    if (!row.vesselTypeUuid && !row.vesselGroupUuid) return "Fleet-wide";
    const parts: string[] = [];
    if (row.vesselTypeUuid)
      parts.push(vtName.get(row.vesselTypeUuid) ?? "Type");
    if (row.vesselGroupUuid)
      parts.push(vgName.get(row.vesselGroupUuid) ?? "Group");
    return parts.join(" · ");
  };

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Scale name", field: "scaleName", minWidth: 200, flex: 1 },
      {
        headerName: "Scope",
        colId: "scope",
        width: 160,
        valueGetter: (p) => scopeLabel(p.data),
      },
      { headerName: "Currency", field: "currency", width: 100 },
      {
        headerName: "Status",
        field: "status",
        width: 120,
        cellRenderer: (p: any) => <StatusCell value={p.value} />,
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
        width: 140,
        pinned: "right",
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const row = p.data;
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                className="text-[#16569e] hover:text-[#12467f]"
                onClick={() => setOpenUuid(row.scaleUuid)}
                data-testid={`button-open-scale-${row.scaleUuid}`}
                title={row.status === "draft" ? "Edit" : "View"}
              >
                <Pencil size={15} />
              </button>
              {mayEdit && row.status === "active" && (
                <button
                  className="text-amber-600 hover:text-amber-800"
                  onClick={() => handleSupersede(row)}
                  data-testid={`button-supersede-scale-${row.scaleUuid}`}
                  title="Supersede"
                >
                  <Copy size={15} />
                </button>
              )}
              {mayDelete && row.status === "draft" && (
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => handleDelete(row)}
                  data-testid={`button-delete-scale-${row.scaleUuid}`}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mayEdit, mayDelete, vtName, vgName],
  );

  if (openUuid) {
    return (
      <WageScaleEditor scaleUuid={openUuid} onBack={() => setOpenUuid(null)} />
    );
  }

  return (
    <div className="p-4 flex flex-col h-full" data-testid="page-wage-scales">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[#16569e]">Wage Scales</h1>
          <p className="text-sm text-muted-foreground">
            Effective-dated rate matrices by rank, nationality and seniority.
          </p>
        </div>
        {mayCreate && (
          <Button
            onClick={openCreate}
            className="bg-[#16569e] hover:bg-[#12467f]"
            data-testid="button-new-scale"
          >
            <Plus size={15} className="mr-1" />
            New wage scale
          </Button>
        )}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New wage scale</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Scale name</Label>
              <Input
                value={form.scaleName}
                onChange={(e) => set("scaleName", e.target.value)}
                data-testid="input-scale-name"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                data-testid="input-scale-description"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-scale-currency">
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
              <Label>Vessel type (optional)</Label>
              <Select
                value={form.vesselTypeUuid}
                onValueChange={(v) => set("vesselTypeUuid", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-scale-vessel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any (fleet-wide)</SelectItem>
                  {vesselTypes.map((v: any) => {
                    const id = v.vtUuid ?? v.uuid;
                    return (
                      <SelectItem key={id} value={id}>
                        {v.vesselType ?? v.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Vessel group (optional)</Label>
              <Select
                value={form.vesselGroupUuid}
                onValueChange={(v) => set("vesselGroupUuid", v)}
              >
                <SelectTrigger className="h-9" data-testid="select-scale-vessel-group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any (fleet-wide)</SelectItem>
                  {vesselGroups.map((v: any) => {
                    const id = v.agUuid ?? v.uuid;
                    return (
                      <SelectItem key={id} value={id}>
                        {v.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Effective from</Label>
              <Input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set("effectiveFrom", e.target.value)}
                data-testid="input-scale-effective-from"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Effective to</Label>
              <Input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => set("effectiveTo", e.target.value)}
                data-testid="input-scale-effective-to"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-scale"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-create-scale"
            >
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
