import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useNationalitiesV2 } from "@/hooks/v2/useMasterDataV2";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { accountsApiV2, parseApiError, ACCOUNTS_BASE } from "../api/accountsApiV2";
import { formatDate, formatMoney, yearStepToMonths } from "../accountsFormat";

const RANKS_KEY = ["/api/v2/admin/company-ranks"];
const ELEMENTS_KEY = [`${ACCOUNTS_BASE}/pay-elements`];
const COLUMN_METHODS = ["scale_lookup", "rate_times_qty"];

interface ColumnDefMeta {
  uuid: string;
  code: string;
  name: string;
  isRate: boolean;
}

interface Tab {
  id: string;
  rankIds: string[];
  nationalityUuid: string | null;
  years: number;
}

type MatrixRow = Record<string, any>;

function tabLabel(
  tab: Tab,
  rankName: Map<string, string>,
  natName: Map<string, string>,
): string {
  const ranks =
    tab.rankIds.map((r) => rankName.get(r) ?? r).join(", ") || "No rank";
  const nat = tab.nationalityUuid ? ` · ${natName.get(tab.nationalityUuid) ?? tab.nationalityUuid}` : "";
  return `${ranks}${nat}`;
}

export default function WageScaleEditor({
  scaleUuid,
  onBack,
}: {
  scaleUuid: string;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const { canEdit } = usePermissions();
  const mayEdit = canEdit("Account Wage Scales");

  const detailKey = useMemo(
    () => [`${ACCOUNTS_BASE}/wage-scales/${scaleUuid}`],
    [scaleUuid],
  );
  const { data: detail, isLoading } = useQuery<any>({ queryKey: detailKey });
  const { data: ranks = [] } = useQuery<any[]>({ queryKey: RANKS_KEY });
  const { data: elements = [] } = useQuery<any[]>({ queryKey: ELEMENTS_KEY });
  const { data: nationalities = [] } = useNationalitiesV2();

  const scale = detail?.scale;
  const supersedes = detail?.supersedes ?? null;
  const isDraft = scale?.status === "draft";
  const editable = mayEdit && isDraft;

  // --- effective dates (Task 148) ---
  const [datesSaving, setDatesSaving] = useState(false);
  const [effFrom, setEffFrom] = useState("");
  const [effTo, setEffTo] = useState("");
  useEffect(() => {
    setEffFrom(scale?.effectiveFrom ?? "");
    setEffTo(scale?.effectiveTo ?? "");
  }, [scale?.effectiveFrom, scale?.effectiveTo]);
  const datesDirty =
    !!scale &&
    (effFrom !== (scale.effectiveFrom ?? "") ||
      effTo !== (scale.effectiveTo ?? ""));

  const handleSaveDates = async () => {
    setDatesSaving(true);
    try {
      await accountsApiV2.wageScales.update(scaleUuid, {
        effectiveFrom: effFrom || null,
        effectiveTo: effTo || null,
      });
      await queryClient.invalidateQueries({ queryKey: detailKey });
      await queryClient.invalidateQueries({
        queryKey: [`${ACCOUNTS_BASE}/wage-scales`],
      });
      toast({ title: "Effective dates saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setDatesSaving(false);
    }
  };

  const rankName = useMemo(() => {
    const m = new Map<string, string>();
    ranks.forEach((r: any) => m.set(r.rankId, r.rank));
    return m;
  }, [ranks]);
  const natName = useMemo(() => {
    const m = new Map<string, string>();
    nationalities.forEach((n: any) => m.set(n.natUuid, n.nationality));
    return m;
  }, [nationalities]);
  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    elements.forEach((e: any) => m.set(e.payElementUuid, e));
    return m;
  }, [elements]);

  const [columns, setColumns] = useState<ColumnDefMeta[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dataRef = useRef<Record<string, MatrixRow[]>>({});
  const gridApiRef = useRef<GridApi | null>(null);

  // Build matrix state from server lines once detail + masters are present.
  const builtForRef = useRef<string>("");
  useEffect(() => {
    if (!detail || elements.length === 0) return;
    if (builtForRef.current === scaleUuid) return;
    builtForRef.current = scaleUuid;

    const lines: any[] = detail.lines ?? [];
    const colOrder: string[] = [];
    const cols: ColumnDefMeta[] = [];
    const seenCol = new Set<string>();
    lines.forEach((l) => {
      if (!seenCol.has(l.payElementUuid)) {
        seenCol.add(l.payElementUuid);
        colOrder.push(l.payElementUuid);
      }
    });
    colOrder.forEach((uuid) => {
      const el = elementByUuid.get(uuid);
      cols.push({
        uuid,
        code: el?.code ?? uuid.slice(0, 6),
        name: el?.name ?? "",
        isRate: el?.calcMethod === "rate_times_qty",
      });
    });

    const tabMap = new Map<string, Tab>();
    const rowsByTab: Record<string, MatrixRow[]> = {};
    const yearsByTab: Record<string, number> = {};

    lines.forEach((l) => {
      const nat = l.nationalityUuid ?? null;
      const tabId = `${l.rankId}|${nat ?? ""}`;
      if (!tabMap.has(tabId)) {
        tabMap.set(tabId, {
          id: tabId,
          rankIds: [l.rankId],
          nationalityUuid: nat,
          years: 1,
        });
        rowsByTab[tabId] = [];
        yearsByTab[tabId] = 1;
      }
      const step = Math.floor((l.experienceMinMonths ?? 0) / 12) + 1;
      yearsByTab[tabId] = Math.max(yearsByTab[tabId], step);
      let row = rowsByTab[tabId].find((r) => r.__year__ === step);
      if (!row) {
        row = { __year__: step };
        rowsByTab[tabId].push(row);
      }
      const isRate = elementByUuid.get(l.payElementUuid)?.calcMethod === "rate_times_qty";
      const raw = isRate ? l.rate : l.amount;
      row[l.payElementUuid] = raw == null || raw === "" ? null : Number(raw);
    });

    const finalTabs = Array.from(tabMap.values()).map((t) => ({
      ...t,
      years: yearsByTab[t.id],
    }));
    finalTabs.forEach((t) => {
      rowsByTab[t.id] = fillRows(rowsByTab[t.id], t.years);
    });

    setColumns(cols);
    setTabs(finalTabs);
    dataRef.current = rowsByTab;
    setActiveTabId(finalTabs[0]?.id ?? "");
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, elements, scaleUuid]);

  function fillRows(existing: MatrixRow[], years: number): MatrixRow[] {
    const byYear = new Map<number, MatrixRow>();
    existing.forEach((r) => byYear.set(r.__year__, r));
    const out: MatrixRow[] = [];
    for (let y = 1; y <= years; y++) {
      out.push(byYear.get(y) ?? { __year__: y });
    }
    return out;
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeRows = activeTab ? dataRef.current[activeTab.id] ?? [] : [];

  const columnDefs = useMemo<ColDef[]>(() => {
    const yearCol: ColDef = {
      headerName: "Year / seniority",
      field: "__year__",
      pinned: "left",
      width: 150,
      editable: false,
      sortable: false,
      filter: false,
      valueFormatter: (p) => {
        const { min, max } = yearStepToMonths(p.value);
        return `Year ${p.value}  (${min}–${max} mo)`;
      },
    };
    const elCols: ColDef[] = columns.map((c) => ({
      headerName: `${c.code}${c.isRate ? " (rate)" : ""}`,
      headerTooltip: c.name,
      field: c.uuid,
      editable: editable,
      sortable: false,
      filter: false,
      type: "rightAligned",
      valueParser: (p) =>
        p.newValue === "" || p.newValue == null ? null : Number(p.newValue),
      valueFormatter: (p) => (p.value == null ? "" : formatMoney(p.value)),
      cellClass: editable ? "bg-blue-50/40" : "",
    }));
    const totalCol: ColDef = {
      headerName: "Total",
      field: "__total__",
      pinned: "right",
      width: 130,
      editable: false,
      sortable: false,
      filter: false,
      type: "rightAligned",
      valueGetter: (p) => {
        let sum = 0;
        let any = false;
        columns.forEach((c) => {
          if (c.isRate) return;
          const v = p.data?.[c.uuid];
          if (v != null && v !== "" && !Number.isNaN(Number(v))) {
            sum += Number(v);
            any = true;
          }
        });
        return any ? sum : null;
      },
      valueFormatter: (p) => (p.value == null ? "" : formatMoney(p.value)),
      cellClass: "font-semibold",
    };
    return [yearCol, ...elCols, totalCol];
  }, [columns, editable]);

  const onGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  };

  const onCellValueChanged = () => {
    setDirty(true);
    gridApiRef.current?.refreshCells({
      columns: ["__total__"],
      force: true,
    });
  };

  // --- column management ---
  const [colToAdd, setColToAdd] = useState("");
  const INELIGIBLE_HINTS: Record<string, string> = {
    fixed_amount: "Fixed amount — not a scale column",
    manual_entry: "Manual entry — entered as transactions",
    percentage_of_base: "Percentage of base — computed at run time",
  };
  const columnCandidates = elements.filter(
    (e: any) => !columns.some((c) => c.uuid === e.payElementUuid),
  );
  const addColumn = () => {
    const el = elementByUuid.get(colToAdd);
    if (!el) return;
    setColumns((c) => [
      ...c,
      {
        uuid: el.payElementUuid,
        code: el.code,
        name: el.name,
        isRate: el.calcMethod === "rate_times_qty",
      },
    ]);
    setColToAdd("");
    setDirty(true);
  };
  const removeColumn = (uuid: string) => {
    setColumns((c) => c.filter((x) => x.uuid !== uuid));
    Object.values(dataRef.current).forEach((rows) =>
      rows.forEach((r) => delete r[uuid]),
    );
    setDirty(true);
  };

  // --- tab management ---
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [newTabRanks, setNewTabRanks] = useState<string[]>([]);
  const [newTabNat, setNewTabNat] = useState<string>("__none__");
  const [newTabYears, setNewTabYears] = useState(4);

  const addTab = () => {
    if (newTabRanks.length === 0) {
      toast({
        title: "Select at least one rank",
        variant: "destructive",
      });
      return;
    }
    const nat = newTabNat === "__none__" ? null : newTabNat;
    const id = `new-${Date.now()}`;
    const tab: Tab = {
      id,
      rankIds: [...newTabRanks],
      nationalityUuid: nat,
      years: Math.max(1, newTabYears),
    };
    dataRef.current[id] = fillRows([], tab.years);
    setTabs((t) => [...t, tab]);
    setActiveTabId(id);
    setTabDialogOpen(false);
    setNewTabRanks([]);
    setNewTabNat("__none__");
    setNewTabYears(4);
    setDirty(true);
  };

  const removeTab = (id: string) => {
    delete dataRef.current[id];
    setTabs((t) => {
      const next = t.filter((x) => x.id !== id);
      if (activeTabId === id) setActiveTabId(next[0]?.id ?? "");
      return next;
    });
    setDirty(true);
  };

  const setActiveYears = (years: number) => {
    if (!activeTab) return;
    const y = Math.max(1, Math.min(40, years));
    dataRef.current[activeTab.id] = fillRows(
      dataRef.current[activeTab.id] ?? [],
      y,
    );
    setTabs((t) =>
      t.map((x) => (x.id === activeTab.id ? { ...x, years: y } : x)),
    );
    setDirty(true);
  };

  // --- save ---
  const buildLines = () => {
    const lines: any[] = [];
    let sortOrder = 0;
    tabs.forEach((tab) => {
      const rows = dataRef.current[tab.id] ?? [];
      rows.forEach((row) => {
        const { min, max } = yearStepToMonths(row.__year__);
        columns.forEach((col) => {
          const v = row[col.uuid];
          if (v == null || v === "" || Number.isNaN(Number(v))) return;
          tab.rankIds.forEach((rankId) => {
            lines.push({
              rankId,
              nationalityUuid: tab.nationalityUuid ?? undefined,
              experienceMinMonths: min,
              experienceMaxMonths: max,
              payElementUuid: col.uuid,
              amount: col.isRate ? undefined : String(v),
              rate: col.isRate ? String(v) : undefined,
              sortOrder: sortOrder++,
            });
          });
        });
      });
    });
    return lines;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountsApiV2.wageScales.replaceLines(scaleUuid, buildLines());
      await queryClient.invalidateQueries({ queryKey: detailKey });
      builtForRef.current = "";
      setDirty(false);
      toast({ title: "Wage scale saved" });
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

  // --- activation + floor check ---
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [violations, setViolations] = useState<any[]>([]);
  const [acknowledge, setAcknowledge] = useState(false);
  const [activating, setActivating] = useState(false);

  const runActivate = async (ack: boolean) => {
    setActivating(true);
    try {
      await accountsApiV2.wageScales.activate(scaleUuid, ack);
      await queryClient.invalidateQueries({ queryKey: detailKey });
      await queryClient.invalidateQueries({
        queryKey: [`${ACCOUNTS_BASE}/wage-scales`],
      });
      builtForRef.current = "";
      setFloorDialogOpen(false);
      toast({ title: "Wage scale activated" });
    } catch (err) {
      const info = parseApiError(err);
      if (info.data?.violations) {
        setViolations(info.data.violations);
        setAcknowledge(false);
        setFloorDialogOpen(true);
      } else {
        toast({
          title: "Activation failed",
          description: info.message,
          variant: "destructive",
        });
      }
    } finally {
      setActivating(false);
    }
  };

  const handleActivateClick = async () => {
    if (dirty) {
      toast({
        title: "Save first",
        description: "Save your changes before activating.",
        variant: "destructive",
      });
      return;
    }
    setActivating(true);
    try {
      const res = await fetchFloorCheck();
      if (res.ok) {
        await runActivate(false);
      } else {
        setViolations(res.violations ?? []);
        setAcknowledge(false);
        setFloorDialogOpen(true);
      }
    } catch (err) {
      toast({
        title: "Floor check failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  };

  const fetchFloorCheck = async (): Promise<any> => {
    return queryClient.fetchQuery({
      queryKey: [`${ACCOUNTS_BASE}/wage-scales/${scaleUuid}/floor-check`],
      staleTime: 0,
    });
  };

  if (isLoading || !scale) {
    return (
      <div className="p-6 text-sm text-muted-foreground" data-testid="wage-scale-editor-loading">
        Loading wage scale…
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-full" data-testid="page-wage-scale-editor">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back-to-scales"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-[#16569e]">
                {scale.scaleName}
              </h1>
              <StatusBadge status={scale.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {scale.currency}
              {scale.effectiveFrom
                ? ` · effective ${formatDate(scale.effectiveFrom)}`
                : ""}
              {scale.effectiveTo ? ` – ${formatDate(scale.effectiveTo)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {editable && (
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              variant="outline"
              data-testid="button-save-scale"
            >
              <Save size={15} className="mr-1" />
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          {editable && (
            <Button
              onClick={handleActivateClick}
              disabled={activating}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-activate-scale"
            >
              <CheckCircle2 size={15} className="mr-1" />
              {activating ? "Checking…" : "Activate"}
            </Button>
          )}
        </div>
      </div>

      {!isDraft && (
        <div
          className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
          data-testid="banner-readonly"
        >
          This wage scale is {scale.status}. Matrix values are read-only.
          {scale.status === "active"
            ? " Use Supersede from the list to create a new draft version."
            : ""}
        </div>
      )}

      {supersedes && !scale.effectiveFrom && (
        <div
          className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          data-testid="banner-revision-missing-effective-from"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            This scale supersedes <b>{supersedes.scaleName}</b> but has no
            Effective From date, so wage calculation will never switch to it.
            Set Effective From below
            {supersedes.effectiveTo
              ? ` (typically the day after ${formatDate(supersedes.effectiveTo)},`
              : " (typically the day after the superseded scale's Effective To,"}
            {" "}or match the superseded scale's Effective From to replace it
            for all periods).
          </span>
        </div>
      )}

      {(isDraft || scale.status === "active") && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Effective from
            </Label>
            <Input
              type="date"
              value={effFrom}
              onChange={(e) => setEffFrom(e.target.value)}
              disabled={!mayEdit}
              className="h-8 w-40 text-xs"
              data-testid="input-editor-effective-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Effective to
            </Label>
            <Input
              type="date"
              value={effTo}
              onChange={(e) => setEffTo(e.target.value)}
              disabled={!mayEdit}
              className="h-8 w-40 text-xs"
              data-testid="input-editor-effective-to"
            />
          </div>
          {mayEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleSaveDates}
              disabled={datesSaving || !datesDirty}
              data-testid="button-save-dates"
            >
              {datesSaving ? "Saving…" : "Save dates"}
            </Button>
          )}
        </div>
      )}

      {/* Column picker */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Elements:
        </span>
        {columns.map((c) => (
          <Badge
            key={c.uuid}
            variant="secondary"
            className="flex items-center gap-1"
            data-testid={`column-chip-${c.code}`}
          >
            {c.code}
            {c.isRate ? " (rate)" : ""}
            {editable && (
              <button
                onClick={() => removeColumn(c.uuid)}
                className="ml-1 text-muted-foreground hover:text-red-600"
                data-testid={`button-remove-column-${c.code}`}
              >
                <X size={11} />
              </button>
            )}
          </Badge>
        ))}
        {editable && (
          <div className="flex items-center gap-1">
            <Select value={colToAdd} onValueChange={setColToAdd}>
              <SelectTrigger
                className="h-7 w-[220px] text-xs"
                data-testid="select-add-column"
              >
                <SelectValue placeholder="Add element column…" />
              </SelectTrigger>
              <SelectContent>
                {columnCandidates.map((e: any) => {
                  const eligible = COLUMN_METHODS.includes(e.calcMethod);
                  return (
                    <SelectItem
                      key={e.payElementUuid}
                      value={e.payElementUuid}
                      disabled={!eligible}
                      className={eligible ? "" : "opacity-50"}
                      data-testid={`option-add-column-${e.code}`}
                    >
                      {e.code} — {e.name}
                      {!eligible && (
                        <span className="ml-1 text-muted-foreground">
                          ({INELIGIBLE_HINTS[e.calcMethod] ?? "Not a scale column"})
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={addColumn}
              disabled={!colToAdd}
              data-testid="button-add-column"
            >
              <Plus size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTabId(t.id)}
            className={`flex items-center gap-1 rounded-t px-3 py-1.5 text-xs ${
              activeTabId === t.id
                ? "bg-[#16569e] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            data-testid={`tab-${t.id}`}
          >
            {tabLabel(t, rankName, natName)}
            {editable && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(t.id);
                }}
                className="ml-1 opacity-70 hover:opacity-100"
                data-testid={`button-remove-tab-${t.id}`}
              >
                <X size={11} />
              </span>
            )}
          </button>
        ))}
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setTabDialogOpen(true)}
            data-testid="button-add-tab"
          >
            <Plus size={13} className="mr-1" />
            Add ranks
          </Button>
        )}
      </div>

      {activeTab && editable && (
        <div className="mb-2 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Year steps:</Label>
          <Input
            type="number"
            min={1}
            max={40}
            value={activeTab.years}
            onChange={(e) => setActiveYears(Number(e.target.value))}
            className="h-7 w-20 text-xs"
            data-testid="input-year-steps"
          />
          <span className="text-xs text-muted-foreground">
            Paste directly from Excel into the grid cells.
          </span>
        </div>
      )}

      <div className="flex-1 min-h-[360px]">
        {activeTab ? (
          <AgGridTable
            key={`${activeTab.id}-${columns.map((c) => c.uuid).join(",")}`}
            rowData={activeRows}
            columnDefs={columnDefs}
            height="100%"
            enableSideBar={false}
            enableStatusBar={false}
            enableExport={false}
            enableRangeSelection
            onGridReady={onGridReady}
            gridOptions={{
              singleClickEdit: true,
              stopEditingWhenCellsLoseFocus: true,
              onCellValueChanged,
              getRowId: (p: any) => String(p.data.__year__),
            }}
          />
        ) : (
          <div
            className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
            data-testid="empty-matrix"
          >
            {editable
              ? "Add a rank group to start building the wage scale."
              : "This wage scale has no lines."}
          </div>
        )}
      </div>

      {/* Add-tab dialog */}
      <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add rank group</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Ranks (one column set is saved per rank)</Label>
              <div className="max-h-56 overflow-y-auto rounded border p-2 grid grid-cols-2 gap-1">
                {ranks
                  .filter((r: any) => !r.isRoleRow)
                  .map((r: any) => (
                    <label
                      key={r.crUuid ?? r.rankId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={newTabRanks.includes(r.rankId)}
                        onCheckedChange={(c) =>
                          setNewTabRanks((prev) =>
                            c === true
                              ? [...prev, r.rankId]
                              : prev.filter((x) => x !== r.rankId),
                          )
                        }
                        data-testid={`checkbox-rank-${r.rankId}`}
                      />
                      {r.rank}
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nationality variant (optional)</Label>
              <Select value={newTabNat} onValueChange={setNewTabNat}>
                <SelectTrigger className="h-9" data-testid="select-tab-nationality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All nationalities</SelectItem>
                  {nationalities.map((n: any) => (
                    <SelectItem key={n.natUuid} value={n.natUuid}>
                      {n.nationality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Year steps</Label>
              <Input
                type="number"
                min={1}
                max={40}
                value={newTabYears}
                onChange={(e) => setNewTabYears(Number(e.target.value))}
                className="h-9 w-24"
                data-testid="input-tab-years"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTabDialogOpen(false)}
              data-testid="button-cancel-tab"
            >
              Cancel
            </Button>
            <Button
              onClick={addTab}
              className="bg-[#16569e] hover:bg-[#12467f]"
              data-testid="button-confirm-tab"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floor-check dialog */}
      <Dialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              CBA floor violations
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The following scale amounts are below their CBA minimums. Review them
            before activating.
          </p>
          <div className="max-h-72 overflow-y-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-2">Rank</th>
                  <th className="p-2">Element</th>
                  <th className="p-2 text-right">Scale</th>
                  <th className="p-2 text-right">CBA min</th>
                  <th className="p-2 text-right">Deficit</th>
                  <th className="p-2">CBA</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v, i) => (
                  <tr key={i} className="border-t" data-testid={`violation-row-${i}`}>
                    <td className="p-2">{rankName.get(v.rankId) ?? v.rankId}</td>
                    <td className="p-2">
                      {v.elementCode} — {v.elementName}
                    </td>
                    <td className="p-2 text-right">
                      {formatMoney(v.scaleAmount, v.currency)}
                    </td>
                    <td className="p-2 text-right">
                      {formatMoney(v.cbaMinimum, v.currency)}
                    </td>
                    <td className="p-2 text-right text-red-600">
                      {formatMoney(v.deficit, v.currency)}
                    </td>
                    <td className="p-2">{v.cbaName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={acknowledge}
              onCheckedChange={(c) => setAcknowledge(c === true)}
              data-testid="checkbox-acknowledge"
            />
            Acknowledge violations and activate anyway
          </label>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFloorDialogOpen(false)}
              data-testid="button-cancel-activate"
            >
              Cancel
            </Button>
            <Button
              onClick={() => runActivate(true)}
              disabled={!acknowledge || activating}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-activate"
            >
              {activating ? "Activating…" : "Activate anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-200 text-slate-700",
    active: "bg-green-100 text-green-700",
    superseded: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-200"}`}
      data-testid="badge-scale-status"
    >
      {status}
    </span>
  );
}
