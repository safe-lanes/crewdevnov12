import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Check, ChevronsUpDown, FilterIcon, PlusIcon } from "lucide-react";
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import AgGridTableActions from "@/components/AgGrid/AgGridTableActions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useCompanyTrainings } from "@/hooks/useCompanyTrainings";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import { useTrainingStatusOptionsV2, withLegacyStatus, useTrainingCategoryOptionsV2, withLegacyCategory } from "@/hooks/v2/useMasterDataV2";
import { cn } from "@/lib/utils";

type AggregatedRow = {
  source: string;
  sourceRefUuid: string;
  name: string | null;
  rank: string | null;
  training: string | null;
  correspondingInDb: string | null;
  identifiedBy: string | null;
  identifiedByUuid: string | null;
  category: string | null;
  status: string | null;
  targetDate: string | null;
  comments: string | null;
  editable: "limited" | "full";
  crewMemberId: string | null;
  rankId: string | null;
};

// Row shape passed to the grid: AggregatedRow plus the resolved DB training name
// (raw correspondingInDb id is preserved for the edit dialog).
type GridRow = AggregatedRow & {
  correspondingInDbName: string | null;
};

type CompanyTrainingLookup = {
  id: string;
  name: string;
};


type CrewLookup = {
  crewUuid: string;
  empNo: string;
  firstName: string | null;
  familyName: string | null;
  presentRank: string | null;
  status: string | null;
};

type UserLookup = {
  userUuid: string | null;
  fullname: string | null;
  displayName: string | null;
  designation: string | null;
};

type FilterState = {
  searchName: string;
  source: string;
  rank: string;
  status: string;
};

const EMPTY_FILTER: FilterState = { searchName: "", source: "all", rank: "all", status: "all" };

type DialogMode =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; row: AggregatedRow };

// ----- Cell renderers (defined outside component to avoid hooks issues) -----
const sourceColor = (s: string): string => {
  if (s === "Recruitment") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
  if (s === "Appraisal") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  if (s === "Promotion") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
};

const SourceCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  const s = (params.value as string) || "";
  return <Badge className={`${sourceColor(s)} text-xs font-medium`}>{s}</Badge>;
};

type ActionsContext = {
  onEdit: (row: AggregatedRow) => void;
  onDelete: (uuid: string) => void;
};

const ActionsCellRenderer = (
  params: ICellRendererParams & { context: ActionsContext }
) => {
  if (!params.colDef || !params.data) return null;
  const r = params.data as AggregatedRow;
  return (
    <div className="flex gap-1 justify-end items-center h-full">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => params.context.onEdit(r)}
        data-testid={`button-edit-${r.sourceRefUuid}`}
      >
        <Pencil className="h-4 w-4 text-gray-500" />
      </Button>
      {r.editable === "full" && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            if (confirm("Delete this training need?")) {
              params.context.onDelete(r.sourceRefUuid);
            }
          }}
          data-testid={`button-delete-${r.sourceRefUuid}`}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      )}
    </div>
  );
};

export const Training = (): JSX.Element => {
  const { toast } = useToast();

  // Filter visibility (Filters button in header)
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Two filter states: draft = what the user is editing, applied = what filters the table.
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTER);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTER);
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });

  const { data: rows = [], isLoading } = useQuery<AggregatedRow[]>({
    queryKey: ["/api/v2/training-needs"],
  });

  // Resolve the stored numeric company-training id (correspondingInDb) to its
  // display name. The raw id is preserved on the row; only the displayed value
  // is the resolved name so sort/filter/CSV-Excel export all operate on names.
  const { options: companyTrainings, getName: getDbTrainingName } = useCompanyTrainings();
  const { statuses: statusOptions } = useTrainingStatusOptionsV2("Training & Retention");

  const { rankOptions: ranks } = useCompanyRanks();

  const { data: crew = [] } = useQuery<CrewLookup[]>({
    queryKey: ["/api/v2/crew-pool/crew"],
  });

  const { data: users = [] } = useQuery<UserLookup[]>({
    queryKey: ["/api/v2/masters/users"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (uuid: string) => {
      await apiRequest("DELETE", `/api/v2/training-needs/others/${uuid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/training-needs"] });
      toast({ title: "Deleted", description: "Training need removed." });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to delete", description: message, variant: "destructive" });
    },
  });

  const distinctSources = useMemo<string[]>(() => {
    const set = new Set<string>(["Recruitment", "Appraisal", "Promotion", "Others"]);
    rows.forEach((r) => set.add(r.source));
    return Array.from(set);
  }, [rows]);


  const filtered = useMemo<GridRow[]>(() => {
    const q = appliedFilters.searchName.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (appliedFilters.source !== "all" && r.source !== appliedFilters.source) return false;
        if (appliedFilters.rank !== "all" && (r.rank || "") !== appliedFilters.rank) return false;
        if (appliedFilters.status !== "all" && (r.status || "") !== appliedFilters.status) return false;
        if (!q) return true;
        return (r.name || "").toLowerCase().includes(q);
      })
      .map((r) => ({
        ...r,
        correspondingInDbName: r.correspondingInDb
          ? getDbTrainingName(r.correspondingInDb) ?? r.correspondingInDb
          : null,
      }));
  }, [rows, appliedFilters, getDbTrainingName]);

  const setDraft = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setDraftFilters((p) => ({ ...p, [k]: v }));

  const handleApply = () => setAppliedFilters(draftFilters);
  const handleClear = () => {
    setDraftFilters(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
  };

  // ----- AG Grid setup -----
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  const handleEditClick = useCallback(
    (row: AggregatedRow) => setDialog({ kind: "edit", row }),
    []
  );

  const handleDeleteClick = useCallback(
    (uuid: string) => deleteMutation.mutate(uuid),
    [deleteMutation]
  );

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: "S No.",
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        flex: 0.35,
        minWidth: 60,
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        sortable: false,
        filter: false,
        resizable: false,
      },
      {
        headerName: "Source",
        field: "source",
        flex: 0.7,
        cellRenderer: SourceCellRenderer,
        cellClass: "flex items-center",
        filter: "agSetColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Name",
        field: "name",
        flex: 1,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agTextColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Rank",
        field: "rank",
        flex: 0.7,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agSetColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Training",
        field: "training",
        flex: 1.2,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agTextColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Training (DB)",
        field: "correspondingInDbName",
        flex: 1.2,
        valueFormatter: (p) => p.value || (p.data?.source === "Recruitment" ? "N/A" : "-"),
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agTextColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Identified By",
        field: "identifiedBy",
        flex: 0.9,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agSetColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Category",
        field: "category",
        flex: 0.8,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agSetColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Target or Compl. Date",
        field: "targetDate",
        flex: 0.9,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agDateColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Status",
        field: "status",
        flex: 0.8,
        valueFormatter: (p) => p.value || "-",
        cellStyle: { fontSize: "13px", color: "#4f5863" },
        filter: "agSetColumnFilter",
        sortable: true,
        resizable: true,
      },
      {
        headerName: "Actions",
        field: "actions",
        flex: 0.5,
        minWidth: 90,
        cellRenderer: ActionsCellRenderer,
        cellClass: "flex items-center justify-end",
        sortable: false,
        filter: false,
        resizable: false,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col h-full" data-testid="page-training">
      {/* Header — standard SectionTitleComponents (matches Crew Database) */}
      <SectionTitleComponents title="Training Needs">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => setFiltersOpen((v) => !v)}
            data-testid="button-toggle-filters"
          >
            <FilterIcon className="h-3 w-3 mr-1" />
            Filters
          </Button>
          <Button
            className="h-8 w-32 bg-[#5dc86f] hover:bg-[#218838] text-xs text-white"
            onClick={() => setDialog({ kind: "new" })}
            data-testid="button-new-entry"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            New Entry
          </Button>
        </div>
      </SectionTitleComponents>

      {/* Filter bar — Crew-Database compact style */}
      {filtersOpen && (
        <div className="mb-4 p-3 md:p-4 pl-0 bg-[#f7fafc] rounded-lg" data-testid="filter-bar">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search Name..."
              className="h-8 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae] flex-1 min-w-[180px] max-w-[260px]"
              value={draftFilters.searchName}
              onChange={(e) => setDraft("searchName", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              data-testid="input-search-name"
            />

            <div className="shrink-0 w-[140px]">
              <Select value={draftFilters.source} onValueChange={(v) => setDraft("source", v)}>
                <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-source-filter">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {distinctSources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 w-[140px]">
              <Select value={draftFilters.rank} onValueChange={(v) => setDraft("rank", v)}>
                <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-rank-filter">
                  <SelectValue placeholder="All Ranks" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="all">All Ranks</SelectItem>
                  {ranks.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="shrink-0 w-[140px]">
              <Select value={draftFilters.status} onValueChange={(v) => setDraft("status", v)}>
                <SelectTrigger className="h-8 text-xs text-[#0f172a] placeholder:text-[#8899ae] w-full" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {withLegacyStatus(statusOptions, draftFilters.status === "all" ? undefined : draftFilters.status).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="h-8 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px] px-4 shrink-0"
              onClick={handleApply}
              data-testid="button-apply-filters"
            >
              Apply
            </Button>
            <Button
              variant="outline"
              className="h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] px-3 shrink-0"
              onClick={handleClear}
              data-testid="button-clear-filters"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* AG Grid Enterprise Table with Actions */}
      <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex flex-col flex-1">
        <CardContent className="p-4 pl-0 bg-[#f7fafc] flex flex-col flex-1">
          <AgGridTable
            rowData={filtered}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            context={{ onEdit: handleEditClick, onDelete: handleDeleteClick }}
            fillAvailableHeight={true}
            bottomPadding={80}
            width="100%"
            enableExport={true}
            enableSideBar={true}
            enableStatusBar={false}
            enableRowGrouping={true}
            enablePivoting={true}
            enableAdvancedFilter={false}
            rowSelection={false}
            theme="alpine"
          />

          {/* Footer with row count + AG Grid actions */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: "-1px" }}>
            <div className="text-xs font-normal font-['Mulish',Helvetica] text-black" data-testid="text-row-count">
              Rows: {filtered.length}
            </div>
            <div>
              <AgGridTableActions
                gridApi={gridApi}
                exportFilename="training-needs"
                showExportButtons={true}
                showFilterButtons={true}
                showGroupButtons={true}
                showSelectionButtons={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {dialog.kind !== "closed" && (
        <TrainingNeedDialog
          mode={dialog}
          onClose={() => setDialog({ kind: "closed" })}
          companyTrainings={companyTrainings}
          ranks={ranks}
          crew={crew}
          users={users}
        />
      )}
    </div>
  );
};

// ============================================================================
// Searchable Combobox for Training (DB)
// ============================================================================

type ComboboxProps = {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  showNone?: boolean;
};

function SearchableCombobox({ value, onChange, options, placeholder, disabled, testId, showNone = true }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal disabled:pointer-events-auto disabled:cursor-not-allowed"
          data-testid={testId}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder || "Select..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." data-testid={testId ? `${testId}-input` : undefined} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {showNone && (
                <CommandItem
                  value="__none"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  — None —
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Add / Edit dialog
// Layout:
//   Row 1: Name | Rank | Target or Compl. Date
//   Row 2: Training | Training (DB, searchable) | Status
//   Row 3: Identified By | Category | Source label
//   Row 4: Comments (full width)
// ============================================================================

type DialogProps = {
  mode: { kind: "new" } | { kind: "edit"; row: AggregatedRow };
  onClose: () => void;
  companyTrainings: CompanyTrainingLookup[];
  ranks: { value: string; label: string }[];
  crew: CrewLookup[];
  users: UserLookup[];
};

type FormState = {
  sourceLabel: string;
  crewMemberId: string;
  name: string;
  rank: string;
  rankId: string;
  training: string;
  correspondingInDb: string;
  identifiedByUuid: string;
  category: string;
  status: string;
  targetDate: string;
  comments: string;
};

function TrainingNeedDialog({ mode, onClose, companyTrainings, ranks, crew, users }: DialogProps) {
  const { toast } = useToast();
  const { statuses: statusOptions } = useTrainingStatusOptionsV2("Training & Retention");
  const { categories: categoryOptions } = useTrainingCategoryOptionsV2("Training & Retention");
  const isNew = mode.kind === "new";
  const row = mode.kind === "edit" ? mode.row : null;
  const isLimited = !!row && row.editable === "limited";

  const [form, setForm] = useState<FormState>({
    sourceLabel: row?.source || "Others",
    // Preserve linkage fields on edit so PATCH does not null them
    crewMemberId: row?.crewMemberId || "",
    name: row?.name || "",
    rank: row?.rank || "",
    rankId: row?.rankId || "",
    training: row?.training || "",
    correspondingInDb: row?.correspondingInDb || "",
    identifiedByUuid: row?.identifiedByUuid || "",
    category: row?.category || "",
    status: row?.status || "",
    targetDate: row?.targetDate || "",
    comments: row?.comments || "",
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const trainingDbOptions = useMemo(
    () => companyTrainings.map((t) => ({ value: t.id, label: t.name })),
    [companyTrainings]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        await apiRequest("POST", "/api/v2/training-needs/others", {
          sourceLabel: form.sourceLabel || "Others",
          crewMemberId: form.crewMemberId || null,
          name: form.name || null,
          rank: form.rank || null,
          rankId: form.rankId || null,
          training: form.training || null,
          correspondingInDb: form.correspondingInDb || null,
          identifiedByUuid: form.identifiedByUuid || null,
          category: form.category || null,
          status: form.status || null,
          targetDate: form.targetDate || null,
          comments: form.comments || null,
        });
      } else if (row && row.editable === "full") {
        await apiRequest("PATCH", `/api/v2/training-needs/others/${row.sourceRefUuid}`, {
          sourceLabel: form.sourceLabel || "Others",
          crewMemberId: form.crewMemberId || null,
          name: form.name || null,
          rank: form.rank || null,
          rankId: form.rankId || null,
          training: form.training || null,
          correspondingInDb: form.correspondingInDb || null,
          identifiedByUuid: form.identifiedByUuid || null,
          category: form.category || null,
          status: form.status || null,
          targetDate: form.targetDate || null,
          comments: form.comments || null,
        });
      } else if (row) {
        const sourceKey =
          row.source === "Recruitment" ? "recruitment" :
          row.source === "Appraisal" ? "appraisal" :
          row.source === "Promotion" ? "promotion" : null;
        if (!sourceKey) throw new Error("Unknown source");

        // All three sourced types accept Status, Target/Compl. Date, Comments and
        // Training (in DB). Server persists fields the source table can hold and
        // overlays the rest — this never touches the original "Training" name.
        await apiRequest("PATCH", `/api/v2/training-needs/source/${sourceKey}/${row.sourceRefUuid}`, {
          status: form.status || null,
          targetDate: form.targetDate || null,
          comments: form.comments || null,
          correspondingInDb: form.correspondingInDb || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/training-needs"] });
      toast({ title: "Saved", description: "Training need saved." });
      onClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" data-testid="dialog-training-need">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Add New Training" : `Edit Training (${row?.source})`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-2">
          {/* Row 1: Name | Rank | Target or Compl. Date */}
          <div>
            <Label className="text-xs">Name</Label>
            {isLimited ? (
              <Input value={form.name} disabled data-testid="input-name" />
            ) : (
              <SearchableCombobox
                value={form.crewMemberId || "__manual"}
                onChange={(v) => {
                  if (v === "__manual") {
                    set("crewMemberId", "");
                    set("name", "");
                    return;
                  }
                  const c = crew.find((x) => x.empNo === v);
                  if (c) {
                    set("crewMemberId", c.empNo);
                    set("name", `${c.firstName || ""} ${c.familyName || ""}`.trim());
                    set("rank", c.presentRank || "");
                  }
                }}
                options={[
                  { value: "__manual", label: "— Enter manually —" },
                  ...crew
                    .filter(
                      (c) =>
                        (c.status || "").toLowerCase() !== "terminated" ||
                        c.empNo === form.crewMemberId
                    )
                    .map((c) => ({
                      value: c.empNo,
                      label: `${`${c.firstName || ""} ${c.familyName || ""}`.trim()} (${c.empNo})`,
                    })),
                ]}
                placeholder="Search crew..."
                showNone={false}
                testId="select-name"
              />
            )}
          </div>

          <div>
            <Label className="text-xs">Rank</Label>
            {isLimited ? (
              <Input value={form.rank} disabled data-testid="input-rank" />
            ) : (
              <Select
                value={form.rank || undefined}
                onValueChange={(v) => {
                  if (v === "__none") {
                    set("rankId", "");
                    set("rank", "");
                    return;
                  }
                  set("rankId", "");
                  set("rank", v);
                }}
              >
                <SelectTrigger data-testid="select-rank"><SelectValue placeholder="Select Rank" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none">— None —</SelectItem>
                  {ranks.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs">Target or Compl. Date</Label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) => set("targetDate", e.target.value)}
              data-testid="input-target-date"
            />
          </div>

          {/* Manual name field — appears only when not bound to a crew member */}
          {!isLimited && !form.crewMemberId && (
            <div className="col-span-3">
              <Label className="text-xs">Name (manual)</Label>
              <Input
                placeholder="Type a name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                data-testid="input-name-manual"
              />
            </div>
          )}

          {/* Row 2: Training | Training (DB, searchable) | Status */}
          <div>
            <Label className="text-xs">Training</Label>
            <Input
              value={form.training}
              onChange={(e) => set("training", e.target.value)}
              disabled={isLimited}
              data-testid="input-training"
            />
          </div>

          <div>
            <Label className="text-xs">Training (in DB)</Label>
            {isLimited ? (
              <Input
                value={(row as any)?.correspondingInDbName || row?.correspondingInDb || ""}
                disabled
                data-testid="input-training-db"
              />
            ) : (
              <SearchableCombobox
                value={form.correspondingInDb}
                onChange={(v) => set("correspondingInDb", v)}
                options={trainingDbOptions}
                placeholder="Search trainings..."
                testId="combobox-training-db"
              />
            )}
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={form.status || undefined}
              onValueChange={(v) => set("status", v === "__none" ? "" : v)}
            >
              <SelectTrigger data-testid="select-status"><SelectValue placeholder="Select Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {withLegacyStatus(statusOptions, form.status).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Identified By | Category | Source label */}
          <div>
            <Label className="text-xs">Identified By</Label>
            {isLimited ? (
              <Input value={row?.identifiedBy || ""} disabled data-testid="input-identified-by" />
            ) : (
              <Select
                value={form.identifiedByUuid || "__none"}
                onValueChange={(v) => set("identifiedByUuid", v === "__none" ? "" : v)}
              >
                <SelectTrigger data-testid="select-identified-by">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none">Select Person</SelectItem>
                  {form.identifiedByUuid &&
                    !users.some((u) => u.userUuid === form.identifiedByUuid) && row?.identifiedBy && (
                      <SelectItem value={form.identifiedByUuid}>{row.identifiedBy}</SelectItem>
                    )}
                  {users
                    .filter((u) => u.userUuid && (u.fullname || u.displayName))
                    .map((u) => {
                      const label = u.fullname || u.displayName || "";
                      return (
                        <SelectItem key={u.userUuid!} value={u.userUuid!}>
                          {u.designation ? `${label}, ${u.designation}` : label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <Select
              value={form.category || undefined}
              onValueChange={(v) => set("category", v === "__none" ? "" : v)}
              disabled={isLimited}
            >
              <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {withLegacyCategory(categoryOptions, form.category).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Source</Label>
            <Input
              value={form.sourceLabel}
              onChange={(e) => set("sourceLabel", e.target.value)}
              disabled={isLimited}
              placeholder="Others / Supt Visit / ..."
              data-testid="input-source-label"
            />
          </div>

          {/* Row 4: Comments (full width) */}
          <div className="col-span-3">
            <Label className="text-xs">Comments</Label>
            <Textarea
              value={form.comments}
              onChange={(e) => set("comments", e.target.value)}
              rows={3}
              data-testid="input-comments"
            />
          </div>
        </div>

        {isLimited && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This row is sourced from {row?.source}. Only Status, Target / Compl. Date
            and Comments are editable here — they are written back to
            the source record. Other fields must be edited at the source.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-[#16569e] hover:bg-[#114a87] text-white"
            data-testid="button-save"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
