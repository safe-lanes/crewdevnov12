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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { NewPlanDialog } from './NewPlanDialog';
import { RotationVersionToggle } from './components/VersionToggle';
import { useRotationPlans, useDeleteRotationPlan } from './hooks/useRotationVersion';
import type { RotationPlan } from '@shared/schema';

export function RotationPlanTable() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<number | string | null>(null);
  const [editingPlan, setEditingPlan] = useState<RotationPlan | null>(null);
  const [newPlanDialogOpen, setNewPlanDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: plans = [], isLoading, isV2 } = useRotationPlans();
  const { deletePlan, isPending: isDeleting } = useDeleteRotationPlan();

  const handleDeleteClick = (id: number | string) => {
    setPlanToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (planToDelete !== null) {
      try {
        await deletePlan(planToDelete);
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

  const handleEditClick = (plan: RotationPlan) => {
    setEditingPlan(plan);
    setNewPlanDialogOpen(true);
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
        <div className="flex items-center gap-4">
          <RotationVersionToggle />
          <Button
            onClick={() => setNewPlanDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
            data-testid="button-new-plan"
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
              plans.map((plan) => {
                const planKey = (plan as any).uuid || plan.id;
                return (
                  <TableRow key={planKey} data-testid={`row-plan-${planKey}`}>
                    <TableCell className="text-sm" data-testid={`text-draft-id-${planKey}`}>{plan.draftId}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-last-edited-${planKey}`}>{plan.lastEdited}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-vessels-${planKey}`}>{parseVessels(plan.vessels)}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-crew-${planKey}`}>{plan.crew}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-plan-dates-${planKey}`}>{plan.planFromDate} - {plan.planToDate}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-created-by-${planKey}`}>{plan.createdBy}</TableCell>
                    <TableCell className="text-sm" data-testid={`text-plan-status-${planKey}`}>{plan.planStatus}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                          onClick={() => handleEditClick(plan)}
                          data-testid={`button-edit-${planKey}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          onClick={() => handleDeleteClick(planKey)}
                          data-testid={`button-delete-${planKey}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
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

      {/* New Plan Dialog - handles both new and edit */}
      <NewPlanDialog 
        open={newPlanDialogOpen} 
        onOpenChange={(open) => {
          setNewPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null); // Clear editing plan when dialog closes
          }
        }}
        editPlan={editingPlan}
      />
    </div>
  );
}
