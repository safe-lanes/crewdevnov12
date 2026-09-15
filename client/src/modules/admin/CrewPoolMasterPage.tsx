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
import { useCrewPoolsV2, CREW_POOLS_KEY, type CrewPoolV2 } from "@/hooks/v2/useMasterDataV2";

type DialogState = { mode: "create" } | { mode: "edit"; row: CrewPoolV2 } | null;

export default function CrewPoolMasterPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, permissions } = usePermissions();
  const canAdd = permissions.length === 0 || canCreate("Masters");
  const canModify = permissions.length === 0 || canEdit("Masters");
  const canRemove = permissions.length === 0 || canDelete("Masters");

  const { data: rows = [], isLoading } = useCrewPoolsV2();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CrewPoolV2 | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [CREW_POOLS_KEY] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest("POST", CREW_POOLS_KEY, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Crew pool created" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create crew pool", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      const res = await apiRequest("PUT", `${CREW_POOLS_KEY}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Crew pool updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update crew pool", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `${CREW_POOLS_KEY}/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Crew pool deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to delete crew pool", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setName("");
    setDescription("");
    setDialog({ mode: "create" });
  };

  const openEdit = (row: CrewPoolV2) => {
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
    const data = { name: trimmed, description: description.trim() };
    if (dialog?.mode === "create") {
      createMutation.mutate(data);
    } else if (dialog?.mode === "edit") {
      updateMutation.mutate({ id: dialog.row.id, data });
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
            data-testid="button-add-crew-pool"
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
                  <TableHead className="text-xs text-white">Name</TableHead>
                  <TableHead className="text-xs text-white w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs py-6">Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs py-6" data-testid="text-no-crew-pools">
                      No crew pools found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} data-testid={`row-crew-pool-${row.id}`}>
                      <TableCell className="text-xs" data-testid={`text-crew-pool-name-${row.id}`}>
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
                              data-testid={`button-edit-crew-pool-${row.id}`}
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
                              data-testid={`button-delete-crew-pool-${row.id}`}
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
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Crew Pool" : "Add Crew Pool"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit" ? "Update the crew pool details." : "Create a new crew pool."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. Deck Pool"
                data-testid="input-crew-pool-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
                placeholder="Optional description"
                data-testid="input-crew-pool-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} data-testid="button-cancel-crew-pool-dialog">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#16569e] hover:bg-[#0f4078] text-white"
              data-testid="button-save-crew-pool"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Crew Pool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-crew-pool">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-crew-pool"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
