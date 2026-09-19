import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useTravelDocumentTypesV2,
  TRAVEL_DOCUMENT_TYPES_KEY,
  type TravelDocumentTypeV2,
} from "@/hooks/v2/useMasterDataV2";

type DialogState = { mode: "create" } | { mode: "edit"; row: TravelDocumentTypeV2 } | null;

export default function TravelDocumentTypeMasterPage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, permissions } = usePermissions();
  const canAdd = permissions.length === 0 || canCreate("Masters");
  const canModify = permissions.length === 0 || canEdit("Masters");
  const canRemove = permissions.length === 0 || canDelete("Masters");

  const { data: rows = [], isLoading } = useTravelDocumentTypesV2();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<TravelDocumentTypeV2 | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [TRAVEL_DOCUMENT_TYPES_KEY] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", TRAVEL_DOCUMENT_TYPES_KEY, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Document type created" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create document type", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ mtdtUuid, data }: { mtdtUuid: string; data: { name: string; isActive: boolean } }) => {
      const res = await apiRequest("PUT", `${TRAVEL_DOCUMENT_TYPES_KEY}/${mtdtUuid}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialog(null);
      toast({ title: "Document type updated" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to update document type", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mtdtUuid: string) => {
      const res = await apiRequest("DELETE", `${TRAVEL_DOCUMENT_TYPES_KEY}/${mtdtUuid}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Document type deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to delete document type", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setName("");
    setIsActive(true);
    setDialog({ mode: "create" });
  };

  const openEdit = (row: TravelDocumentTypeV2) => {
    setName(row.name);
    setIsActive(row.isActive);
    setDialog({ mode: "edit", row });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (dialog?.mode === "create") {
      createMutation.mutate({ name: trimmed });
    } else if (dialog?.mode === "edit") {
      updateMutation.mutate({ mtdtUuid: dialog.row.mtdtUuid, data: { name: trimmed, isActive } });
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
            data-testid="button-add-travel-document-type"
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
                  <TableHead className="text-xs text-white w-[80px]">Status</TableHead>
                  <TableHead className="text-xs text-white w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs py-6">Loading...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs py-6" data-testid="text-no-travel-document-types">
                      No document types found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.mtdtUuid} data-testid={`row-travel-document-type-${row.mtdtUuid}`}>
                      <TableCell className="text-xs text-gray-500" data-testid={`text-travel-document-type-entry-id-${row.mtdtUuid}`}>
                        {row.entryId}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-travel-document-type-name-${row.mtdtUuid}`}>
                        {row.name}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-travel-document-type-status-${row.mtdtUuid}`}>
                        {row.isActive ? "Active" : "Inactive"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openEdit(row)}
                              data-testid={`button-edit-travel-document-type-${row.mtdtUuid}`}
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
                              data-testid={`button-delete-travel-document-type-${row.mtdtUuid}`}
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
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Document Type" : "Add Document Type"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit" ? "Update the document type details." : "Create a new travel/identification document type."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dialog?.mode === "edit" && (
              <div className="space-y-2">
                <Label className="text-xs">Entry ID</Label>
                <Input
                  value={dialog.row.entryId}
                  disabled
                  className="h-8 text-xs"
                  data-testid="input-travel-document-type-entry-id"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
                placeholder="e.g. Passport"
                data-testid="input-travel-document-type-name"
              />
            </div>
            {dialog?.mode === "edit" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="travel-document-type-active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                  data-testid="checkbox-travel-document-type-active"
                />
                <Label htmlFor="travel-document-type-active" className="text-xs">Active</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} data-testid="button-cancel-travel-document-type-dialog">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#16569e] hover:bg-[#0f4078] text-white"
              data-testid="button-save-travel-document-type"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-travel-document-type">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.mtdtUuid)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-travel-document-type"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
