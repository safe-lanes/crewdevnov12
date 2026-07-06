import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCrewUserId } from "@/lib/crewUser";
import {
  useTrainingStatusesV2,
  TRAINING_STATUSES_KEY,
  type TrainingStatusV2,
} from "@/hooks/v2/useMasterDataV2";

const MODULES = ["Promotion", "Appraisal", "Training & Retention"] as const;

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; originalLabel: string; modules: string[] }
  | null;

export default function TrainingStatusPage() {
  const { toast } = useToast();
  const { data: statuses = [], isLoading } = useTrainingStatusesV2();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [label, setLabel] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TrainingStatusV2 | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [TRAINING_STATUSES_KEY] });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; modules: string[] }) => {
      const res = await apiRequest("POST", TRAINING_STATUSES_KEY, {
        ...data,
        auditUserUuid: getCrewUserId(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Training status created" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create status", description: e.message, variant: "destructive" }),
  });

  const groupUpdateMutation = useMutation({
    mutationFn: async (data: { originalLabel: string; label: string; modules: string[] }) => {
      const res = await apiRequest("PUT", `${TRAINING_STATUSES_KEY}/group`, {
        ...data,
        auditUserUuid: getCrewUserId(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Training status updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ mtsUuid, isActive }: { mtsUuid: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `${TRAINING_STATUSES_KEY}/${mtsUuid}`, {
        isActive,
        auditUserUuid: getCrewUserId(),
      });
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mtsUuid: string) => {
      const res = await apiRequest(
        "DELETE",
        `${TRAINING_STATUSES_KEY}/${mtsUuid}?auditUserUuid=${encodeURIComponent(getCrewUserId() || "")}`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Training status deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to delete status", description: e.message, variant: "destructive" }),
  });

  const filteredRows = useMemo(() => {
    return [...statuses].sort(
      (a, b) =>
        a.module.localeCompare(b.module) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.label.localeCompare(b.label),
    );
  }, [statuses]);

  const openCreate = () => {
    setLabel("");
    setSelectedModules([]);
    setDialog({ mode: "create" });
  };

  const openEdit = (row: TrainingStatusV2) => {
    const modules = statuses.filter((s) => s.label === row.label).map((s) => s.module);
    setLabel(row.label);
    setSelectedModules(modules);
    setDialog({ mode: "edit", originalLabel: row.label, modules });
  };

  const toggleModule = (m: string, checked: boolean) => {
    setSelectedModules((prev) => (checked ? [...prev, m] : prev.filter((x) => x !== m)));
  };

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast({ title: "Status label is required", variant: "destructive" });
      return;
    }
    if (dialog?.mode === "create") {
      if (selectedModules.length === 0) {
        toast({ title: "Select at least one module", variant: "destructive" });
        return;
      }
      createMutation.mutate({ label: trimmed, modules: selectedModules });
    } else if (dialog?.mode === "edit") {
      groupUpdateMutation.mutate({
        originalLabel: dialog.originalLabel,
        label: trimmed,
        modules: selectedModules,
      });
    }
  };

  const isSaving = createMutation.isPending || groupUpdateMutation.isPending;

  return (
    <div>
      <Card>
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                <TableHead className="text-xs text-white">Status</TableHead>
                <TableHead className="text-xs text-white">Module</TableHead>
                <TableHead className="text-xs text-white">Active</TableHead>
                <TableHead className="text-xs text-white w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs py-6">Loading...</TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs py-6" data-testid="text-no-statuses">
                    No training statuses found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.mtsUuid} data-testid={`row-training-status-${row.mtsUuid}`}>
                    <TableCell className="text-xs" data-testid={`text-status-label-${row.mtsUuid}`}>
                      {row.label}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[11px]">{row.module}</Badge>
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={row.isActive}
                        disabled={toggleActiveMutation.isPending}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ mtsUuid: row.mtsUuid, isActive: checked === true })
                        }
                        data-testid={`checkbox-status-active-${row.mtsUuid}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openEdit(row)}
                          data-testid={`button-edit-status-${row.mtsUuid}`}
                        >
                          <Pencil className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setDeleteTarget(row)}
                          data-testid={`button-delete-status-${row.mtsUuid}`}
                        >
                          <Trash2 className="h-4 w-4 text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={openCreate}
                          data-testid={`button-add-status-${row.mtsUuid}`}
                        >
                          <Plus className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit Training Status" : "Add Training Status"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? "Rename the status or change its module assignments. Deselecting a module removes the status from that module."
                : "Selecting multiple modules creates the status independently in each module."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Status Label *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. Planned"
                data-testid="input-status-label"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Modules *</Label>
              <div className="space-y-2">
                {MODULES.map((m) => (
                  <div key={m} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedModules.includes(m)}
                      onCheckedChange={(checked) => toggleModule(m, checked === true)}
                      data-testid={`checkbox-module-${m.replace(/[^a-zA-Z]+/g, "-").toLowerCase()}`}
                    />
                    <span className="text-xs">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              data-testid="button-cancel-status-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#16569e] hover:bg-[#0f4078] text-white"
              data-testid="button-save-status"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.label}" from {deleteTarget?.module}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-status">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.mtsUuid)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-status"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
