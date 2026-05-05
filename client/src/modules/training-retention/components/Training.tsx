import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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
};

type DialogMode =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; row: AggregatedRow };

const STATUS_OPTIONS = ["Pending", "Scheduled", "In Progress", "Completed", "Cancelled"];
const CATEGORY_OPTIONS = ["Mandatory", "Recommended", "Optional", "Other"];

export const Training = (): JSX.Element => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<DialogMode>({ kind: "closed" });

  const { data: rows = [], isLoading } = useQuery<AggregatedRow[]>({
    queryKey: ["/api/v2/training-needs"],
  });

  const { data: companyTrainings = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/company-trainings"],
  });

  const { data: ranks = [] } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/available-ranks"],
  });

  const { data: crew = [] } = useQuery<any[]>({
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
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (statusFilter !== "all" && (r.status || "") !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.rank || "").toLowerCase().includes(q) ||
        (r.training || "").toLowerCase().includes(q) ||
        (r.correspondingInDb || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, sourceFilter, statusFilter]);

  const sourceColor = (s: string) => {
    if (s === "Recruitment") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    if (s === "Appraisal") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    if (s === "Promotion") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200";
  };

  return (
    <div className="flex w-full h-[calc(100vh-67px)]" data-testid="page-training">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gray-900">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100" data-testid="text-page-title">
              Training Needs
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Aggregated from Recruitment, Appraisal, Promotion and Others
            </p>
          </div>
          <Button
            onClick={() => setDialog({ kind: "new" })}
            className="bg-[#16569e] hover:bg-[#114a87] text-white"
            data-testid="button-new-entry"
          >
            <Plus className="h-4 w-4 mr-2" /> New Entry
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-gray-50 dark:bg-gray-800/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search name, rank, training..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="Recruitment">Recruitment</SelectItem>
              <SelectItem value="Appraisal">Appraisal</SelectItem>
              <SelectItem value="Promotion">Promotion</SelectItem>
              <SelectItem value="Others">Others</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-gray-500 ml-auto" data-testid="text-row-count">
            {filtered.length} of {rows.length}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-xs uppercase text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Training</th>
                <th className="px-3 py-2 text-left">Training (DB)</th>
                <th className="px-3 py-2 text-left">Identified By</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Target Date</th>
                <th className="px-3 py-2 text-left">Comments</th>
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
              {filtered.map((r) => (
                <tr
                  key={`${r.source}-${r.sourceRefUuid}`}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  data-testid={`row-need-${r.sourceRefUuid}`}
                >
                  <td className="px-3 py-2">
                    <Badge className={`${sourceColor(r.source)} text-xs font-medium`}>{r.source}</Badge>
                  </td>
                  <td className="px-3 py-2" data-testid={`text-name-${r.sourceRefUuid}`}>{r.name || "-"}</td>
                  <td className="px-3 py-2">{r.rank || "-"}</td>
                  <td className="px-3 py-2">{r.training || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.correspondingInDb || "-"}</td>
                  <td className="px-3 py-2">{r.identifiedBy || "-"}</td>
                  <td className="px-3 py-2">{r.category || "-"}</td>
                  <td className="px-3 py-2">{r.status || "-"}</td>
                  <td className="px-3 py-2">{r.targetDate || "-"}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={r.comments || ""}>{r.comments || "-"}</td>
                  <td className="px-3 py-2 text-right">
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
// Dialog (handles both New and Edit)
// ============================================================================

type DialogProps = {
  mode: { kind: "new" } | { kind: "edit"; row: AggregatedRow };
  onClose: () => void;
  companyTrainings: any[];
  ranks: any[];
  crew: any[];
};

function TrainingNeedDialog({ mode, onClose, companyTrainings, ranks, crew }: DialogProps) {
  const { toast } = useToast();
  const isNew = mode.kind === "new";
  const row = mode.kind === "edit" ? mode.row : null;
  const isLimited = !!row && row.editable === "limited";

  const [form, setForm] = useState({
    crewMemberId: "",
    name: row?.name || "",
    rank: row?.rank || "",
    rankId: "",
    training: row?.training || "",
    correspondingInDb: row?.correspondingInDb || "",
    identifiedBy: row?.identifiedBy || "",
    category: row?.category || "",
    status: row?.status || "",
    targetDate: row?.targetDate || "",
    comments: row?.comments || "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        await apiRequest("POST", "/api/v2/training-needs/others", {
          sourceLabel: "Others",
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
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="dialog-training-need">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "New Training Need" : `Edit Training Need (${row?.source})`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Name */}
          <div className="col-span-1">
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
                  const c = crew.find((x: any) => x.empNo === v || x.crewUuid === v);
                  if (c) {
                    set("crewMemberId", c.empNo || c.crewUuid);
                    set("name", `${c.firstName || ""} ${c.familyName || ""}`.trim());
                    set("rank", c.presentRank || "");
                  }
                }}
              >
                <SelectTrigger data-testid="select-name"><SelectValue placeholder="Select crew member" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__manual">— Enter manually —</SelectItem>
                  {crew.map((c: any) => (
                    <SelectItem key={c.empNo || c.crewUuid} value={c.empNo || c.crewUuid}>
                      {`${c.firstName || ""} ${c.familyName || ""}`.trim()} ({c.empNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isLimited && !form.crewMemberId && (
              <Input
                className="mt-2"
                placeholder="Or type a name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                data-testid="input-name-manual"
              />
            )}
          </div>

          {/* Rank */}
          <div className="col-span-1">
            <Label className="text-xs">Rank</Label>
            {isLimited ? (
              <Input value={form.rank} disabled data-testid="input-rank" />
            ) : (
              <Select
                value={form.rankId || form.rank || "__none"}
                onValueChange={(v) => {
                  if (v === "__none") return;
                  const r = ranks.find((x: any) => x.rankId === v || x.name === v);
                  set("rankId", r?.rankId || v);
                  set("rank", r?.name || v);
                }}
              >
                <SelectTrigger data-testid="select-rank"><SelectValue placeholder="Select rank" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none">— None —</SelectItem>
                  {ranks.map((r: any) => (
                    <SelectItem key={r.id || r.arUuid} value={r.rankId || r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Training (free text) */}
          <div className="col-span-1">
            <Label className="text-xs">Training</Label>
            <Input
              value={form.training}
              onChange={(e) => set("training", e.target.value)}
              disabled={isLimited}
              data-testid="input-training"
            />
          </div>

          {/* Training (DB) */}
          <div className="col-span-1">
            <Label className="text-xs">Training (in DB)</Label>
            {isLimited ? (
              <Input value={form.correspondingInDb} disabled data-testid="input-training-db" />
            ) : (
              <Select
                value={form.correspondingInDb || "__none"}
                onValueChange={(v) => set("correspondingInDb", v === "__none" ? "" : v)}
              >
                <SelectTrigger data-testid="select-training-db"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none">— None —</SelectItem>
                  {companyTrainings.map((t: any) => (
                    <SelectItem key={t.ctUuid} value={t.trainingLabel}>{t.trainingLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Identified By */}
          <div className="col-span-1">
            <Label className="text-xs">Identified By</Label>
            <Input
              value={form.identifiedBy}
              onChange={(e) => set("identifiedBy", e.target.value)}
              disabled={isLimited}
              data-testid="input-identified-by"
            />
          </div>

          {/* Category */}
          <div className="col-span-1">
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

          {/* Status — editable for all */}
          <div className="col-span-1">
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

          {/* Target Date — editable for all */}
          <div className="col-span-1">
            <Label className="text-xs">Target Date</Label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) => set("targetDate", e.target.value)}
              data-testid="input-target-date"
            />
          </div>

          {/* Comments — editable for all */}
          <div className="col-span-2">
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
            This row comes from {row?.source}. Only Status, Target Date and Comments can be edited here.
            {row?.source === "Recruitment" && " (Recruitment source has no Status field — Status changes will not be saved.)"}
            {row?.source === "Promotion" && " (Promotion source has no Comments field — Comments will not be saved.)"}
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
