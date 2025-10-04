import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import type { RotationPlan } from '@shared/schema';

export function RotationPlanTable() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RotationPlan | null>(null);
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch rotation plans
  const { data: plans = [], isLoading } = useQuery<RotationPlan[]>({
    queryKey: ['/api/rotation-plans'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/rotation-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotation-plans'] });
      toast({
        title: "Success",
        description: "Rotation plan deleted successfully",
      });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete rotation plan",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (id: number) => {
    setPlanToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (planToDelete !== null) {
      deleteMutation.mutate(planToDelete);
    }
  };

  const handleEditClick = (plan: RotationPlan) => {
    setEditingPlan(plan);
    setEditDialogOpen(true);
  };

  const parseVessels = (vesselsJson: string): string => {
    try {
      const vessels = JSON.parse(vesselsJson);
      return Array.isArray(vessels) ? vessels.join(', ') : vesselsJson;
    } catch {
      return vesselsJson;
    }
  };

  if (isLoading) {
    return <div className="p-4 text-gray-600 dark:text-gray-400">Loading rotation plans...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <SectionTitleComponents title="Rotation Plan">
        <Button
          onClick={() => setNewPlanDialogOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
          data-testid="button-new-plan"
        >
          + New Plan
        </Button>
      </SectionTitleComponents>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
              <TableHead className="text-white font-normal text-xs h-10">Draft ID</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Last Edited</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Vessel</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Crew</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Plan from/To</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Created by</TableHead>
              <TableHead className="text-white font-normal text-xs h-10">Plan Status</TableHead>
              <TableHead className="text-white font-normal text-xs h-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No rotation plans found
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                  <TableCell className="text-sm" data-testid={`text-draft-id-${plan.id}`}>{plan.draftId}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-last-edited-${plan.id}`}>{plan.lastEdited}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-vessels-${plan.id}`}>{parseVessels(plan.vessels)}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-crew-${plan.id}`}>{plan.crew}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-plan-dates-${plan.id}`}>{plan.planFromDate} - {plan.planToDate}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-created-by-${plan.id}`}>{plan.createdBy}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-plan-status-${plan.id}`}>{plan.planStatus}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={() => handleEditClick(plan)}
                        data-testid={`button-edit-${plan.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        onClick={() => handleDeleteClick(plan.id)}
                        data-testid={`button-delete-${plan.id}`}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the rotation plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog - placeholder for now, to be implemented in next instructions */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Rotation Plan</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-gray-600 dark:text-gray-400">
            Form details will be provided in the next instructions
          </div>
        </DialogContent>
      </Dialog>

      {/* New Plan Dialog - placeholder for now, to be implemented in next instructions */}
      <Dialog open={newPlanDialogOpen} onOpenChange={setNewPlanDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Rotation Plan</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-gray-600 dark:text-gray-400">
            Form details will be provided in the next instructions
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
