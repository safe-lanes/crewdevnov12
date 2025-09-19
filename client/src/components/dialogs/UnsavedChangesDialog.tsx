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
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  title = "Unsaved Changes",
  description = "You have unsaved changes that will be lost if you continue. What would you like to do?"
}: UnsavedChangesDialogProps) {
  const closingViaActionRef = useRef(false);

  const handleSave = () => {
    closingViaActionRef.current = true;
    onSave();
  };

  const handleDiscard = () => {
    closingViaActionRef.current = true;
    onDiscard();
  };

  const handleCancel = () => {
    closingViaActionRef.current = true;
    onCancel();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !closingViaActionRef.current) {
      // Dialog closed via Escape key or outside click
      onCancel();
    }
    if (open) {
      // Reset flag when dialog opens
      closingViaActionRef.current = false;
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-gray-900">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600 mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 mt-6">
          <AlertDialogCancel asChild>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="flex-1 h-9 text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
              data-testid="button-cancel-changes"
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button 
            variant="outline" 
            onClick={handleDiscard}
            className="flex-1 h-9 text-sm border-red-300 text-red-700 hover:bg-red-50"
            data-testid="button-discard-changes"
          >
            Discard Changes
          </Button>
          <AlertDialogAction asChild>
            <Button 
              onClick={handleSave}
              className="flex-1 h-9 text-sm bg-[#16569e] hover:bg-[#0f4078] text-white"
              data-testid="button-save-changes"
            >
              Save Changes
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}