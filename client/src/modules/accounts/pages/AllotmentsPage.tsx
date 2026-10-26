import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type FocusEventHandler } from "react";
import { accountsStatusBadgeClass } from "../accountsStatusBadgeStyles";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import AgGridTable from "./AccountsGridTable";
import EndAllotmentDialog from "./EndAllotmentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURRENCIES } from "../accountsConstants";
import {
  FormattedDateInput,
  formatIsoDate,
} from "@/components/ui/formatted-date-input";
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
  Lock,
} from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { useVesselPeriod } from "../vesselPeriodStore";
import {
  LOCKED_DATE_INLINE,
  useCashPeriodLock,
} from "../hooks/useCashPeriodLock";

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

type AllotmentDateInputProps = Pick<
  Extract<ComponentPropsWithoutRef<typeof FormattedDateInput>, { mode?: "date" }>,
  "value" | "onChange" | "onDraftValidityChange" | "data-testid" | "className" | "calendarDisabledPeriods"
>;

function AllotmentDateInput({ onDraftValidityChange, ...props }: AllotmentDateInputProps) {
  const handleBlurCapture: FocusEventHandler<HTMLDivElement> = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "date") return;
    if (input.matches(":disabled") || !input.validity.valid) return;
    if (input.value === props.value) return;
    if (input.value !== "" && !formatIsoDate(input.value)) return;
    // Accept a pending calendar selection before the shared blur handler resets it.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div style={{ minHeight: 56 }} onBlurCapture={handleBlurCapture}>
      <FormattedDateInput
        {...props}
        mode="date"
        className={`min-w-0 ${props.className || "border-input"} text-base md:text-sm`}
        acceptCalendarInputEvents
        retainInvalidDraftOnBlur
        onDraftValidityChange={onDraftValidityChange}
      />
    </div>
  );
}

function maskAccount(acct: string | null | undefined): string {
  if (!acct) return "";
  const tail = acct.slice(-4);
  return acct.length <= 4 ? tail : `•••• ${tail}`;
}

export default function AllotmentsPage({
  embedded = false,
}: {
  /** When rendered inside the Allotments & Cash tabs, skip the page header/padding. */
  embedded?: boolean;
} = {}) {
  const { toast } = useToast();
  const { canCreate, canEdit } = usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);

  const { vessels } = useVesselLookup();
  const { vesselUuid, setVesselUuid, period, setPeriod, resetFilters } = useVesselPeriod();
  const [periodInputKey, setPeriodInputKey] = useState(0);
  const hasFilter = !!vesselUuid && !!period;
  const locks = useCashPeriodLock(vesselUuid, period);
  const lockContext = { vesselUuid, period };
  const [statusFilter, setStatusFilter] = useState("all");
  const [crewSearch, setCrewSearch] = useState("");

  const listKey = [`${ACCOUNTS_BASE}/allotments`];
  const { data: allotments = [], isLoading } = useQuery<any[]>({
    queryKey: listKey,
    enabled: hasFilter,
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCHours(24, 0, 0, 0);

      timer = setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: [`${ACCOUNTS_BASE}/allotments`],
        });
        scheduleRefresh();
      }, nextMidnight.getTime() - now.getTime() + 100);
    };

    scheduleRefresh();

    return () => clearTimeout(timer);
  }, []);

  // Crew for the create dialog comes from the selected vessel's engagements.
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

  const filtered = useMemo(() => {
    if (!hasFilter) return [];
    const q = crewSearch.trim().toLowerCase();
    return allotments.filter(
      (a) =>
        a.vesselUuid === vesselUuid &&
        (!a.validFrom || a.validFrom.slice(0, 7) <= period) &&
        (!a.validTo || a.validTo.slice(0, 7) >= period) &&
        (statusFilter === "all" || a.status === statusFilter) &&
        (!q || (a.crewName ?? "").toLowerCase().includes(q)),
    );
  }, [allotments, hasFilter, vesselUuid, period, statusFilter, crewSearch]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<AllotmentForm>(emptyForm);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateFormVersion, setDateFormVersion] = useState(0);
  const validFromIsValid = useRef(true);

  const validFromOrderError =
    editing?.validTo &&
    form.validFrom &&
    form.validFrom !== (editing.validFrom ?? "") &&
    form.validFrom > editing.validTo
      ? "Valid From cannot be later than Valid To."
      : "";

  const resetDateInput = () => {
    validFromIsValid.current = true;
    setDateFormVersion((version) => version + 1);
  };
  const [endTarget, setEndTarget] = useState<any | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setDialogOpen(false);
    setEditing(null);
    setEndTarget(null);
  }, [vesselUuid, period]);

  const set = <K extends keyof AllotmentForm>(key: K, value: AllotmentForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setValidationAttempted(false);
    resetDateInput();
    setEditing(null);
    setForm({ ...emptyForm, validFrom: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setValidationAttempted(false);
    resetDateInput();
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

  const requiredErrors: Record<string, string> = {};
  if (!editing && !form.crewUuid) {
    requiredErrors.crewUuid = "Crew is required.";
  }
  for (const [key, label] of [
    ["beneficiaryName", "Payee Name"],
    ["bankName", "Bank Name"],
    ["accountNumber", "Account Number"],
    ["ibanSwift", "IBAN/SWIFT"],
  ] as const) {
    if (!form[key].trim()) {
      requiredErrors[key] = `${label} is required.`;
    }
  }
  if (!form.value) {
    requiredErrors.value =
      form.allotmentType === "percentage"
        ? "Percent is required."
        : "Amount is required.";
  }
  if (!form.validFrom) {
    requiredErrors.validFrom = "Valid From is required.";
  }
  const errors: Record<string, string> =
    validationAttempted ? requiredErrors : {};

  const save = async () => {
    setValidationAttempted(true);
    if (locks.blocked) return;

    if (
      validFromIsValid.current &&
      locks.isDateBlocked(form.validFrom, editing?.validFrom)
    ) {
      locks.showDateError();
      return;
    }
    if (Object.keys(requiredErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted errors before saving.",
        variant: "destructive",
      });
      return;
    }
    const crew = engagedRows.find((r) => r.crewUuid === form.crewUuid);
    if (!editing && (!vesselUuid || !period || !crew)) {
      toast({
        title: "Missing crew",
        description: "Select a vessel and period on the main screen, then choose a crew member from that vessel.",
        variant: "destructive",
      });
      return;
    }
    if (!validFromIsValid.current) {
      toast({
        title: "Invalid date",
        description: "Enter a valid date in Valid From before saving.",
        variant: "destructive",
      });
      return;
    }
    if (validFromOrderError) {
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
          lockContext,
        );
      } else {
        res = await accountsApiV2.allotments.create({
          ...payload,
          crewUuid: form.crewUuid,
          crewName: crew?.crewName ?? null,
          rank: crew?.presentRank ?? null,
          engagementUuid: crew?.engagement?.engagementUuid ?? null,
        }, lockContext);
      }
      queryClient.invalidateQueries({ queryKey: listKey });
      setDialogOpen(false);
      toast({ title: editing ? "Allotment updated" : "Allotment created" });
      notifyCap(res);
    } catch (err) {
      if (locks.handleServerError(err, form.validFrom)) return;
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
    action: "suspend" | "reactivate",
  ) => {
    if (locks.blocked) return;
    setActing(true);
    try {
      const res: any =
        action === "suspend"
          ? await accountsApiV2.allotments.suspend(row.allotmentUuid, lockContext)
          : await accountsApiV2.allotments.reactivate(row.allotmentUuid, lockContext);
      queryClient.invalidateQueries({ queryKey: listKey });
      toast({
        title:
          action === "suspend"
            ? "Allotment suspended"
            : "Allotment reactivated",
      });
      if (action === "reactivate") notifyCap(res);
    } catch (err) {
      locks.handleServerError(err);
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
      {
        headerName: "Valid From",
        field: "validFrom",
        width: 110,
        cellRenderer: (p: { value: string | null | undefined }) =>
          formatDate(p.value),
      },
      {
        headerName: "Valid To",
        field: "validTo",
        width: 110,
        cellRenderer: (p: { value: string | null | undefined }) =>
          formatDate(p.value),
      },
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
        cellClass: "accounts-status-badge-cell",
        cellRenderer: (p: any) => (
          <Badge
            variant="outline"
            className={
              p.value === "active"
                ? accountsStatusBadgeClass("green")
                : p.value === "suspended"
                  ? accountsStatusBadgeClass("red")
                  : p.value === "ended"
                    ? accountsStatusBadgeClass("yellow")
                    : "text-xs border-gray-300 bg-gray-50 text-gray-600"
            }
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
                  disabled={locks.blocked}
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
                  disabled={acting || locks.blocked}
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
                  disabled={acting || locks.blocked}
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
                  disabled={acting || locks.blocked}
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
    [mayEdit, acting, locks.blocked, vesselUuid, period],
  );

  return (
    <div
      className={embedded ? "space-y-4" : "p-4 space-y-4"}
      data-testid="allotments-page"
    >
      {!embedded && (
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Allotments</h1>
          <p className="text-sm text-muted-foreground">
            Family remittance instructions with bank details and verification
            flags
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Vessel</Label>
          <Select value={vesselUuid} onValueChange={setVesselUuid}>
            <SelectTrigger
              className="h-8 w-44 text-xs"
              data-testid="select-filter-vessel"
            >
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
        <div
          className="space-y-1"
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            const input =
              event.currentTarget.querySelector<HTMLInputElement>(
                'input[type="text"]',
              );
            if (
              input &&
              (!input.value.trim() || input.dataset.monthValid === "false")
            ) {
              setPeriodInputKey((key) => key + 1);
            }
          }}
        >
          <Label className="text-xs text-gray-600">Period</Label>
          <FormattedDateInput
            key={periodInputKey}
            mode="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="h-8 w-44 bg-transparent text-xs md:text-xs"
            data-testid="input-period"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="h-8 w-36 text-xs"
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
        <div className="hidden space-y-1">
          <Label className="text-xs text-gray-600">Crew</Label>
          <Input
            className="h-9 w-48 bg-white"
            placeholder="Search crew…"
            value={crewSearch}
            onChange={(e) => setCrewSearch(e.target.value)}
            data-testid="input-search-crew"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
          onClick={() => {
            resetFilters();
            setPeriodInputKey((key) => key + 1);
            setStatusFilter("all");
            setCrewSearch("");
          }}
          data-testid="button-clear-filters"
        >
          Clear
        </Button>
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
              disabled={!hasFilter || locks.blocked}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-add-allotment"
            >
              <Plus size={14} className="mr-1" /> Add Allotment
            </Button>
          )}
        </div>
      </div>

      {hasFilter && locks.isLocked && (
        <Badge
          variant="outline"
          className="gap-1"
          data-testid="badge-allotments-locked"
        >
          <Lock size={12} /> Period locked — read only
        </Badge>
      )}

      {locks.notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {locks.notice}
        </p>
      )}

      <div className="border rounded-md bg-white p-2">
        {!hasFilter ? (
          <div
            className="p-8 text-center text-sm text-muted-foreground"
            data-testid="text-allotments-select-prompt"
          >
            Select a vessel and period to view Allotments.
          </div>
        ) : isLoading ? (
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
                  <Label>Crew <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.crewUuid}
                    onValueChange={(v) => set("crewUuid", v)}
                    disabled={!vesselUuid || !period}
                  >
                    <SelectTrigger className={errors.crewUuid ? "border-red-500" : undefined} aria-invalid={!!errors.crewUuid} data-testid="select-allotment-crew">
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
                  {errors.crewUuid && (
                    <p className="text-xs text-red-500" role="alert">{errors.crewUuid}</p>
                  )}
                </div>
              </>
            )}
            {editing && (
              <div className="col-span-2 text-sm text-muted-foreground">
                {editing.crewName} {editing.rank ? `(${editing.rank})` : ""}
              </div>
            )}
            <div className="space-y-1">
              <Label>Payee Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.beneficiaryName}
                onChange={(e) => set("beneficiaryName", e.target.value)}
                data-testid="input-allotment-payee"
                className={errors.beneficiaryName ? "border-red-500" : undefined}
                aria-invalid={!!errors.beneficiaryName}
              />
              {errors.beneficiaryName && (
                <p className="text-xs text-red-500" role="alert">{errors.beneficiaryName}</p>
              )}
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
                {" "}<span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                data-testid="input-allotment-value"
                className={errors.value ? "border-red-500" : undefined}
                aria-invalid={!!errors.value}
              />
              {errors.value && (
                <p className="text-xs text-red-500" role="alert">{errors.value}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select
                value={form.currency === "" ? "__existing_blank_currency__" : form.currency}
                onValueChange={(v) =>
                  set("currency", form.currency === "" && v === "__existing_blank_currency__" ? "" : v)
                }
              >
                <SelectTrigger className="h-9" data-testid="input-allotment-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                  {form.currency === "" ? (
                    <SelectItem value="__existing_blank_currency__">
                      Blank (existing value)
                    </SelectItem>
                  ) : !CURRENCIES.some((c) => c.value === form.currency) ? (
                    <SelectItem value={form.currency}>{form.currency}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
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
              <Label>Bank Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                data-testid="input-allotment-bank"
                className={errors.bankName ? "border-red-500" : undefined}
                aria-invalid={!!errors.bankName}
              />
              {errors.bankName && (
                <p className="text-xs text-red-500" role="alert">{errors.bankName}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Account Number <span className="text-red-500">*</span></Label>
              <Input
                value={form.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
                data-testid="input-allotment-account"
                className={errors.accountNumber ? "border-red-500" : undefined}
                aria-invalid={!!errors.accountNumber}
              />
              {errors.accountNumber && (
                <p className="text-xs text-red-500" role="alert">{errors.accountNumber}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>IBAN / SWIFT <span className="text-red-500">*</span></Label>
              <Input
                value={form.ibanSwift}
                onChange={(e) => set("ibanSwift", e.target.value)}
                data-testid="input-allotment-iban"
                className={errors.ibanSwift ? "border-red-500" : undefined}
                aria-invalid={!!errors.ibanSwift}
              />
              {errors.ibanSwift && (
                <p className="text-xs text-red-500" role="alert">{errors.ibanSwift}</p>
              )}
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
              <Label>Valid From <span className="text-red-500">*</span></Label>
              <AllotmentDateInput
                key={dateFormVersion}
                value={form.validFrom}
                onChange={(e) => set("validFrom", e.target.value)}
                onDraftValidityChange={(valid) => {
                  validFromIsValid.current = valid;
                }}
                data-testid="input-allotment-valid-from"
                calendarDisabledPeriods={locks.calendarDisabledPeriods}
                className={
                  errors.validFrom ||
                  (validationAttempted &&
                    locks.isDateBlocked(form.validFrom, editing?.validFrom))
                    ? "border-red-500"
                    : undefined
                }
              />
              {validationAttempted &&
                locks.isDateBlocked(form.validFrom, editing?.validFrom) && (
                  <p role="alert" className="text-xs text-red-500">
                    {LOCKED_DATE_INLINE}
                  </p>
                )}
              {errors.validFrom && (
                <p className="text-xs text-red-500" role="alert">{errors.validFrom}</p>
              )}
              {validFromOrderError && (
                <p role="alert" className="text-sm text-destructive">
                  {validFromOrderError}
                </p>
              )}
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
              disabled={saving || locks.blocked}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-save-allotment"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End confirmation */}
      {endTarget && (
        <EndAllotmentDialog
          key={endTarget.allotmentUuid}
          target={endTarget}
          lockContext={lockContext}
          mutationBlocked={locks.blocked}
          onClose={() => setEndTarget(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: listKey });
            setEndTarget(null);
          }}
        />
      )}
    </div>
  );
}
