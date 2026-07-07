import { useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Download,
  Pause,
  Play,
  Square,
  Check,
} from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatMoney } from "../accountsFormat";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { currentPeriod } from "./VesselPeriodBar";

const MENU = "Account Allotments";

interface AllotmentForm {
  crewUuid: string;
  beneficiaryName: string;
  relationship: string;
  allotmentType: string;
  value: string;
  currency: string;
  bankName: string;
  accountNumber: string;
  ibanSwift: string;
  bankCountry: string;
  priority: string;
  validFrom: string;
  kycComplete: boolean;
  bankVerified: boolean;
}

const emptyForm: AllotmentForm = {
  crewUuid: "",
  beneficiaryName: "",
  relationship: "",
  allotmentType: "fixed",
  value: "",
  currency: "USD",
  bankName: "",
  accountNumber: "",
  ibanSwift: "",
  bankCountry: "",
  priority: "1",
  validFrom: "",
  kycComplete: false,
  bankVerified: false,
};

function maskAccount(acct: string | null | undefined): string {
  if (!acct) return "";
  const tail = acct.slice(-4);
  return acct.length <= 4 ? tail : `•••• ${tail}`;
}

export default function AllotmentsPage() {
  const { toast } = useToast();
  const { canCreate, canEdit } = usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);

  const { vessels } = useVesselLookup();
  const [vesselFilter, setVesselFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [crewSearch, setCrewSearch] = useState("");

  const listKey = [`${ACCOUNTS_BASE}/allotments`];
  const { data: allotments = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
  });

  // Crew for the create dialog comes from the selected vessel's engagements.
  const [dialogVessel, setDialogVessel] = useState("");
  const { data: reviewRows = [] } = useQuery<any[]>({
    queryKey: [
      `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${dialogVessel}&period=${currentPeriod()}`,
    ],
    enabled: !!dialogVessel,
  });
  const engagedRows = useMemo(
    () => reviewRows.filter((r) => r.engagement),
    [reviewRows],
  );

  const filtered = useMemo(() => {
    const q = crewSearch.trim().toLowerCase();
    return allotments.filter(
      (a) =>
        (vesselFilter === "all" || a.vesselUuid === vesselFilter) &&
        (statusFilter === "all" || a.status === statusFilter) &&
        (!q || (a.crewName ?? "").toLowerCase().includes(q)),
    );
  }, [allotments, vesselFilter, statusFilter, crewSearch]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<AllotmentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [endTarget, setEndTarget] = useState<any | null>(null);
  const [acting, setActing] = useState(false);

  const set = <K extends keyof AllotmentForm>(key: K, value: AllotmentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, validFrom: new Date().toISOString().slice(0, 10) });
    setDialogVessel("");
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      crewUuid: row.crewUuid ?? "",
      beneficiaryName: row.beneficiaryName ?? "",
      relationship: row.relationship ?? "",
      allotmentType: row.allotmentType ?? "fixed",
      value: row.value ?? "",
      currency: row.currency ?? "USD",
      bankName: row.bankName ?? "",
      accountNumber: row.accountNumber ?? "",
      ibanSwift: row.ibanSwift ?? "",
      bankCountry: row.bankCountry ?? "",
      priority: String(row.priority ?? 1),
      validFrom: row.validFrom ?? "",
      kycComplete: !!row.kycComplete,
      bankVerified: !!row.bankVerified,
    });
    setDialogOpen(true);
  };

  const notifyCap = (res: any) => {
    if (res?.capWarning) {
      toast({
        title: "Allotment cap exceeded",
        description: res.capWarning,
        variant: "destructive",
      });
    } else if (res?.capNote) {
      toast({ title: "Cap check skipped", description: res.capNote });
    }
  };

  const save = async () => {
    if (!editing && !form.crewUuid) {
      toast({
        title: "Missing crew",
        description: "Select a vessel and crew member.",
        variant: "destructive",
      });
      return;
    }
    if (!form.beneficiaryName.trim() || !form.value || !form.validFrom) {
      toast({
        title: "Missing fields",
        description: "Payee name, amount and valid-from are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        beneficiaryName: form.beneficiaryName.trim(),
        relationship: form.relationship.trim() || null,
        allotmentType: form.allotmentType,
        value: form.value,
        currency: form.currency,
        bankName: form.bankName.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        ibanSwift: form.ibanSwift.trim() || null,
        bankCountry: form.bankCountry.trim() || null,
        priority: parseInt(form.priority, 10) || 1,
        validFrom: form.validFrom,
        kycComplete: form.kycComplete,
        bankVerified: form.bankVerified,
      };
      let res: any;
      if (editing) {
        res = await accountsApiV2.allotments.update(
          editing.allotmentUuid,
          payload,
        );
      } else {
        const crew = engagedRows.find((r) => r.crewUuid === form.crewUuid);
        res = await accountsApiV2.allotments.create({
          ...payload,
          crewUuid: form.crewUuid,
          crewName: crew?.crewName ?? null,
          rank: crew?.presentRank ?? null,
          engagementUuid: crew?.engagement?.engagementUuid ?? null,
        });
      }
      queryClient.invalidateQueries({ queryKey: listKey });
      setDialogOpen(false);
      toast({ title: editing ? "Allotment updated" : "Allotment created" });
      notifyCap(res);
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

  const lifecycle = async (
    row: any,
    action: "suspend" | "reactivate" | "end",
  ) => {
    setActing(true);
    try {
      const res: any =
        action === "suspend"
          ? await accountsApiV2.allotments.suspend(row.allotmentUuid)
          : action === "reactivate"
            ? await accountsApiV2.allotments.reactivate(row.allotmentUuid)
            : await accountsApiV2.allotments.end(row.allotmentUuid);
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({
        title:
          action === "suspend"
            ? "Allotment suspended"
            : action === "reactivate"
              ? "Allotment reactivated"
              : "Allotment ended",
      });
      if (action === "reactivate") notifyCap(res);
    } catch (err) {
      toast({
        title: "Action failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setActing(false);
      setEndTarget(null);
    }
  };

  const gridApiRef = useRef<GridApi | null>(null);
  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };
  const exportCsv = () => {
    gridApiRef.current?.exportDataAsCsv({ fileName: "allotments.csv" });
  };

  const cols: ColDef[] = useMemo(
    () => [
      { headerName: "Crew", field: "crewName", flex: 2, minWidth: 150 },
      { headerName: "Rank", field: "rank", width: 90 },
      { headerName: "Vessel", field: "vesselName", flex: 1, minWidth: 110 },
      {
        headerName: "Payee",
        field: "beneficiaryName",
        flex: 2,
        minWidth: 140,
      },
      { headerName: "Relationship", field: "relationship", width: 120 },
      {
        headerName: "Bank",
        flex: 2,
        minWidth: 160,
        valueGetter: (p) => {
          const bank = p.data.bankName ?? "";
          const masked = maskAccount(p.data.accountNumber);
          return [bank, masked].filter(Boolean).join(" — ");
        },
      },
      {
        headerName: "Amount",
        field: "value",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) =>
          p.data.allotmentType === "percentage"
            ? `${p.value}%`
            : formatMoney(p.value),
      },
      { headerName: "Ccy", field: "currency", width: 70 },
      { headerName: "Priority", field: "priority", width: 90 },
      { headerName: "Valid From", field: "validFrom", width: 110 },
      { headerName: "Valid To", field: "validTo", width: 110 },
      {
        headerName: "KYC",
        field: "kycComplete",
        width: 70,
        cellRenderer: (p: any) =>
          p.value ? <Check size={14} className="text-green-700" /> : null,
      },
      {
        headerName: "Bank ✓",
        field: "bankVerified",
        width: 80,
        cellRenderer: (p: any) =>
          p.value ? <Check size={14} className="text-green-700" /> : null,
      },
      {
        headerName: "Status",
        field: "status",
        width: 110,
        cellRenderer: (p: any) => (
          <Badge
            variant="outline"
            className={`text-xs ${
              p.value === "active"
                ? "border-green-300 bg-green-50 text-green-800"
                : p.value === "suspended"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-gray-300 bg-gray-50 text-gray-600"
            }`}
          >
            {p.value}
          </Badge>
        ),
      },
      {
        headerName: "Actions",
        width: 150,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          if (!mayEdit) return null;
          const row = p.data;
          const ended = row.status === "ended";
          return (
            <div className="flex items-center gap-1 h-full">
              {!ended && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Edit"
                  onClick={() => openEdit(row)}
                  data-testid={`button-edit-allotment-${row.allotmentUuid}`}
                >
                  <Pencil size={14} />
                </Button>
              )}
              {row.status === "active" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-amber-600"
                  title="Suspend"
                  disabled={acting}
                  onClick={() => lifecycle(row, "suspend")}
                  data-testid={`button-suspend-allotment-${row.allotmentUuid}`}
                >
                  <Pause size={14} />
                </Button>
              )}
              {row.status === "suspended" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-green-700"
                  title="Reactivate"
                  disabled={acting}
                  onClick={() => lifecycle(row, "reactivate")}
                  data-testid={`button-reactivate-allotment-${row.allotmentUuid}`}
                >
                  <Play size={14} />
                </Button>
              )}
              {!ended && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-600"
                  title="End allotment"
                  disabled={acting}
                  onClick={() => setEndTarget(row)}
                  data-testid={`button-end-allotment-${row.allotmentUuid}`}
                >
                  <Square size={14} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [mayEdit, acting],
  );

  return (
    <div className="p-4 space-y-4" data-testid="allotments-page">
      <div>
        <h1 className="text-xl font-semibold text-[#0f172a]">Allotments</h1>
        <p className="text-sm text-muted-foreground">
          Family remittance instructions with bank details and verification
          flags
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Vessel</Label>
          <Select value={vesselFilter} onValueChange={setVesselFilter}>
            <SelectTrigger
              className="h-9 w-44 bg-white"
              data-testid="select-filter-vessel"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vessels</SelectItem>
              {vessels.map((v) => (
                <SelectItem key={v.entryId} value={v.entryId}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="h-9 w-36 bg-white"
              data-testid="select-filter-status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Crew</Label>
          <Input
            className="h-9 w-48 bg-white"
            placeholder="Search crew…"
            value={crewSearch}
            onChange={(e) => setCrewSearch(e.target.value)}
            data-testid="input-search-crew"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            data-testid="button-export-allotments"
          >
            <Download size={14} className="mr-1" /> Export
          </Button>
          {mayCreate && (
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-add-allotment"
            >
              <Plus size={14} className="mr-1" /> Add Allotment
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md bg-white p-2">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading allotments…
          </div>
        ) : (
          <AgGridTable
            rowData={filtered}
            columnDefs={cols}
            onGridReady={onGridReady}
            height="480px"
          />
        )}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Allotment" : "Add Allotment"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <>
                <div className="space-y-1">
                  <Label>Vessel</Label>
                  <Select value={dialogVessel} onValueChange={setDialogVessel}>
                    <SelectTrigger data-testid="select-allotment-vessel">
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      {vessels.map((v) => (
                        <SelectItem key={v.entryId} value={v.entryId}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Crew</Label>
                  <Select
                    value={form.crewUuid}
                    onValueChange={(v) => set("crewUuid", v)}
                    disabled={!dialogVessel}
                  >
                    <SelectTrigger data-testid="select-allotment-crew">
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
              </>
            )}
            {editing && (
              <div className="col-span-2 text-sm text-muted-foreground">
                {editing.crewName} {editing.rank ? `(${editing.rank})` : ""}
              </div>
            )}
            <div className="space-y-1">
              <Label>Payee Name</Label>
              <Input
                value={form.beneficiaryName}
                onChange={(e) => set("beneficiaryName", e.target.value)}
                data-testid="input-allotment-payee"
              />
            </div>
            <div className="space-y-1">
              <Label>Relationship</Label>
              <Input
                value={form.relationship}
                onChange={(e) => set("relationship", e.target.value)}
                placeholder="Spouse, parent…"
                data-testid="input-allotment-relationship"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.allotmentType}
                onValueChange={(v) => set("allotmentType", v)}
              >
                <SelectTrigger data-testid="select-allotment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                {form.allotmentType === "percentage" ? "Percent" : "Amount"}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                data-testid="input-allotment-value"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                data-testid="input-allotment-currency"
              />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                data-testid="input-allotment-priority"
              />
            </div>
            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input
                value={form.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                data-testid="input-allotment-bank"
              />
            </div>
            <div className="space-y-1">
              <Label>Account Number</Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
                data-testid="input-allotment-account"
              />
            </div>
            <div className="space-y-1">
              <Label>IBAN / SWIFT</Label>
              <Input
                value={form.ibanSwift}
                onChange={(e) => set("ibanSwift", e.target.value)}
                data-testid="input-allotment-iban"
              />
            </div>
            <div className="space-y-1">
              <Label>Bank Country</Label>
              <Input
                value={form.bankCountry}
                onChange={(e) => set("bankCountry", e.target.value)}
                data-testid="input-allotment-bank-country"
              />
            </div>
            <div className="space-y-1">
              <Label>Valid From</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) => set("validFrom", e.target.value)}
                data-testid="input-allotment-valid-from"
              />
            </div>
            <div className="flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.kycComplete}
                  onCheckedChange={(v) => set("kycComplete", !!v)}
                  data-testid="checkbox-allotment-kyc"
                />
                KYC complete
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.bankVerified}
                  onCheckedChange={(v) => set("bankVerified", !!v)}
                  data-testid="checkbox-allotment-bank-verified"
                />
                Bank verified
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-allotment"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-save-allotment"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End confirmation */}
      <AlertDialog
        open={!!endTarget}
        onOpenChange={(open) => !open && setEndTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End allotment?</AlertDialogTitle>
            <AlertDialogDescription>
              This ends the allotment for {endTarget?.crewName ?? "this crew"}{" "}
              to {endTarget?.beneficiaryName}. It will stop being deducted from
              the next payroll run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={acting}
              onClick={() => endTarget && lifecycle(endTarget, "end")}
              data-testid="button-confirm-end"
            >
              End Allotment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
