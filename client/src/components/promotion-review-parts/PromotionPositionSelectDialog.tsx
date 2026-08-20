import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface PromotionPositionSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: string[];
  crewName: string;
  onPositionSelect: (position: string) => void;
}

export function PromotionPositionSelectDialog({
  open,
  onOpenChange,
  positions,
  crewName,
  onPositionSelect,
}: PromotionPositionSelectDialogProps) {
  const [selectedPosition, setSelectedPosition] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedPosition("");
    }
  }, [open]);

  const formatPositionLabel = (position: string) =>
    position.replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Position</DialogTitle>
          <DialogDescription>
            Choose a specific position to promote {crewName} to.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <RadioGroup
            value={selectedPosition}
            onValueChange={setSelectedPosition}
            className="gap-3"
          >
            {positions.map((position) => (
              <div
                key={position}
                className={cn(
                  "flex cursor-pointer items-center space-x-3 rounded-md border p-3 transition-colors",
                  selectedPosition === position
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
                onClick={() => setSelectedPosition(position)}
                data-testid={`radio-promotion-position-${position}`}
              >
                <RadioGroupItem
                  value={position}
                  id={`promotion-position-${position}`}
                />
                <label
                  htmlFor={`promotion-position-${position}`}
                  className="flex-1 cursor-pointer text-sm font-medium"
                >
                  {formatPositionLabel(position)}
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex justify-end gap-2 border-t pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedPosition}
            onClick={() => {
              if (selectedPosition) {
                onPositionSelect(selectedPosition);
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}