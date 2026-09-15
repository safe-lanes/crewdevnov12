import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAppraisalTypesV2, APPRAISAL_TYPES_KEY, type AppraisalTypeV2 } from "@/hooks/v2/useMasterDataV2";

type DialogState = { mode: "create" } | { mode: "edit"; row: AppraisalTypeV2 } | null;

export default function AppraisalTypeMasterPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, permissions } = usePermissions();
  const canAdd = permissions.length === 0 || canCreate("Masters");
  const canModify = permissions.length === 0 || canEdit("Masters");
  const canRemove = permissions.length === 0 || canDelete("Masters");

  const { data: rows = [], isLoading } = useAppraisalTypesV2();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [entryId, setEntryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppraisalTypeV2 | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [APPRAISAL_TYPES_KEY] });

  const createMutation = useMutation({
    mutationFn: async (data: { entryId?: string; name: string; description: string }) => {
      const res = await apiRequest("POST", APPRAISAL_TYPES_KEY, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Appraisal type created" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create appraisal type", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      const res = await apiRequest("PUT", `${APPRAISAL_TYPES_KEY}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Appraisal type updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update appraisal type", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `${APPRAISAL_TYPES_KEY}/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Appraisal type deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to delete appraisal type", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEntryId("");
    setName("");
    setDescription("");
    setDialog({ mode: "create" });
  };

  const openEdit = (row: AppraisalTypeV2) => {
    setEntryId(row.entryId);
    setName(row.name);
    setDescription(row.description ?? "");
    setDialog({ mode: "edit", row });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (dialog?.mode === "create") {
      const trimmedEntryId = entryId.trim();
      createMutation.mutate({
        ...(trimmedEntryId ? { entryId: trimmedEntryId } : {}),
        name: trimmed,
        description: description.trim(),
      });
    } else if (dialog?.mode === "edit") {
      updateMutation.mutate({ id: dialog.row.id, data: { name: trimmed, description: description.trim() } });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex justify-end mb-2">
        {canAdd && (
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 text-xs bg-[#52baf3] hover:bg-[#3aa8e0] text-white"
            data-testid="button-add-appraisal-type"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <TableHead className="text-xs text-white">Entry ID</TableHead>
                  <TableHead className="text-xs text-white">Name</TableHead>
                  <TableHead className="text-xs text-white w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs py-6">Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs py-6" data-testid="text-no-appraisal-types">
                      No appraisal types found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} data-testid={`row-appraisal-type-${row.id}`}>
                      <TableCell className="text-xs text-gray-500" data-testid={`text-appraisal-type-entry-id-${row.id}`}>
                        {row.entryId}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-appraisal-type-name-${row.id}`}>
                        {row.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openEdit(row)}
                              data-testid={`button-edit-appraisal-type-${row.id}`}
                            >
                              <Pencil className="h-4 w-4 text-gray-500" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setDeleteTarget(row)}
                              data-testid={`button-delete-appraisal-type-${row.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-gray-500" />
                            </Button>
                          )}
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
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Appraisal Type" : "Add Appraisal Type"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit" ? "Update the appraisal type details." : "Create a new appraisal type."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Entry ID</Label>
              <Input
                value={entryId}
                onChange={(e) => setEntryId(e.target.value)}
                className="h-8 text-xs"
                placeholder={dialog?.mode === "edit" ? undefined : "Auto-generated if left blank"}
                disabled={dialog?.mode === "edit"}
                data-testid="input-appraisal-type-entry-id"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. Mid Term"
                data-testid="input-appraisal-type-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
                placeholder="Optional description"
                data-testid="input-appraisal-type-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} data-testid="button-cancel-appraisal-type-dialog">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#16569e] hover:bg-[#0f4078] text-white"
              data-testid="button-save-appraisal-type"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appraisal Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-appraisal-type">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-appraisal-type"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
