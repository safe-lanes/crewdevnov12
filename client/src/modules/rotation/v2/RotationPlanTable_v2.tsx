import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { NewPlanDialog_v2 } from './NewPlanDialog_v2';
import { RotationVersionToggle } from '../components/VersionToggle';
import { useRotationDraftsV2, useDeleteDraftV2 } from './hooks/useRotationV2';
import type { RotationDraftV2 } from './api/rotationApiV2';

export function RotationPlanTable_v2() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<RotationDraftV2 | null>(null);
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: drafts = [], isLoading } = useRotationDraftsV2();
  const deleteMutation = useDeleteDraftV2();

  const handleDeleteClick = (draftUuid: string) => {
    setPlanToDelete(draftUuid);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (planToDelete !== null) {
      try {
        await deleteMutation.mutateAsync(planToDelete);
        toast({
          title: "Success",
          description: "Rotation plan deleted successfully",
        });
        setDeleteDialogOpen(false);
        setPlanToDelete(null);
      } catch {
        toast({
          title: "Error",
          description: "Failed to delete rotation plan",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditClick = (plan: RotationDraftV2) => {
    setEditingPlan(plan);
    setNewPlanDialogOpen(true);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return <div className="p-4 text-gray-600 dark:text-gray-400">Loading rotation plans...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="Rotation Plan V2">
        <div className="flex items-center gap-4">
          <RotationVersionToggle />
          <Button
            onClick={() => setNewPlanDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
            data-testid="button-new-plan-v2"
          >
            + New Plan
          </Button>
        </div>
      </SectionTitleComponents>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
              <TableHead className="text-white font-normal text-xs h-10">Draft ID</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Last Edited</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Plan from/To</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Plan Status</TableHead>
              <TableHead className="text-white font-normal text-xs h-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No rotation plans found
                </TableCell>
              </TableRow>
            ) : (
              drafts.map((draft) => (
                <TableRow key={draft.draftUuid} data-testid={`row-plan-v2-${draft.draftUuid}`}>
                  <TableCell className="text-sm" data-testid={`text-draft-id-v2-${draft.draftUuid}`}>
                    {draft.draftId}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-last-edited-v2-${draft.draftUuid}`}>
                    {formatDate(draft.lastEdited)}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-plan-dates-v2-${draft.draftUuid}`}>
                    {formatDate(draft.planFromDate)} - {formatDate(draft.planToDate)}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-plan-status-v2-${draft.draftUuid}`}>
                    {draft.planStatus}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={() => handleEditClick(draft)}
                        data-testid={`button-edit-v2-${draft.draftUuid}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        onClick={() => handleDeleteClick(draft.draftUuid)}
                        data-testid={`button-delete-v2-${draft.draftUuid}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the rotation plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-v2">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-v2"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewPlanDialog_v2
        open={newPlanDialogOpen} 
        onOpenChange={(open) => {
          setNewPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
        editPlan={editingPlan}
      />
    </div>
  );
}

export default RotationPlanTable_v2;
