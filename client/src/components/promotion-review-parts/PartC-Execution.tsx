import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';

interface PartCExecutionProps extends React.HTMLAttributes<HTMLDivElement> {
  promotionDate: string;
  onSetPromotionDate: (value: string) => void;
  currentUserDisplay?: string;
  onSave?: () => void;
  onSubmit?: () => void;
  disabled?: boolean;
  showPositionSelector?: boolean;
  selectedPosition?: string;
  onOpenPositionSelector?: () => void;
}

export const PartCExecution = memo(function PartCExecution({
  promotionDate,
  onSetPromotionDate,
  currentUserDisplay = 'Current User, Staff',
  onSave,
  onSubmit,
  disabled = false,
  showPositionSelector = false,
  selectedPosition = '',
  onOpenPositionSelector,
  ...restProps
}: PartCExecutionProps) {
  return (
    <div className="bg-white rounded-lg p-6" {...restProps}>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold text-[#16569e]">Part C - Execution</h2>
          <p className="text-sm text-[#60a5fa] mt-1">To be completed by the crew executive/ crew manager</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-[#16569e]">C1 Date of Promotion</h3>
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
          </div>

          <div className="flex items-center gap-4">
            <Label className="text-sm w-48">C1.1 Date of Promotion:</Label>
            <Input 
              type="date" 
              className="w-40"
              placeholder="dd:mm:yy"
              value={promotionDate}
              onChange={(e) => onSetPromotionDate(e.target.value)}
              disabled={disabled}
              data-testid="input-promotion-date"
            />
          </div>

          {showPositionSelector && (
            <div className="flex items-center gap-4">
              <Label className="text-sm w-48">
                C1.2 Select Position:
              </Label>
              {disabled ? (
                <Input
                  className="w-64 bg-gray-100"
                  value={selectedPosition.replace(/_/g, ' ')}
                  readOnly
                  data-testid="input-selected-promotion-position"
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-64 justify-start"
                  onClick={onOpenPositionSelector}
                  data-testid="button-select-promotion-position"
                >
                  {selectedPosition
                    ? selectedPosition.replace(/_/g, ' ')
                    : 'Select Position'}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4">
          <p className="text-sm italic text-[#60a5fa]">Submitted by: {currentUserDisplay}</p>
          <div className="flex gap-3">
            {/* Hidden from UI only (per request) — button remains fully functional/wired (onClick={onSave}); do not remove or disconnect its logic. */}
            <Button 
              type="button"
              variant="outline" 
              className="hidden px-8 bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
              onClick={onSave}
              data-testid="button-save-part-c"
            >
              Save
            </Button>
            <Button 
              type="button"
              className="px-8 bg-green-600 hover:bg-green-700"
              onClick={onSubmit}
              data-testid="button-submit-part-c"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
