import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, SlidersHorizontal, Check, ChevronsUpDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { cn } from "@/lib/utils";

type AggregatedRow = {
  source: string;
  sourceRefUuid: string;
  name: string | null;
  rank: string | null;
  training: string | null;
  correspondingInDb: string | null;
  identifiedBy: string | null;
  category: string | null;
  status: string | null;
  targetDate: string | null;
  comments: string | null;
  editable: "limited" | "full";
  crewMemberId: string | null;
  rankId: string | null;
};

type CompanyTrainingLookup = {
  ctUuid: string;
  trainingLabel: string;
};

type RankLookup = {
  id: number;
  arUuid: string;
  rankId: string | null;
  name: string;
};

type CrewLookup = {
  crewUuid: string;
  empNo: string;
  firstName: string | null;
  familyName: string | null;
  presentRank: string | null;
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

const STATUS_OPTIONS = ["Pending", "Scheduled", "In Progress", "Completed", "Cancelled"];
const CATEGORY_OPTIONS = ["Mandatory", "Recommended", "Optional", "Other"];

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

  const { data: companyTrainings = [] } = useQuery<CompanyTrainingLookup[]>({
    queryKey: ["/api/v2/admin/company-trainings"],
  });

  const { data: ranks = [] } = useQuery<RankLookup[]>({
    queryKey: ["/api/v2/admin/available-ranks"],
  });

  const { data: crew = [] } = useQuery<CrewLookup[]>({
    queryKey: ["/api/v2/crew-pool/crew"],
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

  const distinctRanks = useMemo<string[]>(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.rank) set.add(r.rank);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = appliedFilters.searchName.trim().toLowerCase();
    return rows.filter((r) => {
      if (appliedFilters.source !== "all" && r.source !== appliedFilters.source) return false;
      if (appliedFilters.rank !== "all" && (r.rank || "") !== appliedFilters.rank) return false;
      if (appliedFilters.status !== "all" && (r.status || "") !== appliedFilters.status) return false;
      if (!q) return true;
      return (r.name || "").toLowerCase().includes(q);
    });
  }, [rows, appliedFilters]);

  const sourceColor = (s: string): string => {
    if (s === "Recruitment") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    if (s === "Appraisal") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    if (s === "Promotion") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
  };

  const setDraft = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setDraftFilters((p) => ({ ...p, [k]: v }));

  const handleApply = () => setAppliedFilters(draftFilters);
  const handleClear = () => {
    setDraftFilters(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
  };

  return (
    <div className="flex w-full h-[calc(100vh-67px)]" data-testid="page-training">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — title, Filters button, + New Entry */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gray-900">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100" data-testid="text-page-title">
              Training Needs
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Aggregated from Recruitment, Appraisal, Promotion and Others
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setFiltersOpen((v) => !v)}
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button
              onClick={() => setDialog({ kind: "new" })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-new-entry"
            >
              <Plus className="h-4 w-4 mr-2" /> New Entry
            </Button>
          </div>
        </div>

        {/* Filter bar — Search Name, Source, Rank, Status, Apply, Clear */}
        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-b bg-gray-50 dark:bg-gray-800/40" data-testid="filter-bar">
            <div className="flex-1 min-w-[220px] max-w-md">
              <Label className="text-xs text-gray-600 dark:text-gray-300">Search Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Crew name..."
                  className="pl-9"
                  value={draftFilters.searchName}
                  onChange={(e) => setDraft("searchName", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
                  data-testid="input-search-name"
                />
              </div>
            </div>

            <div className="w-[180px]">
              <Label className="text-xs text-gray-600 dark:text-gray-300">Source</Label>
              <Select value={draftFilters.source} onValueChange={(v) => setDraft("source", v)}>
                <SelectTrigger data-testid="select-source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {distinctSources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[180px]">
              <Label className="text-xs text-gray-600 dark:text-gray-300">Rank</Label>
              <Select value={draftFilters.rank} onValueChange={(v) => setDraft("rank", v)}>
                <SelectTrigger data-testid="select-rank-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="all">All Ranks</SelectItem>
                  {distinctRanks.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[180px]">
              <Label className="text-xs text-gray-600 dark:text-gray-300">Status</Label>
              <Select value={draftFilters.status} onValueChange={(v) => setDraft("status", v)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleApply}
              className="bg-[#16569e] hover:bg-[#114a87] text-white"
              data-testid="button-apply-filters"
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              data-testid="button-clear-filters"
            >
              Clear
            </Button>

            <div className="text-xs text-gray-500 ml-auto self-end" data-testid="text-row-count">
              {filtered.length} of {rows.length}
            </div>
          </div>
        )}

        {/* Table — column order per spec ends with Target/Compl. Date, Status, Actions */}
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-xs uppercase text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left w-12">S No.</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Training</th>
                <th className="px-3 py-2 text-left">Training (DB)</th>
                <th className="px-3 py-2 text-left">Identified By</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Target or Compl. Date</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">Loading...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400" data-testid="text-empty">No training needs found.</td></tr>
              )}
              {filtered.map((r, idx) => (
                <tr
                  key={`${r.source}-${r.sourceRefUuid}`}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  data-testid={`row-need-${r.sourceRefUuid}`}
                >
                  <td className="px-3 py-2 text-gray-500" data-testid={`text-sno-${r.sourceRefUuid}`}>{idx + 1}</td>
                  <td className="px-3 py-2">
                    <Badge className={`${sourceColor(r.source)} text-xs font-medium`}>{r.source}</Badge>
                  </td>
                  <td className="px-3 py-2" data-testid={`text-name-${r.sourceRefUuid}`}>{r.name || "-"}</td>
                  <td className="px-3 py-2">{r.rank || "-"}</td>
                  <td className="px-3 py-2">{r.training || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.correspondingInDb || "-"}</td>
                  <td className="px-3 py-2">{r.identifiedBy || "-"}</td>
                  <td className="px-3 py-2">{r.category || "-"}</td>
                  <td className="px-3 py-2">{r.targetDate || "-"}</td>
                  <td className="px-3 py-2">{r.status || "-"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDialog({ kind: "edit", row: r })}
                      data-testid={`button-edit-${r.sourceRefUuid}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.editable === "full" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this training need?")) {
                            deleteMutation.mutate(r.sourceRefUuid);
                          }
                        }}
                        data-testid={`button-delete-${r.sourceRefUuid}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right vertical static tabs */}
      <div className="w-12 border-l bg-gray-50 dark:bg-gray-800/40 flex flex-col items-center pt-4 gap-2">
        <div className="rotate-180 [writing-mode:vertical-rl] text-xs font-medium text-gray-600 dark:text-gray-300 px-1 py-2 cursor-default" data-testid="tab-columns">
          Columns
        </div>
        <div className="rotate-180 [writing-mode:vertical-rl] text-xs font-medium text-gray-600 dark:text-gray-300 px-1 py-2 cursor-default" data-testid="tab-filters">
          Filters
        </div>
      </div>

      {dialog.kind !== "closed" && (
        <TrainingNeedDialog
          mode={dialog}
          onClose={() => setDialog({ kind: "closed" })}
          companyTrainings={companyTrainings}
          ranks={ranks}
          crew={crew}
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
};

function SearchableCombobox({ value, onChange, options, placeholder, disabled, testId }: ComboboxProps) {
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
          className="w-full justify-between font-normal"
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
  ranks: RankLookup[];
  crew: CrewLookup[];
};

type FormState = {
  sourceLabel: string;
  crewMemberId: string;
  name: string;
  rank: string;
  rankId: string;
  training: string;
  correspondingInDb: string;
  identifiedBy: string;
  category: string;
  status: string;
  targetDate: string;
  comments: string;
};

function TrainingNeedDialog({ mode, onClose, companyTrainings, ranks, crew }: DialogProps) {
  const { toast } = useToast();
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
    identifiedBy: row?.identifiedBy || "",
    category: row?.category || "",
    status: row?.status || "",
    targetDate: row?.targetDate || "",
    comments: row?.comments || "",
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const trainingDbOptions = useMemo(
    () => companyTrainings.map((t) => ({ value: t.trainingLabel, label: t.trainingLabel })),
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
          identifiedBy: form.identifiedBy || null,
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
          identifiedBy: form.identifiedBy || null,
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

        // All three sourced types persist Status, Target/Compl. Date and Comments
        await apiRequest("PATCH", `/api/v2/training-needs/source/${sourceKey}/${row.sourceRefUuid}`, {
          status: form.status || null,
          targetDate: form.targetDate || null,
          comments: form.comments || null,
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
              <Select
                value={form.crewMemberId || "__manual"}
                onValueChange={(v) => {
                  if (v === "__manual") {
                    set("crewMemberId", "");
                    return;
                  }
                  const c = crew.find((x) => x.empNo === v);
                  if (c) {
                    set("crewMemberId", c.empNo);
                    set("name", `${c.firstName || ""} ${c.familyName || ""}`.trim());
                    set("rank", c.presentRank || "");
                  }
                }}
              >
                <SelectTrigger data-testid="select-name"><SelectValue placeholder="Select crew" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__manual">— Enter manually —</SelectItem>
                  {crew.map((c) => (
                    <SelectItem key={c.empNo} value={c.empNo}>
                      {`${c.firstName || ""} ${c.familyName || ""}`.trim()} ({c.empNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs">Rank</Label>
            {isLimited ? (
              <Input value={form.rank} disabled data-testid="input-rank" />
            ) : (
              <Select
                value={form.rankId || form.rank || "__none"}
                onValueChange={(v) => {
                  if (v === "__none") {
                    set("rankId", "");
                    set("rank", "");
                    return;
                  }
                  const r = ranks.find((x) => (x.rankId || x.name) === v);
                  set("rankId", r?.rankId || "");
                  set("rank", r?.name || v);
                }}
              >
                <SelectTrigger data-testid="select-rank"><SelectValue placeholder="Select rank" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none">— None —</SelectItem>
                  {ranks.map((r) => (
                    <SelectItem key={r.arUuid} value={r.rankId || r.name}>{r.name}</SelectItem>
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
            <SearchableCombobox
              value={form.correspondingInDb}
              onChange={(v) => set("correspondingInDb", v)}
              options={trainingDbOptions}
              placeholder="Search trainings..."
              disabled={isLimited}
              testId="combobox-training-db"
            />
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={form.status || "__none"}
              onValueChange={(v) => set("status", v === "__none" ? "" : v)}
            >
              <SelectTrigger data-testid="select-status"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Identified By | Category | Source label */}
          <div>
            <Label className="text-xs">Identified By</Label>
            <Input
              value={form.identifiedBy}
              onChange={(e) => set("identifiedBy", e.target.value)}
              disabled={isLimited}
              data-testid="input-identified-by"
            />
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <Select
              value={form.category || "__none"}
              onValueChange={(v) => set("category", v === "__none" ? "" : v)}
              disabled={isLimited}
            >
              <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
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
            This row is sourced from {row?.source}. Only Status, Target / Compl. Date and Comments
            are editable here — they are written back to the source record. Other fields must be
            edited at the source.
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
