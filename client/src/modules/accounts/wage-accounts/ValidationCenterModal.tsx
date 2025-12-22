
/**
 * Validation Center Modal - Popup version for use within other workspaces
 */

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ValidationCenter } from "./ValidationCenter";

interface ValidationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  payRunId: string | null;
  onNavigate: (view: string, payRunId?: string, crewId?: string) => void;
}

export function ValidationCenterModal({ 
  isOpen, 
  onClose, 
  payRunId, 
  onNavigate 
}: ValidationCenterModalProps) {
  const handleNavigate = (view: string, payRunIdParam?: string, crewId?: string) => {
    // Close the modal first, then navigate
    onClose();
    onNavigate(view, payRunIdParam, crewId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Validation Center</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ValidationCenter 
            payRunId={payRunId} 
            onNavigate={handleNavigate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
